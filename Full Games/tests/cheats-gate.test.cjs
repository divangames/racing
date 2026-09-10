////////////////////////////////////////////////////////
//
// Публичный NSIS без пункта «ЧИТЫ» и без deliane.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');
const vm = require('node:vm');
const { enhanceHtml, engineFile } = require('../src/main/enhancements');
const { desktopHeadScript } = require('../src/main/build-flags');

/** Песочница гейта читов. */
function bootGate(flags) {
  const g = {
    console,
    save: { dev: 1, cash: 0, carOwned: {} },
    CARS: [{}, {}],
    persist: function () {},
    sCash: function () {},
    enterCameraSetup: function () { g._cam = true; },
    selChar: 0,
    selCar: 0,
    carConfirmed: true,
    cheatBuf: ['d', 'e', 'l', 'i', 'a', 'n', 'e'],
    cheatsAllowed: function () { return true; },
    submitCheat: function () { g._fired = true; }
  };
  Object.assign(g, flags || {});
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/cheats-gate.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает cheats-gate сразу после runtime', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/cheats-gate.js'));
  assert(out.indexOf('runtime.js') < out.indexOf('cheats-gate.js'));
  assert(out.indexOf('cheats-gate.js') < out.indexOf('cars-own.js'));
  assert(engineFile('__engine/cheats-gate.js').endsWith('cheats-gate.js'));
});

test('Dev-окно пускает читы, упакованный клиент — нет', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../rnr.html'), 'utf8');
  assert(html.includes('function cheatsAllowed('));
  assert(html.includes('function submitCheat('));
  const dev = bootGate({ __RNR_DESKTOP__: true, __RNR_PUBLIC_BUILD__: false });
  assert.equal(dev.cheatsAllowed(), true);
  dev.submitCheat();
  assert.equal(dev._fired, true);
  const retail = bootGate({ __RNR_DESKTOP__: true, __RNR_PUBLIC_BUILD__: true });
  assert.equal(retail.cheatsAllowed(), false);
  retail.submitCheat();
  assert.equal(retail._fired, undefined);
  const script = desktopHeadScript(true);
  assert(script.includes('__RNR_PUBLIC_BUILD__=true'));
  assert(desktopHeadScript(false).includes('__RNR_PUBLIC_BUILD__=false'));
});
