////////////////////////////////////////////////////////
//
// DiVANEngine: владение кузовом, тюнинг-заготовка, слот пилота.
// Каталог CAR_UNLOCK остаётся в HTML.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Режим разработчика (чит deliane).
   * @returns {boolean}
   */
  function isDevEngine() {
    if (typeof cheatsAllowed === 'function' && !cheatsAllowed()) return false;
    return !!(save && save.dev);
  }

  /**
   * Чужой личный кузов — нельзя купить и нельзя сесть (в dev можно).
   * @param {number} carI
   * @returns {boolean}
   */
  function isForeignSignatureEngine(carI) {
    if (isDev()) return false;
    const o = carOwnerIdx(carI);
    return o != null && save && o !== save.char;
  }

  /**
   * Эта машина уже в гараже текущего гонщика.
   * @param {number} carI
   * @returns {boolean}
   */
  function carIsOwnedEngine(carI) {
    if (isDev()) return true;
    if (isForeignSignature(carI)) return false;
    if (carOwnerIdx(carI) === save.char) return true;
    return !!(save && save.carOwned && save.carOwned[carI]);
  }

  /**
   * Кузов открыт этапом карьеры, личный или кастом.
   * @param {number} idx
   * @returns {boolean}
   */
  function carUnlockedEngine(idx) {
    if (CARS[idx] && CARS[idx].custom) return true;
    if (carOwnerIdx(idx) != null) return true;
    const u = CAR_UNLOCK[idx];
    return isDev() ? true : save.race >= ((u && u.race) || 0);
  }

  /**
   * Пустой тюнинг одного слота.
   * @returns {object}
   */
  function blankTuneEngine() {
    return { arm: 0, eng: 0, tir: 0, shk: 0, nit: 0, wep: 0, ult: 0 };
  }

  /**
   * Тюнинг на все кузова.
   * @returns {object}
   */
  function allTunesEngine() {
    const o = {};
    for (let i = 0; i < CARS.length; i++) o[i] = Object.assign({}, blankTune());
    return o;
  }

  /**
   * Выдать гонщику его личную машину и убрать чужие личные из owned.
   * @param {number} chI
   */
  function applyCharCarEngine(chI) {
    save.char = chI; save.car = charCarIdx(chI);
    save.carOwned = save.carOwned || {};
    save.carOwned[save.car] = true;
    if (!isDev()) CARS.forEach(function (c, i) {
      if (c.owner != null && c.owner !== chI) delete save.carOwned[i];
    });
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.replace('isDev', isDevEngine);
  engine.replace('isForeignSignature', isForeignSignatureEngine);
  engine.replace('carIsOwned', carIsOwnedEngine);
  engine.replace('carUnlocked', carUnlockedEngine);
  engine.replace('blankTune', blankTuneEngine);
  engine.replace('allTunes', allTunesEngine);
  engine.replace('applyCharCar', applyCharCarEngine);
})(typeof window !== 'undefined' ? window : globalThis);
