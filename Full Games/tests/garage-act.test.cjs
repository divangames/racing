////////////////////////////////////////////////////////
//
// Действие гаража и модалки предупреждений.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { enhanceHtml, engineFile } = require('../src/main/enhancements');

/** Песочница действия гаража и диалогов. */
function bootGarage() {
  const g = {
    console,
    garageAction: function () {},
    drawLabWarn: function () {},
    clickLabWarn: function () {},
    drawExitWarn: function () {},
    clickExitWarn: function () {}
  };
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/garage-act.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/dialogs.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает действие гаража и модалки до кадра', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/garage-act.js'));
  assert(out.includes('/__engine/dialogs.js'));
  assert(out.indexOf('hub.js') < out.indexOf('garage-act.js'));
  assert(out.indexOf('garage-act.js') < out.indexOf('arena.js'));
  assert(out.indexOf('career-ui.js') < out.indexOf('dialogs.js'));
  assert(out.indexOf('dialogs.js') < out.indexOf('pointer.js'));
  assert(engineFile('__engine/dialogs.js').endsWith('dialogs.js'));
});

test('Строки гаража, пара Нет/Да и край модалки', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../rnr.html'), 'utf8');
  assert(html.includes('function garageAction('));
  assert(html.includes('function drawLabWarn('));
  assert(html.includes('function clickExitWarn('));
  const g = bootGarage();
  const kind = g.DiVANEngine.garageAct.garageRowKind;
  assert.equal(kind(0), 'tune');
  assert.equal(kind(5), 'gym');
  assert.equal(kind(6), 'armory');
  assert.equal(kind(7), 'park');
  assert.equal(kind(8), 'race');
  const pair = g.DiVANEngine.dialogs.warnPair(640, 400);
  assert.equal(pair.nx, 466);
  assert.equal(pair.yx, 654);
  const lab = g.DiVANEngine.dialogs.warnCard('lab', 1280, 720);
  assert.equal(lab.mw, 680);
  assert.equal(lab.mx, 300);
  const hit = g.DiVANEngine.dialogs.hitInclusive;
  assert.equal(hit(0, 10, { x: 0, y: 0, w: 20, h: 20 }), true);
  assert.equal(hit(-1, 10, { x: 0, y: 0, w: 20, h: 20 }), false);
});
