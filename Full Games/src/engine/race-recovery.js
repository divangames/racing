// Возврат машины на свободный участок без ремонта, перезарядки и продвижения вперёд.
(function (global) {
  'use strict';
  const engine = global.DiVANEngine;
  if (!engine) return;
  const COOLDOWN = 5;
  let race = null, saved = new WeakMap();
  const wrap = (name, factory) => { if (typeof global[name] === 'function') engine.wrap(name, factory); };
  const player = r => r || (typeof P !== 'undefined' ? P : null);
  function sync() {
    const current = typeof R !== 'undefined' ? R : null;
    if (current !== race) { race = current; saved = new WeakMap(); }
  }
  function data(r) {
    sync();
    let value = saved.get(r);
    if (!value) { value = { until: 0, safe: null }; saved.set(r, value); }
    return value;
  }
  function gap(index) {
    return typeof inTrackGap === 'function' && inTrackGap(race.T, index / race.N);
  }
  function occupied(r, point) {
    const half = typeof carHitHalf === 'function' ? carHitHalf(r) : { hw: 27, hh: 16 };
    const radius = Math.hypot(half.hw, half.hh) + 10;
    const fence = race.tacticGate;
    if (fence && !fence.broken) {
      const box = { cx: fence.x, cy: fence.y, hw: fence.halfWidth, hh: fence.halfSpan,
        ca: Math.cos(fence.angle), sa: Math.sin(fence.angle) };
      const candidate = { ...r, x: point.x, y: point.y, ang: point.ang };
      const body = typeof carObb === 'function' ? carObb(candidate) :
        { cx: point.x, cy: point.y, hw: half.hw, hh: half.hh, ca: Math.cos(point.ang), sa: Math.sin(point.ang) };
      // Та же геометрия, что у контакта с забором; его обломки уже не препятствие.
      if (engine.collision && engine.collision.obbOverlap) {
        if (engine.collision.obbOverlap(body, box)) return true;
      } else {
        // Консервативный запас для старого контента без SAT-хука.
        const dx = body.cx - box.cx, dy = body.cy - box.cy, reach = Math.hypot(body.hw, body.hh);
        if (Math.abs(dx * box.ca + dy * box.sa) < box.hw + reach && Math.abs(-dx * box.sa + dy * box.ca) < box.hh + reach) return true;
      }
    }
    for (const other of race.racers || []) {
      if (other === r || other.dead || other.air) continue;
      if (typeof trackDeck === 'function' && trackDeck(race.T, point.index / race.N) !== trackDeck(race.T, other.trackIdx / race.N)) continue;
      const otherHalf = typeof carHitHalf === 'function' ? carHitHalf(other) : { hw: 27, hh: 16 };
      if (Math.hypot(point.x - other.x, point.y - other.y) < radius + Math.hypot(otherHalf.hw, otherHalf.hh)) return true;
    }
    const objects = global.RnRObjects;
    if (objects && objects.defOf && objects.toLocal) for (const item of race.labObjects || []) {
      const def = objects.defOf(item);
      if (!def || !def.collision || !def.collision.solid || (item.carLayer || item.layer || def.carLayer || def.layer) === 'under') continue;
      const local = objects.toLocal(item, def, point.x, point.y);
      // Консервативный габарит не ставит кузов внутрь редактируемого объекта.
      if (Math.abs(local.x) < (def.w || 128) / 2 + radius && Math.abs(local.y) < (def.h || 128) / 2 + radius) return true;
    }
    return false;
  }
  function positionAt(r, index, lap, lat) {
    const p = race.S[index];
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.ang) || gap(index)) return null;
    const nx = Number.isFinite(p.nx) ? p.nx : -Math.sin(p.ang), ny = Number.isFinite(p.ny) ? p.ny : Math.cos(p.ang);
    const point = { x: p.x + nx * lat, y: p.y + ny * lat, ang: p.ang, index, lap, prog: lap * race.N + index };
    if (point.x < 20 || point.y < 20 || point.x > race.T.w - 20 || point.y > race.T.h - 20) return null;
    return occupied(r, point) ? null : point;
  }
  function target(r) {
    const current = ((r.trackIdx | 0) % race.N + race.N) % race.N;
    const width = typeof ROADW === 'number' ? ROADW : 95;
    const half = typeof carHitHalf === 'function' ? carHitHalf(r) : { hh: 16 };
    const lane = Math.max(0, Math.min(48, width - half.hh - 15));
    // Обычно возвращаем на тот же участок. Разлом/занятый участок ищет место только назад.
    for (let back = 0; back < Math.min(80, race.N); back++) {
      const index = (current - back + race.N) % race.N;
      const lap = (Number.isFinite(r.lap) ? r.lap : -1) - (index > current ? 1 : 0);
      if (lap < -1) break;
      for (const lateral of [0, -lane, lane]) {
        const point = positionAt(r, index, lap, lateral);
        if (point) return point;
      }
    }
    const previous = data(r).safe;
    // Последнее безопасное место подходит только в пределах текущего/предыдущего круга.
    if (previous && previous.prog <= r.prog && r.prog - previous.prog < Math.min(race.N, 80) && !gap(previous.index) && !occupied(r, previous)) return previous;
    return null;
  }
  function status(r) {
    r = player(r); sync();
    if (!race || !r || race.demo || (typeof state !== 'undefined' && state !== 'race')) return { ok: false, reason: 'ВОЗВРАТ ДОСТУПЕН В ЗАЕЗДЕ', cooldown: 0 };
    if (race.phase !== 'go' || r.finished) return { ok: false, reason: 'ЗАЕЗД НЕ АКТИВЕН', cooldown: 0 };
    if (r.dead) return { ok: false, reason: 'МАШИНА ВОССТАНАВЛИВАЕТСЯ', cooldown: 0 };
    if (!race.T || !Array.isArray(race.S) || !race.S.length || !Number.isFinite(race.N) || race.N !== race.S.length) return { ok: false, reason: 'НЕТ БЕЗОПАСНОГО УЧАСТКА', cooldown: 0 };
    const cooldown = Math.max(0, data(r).until - race.time);
    return { ok: cooldown <= 0, reason: cooldown > 0 ? 'ВОЗВРАТ ПЕРЕЗАРЯЖАЕТСЯ' : '', cooldown };
  }
  function recover(r) {
    r = player(r);
    const allowed = status(r);
    if (!allowed.ok) return allowed;
    const point = target(r);
    if (!point) return { ok: false, reason: 'НЕТ СВОБОДНОГО МЕСТА', cooldown: 0 };
    const originalIndex = r.trackIdx, originalLap = r.lap;
    r.x = point.x; r.y = point.y; r.ang = point.ang;
    for (const key of ['spd','lat','z','vz','susp','steerFlt','wheelAngle','bob','bobVel','rockAmp','rockT','landStun','jumpSpd','_reverseHold','_skidElapsed','_railHitN']) r[key] = 0;
    r.air = false; r.handbrake = false; r._engineTrail = null; r._deckDraw = 0;
    r._drift = { active: false, angle: 0, intensity: 0, held: 0 }; r._contactGrace = .8;
    r.invuln = Math.max(r.invuln || 0, .8);
    if (point.index !== originalIndex || point.lap !== originalLap) {
      r.trackIdx = point.index; r.lap = point.lap; r.prog = point.prog;
      r._lapCheckpoint = Math.min(r._lapCheckpoint || 0, Math.floor(point.index * 4 / race.N));
      // Перенос через линию назад не должен срабатывать как новый честный круг.
      if (point.lap < originalLap) r._lapRestore = true;
    }
    if (engine.insights) engine.insights.recoveryUsed(r); else r._lapInvalid = true;
    if (engine.trainingGhost) engine.trainingGhost.invalidate('ВОЗВРАТ НА ТРАССУ');
    if (engine.weaponCharge && engine.weaponCharge.cancel) engine.weaponCharge.cancel(r);
    data(r).until = race.time + COOLDOWN;
    if (typeof clearKeys === 'function') clearKeys();
    if (typeof announce === 'function') announce('МАШИНА НА ТРАССЕ · ЭТОТ КРУГ БЕЗ РЕКОРДА');
    return { ok: true, reason: '', cooldown: COOLDOWN, rolledBack: point.index !== originalIndex || point.lap !== originalLap };
  }
  wrap('stepVehicle', previous => function (r) {
    const result = previous.apply(this, arguments);
    sync();
    if (race && r.isP && !r.dead && !r.air && !r.finished && race.S && race.N && !(r._contactGrace > 0)) {
      const index = ((r.trackIdx | 0) % race.N + race.N) % race.N, p = race.S[index];
      if (p && !gap(index) && Math.hypot(r.x - p.x, r.y - p.y) < (typeof ROADW === 'number' ? ROADW : 95) * .72) {
        data(r).safe = { x: p.x, y: p.y, ang: p.ang, index, lap: r.lap, prog: r.lap * race.N + index };
      }
    }
    return result;
  });
  engine.recovery = { status, recover, cooldown: COOLDOWN };
})(typeof window !== 'undefined' ? window : globalThis);
