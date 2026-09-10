////////////////////////////////////////////////////////
//
// Автопарк, ставка и сдвиг ленты кузовов.
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
  'charDative', 'charCarIdx', 'carOwnerIdx', 'carCatalogOrder', 'carCatalogPos', 'carCatalogAt',
  'pickCarSel', 'nudgeCarSel', 'pickParkSel', 'nudgeParkSel', 'enterAutopark', 'enterPreRace', 'confirmPreRace'
];

/** Песочница входов хаба. */
function bootNav() {
  const g = {
    console,
    CARS: [{ price: 100 }, { price: 200 }, { price: 50, owner: 0 }],
    CHAR_DATIVE: [],
    CHARS: [],
    save: { car: 2, cash: 400, bet: 1, char: 0, race: 0 },
    BET_TABLE: [{ cost: 0 }, { cost: 350 }],
    gt: 12,
    selCar: 0,
    carConfirmed: true,
    carSelDriveT: 0,
    autoparkSel: 0,
    parkDriveT: 0,
    parkScroll: 0,
    autodetailOpen: true,
    state: 'garage',
    raceBoard: null,
    garMsg: '',
    garMsgT: 0,
    sClick: function () { g._click = true; },
    sHit: function () { g._hit = true; },
    persist: function () { g._persisted = true; },
    clampBetAfford: function () { g._clamped = true; },
    makeRaceBoard: function () { return { ok: true }; },
    buildRace: function () { g._race = true; }
  };
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  HOOKS.forEach(function (name) { g[name] = function () {}; });
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/catalog.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/hub-nav.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает навигацию хаба после ставки', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/hub-nav.js'));
  assert(out.indexOf('prerace.js') < out.indexOf('hub-nav.js'));
  assert(engineFile('__engine/hub-nav.js').endsWith('hub-nav.js'));
});

test('Лента, автопарк, ставка и списание кассы', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../rnr.html'), 'utf8');
  assert(html.includes('function enterPreRace('));
  assert(html.includes('function enterAutopark('));
  const g = bootNav();
  g.pickCarSel(1);
  assert.equal(g.selCar, 1);
  assert.equal(g.carConfirmed, false);
  g.nudgeCarSel(1);
  assert.equal(g.selCar, 2);
  g.enterAutopark();
  assert.equal(g.state, 'autopark');
  assert.equal(g.autoparkSel, 2);
  assert.equal(g.autodetailOpen, false);
  g.enterPreRace();
  assert.equal(g.state, 'prerace');
  assert.equal(g.raceBoard.ok, true);
  g.raceBoard = { stale: true };
  g.save.car = 1;
  g.enterPreRace();
  assert.equal(g.raceBoard.ok, true);
  assert.equal(g.raceBoard.stale, undefined);
  g.confirmPreRace();
  assert.equal(g.save.cash, 50);
  assert.equal(g._race, true);
  g.save.cash = 10;
  g._race = false;
  g.confirmPreRace();
  assert.equal(g._hit, true);
  assert.equal(g._race, false);
});
