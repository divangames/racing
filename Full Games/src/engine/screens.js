////////////////////////////////////////////////////////
//
// DiVANEngine: каталог экранов хаба и пункты главного меню.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  const TITLE_CAST_BG = 'assets/image/cast/01.png';
  const TITLE_STUDIO_LOGO = 'assets/divan_games/DIVAN_none.png';
  const TITLE_COL_X = 52;
  const TITLE_LOGO_W = 380;
  const TITLE_ITEM_W = 340;

  let titleCastBg = null;
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

  /** Фон каста и логотип студии — один раз. */
  function ensureTitleArt() {
    if (!titleCastBg) titleCastBg = queueTitleImage(TITLE_CAST_BG);
    if (!titleStudioLogo) titleStudioLogo = queueTitleImage(TITLE_STUDIO_LOGO);
    if (!(typeof BOOT !== 'undefined' && BOOT.ready)) return;
    if (titleCastBg && !titleCastBg.naturalWidth) bindTitleSrc(titleCastBg, TITLE_CAST_BG);
    if (titleStudioLogo && !titleStudioLogo.naturalWidth) bindTitleSrc(titleStudioLogo, TITLE_STUDIO_LOGO);
  }

  /**
   * Картинка на весь кадр без полей.
   * @param {CanvasRenderingContext2D} ctx
   * @param {HTMLImageElement} img
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @returns {boolean}
   */
  function blitCover(ctx, img, x, y, w, h) {
    if (!img || !img.complete || !img.naturalWidth) return false;
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const s = Math.max(w / iw, h / ih);
    const dw = iw * s, dh = ih * s;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    return true;
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

  /**
   * Пункты титульного меню. Лаборатория — в dev; читы — не в публичном NSIS.
   * @param {object|null} saveObj
   * @param {boolean} dev
   * @returns {string[]}
   */
  function titleItems(saveObj, dev, storyObj) {
    const items = [];
    if (storyObj && storyObj.storyCampaign) items.push('ПРОДОЛЖИТЬ КАМПАНИЮ');
    items.push('КАМПАНИЯ');
    if (saveObj) items.push('ПРОДОЛЖИТЬ (ЭТАП ' + (saveObj.race + 1) + ')');
    items.push('НОВАЯ ИГРА', 'ЗАГРУЗИТЬ ИГРУ', 'НАСТРОЙКИ', 'ДОСТИЖЕНИЯ');
    if (typeof cheatsAllowed !== 'function' || cheatsAllowed()) items.push('ЧИТЫ');
    if (dev) items.push('ВЫБОР ТРАССЫ', 'ЛАБОРАТОРИЯ');
    if (saveObj) items.push('СБРОС ПРОГРЕССА');
    items.push('ВЫХОД');
    return items;
  }

  /**
   * Левая колонка: логотип сверху, список сразу под ним.
   * @param {{H:number,n:number,logoH:number,resetArm:boolean}} opts
   * @returns {{titleY0:number,titleStep:number,panelH:number,selFs:number,idleFs:number,colX:number,itemW:number,logoW:number}}
   */
  function titleLayout(opts) {
    const n = Math.max(opts.n, 1);
    const top = Math.min(268, 20 + opts.logoH + 12);
    const bottom = opts.H - (opts.resetArm ? 110 : 96);
    const span = Math.max(160, bottom - top);
    const titleStep = Math.min(34, Math.max(22, span / n));
    const titleY0 = top;
    const panelH = Math.max(20, titleStep - 3);
    return {
      titleY0,
      titleStep,
      panelH,
      selFs: Math.min(20, Math.max(14, titleStep * 0.58)),
      idleFs: Math.min(16, Math.max(12, titleStep * 0.46)),
      colX: TITLE_COL_X,
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
    const side = g.createLinearGradient(x, y, x + w * 0.58, y);
    side.addColorStop(0, 'rgba(5,4,9,.82)');
    side.addColorStop(0.42, 'rgba(5,4,9,.46)');
    side.addColorStop(0.72, 'rgba(5,4,9,.12)');
    side.addColorStop(1, 'rgba(5,4,9,0)');
    g.fillStyle = side;
    g.fillRect(x, y, w, h);
    const foot = g.createLinearGradient(x, y + h * 0.72, x, y + h);
    foot.addColorStop(0, 'rgba(5,4,9,0)');
    foot.addColorStop(1, 'rgba(5,4,9,.55)');
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
    const LX = (W - viewW) / 2, LY = (H - viewH) / 2;
    g.fillStyle = '#050409';
    g.fillRect(LX, LY, viewW, viewH);
    blitCover(g, titleCastBg, LX, LY, viewW, viewH);
    drawTitleShade(LX, LY, viewW, viewH);
    drawTitleLogo(TITLE_COL_X, TITLE_LOGO_W);
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
      txt(g, 'Нажмите любую кнопку', TITLE_COL_X, H - 118, 34, '#ffd23f', 'left');
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
    const items = titleItems(free, typeof isDev === 'function' && isDev(), story);
    if (selTitle >= items.length) selTitle = items.length - 1;
    const n = items.length;
    const lay = titleLayout({ H: H, n: n, logoH: titleLogoHeight(), resetArm: !!resetArm });
    const colX = lay.colX;
    items.forEach(function (t, i) {
      const y = lay.titleY0 + i * lay.titleStep, sel = i === selTitle;
      if (sel) {
        txt(g, '▸', colX - 2, y - 2, Math.max(14, lay.selFs - 2), '#ff9d2e', 'right');
        txt(g, t, colX, y - 2, lay.selFs, '#ffd23f', 'left');
      } else {
        txt(g, t, colX, y - 2, lay.idleFs, '#8f88a0', 'left');
      }
    });
    if (resetArm) {
      txt(g, 'СБРОС ТЕКУЩЕЙ КАРЬЕРЫ. СЛОТЫ НЕ ТРОГАЕМ. ENTER — ДА', colX, lay.titleY0 + n * lay.titleStep + 4, 13, '#ff3d2e', 'left');
    }
    g._titleY0 = lay.titleY0;
    g._titleStep = lay.titleStep;
    g._titleHit = lay.panelH / 2 + 4;
    g._titleColX = colX - 8;
    g._titleItemW = lay.itemW;
    drawStudioMark(colX);
    const ver = gameVersionLabel();
    if (ver) txt(g, ver, W - 22, H - 16, 11, '#5a5468', 'right', F_B);
    g._titleItems = items;
    drawLabWarn();
    drawExitWarn();
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
  engine.screens = { titleItems, titleLayout, paint, names: Object.keys(PAINTERS) };
  engine.replace('drawTitle', drawTitleEngine);
  engine.replace('drawTitleStage', drawTitleStageEngine);
  engine.replace('drawPressStart', drawPressStartEngine);
  ensureTitleArt();
})(typeof window !== 'undefined' ? window : globalThis);
