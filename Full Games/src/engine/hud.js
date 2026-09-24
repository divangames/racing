////////////////////////////////////////////////////////
//
// DiVANEngine: проекция миникарты и кадр HUD заезда.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  let minimapVhsBuffer = null, minimapVhsContext = null;

  /**
   * Масштаб и угол миникарты, чтобы полотно влезло в рамку.
   * @param {{mw:number,mh:number}} map
   * @param {number} px0
   * @param {number} py0
   * @param {number} pw
   * @param {number} ph
   * @param {number} pad
   * @returns {{sc:number,mox:number,moy:number}}
   */
  function minimapView(map, px0, py0, pw, ph, pad) {
    const mw = map.mw || 1, mh = map.mh || 1;
    const sc = Math.min((pw - pad * 2) / mw, (ph - pad * 2) / mh);
    return { sc, mox: px0 + (pw - mw * sc) / 2, moy: py0 + (ph - mh * sc) / 2 };
  }

  /**
   * Мир → пиксель рамки карты.
   * @param {number} wx
   * @param {number} wy
   * @param {number} mox
   * @param {number} moy
   * @param {number} sc
   * @returns {number[]}
   */
  function hudMapXYEngine(wx, wy, mox, moy, sc) {
    return [mox + (wx - R.map.mnx) * R.map.ms * sc, moy + (wy - R.map.mny) * R.map.ms * sc];
  }

  /**
   * Та же проекция без глобала заезда — для тестов.
   * @param {number} wx
   * @param {number} wy
   * @param {{mnx:number,mny:number,ms:number}} map
   * @param {number} mox
   * @param {number} moy
   * @param {number} sc
   * @returns {number[]}
   */
  function project(wx, wy, map, mox, moy, sc) {
    return [mox + (wx - map.mnx) * map.ms * sc, moy + (wy - map.mny) * map.ms * sc];
  }

  /**
   * Рельеф, соперники, маркер игрока, строка развёртки.
   */
  function drawHudMinimapEngine(c, px0, py0, pw, ph) {
    const mp = R.map.pts;
    const view = minimapView(R.map, px0, py0, pw, ph, 36);
    const sc = view.sc, mox = view.mox, moy = view.moy;
    const roadW = clamp(ROADW * R.map.ms * sc * .55, 5, 11);
    c.save();
    if (minimapFrameImage.complete && minimapFrameImage.naturalWidth) c.drawImage(minimapFrameImage, px0, py0, pw, ph);
    rr(c, px0 + 21, py0 + 17, pw - 42, ph - 34, 8); c.clip();
    const trackPath = function () {
      c.beginPath();
      c.moveTo(mox + mp[0][0] * sc, moy + mp[0][1] * sc);
      for (let i = 1; i < mp.length; i++) c.lineTo(mox + mp[i][0] * sc, moy + mp[i][1] * sc);
      c.closePath();
    };
    c.lineJoin = 'round'; c.lineCap = 'round';
    trackPath(); c.shadowColor = 'rgba(53,224,255,.9)'; c.shadowBlur = 10; c.strokeStyle = 'rgba(53,224,255,.72)'; c.lineWidth = Math.max(2, roadW * .18); c.stroke(); c.shadowBlur = 0;
    for (const r of R.racers) {
      if (r.dead || r.isP) continue;
      const p = hudMapXYEngine(r.x, r.y, mox, moy, sc);
      c.shadowColor = r.aiCol || '#e8e2d0'; c.shadowBlur = 7; c.fillStyle = r.aiCol || '#e8e2d0'; c.beginPath(); c.arc(p[0], p[1], 3.4, 0, TAU); c.fill(); c.shadowBlur = 0;
    }
    if (!P.dead) {
      const p = hudMapXYEngine(P.x, P.y, mox, moy, sc);
      const pulse = hudMotionOk() ? 1 + Math.sin(gt * 8) * .14 : 1;
      c.save(); c.translate(p[0], p[1]); c.rotate(P.ang); c.scale(pulse, pulse);
      c.fillStyle = '#0c0a12';
      c.beginPath(); c.moveTo(8, 0); c.lineTo(-5.5, -5.5); c.lineTo(-5.5, 5.5); c.closePath(); c.fill();
      c.shadowColor = '#ffd23f'; c.shadowBlur = 10; c.fillStyle = '#ffd23f';
      c.beginPath(); c.moveTo(6.5, 0); c.lineTo(-4, -4.2); c.lineTo(-4, 4.2); c.closePath(); c.fill();
      c.restore(); c.shadowBlur = 0;
    }
    c.restore();
    c.save();
    rr(c, px0 + 21, py0 + 17, pw - 42, ph - 34, 8); c.clip();
    c.globalAlpha = .16; c.fillStyle = 'rgba(180,255,240,.48)';
    for (let sy = py0 + 18; sy < py0 + ph - 16; sy += 4) c.fillRect(px0 + 21, sy, pw - 42, 1);
    const scanY = py0 + 18 + ((gt * 42) % (ph - 36));
    c.globalAlpha = .18; c.fillStyle = '#aaffd5'; c.fillRect(px0 + 21, scanY, pw - 42, Math.max(2, ph * .025));
    c.restore();
  }

  /**
   * VHS поверх миникарты, обрезка по альфа-маске рамки.
   * @param {{x:number,y:number,w:number,h:number}} box
   */
  function drawMinimapVhsEngine(box) {
    if (!minimapAlphaImage.complete || !minimapAlphaImage.naturalWidth) return;
    vhsEnsure();
    const w = Math.max(1, Math.round(box.w)), h = Math.max(1, Math.round(box.h));
    if (!minimapVhsBuffer) { minimapVhsBuffer = document.createElement('canvas'); minimapVhsContext = minimapVhsBuffer.getContext('2d'); }
    if (minimapVhsBuffer.width !== w || minimapVhsBuffer.height !== h) { minimapVhsBuffer.width = w; minimapVhsBuffer.height = h; }
    const q = minimapVhsContext; q.setTransform(1, 0, 0, 1, 0, 0); q.clearRect(0, 0, w, h); q.drawImage(cv, box.x, box.y, box.w, box.h, 0, 0, w, h);
    q.globalCompositeOperation = 'source-atop'; q.globalAlpha = .34; q.fillStyle = g.createPattern(vhsScan, 'repeat'); q.fillRect(0, 0, w, h);
    q.globalAlpha = .16; const bar = ((gt * 48) % h); q.fillStyle = '#b8ffd0'; q.fillRect(0, bar, w, Math.max(2, h * .025));
    q.globalCompositeOperation = 'destination-in'; q.globalAlpha = 1; q.drawImage(minimapAlphaImage, 0, 0, w, h);
    q.globalCompositeOperation = 'source-over';
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = .58; g.drawImage(minimapVhsBuffer, box.x, box.y, box.w, box.h); g.restore();
  }

  /** Все строки, заголовок и подсказка помещаются даже с дополнительным пунктом разработчика. */
  function pauseLayout(width, height, count) {
    const step = Math.min(48, Math.max(26, (height - 126) / Math.max(1, count)));
    const titleSize = Math.max(26, Math.min(52, height * .075));
    const total = titleSize + 24 + count * step + 30;
    const top = Math.max(10, (height - total) / 2), frameW = Math.min(460, width - 32);
    return { step, titleSize, titleY: top + titleSize / 2,
      firstY: top + titleSize + 24 + step / 2,
      footerY: top + titleSize + 24 + count * step + 18,
      frameX: (width - frameW) / 2, frameW, frameH: Math.min(42, step - 4),
      labelSize: Math.min(24, Math.max(16, step * .5)) };
  }

  /** Пауза использует тот же список, что и навигация, без смещения от тряски HUD. */
  function drawPause(c) {
    const ui = engine.cyberHud && engine.cyberHud.viewport ? engine.cyberHud.viewport()
      : { scale: viewS, width: viewW, height: viewH };
    const items = pauseRaceItems(), box = pauseLayout(ui.width, ui.height, items.length), K = engine.cyberKit;
    if (engine.menu) {
      c.save(); c.setTransform(ui.scale, 0, 0, ui.scale, 0, 0);
      engine.menu.pause(c, ui.width, ui.height, items, pauseMenuIndex, false); c.restore(); return;
    }
    c.save(); c.setTransform(ui.scale, 0, 0, ui.scale, 0, 0);
    c.fillStyle = 'rgba(3,12,20,.90)'; c.fillRect(0, 0, ui.width, ui.height);
    K.text(c, 'ПАУЗА', ui.width / 2, box.titleY, box.titleSize, '#b9efff', 'center', box.frameW, true);
    items.forEach(function (label, index) {
      const y = box.firstY + index * box.step, selected = index === pauseMenuIndex;
      if (selected) K.frame(c, box.frameX, y - box.frameH / 2, box.frameW, box.frameH);
      K.text(c, label, ui.width / 2, y, selected ? box.labelSize : box.labelSize - 2,
        selected ? '#b9efff' : '#78a5b8', 'center', box.frameW - 24, selected);
    });
    const hint = ui.width < 650 ? '↑↓ ВЫБОР · ENTER OK · ESC НАЗАД'
      : '↑↓ — выбор · ENTER — подтвердить · ESC — продолжить';
    K.text(c, hint, ui.width / 2, box.footerY, 12, '#78a5b8', 'center', ui.width - 32);
    c.restore();
  }

  /**
   * Позиция, круги, миникарта, кокпит, отсчёт и пауза.
   */
  function drawHUDEngine() {
    g.setTransform(viewS, 0, 0, viewS, 0, 0);
    tickHudFx();
    const HW = viewW, VH = viewH, fx = hudFx;
    g.translate(fx && fx.hudX || 0, fx && fx.hudY || 0);
    if (global.DiVANEngine.combatHud && R.phase === 'go') global.DiVANEngine.combatHud.drawMarkers();
    global.DiVANEngine.cyberHud.draw(true);
    if (R.phase === 'count') {
      const ct = R.countT;
      if (ct > 3) {
        if (labTest) {
          global.DiVANEngine.cyberKit.frame(g, HW / 2 - 280, 170, 560, 180);
          txt(g, 'ПОЛИГОН', HW / 2, 220, 36, '#21ddff', 'center');
          txt(g, 'простая трасса · замер круга', HW / 2, 262, 16, '#9a9a9a', 'center', F_B);
          txt(g, 'ПРИГОТОВЬТЕСЬ...', HW / 2, 310, 18, '#b9efff', 'center');
        } else {
          global.DiVANEngine.cyberKit.frame(g, HW / 2 - 330, 150, 660, R.betStake ? 268 : 240);
          txt(g, R.countsForCareer === false ? 'РЕВАНШ — ' + R.T.name : 'ЭТАП ' + (save.race + 1) + ' — ' + DIVN[Math.min(3, R.div - 1)], HW / 2, 186, 20, '#21ddff', 'center');
          txt(g, R.T.name, HW / 2, 226, 40, '#b9efff', 'center');
          txt(g, 'ПРИЗОВОЙ ФОНД', HW / 2, 262, 15, '#78a5b8', 'center', F_B);
          const mult = prizeDivMult(R.div);
          txt(g, PRIZE.map(function (p, i) { return (i + 1) + ':$' + Math.round(p * mult); }).join('   '), HW / 2, 290, 15, '#e8e2d0', 'center', F_B);
          txt(g, R.div > 1 ? 'ДИВИЗИОН ' + R.div : 'ПЕРВАЯ ГОНКА СЕЗОНА', HW / 2, 330, 16, '#21ddff', 'center', F_B);
          if ((R.betStake || 0) > 0 && R.betOdds) txt(g, 'СТАВКА ' + fm(R.betStake) + ' · ' + (R.betName || '') + '  1:' + fmtOdds(R.betOdds.k1) + '  2:' + fmtOdds(R.betOdds.k2) + '  3:' + fmtOdds(R.betOdds.k3), HW / 2, 352, 13, '#b9efff', 'center', F_B);
          txt(g, 'ПРИГОТОВЬТЕСЬ...', HW / 2, R.betStake ? 378 : 364, 18, '#fff', 'center');
        }
      } else {
        const n = Math.ceil(ct), f = ct - (n - 1);
        g.save(); g.translate(HW / 2, VH / 2 - 30); g.scale(1 + (1 - f) * .6, 1 + (1 - f) * .6);
        txt(g, n + '', 0, 0, 140, '#b9efff', 'center'); g.restore();
      }
    }
    if (R.phase === 'go' && R.time < 1.2) {
      g.save(); g.translate(HW / 2, VH / 2 - 30); g.scale(1 + R.time * .5, 1 + R.time * .5);
      txt(g, 'ПОГНАЛИ!', 0, 0, 90, '#21ddff', 'center'); g.restore();
    }
    if (paused) drawPause(g);
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.hud = { minimapView, project, pauseLayout, drawPause };
  engine.replace('hudMapXY', hudMapXYEngine);
  engine.replace('drawHudMinimap', drawHudMinimapEngine);
  engine.replace('drawMinimapVhs', drawMinimapVhsEngine);
  engine.replace('drawHUD', drawHUDEngine);
})(typeof window !== 'undefined' ? window : globalThis);
