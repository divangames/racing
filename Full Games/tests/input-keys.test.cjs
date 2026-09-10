////////////////////////////////////////////////////////
//
// Код клавиши, подтверждение и сброс залипания.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { enhanceHtml, engineFile } = require('../src/main/enhancements');

const HOOKS = [
  'ctrlHeld', 'isEnter', 'isConfirm', 'isBack', 'codeFromEvent', 'clearKeys', 'blockBrowserKeys'
];

/** Песочница клавиш. */
function bootInput() {
  const g = {
    console,
    settings: { controls: { up: ['KeyW'] } },
    keys: { KeyW: true, KeyA: true }
  };
  HOOKS.forEach(function (n) { g[n] = function () {}; });
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/input.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает input до сцены', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/input.js'));
  assert(engineFile('__engine/input.js').endsWith('input.js'));
});

test('Numpad Enter, Esc из key, clearKeys, preventDefault', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../rnr.html'), 'utf8');
  assert(html.includes('function codeFromEvent('));
  const g = bootInput();
  assert.equal(g.isEnter('NumpadEnter'), true);
  assert.equal(g.isConfirm('Space'), true);
  assert.equal(g.isBack('Escape'), true);
  assert.equal(g.codeFromEvent({ key: 'Esc' }), 'Escape');
  assert.equal(g.codeFromEvent({ code: 'KeyZ', key: 'z' }), 'KeyZ');
  g.clearKeys();
  assert.equal(g.keys.KeyW, false);
  let n = 0;
  g.blockBrowserKeys({ preventDefault: function () { n++; }, ctrlKey: true }, 'KeyW');
  assert.ok(n >= 1);
});
