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
  const html = fs.readFileSync(path.resolve(__dirname, '../content/rnr.html'), 'utf8');
  assert(html.includes('function normalizeSettings('));
  const g = bootSettings();
  assert.equal(g.abilityBindsLookLegacy(['ControlLeft']), true);
  assert.equal(g.abilityBindsLookLegacy(['KeyZ']), false);
  g.normalizeControls();
  assert.equal(g.settings.controls.fire[0], 'KeyZ');
  g.settings = null;
  g.normalizeSettings();
  assert.equal(g.settings.sound.musicOn, true);
  assert.equal(g.settings.sound.biome, 80);
  assert.equal(g.settings.sound.crowd, 80);
  assert.equal(g.settings.graphics.cameraZoom, 2);
  g.state = 'settings';
  g.settings.sound.music = 10;
  g.beginSettingsDraft();
  g.settings.sound.music = 90;
  g._wrote = null;
  g.saveSettings();
  assert.equal(g._wrote, null);
  g.commitSettings();
  assert.ok(g._wrote.indexOf('"music":90') >= 0);
  g.resetSettingsPane('sound');
  assert.equal(g.settings.sound.music, 50);
});

test('Повреждённые значения и старые занятые клавиши не ломают ввод', () => {
  const g = bootSettings();
  g.settings = {
    graphics: { resolution: -1, cameraZoom: Infinity, particles: 'ultra', skids: 'yes' },
    sound: { music: 'loud', sfx: 200, biome: -30, musicOn: 1 },
    controls: { up: 'KeyW', down: ['KeyR'], fire: ['KeyZ', 'F3'], nitro: ['KeyM'], pause: [null] }
  };
  g.normalizeSettings();
  assert.deepEqual(Array.from(g.settings.controls.up), ['KeyW']);
  assert.deepEqual(Array.from(g.settings.controls.down), ['KeyS']);
  assert.deepEqual(Array.from(g.settings.controls.fire), ['KeyZ']);
  assert.deepEqual(Array.from(g.settings.controls.nitro), ['KeyX']);
  assert.deepEqual(Array.from(g.settings.controls.pause), ['Escape']);
  assert.equal(g.settings.graphics.resolution, 0);
  assert.equal(g.settings.graphics.cameraZoom, 2);
  assert.equal(g.settings.graphics.particles, 'high');
  assert.equal(g.settings.graphics.skids, true);
  assert.equal(g.settings.sound.music, 50);
  assert.equal(g.settings.sound.sfx, 100);
  assert.equal(g.settings.sound.biome, 0);
  assert.equal(g.settings.sound.musicOn, true);
});

test('Настройки экрана читаются из клиента и применяются только после подтверждения', async () => {
  const g = bootSettings();
  g.normalizeSettings();
  const applied = [];
  g.rnrDesktop = {
    screenState: () => ({ settings: { fullscreen: false, displayId: 42 }, displays: [{ id: 42, name: 'Экран 2' }] }),
    setScreen: (patch) => { applied.push(patch); return Promise.resolve({ displayId: patch.displayId }); }
  };
  g.beginSettingsDraft();
  assert.equal(g.settings.graphics.fullscreen, false);
  assert.equal(g.settings.graphics.displayId, 42);
  g.settings.graphics.fullscreen = true;
  assert.equal(applied.length, 0);
  g.commitSettings();
  await Promise.resolve();
  assert.equal(applied.length, 1);
  assert.equal(applied[0].fullscreen, true);
  assert.equal(applied[0].displayId, 42);
});

test('Сила тряски сохраняет выключенное состояние старого сейва и ограничивает ввод', () => {
  const g = bootSettings(); g.settings.graphics = {shake: false}; g.normalizeSettings();
  assert.equal(g.settings.graphics.shakeStrength, 0);
  g.settings.graphics = {shake: true}; g.normalizeSettings();
  assert.equal(g.settings.graphics.shakeStrength, 60);
  g.settings.graphics.shakeStrength = 200; g.normalizeSettings(); assert.equal(g.settings.graphics.shakeStrength, 100);
  g.settings.graphics.shakeStrength = -10; g.normalizeSettings(); assert.equal(g.settings.graphics.shakeStrength, 0);
  g.settings.graphics.shakeStrength = 35; g.saveSettings();
  assert.equal(JSON.parse(g._wrote).graphics.shakeStrength, 35);
});
