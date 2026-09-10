////////////////////////////////////////////////////////
//
// Угол, дуга сплайна и сид мульберри.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { enhanceHtml, engineFile } = require('../src/main/enhancements');

/** Песочница примитивов угла. */
function bootMath() {
  const g = {
    console,
    TAU: Math.PI * 2,
    angDiff: function () { return 0; },
    wrapBetween: function () { return false; },
    mulberry: function () { return function () { return 0; }; }
  };
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/math.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает math сразу после runtime', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/math.js'));
  assert(out.indexOf('runtime.js') < out.indexOf('math.js'));
  assert(out.indexOf('math.js') < out.indexOf('storage.js'));
  assert(engineFile('__engine/math.js').endsWith('math.js'));
});

test('angDiff кратчайший, wrap через ноль, mulberry стабилен', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../rnr.html'), 'utf8');
  assert(html.includes('function angDiff('));
  assert(html.includes('function wrapBetween('));
  assert(html.includes('function mulberry('));
  const g = bootMath();
  assert.ok(Math.abs(g.angDiff(0, 0.1) + 0.1) < 1e-12);
  assert.ok(g.wrapBetween(0.05, 0.9, 0.2));
  assert.equal(g.wrapBetween(0.5, 0.9, 0.2), false);
  assert.equal(g.wrapBetween(0.5, 0.2, 0.8), true);
  const a = g.mulberry(1)();
  const b = g.mulberry(1)();
  assert.equal(a, b);
  assert.ok(a >= 0 && a < 1);
});
