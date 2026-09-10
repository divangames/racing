////////////////////////////////////////////////////////
//
// DiVANEngine: финиш заезда — время, приз, ставка, трофеи.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Множитель приза по дивизиону.
   * @param {number} div
   * @returns {number}
   */
  function prizeDivMultEngine(div) {
    return 1 + PRIZE_DIV_GROWTH * Math.max(0, (div || 1) - 1);
  }

  /**
   * Время круга/финиша: м:сс.д
   * @param {number} t
   * @returns {string}
   */
  function fmtTEngine(t) {
    const m = (t / 60) | 0, s = t - m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
  }

  /**
   * Круг на полигоне: сотые.
   * @param {number} t
   * @returns {string}
   */
  function fmtLapEngine(t) {
    if (!isFinite(t) || t <= 0) return '—';
    const m = (t / 60) | 0, s = t - m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2);
  }

  /**
   * Порядок мест: финиш по времени, иначе прогресс.
   * @param {object[]} racers
   * @returns {object[]}
   */
  function sortRaceOrder(racers) {
    return racers.slice().sort(function (a, b) {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.prog - a.prog;
    });
  }

  /**
   * Гонщик закрыл последний круг.
   * @param {object} r
   */
  function finishRacerEngine(r) {
    r.finished = true; r.finishTime = R.time;
    r.pitSide = null;
    if (!R.firstDone) { R.firstDone = r; announce(racerTag(r) + ' ФИНИШИРУЕТ ПЕРВЫМ!', true); }
    if (typeof voiceSay === 'function') {
      if (R.firstDone === r) voiceSay(r, 'win', { force: true, gap: 0 });
      else if (r.isP) voiceSay(r, 'lose', { force: true, gap: 0 });
    }
    if (r.isP) { announce('ФИНИШ! КАТИСЬ К КРАЮ, НЕ МЕШАЙ ОСТАЛЬНЫМ', true); sWin(); }
    else announce(r.ch.name + ' ФИНИШИРУЕТ (' + fmtT(r.finishTime) + ')');
  }

  /**
   * Новые трофеи по месту, кассе, гаражу и срезам.
   * @returns {object[]}
   */
  function checkAchievementsEngine() {
    const newAch = [];
    const has = function (id) { return save.achievements[id]; };
    const grant = function (id) {
      if (!has(id)) { save.achievements[id] = true; newAch.push(ACHIEVEMENTS.find(function (a) { return a.id === id; })); }
    };
    if (R.place === 0) grant('first_win');
    if (R.place <= 2 && P.hp >= P.maxhp * .95) grant('perfect');
    if ((P.kills || 0) >= 10) grant('killer');
    if (save.cash >= 50000) grant('millionaire');
    if (Object.keys(save.carOwned || {}).length >= 5) grant('collector');
    if ((R.betStake || 0) > 0 && (R.betPay || 0) > 0 && R.bet === 2) grant('risky');
    if (R.place === 0) {
      save.tracksWon[R.tIdx] = true;
      if (Object.keys(save.tracksWon).length >= TRACKDEFS.length) grant('master');
    }
    const tun = save.tuning[save.car] || {};
    const maxed = ['arm', 'eng', 'tir', 'shk', 'nit'].every(function (k) { return (tun[k] || 0) >= 6; });
    if (maxed) grant('full_garage');
    if (!save.shortcutsUsed) save.shortcutsUsed = 0;
    if (R.shortcuts && R.shortcuts.some(function (s) { return s.used; })) save.shortcutsUsed++;
    if (save.shortcutsUsed >= 5) grant('shortcut_master');
    persist();
    return newAch;
  }

  /**
   * Доска результатов: приз, ставка, рекорды, карьера.
   */
  function showResultsEngine() {
    const ord = sortRaceOrder(R.racers);
    R.place = ord.indexOf(P);
    R.order = ord;
    if (labTest) {
      R.prize = ord.map(function () { return 0; });
      R.quip = 'ПОЛИГОН. КАРЬЕРА И ДЕНЬГИ НЕ ТРОНУТЫ. ENTER — В ЛАБОРАТОРИЮ.';
      fillAnnouncerQueue();
      state = 'results';
      return;
    }
    const divMult = prizeDivMult(R.div);
    R.place = ord.indexOf(P);
    R.prize = ord.map(function (r, i) { return Math.round(PRIZE[i] * divMult); });
    save.cash += R.prize[R.place];
    let betPay = 0, betPlace = -1;
    if ((R.betStake || 0) > 0 && R.betOdds) {
      const tgt = R.racers.find(function (r) { return (r.fieldId | 0) === (R.betPick | 0); }) || (R.betPick === 0 ? P : null);
      betPlace = tgt ? ord.indexOf(tgt) : -1;
      betPay = betPayoutFor(R.betStake, R.betOdds, betPlace);
      if (betPay > 0) save.cash += betPay;
    }
    R.betPay = betPay;
    persist();
    if ((R.betStake || 0) > 0) {
      R.quip = betPay > 0
        ? ('СТАВКА СЫГРАЛА: ' + fmtOdds(betPlace === 0 ? R.betOdds.k1 : betPlace === 1 ? R.betOdds.k2 : R.betOdds.k3) + ' на ' + (R.betName || 'пилота') + ' · +' + fm(betPay))
        : ('СТАВКА СГОРЕЛА. ' + (R.betName || 'ПИЛОТ') + ' ВНЕ ПОДИУМА.');
    } else {
      R.quip = R.place === 0 ? pickLine(LINES_WIN_1) :
        R.place === 1 ? pickLine(LINES_WIN_2) :
          R.place === 2 ? pickLine(LINES_WIN_3) :
            pickLine(LINES_LOSE);
    }
    raceBoard = null;
    fillAnnouncerQueue();
    R.order = ord;
    {
      const rec = save.records[R.tIdx] || (save.records[R.tIdx] = { bestLap: 0, bestPlace: 99 });
      R.newRecLap = false;
      if (P.bestLap && (!rec.bestLap || P.bestLap < rec.bestLap)) { rec.bestLap = P.bestLap; R.newRecLap = true; }
      if (R.place < rec.bestPlace) rec.bestPlace = R.place;
    }
    const newAch = checkAchievements();
    if (newAch.length > 0) {
      setTimeout(function () {
        if (state !== 'results') return;
        newAch.forEach(function (a, i) {
          setTimeout(function () {
            if (state === 'results') announce('ДОСТИЖЕНИЕ ВЗЯТО: ' + a.name, true);
          }, i * 2000);
        });
      }, 1500);
    }
    const prevRace = save.race | 0;
    if (typeof careerAfterResults === 'function') careerAfterResults(prevRace, newAch);
    else { save.race++; persist(); }
    state = 'results';
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.raceFinish = { prizeDivMult: prizeDivMultEngine, fmtT: fmtTEngine, fmtLap: fmtLapEngine, sortRaceOrder: sortRaceOrder };
  engine.replace('prizeDivMult', prizeDivMultEngine);
  engine.replace('fmtT', fmtTEngine);
  engine.replace('fmtLap', fmtLapEngine);
  engine.replace('finishRacer', finishRacerEngine);
  engine.replace('checkAchievements', checkAchievementsEngine);
  engine.replace('showResults', showResultsEngine);
})(typeof window !== 'undefined' ? window : globalThis);
