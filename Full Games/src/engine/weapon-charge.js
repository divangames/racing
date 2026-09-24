// Тяжёлое оружие даёт время на ответ и выпускает снаряд в заранее показанном направлении.
(function (global) {
  'use strict';
  const engine = global.DiVANEngine;
  const HEAVY = Object.freeze({
    homing: { label: 'РАКЕТА', duration: .45, range: 620 },
    mortar: { label: 'ГАУБИЦА', duration: .55, range: 580 },
    plasma: { label: 'ПЛАЗМА', duration: .40, range: 790 }
  });
  function specification(r) { return r && r.car && HEAVY[carAbil(r.car.idx).weapon.type]; }
  function requiresCharge(r) { return !!specification(r); }
  function state(r) {
    const charge = r && r.weaponCharge;
    if (!charge || r.dead || r.finished || typeof R === 'undefined' || charge.race !== R) return null;
    return { type: charge.type, label: HEAVY[charge.type].label, remaining: charge.remaining, total: charge.total, progress: 1 - charge.remaining / charge.total, angle: charge.angle };
  }
  function cancel(r) { if (r) r.weaponCharge = null; }
  let release;
  engine.wrap('fireWeapon', original => {
    release = original;
    return function(r) {
      const spec = specification(r);
      if (!spec || !R || R.demo) return original(r);
      if (r.dead || r.finished || r.cdW > 0 || r.weaponCharge || R.phase !== 'go' || paused) return;
      const type = carAbil(r.car.idx).weapon.type;
      r.weaponCharge = { type, total: spec.duration, remaining: spec.duration, angle: r.ang, carIndex: r.car.idx, race: R };
      // Невидимый стрелок раскрывается ещё во время подготовки, а не в момент попадания.
      if (r.cloak > 0) r.cloak = 0;
    };
  });
  engine.wrap('tickCarKits', original => function(r, dt) {
    const result = original(r, dt), charge = r.weaponCharge;
    if (!charge) return result;
    if (!state(r) || r.car.idx !== charge.carIndex || carAbil(r.car.idx).weapon.type !== charge.type || R.phase !== 'go') { cancel(r); return result; }
    if (paused || !(dt > 0) || !Number.isFinite(dt)) return result;
    charge.remaining = Math.max(0, charge.remaining - dt);
    if (charge.remaining > 1e-9) return result;
    cancel(r);
    // Исходный выпуск сохраняет тюнинг, звук, kitPushShot и попадания всех существующих китов.
    const drivingAngle = r.ang;
    try { r.ang = charge.angle; release(r); } finally { r.ang = drivingAngle; }
    return result;
  });
  engine.wrap('killRacer', original => function(r) { cancel(r); return original.apply(this, arguments); });
  engine.wrap('respawn', original => function(r) { cancel(r); return original.apply(this, arguments); });
  /** Только реальная линия огня: стрелок вправе ехать, но не доворачивать уже начатый заряд. */
  function drawWorld() {
    if (!R || R.demo || R.phase !== 'go') return;
    g.save();
    for (const r of R.racers) {
      const charge = state(r);
      if (!charge) continue;
      const spec = HEAVY[charge.type], color = r.isP ? '#73e8ef' : '#ff715e';
      const dx = Math.cos(charge.angle), dy = Math.sin(charge.angle), x = r.x + dx * 28, y = r.y + dy * 28;
      g.globalAlpha = .28 + charge.progress * .45; g.strokeStyle = color; g.fillStyle = color;
      g.lineWidth = 2 + charge.progress * 2; g.setLineDash([12, 10]);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + dx * spec.range, y + dy * spec.range); g.stroke(); g.setLineDash([]);
      g.lineWidth = 3; g.beginPath(); g.arc(r.x, r.y, 34, charge.angle - Math.PI / 2, charge.angle - Math.PI / 2 + Math.PI * 2 * charge.progress); g.stroke();
      if (charge.type === 'mortar') { g.beginPath(); g.arc(x + dx * spec.range, y + dy * spec.range, 108, 0, Math.PI * 2); g.stroke(); }
      g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'bottom';
      g.fillText(charge.label + ' ' + charge.remaining.toFixed(1) + 'с', r.x, r.y - 42);
    }
    g.restore();
  }
  /** Уведомление прицела читается в экранных координатах даже при быстром движении камеры. */
  function drawHud() {
    if (!R || R.demo || R.phase !== 'go' || paused || !P || P.dead || P.finished) return;
    let charge = state(P), warning = false;
    if (!charge) for (const r of R.racers) {
      const incoming = state(r);
      if (!incoming || r === P) continue;
      const dx = P.x - r.x, dy = P.y - r.y, ca = Math.cos(incoming.angle), sa = Math.sin(incoming.angle);
      const along = dx * ca + dy * sa, across = Math.abs(-dx * sa + dy * ca);
      if (along > 0 && along < HEAVY[incoming.type].range + 100 && across < (incoming.type === 'mortar' ? 130 : 85)) {
        if (!charge || incoming.remaining < charge.remaining) { charge = incoming; warning = true; }
      }
    }
    if (!charge) return;
    const ui = engine.cyberHud ? engine.cyberHud.viewport() : { scale: viewS, width: viewW, height: viewH };
    const arsenal = engine.cyberHud && engine.cyberHud.layout(ui.width, ui.height).arsenal;
    const width = Math.min(540, ui.width - 32), x = (ui.width - width) / 2, y = arsenal ? arsenal.y - 97 : ui.height - 231;
    const color = warning ? '#ff715e' : '#73e8ef';
    g.save(); g.setTransform(ui.scale, 0, 0, ui.scale, 0, 0);
    g.fillStyle = 'rgba(6,15,22,.94)'; g.fillRect(x, y, width, 27);
    g.fillStyle = color; g.fillRect(x, y + 25, width * charge.progress, 2);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 12px sans-serif';
    g.fillText(charge.label + ' · ' + charge.remaining.toFixed(1) + 'с · ' + (warning ? 'УЙДИ С ЛИНИИ ОГНЯ' : 'КУРС ВЫСТРЕЛА ЗАФИКСИРОВАН'), ui.width / 2, y + 12, width - 18);
    g.restore();
  }
  engine.wrap('drawRaceArena', original => function() { const result = original.apply(this, arguments); drawWorld(); return result; });
  engine.wrap('drawHUD', original => function() { const result = original.apply(this, arguments); drawHud(); return result; });
  engine.weaponCharge = { HEAVY, requiresCharge, state, cancel, drawWorld, drawHud };
})(typeof window !== 'undefined' ? window : globalThis);
