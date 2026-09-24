////////////////////////////////////////////////////////
//
// DiVANEngine: тик ИИ на трассе и съезд после финиша.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  function reset(r) {
    r._aiIntent = null; r._aiBurst = null; r._aiAttackRest = 0;
  }

  function intent(r) {
    const pending = r && r._aiIntent;
    if (!pending || r.dead || r.finished || r.cloak > 0) return null;
    return { target: pending.target, kind: pending.kind, remaining: pending.remaining,
      duration: pending.duration, progress: clamp(1 - pending.remaining / pending.duration, 0, 1) };
  }

  function readyWeapon(r) {
    if (r.cdW > 0 || (r.wepOver || 0) > 0) return false;
    return wepMagMax(r) <= 0 || (r.wepAmmo | 0) > 0;
  }

  /** Подготовка атаки видна до выстрела; смена цели начинает новое предупреждение. */
  function attacks(r, dt, policy, style) {
    const weapon = carAbil(r.car.idx).weapon;
    const charging = global.DiVANEngine.weaponCharge;
    if (charging && typeof charging.state === 'function' && charging.state(r)) return;
    const rapid = weapon.type === 'minigun' || weapon.type === 'gatling';
    const permitted = target => policy.validTarget(r, target) && R.racers.includes(target) &&
      kitAiWantsFire(r, target, Math.hypot(target.x - r.x, target.y - r.y));
    r._aiAttackRest = Math.max(0, (r._aiAttackRest || 0) - dt);
    if (r._aiBurst) {
      const burst = r._aiBurst;
      burst.remaining -= dt;
      if (burst.remaining <= 0 || !permitted(burst.target) || (r.wepOver || 0) > 0) {
        r._aiBurst = null; r._aiAttackRest = .28;
      } else if (readyWeapon(r)) fireWeapon(r);
      return;
    }
    if (r._aiIntent) {
      const pending = r._aiIntent;
      const valid = pending.kind === 'weapon' ? readyWeapon(r) && permitted(pending.target) : r.cdU <= 0 &&
        (!pending.target ? r.hp < r.maxhp * .4 : policy.validTarget(r, pending.target) && R.racers.includes(pending.target) && Math.hypot(pending.target.x - r.x, pending.target.y - r.y) < 330);
      if (!valid) { r._aiIntent = null; r._aiAttackRest = .12; return; }
      pending.remaining = Math.max(0, pending.remaining - dt);
      if (pending.remaining <= 1e-9) {
        r._aiIntent = null;
        if (pending.kind === 'weapon') {
          fireWeapon(r);
          if (rapid) r._aiBurst = { target: pending.target, remaining: style.burst };
        } else useUlt(r);
        r._aiAttackRest = .22;
      }
      return;
    }
    if (r._aiAttackRest > 0) return;
    const skill = clamp(Number(r.skill) || .75, .5, 1.2);
    const target = policy.chooseTarget(r, R, true).target;
    if (target && readyWeapon(r) && Math.random() < 1 - Math.exp(-dt * (R.demo ? 2.6 : 1.4) * skill * style.attack * (rapid ? 5 : 1))) {
      const charge = global.DiVANEngine.weaponCharge;
      // Тяжёлый ствол сам показывает заряд: не удваиваем его задержку прицеливания.
      if (charge && typeof charge.requiresCharge === 'function' && charge.requiresCharge(r)) {
        fireWeapon(r); r._aiAttackRest = .22;
      } else r._aiIntent = { kind: 'weapon', target, duration: style.windup, remaining: style.windup };
      return;
    }
    const enemy = policy.chooseTarget(r, R, false);
    if (r.cdU <= 0 && (enemy.target && enemy.distance < 300 || r.hp < r.maxhp * .4) &&
      Math.random() < 1 - Math.exp(-dt * (R.demo ? .9 : .5) * skill * style.attack)) {
      const duration = style.windup + .1;
      r._aiIntent = { kind: 'ult', target: enemy.distance < 300 ? enemy.target : null, duration, remaining: duration };
    }
  }

  /**
   * ИИ: полоса, объезд, реверс, ствол, нитро, ульта.
   * @param {object} r
   * @param {number} dt
   */
  function aiThinkEngine(r, dt) {
    if (!Number.isFinite(dt) || dt <= 0 || !R.S || !R.S.length || r.dead || r.finished) {
      if (r.dead || r.finished) reset(r);
      return;
    }
    const S = R.S, N = R.N;
    const policy = global.DiVANEngine.aiPersonality;
    const style = policy && policy.profile(r);
    const look = (r.trackIdx + Math.min(N - 1, 10 + Math.floor(Math.abs(r.spd) * .05))) % N;
    const q = S[look];
    const plan = policy ? policy.drivePlan(r, R, dt) : { throttle: 1, steer: clamp(angDiff(Math.atan2(q.y - r.y, q.x - r.x), r.ang) * 2.4, -1, 1) };
    r._aiPlan = plan;
    if (style) r.aiStyle = style.id;
    let steer = plan.steer, th = plan.throttle;
    r.revT = Math.max(0, Number(r.revT) || 0);
    if (Math.abs(r.spd) < 20 && r.revT <= 0) r.stuckT = (r.stuckT || 0) + dt; else r.stuckT = 0;
    if (r.stuckT > 2.5) { r.revT = 0.8; r.stuckT = 0; }
    if (r.revT > 0) { r.revT = Math.max(0, r.revT - dt); th = -1; steer = -steer; }
    r.ith = th; r.ist = clamp(steer, -1, 1);
    if (policy && !(r._contactGrace > 0) && r.revT <= 0) attacks(r, dt, policy, style);
    else { r._aiIntent = null; r._aiBurst = null; }
    if ((!plan.curvature || plan.curvature < .004) && !plan.blocked && th > 0 && Math.abs(steer) < .45 &&
      (r.nitro || 0) <= 0 && r.cdN <= 0 && Math.random() < 1 - Math.exp(-dt * (R.demo ? .55 : .25) * (Number(r.skill) || .75))) useNitro(r);
  }

  /**
   * После финиша: катимся, тормозим, уходим к обочине, объезжаем других.
   * @param {object} r
   * @returns {{th:number,st:number}}
   */
  function finishDriveEngine(r) {
    const S = R.S, p = S[r.trackIdx];
    if (r.pitSide == null) {
      const lat = (r.x - p.x) * p.nx + (r.y - p.y) * p.ny;
      r.pitSide = lat >= 0 ? 1 : -1;
    }
    const look = (r.trackIdx + 10) % R.N, q = S[look];
    const edge = (ROADW - 32) * r.pitSide;
    const tx = q.x + q.nx * edge, ty = q.y + q.ny * edge;
    const want = Math.atan2(ty - r.y, tx - r.x);
    let steer = clamp(angDiff(want, r.ang) * 2.6, -1, 1);
    const sp = Math.abs(r.spd);
    let th = sp > 110 ? -0.28 : (sp > 45 ? -0.12 : 0);
    for (const o of R.racers) {
      if (o === r || o.dead) continue;
      const dx = o.x - r.x, dy = o.y - r.y, d = Math.hypot(dx, dy);
      if (d < 1 || d > 120) continue;
      const ahead = Math.cos(r.ang) * dx + Math.sin(r.ang) * dy;
      if (ahead < -20 || ahead > 95) continue;
      const side = Math.sin(Math.atan2(dy, dx) - r.ang) > 0 ? -1 : 1;
      steer += side * clamp((110 - d) / 70, 0.35, 1.1);
      if (ahead > 6 && sp > 30) th = -0.55;
    }
    return { th, st: clamp(steer, -1, 1) };
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.ai = { think: aiThinkEngine, finishDrive: finishDriveEngine, intent, reset };
  engine.replace('aiThink', aiThinkEngine);
  engine.replace('finishDrive', finishDriveEngine);
  for (const hook of ['killRacer', 'respawn']) if (typeof global[hook] === 'function') {
    engine.wrap(hook, original => function(r) {
      reset(r);
      r.revT = 0; r.stuckT = 0;
      return original.apply(this, arguments);
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
