////////////////////////////////////////////////////////
//
// DiVANEngine: сетка гонщиков и досье.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Геометрия кольцевой ленты: в окне помещается ровно 4,5 карточки.
   * Две крайние карточки симметрично обрезаются границами сцены.
   * @param {number} width
   * @param {number} n
   * @param {number} [gap]
   * @returns {{cw:number,x0:number,pitch:number,clipX:number,clipW:number,cardsInView:number}}
   */
  function charCardLayout(width, n, gap) {
    const g = gap == null ? 18 : gap;
    const cardsInView = 4.5;
    const clipX = Math.max(24, Math.min(42, width * .025));
    const clipW = Math.max(320, width - clipX * 2);
    const cw = Math.max(150, (clipW - g * 4) / cardsInView);
    return { cw, x0: (width - cw) / 2, pitch: cw + g, clipX, clipW, cardsInView };
  }

  /** Кратчайшее расстояние между двумя позициями на кольце. */
  function charWrapDelta(from, to, n) {
    if (!n) return 0;
    let d = to - from;
    d = ((d % n) + n) % n;
    if (d > n / 2) d -= n;
    return d;
  }

  let charScroll = null;

  /**
   * Карточки PLAYABLE_IDS, кнопка «назад», пепел.
   */
  function drawCharSelEngine() {
    drawHubBackdrop();
    drawCharSelAsh(g);
    txt(g, 'ВЫБЕРИ ГОНЩИКА', W / 2, 64, 40, '#ffd23f', 'center');
    g._charCards = [];
    g._bioBtns = [];
    g._charNav = [];
    g._charDots = [];
    const ids = PLAYABLE_IDS, n = PLAYABLE_N, gap = 18;
    const vx = typeof stageX0 === 'function' ? stageX0() : 0;
    const vw = typeof viewW === 'number' && viewW > 0 ? viewW : W;
    const lay = charCardLayout(vw, n, gap);
    const cw = lay.cw, pitch = lay.pitch;
    const clipX = vx + lay.clipX, clipRight = clipX + lay.clipW;
    const centerX = vx + vw / 2;
    let selPos = ids.indexOf(selChar);
    if (selPos < 0) selPos = 0;
    if (charScroll == null || !Number.isFinite(charScroll)) charScroll = selPos;
    const scrollDelta = charWrapDelta(charScroll, selPos, n);
    charScroll = introReduceMotion||global.DiVANEngine.menu?.inputMode?.()==='keyboard'
      ?selPos:charScroll+(Math.abs(scrollDelta)<.002?scrollDelta:scrollDelta*.2);
    charScroll = ((charScroll % n) + n) % n;
    const cards = ids.map(function (idx, slot) {
      const d = charWrapDelta(charScroll, slot, n);
      return { idx: idx, slot: slot, d: d, x: centerX + d * pitch - cw / 2 };
    }).filter(function (item) {
      return item.x < clipRight && item.x + cw > clipX;
    }).sort(function (a, b) {
      return Math.abs(b.d) - Math.abs(a.d);
    });
    g._charCarousel = { cardWidth: cw, pitch: pitch, clipX: clipX, clipW: lay.clipW, cardsInView: lay.cardsInView, visible: cards.length };
    g.save();
    g.beginPath(); g.rect(clipX, 96, lay.clipW, 524); g.clip();
    cards.forEach(function (item) {
      const idx = item.idx, ch = CHARS[idx], x = item.x, sel = idx === selChar, y = 104, h = 500;
      panel(g, x, y, cw, h, sel ? 'rgba(255,157,46,.12)' : 'rgba(20,17,28,.9)', sel ? '#ffd23f' : '#3a3548');
      drawPortrait(g, ch, x + cw / 2, y + 118, cw > 280 ? 1.14 : (cw > 220 ? 1.05 : .88));
      const nick = ch.name !== ch.short ? ch.short : '';
      txt(g, ch.name, x + cw / 2, y + (nick ? 232 : 242), cw > 220 ? 20 : 16, ch.col, 'center');
      if (nick) txt(g, nick, x + cw / 2, y + 256, 16, '#fff', 'center');
      const pipX = x + Math.min(118, cw - 92);
      const eff = charEff(idx);
      const bars = [['СКОРОСТЬ', eff.spd, '#ff6b4a'], ['ПОВОРОТ', eff.crn, '#35e0ff'], ['БРОНЯ', eff.grt, '#58ff6b']];
      bars.forEach(function (b, bi) {
        txt(g, b[0], x + 14, y + 278 + bi * 26, 12, '#c4bdce', 'left', F_B);
        statPips(g, pipX, y + 272 + bi * 26, b[1], b[2]);
      });
      const slvlC = (save && save.skills && save.skills[idx]) || 1;
      drawSkillBlock(g, x + 8, y + 358, cw - 16, idx, slvlC);
      const bioLines = layoutLines(g, ch.bio, cw - 28, 11, F_B);
      bioLines.slice(0, 2).forEach((line, li) => txt(g, line + (li === 1 && bioLines.length > 2 ? '…' : ''), x + cw / 2, y + 438 + li * 14, 11, '#e8e2d0', 'center', F_B));
      const bbx = x + cw / 2 - 64, bby = y + h - 42, bbw = 128, bbh = 28;
      const hot = mx > bbx && mx < bbx + bbw && my > bby && my < bby + bbh;
      panel(g, bbx, bby, bbw, bbh, (sel || hot) ? 'rgba(53,224,255,.15)' : 'rgba(20,17,28,.9)', (sel || hot) ? '#35e0ff' : '#3a3548', 8);
      txt(g, 'ВЫБРАТЬ', x + cw / 2, bby + bbh / 2, 12, (sel || hot) ? '#35e0ff' : '#c8c2d4', 'center', F_B);
      const hitX = Math.max(x, clipX), hitR = Math.min(x + cw, clipRight);
      const btnX = Math.max(bbx, clipX), btnR = Math.min(bbx + bbw, clipRight);
      if (btnR > btnX) g._bioBtns.push({ x: btnX, y: bby, w: btnR - btnX, h: bbh, idx: idx });
      if (hitR > hitX) g._charCards.push({ x: hitX, y: y, w: hitR - hitX, h: h, idx: idx });
    });
    g.restore();
    if (n > 1) {
      const ay = 358, aw = 46, ah = 86;
      const leftX = clipX + 4, rightX = clipRight - aw - 4;
      const pulse = .72 + Math.sin(gt * 3.2) * .18;
      g.save(); g.globalAlpha = pulse; g.fillStyle = global.DiVANEngine.menu?.colors.accent||'#35e0ff';
      g.beginPath(); g.moveTo(leftX + 28, ay + 22); g.lineTo(leftX + 12, ay + ah / 2); g.lineTo(leftX + 28, ay + ah - 22); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(rightX + aw - 28, ay + 22); g.lineTo(rightX + aw - 12, ay + ah / 2); g.lineTo(rightX + aw - 28, ay + ah - 22); g.closePath(); g.fill();
      g.restore();
      g._charNav.push({ x: leftX, y: ay, w: aw, h: ah, dir: -1 });
      g._charNav.push({ x: rightX, y: ay, w: aw, h: ah, dir: 1 });
    }
    const dotsGap = 20, dotsW = n * dotsGap, dotsY = H - 96;
    const railW = dotsW + 18, railH = 20, railX = centerX - railW / 2, railY = dotsY - railH / 2;
    rr(g, railX, railY, railW, railH, 10); g.fillStyle = 'rgba(11,16,21,.88)'; g.fill();
    g.strokeStyle = 'rgba(147,186,199,.32)'; g.lineWidth = 1; g.stroke();
    const dotsX = centerX - dotsW / 2;
    for (let p = 0; p < n; p++) {
      const on = p === selPos;
      g.fillStyle = on ? global.DiVANEngine.menu?.colors.accent||'#35e0ff' : global.DiVANEngine.menu?.colors.line||'#3a3548';
      const dotX = dotsX + p * dotsGap + dotsGap / 2;
      if (on) { rr(g, dotX - 7, dotsY - 3, 14, 6, 3); g.fill(); }
      else { g.beginPath(); g.arc(dotX, dotsY, 2.8, 0, TAU); g.fill(); }
      g._charDots.push({ x: dotX - dotsGap / 2, y: railY, w: dotsGap, h: railH, idx: ids[p] });
    }
    const backW = 220, backH = 32, backX = W / 2 - backW / 2, backY = H - 80;
    const backHot = mx > backX && mx < backX + backW && my > backY && my < backY + backH;
    panel(g, backX, backY, backW, backH, backHot ? 'rgba(255,157,46,.15)' : 'rgba(20,17,28,.9)', backHot ? '#ff9d2e' : '#3a3548', 8);
    txt(g, 'НАЗАД В МЕНЮ [ESC]', W / 2, backY + backH / 2, 13, backHot ? '#ff9d2e' : '#9a93a8', 'center', F_B);
    g._charBack = { x: backX, y: backY, w: backW, h: backH };
    const hintY = H - 32;
    txt(g, '← → — выбор • ENTER / «ВЫБРАТЬ» — досье • ESC — главное меню', W / 2, hintY, 13, '#6f6880', 'center', F_B);
    g._charFooter = { dotsY: dotsY, railY: railY, railH: railH, backY: backY, backH: backH, hintY: hintY, bottomLineY: H - 18 };
    if (typeof drawCharNameBark === 'function' && g._charCards) {
      const card = g._charCards.find(function (b) { return b.idx === selChar; });
      if (card) drawCharNameBark(g, card);
    }
  }

  /**
   * Широкая карточка досье: био, статы, выбрать / закрыть.
   */
  function drawBioEngine() {
    if (bioOpen < 0) return;
    const ch = CHARS[bioOpen];
    g.fillStyle = 'rgba(5,4,9,.88)'; g.fillRect(stageX0(), stageY0(), viewW, viewH);
    const px = W / 2 - 470, py = 36, pw = 940, ph = 648;
    panel(g, px, py, pw, ph, 'rgba(14,11,22,.97)', ch.col, 0);
    g.save();
    g.strokeStyle = ch.col; g.lineWidth = 4; g.lineCap = 'square'; g.lineJoin = 'miter';
    const cb = 28;
    g.beginPath();
    g.moveTo(px, py + cb); g.lineTo(px, py); g.lineTo(px + cb, py);
    g.moveTo(px + pw - cb, py); g.lineTo(px + pw, py); g.lineTo(px + pw, py + cb);
    g.moveTo(px + pw, py + ph - cb); g.lineTo(px + pw, py + ph); g.lineTo(px + pw - cb, py + ph);
    g.moveTo(px + cb, py + ph); g.lineTo(px, py + ph); g.lineTo(px, py + ph - cb);
    g.stroke();
    g.restore();
    g.fillStyle = 'rgba(255,255,255,.02)';
    for (let yy = py + 6; yy < py + ph - 6; yy += 4) g.fillRect(px + 6, yy, pw - 12, 1);
    panel(g, px + 24, py + 18, 300, 40, 'rgba(255,255,255,.05)', ch.col, 10);
    txt(g, 'ДОСЬЕ ГОНЩИКА', px + 40, py + 38, 16, ch.col, 'left', F_D);
    txt(g, '// СОВЕРШЕННО СЕКРЕТНО // +18', px + pw - 32, py + 38, 12, '#6f6880', 'right', F_B);
    g.save(); g.shadowColor = ch.col; g.shadowBlur = 36;
    drawPortrait(g, ch, px + 188, py + 248, 1.8);
    g.restore();
    const rx = px + 380;
    txt(g, ch.name, rx, py + 120, 44, ch.col, 'left');
    g.strokeStyle = ch.col; g.lineWidth = 2; g.beginPath(); g.moveTo(rx, py + 150); g.lineTo(rx + 400, py + 150); g.stroke();
    wrapText(g, '«' + ch.bio + '»', rx + 200, py + 190, 420, 20, 14, '#c8b8a0', F_B);
    const effB = charEff(bioOpen);
    const keys3 = ['spd', 'crn', 'grt'];
    const bars = [['СКОРОСТЬ', effB.spd, '#ff6b4a'], ['ПОВОРОТ', effB.crn, '#35e0ff'], ['БРОНЯ', effB.grt, '#58ff6b']];
    g._statBtns = [];
    bars.forEach(function (b, bi) {
      const by = py + 268 + bi * 34;
      txt(g, b[0], rx, by, 14, '#c4bdce', 'left', F_B);
      statPips(g, rx + 118, by - 6, b[1], b[2]);
      txt(g, b[1] + '/5', rx + 118 + 5 * 18 + 10, by, 12, '#a8a0b4', 'left', F_B);
      const cs = (save && save.cstats && save.cstats[bioOpen]) || { spd: 0, crn: 0, grt: 0 };
      const key = keys3[bi]; const base = ({ spd: ch.spd, crn: ch.crn, grt: ch.grt })[key];
      const cur = cs[key], maxAdd = 5 - base;
      if (cur < maxAdd) {
        const cost = STAT_COSTS[Math.min(cur, STAT_COSTS.length - 1)];
        const can = save.cash >= cost;
        const bx = rx + 300, bw = 112, bh = 22, byy = by - 11;
        const hot = mx > bx && mx < bx + bw && my > byy && my < byy + bh;
        panel(g, bx, byy, bw, bh, hot ? 'rgba(88,255,107,.18)' : 'rgba(20,17,28,.9)', can ? '#58ff6b' : '#ff3d2e', 6);
        txt(g, '+ ' + fm(cost), bx + bw / 2, byy + bh / 2, 11, can ? '#58ff6b' : '#ff3d2e', 'center', F_B);
        g._statBtns.push({ x: bx, y: byy, w: bw, h: bh, key: key });
      } else {
        txt(g, 'МАКС', rx + 340, by, 12, '#58ff6b', 'left', F_B);
      }
    });
    if (garMsgT > 0) { g.globalAlpha = Math.min(1, garMsgT); txt(g, garMsg, rx + 200, py + 248, 14, '#ffd23f', 'center'); g.globalAlpha = 1; }
    const slvlB = (save && save.skills && save.skills[bioOpen]) || 1;
    drawSkillBlock(g, rx - 8, py + 268 + 3 * 34 + 12, 430, bioOpen, slvlB);
    g.strokeStyle = 'rgba(255,255,255,.1)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(px + 40, py + 468); g.lineTo(px + pw - 40, py + 468); g.stroke();
    txt(g, '// БИОГРАФИЯ', px + 40, py + 490, 13, '#9a93a8', 'left', F_B);
    wrapText(g, ch.bioFull, px + pw / 2, py + 518, pw - 120, 22, 15, '#e8e2d0', F_B);
    g._bioActs = [];
    const bw = 280, bh = 46, by = py + ph - 64;
    const bx1 = W / 2 - bw - 16, bx2 = W / 2 + 16;
    const hot1 = mx > bx1 && mx < bx1 + bw && my > by && my < by + bh;
    panel(g, bx1, by, bw, bh, hot1 ? 'rgba(88,255,107,.18)' : 'rgba(20,17,28,.9)', hot1 ? '#58ff6b' : '#3a3548', 10);
    txt(g, 'ВЫБРАТЬ ГОНЩИКА [ENTER]', bx1 + bw / 2, by + bh / 2, 15, hot1 ? '#58ff6b' : '#9a93a8', 'center', F_B);
    g._bioActs.push({ x: bx1, y: by, w: bw, h: bh, act: 'pick' });
    const hot2 = mx > bx2 && mx < bx2 + bw && my > by && my < by + bh;
    panel(g, bx2, by, bw, bh, hot2 ? 'rgba(255,157,46,.15)' : 'rgba(20,17,28,.9)', hot2 ? '#ff9d2e' : '#3a3548', 10);
    txt(g, 'ЗАКРЫТЬ [ESC]', bx2 + bw / 2, by + bh / 2, 15, hot2 ? '#ff9d2e' : '#9a93a8', 'center', F_B);
    g._bioActs.push({ x: bx2, y: by, w: bw, h: bh, act: 'close' });
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.roster = { charCardLayout, charWrapDelta };
  engine.replace('drawCharSel', drawCharSelEngine);
  engine.replace('drawBio', drawBioEngine);
  let charWheelAt = -Infinity;
  if (typeof cv !== 'undefined' && cv && cv.addEventListener) {
    cv.addEventListener('wheel', function (event) {
      if (typeof state === 'undefined' || state !== 'char' || bioOpen >= 0) return;
      const axis = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      const dir = axis > 6 ? 1 : (axis < -6 ? -1 : 0);
      if (!dir) return;
      event.preventDefault();
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (now - charWheelAt < 140) return;
      charWheelAt = now;
      wrapPlayable(dir);
      sClick();
    }, { passive: false });
  }
})(typeof window !== 'undefined' ? window : globalThis);
