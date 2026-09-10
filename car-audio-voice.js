////////////////////////////////////////////////////////
//
// Голос одного двигателя: клипы, лупы, без наложения на слоте
//
////////////////////////////////////////////////////////
'use strict';

const CAR_ENGINE_STD = 'assets/sounds/engine/';
const CAR_ENGINE_LIB = 'assets/sounds/cars/engine/';
const CAR_ENGINE_WAV = 0.62;
const CAR_ENGINE_CLIPS = [1, 2, 3, 5];

const carEngineShare = {
  miss: {},
  buf: {},
  load: {},
  html: {},
  span: {}
};

/** Папка звуков слота: 0 → assets/data/cars/01/sound/. */
function carEngineDir(idx) {
  const nn = String((idx | 0) + 1).padStart(2, '0');
  return 'assets/data/cars/' + nn + '/sound/';
}

/** Имя пака двигателя: лаборатория, кузов, иначе car.json с диска. */
function carEnginePackName(idx) {
  const read = function (obj) {
    const pack = obj && obj.audio && obj.audio.engine;
    const name = String(pack || '').trim();
    if (!name || name.length > 80 || name.indexOf('..') >= 0 || /[\\/]/.test(name)) return '';
    return name;
  };
  if (typeof editorCarConfig === 'function') {
    const fromLab = read(editorCarConfig(idx));
    if (fromLab) return fromLab;
  }
  const cars = typeof CARS !== 'undefined' ? CARS : [];
  const fromCar = read(cars[idx]);
  if (fromCar) return fromCar;
  if (typeof EditorData !== 'undefined' && EditorData.diskAudio) {
    return read({audio: EditorData.diskAudio(idx)});
  }
  return '';
}

/** Пак из лаборатории: assets/sounds/cars/engine/<имя>/sound/. */
function carEngineLibDir(idx) {
  const name = carEnginePackName(idx);
  if (!name) return '';
  return CAR_ENGINE_LIB + name + '/sound/';
}

/** Имя клипа: 1 → sound_001.wav. */
function carEngineFile(n) {
  return 'sound_' + String(n | 0).padStart(3, '0') + '.wav';
}

/** Сначала выбранный пак, затем файлы кузова, затем стандарт. */
function carEngineUrls(idx, n) {
  const name = carEngineFile(n);
  const alt = 'Sound_' + String(n | 0).padStart(3, '0') + '.wav';
  const out = [];
  const lib = idx >= 0 ? carEngineLibDir(idx) : '';
  if (lib) {
    out.push(lib + name);
    if (alt !== name) out.push(lib + alt);
  }
  if (idx >= 0) out.push(carEngineDir(idx) + name);
  out.push(CAR_ENGINE_STD + name);
  return out;
}

/** Громкость эффектов с потолком двигателя. */
function carEngineVol() {
  if (typeof settings === 'undefined' || !settings || !settings.sound) return 0;
  if (settings.sound.sfxOn === false) return 0;
  return Math.max(0, Math.min(1, (settings.sound.sfx || 80) / 100)) * CAR_ENGINE_WAV;
}

/** Помечает URL, который не открылся. */
function carEngineMarkMiss(url) {
  carEngineShare.miss[url] = true;
}

/** Десктоп: WAV через HTMLAudio, decodeAudioData по rnr:// часто пустой. */
function carEngineDesktop() {
  return typeof window !== 'undefined' && !!window.__RNR_DESKTOP__;
}

/** Первый уже декодированный клип: сначала кузов, иначе стандарт. */
function carEnginePick(idx, n) {
  const urls = carEngineUrls(idx, n);
  for (let i = 0; i < urls.length; i++) {
    const buf = carEngineShare.buf[urls[i]];
    if (buf && buf !== 'bad') return urls[i];
  }
  if (carEngineDesktop()) {
    for (let i = 0; i < urls.length; i++) {
      if (carEngineShare.buf[urls[i]] === 'bad' || carEngineShare.miss[urls[i]]) continue;
      return urls[i];
    }
  }
  return '';
}

/** Прогревает WAV в кэше браузера, чтобы смена клипа не ждала load. */
function carEngineHtmlWarm(url) {
  if (!url || carEngineShare.miss[url] || carEngineShare.html[url]) return;
  const el = new Audio();
  el.preload = 'auto';
  el.referrerPolicy = 'no-referrer';
  el.src = carEngineHtmlSrc(url);
  try { el.load(); } catch (err) {}
  carEngineShare.html[url] = el;
}

/** Грузит один кандидат клипа: пак, затем кузов, затем стандарт. Без лишних fetch. */
function carEngineWarmClip(idx, n) {
  const urls = carEngineUrls(idx, n);
  const rest = [];
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const buf = carEngineShare.buf[url];
    if (buf && buf !== 'bad') return;
    if (buf === 'bad' || carEngineShare.miss[url]) continue;
    if (carEngineDesktop()) carEngineHtmlWarm(url);
    rest.push(url);
  }
  if (rest.length) carEngineLoad(rest[0], rest.slice(1));
}

/** Набор, луп хода, сброс и холостой — без sound_004. */
function carEngineWarmPack(idx) {
  for (let i = 0; i < CAR_ENGINE_CLIPS.length; i++) carEngineWarmClip(idx, CAR_ENGINE_CLIPS[i]);
}

/** src с учётом кэша и адреса страницы (rnr:// и Pages). */
function carEngineSrc(url) {
  if (!url) return '';
  const src = (typeof bootMediaSrc === 'function') ? bootMediaSrc(url) : url;
  if (!src || /^blob:|^data:/i.test(src)) return src;
  const slash = String(src).replace(/\\/g, '/');
  try {
    if (typeof location !== 'undefined' && location.href) {
      return new URL(slash, location.href).href;
    }
  } catch (err) {}
  try {
    return encodeURI(slash);
  } catch (e) {
    return slash;
  }
}

/** Декодирует PCM в буфер, и callback-API, и Promise. */
function carEngineDecode(raw) {
  return new Promise(function (resolve, reject) {
    let done = false;
    const finish = function (ok, val) {
      if (done) return;
      done = true;
      if (ok) resolve(val);
      else reject(val);
    };
    try {
      const ret = AU.ctx.decodeAudioData(raw.slice(0), function (buf) {
        finish(true, buf);
      }, function (err) {
        finish(false, err || new Error('decode'));
      });
      if (ret && typeof ret.then === 'function') {
        ret.then(function (buf) { finish(true, buf); }, function (err) { finish(false, err); });
      }
    } catch (err) {
      finish(false, err);
    }
  });
}

/** Следующий URL, если этот не открылся. */
function carEngineLoadNext(rest) {
  if (!rest || !rest.length) return;
  for (let i = 0; i < rest.length; i++) {
    const url = rest[i];
    if (carEngineShare.buf[url] && carEngineShare.buf[url] !== 'bad') return;
    if (carEngineShare.buf[url] === 'bad' || carEngineShare.miss[url]) continue;
    carEngineLoad(url, rest.slice(i + 1));
    return;
  }
}

/** Декодирует WAV в буфер контекста. rest — запасные пути. */
function carEngineLoad(url, rest) {
  if (!url || !AU.ctx) return;
  if (carEngineShare.buf[url] && carEngineShare.buf[url] !== 'bad') return;
  if (carEngineShare.buf[url] === 'bad' || carEngineShare.miss[url]) {
    carEngineLoadNext(rest);
    return;
  }
  const started = carEngineShare.load[url];
  if (started && (typeof started !== 'number' || Date.now() - started < 2500)) return;
  carEngineShare.load[url] = Date.now();
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 3500);
  const opts = ctrl ? {signal: ctrl.signal} : {};
  fetch(carEngineSrc(url), opts).then(function (res) {
    if (!res.ok) {
      const err = new Error('no wav');
      err.skip = true;
      throw err;
    }
    return res.arrayBuffer();
  }).then(function (raw) {
    if (!raw || !raw.byteLength) {
      const err = new Error('empty');
      err.skip = true;
      throw err;
    }
    carEngineShare.span[url] = carEngineSpanFromWav(raw);
    if (!AU.ctx) {
      carEngineShare.buf[url] = 'html';
      return null;
    }
    return carEngineDecode(raw).then(function (buf) {
      if (!buf || !buf.length) throw new Error('decode');
      carEngineShare.buf[url] = buf;
      carEngineShare.span[url] = carEngineSpanFromBuffer(buf);
    }).catch(function () {
      carEngineShare.buf[url] = 'html';
    });
  }).then(function () {
    carEngineShare.load[url] = 0;
  }).catch(function (err) {
    carEngineShare.load[url] = 0;
    if (err && err.skip) {
      carEngineShare.buf[url] = 'bad';
      carEngineMarkMiss(url);
      carEngineLoadNext(rest);
      return;
    }
    if (!carEngineShare.buf[url] || carEngineShare.buf[url] === 'bad') {
      carEngineShare.buf[url] = 'html';
    }
  }).finally(function () {
    clearTimeout(timer);
  });
}

/** Тихие края PCM — иначе луп щёлкает паузой (у части паков тишина в начале). */
function carEngineSpanFromSamples(ch, sr) {
  const n = ch.length;
  if (!n || !sr) return {start: 0, end: 0};
  const th = 0.018;
  let a = 0;
  let b = n - 1;
  while (a < b && Math.abs(ch[a]) < th) a++;
  while (b > a && Math.abs(ch[b]) < th) b--;
  const pad = Math.max(1, (sr * 0.003) | 0);
  a = Math.max(0, a - pad);
  b = Math.min(n, b + pad + 1);
  if ((b - a) / sr < 0.05) return {start: 0, end: n / sr};
  return {start: a / sr, end: b / sr};
}

/** Края лупа из декодированного буфера. */
function carEngineSpanFromBuffer(buf) {
  try {
    return carEngineSpanFromSamples(buf.getChannelData(0), buf.sampleRate);
  } catch (err) {
    return {start: 0, end: buf.duration || 0};
  }
}

/** Края лупа из WAV, если decodeAudioData недоступен. */
function carEngineSpanFromWav(raw) {
  try {
    const bytes = new Uint8Array(raw);
    const view = new DataView(raw);
    if (bytes.length < 44) return {start: 0, end: 0};
    let o = 12;
    let ch = 1;
    let sr = 44100;
    let bits = 16;
    let dataOff = 0;
    let dataLen = 0;
    while (o + 8 <= bytes.length) {
      const id = String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
      const sz = view.getUint32(o + 4, true);
      if (id === 'fmt ') {
        ch = view.getUint16(o + 10, true) || 1;
        sr = view.getUint32(o + 12, true) || 44100;
        bits = view.getUint16(o + 22, true) || 16;
      } else if (id === 'data') {
        dataOff = o + 8;
        dataLen = sz;
        break;
      }
      o += 8 + sz + (sz % 2);
    }
    if (!dataOff || bits !== 16) return {start: 0, end: dataLen / Math.max(1, sr * ch * 2)};
    const step = ch * 2;
    const frames = Math.floor(dataLen / step);
    const samples = new Float32Array(frames);
    for (let i = 0; i < frames; i++) {
      samples[i] = view.getInt16(dataOff + i * step, true) / 32768;
    }
    return carEngineSpanFromSamples(samples, sr);
  } catch (err) {
    return {start: 0, end: 0};
  }
}

/** Газ: клавиша у игрока, ith у ИИ. */
function carEngineGas(racer) {
  if (!racer) return 0;
  if ((racer.nitro || 0) > 0) return 1;
  if (racer.isP) {
    if (typeof ctrlHeld === 'function' && ctrlHeld('up')) return 1;
    return 0;
  }
  const th = racer.ith;
  if (typeof th === 'number' && th > 0.2) return th;
  return 0;
}

/** Стоит: низкая скорость или отсчёт на решётке. Финиш не режет сброс газа. */
function carEngineStill(racer, n, spd) {
  if (typeof R !== 'undefined' && R && R.phase === 'count') return true;
  if (spd < 22 || n < 0.06) return true;
  return false;
}

/** Тон клипа по ходу. */
function carEngineRate(want, n, pulls) {
  const gear = Math.min(5, Math.floor(Math.max(0, n) * 5));
  if (want === 'accel') return 0.88 + Math.min(4, pulls) * 0.055 + gear * 0.02;
  if (want === 'drive' || want === 'top') return 0.92 + n * 0.18;
  if (want === 'dump') return 0.9 + n * 0.16;
  if (want === 'idle') return 0.96 + n * 0.12;
  return 1;
}

/** Номер лупа: ход — 002, стоянка — 005. */
function carEngineLoopNum(want) {
  if (want === 'top' || want === 'drive') return 2;
  return 5;
}

/** Громкость лупа. */
function carEngineLoopVol(want, vol) {
  return vol * (want === 'idle' ? 0.78 : 0.95);
}

/** Пустой слот голоса. */
function carEngineMakeSlot() {
  return {
    racer: null,
    idx: -1,
    want: '',
    lastGas: false,
    pulls: 0,
    n: 0,
    gas: 0,
    voice: null,
    shot: false,
    live: false,
    pan: 0,
    airHeld: false,
    htmlPool: null,
    htmlRaf: 0
  };
}

/** Тег из пула слота, уже с src — без повторного load. tag: a/b для бесшовного лупа. */
function carEngineHtmlEl(slot, url, tag) {
  if (!slot.htmlPool) slot.htmlPool = {};
  const key = tag ? url + '|' + tag : url;
  let el = slot.htmlPool[key];
  if (el) return el;
  el = new Audio();
  el.preload = 'auto';
  el.referrerPolicy = 'no-referrer';
  el.src = carEngineHtmlSrc(url);
  try { el.load(); } catch (err) {}
  slot.htmlPool[key] = el;
  return el;
}

/** Элемент лежит в пуле слота. */
function carEngineHtmlPooled(slot, el) {
  const pool = slot.htmlPool;
  if (!pool || !el) return false;
  for (const key in pool) {
    if (pool[key] === el) return true;
  }
  return false;
}

/** Глушит остальные клипы слота, не сбрасывая кэш. */
function carEngineMuteHtmlOthers(slot, keep) {
  const pool = slot.htmlPool;
  if (!pool) return;
  for (const key in pool) {
    const el = pool[key];
    if (!el || el === keep) continue;
    try { el.onended = null; } catch (err) {}
    try { el.onerror = null; } catch (err) {}
    try { if (!el.paused) el.pause(); } catch (err) {}
    try { el.currentTime = 0; } catch (err) {}
  }
}

/** Снимает пул HTML, когда меняется кузов или слот гасится. */
function carEngineDrainHtmlPool(slot) {
  const pool = slot.htmlPool;
  if (!pool) return;
  for (const key in pool) {
    const el = pool[key];
    try { el.onended = null; el.onerror = null; el.pause(); el.removeAttribute('src'); el.load(); } catch (err) {}
  }
  slot.htmlPool = null;
}

/** Снимает источник слота, пул WAV оставляет. */
function carEngineKillSlot(slot) {
  if (!slot) return;
  if (slot.htmlRaf) {
    try { cancelAnimationFrame(slot.htmlRaf); } catch (err) {}
    slot.htmlRaf = 0;
  }
  const v = slot.voice;
  if (v) {
    try {
      if (v.el) {
        v.el.onended = null;
        v.el.onerror = null;
        v.el.pause();
        if (!carEngineHtmlPooled(slot, v.el)) {
          v.el.removeAttribute('src');
          v.el.load();
        }
      }
    } catch (err) {}
    try { v.src.onended = null; } catch (err) {}
    try { v.src.stop(); } catch (err) {}
    try { if (v.media) v.media.disconnect(); } catch (err) {}
    try { v.src.disconnect(); } catch (err) {}
    try { v.gain.disconnect(); } catch (err) {}
    try { if (v.pan) v.pan.disconnect(); } catch (err) {}
  }
  slot.voice = null;
  slot.shot = false;
}

/** Громкость, тон и панорама без перезапуска клипа. */
function carEngineTouchSlot(slot, vol, rate) {
  const v = slot && slot.voice;
  if (!v) return;
  const pitch = rate ? Math.max(0.7, Math.min(1.45, rate)) : 0;
  if (v.el) {
    try { v.el.volume = Math.max(0, Math.min(1, vol)); } catch (err) {}
    if (pitch) {
      try { v.el.playbackRate = pitch; } catch (err) {}
    }
  }
  if (v.gain) {
    try { v.gain.gain.value = vol; } catch (err) {}
  }
  if (pitch && v.src && v.src.playbackRate) {
    try { v.src.playbackRate.value = pitch; } catch (err) {}
  }
  if (v.pan) {
    try { v.pan.pan.value = slot.pan || 0; } catch (err) {}
  }
}

/**
 * URL для тега Audio — как у SFX, плюс пробелы в имени пака.
 */
function carEngineHtmlSrc(url) {
  const raw = (typeof bootMediaSrc === 'function') ? bootMediaSrc(url) : url;
  const slash = String(raw || url || '').replace(/\\/g, '/');
  if (!/^blob:|^data:/i.test(slash)) {
    try {
      if (typeof location !== 'undefined' && location.href) return new URL(slash, location.href).href;
    } catch (err) {}
  }
  try {
    return encodeURI(slash);
  } catch (err) {
    return slash;
  }
}

/**
 * Клип как money.mp3: тег Audio сразу в динамики.
 * Луп не через el.loop — у Chromium на WAV стык с паузой.
 */
function carEnginePlayHtml(slot, url, loop, vol, rate, force) {
  const pitch = Math.max(0.7, Math.min(1.45, rate || 1));
  const loud = Math.max(0, Math.min(1, vol));
  const cur = slot.voice;
  if (!force && cur && cur.el && cur.url === url && cur.loop === loop) {
    carEngineTouchSlot(slot, loud, pitch);
    if (cur.el.paused) {
      const retry = cur.el.play();
      if (retry && typeof retry.catch === 'function') retry.catch(function () {});
    }
    if (loop) carEngineHtmlLoopArm(slot);
    return true;
  }
  const tag = loop ? 'a' : '';
  const el = carEngineHtmlEl(slot, url, tag);
  carEngineMuteHtmlOthers(slot, el);
  if (cur && cur.el && cur.el !== el) {
    try { cur.el.onended = null; } catch (err) {}
  }
  el.loop = false;
  el.volume = loud;
  try { el.playbackRate = pitch; } catch (err) {}
  el.onerror = function () {
    carEngineMarkMiss(url);
    carEngineShare.buf[url] = 'bad';
    if (slot.voice && slot.voice.el === el) carEngineKillSlot(slot);
  };
  const span = carEngineShare.span[url];
  const startAt = (loop && span && span.start > 0.004) ? span.start : 0;
  el.onended = function () {
    if (!slot.voice || slot.voice.el !== el) return;
    if (loop) {
      carEngineHtmlSeam(slot, true);
      return;
    }
    slot.voice = null;
    slot.shot = false;
    try { if (slot.live) carEngineResumeSlot(slot); } catch (err) {}
  };
  try { el.currentTime = startAt; } catch (err) {}
  slot.voice = {src: el, gain: null, pan: null, url: url, loop: !!loop, el: el, tag: tag || 'a', seam: false};
  slot.shot = !loop;
  const play = el.play();
  if (play && typeof play.catch === 'function') play.catch(function () {});
  if (loop) carEngineHtmlLoopArm(slot);
  return true;
}

/** Секунды лупа без тихих краёв. */
function carEngineHtmlSpan(el, url) {
  const dur = el && el.duration;
  const span = carEngineShare.span[url];
  const end = (span && span.end > 0.05) ? span.end : (dur || 0);
  const start = (span && span.start > 0 && span.start + 0.05 < end) ? span.start : 0;
  return {start: start, end: (dur && end > dur ? dur : end) || dur || 0};
}

/** Запускает второй тег чуть раньше конца, без дырки native loop. */
function carEngineHtmlSeam(slot, fromEnded) {
  const v = slot && slot.voice;
  if (!v || !v.loop || !v.el || !v.url) return;
  if (v.seam && !fromEnded) return;
  const el = v.el;
  const span = carEngineHtmlSpan(el, v.url);
  if (!span.end && !fromEnded) return;
  const nextTag = v.tag === 'a' ? 'b' : 'a';
  const twin = carEngineHtmlEl(slot, v.url, nextTag);
  twin.loop = false;
  twin.volume = el.volume;
  try { twin.playbackRate = el.playbackRate; } catch (err) {}
  twin.onended = el.onended;
  twin.onerror = el.onerror;
  try { twin.currentTime = span.start; } catch (err) {}
  v.seam = true;
  const play = twin.play();
  if (play && typeof play.catch === 'function') play.catch(function () {});
  slot.voice = {src: twin, gain: null, pan: null, url: v.url, loop: true, el: twin, tag: nextTag, seam: false};
  setTimeout(function () {
    try {
      if (el && slot.voice && slot.voice.el !== el) el.pause();
    } catch (err) {}
  }, 22);
}

/** Следит за концом лупа чаще, чем timeupdate. */
function carEngineHtmlLoopArm(slot) {
  if (!slot || slot.htmlRaf) return;
  const step = function () {
    slot.htmlRaf = 0;
    const v = slot.voice;
    if (!v || !v.loop || !v.el || !slot.live) return;
    const el = v.el;
    const span = carEngineHtmlSpan(el, v.url);
    if (span.end > 0.05 && !el.paused) {
      const rate = Math.max(0.05, el.playbackRate || 1);
      const left = (span.end - el.currentTime) / rate;
      if (left <= 0.048) carEngineHtmlSeam(slot, false);
    }
    slot.htmlRaf = requestAnimationFrame(step);
  };
  slot.htmlRaf = requestAnimationFrame(step);
}

/** Играет клип на слоте. pan: −1 слева, 0 центр, +1 справа. */
function carEnginePlaySlot(slot, url, loop, vol, rate, pan, force) {
  if (!slot || !url || vol <= 0) return false;
  const buf = carEngineShare.buf[url];
  if ((!buf || buf === 'html') && AU.ctx) carEngineLoad(url);
  const sameHtml = slot.voice && slot.voice.el && slot.voice.url === url && slot.voice.loop === loop;
  if (sameHtml && !force) return carEnginePlayHtml(slot, url, loop, vol, rate, false);
  if (buf && buf !== 'bad' && buf !== 'html' && AU.ctx && AU.sfx) {
    return carEnginePlayWeb(slot, url, buf, loop, vol, rate, pan, force);
  }
  if (buf === 'bad') return false;
  return carEnginePlayHtml(slot, url, loop, vol, rate, force);
}

/** Бесшовный луп через BufferSource, края без тишины. */
function carEnginePlayWeb(slot, url, buf, loop, vol, rate, pan, force) {
  const pitch = Math.max(0.7, Math.min(1.45, rate || 1));
  const side = Math.max(-1, Math.min(1, pan || 0));
  const cur = slot.voice;
  if (!force && cur && cur.url === url && cur.loop === loop && cur.src && !cur.el) {
    try { cur.gain.gain.value = vol; } catch (err) {}
    try { cur.src.playbackRate.value = pitch; } catch (err) {}
    try { if (cur.pan) cur.pan.pan.value = side; } catch (err) {}
    return true;
  }
  carEngineKillSlot(slot);
  const gain = AU.ctx.createGain();
  gain.gain.value = vol;
  let panNode = null;
  if (AU.ctx.createStereoPanner) {
    panNode = AU.ctx.createStereoPanner();
    panNode.pan.value = side;
    gain.connect(panNode);
    panNode.connect(AU.sfx);
  } else {
    gain.connect(AU.sfx);
  }
  const src = AU.ctx.createBufferSource();
  src.buffer = buf;
  src.loop = !!loop;
  src.playbackRate.value = pitch;
  if (loop && buf.length > 1) {
    const span = carEngineShare.span[url] || carEngineSpanFromBuffer(buf);
    const dur = buf.duration;
    let start = span.start || 0;
    let end = span.end || dur;
    if (!(end > start + 0.05) || end > dur) {
      start = 0;
      end = dur;
    }
    src.loopStart = start;
    src.loopEnd = end;
  }
  src.connect(gain);
  src.onended = function () {
    if (!slot.voice || slot.voice.src !== src) return;
    slot.voice = null;
    slot.shot = false;
    try {
      if (slot.live) carEngineResumeSlot(slot);
    } catch (err) {}
  };
  try { src.start(0); } catch (err) { return false; }
  slot.voice = {src: src, gain: gain, pan: panNode, url: url, loop: !!loop};
  slot.shot = !loop;
  slot.pan = side;
  return true;
}

/** Луп слота. */
function carEngineEnsureSlot(slot) {
  if (!slot || slot.shot) return false;
  const n = carEngineLoopNum(slot.want);
  carEngineWarmClip(slot.idx, n);
  const url = carEnginePick(slot.idx, n);
  if (!url) return false;
  const vol = carEngineLoopVol(slot.want, slot.mixVol || carEngineVol());
  return carEnginePlaySlot(slot, url, true, vol, carEngineRate(slot.want, slot.n, slot.pulls), slot.pan, false);
}

/** Разовый клип слота. force — с начала, даже тот же файл. */
function carEngineShotSlot(slot, n, vol, rate, force) {
  carEngineWarmClip(slot.idx, n);
  const url = carEnginePick(slot.idx, n);
  if (!url) return false;
  return carEnginePlaySlot(slot, url, false, vol, rate || 1, slot.pan, !!force);
}

/** После разового клипа: набор → луп хода, в воздухе не цеплять 002. */
function carEngineResumeSlot(slot) {
  if (!slot || !slot.live) return;
  if (typeof slot.onResume === 'function') {
    slot.onResume(slot);
    return;
  }
  const racer = slot.racer;
  if (racer && racer.air) return;
  const spd = Math.abs((racer && racer.spd) || 0);
  if (slot.want === 'accel') {
    if (!slot.gas && carEngineStill(racer, slot.n, spd)) {
      slot.want = 'idle';
      carEngineEnsureSlot(slot);
      return;
    }
    slot.want = 'drive';
    carEngineEnsureSlot(slot);
    return;
  }
  if (slot.want === 'dump') {
    if (carEngineStill(racer, slot.n, spd)) {
      slot.want = 'idle';
      carEngineEnsureSlot(slot);
      return;
    }
    slot.want = 'drive';
    carEngineEnsureSlot(slot);
    return;
  }
  slot.want = carEngineStill(racer, slot.n, spd) ? 'idle' : 'drive';
  carEngineEnsureSlot(slot);
}

/** Глушит слот. */
function carEngineHaltSlot(slot) {
  if (!slot) return;
  slot.live = false;
  slot.want = '';
  slot.gas = 0;
  slot.lastGas = false;
  slot.pulls = 0;
  slot.afterLand = false;
  slot.wasAir = false;
  slot.airHeld = false;
  carEngineKillSlot(slot);
  carEngineDrainHtmlPool(slot);
}

/** Прогревает клипы выбранного кузова. */
function carEngineWarm() {
  const cars = typeof CARS !== 'undefined' ? CARS : [];
  const idx = (typeof save !== 'undefined' && save) ? (save.car | 0) : 0;
  if (cars[idx]) carEngineWarmPack(idx);
}
