////////////////////////////////////////////////////////
//
// Ввод карты: кисть деколей, трамплин заход/финиш, перетаскивание
//
////////////////////////////////////////////////////////
'use strict';

const MapInput = (() => {
  let st;

  /** Документ. */
  function doc() { return st.getDoc(); }

  /** Мир из события. */
  function worldOf(e) {
    const canvas = st.canvas, cam = st.cam;
    const r = canvas.getBoundingClientRect();
    const dpr = devicePixelRatio || 1;
    const sx = (e.clientX - r.left) * (canvas.width / Math.max(1, r.width));
    const sy = (e.clientY - r.top) * (canvas.height / Math.max(1, r.height));
    return {x: cam.x + (sx / dpr - canvas.width / dpr / 2) / cam.z, y: cam.y + (sy / dpr - canvas.height / dpr / 2) / cam.z};
  }

  /** Снап. */
  function snapP(x, y, skip) {
    return MapPreview.snapWorld(x, y, doc(), st.snapGrid, st.snapObj, skip);
  }

  /** Живая вкладка. */
  function live() {
    return st.canvas && !st.canvas.closest('[hidden]');
  }

  /** Радиус кисти. */
  function brushR() {
    return Math.max(28, 90 * st.brushScale);
  }

  /** Заливка или ластик. */
  function paintBrush(w, erase) {
    const t = doc();
    if (!t) return;
    const r = brushR();
    if (erase) {
      const n = t.decals.length;
      t.decals = t.decals.filter((d) => Math.hypot(d.x - w.x, d.y - w.y) > r * 0.72);
      if (t.decals.length !== n) st.onChange(false);
      st.brushLast = [w.x, w.y];
      return;
    }
    if (st.brushLast && Math.hypot(w.x - st.brushLast[0], w.y - st.brushLast[1]) < r * 0.55) return;
    const g = st.snapGrid ? MapPreview.CELL : (r * 0.7);
    const x = Math.round(w.x / g) * g, y = Math.round(w.y / g) * g;
    const id = st.canvas.dataset.decal || 'wreckage';
    if (t.decals.some((d) => d.id === id && Math.hypot(d.x - x, d.y - y) < r * 0.4)) {
      st.brushLast = [x, y];
      return;
    }
    t.decals.push({id, x, y, ang: (Math.random() - 0.5) * 0.7, scale: st.brushScale * (0.85 + Math.random() * 0.3)});
    st.brushLast = [x, y];
    st.onChange(false);
  }

  /** Новый маркер. */
  function addHazard(kind, w, extra) {
    const t = doc(), p = snapP(w.x, w.y);
    t.autoHazards = false;
    const key = {ramp: 'ramps', mine: 'mines', oil: 'oils', pad: 'pads'}[kind];
    if (!key) return;
    const rec = {x: p[0], y: p[1], lat: kind === 'mine' || kind === 'oil' ? 40 : 0, ang: (extra && extra.ang) || 0};
    if (kind === 'oil') rec.rot = rec.ang;
    if (extra && extra.tx != null) { rec.tx = extra.tx; rec.ty = extra.ty; }
    t.hazards[key].push(rec);
    st.sel = {kind, i: t.hazards[key].length - 1};
    st.onChange(true);
    st.onSelect(st.sel);
  }

  /** Попадание в точку сплайна. */
  function hitPoint(w, cps) {
    const r = 14 / st.cam.z;
    for (let i = 0; i < cps.length; i++) {
      if (Math.hypot(cps[i][0] - w.x, cps[i][1] - w.y) < r) return {kind: 'cp', i};
    }
    return null;
  }

  /** Попадание в маркер. */
  function hitMark(w, kind, list) {
    const r = 22 / st.cam.z;
    for (let i = 0; i < (list || []).length; i++) {
      if (Math.hypot(list[i].x - w.x, list[i].y - w.y) < r) return {kind, i};
    }
    return null;
  }

  /** Вставка точки на сегмент. */
  function insertNear(w) {
    const t = doc(), cps = t.cps, n = cps.length;
    let best = 1, bd = 1e18;
    for (let i = 0; i < n; i++) {
      const a = cps[i], b = cps[(i + 1) % n];
      const vx = b[0] - a[0], vy = b[1] - a[1], l2 = vx * vx + vy * vy || 1;
      let u = Math.max(0, Math.min(1, ((w.x - a[0]) * vx + (w.y - a[1]) * vy) / l2));
      const d = Math.hypot(w.x - (a[0] + vx * u), w.y - (a[1] + vy * u));
      if (d < bd) { bd = d; best = i + 1; }
    }
    t.cps.splice(best, 0, snapP(w.x, w.y));
    st.sel = {kind: 'cp', i: best};
    st.onChange(true);
    st.onSelect(st.sel);
  }

  /** Нажатие. */
  function onDown(e) {
    if (!live()) return;
    if (e.button === 1 || st.spacePan || st.tool === 'pan') {
      st.drag = {mode: 'pan', x: e.clientX, y: e.clientY, cx: st.cam.x, cy: st.cam.y};
      e.preventDefault();
      return;
    }
    const w = worldOf(e), t = doc();
    if (!t) return;
    t.items = t.items || [];
    t.objects = t.objects || [];
    if (e.button === 2 && st.tool === 'decal') {
      st.drag = {mode: 'brush', erase: true};
      paintBrush(w, true);
      e.preventDefault();
      return;
    }
    if (e.button !== 0 && !(e.button === 2 && st.tool === 'coll')) return;
    if (st.tool === 'coll') {
      const coll = MapColl.handleDown(e, w, t, st.sel, st.cam, st.tool);
      if (coll && coll.needPick) {
        const hit = MapGizmo.pick(w, t, st.cam);
        if (hit && hit.kind === 'asset') { st.sel = hit; st.onSelect(hit); }
        return;
      }
      if (coll && coll.drag) { st.drag = coll.drag; return; }
      if (coll && coll.changed) { st.onChange(true); return; }
      return;
    }
    const target = MapGizmo.resolve(t, st.sel);
    const giz = target ? MapGizmo.hit(w, st.cam, target) : null;
    if (giz === 'ok') {
      st.sel = null;
      st.onChange(true);
      if (st.onDragEnd) st.onDragEnd();
      st.onSelect(null);
      return;
    }
    if (giz === 'del') {
      if (st.removeSel) st.removeSel();
      return;
    }
    if (giz) {
      st.drag = MapGizmo.begin(giz, w, target);
      return;
    }
    if (st.tool === 'select') {
      const hit = MapGizmo.pick(w, t, st.cam);
      if (hit) {
        st.sel = hit;
        st.onSelect(hit);
        const next = MapGizmo.resolve(t, hit);
        if (next) st.drag = MapGizmo.begin('center', w, next);
      } else {
        st.sel = null;
        st.onSelect(null);
      }
      return;
    }
    if (st.tool === 'point') {
      const hit = hitPoint(w, t.cps);
      if (hit) { st.sel = hit; st.drag = {mode: 'cp', i: hit.i}; st.onSelect(st.sel); return; }
      if (e.shiftKey) { insertNear(w); return; }
      t.cps.push(snapP(w.x, w.y));
      st.sel = {kind: 'cp', i: t.cps.length - 1};
      st.onChange(true); st.onSelect(st.sel); return;
    }
    if (st.tool === 'decal') {
      st.drag = {mode: 'brush', erase: e.altKey};
      paintBrush(w, !!e.altKey);
      return;
    }
    if (st.tool === 'item') {
      const hit = hitMark(w, 'item', t.items);
      if (hit) {
        st.sel = hit;
        st.onSelect(st.sel); return;
      }
      const xy = snapP(w.x, w.y);
      t.items.push({type: st.canvas.dataset.item || 'money', x: xy[0], y: xy[1]});
      st.sel = {kind: 'item', i: t.items.length - 1};
      st.onChange(true); st.onSelect(st.sel); return;
    }
    if (st.tool === 'asset') {
      const hit = hitMark(w, 'asset', t.objects);
      if (hit) { st.sel = hit; st.onSelect(st.sel); return; }
      const def = MapAssets.current();
      if (!def) return;
      const xy = snapP(w.x, w.y);
      t.objects.push({
        pack: def.pack, id: def.id, x: xy[0], y: xy[1],
        w: def.w, h: def.h, ang: 0, layer: def.layer, lockRatio: def.lockRatio
      });
      st.sel = {kind: 'asset', i: t.objects.length - 1};
      st.onChange(true); st.onSelect(st.sel); return;
    }
    if (st.tool === 'ramp' || st.tool === 'mine' || st.tool === 'oil' || st.tool === 'pad') {
      const list = t.hazards[{ramp: 'ramps', mine: 'mines', oil: 'oils', pad: 'pads'}[st.tool]];
      const hit = hitMark(w, st.tool, list);
      if (hit) {
        st.sel = hit;
        st.onSelect(st.sel);
        return;
      }
      if (st.tool === 'ramp') {
        if (!st.rampStep) { st.rampStep = snapP(w.x, w.y); return; }
        const a = st.rampStep, b = snapP(w.x, w.y);
        addHazard('ramp', {x: a[0], y: a[1]}, {ang: Math.atan2(b[1] - a[1], b[0] - a[0]), tx: b[0], ty: b[1]});
        st.rampStep = null;
        return;
      }
      addHazard(st.tool, w);
      return;
    }
    if (st.tool === 'cut') {
      if (!st.cutStep) { st.cutStep = snapP(w.x, w.y); return; }
      t.shortcuts.push({name: 'СРЕЗ', bonus: 180, radius: 80, entry: st.cutStep, exit: snapP(w.x, w.y)});
      st.cutStep = null;
      st.sel = {kind: 'cut', i: t.shortcuts.length - 1};
      st.onChange(true); st.onSelect(st.sel);
    }
  }

  /** Движение. */
  function onMove(e) {
    if (!live()) return;
    const w = worldOf(e);
    if (st.onHover) st.onHover(w);
    st.hoverW = w;
    const t = doc();
    if (t && st.sel && !st.drag) {
      st.gizmoHover = MapGizmo.hit(w, st.cam, MapGizmo.resolve(t, st.sel));
    } else if (!st.drag) st.gizmoHover = null;
    if (!st.drag) return;
    const drag = st.drag, cam = st.cam;
    if (drag.mode === 'pan') {
      cam.x = drag.cx - (e.clientX - drag.x) / cam.z;
      cam.y = drag.cy - (e.clientY - drag.y) / cam.z;
      return;
    }
    if (drag.mode === 'brush') { paintBrush(w, !!drag.erase); return; }
    if (drag.mode === 'coll') { MapColl.drag(drag, w); st.onChange(false); return; }
    if (drag.mode === 'gizmo') {
      const target = MapGizmo.resolve(t, st.sel);
      MapGizmo.drag(drag, w, target);
      st.gizmoHover = drag.part;
      st.onChange(false);
      return;
    }
    if (drag.mode === 'cp') {
      t.cps[drag.i] = snapP(w.x, w.y, {kind: 'cp', i: drag.i});
      st.onChange(false);
    } else if (drag.mode === 'item') {
      const p = snapP(w.x + drag.ox, w.y + drag.oy, {kind: 'item', i: drag.i});
      t.items[drag.i].x = p[0]; t.items[drag.i].y = p[1];
      st.onChange(false);
    } else if (drag.mode === 'mark') {
      const key = {ramp: 'ramps', mine: 'mines', oil: 'oils', pad: 'pads'}[drag.kind];
      const rec = t.hazards[key][drag.i];
      const p = snapP(w.x + drag.ox, w.y + drag.oy, {kind: drag.kind, i: drag.i});
      if (rec.tx != null) { rec.tx += p[0] - rec.x; rec.ty += p[1] - rec.y; }
      rec.x = p[0]; rec.y = p[1];
      st.onChange(false);
    } else if (drag.mode === 'aim') {
      const rec = t.hazards.ramps[drag.i];
      rec.tx = w.x; rec.ty = w.y;
      rec.ang = Math.atan2(w.y - rec.y, w.x - rec.x);
      st.onChange(false);
    }
  }

  /** Отпускание. */
  function onUp() {
    if (st.drag && st.drag.mode !== 'pan' && st.onDragEnd) st.onDragEnd();
    st.drag = null;
    st.brushLast = null;
  }

  /** Зум, размер кисти, поворот. */
  function onWheel(e) {
    if (!live()) return;
    e.preventDefault();
    const t = doc();
    if (st.tool === 'decal' && e.shiftKey) {
      st.brushScale = Math.max(0.18, Math.min(2.4, st.brushScale * (e.deltaY > 0 ? 0.9 : 1.12)));
      return;
    }
    if (st.sel && t && st.sel.kind === 'start' && t.start && (e.shiftKey || e.altKey)) {
      t.start.ang = (t.start.ang || 0) + (e.deltaY > 0 ? 0.1 : -0.1);
      st.onChange(false);
      if (st.onDragEnd) st.onDragEnd();
      return;
    }
    if (st.sel && t && st.sel.kind === 'asset' && (e.shiftKey || e.altKey || e.ctrlKey)) {
      const rec = t.objects[st.sel.i];
      const def = rec && RnRObjects.defOf(rec);
      if (rec && def) {
        const k = e.deltaY > 0 ? 0.92 : 1.08;
        const lock = rec.lockRatio != null ? rec.lockRatio : def.lockRatio;
        if (e.altKey && !e.shiftKey) rec.h = Math.max(8, rec.h * k);
        else if (e.shiftKey && !e.altKey) rec.w = Math.max(8, rec.w * k);
        else {
          rec.w = Math.max(8, rec.w * k);
          rec.h = lock ? rec.w * ((def.h || 1) / (def.w || 1)) : Math.max(8, rec.h * k);
        }
        st.onChange(false);
        if (st.onSelect) st.onSelect(st.sel);
        return;
      }
    }
    if (st.sel && t && (e.shiftKey || e.altKey)) {
      const rec = st.sel.kind === 'ramp' ? t.hazards.ramps[st.sel.i]
        : st.sel.kind === 'pad' ? t.hazards.pads[st.sel.i]
        : st.sel.kind === 'oil' ? t.hazards.oils[st.sel.i] : null;
      if (rec) {
        rec.ang = (rec.ang || 0) + (e.deltaY > 0 ? 0.1 : -0.1);
        rec.rot = rec.ang;
        if (isFinite(+rec.tx)) {
          const len = Math.hypot(rec.tx - rec.x, rec.ty - rec.y) || 80;
          rec.tx = rec.x + Math.cos(rec.ang) * len;
          rec.ty = rec.y + Math.sin(rec.ang) * len;
        }
        st.onChange(false);
        if (st.onDragEnd) st.onDragEnd();
        return;
      }
    }
    const before = worldOf(e);
    st.cam.z = Math.max(st.ZMIN, Math.min(st.ZMAX, st.cam.z * (e.deltaY > 0 ? 0.9 : 1.12)));
    const after = worldOf(e);
    st.cam.x += before.x - after.x;
    st.cam.y += before.y - after.y;
    if (st.onZoom) st.onZoom(Math.round(st.cam.z * 100) + '%');
  }

  /** Подписка на холст. */
  function bind(state) {
    st = state;
    const canvas = st.canvas;
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    canvas.addEventListener('wheel', onWheel, {passive: false});
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => { if (live() && e.code === 'Space') st.spacePan = true; });
    window.addEventListener('keyup', (e) => { if (e.code === 'Space') st.spacePan = false; });
  }

  return {bind, brushR, worldOf};
})();
