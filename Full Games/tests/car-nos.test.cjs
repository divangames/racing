////////////////////////////////////////////////////////
//
// Нитро: три фазы без возврата к старым sound_*.wav.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function bootNos() {
  const plays = [];
  const g = {
    console,
    Set,
    carEngineShare: { buf: {}, miss: {} },
    carEngineMakeSlot() { return { live: false, voice: null, shot: false, want: '', wasOn: false }; },
    carEngineLoad() {},
    carEngineDesktop() { return true; },
    carEnginePlaySlot(slot, url, loop, vol, rate, pan) {
      slot.voice = { url, loop };
      slot.shot = !loop;
      plays.push({ slot, url, loop, vol, rate, pan });
      return true;
    },
    carEngineTouchSlot() {},
    carEngineKillSlot(slot) { slot.voice = null; slot.shot = false; },
    carEngineHaltSlot(slot) { slot.live = false; slot.voice = null; slot.shot = false; slot.want = ''; },
    carEngineSpat() { return 1; },
    carEnginePanFrom() { return 0; }
  };
  g.window = g;
  g.globalThis = g;
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../content/car-nos.js'), 'utf8'), g);
  return { g, plays };
}

test('Нитро играет Start, затем Loop, затем End', () => {
  const { g, plays } = bootNos();
  const racer = { nitro: 1, dead: false, isP: true, x: 0, y: 0 };
  g.tickCarNos(racer, [], 1);
  assert.equal(plays[0].url, 'assets/sounds/cars/NOSZ/A_Nitro_Start.WAV');
  assert.equal(plays[0].loop, false);

  const slot = plays[0].slot;
  slot.voice = null;
  slot.shot = false;
  slot.onResume(slot);
  assert.equal(plays[1].url, 'assets/sounds/cars/NOSZ/A_Nitro_Loop.WAV');
  assert.equal(plays[1].loop, true);

  racer.nitro = 0;
  g.tickCarNos(racer, [], 1);
  assert.equal(plays[2].url, 'assets/sounds/cars/NOSZ/A_Nitro_End.WAV');
  assert.equal(plays[2].loop, false);
});

