////////////////////////////////////////////////////////
//
// DiVANEngine: статы машины из пилота, кузова и тюнинга.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  // Слоты ранних версий могли содержать неполный тюнинг. Ограничиваем только
  // расчёт: купленные уровни и сами сохранения здесь не переписываются.
  function tuneLevel(value) {
    const n = Number(value);
    return Number.isFinite(n) ? clamp(Math.floor(n), 0, 6) : 0;
  }

  function pilotStat(base, extra) {
    const b = Number.isFinite(Number(base)) ? Number(base) : 3;
    const n = Number(extra);
    return clamp(b + (Number.isFinite(n) ? Math.max(0, n) : 0), 0, 5);
  }

  /**
   * Скорость, поворот, броня, ХП, сцепление и обочина.
   * @param {object} ch
   * @param {object} car
   * @param {object} lvl
   * @param {object|null} [cs]
   * @param {number} [aiDiv]
   * @returns {object}
   */
  function statsEngine(ch, car, lvl, cs, aiDiv) {
    lvl = lvl || {};
    const chIdx = CHARS.indexOf(ch);
    if (cs === undefined) cs = (chIdx >= 0 && save && save.cstats && save.cstats[chIdx]) || null;
    const spd = pilotStat(ch.spd, cs && cs.spd), crn = pilotStat(ch.crn, cs && cs.crn), grt = pilotStat(ch.grt, cs && cs.grt);
    const arm = tuneLevel(lvl.arm), eng = tuneLevel(lvl.eng), tir = tuneLevel(lvl.tir), shk = tuneLevel(lvl.shk);
    const hpBonus = car.idx === 0 ? 20 : 0;
    const crnM = car.idx === 2 ? 1.12 : 1;
    const accM = car.idx === 1 ? 1.15 : 1;
    let off = Math.min(.86, .4 + shk * .085 + grt * .01);
    if (car.idx === 0 || car.idx === 6) off = Math.min(.92, off + .15);
    if (typeof kitStarterOff === 'function') off = kitStarterOff(car, off);
    if (car.idx === 3) off = 1;
    // У парящего кузова уже есть сильное базовое сцепление. Его апгрейд
    // помогает стабилизации, но не превращается в бесплатный рельсовый руль.
    let turn = 2.5 * car.crn * crnM * (1 + tir * (car.idx === 3 ? .025 : .07)) * (1 + crn * .05);
    let grip = clamp(.5 + (car.idx === 3 ? .42 : 0) + tir * (car.idx === 3 ? .015 : .055) + crn * .038, .48, 1.2);
    if (chIdx === 5) { turn *= 1.1; grip = clamp(grip * 0.84, .42, 1.2); }
    let maxhp = Math.round((car.hp + hpBonus + arm * 22) * (1 + grt * .04));
    let top = 330 * car.top * (1 + eng * .055) * (1 + spd * .03);
    let acc = 300 * car.acc * accM * (1 + eng * .08);
    if (aiDiv > 0) {
      const p = aiPerfScale(aiDiv);
      maxhp = Math.round(maxhp * p.hp);
      top *= p.spd; acc *= p.acc;
    }
    return { maxhp, top, acc, crn: turn, sharp: clamp((turn - 2.15) / 3.05, 0, 1), grip, off };
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.replace('stats', statsEngine);
})(typeof window !== 'undefined' ? window : globalThis);
