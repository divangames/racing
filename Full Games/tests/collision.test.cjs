////////////////////////////////////////////////////////
//
// SAT рамок DiVANEngine без окна заезда.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { enhanceHtml, engineFile } = require('../src/main/enhancements');

/** Грузит runtime + collision в песочнице с заглушками хуков. */
function bootCollision() {
  const g = {
    console,
    carHitHalf() { return { hw: 10, hh: 6 }; },
    editorCarConfig() { return { body: { x: 0, y: 0 } }; }
  };
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, version: '0.2.2.6', runtime: 'html-legacy', host: 'game' };
  g.pointInObb = function () { return false; };
  g.obbOverlap = function () { return null; };
  g.carObb = function () { return null; };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/collision.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает collision и world', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/collision.js'));
  assert(out.includes('/__engine/world.js'));
  assert(out.indexOf('collision.js') < out.indexOf('world.js'));
  assert(engineFile('__engine/collision.js').endsWith('collision.js'));
  assert(engineFile('__engine/world.js').endsWith('world.js'));
});

test('Рамки: пересечение, разведение и точка внутри', () => {
  const g = bootCollision();
  const C = g.DiVANEngine.collision;
  const a = C.aabb(0, 0, 10, 10);
  const b = C.aabb(8, 0, 10, 10);
  const miss = C.aabb(80, 0, 10, 10);
  const hit = C.obbOverlap(a, b);
  assert(hit && hit.pen > 0);
  assert.equal(C.obbOverlap(a, miss), null);
  assert.equal(C.pointInObb(0, 0, a), true);
  assert.equal(C.pointInObb(50, 0, a), false);
  const car = C.carObb({ x: 0, y: 0, ang: 0, car: { idx: 1 } });
  assert.equal(car.hw, 10);
  assert.equal(g.obbOverlap, C.obbOverlap);
});
