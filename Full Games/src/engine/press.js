////////////////////////////////////////////////////////
//
// DiVANEngine: клавиатура хаба — меню, гараж, выбор машины.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Интро, залы, читы, камера, справка, трофеи.
   * @param {string} c
   * @param {string} [k]
   * @returns {boolean}
   */
  function screens(c, k) {
    if (state === 'intro') {
      if (isConfirm(c) || isBack(c)) {
        const sc = introScenes()[introFrame];
        if (!sc) { endIntro(true); return true; }
        if (introCur < sc.text.length) introCur = sc.text.length;
        else {
          introFrame++;
          if (introFrame >= introScenes().length) endIntro(true);
          else resetIntroType();
        }
        sClick();
      }
      return true;
    }
    if (state === 'gym') {
      if (isBack(c)) { state = 'garage'; sClick(); return true; }
      if (c === 'ArrowUp') { gymSel = (gymSel + 3) % 4; sClick(); return true; }
      if (c === 'ArrowDown') { gymSel = (gymSel + 1) % 4; sClick(); return true; }
      if (isConfirm(c)) { buyGym(gymSel); return true; }
      return true;
    }
    if (state === 'armory') {
      if (typeof armoryPress === 'function') armoryPress(c);
      return true;
    }
    if (state === 'tracks') {
      const n = pickableTracks().length, cols = 3;
      if (!n) return true;
      if (isBack(c)) {
        if (trackPickReturn === 'race') { state = 'race'; paused = true; }
        else if (trackPickReturn === 'garage') { state = 'garage'; garagePaused = true; }
        else enterTitle();
        sClick(); return true;
      }
      if (c === 'ArrowLeft') { trackPickSel = (trackPickSel + n - 1) % n; sClick(); return true; }
      if (c === 'ArrowRight') { trackPickSel = (trackPickSel + 1) % n; sClick(); return true; }
      if (c === 'ArrowUp') { trackPickSel = (trackPickSel + n - cols) % n; sClick(); return true; }
      if (c === 'ArrowDown') { trackPickSel = (trackPickSel + cols) % n; sClick(); return true; }
      if (isConfirm(c)) { startDevTrack(trackPickSel); return true; }
      return true;
    }
    if (state === 'cheats') {
      if (typeof cheatsAllowed === 'function' && !cheatsAllowed()) {
        state = 'title';
        return true;
      }
      if (isBack(c)) { state = 'title'; sClick(); return true; }
      if (c === 'ArrowLeft') { cheatCur = (cheatCur + 6) % 7; sClick(); return true; }
      if (c === 'ArrowRight') { cheatCur = (cheatCur + 1) % 7; sClick(); return true; }
      if (c === 'ArrowUp') { cheatBuf[cheatCur] = nextChar(cheatBuf[cheatCur], 1); sClick(); return true; }
      if (c === 'ArrowDown') { cheatBuf[cheatCur] = nextChar(cheatBuf[cheatCur], -1); sClick(); return true; }
      if (isEnter(c)) { submitCheat(); return true; }
      if (k && /^[a-z]$/i.test(k)) { cheatBuf[cheatCur] = k.toLowerCase(); cheatCur = (cheatCur + 1) % 7; sClick(); return true; }
      if (c === 'Backspace') { cheatBuf[cheatCur] = 'a'; sClick(); return true; }
      return true;
    }
    if (state === 'cameraSetup') {
      if (cameraSetupHint) {
        if (isConfirm(c) || isBack(c)) { finishCameraSetup(); sClick(); }
        return true;
      }
      if (isBack(c)) { enterTitle(); sClick(); return true; }
      if (c === 'ArrowLeft') { nudgeCameraZoom(-1); sClick(); }
      if (c === 'ArrowRight') { nudgeCameraZoom(1); sClick(); }
      if (isConfirm(c)) { showCameraSetupHint(); sClick(); }
      return true;
    }
    if (state === 'help') { enterTitle(); return true; }
    if (state === 'achievements') {
      if (isBack(c)) { leaveAchievements(); sClick(); }
      return true;
    }
    return false;
  }

  /**
   * Гонщик, хлам-тюнинг, карусель, автопарк, ставка.
   * @param {string} c
   * @returns {boolean}
   */
  function pickers(c) {
    if (state === 'char') {
      if (bioOpen >= 0) {
        if (isConfirm(c)) { confirmCharPick(bioOpen); sClick(); }
        else if (isBack(c)) { bioOpen = -1; sClick(); }
        return true;
      }
      if (isBack(c)) { leaveCharSel(); sClick(); return true; }
      if (c === 'ArrowLeft') { wrapPlayable(-1); sClick(); }
      if (c === 'ArrowRight') { wrapPlayable(1); sClick(); }
      if (isConfirm(c) || c === 'KeyB') { bioOpen = selChar; sClick(); }
      return true;
    }
    if (state === 'junkTune') {
      if (typeof handleJunkTuneKey === 'function') handleJunkTuneKey(c);
      return true;
    }
    if (state === 'car') {
      if (c === 'ArrowLeft') { nudgeCarSel(-1); }
      if (c === 'ArrowRight') { nudgeCarSel(1); }
      if (isBack(c)) { enterCharSel(); return true; }
      if (isConfirm(c)) {
        if (isForeignSignature(selCar)) { sHit(); return true; }
        const car = CARS[selCar];
        const owned = carIsOwned(selCar);
        if (owned) {
          if (carConfirmed && save.car === selCar) { state = 'garage'; }
          else { save.car = selCar; raceBoard = null; persist(); carConfirmed = true; sClick(); }
        } else if (save.cash >= car.price) {
          save.cash -= car.price; save.carOwned = save.carOwned || {}; save.carOwned[selCar] = true; save.car = selCar;
          raceBoard = null; persist(); carConfirmed = true; SFX.play('buy');
          if (typeof beginJunkTune === 'function' && beginJunkTune(selCar)) return true;
        } else sHit();
      }
      return true;
    }
    if (state === 'autopark') {
      if (c === 'ArrowLeft') nudgeParkSel(-1);
      if (c === 'ArrowRight') nudgeParkSel(1);
      if (isBack(c)) { state = 'garage'; sClick(); }
      if (isConfirm(c)) {
        if (carUnlocked(autoparkSel)) { autodetailOpen = true; state = 'detail'; sClick(); }
        else sHit();
      }
      return true;
    }
    if (state === 'detail') {
      if (isBack(c)) { state = 'autopark'; autodetailOpen = false; sClick(); }
      if (isConfirm(c)) {
        const car = CARS[autoparkSel];
        const owned = carIsOwned(autoparkSel);
        if (isForeignSignature(autoparkSel)) { sHit(); return true; }
        if (owned) {
          save.car = autoparkSel; raceBoard = null; persist(); sClick();
          state = 'garage'; garMsg = 'ВЫБРАНА: ' + car.name; garMsgT = 2.2;
        } else if (save.cash >= car.price) {
          save.cash -= car.price; save.carOwned = save.carOwned || {};
          save.carOwned[autoparkSel] = true; save.car = autoparkSel;
          raceBoard = null; persist(); SFX.play('buy');
          if (typeof beginJunkTune === 'function' && beginJunkTune(autoparkSel)) return true;
          state = 'garage';
          garMsg = 'КУПЛЕНА: ' + car.name; garMsgT = 2.2;
        } else sHit();
      }
      return true;
    }
    if (state === 'prerace') {
      if (c === 'ArrowLeft' || c === 'ArrowRight') {
        if (raceBoard && raceBoard.specs.length) {
          const n = raceBoard.specs.length;
          raceBoard.pick = ((raceBoard.pick | 0) + (c === 'ArrowRight' ? 1 : n - 1)) % n;
          sClick();
        }
      }
      if (c === 'ArrowUp') cycleBet(-1);
      if (c === 'ArrowDown') cycleBet(1);
      if (isBack(c)) { raceBoard = null; state = 'garage'; sClick(); }
      if (isConfirm(c)) confirmPreRace();
      return true;
    }
    return false;
  }

  /**
   * Титул, карьера после финиша, гараж.
   * @param {string} c
   * @returns {boolean}
   */
  function hub(c) {
    if (state === 'title') {
      const n = g._titleItems ? g._titleItems.length : 2;
      if (c === 'ArrowUp') { selTitle = (selTitle + n - 1) % n; resetArm = false; sClick(); }
      if (c === 'ArrowDown') { selTitle = (selTitle + 1) % n; resetArm = false; sClick(); }
      if (isConfirm(c)) {
        const items = g._titleItems || [];
        const it = items[selTitle];
        if (!it) return true;
        if (it === 'КАМПАНИЯ') {
          resetArm = false;
          if (typeof storyStartNewCampaign === 'function') storyStartNewCampaign();
        } else if (it === 'ПРОДОЛЖИТЬ КАМПАНИЮ') {
          resetArm = false;
          if (typeof storyContinueCampaign === 'function') storyContinueCampaign();
        } else if (it && it.startsWith('НОВАЯ')) {
          resetArm = false; save = newSave(); persist();
          selChar = 0; selCar = 0; carConfirmed = false; enterCameraSetup();
        } else if (it && it.startsWith('ПРОДОЛЖИТЬ')) { resetArm = false; loadSave(); state = 'garage'; }
        else if (it && it.startsWith('ЗАГРУЗИТЬ')) { resetArm = false; slotReturn = 'title'; state = 'slotSelect'; slotSelectMode = 'load'; slotSelectIndex = 0; }
        else if (it && it.startsWith('НАСТРОЙКИ')) { resetArm = false; openSettings('title'); }
        else if (it && it.startsWith('ДОСТИЖЕНИЯ')) { resetArm = false; openAchievements('title'); }
        else if (it && it.startsWith('ЧИТЫ')) { resetArm = false; state = 'cheats'; cheatMsgT = 0; }
        else if (it && it.startsWith('ВЫБОР ТРАССЫ')) { resetArm = false; enterTrackPick('title'); }
        else if (it && it.startsWith('ЛАБОРАТОРИЯ')) { resetArm = false; openLabWarn(); }
        else if (it && it.startsWith('СБРОС')) {
          if (!resetArm) { resetArm = true; sClick(); }
          else {
            persistDrop(SKEY);
            save = null;
            resetArm = false; sBoom();
          }
        } else if (it && it.startsWith('ВЫХОД')) { resetArm = false; openExitWarn(); }
        sClick();
      }
      return true;
    }
    if (state === 'career' || state === 'careerTracks') {
      if (typeof careerPress === 'function') careerPress(c);
      return true;
    }
    if (state === 'results') {
      if (isConfirm(c)) {
        if (labTest) exitLabTest();
        else if (typeof careerOpenFromResults === 'function') careerOpenFromResults();
        else state = 'garage';
        sClick();
      }
      return true;
    }
    if (state === 'garage' && isBack(c)) {
      if (garagePaused) { garagePaused = false; clearKeys(); } else { garagePaused = true; garagePauseIndex = 0; clearKeys(); }
      sClick(); return true;
    }
    if (state === 'garage' && garagePaused) {
      const items = pauseGarageItems();
      const n = items.length;
      if (c === 'ArrowUp') { garagePauseIndex = (garagePauseIndex + n - 1) % n; sClick(); return true; }
      if (c === 'ArrowDown') { garagePauseIndex = (garagePauseIndex + 1) % n; sClick(); return true; }
      if (isConfirm(c)) {
        const it = items[garagePauseIndex];
        if (it === 'ПРОДОЛЖИТЬ') { garagePaused = false; clearKeys(); }
        else if (it === 'СОХРАНИТЬ ИГРУ') { garagePaused = false; slotReturn = 'garage'; state = 'slotSelect'; slotSelectMode = 'save'; slotSelectIndex = 0; }
        else if (it === 'ЗАГРУЗИТЬ ИГРУ') { garagePaused = false; slotReturn = 'garage'; state = 'slotSelect'; slotSelectMode = 'load'; slotSelectIndex = 0; }
        else if (it === 'НАСТРОЙКИ') { openSettings('garage'); }
        else if (it === 'ДОСТИЖЕНИЯ') { openAchievements('garage'); }
        else if (it === 'ВЫБОР ТРАССЫ') enterTrackPick('garage');
        else { garagePaused = false; enterTitle(); }
        sClick();
      }
      return true;
    }
    if (state === 'garage') {
      const rows = 9;
      if (c === 'ArrowUp') { tuningSel = (tuningSel + rows - 1) % rows; sClick(); }
      if (c === 'ArrowDown') { tuningSel = (tuningSel + 1) % rows; sClick(); }
      if (c === 'KeyA') { enterAutopark(); sClick(); }
      if (c === 'KeyE') { openLabWarn(); sClick(); return true; }
      if (c === 'Space' || (isEnter(c) && tuningSel === 8)) { enterPreRace(); return true; }
      else if (isEnter(c)) {
        if (tuningSel === 7) { enterAutopark(); sClick(); }
        else garageAction(0, tuningSel);
      }
      return true;
    }
    return false;
  }

  /**
   * Точка входа клавиатуры хаба. Симуляция руля сюда не ходит.
   * @param {string} c
   * @param {string} [k]
   */
  function pressEngine(c, k) {
    const nav = global.DiVANEngine && global.DiVANEngine.pressNav;
    if (nav) {
      if (nav.early(c, k)) return;
      if (nav.race(c)) return;
      if (nav.slotSelect(c)) return;
      if (nav.options(c)) return;
    }
    if (screens(c, k)) return;
    if (pickers(c)) return;
    hub(c);
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.pressHub = { screens, pickers, hub };
  engine.replace('press', pressEngine);
})(typeof window !== 'undefined' ? window : globalThis);
