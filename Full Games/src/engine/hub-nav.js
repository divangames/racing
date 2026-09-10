////////////////////////////////////////////////////////
//
// DiVANEngine: вход в автопарк, ставка и лента выбора кузова.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Фокус карусели: индекс слота (ассет), не позиция в ленте.
   * @param {number} i
   */
  function pickCarSelEngine(i) {
    const n = CARS.length;
    const next = ((i % n) + n) % n;
    if (next === selCar) return;
    selCar = next; carConfirmed = false; carSelDriveT = gt; sClick();
  }

  /**
   * Сдвиг выбора машины по ленте (цена, затем личные).
   * @param {number} dir
   */
  function nudgeCarSelEngine(dir) {
    pickCarSel(carCatalogAt(carCatalogPos(selCar) + dir));
  }

  /**
   * Листать автопарк тем же слайдером, что выбор машины.
   * @param {number} i
   */
  function pickParkSelEngine(i) {
    const n = CARS.length;
    const next = ((i % n) + n) % n;
    if (next === autoparkSel) return;
    autoparkSel = next; parkDriveT = gt; sClick();
  }

  /**
   * Сдвиг автопарка по той же ленте.
   * @param {number} dir
   */
  function nudgeParkSelEngine(dir) {
    pickParkSel(carCatalogAt(carCatalogPos(autoparkSel) + dir));
  }

  /**
   * Открыть автопарк на текущей машине.
   */
  function enterAutoparkEngine() {
    state = 'autopark'; autodetailOpen = false;
    const raw = save.car || 0;
    autoparkSel = typeof carCatalogFocus === 'function' ? carCatalogFocus(raw) : raw; parkScroll = carCatalogPos(autoparkSel); parkDriveT = gt;
  }

  /**
   * Экран ставки перед заездом. Сетка всегда с текущим кузовом.
   */
  function enterPreRaceEngine() {
    clampBetAfford();
    raceBoard = makeRaceBoard();
    state = 'prerace'; sClick();
  }

  /**
   * Касса покрывает выбранную сумму — списываем и едем.
   */
  function confirmPreRaceEngine() {
    clampBetAfford();
    const cost = BET_TABLE[save.bet | 0].cost;
    if (cost > 0 && save.cash < cost) { sHit(); garMsg = 'НЕ ХВАТАЕТ НА СТАВКУ'; garMsgT = 2.2; return; }
    if (cost > 0) { save.cash -= cost; persist(); }
    buildRace();
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.replace('pickCarSel', pickCarSelEngine);
  engine.replace('nudgeCarSel', nudgeCarSelEngine);
  engine.replace('pickParkSel', pickParkSelEngine);
  engine.replace('nudgeParkSel', nudgeParkSelEngine);
  engine.replace('enterAutopark', enterAutoparkEngine);
  engine.replace('enterPreRace', enterPreRaceEngine);
  engine.replace('confirmPreRace', confirmPreRaceEngine);
})(typeof window !== 'undefined' ? window : globalThis);
