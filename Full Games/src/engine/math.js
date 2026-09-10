////////////////////////////////////////////////////////
//
// DiVANEngine: угол, кольцо сплайна, сид мульберри.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Кратчайшая разница углов в (−π; π].
   * @param {number} a
   * @param {number} b
   * @returns {number}
   */
  function angDiffEngine(a, b) {
    let d = (a - b) % TAU;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    return d;
  }

  /**
   * Индекс внутри дуги сплайна, в том числе через ноль.
   * @param {number} idx
   * @param {number} a
   * @param {number} b
   * @returns {boolean}
   */
  function wrapBetweenEngine(idx, a, b) {
    if (a <= b) return idx >= a && idx <= b;
    return idx >= a || idx <= b;
  }

  /**
   * Детерминированный 0…1 из целого семени.
   * @param {number} seed
   * @returns {function(): number}
   */
  function mulberryEngine(seed) {
    return function () {
      seed |= 0;
      seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.math = { angDiff: angDiffEngine, wrapBetween: wrapBetweenEngine, mulberry: mulberryEngine };
  engine.replace('angDiff', angDiffEngine);
  engine.replace('wrapBetween', wrapBetweenEngine);
  engine.replace('mulberry', mulberryEngine);
})(typeof window !== 'undefined' ? window : globalThis);
