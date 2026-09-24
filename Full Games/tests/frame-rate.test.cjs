'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('Кадр в 200 мс проходит 24 физических шага, длинный Alt+Tab не догоняется', () => {
  const calls = [];
  const context = {
    console,
    window: null,
    document: {
      createElement: () => ({ getContext: () => ({
        createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}
      }) })
    },
    settings: { graphics: { particles: 'off', showFps: false } },
    R: { racers: [] }, state: 'race', paused: false,
    updRace(dt) { calls.push(dt); }, stepVehicle() {}, drawRaceArena() {}, drawRaceWorld() {}, drawHudCockpit() {},
    last: 0, gt: 0, fpsSmooth: 60, saveFlash: 0, garMsgT: 0, cheatMsgT: 0,
    lerp: (a, b, t) => a + (b - a) * t,
    updateView() {}, viewOX: 0, viewOY: 0, viewS: 1,
    g: { setTransform() {}, fillRect() {} }, cv: { width: 1280, height: 720 },
    AU: { ctx: null }, CHIP: { on: false }, P: null,
    updEngine() {}, requestAnimationFrame() {}
  };
  context.window = context;
  context.DiVANEngine = {
    wrap(name, factory) { context[name] = factory(context[name]); },
    replace(name, implementation) { context[name] = implementation; },
    screens: { paint() {} }
  };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/presentation.js'), 'utf8'), context);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/loop.js'), 'utf8'), context);
  context.frame(200);
  assert.equal(calls.length, 24);
  assert.ok(Math.abs(calls.reduce((sum, dt) => sum + dt, 0) - 0.2) < 1e-9);
  context.frame(1200);
  assert.equal(calls.length, 24);
  context.frame(1450);
  assert.equal(calls.length, 54);
  assert.ok(Number.isFinite(context.fpsSmooth));
});
