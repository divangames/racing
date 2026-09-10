////////////////////////////////////////////////////////
//
// Диск сейвов в окне заезда: IPC, снимок из head, миграция localStorage.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  const engine = global.DiVANEngine;
  if (!engine) return;
  const desk = global.rnrDesktop;
  const dump = global.__DIVAN_ENGINE_STORE__ && typeof global.__DIVAN_ENGINE_STORE__ === 'object'
    ? global.__DIVAN_ENGINE_STORE__
    : {};

  /**
   * Читает ключ: живой диск, затем снимок страницы.
   * @param {string} key
   * @returns {string|null}
   */
  function get(key) {
    if (desk && typeof desk.storeGet === 'function') {
      try {
        const live = desk.storeGet(key);
        if (live != null) {
          dump[key] = live;
          return live;
        }
      } catch (err) {}
    }
    if (Object.prototype.hasOwnProperty.call(dump, key)) return dump[key];
    return null;
  }

  /**
   * Пишет ключ на диск и в снимок.
   * @param {string} key
   * @param {string} value
   * @returns {boolean}
   */
  function set(key, value) {
    if (typeof value !== 'string') return false;
    dump[key] = value;
    if (desk && typeof desk.storeSet === 'function') {
      try { return desk.storeSet(key, value) !== false; } catch (err) { return false; }
    }
    return true;
  }

  /**
   * Стирает ключ.
   * @param {string} key
   * @returns {boolean}
   */
  function remove(key) {
    delete dump[key];
    if (desk && typeof desk.storeRemove === 'function') {
      try { return desk.storeRemove(key) !== false; } catch (err) { return false; }
    }
    return true;
  }

  /**
   * Первый запуск: диск пустой — сбросить снимок и localStorage на диск.
   */
  function migrateFromLocal() {
    const keys = Object.keys(dump);
    keys.push('rnr_ru_v1', 'rnr_ru_story_v1', 'rnr_ru_slots', 'rnr_ru_settings');
    for (let i = 0; i < 10; i++) keys.push('rnr_ru_slots_' + i);
    const seen = Object.create(null);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (seen[key]) continue;
      seen[key] = true;
      let disk = null;
      if (desk && typeof desk.storeGet === 'function') {
        try { disk = desk.storeGet(key); } catch (err) {}
      }
      if (disk != null) {
        dump[key] = disk;
        continue;
      }
      if (dump[key] != null) {
        set(key, dump[key]);
        continue;
      }
      try {
        const text = global.localStorage && localStorage.getItem(key);
        if (text != null) set(key, text);
      } catch (err) {}
    }
  }

  engine.storage = { get, set, remove };
  migrateFromLocal();
})(typeof window !== 'undefined' ? window : globalThis);
