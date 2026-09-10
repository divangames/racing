////////////////////////////////////////////////////////
//
// Сетка ИИ: 1 дивизион — хлам, 3 — хлам и средний класс.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { enhanceHtml, engineFile } = require('../src/main/enhancements');

const HOOKS = ['isStarterCar', 'isMidCar', 'starterFieldOnly', 'midFieldOnly', 'fieldCarClassOk'];

/** Песочница класса кузовов. */
function bootClass() {
  const g = {
    console,
    STARTER_LO: 11,
    STARTER_HI: 15,
    MID_LO: 16,
    MID_HI: 20
  };
  HOOKS.forEach(function (n) { g[n] = function () {}; });
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/race-class.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает race-class до сетки', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/race-class.js'));
  assert(out.indexOf('race-class.js') < out.indexOf('race-field.js'));
  assert(engineFile('__engine/race-class.js').endsWith('race-class.js'));
});

test('Дивизион 1 режет сток, 3 пускает средний, 5 — все', () => {
  const kits = fs.readFileSync(path.resolve(__dirname, '../../mid-kits.js'), 'utf8');
  assert(kits.includes('function fieldCarClassOk('));
  const g = bootClass();
  assert.equal(g.fieldCarClassOk(12, 1), true);
  assert.equal(g.fieldCarClassOk(0, 1), false);
  assert.equal(g.fieldCarClassOk(16, 1), false);
  assert.equal(g.fieldCarClassOk(16, 3), true);
  assert.equal(g.fieldCarClassOk(12, 3), true);
  assert.equal(g.fieldCarClassOk(0, 3), false);
  assert.equal(g.fieldCarClassOk(0, 5), true);
});
