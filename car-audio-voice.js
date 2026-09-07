////////////////////////////////////////////////////////
//
// Голос одного двигателя: клипы, лупы, без наложения на слоте
//
////////////////////////////////////////////////////////
'use strict';

const CAR_ENGINE_STD = 'assets/sounds/engine/';
const CAR_ENGINE_LIB = 'assets/sounds/cars/engine/';
const CAR_ENGINE_WAV = 0.62;
const CAR_ENGINE_PULLS = 4;

const carEngineShare = {
  miss: {},
  buf: {},
  load: {}
};

/** Папка звуков слота: 0 → assets/data/cars/01/sound/. */
function carEngineDir(idx) {
  const nn = String((idx | 0) + 1).padStart(2, '0');
  return 'assets/data/cars/' + nn + '/sound/';
}

/** Пак из лаборатории: assets/sounds/cars/engine/<имя>/sound/. */
function carEngineLibDir(idx) {
  const cfg = (typeof editorCarConfig === 'function') ? editorCarConfig(idx) : null;
  const pack = cfg && cfg.audio && cfg.audio.engine;
  const name = String(pack || '').trim();
  if (!name || name.length > 80 || name.indexOf('..') >= 0 || /[\\/]/.test(name)) return '';
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

/** Первый уже декодированный клип: сначала кузов, иначе стандарт. */
function carEnginePick(idx, n) {
  const urls = carEngineUrls(idx, n);
  for (let i = 0; i < urls.length; i++) {
    const buf = carEngineShare.buf[urls[i]];
    if (buf && buf !== 'bad') return urls[i];
  }
  return '';
}

/** Грузит один кандидат клипа: пак, затем кузов, затем стандарт. Без лишних fetch. */
function carEngineWarmClip(idx, n) {
  const urls = carEngineUrls(idx, n);
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const buf = carEngineShare.buf[url];
    if (buf && buf !== 'bad') return;
    if (buf === 'bad' || carEngineShare.miss[url]) continue;
    carEngineLoad(url);
    return;
  }
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

/** Декодирует WAV в буфер контекста. */
function carEngineLoad(url) {
  if (!url || !AU.ctx) return;
  if (carEngineShare.buf[url] && carEngineShare.buf[url] !== 'bad') return;
  if (carEngineShare.buf[url] === 'bad' || carEngineShare.miss[url]) return;
  const started = carEngineShare.load[url];
  if (started && (typeof started !== 'number' || Date.now() - started < 2500)) return;
  carEngineShare.load[url] = Date.now();
  fetch(carEngineSrc(url)).then(function (res) {
    if (!res.ok) throw new Error('no wav');
    return res.arrayBuffer();
  }).then(function (raw) {
    return carEngineDecode(raw);
  }).then(function (buf) {
    if (!buf || !buf.length) throw new Error('empty');
    carEngineShare.buf[url] = buf;
    carEngineShare.load[url] = 0;
  }).catch(function () {
    carEngineShare.buf[url] = 'bad';
    carEngineMarkMiss(url);
    carEngineShare.load[url] = 0;
  });
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

/** Тон клипа по ходу и «передаче». */
function carEngineRate(want, n, pulls) {
  const gear = Math.min(5, Math.floor(Math.max(0, n) * 5));
  if (want === 'accel') return 0.88 + Math.min(4, pulls) * 0.055 + gear * 0.02;
  if (want === 'top') return 0.97 + n * 0.14;
  if (want === 'drive') return 0.92 + n * 0.2;
  if (want === 'idle') return 0.96 + n * 0.12;
  return 1;
}

/** Номер лупа. */
function carEngineLoopNum(want) {
  if (want === 'top') return 2;
  if (want === 'drive') return 4;
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
    pan: 0
  };
}

/** Снимает источник слота. */
function carEngineKillSlot(slot) {
  if (!slot) return;
  const v = slot.voice;
  if (v) {
    try { v.src.onended = null; } catch (err) {}
    try { v.src.stop(); } catch (err) {}
    try { v.src.disconnect(); } catch (err) {}
    try { v.gain.disconnect(); } catch (err) {}
    try { if (v.pan) v.pan.disconnect(); } catch (err) {}
  }
  slot.voice = null;
  slot.shot = false;
}

/** Играет клип на слоте. pan: −1 слева, 0 центр, +1 справа. */
function carEnginePlaySlot(slot, url, loop, vol, rate, pan) {
  if (!slot || !AU.ctx || !AU.sfx || !url || vol <= 0) return false;
  const buf = carEngineShare.buf[url];
  if (!buf || buf === 'bad') {
    carEngineLoad(url);
    return false;
  }
  const pitch = Math.max(0.7, Math.min(1.45, rate || 1));
  const side = Math.max(-1, Math.min(1, pan || 0));
  const cur = slot.voice;
  if (cur && cur.url === url && cur.loop === loop) {
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
    src.loopStart = 0;
    src.loopEnd = buf.length / buf.sampleRate;
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
  return carEnginePlaySlot(slot, url, true, vol, carEngineRate(slot.want, slot.n, slot.pulls), slot.pan);
}

/** Разовый клип слота. */
function carEngineShotSlot(slot, n, vol, rate) {
  carEngineWarmClip(slot.idx, n);
  const url = carEnginePick(slot.idx, n);
  if (!url) return false;
  return carEnginePlaySlot(slot, url, false, vol, rate || 1, slot.pan);
}

/** После разового клипа. */
function carEngineResumeSlot(slot) {
  if (!slot || !slot.live) return;
  if (typeof slot.onResume === 'function') {
    slot.onResume(slot);
    return;
  }
  const vol = slot.mixVol || carEngineVol();
  if (slot.afterLand) {
    const stunned = slot.racer && (slot.racer.landStun || 0) > 0.02;
    if (stunned || slot.gas <= 0) {
      slot.want = slot.n < 0.055 ? 'idle' : 'drive';
      carEngineEnsureSlot(slot);
      return;
    }
    slot.afterLand = false;
    slot.pulls = 0;
    slot.want = 'accel';
    carEngineShotSlot(slot, 1, vol, carEngineRate('accel', slot.n, 0));
    return;
  }
  if (slot.n < 0.06 || carEngineStill(slot.racer, slot.n, Math.abs((slot.racer && slot.racer.spd) || 0))) {
    slot.pulls = 0;
    slot.want = 'idle';
    carEngineEnsureSlot(slot);
    return;
  }
  if (slot.gas > 0) {
    if (slot.want === 'accel') slot.pulls += 1;
    if (slot.n >= 0.82 || slot.pulls >= CAR_ENGINE_PULLS) {
      slot.want = 'top';
      carEngineEnsureSlot(slot);
      return;
    }
    slot.want = 'accel';
    carEngineShotSlot(slot, 1, vol, carEngineRate('accel', slot.n, slot.pulls));
    return;
  }
  slot.pulls = 0;
  slot.want = slot.n < 0.055 ? 'idle' : 'drive';
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
  carEngineKillSlot(slot);
}

/** Клип грузится в момент нужды, пачку заранее не качаем. */
function carEngineWarm() {}
