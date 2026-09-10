////////////////////////////////////////////////////////
//
// DiVANEngine: доля частиц и тряска камеры.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Сколько искр рисуем при настройке частиц.
   * @param {number} n
   * @returns {number}
   */
  function partNEngine(n) {
    const m = settings.graphics.particles === 'low' ? 0.35 : settings.graphics.particles === 'medium' ? 0.65 : 1;
    return Math.max(1, Math.round(n * m));
  }

  /**
   * Добавляет тряску, если она включена.
   * @param {number} v
   */
  function doShakeEngine(v) {
    if (settings.graphics.shake) R.shake = Math.min(14, R.shake + v);
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.replace('partN', partNEngine);
  engine.replace('doShake', doShakeEngine);
})(typeof window !== 'undefined' ? window : globalThis);
