////////////////////////////////////////////////////////
//
// Покрышки: WAV скольжения и дрифта, панорама как у моторов
//
////////////////////////////////////////////////////////
'use strict';

const CAR_TIRE_SLIDE = 'assets/sounds/cars/wheels/sound_025.wav';
const CAR_TIRE_DRIFT = 'assets/sounds/cars/wheels/sound_026.wav';
const CAR_TIRE_VOL = 0.94;
const CAR_TIRE_START = 0.24;
const CAR_TIRE_KEEP = 0.1;

/** Шины играют один короткий WAV на срыв, а не бесконечный луп. */
function carTireMakeSlot() {
  const slot = carEngineMakeSlot();
  // Общий голос после one-shot возвращает моторный луп. Для шин это запрещено.
  slot.onResume = function (tireSlot) { tireSlot.live = false; };
  return slot;
}

const carTirePlayer = carTireMakeSlot();
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
  if (!racer || racer.dead || racer.finished || racer.air || (racer.car && racer.car.hov)) return z;
  const chase = typeof state === 'string' && state === 'bearChase';
  if (typeof state === 'string' && state !== 'race' && !chase) return z;
  if ((typeof paused === 'boolean' && paused) || (chase && window.storyBearChase && window.storyBearChase.pause)) return z;
  if (!chase && typeof R !== 'undefined' && R && R.phase !== 'go') return z;
  const spd = Math.abs(racer.spd || 0);
  const lat = Math.abs(racer.lat || 0);
  const steer = Math.abs(racer.steerFlt || 0);
  const hand = !!racer.handbrake;
  if (spd < 55) return z;
  // Те же границы, при которых driving.js оставляет на дороге следы шин.
  const sliding = lat > 22 || (hand && spd > 50);
  const drifting = racer._drift ? racer._drift.active : spd > 100 && steer > 0.62 && lat > 36;
  // Физика обновляет этот флаг каждый шаг: старое _drift.active не имеет
  // права оставлять WAV-луп играть после того, как скольжение закончилось.
  const fallbackMarking = (sliding && spd > 55) || (drifting && spd > 100);
  const marking = typeof racer._tireContact === 'boolean' ? racer._tireContact : fallbackMarking;
  if (!marking) return z;
  const speedMul = Math.max(0, Math.min(1, (spd - 50) / 90));
  const roadSlide = Math.max(0, Math.min(1, (lat - 18) / 70)) * speedMul;
  const handSlide = hand && spd > 50 ? 0.34 + speedMul * 0.28 : 0;
  const slide = Math.max(roadSlide, handSlide);
  const drift = Math.min(1, (racer._drift ? Math.max(.15, racer._drift.intensity) : steer * 1.15) * Math.min(1, spd / 210)) * speedMul;
  z.slide = sliding && spd > 55 ? slide : 0;
  z.drift = drifting && spd > 100 ? drift : 0;
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
  if (slot) {
    slot.kind = '';
    slot.tireActive = false;
    slot.tireLatched = false;
  }
}

/** Тик одного визга. */
function carTireTickSlot(slot, racer, mixVol, pan) {
  const slip = carTireSlip(racer);
  const amt = Math.max(slip.slide, slip.drift);
  if (amt < CAR_TIRE_KEEP || mixVol < 0.01) {
    carTireHaltSlot(slot);
    return false;
  }
  // Пока текущий срыв не закончился, второй WAV не запускаем.
  // Это гарантирует, что даже зависшая lat не превратит звук в бесконечный.
  if (slot.tireLatched) return !!slot.voice;
  if (amt < CAR_TIRE_START) return false;
  const kind = carTireKind(slot, slip);
  slot.kind = kind;
  carTiresWarmKind(kind);
  const url = carTireUrl(kind);
  if (!url) return false;
  const n = Math.min(1, Math.abs(racer.spd || 0) / Math.max(1, racer.st && racer.st.top ? racer.st.top : 1));
  // Слабая боковая скорость на обычном вираже не должна звучать как полный срыв шин.
  const audible = Math.max(0, Math.min(1, (amt - CAR_TIRE_KEEP) / (1 - CAR_TIRE_KEEP)));
  const vol = mixVol * CAR_TIRE_VOL * (0.18 + audible * 0.68);
  const rate = 0.9 + n * 0.22 + amt * 0.08;
  slot.live = true;
  slot.tireActive = true;
  slot.tireLatched = true;
  slot.pan = pan || 0;
  return carEnginePlaySlot(slot, url, false, vol, rate, slot.pan);
}

/** Слот чужой покрышки. */
function carTireNpcSlot(racer) {
  for (let i = 0; i < carTireNpcs.length; i++) {
    if (carTireNpcs[i].racer === racer) return carTireNpcs[i];
  }
  const slot = carTireMakeSlot();
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
  const chase = typeof state === 'string' && state === 'bearChase';
  if (typeof state === 'string' && state !== 'race' && !chase) {
    carTiresHalt();
    return;
  }
  if ((typeof paused === 'boolean' && paused) || (chase && window.storyBearChase && window.storyBearChase.pause)) {
    carTiresHalt();
    return;
  }
  if ((!chase && typeof R !== 'undefined' && R && R.phase !== 'go') || !player || player.dead || player.finished) {
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
