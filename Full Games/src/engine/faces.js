////////////////////////////////////////////////////////
//
// DiVANEngine: лица гонщиков — слот готов или догрузка из папки NN.
// Каталог URL остаётся в chars.js (игра и лаборатория).
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Картинка уже в памяти.
   * @param {HTMLImageElement|null|undefined} img
   * @returns {boolean}
   */
  function spriteReady(img) {
    return !!(img && img.complete && img.naturalWidth > 0);
  }

  /**
   * Если бут не привязал файл — пробуем URL из папки гонщика напрямую.
   * @param {HTMLImageElement} img
   * @param {number} i
   * @param {string} suffix
   */
  function kickPlayerImgEngine(img, i, suffix) {
    if (!img || img._kick) return;
    img._kick = true;
    const urls = playerImgUrls(i, suffix);
    let n = 0;
    const next = function () {
      if (n >= urls.length) return;
      const url = urls[n++];
      const probe = new Image();
      probe.onload = function () { if (probe.naturalWidth > 0) img.src = url; };
      probe.onerror = next;
      probe.src = url;
    };
    next();
  }

  /**
   * Спрайт из банка или null, пока файл не готов.
   * @param {object} ch
   * @param {HTMLImageElement[]} bank
   * @param {string} suffix
   * @returns {HTMLImageElement|null}
   */
  function charSprite(ch, bank, suffix) {
    const idx = CHARS.indexOf(ch);
    const img = idx >= 0 ? bank[idx] : null;
    if (!img) return null;
    if (spriteReady(img)) return img;
    kickPlayerImg(img, idx, suffix);
    return spriteReady(img) ? img : null;
  }

  /**
   * Портрет гонщика.
   * @param {object} ch
   * @returns {HTMLImageElement|null}
   */
  function avatarImageEngine(ch) {
    return charSprite(ch, AVATARS, '');
  }

  /**
   * Ростовой спрайт гонщика.
   * @param {object} ch
   * @returns {HTMLImageElement|null}
   */
  function fullbodyImageEngine(ch) {
    return charSprite(ch, FULLBODIES, '_fullbody');
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.faces = { spriteReady, charSprite };
  engine.replace('kickPlayerImg', kickPlayerImgEngine);
  engine.replace('avatarImage', avatarImageEngine);
  engine.replace('fullbodyImage', fullbodyImageEngine);
})(typeof window !== 'undefined' ? window : globalThis);
