////////////////////////////////////////////////////////
//
// DiVANEngine: достижения, читы и сетка трасс разработчика.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Сетка трофеев 3×3.
   * @param {number} width
   * @param {number} height
   * @param {number} n
   * @param {number} [cols]
   * @returns {{tw:number,th:number,x0:number,y0:number,cols:number,gapX:number,gapY:number}}
   */
  function trophyGrid(width, height, n, cols) {
    const c = cols || 3;
    const rows = Math.max(1, Math.ceil(n / c));
    const gapX = 16, gapY = 12;
    const gridW = width - 56, gridH = height - 108;
    const tw = ((gridW - (c - 1) * gapX) / c) | 0;
    const th = ((gridH - (rows - 1) * gapY) / rows) | 0;
    return { tw, th, x0: (width - c * tw - (c - 1) * gapX) / 2, y0: 78, cols: c, gapX, gapY };
  }

  /**
   * Левый край семи ячеек чит-кода.
   * @param {number} width
   * @param {number} n
   * @param {number} bw
   * @param {number} gap
   * @returns {number}
   */
  function cheatSlotX0(width, n, bw, gap) {
    return width / 2 - (n * bw + (n - 1) * gap) / 2;
  }

  /**
   * Плитка трассы в сетке по три в ряд.
   * @param {number} i
   * @param {number} n
   * @param {number} width
   * @returns {{x:number,y:number,w:number,h:number}}
   */
  function trackTileRectAt(i, n, width) {
    const cols = 3, tw = 360, th = 196, gap = 20;
    const row = (i / cols) | 0, inRow = Math.min(cols, n - row * cols), col = i % cols;
    const rowW = inRow * tw + (inRow - 1) * gap;
    return { x: (width - rowW) / 2 + col * (tw + gap), y: 148 + row * (th + gap), w: tw, h: th };
  }

  /**
   * Пункты паузы в гонке.
   * @returns {string[]}
   */
  function pauseRaceItemsEngine() {
    const items = ['ПРОДОЛЖИТЬ', 'НАСТРОЙКИ', 'ДОСТИЖЕНИЯ', 'РЕСТАРТ ГОНКИ'];
    if (isDev()) items.push('ВЫБОР ТРАССЫ');
    items.push(labTest ? 'В ЛАБОРАТОРИЮ' : 'ВЫЙТИ ИЗ ГОНКИ');
    return items;
  }

  /**
   * Пункты паузы в гараже.
   * @returns {string[]}
   */
  function pauseGarageItemsEngine() {
    const items = ['ПРОДОЛЖИТЬ', 'СОХРАНИТЬ ИГРУ', 'ЗАГРУЗИТЬ ИГРУ', 'НАСТРОЙКИ', 'ДОСТИЖЕНИЯ'];
    if (isDev()) items.push('ВЫБОР ТРАССЫ');
    items.push('В ГЛАВНОЕ МЕНЮ');
    return items;
  }

  /**
   * Позиция плитки по текущему списку трасс.
   * @param {number} i
   * @returns {{x:number,y:number,w:number,h:number}}
   */
  function trackTileRectEngine(i) {
    return trackTileRectAt(i, pickableTracks().length, W);
  }

  /**
   * Контур трассы по контрольным точкам.
   */
  function drawTrackOutlineEngine(c, def, x, y, w, h) {
    const cps = def.cps; if (!cps || !cps.length) return;
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    for (const p of cps) { minx = Math.min(minx, p[0]); miny = Math.min(miny, p[1]); maxx = Math.max(maxx, p[0]); maxy = Math.max(maxy, p[1]); }
    const pad = 18, bw = w - pad * 2, bh = h - pad * 2 - 36;
    const sc = Math.min(bw / Math.max(1, maxx - minx), bh / Math.max(1, maxy - miny));
    const ox = x + w / 2 - ((minx + maxx) / 2) * sc, oy = y + pad + 8 + bh / 2 - ((miny + maxy) / 2) * sc;
    const th = def.theme || {};
    c.save();
    c.strokeStyle = th.line || '#ffd23f'; c.lineWidth = 7; c.lineJoin = 'round'; c.lineCap = 'round';
    c.beginPath();
    cps.forEach(function (p, i) { const px = ox + p[0] * sc, py = oy + p[1] * sc; if (i) c.lineTo(px, py); else c.moveTo(px, py); });
    c.closePath(); c.stroke();
    c.strokeStyle = th.road || '#3a3548'; c.lineWidth = 3.5; c.stroke();
    c.restore();
  }

  /**
   * Подложка-медальон под иконку трофея.
   */
  function drawAchievementMedalEngine(x, y, size, unlocked) {
    const cx = x + size / 2, cy = y + size / 2, r = size / 2;
    g.save();
    g.globalAlpha = unlocked ? .55 : .22;
    const disc = g.createRadialGradient(cx, cy - r * .18, r * .12, cx, cy, r);
    disc.addColorStop(0, unlocked ? '#5a4a28' : '#2a2830');
    disc.addColorStop(.55, unlocked ? '#241c14' : '#141218');
    disc.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = disc;
    g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
    g.globalAlpha = unlocked ? .7 : .25;
    g.strokeStyle = unlocked ? '#ffd23f' : '#3a3844';
    g.lineWidth = 2;
    g.beginPath(); g.arc(cx, cy, r * .46, 0, TAU); g.stroke();
    g.restore();
  }

  /**
   * Иконка из листа или запасная плашка.
   */
  function drawAchievementIconEngine(iconIndex, x, y, size, unlocked) {
    if (!achIconSheet.complete || !achIconSheet.naturalWidth) {
      panel(g, x, y, size, size, unlocked ? 'rgba(255,210,63,.12)' : 'rgba(58,53,72,.35)', unlocked ? '#ffd23f' : '#3a3548', 8);
      return;
    }
    const cell = achIconSheet.naturalWidth / ACH_ICON_GRID;
    const col = iconIndex % ACH_ICON_GRID, row = Math.floor(iconIndex / ACH_ICON_GRID);
    g.save();
    if (unlocked) {
      g.shadowColor = 'rgba(255,180,60,.45)';
      g.shadowBlur = 18;
    } else g.globalAlpha = .38;
    g.imageSmoothingEnabled = false;
    g.drawImage(achIconSheet, col * cell, row * cell, cell, cell, x, y, size, size);
    g.restore();
  }

  /**
   * Плитка трофея: медальон, подпись, галочка если открыто.
   */
  function drawAchievementTileEngine(x, y, tw, th, a) {
    const got = !!(save && save.achievements && save.achievements[a.id]);
    g.save();
    panelPath(g, x, y, tw, th, 12); g.clip();
    const body = g.createLinearGradient(x, y, x, y + th);
    if (got) {
      body.addColorStop(0, 'rgba(48,36,18,.94)');
      body.addColorStop(.45, 'rgba(18,14,22,.92)');
      body.addColorStop(1, 'rgba(8,6,12,.96)');
    } else {
      body.addColorStop(0, 'rgba(22,20,28,.9)');
      body.addColorStop(1, 'rgba(8,7,12,.96)');
    }
    g.fillStyle = body; g.fillRect(x, y, tw, th);
    if (got) {
      const halo = g.createRadialGradient(x + tw / 2, y + th * .38, 10, x + tw / 2, y + th * .38, th * .55);
      halo.addColorStop(0, 'rgba(255,210,63,.22)');
      halo.addColorStop(1, 'rgba(255,157,46,0)');
      g.fillStyle = halo; g.fillRect(x, y, tw, th);
    }
    g.fillStyle = got ? 'rgba(255,210,63,.18)' : 'rgba(255,255,255,.04)';
    g.fillRect(x, y, tw, 2);
    g.restore();
    panel(g, x, y, tw, th, null, got ? '#ffd23f' : '#32303c', 12);
    const icon = Math.round(Math.min(tw * 0.48, th * 0.66));
    const ix = x + (tw - icon) / 2, iy = y + 6;
    drawAchievementMedal(ix - 8, iy - 6, icon + 16, got);
    drawAchievementIcon(a.icon, ix, iy, icon, got);
    txt(g, a.name, x + tw / 2, iy + icon + 12, 14, got ? '#ffd23f' : '#6a6474', 'center');
    const lines = layoutLines(g, a.desc, tw - 28, 11, F_B).slice(0, 2);
    lines.forEach(function (ln, li) { txt(g, ln, x + tw / 2, iy + icon + 28 + li * 14, 11, got ? '#d4cfc0' : '#4a4656', 'center', F_B); });
    if (got) {
      g.save();
      g.shadowColor = 'rgba(88,255,107,.55)'; g.shadowBlur = 8;
      txt(g, '✓', x + tw - 20, y + 18, 15, '#58ff6b', 'center');
      g.restore();
    }
  }

  /**
   * Сетка достижений.
   */
  function drawAchievementsEngine() {
    drawAchievementsBack();
    const n = ACHIEVEMENTS.length, gotN = Object.keys((save && save.achievements) || {}).length;
    txt(g, 'ДОСТИЖЕНИЯ', W / 2, 36, 34, '#ffd23f', 'center');
    txt(g, gotN + ' из ' + n + ' открыто', W / 2, 64, 13, '#9a93a8', 'center', F_B);
    const grid = trophyGrid(W, H, n, 3);
    ACHIEVEMENTS.forEach(function (a, i) {
      const col = i % grid.cols, row = (i / grid.cols) | 0;
      drawAchievementTile(grid.x0 + col * (grid.tw + grid.gapX), grid.y0 + row * (grid.th + grid.gapY), grid.tw, grid.th, a);
    });
    txt(g, 'ESC — НАЗАД', W / 2, H - 18, 14, '#ff9d2e', 'center');
  }

  /**
   * Семь ячеек чит-кода.
   */
  function drawCheatsEngine() {
    if (typeof cheatsAllowed === 'function' && !cheatsAllowed()) {
      state = 'title';
      return;
    }
    g.fillStyle = '#0b0a12'; g.fillRect(0, 0, W, H);
    txt(g, 'ЧИТЫ', W / 2, 70, 44, '#ffd23f', 'center');
    txt(g, 'введите код • только английская раскладка', W / 2, 112, 15, '#9a93a8', 'center', F_B);
    const n = 7, bw = 64, gap = 12;
    const x0 = cheatSlotX0(W, n, bw, gap);
    for (let i = 0; i < n; i++) {
      const x = x0 + i * (bw + gap), sel = i === cheatCur;
      panel(g, x, 300, bw, 80, sel ? 'rgba(255,157,46,.15)' : 'rgba(20,17,28,.9)', sel ? '#ffd23f' : '#3a3548', 8);
      txt(g, cheatBuf[i], x + bw / 2, 340, 40, sel ? '#ffd23f' : '#8f88a0', 'center');
    }
    if (cheatMsgT > 0) {
      g.globalAlpha = Math.min(1, cheatMsgT);
      txt(g, cheatMsg, W / 2, 440, 20, cheatMsg.charAt(0) === '✔' ? '#58ff6b' : '#ff3d2e', 'center'); g.globalAlpha = 1;
    }
    txt(g, '← → — позиция • ↑ ↓ — символ • A–Z — ввод • ENTER — применить • ESC — назад', W / 2, H - 30, 14, '#6f6880', 'center', F_B);
  }

  /**
   * Сетка трасс для быстрого старта.
   */
  function drawTrackPickEngine() {
    g.fillStyle = '#0b0a12'; g.fillRect(0, 0, W, H);
    txt(g, 'ВЫБОР ТРАССЫ', W / 2, 58, 40, '#ffd23f', 'center');
    txt(g, 'быстрый старт • режим разработчика', W / 2, 96, 15, '#9a93a8', 'center', F_B);
    g._trackTiles = [];
    const list = pickableTracks();
    list.forEach(function (def, i) {
      const r = trackTileRect(i), sel = i === trackPickSel;
      const th = def.theme || {};
      panel(g, r.x, r.y, r.w, r.h, sel ? 'rgba(255,157,46,.16)' : 'rgba(20,17,28,.92)', sel ? '#ffd23f' : '#3a3548', 10);
      g.fillStyle = th.ground || '#2a2434';
      rr(g, r.x + 10, r.y + 10, r.w - 20, r.h - 52, 8); g.fill();
      drawTrackOutline(g, def, r.x + 10, r.y + 10, r.w - 20, r.h - 52);
      txt(g, def.name, r.x + r.w / 2, r.y + r.h - 22, 16, sel ? '#ffd23f' : '#c8c0d4', 'center');
      if (def.custom) txt(g, 'СВОЯ', r.x + 24, r.y + 24, 11, '#3d9eff', 'left', F_B);
      g._trackTiles.push(r);
    });
    txt(g, '← → ↑ ↓ — плитка • ENTER — старт • ESC — назад', W / 2, H - 28, 14, '#6f6880', 'center', F_B);
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.extras = { trophyGrid, cheatSlotX0, trackTileRectAt };
  engine.replace('pauseRaceItems', pauseRaceItemsEngine);
  engine.replace('pauseGarageItems', pauseGarageItemsEngine);
  engine.replace('trackTileRect', trackTileRectEngine);
  engine.replace('drawTrackOutline', drawTrackOutlineEngine);
  engine.replace('drawAchievementMedal', drawAchievementMedalEngine);
  engine.replace('drawAchievementIcon', drawAchievementIconEngine);
  engine.replace('drawAchievementTile', drawAchievementTileEngine);
  engine.replace('drawAchievements', drawAchievementsEngine);
  engine.replace('drawCheats', drawCheatsEngine);
  engine.replace('drawTrackPick', drawTrackPickEngine);
})(typeof window !== 'undefined' ? window : globalThis);
