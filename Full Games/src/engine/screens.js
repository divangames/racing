////////////////////////////////////////////////////////
//
// DiVANEngine: каталог экранов хаба и пункты главного меню.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  const TITLE_STUDIO_LOGO = 'assets/divan_games/DIVAN_none.png';
  const TITLE_COL_X = 52;
  const TITLE_LOGO_W = 380;
  const TITLE_ITEM_W = 340;

  let titleStudioLogo = null;

  /**
   * После заставки очередь boot уже стоит: берём blob сами.
   * @param {HTMLImageElement} img
   * @param {string} src
   */
  function bindTitleSrc(img, src) {
    if (!img || img._titleLoad) return;
    img._titleLoad = true;
    const cached = (typeof BOOT !== 'undefined' && BOOT.media) ? BOOT.media[src] : '';
    if (cached) { img.src = cached; return; }
    if (typeof fetch !== 'function') { img.src = src; return; }
    fetch(src, { cache: 'no-store' }).then(function (res) {
      if (!res.ok) { img.src = src; return; }
      return res.blob().then(function (blob) {
        if (!blob || !blob.size) { img.src = src; return; }
        if (typeof bootBind === 'function') return bootBind(img, blob);
        img.src = URL.createObjectURL(blob);
      });
    }).catch(function () { img.src = src; });
  }

  /**
   * В заставку — в очередь; если загрузка уже прошла — сразу fetch.
   * @param {string} src
   * @returns {HTMLImageElement|null}
   */
  function queueTitleImage(src) {
    if (typeof Image === 'undefined') return null;
    const img = new Image();
    const booted = typeof BOOT !== 'undefined' && BOOT.ready;
    if (!booted && typeof bootEnqueue === 'function') bootEnqueue(img, [src]);
    else bindTitleSrc(img, src);
    return img;
  }

  /** Левый край видимой сцены. @returns {number} */
  function titleStageX() {
    return (typeof viewW === 'number') ? (W - viewW) / 2 : 0;
  }

  /** Правый край подписи версии. @returns {number} */
  function titleStageRight() {
    const vw = (typeof viewW === 'number' && viewW > 0) ? viewW : W;
    return titleStageX() + vw;
  }

  /** Фон под текущий экран и логотип студии. */
  function ensureTitleArt() {
    if (engineTitleBg()) engineTitleBg().ensureTitleArt();
    if (!titleStudioLogo) titleStudioLogo = queueTitleImage(TITLE_STUDIO_LOGO);
    if (!(typeof BOOT !== 'undefined' && BOOT.ready)) return;
    if (titleStudioLogo && !titleStudioLogo.naturalWidth) bindTitleSrc(titleStudioLogo, TITLE_STUDIO_LOGO);
  }

  /** API пластины, если модуль уже вставлен. @returns {object|null} */
  function engineTitleBg() {
    return (global.DiVANEngine && global.DiVANEngine.titleBg) || null;
  }

  /**
   * Фон, чей кадр ближе к экрану.
   * @param {number} [aspect]
   * @param {number} [canvasW]
   * @param {number} [canvasH]
   * @returns {string}
   */
  function pickTitleBgSrc(aspect, canvasW, canvasH) {
    const api = engineTitleBg();
    if (api && typeof api.pickTitleBgSrc === 'function') return api.pickTitleBgSrc(aspect, canvasW, canvasH);
    return 'assets/data/cats/Titles/title-medved_1920x1080.webp';
  }

  /**
   * Ширина и высота из имени `…_1920x1080.webp`.
   * @param {string} name
   * @returns {{w:number,h:number,aspect:number}|null}
   */
  function parseTitleBgSize(name) {
    const api = engineTitleBg();
    if (api && typeof api.parseTitleBgSize === 'function') return api.parseTitleBgSize(name);
    const m = String(name || '').match(/(\d+)\s*[x×]\s*(\d+)/i);
    if (!m) return null;
    return { w: +m[1], h: +m[2], aspect: +m[1] / +m[2] };
  }

  /**
   * Подпись версии из метаданных клиента.
   * @returns {string}
   */
  function gameVersionLabel() {
    const meta = global.__DIVAN_ENGINE_META__ || {};
    const v = (global.DiVANEngine && DiVANEngine.version) || meta.version || '';
    if (!v) return '';
    return /^v/i.test(v) ? v : 'v' + v;
  }

  /** Высота игрового логотипа при ширине колонки. */
  function titleLogoHeight() {
    if (titleLogo && titleLogo.complete && titleLogo.naturalWidth) {
      return TITLE_LOGO_W * titleLogo.naturalHeight / titleLogo.naturalWidth;
    }
    return 132;
  }

  /** API пунктов, если модуль уже вставлен. @returns {object|null} */
  function engineTitleMenu() {
    return (global.DiVANEngine && global.DiVANEngine.titleMenu) || null;
  }

  /**
   * Пункты титульного меню.
   * @param {object|null} saveObj
   * @param {boolean} dev
   * @param {object|null} [storyObj]
   * @returns {Array}
   */
  function titleItems(saveObj, dev, storyObj) {
    const api = engineTitleMenu();
    if (api && typeof api.titleItems === 'function') return api.titleItems(saveObj, dev, storyObj);
    return [];
  }

  /**
   * Левая колонка: логотип сверху, список сразу под ним.
   * @param {{H:number,n:number,logoH:number,resetArm:boolean,stageX?:number}} opts
   * @returns {{titleY0:number,titleStep:number,panelH:number,selFs:number,idleFs:number,colX:number,itemW:number,logoW:number}}
   */
  function titleLayout(opts) {
    const n = Math.max(opts.n, 1);
    const top = Math.min(268, 20 + opts.logoH + 12);
    const bottom = opts.H - (opts.resetArm ? 110 : 96);
    const span = Math.max(160, bottom - top);
    const titleStep = Math.min(34, Math.max(opts.minStep == null ? 22 : opts.minStep, span / n));
    const titleY0 = top;
    const panelH = Math.max(20, titleStep - 3);
    const origin = opts.stageX == null ? 0 : opts.stageX;
    return {
      titleY0,
      titleStep,
      panelH,
      selFs: Math.min(20, Math.max(14, titleStep * 0.58)),
      idleFs: Math.min(16, Math.max(12, titleStep * 0.46)),
      colX: origin + TITLE_COL_X,
      itemW: TITLE_ITEM_W,
      logoW: TITLE_LOGO_W
    };
  }

  /**
   * Затемнение слева, чтобы пункты читались на арте.
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   */
  function drawTitleShade(x, y, w, h) {
    const band = Math.min(520, Math.max(380, TITLE_COL_X + TITLE_ITEM_W + 90));
    const side = g.createLinearGradient(x, y, x + band, y);
    side.addColorStop(0, 'rgba(5,4,9,.58)');
    side.addColorStop(0.38, 'rgba(5,4,9,.28)');
    side.addColorStop(0.72, 'rgba(5,4,9,.08)');
    side.addColorStop(1, 'rgba(5,4,9,0)');
    g.fillStyle = side;
    g.fillRect(x, y, w, h);
    const foot = g.createLinearGradient(x, y + h * 0.82, x, y + h);
    foot.addColorStop(0, 'rgba(5,4,9,0)');
    foot.addColorStop(1, 'rgba(5,4,9,.38)');
    g.fillStyle = foot;
    g.fillRect(x, y, w, h);
  }

  /** Логотип игры: левый край совпадает с пунктами. */
  function drawTitleLogo(colX, logoW) {
    if (titleLogo && titleLogo.complete && titleLogo.naturalWidth) {
      const logoH = logoW * titleLogo.naturalHeight / titleLogo.naturalWidth;
      g.save();
      g.shadowColor = 'rgba(0,0,0,.7)';
      g.shadowBlur = 18;
      g.shadowOffsetY = 8;
      g.drawImage(titleLogo, colX, 16, logoW, logoH);
      g.restore();
      return;
    }
    g.save();
    g.textAlign = 'left';
    g.font = '36px ' + F_D;
    g.lineWidth = 8;
    g.strokeStyle = '#000';
    g.strokeText('РОК-Н-РОЛЛ', colX, 64);
    g.fillStyle = '#ffd23f';
    g.fillText('РОК-Н-РОЛЛ', colX, 64);
    g.font = '64px ' + F_D;
    g.lineWidth = 10;
    g.strokeText('ГОНКИ', colX, 124);
    g.fillStyle = '#ff3d2e';
    g.fillText('ГОНКИ', colX, 124);
    g.restore();
  }

  /**
   * Фон каста. Демо-заезд на титуле не рисуем.
   */
  function drawTitleStageEngine() {
    ensureTitleArt();
    const LX = titleStageX();
    const LY = (typeof viewH === 'number') ? (H - viewH) / 2 : 0;
    const vw = (typeof viewW === 'number' && viewW > 0) ? viewW : W;
    const vh = (typeof viewH === 'number' && viewH > 0) ? viewH : H;
    const api = engineTitleBg();
    if (api && typeof api.drawTitlePlate === 'function') api.drawTitlePlate(g, LX, LY, vw, vh);
    else {
      g.fillStyle = '#050409';
      g.fillRect(LX, LY, vw, vh);
    }
    drawTitleShade(LX, LY, vw, vh);
    drawTitleLogo(LX + TITLE_COL_X, TITLE_LOGO_W);
    if (typeof drawTitleRain === 'function') drawTitleRain();
  }

  /** Заставка «любая кнопка» — тот же кадр, призыв слева. */
  function drawPressStartEngine() {
    drawTitleStage();
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const visible = reduce || ((gt % 1.05) < 0.68);
    if (visible) {
      g.save();
      g.shadowColor = 'rgba(255,157,46,.9)';
      g.shadowBlur = 22;
      txt(g, 'Нажмите любую кнопку', titleStageX() + TITLE_COL_X, H - 118, 34, '#ffd23f', 'left');
      g.restore();
    }
  }

  /** Марка студии слева снизу. */
  function drawStudioMark(colX) {
    const img = titleStudioLogo;
    if (!img || !img.complete || !img.naturalWidth) return;
    const markW = 108;
    const markH = markW * img.naturalHeight / img.naturalWidth;
    const y = H - 14 - markH;
    g.save();
    g.globalAlpha = 0.88;
    g.drawImage(img, colX, y, markW, markH);
    g.restore();
  }

  /**
   * Титул: левая колонка пунктов, версия справа снизу.
   */
  function drawTitleEngine() {
    drawTitleStage();
    const free = (typeof persistPeekSave === 'function' && typeof SKEY === 'string')
      ? persistPeekSave(SKEY)
      : save;
    const storyKey = typeof STORY_SKEY === 'string' ? STORY_SKEY : 'rnr_ru_story_v1';
    const story = typeof persistPeekSave === 'function' ? persistPeekSave(storyKey) : null;
    const menu = engineTitleMenu();
    const items = titleItems(free, typeof isDev === 'function' && isDev(), story);
    if (selTitle < 0 && menu && typeof menu.titleDefaultIndex === 'function') selTitle = menu.titleDefaultIndex(items);
    if (selTitle >= items.length) selTitle = items.length - 1;
    const n = items.length;
    const hasHint = items.some(function (t) { return !!(t && t.hint); });
    const lay = titleLayout({
      H: H, n: n, logoH: titleLogoHeight(), resetArm: false, stageX: titleStageX(),
      minStep: hasHint ? 28 : 22
    });
    const colX = lay.colX;
    const labOf = menu && menu.titleItemLabel;
    const hintOf = menu && menu.titleItemHint;
    items.forEach(function (t, i) {
      const y = lay.titleY0 + i * lay.titleStep, sel = i === selTitle;
      const label = labOf ? labOf(t) : (t && t.label) || '';
      const hint = hintOf ? hintOf(t) : (t && t.hint) || '';
      if (sel) {
        txt(g, '▸', colX - 2, y - 2, Math.max(14, lay.selFs - 2), '#ff9d2e', 'right');
        txt(g, label, colX, y - 2, lay.selFs, '#ffd23f', 'left');
      } else {
        txt(g, label, colX, y - 2, lay.idleFs, '#8f88a0', 'left');
      }
      if (hint) txt(g, hint, colX, y + 12, 11, sel ? '#b9a46a' : '#5a5468', 'left', F_B);
    });
    g._titleY0 = lay.titleY0;
    g._titleStep = lay.titleStep;
    g._titleHit = lay.panelH / 2 + 4;
    g._titleColX = colX - 8;
    g._titleItemW = lay.itemW;
    drawStudioMark(colX);
    const ver = gameVersionLabel();
    if (ver) txt(g, ver, titleStageRight() - 22, H - 16, 11, '#5a5468', 'right', F_B);
    g._titleItems = items;
    drawLabWarn();
    drawExitWarn();
    if (typeof drawTitleConfirm === 'function') drawTitleConfirm();
    if (typeof drawClientNotice === 'function') drawClientNotice();
  }

  /**
   * Имена функций контента по состоянию кадра.
   * @type {Object<string, string[]|function>}
   */
  const PAINTERS = {
    press: function () {
      if (typeof pollPressStartPad === 'function') pollPressStartPad();
      drawPressStart();
    },
    title: ['drawTitle'],
    cameraSetup: ['drawCameraSetup'],
    settings: ['drawSettings'],
    help: ['drawHelp'],
    achievements: ['drawAchievements'],
    cheats: ['drawCheats'],
    tracks: ['drawTrackPick'],
    slotSelect: ['drawSlotSelect'],
    char: function () {
      drawCharSel();
      if (bioOpen >= 0) drawBio();
    },
    intro: ['drawIntro'],
    worldIntro: function () {
      try {
        if (typeof drawWorldIntro === 'function') drawWorldIntro();
      } catch (e) {
        console.error(e);
      }
    },
    car: ['drawCarSel'],
    junkTune: function () {
      if (typeof drawJunkTune === 'function') drawJunkTune();
      else {
        state = 'garage';
        drawGarage();
      }
    },
    garage: ['drawGarage'],
    gym: ['drawGym'],
    armory: ['drawArmory'],
    autopark: ['drawAutopark'],
    detail: ['drawCarDetail'],
    prerace: ['drawPreRace'],
    career: ['drawCareer'],
    careerTracks: ['drawCareerTracks'],
    results: ['drawResults'],
    race: function () {
      drawRaceWorld();
      drawHUD();
    }
  };

  /**
   * Рисует экран текущего состояния, не трогая симуляцию.
   * @param {string} mode
   */
  function paint(mode) {
    const job = PAINTERS[mode];
    if (typeof job === 'function') {
      job();
      return;
    }
    if (!Array.isArray(job)) return;
    for (let i = 0; i < job.length; i++) {
      const fn = global[job[i]];
      if (typeof fn === 'function') fn();
    }
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.screens = {
    titleItems,
    titleLayout,
    pickTitleBgSrc,
    parseTitleBgSize,
    paint,
    names: Object.keys(PAINTERS)
  };
  engine.replace('drawTitle', drawTitleEngine);
  engine.replace('drawTitleStage', drawTitleStageEngine);
  engine.replace('drawPressStart', drawPressStartEngine);
  ensureTitleArt();
})(typeof window !== 'undefined' ? window : globalThis);
