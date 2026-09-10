////////////////////////////////////////////////////////
//
// Приглашение на арену: пропуск Лаурята, Янот в сетке.
// Смерть Медведя и Скарабей не здесь.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  const MISSION_INVITE = 'arena_invite';
  const MISSION_FAMILY = 'family_board';

  /**
   * Гонка за пропуском ещё открыта.
   * @returns {boolean}
   */
  function storyInviteActive() {
    return !!(save && save.playMode === 'campaign' && save.storyMission === MISSION_INVITE &&
      !(save.storyFlags && save.storyFlags.arenaPass));
  }

  /**
   * Холодный вход на арену: ледяной перевал.
   * @returns {number}
   */
  function storyInviteTrackIdx() {
    const defs = typeof TRACKDEFS !== 'undefined' ? TRACKDEFS : [];
    for (let i = 0; i < defs.length; i++) {
      const n = defs[i] && defs[i].name;
      if (n && (String(n).indexOf('ЛЕДЯН') >= 0 || String(n).indexOf('ЛЁД') >= 0 || String(n).indexOf('ЛЕД') >= 0)) {
        return i;
      }
    }
    return Math.min(3, Math.max(0, defs.length - 1));
  }

  /**
   * Янот из слота 06, не новый NPC.
   * @returns {object}
   */
  function storyYanotChar() {
    if (typeof CHARS !== 'undefined' && CHARS[5]) return CHARS[5];
    return {
      name: 'ЯНОТ',
      short: 'ЯНОТ',
      spd: 3,
      crn: 5,
      grt: 2,
      col: '#f0c230',
      npc: true
    };
  }

  /**
   * Первое место один раз: Янот на линии, пропуск принят.
   * @param {number} place
   * @returns {boolean}
   */
  function storyResolveInvite(place) {
    if (!storyInviteActive()) return false;
    if ((place | 0) !== 0) return false;
    save.storyFlags = save.storyFlags || {};
    if (save.storyFlags.arenaPass) return false;
    save.storyFlags.arenaPass = true;
    save.storyChapter = 8;
    save.storyMission = MISSION_FAMILY;
    save.garageState = 'home';
    if (typeof persist === 'function') persist();
    return true;
  }

  global.storyInviteActive = storyInviteActive;
  global.storyInviteTrackIdx = storyInviteTrackIdx;
  global.storyYanotChar = storyYanotChar;
  global.storyResolveInvite = storyResolveInvite;

  const engine = global.DiVANEngine;
  if (!engine) return;

  engine.wrap('careerTrackIdx', function (prev) {
    return function () {
      if (typeof raceTrackOverride !== 'undefined' && raceTrackOverride != null) return prev();
      if (storyInviteActive()) return storyInviteTrackIdx();
      return prev();
    };
  });

  engine.wrap('planRaceField', function (prev) {
    return function (div) {
      const specs = prev(div);
      if (!storyInviteActive() || !specs || !specs.length) return specs;
      const ally = specs[1] || specs[specs.length - 1];
      if (!ally || ally.isP) return specs;
      ally.ch = storyYanotChar();
      ally.chIdx = 5;
      ally.isBoss = false;
      ally.isAlly = true;
      const brichka = typeof charCarIdx === 'function' ? charCarIdx(5) : 10;
      if (typeof CARS !== 'undefined' && CARS[brichka]) ally.car = CARS[brichka];
      return specs;
    };
  });

  engine.wrap('careerAfterResults', function (prev) {
    return function (prevRace, newAch) {
      const place = R && R.place;
      const wasInvite = storyInviteActive();
      prev(prevRace, newAch);
      if (wasInvite) storyResolveInvite(place);
    };
  });

  engine.wrap('drawPreRace', function (prev) {
    return function () {
      prev();
      if (!storyInviteActive() || typeof txt !== 'function' || typeof W === 'undefined') return;
      txt(g, 'МИССИЯ: ЯНОТ  ·  дома больше нет', W / 2, 74, 13, '#f0c230', 'center',
        typeof F_B !== 'undefined' ? F_B : undefined);
    };
  });
})(typeof window !== 'undefined' ? window : globalThis);
