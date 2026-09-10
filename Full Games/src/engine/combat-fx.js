////////////////////////////////////////////////////////
//
// DiVANEngine: искры, взрыв, пыль с колёс, дым подбитого корпуса.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * 0…3 для дыма взрыва.
   * @returns {number}
   */
  function irnd4Engine() {
    return (Math.random() * 4) | 0;
  }

  /**
   * Искра на холсте или quarks.
   * @param {number} x
   * @param {number} y
   * @param {string} col
   * @param {number} n
   * @param {number} sp
   */
  function sparkEngine(x, y, col, n, sp) {
    if (vfxLive() && RnRVfx.spark(x, y, col, n, sp)) return;
    const cnt = partN(n);
    for (let i = 0; i < cnt; i++) {
      const a = rnd(TAU), s = rnd(sp * .3, sp);
      R.parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: rnd(.2, .5), col: col, sz: rnd(2, 4) });
    }
  }

  /**
   * Дым и огонь с корпуса, когда машина на исходе.
   * @param {object} r
   * @param {number} dt
   */
  function emitWreckFxEngine(r, dt) {
    if (!R || !R.parts || r.dead || r.maxhp <= 0 || r.hp > r.maxhp * 0.52) return;
    r.smokeT -= dt;
    const hurt = 1 - clamp(r.hp / r.maxhp, 0, 1);
    const crit = hurt > 0.65;
    const dying = hurt > 0.82;
    if (r.smokeT > 0) return;
    r.smokeT = dying ? 0.045 : crit ? 0.07 : 0.13;
    const side = Math.random() < 0.5 ? -1 : 1;
    const sparkAt = typeof carSparkWorld === 'function'
      ? function (ox, oy) { return carSparkWorld(r, ox, oy); }
      : function () { return { x: r.x, y: r.y }; };
    const hood = sparkAt(12 + Math.random() * 5, (Math.random() - 0.5) * 7);
    const hull = sparkAt((Math.random() - 0.35) * 12, side * (6 + Math.random() * 5));
    const pts = dying ? [hood, hull, sparkAt(-8, side * 5)] : crit ? [hood, hull] : [hood];
    const wreck = vfxLive() && typeof RnRVfx.wreck === 'function';
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (wreck && RnRVfx.wreck(p.x, p.y, hurt)) continue;
      R.parts.push({ x: p.x, y: p.y, vx: rnd(-18, 18), vy: rnd(-55, -16), t: rnd(.7, 1.2), col: 'rgba(18,16,14,.72)', sz: rnd(7, 14) });
      if (crit) R.parts.push({ x: p.x, y: p.y, vx: rnd(-14, 14), vy: rnd(-48, -12), t: rnd(.18, .4), col: 'rgba(255,140,32,.85)', sz: rnd(3, 7) });
    }
  }

  /**
   * Запасной всплеск на холсте, если quarks выключен.
   * @param {object} r
   * @param {number} impact
   * @param {string} kind
   */
  function spawnCanvasSprayEngine(r, impact, kind) {
    const k = clamp(impact, .25, 1.2);
    const n = partN(kind === 'water' ? 10 + k * 14 : 12 + k * 16);
    const fx = Math.cos(r.ang), fy = Math.sin(r.ang);
    let cols;
    if (kind === 'snow') cols = ['rgba(245,250,255,.78)', 'rgba(210,228,245,.62)', 'rgba(255,255,255,.55)'];
    else if (kind === 'water') cols = ['rgba(150,200,235,.55)', 'rgba(90,150,200,.45)', 'rgba(220,240,255,.4)'];
    else cols = ['rgba(168,138,92,.58)', 'rgba(120,96,68,.5)', 'rgba(196,170,120,.42)'];
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      const ox = -fx * 10 + (-fy) * side * (10 + Math.random() * 8);
      const oy = -fy * 10 + fx * side * (10 + Math.random() * 8);
      const a = rnd(TAU);
      const s = (kind === 'water' ? rnd(70, 200) : kind === 'snow' ? rnd(28, 110) : rnd(40, 140)) * k;
      const lift = kind === 'snow' ? -40 : kind === 'water' ? -20 : 0;
      R.parts.push({
        x: r.x + ox, y: r.y + oy,
        vx: Math.cos(a) * s - fx * (kind === 'water' ? 80 : 50),
        vy: Math.sin(a) * s - fy * (kind === 'water' ? 80 : 50) + lift,
        t: rnd(kind === 'water' ? .18 : .4, kind === 'water' ? .45 : 1.05),
        col: cols[i % 3], sz: rnd(kind === 'water' ? 2 : 5, kind === 'water' ? 6 : 13) * k,
        kind: kind === 'water' ? 'streak' : (kind === 'snow' ? 'flake' : null)
      });
    }
    if (kind === 'water' && R.shocks) R.shocks.push({ x: r.x, y: r.y, r: 6, maxR: 22 + k * 28, t: .32, tint: 'water' });
  }

  /**
   * Пыль / снег / вода при приземлении или ручнике.
   * @param {object} r
   * @param {number} impact
   */
  function landDustEngine(r, impact) {
    if (!R || !R.parts || (r.car && r.car.hov)) return;
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const sliding = Math.abs(r.lat || 0) > 22 || Math.abs(r.spd) > 50;
    const kind = wheelSprayKind(r, sliding);
    if (vfxLive() && RnRVfx.dust(r.x, r.y, r.ang, impact, kind)) {
      if (kind === 'water' && R.shocks) R.shocks.push({ x: r.x, y: r.y, r: 6, maxR: 22 + clamp(impact, .2, 1) * 28, t: .32, tint: 'water' });
      return;
    }
    spawnCanvasSpray(r, impact, kind);
  }

  /**
   * Взрыв: quarks + ударная волна, иначе частицы холста.
   * @param {number} x
   * @param {number} y
   * @param {boolean|string} kind
   */
  function boomEngine(x, y, kind) {
    const k = kind === true || kind === 'car' ? 'car' : kind === 'rocket' ? 'rocket' : 'mine';
    if (vfxLive()) RnRVfx.boom(x, y, k);
    const car = k === 'car', rkt = k === 'rocket';
    const shock = car ? 120 : rkt ? 90 : 62;
    const scorch = car ? 44 : rkt ? 30 : 22;
    if (vfxLive()) {
      R.shocks.push({ x: x, y: y, r: 10, maxR: shock, t: .45 });
      if (car) R.shocks.push({ x: x, y: y, r: 6, maxR: 170, t: .32 });
      R.scorch.push({ x: x, y: y, r: scorch, t: 1 });
      return;
    }
    const nFire = partN(car ? 58 : rkt ? 36 : 24), nSmoke = partN(car ? 22 : rkt ? 12 : 10);
    const cols = car ? ['#ff9d2e', '#ff3d2e', '#ffd23f', '#fff'] : rkt ? ['#ff6b2e', '#ff3d2e', '#ffd23f'] : ['#ffe08a', '#ffd23f', '#c4a574'];
    for (let i = 0; i < nFire; i++) {
      const a = rnd(TAU), s = rnd(50, car ? 480 : rkt ? 320 : 220);
      R.parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: rnd(.2, .8), col: cols[i % cols.length], sz: rnd(3, car ? 9 : rkt ? 7 : 5) });
    }
    for (let i = 0; i < nSmoke; i++) {
      const a = rnd(TAU), s = rnd(20, car ? 180 : 100);
      R.parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * .7, t: rnd(.45, 1.1), col: ['#555', '#3a3530', '#2a2624', '#666'][irnd4()], sz: rnd(6, car ? 18 : 11) });
    }
    R.shocks.push({ x: x, y: y, r: 10, maxR: shock, t: .45 });
    if (car) R.shocks.push({ x: x, y: y, r: 6, maxR: 170, t: .32 });
    R.scorch.push({ x: x, y: y, r: scorch, t: 1 });
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.replace('irnd4', irnd4Engine);
  engine.replace('spark', sparkEngine);
  engine.replace('emitWreckFx', emitWreckFxEngine);
  engine.replace('spawnCanvasSpray', spawnCanvasSprayEngine);
  engine.replace('landDust', landDustEngine);
  engine.replace('boom', boomEngine);
})(typeof window !== 'undefined' ? window : globalThis);
