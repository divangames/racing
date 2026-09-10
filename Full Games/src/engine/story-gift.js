////////////////////////////////////////////////////////
//
// Глава 6: довезти силовой модуль Башкиру через засаду.
// Скарабей и чёрный ящик не возвращаются.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  const MISSION_GIFT = 'gift_bashkir';
  const MISSION_MANUAL = 'drive_manual';
  const MISSION_INVITE = 'arena_invite';

  /**
   * Доставка модуля ещё не закрыта.
   * @returns {boolean}
   */
  function storyGiftActive() {
    if (!save || save.playMode !== 'campaign') return false;
    if (save.storyFlags && save.storyFlags.powerModuleGiven) return false;
    return save.storyMission === MISSION_GIFT || save.storyMission === MISSION_MANUAL;
  }

  /**
   * Засада: перекрёсток смерти, иначе сад.
   * @returns {number}
   */
  function storyGiftTrackIdx() {
    const defs = typeof TRACKDEFS !== 'undefined' ? TRACKDEFS : [];
    for (let i = 0; i < defs.length; i++) {
      const n = defs[i] && defs[i].name;
      if (n && (String(n).indexOf('ПЕРЕКРЁСТОК') >= 0 || String(n).indexOf('САД') >= 0)) return i;
    }
    return Math.min(1, Math.max(0, defs.length - 1));
  }

  /**
   * Союзник в сетке: живой слот Башкира, не новый NPC.
   * @returns {object}
   */
  function storyBashkirChar() {
    if (typeof CHARS !== 'undefined' && CHARS[3]) return CHARS[3];
    return {
      name: 'БАШКИР',
      short: 'БАШКИР',
      spd: 2,
      crn: 3,
      grt: 5,
      col: '#7fb2ff',
      npc: true
    };
  }

  /**
   * Первое место один раз отдаёт модуль; Дьявол остаётся ручным.
   * @param {number} place
   * @returns {boolean}
   */
  function storyResolveGift(place) {
    if (!storyGiftActive()) return false;
    if ((place | 0) !== 0) return false;
    save.storyFlags = save.storyFlags || {};
    if (save.storyFlags.powerModuleGiven) return false;
    save.storyFlags.powerModuleGiven = true;
    save.storyChapter = 6;
    save.storyMission = MISSION_INVITE;
    save.garageState = 'home';
    if (typeof persist === 'function') persist();
    return true;
  }

  /**
   * Отданный модуль чуть сажает личный кузов.
   * @param {object} st
   * @param {object} car
   * @param {number} [aiDiv]
   * @returns {object}
   */
  function storyTuneGiftedStats(st, car, aiDiv) {
    if (!st || !save || save.playMode !== 'campaign') return st;
    if ((aiDiv | 0) > 0) return st;
    if (!(save.storyFlags && save.storyFlags.powerModuleGiven)) return st;
    if (!car || car.idx == null || typeof carOwnerIdx !== 'function') return st;
    if (carOwnerIdx(car.idx) !== save.char) return st;
    st.top *= 0.92;
    st.acc *= 0.9;
    return st;
  }

  global.storyGiftActive = storyGiftActive;
  global.storyGiftTrackIdx = storyGiftTrackIdx;
  global.storyBashkirChar = storyBashkirChar;
  global.storyResolveGift = storyResolveGift;
  global.storyTuneGiftedStats = storyTuneGiftedStats;

  const engine = global.DiVANEngine;
  if (!engine) return;

  engine.wrap('careerTrackIdx', function (prev) {
    return function () {
      if (typeof raceTrackOverride !== 'undefined' && raceTrackOverride != null) return prev();
      if (storyGiftActive()) return storyGiftTrackIdx();
      return prev();
    };
  });

  engine.wrap('planRaceField', function (prev) {
    return function (div) {
      const specs = prev(div);
      if (!storyGiftActive() || !specs || !specs.length) return specs;
      const ally = specs[1] || specs[specs.length - 1];
      if (!ally || ally.isP) return specs;
      ally.ch = storyBashkirChar();
      ally.chIdx = 3;
      ally.isBoss = false;
      ally.isAlly = true;
      const ural = typeof charCarIdx === 'function' ? charCarIdx(3) : 6;
      if (typeof CARS !== 'undefined' && CARS[ural]) ally.car = CARS[ural];
      return specs;
    };
  });

  engine.wrap('careerAfterResults', function (prev) {
    return function (prevRace, newAch) {
      const place = R && R.place;
      const wasGift = storyGiftActive();
      prev(prevRace, newAch);
      if (wasGift) storyResolveGift(place);
    };
  });

  engine.wrap('drawPreRace', function (prev) {
    return function () {
      prev();
      if (!storyGiftActive() || typeof txt !== 'function' || typeof W === 'undefined') return;
      txt(g, 'МИССИЯ: БАШКИР  ·  довези модуль', W / 2, 74, 13, '#7fb2ff', 'center',
        typeof F_B !== 'undefined' ? F_B : undefined);
    };
  });

  engine.wrap('stats', function (prev) {
    return function (ch, car, lvl, cs, aiDiv) {
      const st = prev(ch, car, lvl, cs, aiDiv);
      return storyTuneGiftedStats(st, car, aiDiv);
    };
  });
})(typeof window !== 'undefined' ? window : globalThis);
