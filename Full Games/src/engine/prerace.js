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
    const foot = 548;
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
    const barY = foot + 14;
    txt(g, 'СУММА', HUB_PAD, barY + 6, 11, '#6f6880', 'left', F_B);
    BET_TABLE.forEach(function (b, i) {
      const can = save.cash >= b.cost, sel = (save.bet | 0) === i;
      const bw = 132, bh = 40, x = HUB_PAD + i * (bw + 10), y = barY + 16;
      panel(g, x, y, bw, bh, sel && can ? 'rgba(255,210,63,.16)' : (can ? 'rgba(16,13,22,.9)' : 'rgba(10,8,14,.7)'), sel ? (can ? '#ffd23f' : '#5a5468') : (can ? '#3a3548' : '#2a2630'), 8);
      txt(g, b.name, x + bw / 2, y + 20, 15, can ? b.col : '#4a4554', 'center', F_B);
      g._preHits.push({ act: 'stake', i: i, x: x, y: y, w: bw, h: bh, locked: !can });
    });
    const pays = [betPayoutFor(cost, od, 0), betPayoutFor(cost, od, 1), betPayoutFor(cost, od, 2)];
    const pcols = ['#ffd23f', '#d8d4e0', '#e09a5a'];
    const px = W / 2 - 20;
    if (cost > 0) {
      txt(g, 'ВЫПЛАТА', px, barY + 6, 11, '#6f6880', 'left', F_B);
      ['1', '2', '3'].forEach(function (lb, i) {
        txt(g, lb + '  ' + fm(pays[i]), px + i * 118, barY + 36, 18, pcols[i], 'left', F_D);
      });
    } else txt(g, 'без ставки — только приз за место', px, barY + 34, 14, '#6f6880', 'left', F_B);
    const cta = 'ENTER  —  В БОЙ';
    g.font = '15px ' + F_D;
    const ctaW = Math.ceil(g.measureText(cta).width) + 40;
    const ctaX = W - HUB_PAD - ctaW, ctaY = barY + 14;
    rr(g, ctaX, ctaY, ctaW, 36, 8); g.fillStyle = accent + '22'; g.fill();
    g.strokeStyle = accent + '99'; g.lineWidth = 1.5; g.stroke();
    txt(g, cta, ctaX + ctaW / 2, ctaY + 18, 15, accent, 'center', F_B, false);
    g._preHits.push({ act: 'go', x: ctaX, y: ctaY, w: ctaW, h: 36 });
    txt(g, '← →  пилот   ·   ↑ ↓  сумма   ·   ESC  гараж', W / 2, H - 18, 12, '#6f6880', 'center', F_B);
    if (!reduce && who.isBoss) {
      g.globalAlpha = .08 + .04 * Math.sin(gt * 2.2);
      g.strokeStyle = '#c45a1a'; g.lineWidth = 2;
      rr(g, col.left - 2, top - 2, col.stage + 4, stageH + 4, 18); g.stroke(); g.globalAlpha = 1;
    }
    drawHubToast();
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.prerace = { preraceColumns };
  engine.replace('drawPreRace', drawPreRaceEngine);
})(typeof window !== 'undefined' ? window : globalThis);
