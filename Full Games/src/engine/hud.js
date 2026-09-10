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

  /**
   * Позиция, круги, миникарта, кокпит, отсчёт и пауза.
   */
  function drawHUDEngine() {
    g.setTransform(viewS, 0, 0, viewS, 0, 0);
    tickHudFx();
    const HW = viewW, VH = viewH, fx = hudFx;
    g.translate(fx && fx.hudX || 0, fx && fx.hudY || 0);
    if (labTest) {
      const cur = R.phase === 'go' ? Math.max(0, R.time - (P.lapStart || 0)) : 0;
      const shownLap = Math.max(1, P.lap + (R.phase === 'go' ? 1 : 0));
      panel(g, 16, 12, 168, 118, 'rgba(12,12,12,.88)', '#3d9eff', 10);
      txt(g, 'ПОЛИГОН', 100, 28, 11, '#3d9eff', 'center', F_B);
      txt(g, 'КРУГ ' + shownLap, 100, 48, 20, '#ededed', 'center', F_D);
      txt(g, fmtLap(cur), 100, 72, 22, '#e8c547', 'center', F_D);
      txt(g, 'прошлый  ' + (P.lap >= 1 && P.lastLap ? fmtLap(P.lastLap) : '—'), 100, 92, 11, '#9a9a9a', 'center', F_B);
      txt(g, 'лучший  ' + (P.bestLap ? fmtLap(P.bestLap) : '—'), 100, 108, 11, P.bestLap ? '#3dd68c' : '#9a9a9a', 'center', F_B);
    } else {
      const place = R.order.indexOf(P) + 1;
      const rankCol = place === 1 ? '#ffd23f' : place === 2 ? '#d8d4e0' : place === 3 ? '#e09a5a' : '#ffd23f';
      const pop = 1 + (fx && fx.pop || 0) * .2;
      const railX = 16, railY = 14, railW = Math.min(204, Math.max(184, HW * .16));
      const railH = 92 + R.racers.length * 32;
      if (leaderboardPanelImage.complete && leaderboardPanelImage.naturalWidth) {
        g.drawImage(leaderboardPanelImage, 4, 4, 224, 336);
      } else {
        panel(g, railX, railY, railW, railH, 'rgba(9,8,14,.88)', 'rgba(255,157,46,.68)', 14);
      }
      g.save(); g.translate(railX + 52, railY + 62); g.scale(pop, pop);
      leaderTxt(g, String(place), 0, 0, 32, rankCol, 'center');
      leaderTxt(g, 'МЕСТО', 0, 21, 8, '#6a6478', 'center');
      g.restore();
      const lapFlash = fx && fx.lapFlash || 0;
      leaderTxt(g, 'КРУГ', railX + 112, railY + 48, 9, '#6a6478', 'left');
      leaderTxt(g, clamp(P.lap + 1, 1, raceLaps) + ' / ' + raceLaps, railX + 112, railY + 71, 22, lapFlash > 0 ? '#ffd23f' : '#e8e2d0', 'left');
      g.strokeStyle = 'rgba(255,157,46,.28)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(railX + 14, railY + 90); g.lineTo(railX + railW - 14, railY + 90); g.stroke();
      const packX = railX, packY = railY + 97, packW = railW;
      g.save();
      g.beginPath();
      g.rect(packX + 14, packY + 2, packW - 28, R.racers.length * 32 + 26);
      g.clip();
      R.order.forEach(function (r, i) {
        const id = R.racers.indexOf(r);
        const y = packY + 16 + (fx && fx.rowY[id] != null ? fx.rowY[id] : i * 32);
        const nCol = i === 0 ? '#ffd23f' : i === 1 ? '#d8d4e0' : i === 2 ? '#e09a5a' : '#9a93a8';
        if (r.isP) {
          g.fillStyle = 'rgba(255,210,63,.10)'; g.fillRect(packX + 10, y - 14, packW - 20, 28);
        }
        leaderTxt(g, (i + 1) + '', packX + 18, y, 11, nCol, 'center');
        const ax = packX + 50;
        if (avatarImage(r.ch)) drawLeaderAvatar(g, r.ch, ax, y, 26);
        else { g.fillStyle = '#16131c'; g.beginPath(); g.arc(ax, y, 13, 0, TAU); g.fill(); }
        if (r.isP) {
          g.strokeStyle = '#ffd23f'; g.lineWidth = 1.6; g.beginPath(); g.arc(ax, y, 14, 0, TAU); g.stroke();
        }
        leaderTxt(g, r.ch.short || r.ch.name, packX + 72, y + 1, 11, r.isP ? '#ffd23f' : '#c8c2d4', 'left');
        if (r.finished) leaderTxt(g, '✓', packX + railW - 32, y, 11, '#58ff6b', 'center');
      });
      g.restore();
      if (typeof drawHudVoiceBarks === 'function') drawHudVoiceBarks(g, packX, packY, packW, fx);
    }
    const weatherOn = settings.graphics.weather && R.weather && R.weather.parts > 0;
    const raceHeadW = 250, raceHeadH = weatherOn ? 58 : 48, raceHeadX = HW / 2 - raceHeadW / 2;
    panel(g, raceHeadX, 12, raceHeadW, raceHeadH, 'rgba(9,8,14,.88)', 'rgba(58,53,72,.92)', 12);
    txt(g, fmtT(R.time), HW / 2, 28, 20, '#e8e2d0', 'center');
    txt(g, 'КРУГ ' + clamp(P.lap + 1, 1, raceLaps) + ' / ' + raceLaps, raceHeadX + 18, 47, 9, '#ffd23f', 'left', F_B);
    if (weatherOn) txt(g, R.weather.name, raceHeadX + raceHeadW - 18, 47, 9, R.weather.col, 'right', F_B);
    if (labTest) {
      panel(g, HW / 2 - 150, weatherOn ? 68 : 56, 300, 22, 'rgba(12,12,12,.85)', '#3d9eff', 8);
      txt(g, 'ESC — В ЛАБОРАТОРИЮ', HW / 2, weatherOn ? 79 : 67, 12, '#9a9a9a', 'center', F_B);
    }
    if (R.endTimer != null && R.endTimer > 0) {
      panel(g, HW / 2 - 140, weatherOn ? 68 : 56, 280, 26, 'rgba(12,10,18,.85)', '#ff3d2e', 8);
      txt(g, 'ФИНИШ: ' + Math.ceil(R.endTimer) + ' с', HW / 2, weatherOn ? 81 : 69, 13, '#ff9d2e', 'center', F_B);
    }
    if (saveFlash > 0) { g.globalAlpha = Math.min(1, saveFlash); txt(g, '✓ СОХРАНЕНО', HW - 20, 188, 11, '#58ff6b', 'right', F_B); g.globalAlpha = 1; }
    drawHudMinimap(g, HW - 18 - 210, 14, 210, 140);
    drawMinimapVhs({ x: (HW - 18 - 210 + (fx && fx.hudX || 0)) * viewS + viewOX, y: (14 + (fx && fx.hudY || 0)) * viewS + viewOY, w: 210 * viewS, h: 140 * viewS });
    const hpRatio = clamp(P.hp / P.maxhp, 0, 1);
    if (hpRatio < .25) {
      const pulse = hudMotionOk() ? 0.10 + Math.sin(gt * 10) * .035 : .10;
      const danger = g.createRadialGradient(HW / 2, VH / 2, Math.min(HW, VH) * .2, HW / 2, VH / 2, Math.max(HW, VH) * .7);
      danger.addColorStop(0, 'rgba(255,61,46,0)');
      danger.addColorStop(1, 'rgba(255,61,46,' + pulse + ')');
      g.fillStyle = danger; g.fillRect(0, 0, HW, VH);
    }
    drawHudCockpit(g, HW, VH);
    if (R.hintT > 0) {
      g.globalAlpha = clamp(R.hintT, 0, 1);
      panel(g, HW / 2 - 360, VH - 122, 720, 26, 'rgba(12,10,18,.72)', null, 10);
      txt(g, 'WASD — руль  ·  Z / P оружие  ·  X / { нитро  ·  C / } ульта', HW / 2, VH - 109, 12, '#c8c2d4', 'center', F_B);
      g.globalAlpha = 1;
    }
    if (R.msg) drawAnnounceToast(g, R.msg, HW / 2, weatherOn ? 92 : 78, HW);
    if (R.phase === 'count') {
      const ct = R.countT;
      if (ct > 3) {
        if (labTest) {
          panel(g, HW / 2 - 280, 170, 560, 180, 'rgba(14,14,16,.94)', '#3d9eff');
          txt(g, 'ПОЛИГОН', HW / 2, 220, 36, '#3d9eff', 'center');
          txt(g, 'простая трасса · замер круга', HW / 2, 262, 16, '#9a9a9a', 'center', F_B);
          txt(g, 'ПРИГОТОВЬТЕСЬ...', HW / 2, 310, 18, '#e8c547', 'center');
        } else {
          panel(g, HW / 2 - 330, 150, 660, R.betStake ? 268 : 240, 'rgba(14,11,20,.92)', '#ff9d2e');
          txt(g, R.countsForCareer === false ? 'РЕВАНШ — ' + R.T.name : 'ЭТАП ' + (save.race + 1) + ' — ' + DIVN[Math.min(3, R.div - 1)], HW / 2, 186, 20, '#ff9d2e', 'center');
          txt(g, R.T.name, HW / 2, 226, 40, '#ffd23f', 'center');
          txt(g, 'ПРИЗОВОЙ ФОНД', HW / 2, 262, 15, '#9a93a8', 'center', F_B);
          const mult = prizeDivMult(R.div);
          txt(g, PRIZE.map(function (p, i) { return (i + 1) + ':$' + Math.round(p * mult); }).join('   '), HW / 2, 290, 15, '#e8e2d0', 'center', F_B);
          txt(g, R.div > 1 ? 'ДИВИЗИОН ' + R.div : 'ПЕРВАЯ ГОНКА СЕЗОНА', HW / 2, 330, 16, '#58ff6b', 'center', F_B);
          if ((R.betStake || 0) > 0 && R.betOdds) txt(g, 'СТАВКА ' + fm(R.betStake) + ' · ' + (R.betName || '') + '  1:' + fmtOdds(R.betOdds.k1) + '  2:' + fmtOdds(R.betOdds.k2) + '  3:' + fmtOdds(R.betOdds.k3), HW / 2, 352, 13, '#ffd23f', 'center', F_B);
          txt(g, 'ПРИГОТОВЬТЕСЬ...', HW / 2, R.betStake ? 378 : 364, 18, '#fff', 'center');
        }
      } else {
        const n = Math.ceil(ct), f = ct - (n - 1);
        g.save(); g.translate(HW / 2, VH / 2 - 30); g.scale(1 + (1 - f) * .6, 1 + (1 - f) * .6);
        txt(g, n + '', 0, 0, 140, '#ffd23f', 'center'); g.restore();
      }
    }
    if (R.phase === 'go' && R.time < 1.2) {
      g.save(); g.translate(HW / 2, VH / 2 - 30); g.scale(1 + R.time * .5, 1 + R.time * .5);
      txt(g, 'ПОГНАЛИ!', 0, 0, 90, '#58ff6b', 'center'); g.restore();
    }
    if (paused) {
      g.fillStyle = 'rgba(5,4,9,.78)'; g.fillRect(0, 0, HW, VH);
      txt(g, 'ПАУЗА', HW / 2, VH / 2 - 160, 56, '#ffd23f', 'center');
      const items = pauseRaceItems();
      const step = 48, y0 = VH / 2 - 8 - (items.length - 1) * step / 2;
      items.forEach(function (t, i) {
        const y = y0 + i * step, sel = i === pauseMenuIndex;
        if (sel) panel(g, HW / 2 - 220, y - 22, 440, 42, 'rgba(255,157,46,.15)', '#ff9d2e');
        txt(g, t, HW / 2, y, sel ? 24 : 18, sel ? '#ffd23f' : '#8f88a0', 'center');
      });
      txt(g, '↑↓ — выбор • ENTER — подтвердить • ESC — продолжить', HW / 2, y0 + items.length * step + 8, 14, '#6f6880', 'center', F_B);
    }
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.hud = { minimapView, project };
  engine.replace('hudMapXY', hudMapXYEngine);
  engine.replace('drawHudMinimap', drawHudMinimapEngine);
  engine.replace('drawMinimapVhs', drawMinimapVhsEngine);
  engine.replace('drawHUD', drawHUDEngine);
})(typeof window !== 'undefined' ? window : globalThis);
