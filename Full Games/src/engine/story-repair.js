////////////////////////////////////////////////////////
//
// Ходовая Дьявола: овал за мост, ручной режим без ящика.
// Нейросеть / Скарабей не возвращаются.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  const MISSION_REPAIR = 'repair_devil';
  const MISSION_GIFT = 'gift_bashkir';

  /**
   * Миссия ходовой ещё открыта.
   * @returns {boolean}
   */
  function storyRepairActive() {
    return !!(save && save.playMode === 'campaign' && save.storyMission === MISSION_REPAIR &&
      !(save.storyFlags && save.storyFlags.drivetrainRestored));
  }

  /**
   * «Нижний рынок»: пыльный овал, иначе нулевой слот.
   * @returns {number}
   */
  function storyRepairTrackIdx() {
    const defs = typeof TRACKDEFS !== 'undefined' ? TRACKDEFS : [];
    for (let i = 0; i < defs.length; i++) {
      const n = defs[i] && defs[i].name;
      if (n && (String(n).indexOf('ОВАЛ') >= 0 || String(n).indexOf('ПЫЛЬН') >= 0)) return i;
    }
    return 0;
  }

  /**
   * Первое место один раз ставит ходовую, ящик не возвращает.
   * @param {number} place
   * @returns {boolean}
   */
  function storyResolveRepair(place) {
    if (!storyRepairActive()) return false;
    if ((place | 0) !== 0) return false;
    save.storyFlags = save.storyFlags || {};
    if (save.storyFlags.drivetrainRestored) return false;
    save.storyFlags.drivetrainRestored = true;
    save.personalCarState = 'manual';
    save.storyMission = MISSION_GIFT;
    save.garageState = 'home';
    if (typeof persist === 'function') persist();
    return true;
  }

  /**
   * Личный кузов без ходовой ползёт; ручной режим чуть слабее полного.
   * @param {object} st
   * @param {object} car
   * @param {number} [aiDiv]
   * @returns {object}
   */
  function storyTunePersonalStats(st, car, aiDiv) {
    if (!st || !save || save.playMode !== 'campaign') return st;
    if ((aiDiv | 0) > 0) return st;
    if (!car || car.idx == null || typeof carOwnerIdx !== 'function') return st;
    if (carOwnerIdx(car.idx) !== save.char) return st;
    if (save.personalCarState === 'recovering') {
      st.top *= 0.55;
      st.acc *= 0.58;
      st.crn *= 0.72;
      if (typeof st.grip === 'number') st.grip = Math.max(0.42, st.grip * 0.82);
    } else if (save.personalCarState === 'manual') {
      st.top *= 0.9;
      st.acc *= 0.88;
    }
    return st;
  }

  global.storyRepairActive = storyRepairActive;
  global.storyRepairTrackIdx = storyRepairTrackIdx;
  global.storyResolveRepair = storyResolveRepair;
  global.storyTunePersonalStats = storyTunePersonalStats;

  const engine = global.DiVANEngine;
  if (!engine) return;

  engine.wrap('careerTrackIdx', function (prev) {
    return function () {
      if (typeof raceTrackOverride !== 'undefined' && raceTrackOverride != null) return prev();
      if (storyRepairActive()) return storyRepairTrackIdx();
      return prev();
    };
  });

  engine.wrap('careerAfterResults', function (prev) {
    return function (prevRace, newAch) {
      const place = R && R.place;
      const wasRepair = storyRepairActive();
      prev(prevRace, newAch);
      if (wasRepair) storyResolveRepair(place);
    };
  });

  engine.wrap('drawPreRace', function (prev) {
    return function () {
      prev();
      if (!storyRepairActive() || typeof txt !== 'function' || typeof W === 'undefined') return;
      txt(g, 'МИССИЯ: ХОДОВАЯ  ·  мост с пыльного овала', W / 2, 74, 13, '#ff9d2e', 'center',
        typeof F_B !== 'undefined' ? F_B : undefined);
    };
  });

  engine.wrap('stats', function (prev) {
    return function (ch, car, lvl, cs, aiDiv) {
      const st = prev(ch, car, lvl, cs, aiDiv);
      return storyTunePersonalStats(st, car, aiDiv);
    };
  });
})(typeof window !== 'undefined' ? window : globalThis);
