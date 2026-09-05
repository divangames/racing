////////////////////////////////////////////////////////
//
// Редактор коллизии ассета: полигон в локали .oblab
//
////////////////////////////////////////////////////////
'use strict';

const MapColl = (() => {
  /** Экземпляр по выделению. */
  function instOf(t, sel) {
    if (!t || !sel || sel.kind !== 'asset') return null;
    return (t.objects || [])[sel.i] || null;
  }

  /** Рисует вершины полигона. */
  function draw(ctx, inst, cam) {
    const def = inst && RnRObjects.defOf(inst);
    if (!def) return;
    RnRObjects.drawCollision(ctx, inst);
    const poly = def.collision.poly || [];
    const sx = (inst.w || def.w) / (def.w || 1);
    const sy = (inst.h || def.h) / (def.h || 1);
    const c = Math.cos(inst.ang || 0), s = Math.sin(inst.ang || 0);
    poly.forEach((p) => {
      const lx = p[0] * sx, ly = p[1] * sy;
      const x = inst.x + lx * c - ly * s;
      const y = inst.y + lx * s + ly * c;
      ctx.fillStyle = '#ff3d2e';
      ctx.beginPath();
      ctx.arc(x, y, 6 / cam.z, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  /** Ближайшая вершина. */
  function hitVert(w, inst, cam) {
    const def = RnRObjects.defOf(inst);
    if (!def) return -1;
    const poly = def.collision.poly || [];
    const sx = (inst.w || def.w) / (def.w || 1);
    const sy = (inst.h || def.h) / (def.h || 1);
    const c = Math.cos(inst.ang || 0), s = Math.sin(inst.ang || 0);
    const r = 10 / cam.z;
    for (let i = 0; i < poly.length; i++) {
      const lx = poly[i][0] * sx, ly = poly[i][1] * sy;
      const x = inst.x + lx * c - ly * s;
      const y = inst.y + lx * s + ly * c;
      if (Math.hypot(x - w.x, y - w.y) < r) return i;
    }
    return -1;
  }

  /** Клик: вершина, новая точка или сброс ПКМ. */
  function handleDown(e, w, t, sel, cam, tool) {
    if (tool !== 'coll') return null;
    const inst = instOf(t, sel);
    if (!inst) return {needPick: true};
    const def = RnRObjects.defOf(inst);
    if (!def) return null;
    def.collision.poly = def.collision.poly || [];
    if (e.button === 2) {
      def.collision.poly.pop();
      return {changed: true};
    }
    const hit = hitVert(w, inst, cam);
    if (hit >= 0) return {drag: {mode: 'coll', i: hit, inst, def}};
    const L = RnRObjects.toLocal(inst, def, w.x, w.y);
    def.collision.poly.push([L.x, L.y]);
    return {changed: true};
  }

  /** Тянет вершину. */
  function drag(state, w) {
    if (!state || state.mode !== 'coll') return;
    const L = RnRObjects.toLocal(state.inst, state.def, w.x, w.y);
    state.def.collision.poly[state.i] = [L.x, L.y];
  }

  return {draw, handleDown, drag, instOf};
})();
