////////////////////////////////////////////////////////
//
// DiVANEngine: сетка заезда, кэфы и касса ставки.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Перемешать копию массива.
   * @template T
   * @param {T[]} src
   * @returns {T[]}
   */
  function shuffleCopyEngine(src) {
    const a = src.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /**
   * Сила участника для букмекера: кузов, тюнинг, навык пилота.
   * @param {object} sp
   * @param {number} div
   * @returns {number}
   */
  function specPowerEngine(sp, div) {
    const st = stats(sp.ch, sp.car, sp.lvl, sp.isP ? undefined : { spd: 0, crn: 0, grt: 0 }, sp.isP ? 0 : div);
    return st.top * .38 + st.acc * .2 + st.maxhp * .65 + (sp.skill || .8) * 90 + (sp.isBoss ? 14 : 0) + (sp.isP ? 6 : 0);
  }

  /**
   * Кэфы 1/2/3: фаворит дешевле, аутсайдер дороже.
   * @param {object[]} specs
   * @param {number} div
   * @returns {object[]}
   */
  function computeFieldOddsEngine(specs, div) {
    const powers = specs.map(function (s) { return specPower(s, div); });
    const mean = powers.reduce(function (a, b) { return a + b; }, 0) / Math.max(1, powers.length);
    const temp = Math.max(32, mean * .11);
    const ex = powers.map(function (p) { return Math.exp((p - mean) / temp); });
    const sum = ex.reduce(function (a, b) { return a + b; }, 0);
    const house = .14;
    return specs.map(function (_, i) {
      const pWin = ex[i] / Math.max(1e-6, sum);
      const k1 = clamp(Math.round((1 / Math.max(.08, pWin)) * (1 - house) * 100) / 100, 1.2, 9);
      return {
        k1: k1,
        k2: Math.round(k1 * BET_PLACE_MUL[1] * 100) / 100,
        k3: Math.round(k1 * BET_PLACE_MUL[2] * 100) / 100
      };
    });
  }

  /**
   * Кузова для сетки. Класс дивизиона не снимается, даже если пул пуст.
   * @param {boolean} ignoreOwner чужие личные тоже, лишь бы класс совпал
   * @returns {number[]}
   */
  function fieldCarsOfClass(ignoreOwner) {
    const div = 1 + ((save.race / TRACKDEFS.length) | 0);
    const out = [];
    for (let i = 0; i < CARS.length; i++) {
      const c = CARS[i]; if (!c) continue;
      if (i === save.car) continue;
      if (!ignoreOwner && c.owner != null && c.owner !== save.char) continue;
      if (typeof fieldCarClassOk === 'function' && !fieldCarClassOk(i, div)) continue;
      out.push(i);
    }
    return out;
  }

  /**
   * Кузова для сетки: 1–2 дивизион — хлам, 3–4 — хлам и средний класс.
   * @returns {number[]}
   */
  function fieldFreeCarsEngine() {
    let out = fieldCarsOfClass(false);
    if (!out.length) out = fieldCarsOfClass(true);
    return shuffleCopy(out);
  }

  /** Личный кузов пилота; при его отсутствии — кузов из обычного пула. */
  function fieldCarForCharEngine(chIdx, fallbackIdx) {
    for (let i = 0; i < CARS.length; i++) {
      if (CARS[i] && CARS[i].owner === chIdx) return CARS[i];
    }
    return CARS[fallbackIdx] || CARS[save.car];
  }

  /** Именные играбельные соперники свободного заезда. */
  function freeRideRivalsEngine() {
    return CHARS.map(function (ch, i) { return { ch: ch, idx: i }; }).filter(function (item) {
      return item.idx !== save.char && item.idx !== BULL_IDX && !item.ch.npc && !item.ch.filler;
    });
  }

  /**
   * Сетка: игрок, Бык-босс и пелотон. В свободном заезде все именные пилоты едут вместе.
   * @param {number} div
   * @returns {object[]}
   */
  function planRaceFieldEngine(div) {
    const tun = save.tuning[save.car] || blankTune();
    const specs = [{ id: 0, isP: true, ch: CHARS[save.char], car: CARS[save.car], lvl: tun, slot: 4, skill: 1, isBoss: false }];
    const cars = fieldFreeCars();
    const bull = CHARS[BULL_IDX];
    const bci = cars[0] | 0;
    specs.push({ id: 1, isP: false, ch: bull, car: CARS[bci], lvl: aiBossTune(div), slot: 0, skill: aiDriveSkill(div, true), isBoss: true });
    const rest = cars.filter(function (i) { return i !== bci; });
    const isFreeRide = !(save && save.storyCampaign) && !(typeof labTest !== 'undefined' && labTest);
    const named = isFreeRide ? shuffleCopy(freeRideRivalsEngine()) : [];
    const aiPool = named.length ? named : shuffleCopy(AIDRV).map(function (ch) { return { ch: ch, idx: CHARS.indexOf(ch) }; });
    const gridSlots = [1, 2, 3, 5, 6, 7];
    for (let i = 0; i < FIELD_AI && i < aiPool.length; i++) {
      const ci = rest.length ? rest[i % rest.length] : bci;
      const ai = aiPool[i];
      specs.push({ id: specs.length, isP: false, ch: ai.ch, chIdx: ai.idx, car: named.length ? fieldCarForCharEngine(ai.idx, ci) : CARS[ci], lvl: aiFillerTune(div), slot: gridSlots[i] == null ? 5 + i : gridSlots[i], skill: aiDriveSkill(div, false), isBoss: false });
    }
    return specs;
  }

  /**
   * Сетка заезда до старта: те же пилоты, что выедут на трассу.
   * @returns {{div:number,specs:object[],odds:object[],pick:number}}
   */
  function makeRaceBoardEngine() {
    const div = 1 + ((save.race / TRACKDEFS.length) | 0);
    raceDiv = div;
    const specs = planRaceField(div);
    return { div: div, specs: specs, odds: computeFieldOdds(specs, div), pick: 0 };
  }

  /**
   * Максимальный индекс ставки, который тянет касса.
   * @returns {number}
   */
  function betAffordMaxEngine() {
    let m = 0;
    for (let i = 0; i < BET_TABLE.length; i++) if (save.cash >= BET_TABLE[i].cost) m = i;
    return m;
  }

  /** Снимает выбор, если на ставку не хватает. */
  function clampBetAffordEngine() {
    if (!save) return;
    const i = save.bet | 0;
    if (!BET_TABLE[i] || save.cash < BET_TABLE[i].cost) {
      const n = betAffordMax();
      if (save.bet !== n) { save.bet = n; persist(); }
    }
  }

  /**
   * Листает только доступные по кассе суммы.
   * @param {number} dir
   */
  function cycleBetEngine(dir) {
    if (!save) return;
    const n = BET_TABLE.length;
    let i = save.bet | 0;
    for (let s = 0; s < n; s++) {
      i = (i + dir + n) % n;
      if (save.cash >= BET_TABLE[i].cost) { save.bet = i; persist(); sClick(); return; }
    }
    sHit();
  }

  /**
   * Выплата за место 0/1/2 от кэфа победы.
   * @param {number} stake
   * @param {object} odds
   * @param {number} place
   * @returns {number}
   */
  function betPayoutForEngine(stake, odds, place) {
    if (!stake || !odds || place < 0 || place > 2) return 0;
    const k = place === 0 ? odds.k1 : place === 1 ? odds.k2 : odds.k3;
    return Math.round(stake * k);
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.raceField = { shuffleCopy: shuffleCopyEngine, specPower: specPowerEngine, betPayoutFor: betPayoutForEngine, freeRideRivals: freeRideRivalsEngine };
  engine.replace('shuffleCopy', shuffleCopyEngine);
  engine.replace('specPower', specPowerEngine);
  engine.replace('computeFieldOdds', computeFieldOddsEngine);
  engine.replace('fieldFreeCars', fieldFreeCarsEngine);
  engine.replace('planRaceField', planRaceFieldEngine);
  engine.replace('makeRaceBoard', makeRaceBoardEngine);
  engine.replace('betAffordMax', betAffordMaxEngine);
  engine.replace('clampBetAfford', clampBetAffordEngine);
  engine.replace('cycleBet', cycleBetEngine);
  engine.replace('betPayoutFor', betPayoutForEngine);
})(typeof window !== 'undefined' ? window : globalThis);
