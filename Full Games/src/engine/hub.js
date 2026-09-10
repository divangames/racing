////////////////////////////////////////////////////////
//
// DiVANEngine: гараж карьеры и доска результатов.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /** Ключи тюнинга в том же порядке, что строки гаража 0–4. */
  const TUNING_KEYS = ['arm', 'eng', 'tir', 'shk', 'nit'];

  /**
   * Колонки хаба: пилот / карточка машины / тюнинг.
   * @param {number} width
   * @param {number} pad
   * @param {number} stage
   * @param {number} gap
   * @returns {{midX:number,midW:number,rightX:number,rightW:number}}
   */
  function garageColumns(width, pad, stage, gap) {
    const midX = pad + stage + gap;
    const midW = 400;
    const rightX = midX + midW + gap;
    return { midX, midW, rightX, rightW: width - pad - rightX };
  }

  /**
   * Сколько карточек эфира уже вышло на доску.
   * @param {number} n
   * @param {number} t
   * @param {number} stagger
   * @param {boolean} reduce
   * @returns {number}
   */
  function resultsShown(n, t, stagger, reduce) {
    if (!n) return 0;
    if (reduce) return n;
    return Math.min(n, Math.floor(t / stagger) + 1);
  }

  /**
   * Первые места для доски (не вся сетка).
   * @param {Array|undefined} order
   * @param {number} cap
   * @returns {Array}
   */
  function resultsBoard(order, cap) {
    return order ? order.slice(0, cap) : [];
  }

  /**
   * Гараж: пилот, превью кузова, тюнинг, выход в гонку.
   */
  function drawGarageEngine() {
    const PAD = 48, STAGE = HUB_STAGE_W, GAP = HUB_STAGE_GAP;
    const col = garageColumns(W, PAD, STAGE, GAP);
    const MID_X = col.midX, MID_W = col.midW, RIGHT_X = col.rightX, RIGHT_W = col.rightW;
    const TOP = 108, FOOT = 656;
    const ch = CHARS[save.char], car = CARS[save.car], tun = save.tuning[save.car] || blankTune();
    if (!ch || !car) {
      g.fillStyle = '#16131e'; g.fillRect(0, 0, W, H);
      txt(g, 'ГАРАЖ', W / 2, H / 2, 28, '#ffd23f', 'center');
      return;
    }
    const st = stats(ch, car, tun);
    const stageTrack = typeof careerTrackIdx === 'function' ? careerTrackIdx() : save.race % TRACKDEFS.length;
    const stage = 'ЭТАП ' + (save.race + 1) + '  ·  ' + (raceTrackOverride != null ? 'РЕВАНШ · ' : '') + TRACKDEFS[stageTrack].name + '  ·  ' + DIVN[Math.min(3, ((save.race / TRACKDEFS.length) | 0))];

    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#16131e'); bg.addColorStop(1, '#0a090f');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,210,63,.04)'; g.fillRect(0, 0, W, 96);
    g.strokeStyle = 'rgba(255,210,63,.14)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(PAD, 96); g.lineTo(W - PAD, 96); g.stroke();

    txt(g, 'ГАРАЖ', PAD, 48, 32, '#ffd23f');
    txt(g, stage, W / 2, 48, 14, '#8f88a0', 'center', F_B);
    const cash = fm(save.cash);
    g.font = '20px ' + F_D;
    const cashW = Math.max(168, g.measureText(cash).width + 36);
    panel(g, W - PAD - cashW, 28, cashW, 40, 'rgba(255,210,63,.08)', 'rgba(255,210,63,.38)', 10);
    txt(g, cash, W - PAD - 18, 48, 20, '#ffd23f', 'right');
    if (saveFlash > 0) {
      g.globalAlpha = Math.min(1, saveFlash);
      txt(g, '✓ СОХРАНЕНО', W - PAD, 82, 12, '#58ff6b', 'right', F_B);
      g.globalAlpha = 1;
    }

    drawPilotStage(PAD, TOP, STAGE, FOOT - TOP, ch, { title: ch.name, sub: car.name, subCol: '#9a93a8' });

    const idY = TOP, idH = 132;
    rr(g, MID_X, idY, MID_W, idH, 16); g.fillStyle = 'rgba(18,15,26,.92)'; g.fill();
    g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 1; g.stroke();
    txt(g, ch.short, MID_X + 20, idY + 28, 13, ch.col, 'left', F_B);
    txt(g, car.name, MID_X + 20, idY + 52, 18, '#e8e2d0', 'left');
    txt(g, 'ОСОБЕННОСТИ', MID_X + 20, idY + 78, 11, '#6f6880', 'left', F_B);
    car.traits.forEach(function (tr, ti) {
      const tag = (tr.split(':')[0] || tr).trim();
      const tx = MID_X + 20 + ti * 122, ty = idY + 96;
      g.font = '11px ' + F_B;
      const cw = Math.min(114, Math.ceil(g.measureText(tag).width) + 16);
      rr(g, tx, ty, cw, 20, 6); g.fillStyle = 'rgba(255,210,63,.08)'; g.fill();
      g.strokeStyle = 'rgba(255,210,63,.22)'; g.lineWidth = 1; g.stroke();
      txt(g, tag, tx + 8, ty + 10, 11, '#d8c89a', 'left', F_B, false);
    });

    const bayY = idY + idH + 16, bayH = FOOT - bayY;
    rr(g, MID_X, bayY, MID_W, bayH, 16); g.fillStyle = 'rgba(18,15,26,.92)'; g.fill();
    g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 1; g.stroke();
    const chipH = 52, artH = bayH - chipH - 8;
    g.save();
    rr(g, MID_X + 4, bayY + 4, MID_W - 8, artH, 12); g.clip();
    try { drawDrivingCarPreview(g, MID_X + MID_W / 2, bayY + 4 + artH / 2, MID_W - 8, artH, car, ch); } catch (e) { console.error(e); }
    g.restore();
    drawVhsView(MID_X + 4, bayY + 4, MID_W - 8, artH, 12);
    const chipY = bayY + bayH - chipH, chipW = (MID_W - 48) / 2;
    [['МАКС. СКОРОСТЬ', '~' + Math.round(st.top * .45) + ' КМ/Ч'], ['КОРПУС', String(st.maxhp)]].forEach(function (c, i) {
      const cx = MID_X + 16 + i * (chipW + 16);
      rr(g, cx, chipY, chipW, 36, 8); g.fillStyle = 'rgba(255,255,255,.04)'; g.fill();
      txt(g, c[0], cx + 14, chipY + 12, 10, '#7a7388', 'left', F_B, false);
      txt(g, c[1], cx + 14, chipY + 26, 14, '#e8e2d0', 'left', F_B, false);
    });

    rr(g, RIGHT_X, TOP, RIGHT_W, FOOT - TOP, 16); g.fillStyle = 'rgba(18,15,26,.92)'; g.fill();
    g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 1; g.stroke();
    txt(g, 'ТЮНИНГ', RIGHT_X + 24, TOP + 28, 18, '#ffd23f', 'left');
    txt(g, 'улучшения этой машины', RIGHT_X + RIGHT_W - 24, TOP + 28, 12, '#6f6880', 'right', F_B);

    g._gar = [];
    const rx = RIGHT_X + 20, rw = RIGHT_W - 40, rowH = 52, rowGap = 10;
    let y = TOP + 56;
    TUNING_KEYS.forEach(function (k, i) {
      const sel = tuningSel === i;
      const lvl = tun[k], maxed = lvl >= 6, cost = maxed ? null : UP_COSTS[k][lvl];
      const dis = maxed || save.cash < cost;
      const accent = dis && sel ? '#ff3d2e' : '#ffd23f';
      const fill = dis ? 'rgba(255,61,46,.10)' : 'rgba(255,157,46,.14)';
      drawGarageRow(rx, y, rw, rowH, sel, accent, fill, UP_INFO[k].n, UP_INFO[k].d,
        maxed ? 'МАКС' : fm(cost), maxed ? '#58ff6b' : (dis ? '#6f6880' : '#ffd23f'));
      drawLevelPips(g, rx + rw - 248, y + 22, lvl, 6, dis ? '#6f6880' : '#ffd23f');
      txt(g, lvl + '/6', rx + rw - 162, y + 26, 11, '#8f88a0', 'left', F_B, false);
      g._gar.push({ x: rx, y: y, w: rw, h: rowH, row: i });
      y += rowH + rowGap;
    });

    y += 8;
    g.strokeStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.moveTo(rx, y); g.lineTo(rx + rw, y); g.stroke();
    y += 16;
    const navH = 56, navGap = 8, navW = (rw - navGap * 2) / 3;
    const navs = [
      { row: 5, n: 'ТРЕНАЖЁРКА', d: 'пилот', col: '#b478ff', fill: 'rgba(180,120,255,.16)' },
      { row: 6, n: 'ОРУЖЕЙКА', d: 'ствол и ульта', col: '#ff6b4a', fill: 'rgba(255,107,74,.16)' },
      { row: 7, n: 'АВТОПАРК', d: 'смена машины', col: '#35e0ff', fill: 'rgba(53,224,255,.14)', park: true }
    ];
    navs.forEach(function (nv, i) {
      const nx = rx + i * (navW + navGap), sel = tuningSel === nv.row;
      drawGarageRow(nx, y, navW, navH, sel, nv.col, nv.fill, nv.n, nv.d, '', '');
      g._gar.push({ x: nx, y: y, w: navW, h: navH, row: nv.row, isAutopark: !!nv.park });
    });
    y += navH + 16;
    const selR = tuningSel === 8;
    drawGarageRow(rx, y, rw, 60, selR, '#ff9d2e', 'rgba(255,157,46,.22)', 'В ГОНКУ!', 'пробел — сразу на старт', 'ГОНКА', '#ffd23f');
    g._gar.push({ x: rx, y: y, w: rw, h: 60, row: 8, isRace: true });

    txt(g, '↑ ↓  выбор   ·   ENTER  улучшить   ·   ПРОБЕЛ  гонка   ·   E  лаборатория   ·   ESC  меню', W / 2, H - 28, 13, '#6f6880', 'center', F_B);

    if (garMsgT > 0) {
      g.globalAlpha = Math.min(1, garMsgT);
      panel(g, W / 2 - 220, 100, 440, 32, 'rgba(16,13,22,.96)', '#ffd23f', 10);
      txt(g, garMsg, W / 2, 116, 15, '#ffd23f', 'center');
      g.globalAlpha = 1;
    }
    if (garagePaused) {
      g.fillStyle = 'rgba(5,4,9,.78)'; g.fillRect(0, 0, W, H);
      txt(g, 'ПАУЗА', W / 2, H / 2 - 186, 56, '#ffd23f', 'center');
      const items = pauseGarageItems();
      const step = 48, y0 = H / 2 - 12 - (items.length - 1) * step / 2;
      items.forEach(function (t, i) {
        const yy = y0 + i * step; const sel = i === garagePauseIndex;
        if (sel) panel(g, W / 2 - 220, yy - 22, 440, 42, 'rgba(255,157,46,.15)', '#ff9d2e');
        txt(g, t, W / 2, yy, sel ? 24 : 18, sel ? '#ffd23f' : '#8f88a0', 'center');
      });
      txt(g, '↑↓ — выбор • ENTER — подтвердить • ESC — продолжить', W / 2, y0 + items.length * step + 8, 14, '#6f6880', 'center', F_B);
    }
    drawLabWarn();
  }

  /**
   * Доска мест после заезда: эфир по одному, затем «что дальше».
   */
  function drawResultsEngine() {
    drawTheatreBack();
    const px = 36, py = 16, pw = W - px * 2, ph = H - 36;
    panel(g, px, py, pw, ph, 'rgba(14,11,20,.94)', '#ff9d2e', 22);
    txt(g, 'РЕЗУЛЬТАТЫ — ' + R.T.name, W / 2, 42, 24, '#ffd23f', 'center');
    txt(g, R.quip, W / 2, 66, 13, '#58ff6b', 'center', F_B);
    if (!labTest && R.prize) {
      const mine = R.prize[R.place] || 0;
      txt(g, R.place <= 2 ? ('ТВОЙ ПРИЗ  ' + fm(mine) + '  ·  1 ' + fm(R.prize[0] || 0) + '   2 ' + fm(R.prize[1] || 0) + '   3 ' + fm(R.prize[2] || 0)) : 'ВНЕ ПОДИУМА  ·  1 ' + fm(R.prize[0] || 0) + '   2 ' + fm(R.prize[1] || 0) + '   3 ' + fm(R.prize[2] || 0), W / 2, 84, 15, R.place <= 2 ? '#ffd23f' : '#9a93a8', 'center', F_B);
    }
    const enterY = py + ph - 16;
    const recY = enterY - 50;
    const listTop = labTest ? 80 : 102;
    const board = resultsBoard(R.order, RESULTS_BOARD);
    const n = board.length;
    const gap = 10;
    const room = recY - listTop - 8;
    const blockH = n ? Math.min(124, Math.max(108, ((room - (n - 1) * gap) / n) | 0)) : 118;
    const rowW = pw - 48, rowX = W / 2 - rowW / 2;
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = R.announcerT || 0;
    const shown = resultsShown(n, t, RESULTS_STAGGER, reduce);
    R.resultsShown = shown;
    for (let i = 0; i < shown; i++) {
      const y = listTop + i * (blockH + gap);
      const age = reduce ? 9 : Math.max(0, t - i * RESULTS_STAGGER);
      drawResultCard(g, board[i], i, rowX, y, rowW, blockH, age, reduce);
    }
    if (shown > 0 && shown < n && !reduce) {
      const pulse = 0.4 + 0.6 * Math.sin(gt * 9);
      g.fillStyle = 'rgba(255,157,46,' + pulse + ')';
      g.beginPath(); g.arc(W / 2, listTop + shown * (blockH + gap) - 2, 4, 0, TAU); g.fill();
      txt(g, 'ЭФИР', W / 2 + 16, listTop + shown * (blockH + gap) - 2, 11, '#6f6880', 'left', F_B, false);
    }
    const rec = save.records && save.records[R.tIdx];
    txt(g, 'РЕКОРД ТРАССЫ: круг ' + (rec && rec.bestLap ? fmtT(rec.bestLap) : '—') + ' · лучшее место ' + (rec && rec.bestPlace < 99 ? (rec.bestPlace + 1) : '—') + (R.newRecLap ? '  ·  НОВЫЙ РЕКОРД!' : ''), W / 2, recY, 13, R.newRecLap ? '#58ff6b' : '#9a93a8', 'center', F_B);
    txt(g, 'БАЛАНС: ' + fm(save.cash) + ((R.betStake || 0) > 0 ? (((R.betPay || 0) > 0 ? '  ·  ставка +' : '  ·  ставка −') + fm((R.betPay || 0) > 0 ? R.betPay : R.betStake)) : ''), W / 2, recY + 26, 22, '#ffd23f', 'center');
    if (R && R.msg) drawAnnounceToast(g, R.msg, W / 2, 8, W);
    txt(g, labTest ? 'ENTER — В ЛАБОРАТОРИЮ' : 'ENTER — ЧТО ДАЛЬШЕ', W / 2, enterY, 15, '#ff9d2e', 'center');
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.hub = { TUNING_KEYS, garageColumns, resultsShown, resultsBoard };
  engine.replace('drawGarage', drawGarageEngine);
  engine.replace('drawResults', drawResultsEngine);
})(typeof window !== 'undefined' ? window : globalThis);
