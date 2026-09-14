////////////////////////////////////////////////////////
//
// DiVANEngine: пластина титула — каталог, якорь, кроссфейд.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  const TITLE_BG_DIR = 'assets/data/cats/Titles/';
  const TITLE_BG_MANIFEST = TITLE_BG_DIR + 'titles.json';
  const TITLE_BG_FALLBACK = 'assets/image/cast/01.png';
  const FADE_SEC = 0.42;
  const BURN_SEC = 28;
  const BURN_ZOOM = 0.018;
  const ASPECT_W = 10;
  const DEFAULT_PLATES = [
    { file: 'title-medved_1920x1080.webp', w: 1920, h: 1080, focusX: 0.64, focusY: 0.46 },
    { file: 'title-medved_3440x1440.webp', w: 3440, h: 1440, focusX: 0.56, focusY: 0.47 }
  ];

  let plates = DEFAULT_PLATES.slice();
  let manifestBusy = false;
  let manifestDone = false;
  const titleBgImgs = Object.create(null);
  let liveSrc = TITLE_BG_FALLBACK;
  let fromSrc = '';
  let fadeFromGt = -1;
  let restQueued = false;

  /**
   * Ширина и высота из имени `…_1920x1080.webp`.
   * @param {string} name
   * @returns {{w:number,h:number,aspect:number}|null}
   */
  function parseTitleBgSize(name) {
    const m = String(name || '').match(/(\d+)\s*[x×]\s*(\d+)/i);
    if (!m) return null;
    const w = +m[1], h = +m[2];
    if (!(w > 0 && h > 0)) return null;
    return { w: w, h: h, aspect: w / h };
  }

  /**
   * Нормализует запись каталога.
   * @param {object} raw
   * @returns {object|null}
   */
  function normalizePlate(raw) {
    if (!raw) return null;
    const file = String(raw.file || raw.src || '').replace(/^.*[\\/]/, '');
    if (!file) return null;
    const named = parseTitleBgSize(file);
    const w = +raw.w || (named && named.w) || 0;
    const h = +raw.h || (named && named.h) || 0;
    if (!(w > 0 && h > 0)) return null;
    const fx = +raw.focusX;
    const fy = +raw.focusY;
    return {
      file: file,
      src: TITLE_BG_DIR + file,
      w: w,
      h: h,
      aspect: w / h,
      focusX: fx >= 0 && fx <= 1 ? fx : 0.5,
      focusY: fy >= 0 && fy <= 1 ? fy : 0.5
    };
  }

  /** Каталог с путями. @returns {object[]} */
  function plateList() {
    const out = [];
    for (let i = 0; i < plates.length; i++) {
      const p = normalizePlate(plates[i]);
      if (p) out.push(p);
    }
    return out;
  }

  /**
   * После заставки очередь boot уже стоит: берём blob сами.
   * @param {HTMLImageElement} img
   * @param {string} src
   */
  function bindTitleSrc(img, src) {
    if (!img || img._titleLoad) return;
    img._titleLoad = true;
    const cached = (typeof BOOT !== 'undefined' && BOOT.media) ? BOOT.media[src] : '';
    if (cached) { img.src = cached; return; }
    if (typeof fetch !== 'function') { img.src = src; return; }
    fetch(src, { cache: 'no-store' }).then(function (res) {
      if (!res.ok) { img.src = src; return; }
      return res.blob().then(function (blob) {
        if (!blob || !blob.size) { img.src = src; return; }
        if (typeof bootBind === 'function') return bootBind(img, blob);
        img.src = URL.createObjectURL(blob);
      });
    }).catch(function () { img.src = src; });
  }

  /**
   * В заставку — в очередь; если загрузка уже прошла — сразу fetch.
   * @param {string} src
   * @returns {HTMLImageElement|null}
   */
  function queueTitleImage(src) {
    if (!src || typeof Image === 'undefined') return null;
    if (titleBgImgs[src]) return titleBgImgs[src];
    const img = new Image();
    titleBgImgs[src] = img;
    const booted = typeof BOOT !== 'undefined' && BOOT.ready;
    if (!booted && typeof bootEnqueue === 'function') bootEnqueue(img, [src]);
    else bindTitleSrc(img, src);
    return img;
  }

  /**
   * Холст окна / выбранного пресета.
   * @returns {{w:number,h:number,aspect:number}}
   */
  function titleCanvas() {
    const cw = (typeof cv !== 'undefined' && cv && cv.width) || 0;
    const ch = (typeof cv !== 'undefined' && cv && cv.height) || 0;
    if (cw > 8 && ch > 8) return { w: cw, h: ch, aspect: cw / ch };
    const vw = (typeof viewW === 'number' && viewW > 0) ? viewW : 1280;
    const vh = (typeof viewH === 'number' && viewH > 0) ? viewH : 720;
    return { w: vw, h: vh, aspect: vw / vh };
  }

  /**
   * Слабая машина: не тянем ультраширокий кадр без нужды.
   * @returns {boolean}
   */
  function titleLowGpu() {
    const gfx = (typeof settings !== 'undefined' && settings && settings.graphics) || null;
    if (!gfx) return false;
    return gfx.particles === 'low' || gfx.quality === 'low';
  }

  /**
   * Чем меньше, тем лучше: аспект важнее пикселей.
   * @param {object} plate
   * @param {number} wantAspect
   * @param {number} canvasW
   * @param {number} canvasH
   * @returns {number}
   */
  function plateScore(plate, wantAspect, canvasW, canvasH) {
    const aspectD = Math.abs(plate.aspect - wantAspect);
    const need = Math.max(1, canvasW * canvasH);
    const have = plate.w * plate.h;
    const scale = Math.sqrt(have / need);
    let pix = 0;
    if (scale < 1) pix = (1 - scale) * 1.6;
    else pix = Math.min(0.55, (scale - 1) * 0.12);
    if (titleLowGpu() && plate.w > 2560) pix += 0.35;
    return aspectD * ASPECT_W + pix;
  }

  /**
   * Фон ближе к экрану: 16:9 / 21:9 и плотность холста.
   * @param {number} [aspect]
   * @param {number} [canvasW]
   * @param {number} [canvasH]
   * @returns {string}
   */
  function pickTitleBgSrc(aspect, canvasW, canvasH) {
    const screen = titleCanvas();
    const want = aspect == null ? screen.aspect : aspect;
    const cw = canvasW == null ? screen.w : canvasW;
    const ch = canvasH == null ? screen.h : canvasH;
    const list = plateList();
    let best = TITLE_BG_FALLBACK;
    let bestS = Infinity;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const s = plateScore(p, want, cw, ch);
      if (s < bestS) {
        bestS = s;
        best = p.src;
      }
    }
    return best;
  }

  /** Карточка кадра по пути. @param {string} src @returns {object|null} */
  function plateBySrc(src) {
    const list = plateList();
    for (let i = 0; i < list.length; i++) {
      if (list[i].src === src) return list[i];
    }
    return null;
  }

  /**
   * Прямоугольник cover с якорем и зумом Ken Burns.
   * @param {number} iw
   * @param {number} ih
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {number} focusX
   * @param {number} focusY
   * @param {number} zoom
   * @returns {{ox:number,oy:number,dw:number,dh:number}}
   */
  function coverDest(iw, ih, x, y, w, h, focusX, focusY, zoom) {
    const s = Math.max(w / iw, h / ih) * (zoom || 1);
    const dw = iw * s, dh = ih * s;
    const fx = focusX >= 0 && focusX <= 1 ? focusX : 0.5;
    const fy = focusY >= 0 && focusY <= 1 ? focusY : 0.5;
    let ox = x + fx * (w - dw);
    let oy = y + fy * (h - dh);
    ox = Math.max(x + w - dw, Math.min(x, ox));
    oy = Math.max(y + h - dh, Math.min(y, oy));
    return { ox: ox, oy: oy, dw: dw, dh: dh };
  }

  /**
   * Спокойный режим — без дрейфа кадра.
   * @returns {boolean}
   */
  function titleCalm() {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /** Зум 1…1.018 за цикл. @returns {number} */
  function burnZoom() {
    if (titleCalm()) return 1;
    const t = typeof gt === 'number' ? gt : 0;
    return 1 + BURN_ZOOM * (0.5 + 0.5 * Math.sin((t / BURN_SEC) * Math.PI * 2));
  }

  /**
   * Картинка на кадр с якорем.
   * @param {CanvasRenderingContext2D} ctx
   * @param {HTMLImageElement} img
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {object|null} plate
   * @param {number} alpha
   * @returns {boolean}
   */
  function blitCover(ctx, img, x, y, w, h, plate, alpha) {
    if (!img || !img.complete || !img.naturalWidth) return false;
    const d = coverDest(
      img.naturalWidth,
      img.naturalHeight,
      x, y, w, h,
      plate ? plate.focusX : 0.5,
      plate ? plate.focusY : 0.5,
      burnZoom()
    );
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.drawImage(img, d.ox, d.oy, d.dw, d.dh);
    ctx.restore();
    return true;
  }

  /** Остальные кадры после выбранного. */
  function preloadRest() {
    if (restQueued) return;
    restQueued = true;
    const run = function () {
      const list = plateList();
      for (let i = 0; i < list.length; i++) queueTitleImage(list[i].src);
      queueTitleImage(TITLE_BG_FALLBACK);
    };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 1800 });
    else if (typeof setTimeout === 'function') setTimeout(run, 480);
    else run();
  }

  /**
   * Подмешивает манифест с диска, не ломая сток.
   * @param {object} data
   */
  function applyManifest(data) {
    if (!data || !Array.isArray(data.plates) || !data.plates.length) return;
    const next = [];
    for (let i = 0; i < data.plates.length; i++) {
      const p = normalizePlate(data.plates[i]);
      if (p) next.push(p);
    }
    if (next.length) plates = next;
  }

  /** Один раз читает titles.json. */
  function ensureManifest() {
    if (manifestDone || manifestBusy) return;
    if (typeof fetch !== 'function') { manifestDone = true; return; }
    manifestBusy = true;
    fetch(TITLE_BG_MANIFEST, { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('titles');
      return res.json();
    }).then(function (data) {
      applyManifest(data);
      manifestDone = true;
      manifestBusy = false;
    }).catch(function () {
      manifestDone = true;
      manifestBusy = false;
    });
  }

  /** Готова ли картинка к блиту. @param {string} src @returns {boolean} */
  function imgReady(src) {
    const img = titleBgImgs[src];
    return !!(img && img.complete && img.naturalWidth);
  }

  /** Фон под текущий экран: сначала выбранный кадр. */
  function ensureTitleArt() {
    ensureManifest();
    const want = pickTitleBgSrc();
    queueTitleImage(want);
    const bg = titleBgImgs[want];
    if (bg && !bg.naturalWidth) bindTitleSrc(bg, want);
    preloadRest();
    const now = typeof gt === 'number' ? gt : 0;
    if (imgReady(want) && want !== liveSrc) {
      if (imgReady(liveSrc) && liveSrc !== want) {
        fromSrc = liveSrc;
        fadeFromGt = now;
      }
      liveSrc = want;
    } else if (!imgReady(liveSrc) && imgReady(want)) {
      liveSrc = want;
    }
  }

  /**
   * Альфа нового кадра при смене разрешения.
   * @returns {number}
   */
  function fadeAlpha() {
    if (fadeFromGt < 0 || titleCalm()) return 1;
    const now = typeof gt === 'number' ? gt : 0;
    return Math.max(0, Math.min(1, (now - fadeFromGt) / FADE_SEC));
  }

  /**
   * Рисует пластину (кроссфейд + якорь).
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   */
  function drawTitlePlate(ctx, x, y, w, h) {
    ensureTitleArt();
    ctx.fillStyle = '#050409';
    ctx.fillRect(x, y, w, h);
    const a = fadeAlpha();
    const fromImg = fromSrc ? titleBgImgs[fromSrc] : null;
    if (fromImg && a < 1) blitCover(ctx, fromImg, x, y, w, h, plateBySrc(fromSrc), 1);
    const liveImg = titleBgImgs[liveSrc] || titleBgImgs[TITLE_BG_FALLBACK];
    blitCover(ctx, liveImg, x, y, w, h, plateBySrc(liveSrc), fromImg && a < 1 ? a : 1);
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.titleBg = {
    pickTitleBgSrc: pickTitleBgSrc,
    parseTitleBgSize: parseTitleBgSize,
    coverDest: coverDest,
    ensureTitleArt: ensureTitleArt,
    drawTitlePlate: drawTitlePlate,
    dir: TITLE_BG_DIR,
    fallback: TITLE_BG_FALLBACK
  };
  ensureTitleArt();
})(typeof window !== 'undefined' ? window : globalThis);
