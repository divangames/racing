////////////////////////////////////////////////////////
//
// DiVANEngine: серия, пачка, календарь. Таблицы CAREER_* остаются в career.js.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Индекс трассы для гаража и ставки.
   * @returns {number}
   */
  function careerTrackIdxEngine() {
    if (typeof labTest !== 'undefined' && labTest) return 0;
    if (typeof raceTrackOverride !== 'undefined' && raceTrackOverride != null) {
      return ((raceTrackOverride % TRACKDEFS.length) + TRACKDEFS.length) % TRACKDEFS.length;
    }
    return (save.race | 0) % TRACKDEFS.length;
  }

  /**
   * Поля сейва, которых не было в старых слотах.
   * @param {object} s
   */
  function careerPatchSaveEngine(s) {
    if (!s) return;
    if (typeof s.winStreak !== 'number') s.winStreak = 0;
    if (typeof s.bestStreak !== 'number') s.bestStreak = 0;
    if (typeof s.careerWins !== 'number') s.careerWins = 0;
  }

  /**
   * Уже проеханные трассы календаря.
   * @returns {number[]}
   */
  function careerVisitedIdxEngine() {
    const n = TRACKDEFS.length;
    const done = save.race | 0;
    const seen = {};
    for (let i = 0; i < done; i++) seen[i % n] = true;
    if (R && R.tIdx != null) seen[R.tIdx] = true;
    return Object.keys(seen).map(Number).sort(function (a, b) { return a - b; });
  }

  /**
   * Подпись места.
   * @param {number} place
   * @returns {string}
   */
  function careerPlaceWordEngine(place) {
    if (place === 0) return '1 МЕСТО';
    if (place === 1) return '2 МЕСТО';
    if (place === 2) return '3 МЕСТО';
    return (place + 1) + ' МЕСТО';
  }

  /**
   * Карточки новостей и кнопки «что дальше».
   * @param {number} prevRace
   * @param {boolean} counts
   * @param {number} streakPay
   * @param {number} packPay
   * @param {object[]} newAch
   * @returns {object}
   */
  function careerMakeBriefEngine(prevRace, counts, streakPay, packPay, newAch) {
    const prize = (R.prize && R.prize[R.place]) || 0;
    const news = [];
    const ink = R.place === 0 ? '#ffd23f' : R.place <= 2 ? '#58ff6b' : '#9a93a8';
    news.push({
      kind: 'prize',
      title: careerPlaceWord(R.place),
      text: prize > 0
        ? ('призовые ' + fm(prize) + (R.place <= 2 ? ' · подиум' : ''))
        : 'вне призовой тройки — касса не выросла от места',
      col: ink
    });
    if ((R.betStake || 0) > 0) {
      news.push({
        kind: 'bet',
        title: (R.betPay || 0) > 0 ? 'СТАВКА СЫГРАЛА' : 'СТАВКА СГОРЕЛА',
        text: (R.betPay || 0) > 0
          ? ('+' + fm(R.betPay) + ' · ' + (R.betName || 'пилот'))
          : ((R.betName || 'пилот') + ' не на подиуме'),
        col: (R.betPay || 0) > 0 ? '#58ff6b' : '#ff6b4a'
      });
    }
    if (streakPay > 0) {
      news.push({
        kind: 'streak', title: 'СЕРИЯ ×' + save.winStreak,
        text: 'три и больше побед подряд · бонус ' + fm(streakPay), col: '#ff9d2e'
      });
    } else if (R.place === 0 && save.winStreak > 0 && save.winStreak < 3) {
      news.push({
        kind: 'streak', title: 'СЕРИЯ ×' + save.winStreak,
        text: 'ещё ' + (3 - save.winStreak) + ' подряд — бонус за серию', col: '#c8c2d4'
      });
    } else if (R.place > 0 && prevRace >= 0) {
      news.push({
        kind: 'streak', title: 'СЕРИЯ СБРОШЕНА',
        text: 'бонус за победы подряд только с первого места', col: '#6f6880'
      });
    }
    if (packPay > 0) {
      news.push({
        kind: 'pack', title: 'ТРИ ЭТАПА',
        text: 'закрыта пачка календаря · бонус ' + fm(packPay), col: '#35e0ff'
      });
    }
    const n = TRACKDEFS.length;
    const prevDiv = 1 + ((prevRace / n) | 0);
    const nowDiv = 1 + ((save.race / n) | 0);
    if (counts && nowDiv > prevDiv) {
      news.push({
        kind: 'div', title: 'ДИВИЗИОН ' + DIVN[Math.min(3, nowDiv - 1)],
        text: 'призы выше, боссы злее. Этап ' + (save.race + 1), col: '#ff9d2e'
      });
    }
    if (counts) {
      for (let i = 0; i < CAR_UNLOCK.length; i++) {
        const u = CAR_UNLOCK[i], car = CARS[i];
        if (!u || !car || car.custom) continue;
        if (carOwnerIdx(i) != null) continue;
        const need = u.race | 0;
        if (need > prevRace && save.race >= need) {
          news.push({
            kind: 'car', title: 'ОТКРЫТ КУЗОВ',
            text: car.name + ' — этап ' + (need + 1) + '. Купить в автопарке, если хватит кассы.',
            col: car.col || '#ffd23f'
          });
        }
      }
    }
    const nextDef = TRACKDEFS[save.race % n];
    if (counts && nextDef) {
      news.push({
        kind: 'track', title: 'СЛЕДУЮЩИЙ ЭТАП',
        text: nextDef.name + ' · этап ' + (save.race + 1), col: '#e8e2d0'
      });
    } else if (!counts) {
      news.push({
        kind: 'track', title: 'РЕВАНШ НЕ СДВИНУЛ ЭТАП',
        text: 'календарь: ' + (nextDef ? nextDef.name : '—') + ' · этап ' + (save.race + 1), col: '#9a93a8'
      });
    }
    (newAch || []).forEach(function (a) {
      if (!a) return;
      news.push({ kind: 'ach', title: 'ДОСТИЖЕНИЕ', text: a.name, col: '#ffd23f' });
    });
    const wins = save.careerWins | 0;
    const canPick = wins >= CAREER_PICK_WINS;
    if (!canPick) {
      news.push({
        kind: 'hint', title: 'ВЫБОР ТРАССЫ',
        text: 'ещё ' + Math.max(0, CAREER_PICK_WINS - wins) + ' побед — реванш на любой уже открытой',
        col: '#6f6880'
      });
    }
    const lastName = (R.T && R.T.name) || 'эта трасса';
    const actions = [
      { id: 'garage', label: 'ГАРАЖ', sub: counts ? ('дальше: ' + (nextDef ? nextDef.name : '')) : 'календарь без сдвига' },
      { id: 'rematch', label: 'РЕВАНШ', sub: lastName }
    ];
    if (canPick) actions.push({ id: 'pick', label: 'ДРУГАЯ ТРАССА', sub: 'уже проеханные' });
    return { news: news.slice(0, 6), actions: actions, sel: 0, t0: gt };
  }

  /**
   * Серия, пачка, этап — затем карточки.
   * @param {number} prevRace
   * @param {object[]} newAch
   */
  function careerAfterResultsEngine(prevRace, newAch) {
    careerPatchSave(save);
    const counts = !labTest && R.countsForCareer !== false;
    if (R.place === 0) {
      save.winStreak = (save.winStreak | 0) + 1;
      save.careerWins = (save.careerWins | 0) + 1;
      if (save.winStreak > (save.bestStreak | 0)) save.bestStreak = save.winStreak;
    } else {
      save.winStreak = 0;
    }
    let streakPay = 0;
    const streakKey = save.winStreak | 0;
    if (R.place === 0 && CAREER_STREAK_PAY[streakKey]) {
      streakPay = Math.round(CAREER_STREAK_PAY[streakKey] * prizeDivMult(R.div));
      save.cash += streakPay;
    }
    let packPay = 0;
    if (counts) save.race++;
    if (counts && save.race > 0 && save.race % CAREER_PACK === 0) {
      packPay = Math.round(CAREER_PACK_PAY * prizeDivMult(R.div));
      save.cash += packPay;
    }
    persist();
    R.career = careerMakeBrief(prevRace, counts, streakPay, packPay, newAch || []);
  }

  /**
   * С подиума на экран смысла, не сразу в гараж.
   */
  function careerOpenFromResultsEngine() {
    if (labTest) { exitLabTest(); return; }
    if (!R || !R.career) { state = 'garage'; return; }
    R.career.sel = 0;
    R.career.t0 = gt;
    state = 'career';
  }

  /**
   * Кнопка экрана карьеры.
   * @param {string} id
   */
  function careerDoEngine(id) {
    if (id === 'garage') {
      raceTrackOverride = null; raceBoard = null; state = 'garage'; sClick(); return;
    }
    if (id === 'rematch') {
      if (R && R.tIdx != null) raceTrackOverride = R.tIdx;
      raceBoard = null; state = 'garage'; sClick(); return;
    }
    if (id === 'pick') { careerEnterTrackPick(); sClick(); }
  }

  /**
   * Сетка уже открытых трасс.
   */
  function careerEnterTrackPickEngine() {
    const list = careerVisitedIdx();
    careerPickSel = list.indexOf(R && R.tIdx != null ? R.tIdx : careerTrackIdx());
    if (careerPickSel < 0) careerPickSel = 0;
    careerPickList = list;
    state = 'careerTracks';
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.replace('careerTrackIdx', careerTrackIdxEngine);
  engine.replace('careerPatchSave', careerPatchSaveEngine);
  engine.replace('careerVisitedIdx', careerVisitedIdxEngine);
  engine.replace('careerPlaceWord', careerPlaceWordEngine);
  engine.replace('careerMakeBrief', careerMakeBriefEngine);
  engine.replace('careerAfterResults', careerAfterResultsEngine);
  engine.replace('careerOpenFromResults', careerOpenFromResultsEngine);
  engine.replace('careerDo', careerDoEngine);
  engine.replace('careerEnterTrackPick', careerEnterTrackPickEngine);
})(typeof window !== 'undefined' ? window : globalThis);
