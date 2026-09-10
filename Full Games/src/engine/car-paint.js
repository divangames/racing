////////////////////////////////////////////////////////
//
// DiVANEngine: кузов на холсте — колёса, слои спрайта, нитро.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Заводской вынос колёс, пока нет записи лаборатории.
   * @param {number} idx
   * @returns {object}
   */
  function stockWheelLayout(idx) {
    if (idx === 0) return { xR: -15.5, xF: 14.2, yR: 11.4, yF: 11.4, ww: 12, wh: 4, fs: 1 };
    if (idx === 1) return { xR: -15.5, xF: 14.2, yR: 12.0, yF: 12.0, ww: 12, wh: 4, fs: 1 };
    if (idx === 2) return { xR: -16.5, xF: 13.5, yR: 10.5, yF: 10.0, ww: 13, wh: 9, fs: .5 };
    if (idx === 5) return { xR: -15.8, xF: 14.6, yR: 12.5, yF: 11.6, ww: 12, wh: 8, fs: 1 };
    if (idx === 6) return { xR: -41.4, xM: -30.2, xF: 37.6, yR: 13.5, yM: 13.5, yF: 13.4, ww: 10.4, wh: 5.1, fs: 1 };
    if (idx === 7) return { xR: -17.8, xF: 14.5, yR: 9.82, yF: 9.87, ww: 10, wh: 4.15, fs: 1 };
    if (idx === 8) return { xR: -16.5, xF: 16.5, yR: 10.0, yF: 10.0, yL: 10.0, yFL: 10.0, ww: 9.4, wh: 4.17, fs: 1 };
    if (idx === 9) return { xR: -16.2, xF: 16.4, yR: 12.2, yF: 12.2, ww: 11, wh: 5, fs: 1 };
    if (idx === 10) return { xR: -18.2, xF: 16.2, yR: 11.6, yF: 11.6, ww: 11, wh: 5, fs: 1 };
    if (idx === 4) return { xR: -14, xF: 17, yR: 9.6, yF: 9.6, ww: 12, wh: 8, fs: 1 };
    return { xR: -14, xF: 17, yR: 14, yF: 14, ww: 12, wh: 8, fs: 1 };
  }

  /**
   * Машина: тень, колёса, кузов, броня, раны, нитро.
   * @param {CanvasRenderingContext2D} c
   * @param {object} r
   * @param {number} [sc]
   */
  function drawCarEngine(c, r, sc) {
    const z = r.z || 0;
    const idx = r.car.idx;
    const editorCfg = editorCarConfig(idx);
    const bodyS = editorCfg && editorCfg.body && editorCfg.body.scale != null ? editorCfg.body.scale : (idx === 6 ? 1.65 : 1);
    c.save(); c.translate(r.x, r.y);
    drawCarGroundShadow(c, r, bodyS);
    c.translate(0, -z + (r.bob || 0));
    c.rotate(r.ang);
    const lift = (sc || 1) * (1 + (z / 46) * 0.25);
    c.scale(lift, lift);
    const suspVis = r.susp || 0;
    const rockVis = introReduceMotion ? 0 : (r.rockAmp || 0) * Math.sin(r.rockT || 0);
    const wheel = function (wx, wy, steer, ww, wh, mult) {
      const scw = mult != null && isFinite(+mult) && +mult > 0 ? +mult : 1;
      const poke = wy * (1 + suspVis * 0.05);
      c.save(); c.translate(wx, poke); c.rotate(steer);
      c.imageSmoothingEnabled = true;
      const frame = ((Math.floor(r.wheelRot * .5) % WHEEL_FRAME_COUNT) + WHEEL_FRAME_COUNT) % WHEEL_FRAME_COUNT;
      const dw = Math.max(0.4, (isFinite(+ww) ? +ww : 12) * scw), dh = Math.max(0.4, (isFinite(+wh) ? +wh : 8) * scw);
      if (WHEEL_SPRITE.complete && WHEEL_SPRITE.naturalWidth > 0) {
        const srcW = WHEEL_SPRITE.naturalWidth / WHEEL_FRAME_COUNT;
        const srcH = WHEEL_SPRITE.naturalHeight;
        c.drawImage(WHEEL_SPRITE, frame * srcW, 0, srcW, srcH, -dw / 2, -dh / 2, dw, dh);
      } else {
        c.fillStyle = '#0d0c10';
        c.beginPath(); if (c.roundRect) c.roundRect(-dw / 2, -dh / 2, dw, dh, 2); else c.rect(-dw / 2, -dh / 2, dw, dh); c.fill();
      }
      c.restore();
    };
    const L = stockWheelLayout(idx);
    const armLvl = racerArmLvl(r);
    const bodyOffset = editorCfg && editorCfg.body || {};
    const vis = editorCfg && editorCfg.visible;
    const stack = editorCfg && Array.isArray(editorCfg.stack) && editorCfg.stack.length ? editorCfg.stack : null;
    const uralLayers = ['shadow', 'wheels', 'nitro', 'body', 'armor'];
    const rawLayers = editorCfg && Array.isArray(editorCfg.layers) ? editorCfg.layers : null;
    const layerOrder = rawLayers && rawLayers.length ? rawLayers : uralLayers;
    const hasNitroLayer = layerOrder.indexOf('nitro') >= 0;
    const layerOn = function (name) { return !(vis && vis[name] === false); };
    const spriteOk = function (im) { return im && im.complete && im.naturalWidth > 0; };
    const paintCarImg = function (im, ox, oy) {
      if (!spriteOk(im)) return false;
      const iw = im.naturalWidth, ih = im.naturalHeight;
      const s = 60 / Math.max(iw, ih) * bodyS;
      const bx = isFinite(+bodyOffset.sx) && +bodyOffset.sx > 0 ? +bodyOffset.sx : 1;
      const by = isFinite(+bodyOffset.sy) && +bodyOffset.sy > 0 ? +bodyOffset.sy : 1;
      c.save(); c.translate((bodyOffset.x || 0) + (ox || 0), (bodyOffset.y || 0) + (oy || 0));
      if (rockVis) c.rotate(rockVis);
      c.drawImage(im, -iw * s * bx / 2, -ih * s * by / 2, iw * s * bx, ih * s * by);
      c.restore();
      return true;
    };
    const placeWheel = function (n, wx, wy, steer, ww, wh, scale) {
      const q = editorCfg && editorCfg.w && editorCfg.w[n];
      if (q) {
        const ww2 = isFinite(+q[2]) ? +q[2] : 12, wh2 = isFinite(+q[3]) ? +q[3] : 8;
        wheel(q[0], q[1], (+q[4] || 0) + steer, ww2, wh2, q[5]);
      } else wheel(wx, wy, steer, ww, wh, scale);
    };
    const drawWheels = function () {
      if (editorCfg && Array.isArray(editorCfg.w) && editorCfg.w.length) {
        editorCfg.w.forEach(function (q, i) {
          if (stack) {
            const lay = stack.find(function (x) { return x.type === 'wheel' && x.ref === i; });
            if (lay && lay.on === false) return;
          }
          const steer = editorWheelSteers(q, i, editorCfg.w) ? r.wheelAngle : 0;
          const ww2 = isFinite(+q[2]) ? +q[2] : 12, wh2 = isFinite(+q[3]) ? +q[3] : 8;
          wheel(q[0], q[1], (+q[4] || 0) + steer, ww2, wh2, q[5]);
        });
        return;
      }
      placeWheel(0, L.xR, -(L.yL ?? L.yR), 0, L.ww, L.wh, 1);
      placeWheel(1, L.xR, L.yR, 0, L.ww, L.wh, 1);
      if (L.xM != null) {
        placeWheel(2, L.xM, -L.yM, 0, L.ww, L.wh, 1);
        placeWheel(3, L.xM, L.yM, 0, L.ww, L.wh, 1);
      }
      const frontIndex = L.xM != null ? 4 : 2;
      placeWheel(frontIndex, L.xF, -(L.yFL ?? L.yF), r.wheelAngle, L.ww, L.wh, L.fs);
      placeWheel(frontIndex + 1, L.xF, L.yF, r.wheelAngle, L.ww, L.wh, L.fs);
    };
    const drawShredderSaws = function () {
      const spin = gt * 28;
      const saw = function (x, y, r0, dir) {
        c.save(); c.translate(x, y); c.rotate(spin * dir);
        c.fillStyle = 'rgba(0,0,0,.45)';
        c.beginPath(); c.arc(0, 0, r0 + 2.4, 0, TAU); c.fill();
        c.fillStyle = '#c9ced4';
        c.beginPath();
        for (let k = 0; k < 32; k++) {
          const a = k / 32 * TAU, rad = k % 2 ? r0 * .7 : r0 + 2.6;
          const px = Math.cos(a) * rad, py = Math.sin(a) * rad;
          if (k) c.lineTo(px, py); else c.moveTo(px, py);
        }
        c.closePath(); c.fill();
        c.strokeStyle = '#15171b'; c.lineWidth = 1.1; c.stroke();
        c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = .7;
        for (let k = 0; k < 4; k++) { const a = (k / 4) * TAU; c.beginPath(); c.moveTo(Math.cos(a) * 2, Math.sin(a) * 2); c.lineTo(Math.cos(a) * (r0 + 1), Math.sin(a) * (r0 + 1)); c.stroke(); }
        c.fillStyle = '#2a2e34'; c.beginPath(); c.moveTo(r0 * .18, -1.2); c.lineTo(r0 + 1.8, -4.2); c.lineTo(r0 * .62, 1.7); c.closePath(); c.fill();
        c.strokeStyle = '#f0d8a0'; c.lineWidth = 1.1; c.beginPath(); c.moveTo(-1.5, r0 * .15); c.lineTo(r0 + 1.8, r0 * .32); c.stroke();
        c.fillStyle = '#505860'; c.beginPath(); c.arc(0, 0, r0 * .52, 0, TAU); c.fill();
        c.fillStyle = '#101216'; c.beginPath(); c.arc(0, 0, 2.1, 0, TAU); c.fill();
        c.restore();
      };
      saw(L.xF, -L.yF, 7.2, 1);
      saw(L.xF, L.yF, 7.2, -1);
    };
    const bodyImg = editorBodySprite(idx) || CAR_SVG[idx];
    const armorImg = (armLvl >= 1 && CAR_ARMOR[idx]) ? CAR_ARMOR[idx][armLvl] : null;
    const woundLvl = racerWoundLvl(r);
    const woundImg = (woundLvl >= 1 && CAR_DAMAGE[idx]) ? CAR_DAMAGE[idx][woundLvl] : null;
    const paintWound = function () { paintCarImg(woundImg); };
    const svgImg = spriteOk(armorImg) ? armorImg : bodyImg;
    const drawNitro = function () {
      if (!(r.nitro > 0)) return;
      const jet = function (x, y, len, half) {
        const flick = len + Math.random() * len * .35;
        c.fillStyle = '#35e0ff';
        c.beginPath(); c.moveTo(x, y - half); c.lineTo(x - flick, y); c.lineTo(x, y + half); c.closePath(); c.fill();
        c.fillStyle = '#fff';
        c.beginPath(); c.moveTo(x, y - half * .4); c.lineTo(x - flick * .55, y); c.lineTo(x, y + half * .4); c.closePath(); c.fill();
      };
      const pipes = editorCfg && Array.isArray(editorCfg.nitro) && editorCfg.nitro.length ? editorCfg.nitro : null;
      if (pipes) {
        pipes.forEach(function (p, i) {
          if (stack && editorCfg.stack.some(function (lay) { return lay.type === 'nitro' && lay.ref === i && lay.on === false; })) return;
          jet(+p[0] || 0, +p[1] || 0, +p[2] || 9, +p[3] || 1.5);
        });
        return;
      }
      if (idx === 0) { for (const y of [-6.4, -3.2, 3.2, 6.4]) jet(-26, y, 8, 1.35); }
      else if (idx === 1) { jet(-25, -7.8, 9, 1.55); jet(-25, 7.8, 9, 1.55); }
      else if (idx === 2) { jet(-26.4, -8.0, 10, 1.9); jet(-26.4, 8.0, 10, 1.9); }
      else if (idx === 4) { jet(-24, -6.6, 9, 1.55); jet(-24, 6.6, 9, 1.55); }
      else if (idx === 5) { jet(-27, -7.2, 14, 3.3); jet(-27, 7.2, 14, 3.3); }
      else if (idx === 6) { jet(-15.2 * bodyS, -6.5 * bodyS, 11, 1.8); jet(-15.2 * bodyS, 6.8 * bodyS, 11, 1.8); }
      else if (idx === 7) { jet(-25.8, -6.1, 10, 1.7); jet(-26.0, 5.8, 10, 1.7); }
      else if (idx === 8) {
        jet(-25.8, -6.63, 9, 1.35); jet(-25.9, -4.37, 9, 1.35);
        jet(-25.8, 5.13, 9, 1.35); jet(-25.7, 6.92, 9, 1.35);
      } else if (idx === 10) { jet(-27.2, -6.4, 10, 1.55); jet(-27.2, 6.4, 10, 1.55); }
      else { jet(-26, -5.2, 9, 1.5); jet(-26, 5.2, 9, 1.5); }
    };
    if (!(svgImg && svgImg.complete && svgImg.naturalWidth > 0)) {
      if (!r.car.hov && layerOn('wheels')) drawWheels();
      else if (r.car.hov) {
        const pulse = 0.12 + 0.05 * Math.sin(gt * 6);
        c.fillStyle = 'rgba(53,224,255,' + pulse + ')';
        c.beginPath(); c.ellipse(0, 0, 32, 15, 0, 0, TAU); c.fill();
      }
      if (layerOn('nitro')) drawNitro();
    } else {
      c.save(); c.rotate(CAR_SVG_ROT);
      if (r.car.hov) {
        const pulse = 0.14 + 0.05 * Math.sin(gt * 6);
        c.fillStyle = 'rgba(53,224,255,' + pulse + ')';
        c.beginPath(); c.ellipse(-4, 0, 32, 16, 0, 0, TAU); c.fill();
      }
      if (stack) {
        const jetOnce = function (p) {
          if (!(r.nitro > 0) || !p) return;
          const x = +p[0] || 0, y = +p[1] || 0, len = +p[2] || 9, half = +p[3] || 1.5;
          const flick = len + Math.random() * len * .35;
          c.fillStyle = '#35e0ff';
          c.beginPath(); c.moveTo(x, y - half); c.lineTo(x - flick, y); c.lineTo(x, y + half); c.closePath(); c.fill();
          c.fillStyle = '#fff';
          c.beginPath(); c.moveTo(x, y - half * .4); c.lineTo(x - flick * .55, y); c.lineTo(x, y + half * .4); c.closePath(); c.fill();
        };
        for (let li = 0; li < stack.length; li++) {
          const lay = stack[li];
          if (!lay || lay.on === false) continue;
          if (lay.type === 'shadow' || lay.type === 'guides') continue;
          if (lay.type === 'wheel') {
            if (!r.car.hov && editorCfg.w && editorCfg.w[lay.ref]) {
              const q = editorCfg.w[lay.ref];
              const steer = editorWheelSteers(q, lay.ref, editorCfg.w) ? r.wheelAngle : 0;
              const ww2 = isFinite(+q[2]) ? +q[2] : 12, wh2 = isFinite(+q[3]) ? +q[3] : 8;
              wheel(q[0], q[1], (+q[4] || 0) + steer, ww2, wh2, q[5]);
            }
            continue;
          }
          if (lay.type === 'nitro') { jetOnce(editorCfg.nitro && editorCfg.nitro[lay.ref]); continue; }
          if (lay.type === 'body') { if (idx === 2) drawShredderSaws(); paintCarImg(bodyImg); paintWound(); continue; }
          if (lay.type === 'armor') { paintCarImg(armorImg, bodyOffset.ax || 0, bodyOffset.ay || 0); continue; }
        }
      } else {
        for (let li = 0; li < layerOrder.length; li++) {
          const name = layerOrder[li];
          if (name === 'shadow' || name === 'guides') continue;
          if (!layerOn(name)) continue;
          if (name === 'wheels') { if (!r.car.hov) drawWheels(); if (idx === 2) drawShredderSaws(); continue; }
          if (name === 'nitro') { drawNitro(); continue; }
          if (name === 'body') {
            if (!hasNitroLayer && idx !== 6) drawNitro();
            paintCarImg(bodyImg);
            paintWound();
            continue;
          }
          if (name === 'armor') { paintCarImg(armorImg, bodyOffset.ax || 0, bodyOffset.ay || 0); continue; }
        }
        if (!hasNitroLayer && idx === 6) drawNitro();
      }
      c.restore();
      c.restore();
      return;
    }
    if (!layerOn('body')) { c.restore(); return; }
    const fb = global.DiVANEngine && global.DiVANEngine.carPaint && global.DiVANEngine.carPaint.drawFallbackBody;
    if (fb) fb(c, r, idx);
    c.restore();
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.carPaint = engine.carPaint || {};
  engine.carPaint.stockWheelLayout = stockWheelLayout;
  engine.replace('drawCar', drawCarEngine);
})(typeof window !== 'undefined' ? window : globalThis);
