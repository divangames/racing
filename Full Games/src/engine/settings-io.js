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
    if (!arr || !arr.length) return true;
    const modern = new Set(['KeyZ', 'KeyP', 'KeyX', 'KeyC', 'BracketLeft', 'BracketRight']);
    if (arr.some(function (k) { return modern.has(k); })) return false;
    const legacy = new Set(['ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'Space', 'ShiftLeft', 'ShiftRight']);
    return arr.every(function (k) { return legacy.has(k); });
  }

  /**
   * Дописывает отсутствующие действия из каталога HTML.
   */
  function normalizeControlsEngine() {
    if (!settings.controls) settings.controls = {};
    for (const k of Object.keys(DEFAULT_CONTROLS)) {
      if (!settings.controls[k] || !settings.controls[k].length)
        settings.controls[k] = DEFAULT_CONTROLS[k].slice();
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
        graphics: { resolution: 0, particles: 'high', skids: true, weather: true, shake: true, showFps: false, cameraZoom: 2 },
        controls: {
          up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'],
          left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
          fire: ['KeyZ', 'KeyP'], nitro: ['KeyX', 'BracketLeft'], ult: ['KeyC', 'BracketRight'],
          handbrake: ['Space'], pause: ['Escape']
        },
        sound: { music: 50, sfx: 80, musicOn: true, sfxOn: true }
      };
      return;
    }
    if (!settings.graphics || typeof settings.graphics !== 'object')
      settings.graphics = { resolution: 0, particles: 'high', skids: true, weather: true, shake: true, showFps: false, cameraZoom: 2 };
    else if (settings.graphics.cameraZoom == null) settings.graphics.cameraZoom = 2;
    if (!settings.sound || typeof settings.sound !== 'object')
      settings.sound = { music: 50, sfx: 80, musicOn: true, sfxOn: true };
    else {
      if (settings.sound.music == null) settings.sound.music = 50;
      if (settings.sound.sfx == null) settings.sound.sfx = 80;
      if (settings.sound.musicOn == null) settings.sound.musicOn = true;
      if (settings.sound.sfxOn == null) settings.sound.sfxOn = true;
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
   * Пишет текущие настройки.
   */
  function saveSettingsEngine() {
    persistWrite(SETTINGS_KEY, JSON.stringify(settings));
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.replace('abilityBindsLookLegacy', abilityBindsLookLegacyEngine);
  engine.replace('normalizeControls', normalizeControlsEngine);
  engine.replace('normalizeSettings', normalizeSettingsEngine);
  engine.replace('loadSettings', loadSettingsEngine);
  engine.replace('saveSettings', saveSettingsEngine);
})(typeof window !== 'undefined' ? window : globalThis);
