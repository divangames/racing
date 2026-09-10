////////////////////////////////////////////////////////
//
// DiVANEngine: холст, поля ультравайда и зум камеры заезда.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Размер холста по списку RESOLUTIONS из HTML.
   */
  function applyResolutionEngine() {
    const r = RESOLUTIONS[settings.graphics.resolution || 0] || RESOLUTIONS[0];
    if (!r || r.w === 0) {
      const dpr = global.devicePixelRatio || 1;
      cv.width = Math.max(640, Math.round(global.innerWidth * dpr));
      cv.height = Math.max(360, Math.round(global.innerHeight * dpr));
    } else { cv.width = r.w; cv.height = r.h; }
    fit();
  }

  /**
   * Масштаб letterbox: игровые 1280×720 внутри холста.
   */
  function updateViewEngine() {
    viewS = Math.min(cv.width / W, cv.height / H);
    if (!viewS || !Number.isFinite(viewS)) {
      viewS = 1; viewOX = 0; viewOY = 0; viewW = W; viewH = H; return;
    }
    viewOX = (cv.width - W * viewS) / 2;
    viewOY = (cv.height - H * viewS) / 2;
    viewW = cv.width / viewS;
    viewH = cv.height / viewS;
  }

  /** Левый край сцены в игровых единицах. @returns {number} */
  function stageX0Engine() { return -viewOX / viewS; }

  /** Верх сцены в игровых единицах. @returns {number} */
  function stageY0Engine() { return -viewOY / viewS; }

  /**
   * Зум заезда: дальше 1.75, ближе 2.2.
   * @returns {number}
   */
  function raceZoomEngine() {
    const z = settings.graphics && settings.graphics.cameraZoom;
    return clamp(typeof z === 'number' ? z : CAM_ZOOM_DEF, CAM_ZOOM_MIN, CAM_ZOOM_MAX);
  }

  /**
   * Шаг ползунка без дробной погрешности.
   * @param {number} v
   * @returns {number}
   */
  function snapCameraZoomEngine(v) {
    const n = Math.round((clamp(v, CAM_ZOOM_MIN, CAM_ZOOM_MAX) - CAM_ZOOM_MIN) / CAM_ZOOM_STEP);
    return +(CAM_ZOOM_MIN + n * CAM_ZOOM_STEP).toFixed(2);
  }

  /**
   * Пишет зум и сейв настроек.
   * @param {number} v
   */
  function setCameraZoomEngine(v) {
    if (!settings.graphics) settings.graphics = {};
    settings.graphics.cameraZoom = snapCameraZoom(v);
    saveSettings();
  }

  /**
   * Сдвиг зума на один шаг ползунка.
   * @param {number} dir
   */
  function nudgeCameraZoomEngine(dir) {
    setCameraZoom(raceZoom() + dir * CAM_ZOOM_STEP);
  }

  /** Видимая ширина мира. @returns {number} */
  function visWEngine() { return viewW / raceZoom(); }

  /** Видимая высота мира. @returns {number} */
  function visHEngine() { return viewH / raceZoom(); }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.replace('applyResolution', applyResolutionEngine);
  engine.replace('updateView', updateViewEngine);
  engine.replace('stageX0', stageX0Engine);
  engine.replace('stageY0', stageY0Engine);
  engine.replace('raceZoom', raceZoomEngine);
  engine.replace('snapCameraZoom', snapCameraZoomEngine);
  engine.replace('setCameraZoom', setCameraZoomEngine);
  engine.replace('nudgeCameraZoom', nudgeCameraZoomEngine);
  engine.replace('visW', visWEngine);
  engine.replace('visH', visHEngine);
})(typeof window !== 'undefined' ? window : globalThis);
