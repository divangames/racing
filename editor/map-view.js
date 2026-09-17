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
    try { drawScene(now); } catch (err) { console.error(err); }
  }

  /** Сцена карты: земля, петля, маркеры. */
  function drawScene(now) {
    const canvas = st.canvas, dpr = devicePixelRatio || 1;
    const cssW = canvas.width / dpr, cssH = canvas.height / dpr;
    const t = doc();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = (t && t.theme && t.theme.ground) || '#1a1a1a';
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.save();
    try {
    ctx.translate(cssW / 2, cssH / 2);
    ctx.scale(cam.z, cam.z);
    ctx.translate(-cam.x, -cam.y);
    const cell = MapPreview.CELL;
    const x0 = cam.x - cssW / 2 / cam.z, y0 = cam.y - cssH / 2 / cam.z;
    const x1 = cam.x + cssW / 2 / cam.z, y1 = cam.y + cssH / 2 / cam.z;
    if (t) MapPreview.fillGround(ctx, t, x0, y0, x1, y1);
    if (t && window.RnRObjects) RnRObjects.drawLayer(ctx, t.objects, 'underRoad', () => {});
    const gridStep = cell * cam.z;
    if (gridStep >= 6) {
      ctx.strokeStyle = st.snapGrid ? 'rgba(232,197,71,.22)' : 'rgba(0,0,0,.18)';
      ctx.lineWidth = 1 / cam.z;
      ctx.beginPath();
      for (let x = Math.floor(x0 / cell) * cell; x < x1; x += cell) { ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
      for (let y = Math.floor(y0 / cell) * cell; y < y1; y += cell) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
      ctx.stroke();
    }
    if (!t) { return; }
    const cheap = !!(st.drag && st.drag.mode === 'cp');
    const S = MapPreview.strokeRoad(ctx, null, t, { cheap: cheap });
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
    // Слой under означает «на трассе»: как и в заезде, он находится поверх
    // запечённого полотна дороги и деколей, но под машинами и маркерами.
    if (window.RnRObjects) RnRObjects.drawLayer(ctx, t.objects, 'under', () => {});
    t.cps.forEach((p, i) => {
      ctx.fillStyle = st.sel && st.sel.kind === 'cp' && st.sel.i === i ? '#3d9eff' : '#ededed';
      ctx.beginPath();
      ctx.arc(p[0], p[1], (st.sel && st.sel.kind === 'cp' && st.sel.i === i ? 10 : 7) / cam.z, 0, TAU);
      ctx.fill();
    });
    const lay = (typeof MapLayout !== 'undefined' && MapLayout.visible) ? MapLayout.visible(t, S || []) : null;
    const view = lay ? {
      start: t.start,
      hazards: { ramps: lay.ramps, mines: lay.mines, oils: lay.oils, pads: lay.pads },
      shortcuts: t.shortcuts
    } : t;
    MapMarks.drawAll(ctx, view, st.sel, now, st.cutStep);
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
    (lay ? lay.picks : (t.items || [])).forEach((p) => MapPreview.drawItem(ctx, p, cam.z));
    if (window.RnRObjects) RnRObjects.drawLayer(ctx, t.objects, 'over', () => {});
    if (st.sel && st.sel.kind === 'asset' && t.objects && t.objects[st.sel.i] && window.MapColl) {
      MapColl.draw(ctx, t.objects[st.sel.i], cam);
    } else if (st.tool === 'coll' && st.sel && st.sel.kind === 'asset' && t.objects) {
      MapColl.draw(ctx, t.objects[st.sel.i], cam);
    }
    MapGizmo.draw(ctx, cam, MapGizmo.resolve(t, st.sel), st.gizmoHover);
    MapPreview.drawWeather(ctx, t, x0, y0, x1, y1, now || performance.now());
    } finally { ctx.restore(); }
  }

  /** Нужен ли повтор кадра (погода или перетаскивание). */
  function needsLoop() {
    if (!mapLive()) return false;
    if (st.drag) return true;
    const t = doc();
    if (!t) return false;
    const wx = MapPreview.weatherId(t);
    if (!wx || wx === 'clear') return false;
    return !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /** Ставит кадр в очередь, не крутит цикл вхолостую. */
  function kick() {
    if (!raf) raf = requestAnimationFrame(tick);
  }

  /** Кадр, пока открыта карта. */
  function tick(now) {
    raf = 0;
    if (mapLive()) draw(now);
    if (needsLoop()) raf = requestAnimationFrame(tick);
  }

  /** Зум от кнопок панели. */
  function zoomBy(factor) {
    cam.z = Math.max(ZMIN, Math.min(ZMAX, cam.z * (factor || 1)));
    if (st.onZoom) st.onZoom(Math.round(cam.z * 100) + '%');
    kick();
  }

  /** Размер буфера. */
  function sync() {
    if (!st.canvas) return;
    const r = st.canvas.getBoundingClientRect();
    const d = devicePixelRatio || 1;
    const w = Math.max(1, Math.round(r.width * d));
    const h = Math.max(1, Math.round(r.height * d));
    const grew = (st.canvas.width < 8 && w >= 8) || (st.canvas.height < 8 && h >= 8);
    if (st.canvas.width !== w || st.canvas.height !== h) {
      st.canvas.width = w;
      st.canvas.height = h;
      if (grew) fit();
      else kick();
    }
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
    kick();
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
    kick();
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
    st.redraw = kick;
    MapInput.bind(st);
    window.addEventListener('resize', sync);
    if (typeof ResizeObserver !== 'undefined' && st.canvas.parentElement) {
      new ResizeObserver(sync).observe(st.canvas.parentElement);
    }
    RnRTracks.preloadDecals();
    sync();
    kick();
  }

  return {
    init, draw: kick, fit, sync, removeSel, zoomBy,
    center: () => ({x: cam.x, y: cam.y}),
    setTool: (v) => { st.tool = v; st.cutStep = null; st.rampStep = null; kick(); },
    tool: () => st.tool,
    setSnap: (v) => { st.snapGrid = !!v; kick(); },
    setSnapObj: (v) => { st.snapObj = !!v; },
    setDecal: (id) => { if (st.canvas) st.canvas.dataset.decal = id; },
    setItem: (id) => { if (st.canvas) st.canvas.dataset.item = id; },
    selection: () => st.sel,
    setSelection: (s) => { st.sel = s; kick(); },
    setSelectedAssetLayers: (layers) => {
      const t = doc(), sel = st.sel;
      if (!t || !sel || sel.kind !== 'asset' || !t.objects || !t.objects[sel.i]) return false;
      const object = t.objects[sel.i];
      object.roadLayer = layers && layers.roadLayer === 'under' ? 'under' : 'over';
      object.carLayer = layers && layers.carLayer === 'over' ? 'over' : 'under';
      object.layer = object.carLayer;
      st.onChange(true);
      st.onSelect(sel);
      kick();
      return true;
    },
    confirmSel: () => {
      if (!st.sel) return;
      st.sel = null;
      st.onChange(true);
      if (st.onDragEnd) st.onDragEnd();
      st.onSelect(null);
      kick();
    },
  };
})();
