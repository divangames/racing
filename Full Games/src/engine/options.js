////////////////////////////////////////////////////////
//
// DiVANEngine: настройки, камера перед карьерой, ползунок зума.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /** Пункты корня настроек — клик сравнивает те же строки. */
  const SETTINGS_MAIN = ['НАСТРОЙКА ГРАФИКИ', 'НАСТРОЙКИ ЗВУКА', 'НАСТРОЙКА ИГРЫ', 'НАЗАД'];
  const cameraAtlas = typeof Image !== 'undefined' ? new Image() : null;
  if (cameraAtlas) cameraAtlas.src = '/__engine/title-ui-assets/camera-calibration-atlas.png';
  function cameraPart(sx, sy, sw, sh, x, y, w, h) {
    if (!cameraAtlas?.complete || !cameraAtlas.naturalWidth) return;
    // Coordinates refer to the supplied 1672×941 atlas; never render its baked UI.
    const scaleX = cameraAtlas.naturalWidth / 1672, scaleY = cameraAtlas.naturalHeight / 941;
    g.drawImage(cameraAtlas, sx*scaleX, sy*scaleY, sw*scaleX, sh*scaleY, x, y, w, h);
  }
  function cameraMetal(x,y,w,h,opacity=.65) {
    // Repeat a small blank header patch at its original density, without labels.
    g.save();g.beginPath();g.rect(x,y,w,h);g.clip();g.globalAlpha*=opacity;
    for(let yy=y;yy<y+h;yy+=28)for(let xx=x;xx<x+w;xx+=180)
      cameraPart(390,112,270,23,xx,yy,180,28);
    g.restore();
  }

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
    g._setHits = [];
    const M = global.DiVANEngine.menu, C = M?.colors || {text:'#edf2ef',muted:'#a6b2b8',cool:'#91adb8',accent:'#efb342',line:'#45545b'};
    const cx = W / 2, cardW = Math.min(760, W - 72), cardX = cx - cardW / 2, cardY = H - 262, cardH = 190;
    const label = (s,x,y,size,color,align='center',width,heavy=false) => M ? M.text(g,s,x,y,size,color,align,width,heavy) : txt(g,s,x,y,size,color,align,F_B);
    g.save();
    // The backing stays inside the atlas rails; no generic outer menu frame.
    g.fillStyle='#11181d';
    g.fillRect(cardX+16,cardY+13,cardW-32,cardH-27);
    cameraMetal(cardX+16,cardY+13,cardW-32,cardH-27);
    // Assemble only blank edge strips, handles and the insignia from the atlas.
    cameraPart(150,58,1378,22,cardX,cardY,cardW,13);
    cameraPart(180,386,420,29,cardX+12,cardY+cardH-14,cardW/2-12,14);
    cameraPart(1080,386,420,29,cx,cardY+cardH-14,cardW/2-12,14);
    cameraPart(150,80,30,300,cardX,cardY+13,16,cardH-27);
    cameraPart(1488,80,32,300,cardX+cardW-16,cardY+13,16,cardH-27);
    cameraPart(94,125,60,190,cardX-23,cardY+32,28,113);
    cameraPart(1518,125,60,190,cardX+cardW-5,cardY+32,28,113);
    cameraPart(220,86,135,112,cardX+28,cardY+16,54,45);
    g.fillStyle='#4eafc3';g.globalAlpha=.8;g.fillRect(cardX+132,cardY+15,76,1);g.fillRect(cardX+cardW-210,cardY+15,76,1);g.globalAlpha=1;
    label('КАМЕРА',cx,cardY+28,27,C.text,'center',cardW-240,true);
    label('Настрой обзор с бортовой камеры перед стартом',cx,cardY+52,12,C.muted,'center',cardW-180);
    label('CAM–01',cardX+cardW-34,cardY+30,11,C.cool,'right');
    label('RACE UNIT',cardX+cardW-34,cardY+47,8,C.muted,'right');
    g.fillStyle='#4eafc3';for(let i=0;i<3;i++){const x=cardX+cardW-59+i*8;g.beginPath();g.moveTo(x,cardY+54);g.lineTo(x+5,cardY+54);g.lineTo(x-2,cardY+62);g.lineTo(x-7,cardY+62);g.closePath();g.fill();}
    g.fillStyle=C.line;g.fillRect(cardX+26,cardY+68,cardW-52,1);
    const railX=cardX+106,railW=cardW-212,railY=cardY+96,z=raceZoom(),t=Math.max(0,Math.min(1,zoomT(z,CAM_ZOOM_MIN,CAM_ZOOM_MAX))),thumb=railX+railW*t;
    const bx=cx-123,by=cardY+139,bw=246,bh=48;
    const buttonActive=mx>=bx&&mx<=bx+bw&&my>=by&&my<=by+bh&&M?.inputMode()==='mouse';
    const sliderActive = settingsZoomDrag || !buttonActive;
    g.strokeStyle=C.cool;g.lineWidth=1;
    for(let i=0;i<=12;i++){const x=railX+railW*i/12;g.beginPath();g.moveTo(x,railY-13);g.lineTo(x,railY-7);g.moveTo(x,railY+7);g.lineTo(x,railY+13);g.stroke();}
    g.fillStyle=C.line;g.fillRect(railX,railY-3,railW,6);g.fillStyle=sliderActive?C.accent:C.cool;g.fillRect(railX,railY-3,railW*t,6);
    g.shadowColor=C.accent;g.shadowBlur=sliderActive?6:0;g.beginPath();g.arc(thumb,railY,11,0,TAU);g.fillStyle='#172025';g.fill();g.strokeStyle=sliderActive?C.accent:C.cool;g.lineWidth=2;g.stroke();g.shadowBlur=0;
    g.beginPath();g.arc(thumb,railY,6,0,TAU);g.fillStyle=sliderActive?C.accent:C.text;g.fill();
    g.fillStyle=sliderActive?C.accent:C.cool;g.beginPath();g.moveTo(thumb,railY-25);g.lineTo(thumb-2,railY-20);g.lineTo(thumb,railY-14);g.lineTo(thumb+2,railY-20);g.closePath();g.fill();
    label('ДАЛЬШЕ',railX-20,railY,11,C.text,'right');label('БЛИЖЕ',railX+railW+20,railY,11,C.text,'left');
    label(String(Math.round(z*100)),thumb,railY+29,20,sliderActive?C.accent:C.text,'center',60,true);
    g._setHits.push({act:'zoombar',x:railX,y:railY-20,w:railW,h:40});
    g.fillStyle=C.line;g.fillRect(cardX+26,cardY+133,cardW-52,1);
    if(M)M.frame(g,bx,by,bw,bh,buttonActive);else hudPanel(g,bx,by,bw,bh,'#172025','#225568',10);
    cameraMetal(bx+14,by+8,bw-28,bh-16,.9);
    cameraPart(52,606,461,19,bx,by,bw,10);
    cameraPart(52,684,461,20,bx,by+bh-10,bw,10);
    cameraPart(52,625,45,59,bx,by+10,24,bh-20);
    cameraPart(470,625,43,59,bx+bw-23,by+10,23,bh-20);
    label('ДАЛЬШЕ',cx-14,by+bh/2,18,C.text,'center',bw-76,true);
    label('»',cx+46,by+bh/2,30,C.accent,'center',40,true);
    g._setHits.push({act:'camGo',x:bx,y:by,w:bw,h:bh});
    const keycap=(key,x,y,w=21)=>{g.fillStyle='#111b22';g.fillRect(x,y,w,21);g.strokeStyle=C.cool;g.lineWidth=.8;g.strokeRect(x+.5,y+.5,w-1,20);label(key,x+w/2,y+11,11,C.cool);};
    keycap('←',cardX+43,by+13);keycap('→',cardX+72,by+13);
    label('— камера / колесо',cardX+102,by+24,10,C.muted,'left',140);
    keycap('ENTER',cardX+cardW-174,by+5,43);label('дальше',cardX+cardW-121,by+16,10,C.muted,'left');
    label('ESC — МЕНЮ',cardX+cardW-174,by+34,9,C.cool,'left');
    g.restore();
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
          g.fillStyle = global.DiVANEngine.menu?.colors.accent||'#79dce6'; g.fillRect(x, y - 3, width * value / 100, 6);
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
  engine.options = { SETTINGS_MAIN, zoomT, cameraAssetsReady: () => !!cameraAtlas?.complete && cameraAtlas.naturalWidth > 0 };
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
