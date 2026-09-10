////////////////////////////////////////////////////////
//
// Прогон заезда: WAV мотора, ближний/дальний выстрел, мятость Дьявола, дождь не на линзе.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '../..');

/** Файл обязан лежать на диске контента. */
function mustFile(rel) {
  const full = path.join(ROOT, rel);
  assert.ok(fs.existsSync(full), 'нет файла: ' + rel);
  return full;
}

test('У Дьявола есть слои повреждений 1–6', () => {
  for (let l = 1; l <= 6; l++) {
    mustFile('assets/data/cars/01/damage/01_damage_' + l + '.webp');
  }
});

test('Пак мотора GTR, шины и Shotgun лежат на диске', () => {
  for (let n = 1; n <= 5; n++) {
    mustFile('assets/sounds/cars/engine/01 Nissan GTR/sound/sound_00' + n + '.wav');
  }
  mustFile('assets/sounds/cars/wheels/sound_025.wav');
  mustFile('assets/sounds/cars/wheels/sound_026.wav');
  mustFile('assets/sounds/weapon/Shotgun/shoot.wav');
  mustFile('assets/sounds/weapon/Shotgun/distant0.wav');
  const kit = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/cars/01/car.json'), 'utf8'));
  assert.equal(kit.audio.engine, '01 Nissan GTR');
  assert.equal(kit.audio.wep.near, 'shoot.wav');
  assert.equal(kit.audio.wep.far, 'distant0.wav');
  assert.notEqual(kit.audio.wep.near, kit.audio.wep.far);
});

test('Свой выстрел — near, чужой — far и тише с дистанции', () => {
  const played = [];
  const g = {
    console,
    CARS: [{ audio: { wep: { pack: 'Shotgun', near: 'shoot.wav', far: 'distant0.wav' } } }],
    settings: { sound: { sfxOn: true, sfx: 80 } },
    P: { x: 0, y: 0, isP: true, car: { idx: 0 } },
    encodeURI: encodeURI,
    Audio: function () {
      this.src = '';
      this.volume = 1;
      this.play = function () { return { catch: function () {} }; };
      played.push(this);
    }
  };
  g.window = g;
  g.globalThis = g;
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'weapon-audio.js'), 'utf8'), g);
  const slot = g.carWeaponSlot(0, 'wep');
  assert.equal(slot.near, 'shoot.wav');
  assert.equal(slot.far, 'distant0.wav');
  const near = g.carWeaponField(g.P, { x: 40, y: 0 });
  const far = g.carWeaponField(g.P, { x: 700, y: 0 });
  assert.ok(near.gain > far.gain, 'дальний должен быть тише');
  g.playCarWeapon({ isP: true, car: { idx: 0 }, x: 0, y: 0 }, 'wep');
  assert.ok(String(played[0].src).indexOf('shoot.wav') >= 0);
  g.playCarWeapon({ isP: false, car: { idx: 0 }, x: 400, y: 0 }, 'wep');
  assert.ok(String(played[1].src).indexOf('distant0.wav') >= 0);
});

test('Подбитый корпус без quarks даёт чёрный дым и огонь', () => {
  const g = {
    console,
    clamp: function (n, a, b) { return n < a ? a : n > b ? b : n; },
    rnd: function (a, b) { return (a + b) / 2; },
    partN: function (n) { return n; },
    vfxLive: function () { return false; },
    TAU: Math.PI * 2,
    R: { parts: [] },
    irnd4: function () { return 0; },
    spark: function () {},
    emitWreckFx: function () {},
    spawnCanvasSpray: function () {},
    landDust: function () {},
    boom: function () {},
    carSparkWorld: function (r) { return { x: r.x, y: r.y }; }
  };
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/combat-fx.js'), 'utf8'), g);
  const devil = { dead: false, hp: 18, maxhp: 100, x: 10, y: 20, ang: 0, car: { idx: 0 }, smokeT: 0 };
  g.emitWreckFx(devil, 0.2);
  const smoke = g.R.parts.filter(function (p) { return String(p.col).indexOf('18,16,14') >= 0; });
  const fire = g.R.parts.filter(function (p) { return String(p.col).indexOf('255,140') >= 0; });
  assert.ok(smoke.length > 0, 'нужен чёрный дым');
  assert.ok(fire.length > 0, 'нужен огонь');
});

test('При живых quarks холст не рисует капли, эмиттер дождя над кадром', () => {
  const weatherSrc = fs.readFileSync(path.join(ROOT, 'vfx/weather-fx.js'), 'utf8');
  assert.ok(weatherSrc.includes('quarksPrecip(root.settings)'));
  const quarksSrc = fs.readFileSync(path.join(ROOT, 'vfx/quarks-weather.js'), 'utf8');
  assert.ok(quarksSrc.includes('hh * 0.95'));
  const g = {
    console,
    matchMedia: function () { return { matches: false }; },
    settings: { graphics: { weather: true, particles: 'high' } },
    RnRVfx: {
      ok: true,
      weatherOn: true,
      weather: function (id) { g._wx = id; }
    }
  };
  g.window = g;
  g.globalThis = g;
  vm.runInNewContext(weatherSrc, g);
  const R = { weather: { id: 'rain', parts: 260, vis: 0.93 }, wxFx: { parts: [{ k: 'rain' }], bolts: [], flash: 0, nextStrike: 9 } };
  g.RnRWeather.tick(R, 0.05, { x: 0, y: 0, w: 400, h: 300 }, 1280, 720, g.settings);
  assert.equal(R.wxFx.parts.length, 0);
  assert.equal(g._wx, 'rain');
  let drew = false;
  const ctx = {
    save: function () { drew = true; },
    restore: function () {},
    translate: function () {},
    rotate: function () {},
    fillRect: function () { drew = true; }
  };
  g.RnRWeather.drawWorld(ctx, R);
  assert.equal(drew, false);
});
