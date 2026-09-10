////////////////////////////////////////////////////////
//
// Глава 8: Ерш и Бегемотик на табло. Не убивай своих.
// Смерть Медведя и Скарабей не здесь.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  const MISSION_FAMILY = 'family_board';
  const MISSION_TRUTH = 'truth_tunnel';

  /**
   * Семейный заезд ещё не закрыт.
   * @returns {boolean}
   */
  function storyFamilyActive() {
    return !!(save && save.playMode === 'campaign' && save.storyMission === MISSION_FAMILY &&
      !(save.storyFlags && save.storyFlags.familySeen));
  }

  /**
   * Арена после пропуска: вулкан, иначе последний трек.
   * @returns {number}
   */
  function storyFamilyTrackIdx() {
    const defs = typeof TRACKDEFS !== 'undefined' ? TRACKDEFS : [];
    for (let i = 0; i < defs.length; i++) {
      const n = defs[i] && defs[i].name;
      if (n && String(n).indexOf('ВУЛКАН') >= 0) return i;
    }
    return Math.max(0, defs.length - 1);
  }

  /**
   * Пилот из слота CHARS, не новый NPC.
   * @param {number} chI
   * @param {string} fallback
   * @returns {object}
   */
  function storyFamilyChar(chI, fallback) {
    if (typeof CHARS !== 'undefined' && CHARS[chI]) return CHARS[chI];
    return { name: fallback, short: fallback, npc: true };
  }

  /**
   * Ставит союзника в клетку сетки.
   * @param {object} slot
   * @param {number} chI
   * @param {string} fallback
   */
  function storyStampFamilyAlly(slot, chI, fallback) {
    if (!slot || slot.isP) return;
    slot.ch = storyFamilyChar(chI, fallback);
    slot.chIdx = chI;
    slot.isBoss = false;
    slot.isAlly = true;
    const ci = typeof charCarIdx === 'function' ? charCarIdx(chI) : -1;
    if (typeof CARS !== 'undefined' && ci >= 0 && CARS[ci]) slot.car = CARS[ci];
  }

  /**
   * Игрок за этот заезд убил Ерша или Бегемотик.
   * @returns {boolean}
   */
  function storyFamilyBlood() {
    return !!global.storyFamilyKillFlag;
  }

  /**
   * Сброс крови перед клеткой.
   */
  function storyFamilyResetBlood() {
    global.storyFamilyKillFlag = false;
  }

  /**
   * Пометить убийство своих игроком.
   * @param {object} r
   * @param {object|null} killer
   */
  function storyFamilyMarkKill(r, killer) {
    if (!storyFamilyActive() || !r || !killer || !killer.isP) return;
    if ((r.chIdx | 0) === 1 || (r.chIdx | 0) === 2) global.storyFamilyKillFlag = true;
  }

  /**
   * Первое место один раз, если своих не снял.
   * @param {number} place
   * @returns {boolean}
   */
  function storyResolveFamily(place) {
    if (!storyFamilyActive()) return false;
    if ((place | 0) !== 0) return false;
    if (storyFamilyBlood()) return false;
    save.storyFlags = save.storyFlags || {};
    if (save.storyFlags.familySeen) return false;
    save.storyFlags.familySeen = true;
    save.storyChapter = 9;
    save.storyMission = MISSION_TRUTH;
    save.garageState = 'home';
    if (typeof persist === 'function') persist();
    return true;
  }

  /**
   * Союзник не стреляет в игрока и в своих.
   * @param {object} r
   * @param {object} bestT
   * @returns {boolean}
   */
  function storyAllyHoldsFire(r, bestT) {
    if (!r || !r.isAlly || !bestT) return false;
    return !!(bestT.isP || bestT.isAlly);
  }

  global.storyFamilyActive = storyFamilyActive;
  global.storyFamilyTrackIdx = storyFamilyTrackIdx;
  global.storyFamilyChar = storyFamilyChar;
  global.storyFamilyBlood = storyFamilyBlood;
  global.storyFamilyResetBlood = storyFamilyResetBlood;
  global.storyFamilyMarkKill = storyFamilyMarkKill;
  global.storyResolveFamily = storyResolveFamily;

  const engine = global.DiVANEngine;
  if (!engine) return;

  engine.wrap('careerTrackIdx', function (prev) {
    return function () {
      if (typeof raceTrackOverride !== 'undefined' && raceTrackOverride != null) return prev();
      if (storyFamilyActive()) return storyFamilyTrackIdx();
      return prev();
    };
  });

  engine.wrap('planRaceField', function (prev) {
    return function (div) {
      const specs = prev(div);
      if (!storyFamilyActive() || !specs || !specs.length) return specs;
      while (specs.length < 3) {
        specs.push({
          isP: false,
          isBoss: false,
          ch: { name: 'ПЕЛОТОН' },
          car: specs[0].car,
          lvl: {},
          slot: specs.length
        });
      }
      storyStampFamilyAlly(specs[1], 1, 'ЕРШ');
      storyStampFamilyAlly(specs[2], 2, 'БЕГЕМОТИК');
      return specs;
    };
  });

  engine.wrap('careerAfterResults', function (prev) {
    return function (prevRace, newAch) {
      const place = R && R.place;
      const wasFamily = storyFamilyActive();
      prev(prevRace, newAch);
      if (wasFamily) storyResolveFamily(place);
    };
  });

  engine.wrap('drawPreRace', function (prev) {
    return function () {
      prev();
      if (!storyFamilyActive() || typeof txt !== 'function' || typeof W === 'undefined') return;
      txt(g, 'МИССИЯ: СВОИ  ·  не снимай Ерша и Бегемотик', W / 2, 74, 13, '#9dff4a', 'center',
        typeof F_B !== 'undefined' ? F_B : undefined);
    };
  });

  /**
   * Хук есть только в полном заезде, в сюжетной песочнице его нет.
   * @param {string} name
   * @param {function(Function): Function} factory
   */
  function wrapIfPresent(name, factory) {
    if (engine.get(name)) engine.wrap(name, factory);
  }

  wrapIfPresent('killRacer', function (prev) {
    return function (r, killer) {
      storyFamilyMarkKill(r, killer);
      return prev(r, killer);
    };
  });

  wrapIfPresent('kitAiWantsFire', function (prev) {
    return function (r, bestT, bd) {
      if (storyAllyHoldsFire(r, bestT)) return false;
      return prev(r, bestT, bd);
    };
  });

  wrapIfPresent('buildRace', function (prev) {
    return function () {
      storyFamilyResetBlood();
      return prev();
    };
  });
})(typeof window !== 'undefined' ? window : globalThis);
