////////////////////////////////////////////////////////
//
// Серия побед и реванш без сдвига календаря.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { enhanceHtml, engineFile } = require('../src/main/enhancements');

const HOOKS = [
  'careerTrackIdx', 'careerPatchSave', 'careerVisitedIdx', 'careerPlaceWord',
  'careerMakeBrief', 'careerAfterResults', 'careerOpenFromResults', 'careerDo', 'careerEnterTrackPick'
];

/** Песочница экономики карьеры. */
function bootEcon() {
  const g = {
    console,
    CAREER_STREAK_PAY: { 3: 420, 5: 900, 8: 1600 },
    CAREER_PACK: 3,
    CAREER_PACK_PAY: 360,
    CAREER_PICK_WINS: 5,
    TRACKDEFS: [{ name: 'А' }, { name: 'Б' }, { name: 'В' }],
    DIVN: ['I', 'II', 'III', 'IV'],
    CAR_UNLOCK: [],
    CARS: [],
    labTest: false,
    raceTrackOverride: null,
    raceBoard: null,
    gt: 10,
    state: 'results',
    careerPickSel: 0,
    careerPickList: [],
    save: { race: 2, cash: 1000, winStreak: 2, bestStreak: 2, careerWins: 2 },
    R: {
      place: 0, div: 1, prize: [200, 100, 50], betStake: 0, countsForCareer: true,
      tIdx: 1, T: { name: 'А' }, career: null
    },
    prizeDivMult: function () { return 1; },
    persist: function () { g._persisted = true; },
    fm: function (n) { return String(n); },
    carOwnerIdx: function () { return null; },
    sClick: function () { g._click = true; },
    exitLabTest: function () { g._lab = true; }
  };
  HOOKS.forEach(function (n) { g[n] = function () {}; });
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/career-econ.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает career-econ до отрисовки карьеры', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/career-econ.js'));
  assert(out.indexOf('career-econ.js') < out.indexOf('career-ui.js'));
  assert(engineFile('__engine/career-econ.js').endsWith('career-econ.js'));
});

test('Третья победа даёт бонус серии, реванш не двигает этап', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../content/career.js'), 'utf8');
  assert(src.includes('function careerAfterResults('));
  const g = bootEcon();
  g.careerAfterResults(2, []);
  assert.equal(g.save.winStreak, 3);
  assert.equal(g.save.cash, 1780);
  assert.equal(g.save.race, 3);
  assert.equal(g._persisted, true);
  assert.equal(g.R.career.news[0].title, '1 МЕСТО');
  g.R.countsForCareer = false;
  g.R.place = 1;
  const race = g.save.race;
  g.careerAfterResults(3, []);
  assert.equal(g.save.race, race);
  assert.equal(g.save.winStreak, 0);
  g.careerDo('rematch');
  assert.equal(g.raceTrackOverride, 1);
  assert.equal(g.state, 'garage');
});

test('Сход оставляет этап доступным для повтора', () => {
  const g = bootEcon();
  g.R.dnf = true;
  g.R.place = 1;
  g.R.prize = [200, 0, 50];
  g.careerAfterResults(2, []);
  assert.equal(g.save.race, 2);
  assert.equal(g.save.winStreak, 0);
  assert.equal(g.R.career.news[0].title, 'СХОД');
});

test('Финиш вне подиума даёт небольшой бюджет, подиум остаётся выгоднее', () => {
  [3, 4, 5].forEach(function (place) {
    const g = bootEcon();
    g.P = { finished: true };
    g.save.race = 0;
    g.R.place = place;
    g.R.prize = [480, 300, 180, 70, 0, 0];
    const paidForPlace = g.R.prize[place];
    g.careerAfterResults(0, []);
    const total = paidForPlace + g.R.finishSupportPay;
    assert.equal(total, [120, 96, 72][place - 3]);
    assert(total < g.R.prize[2]);
    assert.equal(g.save.cash, 1000 + g.R.finishSupportPay);
    assert(g.R.career.news.some(function (n) { return n.kind === 'finish'; }));
  });
});

test('Бонус дохода учитывается один раз; реванш, сход и незаконченный заезд не дают поддержки', () => {
  const g = bootEcon();
  g.P = { finished: true };
  g.save.race = 0;
  g.R.place = 3;
  g.R.prize = [480, 300, 180, 77, 0, 0];
  g.incomePayout = function (n) { return Math.round(n * 1.1); };
  g.careerAfterResults(0, []);
  assert.equal(g.R.finishSupportPay, 55);
  const cash = g.save.cash;
  g.careerAfterResults(1, []);
  assert.equal(g.save.cash, cash, 'один результат не даёт повторной поддержки');
  [function () { g.R.countsForCareer = false; }, function () { g.R.dnf = true; }, function () { g.P.finished = false; }].forEach(function (setup) {
    g.R.countsForCareer = true;
    g.R.dnf = false;
    g.P.finished = true;
    setup();
    assert.equal(g.DiVANEngine.careerEcon.finishSupportPay(), 0);
  });
});

test('Сход с первым местом не считается победой, лаборатория не меняет карьеру', () => {
  const g = bootEcon();
  g.R.dnf = true;
  g.careerAfterResults(2, []);
  assert.equal(g.save.careerWins, 2);
  assert.equal(g.save.winStreak, 0);
  assert.equal(g.save.cash, 1000);
  assert.equal(g.save.race, 2);
  g.labTest = true;
  g.R.dnf = false;
  const before = JSON.stringify(g.save);
  g.careerAfterResults(2, []);
  assert.equal(JSON.stringify(g.save), before);
});
