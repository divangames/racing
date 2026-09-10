////////////////////////////////////////////////////////
//
// DiVANEngine: настройки, камера перед карьерой, ползунок зума.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /** Пункты корня настроек — клик сравнивает те же строки. */
  const SETTINGS_MAIN = ['НАСТРОЙКА ГРАФИКИ', 'НАСТРОЙКИ ЗВУКА', 'НАСТРОЙКА ИГРЫ', 'НАЗАД'];

  /**
   * Доля ползунка камеры 0…1.
   * @param {number} z
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  function zoomT(z, min, max) {
    return (z - min) / (max - min);
  }

  /**
   * Фон демо-заезда под панелями.
   * @param {boolean} heavy
   */
  function drawSettingsBackdropEngine(heavy) {
    ensureTitlePreview();
    const LX = (W - viewW) / 2, LY = (H - viewH) / 2;
    g.fillStyle = '#050409'; g.fillRect(LX, LY, viewW, viewH);
    drawTitleRace();
    g.fillStyle = heavy ? 'rgba(5,4,9,.42)' : 'rgba(5,4,9,.18)';
    g.fillRect(LX, LY, viewW, viewH);
  }

  /**
   * Тень справа, чтобы заезд читался слева.
   */
  function drawSideShadeEngine() {
    const grd = g.createLinearGradient(W * 0.28, 0, W * 0.78, 0);
    grd.addColorStop(0, 'rgba(5,4,9,0)');
    grd.addColorStop(.55, 'rgba(5,4,9,.55)');
    grd.addColorStop(1, 'rgba(8,6,14,.88)');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
  }

  /**
   * Ползунок дистанции камеры.
   */
  function drawZoomBarEngine(x, y, w, sel) {
    const z = raceZoom(), t = zoomT(z, CAM_ZOOM_MIN, CAM_ZOOM_MAX);
    g.fillStyle = '#16131c'; g.fillRect(x, y, w, 12);
    g.fillStyle = sel ? '#ffd23f' : '#c9a227'; g.fillRect(x, y, w * t, 12);
    g.beginPath(); g.arc(x + w * t, y + 6, 9, 0, TAU);
    g.fillStyle = sel ? '#fff4c8' : '#e8e2d0'; g.fill();
    g.strokeStyle = sel ? '#ff9d2e' : '#6f6880'; g.lineWidth = 2; g.stroke();
    txt(g, 'дальше', x, y + 28, 12, '#6f6880', 'left', F_B);
    txt(g, 'ближе', x + w, y + 28, 12, '#6f6880', 'right', F_B);
    txt(g, z.toFixed(2), x + w / 2, y + 28, 13, sel ? '#ffd23f' : '#9a93a8', 'center', F_B);
    g._setHits.push({ act: 'zoombar', x: x, y: y - 8, w: w, h: 36 });
  }

  /**
   * Первый заход в карьеру: подогнать кадр на демо.
   */
  function drawCameraSetupEngine() {
    ensureTitlePreview();
    const LX = (W - viewW) / 2, LY = (H - viewH) / 2;
    g.fillStyle = '#050409'; g.fillRect(LX, LY, viewW, viewH);
    drawTitleRace();
    const fade = g.createLinearGradient(0, H * .42, 0, H);
    fade.addColorStop(0, 'rgba(5,4,9,0)');
    fade.addColorStop(.35, 'rgba(5,4,9,.45)');
    fade.addColorStop(1, 'rgba(5,4,9,.88)');
    g.fillStyle = fade; g.fillRect(0, 0, W, H);
    g._setHits = [];
    const cx = W / 2, cardW = 760, cardX = cx - cardW / 2, cardY = H - 268;
    panel(g, cardX, cardY, cardW, 236, 'rgba(10,8,16,.86)', '#ff9d2e', 16);
    txt(g, 'КАМЕРА', cx, cardY + 36, 32, '#ffd23f', 'center');
    txt(g, 'Смотри заезд. Подгони дистанцию, пока машина не сядет в кадр.', cx, cardY + 68, 14, '#c8c2d4', 'center', F_B);
    drawZoomBar(cardX + 48, cardY + 102, cardW - 96, true);
    const bx = cx - 150, by = cardY + 152, bw = 300, bh = 48;
    panel(g, bx, by, bw, bh, 'rgba(255,157,46,.2)', '#ffd23f', 12);
    txt(g, 'ДАЛЬШЕ', cx, by + 24, 20, '#ffd23f', 'center');
    g._setHits.push({ act: 'camGo', x: bx, y: by, w: bw, h: bh });
    txt(g, '← → или колесо — зум  •  ENTER — дальше, если так удобно', cx, cardY + 218, 13, '#6f6880', 'center', F_B);
    if (cameraSetupHint) {
      g.fillStyle = 'rgba(4,3,8,.62)'; g.fillRect(0, 0, W, H);
      const mx0 = W / 2 - 310, my0 = H / 2 - 120, mw = 620, mh = 240;
      panel(g, mx0, my0, mw, mh, 'rgba(14,11,20,.96)', '#ffd23f', 16);
      txt(g, 'НА ЗАМЕТКУ', W / 2, my0 + 48, 28, '#ffd23f', 'center');
      const hint = 'Если в гонке кадр не зайдёт — зайди в Настройки → Настройка графики. Там тот же ползунок камеры.';
      const lines = layoutLines(g, hint, mw - 64, 16, F_B);
      lines.forEach(function (ln, i) { txt(g, ln, W / 2, my0 + 96 + i * 22, 16, '#e8e2d0', 'center', F_B); });
      panel(g, W / 2 - 130, my0 + mh - 64, 260, 44, 'rgba(255,157,46,.2)', '#ffd23f', 10);
      txt(g, 'ПОНЯТНО', W / 2, my0 + mh - 42, 18, '#ffd23f', 'center');
      g._setHits = [{ act: 'camHint', x: mx0, y: my0, w: mw, h: mh }];
    }
  }

  /**
   * Разделы графики, звука, игры и раскладки.
   */
  function drawSettingsEngine() {
    drawSettingsBackdrop(settingsState !== 'graphics');
    g._setHits = [];
    if (settingsState === 'graphics') drawSideShade();

    if (settingsState === 'main') {
      txt(g, 'НАСТРОЙКИ', W / 2, 86, 36, '#ffd23f', 'center');
      txt(g, 'Демо-заезд крутится сзади — разделы не прячут картинку', W / 2, 124, 15, '#9a93a8', 'center', F_B);
      SETTINGS_MAIN.forEach(function (t, i) {
        const y = 210 + i * 64, sel = i === settingsTab;
        const bx = W / 2 - 240, by = y - 28, bw = 480, bh = 52;
        if (sel) panel(g, bx, by, bw, bh, 'rgba(255,157,46,.18)', '#ff9d2e');
        else panel(g, bx, by, bw, bh, 'rgba(8,6,14,.72)', '#2e2a38');
        txt(g, t, W / 2, y, sel ? 24 : 20, sel ? '#ffd23f' : '#c8c2d4', 'center');
        g._setHits.push({ act: 'main', i: i, x: bx, y: by, w: bw, h: bh });
      });
      txt(g, 'ENTER — открыть • ESC — выход', W / 2, H - 28, 14, '#6f6880', 'center', F_B);
      return;
    }

    const px = W - 536, py = 28, pw = 508, ph = H - 56;
    panel(g, px, py, pw, ph, 'rgba(10,8,16,.82)', '#ff9d2e', 18);

    if (settingsState === 'graphics') {
      txt(g, 'ГРАФИКА', px + pw / 2, py + 42, 26, '#ffd23f', 'center');
      txt(g, 'Камера меняется сразу — смотри заезд слева', px + pw / 2, py + 70, 13, '#9a93a8', 'center', F_B);
      const opts = gfxOpts();
      opts.forEach(function (opt, i) {
        const y = i === 0 ? py + 112 : py + 210 + (i - 1) * 48;
        const sel = i === settingsTab;
        const rowH = i === 0 ? 86 : 48;
        const by = i === 0 ? y - 18 : y - 22;
        if (sel) panel(g, px + 16, by, pw - 32, rowH, 'rgba(255,157,46,.12)', '#ff9d2e', 10);
        if (opt.type === 'back') {
          txt(g, opt.label, px + pw / 2, y, 18, sel ? '#ffd23f' : '#8f88a0', 'center', F_B);
          g._setHits.push({ act: 'back', x: px + 16, y: by, w: pw - 32, h: rowH });
          return;
        }
        txt(g, opt.label, px + 36, y, 16, '#e8e2d0', 'left', F_B);
        g._setHits.push({ act: 'gfx', i: i, x: px + 16, y: by, w: pw - 32, h: rowH });
        if (opt.type === 'zoom') drawZoomBar(px + 36, y + 22, pw - 72, sel);
        else if (opt.type === 'bool') {
          const val = settings.graphics[opt.key];
          txt(g, val ? 'ВКЛ' : 'ВЫКЛ', px + pw - 36, y, 18, val ? '#58ff6b' : '#ff3d2e', 'right');
        } else if (opt.type === 'res') {
          txt(g, RESOLUTIONS[settings.graphics.resolution || 0].name, px + pw - 36, y, 15, '#ffd23f', 'right');
        } else {
          const idx = opt.values.indexOf(settings.graphics[opt.key]);
          txt(g, opt.labels[idx], px + pw - 36, y, 18, '#ffd23f', 'right');
        }
      });
      txt(g, '← → менять • колесо — камера • ESC назад', px + pw / 2, py + ph - 22, 12, '#6f6880', 'center', F_B);
    } else if (settingsState === 'sound') {
      txt(g, 'ЗВУК', px + pw / 2, py + 42, 26, '#ffd23f', 'center');
      const opts = sndOpts();
      opts.forEach(function (opt, i) {
        const y = py + 120 + i * 72, sel = i === settingsTab, by = y - 28, bh = 56;
        if (sel) panel(g, px + 16, by, pw - 32, bh, 'rgba(255,157,46,.12)', '#ff9d2e', 10);
        if (opt.type === 'back') {
          txt(g, opt.label, px + pw / 2, y, 18, sel ? '#ffd23f' : '#8f88a0', 'center', F_B);
          g._setHits.push({ act: 'back', x: px + 16, y: by, w: pw - 32, h: bh });
          return;
        }
        txt(g, opt.label, px + 36, y - 8, 16, '#e8e2d0', 'left', F_B);
        g._setHits.push({ act: 'snd', i: i, x: px + 16, y: by, w: pw - 32, h: bh });
        if (opt.type === 'vol') {
          const v = settings.sound[opt.key] / 100, col = opt.key === 'music' ? '#ffd23f' : '#35e0ff';
          g.fillStyle = '#16131c'; g.fillRect(px + 36, y + 10, pw - 120, 10);
          g.fillStyle = col; g.fillRect(px + 36, y + 10, (pw - 120) * v, 10);
          txt(g, settings.sound[opt.key] + '%', px + pw - 36, y + 16, 15, col, 'right');
        } else {
          const on = settings.sound[opt.key];
          txt(g, on ? 'ВКЛ' : 'ВЫКЛ', px + pw - 36, y, 18, on ? '#58ff6b' : '#ff3d2e', 'right');
        }
      });
      txt(g, '← → менять • ESC назад', px + pw / 2, py + ph - 22, 13, '#6f6880', 'center', F_B);
    } else if (settingsState === 'game') {
      txt(g, 'ИГРА', px + pw / 2, py + 42, 26, '#ffd23f', 'center');
      const opts = gameOpts();
      opts.forEach(function (opt, i) {
        const y = py + 140 + i * 72, sel = i === settingsTab, by = y - 28, bh = 56;
        if (sel) panel(g, px + 16, by, pw - 32, bh, 'rgba(255,157,46,.12)', '#ff9d2e', 10);
        else panel(g, px + 16, by, pw - 32, bh, 'rgba(8,6,14,.35)', '#2e2a38', 10);
        txt(g, opt.label, px + pw / 2, y, opt.type === 'back' ? 18 : 20, sel ? '#ffd23f' : (opt.type === 'back' ? '#8f88a0' : '#e8e2d0'), 'center', F_B);
        g._setHits.push({ act: opt.type === 'back' ? 'back' : 'game', i: i, x: px + 16, y: by, w: pw - 32, h: bh });
      });
      txt(g, 'ENTER — открыть • ESC назад', px + pw / 2, py + ph - 22, 13, '#6f6880', 'center', F_B);
    } else if (settingsState === 'controls') {
      txt(g, 'УПРАВЛЕНИЕ', px + pw / 2, py + 36, 22, '#ffd23f', 'center');
      txt(g, 'Раскладка клавиатуры', px + pw / 2, py + 62, 13, '#9a93a8', 'center', F_B);
      const keys_list = controlOpts();
      keys_list.forEach(function (k, i) {
        const y = py + 88 + i * 46, sel = i === settingsTab && !controlCaptureKey, by = y - 16, bh = 38;
        if (k.type === 'back') {
          if (sel) panel(g, px + 16, by, pw - 32, bh, 'rgba(255,157,46,.12)', '#ff9d2e', 10);
          txt(g, k.label, px + pw / 2, y, 16, sel ? '#ffd23f' : '#8f88a0', 'center', F_B);
          g._setHits.push({ act: 'back', x: px + 16, y: by, w: pw - 32, h: bh });
          return;
        }
        if (k.isReset) {
          if (sel) panel(g, px + 16, by, pw - 32, bh, 'rgba(255,61,46,.15)', '#ff3d2e', 10);
          txt(g, k.label, px + pw / 2, y, 15, sel ? '#ff3d2e' : '#ff6b4a', 'center', F_B);
          g._setHits.push({ act: 'ctrl', i: i, x: px + 16, y: by, w: pw - 32, h: bh });
          return;
        }
        if (sel) panel(g, px + 16, by, pw - 32, bh, 'rgba(255,157,46,.08)', '#ff9d2e', 10);
        txt(g, k.label, px + 36, y, 15, '#e8e2d0', 'left', F_B);
        const val = settings.controls[k.key] || [];
        let display;
        if (controlCaptureKey === k.key) {
          if (val.length === 0) display = '[ Нажми клавишу ]';
          else if (val.length === 1) display = prettyKey(val[0]) + ' (ещё или ENTER)';
          else display = val.map(prettyKey).join(' / ');
        } else {
          display = val.length === 0 ? '—' : val.map(prettyKey).join(' / ');
        }
        txt(g, display, px + pw - 36, y, 14, controlCaptureKey === k.key ? '#ff9d2e' : '#ffd23f', 'right', F_B);
        g._setHits.push({ act: 'ctrl', i: i, x: px + 16, y: by, w: pw - 32, h: bh });
      });
      txt(g, 'ENTER — изменить • BACKSPACE — стереть • ESC — отмена', px + pw / 2, py + ph - 22, 12, '#6f6880', 'center', F_B);
    }
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.options = { SETTINGS_MAIN, zoomT };
  engine.replace('drawSettingsBackdrop', drawSettingsBackdropEngine);
  engine.replace('drawSideShade', drawSideShadeEngine);
  engine.replace('drawZoomBar', drawZoomBarEngine);
  engine.replace('drawCameraSetup', drawCameraSetupEngine);
  engine.replace('drawSettings', drawSettingsEngine);
})(typeof window !== 'undefined' ? window : globalThis);
