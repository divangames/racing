////////////////////////////////////////////////////////
//
// DiVANEngine: удержание действий заезда (клавиши из настроек).
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  let padState = null;
  let previousButtons = [];
  let navigationDirection = '';
  let navigationRepeat = 0;
  let blockedButtons = [];
  let blockedAxes = [];
  let suspended = false;
  let padSeen = false;
  let reconnectPending = false;
  let previousPadId = '';

  function rawPadButton(index) {
    const button = padState && padState.buttons && padState.buttons[index];
    if (!button) return 0;
    const value = typeof button === 'number' ? button :
      (Number.isFinite(button.value) ? button.value : (button.pressed ? 1 : 0));
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  }

  function padButton(index) {
    return suspended || blockedButtons[index] ? 0 : rawPadButton(index);
  }

  function deadAxis(value) {
    const n = Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
    return Math.abs(n) < 0.18 ? 0 : Math.max(-1, Math.min(1, (n - Math.sign(n) * 0.18) / 0.82));
  }

  function driveAxis(index) {
    return suspended || blockedAxes[index] ? 0 : deadAxis(padState && padState.axes && padState.axes[index]);
  }

  function focused() {
    return typeof document === 'undefined' || (!document.hidden &&
      (typeof document.hasFocus !== 'function' || document.hasFocus()));
  }

  /** Подтверждение меню и возврат в игру требуют отпустить прежний ввод. */
  function suppressHeldPad() {
    blockedButtons = Array.from({ length: padState && padState.buttons ? padState.buttons.length : 0 }, function (_, i) {
      return rawPadButton(i) > (i === 6 || i === 7 ? .05 : .55);
    });
    blockedAxes = [0, 1].map(function (i) { return Math.abs(deadAxis(padState && padState.axes && padState.axes[i])) > .05; });
    navigationDirection = '';
    navigationRepeat = 0;
  }

  function currentPad() {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return null;
    try {
      return Array.from(navigator.getGamepads() || []).find(function (pad) { return pad && pad.connected !== false; }) || null;
    } catch (e) { return null; }
  }

  /** Один опрос за кадр: аналоговые оси для физики, фронты кнопок для меню. */
  function pollPad(state, dt, dispatch) {
    padState = currentPad();
    const hasFocus = focused();
    const returning = suspended && hasFocus;
    suspended = !hasFocus;
    if (!padState) {
      if (padSeen) reconnectPending = true;
      blockedButtons = [];
      blockedAxes = [];
      previousButtons = [];
      navigationDirection = '';
      navigationRepeat = 0;
      return;
    }
    const padId = String(padState.index || 0) + ':' + String(padState.id || '');
    if (suspended || returning || reconnectPending || (padSeen && previousPadId !== padId)) suppressHeldPad();
    padSeen = true;
    previousPadId = padId;
    reconnectPending = false;
    if (suspended) { previousButtons = []; return; }
    blockedButtons.forEach(function (_, i) {
      if (rawPadButton(i) <= (i === 6 || i === 7 ? .05 : .55)) blockedButtons[i] = false;
    });
    blockedAxes.forEach(function (_, i) {
      if (Math.abs(deadAxis(padState.axes && padState.axes[i])) <= .05) blockedAxes[i] = false;
    });
    const buttons = Array.from({ length: 16 }, function (_, i) { return padButton(i) > 0.55; });
    const rising = function (i) { return buttons[i] && !previousButtons[i]; };
    if (state !== 'press' && typeof dispatch === 'function') {
      const inRace = state === 'race';
      if (inRace && rising(9)) {
        const pause = settings && settings.controls && settings.controls.pause;
        dispatch(Array.isArray(pause) && pause.length ? pause[0] : 'Escape');
        previousButtons = buttons;
        navigationDirection = '';
        navigationRepeat = 0;
        return;
      }
      if (!inRace || paused) {
        const x = driveAxis(0);
        const y = driveAxis(1);
        const direction = buttons[12] || y < -0.65 ? 'ArrowUp' : buttons[13] || y > 0.65 ? 'ArrowDown' :
          buttons[14] || x < -0.65 ? 'ArrowLeft' : buttons[15] || x > 0.65 ? 'ArrowRight' : '';
        if (direction !== navigationDirection) {
          navigationDirection = direction;
          navigationRepeat = 0.34;
          if (direction) dispatch(direction);
        } else if (direction) {
          navigationRepeat -= Math.max(0, dt || 0);
          if (navigationRepeat <= 0) { dispatch(direction); navigationRepeat = 0.12; }
        }
        if (rising(0)) dispatch('Enter');
        if (rising(1)) {
          const pause = settings && settings.controls && settings.controls.pause;
          dispatch(inRace && Array.isArray(pause) && pause.length ? pause[0] : 'Escape');
        }
        if (!inRace && rising(9)) dispatch('Enter');
      } else {
        navigationDirection = '';
        navigationRepeat = 0;
      }
    }
    previousButtons = buttons;
  }

  /**
   * Действие зажато по раскладке игрока.
   * @param {string} name
   * @returns {boolean}
   */
  function held(name) {
    if (suspended) return false;
    const arr = settings && settings.controls && settings.controls[name];
    const keyboard = !!(Array.isArray(arr) && arr.some(function (k) { return Object.prototype.hasOwnProperty.call(keys, k) && keys[k]; }));
    const pad = name === 'fire' ? 0 : name === 'nitro' ? 1 : name === 'ult' ? 2 : name === 'handbrake' ? 3 : -1;
    return keyboard || (pad >= 0 && padButton(pad) > 0.55);
  }

  /**
   * Ось газа и руля: -1…1, как в updRace.
   * @returns {{throttle:number,steer:number,handbrake:boolean}}
   */
  function axis() {
    const keyboardThrottle = (held('up') ? 1 : 0) - (held('down') ? 1 : 0);
    const keyboardSteer = (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
    // На современных контроллерах левый стик отвечает только за руль: диагональ
    // не подмешивает тормоз. Для простых джойстиков без курков остаётся ось Y.
    const hasPedals = padState && (padState.mapping === 'standard' || (padState.buttons && padState.buttons.length >= 16));
    const accelerator = padButton(7), brake = padButton(6);
    // Тормоз приоритетнее газа: оба курка не превращаются в движение накатом.
    const padThrottle = hasPedals ? (brake > 0.05 ? -brake : accelerator > 0.05 ? accelerator : 0) :
      -driveAxis(1);
    const padSteer = driveAxis(0);
    return {
      throttle: Math.abs(padThrottle) > 0.05 ? padThrottle : keyboardThrottle,
      steer: Math.abs(padSteer) > 0.05 ? padSteer : keyboardSteer,
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
    suspended = !focused();
    suppressHeldPad();
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
  engine.input = { held, axis, pollPad, deadAxis };
  engine.replace('ctrlHeld', held);
  engine.replace('isEnter', isEnterEngine);
  engine.replace('isConfirm', isConfirmEngine);
  engine.replace('isBack', isBackEngine);
  engine.replace('codeFromEvent', codeFromEventEngine);
  engine.replace('clearKeys', clearKeysEngine);
  engine.replace('blockBrowserKeys', blockBrowserKeysEngine);
})(typeof window !== 'undefined' ? window : globalThis);
