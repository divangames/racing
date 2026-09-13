////////////////////////////////////////////////////////
//
// Сплэш лаборатории: версия клиента и имя загружаемого файла.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  const WAIT = { cars: false, map: false };
  const shownAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  let hidden = false;

  /**
   * Узлы сплэша, если разметка уже в документе.
   * @returns {{root: HTMLElement, version: HTMLElement, files: HTMLElement}|null}
   */
  function els() {
    const root = document.getElementById('lab-splash');
    if (!root) return null;
    return {
      root: root,
      version: document.getElementById('lab-splash-version'),
      files: document.getElementById('lab-splash-files')
    };
  }

  /**
   * Подпись версии из метаданных DiVANEngine.
   * @returns {string}
   */
  function versionLabel() {
    const meta = global.__DIVAN_ENGINE_META__ || {};
    const v = (global.DiVANEngine && DiVANEngine.version) || meta.version || '';
    if (!v) return '';
    return /^v/i.test(String(v)) ? String(v) : 'v' + v;
  }

  /** Пишет версию в слот макета. */
  function paintVersion() {
    const node = els();
    if (node && node.version) node.version.textContent = versionLabel();
  }

  /**
   * Имя текущего файла или этапа загрузки.
   * @param {string} label
   */
  function file(label) {
    const node = els();
    if (!node || !node.files) return;
    const text = String(label || '').trim();
    node.files.textContent = text || 'Файлы';
    node.files.title = text;
  }

  /** Снимает сплэш после машин и карты. */
  function hide() {
    if (hidden) return;
    hidden = true;
    const node = els();
    if (!node) return;
    const drop = function () {
      if (node.root && node.root.parentNode) node.root.parentNode.removeChild(node.root);
    };
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    node.root.classList.add('is-out');
    if (reduce) drop();
    else setTimeout(drop, 380);
  }

  /**
   * Отмечает готовность блока загрузки.
   * @param {'cars'|'map'} task
   */
  function done(task) {
    if (task === 'cars' || task === 'map') WAIT[task] = true;
    if (!WAIT.cars || !WAIT.map) return;
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const hold = Math.max(0, 700 - (now - shownAt));
    setTimeout(hide, hold);
  }

  paintVersion();
  file('Файлы');
  setTimeout(hide, 15000);

  global.LabSplash = {
    file: file,
    done: done,
    hide: hide
  };
})(typeof window !== 'undefined' ? window : globalThis);
