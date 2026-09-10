////////////////////////////////////////////////////////
//
// DiVANEngine: справка по клавишам и сетка слотов сейва.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /** Строки экрана управления: клавиша и смысл. */
  const HELP_ROWS = [
    ['W / ↑', 'газ'],
    ['S / ↓', 'тормоз, задний ход'],
    ['A D / ← →', 'руль'],
    ['Пробел', 'ручной тормоз'],
    ['Z / P', 'оружие (уникальное для каждой машины)'],
    ['X / {', 'нитро или прыжок (зависит от машины)'],
    ['C / }', 'ульта (уникальная для каждой машины)'],
    ['ESC', 'пауза'],
    ['R', 'перезапуск гонки'],
    ['M', 'музыка вкл/выкл']
  ];

  /**
   * Сетка десяти слотов: 5×2.
   * @param {number} width
   * @returns {{slotW:number,slotH:number,gap:number,cols:number,startX:number,startY:number}}
   */
  function slotGrid(width) {
    const slotW = 220, slotH = 160, gap = 20, cols = 5;
    return {
      slotW,
      slotH,
      gap,
      cols,
      startX: (width - cols * (slotW + gap) + gap) / 2,
      startY: 140
    };
  }

  /**
   * Прямоугольник ячейки слота.
   * @param {number} i
   * @param {number} width
   * @returns {{x:number,y:number,w:number,h:number}}
   */
  function slotRectAt(i, width) {
    const lay = slotGrid(width);
    const col = i % lay.cols, row = (i / lay.cols) | 0;
    return {
      x: lay.startX + col * (lay.slotW + lay.gap),
      y: lay.startY + row * (lay.slotH + lay.gap),
      w: lay.slotW,
      h: lay.slotH
    };
  }

  /**
   * Сдвиг курсора по сетке 5×2 (десять ячеек).
   * @param {number} index
   * @param {string} code
   * @returns {number}
   */
  function slotStep(index, code) {
    const i = ((index | 0) % 10 + 10) % 10;
    if (code === 'ArrowLeft') return (i + 9) % 10;
    if (code === 'ArrowRight') return (i + 1) % 10;
    if (code === 'ArrowUp' || code === 'ArrowDown') return (i + 5) % 10;
    return i;
  }

  /**
   * Экран справки: крупные подписи, не таблица Excel.
   */
  function drawHelpEngine() {
    g.fillStyle = '#0b0a12';
    g.fillRect(0, 0, W, H);
    txt(g, 'УПРАВЛЕНИЕ', W / 2, 70, 44, '#ffd23f', 'center');
    HELP_ROWS.forEach(function (r, i) {
      const y = 130 + i * 44;
      panel(g, W / 2 - 320, y - 19, 200, 36, 'rgba(255,210,63,.1)', '#ffd23f');
      txt(g, r[0], W / 2 - 220, y, 18, '#ffd23f', 'center');
      txt(g, r[1], W / 2 - 90, y, 18, '#e8e2d0', 'left', F_B);
    });
    txt(g, 'Собирай деньги и ящики, взрывай соперников, финишируй первым.', W / 2, H - 60, 17, '#9a93a8', 'center', F_B);
    txt(g, 'ЛЮБАЯ КЛАВИША — НАЗАД', W / 2, H - 30, 16, '#ff9d2e', 'center');
  }

  /**
   * Выбор слота: сохранение или загрузка.
   */
  function drawSlotSelectEngine() {
    g.fillStyle = '#0b0a12';
    g.fillRect(0, 0, W, H);
    txt(g, slotSelectMode === 'save' ? 'ВЫБЕРИТЕ СЛОТ ДЛЯ СОХРАНЕНИЯ' : 'ВЫБЕРИТЕ СЛОТ ДЛЯ ЗАГРУЗКИ', W / 2, 70, 32, '#ffd23f', 'center');
    for (let i = 0; i < 10; i++) {
      const r = slotRectAt(i, W);
      const sel = i === slotSelectIndex;
      const slot = slots[i];
      panel(g, r.x, r.y, r.w, r.h, sel ? 'rgba(255,157,46,.15)' : 'rgba(20,17,28,.9)', sel ? '#ffd23f' : '#3a3548');
      txt(g, 'СЛОТ ' + (i + 1), r.x + r.w / 2, r.y + 30, 20, sel ? '#ffd23f' : '#e8e2d0', 'center');
      if (slot) {
        txt(g, slot.label || 'Сохранено', r.x + r.w / 2, r.y + 70, 14, '#9a93a8', 'center', F_B);
        if (slot.timestamp) {
          const d = new Date(slot.timestamp);
          const dateStr = d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
          txt(g, dateStr, r.x + r.w / 2, r.y + 95, 11, '#6f6880', 'center', F_B);
        }
        txt(g, 'Этап ' + (slot.save.race + 1), r.x + r.w / 2, r.y + 120, 12, '#58ff6b', 'center', F_B);
      } else {
        txt(g, 'ПУСТО', r.x + r.w / 2, r.y + 90, 16, '#4a4658', 'center');
      }
    }
    txt(g, '← → — выбор • ENTER — подтвердить • DELETE — стереть слот • ESC — отмена', W / 2, H - 30, 15, '#6f6880', 'center', F_B);
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.slots = { slotGrid, slotRectAt, slotStep, HELP_ROWS };
  engine.replace('drawHelp', drawHelpEngine);
  engine.replace('drawSlotSelect', drawSlotSelectEngine);
})(typeof window !== 'undefined' ? window : globalThis);
