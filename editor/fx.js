////////////////////////////////////////////////////////
//
// Нитро и броня на холсте лаборатории
//
////////////////////////////////////////////////////////
'use strict';

const EditorFx = (() => {
  /** Струя: основание у трубы, язык назад. live — мерцание как в гонке. */
  function jet(ctx, x, y, len, half, t, live) {
    const flick = live ? len + (0.55 + 0.45 * Math.sin(t * 0.018 + y * 3)) * len * 0.28 : len * 0.42;
    ctx.fillStyle = live ? '#35e0ff' : 'rgba(53,224,255,.55)';
    ctx.beginPath();
    ctx.moveTo(x, y - half);
    ctx.lineTo(x - flick, y);
    ctx.lineTo(x, y + half);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = live ? '#fff' : 'rgba(255,255,255,.7)';
    ctx.beginPath();
    ctx.moveTo(x, y - half * 0.4);
    ctx.lineTo(x - flick * 0.55, y);
    ctx.lineTo(x, y + half * 0.4);
    ctx.closePath();
    ctx.fill();
  }

  /** Все выходы нитро и рамка выбранных. only — одна труба. */
  function drawNitro(ctx, jets, opts) {
    const t = opts.time || 0;
    const live = !!opts.live;
    const sel = opts.sel | 0;
    const multi = opts.multi || [];
    const layerOn = !!opts.layerOn;
    (jets || []).forEach((p, i) => {
      if (opts.only != null && i !== opts.only) return;
      jet(ctx, p[0], p[1], p[2], p[3], t, live);
      const chosen = i === sel || multi.indexOf(i) >= 0 || layerOn;
      if (opts.marks === false) return;
      ctx.beginPath();
      ctx.arc(p[0], p[1], chosen ? 1.35 : 1.05, 0, Math.PI * 2);
      ctx.fillStyle = chosen ? '#35e0ff' : (i === opts.hover ? '#ffd23f' : '#ff8a3d');
      ctx.fill();
      ctx.fillStyle = '#eee8f4';
      ctx.font = '2.3px Arial';
      ctx.fillText('N' + (i + 1), p[0] + 1.4, p[1] - 1.3);
    });
  }

  /** Запасная броня, если файла слоя нет (07–09 и свои слоты). */
  function armorFallback(ctx, car, sz) {
    const lvl = car.body.armor | 0;
    if (lvl < 1) return;
    const x = car.body.x, y = car.body.y;
    const w = sz.w * (0.92 + lvl * 0.012);
    const h = sz.h * (0.88 + lvl * 0.01);
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(180,196,210,' + (0.14 + lvl * 0.04) + ')';
    ctx.strokeStyle = 'rgba(210,230,245,' + (0.45 + lvl * 0.07) + ')';
    ctx.lineWidth = 0.55 + lvl * 0.12;
    ctx.beginPath();
    ctx.rect(-w / 2, -h / 2, w, h);
    ctx.fill();
    ctx.stroke();
    for (let i = 0; i < lvl; i++) {
      ctx.fillStyle = 'rgba(90,110,128,.35)';
      ctx.fillRect(-w / 2 + 1.2, -h / 2 + 1.4 + i * (h - 2.8) / Math.max(lvl, 1), 3.2, Math.max(2, (h - 3) / lvl - 0.4));
    }
    ctx.restore();
  }

  /** Подпись уровня брони, чтобы смена тюнинга была сразу видна. */
  function armorBadge(ctx, car, sz) {
    const lvl = car.body.armor | 0;
    if (lvl < 1) return;
    ctx.fillStyle = '#ffd23f';
    ctx.font = '2.6px Arial';
    ctx.fillText('БРОНЯ ' + ['', 'I', 'II', 'III', 'IV', 'V', 'VI'][lvl], car.body.x - 8, car.body.y + sz.h / 2 + 3.4);
  }

  return {drawNitro, armorFallback, armorBadge};
})();
