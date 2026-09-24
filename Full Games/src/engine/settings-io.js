////////////////////////////////////////////////////////
//
// DiVANEngine: чтение настроек. Раскладка DEFAULT_CONTROLS остаётся в HTML.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Старые Ctrl/Alt/пробел на огне нельзя оставлять — глушат Z/X/C.
   * @param {string[]} arr
   * @returns {boolean}
   */
  function abilityBindsLookLegacyEngine(arr) {
    if (!Array.isArray(arr) || !arr.length) return true;
    const modern = new Set(['KeyZ', 'KeyP', 'KeyX', 'KeyC', 'BracketLeft', 'BracketRight']);
    if (arr.some(function (k) { return modern.has(k); })) return false;
    const legacy = new Set(['ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'Space', 'ShiftLeft', 'ShiftRight']);
    return arr.every(function (k) { return legacy.has(k); });
  }

  /**
   * Дописывает отсутствующие действия из каталога HTML.
   */
  function normalizeControlsEngine() {
    if (!settings.controls || typeof settings.controls !== 'object' || Array.isArray(settings.controls)) settings.controls = {};
    const reserved = new Set(['KeyM', 'KeyR', 'F3']);
    for (const k of Object.keys(DEFAULT_CONTROLS)) {
      const raw = settings.controls[k];
      const valid = Array.isArray(raw) ? raw.filter(function (code) {
        return typeof code === 'string' && code.length > 0 && code.length < 64 && !reserved.has(code);
      }).slice(0, 2) : [];
      settings.controls[k] = valid.length ? Array.from(new Set(valid)) : DEFAULT_CONTROLS[k].slice();
    }
    if (abilityBindsLookLegacy(settings.controls.fire)) {
      settings.controls.fire = DEFAULT_CONTROLS.fire.slice();
      settings.controls.nitro = DEFAULT_CONTROLS.nitro.slice();
      settings.controls.ult = DEFAULT_CONTROLS.ult.slice();
      try { saveSettings(); } catch (e) { /* старый диск */ }
    }
  }

  /**
   * Старый JSON без sound/graphics не должен ронять audioInit.
   */
  function normalizeSettingsEngine() {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      settings = {
        graphics: defaultGraphics(),
        controls: {
          up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'],
          left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
          fire: ['KeyZ', 'KeyP'], nitro: ['KeyX', 'BracketLeft'], ult: ['KeyC', 'BracketRight'],
          handbrake: ['Space'], pause: ['Escape']
        },
        sound: { music: 50, sfx: 80, biome: 80, crowd: 80, musicOn: true, sfxOn: true }
      };
      return;
    }
    const graphics = defaultGraphics();
    if (!settings.graphics || typeof settings.graphics !== 'object' || Array.isArray(settings.graphics)) settings.graphics = {};
    for (const key of Object.keys(graphics)) {
      const value = settings.graphics[key];
      if (typeof graphics[key] === 'boolean') settings.graphics[key] = typeof value === 'boolean' ? value : graphics[key];
    }
    settings.graphics.resolution = Number.isInteger(settings.graphics.resolution) && settings.graphics.resolution >= 0 &&
      (typeof RESOLUTIONS === 'undefined' || settings.graphics.resolution < RESOLUTIONS.length) ? settings.graphics.resolution : 0;
    settings.graphics.displayId = Number.isInteger(settings.graphics.displayId) ? settings.graphics.displayId : null;
    settings.graphics.particles = ['low', 'medium', 'high', 'off'].includes(settings.graphics.particles) ? settings.graphics.particles : graphics.particles;
    const zoomMin = typeof CAM_ZOOM_MIN === 'number' ? CAM_ZOOM_MIN : 1;
    const zoomMax = typeof CAM_ZOOM_MAX === 'number' ? CAM_ZOOM_MAX : 3;
    settings.graphics.cameraZoom = Number.isFinite(settings.graphics.cameraZoom)
      ? Math.max(zoomMin, Math.min(zoomMax, settings.graphics.cameraZoom)) : graphics.cameraZoom;
    settings.graphics.shakeStrength = Number.isFinite(settings.graphics.shakeStrength)
      ? Math.max(0, Math.min(100, settings.graphics.shakeStrength)) : settings.graphics.shake === false ? 0 : 60;
    const sound = defaultSound();
    if (!settings.sound || typeof settings.sound !== 'object' || Array.isArray(settings.sound)) settings.sound = {};
    for (const key of Object.keys(sound)) {
      const value = settings.sound[key];
      if (typeof sound[key] === 'boolean') settings.sound[key] = typeof value === 'boolean' ? value : sound[key];
      else settings.sound[key] = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : sound[key];
    }
    normalizeControls();
  }

  /**
   * Читает JSON настроек с диска карьеры.
   */
  function loadSettingsEngine() {
    try {
      const s = persistRead(SETTINGS_KEY);
      if (s) { settings = JSON.parse(s); }
    } catch (e) { /* битый JSON */ }
    normalizeSettings();
  }

  /**
   * Пишет текущие настройки. В экране настроек — только по «Применить».
   */
  function saveSettingsEngine() {
    if (settingsDraft && !settingsCommitLock && typeof state === 'string' && state === 'settings') return;
    persistWrite(SETTINGS_KEY, JSON.stringify(settings));
  }

  /** Заводская графика. @returns {object} */
  function defaultGraphics() {
    return { resolution: 0, fullscreen: true, displayId: null, particles: 'high', skids: true, weather: true, shake: true, shakeStrength: 60, showFps: false, cameraZoom: 2, combatHud: true };
  }

  /** Заводской звук. @returns {object} */
  function defaultSound() {
    return { music: 50, sfx: 80, biome: 80, crowd: 80, musicOn: true, sfxOn: true };
  }

  /**
   * Копия настроек без ссылок.
   * @param {object} src
   * @returns {object|null}
   */
  function cloneSettings(src) {
    if (!src || typeof src !== 'object') return null;
    try { return JSON.parse(JSON.stringify(src)); } catch (e) { return null; }
  }

  /** Разрешение и микшер после отката/сброса. */
  function liveApplySettings() {
    if (typeof applyResolution === 'function') applyResolution();
    if (typeof applyAudioSettings === 'function') applyAudioSettings();
  }

  /** Снимок на входе в настройки. */
  function beginSettingsDraft() {
    if (global.rnrDesktop && typeof global.rnrDesktop.screenState === 'function') {
      try {
        const state = global.rnrDesktop.screenState();
        global.rnrDisplayChoices = state.displays || [];
        settings.graphics.fullscreen = state.settings.fullscreen;
        settings.graphics.displayId = state.settings.displayId;
      } catch (err) { /* браузерный режим и старый клиент */ }
    }
    settingsDraft = cloneSettings(settings);
    settingsCommitLock = false;
    global._settingsDraftOn = true;
  }

  /** Откат к снимку (ESC / Назад без «Применить»). */
  function revertSettingsDraft() {
    if (!settingsDraft) return;
    settings = cloneSettings(settingsDraft);
    if (typeof normalizeSettings === 'function') normalizeSettings();
    liveApplySettings();
  }

  /** «Применить»: диск и новый снимок. */
  function commitSettings() {
    settingsCommitLock = true;
    try {
      persistWrite(SETTINGS_KEY, JSON.stringify(settings));
      settingsDraft = cloneSettings(settings);
    } finally {
      settingsCommitLock = false;
    }
    liveApplySettings();
    if (global.rnrDesktop && typeof global.rnrDesktop.setScreen === 'function') {
      global.rnrDesktop.setScreen({ fullscreen: settings.graphics.fullscreen, displayId: settings.graphics.displayId })
        .then(function (next) { settings.graphics.displayId = next.displayId; })
        .catch(function (err) { console.error('Не удалось применить настройки экрана', err); });
    }
  }

  /**
   * Заводские значения текущего раздела (или всех с корня).
   * @param {string} [pane]
   */
  function resetSettingsPane(pane) {
    const kind = pane || (typeof settingsState === 'string' ? settingsState : 'main');
    if (!settings || typeof settings !== 'object') normalizeSettings();
    switch (kind) {
      case 'graphics':
        settings.graphics = defaultGraphics();
        break;
      case 'sound':
        settings.sound = defaultSound();
        break;
      case 'controls':
        if (typeof resetControls === 'function') resetControls();
        else if (typeof DEFAULT_CONTROLS === 'object') {
          settings.controls = cloneSettings(DEFAULT_CONTROLS);
        }
        break;
      case 'game':
      case 'main':
        settings.graphics = defaultGraphics();
        settings.sound = defaultSound();
        if (typeof resetControls === 'function') resetControls();
        else if (typeof DEFAULT_CONTROLS === 'object') settings.controls = cloneSettings(DEFAULT_CONTROLS);
        break;
      default: {
        const neverPane = kind;
        void neverPane;
        break;
      }
    }
    liveApplySettings();
  }

  let settingsDraft = null;
  let settingsCommitLock = false;

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.settingsIo = {
    defaultGraphics,
    defaultSound,
    cloneSettings,
    beginSettingsDraft,
    revertSettingsDraft,
    commitSettings,
    resetSettingsPane
  };
  global.beginSettingsDraft = beginSettingsDraft;
  global.revertSettingsDraft = revertSettingsDraft;
  global.commitSettings = commitSettings;
  global.resetSettingsPane = resetSettingsPane;
  engine.replace('abilityBindsLookLegacy', abilityBindsLookLegacyEngine);
  engine.replace('normalizeControls', normalizeControlsEngine);
  engine.replace('normalizeSettings', normalizeSettingsEngine);
  engine.replace('loadSettings', loadSettingsEngine);
  engine.replace('saveSettings', saveSettingsEngine);
  if (engine.get('openSettings')) {
    engine.wrap('openSettings', function (orig) {
      return function (from) {
        orig(from);
        beginSettingsDraft();
      };
    });
  }
  if (engine.get('leaveSettings')) {
    engine.wrap('leaveSettings', function (orig) {
      return function () {
        revertSettingsDraft();
        orig();
        settingsDraft = null;
        global._settingsDraftOn = false;
      };
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
