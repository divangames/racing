////////////////////////////////////////////////////////
//
// DiVANEngine: контракт в окне заезда.
// Модули меняют именованные хуки, а не ищут функции в HTML.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  const meta = global.__DIVAN_ENGINE_META__ || {};
  const originals = Object.create(null);
  const current = Object.create(null);
  const ENGINE_NAME = meta.name || 'DiVANEngine';

  /**
   * Функция на глобале страницы (классический скрипт игры).
   * @param {string} name
   * @returns {Function|null}
   */
  function readGlobal(name) {
    const fn = global[name];
    return typeof fn === 'function' ? fn : null;
  }

  /**
   * Пишет ошибку, если контент старше контракта.
   * @param {string} name
   * @returns {boolean}
   */
  function missing(name) {
    console.error(
      ENGINE_NAME + ': нет хука «' + name + '». Нужен контент с meta divan-engine и прежними именами функций.'
    );
    return false;
  }

  const api = {
    name: ENGINE_NAME,
    abi: meta.abi || 1,
    contentSchema: meta.contentSchema || 1,
    runtime: meta.runtime || 'html-legacy',
    version: meta.version || '',
    host: meta.host || '',
    /**
     * Текущая реализация хука.
     * @param {string} name
     * @returns {Function|null}
     */
    get(name) {
      if (current[name]) return current[name];
      return readGlobal(name);
    },
    /**
     * Первая функция контента до патчей движка.
     * @param {string} name
     * @returns {Function|null}
     */
    original(name) {
      return originals[name] || readGlobal(name);
    },
    /**
     * Жёсткая замена хука. Без исходной функции модуль не ставится.
     * @param {string} name
     * @param {Function} impl
     * @returns {boolean}
     */
    replace(name, impl) {
      if (typeof impl !== 'function') {
        throw new Error(ENGINE_NAME + '.replace: «' + name + '» должна быть функцией');
      }
      const prev = this.get(name);
      if (!prev) return missing(name);
      if (!originals[name]) originals[name] = prev;
      current[name] = impl;
      global[name] = impl;
      return true;
    },
    /**
     * Обёртка: фабрика получает предыдущую реализацию.
     * @param {string} name
     * @param {function(Function): Function} factory
     * @returns {boolean}
     */
    wrap(name, factory) {
      if (typeof factory !== 'function') {
        throw new Error(ENGINE_NAME + '.wrap: нужна фабрика для «' + name + '»');
      }
      const prev = this.get(name);
      if (!prev) return missing(name);
      const next = factory(prev);
      if (typeof next !== 'function') {
        throw new Error(ENGINE_NAME + '.wrap: фабрика «' + name + '» не вернула функцию');
      }
      return this.replace(name, next);
    }
  };

  if (global.DiVANEngine && typeof global.DiVANEngine === 'object') {
    const keep = global.DiVANEngine;
    for (const key of Object.keys(api)) {
      if (keep[key] == null) keep[key] = api[key];
    }
    global.DiVANEngine = keep;
  } else {
    global.DiVANEngine = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
