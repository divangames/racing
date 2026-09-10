////////////////////////////////////////////////////////
//
// DiVANEngine: портрет, рост и метка хозяина кузова.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * RGB из #hex для заливок сцены пилота.
   * @param {string} hex
   * @returns {number[]}
   */
  function hexToRgbEngine(hex) {
    const s = String(hex || '#c8b070').replace('#', '');
    const n = parseInt(s.length === 3 ? s.replace(/./g, '$&$&') : s, 16);
    if (isNaN(n)) return [200, 176, 112];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  /**
   * Масштаб портрета: базовый спрайт 88×88, затем ×2.
   * @param {number} s
   * @returns {number}
   */
  function portraitZoom(s) {
    return s * 2;
  }

  /**
   * Рост вписан по высоте, ноги к низу кадра.
   * @param {number} iw
   * @param {number} ih
   * @param {number} w
   * @param {number} h
   * @param {number} [scale]
   * @returns {{dw:number,dh:number,dx:number,dy:number}}
   */
  function fullbodyFit(iw, ih, w, h, scale) {
    const sc = Math.min(w / iw, h / ih) * (scale || 1);
    const dw = iw * sc, dh = ih * sc;
    return { dw, dh, dx: (w - dw) / 2, dy: h - dh };
  }

  /**
   * Портрет без круга, в 2 раза крупнее базового 88×88.
   * @param {CanvasRenderingContext2D} c
   * @param {object} ch
   * @param {number} cx
   * @param {number} cy
   * @param {number} s
   */
  function drawPortraitEngine(c, ch, cx, cy, s) {
    const img = avatarImage(ch);
    c.save();
    c.translate(cx, cy);
    const k = portraitZoom(s);
    c.scale(k, k);
    if (img) {
      c.drawImage(img, -44, -44, 88, 88);
    } else if (ch) {
      c.fillStyle = ch.col || '#3a3548'; rr(c, -30, -34, 60, 68, 8); c.fill();
      c.fillStyle = ch.skin || '#eab98a'; rr(c, -16, -26, 32, 38, 10); c.fill();
      c.fillStyle = ch.hair || '#2b2119'; c.fillRect(-17, -30, 34, 12);
      c.fillStyle = '#1a1622'; c.fillRect(-11, -10, 7, 5); c.fillRect(4, -10, 7, 5);
    }
    c.restore();
  }

  /**
   * Рисует NN_Player_fullbody, вписанный по высоте, ноги к низу кадра.
   * @param {CanvasRenderingContext2D} c
   * @param {HTMLImageElement} img
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {number} [scale]
   */
  function drawFullbodyFitEngine(c, img, x, y, w, h, scale) {
    const f = fullbodyFit(img.naturalWidth, img.naturalHeight, w, h, scale);
    c.drawImage(img, x + f.dx, y + f.dy, f.dw, f.dh);
  }

  /**
   * Левая витрина гонщика для гаража и тренажёрки.
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {object} ch
   * @param {{title:string,sub?:string,subCol?:string}|null} plaque
   */
  function drawPilotStageEngine(x, y, w, h, ch, plaque) {
    const rgb = hexToRgb(ch && ch.col);
    const img = fullbodyImage(ch);
    const reduce = introReduceMotion;
    rr(g, x, y, w, h, 16); g.fillStyle = '#0c0a12'; g.fill();
    g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 1; g.stroke();
    g.save();
    rr(g, x, y, w, h, 16); g.clip();
    const wash = g.createLinearGradient(x, y, x, y + h);
    wash.addColorStop(0, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',.22)');
    wash.addColorStop(.38, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',.05)');
    wash.addColorStop(1, 'rgba(8,6,12,.2)');
    g.fillStyle = wash; g.fillRect(x, y, w, h);
    const spot = g.createRadialGradient(x + w * .5, y + h * .18, 8, x + w * .5, y + h * .42, w * .92);
    spot.addColorStop(0, 'rgba(255,248,230,.16)');
    spot.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = spot; g.fillRect(x, y, w, h);
    const vig = g.createLinearGradient(x, y, x + w, y);
    vig.addColorStop(0, 'rgba(6,5,10,.45)'); vig.addColorStop(.18, 'rgba(6,5,10,0)');
    vig.addColorStop(.82, 'rgba(6,5,10,0)'); vig.addColorStop(1, 'rgba(6,5,10,.45)');
    g.fillStyle = vig; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',.85)';
    g.fillRect(x, y, 4, h);
    g.restore();
    const pad = 8, plaqueH = 58, standLift = 34;
    const fx = x + pad, fy = y - 52, fw = w - pad * 2, fh = h - plaqueH - standLift + 52;
    const feetY = fy + fh;
    g.save();
    g.beginPath(); g.rect(x, y - 80, w, h - plaqueH + 80); g.clip();
    g.fillStyle = 'rgba(0,0,0,.42)';
    g.beginPath(); g.ellipse(x + w / 2, feetY, w * .48, 32, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',.35)'; g.lineWidth = 1.4;
    g.beginPath(); g.ellipse(x + w / 2, feetY, w * .48, 32, 0, 0, TAU); g.stroke();
    if (img) {
      g.save();
      if (!reduce) { g.translate(x + w / 2, feetY); g.scale(1 + Math.sin(gt * 1.15) * 0.008, 1 + Math.sin(gt * 1.15) * 0.008); g.translate(-(x + w / 2), -feetY); }
      drawFullbodyFit(g, img, fx, fy + 14, fw, fh, 1.02);
      g.restore();
    } else {
      drawPortrait(g, ch, x + w / 2, y + h * 0.38, 1.35);
    }
    g.restore();
    if (!plaque) return;
    const py = y + h - plaqueH;
    panel(g, x + 12, py, w - 24, 46, 'rgba(12,10,18,.88)', 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',.4)', 10);
    txt(g, plaque.title, x + w / 2, py + 16, 15, ch.col || '#ffd23f', 'center', F_B);
    if (plaque.sub) txt(g, plaque.sub, x + w / 2, py + 34, 11, plaque.subCol || '#9a93a8', 'center', F_B);
  }

  /**
   * Аватар в списке лидеров: файл или пустой слот, без рамки.
   * @param {CanvasRenderingContext2D} c
   * @param {object} ch
   * @param {number} cx
   * @param {number} cy
   * @param {number} size
   * @param {number} [zoom]
   */
  function drawLeaderAvatarEngine(c, ch, cx, cy, size, zoom) {
    const img = avatarImage(ch);
    if (!img) return;
    const z = zoom == null ? 1.24 : zoom;
    const s = size * z;
    c.save();
    c.beginPath();
    c.arc(cx, cy, size / 2, 0, TAU);
    c.closePath();
    c.clip();
    c.drawImage(img, cx - s / 2, cy - s / 2 + size * 0.05, s, s);
    c.restore();
  }

  /**
   * Аватар владельца кузова: без кольца, как портрет гонщика.
   * @param {number} x
   * @param {number} y
   * @param {number} size
   * @param {number} ownerIdx
   */
  function drawCarOwnerMarkEngine(x, y, size, ownerIdx) {
    if (ownerIdx == null || !CHARS[ownerIdx]) return;
    drawPortrait(g, CHARS[ownerIdx], x, y, size / 176);
  }

  /**
   * Хозяин авто — крупный портрет в правом нижнем углу карточки.
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {number} ownerIdx
   * @param {number} size
   */
  function drawCarOwnerCornerEngine(x, y, w, h, ownerIdx, size) {
    if (ownerIdx == null) return;
    g.save();
    rr(g, x, y, w, h, 16); g.clip();
    drawCarOwnerMark(x + w - size * 0.36, y + h - size * 0.34, size, ownerIdx);
    g.restore();
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.portraits = { hexToRgb: hexToRgbEngine, portraitZoom, fullbodyFit };
  engine.replace('hexToRgb', hexToRgbEngine);
  engine.replace('drawPortrait', drawPortraitEngine);
  engine.replace('drawFullbodyFit', drawFullbodyFitEngine);
  engine.replace('drawPilotStage', drawPilotStageEngine);
  engine.replace('drawLeaderAvatar', drawLeaderAvatarEngine);
  engine.replace('drawCarOwnerMark', drawCarOwnerMarkEngine);
  engine.replace('drawCarOwnerCorner', drawCarOwnerCornerEngine);
})(typeof window !== 'undefined' ? window : globalThis);
