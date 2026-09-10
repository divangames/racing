////////////////////////////////////////////////////////
//
// Сетка ИИ, кэфы и касса ставки.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { enhanceHtml, engineFile } = require('../src/main/enhancements');

/** Песочница сетки. */
function bootField() {
  const fillers = [{ name: 'А' }, { name: 'Б' }, { name: 'В' }];
  const g = {
    console,
    clamp: function (n, a, b) { return n < a ? a : n > b ? b : n; },
    BULL_IDX: 4,
    FIELD_AI: 3,
    AIDRV: fillers,
    BET_PLACE_MUL: [1, .55, .3],
    BET_TABLE: [{ cost: 0 }, { cost: 350 }, { cost: 900 }],
    TRACKDEFS: [{}, {}, {}, {}, {}],
    raceDiv: 0,
    save: {
      char: 0, car: 0, race: 0, cash: 400, bet: 2,
      tuning: { 0: { arm: 0, eng: 0, tir: 0, shk: 0, nit: 0 } }
    },
    CHARS: [
      { name: 'МЕДВЕДЬ' }, { name: '2' }, { name: '3' }, { name: '4' },
      { name: 'БЫК', col: '#fc0' }
    ],
    CARS: [
      { idx: 0 }, { idx: 1 }, { idx: 2 }, { idx: 3 }, { idx: 4, owner: 0 }
    ],
    fieldCarClassOk: function () { return true; },
    blankTune: function () { return { arm: 0, eng: 0, tir: 0, shk: 0, nit: 0, wep: 0, ult: 0 }; },
    stats: function (ch) {
      if (ch && ch.strong) return { top: 220, acc: 40, maxhp: 180 };
      return { top: 40, acc: 8, maxhp: 40 };
    },
    persist: function () { g._persisted = true; },
    sClick: function () { g._click = true; },
    sHit: function () { g._hit = true; },
    aiBossTune: function () { return {}; },
    aiFillerTune: function () { return {}; },
    aiSkillLvl: function () { return 1; },
    aiDriveSkill: function () { return .5; },
    aiPerfScale: function () { return { hp: 1, spd: 1, acc: 1 }; },
    shuffleCopy: function (a) { return a.slice(); },
    specPower: function () { return 0; },
    computeFieldOdds: function () { return []; },
    fieldFreeCars: function () { return []; },
    planRaceField: function () { return []; },
    makeRaceBoard: function () { return {}; },
    betAffordMax: function () { return 0; },
    clampBetAfford: function () {},
    cycleBet: function () {},
    betPayoutFor: function () { return 0; }
  };
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/race-ai.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/race-field.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает ИИ и сетку после сборки', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/race-ai.js'));
  assert(out.includes('/__engine/race-field.js'));
  assert(out.indexOf('race-build.js') < out.indexOf('race-ai.js'));
  assert(out.indexOf('race-ai.js') < out.indexOf('race-field.js'));
  assert(out.indexOf('race-field.js') < out.indexOf('collision.js'));
  assert(engineFile('__engine/race-field.js').endsWith('race-field.js'));
});

test('Тюнинг ИИ, фаворит дешевле, Бык-босс и касса ставки', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../rnr.html'), 'utf8');
  assert(html.includes('function planRaceField('));
  assert(html.includes('function computeFieldOdds('));
  const g = bootField();
  assert.equal(g.aiBossTune(1).arm, 0);
  assert.equal(g.aiBossTune(6).arm, 5);
  assert.equal(g.aiFillerTune(4).nit, 0);
  assert.equal(g.aiSkillLvl(1), 1);
  assert.equal(g.aiSkillLvl(11), 4);
  assert.equal(g.aiPerfScale(1).hp, 0.78);
  assert.equal(g.aiPerfScale(6).hp, 0.96);
  assert.equal(g.aiPerfScale(6).spd, 1);
  const sh = g.shuffleCopy([1, 2, 3, 4]);
  assert.equal(sh.length, 4);
  assert.deepEqual(sh.slice().sort(), [1, 2, 3, 4]);
  const odds = g.computeFieldOdds([
    { ch: { strong: true }, car: {}, lvl: {}, skill: 1.1, isP: true, isBoss: false },
    { ch: {}, car: {}, lvl: {}, skill: .5, isP: false, isBoss: false }
  ], 1);
  assert(odds[0].k1 < odds[1].k1);
  assert.equal(g.betPayoutFor(100, { k1: 2, k2: 1.1, k3: 0.6 }, 0), 200);
  assert.equal(g.betAffordMax(), 1);
  g.clampBetAfford();
  assert.equal(g.save.bet, 1);
  const board = g.makeRaceBoard();
  assert.equal(board.specs.length, 5);
  assert.equal(board.specs.filter(function (s) { return s.isP; }).length, 1);
  assert.equal(board.specs.filter(function (s) { return s.isBoss; }).length, 1);
  assert.equal(board.specs.find(function (s) { return s.isBoss; }).ch.name, 'БЫК');
  assert.equal(board.pick, 0);
});

test('1 дивизион — только хлам 12–16, 3 — ещё средний 17–21', () => {
  const g = bootField();
  g.CARS = Array.from({ length: 21 }, function (_, i) {
    return { idx: i, owner: null };
  });
  g.save.car = 0;
  g.save.char = 0;
  g.save.race = 0;
  g.STARTER_LO = 11;
  g.STARTER_HI = 15;
  g.MID_LO = 16;
  g.MID_HI = 20;
  ['isStarterCar', 'isMidCar', 'starterFieldOnly', 'midFieldOnly', 'fieldCarClassOk'].forEach(function (n) {
    g[n] = function () {};
  });
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/race-class.js'), 'utf8'), g);
  const d1 = g.fieldFreeCars();
  assert.ok(d1.length > 0);
  assert.ok(d1.every(function (i) { return i >= 11 && i <= 15; }));
  assert.equal(d1.includes(0), false);
  assert.equal(d1.includes(1), false);
  const ai1 = g.planRaceField(1).filter(function (s) { return !s.isP; }).map(function (s) { return s.car.idx; });
  assert.ok(ai1.every(function (i) { return i >= 11 && i <= 15; }));
  g.save.race = g.TRACKDEFS.length * 2;
  const d3 = g.fieldFreeCars();
  assert.ok(d3.every(function (i) { return i >= 11 && i <= 20; }));
  assert.ok(d3.some(function (i) { return i >= 16; }));
  const ai3 = g.planRaceField(3).filter(function (s) { return !s.isP; }).map(function (s) { return s.car.idx; });
  assert.ok(ai3.every(function (i) { return i >= 11 && i <= 20; }));
});
