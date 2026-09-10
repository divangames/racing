////////////////////////////////////////////////////////
//
// Слоты сейва и клавиатура хаба DiVANEngine.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { enhanceHtml, engineFile } = require('../src/main/enhancements');

/** Песочница слотов и press. */
function bootPress() {
  const g = {
    console,
    drawHelp: function () {},
    drawSlotSelect: function () {},
    press: function () { g.pressHits = (g.pressHits || 0) + 1; }
  };
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/slots.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/press-nav.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/press.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает слоты и press до кадра', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/slots.js'));
  assert(out.includes('/__engine/press-nav.js'));
  assert(out.includes('/__engine/press.js'));
  assert(out.indexOf('pointer.js') < out.indexOf('slots.js'));
  assert(out.indexOf('slots.js') < out.indexOf('press-nav.js'));
  assert(out.indexOf('press-nav.js') < out.indexOf('press.js'));
  assert(out.indexOf('press.js') < out.indexOf('loop.js'));
  assert(engineFile('__engine/press.js').endsWith('press.js'));
});

test('Сетка слотов, шаг курсора и хук press', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../rnr.html'), 'utf8');
  assert(html.includes('function press('));
  assert(html.includes('function drawSlotSelect('));
  assert(html.includes('function drawHelp('));
  const g = bootPress();
  const lay = g.DiVANEngine.slots.slotGrid(1280);
  assert.equal(lay.startX, 50);
  assert.equal(lay.slotW, 220);
  const r0 = g.DiVANEngine.slots.slotRectAt(0, 1280);
  assert.equal(r0.x, 50);
  assert.equal(r0.y, 140);
  const step = g.DiVANEngine.slots.slotStep;
  assert.equal(step(0, 'ArrowLeft'), 9);
  assert.equal(step(9, 'ArrowRight'), 0);
  assert.equal(step(0, 'ArrowDown'), 5);
  assert.equal(typeof g.DiVANEngine.pressNav.early, 'function');
  assert.equal(g.press.name, 'pressEngine');
});
