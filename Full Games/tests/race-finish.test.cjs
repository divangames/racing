////////////////////////////////////////////////////////
//
// Финиш заезда: приз, ставка, трофеи.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { enhanceHtml, engineFile } = require('../src/main/enhancements');

/** Песочница финиша. */
function bootFinish() {
  const P = {
    isP: true, finished: true, finishTime: 40, prog: 4, hp: 100, maxhp: 100,
    kills: 0, bestLap: 12, ch: { name: 'МЕДВЕДЬ' }, fieldId: 0
  };
  const ai = { isP: false, finished: true, finishTime: 50, prog: 4, ch: { name: 'БЫК' }, fieldId: 1 };
  const g = {
    console,
    setTimeout: function () {},
    labTest: true,
    state: 'race',
    raceBoard: {},
    P: P,
    PRIZE: [480, 300, 180, 70, 0, 0],
    PRIZE_DIV_GROWTH: .28,
    TRACKDEFS: [{}, {}, {}, {}, {}],
    ACHIEVEMENTS: [
      { id: 'first_win', name: 'ПЕРВАЯ ПОБЕДА' },
      { id: 'perfect', name: 'БЕЗ ЦАРАПИН' },
      { id: 'risky', name: 'РИСКОВЫЙ' }
    ],
    LINES_WIN_1: ['ОК'],
    LINES_WIN_2: ['ОК'],
    LINES_WIN_3: ['ОК'],
    LINES_LOSE: ['ОК'],
    save: {
      cash: 1000, race: 2, car: 0, bet: 0, achievements: {}, tracksWon: {},
      records: {}, tuning: { 0: {} }, carOwned: { 0: true }
    },
    R: {
      time: 40, racers: [P, ai], firstDone: null, div: 1, tIdx: 0,
      betStake: 0, betOdds: null, betPick: 0, betName: '',
      shortcuts: [], countsForCareer: true
    },
    prizeDivMult: function () { return 1; },
    fmtT: function () { return ''; },
    fmtLap: function () { return ''; },
    finishRacer: function () {},
    checkAchievements: function () { return []; },
    showResults: function () {},
    announce: function (t) { g._ann = t; },
    racerTag: function (r) { return r.ch.name; },
    sWin: function () { g._win = true; },
    persist: function () { g._persisted = true; },
    fillAnnouncerQueue: function () { g._queue = true; },
    betPayoutFor: function (stake, odds, place) {
      if (place < 0 || place > 2) return 0;
      return Math.round(stake * (place === 0 ? odds.k1 : 0));
    },
    fmtOdds: function (k) { return '×' + Number(k).toFixed(2); },
    fm: function (n) { return '$' + n; },
    pickLine: function (lines) { return lines[0]; },
    careerAfterResults: function (prev) { g._careerPrev = prev; }
  };
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/race-finish.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает финиш после сетки', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/race-finish.js'));
  assert(out.indexOf('race-field.js') < out.indexOf('race-finish.js'));
  assert(out.indexOf('race-finish.js') < out.indexOf('collision.js'));
  assert(engineFile('__engine/race-finish.js').endsWith('race-finish.js'));
});

test('Время, полигон без кассы, карьера с призом и first_win', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../rnr.html'), 'utf8');
  assert(html.includes('function showResults('));
  assert(html.includes('function prizeDivMult('));
  const g = bootFinish();
  assert.equal(g.DiVANEngine.raceFinish.prizeDivMult(1), 1);
  assert.equal(g.DiVANEngine.raceFinish.prizeDivMult(2), 1.28);
  assert.equal(g.fmtT(65.2), '1:05.2');
  assert.equal(g.fmtLap(0), '—');
  g.finishRacer(g.P);
  assert.equal(g.P.finished, true);
  assert.equal(g.R.firstDone, g.P);
  assert.equal(g._win, true);
  const cash0 = g.save.cash;
  g.showResults();
  assert.equal(g.state, 'results');
  assert.equal(g.save.cash, cash0);
  assert.equal(g.R.prize[0], 0);
  g.labTest = false;
  g.state = 'race';
  g.save.cash = 1000;
  g.save.achievements = {};
  g.R.betStake = 350;
  g.R.betOdds = { k1: 2, k2: 1.1, k3: 0.6 };
  g.R.betPick = 0;
  g.R.betName = 'МЕДВЕДЬ';
  g.R.bet = 2;
  g.showResults();
  assert.equal(g.R.place, 0);
  assert.equal(g.R.prize[0], 480);
  assert.equal(g.R.betPay, 700);
  assert.equal(g.save.cash, 1000 + 480 + 700);
  assert.equal(g.save.achievements.first_win, true);
  assert.equal(g._careerPrev, 2);
});
