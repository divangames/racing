////////////////////////////////////////////////////////
//
// DiVANEngine: камера мира заезда — зум, арена, погода на экране.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Матрица вида: масштаб заезда и сдвиг камеры с тряской.
   * @param {{cam:{x:number,y:number},sx:number,sy:number}} race
   * @param {number} zoom
   * @param {number} viewScale
   * @returns {{scale:number,tx:number,ty:number}}
   */
  function worldCamera(race, zoom, viewScale) {
    return {
      scale: viewScale * zoom,
      tx: -race.cam.x + race.sx,
      ty: -race.cam.y + race.sy
    };
  }

  /**
   * Мир в координатах трассы, затем оверлей погоды поверх вьюпорта.
   */
  function drawRaceWorldEngine() {
    const cam = worldCamera(R, raceZoom(), viewS);
    g.setTransform(cam.scale, 0, 0, cam.scale, 0, 0);
    g.save();
    g.translate(cam.tx, cam.ty);
    drawRaceArena();
    g.restore();
    if (global.RnRVfx && RnRVfx.ok) RnRVfx.blit('race', g);
    g.setTransform(viewS, 0, 0, viewS, 0, 0);
    if (settings.graphics.weather && global.RnRWeather) {
      RnRWeather.drawScreen(g, R, viewW, viewH);
    }
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.render = { worldCamera };
  engine.replace('drawRaceWorld', drawRaceWorldEngine);
})(typeof window !== 'undefined' ? window : globalThis);
