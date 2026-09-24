// Честная статистика заезда: подтверждённые снаряды, время заноса и валидные круги.
(function (global) {
  'use strict';
  const engine = global.DiVANEngine;
  if (!engine) return;
  let race = null, racers = new WeakMap(), shots = new WeakMap(), shotSequence = 0, activeShot = null;
  const lapListeners = new Set();
  const finite = value => Number.isFinite(value) ? value : 0;
  const wrap = (name, factory) => { if (typeof global[name] === 'function') engine.wrap(name, factory); };

  function sync() {
    const current = typeof R !== 'undefined' ? R : null;
    if (current !== race) { race = current; racers = new WeakMap(); shots = new WeakMap(); shotSequence = 0; activeShot = null; }
    return current;
  }
  function stats(r) {
    sync();
    let data = racers.get(r);
    if (!data) {
      const rec = typeof save !== 'undefined' && save && save.records && race ? save.records[race.tIdx] : null;
      const training = typeof labTest !== 'undefined' && labTest || race && (race.training || race.practice || race.replay);
      data = { shotsFired: 0, shotsHit: 0, driftTime: 0, recoveries: 0, bestLap: finite(r.bestLap),
        lastLap: 0, lastLapValid: false, invalid: '', previousBest: training ? 0 : finite(rec && rec.bestLap), completedLaps: 0 };
      racers.set(r, data);
    }
    return data;
  }
  function active(r) {
    return sync() && !race.demo && race.phase === 'go' && r && !r.dead && !r.finished &&
      (typeof state === 'undefined' || state === 'race') && (typeof paused === 'undefined' || !paused);
  }
  function invalidateLap(r, reason) {
    if (!r) return;
    const data = stats(r);
    data.invalid = reason || 'ВОССТАНОВЛЕНИЕ'; r._lapInvalid = true;
  }
  function recoveryUsed(r) { stats(r).recoveries++; invalidateLap(r, 'ВОЗВРАТ НА ТРАССУ'); }
  function setPersonalBest(r, value) { if (r && Number.isFinite(value) && value > 0) stats(r).previousBest = value; }
  function snapshot(r) {
    r = r || (typeof P !== 'undefined' ? P : null);
    if (!r) return null;
    const data = stats(r), best = data.bestLap;
    return { bestLap: best, lastLap: data.lastLap, lastLapValid: data.lastLapValid,
      shotsFired: data.shotsFired, shotsHit: data.shotsHit,
      accuracy: data.shotsFired ? Math.min(100, data.shotsHit / data.shotsFired * 100) : null,
      accuracyLabel: 'ТОЧНОСТЬ СНАРЯДОВ', damageDealt: Math.max(0, finite(r.dmgDealt)),
      driftTime: data.driftTime, recoveries: data.recoveries, completedLaps: data.completedLaps,
      lapValid: !data.invalid && !r._lapInvalid, invalidReason: data.invalid,
      previousBest: data.previousBest, personalBest: best && data.previousBest ? Math.min(best, data.previousBest) : best || data.previousBest,
      newPersonalBest: best > 0 && (!data.previousBest || best < data.previousBest), kills: finite(r.kills) };
  }
  /** Один объект снаряда получает один ID независимо от числа целей или вызовов попадания. */
  function registerShot(shot) {
    sync();
    if (!shot || !shot.r || !race || race.demo || race.phase !== 'go' ||
      (typeof paused !== 'undefined' && paused) || (typeof state !== 'undefined' && state !== 'race')) return null;
    let entry = shots.get(shot);
    if (!entry) {
      entry = { id: ++shotSequence, racer: shot.r, race, hit: false };
      shots.set(shot, entry); stats(shot.r).shotsFired++;
    }
    return entry.id;
  }
  function hitShot(shot, victim) {
    sync();
    const entry = shot && shots.get(shot);
    if (!entry || entry.race !== race || entry.hit || !victim || victim === entry.racer) return false;
    entry.hit = true; stats(entry.racer).shotsHit++;
    return true;
  }
  function emitLap(event) { for (const listener of lapListeners) listener(event); }

  wrap('kitPushShot', previous => function () {
    const shot = previous.apply(this, arguments); registerShot(shot); return shot;
  });
  // Старые наборы оружия иногда пишут в R.shots напрямую.
  wrap('resolveRaceContact', previous => function () {
    sync(); if (race) for (const shot of race.shots || []) registerShot(shot);
    return previous.apply(this, arguments);
  });
  wrap('kitOnShotHit', previous => function (shot, victim) {
    hitShot(shot, victim);
    const prior = activeShot; activeShot = shot;
    try { return previous.apply(this, arguments); } finally { activeShot = prior; }
  });
  // Взрыв гаубицы по истечении времени тоже считается попаданием, но лишь один раз.
  wrap('kitOnShotExpire', previous => function (shot) {
    const prior = activeShot; activeShot = shot;
    try { return previous.apply(this, arguments); } finally { activeShot = prior; }
  });
  wrap('dmgRacer', previous => function (victim) {
    const hp = victim.hp, result = previous.apply(this, arguments);
    if (activeShot && victim.hp < hp) hitShot(activeShot, victim);
    return result;
  });
  wrap('stepVehicle', previous => function (r, throttle, steer, dt) {
    const counting = active(r), x = r.x, y = r.y;
    const result = previous.apply(this, arguments);
    if (counting && Number.isFinite(dt) && dt > 0 && dt <= .25) {
      const data = stats(r);
      if (r._drift && r._drift.active && !r.air && !r.dead && !r.finished && !r.car.hov && !(r._contactGrace > 0)) data.driftTime += dt;
      const limit = Math.max(120, (Math.abs(finite(r.spd)) + Math.abs(finite(r.lat))) * dt * 3 + 20);
      if (Math.hypot(r.x - x, r.y - y) > limit) invalidateLap(r, 'ПЕРЕМЕЩЕНИЕ ВНЕ ТРАССЫ');
    }
    return result;
  });
  wrap('advanceIdx', previous => function (r) {
    const data = stats(r), lap = r.lap, start = r.lapStart, oldBest = r.bestLap, restoring = !!r._lapRestore;
    const invalid = data.invalid || r._lapInvalid;
    const result = previous.apply(this, arguments);
    if (!race || race.demo || !r.isP) return result;
    if (r.lap < lap) invalidateLap(r, 'ОБРАТНОЕ ПЕРЕСЕЧЕНИЕ ФИНИША');
    if (r.lapStart !== start && r.lap > lap) {
      const elapsed = finite(race.time - start), first = lap < 0;
      const clean = !first && !invalid && !restoring && elapsed > 0;
      if (!first) {
        data.lastLap = elapsed; data.lastLapValid = clean;
        if (clean) { data.completedLaps++; if (!data.bestLap || elapsed < data.bestLap) data.bestLap = elapsed; }
        else r.bestLap = oldBest;
      }
      emitLap({ racer: r, race, started: first, clean, elapsed: first ? 0 : elapsed, reason: invalid || '', finished: !!r.finished });
      data.invalid = ''; r._lapInvalid = false;
    }
    return result;
  });
  for (const hook of ['killRacer', 'respawn']) wrap(hook, previous => function (r) {
    invalidateLap(r, hook === 'killRacer' ? 'МАШИНА УНИЧТОЖЕНА' : 'ВОССТАНОВЛЕНИЕ');
    return previous.apply(this, arguments);
  });
  wrap('showResults', previous => function () {
    if (sync() && typeof P !== 'undefined' && P) race.insights = snapshot(P);
    return previous.apply(this, arguments);
  });
  engine.insights = { snapshot, invalidateLap, recoveryUsed, setPersonalBest, registerShot, hitShot,
    onLap(listener) { lapListeners.add(listener); return () => lapListeners.delete(listener); } };
})(typeof window !== 'undefined' ? window : globalThis);
