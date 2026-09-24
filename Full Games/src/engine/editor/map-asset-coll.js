////////////////////////////////////////////////////////
//
// Коллизия ассета: несколько боксов, вершины, масштаб, копия
//
////////////////////////////////////////////////////////
'use strict';

window.MapAssetColl = (() => {
  let sel = 0, drag = null, pointOn = false, selectedVert = null;
  const HANDLE_RADIUS = 7;
  const SELECTED_HANDLE_RADIUS = 9;
  const SCALE_HANDLE_SIZE = 7;

  ////////////////////////////////////////////////////////
  //
  // Данные
  //
  ////////////////////////////////////////////////////////

  /** Список тел, поднимает старый poly. */
  function bodies(def) {
    if (!def.collision) def.collision = {solid: true, bodies: [], poly: []};
    if (!Array.isArray(def.collision.bodies)) def.collision.bodies = [];
    if (!def.collision.bodies.length && def.collision.poly && def.collision.poly.length >= 3) {
      def.collision.bodies = [{poly: def.collision.poly.map((p) => [p[0], p[1]])}];
    }
    return def.collision.bodies;
  }

  /** Первый полигон для старых читателей. */
  function syncPoly(def) {
    const b = bodies(def)[0];
    def.collision.poly = b ? b.poly : [];
  }

  /** Прямоугольник вокруг точки. */
  function boxPoly(cx, cy, w, h) {
    const hw = w / 2, hh = h / 2;
    return [[cx - hw, cy - hh], [cx + hw, cy - hh], [cx + hw, cy + hh], [cx - hw, cy + hh]];
  }

  /** Рамка полигона. */
  function aabb(poly) {
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    poly.forEach((p) => {
      minx = Math.min(minx, p[0]); miny = Math.min(miny, p[1]);
      maxx = Math.max(maxx, p[0]); maxy = Math.max(maxy, p[1]);
    });
    return {minx, miny, maxx, maxy, cx: (minx + maxx) / 2, cy: (miny + maxy) / 2};
  }

  /** Точка в полигоне. */
  function inPoly(x, y, poly) {
    let ok = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-6) + xi)) ok = !ok;
    }
    return ok;
  }

  /** Ближайшее ребро для новой вершины. */
  function nearestEdge(L, poly, maxd) {
    let best = null;
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const a = poly[i], b = poly[(i + 1) % n];
      const vx = b[0] - a[0], vy = b[1] - a[1], len2 = vx * vx + vy * vy || 1;
      const t = Math.max(0.05, Math.min(0.95, ((L.x - a[0]) * vx + (L.y - a[1]) * vy) / len2));
      const px = a[0] + vx * t, py = a[1] + vy * t;
      const d = Math.hypot(L.x - px, L.y - py);
      if (d < maxd && (!best || d < best.d)) best = {i, px, py, d};
    }
    return best;
  }

  ////////////////////////////////////////////////////////
  //
  // Рисование
  //
  ////////////////////////////////////////////////////////

  /** Контуры и ручки. */
  function paint(ctx, def, scale) {
    const list = bodies(def);
    const editable = def.layer === 'over';
    const solid = editable && def.collision.solid;
    list.forEach((b, i) => {
      const on = i === sel;
      const lineColor = solid ? '#ff604f' : '#61e7f0';
      ctx.save();
      ctx.fillStyle = solid ? 'rgba(255,72,54,.12)' : 'rgba(97,231,240,.10)';
      ctx.beginPath();
      b.poly.forEach((p, k) => { if (k) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
      ctx.closePath();
      ctx.fill();
      // Тёмная подложка сохраняет контур читаемым на белых и светящихся картинках.
      ctx.lineWidth = (on ? 6 : 4) / scale;
      ctx.strokeStyle = 'rgba(2,6,10,.88)';
      ctx.setLineDash(on ? [] : [6 / scale, 5 / scale]);
      ctx.stroke();
      ctx.lineWidth = (on ? 2.8 : 2) / scale;
      ctx.strokeStyle = editable ? lineColor : 'rgba(160,160,170,.65)';
      ctx.setLineDash(on ? [] : [6 / scale, 5 / scale]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      if (!on || !editable) return;
      b.poly.forEach((p, vertexIndex) => {
        const chosen = selectedVert && selectedVert.bi === i && selectedVert.i === vertexIndex;
        const radius = (chosen ? SELECTED_HANDLE_RADIUS : HANDLE_RADIUS) / scale;
        ctx.fillStyle = 'rgba(2,6,10,.95)';
        ctx.beginPath();
        ctx.arc(p[0], p[1], radius + 2 / scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = chosen ? '#ff765f' : '#ffd23f';
        ctx.beginPath();
        ctx.arc(p[0], p[1], radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff7cf';
        ctx.lineWidth = 1.5 / scale;
        ctx.stroke();
      });
      const bb = aabb(b.poly);
      const hs = SCALE_HANDLE_SIZE / scale;
      [[bb.minx, bb.miny], [bb.maxx, bb.miny], [bb.maxx, bb.maxy], [bb.minx, bb.maxy]].forEach((h) => {
        ctx.fillStyle = 'rgba(2,6,10,.95)';
        ctx.fillRect(h[0] - hs - 2 / scale, h[1] - hs - 2 / scale, hs * 2 + 4 / scale, hs * 2 + 4 / scale);
        ctx.fillStyle = '#79dce6';
        ctx.fillRect(h[0] - hs, h[1] - hs, hs * 2, hs * 2);
        ctx.strokeStyle = '#e8fdff';
        ctx.lineWidth = 1.5 / scale;
        ctx.strokeRect(h[0] - hs, h[1] - hs, hs * 2, hs * 2);
      });
    });
  }

  ////////////////////////////////////////////////////////
  //
  // Ввод
  //
  ////////////////////////////////////////////////////////

  /** Клик: вершина, ручка, точка на ребре, перенос тела. */
  function onDown(e, def, L, scale) {
    const list = bodies(def);
    const r = 8 / scale;
    if (e.button === 2) {
      for (let i = 0; i < list.length; i++) {
        const poly = list[i].poly;
        for (let k = 0; k < poly.length; k++) {
          if (Math.hypot(poly[k][0] - L.x, poly[k][1] - L.y) < r && poly.length > 3) {
            poly.splice(k, 1); sel = i; selectedVert = null; syncPoly(def); return true;
          }
        }
      }
      return true;
    }
    for (let i = 0; i < list.length; i++) {
      const poly = list[i].poly;
      for (let k = 0; k < poly.length; k++) {
        if (Math.hypot(poly[k][0] - L.x, poly[k][1] - L.y) < r) {
          sel = i; selectedVert = {bi: i, i: k}; drag = {kind: 'vert', bi: i, i: k}; return true;
        }
      }
    }
    if (list[sel]) {
      const bb = aabb(list[sel].poly);
      const corners = [[bb.minx, bb.miny], [bb.maxx, bb.miny], [bb.maxx, bb.maxy], [bb.minx, bb.maxy]];
      for (let c = 0; c < 4; c++) {
        if (Math.hypot(corners[c][0] - L.x, corners[c][1] - L.y) < 10 / scale) {
          selectedVert = null;
          drag = {kind: 'scale', bi: sel, c, bb, start: list[sel].poly.map((p) => [p[0], p[1]])};
          return true;
        }
      }
    }
    if (pointOn || e.altKey) {
      const b = list[sel];
      if (b) {
        const edge = nearestEdge(L, b.poly, 14 / scale);
        if (edge) {
          b.poly.splice(edge.i + 1, 0, [edge.px, edge.py]);
          selectedVert = {bi: sel, i: edge.i + 1};
        }
        syncPoly(def);
      }
      return true;
    }
    for (let i = list.length - 1; i >= 0; i--) {
      if (inPoly(L.x, L.y, list[i].poly)) {
        sel = i;
        selectedVert = null;
        drag = {kind: 'move', bi: i, lx: L.x, ly: L.y};
        return true;
      }
    }
    return false;
  }

  /** Двойной клик вставляет вершину в ближайшее ребро выбранного бокса. */
  function onDoubleClick(def, L, scale) {
    const body = bodies(def)[sel];
    if (!body) return false;
    const edge = nearestEdge(L, body.poly, 18 / scale);
    if (!edge) return false;
    body.poly.splice(edge.i + 1, 0, [edge.px, edge.py]);
    selectedVert = {bi: sel, i: edge.i + 1};
    syncPoly(def);
    return true;
  }

  /** Удаляет выбранную вершину, но не ломает минимальный треугольник. */
  function removeSelectedVertex(def) {
    if (!selectedVert) return false;
    const body = bodies(def)[selectedVert.bi];
    if (!body || body.poly.length <= 3) return false;
    body.poly.splice(selectedVert.i, 1);
    selectedVert = null;
    syncPoly(def);
    return true;
  }

  /** Тяга вершины, тела или масштаба. */
  function onMove(L, def) {
    if (!drag) return false;
    const b = bodies(def)[drag.bi];
    if (!b) return false;
    if (drag.kind === 'vert') b.poly[drag.i] = [L.x, L.y];
    if (drag.kind === 'move') {
      const dx = L.x - drag.lx, dy = L.y - drag.ly;
      b.poly.forEach((p) => { p[0] += dx; p[1] += dy; });
      drag.lx = L.x; drag.ly = L.y;
    }
    if (drag.kind === 'scale') {
      const bb = drag.bb, cx = bb.cx, cy = bb.cy;
      let sx = 1, sy = 1;
      if (drag.c === 1 || drag.c === 2) sx = (L.x - cx) / Math.max(8, bb.maxx - cx);
      else sx = (cx - L.x) / Math.max(8, cx - bb.minx);
      if (drag.c === 2 || drag.c === 3) sy = (L.y - cy) / Math.max(8, bb.maxy - cy);
      else sy = (cy - L.y) / Math.max(8, cy - bb.miny);
      sx = Math.max(0.12, Math.min(8, sx));
      sy = Math.max(0.12, Math.min(8, sy));
      b.poly = drag.start.map((p) => [cx + (p[0] - cx) * sx, cy + (p[1] - cy) * sy]);
    }
    syncPoly(def);
    return true;
  }

  ////////////////////////////////////////////////////////
  //
  // Команды
  //
  ////////////////////////////////////////////////////////

  /** Новый бокс со смещением. */
  function addBox(def, iw, ih) {
    const n = bodies(def).length;
    const ox = (n % 3) * 22 - 22, oy = Math.floor(n / 3) * 22;
    def.collision.bodies.push({poly: boxPoly(ox, oy, Math.min(iw * 0.55, 96), Math.min(ih * 0.55, 96))});
    sel = def.collision.bodies.length - 1;
    syncPoly(def);
  }

  /** Копия выбранного тела. */
  function copy(def) {
    const b = bodies(def)[sel];
    if (!b) return;
    def.collision.bodies.push({poly: b.poly.map((p) => [p[0] + 18, p[1] + 18])});
    sel = def.collision.bodies.length - 1;
    syncPoly(def);
  }

  /** Удалить выбранный бокс. */
  function remove(def) {
    const list = bodies(def);
    if (!list.length) return;
    list.splice(sel, 1);
    sel = Math.max(0, list.length - 1);
    selectedVert = null;
    syncPoly(def);
  }

  /** Снять все тела. */
  function clear(def) {
    def.collision.bodies = [];
    def.collision.poly = [];
    sel = 0;
    selectedVert = null;
  }

  /** Режим вставки вершины. */
  function setPoint(on) { pointOn = !!on; }

  /** Состояние выбора для подсказки редактора. */
  function state(def) {
    const list = bodies(def);
    return {
      bodyCount: list.length,
      selectedBody: list.length ? Math.min(sel, list.length - 1) : -1,
      selectedVertex: selectedVert ? selectedVert.i : -1,
      pointOn
    };
  }

  /** Сброс при открытии окна. */
  function reset() { sel = 0; drag = null; pointOn = false; selectedVert = null; }

  return {
    bodies, paint, onDown, onDoubleClick, onMove, removeSelectedVertex, endDrag: () => { drag = null; },
    addBox, copy, remove, clear, setPoint, pointOn: () => pointOn, state, reset, syncPoly
  };
})();
