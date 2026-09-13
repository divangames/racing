// Нижняя телеметрия: рабочая рамка и живые приборы по refetrence.png.
(() => {
  'use strict';
  // Координаты приборов заданы в макете шириной 2048; прозрачные поля PNG не занимают экран.
  const FRAME = { width: 2048, height: 2048 / 3, top: 64, bottom: 550, maxWidth: 480, margin: 16, bottomGap: 10 };
  const COLOR = { cyan: '#28efff', gold: '#ffcf08', magenta: '#ff29b6', text: '#e7eff0', muted: '#a8bcc4', red: '#ff5140', dim: '#12373c' };
  const DIGITS = ['abcdef', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'afgecd', 'abc', 'abcdefg', 'abcdfg'];
  const SEGMENTS = {
    a: [[8,0],[42,0],[48,6],[42,12],[8,12],[2,6]],
    b: [[44,9],[50,15],[50,43],[44,49],[38,43],[38,15]],
    c: [[44,51],[50,57],[50,85],[44,91],[38,85],[38,57]],
    d: [[8,88],[42,88],[48,94],[42,100],[8,100],[2,94]],
    e: [[6,51],[12,57],[12,85],[6,91],[0,85],[0,57]],
    f: [[6,9],[12,15],[12,43],[6,49],[0,43],[0,15]],
    g: [[8,44],[42,44],[48,50],[42,56],[8,56],[2,50]]
  };
  const image = new Image();
  image.src = 'assets/HUD/telemetry/telemetry.png';

  /** Возвращает положение всей панели в игровых координатах, сохраняя пропорции рамки. */
  function layout(width, height) {
    const w = Math.max(1, Math.min(FRAME.maxWidth, width - FRAME.margin * 2, height * .34 * FRAME.width / (FRAME.bottom - FRAME.top)));
    const scale = w / FRAME.width, h = (FRAME.bottom - FRAME.top) * scale;
    return { x: (width - w) / 2, y: height - h - FRAME.bottomGap, w, h, scale };
  }

  /** Печатает подпись внутри своего прибора, ограничивая ширину длинных клавиш. */
  function label(c, text, x, y, size, color = COLOR.text, align = 'left', maxWidth = 680) {
    c.font = `600 ${size}px ${F_B}`;
    c.fillStyle = color; c.textAlign = align; c.textBaseline = 'middle';
    c.fillText(String(text), x, y, maxWidth);
  }

  /** Рисует трёхзначную скорость семисегментными цифрами без зависимости от цифрового шрифта. */
  function speedDigits(c, value, color) {
    const speed = String(Math.min(999, Math.max(0, Math.round(value)))).padStart(3, '0');
    c.save(); c.translate(220, 270); c.scale(1.08, .88);
    for (let i = 0; i < speed.length; i++) {
      for (const [name, points] of Object.entries(SEGMENTS)) {
        c.beginPath();
        points.forEach(([x, y], n) => n ? c.lineTo(x + i * 65, y) : c.moveTo(x + i * 65, y));
        c.closePath(); c.fillStyle = DIGITS[Number(speed[i])].includes(name) ? color : '#23302b'; c.fill();
      }
    }
    c.restore();
  }

  /** Заполняет сегментную шкалу долей от нуля до единицы. */
  function segments(c, x, y, width, height, count, ratio, color) {
    const gap = 3, step = width / count;
    for (let i = 0; i < count; i++) {
      c.fillStyle = COLOR.dim; c.fillRect(x + i * step, y, step - gap, height);
      const fill = clamp(ratio * count - i, 0, 1);
      if (fill > 0) { c.fillStyle = color; c.fillRect(x + i * step, y, (step - gap) * fill, height); }
    }
  }

  /** Кольцо показывает запас или восстановление; внутри остаются название и клавиша / секунды. */
  function orb(c, x, title, hotkey, cd, maxCd, color, ready, fill = null, detail = '') {
    const y = 315, radius = 70, start = -Math.PI / 2;
    const fraction = fill == null ? (maxCd > 0 ? clamp(1 - cd / maxCd, 0, 1) : 1) : clamp(fill, 0, 1);
    c.save();
    c.fillStyle = 'rgba(3,10,16,.75)'; c.beginPath(); c.arc(x, y, radius, 0, TAU); c.fill();
    c.strokeStyle = COLOR.dim; c.lineWidth = 9; c.stroke();
    c.strokeStyle = color; c.lineWidth = 8;
    if (fraction > 0) { c.beginPath(); c.arc(x, y, radius, start, start + TAU * fraction); c.stroke(); }
    c.globalAlpha = .55; c.lineWidth = 1.5;
    for (const r of [radius - 12, radius + 13, radius + 18]) {
      c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke();
    }
    // Насечки повторяют техническую разметку колец на образце.
    for (let i = 0; i < 12; i++) {
      const angle = i * TAU / 12;
      c.beginPath(); c.moveTo(x + Math.cos(angle) * 79, y + Math.sin(angle) * 79);
      c.lineTo(x + Math.cos(angle) * 91, y + Math.sin(angle) * 91); c.stroke();
    }
    if (ready > 0 && cd <= 0 && hudMotionOk()) {
      c.globalAlpha = ready * .6; c.lineWidth = 4;
      c.beginPath(); c.arc(x, y, 87, 0, TAU); c.stroke();
    }
    c.globalAlpha = 1;
    label(c, title, x, y - 13, 27, cd > 0 ? COLOR.muted : COLOR.text, 'center', 135);
    label(c, cd > 0 ? Math.ceil(cd) : hotkey, x, y + 25, 29, cd > 0 ? COLOR.muted : COLOR.gold, 'center', 120);
    if (detail) label(c, detail, x, y + 49, 17, COLOR.muted, 'center', 105);
    c.restore();
  }

  /** Текст состояния отражает текущую машину; шкала под ним показывает боковую устойчивость. */
  function status() {
    return P.dead ? 'ВОССТАНОВЛЕНИЕ' : P.air ? 'В ПОЛЁТЕ' : P.nitro > 0 ? 'НИТРО АКТИВНО' : P.bolt > 0 ? 'ТУРБО АКТИВНО' : P.handbrake ? 'РУЧНОЙ ТОРМОЗ' : Math.abs(P.lat || 0) > 25 ? 'ЗАНОС' : P.bubble > 0 ? 'КУПОЛ · ' + Math.ceil(P.bubble) + ' С' : P.shield > 0 ? 'ЩИТ · ' + P.shield : 'СЦЕПЛЕНИЕ С ТРАССОЙ';
  }

  /** Рисует живые показания строго внутри трёх окон исходной рамки. */
  function draw(c, width, height) {
    const box = layout(width, height);
    const hp = clamp(P.hp / Math.max(1, P.maxhp), 0, 1);
    const fx = hudFx || { hp, spd: Math.abs(P.spd) * .45, ready: [0, 0, 0] };
    const boosted = P.nitro > 0 || P.bolt > 0, speedColor = boosted ? COLOR.cyan : COLOR.gold;
    const speedRatio = clamp(Math.abs(P.spd) / Math.max(P.st.top, 1), 0, 1);
    const gear = P.spd < -5 ? 'R' : Math.abs(P.spd) < 4 ? 'N' : String(Math.min(6, Math.floor(speedRatio * 5) + 1));
    c.save(); c.translate(box.x, box.y); c.scale(box.scale, box.scale); c.translate(0, -FRAME.top);
    c.drawImage(image, 0, 0, FRAME.width, FRAME.height);
    label(c, 'ТЕЛЕМЕТРИЯ', 283, 212, 25, COLOR.cyan, 'center', 192);
    speedDigits(c, fx.spd, speedColor);
    label(c, gear, 498, 311, 70, COLOR.text, 'center', 75);
    label(c, 'КМ/Ч', 497, 382, 24, COLOR.muted, 'center', 82);
    segments(c, 222, 393, 194, 11, 12, speedRatio, speedColor);
    label(c, 'ЦЕЛОСТНОСТЬ КОРПУСА', 608, 241, 29, COLOR.cyan);
    label(c, Math.round(hp * 100) + '%', 1280, 241, 32, hp <= .3 ? COLOR.red : COLOR.cyan, 'right');
    c.fillStyle = COLOR.dim; c.fillRect(608, 274, 672, 13);
    c.fillStyle = hp <= .3 ? COLOR.red : COLOR.cyan; c.fillRect(608, 274, 672 * clamp(fx.hp, 0, 1), 13);
    label(c, status(), 608, 323, 29, P.dead ? COLOR.red : boosted ? COLOR.cyan : COLOR.gold);
    const stability = P.dead || P.air ? 0 : clamp(1 - Math.abs(P.lat || 0) / 140, 0, 1);
    segments(c, 608, 361, 672, 11, 26, stability, COLOR.cyan);
    label(c, 'БОЕВОЙ КОНТУР  /  ' + (P.finished ? 'ФИНИШ' : P.dead ? 'ВОССТАНОВЛЕНИЕ' : 'АКТИВЕН'), 608, 405, 25, COLOR.muted);
    const ab = carAbil(P.car.idx), mag = wepMagMax(P), heatMax = kitOverheat(P, ab.weapon), gat = ab.weapon.type === 'gatling';
    const overheat = P.wepOver || 0;
    const fill = mag > 0 ? (overheat > 0 ? 1 - overheat / Math.max(heatMax, .001) : P.wepAmmo / mag) : gat ? (overheat > 0 ? 1 - overheat / Math.max(heatMax, .001) : 1 - (P.wepHeat || 0)) : null;
    const key = action => prettyKey((settings.controls[action] || [{ fire: 'KeyZ', nitro: 'KeyX', ult: 'KeyC' }[action]])[0]);
    const ammo = mag > 0 && overheat <= 0 && P.wepAmmo < mag ? `${P.wepAmmo | 0}/${mag}` : '';
    orb(c, 1423, 'ОРУЖИЕ', key('fire'), mag > 0 || gat ? overheat : P.cdW, mag > 0 || gat ? heatMax : kitWepCd(P, ab.weapon), COLOR.magenta, fx.ready[0], fill, ammo);
    orb(c, 1604, ab.nitro.type === 'jump' ? 'ПРЫЖОК' : 'НИТРО', key('nitro'), P.cdN, ab.nitro.cd, COLOR.cyan, fx.ready[1]);
    orb(c, 1785, 'УЛЬТА', key('ult'), P.cdU, kitUltCd(P, ab.ult), COLOR.gold, fx.ready[2]);
    c.restore();
  }

  DiVANEngine.telemetry = { layout, ready: () => image.complete && image.naturalWidth > 0 };
  /** До загрузки PNG или при отсутствии файла сохраняет работоспособность прежней панели. */
  DiVANEngine.wrap('drawHudCockpit', previous => function(c, width, height) {
    if (!P) return;
    if (!DiVANEngine.telemetry.ready()) { previous(c, width, height); return; }
    draw(c, width, height);
  });
})();
