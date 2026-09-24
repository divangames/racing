////////////////////////////////////////////////////////
//
// DiVANEngine: экран старта заезда — ставка, сетка, «в бой».
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Колонка пилота и доска коэффициентов.
   * @param {number} width
   * @param {number} pad
   * @returns {{left:number,stage:number,rightX:number,rightW:number,chipW:number}}
   */
  function preraceColumns(width, pad) {
    const stage = 300, gap = 22;
    const left = pad;
    const rightX = left + stage + gap;
    const rightW = width - pad - rightX;
    return { left, stage, rightX, rightW, chipW: (rightW - 64) / 2 };
  }

  /** Нижняя панель: все действия стоят на одной сетке и не прилипают к краю. */
  function preraceBottomLayout(width, height, pad) {
    const dockY = height - 132;
    const dockH = 92;
    const stakeW = 132;
    const stakeGap = 10;
    const ctaW = 190;
    const ctaX = width - pad - 20 - ctaW;
    const payoutX = pad + 20 + (stakeW + stakeGap) * 3 + 28;
    return {
      dockX: pad,
      dockY,
      dockW: width - pad * 2,
      dockH,
      contentFoot: dockY - 14,
      controlY: dockY + 34,
      stakeX: pad + 20,
      stakeW,
      stakeGap,
      payoutX,
      payoutW: Math.max(220, ctaX - payoutX - 28),
      ctaX,
      ctaW,
      footerY: height - 30
    };
  }

  /**
   * Старт: на кого ставим, сумма, выплата, вход в бой.
   */
  function drawPreRaceEngine() {
    if (!raceBoard) raceBoard = makeRaceBoard();
    clampBetAfford();
    const board = raceBoard;
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pick = board.pick | 0;
    const who = board.specs[pick];
    const od = board.odds[pick];
    const cost = BET_TABLE[save.bet | 0].cost;
    const tIdx = typeof careerTrackIdx === 'function' ? careerTrackIdx() : save.race % TRACKDEFS.length;
    const track = TRACKDEFS[tIdx];
    const divI = ((save.race / TRACKDEFS.length) | 0);
    const accent = who.isBoss ? '#ff9d2e' : (who.isP ? '#ffd23f' : '#35e0ff');
    drawHubBackdrop(who.isBoss ? 'rgba(196,90,26,.06)' : 'rgba(255,210,63,.04)');
    drawHubHeader('СТАРТ', (raceTrackOverride != null ? 'реванш · ' : 'этап ' + (save.race + 1) + '  ·  ') + track.name + '  ·  ' + DIVN[Math.min(3, divI)], accent);
    const col = preraceColumns(W, HUB_PAD);
    const bottom = preraceBottomLayout(W, H, HUB_PAD);
    const foot = bottom.contentFoot;
    const top = HUB_TOP, stageH = foot - top;
    const tag = who.isP ? 'ТЫ' : (who.isBoss ? 'БОСС' : 'ПЕЛОТОН');
    drawPilotStage(col.left, top, col.stage, stageH, who.ch, { title: who.ch.short || who.ch.name, sub: who.car.name + '  ·  ' + tag, subCol: accent });
    drawHubCard(col.rightX, top, col.rightW, stageH, accent);
    txt(g, 'НА КОГО СТАВИМ', col.rightX + 26, top + 26, 12, '#8f88a0', 'left', F_B);
    txt(g, fmtOdds(od.k1), col.rightX + 26, top + 72, 44, accent, 'left', F_D);
    txt(g, 'победа', col.rightX + 26, top + 98, 12, '#6f6880', 'left', F_B);
    const chip = function (label, val, x, y, w, chipCol) {
      rr(g, x, y, w, 44, 10); g.fillStyle = 'rgba(8,6,12,.55)'; g.fill();
      g.strokeStyle = chipCol + '44'; g.lineWidth = 1; g.stroke();
      txt(g, label, x + 14, y + 16, 11, '#6f6880', 'left', F_B);
      txt(g, fmtOdds(val), x + 14, y + 34, 16, chipCol, 'left', F_D);
    };
    chip('2 МЕСТО', od.k2, col.rightX + 26, top + 114, col.chipW, '#d8d4e0');
    chip('3 МЕСТО', od.k3, col.rightX + 38 + col.chipW, top + 114, col.chipW, '#e09a5a');
    const listY = top + 172, listH = foot - top - 188;
    const n = board.specs.length, rowH = listH / n;
    g._preHits = [];
    board.specs.forEach(function (sp, i) {
      const y = listY + i * rowH, h = rowH - 6;
      const sel = i === pick;
      const hot = mx > col.rightX + 14 && mx < col.rightX + col.rightW - 14 && my > y && my < y + h;
      const ac = sp.isBoss ? '#ff9d2e' : (sp.isP ? '#ffd23f' : '#c8c0d4');
      rr(g, col.rightX + 14, y, col.rightW - 28, h, 12);
      g.fillStyle = sel ? 'rgba(255,210,63,.12)' : (hot ? 'rgba(255,255,255,.05)' : 'rgba(8,6,12,.35)');
      g.fill();
      if (sel) { g.strokeStyle = ac; g.lineWidth = 1.6; g.stroke(); g.fillStyle = ac; g.fillRect(col.rightX + 14, y + 10, 3, h - 20); }
      g._preHits.push({ act: 'pick', id: i, x: col.rightX + 14, y: y, w: col.rightW - 28, h: h });
      const av = Math.min(52, h - 16);
      drawBetFace(sp.ch, col.rightX + 48, y + h / 2, av);
      txt(g, sp.ch.short || sp.ch.name, col.rightX + 84, y + h / 2 - 8, sel ? 17 : 15, sel ? '#fff' : '#e8e2d0', 'left', F_B);
      txt(g, (sp.isP ? 'ты  ·  ' : sp.isBoss ? 'босс  ·  ' : '') + sp.car.name, col.rightX + 84, y + h / 2 + 12, 11, sel ? ac : '#7a7388', 'left', F_B);
      txt(g, fmtOdds(board.odds[i].k1), col.rightX + col.rightW - 36, y + h / 2, sel ? 22 : 18, ac, 'right', F_D);
    });
    const menu = global.DiVANEngine && global.DiVANEngine.menu;
    if (menu) menu.frame(g, bottom.dockX, bottom.dockY, bottom.dockW, bottom.dockH, false, false, 'prerace-actions');
    else panel(g, bottom.dockX, bottom.dockY, bottom.dockW, bottom.dockH, 'rgba(14,20,27,.96)', '#364550', 8);
    txt(g, 'СУММА СТАВКИ', bottom.stakeX, bottom.dockY + 18, 11, '#8f88a0', 'left', F_B);
    BET_TABLE.forEach(function (b, i) {
      const can = save.cash >= b.cost, sel = (save.bet | 0) === i;
      const bw = bottom.stakeW, bh = 42, x = bottom.stakeX + i * (bw + bottom.stakeGap), y = bottom.controlY;
      if (menu) menu.frame(g, x, y, bw, bh, sel, !can, 'prerace-stake-' + i);
      else panel(g, x, y, bw, bh, sel && can ? 'rgba(147,186,199,.16)' : '#141c23', sel ? '#93bac7' : '#364550', 7);
      txt(g, b.name, x + bw / 2, y + bh / 2, 15, can ? (sel ? '#e5ebef' : '#a6b3bd') : '#64727c', 'center', F_B);
      g._preHits.push({ act: 'stake', i: i, x: x, y: y, w: bw, h: bh, locked: !can });
    });
    const pays = [betPayoutFor(cost, od, 0), betPayoutFor(cost, od, 1), betPayoutFor(cost, od, 2)];
    const pcols = ['#ffd23f', '#d8d4e0', '#e09a5a'];
    const px = bottom.payoutX;
    if (cost > 0) {
      txt(g, 'ВОЗМОЖНАЯ ВЫПЛАТА', px, bottom.dockY + 18, 11, '#8f88a0', 'left', F_B);
      const payStep = bottom.payoutW / 3;
      ['1', '2', '3'].forEach(function (lb, i) {
        txt(g, lb, px + i * payStep, bottom.controlY + 21, 12, '#84939f', 'left', F_B);
        txt(g, fm(pays[i]), px + i * payStep + 18, bottom.controlY + 21, 17, pcols[i], 'left', F_D);
      });
    } else {
      txt(g, 'ВЫПЛАТА', px, bottom.dockY + 18, 11, '#8f88a0', 'left', F_B);
      txt(g, 'без ставки · только приз за место', px, bottom.controlY + 21, 14, '#a6b3bd', 'left', F_B);
    }
    const ctaY = bottom.dockY + 23;
    if (menu) menu.frame(g, bottom.ctaX, ctaY, bottom.ctaW, 52, true, false, 'prerace-go');
    else panel(g, bottom.ctaX, ctaY, bottom.ctaW, 52, 'rgba(147,186,199,.16)', '#93bac7', 7);
    txt(g, 'В БОЙ', bottom.ctaX + 24, ctaY + 21, 17, '#e5ebef', 'left', F_B);
    txt(g, 'ENTER', bottom.ctaX + 24, ctaY + 39, 10, '#93bac7', 'left', F_B);
    txt(g, '›', bottom.ctaX + bottom.ctaW - 24, ctaY + 26, 24, '#93bac7', 'center', F_B);
    g._preHits.push({ act: 'go', x: bottom.ctaX, y: ctaY, w: bottom.ctaW, h: 52 });
    txt(g, '← →  ПИЛОТ     ↑ ↓  СУММА     ESC  ГАРАЖ', W / 2, bottom.footerY, 11, '#84939f', 'center', F_B);
    if (!reduce && who.isBoss) {
      g.globalAlpha = .08 + .04 * Math.sin(gt * 2.2);
      g.strokeStyle = '#c45a1a'; g.lineWidth = 2;
      rr(g, col.left - 2, top - 2, col.stage + 4, stageH + 4, 18); g.stroke(); g.globalAlpha = 1;
    }
    drawHubToast();
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.prerace = { preraceColumns, preraceBottomLayout };
  engine.replace('drawPreRace', drawPreRaceEngine);
})(typeof window !== 'undefined' ? window : globalThis);
