////////////////////////////////////////////////////////
//
// DiVANEngine: комикс-интро гонщика — кадр, печать, пропуск.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Высота панели кадра от высоты окна.
   * @param {number} height
   * @returns {number}
   */
  function introPanelH(height) {
    return Math.round(height * 0.64);
  }

  /**
   * Доля удержания пробела до пропуска главы.
   * @param {number} held
   * @param {number} need
   * @returns {number}
   */
  function skipRatio(held, need) {
    if (need <= 0) return 1;
    const t = held / need;
    return t < 0 ? 0 : t > 1 ? 1 : t;
  }

  /**
   * Глава комикса: картинка сверху, текст снизу, VHS только на кадр.
   */
  function drawIntroEngine() {
    const pack = CHAR_INTROS[introChar];
    const scenes = introScenes();
    const sc = scenes[introFrame];
    if (!pack || !sc) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    const IW = cv.width, IH = cv.height;
    const s = Math.min(IW / 1280, IH / 720);
    const pad = Math.max(16, Math.round(22 * s));
    const img = pack.imgs[sc.img];
    const accent = pack.col || '#ffd23f';
    g.fillStyle = '#050409'; g.fillRect(0, 0, IW, IH);
    const panelH = introPanelH(IH);
    if (img && img.complete && img.naturalWidth > 0) {
      const crop = introCrop(img);
      g.save();
      g.beginPath(); g.rect(0, 0, IW, panelH); g.clip();
      const cover = Math.max(IW / crop.sw, panelH / crop.sh);
      g.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, (IW - crop.sw * cover) / 2, (panelH - crop.sh * cover) / 2, crop.sw * cover, crop.sh * cover);
      g.fillStyle = 'rgba(5,4,9,.78)'; g.fillRect(0, 0, IW, panelH);
      const fit = Math.min(IW / crop.sw, panelH / crop.sh);
      g.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, (IW - crop.sw * fit) / 2, (panelH - crop.sh * fit) / 2, crop.sw * fit, crop.sh * fit);
      g.restore();
    } else {
      g.fillStyle = '#181420'; g.fillRect(0, 0, IW, panelH);
      txt(g, '[КАДР ' + (introFrame + 1) + ']', IW / 2, panelH / 2, Math.round(22 * s), '#6f6880', 'center');
    }
    g.fillStyle = accent; g.fillRect(0, panelH, IW, Math.max(2, Math.round(2 * s)));
    const boxY = panelH;
    g.fillStyle = '#0c0a14'; g.fillRect(0, boxY, IW, IH - panelH);
    g.strokeStyle = accent; g.globalAlpha = .22; g.lineWidth = 1;
    g.beginPath(); g.moveTo(pad, boxY + 1); g.lineTo(IW - pad, boxY + 1); g.stroke(); g.globalAlpha = 1;
    const headY = boxY + Math.round(28 * s);
    txt(g, 'ГЛАВА ' + (introFrame + 1) + ' / ' + scenes.length, pad, headY, Math.round(12 * s), '#6f6880', 'left', F_B);
    txt(g, pack.name, IW - pad, headY, Math.round(14 * s), accent, 'right', F_B);
    const shown = sc.text.substring(0, introCur);
    const cursor = introCur < sc.text.length && Math.floor(gt * 4) % 2 === 0 ? '▌' : '';
    const fs = Math.round(18 * s);
    const wrapW = Math.min(Math.round(IW * 0.78), Math.round(980 * s));
    const lines = layoutLines(g, shown + cursor, wrapW, fs, F_B);
    const lineH = Math.round(26 * s);
    const textTop = boxY + Math.round(58 * s);
    lines.forEach(function (ln, i) { txt(g, ln, IW / 2, textTop + i * lineH, fs, '#f2eef8', 'center', F_B); });
    const hintY = IH - Math.round(22 * s);
    const allPrinted = introCur >= sc.text.length;
    txt(g, allPrinted ? 'ENTER — ДАЛЬШЕ  ·  ПРОБЕЛ — ПРОПУСТИТЬ ИНТРО' : 'ENTER — УСКОРИТЬ  ·  ПРОБЕЛ — ПРОПУСТИТЬ ИНТРО', IW / 2, hintY, Math.round(13 * s), '#6f6880', 'center', F_B);
    if (introSkipT > 0) {
      const skipT = skipRatio(introSkipT, INTRO_SKIP_HOLD);
      const left = Math.max(0, INTRO_SKIP_HOLD - introSkipT);
      const skipR = Math.max(13, Math.round(15 * s));
      const skipCx = pad + skipR;
      const skipCy = IH - Math.round(48 * s);
      g.fillStyle = 'rgba(5,4,9,.72)';
      g.beginPath(); g.arc(skipCx, skipCy, skipR + 5, 0, TAU); g.fill();
      g.lineWidth = Math.max(3, Math.round(3.2 * s));
      g.strokeStyle = 'rgba(255,255,255,.16)';
      g.beginPath(); g.arc(skipCx, skipCy, skipR, 0, TAU); g.stroke();
      g.strokeStyle = accent; g.lineCap = 'round';
      g.beginPath(); g.arc(skipCx, skipCy, skipR, -Math.PI / 2, -Math.PI / 2 + skipT * TAU); g.stroke();
      g.lineCap = 'butt';
      txt(g, left.toFixed(1), skipCx, skipCy + Math.round(1 * s), Math.round(11 * s), accent, 'center', F_D);
      txt(g, 'ПРОПУСК', skipCx + skipR + Math.round(10 * s), skipCy + Math.round(1 * s), Math.round(10 * s), '#c8c2d4', 'left', F_B);
    }
    const n = scenes.length, gap = Math.round(16 * s), r = Math.max(3, Math.round(3.5 * s));
    const dotsX = IW / 2 - (n * gap) / 2;
    const dotsY = boxY + Math.round(28 * s);
    for (let i = 0; i < n; i++) {
      g.fillStyle = i < introFrame ? accent : (i === introFrame ? '#ff9d2e' : '#3a3548');
      g.beginPath(); g.arc(dotsX + i * gap + gap / 2, dotsY, r, 0, TAU); g.fill();
    }
    drawVhsOverlay({ x: 0, y: 0, w: IW, h: panelH });
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.intro = { introPanelH, skipRatio };
  engine.replace('drawIntro', drawIntroEngine);
})(typeof window !== 'undefined' ? window : globalThis);
