// Одноразовые сюжетные гудки PitterMAX, привязанные только к входу в нужную фазу.
(function (global) {
  'use strict';

  const HORN_URL = 'assets/data/Missions/01/gudok.mp3';
  const CUE_PHASES = Object.freeze({TRUCK_INTRO: 'intro', TRUCK_ESCAPE: 'escape'});
  let audio = null;
  let observedPhase = '';
  let activeCue = '';
  let cueStatus = 'idle';
  let playbackToken = 0;
  let lastModel = null;

  /** Создаёт единственный аудиоэлемент и подключает его к мировой шине эффектов. */
  function ensureAudio() {
    if (audio || typeof Audio === 'undefined') return audio;
    audio = new Audio(typeof bootMediaSrc === 'function' ? bootMediaSrc(HORN_URL) : HORN_URL);
    audio.preload = 'auto';
    audio.loop = false;
    if (audio.addEventListener) audio.addEventListener('ended', function () {
      if (!activeCue) return;
      playbackToken += 1;
      cueStatus = 'ended';
    });
    const mix = global.DiVANEngine && global.DiVANEngine.audioMix;
    audio._rnrRouted = !!(mix && mix.routeMedia && mix.routeMedia(audio, 0));
    return audio;
  }

  /** Применяет громкость только для резервного прямого HTMLAudio-маршрута. */
  function applyFallbackVolume(element) {
    if (!element || element._rnrRouted) return;
    const sound = typeof settings !== 'undefined' && settings.sound || {};
    element.volume = sound.sfxOn === false ? 0 : Math.max(0,
      Math.min(1, (sound.sfx == null ? 80 : sound.sfx) / 100));
  }

  /** Проверяет, нужно ли заморозить гудок без сброса его позиции. */
  function suspended(model) {
    const hidden = typeof document !== 'undefined' && !!document.hidden;
    return !!(model && model.pause) || hidden;
  }

  /** Немедленно останавливает клип и инвалидирует его незавершённый запуск. */
  function stopClip() {
    playbackToken += 1;
    activeCue = '';
    cueStatus = 'idle';
    if (audio) {
      try { audio.pause(); audio.currentTime = 0; } catch (error) {}
    }
  }

  /** Запускает активную реплику, не повторяя её после окончания или отказа play(). */
  function playCue(fromStart) {
    if (!activeCue || (cueStatus !== 'armed' && cueStatus !== 'paused')) return false;
    const element = ensureAudio();
    if (!element) { cueStatus = 'rejected'; return false; }
    applyFallbackVolume(element);
    const token = ++playbackToken;
    cueStatus = 'starting';
    try {
      if (fromStart) element.currentTime = 0;
      const playback = element.play();
      if (playback && playback.then) playback.then(function () {
        if (token === playbackToken && activeCue && cueStatus === 'starting') cueStatus = 'playing';
      }, function () {
        if (token === playbackToken && activeCue) cueStatus = 'rejected';
      });
      else cueStatus = 'playing';
      return true;
    } catch (error) {
      if (token === playbackToken && activeCue) cueStatus = 'rejected';
      return false;
    }
  }

  /** Приостанавливает начатый гудок, не перематывая его. */
  function pauseCue() {
    if (!activeCue || (cueStatus !== 'starting' && cueStatus !== 'playing')) return false;
    playbackToken += 1;
    if (audio) {
      try { audio.pause(); } catch (error) {}
    }
    cueStatus = 'paused';
    return true;
  }

  /** Возобновляет паузу с той же позиции или впервые запускает реплику, вооружённую на паузе. */
  function resumeCue() {
    if (cueStatus === 'paused') return playCue(false);
    if (cueStatus === 'armed') return playCue(true);
    return false;
  }

  /** Реагирует на вход в фазу и отдельно синхронизирует паузу, не перезапуская завершённый сигнал. */
  function sync(model) {
    lastModel = model || null;
    const phase = model && String(model.phase || '') || '';
    if (phase !== observedPhase) {
      observedPhase = phase;
      stopClip();
      activeCue = CUE_PHASES[phase] || '';
      if (!activeCue) return false;
      cueStatus = 'armed';
      if (!suspended(model)) playCue(true);
      return true;
    }
    if (!activeCue || activeCue !== CUE_PHASES[phase]) return false;
    if (suspended(model)) pauseCue();
    else resumeCue();
    return false;
  }

  /** Сбрасывает наблюдение перед новым запуском или выходом из миссии. */
  function reset() {
    lastModel = null;
    observedPhase = '';
    stopClip();
  }

  // RAF может не прийти после скрытия окна, поэтому медиаэлемент замораживается самим visibilitychange.
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', function () {
      if (lastModel) sync(lastModel);
    });
  }

  global.RnRStoryChaseHorn = {sync, reset, stop: stopClip, url: HORN_URL};
})(typeof window !== 'undefined' ? window : globalThis);
