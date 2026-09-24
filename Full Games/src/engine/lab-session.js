// Общий контракт временного черновика между лабораторией и тестовым заездом.
(function (global) {
  'use strict';

  const KEY = 'rnr.studio.testSession.v1';
  const VERSION = 1;

  /** Записывает единый снимок сеанса; ошибка хранилища запрещает уход из редактора. */
  function write(data) {
    const token = global.crypto && typeof global.crypto.randomUUID === 'function'
      ? global.crypto.randomUUID() : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
    const session = { ...data, version: VERSION, token };
    global.sessionStorage.setItem(KEY, JSON.stringify(session));
    return session;
  }

  /** Читает только запрошенный сеанс и трассу, чтобы старый черновик не подменил другой заезд. */
  function read(token, trackId) {
    if (!token) return null;
    try {
      const session = JSON.parse(global.sessionStorage.getItem(KEY) || 'null');
      if (!session || session.version !== VERSION || session.token !== token) return null;
      if (trackId && session.activeId !== trackId) return null;
      if (!Array.isArray(session.documents) || !session.documents.length) return null;
      if (!session.documents.every(entry => entry && entry.track && typeof entry.track.id === 'string')) return null;
      if (!session.documents.some(entry => entry.track.id === session.activeId)) return null;
      return session;
    } catch (error) { return null; }
  }

  /** Убирает восстановленный сеанс, не затрагивая более новый тест в том же окне. */
  function clear(token) {
    if (read(token)) global.sessionStorage.removeItem(KEY);
  }

  global.DiVANLabSession = { write, read, clear };
})(typeof window !== 'undefined' ? window : globalThis);
