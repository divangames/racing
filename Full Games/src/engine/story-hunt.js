////////////////////////////////////////////////////////
//
// Охота на Бронекузнеца: заводской трек, босс, корпус за 1 место.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  const MISSION_BRONE = 'find_bronekouznets';
  const MISSION_REPAIR = 'repair_devil';

  /**
   * Охота ещё не закрыта.
   * @returns {boolean}
   */
  function storyHuntActive() {
    return !!(save && save.playMode === 'campaign' && save.storyMission === MISSION_BRONE &&
      !(save.storyFlags && save.storyFlags.bronekouznetsBeaten));
  }

  /**
   * Босс без слота лица, чтобы не сдвигать папки пилотов.
   * @returns {object}
   */
  function storySmithChar() {
    return {
      name: 'БРОНЕКУЗНЕЦ',
      short: 'КУЗНЕЦ',
      spd: 2,
      crn: 2,
      grt: 5,
      col: '#a86b3c',
      skin: '#c4a07a',
      hair: '#1a120c',
      npc: true
    };
  }

  /**
   * Трек крушения, иначе запасной индекс.
   * @returns {number}
   */
  function storyHuntTrackIdx() {
    const defs = typeof TRACKDEFS !== 'undefined' ? TRACKDEFS : [];
    for (let i = 0; i < defs.length; i++) {
      const n = defs[i] && defs[i].name;
      if (n && String(n).indexOf('КРУШЕНИЕ') >= 0) return i;
    }
    return Math.min(2, Math.max(0, defs.length - 1));
  }

  /**
   * Первое место один раз возвращает корпус, ящик ещё нет.
   * @param {number} place
   * @returns {boolean}
   */
  function storyResolveHunt(place) {
    if (!storyHuntActive()) return false;
    if ((place | 0) !== 0) return false;
    save.storyFlags = save.storyFlags || {};
    if (save.storyFlags.bronekouznetsBeaten) return false;
    save.storyFlags.bronekouznetsBeaten = true;
    save.personalCarState = 'recovering';
    save.storyMission = MISSION_REPAIR;
    save.garageState = 'home';
    const own = typeof charCarIdx === 'function' ? charCarIdx(save.char) : 0;
    save.carOwned = save.carOwned || {};
    save.carOwned[own] = true;
    if (typeof persist === 'function') persist();
    return true;
  }

  global.storyHuntActive = storyHuntActive;
  global.storySmithChar = storySmithChar;
  global.storyHuntTrackIdx = storyHuntTrackIdx;
  global.storyResolveHunt = storyResolveHunt;

  const engine = global.DiVANEngine;
  if (!engine) return;

  engine.wrap('careerTrackIdx', function (prev) {
    return function () {
      if (typeof raceTrackOverride !== 'undefined' && raceTrackOverride != null) return prev();
      if (storyHuntActive()) return storyHuntTrackIdx();
      return prev();
    };
  });

  engine.wrap('planRaceField', function (prev) {
    return function (div) {
      const specs = prev(div);
      if (!storyHuntActive() || !specs || !specs.length) return specs;
      const boss = specs[1] || specs[specs.length - 1];
      if (!boss || boss.isP) return specs;
      boss.ch = storySmithChar();
      boss.isBoss = true;
      if (typeof aiBossTune === 'function') {
        const tun = aiBossTune(div);
        tun.arm = Math.max(tun.arm | 0, 4);
        boss.lvl = tun;
      }
      return specs;
    };
  });

  engine.wrap('careerAfterResults', function (prev) {
    return function (prevRace, newAch) {
      const place = R && R.place;
      prev(prevRace, newAch);
      storyResolveHunt(place);
    };
  });

  engine.wrap('drawPreRace', function (prev) {
    return function () {
      prev();
      if (!storyHuntActive() || typeof txt !== 'function' || typeof W === 'undefined') return;
      txt(g, 'МИССИЯ: БРОНЕКУЗНЕЦ  ·  догони корпус', W / 2, 74, 13, '#ff9d2e', 'center',
        typeof F_B !== 'undefined' ? F_B : undefined);
    };
  });
})(typeof window !== 'undefined' ? window : globalThis);
