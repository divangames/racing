////////////////////////////////////////////////////////
//
// DiVANEngine: асфальт в карточках машин.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  const engine = global.DiVANEngine;
  if (!engine || !engine.trackStrip) return;

  // The game defines drawPreviewRoad in its inline script. Replace that
  // legacy flat road after the shared track material has been registered.
  global.drawPreviewRoad = function (boxW, boxH, moving, burst) {
    const c = g;
    const hw = boxW / 2, hh = boxH / 2;
    const asphalt = engine.trackStrip.bakeRoadStrip('asphalt', '#43404b');
    const speed = moving ? 520 + (burst || 0) * 280 : 0;
    const offset = speed ? (gt * speed) % boxW : 0;

    // Scroll the same asphalt used by the track, without the old sand shoulders.
    c.drawImage(asphalt, -hw - offset, -hh, boxW, boxH);
    if (offset) c.drawImage(asphalt, hw - offset, -hh, boxW, boxH);

    const period = 58, dash = 30;
    const shift = speed ? -(gt * speed) % period : 0;
    c.fillStyle = '#e8b030';
    for (let x = -hw - period + shift; x < hw; x += period) {
      c.fillRect(x, -5, dash, 10);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
