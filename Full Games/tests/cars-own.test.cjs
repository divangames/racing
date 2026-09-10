////////////////////////////////////////////////////////
//
// Владение кузовом, этап разблокировки и смена пилота.
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
  'isDev', 'isForeignSignature', 'carIsOwned', 'carUnlocked', 'blankTune', 'allTunes', 'applyCharCar'
];

/** Песочница гаража кузовов. */
function bootOwn() {
  const g = {
    console,
    CHAR_DATIVE: ['Медведю'],
    CHARS: [{ name: 'МЕДВЕДЬ' }, { name: 'ЕРШ' }],
    CARS: [
      { owner: 0, price: 0 },
      { owner: 1, price: 0 },
      { price: 100 },
      { custom: true, price: 1 }
    ],
    CAR_UNLOCK: [{ race: 0 }, { race: 0 }, { race: 5 }, { race: 0 }],
    save: { char: 0, car: 0, race: 2, dev: 0, carOwned: { 2: true } }
  };
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  HOOKS.forEach(function (name) { g[name] = function () { return false; }; });
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/catalog.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/cars-own.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает владение кузовом после ленты', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/cars-own.js'));
  assert(out.indexOf('catalog.js') < out.indexOf('cars-own.js'));
  assert(engineFile('__engine/cars-own.js').endsWith('cars-own.js'));
});

test('Чужой личный, кастом, этап и смена пилота', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../rnr.html'), 'utf8');
  assert(html.includes('function carIsOwned('));
  assert(html.includes('function applyCharCar('));
  const g = bootOwn();
  assert.equal(g.isForeignSignature(1), true);
  assert.equal(g.carIsOwned(1), false);
  assert.equal(g.carIsOwned(0), true);
  assert.equal(g.carIsOwned(2), true);
  assert.equal(g.carUnlocked(3), true);
  assert.equal(g.carUnlocked(2), false);
  g.save.race = 5;
  assert.equal(g.carUnlocked(2), true);
  const tun = g.blankTune();
  assert.equal(tun.wep, 0);
  assert.equal(Object.keys(g.allTunes()).length, 4);
  g.save.carOwned[1] = true;
  g.applyCharCar(0);
  assert.equal(g.save.car, 0);
  assert.equal(g.save.carOwned[1], undefined);
  g.save.dev = 1;
  assert.equal(g.isForeignSignature(1), false);
  assert.equal(g.carIsOwned(1), true);
  g.cheatsAllowed = function () { return false; };
  assert.equal(g.isDev(), false);
  assert.equal(g.isForeignSignature(1), true);
});
