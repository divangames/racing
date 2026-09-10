////////////////////////////////////////////////////////
//
// DiVANEngine: класс кузова сетки ИИ. Диапазоны STARTER_* / MID_* остаются в китах.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Хлам 12–16 слота (индексы STARTER_LO…HI).
   * @param {number} i
   * @returns {boolean}
   */
  function isStarterCarEngine(i) {
    i = i | 0;
    return i >= STARTER_LO && i <= STARTER_HI;
  }

  /**
   * Средний класс 17–21 слота.
   * @param {number} i
   * @returns {boolean}
   */
  function isMidCarEngine(i) {
    i = i | 0;
    return i >= MID_LO && i <= MID_HI;
  }

  /**
   * Дивизионы 1–2 только на стартовых кузовах.
   * @param {number} div
   * @returns {boolean}
   */
  function starterFieldOnlyEngine(div) {
    return (div | 0) <= 2;
  }

  /**
   * Дивизионы 3–4 ещё без V8.
   * @param {number} div
   * @returns {boolean}
   */
  function midFieldOnlyEngine(div) {
    return (div | 0) <= 4;
  }

  /**
   * Можно ли ставить кузов в сетку этого дивизиона.
   * @param {number} i
   * @param {number} div
   * @returns {boolean}
   */
  function fieldCarClassOkEngine(i, div) {
    if (typeof starterFieldOnly === 'function' && starterFieldOnly(div)) {
      return typeof isStarterCar === 'function' ? isStarterCar(i) : false;
    }
    if (midFieldOnly(div)) {
      const junk = typeof isStarterCar === 'function' && isStarterCar(i);
      return junk || isMidCar(i);
    }
    return true;
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.replace('isStarterCar', isStarterCarEngine);
  engine.replace('isMidCar', isMidCarEngine);
  engine.replace('starterFieldOnly', starterFieldOnlyEngine);
  engine.replace('midFieldOnly', midFieldOnlyEngine);
  engine.replace('fieldCarClassOk', fieldCarClassOkEngine);
})(typeof window !== 'undefined' ? window : globalThis);
