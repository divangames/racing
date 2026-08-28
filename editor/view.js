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
  let snap = false, yaw = 0, testSteer = 0, now = 0;
  let mirrorWheels = true;
  let showMarks = true;
  let layerSel = [], wheelSel = [], nitroSel = [], lastFocus = 'wheel';
  const cache = new Map();

  /** Подключает холст и колбэки приложения. */
  function init(opts) {
    canvas = opts.canvas;
    ctx = canvas.getContext('2d');
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
    fit();
    window.addEventListener('resize', resize);
    requestAnimationFrame(tick);
  }

  /** Кадр: вращение дисков, в тесте — руль и живое нитро. */
  function tick(t) {
    now = t;
    if (playing || testing) spin = t * (testing ? 0.045 : 0.012);
    testSteer = testing ? Math.sin(t * 0.003) * 0.55 : yaw;
    draw();
    requestAnimationFrame(tick);
  }

  /** Подгоняет плотность пикселей холста под экран. */
  function resize() {
    const r = canvas.getBoundingClientRect();
    const d = devicePixelRatio || 1;
    canvas.width = Math.max(1, r.width * d);
    canvas.height = Math.max(1, r.height * d);
    ctx.setTransform(d, 0, 0, d, 0, 0);
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
    const z = Math.min(r.width / b.w, r.height / b.h) * 0.9;
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

  /** Экран → мир (центр машины = 0,0). */
  function toWorld(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left - r.width / 2) / cam.z + cam.x,
      y: (e.clientY - r.top - r.height / 2) / cam.z + cam.y
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

  /** Слой включён. */
  function layerOn(car, name) {
    return !(car.visible && car.visible[name] === false);
  }

  /** Слой перекрыт кузовом или бронёй, которые рисуются позже. */
  function buriedUnder(layers, name, covers) {
    const i = layers.indexOf(name);
    if (i < 0) return false;
    return layers.slice(i + 1).some((n) => covers.indexOf(n) >= 0);
  }

  /** Рисует слой по имени. */
  function drawLayer(car, name) {
    if (name === 'shadow') drawShadow(car);
    else if (name === 'wheels') drawWheels(car);
    else if (name === 'nitro') drawNitro(car);
    else if (name === 'body') drawBody(car, false);
    else if (name === 'armor') drawArmor(car);
    else if (name === 'guides') drawGuides(car);
  }

  /** Рисует всю сцену. */
  function draw() {
    if (!canvas || !ctx) return;
    const r = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, r.width, r.height);
    ctx.save();
    ctx.translate(r.width / 2, r.height / 2);
    ctx.scale(cam.z, cam.z);
    ctx.translate(-cam.x, -cam.y);
    ctx.rotate(yaw);
    drawGrid();
    const car = getCar();
    if (!car) { ctx.restore(); return; }
    const layers = car.layers || EditorData.LAYERS;
    layers.forEach((name) => {
      if (!layerOn(car, name)) return;
      drawLayer(car, name);
    });
    const covers = ['body', 'armor'];
    if (layerOn(car, 'nitro') && (layerOn(car, 'body') || layerOn(car, 'armor')) && buriedUnder(layers, 'nitro', covers)) {
      ctx.save();
      ctx.globalAlpha = 0.7;
      drawNitro(car);
      ctx.restore();
    }
    if (layerOn(car, 'body') && !bodyReady()) {
      ctx.fillStyle = '#ffd23f';
      ctx.font = '4px Arial';
      ctx.fillText('Нет спрайта кузова', -22, 0);
    }
    ctx.restore();
  }

  /** Сетка при включённой привязке. */
  function drawGrid() {
    if (!snap) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(53,224,255,.14)';
    ctx.lineWidth = 1 / Math.max(cam.z, 1);
    const step = 5;
    for (let x = -90; x <= 90; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, -60);
      ctx.lineTo(x, 60);
      ctx.stroke();
    }
    for (let y = -60; y <= 60; y += step) {
      ctx.beginPath();
      ctx.moveTo(-90, y);
      ctx.lineTo(90, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Тень под машиной. */
  function drawShadow(car) {
    const s = car.body.scale || 1;
    ctx.fillStyle = 'rgba(0,0,0,.38)';
    ctx.beginPath();
    ctx.ellipse(car.body.x, car.body.y + 5 * s, 30 * s, 15 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Спрайт кузова в игровом масштабе. */
  function drawBody(car, armorOnly) {
    const im = imgChain(bodySrcList(car, getIndex(), armorOnly));
    if (!im || !im.complete || !im.naturalWidth) return false;
    const s = 60 / Math.max(im.naturalWidth, im.naturalHeight) * (car.body.scale || 1);
    ctx.save();
    ctx.translate(car.body.x, car.body.y);
    ctx.drawImage(im, -im.naturalWidth * s / 2, -im.naturalHeight * s / 2, im.naturalWidth * s, im.naturalHeight * s);
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
    const r = Math.max(0.55, 2.4 / Math.max(cam.z, 0.8));
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = selected ? '#35e0ff' : (hovered ? '#ffd23f' : '#fff4c8');
    ctx.fill();
    ctx.strokeStyle = '#111018';
    ctx.lineWidth = Math.max(0.2, 0.9 / Math.max(cam.z, 0.8));
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = '#111018';
    ctx.fill();
  }

  /** Колёса: спрайт, руль в тесте, рамка выбора. */
  function drawWheels(car) {
    if (car.stats && car.stats.hov && !(car.w && car.w.length)) {
      ctx.fillStyle = 'rgba(53,224,255,.18)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 32, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const sel = getWheel();
    (car.w || []).forEach((w, i) => {
      const {dw, dh} = wheelSize(w);
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
      if (showMarks && (i === sel || wheelSel.indexOf(i) >= 0 || layerSel.indexOf('wheels') >= 0)) {
        ctx.strokeStyle = i === sel ? '#35e0ff' : '#7af0ff';
        ctx.lineWidth = i === sel ? 0.7 : 0.45;
        ctx.strokeRect(-dw / 2, -dh / 2, dw, dh);
      }
      if (showMarks) drawWheelHub(i === sel || wheelSel.indexOf(i) >= 0, i === hoverW);
      ctx.restore();
    });
  }

  /** Выходы нитро: в тесте — живые струи. */
  function drawNitro(car) {
    EditorFx.drawNitro(ctx, car.nitro || [], {
      time: now,
      live: testing,
      sel: getNitro(),
      multi: nitroSel,
      layerOn: layerSel.indexOf('nitro') >= 0,
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
        ctx.font = '2.3px Arial';
        ctx.fillText(String(i + 1) + (w[6] ? '*' : ''), w[0] + 1.4, w[1] - 1.3);
      });
    }
    if (layerOn(car, 'body') || layerOn(car, 'armor')) {
      const sz = bodyDrawSize(car);
      const bodyOn = layerSel.indexOf('body') >= 0 || layerSel.indexOf('armor') >= 0;
      ctx.strokeStyle = bodyOn ? '#35e0ff' : '#ffd23f';
      ctx.lineWidth = bodyOn ? 0.7 : 0.45;
      ctx.strokeRect(car.body.x - sz.w / 2, car.body.y - sz.h / 2, sz.w, sz.h);
    }
    ctx.strokeStyle = 'rgba(53,224,255,.45)';
    ctx.beginPath();
    ctx.moveTo(-40, 0); ctx.lineTo(40, 0);
    ctx.moveTo(0, -26); ctx.lineTo(0, 26);
    ctx.stroke();
  }

  /** Что двигаем: кузов, колёса, трубы. */
  function moveSet(car) {
    const body = layerSel.indexOf('body') >= 0 || layerSel.indexOf('armor') >= 0 || layerSel.indexOf('shadow') >= 0;
    const allW = layerSel.indexOf('wheels') >= 0;
    const allN = layerSel.indexOf('nitro') >= 0;
    if (!layerSel.length) {
      if (lastFocus === 'body') return {body: true, wheels: [], nitros: []};
      if (lastFocus === 'nitro') {
        return {body: false, wheels: [], nitros: nitroSel.length ? nitroSel.slice() : [getNitro()]};
      }
      return {body: false, wheels: wheelSel.length > 1 ? wheelSel.slice() : [getWheel()], nitros: []};
    }
    return {
      body: body,
      wheels: allW ? (car.w || []).map((_, i) => i) : (wheelSel.length ? wheelSel.slice() : (lastFocus === 'wheel' ? [getWheel()] : [])),
      nitros: allN ? (car.nitro || []).map((_, i) => i) : (nitroSel.length ? nitroSel.slice() : (lastFocus === 'nitro' ? [getNitro()] : []))
    };
  }

  /** Пара на той же оси: близкий X и зеркальный Y, иначе сосед в раскладке 0–1, 2–3, 4–5. */
  function pairWheel(car, i) {
    const list = car && car.w;
    if (!list || i < 0 || !list[i]) return -1;
    const x = list[i][0], y = list[i][1];
    if (Math.abs(y) < 0.35) return -1;
    let best = -1, bestScore = 8;
    list.forEach((w, j) => {
      if (j === i || !w) return;
      if (y * w[1] >= 0) return;
      const dx = Math.abs(w[0] - x);
      const dy = Math.abs(w[1] + y);
      if (dx > 10 || dy > 5) return;
      const score = dx + dy;
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
    if (t.body) {
      car.body.x = (pose ? pose.body.x : car.body.x) + dx;
      car.body.y = (pose ? pose.body.y : car.body.y) + dy;
    }
    const moved = {};
    (t.wheels || []).forEach((i) => {
      const w = car.w[i];
      if (!w) return;
      w[0] = (pose ? pose.wheels[i][0] : w[0]) + dx;
      w[1] = (pose ? pose.wheels[i][1] : w[1]) + dy;
      moved[i] = true;
    });
    if (mirrorWheels && t.wheels && t.wheels.length) {
      t.wheels.forEach((i) => {
        const j = pairWheel(car, i);
        if (j < 0 || moved[j] || !car.w[j]) return;
        const pw = car.w[j];
        pw[0] = (pose ? pose.wheels[j][0] : pw[0]) + dx;
        pw[1] = (pose ? pose.wheels[j][1] : pw[1]) - dy;
        moved[j] = true;
      });
    }
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
      wheels: (car.w || []).map((w) => [w[0], w[1]]),
      nitro: (car.nitro || []).map((n) => [n[0], n[1]])
    };
  }

  /** Выбор слоя: Ctrl добавляет, иначе заменяет. */
  function pickLayer(name, add) {
    if (!add) {
      wheelSel = [];
      nitroSel = [];
      layerSel = layerSel.length === 1 && layerSel[0] === name ? [] : [name];
    } else if (layerSel.indexOf(name) >= 0) layerSel = layerSel.filter((n) => n !== name);
    else layerSel = layerSel.concat(name);
    if (layerSel.indexOf('body') >= 0 || layerSel.indexOf('armor') >= 0 || layerSel.indexOf('shadow') >= 0) lastFocus = 'body';
    if (layerSel.indexOf('wheels') >= 0) lastFocus = 'wheel';
    if (layerSel.indexOf('nitro') >= 0) lastFocus = 'nitro';
  }

  /** Выбор колеса: Ctrl добавляет в набор. */
  function pickWheel(i, add) {
    if (!add) layerSel = layerSel.filter((n) => n !== 'wheels');
    setWheel(i);
    lastFocus = 'wheel';
    if (!add) { wheelSel = [i]; return; }
    if (wheelSel.indexOf(i) >= 0) wheelSel = wheelSel.filter((n) => n !== i);
    else wheelSel = wheelSel.concat(i);
    if (!wheelSel.length) wheelSel = [i];
    else setWheel(wheelSel[wheelSel.length - 1]);
  }

  /** Выбор трубы нитро: Ctrl добавляет в набор. */
  function pickNitro(i, add) {
    if (!add) layerSel = layerSel.filter((n) => n !== 'nitro');
    setNitro(i);
    lastFocus = 'nitro';
    if (!add) { nitroSel = [i]; return; }
    if (nitroSel.indexOf(i) >= 0) nitroSel = nitroSel.filter((n) => n !== i);
    else nitroSel = nitroSel.concat(i);
    if (!nitroSel.length) nitroSel = [i];
    else setNitro(nitroSel[nitroSel.length - 1]);
  }

  /** Сбрасывает набор при смене машины. */
  function clearSel() {
    layerSel = [];
    wheelSel = [0];
    nitroSel = [0];
    lastFocus = 'wheel';
  }

  function hasLayer(name) { return layerSel.indexOf(name) >= 0; }
  function hasWheel(i) { return wheelSel.indexOf(i) >= 0; }
  function hasNitro(i) { return nitroSel.indexOf(i) >= 0; }
  function focusKind() { return lastFocus; }
  function selectedWheels() { return wheelSel.slice(); }
  function selectedNitro() { return nitroSel.slice(); }

  /** Попадание в колесо. */
  function hitWheel(p, car) {
    let best = -1, bestD = 5.5;
    (car.w || []).forEach((w, i) => {
      const d = Math.hypot(p.x - w[0], p.y - w[1]);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  /** Попадание в выход нитро. */
  function hitNitro(p, car) {
    let best = -1, bestD = 4.2;
    (car.nitro || []).forEach((n, i) => {
      const d = Math.hypot(p.x - n[0], p.y - n[1]);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  /** Размер спрайта кузова в игровых единицах. */
  function bodyDrawSize(car) {
    const scale = car.body.scale || 1;
    const im = imgChain(bodySrcList(car, getIndex(), false));
    if (im && im.complete && im.naturalWidth) {
      const s = 60 / Math.max(im.naturalWidth, im.naturalHeight) * scale;
      return {w: im.naturalWidth * s, h: im.naturalHeight * s};
    }
    return {w: 60 * scale, h: 32 * scale};
  }

  /** Попадание в рамку кузова. */
  function hitBody(p, car) {
    const sz = bodyDrawSize(car);
    return Math.abs(p.x - car.body.x) < sz.w / 2 && Math.abs(p.y - car.body.y) < sz.h / 2;
  }

  /** Завершает перетаскивание и сообщает о шаге правки. */
  function finishDrag() {
    const kind = drag && drag.type;
    drag = null;
    if (kind === 'move' && typeof onDragEnd === 'function') onDragEnd();
  }

  /** События мыши, колеса и клавиатуры холста. */
  function bind() {
    canvas.addEventListener('pointerdown', (e) => {
      const p = toWorld(e);
      const car = getCar();
      const nHit = (car.visible && car.visible.nitro === false) ? -1 : hitNitro(p, car);
      const wHit = (car.visible && car.visible.wheels === false) ? -1 : hitWheel(p, car);
      if (e.button === 1 || (e.shiftKey && e.button === 2)) {
        drag = {type: 'pan', x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y};
        canvas.setPointerCapture(e.pointerId);
        return;
      }
      const add = e.ctrlKey || e.metaKey;
      if (nHit >= 0) {
        pickNitro(nHit, add);
        onSelect();
        drag = {type: 'move', px: p.x, py: p.y, pose: capturePose(car)};
        canvas.setPointerCapture(e.pointerId);
        return;
      }
      if (wHit >= 0) {
        pickWheel(wHit, add);
        onSelect();
        drag = {type: 'move', px: p.x, py: p.y, pose: capturePose(car)};
        canvas.setPointerCapture(e.pointerId);
        return;
      }
      if (hitBody(p, car)) {
        if (!add && layerSel.indexOf('body') < 0 && layerSel.indexOf('armor') < 0) layerSel = [];
        lastFocus = 'body';
        drag = {type: 'move', px: p.x, py: p.y, pose: capturePose(car)};
        canvas.setPointerCapture(e.pointerId);
        onSelect();
        return;
      }
      if (layerSel.length && e.button === 0) {
        layerSel = [];
        onSelect();
      }
      drag = {type: 'pan', x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y};
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = toWorld(e);
      const car = getCar();
      hoverW = hitWheel(p, car);
      hoverN = hitNitro(p, car);
      if (!drag) {
        if (typeof onHover === 'function') onHover(p, hoverW, hoverN);
        return;
      }
      const fine = e.shiftKey ? 0.15 : 1;
      if (drag.type === 'pan') {
        cam.x = drag.cx - (e.clientX - drag.x) / cam.z;
        cam.y = drag.cy - (e.clientY - drag.y) / cam.z;
        return;
      }
      if (drag.type === 'move') {
        let dx = p.x - drag.px, dy = p.y - drag.py;
        if (snap) { dx = Math.round(dx * 2) / 2; dy = Math.round(dy * 2) / 2; }
        if (fine !== 1) { dx *= fine; dy *= fine; }
        applyDelta(car, dx, dy, drag.pose);
        onChange(false);
      }
    });
    canvas.addEventListener('pointerup', finishDrag);
    canvas.addEventListener('pointercancel', finishDrag);
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
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
  function setPlay(v) { playing = !!v; }
  function setTest(v) { testing = !!v; if (v) playing = true; }
  function setYaw(v) { yaw = +v || 0; }
  function clearCache() { cache.clear(); }

  return {
    init, draw, fit, zoomBy, zoomLabel, resize, setSnap, setMarks, marksOn, setMirrorWheels, pairWheel, setPlay, setTest, setYaw, clearCache,
    pickLayer, pickWheel, pickNitro, hasLayer, hasWheel, hasNitro, clearSel,
    focusKind, selectedWheels, selectedNitro, cam
  };
})();
