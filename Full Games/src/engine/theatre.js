////////////////////////////////////////////////////////
//
// DiVANEngine: фон театра, диагонали трофеев, тост эфира.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /** Сдвиг диагоналей достижений. */
  const ACH_STRIPE = { period: 38, band: 9 };

  /**
   * Ширина карточки эфира.
   * @param {number} viewWidth
   * @param {boolean} big
   * @returns {number}
   */
  function toastMaxW(viewWidth, big) {
    return Math.min(big ? 560 : 500, Math.max(300, viewWidth - 380));
  }

  /**
   * Фон экранов результатов и карьеры.
   */
  function drawTheatreBackEngine() {
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1c1828'); bg.addColorStop(.5, '#0c0a12'); bg.addColorStop(1, '#050409');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.save(); g.globalAlpha = .04; g.fillStyle = '#ff9d2e';
    for (let x = -90; x < W + 90; x += 58) {
      g.save(); g.translate(x, -24); g.rotate(-.52); g.fillRect(0, 0, 16, H + 140); g.restore();
    }
    g.restore();
  }

  /**
   * Фон достижений: плотные диагонали, тихий бесконечный сдвиг.
   */
  function drawAchievementsBackEngine() {
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1a1424'); bg.addColorStop(.5, '#0a0812'); bg.addColorStop(1, '#050409');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const period = ACH_STRIPE.period, band = ACH_STRIPE.band;
    const shift = reduce ? 0 : ((gt * 16) % period);
    g.save();
    g.beginPath(); g.rect(0, 0, W, H); g.clip();
    g.globalAlpha = .055;
    g.fillStyle = '#e8a23a';
    for (let x = -H - period; x < W + H + period; x += period) {
      g.save();
      g.translate(x + shift, -48);
      g.rotate(-.52);
      g.fillRect(0, 0, band, H + 240);
      g.restore();
    }
    g.restore();
    const vg = g.createRadialGradient(W / 2, H * .38, 60, W / 2, H * .52, H * .9);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(3,2,8,.55)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
  }

  /**
   * Тост комментатора: перенос, клип, ширина по тексту.
   * @param {CanvasRenderingContext2D} c
   * @param {{txt:string,t:number,big?:boolean}|null} msg
   * @param {number} cx
   * @param {number} top
   * @param {number} viewWidth
   */
  function drawAnnounceToastEngine(c, msg, cx, top, viewWidth) {
    if (!msg || !msg.txt) return;
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const a = reduce ? 1 : (msg.t < .25 ? msg.t / .25 : msg.t > 2.9 ? clamp((3.4 - msg.t) / .5, 0, 1) : 1);
    if (a <= 0) return;
    const big = !!msg.big;
    const size = big ? 18 : 15;
    const lineH = big ? 22 : 19;
    const labelH = 14;
    const padX = 28;
    const padY = 14;
    const maxW = toastMaxW(viewWidth, big);
    const inner = Math.max(140, maxW - padX * 2 - 8);
    const raw = layoutLines(c, msg.txt, inner, size, F_D);
    const shown = raw.slice(0, 3);
    if (raw.length > 3) {
      let last = shown[2];
      while (last.length > 1 && c.measureText(last + '…').width > inner) last = last.slice(0, -1);
      shown[2] = last + '…';
    }
    const textW = shown.reduce(function (m, l) { return Math.max(m, c.measureText(l).width); }, 0);
    const w = clamp(textW + padX * 2 + 8, 220, maxW);
    const h = padY + labelH + shown.length * lineH + padY + 2;
    const x = cx - w / 2, y = top;
    c.save();
    c.globalAlpha = a;
    rr(c, x, y, w, h, 10);
    c.fillStyle = 'rgba(16,12,22,.94)'; c.fill();
    c.strokeStyle = '#ff9d2e'; c.lineWidth = 2; c.stroke();
    c.beginPath();
    if (c.roundRect) c.roundRect(x, y, w, h, 10);
    else rr(c, x, y, w, h, 10);
    c.clip();
    c.fillStyle = 'rgba(255,157,46,.16)';
    c.fillRect(x, y, 5, h);
    txt(c, 'ЭФИР', x + padX, y + padY + labelH / 2, 11, '#ff9d2e', 'left', F_B, false);
    const life = clamp(1 - msg.t / 3.4, 0, 1);
    c.fillStyle = 'rgba(255,157,46,.45)';
    c.fillRect(x + padX, y + padY + labelH - 2, Math.max(24, (w - padX * 2) * life), 2);
    const ty = y + padY + labelH + lineH / 2;
    shown.forEach(function (line, i) { txt(c, line, x + padX, ty + i * lineH, size, '#ffd23f', 'left', F_D); });
    c.restore();
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.theatre = { ACH_STRIPE, toastMaxW };
  engine.replace('drawTheatreBack', drawTheatreBackEngine);
  engine.replace('drawAchievementsBack', drawAchievementsBackEngine);
  engine.replace('drawAnnounceToast', drawAnnounceToastEngine);
})(typeof window !== 'undefined' ? window : globalThis);
