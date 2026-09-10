////////////////////////////////////////////////////////
//
// DiVANEngine: действие строки гаража — тюнинг и переходы.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /** Строки 0–4 — апгрейды, дальше залы и старт. */
  const ROW_KIND = ['tune', 'tune', 'tune', 'tune', 'tune', 'gym', 'armory', 'park', 'race'];

  /**
   * Тип строки гаража.
   * @param {number} row
   * @returns {string}
   */
  function garageRowKind(row) {
    return ROW_KIND[row] || '';
  }

  /**
   * Клик или Enter по строке гаража.
   * @param {number} col
   * @param {number} row
   */
  function garageActionEngine(col, row) {
    const kind = garageRowKind(row);
    if (kind === 'park') { enterAutopark(); sClick(); return; }
    if (kind === 'race') { enterPreRace(); return; }
    if (kind === 'armory') { enterArmory(); sClick(); return; }
    if (kind === 'gym') { gymSel = 0; state = 'gym'; sClick(); return; }
    if (col !== 0 || kind !== 'tune') return;
    const keys = (global.DiVANEngine && global.DiVANEngine.hub && global.DiVANEngine.hub.TUNING_KEYS) || ['arm', 'eng', 'tir', 'shk', 'nit'];
    const k = keys[row];
    const lvl = save.tuning[save.car][k];
    if (lvl >= 6) { garMsg = 'МАКСИМАЛЬНЫЙ УРОВЕНЬ'; garMsgT = 2.2; sHit(); }
    else {
      const cost = UP_COSTS[k][lvl];
      if (save.cash >= cost) {
        save.cash -= cost; save.tuning[save.car][k]++;
        persist(); SFX.play('tune'); garMsg = 'УСТАНОВЛЕНО: ' + UP_INFO[k].n; garMsgT = 2.2;
      } else { garMsg = 'НЕ ХВАТАЕТ ' + fm(cost - save.cash); garMsgT = 2.2; sHit(); }
    }
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.garageAct = { garageRowKind, ROW_KIND };
  engine.replace('garageAction', garageActionEngine);
})(typeof window !== 'undefined' ? window : globalThis);
