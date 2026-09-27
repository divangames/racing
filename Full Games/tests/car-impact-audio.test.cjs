////////////////////////////////////////////////////////
//
// Подписанные клипы контакта, урона, приземления и коробки.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('Автомобильные события выбирают свои группы WAV', () => {
  const played = [];
  class AudioMock {
    constructor() { this.volume = 1; this.playbackRate = 1; }
    addEventListener() {}
    play() { played.push(this.src); return Promise.resolve(); }
  }
  const g = {
    console,
    Audio: AudioMock,
    settings: { sound: { sfxOn: true, sfx: 80 } },
    performance: { now: () => 1000 },
    P: { x: 0, y: 0 }
  };
  g.window = g;
  g.globalThis = g;
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../content/sounds.js'), 'utf8'), g);

  assert.deepEqual(Array.from(g.CAR_IMPACT_TRACKS.collision), ['carHit1', 'carHit2', 'carHit3']);
  assert.deepEqual(Array.from(g.CAR_IMPACT_TRACKS.damage), ['carBody1', 'carBody2', 'carBody3']);
  assert.deepEqual(Array.from(g.CAR_IMPACT_TRACKS.land), ['carLand1', 'carLand2']);
  assert.deepEqual(Array.from(g.CAR_GEAR_TRACKS), ['carGear1', 'carGear2', 'carGear3', 'carGear4']);

  assert.equal(g.carImpactPlay('collision', { isP: true }, 1, { local: true }), true);
  assert.match(played[0], /assets\/sounds\/cars\/hit\/A_CarHit_03\.WAV$/);
  assert.equal(g.carGearPlay({ isP: true }, .7, 0), true);
  assert.match(played[1], /assets\/sounds\/cars\/GearSwitch\/GearSwitch_[1-4]\.WAV$/);
  assert.equal(g.carGearPlay({ isP: true }, .7, 0), false, 'дребезг ввода не дублирует щелчок');
});
