////////////////////////////////////////////////////////
//
// Покрышки: не визжат вне заезда; поздний play() не оживляет луп.
//
////////////////////////////////////////////////////////
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '../..');

/** Песочница голоса и покрышек. */
function loadTires(opts) {
  const pending = [];
  function FakeAudio() {
    this.src = '';
    this.volume = 1;
    this.paused = true;
    this.loop = false;
    this.currentTime = 0;
    this.playbackRate = 1;
    this.onended = null;
    this.onerror = null;
    const el = this;
    this.play = function () {
      el.paused = false;
      return {
        then: function (ok) { pending.push(function () { ok(); }); },
        catch: function () {}
      };
    };
    this.pause = function () { el.paused = true; };
    this.load = function () {};
    this.removeAttribute = function () {};
  }
  const g = {
    console,
    document: { hidden: false },
    state: (opts && opts.state) || 'cameraSetup',
    settings: { sound: { sfxOn: true, sfx: 80 } },
    titleSim: {
      racers: [{
        x: 0, y: 0, ang: 0, spd: 180, lat: 80, steerFlt: 1,
        dead: false, air: false, car: { hov: false, idx: 0 }, st: { top: 200 }
      }]
    },
    titleFocus: null,
    navigator: { hardwareConcurrency: 8 },
    Audio: FakeAudio,
    encodeURI: encodeURI,
    URL: URL,
    location: { href: 'https://game.local/rnr.html' },
    AU: { ctx: null, sfx: null },
    requestAnimationFrame: function () { return 1; },
    cancelAnimationFrame: function () {},
    setTimeout: function () { return 0; },
    carEngineShare: null
  };
  g.window = g;
  g.globalThis = g;
  g.__RNR_DESKTOP__ = true;
  g.titleFocus = g.titleSim.racers[0];
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'car-audio-voice.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'car-tires.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'car-audio.js'), 'utf8'), g);
  return { g: g, flush: function () { while (pending.length) pending.shift()(); } };
}

test('На камере демо не включает визг шин', () => {
  const { g, flush } = loadTires({ state: 'cameraSetup' });
  g.tickCarEngineField(g.titleFocus, false, 'cameraSetup');
  flush();
  assert.equal(g.carTiresLive(), false);
});

test('Поздний play после глушения не оставляет луп', () => {
  const { g, flush } = loadTires({ state: 'race' });
  const slot = g.carEngineMakeSlot();
  slot.live = true;
  g.carEnginePlayHtml(slot, 'assets/sounds/cars/wheels/sound_025.wav', true, 0.8, 1, true);
  const el = slot.voice.el;
  assert.equal(el.paused, false);
  g.carEngineHaltSlot(slot);
  assert.equal(el.paused, true);
  flush();
  assert.equal(el.paused, true);
  assert.equal(slot.voice, null);
});

test('Стоящая машина не даёт скольжение', () => {
  const { g } = loadTires({ state: 'race' });
  const z = g.carTireSlip({ spd: 0, lat: 0, steerFlt: 0, car: { hov: false } });
  assert.equal(z.slide, 0);
  assert.equal(z.drift, 0);
});

test('Обычный ход не включает визг покрышек', () => {
  const { g } = loadTires({ state: 'race' });
  g.paused = false;
  const z = g.carTireSlip({ spd: 140, lat: 22, steerFlt: 0.2, car: { hov: false } });
  assert.equal(z.slide, 0);
  assert.equal(z.drift, 0);
});

test('Неактивный заезд глушит шины до тика моторов', () => {
  const g = {
    console,
    settings: { sound: { sfxOn: true } },
    document: { hidden: false, addEventListener: function () {} },
    AU: { ctx: null, engG: null },
    updEngine: function () {},
    carTiresHalt: function () { g.halted = true; },
    tickCarEngine: function () { assert.equal(g.halted, true); },
    carEngineLive: function () { return false; }
  };
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/engine/audio.js'), 'utf8'), g);
  g.updEngine({}, false, 'cameraSetup');
  assert.equal(g.halted, true);
});
