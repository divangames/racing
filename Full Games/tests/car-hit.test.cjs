////////////////////////////////////////////////////////
//
// Полуоси хитбокса: Урал, мятость, запас 27×16.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { enhanceHtml, engineFile } = require('../src/main/enhancements');

const HOOKS = ['carBodyScale', 'racerArmLvl', 'racerWoundLvl', 'carHitHalf'];

/** Песочница рамки кузова. */
function bootHit() {
  const g = {
    console,
    clamp: function (n, a, b) { return n < a ? a : n > b ? b : n; },
    CAR_HIT_CACHE: {},
    save: { tuning: { 0: { arm: 2 } } },
    editorCarConfig: function () { return null; },
    carSprite: function () { return null; },
    kitHitScale: function () { return 1; }
  };
  HOOKS.forEach(function (n) { g[n] = function () {}; });
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/car-hit.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает car-hit до SAT рамок', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/car-hit.js'));
  assert(out.indexOf('car-hit.js') < out.indexOf('collision.js'));
  assert(engineFile('__engine/car-hit.js').endsWith('car-hit.js'));
});

test('Урал крупнее, раненый слой, запас полуосей', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../rnr.html'), 'utf8');
  assert(html.includes('function carHitHalf('));
  const g = bootHit();
  assert.equal(g.carBodyScale(6), 1.65);
  assert.equal(g.carBodyScale(0), 1);
  assert.equal(g.racerArmLvl({ car: { idx: 0 }, lvl: {} }), 2);
  assert.equal(g.racerWoundLvl({ hp: 100, maxhp: 100 }), 0);
  assert.equal(g.racerWoundLvl({ hp: 40, maxhp: 100 }), 4);
  const h = g.carHitHalf({ car: { idx: 0 }, lvl: { arm: 0 } });
  assert.equal(h.hw, 27);
  assert.equal(h.hh, 16);
});
