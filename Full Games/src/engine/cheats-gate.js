////////////////////////////////////////////////////////
//
// DiVANEngine: читы только в dev-окне, не в публичном NSIS.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Пункт «ЧИТЫ» и deliane: скрыты в упакованном клиенте.
   * @returns {boolean}
   */
  function cheatsAllowedEngine() {
    const root = typeof window !== 'undefined' ? window : globalThis;
    if (root.__RNR_DESKTOP__ && root.__RNR_PUBLIC_BUILD__) return false;
    return true;
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.replace('cheatsAllowed', cheatsAllowedEngine);
  engine.wrap('submitCheat', function (orig) {
    return function () {
      if (!cheatsAllowed()) return;
      return orig.apply(this, arguments);
    };
  });
})(typeof window !== 'undefined' ? window : globalThis);
