////////////////////////////////////////////////////////
//
// DiVANEngine: тик ИИ на трассе и съезд после финиша.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * ИИ: полоса, объезд, реверс, ствол, нитро, ульта.
   * @param {object} r
   * @param {number} dt
   */
  function aiThinkEngine(r, dt) {
    const S = R.S, N = R.N;
    r.laneT -= dt;
    if (r.laneT <= 0) {
      r.laneT = 2 + Math.random() * 3;
      r.aiLane = clamp(r.aiLane + rnd(-35, 35), -55, 55);
    }
    const look = (10 + Math.abs(r.spd) * 0.05) | 0, i2 = (r.trackIdx + look) % N;
    const tx = S[i2].x + S[i2].nx * r.aiLane, ty = S[i2].y + S[i2].ny * r.aiLane;
    const want = Math.atan2(ty - r.y, tx - r.x), d = angDiff(want, r.ang);
    let steer = clamp(d * 2.4, -1, 1), th = 1;
    for (const o of R.racers) {
      if (o === r || o.dead || o.finished) continue;
      const dx = o.x - r.x, dy = o.y - r.y, dist = Math.hypot(dx, dy);
      if (dist < 95 && Math.abs(angDiff(Math.atan2(dy, dx), r.ang)) < 0.8) {
        const side = Math.sin(Math.atan2(dy, dx) - r.ang) > 0 ? -1 : 1;
        steer += side * 0.7;
      }
    }
    const i3 = (r.trackIdx + 24) % N;
    if (S[i3].k > 0.011 && Math.abs(r.spd) > 170) th = -0.15;
    if (Math.abs(r.spd) < 20 && !r.revT) r.stuckT += dt; else r.stuckT = 0;
    if (r.stuckT > 2.5) { r.revT = 0.8; r.stuckT = 0; }
    if (r.revT > 0) { r.revT -= dt; th = -1; steer = -steer; }
    r.ith = th; r.ist = clamp(steer, -1, 1);
    let bestT = null, bd = 1e9;
    for (const o of R.racers) {
      if (o === r || o.dead || o.finished) continue;
      const dd = Math.hypot(o.x - r.x, o.y - r.y);
      if (dd < bd) { bd = dd; bestT = o; }
    }
    if (bestT && kitAiWantsFire(r, bestT, bd) && r.cdW <= 0) {
      const mag = wepMagMax(r);
      const gat = carAbil(r.car.idx).weapon.type === 'gatling';
      const canMag = (mag <= 0 || ((r.wepOver || 0) <= 0 && (r.wepAmmo | 0) > 0)) && (!gat || (r.wepOver || 0) <= 0);
      if (canMag && Math.random() < dt * (R.demo ? 2.6 : 1.4) * r.skill * (mag > 0 || gat ? 5 : 1)) fireWeapon(r);
    }
    if (S[(r.trackIdx + 30) % N].k < 0.004 && !r.nitro && r.cdN <= 0 && Math.random() < dt * (R.demo ? 0.55 : 0.25) * r.skill) useNitro(r);
    if (r.cdU <= 0 && (bestT && bd < 300 || r.hp < r.maxhp * 0.4) && Math.random() < dt * (R.demo ? 0.9 : 0.5) * r.skill) useUlt(r);
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
  engine.ai = { think: aiThinkEngine, finishDrive: finishDriveEngine };
  engine.replace('aiThink', aiThinkEngine);
  engine.replace('finishDrive', finishDriveEngine);
})(typeof window !== 'undefined' ? window : globalThis);
