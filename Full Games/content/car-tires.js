////////////////////////////////////////////////////////
//
// Покрышки: WAV скольжения и дрифта, панорама как у моторов
//
////////////////////////////////////////////////////////
'use strict';

const CAR_TIRE_SLIDE = 'assets/sounds/cars/wheels/sound_025.wav';
const CAR_TIRE_DRIFT = 'assets/sounds/cars/wheels/sound_026.wav';
const CAR_TIRE_VOL = 1;

const carTirePlayer = carEngineMakeSlot();
const carTireNpcs = [];

/** Грузит только нужный клип покрышек. */
function carTiresWarmKind(kind) {
  if (typeof carEngineLoad !== 'function') return;
  carEngineLoad(kind === 'drift' ? CAR_TIRE_DRIFT : CAR_TIRE_SLIDE);
}

/** Готовый URL клипа. */
function carTireUrl(kind) {
  const url = kind === 'drift' ? CAR_TIRE_DRIFT : CAR_TIRE_SLIDE;
  const buf = carEngineShare.buf[url];
  if (buf && buf !== 'bad') return url;
  if (typeof carEngineDesktop === 'function' && carEngineDesktop() && !carEngineShare.miss[url]) return url;
  return '';
}

/**
 * Сила визга: скольжение по lat/ручнику и дрифт по углу.
 */
function carTireSlip(racer) {
  const z = {slide: 0, drift: 0};
  if (!racer || racer.dead || racer.air || (racer.car && racer.car.hov)) return z;
  if (typeof state === 'string' && state !== 'race') return z;
  if (typeof paused === 'boolean' && paused) return z;
  const spd = Math.abs(racer.spd || 0);
  const lat = Math.abs(racer.lat || 0);
  const steer = Math.abs(racer.steerFlt || 0);
  const hand = !!racer.handbrake;
  if (spd < 55) return z;
  const sliding = lat > 52;
  const drifting = racer._drift ? racer._drift.active : spd > 100 && steer > 0.62 && lat > 36;
  const handSpin = hand && spd > 70 && lat > 28;
  if (!sliding && !drifting && !handSpin) return z;
  const speedMul = Math.max(0, Math.min(1, (spd - 50) / 90));
  z.slide = sliding || handSpin ? Math.max(0, Math.min(1, (lat - 40) / 70)) * speedMul : 0;
  z.drift = drifting ? Math.min(1, (racer._drift ? Math.max(.15, racer._drift.intensity) : steer * 1.15) * Math.min(1, spd / 210)) * speedMul : 0;
  return z;
}

/** Какой клип: дрифт или скольжение, с гистерезисом. */
function carTireKind(slot, slip) {
  const prev = slot.kind || 'slide';
  if (slip.drift > slip.slide + 0.08) return 'drift';
  if (slip.slide > slip.drift + 0.08) return 'slide';
  return prev;
}

/** Глушит слот покрышек. */
function carTireHaltSlot(slot) {
  carEngineHaltSlot(slot);
  if (slot) slot.kind = '';
}

/** Тик одного визга. */
function carTireTickSlot(slot, racer, mixVol, pan) {
  const slip = carTireSlip(racer);
  const amt = Math.max(slip.slide, slip.drift);
  if (amt < 0.05 || mixVol < 0.01) {
    carTireHaltSlot(slot);
    return false;
  }
  const kind = carTireKind(slot, slip);
  slot.kind = kind;
  carTiresWarmKind(kind);
  const url = carTireUrl(kind);
  if (!url) return false;
  const n = Math.min(1, Math.abs(racer.spd || 0) / Math.max(1, racer.st && racer.st.top ? racer.st.top : 1));
  const vol = mixVol * CAR_TIRE_VOL * (0.42 + amt * 0.58);
  const rate = 0.9 + n * 0.22 + amt * 0.08;
  slot.live = true;
  slot.pan = pan || 0;
  return carEnginePlaySlot(slot, url, true, vol, rate, slot.pan);
}

/** Слот чужой покрышки. */
function carTireNpcSlot(racer) {
  for (let i = 0; i < carTireNpcs.length; i++) {
    if (carTireNpcs[i].racer === racer) return carTireNpcs[i];
  }
  const slot = carEngineMakeSlot();
  slot.racer = racer;
  carTireNpcs.push(slot);
  return slot;
}

/** Глушит все покрышки. */
function carTiresHalt() {
  carTireHaltSlot(carTirePlayer);
  for (let i = 0; i < carTireNpcs.length; i++) carTireHaltSlot(carTireNpcs[i]);
  carTireNpcs.length = 0;
}

/** На диске есть клипы покрышек — пилу-шум не включать. */
function carTiresReady() {
  return !!(carTireUrl('slide') || carTireUrl('drift'));
}

/** Игрок или соперник сейчас орёт покрышками с диска. */
function carTiresLive() {
  if (carTirePlayer && carTirePlayer.voice) return true;
  for (let i = 0; i < carTireNpcs.length; i++) {
    if (carTireNpcs[i] && carTireNpcs[i].voice) return true;
  }
  return false;
}

/**
 * Визг поля: игрок и ближайшие соперники. Только живой заезд.
 */
function tickCarTires(player, pack, base) {
  if (typeof document !== 'undefined' && document.hidden) {
    carTiresHalt();
    return;
  }
  if (typeof state === 'string' && state !== 'race') {
    carTiresHalt();
    return;
  }
  if (typeof paused === 'boolean' && paused) {
    carTiresHalt();
    return;
  }
  carTireTickSlot(carTirePlayer, player, base, 0);
  const list = pack || [];
  const cap = typeof carEngineNpcCap === 'function' ? Math.min(4, carEngineNpcCap()) : 4;
  const ranked = [];
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    if (!r || r === player || r.isP || r.dead) continue;
    const slip = carTireSlip(r);
    if (Math.max(slip.slide, slip.drift) < 0.08) continue;
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
    const slot = carTireNpcSlot(ranked[i].r);
    carTireTickSlot(slot, ranked[i].r, base * ranked[i].spat, carEnginePanFrom(player, ranked[i].r));
  }
  for (let i = carTireNpcs.length - 1; i >= 0; i--) {
    if (!keep.has(carTireNpcs[i].racer)) {
      carTireHaltSlot(carTireNpcs[i]);
      carTireNpcs.splice(i, 1);
    }
  }
}
