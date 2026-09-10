////////////////////////////////////////////////////////
//
// Ввод и камера DiVANEngine без окна заезда.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { enhanceHtml, engineFile } = require('../src/main/enhancements');

/** Песочница runtime + input + scene. */
function bootScene() {
  const g = {
    console,
    settings: { controls: { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], handbrake: ['Space'] } },
    keys: { KeyW: true, KeyA: false, KeyS: false, KeyD: false, Space: false }
  };
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  g.ctrlHeld = function () { return false; };
  g.isEnter = function () { return false; };
  g.isConfirm = function () { return false; };
  g.isBack = function () { return false; };
  g.codeFromEvent = function () { return ''; };
  g.clearKeys = function () {};
  g.blockBrowserKeys = function () {};
  g.updRace = function () {};
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/input.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/scene.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает input и scene', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/input.js'));
  assert(out.includes('/__engine/scene.js'));
  assert(out.indexOf('input.js') < out.indexOf('scene.js'));
  assert(out.indexOf('scene.js') < out.indexOf('presentation.js'));
  assert(engineFile('__engine/input.js').endsWith('input.js'));
});

test('Ось ввода и камера не выезжает за карту', () => {
  const g = bootScene();
  const drive = g.DiVANEngine.input.axis();
  assert.equal(drive.throttle, 1);
  assert.equal(drive.steer, 0);
  assert.equal(g.ctrlHeld('up'), true);
  const race = { cam: { x: 0, y: 0 }, T: { w: 400, h: 400 } };
  const player = { x: 200, y: 200, ang: 0, spd: 0 };
  g.DiVANEngine.scene.followCam(race, player, 1 / 60, { w: 800, h: 400 });
  assert.equal(race.cam.x, (400 - 800) / 2);
  const big = { cam: { x: 0, y: 0 }, T: { w: 4000, h: 4000 } };
  g.DiVANEngine.scene.followCam(big, { x: 2000, y: 2000, ang: 0, spd: 0 }, 1, { w: 800, h: 450 });
  assert.ok(big.cam.x >= 0 && big.cam.x <= 4000 - 800);
  assert.ok(big.cam.y >= 0 && big.cam.y <= 4000 - 450);
});
