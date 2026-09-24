////////////////////////////////////////////////////////
//
// Плеер трибуны: HTML-колоды, громкость «Звук арены», поверх биома.
// Клипы assets/sounds/embirnt/arena, банки из index.json.
//
////////////////////////////////////////////////////////

(function (root) {
  'use strict';

  const INDEX_SRC = 'assets/sounds/embirnt/arena/index.json';
  const DIR = 'assets/sounds/embirnt/arena/';
  const CROSS = 1.15;
  const ATMOS_MIX = 0.52;
  const SHOT_MIX = { aplodisment: 0.58, nedovolny: 0.52, random: 0.42 };
  const FALLBACK = {
    aplodisment: ['aplodisment_01.mp3', 'aplodisment_02.mp3'],
    atmos: ['atmos_00.mp3', 'atmos_01.mp3', 'atmos_02.mp3', 'atmos_03.mp3'],
    nedovolny: ['nedovolny_01.mp3', 'nedovolny_02.mp3'],
    random: ['Random_01.mp3', 'Random_02.mp3', 'Random_03.mp3', 'Random_04.mp3', 'Random_05.mp3']
  };

  let banks = FALLBACK;
  let deckA = null;
  let deckB = null;
  let liveDeck = 'a';
  let lastAtmos = '';
  let shotEl = null;
  let shotBank = '';
  let wrapDone = false;

  /**
   * Ползунок арены 0…1, отдельно от эффектов и биома.
   * @returns {number}
   */
  function crowdLevel() {
    const cfg = typeof settings !== 'undefined' ? settings : root.settings;
    const s = cfg && cfg.sound;
    if (!s) return 0;
    const n = s.crowd == null ? 80 : s.crowd;
    return n < 0 ? 0 : n > 100 ? 1 : n / 100;
  }

  /**
   * Прямой URL протокола, без blob заставки.
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
   * Заезд, не демо титула. Биом любой, пока трибуна не выключена.
   * @param {object|null} R
   * @returns {boolean}
   */
  function arenaLive(R) {
    if (!R || R.demo) return false;
    const screen = typeof state !== 'undefined' ? state : root.state;
    if (screen && screen !== 'race') return false;
    const theme = R.T && R.T.theme;
    if (root.RnRTracks && typeof RnRTracks.crowdSoundOn === 'function') return RnRTracks.crowdSoundOn(theme);
    return !theme || theme.crowdSound !== false;
  }

  /**
   * Случайный файл банки, не тот же подряд.
   * @param {string} bank
   * @param {string} avoid
   * @returns {string}
   */
  function pickFile(bank, avoid) {
    const list = banks[bank] || [];
    if (!list.length) return '';
    const pool = [];
    for (let i = 0; i < list.length; i++) if (list[i] !== avoid) pool.push(list[i]);
    const use = pool.length ? pool : list;
    return use[(Math.random() * use.length) | 0];
  }

  /** Новый HTML-узел в DOM. */
  function makeEl() {
    const el = new Audio();
    el.preload = 'auto';
    el.referrerPolicy = 'no-referrer';
    try { el.setAttribute('playsinline', ''); } catch (e) {}
    if (typeof document !== 'undefined' && document.body) {
      el.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;opacity:0';
      document.body.appendChild(el);
    }
    return el;
  }

  /**
   * Секунд до конца HTML-клипа.
   * @param {HTMLAudioElement|null} el
   * @returns {number}
   */
  function remainHtml(el) {
    if (!el || !el.src || el.paused || el.ended) return 0;
    const d = el.duration;
    if (!isFinite(d) || d <= 0) return 99;
    return Math.max(0, d - el.currentTime);
  }

  /** Глушит HTML-колоды. */
  function haltDecks() {
    if (deckA) try { deckA.pause(); } catch (e) {}
    if (deckB) try { deckB.pause(); } catch (e) {}
  }

  /** Глушит реакцию. */
  function haltShot() {
    if (shotEl) {
      try { shotEl.pause(); } catch (e) {}
      shotEl = null;
    }
    shotBank = '';
  }

  /** Полная тишина трибуны. */
  function halt() {
    haltDecks();
    haltShot();
  }

  /**
   * Вешает файл на колоду один раз, play не рвёт src.
   * @param {HTMLAudioElement} el
   * @param {string} file
   */
  function kickHtml(el, file) {
    if (el._file !== file) {
      el._file = file;
      el.loop = false;
      el.src = mediaHref(DIR + file);
    }
    if (el.paused && !el._kick) {
      el._kick = true;
      const p = el.play();
      if (p && typeof p.then === 'function') {
        p.then(function () { el._kick = false; }).catch(function () { el._kick = false; });
      } else {
        el._kick = false;
      }
    }
  }

  /**
   * Старт атмосферы, если колода пустая.
   * @param {HTMLAudioElement} el
   */
  function fillHtml(el) {
    if (el._file && !el.ended) {
      kickHtml(el, el._file);
      return;
    }
    const file = pickFile('atmos', lastAtmos);
    if (!file) return;
    lastAtmos = file;
    kickHtml(el, file);
  }

  /**
   * Реакция на одном слоте.
   * @param {string} bank
   * @param {boolean} [force]
   * @returns {boolean}
   */
  function playShot(bank, force) {
    if (!SHOT_MIX[bank] || !(banks[bank] || []).length) return false;
    if (crowdLevel() <= 0) return false;
    const htmlBusy = shotEl && !shotEl.paused && !shotEl.ended && remainHtml(shotEl) > 0.28;
    if (htmlBusy && !force) return false;
    if (force) haltShot();
    const file = pickFile(bank, '');
    if (!file) return false;
    if (typeof Audio === 'undefined') return false;
    shotEl = makeEl();
    shotBank = bank;
    shotEl.volume = crowdLevel() * SHOT_MIX[bank];
    shotEl.src = mediaHref(DIR + file);
    shotEl.play().catch(function () {});
    return true;
  }

  /**
   * Кроссфейд колод. Не пересоздаёт src, пока клип грузится.
   * @param {number} dt
   */
  function tickBed(dt) {
    tryWrap();
    if (typeof root.audioInit === 'function' && !(root.AU && root.AU.ctx)) {
      try { root.audioInit(); } catch (e) {}
    }
    if (crowdLevel() <= 0) { halt(); return; }
    if (typeof document !== 'undefined' && document.hidden) { halt(); return; }
    if (typeof Audio === 'undefined') return;
    if (!deckA) deckA = makeEl();
    if (!deckB) deckB = makeEl();
    const live = liveDeck === 'a' ? deckA : deckB;
    const wait = liveDeck === 'a' ? deckB : deckA;
    const duck = (shotEl && !shotEl.paused && !shotEl.ended) ? 0.55 : 1;
    const want = crowdLevel() * ATMOS_MIX * duck;
    fillHtml(live);
    const left = remainHtml(live);
    if (left > 0 && left <= CROSS && (!wait._file || wait.ended || wait.paused)) {
      const file = pickFile('atmos', lastAtmos);
      if (file) {
        lastAtmos = file;
        kickHtml(wait, file);
        liveDeck = liveDeck === 'a' ? 'b' : 'a';
      }
    }
    const k = Math.min(1, (dt || 0.016) / CROSS);
    if (liveDeck === 'a') {
      deckA.volume = want;
      deckB.volume += (0 - deckB.volume) * k;
    } else {
      deckB.volume = want;
      deckA.volume += (0 - deckA.volume) * k;
    }
    if (shotEl && !shotEl.paused) shotEl.volume = crowdLevel() * (SHOT_MIX[shotBank] || 0.5);
  }

  /** Слайдер арены. */
  function tryWrap() {
    if (wrapDone) return;
    if (!root.DiVANEngine || typeof root.DiVANEngine.wrap !== 'function') return;
    if (typeof root.applyAudioSettings !== 'function') return;
    wrapDone = true;
    root.DiVANEngine.wrap('applyAudioSettings', function (orig) {
      return function () {
        orig();
        if (crowdLevel() <= 0) halt();
        else if (deckA) {
          const duck = (shotEl && !shotEl.paused && !shotEl.ended) ? 0.55 : 1;
          const want = crowdLevel() * ATMOS_MIX * duck;
          if (liveDeck === 'a') deckA.volume = want;
          else if (deckB) deckB.volume = want;
        }
      };
    });
  }

  /**
   * Банки из манифеста папки.
   * @param {object} data
   */
  function applyIndex(data) {
    if (!data || !data.banks) return;
    banks = data.banks;
    const urls = [INDEX_SRC];
    Object.keys(banks).forEach(function (k) {
      (banks[k] || []).forEach(function (n) { urls.push(DIR + n); });
    });
    if (typeof root.bootEnqueueFetch === 'function') root.bootEnqueueFetch(urls, true);
  }

  function preloadFallback() {
    const urls = [INDEX_SRC];
    Object.keys(FALLBACK).forEach(function (k) {
      FALLBACK[k].forEach(function (n) { urls.push(DIR + n); });
    });
    if (typeof root.bootEnqueueFetch === 'function') root.bootEnqueueFetch(urls, true);
  }

  preloadFallback();
  if (typeof root.fetch === 'function') {
    root.fetch(INDEX_SRC, { cache: 'no-store' }).then(function (res) {
      return res.ok ? res.json() : null;
    }).then(function (data) { if (data) applyIndex(data); }).catch(function () {});
  }

  root.RnRArenaCrowd = {
    tickBed: tickBed,
    halt: halt,
    playShot: playShot,
    arenaLive: arenaLive,
    dir: DIR,
    indexSrc: INDEX_SRC
  };

  tryWrap();
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(tryWrap);
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) halt();
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
