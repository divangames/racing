////////////////////////////////////////////////////////
//
// Смешение двигателей: игрок по центру, чужие — дистанция и сторона
//
////////////////////////////////////////////////////////
'use strict';

const CAR_ENGINE_HEAR = 1320;
const CAR_ENGINE_NEAR = 78;
const CAR_ENGINE_PAN = 260;
const CAR_ENGINE_PLAYER = 1;
const CAR_ENGINE_MENU = 0.58;

const carEnginePlayer = carEngineMakeSlot();
const carEngineNpcs = [];
let carEnginePreview = null;

/** Сколько чужих моторов одновременно. */
function carEngineNpcCap() {
  const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 8;
  if (cores <= 4) return 3;
  return 6;
}

/**
 * Громкость относительно игрока: вплотную — как свой мотор, дальше тише.
 */
function carEngineSpat(dist) {
  if (dist <= CAR_ENGINE_NEAR) return 1;
  if (dist >= CAR_ENGINE_HEAR) return 0;
  const t = (dist - CAR_ENGINE_NEAR) / (CAR_ENGINE_HEAR - CAR_ENGINE_NEAR);
  return Math.pow(1 - t, 1.35);
}

/**
 * Панорама в осях игрока: отрицательная — слева, положительная — справа.
 */
function carEnginePanFrom(listener, racer) {
  if (!listener || !racer) return 0;
  const dx = racer.x - listener.x;
  const dy = racer.y - listener.y;
  const ang = listener.ang || 0;
  const fx = Math.cos(ang);
  const fy = Math.sin(ang);
  const side = dx * (-fy) + dy * fx;
  return Math.max(-1, Math.min(1, side / CAR_ENGINE_PAN));
}

/** Слот чужой машины или новый. */
function carEngineNpcSlot(racer) {
  for (let i = 0; i < carEngineNpcs.length; i++) {
    if (carEngineNpcs[i].racer === racer) return carEngineNpcs[i];
  }
  const slot = carEngineMakeSlot();
  slot.racer = racer;
  carEngineNpcs.push(slot);
  return slot;
}

/** Глушит слоты, которых нет среди живых. */
function carEnginePruneNpcs(keep) {
  for (let i = carEngineNpcs.length - 1; i >= 0; i--) {
    if (!keep.has(carEngineNpcs[i].racer)) {
      carEngineHaltSlot(carEngineNpcs[i]);
      carEngineNpcs.splice(i, 1);
    }
  }
}

/** Глушит все двигатели. */
function carEngineHalt() {
  carEngineHaltSlot(carEnginePlayer);
  for (let i = 0; i < carEngineNpcs.length; i++) carEngineHaltSlot(carEngineNpcs[i]);
  carEngineNpcs.length = 0;
  if (typeof carTiresHalt === 'function') carTiresHalt();
  if (typeof carNosHalt === 'function') carNosHalt();
}

/**
 * Тик поля: игрок + ближайшие соперники.
 * true — семплы есть, пилу игрока можно глушить.
 */
function tickCarEngine(player, paused, screen) {
  try {
    return tickCarEngineField(player, paused, screen);
  } catch (err) {
    return false;
  }
}

/** Титул и настройки поверх демо-заезда. */
function carEngineTitleScreen(screen) {
  return screen === 'press' || screen === 'title' || screen === 'settings' || screen === 'cameraSetup';
}

/** Карусель машин: холостой выбранного кузова. */
function carEnginePickScreen(screen) {
  return screen === 'car' || screen === 'autopark' || screen === 'detail';
}

/** Макет гонщика для превью: стоит, без газа. */
function carEnginePreviewRacer(car) {
  if (!carEnginePreview) {
    carEnginePreview = {
      car: car,
      spd: 0,
      st: {top: 1},
      isP: false,
      air: false,
      dead: false,
      nitro: 0,
      handbrake: false,
      landStun: 0,
      ith: 0,
      x: 0,
      y: 0,
      ang: 0
    };
  }
  carEnginePreview.car = car;
  return carEnginePreview;
}

/** Демо на титуле: моторы пака относительно камеры. */
function tickCarEngineTitle(base) {
  const pack = (typeof titleSim !== 'undefined' && titleSim && titleSim.racers) ? titleSim.racers : [];
  const listener = (typeof titleFocus !== 'undefined' && titleFocus) || pack[0];
  if (!base || document.hidden || !listener || !pack.length) {
    carEngineHalt();
    return false;
  }
  const mix = base * CAR_ENGINE_MENU;
  carEngineHaltSlot(carEnginePlayer);
  const cap = carEngineNpcCap();
  const ranked = [];
  for (let i = 0; i < pack.length; i++) {
    const r = pack[i];
    if (!r || r.dead) continue;
    const dist = Math.hypot((r.x || 0) - listener.x, (r.y || 0) - listener.y);
    const spat = carEngineSpat(dist);
    if (spat < 0.03) continue;
    ranked.push({r: r, dist: dist, spat: spat});
  }
  ranked.sort(function (a, b) { return a.dist - b.dist; });
  const keep = new Set();
  const n = Math.min(cap, ranked.length);
  let any = false;
  for (let i = 0; i < n; i++) {
    const item = ranked[i];
    keep.add(item.r);
    const slot = carEngineNpcSlot(item.r);
    any = carEngineTickSlot(slot, item.r, mix * item.spat, carEnginePanFrom(listener, item.r)) || any;
  }
  carEnginePruneNpcs(keep);
  if (typeof tickCarTires === 'function') tickCarTires(listener, pack, mix);
  if (typeof tickCarNos === 'function') tickCarNos(listener, pack, mix);
  return any;
}

/** Есть живой семпл мотора — пилу глушить только тогда. */
function carEngineLive() {
  if (carEnginePlayer && carEnginePlayer.voice) return true;
  for (let i = 0; i < carEngineNpcs.length; i++) {
    if (carEngineNpcs[i] && carEngineNpcs[i].voice) return true;
  }
  return false;
}

/** Холостой выбранной машины в ленте. */
function tickCarEnginePreview(base, screen) {
  if (!base || document.hidden) {
    carEngineHalt();
    return false;
  }
  let idx = 0;
  if (screen === 'car' && typeof selCar === 'number') idx = selCar | 0;
  else if (screen === 'autopark' && typeof autoparkSel === 'number') idx = autoparkSel | 0;
  else if (typeof save !== 'undefined' && save) idx = save.car | 0;
  const cars = typeof CARS !== 'undefined' ? CARS : [];
  const car = cars[idx];
  if (!car) {
    carEngineHalt();
    return false;
  }
  carEnginePruneNpcs(new Set());
  if (typeof carTiresHalt === 'function') carTiresHalt();
  if (typeof carNosHalt === 'function') carNosHalt();
  return carEngineTickSlot(carEnginePlayer, carEnginePreviewRacer(car), base * CAR_ENGINE_MENU, 0);
}
function tickCarEngineField(player, paused, screen) {
  const base = carEngineVol() * CAR_ENGINE_PLAYER;
  if (carEngineTitleScreen(screen)) return tickCarEngineTitle(base);
  if (carEnginePickScreen(screen)) return tickCarEnginePreview(base, screen);
  const live = screen === 'race' && !paused && !document.hidden && player && !player.dead && base > 0;
  if (!live) {
    carEngineHalt();
    return false;
  }
  carEngineTickSlot(carEnginePlayer, player, base, 0);
  const pack = (typeof R !== 'undefined' && R && R.racers) ? R.racers : [];
  const cap = carEngineNpcCap();
  const ranked = [];
  for (let i = 0; i < pack.length; i++) {
    const r = pack[i];
    if (!r || r === player || r.isP || r.dead) continue;
    const dist = Math.hypot((r.x || 0) - player.x, (r.y || 0) - player.y);
    const spat = carEngineSpat(dist);
    if (spat < 0.03) continue;
    ranked.push({r: r, dist: dist, spat: spat});
  }
  ranked.sort(function (a, b) { return a.dist - b.dist; });
  const keep = new Set();
  const n = Math.min(cap, ranked.length);
  for (let i = 0; i < n; i++) {
    const item = ranked[i];
    keep.add(item.r);
    const slot = carEngineNpcSlot(item.r);
    carEngineTickSlot(slot, item.r, base * item.spat, carEnginePanFrom(player, item.r));
  }
  carEnginePruneNpcs(keep);
  if (typeof tickCarTires === 'function') tickCarTires(player, pack, base);
  if (typeof tickCarNos === 'function') tickCarNos(player, pack, base);
  return !!carEnginePlayer.voice;
}

/**
 * Тик одного гонщика: лупы, набор, сброс, приземление с трамплина.
 */
function carEngineTickSlot(slot, racer, mixVol, pan) {
  if (!slot || !racer) return false;
  slot.racer = racer;
  slot.mixVol = mixVol;
  slot.pan = pan || 0;
  slot.live = mixVol > 0.008;
  if (!slot.live) {
    carEngineHaltSlot(slot);
    return false;
  }
  const idx = racer.car ? (racer.car.idx | 0) : 0;
  if (idx !== slot.idx) {
    slot.idx = idx;
    slot.pulls = 0;
    carEngineKillSlot(slot);
  }
  const top = Math.max(1, racer.st && racer.st.top ? racer.st.top : 1);
  const spd = Math.abs(racer.spd || 0);
  const n = Math.min(1, spd / top);
  const gas = carEngineGas(racer);
  slot.n = n;
  const hb = !!racer.handbrake;
  const vol = mixVol;
  const landed = !!slot.wasAir && !racer.air;
  slot.wasAir = !!racer.air;
  const stunned = (racer.landStun || 0) > 0.02;
  const gasGo = gas > 0 && !hb && !stunned;
  slot.gas = gasGo ? gas : 0;
  if (landed && n > 0.07) {
    slot.pulls = 0;
    slot.lastGas = false;
    slot.afterLand = true;
    slot.want = 'dump';
    carEngineShotSlot(slot, 3, vol, carEngineRate('drive', n, 0));
    return !!slot.voice;
  }
  if (slot.afterLand && slot.shot && slot.want === 'dump') return !!slot.voice;
  if (slot.afterLand && !slot.shot) {
    if (stunned) {
      slot.want = n < 0.055 ? 'idle' : 'drive';
      carEngineEnsureSlot(slot);
      return !!slot.voice;
    }
    if (gasGo) {
      slot.afterLand = false;
      slot.pulls = 0;
      slot.lastGas = true;
      slot.want = 'accel';
      carEngineShotSlot(slot, 1, vol, carEngineRate('accel', n, 0));
      return !!slot.voice;
    }
  }
  if (slot.shot && slot.want === 'dump') {
    const v = slot.voice;
    if (v && v.gain) {
      try { v.gain.gain.value = vol; } catch (err) {}
    }
    if (v && v.pan) {
      try { v.pan.pan.value = slot.pan; } catch (err) {}
    }
    return !!slot.voice;
  }
  if (carEngineStill(racer, n, spd)) {
    slot.lastGas = false;
    slot.pulls = 0;
    slot.want = 'idle';
    if (slot.shot) carEngineKillSlot(slot);
    carEngineEnsureSlot(slot);
    return !!slot.voice;
  }
  if (gasGo) {
    slot.lastGas = true;
    const atTop = n >= 0.86 || (slot.want === 'top' && n >= 0.78);
    if (atTop && slot.pulls >= 1) {
      slot.want = 'top';
      if (!slot.shot) carEngineEnsureSlot(slot);
    } else if (slot.shot && slot.want === 'accel') {
      const v = slot.voice;
      if (v && v.src && v.src.playbackRate) {
        try { v.src.playbackRate.value = carEngineRate('accel', n, slot.pulls); } catch (err) {}
      }
      if (v && v.pan) {
        try { v.pan.pan.value = slot.pan; } catch (err) {}
      }
      if (v && v.gain) {
        try { v.gain.gain.value = vol; } catch (err) {}
      }
    } else {
      slot.want = 'accel';
      carEngineShotSlot(slot, 1, vol, carEngineRate('accel', n, slot.pulls));
    }
  } else if (slot.lastGas && n > 0.07) {
    slot.lastGas = false;
    slot.pulls = 0;
    slot.want = 'dump';
    carEngineShotSlot(slot, 3, vol, carEngineRate('drive', n, 0));
  } else {
    slot.lastGas = false;
    slot.pulls = 0;
    slot.want = n < 0.055 ? 'idle' : 'drive';
    if (!slot.shot) carEngineEnsureSlot(slot);
  }
  return !!slot.voice;
}

