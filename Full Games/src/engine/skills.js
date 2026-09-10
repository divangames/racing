////////////////////////////////////////////////////////
//
// DiVANEngine: личные скилы пилота и эффективные статы.
// Каталоги SKILL_* / STAT_* остаются в контенте.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Норма уровня скила 0…1.
   * @param {number} lvl
   * @returns {number}
   */
  function skillTEngine(lvl) {
    return clamp((lvl - 1) / (SKILL_MAX - 1), 0, 1);
  }

  /**
   * Число скила по гонщику: лечение, КД, урон, мины, навигатор.
   * @param {number} chIdx
   * @param {number} lvl
   * @returns {number}
   */
  function skillValEngine(chIdx, lvl) {
    const t = skillT(lvl);
    switch (chIdx | 0) {
      case 0: return lerp(10, 2, t);
      case 1: return lerp(0.05, 0.15, t);
      case 2: return lerp(0.02, 0.15, t);
      case 3: return lerp(0.10, 1.0, t);
      case 4: return 0;
      case 5: return lerp(5, 12, t);
      default: return 0;
    }
  }

  /**
   * Подпись скила для тренажёрки.
   * @param {number} chIdx
   * @param {number} lvl
   * @returns {string}
   */
  function skillDescEngine(chIdx, lvl) {
    const v = skillVal(chIdx, lvl);
    switch (chIdx | 0) {
      case 0: return 'полное лечение за ' + v.toFixed(1) + 'с';
      case 1: return 'нитро-кд −' + Math.round(v * 100) + '%';
      case 2: return 'урон +' + Math.round(v * 100) + '%';
      case 3: return 'пропуск мин ' + Math.round(v * 100) + '%';
      case 4: return '';
      case 5: return 'стрелки линии, ' + Math.round(v) + ' впереди';
      default: return '';
    }
  }

  /**
   * База гонщика плюс качалка.
   * @param {number} i
   * @returns {{spd:number,crn:number,grt:number}}
   */
  function charEffEngine(i) {
    const ch = CHARS[i];
    const cs = (save && save.cstats && save.cstats[i]) || { spd: 0, crn: 0, grt: 0 };
    return { spd: ch.spd + cs.spd, crn: ch.crn + cs.crn, grt: ch.grt + cs.grt };
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.skills = { skillT: skillTEngine, skillVal: skillValEngine, charEff: charEffEngine };
  engine.replace('skillT', skillTEngine);
  engine.replace('skillVal', skillValEngine);
  engine.replace('SKILL_DESC', skillDescEngine);
  engine.replace('charEff', charEffEngine);
})(typeof window !== 'undefined' ? window : globalThis);
