////////////////////////////////////////////////////////
//
// DiVANEngine: блик металла по карте NN_Specular.
// Белое — блеск, чёрное — матовое. Нет файла — нет блика.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /** Тестовый софтбокс: медленно обходит машину 01. */
  const LIGHT_PERIOD = 5.6;
  const LIGHT_BASE_ANGLE = 0.48;
  const LIGHT_ARC = 0.58;
  const LIGHT_TRAVEL = 0.82;
  const BUF_MAX = 256;
  let specBuf = null;

  /**
   * Путь карты блеска слота.
   * @param {number} idx
   * @param {string} ext
   * @returns {string}
   */
  function specUrl(idx, ext) {
    const nn = String((idx | 0) + 1).padStart(2, '0');
    return 'assets/data/cars/' + nn + '/' + nn + '_Specular.' + ext;
  }

  /**
   * Если очередь заставки не дала картинку — грузим PNG напрямую.
   * @param {HTMLImageElement} im
   * @param {number} idx
   */
  function kickSpecSrc(im, idx) {
    if (!im || im._specKick) return;
    if (!im.complete || im.naturalWidth > 1) return;
    im._specKick = true;
    im.src = specUrl(idx, 'png');
  }

  /**
   * Карта блеска слота: assets/data/cars/NN/NN_Specular.
   * @param {number} idx
   * @returns {HTMLImageElement|null}
   */
  function specImage(idx) {
    const list = global.CAR_SPECULAR;
    const im = list && list[idx];
    if (!im) return null;
    kickSpecSrc(im, idx);
    if (!im.complete || im.naturalWidth < 2) return null;
    return im;
  }

  /**
   * Белая RGB, альфа = яркость карты — маска destination-in.
   * @param {HTMLImageElement} spec
   * @returns {HTMLCanvasElement|null}
   */
  function specAlphaMask(spec) {
    if (spec._specAlpha) return spec._specAlpha;
    if (typeof document === 'undefined') return null;
    try {
      const w = spec.naturalWidth, h = spec.naturalHeight;
      const cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      const g = cv.getContext('2d', { willReadFrequently: true });
      g.drawImage(spec, 0, 0);
      const data = g.getImageData(0, 0, w, h);
      const p = data.data;
      for (let i = 0; i < p.length; i += 4) {
        const lum = p[i] * 0.299 + p[i + 1] * 0.587 + p[i + 2] * 0.114;
        p[i] = 255;
        p[i + 1] = 255;
        p[i + 2] = 255;
        p[i + 3] = lum;
      }
      g.putImageData(data, 0, 0);
      spec._specAlpha = cv;
      return cv;
    } catch (e) {
      return null;
    }
  }

  /**
   * Ставит карты в очередь заставки. Пустой слот остаётся без блика.
   */
  function loadSpecularMaps() {
    const cars = global.CARS;
    if (!cars || !cars.length || global.CAR_SPECULAR) return;
    const enqueue = global.bootEnqueue;
    global.CAR_SPECULAR = cars.map(function (_, i) {
      const img = new Image();
      if (i !== 0) return img;
      if (typeof enqueue === 'function') {
        enqueue(img, [specUrl(i, 'webp'), specUrl(i, 'png')]);
      } else {
        kickSpecSrc(img, i);
      }
      return img;
    });
  }

  /**
   * Переиспользуемый буфер блика.
   * @param {number} w
   * @param {number} h
   * @returns {{canvas: HTMLCanvasElement, g: CanvasRenderingContext2D}}
   */
  function shineBuf(w, h) {
    if (!specBuf) {
      specBuf = document.createElement('canvas');
      specBuf._g = specBuf.getContext('2d', { alpha: true });
    }
    if (specBuf.width !== w || specBuf.height !== h) {
      specBuf.width = w;
      specBuf.height = h;
    }
    return { canvas: specBuf, g: specBuf._g };
  }

  /** Единое время кадра; fallback нужен для изолированного preview. */
  function lightTime() {
    if (typeof gt === 'number' && isFinite(gt)) return gt;
    if (typeof performance !== 'undefined' && performance.now) return performance.now() / 1000;
    return Date.now() / 1000;
  }

  /**
   * Направление движущегося света в осях кузова после rotate(ang).
   * @param {number} ang
   * @param {number} [time]
   * @returns {{x: number, y: number, sweep: number}}
   */
  function localLight(ang, time) {
    const t = isFinite(+time) ? +time : lightTime();
    const phase = t / LIGHT_PERIOD * Math.PI * 2;
    const worldAng = LIGHT_BASE_ANGLE + Math.sin(phase) * LIGHT_ARC;
    const sunX = Math.cos(worldAng), sunY = Math.sin(worldAng);
    const ca = Math.cos(ang || 0), sa = Math.sin(ang || 0);
    let x = sunX * ca + sunY * sa;
    let y = -sunX * sa + sunY * ca;
    const len = Math.hypot(x, y) || 1;
    return { x: x / len, y: y / len, sweep: Math.sin(phase - Math.PI * 0.5) };
  }

  /**
   * Рисует спекуляр поверх кузова, брони и ран.
   * @param {CanvasRenderingContext2D} c
   * @param {number} idx
   * @param {number} ang
   * @param {number} dx
   * @param {number} dy
   * @param {number} dw
   * @param {number} dh
   * @returns {boolean}
   */
  function paintCarSpecular(c, idx, ang, dx, dy, dw, dh) {
    if (idx !== 0) return false;
    const spec = specImage(idx);
    if (!spec || !c || typeof document === 'undefined') return false;
    const mask = specAlphaMask(spec);
    const iw = spec.naturalWidth, ih = spec.naturalHeight;
    const k = Math.min(1, BUF_MAX / Math.max(iw, ih));
    const bw = Math.max(8, Math.round(iw * k));
    const bh = Math.max(8, Math.round(ih * k));
    const buf = shineBuf(bw, bh);
    const g = buf.g;
    const L = localLight(ang);
    const span = Math.abs(L.x) * bw * 0.5 + Math.abs(L.y) * bh * 0.5;
    const cx = bw * 0.5 + L.x * span * L.sweep * LIGHT_TRAVEL;
    const cy = bh * 0.5 + L.y * span * L.sweep * LIGHT_TRAVEL;
    const rad = Math.max(bw, bh) * 0.46;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.clearRect(0, 0, bw, bh);
    const blob = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
    blob.addColorStop(0, 'rgba(255,255,255,1)');
    blob.addColorStop(0.18, 'rgba(255,247,226,0.95)');
    blob.addColorStop(0.48, 'rgba(255,220,170,0.58)');
    blob.addColorStop(0.8, 'rgba(190,215,255,0.18)');
    blob.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = blob;
    g.fillRect(0, 0, bw, bh);
    g.globalCompositeOperation = 'lighter';
    const px = L.x, py = L.y;
    const streak = g.createLinearGradient(
      cx - px * span * 0.42, cy - py * span * 0.42,
      cx + px * span * 0.42, cy + py * span * 0.42
    );
    streak.addColorStop(0, 'rgba(255,255,255,0)');
    streak.addColorStop(0.38, 'rgba(255,255,255,0)');
    streak.addColorStop(0.5, 'rgba(255,255,255,1)');
    streak.addColorStop(0.62, 'rgba(255,255,255,0)');
    streak.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = streak;
    g.fillRect(0, 0, bw, bh);
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(mask || spec, 0, 0, bw, bh);
    g.globalCompositeOperation = 'source-over';
    c.save();
    c.imageSmoothingEnabled = true;
    if (c.imageSmoothingQuality) c.imageSmoothingQuality = 'medium';
    c.globalCompositeOperation = 'screen';
    c.globalAlpha = 0.12;
    c.drawImage(spec, dx, dy, dw, dh);
    c.globalAlpha = 0.92;
    c.drawImage(buf.canvas, dx, dy, dw, dh);
    c.restore();
    return true;
  }

  loadSpecularMaps();

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.carSpec = {
    loadSpecularMaps: loadSpecularMaps,
    specImage: specImage,
    paint: paintCarSpecular,
    localLight: localLight
  };
})(typeof window !== 'undefined' ? window : globalThis);
