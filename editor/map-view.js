////////////////////////////////////////////////////////
//
// Холст редактора трассы: камера, сплайн, живой кадр
//
////////////////////////////////////////////////////////
'use strict';

const MapView = (() => {
  const TAU = Math.PI * 2, ZMIN = 0.08, ZMAX = 4;
  const cam = {x: 1600, y: 1000, z: 0.28};
  const st = {
    TAU, ZMIN, ZMAX, cam,
    tool: 'select', snapGrid: true, snapObj: true, drag: null, sel: null,
    cutStep: null, rampStep: null, spacePan: false, brushScale: 0.48, brushLast: null, hoverW: null, gizmoHover: null,
    canvas: null, getDoc: null, onChange: () => {}, onSelect: () => {}, onHover: null, onZoom: null, onDragEnd: null
  };
  let ctx, images = Object.create(null), raf = 0;

  /** Catmull-Rom как в игре. */
  function cr(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t;
    return [
      0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
      0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
    ];
  }

  /** Плотная полилиния петли. */
  function sample(cps) {
    const n = cps.length, raw = [], SUB = Math.max(8, Math.ceil(48 / Math.max(1, n)));
    if (n < 2) return raw;
    for (let i = 0; i < n; i++) {
      const p0 = cps[(i + n - 1) % n], p1 = cps[i], p2 = cps[(i + 1) % n], p3 = cps[(i + 2) % n];
      for (let j = 0; j < SUB; j++) raw.push(cr(p0, p1, p2, p3, j / SUB));
    }
    return raw;
  }

  /** Документ. */
  function doc() { return st.getDoc(); }

  /** Картинка деколи. */
  function imgOf(id, src) {
    const key = src || id;
    if (images[key]) return images[key];
    const spec = RnRTracks.DECALS.find((d) => d.id === id);
    const url = src || (spec && spec.src);
    if (!url) return null;
    const im = new Image();
    im.src = url;
    images[key] = im;
    return im;
  }

  /** Холст карты на экране. */
  function mapLive() {
    return st.canvas && !st.canvas.closest('[hidden]');
  }

  /** Живой кадр мира. */
  function draw(now) {
    if (!st.canvas || !ctx) return;
    const canvas = st.canvas, dpr = devicePixelRatio || 1;
    const cssW = canvas.width / dpr, cssH = canvas.height / dpr;
    const t = doc();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = (t && t.theme && t.theme.ground) || '#1a1a1a';
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.save();
    ctx.translate(cssW / 2, cssH / 2);
    ctx.scale(cam.z, cam.z);
    ctx.translate(-cam.x, -cam.y);
    const cell = MapPreview.CELL;
    const x0 = cam.x - cssW / 2 / cam.z, y0 = cam.y - cssH / 2 / cam.z;
    const x1 = cam.x + cssW / 2 / cam.z, y1 = cam.y + cssH / 2 / cam.z;
    if (t) MapPreview.fillGround(ctx, t, x0, y0, x1, y1);
    if (t && window.RnRObjects) RnRObjects.drawLayer(ctx, t.objects, 'under', () => {});
    ctx.strokeStyle = st.snapGrid ? 'rgba(232,197,71,.22)' : 'rgba(0,0,0,.18)';
    ctx.lineWidth = 1 / cam.z;
    ctx.beginPath();
    for (let x = Math.floor(x0 / cell) * cell; x < x1; x += cell) { ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
    for (let y = Math.floor(y0 / cell) * cell; y < y1; y += cell) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
    ctx.stroke();
    if (!t) { ctx.restore(); return; }
    (t.decals || []).forEach((d) => {
      const im = imgOf(d.id, d.src);
      if (!im || !im.complete || !im.naturalWidth) return;
      const w = im.naturalWidth * d.scale, h = im.naturalHeight * d.scale;
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.ang || 0);
      ctx.globalAlpha = 0.9;
      ctx.drawImage(im, -w / 2, -h / 2, w, h);
      ctx.restore();
    });
    MapPreview.strokeRoad(ctx, sample(t.cps), t);
    t.cps.forEach((p, i) => {
      ctx.fillStyle = st.sel && st.sel.kind === 'cp' && st.sel.i === i ? '#3d9eff' : '#ededed';
      ctx.beginPath();
      ctx.arc(p[0], p[1], (st.sel && st.sel.kind === 'cp' && st.sel.i === i ? 10 : 7) / cam.z, 0, TAU);
      ctx.fill();
    });
    MapMarks.drawAll(ctx, t, st.sel, now, st.cutStep);
    if (st.rampStep && st.hoverW) {
      MapMarks.drawRamp(ctx, {
        x: st.rampStep[0], y: st.rampStep[1],
        ang: Math.atan2(st.hoverW.y - st.rampStep[1], st.hoverW.x - st.rampStep[0]),
        tx: st.hoverW.x, ty: st.hoverW.y
      }, true);
    }
    if (st.tool === 'decal' && st.hoverW) {
      ctx.strokeStyle = st.drag && st.drag.erase ? 'rgba(255,61,46,.85)' : 'rgba(61,158,255,.8)';
      ctx.lineWidth = 2 / cam.z;
      ctx.setLineDash([6 / cam.z, 6 / cam.z]);
      ctx.beginPath();
      ctx.arc(st.hoverW.x, st.hoverW.y, MapInput.brushR(), 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    (t.items || []).forEach((p) => MapPreview.drawItem(ctx, p, cam.z));
    if (window.RnRObjects) RnRObjects.drawLayer(ctx, t.objects, 'over', () => {});
    if (st.sel && st.sel.kind === 'asset' && t.objects && t.objects[st.sel.i] && window.MapColl) {
      MapColl.draw(ctx, t.objects[st.sel.i], cam);
    } else if (st.tool === 'coll' && st.sel && st.sel.kind === 'asset' && t.objects) {
      MapColl.draw(ctx, t.objects[st.sel.i], cam);
    }
    MapGizmo.draw(ctx, cam, MapGizmo.resolve(t, st.sel), st.gizmoHover);
    MapPreview.drawWeather(ctx, t, x0, y0, x1, y1, now || performance.now());
    ctx.restore();
  }

  /** Кадр, пока открыта карта. */
  function tick(now) {
    raf = requestAnimationFrame(tick);
    if (mapLive()) draw(now);
  }

  /** Размер буфера. */
  function sync() {
    if (!st.canvas) return;
    const r = st.canvas.getBoundingClientRect();
    const d = devicePixelRatio || 1;
    const w = Math.max(1, Math.round(r.width * d));
    const h = Math.max(1, Math.round(r.height * d));
    if (st.canvas.width !== w || st.canvas.height !== h) { st.canvas.width = w; st.canvas.height = h; }
  }

  /** Вписать петлю. */
  function fit() {
    const t = doc();
    if (!t || !t.cps.length || !st.canvas) return;
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    t.cps.forEach((p) => { minx = Math.min(minx, p[0]); miny = Math.min(miny, p[1]); maxx = Math.max(maxx, p[0]); maxy = Math.max(maxy, p[1]); });
    const r = st.canvas.getBoundingClientRect();
    const pad = 80;
    cam.x = (minx + maxx) / 2;
    cam.y = (miny + maxy) / 2;
    cam.z = Math.max(ZMIN, Math.min(1.2, Math.min((r.width - pad) / Math.max(1, maxx - minx), (r.height - pad) / Math.max(1, maxy - miny))));
    if (st.onZoom) st.onZoom(Math.round(cam.z * 100) + '%');
  }

  /** Удаляет выбранное. */
  function removeSel() {
    const t = doc();
    if (!t || !st.sel) return;
    const s = st.sel;
    if (s.kind === 'cp' && t.cps.length > 4) t.cps.splice(s.i, 1);
    else if (s.kind === 'decal') t.decals.splice(s.i, 1);
    else if (s.kind === 'item') t.items.splice(s.i, 1);
    else if (s.kind === 'ramp') t.hazards.ramps.splice(s.i, 1);
    else if (s.kind === 'mine') t.hazards.mines.splice(s.i, 1);
    else if (s.kind === 'oil') t.hazards.oils.splice(s.i, 1);
    else if (s.kind === 'pad') t.hazards.pads.splice(s.i, 1);
    else if (s.kind === 'cut') t.shortcuts.splice(s.i, 1);
    else if (s.kind === 'asset') t.objects.splice(s.i, 1);
    else if (s.kind === 'start') t.start = null;
    else return;
    st.sel = null;
    st.onChange(true);
    st.onSelect(null);
  }

  /** Подключение холста. */
  function init(opts) {
    st.canvas = opts.canvas;
    ctx = st.canvas.getContext('2d', {alpha: false});
    st.getDoc = opts.getDoc;
    st.onChange = opts.onChange || (() => {});
    st.onSelect = opts.onSelect || (() => {});
    st.onHover = opts.onHover;
    st.onZoom = opts.onZoom;
    st.onDragEnd = opts.onDragEnd;
    st.removeSel = removeSel;
    MapInput.bind(st);
    window.addEventListener('resize', sync);
    if (typeof ResizeObserver !== 'undefined' && st.canvas.parentElement) {
      new ResizeObserver(sync).observe(st.canvas.parentElement);
    }
    RnRTracks.preloadDecals();
    sync();
    if (!raf) raf = requestAnimationFrame(tick);
  }

  return {
    init, draw, fit, sync, removeSel,
    center: () => ({x: cam.x, y: cam.y}),
    setTool: (v) => { st.tool = v; st.cutStep = null; st.rampStep = null; },
    tool: () => st.tool,
    setSnap: (v) => { st.snapGrid = !!v; },
    setSnapObj: (v) => { st.snapObj = !!v; },
    setDecal: (id) => { if (st.canvas) st.canvas.dataset.decal = id; },
    setItem: (id) => { if (st.canvas) st.canvas.dataset.item = id; },
    selection: () => st.sel,
    setSelection: (s) => { st.sel = s; },
    confirmSel: () => {
      if (!st.sel) return;
      st.sel = null;
      st.onChange(true);
      if (st.onDragEnd) st.onDragEnd();
      st.onSelect(null);
    },
  };
})();
