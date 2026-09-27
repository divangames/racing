////////////////////////////////////////////////////////
//
// Сетка гонщиков и потолок прокачки без окна хаба.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { enhanceHtml, engineFile } = require('../src/main/enhancements');

/** Песочница runtime + roster + training. */
function bootRoster() {
  const g = {
    console,
    drawCharSel: function () {},
    drawBio: function () {},
    drawGym: function () {},
    drawArmCard: function () {},
    drawArmory: function () {}
  };
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/roster.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/training.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает roster и training до кадра', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/roster.js'));
  assert(out.includes('/__engine/training.js'));
  assert(out.indexOf('carousel.js') < out.indexOf('roster.js'));
  assert(out.indexOf('roster.js') < out.indexOf('training.js'));
  assert(out.indexOf('training.js') < out.indexOf('loop.js'));
  assert(engineFile('__engine/roster.js').endsWith('roster.js'));
});

test('Карточки пилотов и потолок стата до пяти', () => {
  const g = bootRoster();
  const lay = g.DiVANEngine.roster.charCardLayout(1280, 7, 18);
  assert.equal(lay.cardsInView, 4.5);
  assert(Math.abs(lay.cw * 4.5 + 18 * 4 - lay.clipW) < 1e-9);
  assert.equal(lay.pitch, lay.cw + 18);
  assert.equal(g.DiVANEngine.roster.charWrapDelta(0, 6, 7), -1);
  assert.equal(g.DiVANEngine.roster.charWrapDelta(6, 0, 7), 1);
  assert.equal(g.DiVANEngine.training.GYM_KEYS.join(','), 'spd,crn,grt');
  assert.equal(g.DiVANEngine.training.gymMaxAdd(2), 3);
  assert.equal(g.DiVANEngine.training.gymMaxAdd(5), 0);
});
