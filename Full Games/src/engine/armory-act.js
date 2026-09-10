////////////////////////////////////////////////////////
//
// DiVANEngine: вход, покупка и ввод оружейки.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Вход в оружейку текущей машины.
   */
  function enterArmoryEngine() {
    armorySel = 0;
    state = 'armory';
  }

  /**
   * Покупка уровня ствола или ульты.
   * @param {string} key
   */
  function buyArmoryEngine(key) {
    const tun = ensureTuneGuns(save.tuning[save.car] || blankTune());
    save.tuning[save.car] = tun;
    const lvl = tun[key] | 0;
    if (lvl >= ARM_MAX) { garMsg = 'МАКСИМАЛЬНЫЙ УРОВЕНЬ'; garMsgT = 2.2; sHit(); return; }
    const cost = ARM_COSTS[key][lvl];
    if (save.cash < cost) { garMsg = 'НЕ ХВАТАЕТ ' + fm(cost - save.cash); garMsgT = 2.2; sHit(); return; }
    save.cash -= cost; tun[key] = lvl + 1; persist(); SFX.play('tune');
    const ab = carAbil(save.car);
    garMsg = 'УСТАНОВЛЕНО: ' + (key === 'wep' ? ab.weapon.name : ab.ult.name) + ' ' + (lvl + 1);
    garMsgT = 2.2;
  }

  /**
   * Клавиши оружейки.
   * @param {string} c
   */
  function armoryPressEngine(c) {
    if (isBack(c)) { state = 'garage'; sClick(); return; }
    if (c === 'ArrowUp' || c === 'ArrowLeft') { armorySel = (armorySel + 1) % 2; sClick(); return; }
    if (c === 'ArrowDown' || c === 'ArrowRight') { armorySel = (armorySel + 1) % 2; sClick(); return; }
    if (isConfirm(c)) { buyArmory(armorySel === 0 ? 'wep' : 'ult'); }
  }

  /**
   * Клик по карточкам.
   * @param {number} x
   * @param {number} y
   */
  function armoryClickEngine(x, y) {
    const hits = g._armHits || [];
    for (const b of hits) {
      if (x < b.x || x > b.x + b.w || y < b.y || y > b.y + b.h) continue;
      armorySel = b.i;
      if (b.buy) buyArmory(b.key);
      else sClick();
      return;
    }
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.replace('enterArmory', enterArmoryEngine);
  engine.replace('buyArmory', buyArmoryEngine);
  engine.replace('armoryPress', armoryPressEngine);
  engine.replace('armoryClick', armoryClickEngine);
})(typeof window !== 'undefined' ? window : globalThis);
