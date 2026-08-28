////////////////////////////////////////////////////////
//
// Холст лаборатории: слои, колёса, нитро, тест и перетаскивание
//
////////////////////////////////////////////////////////
'use strict';

const EditorView = (() => {
  const ZMIN = 0.8, ZMAX = 80;
  let canvas, ctx, sprite, getCar, getIndex, getWheel, setWheel, getNitro, setNitro;
  let onChange, onSelect, onHover, onDragEnd, onZoom;
  const cam = {x: 0, y: 0, z: 10};
  let pendingFit = false;
  let drag = null, hoverW = -1, hoverN = -1, spin = 0, playing = true, testing = false;
  let snap = true, yaw = 0, testSteer = 0, now = 0;
  let mirrorWheels = true;
  let linkArmor = true;
  let showMarks = true;
  let layerSel = [], wheelSel = [], nitroSel = [], lastFocus = 'wheel';
  let selAnchor = null;
  const cache = new Map();
  const shadowCache = new Map();

  let lastCssW = 0, lastCssH = 0;

  /** Подключает холст и колбэки приложения. */
  function init(opts) {
    canvas = opts.canvas;
    ctx = canvas.getContext('2d', {alpha: false});
    getCar = opts.getCar;
    getIndex = opts.getIndex;
    getWheel = opts.getWheel;
    setWheel = opts.setWheel;
    getNitro = opts.getNitro || (() => 0);
    setNitro = opts.setNitro || (() => {});
    onChange = opts.onChange;
    onSelect = opts.onSelect;
    onHover = opts.onHover;
    onDragEnd = opts.onDragEnd;
    onZoom = opts.onZoom;
    sprite = imgChain([
      'assets/machines/wheels/wheel-strip.webp',
      'assets/machines/wheels/wheel-strip.png',
      'assets/machines/wheels/wheel-strip.svg'
    ]);
    bind();
    syncCanvasSize();
    fit();
    window.addEventListener('resize', () => { syncCanvasSize(); if (pendingFit) fit(); else draw(); });
    if (typeof ResizeObserver !== 'undefined' && canvas.parentElement) {
      new ResizeObserver(() => {
        if (drag) return;
        const grew = syncCanvasSize();
        if (grew || pendingFit) fit();
        else draw();
      }).observe(canvas.parentElement);
    }
    window.addEventListener('load', () => { syncCanvasSize(); fit(); });
    requestAnimationFrame(() => { syncCanvasSize(); fit(); });
    requestAnimationFrame(tick);
  }

  /** Кадр: вращение дисков, в тесте — руль и живое нитро. */
  function tick(t) {
    now = t;
    if (playing || testing) spin = t * (testing ? 0.045 : 0.012);
    testSteer = testing ? Math.sin(t * 0.003) * 0.55 : yaw;
    try { draw(); } catch (err) { console.error(err); }
    requestAnimationFrame(tick);
  }

  /** Совпадает буфер холста с видимым размером (иначе картинка 1px на сером фоне). */
  function syncCanvasSize() {
    if (!canvas || !ctx) return false;
    if (drag) return false;
    const r = canvas.getBoundingClientRect();
    const d = devicePixelRatio || 1;
    const cssW = Math.max(0, r.width);
    const cssH = Math.max(0, r.height);
    const w = Math.max(1, Math.round(cssW * d));
    const h = Math.max(1, Math.round(cssH * d));
    const grew = (lastCssW < 8 && cssW >= 8) || (lastCssH < 8 && cssH >= 8);
    lastCssW = cssW;
    lastCssH = cssH;
    if (Math.abs(canvas.width - w) > 1 || Math.abs(canvas.height - h) > 1) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.setTransform(d, 0, 0, d, 0, 0);
    return grew;
  }

  /** Подгоняет плотность пикселей холста под экран. */
  function resize() {
    syncCanvasSize();
    draw();
  }

  /** Рамка кузова, колёс и нитро — чтобы крупная машина влезала в кадр. */
  function carBounds(car) {
    if (!car || !car.body) return {x: 0, y: 0, w: 90, h: 56};
    const sz = bodyDrawSize(car);
    let minX = car.body.x - sz.w / 2, maxX = car.body.x + sz.w / 2;
    let minY = car.body.y - sz.h / 2, maxY = car.body.y + sz.h / 2;
    (car.w || []).forEach((w) => {
      const s = wheelSize(w);
      minX = Math.min(minX, w[0] - s.dw / 2);
      maxX = Math.max(maxX, w[0] + s.dw / 2);
      minY = Math.min(minY, w[1] - s.dh / 2);
      maxY = Math.max(maxY, w[1] + s.dh / 2);
    });
    (car.nitro || []).forEach((n) => {
      const len = n[2] || 8, half = n[3] || 3;
      minX = Math.min(minX, n[0] - len);
      maxX = Math.max(maxX, n[0] + 2);
      minY = Math.min(minY, n[1] - half);
      maxY = Math.max(maxY, n[1] + half);
    });
    const ap = armorPos(car);
    minX = Math.min(minX, ap.x - sz.w / 2);
    maxX = Math.max(maxX, ap.x + sz.w / 2);
    minY = Math.min(minY, ap.y - sz.h / 2);
    maxY = Math.max(maxY, ap.y + sz.h / 2);
    return {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      w: Math.max(28, maxX - minX + 20),
      h: Math.max(20, maxY - minY + 20)
    };
  }

  /** Масштаб, при котором текущая машина целиком в кадре. */
  function fitScale() {
    const r = canvas.getBoundingClientRect();
    const b = carBounds(typeof getCar === 'function' ? getCar() : null);
    const z = Math.min(r.width / Math.max(b.w, 1), r.height / Math.max(b.h, 1)) * 0.9;
    if (!isFinite(z) || z <= 0) return 10;
    return Math.max(ZMIN, Math.min(ZMAX, z));
  }

  /** Кузов уже с реальными пикселями спрайта. */
  function bodyReady() {
    if (typeof getCar !== 'function') return false;
    const im = imgChain(bodySrcList(getCar(), getIndex(), false));
    return !!(im && im.complete && im.naturalWidth);
  }

  /** Вписывает машину в кадр; после загрузки спрайта подгоняет ещё раз. */
  function fit() {
    pendingFit = true;
    applyFit();
    if (bodyReady()) pendingFit = false;
  }

  /** Ставит камеру по рамке машины. */
  function applyFit() {
    if (!canvas) return;
    const b = carBounds(typeof getCar === 'function' ? getCar() : null);
    cam.x = b.x;
    cam.y = b.y;
    cam.z = fitScale();
    resize();
    notifyZoom();
  }

  /** Зум к точке курсора или к центру холста. */
  function zoomBy(factor, e) {
    if (!canvas) return;
    pendingFit = false;
    const r = canvas.getBoundingClientRect();
    const pt = e || {clientX: r.left + r.width / 2, clientY: r.top + r.height / 2};
    const p = toWorld(pt);
    cam.z = Math.max(ZMIN, Math.min(ZMAX, cam.z * factor));
    const p2 = toWorld(pt);
    cam.x += p.x - p2.x;
    cam.y += p.y - p2.y;
    notifyZoom();
  }

  /** Подпись масштаба: 100% = машина в кадре. */
  function zoomLabel() {
    const ref = fitScale() || 1;
    return Math.round(cam.z / ref * 100) + '%';
  }

  /** Сообщает панели текущий зум. */
  function notifyZoom() {
    if (typeof onZoom === 'function') onZoom(zoomLabel());
  }

  /** Экран → мир: обратная матрица кадра (центр, зум, камера, ракурс). */
  function toWorld(e) {
    const r = canvas.getBoundingClientRect();
    const z = (isFinite(cam.z) && cam.z > 0) ? cam.z : 10;
    const sx = (e.clientX - r.left - r.width / 2) / z;
    const sy = (e.clientY - r.top - r.height / 2) / z;
    const cx = isFinite(cam.x) ? cam.x : 0;
    const cy = isFinite(cam.y) ? cam.y : 0;
    const a = isFinite(yaw) ? -yaw : 0;
    const c = Math.cos(a), s = Math.sin(a);
    const lx = sx + cx;
    const ly = sy + cy;
    return {x: lx * c - ly * s, y: lx * s + ly * c};
  }

  /** Смещение брони от кузова: мир = кузов + (ax, ay). */
  function armorPos(car) {
    const b = (car && car.body) || {};
    return {x: (+b.x || 0) + (+b.ax || 0), y: (+b.y || 0) + (+b.ay || 0)};
  }

  /** Растяжение кузова по осям (1 = как в файле спрайта). */
  function bodyStretch(car) {
    const b = (car && car.body) || {};
    const sx = +b.sx;
    const sy = +b.sy;
    return {
      sx: isFinite(sx) && sx > 0 ? sx : 1,
      sy: isFinite(sy) && sy > 0 ? sy : 1
    };
  }

  /** Путь кузова или слоя брони: webp, затем png. */
  function bodySrcList(car, idx, armorLayer) {
    if (!armorLayer && car.bodyData) return [car.bodyData];
    const n = String((idx >= 0 ? idx : 0) + 1).padStart(2, '0');
    if (armorLayer) {
      if (!(car.body.armor > 0)) return [];
      const base = 'assets/machines/cars/' + n + '_armor_' + (car.body.armor | 0);
      return [base + '.webp', base + '.png'];
    }
    return ['assets/machines/cars/' + n + '.webp', 'assets/machines/cars/' + n + '.png'];
  }

  /** Картинка с запасным расширением (как в игре). */
  function imgChain(srcs) {
    if (!srcs.length) return null;
    const key = srcs.join('|');
    if (cache.has(key)) return cache.get(key);
    const im = new Image();
    im.decoding = 'async';
    let e = 0;
    const tryNext = () => { if (e < srcs.length) im.src = srcs[e++]; else draw(); };
    im.onload = () => {
      draw();
      if (pendingFit) fit();
    };
    im.onerror = tryNext;
    tryNext();
    cache.set(key, im);
    return im;
  }

  /** Слой-группа включён (старый visible). */
  function layerOn(car, name) {
    return !(car.visible && car.visible[name] === false);
  }

  /** Id слоя колеса или трубы. */
  function stackIdOf(car, type, ref) {
    if (!car || !car.stack) return null;
    const L = car.stack.find((x) => x.type === type && x.ref === ref);
    return L ? L.id : null;
  }

  /** Рисует всю сцену по стеку: снизу вверх, как в Figma. */
  function draw() {
    if (!canvas || !ctx) return;
    const r = canvas.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;
    const d = devicePixelRatio || 1;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.fillStyle = '#2a2833';
    ctx.fillRect(0, 0, r.width, r.height);
    ctx.save();
    try {
      ctx.translate(r.width / 2, r.height / 2);
      const z = (isFinite(cam.z) && cam.z > 0) ? cam.z : 10;
      ctx.scale(z, z);
      ctx.translate(-(isFinite(cam.x) ? cam.x : 0), -(isFinite(cam.y) ? cam.y : 0));
      ctx.rotate(isFinite(yaw) ? yaw : 0);
      drawGrid();
      const car = typeof getCar === 'function' ? getCar() : null;
      if (!car) return;
      if (typeof EditorData !== 'undefined' && EditorData.ensureStack) EditorData.ensureStack(car);
      const stack = Array.isArray(car.stack) && car.stack.length ? car.stack : [
        {type: 'shadow', on: true}, {type: 'wheel', on: true, ref: 0},
        {type: 'body', on: true}, {type: 'guides', on: true}
      ];
      if (car.stats && car.stats.hov && !(car.w && car.w.length)) {
        ctx.fillStyle = 'rgba(53,224,255,.18)';
        ctx.beginPath();
        ctx.ellipse(0, 0, 32, 16, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      stack.forEach((L) => {
        if (!L || L.on === false) return;
        try {
          if (L.type === 'shadow') drawShadow(car);
          else if (L.type === 'wheel') drawOneWheel(car, L.ref);
          else if (L.type === 'nitro') drawOneNitro(car, L.ref);
          else if (L.type === 'body') drawBody(car, false);
          else if (L.type === 'armor') drawArmor(car);
          else if (L.type === 'guides') drawGuides(car);
        } catch (err) { console.error(err); }
      });
      const bodyL = (car.stack || []).find((x) => x.type === 'body');
      if ((!bodyL || bodyL.on !== false) && !bodyReady()) drawBodyFallback(car);
    } finally {
      ctx.restore();
    }
  }

  /** Контур кузова, если webp не дошёл (VPN / файл). */
  function drawBodyFallback(car) {
    const sz = {w: 52 * (car.body.scale || 1), h: 26 * (car.body.scale || 1)};
    ctx.save();
    ctx.translate(car.body.x || 0, car.body.y || 0);
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 0.7;
    ctx.strokeRect(-sz.w / 2, -sz.h / 2, sz.w, sz.h);
    ctx.fillStyle = '#ffd23f';
    ctx.font = '3.2px Arial';
    ctx.fillText('Нет спрайта — проверьте VPN / editor.bat', -26, 0);
    ctx.restore();
  }

  /** Толщина отметки ~1 px экрана, без жирных рамок. */
  function hair() {
    return 1 / Math.max(cam.z, 1);
  }

  /** Сетка на весь видимый холст. Мелкая клетка + каждая 4-я чуть ярче. */
  function drawGrid() {
    if (!snap) return;
    const r = canvas.getBoundingClientRect();
    const z = (isFinite(cam.z) && cam.z > 0) ? cam.z : 10;
    const pad = 8;
    const halfW = r.width / (2 * z) + pad;
    const halfH = r.height / (2 * z) + pad;
    const step = 0.625;
    const major = step * 4;
    const x0 = Math.floor((cam.x - halfW) / step) * step;
    const x1 = cam.x + halfW;
    const y0 = Math.floor((cam.y - halfH) / step) * step;
    const y1 = cam.y + halfH;
    ctx.save();
    ctx.strokeStyle = 'rgba(180,180,180,.12)';
    ctx.lineWidth = hair() * 0.55;
    for (let x = x0; x <= x1; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y1);
      ctx.stroke();
    }
    for (let y = y0; y <= y1; y += step) {
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(180,180,180,.22)';
    ctx.lineWidth = hair() * 0.7;
    const mx0 = Math.floor((cam.x - halfW) / major) * major;
    const my0 = Math.floor((cam.y - halfH) / major) * major;
    for (let x = mx0; x <= x1; x += major) {
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y1);
      ctx.stroke();
    }
    for (let y = my0; y <= y1; y += major) {
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(61,158,255,.22)';
    ctx.beginPath();
    ctx.moveTo(x0, 0);
    ctx.lineTo(x1, 0);
    ctx.moveTo(0, y0);
    ctx.lineTo(0, y1);
    ctx.stroke();
    ctx.restore();
  }

  /** Силуэт кузова как в игре: маска по альфе, лёгкое размытие. */
  function getShadowGfx(car) {
    const im = imgChain(bodySrcList(car, getIndex(), false));
    if (!im || !im.complete || !im.naturalWidth) return null;
    const key = (im.src || '') + '|' + im.naturalWidth + 'x' + im.naturalHeight;
    if (shadowCache.has(key)) return shadowCache.get(key);
    const iw = im.naturalWidth, ih = im.naturalHeight;
    const maxSide = 128, sc = maxSide / Math.max(iw, ih);
    const mw = Math.max(8, Math.round(iw * sc)), mh = Math.max(8, Math.round(ih * sc));
    const pad = 8, cw = mw + pad * 2, ch = mh + pad * 2;
    const fill = document.createElement('canvas');
    fill.width = cw;
    fill.height = ch;
    const fg = fill.getContext('2d');
    fg.drawImage(im, pad, pad, mw, mh);
    fg.globalCompositeOperation = 'source-in';
    fg.fillStyle = '#000';
    fg.fillRect(0, 0, cw, ch);
    const out = document.createElement('canvas');
    out.width = cw;
    out.height = ch;
    const og = out.getContext('2d');
    if (og.filter !== undefined) {
      og.filter = 'blur(1.6px)';
      og.drawImage(fill, 0, 0);
      og.filter = 'none';
    } else {
      og.drawImage(fill, 0, 0);
    }
    const gfx = {img: out, pad: pad, mw: mw, mh: mh, iw: iw, ih: ih};
    shadowCache.set(key, gfx);
    return gfx;
  }

  /** Тень на земле: тот же силуэт, что в гонке (не эллипс). */
  function drawShadow(car) {
    const bodyS = car.body.scale || 1;
    const gfx = getShadowGfx(car);
    ctx.save();
    ctx.translate(car.body.x || 0, (car.body.y || 0) + 5);
    ctx.scale(1, 0.92);
    ctx.globalAlpha = 0.36;
    if (gfx) {
      const s = 60 / Math.max(gfx.iw, gfx.ih) * bodyS;
      const dw = gfx.iw * s, dh = gfx.ih * s;
      const padU = gfx.pad * (dw / gfx.mw);
      ctx.drawImage(gfx.img, -dw / 2 - padU, -dh / 2 - padU, dw + padU * 2, dh + padU * 2);
    } else {
      ctx.fillStyle = '#000';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-27 * bodyS, -16 * bodyS, 54 * bodyS, 32 * bodyS, 7);
      else ctx.rect(-27 * bodyS, -16 * bodyS, 54 * bodyS, 32 * bodyS);
      ctx.fill();
    }
    ctx.restore();
  }

  /** Спрайт кузова в игровом масштабе. */
  function drawBody(car, armorOnly) {
    const im = imgChain(bodySrcList(car, getIndex(), armorOnly));
    if (!im || !im.complete || !im.naturalWidth) return false;
    const st = bodyStretch(car);
    const s = 60 / Math.max(im.naturalWidth, im.naturalHeight) * (car.body.scale || 1);
    const pos = armorOnly ? armorPos(car) : {x: car.body.x, y: car.body.y};
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.drawImage(im,
      -im.naturalWidth * s * st.sx / 2,
      -im.naturalHeight * s * st.sy / 2,
      im.naturalWidth * s * st.sx,
      im.naturalHeight * s * st.sy);
    ctx.restore();
    return true;
  }

  /** Броня: файл слоя или запасные пластины, плюс подпись уровня. */
  function drawArmor(car) {
    if (!(car.body.armor > 0)) return;
    const painted = drawBody(car, true);
    const sz = bodyDrawSize(car);
    if (!painted) EditorFx.armorFallback(ctx, car, sz);
    if (showMarks) EditorFx.armorBadge(ctx, car, sz);
  }

  /** Размер колеса как в игре: ширина / высота / множитель сразу видны на холсте. */
  function wheelSize(w) {
    const sx = Number(w && w[5]);
    const scale = isFinite(sx) && sx > 0 ? sx : 1;
    const ww = Number(w && w[2]);
    const wh = Number(w && w[3]);
    return {
      dw: Math.max(0.4, (isFinite(ww) ? ww : 12) * scale),
      dh: Math.max(0.4, (isFinite(wh) ? wh : 8) * scale)
    };
  }

  /** Точка центра колеса: ось вращения и якорь размера. */
  function drawWheelHub(selected, hovered) {
    const r = Math.max(0.28, 1.15 / Math.max(cam.z, 0.8));
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = selected ? '#3d9eff' : (hovered ? '#e8c547' : '#d8d8d8');
    ctx.fill();
  }

  /** Одно колесо в порядке стека. */
  function drawOneWheel(car, i) {
    const w = car.w && car.w[i];
    if (!w) return;
    const {dw, dh} = wheelSize(w);
    const sid = stackIdOf(car, 'wheel', i);
    const chosen = wheelSel.indexOf(i) >= 0 || layerSel.indexOf(sid) >= 0 || layerSel.indexOf('wheels') >= 0;
    ctx.save();
    ctx.translate(w[0], w[1]);
    ctx.rotate(w[4] + (w[6] ? testSteer : 0));
    const frame = ((Math.floor(spin) % 8) + 8) % 8;
    ctx.imageSmoothingEnabled = true;
    if (sprite && sprite.complete && sprite.naturalWidth) {
      const srcW = sprite.naturalWidth / 8;
      const srcH = sprite.naturalHeight;
      ctx.drawImage(sprite, frame * srcW, 0, srcW, srcH, -dw / 2, -dh / 2, dw, dh);
    } else {
      ctx.fillStyle = '#111';
      ctx.fillRect(-dw / 2, -dh / 2, dw, dh);
    }
    if (showMarks && chosen) {
      ctx.strokeStyle = (lastFocus === 'wheel' && getWheel() === i) ? '#3d9eff' : '#7ab8ff';
      ctx.lineWidth = hair();
      ctx.strokeRect(-dw / 2, -dh / 2, dw, dh);
    }
    if (showMarks) drawWheelHub(chosen, i === hoverW);
    ctx.restore();
  }

  /** Одна труба нитро в порядке стека. */
  function drawOneNitro(car, i) {
    const sid = stackIdOf(car, 'nitro', i);
    EditorFx.drawNitro(ctx, car.nitro || [], {
      time: now,
      live: testing,
      sel: lastFocus === 'nitro' ? getNitro() : -1,
      multi: nitroSel,
      only: i,
      layerOn: layerSel.indexOf(sid) >= 0 || layerSel.indexOf('nitro') >= 0,
      hover: hoverN,
      marks: showMarks
    });
  }

  /** Точки колёс, нитро и рамка кузова. */
  function drawGuides(car) {
    if (!showMarks) return;
    if (layerOn(car, 'wheels')) {
      (car.w || []).forEach((w, i) => {
        ctx.fillStyle = '#eee8f4';
        ctx.font = '1.55px Arial';
        ctx.fillText(String(i + 1) + (w[6] ? '*' : ''), w[0] + 1.4, w[1] - 1.3);
      });
    }
    if (layerOn(car, 'body') || layerOn(car, 'armor')) {
      const sz = bodyDrawSize(car);
      const bodyOn = layerSel.indexOf('body') >= 0 ||
        (car.stack || []).some((L) => L.type === 'body' && layerSel.indexOf(L.id) >= 0);
      const armorOn = layerSel.indexOf('armor') >= 0 ||
        (car.stack || []).some((L) => L.type === 'armor' && layerSel.indexOf(L.id) >= 0);
      if (layerOn(car, 'body')) {
        ctx.strokeStyle = bodyOn ? '#3d9eff' : 'rgba(232,197,71,.55)';
        ctx.lineWidth = hair();
        ctx.strokeRect(car.body.x - sz.w / 2, car.body.y - sz.h / 2, sz.w, sz.h);
      }
      if (layerOn(car, 'armor') && (car.body.armor > 0 || armorOn)) {
        const ap = armorPos(car);
        ctx.strokeStyle = armorOn ? '#7ab8ff' : 'rgba(180,196,210,.4)';
        ctx.lineWidth = hair();
        ctx.strokeRect(ap.x - sz.w / 2, ap.y - sz.h / 2, sz.w, sz.h);
      }
    }
    ctx.strokeStyle = 'rgba(61,158,255,.28)';
    ctx.lineWidth = hair() * 0.8;
    ctx.beginPath();
    ctx.moveTo(-40, 0); ctx.lineTo(40, 0);
    ctx.moveTo(0, -26); ctx.lineTo(0, 26);
    ctx.stroke();
  }

  /** Что двигаем: кузов, броня, колёса, трубы. */
  function moveSet(car) {
    EditorData.ensureStack(car);
    const picked = (car.stack || []).filter((L) => layerSel.indexOf(L.id) >= 0);
    const pickedBody = picked.some((L) => L.type === 'body' || L.type === 'shadow') ||
      layerSel.indexOf('body') >= 0 || layerSel.indexOf('shadow') >= 0;
    const pickedArmor = picked.some((L) => L.type === 'armor') || layerSel.indexOf('armor') >= 0;
    const fromW = picked.filter((L) => L.type === 'wheel').map((L) => L.ref);
    const fromN = picked.filter((L) => L.type === 'nitro').map((L) => L.ref);
    const allW = layerSel.indexOf('wheels') >= 0;
    const allN = layerSel.indexOf('nitro') >= 0;
    if (!layerSel.length) return {body: false, armor: false, wheels: [], nitros: []};
    return {
      body: pickedBody,
      armor: pickedArmor && !pickedBody,
      wheels: allW ? (car.w || []).map((_, i) => i) : uniqIds(fromW.concat(wheelSel)),
      nitros: allN ? (car.nitro || []).map((_, i) => i) : uniqIds(fromN.concat(nitroSel))
    };
  }

  /** Без повторов, порядок как пришёл. */
  function uniqIds(list) {
    const out = [];
    (list || []).forEach((id) => {
      if (id == null || out.indexOf(id) >= 0) return;
      out.push(id);
    });
    return out;
  }

  /** Слои сверху вниз — как в панели. */
  function visualStackIds(car) {
    return ((car && car.stack) || []).filter((L) => L && L.id).slice().reverse().map((L) => L.id);
  }

  /** Диапазон слоёв между якорем и кликом (как Shift в Photoshop). */
  function rangeStackIds(car, fromId, toId) {
    const ids = visualStackIds(car);
    let a = ids.indexOf(fromId);
    const b = ids.indexOf(toId);
    if (b < 0) return toId ? [toId] : [];
    if (a < 0) a = b;
    const lo = Math.min(a, b), hi = Math.max(a, b);
    return ids.slice(lo, hi + 1);
  }

  /** Колёса и нитро в наборе совпадают со слоями. */
  function syncPartsFromLayers(car) {
    const nextW = [], nextN = [];
    ((car && car.stack) || []).forEach((L) => {
      if (!L || layerSel.indexOf(L.id) < 0) return;
      if (L.type === 'wheel' && nextW.indexOf(L.ref) < 0) nextW.push(L.ref);
      if (L.type === 'nitro' && nextN.indexOf(L.ref) < 0) nextN.push(L.ref);
    });
    wheelSel = nextW;
    nitroSel = nextN;
  }

  /** Фокус инспектора на слой, набор не трогает. */
  function focusLayer(car, id) {
    const L = ((car && car.stack) || []).find((x) => x.id === id);
    if (L) {
      if (L.type === 'wheel') { lastFocus = 'wheel'; setWheel(L.ref); }
      else if (L.type === 'nitro') { lastFocus = 'nitro'; setNitro(L.ref); }
      else if (L.type === 'armor') lastFocus = 'armor';
      else lastFocus = 'body';
      return;
    }
    if (id === 'armor') lastFocus = 'armor';
    else if (id === 'wheels') lastFocus = 'wheel';
    else if (id === 'nitro') lastFocus = 'nitro';
    else lastFocus = 'body';
  }

  /** Id слоя по попаданию на холсте. */
  function layerIdFromHit(car, hit) {
    if (!car || !hit || !hit.kind) return null;
    if (hit.kind === 'wheel') return stackIdOf(car, 'wheel', hit.ref);
    if (hit.kind === 'nitro') return stackIdOf(car, 'nitro', hit.ref);
    if (hit.kind === 'armor') {
      const L = (car.stack || []).find((x) => x.type === 'armor');
      return L ? L.id : 'armor';
    }
    if (hit.kind === 'body') {
      const L = (car.stack || []).find((x) => x.type === 'body');
      return L ? L.id : 'body';
    }
    return null;
  }

  /** Деталь уже в группе. */
  function hitInGroup(car, hit) {
    const id = layerIdFromHit(car, hit);
    if (id && layerSel.indexOf(id) >= 0) return true;
    if (hit.kind === 'wheel' && wheelSel.indexOf(hit.ref) >= 0) return true;
    if (hit.kind === 'nitro' && nitroSel.indexOf(hit.ref) >= 0) return true;
    return false;
  }

  /** Пара на оси: левое ↔ правое. Сначала соседи 0–1, 2–3, иначе поиск по X и зеркальному Y. */
  function pairWheel(car, i, pts) {
    const list = pts || (car && car.w);
    if (!list || i < 0 || !list[i]) return -1;
    const x = list[i][0], y = list[i][1];
    const n = i ^ 1;
    if (list[n] && Math.abs((list[n][0] || 0) - x) < 28) return n;
    if (Math.abs(y) < 0.15) return -1;
    let best = -1, bestScore = 48;
    list.forEach((w, j) => {
      if (j === i || !w) return;
      if (y * w[1] >= 0) return;
      const dx = Math.abs(w[0] - x);
      const dy = Math.abs(w[1] + y);
      if (dx > 24 || dy > 16) return;
      const score = dx * 1.2 + dy;
      if (score < bestScore) {
        bestScore = score;
        best = j;
      }
    });
    return best;
  }

  /** Сдвигает выбранные слои, колёса и нитро. */
  function applyDelta(car, dx, dy, pose) {
    const t = moveSet(car);
    const ax0 = pose ? pose.ax : (+car.body.ax || 0);
    const ay0 = pose ? pose.ay : (+car.body.ay || 0);
    if (t.body) {
      car.body.x = (pose ? pose.body.x : car.body.x) + dx;
      car.body.y = (pose ? pose.body.y : car.body.y) + dy;
      if (!linkArmor) {
        car.body.ax = ax0 - dx;
        car.body.ay = ay0 - dy;
      } else {
        car.body.ax = ax0;
        car.body.ay = ay0;
      }
    }
    if (t.armor) {
      car.body.ax = ax0 + dx;
      car.body.ay = ay0 + dy;
    }
    const wpose = pose && pose.wheels;
    const moved = {};
    (t.wheels || []).forEach((i) => {
      if (moved[i]) return;
      const w = car.w[i];
      if (!w) return;
      w[0] = (wpose && wpose[i] ? wpose[i][0] : w[0]) + dx;
      w[1] = (wpose && wpose[i] ? wpose[i][1] : w[1]) + dy;
      moved[i] = true;
      if (!mirrorWheels) return;
      const j = pairWheel(car, i, wpose || car.w);
      if (j < 0 || moved[j] || !car.w[j]) return;
      const pw = car.w[j];
      pw[0] = (wpose && wpose[j] ? wpose[j][0] : pw[0]) + dx;
      pw[1] = (wpose && wpose[j] ? wpose[j][1] : pw[1]) - dy;
      moved[j] = true;
    });
    (t.nitros || []).forEach((i) => {
      const n = car.nitro[i];
      if (!n) return;
      n[0] = (pose ? pose.nitro[i][0] : n[0]) + dx;
      n[1] = (pose ? pose.nitro[i][1] : n[1]) + dy;
    });
  }

  /** Запоминает позиции до жеста. */
  function capturePose(car) {
    return {
      body: {x: car.body.x, y: car.body.y},
      ax: +car.body.ax || 0,
      ay: +car.body.ay || 0,
      wheels: (car.w || []).map((w) => [w[0], w[1]]),
      nitro: (car.nitro || []).map((n) => [n[0], n[1]])
    };
  }

  /** Выбор слоя стека: Ctrl — добавить/снять, Shift — диапазон от якоря. */
  function pickLayer(id, add, range) {
    const car = getCar && getCar();
    if (car) EditorData.ensureStack(car);
    const L = car && (car.stack || []).find((x) => x.id === id);
    if (range) {
      const ids = rangeStackIds(car, selAnchor || id, id);
      layerSel = add ? uniqIds(layerSel.concat(ids)) : ids;
      syncPartsFromLayers(car);
      focusLayer(car, id);
      return;
    }
    if (add) {
      if (layerSel.indexOf(id) >= 0) layerSel = layerSel.filter((n) => n !== id);
      else {
        layerSel = layerSel.concat(id);
        selAnchor = id;
      }
      if (!selAnchor) selAnchor = id;
      syncPartsFromLayers(car);
      focusLayer(car, id);
      return;
    }
    layerSel = [id];
    selAnchor = id;
    syncPartsFromLayers(car);
    focusLayer(car, id);
    if (L && L.type === 'wheel') includeWheelPair(car, L.ref);
  }

  /** Пара оси в выбор, если включено зеркало лево↔право. */
  function includeWheelPair(car, i) {
    if (!mirrorWheels || !car || i == null || i < 0) return;
    const j = pairWheel(car, i);
    if (j < 0) return;
    if (wheelSel.indexOf(j) < 0) wheelSel = wheelSel.concat(j);
    const sid = stackIdOf(car, 'wheel', j);
    if (sid && layerSel.indexOf(sid) < 0) layerSel = layerSel.concat(sid);
  }

  /** Добирает пару к текущему колесу (вкл. зеркало). Не трогает выбор нитро. */
  function syncWheelPair() {
    if (lastFocus !== 'wheel') return;
    const car = typeof getCar === 'function' ? getCar() : null;
    const i = typeof getWheel === 'function' ? getWheel() : -1;
    includeWheelPair(car, i);
  }

  /** Снимает парное колесо с выбора, остальные слои оставляет. */
  function dropWheelPair() {
    if (lastFocus !== 'wheel') return;
    const car = typeof getCar === 'function' ? getCar() : null;
    const i = typeof getWheel === 'function' ? getWheel() : 0;
    const j = pairWheel(car, i);
    if (j < 0 || j === i) return;
    wheelSel = wheelSel.filter((n) => n !== j);
    const sid = car ? stackIdOf(car, 'wheel', j) : null;
    if (sid) layerSel = layerSel.filter((id) => id !== sid);
  }

  /** Диапазон индексов в списке колёс или труб. */
  function pickIndexRange(kind, i, add, range) {
    const car = getCar && getCar();
    if (!car) return;
    const list = kind === 'wheel' ? car.w : car.nitro;
    if (!list || i < 0 || i >= list.length) return;
    if (range) {
      let from = -1;
      const anchorL = (car.stack || []).find((x) => x.id === selAnchor);
      if (anchorL && anchorL.type === kind) from = anchorL.ref;
      else if (kind === 'wheel' && lastFocus === 'wheel') from = getWheel();
      else if (kind === 'nitro' && lastFocus === 'nitro') from = getNitro();
      if (from == null || from < 0) from = i;
      const lo = Math.min(from, i), hi = Math.max(from, i);
      const extra = [];
      for (let k = lo; k <= hi; k++) {
        const sid = stackIdOf(car, kind, k);
        if (sid) extra.push(sid);
      }
      layerSel = add ? uniqIds(layerSel.concat(extra)) : extra;
      syncPartsFromLayers(car);
      const sid = stackIdOf(car, kind, i);
      if (sid) focusLayer(car, sid);
      return;
    }
    const sid = stackIdOf(car, kind, i);
    if (sid) pickLayer(sid, add, false);
    else if (kind === 'wheel') {
      setWheel(i);
      lastFocus = 'wheel';
      if (!add) { nitroSel = []; wheelSel = [i]; }
    } else {
      setNitro(i);
      lastFocus = 'nitro';
      if (!add) { wheelSel = []; nitroSel = [i]; }
    }
  }

  /** Выбор колеса: Ctrl добавляет, Shift — диапазон в списке. */
  function pickWheel(i, add, range) {
    pickIndexRange('wheel', i, add, range);
  }

  /** Выбор трубы нитро: Ctrl добавляет, Shift — диапазон в списке. */
  function pickNitro(i, add, range) {
    pickIndexRange('nitro', i, add, range);
  }

  /** Снимает выбор слоёв, как клик по пустому в Photoshop. */
  function deselect() {
    layerSel = [];
    wheelSel = [];
    nitroSel = [];
    lastFocus = '';
    selAnchor = null;
  }

  /** Сбрасывает набор при смене машины. */
  function clearSel() {
    const car = typeof getCar === 'function' ? getCar() : null;
    const sid = car ? stackIdOf(car, 'wheel', 0) : null;
    layerSel = sid ? [sid] : [];
    wheelSel = [0];
    nitroSel = [];
    lastFocus = 'wheel';
    selAnchor = sid;
  }

  function hasLayer(name) { return layerSel.indexOf(name) >= 0; }
  function hasWheel(i) { return wheelSel.indexOf(i) >= 0; }
  function hasNitro(i) { return nitroSel.indexOf(i) >= 0; }
  function selectedLayers() { return layerSel.slice(); }
  function focusKind() { return lastFocus; }
  /** Тип инспектора: пусто, пока нет выбранного слоя. */
  function inspectorKind() {
    if (!layerSel.length) return '';
    if (lastFocus === 'nitro') return 'nitro';
    if (lastFocus === 'wheel') return 'wheel';
    if (lastFocus === 'armor') return 'armor';
    if (lastFocus === 'body') return 'body';
    const L = (typeof getCar === 'function' && getCar() && getCar().stack || []).find((x) => layerSel.indexOf(x.id) >= 0);
    if (L && L.type === 'nitro') return 'nitro';
    if (L && L.type === 'wheel') return 'wheel';
    if (L && L.type === 'armor') return 'armor';
    if (L && (L.type === 'body' || L.type === 'shadow' || L.type === 'guides')) return 'body';
    return '';
  }
  function selectedWheels() { return wheelSel.slice(); }
  function selectedNitro() { return nitroSel.slice(); }

  /** Попадание в диск колеса (с запасом, чтобы брать и под кузовом). */
  function hitOneWheel(p, w) {
    if (!w) return false;
    const {dw, dh} = wheelSize(w);
    const rad = Math.max(dw, dh, 8) * 0.62 + 4;
    return Math.hypot(p.x - w[0], p.y - w[1]) <= rad;
  }

  function hitOneNitro(p, n) {
    if (!n) return false;
    const x = n[0], y = n[1], len = n[2] || 8, half = Math.max(n[3] || 1.5, 1.2);
    const dx = Math.max(x - len, Math.min(p.x, x)) - p.x;
    const dy = p.y - y;
    return dx * dx + dy * dy <= (half + 4.5) * (half + 4.5);
  }

  /** Клик: среди колёс и нитро берём ближайший центр (нитро не перекрывается диском колеса). */
  function hitFront(p, car) {
    if (!car) return {kind: '', ref: -1};
    const on = (type, ref) => {
      if (typeof EditorData === 'undefined' || !EditorData.stackItemOn) return true;
      return EditorData.stackItemOn(car, type, ref);
    };
    let best = null, bestD = 1e9;
    (car.nitro || []).forEach((n, i) => {
      if (!on('nitro', i) || !hitOneNitro(p, n)) return;
      const d = Math.hypot(p.x - n[0], p.y - n[1]);
      if (d < bestD) { bestD = d; best = {kind: 'nitro', ref: i}; }
    });
    (car.w || []).forEach((w, i) => {
      if (!on('wheel', i) || !hitOneWheel(p, w)) return;
      const d = Math.hypot(p.x - w[0], p.y - w[1]);
      if (d < bestD) { bestD = d; best = {kind: 'wheel', ref: i}; }
    });
    if (best) return best;
    const armorL = (car.stack || []).find((L) => L.type === 'armor');
    const armorSel = !!(armorL && layerSel.indexOf(armorL.id) >= 0);
    const bodyHit = on('body') !== false && hitBody(p, car);
    const armorHit = on('armor') !== false && hitArmor(p, car);
    if (armorHit && (armorSel || !bodyHit)) return {kind: 'armor', ref: 0};
    if (bodyHit) return {kind: 'body', ref: 0};
    if (armorHit) return {kind: 'armor', ref: 0};
    return {kind: '', ref: -1};
  }

  function hoverWheel(p, car) {
    let best = -1, bestD = 1e9;
    (car.w || []).forEach((w, i) => {
      if (!hitOneWheel(p, w)) return;
      const d = Math.hypot(p.x - w[0], p.y - w[1]);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  function hoverNitro(p, car) {
    let best = -1, bestD = 1e9;
    (car.nitro || []).forEach((n, i) => {
      if (!hitOneNitro(p, n)) return;
      const d = Math.hypot(p.x - n[0], p.y - n[1]);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  /** Размер спрайта кузова в игровых единицах. */
  function bodyDrawSize(car) {
    const scale = car.body.scale || 1;
    const st = bodyStretch(car);
    const im = imgChain(bodySrcList(car, getIndex(), false));
    if (im && im.complete && im.naturalWidth) {
      const s = 60 / Math.max(im.naturalWidth, im.naturalHeight) * scale;
      return {w: im.naturalWidth * s * st.sx, h: im.naturalHeight * s * st.sy};
    }
    return {w: 60 * scale * st.sx, h: 32 * scale * st.sy};
  }

  /** Попадание в рамку кузова. */
  function hitBody(p, car) {
    const sz = bodyDrawSize(car);
    return Math.abs(p.x - car.body.x) < sz.w / 2 && Math.abs(p.y - car.body.y) < sz.h / 2;
  }

  /** Попадание в пластины брони (могут быть сдвинуты относительно кузова). */
  function hitArmor(p, car) {
    const sz = bodyDrawSize(car);
    const a = armorPos(car);
    return Math.abs(p.x - a.x) < sz.w / 2 && Math.abs(p.y - a.y) < sz.h / 2;
  }

  /** Завершает перетаскивание и сообщает о шаге правки. */
  function finishDrag() {
    const kind = drag && drag.type;
    const car = typeof getCar === 'function' ? getCar() : null;
    if (kind === 'move' && snap && car) snapPose(car);
    drag = null;
    unbindWinDrag();
    if (canvas) canvas.style.cursor = 'crosshair';
    if (kind === 'move' && typeof onDragEnd === 'function') onDragEnd();
  }

  /** Привязка жеста к окну: смена размера холста не рвёт захват мыши. */
  let winDragBound = false;
  function bindWinDrag() {
    if (winDragBound) return;
    winDragBound = true;
    window.addEventListener('pointermove', onWinDragMove);
    window.addEventListener('pointerup', onWinDragUp);
    window.addEventListener('pointercancel', onWinDragUp);
    window.addEventListener('keydown', onWinDragKey);
    window.addEventListener('keyup', onWinDragKey);
  }
  function unbindWinDrag() {
    if (!winDragBound) return;
    winDragBound = false;
    window.removeEventListener('pointermove', onWinDragMove);
    window.removeEventListener('pointerup', onWinDragUp);
    window.removeEventListener('pointercancel', onWinDragUp);
    window.removeEventListener('keydown', onWinDragKey);
    window.removeEventListener('keyup', onWinDragKey);
  }

  /** Сдвиг от точки нажатия; Shift режет ось в любой момент жеста. */
  function applyMoveFromDrag(shiftOn) {
    if (!drag || drag.type !== 'move' || !drag.last) return;
    const car = getCar();
    if (!car) return;
    let dx = drag.last.x - drag.px, dy = drag.last.y - drag.py;
    if (shiftOn) {
      if (!drag.axis && (Math.abs(dx) > 0.02 || Math.abs(dy) > 0.02)) {
        drag.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
      }
      if (drag.axis === 'x') dy = 0;
      else if (drag.axis === 'y') dx = 0;
    } else {
      drag.axis = null;
    }
    applyDelta(car, dx, dy, drag.pose);
    if (typeof onChange === 'function') onChange(false);
  }

  function onWinDragMove(e) {
    if (!drag) return;
    const car = getCar();
    if (!car) return;
    if (drag.type === 'pan') {
      cam.x = drag.cx - (e.clientX - drag.x) / Math.max(cam.z, 0.2);
      cam.y = drag.cy - (e.clientY - drag.y) / Math.max(cam.z, 0.2);
      return;
    }
    if (drag.type !== 'move') return;
    drag.last = toWorld(e);
    applyMoveFromDrag(e.shiftKey);
  }
  function onWinDragKey(e) {
    if (!drag || drag.type !== 'move') return;
    if (e.key !== 'Shift') return;
    applyMoveFromDrag(e.type === 'keydown');
  }
  function onWinDragUp() {
    finishDrag();
  }

  /** Клик по детали: набор, диапазон или сохранить группу. */
  function selectHit(car, hit, add, range) {
    const id = layerIdFromHit(car, hit);
    if (!id) return 'skip';
    const already = hitInGroup(car, hit);
    if (!add && !range && already) {
      focusLayer(car, id);
      return 'move';
    }
    const wasOn = layerSel.indexOf(id) >= 0;
    pickLayer(id, add, range);
    if (add && !range && wasOn && layerSel.indexOf(id) < 0) return 'skip';
    return 'move';
  }

  /** Сетка: после жеста координаты на шаг 0.5. */
  function snapPose(car) {
    const q = (v) => Math.round(v / 0.5) * 0.5;
    const t = moveSet(car);
    if (t.body && car.body) {
      car.body.x = q(car.body.x);
      car.body.y = q(car.body.y);
      if (!linkArmor) {
        car.body.ax = q(+car.body.ax || 0);
        car.body.ay = q(+car.body.ay || 0);
      }
    }
    if (t.armor && car.body) {
      car.body.ax = q(+car.body.ax || 0);
      car.body.ay = q(+car.body.ay || 0);
    }
    const doneSnap = {};
    (t.wheels || []).forEach((i) => {
      if (doneSnap[i]) return;
      const w = car.w && car.w[i];
      if (!w) return;
      w[0] = q(w[0]);
      w[1] = q(w[1]);
      doneSnap[i] = true;
      if (!mirrorWheels) return;
      const j = pairWheel(car, i);
      if (j < 0 || !car.w[j] || doneSnap[j]) return;
      car.w[j][0] = q(car.w[j][0]);
      car.w[j][1] = q(car.w[j][1]);
      doneSnap[j] = true;
    });
    (t.nitros || []).forEach((i) => {
      const n = car.nitro && car.nitro[i];
      if (!n) return;
      n[0] = q(n[0]);
      n[1] = q(n[1]);
    });
  }

  /** Ctrl+колёсико — высота, Alt+колёсико — ширина выбранного. */
  function scaleSelected(car, axis, factor) {
    if (!car) return;
    const t = moveSet(car);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    if (t.body || t.armor) {
      car.body.sx = +car.body.sx || 1;
      car.body.sy = +car.body.sy || 1;
      if (axis === 'x') car.body.sx = clamp(car.body.sx * factor, 0.15, 4);
      else car.body.sy = clamp(car.body.sy * factor, 0.15, 4);
    }
    const done = {};
    (t.wheels || []).forEach((i) => {
      const w = car.w && car.w[i];
      if (!w) return;
      if (axis === 'x') w[2] = clamp((+w[2] || 12) * factor, 0.4, 80);
      else w[3] = clamp((+w[3] || 8) * factor, 0.4, 80);
      done[i] = true;
      if (!mirrorWheels) return;
      const j = pairWheel(car, i);
      if (j < 0 || !car.w[j] || done[j]) return;
      car.w[j][2] = w[2];
      car.w[j][3] = w[3];
      done[j] = true;
    });
    (t.nitros || []).forEach((i) => {
      const n = car.nitro && car.nitro[i];
      if (!n) return;
      if (axis === 'x') n[2] = clamp((+n[2] || 8) * factor, 1, 80);
      else n[3] = clamp((+n[3] || 1.5) * factor, 0.3, 24);
    });
  }

  /** События мыши, колеса и клавиатуры холста. */
  function bind() {
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.button !== 1 && e.button !== 2) return;
      const p = toWorld(e);
      const car = getCar();
      if (!car) return;
      if (e.button === 1 || e.button === 2) {
        drag = {type: 'pan', x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y};
        bindWinDrag();
        return;
      }
      const add = e.ctrlKey || e.metaKey;
      const range = e.shiftKey;
      const hit = hitFront(p, car);
      const keepPart = (lastFocus === 'wheel' || lastFocus === 'nitro') && !add && !range;
      if (hit.kind === 'nitro' || hit.kind === 'wheel') {
        const act = selectHit(car, hit, add, range);
        if (act === 'move') {
          drag = {type: 'move', px: p.x, py: p.y, last: {x: p.x, y: p.y}, pose: capturePose(car)};
          bindWinDrag();
          canvas.style.cursor = 'move';
        }
        queueMicrotask(() => { if (typeof onSelect === 'function') onSelect(); });
        return;
      }
      if ((hit.kind === 'armor' || hit.kind === 'body') && keepPart && !hitInGroup(car, hit)) {
        drag = {type: 'pan', x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y};
        bindWinDrag();
        canvas.style.cursor = 'grabbing';
        return;
      }
      if (hit.kind === 'armor' || hit.kind === 'body') {
        const act = selectHit(car, hit, add, range);
        if (act === 'move') {
          drag = {type: 'move', px: p.x, py: p.y, last: {x: p.x, y: p.y}, pose: capturePose(car)};
          bindWinDrag();
          canvas.style.cursor = 'move';
        }
        queueMicrotask(() => { if (typeof onSelect === 'function') onSelect(); });
        return;
      }
      drag = {type: 'pan', x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y};
      bindWinDrag();
      canvas.style.cursor = 'grabbing';
      if (!add && !range) {
        deselect();
        queueMicrotask(() => { if (typeof onSelect === 'function') onSelect(); });
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (drag) return;
      const p = toWorld(e);
      const car = getCar();
      hoverW = hoverWheel(p, car);
      hoverN = hoverNitro(p, car);
      canvas.style.cursor = (hoverW >= 0 || hoverN >= 0 || hitBody(p, car) || hitArmor(p, car)) ? 'move' : 'crosshair';
      if (typeof onHover === 'function') onHover(p, hoverW, hoverN);
    });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const car = getCar();
      if (car && (e.ctrlKey || e.metaKey || e.altKey)) {
        const axis = e.altKey && !(e.ctrlKey || e.metaKey) ? 'x' : 'y';
        const factor = e.deltaY > 0 ? 0.94 : 1.065;
        scaleSelected(car, axis, factor);
        if (typeof onChange === 'function') onChange(true);
        return;
      }
      zoomBy(e.deltaY > 0 ? 0.9 : 1.11, e);
    }, {passive: false});
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.ctrlKey || e.metaKey) return;
      const car = getCar();
      const step = e.shiftKey ? 0.1 : 0.5;
      let dx = 0, dy = 0;
      if (e.key === 'ArrowLeft') dx = -step;
      if (e.key === 'ArrowRight') dx = step;
      if (e.key === 'ArrowUp') dy = -step;
      if (e.key === 'ArrowDown') dy = step;
      if (e.key === '+' || e.key === '=') { zoomBy(1.15); e.preventDefault(); return; }
      if (e.key === '-' || e.key === '_') { zoomBy(0.87); e.preventDefault(); return; }
      if (e.key === '0') { fit(); e.preventDefault(); return; }
      if (!dx && !dy) return;
      applyDelta(car, dx, dy, null);
      onChange(true);
      e.preventDefault();
    });
  }

  function setSnap(v) { snap = !!v; }
  function setMarks(v) { showMarks = !!v; draw(); }
  function marksOn() { return showMarks; }
  function setMirrorWheels(v) { mirrorWheels = !!v; }
  function setLinkArmor(v) { linkArmor = !!v; }
  function armorLinked() { return linkArmor; }
  function setPlay(v) { playing = !!v; }
  function setTest(v) { testing = !!v; if (v) playing = true; }
  function setYaw(v) { yaw = +v || 0; }
  function clearCache() { cache.clear(); shadowCache.clear(); }

  return {
    init, draw, fit, zoomBy, zoomLabel, resize, setSnap, setMarks, marksOn, setMirrorWheels, setLinkArmor, armorLinked, pairWheel, setPlay, setTest, setYaw, clearCache,
    pickLayer, pickWheel, pickNitro, hasLayer, hasWheel, hasNitro, selectedLayers, clearSel, deselect,
    focusKind, inspectorKind, selectedWheels, selectedNitro, cam, syncWheelPair, dropWheelPair
  };
})();
