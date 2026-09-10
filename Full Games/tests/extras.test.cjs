////////////////////////////////////////////////////////
//
// Трофеи, читы, плитки трасс и попадание клика.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { enhanceHtml, engineFile } = require('../src/main/enhancements');

/** Песочница extras + pointer. */
function bootExtras() {
  const g = {
    console,
    pauseRaceItems: function () { return []; },
    pauseGarageItems: function () { return []; },
    trackTileRect: function () {},
    drawTrackOutline: function () {},
    drawAchievementMedal: function () {},
    drawAchievementIcon: function () {},
    drawAchievementTile: function () {},
    drawAchievements: function () {},
    drawCheats: function () {},
    drawTrackPick: function () {},
    hubClick: function () { g.hubHits = (g.hubHits || 0) + 1; }
  };
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/extras.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/pointer.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает extras и pointer до кадра', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/extras.js'));
  assert(out.includes('/__engine/pointer.js'));
  assert(out.indexOf('prerace.js') < out.indexOf('extras.js'));
  assert(out.indexOf('extras.js') < out.indexOf('pointer.js'));
  assert(out.indexOf('pointer.js') < out.indexOf('loop.js'));
  assert(engineFile('__engine/pointer.js').endsWith('pointer.js'));
});

test('Сетка трофеев, чит-ячейки, плитка трассы и хитбокс', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../rnr.html'), 'utf8');
  assert(html.includes('function hubClick('));
  const g = bootExtras();
  const grid = g.DiVANEngine.extras.trophyGrid(1280, 720, 9, 3);
  assert.equal(grid.tw, 397);
  assert.equal(grid.th, 196);
  assert.equal(g.DiVANEngine.extras.cheatSlotX0(1280, 7, 64, 12), 380);
  const tile = g.DiVANEngine.extras.trackTileRectAt(0, 5, 1280);
  assert.equal(tile.w, 360);
  assert.equal(tile.x, 80);
  const ptr = g.DiVANEngine.pointer;
  assert.equal(ptr.hitRect(10, 10, { x: 0, y: 0, w: 20, h: 20 }), true);
  assert.equal(ptr.hitRect(0, 10, { x: 0, y: 0, w: 20, h: 20 }), false);
  assert.equal(ptr.hitTitleItem(640, 320, 0, { y0: 320, step: 32, pad: 14, mid: 640, halfW: 200 }), true);
  assert.equal(ptr.hitTitleItem(80, 320, 0, { y0: 320, step: 32, pad: 14, left: 44, width: 340 }), true);
  assert.equal(ptr.hitTitleItem(640, 320, 0, { y0: 320, step: 32, pad: 14, left: 44, width: 340 }), false);
});
