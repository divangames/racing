////////////////////////////////////////////////////////
//
// DiVANEngine: настройки, камера перед карьерой, ползунок зума.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /** Пункты корня настроек — клик сравнивает те же строки. */
  const SETTINGS_MAIN = ['НАСТРОЙКА ГРАФИКИ', 'НАСТРОЙКИ ЗВУКА', 'НАСТРОЙКА ИГРЫ', 'НАЗАД'];

  /** Общая форма меню с теми же срезами и подсветкой, что у HUD гонки. */
  function hudPanel(c, x, y, w, h, fill, stroke, cut) {
    const menu = global.DiVANEngine && global.DiVANEngine.menu;
    if (menu) return menu.frame(c, x, y, w, h, h < 160 && stroke !== '#225568', String(stroke).includes('ff3158'));
    const kit = global.DiVANEngine && global.DiVANEngine.cyberKit;
    if (kit && kit.frame) {
      const accent = String(stroke).includes('ff3158') ? kit.colors.red
        : String(stroke).includes('225568') ? kit.colors.line : kit.colors.cyan;
      kit.frame(c, x, y, w, h, accent);
    } else panel(c, x, y, w, h, fill, stroke, cut);
  }

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
   * Кнопки «Сбросить» и «Применить» внизу панели.
   * @param {number} cx
   * @param {number} by
   * @param {number} [tabBase]
   * @param {number} [tabCount]
   */
  function drawSettingsActions(cx, by, tabBase, tabCount) {
    const bw = 188, bh = 44, gap = 18;
    const rx = cx - gap / 2 - bw, ax = cx + gap / 2;
    const extra = tabCount != null && tabBase != null;
    const resetSel = extra && settingsTab === tabBase;
    const applySel = extra && settingsTab === tabBase + 1;
    hudPanel(g, rx, by, bw, bh, resetSel ? 'rgba(255,61,46,.2)' : 'rgba(3,12,20,.9)', resetSel ? '#ff3158' : '#225568', 10);
    txt(g, 'СБРОСИТЬ', rx + bw / 2, by + 22, 16, resetSel ? '#ff3158' : '#78a5b8', 'center');
    hudPanel(g, ax, by, bw, bh, applySel ? 'rgba(33,221,255,.2)' : 'rgba(3,12,20,.9)', applySel ? '#b9efff' : '#225568', 10);
    txt(g, 'ПРИМЕНИТЬ', ax + bw / 2, by + 22, 16, applySel ? '#b9efff' : '#e0f6ff', 'center');
    g._setHits.push({ act: 'reset', x: rx, y: by, w: bw, h: bh });
    g._setHits.push({ act: 'apply', x: ax, y: by, w: bw, h: bh });
  }

  /**
   * Фон демо-заезда под панелями.
   * @param {boolean} heavy
   */
  function drawSettingsBackdropEngine(heavy) {
    if (heavy && global.DiVANEngine.menu) { global.DiVANEngine.menu.background(g); return; }
    ensureTitlePreview();
    const LX = (W - viewW) / 2, LY = (H - viewH) / 2;
    g.fillStyle = '#03101a'; g.fillRect(LX, LY, viewW, viewH);
    drawTitleRace();
    g.fillStyle = heavy ? 'rgba(3,12,20,.52)' : 'rgba(3,12,20,.24)';
    g.fillRect(LX, LY, viewW, viewH);
  }

  /**
   * Тень справа, чтобы заезд читался слева.
   */
  function drawSideShadeEngine() {
    const grd = g.createLinearGradient(W * 0.28, 0, W * 0.78, 0);
    grd.addColorStop(0, 'rgba(3,12,20,0)');
    grd.addColorStop(.55, 'rgba(3,12,20,.55)');
    grd.addColorStop(1, 'rgba(3,12,20,.88)');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
  }

  /**
   * Ползунок дистанции камеры.
   */
  function drawZoomBarEngine(x, y, w, sel) {
    const z = raceZoom(), t = zoomT(z, CAM_ZOOM_MIN, CAM_ZOOM_MAX);
    g.fillStyle = '#364550'; g.fillRect(x, y + 3, w, 6);
    g.fillStyle = sel ? '#c4dbe2' : '#93bac7'; g.fillRect(x, y + 3, w * t, 6);
    g.beginPath(); g.arc(x + w * t, y + 6, 7, 0, TAU);
    g.fillStyle = '#e5ebef'; g.fill();
    g.strokeStyle = '#93bac7'; g.lineWidth = 1; g.stroke();
    txt(g, 'дальше', x, y + 28, 12, '#567d8f', 'left', F_B);
    txt(g, 'ближе', x + w, y + 28, 12, '#567d8f', 'right', F_B);
    txt(g, z.toFixed(2), x + w / 2, y + 28, 13, sel ? '#b9efff' : '#78a5b8', 'center', F_B);
    g._setHits.push({ act: 'zoombar', x: x, y: y - 8, w: w, h: 36 });
  }

  /**
   * Первый заход в карьеру: подогнать кадр на демо.
   */
  function drawCameraSetupEngine() {
    ensureTitlePreview();
    const LX = (W - viewW) / 2, LY = (H - viewH) / 2;
    g.fillStyle = '#03101a'; g.fillRect(LX, LY, viewW, viewH);
    drawTitleRace();
    const fade = g.createLinearGradient(0, H * .42, 0, H);
    fade.addColorStop(0, 'rgba(3,12,20,0)');
    fade.addColorStop(.35, 'rgba(3,12,20,.45)');
    fade.addColorStop(1, 'rgba(3,12,20,.88)');
    g.fillStyle = fade; g.fillRect(0, 0, W, H);
    g._setHits = [];
    const cx = W / 2, cardW = 760, cardX = cx - cardW / 2, cardY = H - 268;
    hudPanel(g, cardX, cardY, cardW, 236, 'rgba(3,12,20,.86)', '#21ddff', 16);
    txt(g, 'КАМЕРА', cx, cardY + 36, 32, '#b9efff', 'center');
    txt(g, 'Смотри заезд. Подгони дистанцию, пока машина не сядет в кадр.', cx, cardY + 68, 14, '#e0f6ff', 'center', F_B);
    drawZoomBar(cardX + 48, cardY + 102, cardW - 96, true);
    const bx = cx - 150, by = cardY + 152, bw = 300, bh = 48;
    hudPanel(g, bx, by, bw, bh, 'rgba(33,221,255,.2)', '#b9efff', 12);
    txt(g, 'ДАЛЬШЕ', cx, by + 24, 20, '#b9efff', 'center');
    g._setHits.push({ act: 'camGo', x: bx, y: by, w: bw, h: bh });
    txt(g, '← → или колесо — зум  •  ENTER — дальше, если так удобно', cx, cardY + 218, 13, '#567d8f', 'center', F_B);
    if (cameraSetupHint) {
      g.fillStyle = 'rgba(3,12,20,.7)'; g.fillRect(0, 0, W, H);
      const mx0 = W / 2 - 310, my0 = H / 2 - 120, mw = 620, mh = 240;
      hudPanel(g, mx0, my0, mw, mh, 'rgba(14,11,20,.96)', '#b9efff', 16);
      txt(g, 'НА ЗАМЕТКУ', W / 2, my0 + 48, 28, '#b9efff', 'center');
      const hint = 'Если в гонке кадр не зайдёт — зайди в Настройки → Настройка графики. Там тот же ползунок камеры.';
      const lines = layoutLines(g, hint, mw - 64, 16, F_B);
      lines.forEach(function (ln, i) { txt(g, ln, W / 2, my0 + 96 + i * 22, 16, '#e0f6ff', 'center', F_B); });
      hudPanel(g, W / 2 - 130, my0 + mh - 64, 260, 44, 'rgba(33,221,255,.2)', '#b9efff', 10);
      txt(g, 'ПОНЯТНО', W / 2, my0 + mh - 42, 18, '#b9efff', 'center');
      g._setHits = [{ act: 'camHint', x: mx0, y: my0, w: mw, h: mh }];
    }
  }

  /**
   * Разделы графики, звука, игры и раскладки.
   */
  function drawSettingsEngine() {
    if (typeof beginSettingsDraft === 'function' && !global._settingsDraftOn) beginSettingsDraft();
    drawSettingsBackdrop(settingsState !== 'graphics');
    g._setHits = [];
    if (settingsState === 'graphics') drawSideShade();

    if (settingsState === 'main') {
      txt(g, 'НАСТРОЙКИ', W / 2, 86, 36, '#b9efff', 'center');
      txt(g, 'ПАРАМЕТРЫ СИСТЕМЫ  /  ДЕМО-ЗАЕЗД', W / 2, 124, 15, '#78a5b8', 'center', F_B);
      SETTINGS_MAIN.forEach(function (t, i) {
        const y = 210 + i * 64, sel = i === settingsTab;
        const bx = W / 2 - 240, by = y - 28, bw = 480, bh = 52;
        if (global.DiVANEngine.menu) {
          global.DiVANEngine.menu.row(g, bx, by, bw, bh, t, sel, {id: 'settings-main-' + i, number: String(i + 1).padStart(2, '0')});
        } else {
          hudPanel(g, bx, by, bw, bh, 'rgba(3,12,20,.72)', sel ? '#21ddff' : '#225568');
          txt(g, t, W / 2, y, 20, '#e0f6ff', 'center');
        }
        g._setHits.push({ act: 'main', i: i, x: bx, y: by, w: bw, h: bh });
      });
      drawSettingsActions(W / 2, H - 96, 4, 2);
      txt(g, 'ENTER — открыть • ESC — отменить • ПРИМЕНИТЬ — сохранить изменения', W / 2, H - 28, 13, '#567d8f', 'center', F_B);
      return;
    }

    const px = settingsState === 'graphics' ? W - 536 : W / 2 - 254, py = 28, pw = 508, ph = H - 56;
    hudPanel(g, px, py, pw, ph, 'rgba(3,12,20,.82)', '#21ddff', 18);

    if (settingsState === 'graphics') {
      txt(g, 'ГРАФИКА', px + pw / 2, py + 42, 26, '#b9efff', 'center');
      txt(g, 'Камера меняется сразу — смотри заезд слева', px + pw / 2, py + 70, 13, '#78a5b8', 'center', F_B);
      const opts = gfxOpts();
      opts.forEach(function (opt, i) {
        const y = i === 0 ? py + 112 : py + 210 + (i - 1) * 48;
        const sel = i === settingsTab;
        const rowH = i === 0 ? 86 : 48;
        const by = i === 0 ? y - 18 : y - 22;
        hudPanel(g, px + 16, by, pw - 32, rowH, 'rgba(33,221,255,.12)', sel ? '#21ddff' : '#225568', 10);
        if (opt.type === 'back') {
          txt(g, opt.label, px + pw / 2, y, 18, sel ? '#b9efff' : '#78a5b8', 'center', F_B);
          g._setHits.push({ act: 'back', x: px + 16, y: by, w: pw - 32, h: rowH });
          return;
        }
        txt(g, opt.label, px + 36, y, 16, '#e0f6ff', 'left', F_B);
        g._setHits.push({ act: 'gfx', i: i, x: px + 16, y: by, w: pw - 32, h: rowH });
        if (opt.type === 'zoom') drawZoomBar(px + 36, y + 22, pw - 72, sel);
        else if (opt.type === 'bool') {
          const val = settings.graphics[opt.key];
          txt(g, val ? 'ВКЛ' : 'ВЫКЛ', px + pw - 36, y, 18, val ? '#58ff6b' : '#ff3158', 'right');
        } else if (opt.type === 'range') {
          const value = settings.graphics.shake === false ? 0 : (settings.graphics[opt.key] ?? 60);
          const x = px + 258, width = pw - 346;
          g.fillStyle = '#25434d'; g.fillRect(x, y - 3, width, 6);
          g.fillStyle = '#79dce6'; g.fillRect(x, y - 3, width * value / 100, 6);
          txt(g, value + '%', px + pw - 36, y, 15, '#b9efff', 'right');
          g._setHits.push({act: 'gfxRange', i, key: opt.key, x: x - 8, y: y - 15, w: width + 16, h: 30, start: x, width});
        } else if (opt.type === 'res') {
          txt(g, RESOLUTIONS[settings.graphics.resolution || 0].name, px + pw - 36, y, 15, '#b9efff', 'right');
        } else if (opt.type === 'display') {
          const selected = displayChoices().find(function (choice) { return choice.id === settings.graphics.displayId; });
          txt(g, selected ? selected.name : 'Основной экран', px + pw - 36, y, 14, '#b9efff', 'right');
        } else {
          const idx = opt.values.indexOf(settings.graphics[opt.key]);
          txt(g, opt.labels[idx], px + pw - 36, y, 18, '#b9efff', 'right');
        }
      });
      txt(g, '← → менять • колесо — камера • ESC назад', px + pw / 2, py + ph - 22, 12, '#567d8f', 'center', F_B);
      drawSettingsActions(px + pw / 2, py + ph - 74, gfxOpts().length, 2);
    } else if (settingsState === 'sound') {
      txt(g, 'ЗВУК', px + pw / 2, py + 36, 24, '#b9efff', 'center');
      const opts = sndOpts();
      opts.forEach(function (opt, i) {
        const y = py + 88 + i * 54, sel = i === settingsTab, by = y - 22, bh = 46;
        hudPanel(g, px + 16, by, pw - 32, bh, 'rgba(33,221,255,.12)', sel ? '#21ddff' : '#225568', 10);
        if (opt.type === 'back') {
          txt(g, opt.label, px + pw / 2, y, 16, sel ? '#b9efff' : '#78a5b8', 'center', F_B);
          g._setHits.push({ act: 'back', x: px + 16, y: by, w: pw - 32, h: bh });
          return;
        }
        txt(g, opt.label, px + 36, y - 8, 15, '#e0f6ff', 'left', F_B);
        g._setHits.push({ act: 'snd', i: i, x: px + 16, y: by, w: pw - 32, h: bh });
        if (opt.type === 'vol') {
          const raw = settings.sound[opt.key];
          const n = raw == null ? 80 : raw;
          const v = n / 100;
          const col = sel ? '#c4dbe2' : '#93bac7';
          g.fillStyle = '#364550'; g.fillRect(px + 36, y + 8, pw - 120, 6);
          g.fillStyle = col; g.fillRect(px + 36, y + 8, (pw - 120) * v, 6);
          g.beginPath(); g.arc(px + 36 + (pw - 120) * v, y + 11, 5, 0, TAU); g.fill();
          g._setHits.push({act: 'sndRange', i, key: opt.key, x: px + 28, y: y, w: pw - 104, h: 26, start: px + 36, width: pw - 120});
          txt(g, n + '%', px + pw - 36, y + 12, 14, col, 'right');
        } else {
          const on = settings.sound[opt.key];
          txt(g, on ? 'ВКЛ' : 'ВЫКЛ', px + pw - 36, y, 16, on ? '#58ff6b' : '#ff3158', 'right');
        }
      });
      txt(g, '← → менять • ESC назад', px + pw / 2, py + ph - 22, 12, '#567d8f', 'center', F_B);
      drawSettingsActions(px + pw / 2, py + ph - 74, sndOpts().length, 2);
    } else if (settingsState === 'game') {
      txt(g, 'ИГРА', px + pw / 2, py + 42, 26, '#b9efff', 'center');
      const opts = gameOpts();
      opts.forEach(function (opt, i) {
        const y = py + 140 + i * 72, sel = i === settingsTab, by = y - 28, bh = 56;
        hudPanel(g, px + 16, by, pw - 32, bh, 'rgba(33,221,255,.12)', sel ? '#21ddff' : '#225568', 10);
        txt(g, opt.label, px + pw / 2, y, opt.type === 'back' ? 18 : 20, sel ? '#b9efff' : (opt.type === 'back' ? '#78a5b8' : '#e0f6ff'), 'center', F_B);
        g._setHits.push({ act: opt.type === 'back' ? 'back' : 'game', i: i, x: px + 16, y: by, w: pw - 32, h: bh });
      });
      txt(g, 'ENTER — открыть • ESC назад', px + pw / 2, py + ph - 22, 13, '#567d8f', 'center', F_B);
      drawSettingsActions(px + pw / 2, py + ph - 74, gameOpts().length, 2);
    } else if (settingsState === 'controls') {
      txt(g, 'УПРАВЛЕНИЕ', px + pw / 2, py + 36, 22, '#b9efff', 'center');
      txt(g, 'Раскладка клавиатуры', px + pw / 2, py + 62, 13, '#78a5b8', 'center', F_B);
      const keys_list = controlOpts();
      keys_list.forEach(function (k, i) {
        const y = py + 88 + i * 46, sel = i === settingsTab && !controlCaptureKey, by = y - 16, bh = 38;
        if (k.type === 'back') {
          hudPanel(g, px + 16, by, pw - 32, bh, 'rgba(33,221,255,.12)', sel ? '#21ddff' : '#225568', 10);
          txt(g, k.label, px + pw / 2, y, 16, sel ? '#b9efff' : '#78a5b8', 'center', F_B);
          g._setHits.push({ act: 'back', x: px + 16, y: by, w: pw - 32, h: bh });
          return;
        }
        if (k.isReset) {
          hudPanel(g, px + 16, by, pw - 32, bh, 'rgba(255,61,46,.15)', sel ? '#ff3158' : '#225568', 10);
          txt(g, k.label, px + pw / 2, y, 15, sel ? '#ff3158' : '#ff6b4a', 'center', F_B);
          g._setHits.push({ act: 'ctrl', i: i, x: px + 16, y: by, w: pw - 32, h: bh });
          return;
        }
        hudPanel(g, px + 16, by, pw - 32, bh, 'rgba(33,221,255,.08)', sel ? '#21ddff' : '#225568', 10);
        txt(g, k.label, px + 36, y, 15, '#e0f6ff', 'left', F_B);
        const val = settings.controls[k.key] || [];
        let display;
        if (controlCaptureKey === k.key) {
          if (val.length === 0) display = '[ Нажми клавишу ]';
          else if (val.length === 1) display = prettyKey(val[0]) + ' (ещё или ENTER)';
          else display = val.map(prettyKey).join(' / ');
        } else {
          display = val.length === 0 ? '—' : val.map(prettyKey).join(' / ');
        }
        txt(g, display, px + pw - 36, y, 14, controlCaptureKey === k.key ? '#21ddff' : '#b9efff', 'right', F_B);
        g._setHits.push({ act: 'ctrl', i: i, x: px + 16, y: by, w: pw - 32, h: bh });
      });
      txt(g, 'ENTER — изменить • BACKSPACE — стереть • ESC — отмена • M/R/F3 заняты', px + pw / 2, py + ph - 22, 12, '#567d8f', 'center', F_B);
      drawSettingsActions(px + pw / 2, py + ph - 74, controlOpts().length, 2);
    }
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.options = { SETTINGS_MAIN, zoomT };
  /**
   * Пункты звука: музыка, эффекты, биом и арена отдельно.
   * @returns {object[]}
   */
  function sndOptsEngine() {
    return [
      { label: 'Громкость музыки', key: 'music', type: 'vol' },
      { label: 'Громкость эффектов', key: 'sfx', type: 'vol' },
      { label: 'Атмосфера биома', key: 'biome', type: 'vol' },
      { label: 'Звук арены', key: 'crowd', type: 'vol' },
      { label: 'Музыка', key: 'musicOn', type: 'bool' },
      { label: 'Эффекты', key: 'sfxOn', type: 'bool' }
    ];
  }

  /**
   * Графика без «Назад»: выход — ESC, запись — «Применить».
   * @returns {object[]}
   */
  function gfxOptsEngine() {
    return [
      { label: 'Камера', key: 'cameraZoom', type: 'zoom' },
      { label: 'Разрешение экрана', key: 'resolution', type: 'res' },
      { label: 'Полный экран', key: 'fullscreen', type: 'bool' },
      { label: 'Выбор экрана', key: 'displayId', type: 'display' },
      { label: 'Частицы', key: 'particles', type: 'enum', values: ['low', 'medium', 'high'], labels: ['Низкое', 'Среднее', 'Высокое'] },
      { label: 'Следы от шин', key: 'skids', type: 'bool' },
      { label: 'Эффекты погоды', key: 'weather', type: 'bool' },
      { label: 'Сила тряски', key: 'shakeStrength', type: 'range' },
      { label: 'Показывать FPS', key: 'showFps', type: 'bool' }
    ];
  }

  /** Мониторы из Electron; в браузере доступен только текущий экран. */
  function displayChoices() {
    return global.rnrDisplayChoices && global.rnrDisplayChoices.length
      ? global.rnrDisplayChoices : [{ id: null, name: 'Основной экран' }];
  }

  function nudgeGraphicsEngine(dir) {
    const opt = gfxOpts()[settingsTab];
    if (!opt) return false;
    if (opt.type === 'range') {
      const before = settings.graphics.shake === false ? 0 : (settings.graphics.shakeStrength ?? 60);
      settings.graphics.shakeStrength = clamp(before + dir * 10, 0, 100);
      settings.graphics.shake = settings.graphics.shakeStrength > 0;
      saveSettings(); return true;
    }
    if (opt.type === 'display') {
      const choices = displayChoices();
      const at = choices.findIndex(function (choice) { return choice.id === settings.graphics.displayId; });
      settings.graphics.displayId = choices[((at < 0 ? 0 : at) + (dir > 0 ? 1 : -1) + choices.length) % choices.length].id;
      saveSettings();
      return true;
    }
    if (opt.key === 'fullscreen') {
      settings.graphics.fullscreen = !settings.graphics.fullscreen;
      saveSettings();
      return true;
    }
    return engine.original('nudgeGraphics')(dir);
  }

  /**
   * Игра: только переход к раскладке.
   * @returns {object[]}
   */
  function gameOptsEngine() {
    return [
      { label: 'Настройки управления', key: '_controls', type: 'goto', to: 'controls' }
    ];
  }

  /**
   * Клавиши без сброса в списке — сброс кнопкой внизу.
   * @returns {object[]}
   */
  function controlOptsEngine() {
    return [
      { label: 'Газ', key: 'up' },
      { label: 'Тормоз', key: 'down' },
      { label: 'Влево', key: 'left' },
      { label: 'Вправо', key: 'right' },
      { label: 'Оружие', key: 'fire' },
      { label: 'Нитро', key: 'nitro' },
      { label: 'Ульта', key: 'ult' },
      { label: 'Ручник', key: 'handbrake' },
      { label: 'Вернуться на трассу', key: 'recover' },
      { label: 'Пауза', key: 'pause' }
    ];
  }

  /**
   * Шаг ползунка или тумблера; все каналы через applyAudioSettings.
   * @param {number} dir
   * @returns {boolean}
   */
  function nudgeSoundEngine(dir) {
    const opt = sndOpts()[settingsTab];
    if (!opt || opt.type === 'back' || opt.type === 'apply' || opt.type === 'reset') return false;
    if (opt.type === 'vol') {
      settings.sound[opt.key] = clamp((settings.sound[opt.key] || 0) + dir * 10, 0, 100);
      if (typeof applyAudioSettings === 'function') applyAudioSettings();
    } else if (opt.type === 'bool') {
      settings.sound[opt.key] = !settings.sound[opt.key];
      if (typeof applyAudioSettings === 'function') applyAudioSettings();
    }
    if (typeof saveSettings === 'function') saveSettings();
    return true;
  }

  engine.replace('drawSettingsBackdrop', drawSettingsBackdropEngine);
  engine.replace('drawSideShade', drawSideShadeEngine);
  engine.replace('drawZoomBar', drawZoomBarEngine);
  engine.replace('drawCameraSetup', drawCameraSetupEngine);
  engine.replace('drawSettings', drawSettingsEngine);
  engine.replace('sndOpts', sndOptsEngine);
  engine.replace('gfxOpts', gfxOptsEngine);
  engine.replace('nudgeGraphics', nudgeGraphicsEngine);
  engine.replace('gameOpts', gameOptsEngine);
  engine.replace('controlOpts', controlOptsEngine);
  engine.replace('nudgeSound', nudgeSoundEngine);
})(typeof window !== 'undefined' ? window : globalThis);
