////////////////////////////////////////////////////////
//
// DiVANEngine: тень кузова и щит в пространстве машины.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  let sweepBuf = null;

  /**
   * Временный холст для бегущей вспышки по маске.
   * @param {number} w
   * @param {number} h
   * @returns {HTMLCanvasElement}
   */
  function shieldSweepBuf(w, h) {
    if (!sweepBuf || sweepBuf.width !== w || sweepBuf.height !== h) {
      sweepBuf = document.createElement('canvas');
      sweepBuf.width = w;
      sweepBuf.height = h;
      sweepBuf._g = sweepBuf.getContext('2d');
    }
    return sweepBuf;
  }

  /**
   * Тень на земле: слабее и меньше, если машина в воздухе.
   * @param {CanvasRenderingContext2D} c
   * @param {object} r
   * @param {number} bodyS
   */
  function drawCarGroundShadowEngine(c, r, bodyS) {
    const idx = r.car.idx, z = r.z || 0;
    const airborne = z > 2;
    const gfx = getCarShadowGfx(idx);
    const cfg = editorCarConfig(idx);
    const ox = (cfg && cfg.body && cfg.body.x) || 0;
    const oy = (cfg && cfg.body && cfg.body.y) || 0;
    const shs = airborne ? 0.72 : 1;
    const alpha = airborne ? 0.22 : 0.36;
    c.save();
    c.translate(0, -z + (airborne ? 14 : 5));
    c.rotate(r.ang);
    c.scale(shs, shs * 0.92);
    if (CAR_SVG_ROT) c.rotate(CAR_SVG_ROT);
    c.translate(ox, oy);
    c.globalAlpha = alpha;
    if (gfx) {
      const s = 60 / Math.max(gfx.iw, gfx.ih) * bodyS;
      const dw = gfx.iw * s, dh = gfx.ih * s;
      const padU = gfx.pad * (dw / gfx.mw);
      c.drawImage(gfx.img, -dw / 2 - padU, -dh / 2 - padU, dw + padU * 2, dh + padU * 2);
    } else {
      c.fillStyle = '#000';
      rr(c, -27 * bodyS, -16 * bodyS, 54 * bodyS, 32 * bodyS, 7); c.fill();
    }
    c.restore();
  }

  /**
   * Щит в пространстве машины: те же поворот и масштаб, что у кузова.
   * @param {CanvasRenderingContext2D} c
   * @param {object} r
   */
  function drawCarShieldEngine(c, r) {
    if (!(r.shield > 0 || r.bubble > 0)) return;
    const idx = r.car.idx, z = r.z || 0, gfx = getShieldGfx(idx);
    const mot = typeof hudMotionOk === 'function' ? hudMotionOk() : true;
    if (!gfx) {
      c.save();
      c.strokeStyle = 'rgba(53,224,255,' + (mot ? (.5 + .3 * Math.sin(gt * 8)) : 0.65) + ')';
      c.lineWidth = 3;
      c.beginPath(); c.arc(r.x, r.y - z, 32, 0, TAU); c.stroke();
      c.restore();
      return;
    }
    const cfg = editorCarConfig(idx);
    const bodyS = carBodyScale(idx);
    const ox = (cfg && cfg.body && cfg.body.x) || 0;
    const oy = (cfg && cfg.body && cfg.body.y) || 0;
    const lift = 1 + (z / 46) * 0.25;
    const s = 60 / Math.max(gfx.iw, gfx.ih) * bodyS;
    const dw = gfx.iw * s, dh = gfx.ih * s;
    const padU = gfx.pad * (dw / gfx.mw);
    const stacks = r.bubble > 0 ? 3 : Math.min(3, r.shield | 0);
    c.save();
    c.translate(r.x, r.y - z);
    c.rotate(r.ang);
    c.scale(lift, lift);
    if (CAR_SVG_ROT) c.rotate(CAR_SVG_ROT);
    c.translate(ox, oy);
    const x = -dw / 2 - padU, y = -dh / 2 - padU, w = dw + padU * 2, h = dh + padU * 2;
    c.globalAlpha = mot ? (0.12 + 0.06 * Math.sin(gt * 5 + idx) + stacks * 0.04) : 0.18;
    c.drawImage(gfx.fill, x, y, w, h);
    c.globalAlpha = Math.min(1, mot ? (0.52 + 0.28 * Math.sin(gt * 7) + stacks * 0.08) : 0.72);
    c.drawImage(gfx.ring, x, y, w, h);
    if (mot) {
      const buf = shieldSweepBuf(gfx.cw, gfx.ch), sg = buf._g;
      sg.clearRect(0, 0, gfx.cw, gfx.ch);
      sg.drawImage(gfx.fill, 0, 0);
      sg.globalCompositeOperation = 'source-in';
      const t = (gt * 90 + idx * 40) % (gfx.cw + 36) - 18;
      const band = sg.createLinearGradient(t, 0, t + 22, 0);
      band.addColorStop(0, 'rgba(255,255,255,0)');
      band.addColorStop(.45, 'rgba(180,255,255,.95)');
      band.addColorStop(1, 'rgba(255,255,255,0)');
      sg.fillStyle = band; sg.fillRect(0, 0, gfx.cw, gfx.ch);
      sg.globalCompositeOperation = 'source-over';
      c.globalAlpha = .42;
      c.drawImage(buf, x, y, w, h);
    }
    c.restore();
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.carFx = { shieldSweepBuf };
  engine.replace('drawCarGroundShadow', drawCarGroundShadowEngine);
  engine.replace('drawCarShield', drawCarShieldEngine);
})(typeof window !== 'undefined' ? window : globalThis);
