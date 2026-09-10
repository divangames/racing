////////////////////////////////////////////////////////
//
// DiVANEngine: клик по настройкам и экрану камеры.
// Края хитбокса входят (в отличие от клика хаба).
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Верхний хит среди попаданий, края входят.
   * @param {number} x
   * @param {number} y
   * @param {Array<{x:number,y:number,w:number,h:number,act?:string}>} [hits]
   * @returns {object|null}
   */
  function hitSettingsAt(x, y, hits) {
    const list = hits || [];
    for (let i = list.length - 1; i >= 0; i--) {
      const b = list[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    }
    return null;
  }

  /**
   * Хит по текущим зонам панели настроек.
   * @param {number} x
   * @param {number} y
   * @returns {object|null}
   */
  function hitSettingsEngine(x, y) {
    return hitSettingsAt(x, y, g._setHits);
  }

  /**
   * Первый заход: ползунок, «дальше», подсказка.
   * @param {number} x
   * @param {number} y
   */
  function clickCameraSetupEngine(x, y) {
    const h = hitSettings(x, y);
    if (!h) return;
    if (h.act === 'zoombar' && !cameraSetupHint) {
      setZoomFromPointer(x, h); settingsZoomDrag = true; sClick(); return;
    }
    if (h.act === 'camGo') { showCameraSetupHint(); sClick(); return; }
    if (h.act === 'camHint') { finishCameraSetup(); sClick(); }
  }

  /**
   * Клик по пункту настроек: выбор, ползунок камеры, вход в раздел.
   * @param {number} x
   * @param {number} y
   */
  function clickSettingsEngine(x, y) {
    const h = hitSettings(x, y);
    if (!h) return;
    if (h.act === 'zoombar') {
      settingsTab = 0; setZoomFromPointer(x, h); settingsZoomDrag = true; sClick(); return;
    }
    if (h.act === 'main') {
      settingsTab = h.i; press('Enter'); return;
    }
    if (h.act === 'back') {
      settingsBack(); sClick(); return;
    }
    if (h.act === 'gfx') {
      settingsTab = h.i;
      const opt = gfxOpts()[h.i];
      if (opt.type === 'zoom') { sClick(); return; }
      if (nudgeGraphics(x < (h.x + h.w / 2) ? -1 : 1)) sClick();
      return;
    }
    if (h.act === 'snd') {
      settingsTab = h.i;
      if (nudgeSound(x < (h.x + h.w / 2) ? -1 : 1)) sClick();
      return;
    }
    if (h.act === 'game' || h.act === 'ctrl') {
      settingsTab = h.i; press('Enter');
    }
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.settingsInput = { hitSettingsAt };
  engine.replace('hitSettings', hitSettingsEngine);
  engine.replace('clickCameraSetup', clickCameraSetupEngine);
  engine.replace('clickSettings', clickSettingsEngine);
})(typeof window !== 'undefined' ? window : globalThis);
