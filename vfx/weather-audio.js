////////////////////////////////////////////////////////
//
// Эмбиент биома: дождь, снег, гром из assets/sounds/embirnt.
//
////////////////////////////////////////////////////////

(function (root) {
  'use strict';

  const THUNDER_SRC = 'assets/sounds/embirnt/grom.mp3';
  const THUNDER_MIX = 0.88;
  const LOOPS = {
    rain: { src: 'assets/sounds/embirnt/rain.mp3', mix: 0.44 },
    snow: { src: 'assets/sounds/embirnt/Snow.mp3', mix: 0.4 }
  };

  let loopEl = null;
  let loopKey = '';
  let lastMix = LOOPS.rain.mix;

  /**
   * Настройки канала эффектов.
   * @returns {object|null}
   */
  function snd() {
    const s = root.settings;
    return s && s.sound ? s.sound : null;
  }

  /**
   * Громкость эффектов 0…1, с учётом выключателя.
   * @returns {number}
   */
  function sfxLevel() {
    const s = snd();
    if (!s || s.sfxOn === false) return 0;
    const n = s.sfx == null ? 80 : s.sfx;
    return n < 0 ? 0 : n > 100 ? 1 : n / 100;
  }

  /**
   * Blob заставки или локальный путь.
   * @param {string} rel
   * @returns {string}
   */
  function mediaHref(rel) {
    const cached = root.BOOT && root.BOOT.media ? root.BOOT.media[rel] : '';
    if (cached) return cached;
    if (typeof root.bootMediaSrc === 'function') return root.bootMediaSrc(rel);
    return rel;
  }

  /**
   * Титул уже крутит rain.mp3 в title-fx.
   * @returns {boolean}
   */
  function titleMenu() {
    return root.state === 'title' || root.state === 'press';
  }

  /**
   * Какой луп нужен: rain, snow или пусто.
   * @param {object|null} R
   * @param {object|null} settings
   * @returns {string}
   */
  function wantedKey(R, settings) {
    if (titleMenu()) return '';
    if (!settings || !settings.graphics || !settings.graphics.weather) return '';
    if (!R || !R.weather || !LOOPS[R.weather.id]) return '';
    if (sfxLevel() <= 0) return '';
    if (typeof document !== 'undefined' && document.hidden) return '';
    return R.weather.id;
  }

  /** Останавливает луп биома. */
  function haltLoop() {
    if (!loopEl) return;
    try { loopEl.pause(); } catch (e) {}
  }

  /**
   * Луп текущего биома, без наслоения на титульный дождь.
   * @param {object|null} R
   * @param {object|null} settings
   */
  function sync(R, settings) {
    const key = wantedKey(R, settings);
    if (!key) {
      haltLoop();
      return;
    }
    if (typeof Audio === 'undefined') return;
    const spec = LOOPS[key];
    lastMix = spec.mix;
    if (!loopEl) {
      loopEl = new Audio();
      loopEl.loop = true;
      loopEl.preload = 'auto';
      loopEl.referrerPolicy = 'no-referrer';
    }
    if (loopKey !== key) {
      loopKey = key;
      loopEl.src = mediaHref(spec.src);
    }
    loopEl.volume = sfxLevel() * spec.mix;
    if (loopEl.paused) loopEl.play().catch(function () {});
  }

  /** Одиночный удар грома. */
  function strike() {
    const vol = sfxLevel() * THUNDER_MIX;
    if (vol <= 0) return;
    if (typeof Audio === 'undefined') return;
    const a = new Audio();
    a.referrerPolicy = 'no-referrer';
    a.volume = vol;
    a.src = mediaHref(THUNDER_SRC);
    a.play().catch(function () {});
  }

  let wrapDone = false;

  /** Громкость и выключатель после слайдера настроек. */
  function tryWrap() {
    if (wrapDone) return;
    if (!root.DiVANEngine || typeof root.DiVANEngine.wrap !== 'function') return;
    if (typeof root.applyAudioSettings !== 'function') return;
    wrapDone = true;
    root.DiVANEngine.wrap('applyAudioSettings', function (orig) {
      return function () {
        orig();
        if (loopEl) loopEl.volume = sfxLevel() * lastMix;
        if (sfxLevel() <= 0) haltLoop();
      };
    });
  }

  /**
   * Синхрон с обёрткой микшера.
   * @param {object|null} R
   * @param {object|null} settings
   */
  function syncWired(R, settings) {
    tryWrap();
    sync(R, settings);
  }

  const preload = [LOOPS.rain.src, LOOPS.snow.src, THUNDER_SRC];
  if (typeof root.bootEnqueueFetch === 'function') root.bootEnqueueFetch(preload, true);

  root.RnRWeatherAudio = {
    sync: syncWired,
    strike: strike,
    haltRain: haltLoop,
    haltLoop: haltLoop,
    rainSrc: LOOPS.rain.src,
    snowSrc: LOOPS.snow.src,
    thunderSrc: THUNDER_SRC
  };

  tryWrap();
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(tryWrap);

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) haltLoop();
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
