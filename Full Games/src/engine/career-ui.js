////////////////////////////////////////////////////////
//
// DiVANEngine: экран «что дальше» и реванш. Призы остаются в career.js.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Крупная строка места на герое кадра.
   * @param {number} place
   * @returns {string}
   */
  function careerHeroLine(place) {
    if (place === 0) return 'ТЫ РАЗОРВАЛ КЛЕТКУ';
    if (place <= 2) return 'ПОДИУМ. ДЕНЬГИ ЕСТЬ.';
    return 'СЛЕДУЮЩИЙ ЗАЕЗД ВСЁ ЕЩЁ ТВОЙ';
  }

  /**
   * Ряд кнопок внизу экрана карьеры.
   * @param {number} width
   * @param {number} height
   * @param {number} n
   * @param {number} [pad]
   * @returns {{pad:number,btnY:number,btnH:number,btnGap:number,btnW:number}}
   */
  function careerBtnLayout(width, height, n, pad) {
    const p = pad == null ? 40 : pad;
    const btnY = height - 92, btnH = 56, btnGap = 14;
    const btnW = n ? (width - p * 2 - (n - 1) * btnGap) / n : 200;
    return { pad: p, btnY, btnH, btnGap, btnW };
  }

  /**
   * Клавиши экрана «что дальше».
   * @param {string} c
   */
  function careerPressEngine(c) {
    if (state === 'careerTracks') {
      const n = careerPickList.length;
      if (!n) { state = 'career'; return; }
      if (c === 'ArrowLeft') { careerPickSel = (careerPickSel + n - 1) % n; sClick(); return; }
      if (c === 'ArrowRight') { careerPickSel = (careerPickSel + 1) % n; sClick(); return; }
      if (c === 'ArrowUp') { careerPickSel = (careerPickSel + n - 1) % n; sClick(); return; }
      if (c === 'ArrowDown') { careerPickSel = (careerPickSel + 1) % n; sClick(); return; }
      if (isBack(c)) { state = 'career'; sClick(); return; }
      if (isConfirm(c)) {
        raceTrackOverride = careerPickList[careerPickSel];
        raceBoard = null;
        state = 'garage';
        sClick();
      }
      return;
    }
    if (state !== 'career' || !R || !R.career) return;
    const acts = R.career.actions || [];
    const n = acts.length;
    if (!n) { careerOpenFromResults(); return; }
    if (c === 'ArrowLeft' || c === 'ArrowUp') {
      R.career.sel = (R.career.sel + n - 1) % n; sClick(); return;
    }
    if (c === 'ArrowRight' || c === 'ArrowDown') {
      R.career.sel = (R.career.sel + 1) % n; sClick(); return;
    }
    if (isConfirm(c)) careerDo(acts[R.career.sel | 0].id);
  }

  /**
   * Клик по кнопкам карьеры.
   * @param {number} x
   * @param {number} y
   */
  function careerClickEngine(x, y) {
    if (state === 'careerTracks' && g._careerTiles) {
      for (let i = 0; i < g._careerTiles.length; i++) {
        const b = g._careerTiles[i];
        if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) {
          if (careerPickSel === i) {
            raceTrackOverride = careerPickList[i];
            raceBoard = null;
            state = 'garage';
          } else careerPickSel = i;
          sClick();
          return;
        }
      }
      return;
    }
    if (state !== 'career' || !g._careerBtns) return;
    for (const b of g._careerBtns) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        R.career.sel = b.i;
        careerDo(b.id);
        return;
      }
    }
  }

  /**
   * Экран после результатов: крупный следующий шаг, не таблица Excel.
   */
  function drawCareerEngine() {
    const brief = R && R.career;
    if (!brief) { drawTheatreBack(); return; }
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const age = reduce ? 9 : Math.max(0, gt - (brief.t0 || 0));
    drawTheatreBack();
    const pad = 40;
    const ink = R.place === 0 ? '#ffd23f' : R.place <= 2 ? '#ff9d2e' : '#e8e2d0';
    txt(g, 'ЧТО ДАЛЬШЕ', pad, 52, 32, ink);
    txt(g, (R.T && R.T.name) || '', W / 2, 48, 14, '#8f88a0', 'center', F_B);
    const cash = fm(save.cash);
    g.font = '20px ' + F_D;
    const cashW = Math.max(168, g.measureText(cash).width + 36);
    panel(g, W - pad - cashW, 28, cashW, 40, 'rgba(255,210,63,.08)', 'rgba(255,210,63,.38)', 10);
    txt(g, cash, W - pad - 18, 48, 20, '#ffd23f', 'right');

    const heroY = 88;
    const heroH = 118;
    rr(g, pad, heroY, W - pad * 2, heroH, 16);
    g.fillStyle = 'rgba(18,15,26,.92)'; g.fill();
    g.strokeStyle = ink + '66'; g.lineWidth = 2; g.stroke();
    const pop = reduce ? 1 : Math.min(1, age / 0.28);
    g.globalAlpha = pop;
    txt(g, careerPlaceWord(R.place), pad + 28, heroY + 36, 18, ink, 'left', F_B);
    const nextDef = TRACKDEFS[save.race % TRACKDEFS.length];
    txt(g, careerHeroLine(R.place), pad + 28, heroY + 72, 28, '#e8e2d0', 'left');
    txt(g, nextDef ? ('этап ' + (save.race + 1) + ' · ' + nextDef.name) : '', pad + 28, heroY + 98, 14, '#8f88a0', 'left', F_B);
    g.globalAlpha = 1;

    const news = brief.news || [];
    const listTop = heroY + heroH + 16;
    const listH = 330;
    const gap = 8;
    const rowH = news.length ? Math.min(52, (listH - (news.length - 1) * gap) / news.length) : 48;
    news.forEach(function (n, i) {
      const y = listTop + i * (rowH + gap);
      const a = reduce ? 1 : Math.min(1, Math.max(0, (age - 0.12 - i * 0.07) / 0.2));
      g.globalAlpha = a;
      rr(g, pad, y, W - pad * 2, rowH, 10);
      g.fillStyle = 'rgba(16,13,22,.94)'; g.fill();
      g.fillStyle = n.col || '#ffd23f';
      g.fillRect(pad, y + 10, 4, rowH - 20);
      txt(g, n.title, pad + 24, y + rowH * 0.38, 14, n.col || '#ffd23f', 'left', F_B);
      txt(g, n.text, pad + 24, y + rowH * 0.72, 12, '#9a93a8', 'left', F_B);
      g.globalAlpha = 1;
    });

    const acts = brief.actions || [];
    const lay = careerBtnLayout(W, H, acts.length, pad);
    g._careerBtns = [];
    acts.forEach(function (act, i) {
      const x = lay.pad + i * (lay.btnW + lay.btnGap);
      const sel = (brief.sel | 0) === i;
      const hot = mx > x && mx < x + lay.btnW && my > lay.btnY && my < lay.btnY + lay.btnH;
      panel(g, x, lay.btnY, lay.btnW, lay.btnH, sel || hot ? 'rgba(255,157,46,.16)' : 'rgba(16,13,22,.94)', sel || hot ? '#ffd23f' : '#3a3548', 12);
      txt(g, act.label, x + lay.btnW / 2, lay.btnY + 22, sel ? 18 : 16, sel ? '#ffd23f' : '#e8e2d0', 'center');
      txt(g, act.sub || '', x + lay.btnW / 2, lay.btnY + 42, 11, '#8f88a0', 'center', F_B);
      g._careerBtns.push({ x: x, y: lay.btnY, w: lay.btnW, h: lay.btnH, i: i, id: act.id });
    });
    txt(g, '← →  выбор   ·   ENTER — поехать', W / 2, H - 22, 13, '#6f6880', 'center', F_B);
  }

  /**
   * Выбор реванша: только уже открытые трассы.
   */
  function drawCareerTracksEngine() {
    drawTheatreBack();
    txt(g, 'РЕВАНШ', HUB_PAD, 52, 32, '#ffd23f');
    txt(g, 'только трассы, которые уже были в карьере', W / 2, 48, 14, '#8f88a0', 'center', F_B);
    g._careerTiles = [];
    careerPickList.forEach(function (idx, slot) {
      const def = TRACKDEFS[idx];
      const r = trackTileRect(slot);
      const sel = slot === careerPickSel;
      panel(g, r.x, r.y, r.w, r.h, sel ? 'rgba(255,157,46,.16)' : 'rgba(20,17,28,.92)', sel ? '#ffd23f' : '#3a3548', 10);
      const th = def.theme || {};
      g.fillStyle = th.ground || '#2a2434';
      rr(g, r.x + 10, r.y + 10, r.w - 20, r.h - 52, 8); g.fill();
      drawTrackOutline(g, def, r.x + 10, r.y + 10, r.w - 20, r.h - 52);
      txt(g, def.name, r.x + r.w / 2, r.y + r.h - 22, 16, sel ? '#ffd23f' : '#c8c0d4', 'center');
      g._careerTiles.push(r);
    });
    txt(g, 'ENTER — в гараж на этой трассе · ESC — назад', W / 2, H - 28, 14, '#6f6880', 'center', F_B);
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.careerUi = { careerHeroLine, careerBtnLayout };
  engine.replace('careerPress', careerPressEngine);
  engine.replace('careerClick', careerClickEngine);
  engine.replace('drawCareer', drawCareerEngine);
  engine.replace('drawCareerTracks', drawCareerTracksEngine);
})(typeof window !== 'undefined' ? window : globalThis);
