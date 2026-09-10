////////////////////////////////////////////////////////
//
// DiVANEngine: сеть заставки — fetch, Image, Audio, воркеры очереди.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Внешний http(s) — не rnr:// и не относительный путь.
   * @param {string} url
   * @returns {boolean}
   */
  function bootRemoteHttp(url) {
    return /^https?:\/\//i.test(String(url || ''));
  }

  /**
   * Упакованный/dev десктоп не ходит на CDN за музыкой и FX.
   * @param {string} url
   * @returns {boolean}
   */
  function bootSkipRemoteOnDesktop(url) {
    const root = typeof window !== 'undefined' ? window : globalThis;
    return !!(root.__RNR_DESKTOP__ && bootRemoteHttp(url));
  }

  /**
   * Качает URL с прогрессом по байтам.
   * @param {string} url
   * @param {object} job
   * @param {AbortSignal} [signal]
   * @returns {Promise<Blob|false|null>}
   */
  async function bootFetchUrlEngine(url, job, signal) {
    if (bootSkipRemoteOnDesktop(url)) return false;
    const desktop = typeof window !== 'undefined' && window.__RNR_DESKTOP__;
    const own = (!signal && desktop && typeof AbortController !== 'undefined') ? new AbortController() : null;
    const timer = own ? setTimeout(function () { own.abort(); }, 20000) : null;
    try {
      const res = await fetch(url, {
        cache: job && job.sticky ? 'default' : 'no-cache',
        signal: signal || (own && own.signal),
        mode: 'cors'
      });
      if (!res.ok) return false;
      const cl = +res.headers.get('Content-Length') || 0;
      if (cl) job.total = cl;
      const mime = bootMime(url, res.headers.get('Content-Type'));
      if (!res.body || !res.body.getReader) {
        const raw = await res.blob();
        if (!raw || !raw.size) return null;
        const blob = raw.type ? raw : new Blob([raw], { type: mime });
        job.got = blob.size; if (!job.total) job.total = blob.size;
        bootPaint();
        return blob;
      }
      const reader = res.body.getReader();
      const chunks = [];
      let got = 0;
      while (true) {
        const step = await reader.read();
        if (step.done) break;
        chunks.push(step.value);
        got += step.value.byteLength;
        job.got = got;
        if (!job.total) job.total = got;
        bootPaint();
      }
      const blob = new Blob(chunks, { type: mime });
      if (!blob.size) return null;
      if (!job.total) job.total = got;
      job.got = got;
      bootPaint();
      return blob;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /**
   * Вешает blob на Image.
   * @param {HTMLImageElement} img
   * @param {Blob} blob
   */
  async function bootBindEngine(img, blob) {
    const href = URL.createObjectURL(blob);
    img.src = href;
    try { if (img.decode) await img.decode(); } catch (e) {}
  }

  /**
   * Если fetch недоступен (file://), грузим как обычный Image.
   * @param {HTMLImageElement} img
   * @param {string} url
   * @returns {Promise<boolean>}
   */
  function bootImgTagEngine(img, url) {
    if (bootSkipRemoteOnDesktop(url)) return Promise.resolve(false);
    return new Promise(function (resolve) {
      const t = setTimeout(function () { done(img.naturalWidth > 0 || /\.svg(\?|$)/i.test(url)); }, 20000);
      const done = function (ok) { clearTimeout(t); img.onload = null; img.onerror = null; resolve(ok); };
      img.onload = function () { done(img.naturalWidth > 0 || /\.svg(\?|$)/i.test(url)); };
      img.onerror = function () { done(false); };
      img.src = url;
    });
  }

  /**
   * Прогрев MP3 через Audio, если fetch режет CORS.
   * @param {string} url
   * @param {object} job
   * @returns {Promise<boolean>}
   */
  function bootAudioTagEngine(url, job) {
    if (bootSkipRemoteOnDesktop(url)) return Promise.resolve(false);
    return new Promise(function (resolve) {
      const a = new Audio();
      a.preload = 'auto';
      a.referrerPolicy = 'no-referrer';
      let done = false;
      const fin = function (ok) {
        if (done) return; done = true;
        clearTimeout(t);
        a.oncanplaythrough = null; a.onloadeddata = null; a.onerror = null;
        resolve(ok);
      };
      const t = setTimeout(function () {
        fin(a.readyState >= 3);
      }, (typeof window !== 'undefined' && window.__RNR_DESKTOP__) ? 8000 : 90000);
      a.oncanplaythrough = function () { fin(true); };
      a.onloadeddata = function () { if (a.readyState >= 3) fin(true); };
      a.onerror = function () { fin(false); };
      a.src = url;
      try { a.load(); } catch (e) { fin(false); }
      if (job && !job.total) { job.total = 1; job.got = 0.2; bootPaint(); }
    });
  }

  /**
   * Одно задание очереди: fetch, затем Image/Audio.
   * @param {object} job
   */
  async function bootRunJobEngine(job) {
    if (job.done) return;
    const fileProto = typeof location !== 'undefined' && location.protocol === 'file:';
    let attempt = 0;
    while (!job.ok && !BOOT.giveUp) {
      attempt++;
      let needImg = !job.img ? false : fileProto;
      let netFail = false;
      if (!fileProto) {
        try {
          for (const url of job.urls) {
            if (BOOT.giveUp) break;
            try {
              const blob = await bootFetchUrl(url, job, undefined);
              if (blob === false) continue;
              if (!blob) continue;
              if (job.img) await bootBind(job.img, blob);
              else {
                bootKeepMedia(url, blob);
                const href = BOOT.media[url];
                if (href) {
                  for (const u of job.urls) {
                    if (u && !BOOT.media[u]) BOOT.media[u] = href;
                  }
                }
              }
              job.ok = true;
              job.done = true;
              if (job.got < job.total) job.got = job.total;
              bootPaint();
              bootPlayMenuIfReady();
              return;
            } catch (e) {
              netFail = true;
              needImg = !!job.img;
            }
          }
        } catch (e) { netFail = true; needImg = !!job.img; }
      }
      if (!job.ok && job.img && needImg) {
        for (const url of job.urls) {
          if (BOOT.giveUp) break;
          const ok = await bootImgTag(job.img, url);
          if (ok) {
            job.ok = true; job.done = true;
            if (!job.total) { job.total = 1; job.got = 1; }
            else job.got = job.total;
            bootPaint();
            return;
          }
        }
      }
      if (!job.ok && !job.img) {
        for (const url of job.urls) {
          if (BOOT.giveUp) break;
          const ok = await bootAudioTag(url, job);
          if (ok) {
            if (!BOOT.media[url]) BOOT.media[url] = url;
            for (const u of job.urls) {
              if (u && !BOOT.media[u]) BOOT.media[u] = BOOT.media[url];
            }
            job.ok = true; job.done = true;
            if (!job.total) { job.total = 1; job.got = 1; }
            else job.got = job.total;
            bootPaint();
            bootPlayMenuIfReady();
            return;
          }
          netFail = true;
        }
      }
      if (job.ok) return;
      if (job.sticky && netFail && !BOOT.giveUp && !(typeof window !== 'undefined' && window.__RNR_DESKTOP__)) {
        await bootSleep(Math.min(8000, 400 * attempt));
        job.got = 0;
        continue;
      }
      break;
    }
    job.done = true;
    if (!job.total) { job.total = 1; job.got = 1; }
    bootPaint();
  }

  /**
   * Рабочие берут новые задания, пока открывается список тайлов карты.
   * @param {number} limit
   * @param {Promise[]} extras
   */
  async function bootWaitAllEngine(limit, extras) {
    let extrasDone = false;
    const extraP = Promise.all(extras || []).then(function () { extrasDone = true; }, function (e) {
      console.error(e); extrasDone = true;
    });
    const n = Math.max(1, limit | 0);
    const workers = Array.from({ length: n }, async function () {
      while (!BOOT.giveUp) {
        const job = BOOT.jobs.find(function (j) { return !j.done && !j.busy; });
        if (job) {
          job.busy = true;
          try { await bootRunJob(job); }
          finally { job.busy = false; }
          continue;
        }
        if (extrasDone && BOOT.jobs.every(function (j) { return j.done; })) return;
        await bootSleep(40);
      }
    });
    await Promise.all(workers.concat([extraP]));
  }

  /**
   * Задание «шрифты» до 2.5 с.
   * @returns {Promise<void>}
   */
  function bootFontsJobEngine() {
    const job = { img: null, urls: [], got: 0, total: 1, done: false, busy: true, ok: false, sticky: false, label: 'Шрифты' };
    BOOT.jobs.push(job);
    return new Promise(function (resolve) {
      let done = false;
      const fin = function () {
        if (done) return; done = true; job.done = true; job.ok = true; job.busy = false; job.got = 1; bootPaint(); resolve();
      };
      const t = setTimeout(fin, 2500);
      const ready = document.fonts && document.fonts.ready;
      if (ready) ready.then(function () { clearTimeout(t); fin(); }).catch(function () { clearTimeout(t); fin(); });
      else { clearTimeout(t); fin(); }
    });
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.replace('bootFetchUrl', bootFetchUrlEngine);
  engine.replace('bootBind', bootBindEngine);
  engine.replace('bootImgTag', bootImgTagEngine);
  engine.replace('bootAudioTag', bootAudioTagEngine);
  engine.replace('bootRunJob', bootRunJobEngine);
  engine.replace('bootWaitAll', bootWaitAllEngine);
  engine.replace('bootFontsJob', bootFontsJobEngine);
  engine.boot = engine.boot || {};
  engine.boot.skipRemoteOnDesktop = bootSkipRemoteOnDesktop;
})(typeof window !== 'undefined' ? window : globalThis);
