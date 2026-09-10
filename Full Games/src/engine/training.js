////////////////////////////////////////////////////////
//
// DiVANEngine: тренажёрка пилота и верстак ствола/ульты.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /** Статы качаются в том же порядке, что строки 0–2. */
  const GYM_KEYS = ['spd', 'crn', 'grt'];

  /**
   * Сколько ещё можно докинуть до потолка 5.
   * @param {number} base
   * @returns {number}
   */
  function gymMaxAdd(base) {
    return 5 - base;
  }

  /**
   * Тренажёрка: три стата и личный скил.
   */
  function drawGymEngine() {
    const chI = save.char, ch = CHARS[chI];
    if (!save.cstats) save.cstats = blankCstatsMap();
    const cs = save.cstats[chI] || (save.cstats[chI] = { spd: 0, crn: 0, grt: 0 });
    const eff = charEff(chI);
    const lvl = save.skills[chI] || 1;
    const STAGE = HUB_STAGE_W, GAP = HUB_STAGE_GAP;
    const RIGHT_X = HUB_PAD + STAGE + GAP, RIGHT_W = W - HUB_PAD - RIGHT_X;

    drawHubBackdrop('rgba(180,120,255,.05)');
    drawHubHeader('ТРЕНАЖЁРКА', 'качаем гонщика, а не тачку', '#b478ff');

    drawPilotStage(HUB_PAD, HUB_TOP, STAGE, HUB_FOOT - HUB_TOP, ch, {
      title: ch.name, sub: SKILL_META[chI].n + '  ·  ур.' + lvl, subCol: '#c89bff'
    });

    drawHubCard(RIGHT_X, HUB_TOP, RIGHT_W, HUB_FOOT - HUB_TOP);
    txt(g, 'ПРОКАЧКА', RIGHT_X + 24, HUB_TOP + 28, 18, '#b478ff', 'left');
    txt(g, 'база и личный скил', RIGHT_X + RIGHT_W - 24, HUB_TOP + 28, 12, '#6f6880', 'right', F_B);

    g._gymBtns = [];
    const rx = RIGHT_X + 20, rw = RIGHT_W - 40, rowH = 72, rowGap = 12;
    const rows = [
      { key: 'spd', label: 'СКОРОСТЬ', val: eff.spd, base: ch.spd, col: '#ff6b4a', d: 'макс. скорость гонщика' },
      { key: 'crn', label: 'ПОВОРОТ', val: eff.crn, base: ch.crn, col: '#35e0ff', d: 'острее руль, меньше запаздывания' },
      { key: 'grt', label: 'БРОНЯ', val: eff.grt, base: ch.grt, col: '#58ff6b', d: 'запас корпуса пилота' }
    ];
    let y = HUB_TOP + 52;
    rows.forEach(function (rwRow, i) {
      const sel = gymSel === i;
      const cur = cs[rwRow.key], maxAdd = gymMaxAdd(rwRow.base), maxed = cur >= maxAdd;
      const cost = maxed ? null : STAT_COSTS[Math.min(cur, STAT_COSTS.length - 1)];
      const can = !maxed && save.cash >= cost;
      drawGarageRow(rx, y, rw, rowH, sel, rwRow.col, 'rgba(255,157,46,.14)',
        rwRow.label, rwRow.d, maxed ? 'МАКС' : '', maxed ? '#58ff6b' : '#ffd23f');
      statPips(g, rx + 168, y + 14, rwRow.val, rwRow.col);
      txt(g, rwRow.val + '/5', rx + 268, y + 19, 11, '#8f88a0', 'left', F_B, false);
      if (!maxed) {
        const bx = rx + rw - 118, by = y + 16, bw = 100, bh = 40;
        drawHubPlus(bx, by, bw, bh, can, sel, fm(cost));
        g._gymBtns.push({ idx: i, x: bx, y: by, w: bw, h: bh });
      }
      g._gymBtns.push({ idx: i, x: rx, y: y, w: rw, h: rowH });
      y += rowH + rowGap;
    });
    y += 6;
    g.strokeStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.moveTo(rx, y); g.lineTo(rx + rw, y); g.stroke();
    y += 14;
    const selS = gymSel === 3, skH = HUB_FOOT - (y + 16);
    drawGarageRow(rx, y, rw, skH, selS, '#b478ff', 'rgba(180,120,255,.16)',
      SKILL_META[chI].n, SKILL_DESC(chI, lvl), lvl >= SKILL_MAX ? 'МАКС' : '', '#58ff6b');
    statPipsN(g, rx + 22, y + 50, lvl, SKILL_MAX, '#d4b0ff');
    txt(g, 'ур.' + lvl + '/' + SKILL_MAX, rx + 22 + SKILL_MAX * 16 + 10, y + 55, 11, '#8f88a0', 'left', F_B, false);
    if (lvl < SKILL_MAX) {
      const cost = SKILL_COSTS[lvl - 1], can = save.cash >= cost;
      const bx = rx + rw - 118, by = y + 16, bw = 100, bh = 40;
      drawHubPlus(bx, by, bw, bh, can, selS, fm(cost));
      g._gymBtns.push({ idx: 3, x: bx, y: by, w: bw, h: bh });
    }
    g._gymBtns.push({ idx: 3, x: rx, y: y, w: rw, h: skH });

    txt(g, '↑ ↓  выбор   ·   ENTER / «+»  качать   ·   ESC  в гараж', W / 2, H - 28, 13, '#6f6880', 'center', F_B);
    drawHubToast();
  }

  /**
   * Карточка ствола или ульты на верстаке.
   */
  function drawArmCardEngine(x, y, w, h, sel, key, title, name, blurb, col) {
    const tun = ensureTuneGuns(save.tuning[save.car] || blankTune());
    const lvl = tun[key] | 0, maxed = lvl >= ARM_MAX;
    const cost = maxed ? null : ARM_COSTS[key][lvl];
    const dis = maxed || save.cash < cost;
    const accent = sel ? (dis ? '#ff3d2e' : col) : 'rgba(255,255,255,.08)';
    drawHubCard(x, y, w, h, sel ? accent : null);
    txt(g, title, x + 24, y + 26, 13, col, 'left', F_B);
    txt(g, name, x + 24, y + 56, 26, '#e8e2d0', 'left');
    txt(g, blurb, x + 24, y + 86, 13, '#9a93a8', 'left', F_B);
    drawLevelPips(g, x + 24, y + 118, lvl, ARM_MAX, dis ? '#6f6880' : col);
    txt(g, lvl + '/' + ARM_MAX, x + 24 + ARM_MAX * 16 + 12, y + 123, 13, '#8f88a0', 'left', F_B, false);
    if (maxed) txt(g, 'МАКС', x + w - 28, y + h / 2 + 8, 18, '#58ff6b', 'right');
    else {
      const can = !dis;
      const bx = x + w - 132, by = y + h - 56, bw = 108, bh = 40;
      drawHubPlus(bx, by, bw, bh, can, sel, fm(cost));
      g._armHits.push({ i: key === 'wep' ? 0 : 1, key: key, x: bx, y: by, w: bw, h: bh, buy: true });
    }
    g._armHits.push({ i: key === 'wep' ? 0 : 1, key: key, x: x, y: y, w: w, h: h, buy: false });
  }

  /**
   * Оружейка: пилот слева, ствол и ульта справа.
   */
  function drawArmoryEngine() {
    const ch = CHARS[save.char], car = CARS[save.car];
    const ab = carAbil(car.idx);
    const tun = ensureTuneGuns(save.tuning[car.idx] || blankTune());
    save.tuning[car.idx] = tun;
    const STAGE = HUB_STAGE_W, GAP = HUB_STAGE_GAP;
    const RIGHT_X = HUB_PAD + STAGE + GAP, RIGHT_W = W - HUB_PAD - RIGHT_X;
    drawHubBackdrop('rgba(255,107,74,.05)');
    drawHubHeader('ОРУЖЕЙКА', 'ствол и ульта этой машины', '#ff6b4a');
    drawPilotStage(HUB_PAD, HUB_TOP, STAGE, HUB_FOOT - HUB_TOP, ch, {
      title: car.name, sub: ab.weapon.name + '  ·  ' + ab.ult.name, subCol: '#ff9d7a'
    });
    drawHubCard(RIGHT_X, HUB_TOP, RIGHT_W, HUB_FOOT - HUB_TOP);
    txt(g, 'ВЕРСТАК', RIGHT_X + 24, HUB_TOP + 28, 18, '#ff6b4a', 'left');
    txt(g, 'качается только выбранный кузов', RIGHT_X + RIGHT_W - 24, HUB_TOP + 28, 12, '#6f6880', 'right', F_B);
    g._armHits = [];
    const rx = RIGHT_X + 20, rw = RIGHT_W - 40, gap = 16;
    const cardH = (HUB_FOOT - HUB_TOP - 88 - gap) / 2;
    const y0 = HUB_TOP + 48;
    drawArmCardEngine(rx, y0, rw, cardH, armorySel === 0, 'wep', 'ОРУЖИЕ', ab.weapon.name, armWepBlurb(car.idx, tun.wep | 0), '#ff6b4a');
    drawArmCardEngine(rx, y0 + cardH + gap, rw, cardH, armorySel === 1, 'ult', 'УЛЬТА', ab.ult.name, armUltBlurb(car.idx, tun.ult | 0), '#b478ff');
    txt(g, '↑ ↓  ствол / ульта   ·   ENTER / «+»  качать   ·   ESC  в гараж', W / 2, H - 28, 13, '#6f6880', 'center', F_B);
    drawHubToast();
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.training = { GYM_KEYS, gymMaxAdd };
  engine.replace('drawGym', drawGymEngine);
  engine.replace('drawArmCard', drawArmCardEngine);
  engine.replace('drawArmory', drawArmoryEngine);
})(typeof window !== 'undefined' ? window : globalThis);
