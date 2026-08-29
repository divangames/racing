////////////////////////////////////////////////////////
//
// Реплики гонщиков: JSON из папки voice/, случайный дубль,
// выноска у аватара в списке мест.
//
////////////////////////////////////////////////////////
'use strict';

const VOICE_LIFE = 3.15;
const VOICE_MAX = 2;
const VOICE_GAP = 3.4;

/** Банки, очередь и живые выноски. */
const VOICE = {
 banks: {},
 host: null,
 shown: [],
 wait: [],
 lastAny: {},
 skipFile: {},
 audio: null,
 ready: false
};

/** Индекс гонщика в CHARS, иначе -1. */
function voiceCharIdx(r) {
 if (!r || r.chIdx == null || r.chIdx < 0) return -1;
 return r.chIdx | 0;
}

/** Папка MP3: assets/data/players/NN/voice/. */
function voiceDirOf(chIdx) {
 if (chIdx < 0) return '';
 if (typeof playerVoiceDir === 'function') return playerVoiceDir(chIdx);
 const nn = String((chIdx | 0) + 1).padStart(2, '0');
 return 'assets/data/players/' + nn + '/voice/';
}

/** Грузит один lines.json. */
function voiceLoadJson(url, key) {
 fetch(url, { cache: 'no-cache' }).then(function (res) {
  if (!res.ok) return null;
  return res.json();
 }).then(function (data) {
  if (!data || !data.cues) return;
  if (key === 'host') VOICE.host = data;
  else VOICE.banks[key] = data;
 }).catch(function () {});
}

/** Качает банки всех гонщиков и ведущего. */
function voicePreload() {
 if (VOICE.ready) return;
 VOICE.ready = true;
 if (typeof CHARS === 'undefined') return;
 for (let i = 0; i < CHARS.length; i++) {
  voiceLoadJson(voiceDirOf(i) + 'lines.json', i);
 }
 voiceLoadJson('assets/data/players/host/voice/lines.json', 'host');
}

/** Случайный дубль события. */
function voicePickTake(bank, cueId) {
 if (!bank || !bank.cues) return null;
 const cue = bank.cues.find(function (c) { return c.id === cueId; });
 if (!cue || !cue.takes || !cue.takes.length) return null;
 return cue.takes[(Math.random() * cue.takes.length) | 0];
}

/** Сброс выносок на новый заезд. */
function voiceReset() {
 VOICE.shown = [];
 VOICE.wait = [];
 VOICE.lastAny = {};
}

/** Сейчас говорит этот гонщик. */
function voiceIsTalking(r) {
 return VOICE.shown.some(function (s) { return s.r === r; });
}

/** Можно ли снова сказать эту реплику. */
function voiceCoolOk(r, cue, gap) {
 const t = (typeof R !== 'undefined' && R && R.time) || 0;
 const id = voiceCharIdx(r) + ':' + cue;
 const last = VOICE.lastAny[id];
 if (last != null && t - last < (gap == null ? VOICE_GAP : gap)) return false;
 return true;
}

/** Помечает кулдаун. */
function voiceMark(r, cue) {
 const t = (typeof R !== 'undefined' && R && R.time) || 0;
 VOICE.lastAny[voiceCharIdx(r) + ':' + cue] = t;
 VOICE.lastAny[voiceCharIdx(r) + ':any'] = t;
}

/** Играет MP3, если файл не пустой. */
function voicePlayFile(url) {
 if (!url || VOICE.skipFile[url]) return;
 const snd = typeof settings !== 'undefined' && settings && settings.sound;
 if (!snd || snd.sfxOn === false) return;
 try {
  if (VOICE.audio) { VOICE.audio.pause(); VOICE.audio.src = ''; }
 } catch (e) {}
 const a = new Audio();
 let bad = false;
 const fail = function () {
  if (bad) return;
  bad = true;
  VOICE.skipFile[url] = true;
 };
 a.preload = 'auto';
 a.referrerPolicy = 'no-referrer';
 a.volume = Math.max(0, Math.min(1, ((snd.sfx || 80) / 100) * 0.92));
 a.addEventListener('error', fail);
 a.addEventListener('canplaythrough', function () {
  if (bad) return;
  a.play().catch(fail);
 }, { once: true });
 a.src = url;
 VOICE.audio = a;
}

/** Ставит выноску. opts: delay, chance, force, gap. */
function voiceSay(r, cue, opts) {
 opts = opts || {};
 if (!r || typeof R === 'undefined' || !R || R.demo) return;
 if (typeof labTest !== 'undefined' && labTest) return;
 const chIdx = voiceCharIdx(r);
 if (chIdx < 0) return;
 if (opts.chance != null && Math.random() > opts.chance) return;
 if (!opts.force && voiceIsTalking(r)) return;
 if (!opts.force && !voiceCoolOk(r, 'any', opts.gap || VOICE_GAP)) return;
 if (!opts.force && !voiceCoolOk(r, cue, opts.gap || 7)) return;
 const delay = opts.delay || 0;
 if (delay > 0) {
  VOICE.wait.push({ r: r, cue: cue, at: R.time + delay, opts: { force: !!opts.force, gap: opts.gap } });
  return;
 }
 const take = voicePickTake(VOICE.banks[chIdx], cue);
 if (!take || !take.text) return;
 if (VOICE.shown.length >= VOICE_MAX && !opts.force) {
  VOICE.shown.sort(function (a, b) { return a.t0 - b.t0; });
  VOICE.shown.shift();
 }
 if (opts.force) {
  VOICE.shown = VOICE.shown.filter(function (s) { return s.r !== r; });
 }
 voiceMark(r, cue);
 VOICE.shown.push({
  r: r,
  text: String(take.text),
  col: (r.ch && r.ch.col) || '#ffd23f',
  t0: R.time,
  life: VOICE_LIFE
 });
 const file = take.file ? (voiceDirOf(chIdx) + take.file) : '';
 if (file) voicePlayFile(file);
}

/** Очередь и срок жизни выносок. */
function voiceTick() {
 if (!VOICE.wait.length && !VOICE.shown.length) return;
 if (typeof R === 'undefined' || !R) return;
 const t = R.time || 0;
 const keep = [];
 for (let i = 0; i < VOICE.wait.length; i++) {
  const q = VOICE.wait[i];
  if (!q.r || q.r.dead) continue;
  if (t >= q.at) voiceSay(q.r, q.cue, q.opts || {});
  else keep.push(q);
 }
 VOICE.wait = keep;
 VOICE.shown = VOICE.shown.filter(function (s) {
  return s.r && (t - s.t0) < s.life;
 });
}

/** Старт: игрок и часть соперников. */
function voiceOnStart() {
 if (typeof R === 'undefined' || !R || !R.racers) return;
 R.racers.forEach(function (r, i) {
  if (voiceCharIdx(r) < 0) return;
  if (r.isP || Math.random() < 0.42) {
   voiceSay(r, 'start', { delay: 0.12 + i * 0.28 });
  }
 });
}

/** Погоня: второй дышит в спину. */
function voiceOnChase() {
 if (typeof R === 'undefined' || !R || !R.order || R.order.length < 2) return;
 const a = R.order[0], b = R.order[1];
 if (!a || !b || a.finished || b.finished || b.dead) return;
 if ((a.prog - b.prog) > 55) return;
 voiceSay(b, 'chase', { chance: 0.012, gap: 11 });
}

/** Альфа выноски. */
function voiceAlpha(s) {
 const t = (R.time || 0) - s.t0;
 const reduce = typeof hudMotionOk === 'function' ? !hudMotionOk() : false;
 if (reduce) return 1;
 if (t < 0.14) return t / 0.14;
 if (t > s.life - 0.4) return Math.max(0, (s.life - t) / 0.4);
 return 1;
}

/** Выноска справа от аватара в колонке мест. */
function drawHudVoiceBarks(c, packX, packY, packW, fx) {
 voiceTick();
 if (!VOICE.shown.length || typeof R === 'undefined' || !R || !R.order) return;
 const mot = typeof hudMotionOk === 'function' ? hudMotionOk() : true;
 const size = 12;
 const lineH = 15;
 const padX = 11;
 const padY = 8;
 const maxW = 176;
 VOICE.shown.forEach(function (s) {
  const i = R.order.indexOf(s.r);
  if (i < 0) return;
  const id = R.racers.indexOf(s.r);
  const row = (fx && fx.rowY && fx.rowY[id] != null) ? fx.rowY[id] : i * 32;
  const ay = packY + 16 + row;
  const ax = packX + packW + 8;
  const a = voiceAlpha(s);
  if (a <= 0.02) return;
  const lines = layoutLines(c, s.text, maxW, size, F_B).slice(0, 3);
  let tw = 0;
  c.font = size + 'px ' + F_B;
  for (let li = 0; li < lines.length; li++) {
   tw = Math.max(tw, c.measureText(lines[li]).width);
  }
  const bw = Math.ceil(tw) + padX * 2;
  const bh = lines.length * lineH + padY * 2;
  const pop = mot ? (0.94 + a * 0.06) : 1;
  const bx = ax + 10;
  const by = ay - bh / 2;
  c.save();
  c.globalAlpha = a;
  c.translate(bx + bw * 0.5, ay);
  c.scale(pop, pop);
  c.translate(-(bx + bw * 0.5), -ay);
  c.fillStyle = s.col;
  c.beginPath();
  c.moveTo(ax + 1, ay);
  c.lineTo(bx + 6, ay - 5);
  c.lineTo(bx + 6, ay + 5);
  c.closePath();
  c.fill();
  c.fillStyle = 'rgba(10,8,14,.94)';
  rr(c, bx, by, bw, bh, 10);
  c.fill();
  c.strokeStyle = s.col;
  c.lineWidth = 1.6;
  rr(c, bx, by, bw, bh, 10);
  c.stroke();
  const shine = c.createLinearGradient(bx, by, bx, by + 10);
  shine.addColorStop(0, 'rgba(255,244,220,.14)');
  shine.addColorStop(1, 'rgba(255,244,220,0)');
  c.fillStyle = shine;
  rr(c, bx + 1, by + 1, bw - 2, 9, 8);
  c.fill();
  const tx = bx + bw / 2;
  const ty = by + padY + lineH * 0.5;
  for (let li = 0; li < lines.length; li++) {
   txt(c, lines[li], tx, ty + li * lineH, size, '#f4efe4', 'center', F_B);
  }
  c.restore();
 });
}

function voiceBoot() {
 if (typeof CHARS === 'undefined' || !CHARS.length) {
  setTimeout(voiceBoot, 40);
  return;
 }
 voicePreload();
}

if (typeof window !== 'undefined') {
 window.VOICE = VOICE;
 window.voicePreload = voicePreload;
 window.voiceReset = voiceReset;
 window.voiceSay = voiceSay;
 window.voiceOnStart = voiceOnStart;
 window.voiceOnChase = voiceOnChase;
 window.drawHudVoiceBarks = drawHudVoiceBarks;
}

voiceBoot();
