////////////////////////////////////////////////////////
//
// DiVANEngine: примитивы холста — панель, текст, деньги.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Скруглённый прямоугольник (path).
   * @param {CanvasRenderingContext2D} c
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {number} r
   */
  function rrEngine(c, x, y, w, h, r) {
    c.beginPath();
    if (c.roundRect) c.roundRect(x, y, w, h, r);
    else {
      c.moveTo(x + r, y);
      c.arcTo(x + w, y, x + w, y + h, r);
      c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r);
      c.arcTo(x, y, x + w, y, r);
    }
    c.closePath();
  }

  /**
   * Скошенная плашка хаба.
   * @param {CanvasRenderingContext2D} c
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {string|null} fill
   * @param {string|null} stroke
   * @param {number} [sk]
   */
  function panelEngine(c, x, y, w, h, fill, stroke, sk) {
    const cut = sk == null ? 14 : sk;
    c.beginPath();
    c.moveTo(x + cut, y);
    c.lineTo(x + w, y);
    c.lineTo(x + w - cut, y + h);
    c.lineTo(x, y + h);
    c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = 2; c.stroke(); }
  }

  /**
   * Только контур скошенной плашки.
   * @param {CanvasRenderingContext2D} c
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {number} [sk]
   */
  function panelPathEngine(c, x, y, w, h, sk) {
    const cut = sk == null ? 14 : sk;
    c.beginPath();
    c.moveTo(x + cut, y);
    c.lineTo(x + w, y);
    c.lineTo(x + w - cut, y + h);
    c.lineTo(x, y + h);
    c.closePath();
  }

  /**
   * Подпись с обводкой.
   * @param {CanvasRenderingContext2D} c
   * @param {string} t
   * @param {number} x
   * @param {number} y
   * @param {number} size
   * @param {string} col
   * @param {string} [align]
   * @param {string} [font]
   * @param {boolean} [stroke]
   */
  function txtEngine(c, t, x, y, size, col, align, font, stroke) {
    const a = align == null ? 'left' : align;
    const f = font == null ? F_D : font;
    const outline = stroke == null ? true : stroke;
    c.font = size + 'px ' + f;
    c.textAlign = a;
    c.textBaseline = 'middle';
    if (outline) {
      c.lineWidth = Math.max(2, size / 9);
      c.strokeStyle = '#000';
      c.strokeText(t, x, y);
    }
    c.fillStyle = col;
    c.fillText(t, x, y);
  }

  /**
   * Перенос в массив строк (слово, затем символ).
   * @param {CanvasRenderingContext2D} c
   * @param {string} text
   * @param {number} maxW
   * @param {number} size
   * @param {string} font
   * @returns {string[]}
   */
  function layoutLinesEngine(c, text, maxW, size, font) {
    c.font = size + 'px ' + font;
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    const flush = function () { if (line) { lines.push(line); line = ''; } };
    const fit = function (chunk) {
      if (c.measureText(chunk).width <= maxW) return chunk;
      let keep = '';
      for (const ch of chunk) {
        if (keep && c.measureText(keep + ch).width > maxW) { lines.push(keep); keep = ch; }
        else keep += ch;
      }
      return keep;
    };
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (c.measureText(test).width <= maxW) { line = test; continue; }
      flush();
      line = fit(w);
    }
    flush();
    return lines.length ? lines : [''];
  }

  /**
   * Рисует подпись с переносом по словам, возвращает Y последней строки.
   * @param {CanvasRenderingContext2D} c
   * @param {string} text
   * @param {number} x
   * @param {number} y
   * @param {number} maxW
   * @param {number} lineH
   * @param {number} size
   * @param {string} col
   * @param {string} font
   * @returns {number}
   */
  function wrapTextEngine(c, text, x, y, maxW, lineH, size, col, font) {
    c.font = size + 'px ' + font; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = col;
    const words = text.split(' '); let line = ''; let yy = y;
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (c.measureText(test).width > maxW && line) { c.fillText(line, x, yy); line = w; yy += lineH; }
      else line = test;
    }
    if (line) c.fillText(line, x, yy);
    return yy;
  }

  /**
   * Деньги с пробелом тысяч.
   * @param {number} n
   * @returns {string}
   */
  function fmEngine(n) {
    return '$' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  /**
   * Букмекерский кэф: ×1.20
   * @param {number} k
   * @returns {string}
   */
  function fmtOddsEngine(k) {
    return '×' + Number(k).toFixed(2);
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.gfx = { layoutLines: layoutLinesEngine, fm: fmEngine, fmtOdds: fmtOddsEngine };
  engine.replace('rr', rrEngine);
  engine.replace('panel', panelEngine);
  engine.replace('panelPath', panelPathEngine);
  engine.replace('txt', txtEngine);
  engine.replace('layoutLines', layoutLinesEngine);
  engine.replace('wrapText', wrapTextEngine);
  engine.replace('fm', fmEngine);
  engine.replace('fmtOdds', fmtOddsEngine);
})(typeof window !== 'undefined' ? window : globalThis);
