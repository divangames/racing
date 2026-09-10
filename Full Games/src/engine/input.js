////////////////////////////////////////////////////////
//
// DiVANEngine: удержание действий заезда (клавиши из настроек).
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Действие зажато по раскладке игрока.
   * @param {string} name
   * @returns {boolean}
   */
  function held(name) {
    const arr = settings && settings.controls && settings.controls[name];
    return !!(arr && arr.some(function (k) { return keys[k]; }));
  }

  /**
   * Ось газа и руля: -1…1, как в updRace.
   * @returns {{throttle:number,steer:number,handbrake:boolean}}
   */
  function axis() {
    return {
      throttle: (held('up') ? 1 : 0) - (held('down') ? 1 : 0),
      steer: (held('right') ? 1 : 0) - (held('left') ? 1 : 0),
      handbrake: held('handbrake')
    };
  }

  /**
   * Enter с основной и цифровой клавиатуры.
   * @param {string} c
   * @returns {boolean}
   */
  function isEnterEngine(c) {
    return c === 'Enter' || c === 'NumpadEnter';
  }

  /**
   * Подтверждение: Enter или пробел.
   * @param {string} c
   * @returns {boolean}
   */
  function isConfirmEngine(c) {
    return isEnter(c) || c === 'Space';
  }

  /**
   * Назад / пауза.
   * @param {string} c
   * @returns {boolean}
   */
  function isBackEngine(c) {
    return c === 'Escape';
  }

  /**
   * Код клавиши: KeyboardEvent.code, иначе устаревший key.
   * @param {{code?:string,key?:string}|null} e
   * @returns {string}
   */
  function codeFromEventEngine(e) {
    if (e && e.code) return e.code;
    const k = e && e.key;
    if (k === 'Enter') return 'Enter';
    if (k === 'Escape' || k === 'Esc') return 'Escape';
    if (k === ' ' || k === 'Spacebar') return 'Space';
    if (k === 'ArrowUp' || k === 'Up') return 'ArrowUp';
    if (k === 'ArrowDown' || k === 'Down') return 'ArrowDown';
    if (k === 'ArrowLeft' || k === 'Left') return 'ArrowLeft';
    if (k === 'ArrowRight' || k === 'Right') return 'ArrowRight';
    return k || '';
  }

  /**
   * Сброс залипания после меню и Alt+Tab.
   */
  function clearKeysEngine() {
    for (const k in keys) keys[k] = false;
  }

  /**
   * Не отдаём стрелки, пробел и F-клавиши браузеру во время игры.
   * @param {{preventDefault:function(),ctrlKey?:boolean,altKey?:boolean,metaKey?:boolean}} e
   * @param {string} code
   */
  function blockBrowserKeysEngine(e, code) {
    const gameCodes = [
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter', 'NumpadEnter',
      'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyZ', 'KeyX', 'KeyC', 'KeyP', 'BracketLeft', 'BracketRight',
      'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'ShiftLeft', 'ShiftRight', 'Tab', 'Escape',
      'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'Backquote', 'Backspace'
    ];
    const modAny = e.ctrlKey || e.altKey || e.metaKey;
    if (code === 'Space' || code === 'Enter' || code === 'NumpadEnter' || code === 'Escape' || gameCodes.includes(code)) e.preventDefault();
    if (code === 'Tab' || (code.startsWith('F') && code !== 'F12' && code !== 'KeyF')) e.preventDefault();
    if (modAny && (code.startsWith('Key') || code.startsWith('Arrow') || code.startsWith('Digit'))) e.preventDefault();
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.input = { held, axis };
  engine.replace('ctrlHeld', held);
  engine.replace('isEnter', isEnterEngine);
  engine.replace('isConfirm', isConfirmEngine);
  engine.replace('isBack', isBackEngine);
  engine.replace('codeFromEvent', codeFromEventEngine);
  engine.replace('clearKeys', clearKeysEngine);
  engine.replace('blockBrowserKeys', blockBrowserKeysEngine);
})(typeof window !== 'undefined' ? window : globalThis);
