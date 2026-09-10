////////////////////////////////////////////////////////
//
// Миникарта HUD и кольцо карусели без окна заезда.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { enhanceHtml, engineFile } = require('../src/main/enhancements');

/** Песочница runtime + hud + carousel. */
function bootHud() {
  const g = {
    console,
    hudMapXY: function () {},
    drawHudMinimap: function () {},
    drawMinimapVhs: function () {},
    drawHUD: function () {},
    carSelWrapDelta: function () {},
    drawCarCarousel: function () {}
  };
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/hud.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/carousel.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает hud и carousel до кадра', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/hud.js'));
  assert(out.includes('/__engine/carousel.js'));
  assert(out.indexOf('arena.js') < out.indexOf('hud.js'));
  assert(out.indexOf('hud.js') < out.indexOf('carousel.js'));
  assert(out.indexOf('carousel.js') < out.indexOf('loop.js'));
  assert(out.indexOf('carousel.js') < out.indexOf('presentation.js'));
  assert(engineFile('__engine/hud.js').endsWith('hud.js'));
});

test('Проекция карты и кратчайший сдвиг карусели', () => {
  const g = bootHud();
  const view = g.DiVANEngine.hud.minimapView({ mw: 100, mh: 50 }, 0, 0, 200, 140, 36);
  assert.ok(view.sc > 0);
  assert.ok(view.mox > 0 && view.moy > 0);
  const xy = g.DiVANEngine.hud.project(10, 20, { mnx: 0, mny: 0, ms: 2 }, 5, 7, 0.5);
  assert.equal(xy[0], 5 + 10 * 2 * 0.5);
  assert.equal(xy[1], 7 + 20 * 2 * 0.5);
  const car = g.DiVANEngine.carousel;
  assert.equal(car.wrapDelta(0, 5, 6), -1);
  assert.equal(car.wrapDelta(5, 0, 6), 1);
  const vis = car.visibleCards(0, 8, 1.65);
  assert.ok(vis.length < 8);
  assert.ok(vis.some(function (it) { return it.pos === 0 && it.d === 0; }));
});
