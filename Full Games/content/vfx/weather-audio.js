////////////////////////////////////////////////////////
//
// Эмбиент биома: HTML-луп как моторы. В меню — дождь, в заезде — погода.
// decodeAudioData по rnr:// на десктопе часто пустой — не используем.
//
////////////////////////////////////////////////////////

(function (root) {
  'use strict';

  const THUNDER_SRC = 'assets/sounds/embirnt/grom.mp3';
  const THUNDER_MIX = 0.68;
  const LOOPS = {
    rain: { src: 'assets/sounds/embirnt/rain.mp3', mix: 0.52 },
    snow: { src: 'assets/sounds/embirnt/Snow.mp3', mix: 0.46 }
  };

  let loopEl = null;
  let loopKey = '';
  let lastMix = LOOPS.rain.mix;
  let kickBusy = false;

  /**
   * Настройки звука.
   * @returns {object|null}
   */
  function snd() {
    const s = typeof settings !== 'undefined' ? settings : root.settings;
    return s && s.sound ? s.sound : null;
  }

  /**
   * Ползунок атмосферы биома 0…1.
   * @returns {number}
   */
  function biomeLevel() {
    const s = snd();
    if (!s) return 0;
    const n = s.biome == null ? 80 : s.biome;
    return n < 0 ? 0 : n > 100 ? 1 : n / 100;
  }

  /**
   * Прямой URL протокола, без blob заставки (пустой blob = тишина).
   * @param {string} rel
   * @returns {string}
   */
  function mediaHref(rel) {
    const slash = String(rel || '').replace(/\\/g, '/');
    try {
      if (typeof location !== 'undefined' && location.href) {
        return new URL(slash, location.href).href;
      }
    } catch (e) {}
    if (typeof root.bootMediaSrc === 'function') return root.bootMediaSrc(slash);
    return slash;
  }

  /**
   * Комикс и заставка мира — без эмбиента.
   * @returns {boolean}
   */
  function quietState() {
    const s = typeof state !== 'undefined' ? state : root.state;
    return s === 'intro' || s === 'worldIntro';
  }

  /**
   * Экраны главного меню, где дождь является частью заставки.
   * @param {string} screen
   * @returns {boolean}
   */
  function menuRainScreen(screen) {
    return screen === 'press' || screen === 'title';
  }

  /**
   * Какой луп: в меню всегда дождь, в заезде — дождь/снег биома.
   * @param {object|null} R
   * @param {object|null} settings
   * @returns {string}
   */
  function wantedKey(R, settings) {
    const screen = typeof state !== 'undefined' ? state : root.state;
    if (typeof document !== 'undefined' && document.hidden) return '';
    if (biomeLevel() <= 0) return '';
    if (quietState()) return '';
    if (screen === 'race') {
      if (typeof paused !== 'undefined' && paused) return '';
      if (!settings || !settings.graphics || !settings.graphics.weather) return '';
      if (!R || R.demo || !R.weather || !LOOPS[R.weather.id]) return '';
      return R.weather.id;
    }
    return menuRainScreen(screen) ? 'rain' : '';
  }

  /** Останавливает луп биома. */
  function haltLoop() {
    kickBusy = false;
    if (!loopEl) return;
    try { loopEl.pause(); } catch (e) {}
  }

  /**
   * HTML-тег в DOM — Chromium иначе режет play() вне жеста.
   * @returns {HTMLAudioElement|null}
   */
  function ensureEl() {
    if (typeof Audio === 'undefined') return null;
    if (loopEl) return loopEl;
    loopEl = new Audio();
    loopEl.loop = true;
    loopEl.preload = 'auto';
    loopEl.referrerPolicy = 'no-referrer';
    try { loopEl.setAttribute('playsinline', ''); } catch (e) {}
    if (typeof document !== 'undefined' && document.body) {
      loopEl.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;opacity:0';
      document.body.appendChild(loopEl);
    }
    if (loopEl && typeof loopEl.addEventListener === 'function') {
      loopEl.addEventListener('error', function () {
        loopKey = '';
      });
    }
    return loopEl;
  }

  /**
   * Луп биома или меню.
   * @param {object|null} R
   * @param {object|null} settings
   */
  function sync(R, settings) {
    const key = wantedKey(R, settings);
    if (!key) {
      haltLoop();
      return;
    }
    if (typeof root.audioInit === 'function' && !(root.AU && root.AU.ctx)) {
      try { root.audioInit(); } catch (e) {}
    }
    const spec = LOOPS[key];
    lastMix = spec.mix;
    const el = ensureEl();
    if (!el) return;
    const href = mediaHref(spec.src);
    if (loopKey !== key || el._href !== href) {
      loopKey = key;
      el._href = href;
      el.loop = true;
      el.src = href;
      try { el.load(); } catch (e) {}
    }
    const screen = typeof state !== 'undefined' ? state : root.state;
    el.volume = biomeLevel() * spec.mix * (menuRainScreen(screen) ? .32 : .65);
    if (el.paused && !kickBusy) {
      kickBusy = true;
      const p = el.play();
      if (p && typeof p.then === 'function') {
        p.then(function () { kickBusy = false; }).catch(function () { kickBusy = false; });
      } else {
        kickBusy = false;
      }
    }
  }

  /** Одиночный удар грома. */
  function strike() {
    const screen = typeof state !== 'undefined' ? state : root.state;
    if (screen !== 'race' && !menuRainScreen(screen)) return;
    if (screen === 'race' && typeof paused !== 'undefined' && paused) return;
    if (typeof R !== 'undefined' && R && R.demo) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    const vol = biomeLevel() * THUNDER_MIX * (menuRainScreen(screen) ? .32 : .65);
    if (vol <= 0) return;
    if (typeof Audio === 'undefined') return;
    const a = new Audio();
    a.referrerPolicy = 'no-referrer';
    a.volume = vol;
    a.src = mediaHref(THUNDER_SRC);
    a.play().catch(function () {});
  }

  let wrapDone = false;

  /** Слайдер атмосферы. */
  function tryWrap() {
    if (wrapDone) return;
    if (!root.DiVANEngine || typeof root.DiVANEngine.wrap !== 'function') return;
    if (typeof root.applyAudioSettings !== 'function') return;
    wrapDone = true;
    root.DiVANEngine.wrap('applyAudioSettings', function (orig) {
      return function () {
        orig();
        sync(typeof R !== 'undefined' ? R : null, typeof settings !== 'undefined' ? settings : null);
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
