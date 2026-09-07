////////////////////////////////////////////////////////
//
// Нитро: запуск 084, луп 011 пока ускорение живо
//
////////////////////////////////////////////////////////
'use strict';

const CAR_NOS_START = 'assets/sounds/cars/NOSZ/sound_084.wav';
const CAR_NOS_LOOP = 'assets/sounds/cars/NOSZ/sound_011.wav';
const CAR_NOS_VOL = 1;

const carNosPlayer = carEngineMakeSlot();
const carNosNpcs = [];

/** Грузит клип NOS только когда ускорение уже нужно. */
function carNosWarmKind(kind) {
  if (typeof carEngineLoad !== 'function') return;
  carEngineLoad(kind === 'loop' ? CAR_NOS_LOOP : CAR_NOS_START);
}

/** Готовый URL. */
function carNosUrl(kind) {
  const url = kind === 'loop' ? CAR_NOS_LOOP : CAR_NOS_START;
  const buf = carEngineShare.buf[url];
  if (buf && buf !== 'bad') return url;
  return '';
}

/** Клипы NOS уже в буфере — пилу можно не дублировать. */
function carNosReady() {
  return !!(carNosUrl('start') || carNosUrl('loop'));
}

/** После запуска: луп, если ускорение ещё идёт. */
function carNosAfterStart(slot) {
  if (!slot || !slot.live || !slot.nosOn) {
    carEngineHaltSlot(slot);
    return;
  }
  const url = carNosUrl('loop');
  if (!url) {
    carNosWarmKind('loop');
    return;
  }
  slot.want = 'nos-loop';
  carEnginePlaySlot(slot, url, true, slot.mixVol * CAR_NOS_VOL, 1, slot.pan || 0);
}

/** Тик одного NOS. */
function carNosTickSlot(slot, racer, mixVol, pan) {
  const on = !!(racer && !racer.dead && (racer.nitro || 0) > 0.04);
  slot.racer = racer;
  slot.mixVol = mixVol;
  slot.pan = pan || 0;
  slot.nosOn = on;
  slot.onResume = carNosAfterStart;
  if (!on) {
    if (slot.shot && slot.want === 'nos-start') {
      slot.live = true;
      return true;
    }
    carEngineHaltSlot(slot);
    slot.wasOn = false;
    slot.want = '';
    return false;
  }
  slot.live = true;
  if (!slot.wasOn) {
    carNosWarmKind('start');
    const start = carNosUrl('start');
    if (start) {
      slot.wasOn = true;
      slot.want = 'nos-start';
      return carEnginePlaySlot(slot, start, false, mixVol * CAR_NOS_VOL, 1, slot.pan);
    }
    const startGone = !!(carEngineShare && (carEngineShare.buf[CAR_NOS_START] === 'bad' || carEngineShare.miss[CAR_NOS_START]));
    if (!startGone) return false;
    carNosWarmKind('loop');
    const fallback = carNosUrl('loop');
    if (!fallback) return false;
    slot.wasOn = true;
    slot.want = 'nos-loop';
    return carEnginePlaySlot(slot, fallback, true, mixVol * CAR_NOS_VOL, 1, slot.pan);
  }
  if (slot.shot && slot.want === 'nos-start') {
    const v = slot.voice;
    if (v && v.gain) {
      try { v.gain.gain.value = mixVol * CAR_NOS_VOL; } catch (err) {}
    }
    if (v && v.pan) {
      try { v.pan.pan.value = slot.pan; } catch (err) {}
    }
    return true;
  }
  const loop = carNosUrl('loop');
  if (!loop) {
    carNosWarmKind('loop');
    return false;
  }
  slot.want = 'nos-loop';
  return carEnginePlaySlot(slot, loop, true, mixVol * CAR_NOS_VOL, 1, slot.pan);
}

/** Слот чужого NOS. */
function carNosNpcSlot(racer) {
  for (let i = 0; i < carNosNpcs.length; i++) {
    if (carNosNpcs[i].racer === racer) return carNosNpcs[i];
  }
  const slot = carEngineMakeSlot();
  slot.racer = racer;
  carNosNpcs.push(slot);
  return slot;
}

/** Глушит все NOS. */
function carNosHalt() {
  carEngineHaltSlot(carNosPlayer);
  carNosPlayer.wasOn = false;
  for (let i = 0; i < carNosNpcs.length; i++) {
    carEngineHaltSlot(carNosNpcs[i]);
    carNosNpcs[i].wasOn = false;
  }
  carNosNpcs.length = 0;
}

/**
 * Поле: игрок и ближайшие с активным ускорением.
 */
function tickCarNos(player, pack, base) {
  carNosTickSlot(carNosPlayer, player, base, 0);
  const list = pack || [];
  const cap = 4;
  const ranked = [];
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    if (!r || r === player || r.isP || r.dead || (r.nitro || 0) < 0.04) continue;
    const dist = Math.hypot((r.x || 0) - player.x, (r.y || 0) - player.y);
    const spat = carEngineSpat(dist);
    if (spat < 0.04) continue;
    ranked.push({r: r, dist: dist, spat: spat});
  }
  ranked.sort(function (a, b) { return a.dist - b.dist; });
  const keep = new Set();
  const n = Math.min(cap, ranked.length);
  for (let i = 0; i < n; i++) {
    keep.add(ranked[i].r);
    const slot = carNosNpcSlot(ranked[i].r);
    carNosTickSlot(slot, ranked[i].r, base * ranked[i].spat, carEnginePanFrom(player, ranked[i].r));
  }
  for (let i = carNosNpcs.length - 1; i >= 0; i--) {
    if (!keep.has(carNosNpcs[i].racer)) {
      carEngineHaltSlot(carNosNpcs[i]);
      carNosNpcs.splice(i, 1);
    }
  }
}
