////////////////////////////////////////////////////////
//
// DiVANEngine: покупка стата и скила в тренажёрке.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /** Строки 0–2 — база, 3 — доход, 4 — личный скил. */
  const GYM_STAT_KEYS = ['spd', 'crn', 'grt'];

  // При призе первого дивизиона 480 прежний вход за 150 000 откладывал
  // прокачку на сотни гонок. Первые покупки теперь сопоставимы с тюнингом,
  // а последние уровни остаются долгосрочной целью. Общие массивы нужны
  // также досье гонщика: на всех экранах показывается фактическая цена.
  const BALANCED_STAT_COSTS = [900, 1800, 3200, 5200];
  const BALANCED_SKILL_COSTS = [1200, 2400, 4200, 7200, 12000];

  function charTraining(i) {
    if (!save.cstats) save.cstats = blankCstatsMap();
    const cs = save.cstats[i] || (save.cstats[i] = {});
    GYM_STAT_KEYS.concat('inc').forEach(function (key) {
      const n = Number(cs[key]);
      cs[key] = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
    });
    return cs;
  }

  /**
   * Качает один стат текущего пилота.
   * @param {number} i
   * @param {string} key
   */
  function upgradeCharStatEngine(i, key) {
    const ch = CHARS[i];
    if (!ch || GYM_STAT_KEYS.indexOf(key) < 0) return;
    const cs = charTraining(i);
    const maxAdd = 5 - ch[key];
    if (cs[key] >= maxAdd) { garMsg = 'МАКСИМУМ'; garMsgT = 2.2; sHit(); return; }
    const cost = STAT_COSTS[Math.min(cs[key], STAT_COSTS.length - 1)];
    if (save.cash >= cost) {
      save.cash -= cost; cs[key]++; persist(); SFX.play('buy');
      garMsg = 'НАКАЧАНО: ' + STAT_NAME[key]; garMsgT = 2.2;
    } else { garMsg = 'НЕ ХВАТАЕТ ' + fm(cost - save.cash); garMsgT = 2.2; sHit(); }
  }

  /**
   * Покупка в тренажёрке: 0–2 база, 3 — доход, 4 — скил текущего гонщика.
   * @param {number} idx
   */
  function buyGymEngine(idx) {
    if (!Number.isInteger(idx) || idx < 0 || idx > 4) return;
    const chI = save.char;
    if (!CHARS[chI]) return;
    const cs = charTraining(chI);
    if (idx < 3) {
      upgradeCharStat(chI, GYM_STAT_KEYS[idx]);
      return;
    }
    if (idx === 3) {
      const max = DiVANEngine.skills.INCOME_PCTS.length - 1;
      const lvl = cs.inc | 0;
      if (lvl >= max) { garMsg = 'ДОХОД: МАКСИМУМ'; garMsgT = 2.2; sHit(); return; }
      const cost = SKILL_COSTS[Math.min(lvl, SKILL_COSTS.length - 1)];
      if (save.cash >= cost) {
        save.cash -= cost; cs.inc = lvl + 1; persist(); SFX.play('buy');
        garMsg = 'ДОХОД: +' + incomePct(chI) + '%'; garMsgT = 2.2;
      } else { garMsg = 'НЕ ХВАТАЕТ ' + fm(cost - save.cash); garMsgT = 2.2; sHit(); }
      return;
    }
    if (!save.skills) save.skills = {};
    const rawLevel = Number(save.skills[chI]);
    const lvl = Number.isFinite(rawLevel) ? Math.max(1, Math.floor(rawLevel)) : 1;
    if (lvl >= SKILL_MAX) { garMsg = 'МАКСИМАЛЬНЫЙ УРОВЕНЬ'; garMsgT = 2.2; sHit(); return; }
    const cost = SKILL_COSTS[lvl - 1];
    if (save.cash >= cost) {
      save.cash -= cost; save.skills[chI] = lvl + 1; persist(); SFX.play('buy');
      garMsg = 'СКИЛЛ УЛУЧШЕН: ' + SKILL_META[chI].n; garMsgT = 2.2;
    } else { garMsg = 'НЕ ХВАТАЕТ ' + fm(cost - save.cash); garMsgT = 2.2; sHit(); }
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  if (typeof STAT_COSTS !== 'undefined') STAT_COSTS.splice(0, STAT_COSTS.length, ...BALANCED_STAT_COSTS);
  if (typeof SKILL_COSTS !== 'undefined') SKILL_COSTS.splice(0, SKILL_COSTS.length, ...BALANCED_SKILL_COSTS);
  engine.gymAct = { GYM_STAT_KEYS, statCosts: BALANCED_STAT_COSTS.slice(), skillCosts: BALANCED_SKILL_COSTS.slice() };
  engine.replace('upgradeCharStat', upgradeCharStatEngine);
  engine.replace('buyGym', buyGymEngine);
})(typeof window !== 'undefined' ? window : globalThis);
