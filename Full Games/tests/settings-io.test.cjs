////////////////////////////////////////////////////////
//
// Старый JSON настроек и легаси-бинды огня.
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
  'abilityBindsLookLegacy', 'normalizeControls', 'normalizeSettings', 'loadSettings', 'saveSettings'
];

/** Песочница настроек. */
function bootSettings() {
  const g = {
    console,
    SETTINGS_KEY: 'rnr_ru_settings',
    settings: { graphics: {}, sound: {}, controls: { fire: ['ControlLeft'] } },
    DEFAULT_CONTROLS: {
      up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
      fire: ['KeyZ', 'KeyP'], nitro: ['KeyX'], ult: ['KeyC'],
      handbrake: ['Space'], pause: ['Escape']
    },
    persistRead: function () { return null; },
    persistWrite: function (k, t) { g._wrote = t; }
  };
  HOOKS.forEach(function (n) { g[n] = function () {}; });
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/settings-io.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает settings-io после persist-save', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/settings-io.js'));
  assert(out.indexOf('persist-save.js') < out.indexOf('settings-io.js'));
  assert(engineFile('__engine/settings-io.js').endsWith('settings-io.js'));
});

test('Легаси Ctrl на огне сбрасывается, дырявый JSON чинится', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../rnr.html'), 'utf8');
  assert(html.includes('function normalizeSettings('));
  const g = bootSettings();
  assert.equal(g.abilityBindsLookLegacy(['ControlLeft']), true);
  assert.equal(g.abilityBindsLookLegacy(['KeyZ']), false);
  g.normalizeControls();
  assert.equal(g.settings.controls.fire[0], 'KeyZ');
  g.settings = null;
  g.normalizeSettings();
  assert.equal(g.settings.sound.musicOn, true);
  assert.equal(g.settings.graphics.cameraZoom, 2);
});
