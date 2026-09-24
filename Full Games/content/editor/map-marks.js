////////////////////////////////////////////////////////
//
// Графика объектов трассы: старт, трамплин, мина, масло, срез
//
////////////////////////////////////////////////////////
'use strict';

const MapMarks = (() => {
  const TAU = Math.PI * 2;

  /** Скруглённый прямоугольник. */
  function rr(ctx, x, y, w, h, r) {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }

  /** Стрелка вдоль локальной оси X. */
  function arrow(ctx, col) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(4, -10);
    ctx.lineTo(4, -4);
    ctx.lineTo(-16, -4);
    ctx.lineTo(-16, 4);
    ctx.lineTo(4, 4);
    ctx.lineTo(4, 10);
    ctx.closePath();
    ctx.fill();
  }

  /** Клетка старт/финиш: позиция и угол как у объекта. */
  function drawStart(ctx, gate, sel) {
    if (!gate) return;
    ctx.save();
    ctx.translate(gate.x, gate.y);
    ctx.rotate(gate.ang || 0);
    for (let cx = -24; cx < 24; cx += 12) {
      for (let cy = -96; cy < 96; cy += 12) {
        ctx.fillStyle = ((cx / 12 + cy / 12) & 1) ? '#eee' : '#15141a';
        ctx.fillRect(cx, cy, 12, 12);
      }
    }
    ctx.fillStyle = sel ? '#3d9eff' : '#e8c547';
    ctx.font = '700 16px Montserrat,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('СТАРТ', 0, -110);
    ctx.fillStyle = '#ededed';
    ctx.fillText('ФИНИШ', 0, 122);
    ctx.restore();
  }

  /** Трамплин: заход, доска, направление прыжка. */
  function drawRamp(ctx, p, on) {
    const ang = isFinite(+p.ang) ? +p.ang : 0;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(ang);
    for (let k = 1; k <= 3; k++) {
      ctx.save();
      ctx.translate(-28 * k, 0);
      ctx.fillStyle = 'rgba(125,249,255,' + (0.22 + k * 0.08) + ')';
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(4, -7);
      ctx.lineTo(4, -2);
      ctx.lineTo(-10, -2);
      ctx.lineTo(-10, 2);
      ctx.lineTo(4, 2);
      ctx.lineTo(4, 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 30, 44, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#8a6a3a';
    rr(ctx, -16, -40, 32, 80, 6);
    ctx.fill();
    ctx.fillStyle = '#c9a05a';
    rr(ctx, -12, -36, 24, 72, 4);
    ctx.fill();
    ctx.fillStyle = '#e8d9a0';
    ctx.fillRect(8, -36, 6, 72);
    arrow(ctx, 'rgba(125,249,255,.95)');
    ctx.strokeStyle = on ? '#3d9eff' : '#7df9ff';
    ctx.lineWidth = on ? 3 : 1.5;
    ctx.stroke();
    ctx.restore();
    if (!isFinite(+p.tx) || !isFinite(+p.ty)) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(125,249,255,.55)';
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.tx, p.ty);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#7df9ff';
    ctx.beginPath();
    ctx.arc(p.tx, p.ty, 8, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  /** Мина. */
  function drawMine(ctx, p, on, now) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = '#1c1a22';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = on ? '#3d9eff' : '#3a3644';
    ctx.lineWidth = 2.2;
    for (let k = 0; k < 4; k++) {
      const a = k * TAU / 4 + 0.4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8);
      ctx.lineTo(Math.cos(a) * 14, Math.sin(a) * 14);
      ctx.stroke();
    }
    if (((now || 0) * 0.0025 + p.x) % 1 < 0.5) {
      ctx.fillStyle = '#ff3d2e';
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /** Масляная лужа. */
  function drawOil(ctx, p, on) {
    const rot = isFinite(+p.rot) ? +p.rot : (p.ang || 0);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(rot);
    ctx.fillStyle = 'rgba(16,14,20,.88)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 32, 20, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(120,90,200,.22)';
    ctx.beginPath();
    ctx.ellipse(-4, -3, 16, 8, 0, 0, TAU);
    ctx.fill();
    if (on) {
      ctx.strokeStyle = '#3d9eff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 32, 20, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Нитро-пад. */
  function drawPad(ctx, p, on) {
    const ang = isFinite(+p.ang) ? +p.ang : 0;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(ang);
    ctx.fillStyle = 'rgba(53,224,255,.85)';
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(-18 + k * 14, -16);
      ctx.lineTo(-4 + k * 14, 0);
      ctx.lineTo(-18 + k * 14, 16);
      ctx.lineTo(-24 + k * 14, 16);
      ctx.lineTo(-10 + k * 14, 0);
      ctx.lineTo(-24 + k * 14, -16);
      ctx.closePath();
      ctx.fill();
    }
    if (on) {
      ctx.strokeStyle = '#3d9eff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Срез: вход, тоннель, выход. */
  function drawCut(ctx, s, on) {
    const e = s.entry, x = s.exit, r = s.radius || 80;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,157,46,.55)';
    ctx.fillStyle = 'rgba(255,157,46,.08)';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(e[0], e[1]);
    ctx.lineTo(x[0], x[1]);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(e[0], e[1], r, 0, TAU);
    ctx.stroke();
    ctx.fill();
    ctx.strokeStyle = on ? '#3d9eff' : 'rgba(88,255,107,.7)';
    ctx.fillStyle = 'rgba(88,255,107,.1)';
    ctx.beginPath();
    ctx.arc(x[0], x[1], r, 0, TAU);
    ctx.stroke();
    ctx.fill();
    ctx.fillStyle = '#ff9d2e';
    ctx.font = '700 12px Montserrat,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ВХОД', e[0], e[1] - r - 8);
    ctx.fillStyle = '#58ff6b';
    ctx.fillText('ВЫХОД', x[0], x[1] - r - 8);
    ctx.restore();
  }

  /** Все маркеры документа. */
  function drawAll(ctx, t, sel, now, cutStep) {
    drawStart(ctx, t.start, sel && sel.kind === 'start');
    (t.hazards.ramps || []).forEach((p, i) => drawRamp(ctx, p, sel && sel.kind === 'ramp' && sel.i === i));
    (t.hazards.mines || []).forEach((p, i) => drawMine(ctx, p, sel && sel.kind === 'mine' && sel.i === i, now));
    (t.hazards.oils || []).forEach((p, i) => drawOil(ctx, p, sel && sel.kind === 'oil' && sel.i === i));
    (t.hazards.pads || []).forEach((p, i) => drawPad(ctx, p, sel && sel.kind === 'pad' && sel.i === i));
    (t.shortcuts || []).forEach((s, i) => drawCut(ctx, s, sel && sel.kind === 'cut' && sel.i === i));
    if (cutStep) {
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cutStep[0], cutStep[1], 20, 0, TAU);
      ctx.stroke();
    }
  }

  return {drawAll, drawRamp, drawStart};
})();
