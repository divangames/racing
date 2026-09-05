////////////////////////////////////////////////////////
//
// Гизмо объекта: оси X/Y, свободный центр, кольцо поворота, галочка
//
////////////////////////////////////////////////////////
'use strict';

const MapGizmo = (() => {
  const TAU = Math.PI * 2;

  /** Цель по выделению документа. */
  function resolve(t, sel) {
    if (!t || !sel) return null;
    const k = sel.kind, i = sel.i;
    if (k === 'start') {
      const g = t.start;
      if (!g) return null;
      return {
        rot: true,
        get() { return {x: g.x, y: g.y, ang: g.ang || 0}; },
        setPos(x, y) { g.x = x; g.y = y; },
        setAng(ang) { g.ang = ang; }
      };
    }
    if (k === 'cp') {
      const p = t.cps[i];
      if (!p) return null;
      return {
        rot: false,
        get() { return {x: p[0], y: p[1], ang: 0}; },
        setPos(x, y) { p[0] = x; p[1] = y; },
        setAng() {}
      };
    }
    if (k === 'cut') {
      const s = t.shortcuts[i];
      if (!s) return null;
      return {
        rot: true,
        get() {
          return {x: (s.entry[0] + s.exit[0]) / 2, y: (s.entry[1] + s.exit[1]) / 2, ang: Math.atan2(s.exit[1] - s.entry[1], s.exit[0] - s.entry[0])};
        },
        setPos(x, y) {
          const g = this.get(), dx = x - g.x, dy = y - g.y;
          s.entry[0] += dx; s.entry[1] += dy;
          s.exit[0] += dx; s.exit[1] += dy;
        },
        setAng(ang) {
          const g = this.get(), c = Math.cos(ang - g.ang), sA = Math.sin(ang - g.ang);
          const spin = (p) => {
            const rx = p[0] - g.x, ry = p[1] - g.y;
            p[0] = g.x + rx * c - ry * sA;
            p[1] = g.y + rx * sA + ry * c;
          };
          spin(s.entry); spin(s.exit);
        }
      };
    }
    let rec = null;
    if (k === 'decal') rec = t.decals[i];
    else if (k === 'item') rec = t.items[i];
    else if (k === 'ramp') rec = t.hazards.ramps[i];
    else if (k === 'mine') rec = t.hazards.mines[i];
    else if (k === 'oil') rec = t.hazards.oils[i];
    else if (k === 'pad') rec = t.hazards.pads[i];
    else if (k === 'asset') rec = (t.objects || [])[i];
    if (!rec) return null;
    const scale = k === 'asset';
    return {
      rot: k !== 'item' && k !== 'mine',
      scale,
      get() { return {x: rec.x, y: rec.y, ang: rec.ang || rec.rot || 0, w: rec.w || 128, h: rec.h || 128}; },
      setPos(x, y) {
        const dx = x - rec.x, dy = y - rec.y;
        rec.x = x; rec.y = y;
        if (rec.tx != null) { rec.tx += dx; rec.ty += dy; }
      },
      setAng(ang) {
        rec.ang = ang;
        rec.rot = ang;
        if (rec.tx != null) {
          const len = Math.hypot(rec.tx - rec.x, rec.ty - rec.y) || 80;
          rec.tx = rec.x + Math.cos(ang) * len;
          rec.ty = rec.y + Math.sin(ang) * len;
        }
      }
    };
  }

  /** Размеры гизмо в мире (на экране почти постоянны). */
  function metrics(cam) {
    const u = 1 / Math.max(0.08, cam.z);
    return {len: 78 * u, rad: 52 * u, hub: 11 * u, thick: 7 * u, ok: 16 * u};
  }

  /** Точка галочки справа-сверху. */
  function okPos(g, m) {
    return {x: g.x + m.len * 0.72, y: g.y - m.len * 0.72};
  }

  /** Корзина рядом с галочкой. */
  function delPos(g, m) {
    return {x: g.x + m.len * 1.18, y: g.y - m.len * 0.72};
  }

  /** Расстояние до отрезка. */
  function distSeg(px, py, ax, ay, bx, by) {
    const vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy || 1;
    let t = ((px - ax) * vx + (py - ay) * vy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
  }

  /** Какая ручка под курсором. */
  function hit(w, cam, target) {
    if (!target || !w) return null;
    const g = target.get(), m = metrics(cam);
    const ok = okPos(g, m);
    if (Math.hypot(w.x - ok.x, w.y - ok.y) < m.ok) return 'ok';
    const trash = delPos(g, m);
    if (Math.hypot(w.x - trash.x, w.y - trash.y) < m.ok) return 'del';
    const d = Math.hypot(w.x - g.x, w.y - g.y);
    if (d < m.hub * 1.15) return 'center';
    const dx = distSeg(w.x, w.y, g.x, g.y, g.x + m.len, g.y);
    const dy = distSeg(w.x, w.y, g.x, g.y, g.x, g.y + m.len);
    if (dx < m.thick && dx <= dy) return 'x';
    if (dy < m.thick) return 'y';
    if (target.rot && Math.abs(d - m.rad) < m.thick) return 'rot';
    return null;
  }

  /** Рисует оси, кольцо и галочку. */
  function draw(ctx, cam, target, hover) {
    if (!target) return;
    const g = target.get(), m = metrics(cam), u = 1 / Math.max(0.08, cam.z);
    const on = (part) => hover === part;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (target.rot) {
      ctx.strokeStyle = on('rot') ? '#ffe08a' : 'rgba(232,197,71,.85)';
      ctx.lineWidth = 3.2 * u;
      ctx.beginPath();
      ctx.arc(g.x, g.y, m.rad, 0, TAU);
      ctx.stroke();
    }
    const axis = (toX, toY, col, part) => {
      ctx.strokeStyle = on(part) ? '#fff' : col;
      ctx.fillStyle = on(part) ? '#fff' : col;
      ctx.lineWidth = 3.4 * u;
      ctx.beginPath();
      ctx.moveTo(g.x, g.y);
      ctx.lineTo(toX, toY);
      ctx.stroke();
      const ang = Math.atan2(toY - g.y, toX - g.x);
      ctx.save();
      ctx.translate(toX, toY);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-14 * u, -7 * u);
      ctx.lineTo(-14 * u, 7 * u);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };
    axis(g.x + m.len, g.y, '#e24b4b', 'x');
    axis(g.x, g.y + m.len, '#3dff7a', 'y');
    ctx.fillStyle = on('center') ? '#fff' : '#f2f2f2';
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2 * u;
    ctx.beginPath();
    ctx.arc(g.x, g.y, m.hub, 0, TAU);
    ctx.fill();
    ctx.stroke();
    const ok = okPos(g, m);
    ctx.fillStyle = on('ok') ? '#7dff9a' : '#58ff6b';
    ctx.beginPath();
    ctx.arc(ok.x, ok.y, m.ok, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(10,16,12,.9)';
    ctx.lineWidth = 2.4 * u;
    ctx.beginPath();
    ctx.moveTo(ok.x - 7 * u, ok.y);
    ctx.lineTo(ok.x - 1.5 * u, ok.y + 6 * u);
    ctx.lineTo(ok.x + 8 * u, ok.y - 6 * u);
    ctx.stroke();
    const trash = delPos(g, m);
    ctx.fillStyle = on('del') ? '#ff6b5a' : '#c43c32';
    ctx.beginPath();
    ctx.arc(trash.x, trash.y, m.ok, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,240,236,.95)';
    ctx.lineWidth = 2 * u;
    const bx = trash.x, by = trash.y;
    ctx.beginPath();
    ctx.moveTo(bx - 6 * u, by - 5 * u);
    ctx.lineTo(bx + 6 * u, by - 5 * u);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx - 3.5 * u, by - 5 * u);
    ctx.lineTo(bx - 2 * u, by - 8 * u);
    ctx.lineTo(bx + 2 * u, by - 8 * u);
    ctx.lineTo(bx + 3.5 * u, by - 5 * u);
    ctx.stroke();
    ctx.strokeRect(bx - 5 * u, by - 4 * u, 10 * u, 10 * u);
    ctx.beginPath();
    ctx.moveTo(bx - 1.5 * u, by - 2 * u);
    ctx.lineTo(bx - 1.5 * u, by + 4 * u);
    ctx.moveTo(bx + 1.5 * u, by - 2 * u);
    ctx.lineTo(bx + 1.5 * u, by + 4 * u);
    ctx.stroke();
    ctx.restore();
  }

  /** Начинает жест гизмо. */
  function begin(part, w, target) {
    const g = target.get();
    return {
      mode: 'gizmo', part,
      ox: g.x - w.x, oy: g.y - w.y,
      sx: g.x, sy: g.y, sang: g.ang,
      a0: Math.atan2(w.y - g.y, w.x - g.x)
    };
  }

  /** Тянет объект гизмо. */
  function drag(drag, w, target) {
    if (!drag || !target) return;
    const g0x = drag.sx, g0y = drag.sy;
    if (drag.part === 'rot') {
      const a1 = Math.atan2(w.y - g0y, w.x - g0x);
      target.setAng(drag.sang + (a1 - drag.a0));
      return;
    }
    let x = w.x + drag.ox, y = w.y + drag.oy;
    if (drag.part === 'x') y = g0y;
    if (drag.part === 'y') x = g0x;
    target.setPos(x, y);
  }

  /** Выбор объекта под курсором. */
  function pick(w, t, cam) {
    if (!t || !w) return null;
    const r = 26 / cam.z;
    const near = (x, y, kind, i) => (Math.hypot(x - w.x, y - w.y) < r ? {kind, i, d: Math.hypot(x - w.x, y - w.y)} : null);
    let best = null;
    const consider = (h) => { if (h && (!best || h.d < best.d)) best = h; };
    if (t.start) {
      const g = t.start;
      const dx = w.x - g.x, dy = w.y - g.y;
      const c = Math.cos(-(g.ang || 0)), s = Math.sin(-(g.ang || 0));
      const lx = dx * c - dy * s, ly = dx * s + dy * c;
      if (Math.abs(lx) < 28 && Math.abs(ly) < 112) consider({kind: 'start', i: 0, d: Math.hypot(dx, dy)});
    }
    (t.objects || []).forEach((o, i) => {
      const hitR = Math.max(r, Math.min(o.w || 64, o.h || 64) * 0.42);
      const d = Math.hypot(o.x - w.x, o.y - w.y);
      if (d < hitR) consider({kind: 'asset', i, d});
    });
    (t.decals || []).forEach((d, i) => consider(near(d.x, d.y, 'decal', i)));
    (t.items || []).forEach((p, i) => consider(near(p.x, p.y, 'item', i)));
    ['ramps', 'mines', 'oils', 'pads'].forEach((key) => {
      const kind = {ramps: 'ramp', mines: 'mine', oils: 'oil', pads: 'pad'}[key];
      (t.hazards[key] || []).forEach((p, i) => consider(near(p.x, p.y, kind, i)));
    });
    (t.shortcuts || []).forEach((s, i) => {
      consider(near(s.entry[0], s.entry[1], 'cut', i));
      consider(near(s.exit[0], s.exit[1], 'cut', i));
    });
    (t.cps || []).forEach((p, i) => consider(near(p[0], p[1], 'cp', i)));
    return best ? {kind: best.kind, i: best.i} : null;
  }

  return {resolve, hit, draw, begin, drag, pick, metrics};
})();
