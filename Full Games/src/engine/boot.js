////////////////////////////////////////////////////////
//
// DiVANEngine: очередь заставки — подписи, MIME, доля, каталоги.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Подпись этапа по первому URL задания.
   * @param {{urls?:string[],label?:string}|null} job
   * @returns {string}
   */
  function bootJobLabelEngine(job) {
    const u = String((job && job.urls && job.urls[0]) || job && job.label || '');
    if (job && job.label) return job.label;
    if (/comics/i.test(u)) return 'Комиксы';
    if (/\/players\//i.test(u)) return 'Гонщики';
    if (/data\/cars|armor|_armor_/i.test(u)) return 'Машины';
    if (/wheels/i.test(u)) return 'Машины';
    if (/music|ikrinka24/i.test(u)) return 'Музыка';
    if (/textures\/map/i.test(u)) return 'Карта';
    if (/sounds|\/FX\//i.test(u)) return 'Звуки';
    if (/voice\/.*\.json/i.test(u)) return 'Гонщики';
    return 'Файлы';
  }

  /**
   * URL из кэша загрузки (blob) или исходный.
   * @param {string} url
   * @returns {string}
   */
  function bootMediaSrcEngine(url) {
    if (!url) return url;
    return (BOOT.media && BOOT.media[url]) || url;
  }

  /**
   * Кладёт скачанный файл в кэш воспроизведения.
   * @param {string} url
   * @param {Blob} blob
   */
  function bootKeepMediaEngine(url, blob) {
    if (!url || !blob || !blob.size) return;
    try {
      const prev = BOOT.media[url];
      const href = URL.createObjectURL(blob);
      BOOT.media[url] = href;
      if (prev && prev !== href) try { URL.revokeObjectURL(prev); } catch (e) {}
    } catch (e) {}
  }

  /**
   * Ставит картинку в очередь: пробуем URL по порядку, считаем байты.
   * @param {HTMLImageElement|null} img
   * @param {string[]} urls
   */
  function bootEnqueueEngine(img, urls) {
    const list = (urls || []).filter(Boolean);
    if (!list.length) return;
    BOOT.jobs.push({ img: img, urls: list, got: 0, total: 0, done: false, busy: false, ok: false, sticky: false });
  }

  /**
   * Файл без Image: музыка, SFX. sticky — не отпускаем при сбое сети.
   * @param {string[]} urls
   * @param {boolean} sticky
   */
  function bootEnqueueFetchEngine(urls, sticky) {
    const list = (urls || []).filter(Boolean);
    if (!list.length) return;
    if (BOOT.jobs.some(function (j) { return j.urls && j.urls[0] === list[0] && !j.img; })) return;
    BOOT.jobs.push({
      img: null, urls: list, got: 0, total: 0, done: false, busy: false, ok: false, sticky: !!sticky, kind: 'fetch'
    });
  }

  /**
   * Узлы DOM заставки.
   * @returns {object}
   */
  function bootElsEngine() {
    if (BOOT.els) return BOOT.els;
    BOOT.els = {
      root: document.getElementById('boot-screen'),
      heading: document.getElementById('boot-heading'),
      fill: document.getElementById('boot-fill'),
      pct: document.getElementById('boot-pct'),
      status: document.getElementById('boot-status'),
      vpn: document.getElementById('boot-vpn')
    };
    return BOOT.els;
  }

  /**
   * Доля загрузки: готовые файлы + текущий поток по Content-Length.
   * @returns {number}
   */
  function bootRatioEngine() {
    const n = BOOT.jobs.length;
    if (!n) return 0;
    let s = 0;
    for (const j of BOOT.jobs) {
      if (j.done) s += 1;
      else if (j.total > 0) s += Math.min(.99, j.got / j.total);
    }
    return s / n;
  }

  /** Полоска и подпись этапа. */
  function bootPaintEngine() {
    const el = bootEls();
    const n = BOOT.jobs.length;
    const done = BOOT.jobs.filter(function (j) { return j.done; }).length;
    const pct = Math.min(99, Math.floor(bootRatio() * 100));
    if (el.fill) el.fill.style.width = pct + '%';
    if (el.pct) el.pct.textContent = pct + '%';
    const wait = BOOT.jobs.find(function (j) { return !j.done; });
    const lab = wait ? bootJobLabel(wait) : 'Файлы';
    if (el.status) el.status.textContent = n ? (lab + ' · ' + done + ' / ' + n) : 'Собираем трассу…';
    if (!BOOT.vpnShown && BOOT.t0 && performance.now() - BOOT.t0 > 12000) {
      BOOT.vpnShown = true;
      if (el.vpn) el.vpn.classList.add('is-on');
    }
  }

  /**
   * MIME по заголовку или расширению.
   * @param {string} url
   * @param {string} [header]
   * @returns {string}
   */
  function bootMimeEngine(url, header) {
    const h = (header || '').split(';')[0].trim();
    if (h && h !== 'application/octet-stream') return h;
    if (/\.svg(\?|$)/i.test(url)) return 'image/svg+xml';
    if (/\.webp(\?|$)/i.test(url)) return 'image/webp';
    if (/\.png(\?|$)/i.test(url)) return 'image/png';
    if (/\.jpg|\.jpeg/i.test(url)) return 'image/jpeg';
    if (/\.mp3(\?|$)/i.test(url)) return 'audio/mpeg';
    if (/\.wav(\?|$)/i.test(url)) return 'audio/wav';
    return h || 'application/octet-stream';
  }

  /**
   * Пауза между повторами сети.
   * @param {number} ms
   * @returns {Promise<void>}
   */
  function bootSleepEngine(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  /**
   * Тема титула из cast; main — только пока каст ещё не в кэше.
   */
  function bootPlayMenuIfReadyEngine() {
    if (BOOT.ready) return;
    const tracks = global.MUSIC_TRACKS || {};
    const castUrl = tracks.cast && tracks.cast[0];
    if (castUrl && BOOT.media[castUrl]) {
      if (BOOT.menuMusic && lastMusicCat === 'cast') return;
      BOOT.menuMusic = true;
      try {
        lastMusicCat = 'cast';
        if (typeof MUSIC !== 'undefined' && MUSIC.play) MUSIC.play('cast');
      } catch (e) { console.error(e); }
      return;
    }
    if (BOOT.menuMusic) return;
    const list = tracks.main || [];
    const url = list[0];
    if (!url || !BOOT.media[url]) return;
    BOOT.menuMusic = true;
    try {
      lastMusicCat = 'main';
      if (typeof MUSIC !== 'undefined' && MUSIC.play) MUSIC.play('main');
    } catch (e) { console.error(e); }
  }

  /** Каталог MP3 из music.js — обязателен до титула. */
  function bootEnqueueAudioCatalogEngine() {
    const tracks = global.MUSIC_TRACKS;
    if (!tracks) return;
    for (const cat of Object.keys(tracks)) {
      const list = tracks[cat];
      if (!Array.isArray(list)) continue;
      for (const url of list) {
        const urls = (typeof musicSources === 'function') ? musicSources(url) : [url];
        bootEnqueueFetch(urls, true);
      }
    }
  }

  /** Клипы SFX: локальный файл, затем CDN. */
  function bootEnqueueSfxEngine() {
    if (typeof SFX_TRACKS !== 'object' || !SFX_TRACKS) return;
    for (const id of Object.keys(SFX_TRACKS)) {
      const v = SFX_TRACKS[id];
      const list = (Array.isArray(v) ? v : [v]).filter(Boolean);
      for (const url of list) {
        const urls = (typeof sfxSources === 'function') ? sfxSources(url) : [url];
        bootEnqueueFetch(urls, false);
      }
    }
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.boot = { jobLabel: bootJobLabelEngine, mime: bootMimeEngine, ratio: bootRatioEngine };
  engine.replace('bootJobLabel', bootJobLabelEngine);
  engine.replace('bootMediaSrc', bootMediaSrcEngine);
  engine.replace('bootKeepMedia', bootKeepMediaEngine);
  engine.replace('bootEnqueue', bootEnqueueEngine);
  engine.replace('bootEnqueueFetch', bootEnqueueFetchEngine);
  engine.replace('bootEls', bootElsEngine);
  engine.replace('bootRatio', bootRatioEngine);
  engine.replace('bootPaint', bootPaintEngine);
  engine.replace('bootMime', bootMimeEngine);
  engine.replace('bootSleep', bootSleepEngine);
  engine.replace('bootPlayMenuIfReady', bootPlayMenuIfReadyEngine);
  engine.replace('bootEnqueueAudioCatalog', bootEnqueueAudioCatalogEngine);
  engine.replace('bootEnqueueSfx', bootEnqueueSfxEngine);
})(typeof window !== 'undefined' ? window : globalThis);
