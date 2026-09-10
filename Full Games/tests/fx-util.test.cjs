////////////////////////////////////////////////////////
//
// Доля частиц и потолок тряски.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { enhanceHtml, engineFile } = require('../src/main/enhancements');

test('Заезд подключает долю частиц после холста', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/fx-util.js'));
  assert(out.indexOf('gfx.js') < out.indexOf('fx-util.js'));
  assert(engineFile('__engine/fx-util.js').endsWith('fx-util.js'));
});

test('Low режет искры, shake копит до 14', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../rnr.html'), 'utf8');
  assert(html.includes('function partN('));
  assert(html.includes('function doShake('));
  const g = {
    console,
    settings: { graphics: { particles: 'low', shake: true } },
    R: { shake: 12 },
    partN: function (n) { return n; },
    doShake: function () {}
  };
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/fx-util.js'), 'utf8'), g);
  assert.equal(g.partN(10), 4);
  g.settings.graphics.particles = 'high';
  assert.equal(g.partN(10), 10);
  g.doShake(8);
  assert.equal(g.R.shake, 14);
  g.settings.graphics.shake = false;
  g.R.shake = 0;
  g.doShake(8);
  assert.equal(g.R.shake, 0);
});
