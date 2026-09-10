////////////////////////////////////////////////////////
//
// DiVANEngine: векторный кузов, если спрайт ещё не готов.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Фолбэк кузова 0–5 и общий ящик.
   * @param {CanvasRenderingContext2D} c
   * @param {object} r
   * @param {number} idx
   */
  function drawFallbackBody(c, r, idx) {
    if (idx === 0) {
      c.fillStyle = '#3a3128'; c.fillRect(-27, -9, 4, 18);
      c.fillStyle = r.car.col; rr(c, -24, -11, 47, 22, 4); c.fill();
      c.fillStyle = r.car.col2; c.fillRect(-24, -11, 10, 22); c.fillRect(2, -6, 8, 5); c.fillRect(-8, 4, 7, 6);
      c.fillStyle = r.ch.col; c.fillRect(-2, -2, 20, 4);
      c.fillStyle = '#6f665c'; c.fillRect(-14, -13, 16, 3); c.fillRect(-14, 10, 16, 3);
      c.strokeStyle = '#c9c2b8'; c.lineWidth = 2.5;
      c.beginPath(); c.moveTo(23, -9); c.lineTo(26, -9); c.lineTo(26, 9); c.lineTo(23, 9); c.stroke();
      c.fillStyle = '#c9c2b8';
      c.beginPath(); c.moveTo(26, -6); c.lineTo(29, -5); c.lineTo(26, -4); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(26, 4); c.lineTo(29, 5); c.lineTo(26, 6); c.closePath(); c.fill();
      c.fillStyle = '#0e1c28'; rr(c, 1, -8, 10, 16, 3); c.fill();
      c.fillStyle = r.ch.col; c.beginPath(); c.arc(5, 0, 4, 0, TAU); c.fill();
      c.fillStyle = '#ffe9a0'; c.fillRect(21, -8, 3, 4); c.fillRect(21, 4, 3, 4);
    } else if (idx === 1) {
      c.fillStyle = '#10141c'; c.fillRect(-27, -10, 3, 20);
      c.fillStyle = r.car.col; rr(c, -24, -10, 47, 20, 5); c.fill();
      c.fillStyle = r.car.col2; rr(c, -24, -10, 12, 20, 5); c.fill();
      c.fillStyle = r.ch.col; c.fillRect(-12, -3, 20, 2); c.fillRect(-12, 1, 20, 2);
      c.fillStyle = '#10141c'; rr(c, 8, -4, 9, 8, 2); c.fill();
      c.fillStyle = '#3a3f4a'; c.fillRect(15, -3, 3, 6);
      c.fillStyle = '#0e1c28'; rr(c, 0, -8, 8, 16, 2); c.fill();
      c.fillStyle = r.ch.col; c.beginPath(); c.arc(-4, 0, 4, 0, TAU); c.fill();
      c.fillStyle = '#6f665c'; c.fillRect(-26, -6, 3, 3); c.fillRect(-26, 3, 3, 3);
      c.fillStyle = '#ffe9a0'; c.fillRect(21, -8, 3, 4); c.fillRect(21, 4, 3, 4);
    } else if (idx === 2) {
      const rot = gt * 10;
      const blade = function (bx, by) {
        c.save(); c.translate(bx, by); c.rotate(rot);
        c.fillStyle = '#9aa0a8'; c.beginPath(); c.arc(0, 0, 6, 0, TAU); c.fill();
        c.fillStyle = '#565b63';
        for (let k = 0; k < 4; k++) { c.rotate(Math.PI / 2); c.fillRect(4, -1, 4, 2); }
        c.fillStyle = '#22262c'; c.beginPath(); c.arc(0, 0, 2, 0, TAU); c.fill();
        c.restore();
      };
      blade(-2, -13); blade(-2, 13);
      c.fillStyle = '#12351a'; c.fillRect(-27, -10, 4, 20);
      c.fillStyle = r.car.col; rr(c, -24, -11, 47, 22, 3); c.fill();
      c.fillStyle = r.car.col2; rr(c, -24, -11, 12, 22, 3); c.fill();
      c.fillStyle = '#9aa0a8';
      c.beginPath(); c.moveTo(20, -10); c.lineTo(27, -6); c.lineTo(27, 6); c.lineTo(20, 10); c.closePath(); c.fill();
      c.fillStyle = '#565b63'; c.fillRect(24, -6, 2, 12);
      c.fillStyle = '#d8dde3';
      for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(8, k * 5 - 2); c.lineTo(12, k * 5); c.lineTo(8, k * 5 + 2); c.closePath(); c.fill(); }
      c.fillStyle = '#0e1c28'; rr(c, -2, -8, 9, 16, 2); c.fill();
      c.fillStyle = r.ch.col; c.beginPath(); c.arc(2, 0, 4, 0, TAU); c.fill();
      c.fillStyle = '#ffe9a0'; c.fillRect(20, -9, 3, 4); c.fillRect(20, 5, 3, 4);
    } else if (idx === 3) {
      c.fillStyle = r.car.col;
      c.beginPath(); c.moveTo(-22, -9); c.lineTo(10, -10); c.lineTo(24, -4); c.lineTo(24, 4); c.lineTo(10, 10); c.lineTo(-22, 9); c.closePath(); c.fill();
      c.fillStyle = r.car.col2;
      c.beginPath(); c.moveTo(-22, -9); c.lineTo(-8, -9); c.lineTo(-8, 9); c.lineTo(-22, 9); c.closePath(); c.fill();
      c.fillStyle = 'rgba(53,224,255,.8)'; c.fillRect(-18, -11, 26, 2); c.fillRect(-18, 9, 26, 2);
      c.fillStyle = r.car.col2;
      c.beginPath(); c.moveTo(16, -9); c.lineTo(22, -12); c.lineTo(20, -7); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(16, 9); c.lineTo(22, 12); c.lineTo(20, 7); c.closePath(); c.fill();
      c.fillStyle = '#0e1c28'; c.beginPath(); c.ellipse(2, 0, 8, 6, 0, 0, TAU); c.fill();
      c.fillStyle = 'rgba(53,224,255,.5)'; c.beginPath(); c.ellipse(4, 0, 5, 3.5, 0, 0, TAU); c.fill();
      c.fillStyle = r.ch.col; c.beginPath(); c.arc(1, 0, 3.5, 0, TAU); c.fill();
      c.fillStyle = '#22262c'; c.fillRect(-25, -6, 4, 4); c.fillRect(-25, 2, 4, 4);
      c.fillStyle = '#e8f4ff'; c.fillRect(22, -3, 2, 6);
    } else if (idx === 4) {
      c.fillStyle = '#0a0a0a'; c.fillRect(-28, -12, 4, 24);
      c.fillStyle = r.car.col; rr(c, -25, -13, 50, 26, 3); c.fill();
      c.fillStyle = r.car.col2; rr(c, -25, -13, 14, 26, 3); c.fill();
      c.fillStyle = '#3a3a3a'; c.fillRect(-22, -15, 6, 30); c.fillRect(-10, -14, 4, 28);
      c.fillStyle = r.car.col2; c.fillRect(-18, -8, 8, 16);
      c.fillStyle = '#c9c2b8';
      for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(24, k * 6 - 2); c.lineTo(28, k * 6); c.lineTo(24, k * 6 + 2); c.closePath(); c.fill(); }
      c.fillStyle = '#0e1c28'; rr(c, -4, -10, 10, 20, 2); c.fill();
      c.fillStyle = r.ch.col; c.beginPath(); c.arc(1, 0, 4, 0, TAU); c.fill();
      c.strokeStyle = '#8b0000'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(-4, -10); c.lineTo(6, -10); c.lineTo(6, 10); c.lineTo(-4, 10); c.stroke();
      c.fillStyle = '#ff3d2e'; c.fillRect(22, -10, 3, 4); c.fillRect(22, 6, 3, 4);
    } else if (idx === 5) {
      c.fillStyle = r.car.col;
      c.beginPath(); c.moveTo(-20, -9); c.lineTo(8, -10); c.lineTo(26, -3); c.lineTo(26, 3); c.lineTo(8, 10); c.lineTo(-20, 9); c.closePath(); c.fill();
      c.fillStyle = r.car.col2;
      c.beginPath(); c.moveTo(-20, -9); c.lineTo(-8, -9); c.lineTo(-8, 9); c.lineTo(-20, 9); c.closePath(); c.fill();
      c.fillStyle = 'rgba(180,120,255,.6)'; c.fillRect(-16, -11, 22, 2); c.fillRect(-16, 9, 22, 2);
      c.fillStyle = '#0e1c28'; c.beginPath(); c.ellipse(0, 0, 9, 5, 0, 0, TAU); c.fill();
      c.fillStyle = 'rgba(180,120,255,.4)'; c.beginPath(); c.ellipse(2, 0, 6, 3, 0, 0, TAU); c.fill();
      c.fillStyle = r.ch.col; c.beginPath(); c.arc(-1, 0, 3.5, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(180,120,255,.8)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(20, -8); c.lineTo(28, -2); c.moveTo(20, 8); c.lineTo(28, 2); c.stroke();
      c.fillStyle = '#ffe9a0'; c.fillRect(24, -2, 2, 4);
    } else {
      c.fillStyle = r.car.col; rr(c, -24, -11, 47, 22, 5); c.fill();
      c.fillStyle = r.car.col2; rr(c, -24, -11, 12, 22, 5); c.fill();
      c.fillStyle = '#0e1c28'; rr(c, -2, -8, 10, 16, 3); c.fill();
      c.fillStyle = r.ch.col; c.beginPath(); c.arc(2, 0, 4, 0, TAU); c.fill();
      c.fillStyle = '#ffe9a0'; c.fillRect(21, -8, 3, 4); c.fillRect(21, 4, 3, 4);
    }
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.carPaint = engine.carPaint || {};
  engine.carPaint.drawFallbackBody = drawFallbackBody;
})(typeof window !== 'undefined' ? window : globalThis);
