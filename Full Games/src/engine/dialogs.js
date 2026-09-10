////////////////////////////////////////////////////////
//
// DiVANEngine: модалки лаборатории и выхода. Да справа, нет слева.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Пара кнопок «Нет / Да» по центру.
   * @param {number} cx
   * @param {number} by
   * @param {number} [bw]
   * @param {number} [bh]
   * @param {number} [gap]
   * @returns {{nx:number,yx:number,by:number,bw:number,bh:number}}
   */
  function warnPair(cx, by, bw, bh, gap) {
    const w = bw == null ? 160 : bw;
    const h = bh == null ? 48 : bh;
    const g0 = gap == null ? 28 : gap;
    return { nx: cx - g0 / 2 - w, yx: cx + g0 / 2, by: by, bw: w, bh: h };
  }

  /**
   * Карточка предупреждения.
   * @param {'lab'|'exit'} kind
   * @param {number} width
   * @param {number} height
   * @returns {{mx:number,my:number,mw:number,mh:number,pair:object}}
   */
  function warnCard(kind, width, height) {
    const lab = kind === 'lab';
    const mw = lab ? 680 : 600, mh = lab ? 300 : 260;
    const mx = width / 2 - mw / 2, my = height / 2 - (lab ? 150 : 130);
    return { mx, my, mw, mh, pair: warnPair(width / 2, my + mh - 72) };
  }

  /**
   * Край входит, как у настроек.
   * @param {number} x
   * @param {number} y
   * @param {{x:number,y:number,w:number,h:number}} b
   * @returns {boolean}
   */
  function hitInclusive(x, y, b) {
    return !!(b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
  }

  /**
   * Две кнопки модалки: нет — зелёная, да — красная.
   * @param {object} pair
   * @param {boolean} yesSel
   * @param {string} noAct
   * @param {string} yesAct
   * @returns {Array}
   */
  function paintWarnButtons(pair, yesSel, noAct, yesAct) {
    const noSel = !yesSel;
    panel(g, pair.nx, pair.by, pair.bw, pair.bh, noSel ? 'rgba(88,255,107,.16)' : 'rgba(20,17,28,.9)', noSel ? '#58ff6b' : '#3a3548', 10);
    txt(g, 'НЕТ', pair.nx + pair.bw / 2, pair.by + 24, 20, noSel ? '#58ff6b' : '#8f88a0', 'center');
    panel(g, pair.yx, pair.by, pair.bw, pair.bh, yesSel ? 'rgba(255,61,46,.2)' : 'rgba(20,17,28,.9)', yesSel ? '#ff3d2e' : '#3a3548', 10);
    txt(g, 'ДА', pair.yx + pair.bw / 2, pair.by + 24, 20, yesSel ? '#ff3d2e' : '#8f88a0', 'center');
    return [
      { act: noAct, x: pair.nx, y: pair.by, w: pair.bw, h: pair.bh },
      { act: yesAct, x: pair.yx, y: pair.by, w: pair.bw, h: pair.bh }
    ];
  }

  /**
   * Окно: лаборатория может испортить машину.
   */
  function drawLabWarnEngine() {
    if (!labWarn) return;
    g.fillStyle = 'rgba(4,3,8,.7)'; g.fillRect(0, 0, W, H);
    const card = warnCard('lab', W, H);
    panel(g, card.mx, card.my, card.mw, card.mh, 'rgba(16,10,14,.97)', '#ff3d2e', 16);
    txt(g, 'ОПАСНО', W / 2, card.my + 44, 32, '#ff3d2e', 'center');
    const warn = 'В лаборатории легко сломать посадку колёс и кузов. Если вы не участник разработки проекта — лучше туда не лезть.';
    const lines = layoutLines(g, warn, card.mw - 72, 16, F_B);
    lines.forEach(function (ln, i) { txt(g, ln, W / 2, card.my + 96 + i * 22, 16, '#e8e2d0', 'center', F_B); });
    g._labHits = paintWarnButtons(card.pair, labWarnSel === 1, 'labNo', 'labYes');
  }

  /**
   * Клик по «Нет / Да» лаборатории.
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  function clickLabWarnEngine(x, y) {
    const hits = g._labHits || [];
    for (const b of hits) {
      if (!hitInclusive(x, y, b)) continue;
      labWarnSel = b.act === 'labYes' ? 1 : 0;
      confirmLabWarn();
      return true;
    }
    return false;
  }

  /**
   * Подтверждение выхода: Да / Нет, как у лаборатории.
   */
  function drawExitWarnEngine() {
    if (!exitWarn) return;
    g.fillStyle = 'rgba(4,3,8,.7)'; g.fillRect(0, 0, W, H);
    const card = warnCard('exit', W, H);
    panel(g, card.mx, card.my, card.mw, card.mh, 'rgba(12,8,16,.97)', '#ff9d2e', 16);
    txt(g, 'ВЫХОД', W / 2, card.my + 48, 36, '#ffd23f', 'center');
    txt(g, 'Закрыть игру и выйти?', W / 2, card.my + 100, 18, '#e8e2d0', 'center', F_B);
    g._exitHits = paintWarnButtons(card.pair, exitWarnSel === 1, 'exitNo', 'exitYes');
  }

  /**
   * Клик по выходу.
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  function clickExitWarnEngine(x, y) {
    const hits = g._exitHits || [];
    for (const b of hits) {
      if (!hitInclusive(x, y, b)) continue;
      exitWarnSel = b.act === 'exitYes' ? 1 : 0;
      confirmExitWarn();
      return true;
    }
    return false;
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.dialogs = { warnPair, warnCard, hitInclusive };
  engine.replace('drawLabWarn', drawLabWarnEngine);
  engine.replace('clickLabWarn', clickLabWarnEngine);
  engine.replace('drawExitWarn', drawExitWarnEngine);
  engine.replace('clickExitWarn', clickExitWarnEngine);
})(typeof window !== 'undefined' ? window : globalThis);
