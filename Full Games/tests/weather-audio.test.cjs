////////////////////////////////////////////////////////
//
// Дождь, снег и гром биома из assets/sounds/embirnt.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '../..');

/** Песочница погоды и эмбиента. */
function bootWx() {
  const plays = [];
  const g = {
    console,
    state: 'race',
    settings: { graphics: { weather: true, particles: 'high' }, sound: { sfxOn: true, sfx: 80 } },
    matchMedia: function () { return { matches: false }; },
    document: { hidden: false, addEventListener: function () {} },
    Audio: function () {
      this.loop = false;
      this.paused = true;
      this.volume = 1;
      this.src = '';
      this.referrerPolicy = '';
      this.preload = '';
      this.play = function () {
        plays.push(this.src);
        this.paused = false;
        return Promise.resolve();
      };
      this.pause = function () { this.paused = true; };
    },
    bootEnqueueFetch: function (urls) { g.queued = urls; }
  };
  g.window = g;
  g.globalThis = g;
  g.plays = plays;
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'vfx/weather-fx.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'vfx/weather-audio.js'), 'utf8'), g);
  return g;
}

test('Каталог знает дождь, снег и гром', () => {
  const src = fs.readFileSync(path.join(ROOT, 'sounds.js'), 'utf8');
  assert.ok(src.includes("ambientRain: 'assets/sounds/embirnt/rain.mp3'"));
  assert.ok(src.includes("ambientSnow: 'assets/sounds/embirnt/Snow.mp3'"));
  assert.ok(src.includes("thunder: 'assets/sounds/embirnt/grom.mp3'"));
  assert.ok(fs.readFileSync(path.join(ROOT, 'rnr.html'), 'utf8').includes('vfx/weather-audio.js'));
});

test('В дождевом заезде луп дождя, на титуле нет второго лупа', () => {
  const g = bootWx();
  assert.equal((g.queued || []).join(','), 'assets/sounds/embirnt/rain.mp3,assets/sounds/embirnt/Snow.mp3,assets/sounds/embirnt/grom.mp3');
  const R = { weather: { id: 'rain', parts: 260, vis: 0.93 }, wxFx: { parts: [], bolts: [], flash: 0, nextStrike: 9 } };
  g.RnRWeather.tick(R, 0.05, { x: 0, y: 0, w: 400, h: 300 }, 1280, 720, g.settings);
  assert.ok(g.plays.indexOf('assets/sounds/embirnt/rain.mp3') >= 0);
  g.state = 'title';
  g.plays.length = 0;
  g.RnRWeatherAudio.sync(R, g.settings);
  assert.equal(g.plays.length, 0);
});

test('В снежном заезде луп Snow.mp3', () => {
  const g = bootWx();
  const R = { weather: { id: 'snow', parts: 240, vis: 0.95 }, wxFx: { parts: [], bolts: [], flash: 0, nextStrike: 9 } };
  g.RnRWeather.tick(R, 0.05, { x: 0, y: 0, w: 400, h: 300 }, 1280, 720, g.settings);
  assert.ok(g.plays.indexOf('assets/sounds/embirnt/Snow.mp3') >= 0);
  assert.ok(g.plays.indexOf('assets/sounds/embirnt/rain.mp3') < 0);
});

test('Молния бьёт grom.mp3', () => {
  const g = bootWx();
  const R = { weather: { id: 'rain', parts: 260, vis: 0.93 }, shake: 0 };
  g.RnRWeather.tick(R, 0.05, { x: 0, y: 0, w: 400, h: 300 }, 1280, 720, g.settings);
  R.wxFx.nextStrike = 0;
  g.plays.length = 0;
  g.RnRWeather.tick(R, 0.05, { x: 0, y: 0, w: 400, h: 300 }, 1280, 720, g.settings);
  assert.ok(g.plays.indexOf('assets/sounds/embirnt/grom.mp3') >= 0);
  assert.ok(R.wxFx.flash > 0);
});
