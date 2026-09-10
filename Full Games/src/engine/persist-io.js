////////////////////////////////////////////////////////
//
// DiVANEngine: чтение/запись ключей карьеры — диск, снимок, localStorage.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Карьера: диск, затем снимок страницы, затем localStorage.
   * @param {string} key
   * @returns {string|null}
   */
  function persistReadEngine(key) {
    try {
      if (global.DiVANEngine && DiVANEngine.storage) {
        const disk = DiVANEngine.storage.get(key);
        if (disk != null) return disk;
      }
    } catch (e) {}
    try {
      const snap = global.__DIVAN_ENGINE_STORE__;
      if (snap && Object.prototype.hasOwnProperty.call(snap, key) && snap[key] != null) return snap[key];
    } catch (e) {}
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  /**
   * Пишет и в localStorage, и на диск клиента.
   * @param {string} key
   * @param {string} text
   */
  function persistWriteEngine(key, text) {
    try { localStorage.setItem(key, text); } catch (e) {}
    try {
      if (global.__DIVAN_ENGINE_STORE__) global.__DIVAN_ENGINE_STORE__[key] = text;
    } catch (e) {}
    try { if (global.DiVANEngine && DiVANEngine.storage) DiVANEngine.storage.set(key, text); } catch (e) {}
  }

  /**
   * Стирает ключ везде.
   * @param {string} key
   */
  function persistDropEngine(key) {
    try { localStorage.removeItem(key); } catch (e) {}
    try {
      if (global.__DIVAN_ENGINE_STORE__) delete global.__DIVAN_ENGINE_STORE__[key];
    } catch (e) {}
    try { if (global.DiVANEngine && DiVANEngine.storage) DiVANEngine.storage.remove(key); } catch (e) {}
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.replace('persistRead', persistReadEngine);
  engine.replace('persistWrite', persistWriteEngine);
  engine.replace('persistDrop', persistDropEngine);
})(typeof window !== 'undefined' ? window : globalThis);
