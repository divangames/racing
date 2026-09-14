////////////////////////////////////////////////////////
//
// Пластина титула: аспект, плотность, якорь cover.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');
const vm = require('node:vm');
const { enhanceHtml, engineFile } = require('../src/main/enhancements');

/** Песочница title-bg. */
function bootBg() {
  const g = {
    console,
    W: 1280,
    H: 720,
    viewW: 1280,
    viewH: 720,
    gt: 0,
    settings: { graphics: { particles: 'high' } },
    matchMedia: function () { return { matches: false }; }
  };
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/title-bg.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает title-bg до screens', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/title-bg.js'));
  assert(out.indexOf('title-bg.js') < out.indexOf('screens.js'));
  assert(engineFile('__engine/title-bg.js').endsWith('title-bg.js'));
});

test('Выбор кадра и якорь cover', () => {
  const g = bootBg();
  const api = g.DiVANEngine.titleBg;
  assert.ok(api.pickTitleBgSrc(16 / 9).indexOf('1920x1080') >= 0);
  assert.ok(api.pickTitleBgSrc(3440 / 1440, 3440, 1440).indexOf('3440x1440') >= 0);
  const d = api.coverDest(1920, 1080, 0, 0, 1280, 720, 0.64, 0.46, 1);
  assert.equal(d.dw, 1280);
  assert.equal(d.dh, 720);
  assert.equal(d.ox, 0);
  const crop = api.coverDest(1920, 1080, 0, 0, 1720, 720, 0.64, 0.46, 1);
  assert.ok(crop.dh > 720);
  assert.ok(crop.oy <= 0);
});
