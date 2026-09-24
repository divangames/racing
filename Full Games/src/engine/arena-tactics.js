// Тактические повороты: честный выбор полосы, предупреждения и циклы опасности для игрока и ИИ.
(function (global) {
  'use strict';
  const engine = global.DiVANEngine, DAMAGE_STEP = .5, INNER_EDGE = 14;
  /** Возвращает фазу только живого заезда, не расходуя безопасное окно на отсчёт старта. */
  function state(race) {
    const plan = race && race.T.tactics;
    if (!plan) return null;
    if (race.phase !== 'go') return { kind: 'open', remaining: plan.period - plan.warning - plan.active };
    if (race._tacticStart == null) race._tacticStart = race.time;
    return RnRTactics.phase(plan, race.time - race._tacticStart);
  }
  /** Проверяет участок по индексу трассы и реальному положению, не захватывая соседнюю нитку. */
  function position(race, racer) {
    const plan = race && race.T.tactics;
    if (!plan) return null;
    const index = racer.trackIdx, p = race.S[index];
    const distance = Math.hypot(racer.x - p.x, racer.y - p.y);
    const lat = ((racer.x - p.x) * p.nx + (racer.y - p.y) * p.ny) * plan.side;
    const inside = index >= plan.a && index <= plan.b && distance <= ROADW + 20;
    const ahead = (plan.a - index + race.N) % race.N;
    const inRoute = index >= plan.entry && index <= plan.exit;
    return { inside, risky: inside && lat > INNER_EDGE, near: inRoute || inside || ahead < Math.max(24, Math.abs(racer.spd) * 1.8 / 14) };
  }
  /** Разрушение живёт только в заезде: редактор, сохранение и исходные ассеты не меняются. */
  function gate(race) {
    const plan = race && race.T.tactics;
    if (!plan || !plan.gate || race.demo) return null;
    if (!race.tacticGate) race.tacticGate = { ...plan.gate, hp: plan.gate.maxhp, broken: false };
    return race.tacticGate;
  }
  function gateBox(fence) {
    return { cx: fence.x, cy: fence.y, hw: fence.halfWidth, hh: fence.halfSpan, ca: Math.cos(fence.angle), sa: Math.sin(fence.angle) };
  }
  /** Swept slab test: быстрый снаряд или корпус не пролетает насквозь между кадрами. */
  function segmentHit(x0, y0, x1, y1, box, expandX, expandY) {
    const local = (x, y) => { const dx = x - box.cx, dy = y - box.cy; return [dx * box.ca + dy * box.sa, -dx * box.sa + dy * box.ca]; };
    const a = local(x0, y0), b = local(x1, y1), half = [box.hw + (expandX || 0), box.hh + (expandY || 0)];
    let enter = 0, exit = 1;
    for (let i = 0; i < 2; i++) {
      const delta = b[i] - a[i];
      if (Math.abs(delta) < 1e-9) { if (Math.abs(a[i]) > half[i]) return null; continue; }
      let near = (-half[i] - a[i]) / delta, far = (half[i] - a[i]) / delta;
      if (near > far) [near, far] = [far, near];
      enter = Math.max(enter, near); exit = Math.min(exit, far);
      if (enter > exit) return null;
    }
    return enter;
  }
  function damageGate(fence, amount, owner) {
    if (fence.broken || !(amount > 0)) return;
    fence.hp = Math.max(0, fence.hp - amount);
    if (typeof spark === 'function') spark(fence.x, fence.y, '#ffc76c', fence.hp ? 6 : 20, fence.hp ? 100 : 220);
    if (fence.hp) return;
    fence.broken = true;
    if (owner && owner.isP && typeof fl === 'function') fl(fence.x, fence.y, 'ПРОХОД ОТКРЫТ', '#73e8ef');
  }
  /** Внешняя полоса свободна; внутри забор можно заранее расстрелять или пробить тараном. */
  function contactGate(r, before, dt) {
    const fence = gate(R);
    if (!fence || fence.broken || R.phase !== 'go' || paused || r.dead || r.finished || r.air || (typeof kitGhost === 'function' && kitGhost(r))) return;
    r._gateImpactCd = Math.max(0, (r._gateImpactCd || 0) - dt);
    const box = gateBox(fence), car = carObb(r), hit = obbOverlap(car, box);
    const dx = car.cx - r.x, dy = car.cy - r.y;
    const along = car.hw * Math.abs(car.ca * box.ca + car.sa * box.sa) + car.hh * Math.abs(-car.sa * box.ca + car.ca * box.sa);
    const across = car.hw * Math.abs(-car.ca * box.sa + car.sa * box.ca) + car.hh * Math.abs(car.sa * box.sa + car.ca * box.ca);
    const sweep = segmentHit(before.x + dx, before.y + dy, car.cx, car.cy, box, along, across);
    if (!hit && sweep == null) return;
    const vx = Math.cos(r.ang) * r.spd - Math.sin(r.ang) * (r.lat || 0), vy = Math.sin(r.ang) * r.spd + Math.cos(r.ang) * (r.lat || 0);
    const impact = Math.abs(vx * box.ca + vy * box.sa);
    if (r._gateImpactCd <= 0 && impact > 70) {
      r._gateImpactCd = .7;
      damageGate(fence, (impact - 70) * .30, r);
      dmgRacer(r, Math.min(7, 2 + impact * .018), null, 'arena');
      r.spd *= fence.broken ? .78 : .45; r.lat = (r.lat || 0) * .5;
    }
    if (fence.broken) return;
    if (hit) { r.x -= hit.nx * (hit.pen + .5); r.y -= hit.ny * (hit.pen + .5); }
    else { r.x = before.x + (r.x - before.x) * Math.max(0, sweep - .005); r.y = before.y + (r.y - before.y) * Math.max(0, sweep - .005); }
    // Держать газ у целого забора не позволяет незаметно просочиться через него.
    if (impact < 70 || r._gateImpactCd > 0) r.spd *= Math.exp(-12 * dt);
  }
  function shootGate(dt) {
    const fence = gate(R);
    if (!fence || fence.broken || R.phase !== 'go' || paused) return;
    const box = gateBox(fence);
    for (let i = R.shots.length - 1; i >= 0 && !fence.broken; i--) {
      const s = R.shots[i], nextX = s.x + s.vx * dt, nextY = s.y + s.vy * dt;
      const t = segmentHit(s.x, s.y, nextX, nextY, box);
      if (t == null) continue;
      s.x += (nextX - s.x) * t; s.y += (nextY - s.y) * t;
      damageGate(fence, Math.max(1, s.dmg || 14), s.r);
      if (s.mortar && typeof kitOnShotExpire === 'function') kitOnShotExpire(s);
      R.shots.splice(i, 1);
    }
  }
  /** Воздействует только после предупреждения; накопление урона не зависит от FPS. */
  function affect(r, dt) {
    r._tacticGrip = 1;
    const plan = R && R.T.tactics, phase = state(R), pos = position(R, r);
    if (!plan || R.demo || R.phase !== 'go' || paused || r.dead || r.finished || r.air || !pos.risky || phase.kind !== 'active') {
      r._tacticDamage = 0; return;
    }
    if (plan.mode === 'slick') { r._tacticGrip = .42; return; }
    r._tacticDamage = (r._tacticDamage || 0) + dt;
    while (r._tacticDamage + 1e-9 >= DAMAGE_STEP && !r.dead) {
      r._tacticDamage = Math.max(0, r._tacticDamage - DAMAGE_STEP);
      dmgRacer(r, plan.mode === 'press' ? 9 : 5, null, 'arena');
    }
    if (plan.mode === 'press') r.spd *= Math.exp(-1.4 * dt);
  }
  /** Рисует полосу по точкам сплайна, сохраняя верхние слои машин и объектов. */
  function path(points) {
    g.beginPath(); points.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y));
  }
  /** Прозрачная разметка показывает реальный внутренний и внешний путь, а не новую телепортацию. */
  function drawWorld() {
    const plan = R.T.tactics;
    if (!plan || R.demo) return;
    const phase = state(R), color = phase.kind === 'active' ? '#ff715e' : phase.kind === 'warning' ? '#ffd23f' : '#e1b966';
    g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
    g.globalAlpha = phase.kind === 'active' ? .30 : .14;
    g.strokeStyle = color; g.lineWidth = 68; path(plan.inner); g.stroke();
    g.globalAlpha = .9; g.lineWidth = 3; g.setLineDash([16, 12]); path(plan.innerRoute || plan.inner); g.stroke();
    g.strokeStyle = '#73e8ef'; path(plan.outerRoute || plan.outer); g.stroke(); g.setLineDash([]);
    const fence = gate(R);
    if (fence) {
      g.save(); g.translate(fence.x, fence.y); g.rotate(fence.angle); g.globalAlpha = fence.broken ? .45 : 1;
      g.fillStyle = '#131a22'; g.strokeStyle = fence.broken ? '#73e8ef' : '#ffc76c'; g.lineWidth = 3;
      if (!fence.broken) {
        g.fillRect(-8, -32, 16, 64); g.strokeRect(-8, -32, 16, 64);
        g.beginPath(); for (let y = -25; y < 30; y += 14) { g.moveTo(-7, y); g.lineTo(7, y + 9); } g.stroke();
        g.fillStyle = '#ffdb92'; g.fillRect(-14, -32, 3, 64 * fence.hp / fence.maxhp);
      } else {
        for (const y of [-32, 32]) { g.fillRect(-7, y - 3, 14, 6); g.strokeRect(-7, y - 3, 14, 6); }
      }
      g.restore();
    }
    const entry = R.S[plan.a], mid = R.S[Math.floor((plan.a + plan.b) / 2)];
    const saved = Math.round(100 * (1 - (plan.routeShortLength || plan.shortLength) / (plan.routeLongLength || plan.longLength)));
    for (const [p, label, col] of [[entry, 'Срез −' + saved + '% · ' + (fence && !fence.broken ? 'ПРОБЕЙ ЗАБОР' : 'ПРОХОД ОТКРЫТ'), color], [mid, plan.title, color]]) {
      g.fillStyle = '#071017'; g.fillRect(p.x - 104, p.y - ROADW - 44, 208, 30);
      g.font = 'bold 13px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = col;
      g.fillText(label, p.x, p.y - ROADW - 29, 196);
    }
    g.restore();
  }
  /** Короткая памятка остаётся до въезда, затем уступает место таймеру конкретной угрозы. */
  function drawHud() {
    const plan = R && R.T.tactics;
    if (!plan || R.demo || paused || R.phase !== 'go' || P.finished) return;
    const pos = position(R, P), phase = state(R);
    if (!pos.near && R.time - R._tacticStart > 8) return;
    const title = pos.near ? plan.title + ' · ' + (phase.kind === 'active' ? 'АКТИВНО ' : phase.kind === 'warning' ? 'ОПАСНОСТЬ ЧЕРЕЗ ' : 'ОКНО ') + Math.ceil(phase.remaining) + 'с' : plan.title;
    const fence = gate(R);
    const detail = pos.near && fence && !fence.broken && phase.kind !== 'active' ? 'Забор внутри: выстрел или быстрый таран. Голубая полоса свободна.' : pos.near && phase.kind === 'active' ? 'Внешняя голубая полоса — безопасный обход' : plan.advice;
    const ui = engine.cyberHud ? engine.cyberHud.viewport() : { scale: viewS, width: viewW, height: viewH };
    const arsenal = engine.cyberHud && engine.cyberHud.layout(ui.width, ui.height).arsenal;
    g.save(); g.setTransform(ui.scale, 0, 0, ui.scale, 0, 0);
    const width = Math.min(570, arsenal ? arsenal.w : ui.width - 32), x = (ui.width - width) / 2;
    const y = arsenal ? arsenal.y - 64 : ui.height - 198;
    panel(g, x, y, width, 52, 'rgba(6,15,22,.90)', phase.kind === 'active' ? '#ff715e' : '#e1b966', 6);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = phase.kind === 'active' ? '#ff715e' : '#ffd23f';
    g.font = 'bold 14px sans-serif'; g.fillText(title, ui.width / 2, y + 15, width - 20);
    g.fillStyle = '#e7eff0'; g.font = '12px sans-serif'; g.fillText(detail, ui.width / 2, y + 36, width - 20); g.restore();
  }
  engine.wrap('buildTrack', original => function(def, idx) {
    const track = original(def, idx); track.tactics = RnRTactics.plan(track, def); return track;
  });
  engine.wrap('buildRace', original => function() {
    const result = original();
    // На тактической трассе не показываем прежние порталы и не даём вторую награду за срез.
    if (R && R.T.tactics) { R.shortcuts = []; R.tacticGate = null; gate(R); }
    return result;
  });
  engine.wrap('placeTrackHazards', original => function(T, seed) {
    const hz = original(T, seed), plan = T.tactics;
    // Только процедурные опасности: ручные объекты автора не удаляются скрытно.
    if (plan && T.autoHazards) for (const name of ['mines', 'oils', 'ramps']) hz[name] = hz[name].filter(p => p.i < plan.entry || p.i > plan.exit);
    return hz;
  });
  engine.wrap('stepVehicle', original => function(r, th, steer, dt, hb) {
    const before = { x: r.x, y: r.y };
    if (Number.isFinite(dt) && dt > 0) affect(r, dt);
    const result = original(r, th, steer, dt, hb);
    if (Number.isFinite(dt) && dt > 0) contactGate(r, before, dt);
    return result;
  });
  engine.wrap('resolveRaceContact', original => function(dt) { shootGate(dt); return original(dt); });
  engine.wrap('aiThink', original => function(r, dt) {
    original(r, dt);
    const plan = R.T.tactics, pos = position(R, r);
    if (!plan || !pos.near || r.revT > 0) return;
    const phase = state(R);
    // ИИ оценивает запас окна на весь поворот, а не ныряет под закрывающийся пресс.
    const safeTime = plan.shortLength / Math.max(120, Math.abs(r.spd)) + 2;
    const fence = gate(R), gateReady = !fence || fence.broken || r.trackIdx > fence.index + 3 || r.spd > 185;
    const takeRisk = phase.kind === 'open' && phase.remaining > safeTime && r.hp > r.maxhp * .45 && gateReady;
    const targetIndex = (r.trackIdx + 12) % R.N;
    r.aiLane = RnRTactics.laneOffset(plan, targetIndex, takeRisk);
    const p = R.S[targetIndex];
    r.ist = clamp(angDiff(Math.atan2(p.y + p.ny * r.aiLane - r.y, p.x + p.nx * r.aiLane - r.x), r.ang) * 2.4, -1, 1);
  });
  engine.wrap('drawHUD', original => function() { original(); drawHud(); });
  engine.tactics = { state, position, affect, gate, contactGate, shootGate, segmentHit, drawWorld, drawHud };
})(typeof window !== 'undefined' ? window : globalThis);
