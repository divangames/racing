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

  /** Реальный результат следующего уровня для выбранной машины и пилота. */
  function tuningPreview(ch, car, tun, key) {
    if (!ch || !car || !tun || typeof stats !== 'function') return '';
    const level = Math.max(0, Math.min(6, Math.floor(Number(tun[key]) || 0)));
    if (level >= 6) return 'максимальный уровень';
    const next = Object.assign({}, tun);
    next[key] = level + 1;
    const before = stats(ch, car, tun), after = stats(ch, car, next);
    function gain(a, b) { return a > 0 ? Math.round((b / a - 1) * 100) : 0; }
    if (key === 'arm') return before.maxhp + ' → ' + after.maxhp + ' корпуса';
    if (key === 'eng') return Math.round(before.top * .45) + ' → ' + Math.round(after.top * .45) + ' км/ч · разгон +' + gain(before.acc, after.acc) + '%';
    if (key === 'tir') return 'руль +' + gain(before.crn, after.crn) + '% · сцепление +' + gain(before.grip, after.grip) + '%';
    if (key === 'shk') return 'обочина ' + Math.round(before.off * 100) + ' → ' + Math.round(after.off * 100) + '% · удар мягче';
    if (key === 'nit' && typeof carAbil === 'function') {
      const nitro = carAbil(car.idx).nitro;
      if (nitro && Number.isFinite(nitro.cd)) {
        const chIdx = typeof CHARS !== 'undefined' ? CHARS.indexOf(ch) : -1;
        const skill = save.skills && save.skills[chIdx] || 1;
        const reduction = chIdx === 1 && typeof skillVal === 'function' ? skillVal(1, skill) : 0;
        const base = nitro.cd * (1 - reduction);
        return 'перезарядка ' + Math.max(1, base - level * .6).toFixed(1) + ' → ' + Math.max(1, base - (level + 1) * .6).toFixed(1) + ' с';
      }
    }
    return typeof UP_INFO !== 'undefined' && UP_INFO[key] ? UP_INFO[key].d : '';
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
    if (!k || !UP_COSTS[k]) return;
    if (!save.tuning) save.tuning = {};
    const tun = save.tuning[save.car] || (save.tuning[save.car] = typeof blankTune === 'function' ? blankTune() : {});
    const lvl = Math.max(0, Math.floor(Number(tun[k]) || 0));
    if (lvl >= 6) { garMsg = 'МАКСИМАЛЬНЫЙ УРОВЕНЬ'; garMsgT = 2.2; sHit(); }
    else {
      const cost = UP_COSTS[k][lvl];
      if (save.cash >= cost) {
        const preview = typeof CHARS !== 'undefined' && typeof CARS !== 'undefined' ? tuningPreview(CHARS[save.char], CARS[save.car], tun, k) : '';
        save.cash -= cost; tun[k] = lvl + 1;
        persist(); SFX.play('tune'); garMsg = preview || ('УСТАНОВЛЕНО: ' + UP_INFO[k].n); garMsgT = 3;
      } else { garMsg = 'НЕ ХВАТАЕТ ' + fm(cost - save.cash); garMsgT = 2.2; sHit(); }
    }
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.garageAct = { garageRowKind, ROW_KIND, tuningPreview };
  engine.replace('garageAction', garageActionEngine);
})(typeof window !== 'undefined' ? window : globalThis);
