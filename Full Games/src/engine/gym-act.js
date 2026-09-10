////////////////////////////////////////////////////////
//
// DiVANEngine: покупка стата и скила в тренажёрке.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /** Строки 0–2 — база, 3 — личный скил. */
  const GYM_STAT_KEYS = ['spd', 'crn', 'grt'];

  /**
   * Качает один стат текущего пилота.
   * @param {number} i
   * @param {string} key
   */
  function upgradeCharStatEngine(i, key) {
    if (!save.cstats) save.cstats = blankCstatsMap();
    const ch = CHARS[i];
    const cs = save.cstats[i] || (save.cstats[i] = { spd: 0, crn: 0, grt: 0 });
    const maxAdd = 5 - ch[key];
    if (cs[key] >= maxAdd) { garMsg = 'МАКСИМУМ'; garMsgT = 2.2; sHit(); return; }
    const cost = STAT_COSTS[Math.min(cs[key], STAT_COSTS.length - 1)];
    if (save.cash >= cost) {
      save.cash -= cost; cs[key]++; persist(); SFX.play('buy');
      garMsg = 'НАКАЧАНО: ' + STAT_NAME[key]; garMsgT = 2.2;
    } else { garMsg = 'НЕ ХВАТАЕТ ' + fm(cost - save.cash); garMsgT = 2.2; sHit(); }
  }

  /**
   * Покупка в тренажёрке: 0–2 база, 3 — скил текущего гонщика.
   * @param {number} idx
   */
  function buyGymEngine(idx) {
    if (!save.cstats) save.cstats = blankCstatsMap();
    const chI = save.char;
    if (idx < 3) {
      upgradeCharStat(chI, GYM_STAT_KEYS[idx]);
      return;
    }
    const lvl = save.skills[chI] || 1;
    if (lvl >= SKILL_MAX) { garMsg = 'МАКСИМАЛЬНЫЙ УРОВЕНЬ'; garMsgT = 2.2; sHit(); return; }
    const cost = SKILL_COSTS[lvl - 1];
    if (save.cash >= cost) {
      save.cash -= cost; save.skills[chI] = lvl + 1; persist(); SFX.play('buy');
      garMsg = 'СКИЛЛ УЛУЧШЕН: ' + SKILL_META[chI].n; garMsgT = 2.2;
    } else { garMsg = 'НЕ ХВАТАЕТ ' + fm(cost - save.cash); garMsgT = 2.2; sHit(); }
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.gymAct = { GYM_STAT_KEYS };
  engine.replace('upgradeCharStat', upgradeCharStatEngine);
  engine.replace('buyGym', buyGymEngine);
})(typeof window !== 'undefined' ? window : globalThis);
