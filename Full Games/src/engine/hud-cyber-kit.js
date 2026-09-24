// Векторный набор киберпанк-HUD: срезанные рамки, неон, пиктограммы и приборные шкалы.
(function () {
  'use strict';
  const colors = { cyan: '#21ddff', ice: '#b9efff', text: '#e0f6ff', muted: '#78a5b8', line: '#225568', red: '#ff3158', gold: '#ffe193', bg: '#05121c' };
  const spacing = { inset: 16, gap: 12 };
  /** Строит замкнутый многоугольник по точкам. */
  function path(c, points) {
    c.beginPath(); points.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath();
  }
  /** Техническая панель со срезами и короткими светящимися участками контура. */
  function frame(c, x, y, w, h, accent = colors.cyan) {
    const cut = Math.min(16, h / 4);
    c.save();
    path(c, [[x + cut, y], [x + w - cut, y], [x + w, y + cut], [x + w, y + h - cut], [x + w - cut, y + h], [x + cut, y + h], [x, y + h - cut], [x, y + cut]]);
    const fill = c.createLinearGradient(x, y, x + w * .4, y + h);
    fill.addColorStop(0, 'rgba(3,15,24,.94)'); fill.addColorStop(.6, 'rgba(3,12,20,.83)'); fill.addColorStop(1, 'rgba(3,12,20,.94)');
    c.fillStyle = fill; c.fill(); c.strokeStyle = colors.line; c.lineWidth = 1; c.stroke();
    c.save(); c.clip();
    c.fillStyle = 'rgba(94,192,220,.023)';
    for (let sy = y + 3; sy < y + h; sy += 5) c.fillRect(x, sy, w, 1);
    c.restore();
    c.strokeStyle = accent; c.shadowColor = accent; c.shadowBlur = 5; c.lineWidth = 1.25;
    c.beginPath(); c.moveTo(x, y + cut + 13); c.lineTo(x, y + cut); c.lineTo(x + cut, y); c.lineTo(x + cut + 32, y);
    c.moveTo(x + w - 46, y + h); c.lineTo(x + w - cut, y + h); c.lineTo(x + w, y + h - cut); c.lineTo(x + w, y + h - cut - 10); c.stroke();
    c.shadowBlur = 0; c.globalAlpha *= .4; c.strokeStyle = accent;
    c.beginPath(); c.moveTo(x + 8, y + cut + 4); c.lineTo(x + 8, y + h - cut - 4); c.lineTo(x + cut + 4, y + h - 8); c.stroke();
    c.fillStyle = accent; c.fillRect(x + 56, y, 23, 2); c.fillRect(x + 83, y, 4, 2);
    c.restore();
  }
  /** Выводит читаемый текст с ограничением ширины, не обрезая назначенные клавиши. */
  function text(c, value, x, y, size = 13, color = colors.text, align = 'left', width = 1000, heavy = false) {
    c.font = `${heavy ? 900 : 500} ${size}px "Bender", "Segoe UI", sans-serif`;
    c.textAlign = align; c.textBaseline = 'middle'; c.fillStyle = color; c.fillText(String(value), x, y, width);
  }
  /** Отделяет заголовок тонкой линией с затуханием. */
  function rule(c, x, y, w) {
    const fill = c.createLinearGradient(x, y, x + w, y);
    fill.addColorStop(0, colors.line); fill.addColorStop(1, 'rgba(33,221,255,0)');
    c.fillStyle = fill; c.fillRect(x, y, w, 1);
  }
  /** Рисует сегменты с точным частичным заполнением. */
  function meter(c, x, y, w, h, value, color = colors.cyan, count = 16) {
    const ratio = clamp(Number(value) || 0, 0, 1), step = w / count;
    c.save();
    for (let i = 0; i < count; i++) {
      c.fillStyle = '#12313e'; c.fillRect(x + i * step, y, step - 2, h);
      const fraction = clamp(ratio * count - i, 0, 1);
      if (fraction) {
        c.fillStyle = color; c.shadowColor = color; c.shadowBlur = 4;
        c.fillRect(x + i * step, y, (step - 2) * fraction, h); c.shadowBlur = 0;
      }
    }
    c.restore();
  }
  /** Геометрические знаки не зависят от emoji и системных шрифтов. */
  function icon(c, kind, x, y, size = 20, color = colors.cyan) {
    c.save(); c.translate(x, y); c.scale(size / 24, size / 24);
    c.strokeStyle = color; c.fillStyle = color; c.lineWidth = 1.5; c.lineJoin = 'round';
    if (kind === 'shield') {
      path(c, [[0,-11],[9,-7],[8,3],[5,8],[0,12],[-5,8],[-8,3],[-9,-7]]); c.stroke();
      path(c, [[0,-6],[5,-4],[4,3],[0,7],[-4,3],[-5,-4]]); c.fill();
    } else if (kind === 'bolt' || kind === 'jump') {
      path(c, [[2,-12],[-10,3],[-1,3],[-4,13],[11,-4],[2,-4],[7,-12]]); c.fill();
    } else if (kind === 'skull') {
      c.beginPath(); c.arc(0,-2,9,Math.PI,0); c.lineTo(8,5); c.lineTo(4,6); c.lineTo(4,11); c.lineTo(-4,11); c.lineTo(-4,6); c.lineTo(-8,5); c.closePath(); c.fill();
      c.fillStyle = colors.bg; c.fillRect(-6,-2,4,4); c.fillRect(2,-2,4,4); c.fillRect(-1,6,2,5);
    } else if (kind === 'target') {
      c.beginPath(); c.arc(0,0,7,0,Math.PI*2); c.stroke();
      c.beginPath(); c.moveTo(-12,0); c.lineTo(12,0); c.moveTo(0,-12); c.lineTo(0,12); c.stroke();
    } else if (kind === 'box') {
      path(c, [[0,-10],[9,-5],[9,6],[0,11],[-9,6],[-9,-5]]); c.stroke();
      c.beginPath(); c.moveTo(-9,-5); c.lineTo(0,0); c.lineTo(9,-5); c.moveTo(0,0); c.lineTo(0,11); c.stroke();
    } else if (kind === 'gun') {
      path(c, [[-11,-5],[4,-5],[4,-8],[12,-8],[12,-2],[4,-2],[4,3],[-2,3],[-3,10],[-8,10],[-7,2],[-11,2]]); c.stroke(); c.fillRect(-8,-3,10,3);
    } else if (kind === 'flag') {
      c.beginPath(); c.moveTo(-7,11); c.lineTo(-7,-11); c.lineTo(10,-11); c.lineTo(10,2); c.lineTo(-7,2); c.stroke();
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) if ((i+j)%2 === 0) c.fillRect(-6+i*5,-10+j*6,5,6);
    } else {
      path(c, [[0,-10],[10,0],[0,10],[-10,0]]); c.stroke(); c.fillRect(-2,-2,4,4);
    }
    c.restore();
  }
  /** Показывает первую фактически назначенную клавишу. */
  function key(action) {
    const keys = settings.controls && settings.controls[action];
    return keys && keys.length ? prettyKey(keys[0]) : '—';
  }
  /** Небольшая клавишная плашка, включая длинные обозначения вроде SHIFT. */
  function keycap(c, value, x, y, w = 34) {
    c.strokeStyle = colors.line; c.lineWidth = 1; c.strokeRect(x, y, w, 18);
    text(c, value, x + w/2, y + 9, 11, colors.ice, 'center', w - 4);
  }
  DiVANEngine.cyberKit = { colors, spacing, path, frame, text, rule, meter, icon, key, keycap };
})();
