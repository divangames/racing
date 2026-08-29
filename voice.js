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
 objectUrl: null,
 ready: false,
 nameBark: null,
 nameGen: 0
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

/** Дубли события в случайном порядке. */
function voiceShuffleTakes(bank, cueId) {
 if (!bank || !bank.cues) return [];
 const cue = bank.cues.find(function (c) { return c.id === cueId; });
 if (!cue || !cue.takes) return [];
 const takes = cue.takes.slice();
 for (let i = takes.length - 1; i > 0; i--) {
  const j = (Math.random() * (i + 1)) | 0;
  const tmp = takes[i];
  takes[i] = takes[j];
  takes[j] = tmp;
 }
 return takes;
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

/** Останавливает текущий MP3 реплики. */
function voiceStopAudio() {
 if (VOICE.fetchAc) {
  try { VOICE.fetchAc.abort(); } catch (e) {}
  VOICE.fetchAc = null;
 }
 try {
  if (VOICE.audio) { VOICE.audio.pause(); VOICE.audio.src = ''; }
 } catch (e) {}
 VOICE.audio = null;
 if (VOICE.objectUrl) {
  try { URL.revokeObjectURL(VOICE.objectUrl); } catch (e) {}
  VOICE.objectUrl = null;
 }
}

/** Играет MP3, если файл не пустой заглушкой. onFail — нет звука, onOk — пошёл. */
function voicePlayFile(url, onFail, onOk) {
 const miss = function () {
  if (typeof onFail === 'function') onFail();
 };
 if (!url || VOICE.skipFile[url]) { miss(); return; }
 const snd = typeof settings !== 'undefined' && settings && settings.sound;
 if (!snd || snd.sfxOn === false) { miss(); return; }
 voiceStopAudio();
 const ac = typeof AbortController === 'function' ? new AbortController() : null;
 VOICE.fetchAc = ac;
 fetch(url, { cache: 'no-cache', signal: ac && ac.signal }).then(function (res) {
  if (!res.ok) throw new Error('http');
  return res.blob();
 }).then(function (blob) {
  if (ac && VOICE.fetchAc !== ac) return false;
  if (!blob || blob.size < 400) throw new Error('empty');
  const a = new Audio();
  const href = URL.createObjectURL(blob);
  VOICE.objectUrl = href;
  a.preload = 'auto';
  a.volume = Math.max(0, Math.min(1, ((snd.sfx || 80) / 100) * 0.92));
  a.addEventListener('error', function () {
   VOICE.skipFile[url] = true;
   miss();
  }, { once: true });
  a.src = href;
  VOICE.audio = a;
  return a.play().then(function () { return true; });
 }).then(function (ok) {
  if (ok !== true) return;
  if (typeof onOk === 'function') onOk();
 }).catch(function (err) {
  if (err && err.name === 'AbortError') return;
  if (ac && VOICE.fetchAc !== ac) return;
  VOICE.skipFile[url] = true;
  miss();
 });
}

/** Выноска текста на выборе гонщика. */
function voiceSetNameBark(chIdx, take) {
 const ch = typeof CHARS !== 'undefined' ? CHARS[chIdx] : null;
 VOICE.nameBark = {
  text: String((take && take.text) || ''),
  col: (ch && ch.col) || '#ffd23f',
  t0: (typeof performance !== 'undefined' ? performance.now() : Date.now()),
  idx: chIdx
 };
}

/** Выбор гонщика: случайный дубль события name из lines.json. */
function voiceSayName(chIdx) {
 const gen = ++VOICE.nameGen;
 VOICE.nameBark = null;
 voiceStopAudio();
 if (chIdx == null || chIdx < 0) return;
 voicePreload();
 let waits = 0;
 const go = function () {
  if (gen !== VOICE.nameGen) return;
  const bank = VOICE.banks[chIdx];
  if (!bank) {
   waits++;
   if (waits > 40) return;
   setTimeout(go, 50);
   return;
  }
  const takes = voiceShuffleTakes(bank, 'name');
  if (!takes.length) return;
  const dir = voiceDirOf(chIdx);
  const snd = typeof settings !== 'undefined' && settings && settings.sound;
  const muted = !snd || snd.sfxOn === false;
  const tryAt = function (i) {
   if (gen !== VOICE.nameGen) return;
   if (i >= takes.length) {
    voiceSetNameBark(chIdx, takes[(Math.random() * takes.length) | 0]);
    return;
   }
   const take = takes[i];
   if (muted || !take.file) {
    voiceSetNameBark(chIdx, take);
    return;
   }
   voicePlayFile(dir + take.file, function () {
    tryAt(i + 1);
   }, function () {
    if (gen !== VOICE.nameGen) return;
    voiceSetNameBark(chIdx, take);
   });
  };
  tryAt(0);
 };
 go();
}

/** Сброс голоса имени при уходе с экрана. */
function voiceStopName() {
 VOICE.nameGen++;
 VOICE.nameBark = null;
 voiceStopAudio();
}

/** Выноска реплики на карточке выбранного гонщика. */
function drawCharNameBark(c, card) {
 const s = VOICE.nameBark;
 if (!s || !s.text || !card || s.idx !== card.idx) return;
 const age = ((typeof performance !== 'undefined' ? performance.now() : Date.now()) - s.t0) / 1000;
 if (age > 5.4) return;
 let a = 1;
 if (age < 0.12) a = age / 0.12;
 else if (age > 4.7) a = Math.max(0, (5.4 - age) / 0.7);
 if (a <= 0.02) return;
 const size = 13;
 const lineH = 16;
 const padX = 12;
 const padY = 9;
 const maxW = Math.max(120, card.w - 28);
 const lines = (typeof layoutLines === 'function' ? layoutLines(c, s.text, maxW, size, F_B) : [s.text]).slice(0, 3);
 let tw = 0;
 c.font = size + 'px ' + F_B;
 for (let li = 0; li < lines.length; li++) tw = Math.max(tw, c.measureText(lines[li]).width);
 const bw = Math.min(card.w - 16, Math.ceil(tw) + padX * 2);
 const bh = lines.length * lineH + padY * 2;
 const bx = card.x + (card.w - bw) / 2;
 const by = card.y + 8;
 c.save();
 c.globalAlpha = a;
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
 c.fillStyle = s.col;
 c.beginPath();
 c.moveTo(bx + bw / 2 - 6, by + bh);
 c.lineTo(bx + bw / 2 + 6, by + bh);
 c.lineTo(bx + bw / 2, by + bh + 7);
 c.closePath();
 c.fill();
 const tx = bx + bw / 2;
 const ty = by + padY + lineH * 0.5;
 for (let li = 0; li < lines.length; li++) {
  txt(c, lines[li], tx, ty + li * lineH, size, '#f4efe4', 'center', F_B);
 }
 c.restore();
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
 window.voiceSayName = voiceSayName;
 window.voiceStopName = voiceStopName;
 window.voiceOnStart = voiceOnStart;
 window.voiceOnChase = voiceOnChase;
 window.drawHudVoiceBarks = drawHudVoiceBarks;
 window.drawCharNameBark = drawCharNameBark;
}

voiceBoot();
