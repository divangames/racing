////////////////////////////////////////////////////////
//
// Лента авто и статы кузова без каталога CARS из HTML.
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
  'charDative', 'charCarIdx', 'carOwnerIdx', 'carCatalogOrder', 'carCatalogPos', 'carCatalogAt', 'stats'
];

/** Песочница ленты и статов. */
function bootCatalog() {
  const medved = { name: 'МЕДВЕДЬ', spd: 3, crn: 3, grt: 3 };
  const yanot = { name: 'ЯНОТ', spd: 3, crn: 3, grt: 3 };
  const g = {
    console,
    clamp: function (n, a, b) { return n < a ? a : n > b ? b : n; },
    CHAR_DATIVE: ['Медведю', 'Ершу', 'Бегемотику', 'Башкиру', 'Борису Быку', 'Янот'],
    CHARS: [medved, {}, {}, {}, {}, yanot],
    CARS: [
      { price: 500, owner: null },
      { price: 100, owner: null },
      { price: 0, owner: 1 },
      { price: 0, owner: 0 }
    ],
    save: { char: 0, race: 0, cstats: { 0: { spd: 1, crn: 0, grt: 0 } } },
    aiPerfScale: function () { return { hp: 0.78, spd: 0.9, acc: 0.88 }; },
    kitStarterOff: function (car, off) { return off; }
  };
  g.medved = medved;
  g.yanot = yanot;
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  HOOKS.forEach(function (name) { g[name] = function () { return name === 'stats' ? {} : 0; }; });
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/catalog.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/stats.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает ленту и статы до трассы', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/catalog.js'));
  assert(out.includes('/__engine/stats.js'));
  assert(out.indexOf('skills.js') < out.indexOf('catalog.js'));
  assert(out.indexOf('catalog.js') < out.indexOf('stats.js'));
  assert(out.indexOf('stats.js') < out.indexOf('race-build.js'));
  assert(engineFile('__engine/catalog.js').endsWith('catalog.js'));
});

test('Магазин по цене, личные по хозяину, ХП Медведя и гандикап', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../rnr.html'), 'utf8');
  assert(html.includes('function carCatalogOrder('));
  assert(html.includes('function stats('));
  const g = bootCatalog();
  assert.equal(g.charDative(0), 'Медведю');
  assert.equal(g.charCarIdx(0), 3);
  assert.equal(g.carOwnerIdx(1), null);
  const order = g.carCatalogOrder();
  assert.equal(order[0], 1);
  assert.equal(order[1], 0);
  assert.equal(order[2], 3);
  assert.equal(order.length, 3);
  assert.equal(order.indexOf(2), -1);
  assert.equal(g.carCatalogPos(0), 1);
  assert.equal(g.carCatalogAt(-1), 3);
  const st = g.stats(g.medved, { idx: 0, hp: 100, top: 1, acc: 1, crn: 1 }, { arm: 0, eng: 0, tir: 0, shk: 0 }, undefined, 0);
  assert.equal(st.maxhp, 134);
  assert(st.off > 0.5 && st.off < 0.7);
  const ai = g.stats(g.medved, { idx: 0, hp: 100, top: 1, acc: 1, crn: 1 }, { arm: 0, eng: 0, tir: 0, shk: 0 }, { spd: 0, crn: 0, grt: 0 }, 1);
  assert.equal(ai.maxhp, 105);
  const devil = g.stats(g.medved, { idx: 3, hp: 80, top: 1, acc: 1, crn: 1 }, { arm: 0, eng: 0, tir: 2, shk: 0 }, { spd: 0, crn: 0, grt: 0 }, 0);
  assert.equal(devil.off, 1);
  const yn = g.stats(g.yanot, { idx: 5, hp: 80, top: 1, acc: 1, crn: 1 }, { arm: 0, eng: 0, tir: 0, shk: 0 }, { spd: 0, crn: 0, grt: 0 }, 0);
  const plain = g.stats(g.medved, { idx: 5, hp: 80, top: 1, acc: 1, crn: 1 }, { arm: 0, eng: 0, tir: 0, shk: 0 }, { spd: 0, crn: 0, grt: 0 }, 0);
  assert(yn.grip < plain.grip);
});

test('Чужие личные спрятаны, дальние закрытые тоже, ближайшая волна видна', () => {
  const g = bootCatalog();
  g.CARS = [
    { price: 100, owner: null },
    { price: 200, owner: null },
    { price: 0, owner: 1 },
    { price: 0, owner: 0 },
    { price: 400, owner: null }
  ];
  g.CAR_UNLOCK = [{ race: 0 }, { race: 2 }, { race: 0 }, { race: 0 }, { race: 9 }];
  g.save.char = 0;
  g.save.race = 0;
  assert.equal(g.carCatalogOrder().join(), '0,1,3');
  g.save.race = 2;
  assert.equal(g.carCatalogOrder().join(), '0,1,4,3');
  g.isDev = function () { return true; };
  assert.equal(g.carCatalogOrder().length, 5);
});
