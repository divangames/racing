////////////////////////////////////////////////////////
//
// DiVANEngine: лента автопарка и личные кузова.
// Падежи CHAR_DATIVE остаются в контенте.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Имя в дательном падеже.
   * @param {number} i
   * @returns {string}
   */
  function charDativeEngine(i) {
    return CHAR_DATIVE[i] || ((CHARS[i] && CHARS[i].name) || 'гонщику');
  }

  /**
   * Индекс личной машины гонщика (после правок лаборатории).
   * @param {number} chI
   * @returns {number}
   */
  function charCarIdxEngine(chI) {
    const i = CARS.findIndex(function (c) { return c && c.owner === chI; });
    return i >= 0 ? i : 0;
  }

  /**
   * Чей это личный кузов, или null для магазина.
   * @param {number} carI
   * @returns {number|null}
   */
  function carOwnerIdxEngine(carI) {
    const o = CARS[carI] && CARS[carI].owner;
    return o == null ? null : o;
  }

  /**
   * Текущий пилот ленты.
   * @returns {number}
   */
  function catalogPilot() {
    return (save && typeof save.char === 'number') ? save.char : 0;
  }

  /**
   * Этап, с которого кузов открывается в магазине.
   * @param {number} i
   * @returns {number}
   */
  function catalogNeedRace(i) {
    const u = typeof CAR_UNLOCK !== 'undefined' ? CAR_UNLOCK[i] : null;
    return (u && u.race) | 0;
  }

  /**
   * Магазинный кузов уже открыт этапом.
   * @param {number} i
   * @returns {boolean}
   */
  function catalogShopOpen(i) {
    if (typeof carUnlocked === 'function') return !!carUnlocked(i);
    return ((save && save.race) | 0) >= catalogNeedRace(i);
  }

  /**
   * Ближайший ещё закрытый этап магазина — его кузова светятся как цель.
   * @returns {number|null}
   */
  function catalogNextLockRace() {
    const race = (save && save.race) | 0;
    let min = Infinity;
    for (let i = 0; i < CARS.length; i++) {
      const c = CARS[i];
      if (!c || c.custom || c.owner != null) continue;
      if (typeof carIsOwned === 'function' && carIsOwned(i)) continue;
      const need = catalogNeedRace(i);
      if (need > race && need < min) min = need;
    }
    return min === Infinity ? null : min;
  }

  /**
   * Виден в карусели: свои, купленные, открытые и одна ближайшая закрытая волна.
   * @param {number} i
   * @returns {boolean}
   */
  function catalogCarVisible(i) {
    const c = CARS[i];
    if (!c) return false;
    if (typeof isDev === 'function' && isDev()) return true;
    if (c.custom) return true;
    if (c.owner != null) return c.owner === catalogPilot();
    if (typeof carIsOwned === 'function' && carIsOwned(i)) return true;
    if (catalogShopOpen(i)) return true;
    const next = catalogNextLockRace();
    return next != null && catalogNeedRace(i) === next;
  }

  /**
   * Индекс из ленты, иначе первый видимый слот.
   * @param {number} i
   * @returns {number}
   */
  function carCatalogFocusEngine(i) {
    const o = carCatalogOrder();
    if (!o.length) return 0;
    if (o.indexOf(i) >= 0) return i;
    return o[0];
  }

  /**
   * Индексы кузовов в ленте: магазин по цене, затем своя личная.
   * Чужие сюжетные и дальние закрытые спрятаны.
   * @returns {number[]}
   */
  function carCatalogOrderEngine() {
    const shop = [], sign = [];
    CARS.forEach(function (c, i) {
      if (!catalogCarVisible(i)) return;
      if (c.owner != null) sign.push(i);
      else shop.push(i);
    });
    shop.sort(function (a, b) {
      const d = (+CARS[a].price || 0) - (+CARS[b].price || 0);
      return d || a - b;
    });
    sign.sort(function (a, b) {
      const d = (CARS[a].owner | 0) - (CARS[b].owner | 0);
      return d || a - b;
    });
    return shop.concat(sign);
  }

  /**
   * Позиция кузова в ленте.
   * @param {number} carI
   * @returns {number}
   */
  function carCatalogPosEngine(carI) {
    const o = carCatalogOrder();
    const p = o.indexOf(carI);
    return p < 0 ? 0 : p;
  }

  /**
   * Кузов на позиции ленты (кольцо).
   * @param {number} pos
   * @returns {number}
   */
  function carCatalogAtEngine(pos) {
    const o = carCatalogOrder();
    const n = o.length;
    if (!n) return 0;
    return o[((pos % n) + n) % n];
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  global.carCatalogFocus = carCatalogFocusEngine;
  engine.catalog = { order: carCatalogOrderEngine, pos: carCatalogPosEngine, at: carCatalogAtEngine, focus: carCatalogFocusEngine };
  engine.replace('charDative', charDativeEngine);
  engine.replace('charCarIdx', charCarIdxEngine);
  engine.replace('carOwnerIdx', carOwnerIdxEngine);
  engine.replace('carCatalogOrder', carCatalogOrderEngine);
  engine.replace('carCatalogPos', carCatalogPosEngine);
  engine.replace('carCatalogAt', carCatalogAtEngine);
})(typeof window !== 'undefined' ? window : globalThis);
