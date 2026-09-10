////////////////////////////////////////////////////////
//
// DiVANEngine: бонусы ствола и ульты на верстаке.
// Цены ARM_COSTS остаются в armory.js.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Дописывает wep/ult в старый тюнинг.
   * @param {object} tun
   * @returns {object}
   */
  function ensureTuneGunsEngine(tun) {
    if (!tun) return tun;
    if (tun.wep == null) tun.wep = 0;
    if (tun.ult == null) tun.ult = 0;
    return tun;
  }

  /**
   * Текст бонуса ствола для этого кузова.
   * @param {number} idx
   * @param {number} lvl
   * @returns {string}
   */
  function armWepBlurbEngine(idx, lvl) {
    const w = carAbil(idx).weapon;
    const t = w.type;
    if (!lvl) return 'сток · каждый уровень: +8% урона, −6% КД';
    const dmg = 'урон +' + Math.round(lvl * 8) + '%';
    const cd = ' · КД −' + Math.round(lvl * 6) + '%';
    switch (t) {
      case 'minigun': return dmg + cd + ' · магазин ' + (50 + lvl * 8) + ' · холоднее ствол';
      case 'gatling': return dmg + cd + ' · лента греется медленнее';
      case 'fang': return dmg + cd + ' · клык плотнее в упор';
      case 'saw': return dmg + cd + ' · пилы достают дальше';
      case 'homing': return dmg + cd + ' · импульс бьёт жёстче';
      case 'mortar': return dmg + cd + ' · разрыв шире';
      case 'plasma': return dmg + cd + ' · шар тяжелее';
      case 'spikes': return dmg + cd + ' · шипы живут дольше' + (lvl >= 4 ? ' · лента шире' : '');
      case 'mine': return dmg + cd + ' · посылка жирнее';
      case 'nails': return dmg + cd + ' · гвоздей больнее';
      case 'hook': return dmg + cd + ' · скоба тянет дальше';
      default: return dmg + cd;
    }
  }

  /**
   * Текст бонуса ульты для этого кузова.
   * @param {number} idx
   * @param {number} lvl
   * @returns {string}
   */
  function armUltBlurbEngine(idx, lvl) {
    const u = carAbil(idx).ult;
    const t = u.type;
    if (!lvl) return 'сток · каждый уровень: −7% КД, +12% длительность / радиус';
    const cd = 'КД −' + Math.round(lvl * 7) + '%';
    const dur = ' · длительность +' + Math.round(lvl * 12) + '%';
    switch (t) {
      case 'dash': return cd + dur + ' · рывок дольше держит таран';
      case 'slowmo': return cd + dur + ' · прицел держит сетку дольше';
      case 'cage': return cd + ' · пауки злее и живучее';
      case 'recharge': return cd + (lvl >= 4 ? ' · третий щит на IV+' : ' · щиты и перезарядка');
      case 'berserk': return cd + dur + ' · монолит стоит дольше';
      case 'cloak': return cd + dur + ' · дольше в тени';
      case 'plow': return cd + ' · отвал шире';
      case 'ghost': return cd + dur + ' · дольше сквозь машины';
      case 'haze': return cd + dur + ' · облако больше';
      case 'bubble': return cd + dur + ' · купол дольше';
      case 'shove': return cd + ' · табун шире';
      default: return cd + dur;
    }
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.armoryTune = { ensureTuneGuns: ensureTuneGunsEngine };
  engine.replace('ensureTuneGuns', ensureTuneGunsEngine);
  engine.replace('armWepBlurb', armWepBlurbEngine);
  engine.replace('armUltBlurb', armUltBlurbEngine);
})(typeof window !== 'undefined' ? window : globalThis);
