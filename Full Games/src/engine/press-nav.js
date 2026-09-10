////////////////////////////////////////////////////////
//
// DiVANEngine: ранние клавиши — предупреждения, пауза, слоты, настройки.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /** Коды, которые нельзя назначить на действие в захвате. */
  const CAPTURE_BLOCK = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'NumpadEnter', 'Escape', 'Tab', 'CapsLock', 'Backspace'];

  /**
   * Старт, пролог, музыка, модалки лаборатории и выхода.
   * @param {string} c
   * @param {string} [k]
   * @returns {boolean}
   */
  function early(c, k) {
    if (state === 'press') { dismissPressStart(); return true; }
    if (state === 'worldIntro') {
      if (typeof isBack === 'function' && isBack(c)) {
        if (typeof endWorldIntro === 'function') endWorldIntro();
        if (typeof sClick === 'function') sClick();
        return true;
      }
      if (c === 'Space') return true;
      if (typeof isConfirm === 'function' ? isConfirm(c) : (c === 'Enter' || c === 'NumpadEnter')) {
        if (typeof worldIntroPress === 'function') worldIntroPress();
      }
      return true;
    }
    if (c === 'KeyM' && state !== 'cheats') {
      if (AU.ctx) {
        settings.sound.musicOn = !settings.sound.musicOn;
        saveSettings();
        applyAudioSettings();
      }
      return true;
    }
    if (typeof clientNoticePress === 'function' && clientNoticePress(c)) return true;
    if (labWarn) {
      if (c === 'ArrowLeft' || c === 'ArrowRight' || c === 'ArrowUp' || c === 'ArrowDown') { labWarnSel = labWarnSel ? 0 : 1; sClick(); return true; }
      if (isBack(c)) { closeLabWarn(); return true; }
      if (isConfirm(c)) { confirmLabWarn(); return true; }
      return true;
    }
    if (exitWarn) {
      if (c === 'ArrowLeft' || c === 'ArrowRight' || c === 'ArrowUp' || c === 'ArrowDown') { exitWarnSel = exitWarnSel ? 0 : 1; sClick(); return true; }
      if (isBack(c)) { closeExitWarn(); return true; }
      if (isConfirm(c)) { confirmExitWarn(); return true; }
      return true;
    }
    void k;
    return false;
  }

  /**
   * Пауза заезда, рестарт и FPS. Остальные клавиши заезда не глотаем.
   * @param {string} c
   * @returns {boolean}
   */
  function race(c) {
    if (state !== 'race') return false;
    if (settings.controls && Array.isArray(settings.controls.pause) && settings.controls.pause.includes(c)) {
      if (paused) { paused = false; clearKeys(); } else { paused = true; pauseMenuIndex = 0; clearKeys(); }
      sClick();
      return true;
    }
    if (paused) {
      const items = pauseRaceItems();
      const n = items.length;
      if (c === 'ArrowUp') { pauseMenuIndex = (pauseMenuIndex + n - 1) % n; sClick(); return true; }
      if (c === 'ArrowDown') { pauseMenuIndex = (pauseMenuIndex + 1) % n; sClick(); return true; }
      if (isConfirm(c)) {
        const it = items[pauseMenuIndex];
        if (it === 'ПРОДОЛЖИТЬ') { paused = false; clearKeys(); }
        else if (it === 'НАСТРОЙКИ') { openSettings('race'); }
        else if (it === 'ДОСТИЖЕНИЯ') { openAchievements('race'); }
        else if (it === 'РЕСТАРТ ГОНКИ') restartRace();
        else if (it === 'ВЫБОР ТРАССЫ') enterTrackPick('race');
        else {
          paused = false;
          if (labTest) exitLabTest();
          else {
            if (R && R.betStake && R.phase === 'count') { save.cash += R.betStake; persist(); }
            raceBoard = null; raceTrackOverride = null; state = 'garage';
          }
        }
        sClick();
      }
      return true;
    }
    if (c === 'KeyR') { restartRace(); return true; }
    if (c === 'F3') { settings.graphics.showFps = !settings.graphics.showFps; saveSettings(); return true; }
    return false;
  }

  /**
   * Сетка слотов: стрелки, стирание, запись и загрузка.
   * @param {string} c
   * @returns {boolean}
   */
  function slotSelect(c) {
    if (state !== 'slotSelect') return false;
    const step = global.DiVANEngine && global.DiVANEngine.slots && global.DiVANEngine.slots.slotStep;
    if (c === 'ArrowLeft' || c === 'ArrowRight' || c === 'ArrowUp' || c === 'ArrowDown') {
      slotSelectIndex = step ? step(slotSelectIndex, c) : slotSelectIndex;
      sClick();
    }
    if (isBack(c)) { if (slotReturn === 'title') enterTitle(); else state = slotReturn; sClick(); return true; }
    if (c === 'Backspace' || c === 'Delete') {
      if (clearSaveSlot(slotSelectIndex)) sClick();
      else sHit();
      return true;
    }
    if (isConfirm(c)) {
      if (slotSelectMode === 'load') {
        if (slots[slotSelectIndex]) {
          loadSave(slotSelectIndex);
          save = JSON.parse(JSON.stringify(slots[slotSelectIndex].save));
          state = 'garage';
        } else sHit();
      } else if (slotSelectMode === 'save') {
        persist(slotSelectIndex);
        sCash();
        state = 'garage';
      }
      sClick();
    }
    return true;
  }

  /**
   * Разделы настроек и захват клавиш управления.
   * @param {string} c
   * @returns {boolean}
   */
  function options(c) {
    if (state !== 'settings') return false;
    if (settingsState === 'main') {
      if (c === 'ArrowUp') { settingsTab = (settingsTab + 3) % 4; sClick(); }
      if (c === 'ArrowDown') { settingsTab = (settingsTab + 1) % 4; sClick(); }
      if (isConfirm(c)) {
        if (settingsTab === 0) { settingsState = 'graphics'; settingsTab = 0; }
        else if (settingsTab === 1) { settingsState = 'sound'; settingsTab = 0; }
        else if (settingsTab === 2) { settingsState = 'game'; settingsTab = 0; }
        else leaveSettings();
        sClick();
      }
      if (isBack(c)) { leaveSettings(); sClick(); return true; }
    } else if (settingsState === 'graphics') {
      const n = gfxOpts().length;
      if (isBack(c)) { settingsState = 'main'; settingsTab = 0; sClick(); return true; }
      if (c === 'ArrowUp') { settingsTab = (settingsTab + n - 1) % n; sClick(); }
      if (c === 'ArrowDown') { settingsTab = (settingsTab + 1) % n; sClick(); }
      if (isConfirm(c)) {
        const opt = gfxOpts()[settingsTab];
        if (opt.type === 'back') { settingsBack(); sClick(); }
        else if (opt.type !== 'zoom' && nudgeGraphics(1)) sClick();
      }
      if (c === 'ArrowLeft' || c === 'ArrowRight') {
        if (nudgeGraphics(c === 'ArrowRight' ? 1 : -1)) sClick();
      }
    } else if (settingsState === 'sound') {
      const n = sndOpts().length;
      if (isBack(c)) { settingsState = 'main'; settingsTab = 0; sClick(); return true; }
      if (c === 'ArrowUp') { settingsTab = (settingsTab + n - 1) % n; sClick(); }
      if (c === 'ArrowDown') { settingsTab = (settingsTab + 1) % n; sClick(); }
      if (isConfirm(c)) {
        if (sndOpts()[settingsTab].type === 'back') { settingsState = 'main'; settingsTab = 0; sClick(); }
        else if (nudgeSound(1)) sClick();
      }
      if (c === 'ArrowLeft' || c === 'ArrowRight') {
        if (nudgeSound(c === 'ArrowRight' ? 1 : -1)) sClick();
      }
    } else if (settingsState === 'game') {
      const n = gameOpts().length;
      if (isBack(c)) { settingsBack(); sClick(); return true; }
      if (c === 'ArrowUp') { settingsTab = (settingsTab + n - 1) % n; sClick(); }
      if (c === 'ArrowDown') { settingsTab = (settingsTab + 1) % n; sClick(); }
      if (isConfirm(c)) {
        const opt = gameOpts()[settingsTab];
        if (opt.type === 'back') { settingsBack(); sClick(); }
        else if (opt.to) { settingsState = opt.to; settingsTab = 0; sClick(); }
      }
    } else if (settingsState === 'controls') {
      const keysList = controlOpts();
      const n = keysList.length;
      if (isBack(c)) {
        if (controlCaptureKey) {
          if (captureBackup) settings.controls[controlCaptureKey] = captureBackup;
          controlCaptureKey = null; captureBackup = null;
          sClick();
        } else { settingsBack(); sClick(); }
        return true;
      }
      if (controlCaptureKey) {
        if (isEnter(c)) {
          if (settings.controls[controlCaptureKey].length === 0 && captureBackup) {
            settings.controls[controlCaptureKey] = captureBackup;
          }
          controlCaptureKey = null; captureBackup = null;
          saveSettings(); sClick();
          return true;
        }
        if (c === 'Backspace') {
          settings.controls[controlCaptureKey].pop();
          saveSettings(); sClick();
          return true;
        }
        if (CAPTURE_BLOCK.includes(c)) return true;
        const arr = settings.controls[controlCaptureKey];
        if (arr.includes(c)) return true;
        for (const k of Object.keys(settings.controls)) {
          if (k !== controlCaptureKey) {
            const idx = settings.controls[k].indexOf(c);
            if (idx >= 0) settings.controls[k].splice(idx, 1);
          }
        }
        if (arr.length < 2) arr.push(c);
        else arr[1] = c;
        saveSettings(); sClick();
        return true;
      }
      if (c === 'ArrowUp') { settingsTab = (settingsTab + n - 1) % n; sClick(); }
      if (c === 'ArrowDown') { settingsTab = (settingsTab + 1) % n; sClick(); }
      if (isConfirm(c)) {
        const key = keysList[settingsTab];
        if (key.type === 'back') { settingsBack(); sClick(); }
        else if (key.key === '_reset') { resetControls(); sClick(); }
        else {
          controlCaptureKey = key.key;
          captureBackup = (settings.controls[key.key] || []).slice();
          settings.controls[key.key] = captureBackup.slice();
          saveSettings(); sClick();
        }
      }
    }
    return true;
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.pressNav = { early, race, slotSelect, options, CAPTURE_BLOCK };
})(typeof window !== 'undefined' ? window : globalThis);
