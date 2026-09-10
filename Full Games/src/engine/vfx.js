////////////////////////////////////////////////////////
//
// DiVANEngine: гейт quarks — средние частицы, без reduced-motion.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Можно ли кормить RnRVfx: WebGL жив, не low, не reduce.
   * @param {object|null} vfx
   * @param {object|null} gfx
   * @param {boolean} reduce
   * @returns {boolean}
   */
  function vfxAllowed(vfx, gfx, reduce) {
    if (!vfx || !vfx.ok) return false;
    if (!gfx || gfx.particles === 'low') return false;
    if (reduce) return false;
    return true;
  }

  /**
   * Слой quarks: средний/высокий, без reduced-motion, WebGL поднялся.
   * @returns {boolean}
   */
  function vfxLiveEngine() {
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    return vfxAllowed(global.RnRVfx, settings && settings.graphics, reduce);
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.vfx = { vfxAllowed };
  engine.replace('vfxLive', vfxLiveEngine);
})(typeof window !== 'undefined' ? window : globalThis);
