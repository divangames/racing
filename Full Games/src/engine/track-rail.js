////////////////////////////////////////////////////////
//
// DiVANEngine: отскок от рельса без залипания и дребезга.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Ближняя точка сплайна у машины, не только trackIdx.
   * @param {object[]} S
   * @param {object} r
   * @returns {object}
   */
  function nearestSpline(S, r) {
    const N = S.length;
    const i0 = ((r.trackIdx | 0) % N + N) % N;
    let best = i0, bd = 1e18;
    for (let k = -10; k <= 10; k++) {
      const i = (i0 + k + N) % N;
      const dx = r.x - S[i].x, dy = r.y - S[i].y;
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = i; }
    }
    const s = S[best];
    return { i: best, x: s.x, y: s.y, nx: s.nx, ny: s.ny, tx: s.tx, ty: s.ty, ang: s.ang };
  }

  /**
   * Искры и урон при ударе о рельс.
   * @param {object} r
   * @param {number} hx
   * @param {number} hy
   * @param {number} nx
   * @param {number} ny
   * @param {number} force
   * @param {boolean} slam
   */
  function railHitFx(r, hx, hy, nx, ny, force, slam) {
    const now = typeof gt === 'number' ? gt : 0;
    const gap = slam ? 0.12 : 0.07;
    if (r._railFxAt != null && now - r._railFxAt < gap) return;
    r._railFxAt = now;
    const k = force < 40 ? 0.35 : force > 220 ? 1 : force / 220;
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduce && typeof spark === 'function') {
      spark(hx, hy, '#ffd23f', 6 + (k * 10) | 0, 120 + k * 160);
      if (slam) spark(hx, hy, '#fff', 4, 90);
    }
    if (!reduce && R && R.parts) {
      const tx = -ny, ty = nx;
      const n = slam ? 7 : 3;
      for (let i = 0; i < n; i++) {
        const s = 70 + Math.random() * (140 + k * 160);
        const j = (Math.random() - 0.5) * 1.4;
        R.parts.push({
          x: hx, y: hy,
          vx: nx * s + tx * j * 90, vy: ny * s + ty * j * 90,
          t: 0.12 + Math.random() * 0.18,
          col: i & 1 ? '#ff9d2e' : '#ffe08a',
          sz: 1.2 + Math.random() * 2.2, rim: 1
        });
      }
    }
    if (slam && R && R.shocks) R.shocks.push({ x: hx, y: hy, r: 5, maxR: 14 + k * 22, t: 0.28 });
    if (slam && r.isP && typeof doShake === 'function') doShake(3 + k * 6);
    if (slam && R && !R.demo && typeof sHit === 'function' && (r.isP || (typeof nearP === 'function' && nearP(hx, hy, 520)))) sHit();
    else if (slam && R && !R.demo && typeof swp === 'function' && r.isP) swp('triangle', 140, 40, 0.12, 0.22);
    if (slam) {
      r.rockAmp = Math.max(r.rockAmp || 0, 0.12 + k * 0.16);
      r.bobVel = (r.bobVel || 0) - (10 + k * 18);
    }
    if (slam && force > 88 && now - (r._railDmgAt || 0) > 0.28 && typeof dmgRacer === 'function') {
      r._railDmgAt = now;
      const dmg = Math.min(16, (force - 88) * 0.045);
      if (dmg > 0.8) dmgRacer(r, dmg, null, 'crush');
    }
  }

  /**
   * Один отскок: внутрь полотна, без переворота скорости каждый кадр.
   * @param {object} r
   * @param {number} roadW
   * @returns {boolean}
   */
  function keepOnTrackEngine(r, roadW) {
    if (!r || r.dead) return false;
    if (!R || !R.S || !R.S.length) return false;
    const p = nearestSpline(R.S, r);
    if (!p || p.nx == null) return false;
    if (typeof inTrackGap === 'function' && R.T && inTrackGap(R.T, p.i / R.S.length)) return false;
    const lat = (r.x - p.x) * p.nx + (r.y - p.y) * p.ny;
    let half = 16;
    if (typeof carHitHalf === 'function') {
      const h = carHitHalf(r);
      half = Math.max(10, h.hh || 16);
    }
    const limit = Math.max(18, roadW - half - 7);
    const skin = 5;
    if (Math.abs(lat) <= limit) {
      r._railHitN = 0;
      return false;
    }
    const side = lat > 0 ? 1 : -1;
    const nx = p.nx * side, ny = p.ny * side;
    const pen = Math.abs(lat) - (limit - skin);
    r.x -= nx * pen;
    r.y -= ny * pen;
    const fx = Math.cos(r.ang), fy = Math.sin(r.ang);
    let vx = fx * (r.spd || 0) - fy * (r.lat || 0);
    let vy = fy * (r.spd || 0) + fx * (r.lat || 0);
    const vn = vx * nx + vy * ny;
    const tx = -ny, ty = nx;
    const vt = vx * tx + vy * ty;
    const slam = vn > 36;
    let nAfter;
    if (slam) nAfter = -vn * (vn > 110 ? 0.55 : 0.38) - 28;
    else if (vn > 0) nAfter = -12;
    else nAfter = vn;
    r._railHitN = (r._railHitN || 0) + 1;
    if (r._railHitN > 5) {
      r.x -= nx * 18;
      r.y -= ny * 18;
      nAfter = -Math.max(50, Math.abs(r.spd || 0) * 0.3);
      r._railHitN = 0;
    }
    const tAfter = vt * (slam ? 0.72 : 0.88);
    vx = nx * nAfter + tx * tAfter;
    vy = ny * nAfter + ty * tAfter;
    r.spd = vx * fx + vy * fy;
    r.lat = -vx * fy + vy * fx;
    if (slam) r.ang += side * Math.min(0.08, vn * 0.00022);
    railHitFx(r, p.x + nx * (roadW + 4), p.y + ny * (roadW + 4), nx, ny, Math.max(vn, pen * 8), slam);
    return true;
  }

  /**
   * Повтор после тарана: чужой корпус не заталкивает в рельс.
   */
  function keepAllOnTrackEngine() {
    if (!R || !R.racers || typeof ROADW !== 'number') return;
    for (let i = 0; i < R.racers.length; i++) {
      const r = R.racers[i];
      if (!r || r.dead) continue;
      keepOnTrackEngine(r, ROADW);
    }
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  global.keepOnTrack = keepOnTrackEngine;
  global.keepAllOnTrack = keepAllOnTrackEngine;
  engine.track = engine.track || {};
  engine.track.keepOnTrack = keepOnTrackEngine;
  engine.track.keepAllOnTrack = keepAllOnTrackEngine;
})(typeof window !== 'undefined' ? window : globalThis);
