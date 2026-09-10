////////////////////////////////////////////////////////
//
// DiVANEngine: рамки машин (SAT), без привязки к кадру меню.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Точка внутри ориентированной рамки.
   * @param {number} px
   * @param {number} py
   * @param {{cx:number,cy:number,hw:number,hh:number,ca:number,sa:number}} o
   * @returns {boolean}
   */
  function pointInObbEngine(px, py, o) {
    const dx = px - o.cx, dy = py - o.cy;
    return Math.abs(dx * o.ca + dy * o.sa) <= o.hw && Math.abs(-dx * o.sa + dy * o.ca) <= o.hh;
  }

  /**
   * Перекрытие двух рамок. MTV: единичный вектор от A к B и глубина.
   * @param {object} A
   * @param {object} B
   * @returns {{nx:number,ny:number,pen:number}|null}
   */
  function obbOverlapEngine(A, B) {
    const dx = B.cx - A.cx, dy = B.cy - A.cy;
    const span = Math.hypot(A.hw, A.hh) + Math.hypot(B.hw, B.hh);
    if (dx * dx + dy * dy > span * span) return null;
    const axes = [[A.ca, A.sa], [-A.sa, A.ca], [B.ca, B.sa], [-B.sa, B.ca]];
    let pen = 1e9, nx = 1, ny = 0;
    for (let i = 0; i < 4; i++) {
      const ax = axes[i][0], ay = axes[i][1];
      const rA = A.hw * Math.abs(ax * A.ca + ay * A.sa) + A.hh * Math.abs(ax * (-A.sa) + ay * A.ca);
      const rB = B.hw * Math.abs(ax * B.ca + ay * B.sa) + B.hh * Math.abs(ax * (-B.sa) + ay * B.ca);
      const d = dx * ax + dy * ay, ov = rA + rB - Math.abs(d);
      if (ov <= 0) return null;
      if (ov < pen) {
        pen = ov;
        const s = d < 0 ? -1 : 1;
        nx = ax * s; ny = ay * s;
      }
    }
    if (!(nx || ny)) { nx = dx || 1; ny = dy; }
    const len = Math.hypot(nx, ny) || 1;
    return { nx: nx / len, ny: ny / len, pen };
  }

  /**
   * Рамка гонщика: центр с учётом смещения кузова в лаборатории.
   * @param {object} r
   * @returns {object}
   */
  function carObbEngine(r) {
    const h = carHitHalf(r);
    const cfg = typeof editorCarConfig === 'function' ? editorCarConfig(r.car.idx) : null;
    const ox = (cfg && cfg.body && cfg.body.x) || 0;
    const oy = (cfg && cfg.body && cfg.body.y) || 0;
    const ca = Math.cos(r.ang), sa = Math.sin(r.ang);
    return { cx: r.x + ox * ca - oy * sa, cy: r.y + ox * sa + oy * ca, hw: h.hw, hh: h.hh, ca, sa };
  }

  /**
   * Ось-выровненная рамка для тестов и простых зон.
   * @param {number} cx
   * @param {number} cy
   * @param {number} hw
   * @param {number} hh
   * @returns {object}
   */
  function aabb(cx, cy, hw, hh) {
    return { cx, cy, hw, hh, ca: 1, sa: 0 };
  }

  const collision = {
    pointInObb: pointInObbEngine,
    obbOverlap: obbOverlapEngine,
    carObb: carObbEngine,
    aabb
  };

  const engine = global.DiVANEngine;
  if (engine) {
    engine.collision = collision;
    engine.replace('pointInObb', pointInObbEngine);
    engine.replace('obbOverlap', obbOverlapEngine);
    if (typeof global.carHitHalf === 'function') engine.replace('carObb', carObbEngine);
  }
})(typeof window !== 'undefined' ? window : globalThis);
