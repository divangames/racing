////////////////////////////////////////////////////////
//
// Дождь титула: капли и гейт эмбиента без canvas.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { enhanceHtml, engineFile } = require('../src/main/enhancements');

/** Песочница title-fx. */
function bootFx() {
  const g = {
    console,
    state: 'title',
    W: 1280,
    H: 720,
    settings: { sound: { sfxOn: true, sfx: 80 }, graphics: { particles: 'high' } },
    matchMedia: function () { return { matches: false }; },
    clamp: function (v, a, b) { return v < a ? a : v > b ? b : v; },
    g: {
      save: function () {},
      restore: function () {},
      translate: function () {},
      rotate: function () {},
      fillRect: function () { g.rects = (g.rects || 0) + 1; },
      beginPath: function () {},
      ellipse: function () {},
      stroke: function () { g.strokes = (g.strokes || 0) + 1; }
    },
    applyAudioSettings: function () {},
    bootEnqueueFetch: function (urls) { g.queued = urls; }
  };
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/title-fx.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает title-fx после screens', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/title-fx.js'));
  assert(out.indexOf('screens.js') < out.indexOf('title-fx.js'));
  assert(out.indexOf('title-fx.js') < out.indexOf('loop.js'));
  assert(engineFile('__engine/title-fx.js').endsWith('title-fx.js'));
});

test('На титуле капли есть, в гонке слой пустой', () => {
  const g = bootFx();
  assert.equal(g.queued[0], 'assets/sounds/embirnt/rain.mp3');
  g.tickTitleFx(0.016);
  g.drawTitleRain();
  assert.ok((g.rects || 0) > 10);
  g.state = 'race';
  g.tickTitleFx(0.016);
  g.rects = 0;
  g.drawTitleRain();
  assert.equal(g.rects || 0, 0);
});
