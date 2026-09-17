////////////////////////////////////////////////////////
//
// DiVANEngine: комикс, титул и вход в выбор машины.
// Кадры CHAR_INTROS остаются в контенте.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Открыть экран выбора машины с каруселью на указанном индексе.
   * @param {number} [idx]
   */
  function enterCarSelEngine(idx) {
    stopCharVoice();
    const raw = (idx == null) ? charCarIdx(save.char) : idx;
    const start = typeof carCatalogFocus === 'function' ? carCatalogFocus(raw) : raw;
    state = 'car'; carConfirmed = false; selCar = start; carSelScroll = carCatalogPos(selCar); carSelDriveT = gt;
  }

  /**
   * Запуск комикса выбранного гонщика.
   * @param {number} charIdx
   */
  function startIntroEngine(charIdx) {
    introChar = charIdx;
    const pack = CHAR_INTROS[introChar];
    if (!pack) { enterCarSel(charCarIdx(save.char)); return; }
    introFrame = 0; introDone = false; introSkipT = 0; resetIntroType();
    state = 'intro';
    const music = introMusicUrl(introChar);
    if (!music) {
      if (introAudio) { try { introAudio.pause(); } catch (e) {} }
      introAudio = null; introAudioSrc = '';
    } else if (!introAudio || introAudioSrc !== music) {
      if (introAudio) { try { introAudio.pause(); } catch (e) {} }
      introAudio = new Audio(bootMediaSrc(music));
      introAudioSrc = music;
    }
    if (introAudio) {
      introAudio.loop = true;
      introAudio.volume = (settings.sound.music || 50) / 100;
      introAudio.currentTime = 0;
      if (settings.sound.musicOn !== false) introAudio.play().catch(function () {});
    }
    stopCharVoice();
    MUSIC.stop(); CHIP.stop();
  }

  /**
   * Экран дистанции камеры. next: char — гонщик, car — кузов.
   * @param {string} [next]
   */
  function enterCameraSetupEngine(next) {
    cameraSetupHint = false;
    settingsZoomDrag = false;
    if (next) cameraSetupNext = next;
    // Переход состояния может случиться между audio-кадрами: не ждём тика демо.
    if (typeof carTiresHalt === 'function') carTiresHalt();
    if (typeof ensureTitlePreview === 'function') ensureTitlePreview();
    state = 'cameraSetup';
  }

  /**
   * После подсказки: свободная карьера — гонщик, кампания — кузов.
   */
  function finishCameraSetupEngine() {
    cameraSetupHint = false;
    // Не даём отложенному play() визга пережить экран камеры.
    if (typeof carTiresHalt === 'function') carTiresHalt();
    const next = cameraSetupNext || 'char';
    cameraSetupNext = 'char';
    if (next === 'car') {
      enterCarSel(save && save.car);
      return;
    }
    enterCharSel();
  }

  /**
   * Выход из интро: в выбор машины или на титул.
   * @param {boolean} goCar
   */
  function endIntroEngine(goCar) {
    if (introAudio) { try { introAudio.pause(); introAudio.currentTime = 0; } catch (e) {} }
    introSkipT = 0;
    lastMusicCat = null;
    if (goCar) enterCarSel(charCarIdx(save.char));
    else enterTitle();
  }

  /**
   * Подтверждение гонщика из досье: если есть комикс — сначала он.
   * @param {number} idx
   */
  function confirmCharPickEngine(idx) {
    selChar = idx; if (!save) save = newSave();
    applyCharCar(idx); persist(); bioOpen = -1;
    if (CHAR_INTROS[idx]) startIntro(idx);
    else enterCarSel(charCarIdx(idx));
  }

  /**
   * Главное меню: без демо-пака и моторов.
   */
  function enterTitleEngine() {
    if (typeof clearKeys === 'function') clearKeys();
    state = 'title';
    selTitle = -1;
    global.titleConfirm = null;
    global.titleSim = null;
    global.titleFocus = null;
    if (typeof carEngineHalt === 'function') carEngineHalt();
    if (typeof clientNoticeOpenIfNeeded === 'function') clientNoticeOpenIfNeeded();
  }

  /**
   * Любая кнопка на заставке: сразу меню. Пролог запускается новой кампанией.
   */
  function dismissPressStartEngine() {
    if (state !== 'press') return;
    enterTitle();
    sClick();
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.replace('enterCarSel', enterCarSelEngine);
  engine.replace('startIntro', startIntroEngine);
  engine.replace('endIntro', endIntroEngine);
  engine.replace('confirmCharPick', confirmCharPickEngine);
  engine.replace('enterTitle', enterTitleEngine);
  engine.replace('dismissPressStart', dismissPressStartEngine);
  engine.replace('enterCameraSetup', enterCameraSetupEngine);
  engine.replace('finishCameraSetup', finishCameraSetupEngine);
})(typeof window !== 'undefined' ? window : globalThis);
