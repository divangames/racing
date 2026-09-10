////////////////////////////////////////////////////////
//
// DiVANEngine: уровни ствола, магазин, урон, снаряд из носа.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Уровень ствола 0…6.
   * @param {object} r
   * @returns {number}
   */
  function kitLvWEngine(r) {
    return Math.max(0, Math.min(6, (r && r.wepLvl) | 0));
  }

  /**
   * Уровень ульты 0…6.
   * @param {object} r
   * @returns {number}
   */
  function kitLvUEngine(r) {
    return Math.max(0, Math.min(6, (r && r.ultLvl) | 0));
  }

  /**
   * КД оружия после оружейки.
   * @param {object} r
   * @param {object} ab
   * @returns {number}
   */
  function kitWepCdEngine(r, ab) {
    return Math.max(0.045, (ab.cd || 1) * (1 - kitLvW(r) * 0.06));
  }

  /**
   * КД ульты после оружейки.
   * @param {object} r
   * @param {object} ab
   * @returns {number}
   */
  function kitUltCdEngine(r, ab) {
    return Math.max(3, (ab.cd || 10) * (1 - kitLvU(r) * 0.07));
  }

  /**
   * Перегрев минигана / гатлинга.
   * @param {object} r
   * @param {object} ab
   * @returns {number}
   */
  function kitOverheatEngine(r, ab) {
    return Math.max(0.7, (ab.overheat || 3.2) * (1 - kitLvW(r) * 0.07));
  }

  /**
   * Шаг нагрева гатлинга.
   * @param {object} r
   * @param {object} ab
   * @returns {number}
   */
  function kitHeatStepEngine(r, ab) {
    return Math.max(0.035, (ab.heat || 0.07) * (1 - kitLvW(r) * 0.08));
  }

  /**
   * Длительность ульты.
   * @param {object} r
   * @param {number} base
   * @returns {number}
   */
  function kitUltDurEngine(r, base) {
    return (base || 1) * (1 + kitLvU(r) * 0.12);
  }

  /**
   * Радиус ульты.
   * @param {object} r
   * @param {number} base
   * @returns {number}
   */
  function kitUltRadEngine(r, base) {
    return (base || 1) * (1 + kitLvU(r) * 0.08);
  }

  /**
   * Строка HUD: оружие · нитро/прыжок · ульта.
   * @param {object} ab
   * @returns {string}
   */
  function abilHudLineEngine(ab) {
    const n = (ab.nitro && ab.nitro.type) === 'jump' ? 'прыжок ' + ab.nitro.cd + 'с' : 'нитро ' + ab.nitro.cd + 'с';
    return ab.weapon.name + ' · ' + n + ' · ' + ab.ult.name;
  }

  /**
   * Магазин минигана (0 — обычный кулдаун).
   * @param {object} r
   * @returns {number}
   */
  function wepMagMaxEngine(r) {
    const w = carAbil(r.car.idx).weapon;
    if (!(w && w.type === 'minigun')) return 0;
    return (w.ammo || 50) + kitLvW(r) * 8;
  }

  /**
   * Полный магазин и сброс перегрева.
   * @param {object} r
   */
  function resetWepMagEngine(r) {
    r.wepAmmo = wepMagMax(r);
    r.wepOver = 0;
    r.wepHeat = 0;
  }

  /**
   * Урон выстрела: оружейка, рывок, берсерк, скил Бегемотика.
   * @param {object} r
   * @param {object} ab
   * @returns {number}
   */
  function kitWepDmgEngine(r, ab) {
    const tune = 1 + kitLvW(r) * 0.08;
    return ab.dmg * tune * r.buffDmg * (r.berserk > 0 ? 1.5 : 1) * (r.dmgMul || 1);
  }

  /**
   * Занос: ручник или сильный lat.
   * @param {object} r
   * @returns {boolean}
   */
  function kitSlidingEngine(r) {
    return Math.abs(r.lat || 0) > 38 || (!!r.handbrake && Math.abs(r.spd) > 48);
  }

  /**
   * Метка следующей мины.
   * @returns {number}
   */
  function kitMineIdEngine() {
    global._kitMineSeq = (global._kitMineSeq || 9000) + 1;
    return global._kitMineSeq;
  }

  /**
   * Выстрел из носа.
   * @param {object} r
   * @param {number} ang
   * @param {number} spd
   * @param {number} life
   * @param {number} dmg
   * @param {object} [extra]
   * @returns {object}
   */
  function kitPushShotEngine(r, ang, spd, life, dmg, extra) {
    const s = Object.assign({
      x: r.x + Math.cos(ang) * 26, y: r.y + Math.sin(ang) * 26,
      vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, r: r, life: life, dmg: dmg
    }, extra || {});
    R.shots.push(s);
    return s;
  }

  /**
   * Гаубица рвётся по площади.
   * @param {number} x
   * @param {number} y
   * @param {number} dmg
   * @param {object} owner
   * @param {number} [rad]
   */
  function kitMortarBoomEngine(x, y, dmg, owner, rad) {
    const Rmax = rad || 108;
    boom(x, y, 'rocket');
    if (!R.demo) { sBoom(); if (nearP(x, y, 700)) doShake(8); }
    for (const o of R.racers) {
      if (o.dead || o === owner) continue;
      const d = Math.hypot(o.x - x, o.y - y);
      if (d > Rmax) continue;
      dmgRacer(o, dmg * (1 - d / Rmax), owner, 'proj');
    }
  }

  /**
   * Множитель исходящего тарана.
   * @param {object} r
   * @returns {number}
   */
  function kitRamOutEngine(r) {
    let m = 1;
    if (r.car.idx === 0) m = 2;
    if (r.car.idx === 4) m = 3;
    if (r.car.idx === 17) m = 1.22;
    if (r.dash > 0) m *= 1.15;
    if (r.berserk > 0) m *= 1.45;
    return m;
  }

  /**
   * Множитель входящего тарана.
   * @param {object} r
   * @returns {number}
   */
  function kitRamInEngine(r) {
    if (r.car.idx === 0 || r.car.idx === 4) return .5;
    return 1;
  }

  /**
   * Купол режет снаряды и мины, таран проходит.
   * @param {string} src
   * @returns {boolean}
   */
  function kitBubbleBlocksEngine(src) {
    return src !== 'ram' && src !== 'crush';
  }

  /**
   * Призрак не сталкивается.
   * @param {object} r
   * @returns {boolean}
   */
  function kitGhostEngine(r) {
    return (r.ghost || 0) > 0;
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.weapons = { kitLvW: kitLvWEngine, kitLvU: kitLvUEngine, wepMagMax: wepMagMaxEngine, kitWepDmg: kitWepDmgEngine };
  engine.replace('kitLvW', kitLvWEngine);
  engine.replace('kitLvU', kitLvUEngine);
  engine.replace('kitWepCd', kitWepCdEngine);
  engine.replace('kitUltCd', kitUltCdEngine);
  engine.replace('kitOverheat', kitOverheatEngine);
  engine.replace('kitHeatStep', kitHeatStepEngine);
  engine.replace('kitUltDur', kitUltDurEngine);
  engine.replace('kitUltRad', kitUltRadEngine);
  engine.replace('abilHudLine', abilHudLineEngine);
  engine.replace('wepMagMax', wepMagMaxEngine);
  engine.replace('resetWepMag', resetWepMagEngine);
  engine.replace('kitWepDmg', kitWepDmgEngine);
  engine.replace('kitSliding', kitSlidingEngine);
  engine.replace('kitMineId', kitMineIdEngine);
  engine.replace('kitPushShot', kitPushShotEngine);
  engine.replace('kitMortarBoom', kitMortarBoomEngine);
  engine.replace('kitRamOut', kitRamOutEngine);
  engine.replace('kitRamIn', kitRamInEngine);
  engine.replace('kitBubbleBlocks', kitBubbleBlocksEngine);
  engine.replace('kitGhost', kitGhostEngine);
})(typeof window !== 'undefined' ? window : globalThis);
