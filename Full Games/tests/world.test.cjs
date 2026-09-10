////////////////////////////////////////////////////////
//
// Контакт заезда: призрак, таран, деньги.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { enhanceHtml, engineFile } = require('../src/main/enhancements');

/** Песочница мира. */
function bootWorld() {
  const g = {
    console,
    clamp: function (n, a, b) { return n < a ? a : n > b ? b : n; },
    angDiff: function () { return 0; },
    rnd: function (a, b) { return b == null ? a : (a + b) / 2; },
    kitGhost: function (r) { return !!r.ghost; },
    kitRamOut: function () { return 1; },
    kitRamIn: function () { return 1; },
    obbOverlap: function (A, B) {
      const dx = B.cx - A.cx, dy = B.cy - A.cy;
      const d = Math.hypot(dx, dy);
      if (d > 20) return null;
      return { nx: dx || 1, ny: dy, pen: 4 };
    },
    carObb: function (r) { return { cx: r.x, cy: r.y }; },
    pointInObb: function () { return false; },
    dmgRacer: function (r, d) { g._dmg = (g._dmg || 0) + d; r.hp -= d; },
    spark: function () {},
    boom: function () {},
    doShake: function () {},
    vfxLive: function () { return false; },
    nearP: function () { return false; },
    fl: function () {},
    skillVal: function () { return 0; },
    mineExplode: function () {},
    carAbil: function () { return { passive: {}, nitro: { type: 'boost' }, weapon: { type: 'gun' } }; },
    resetWepMag: function () {},
    sBoom: function () {},
    sPick: function () {},
    SFX: { play: function () {} },
    save: { cash: 10 },
    R: {
      demo: false,
      racers: [],
      shots: [],
      mines: [],
      spikes: [],
      pads: [],
      picks: [],
      parts: []
    }
  };
  g.resolveRaceContact = function () {};
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/world.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает world после collision', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/world.js'));
  assert(out.indexOf('collision.js') < out.indexOf('world.js'));
  assert(engineFile('__engine/world.js').endsWith('world.js'));
});

test('Призрак не таранит, живые разводятся, деньги игроку', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../rnr.html'), 'utf8');
  assert(html.includes('function resolveRaceContact('));
  const g = bootWorld();
  const a = { x: 0, y: 0, spd: 100, dead: false, air: false, ghost: true, car: { idx: 0 }, hp: 100 };
  const b = { x: 1, y: 0, spd: 10, dead: false, air: false, car: { idx: 1 }, hp: 100 };
  g.R.racers = [a, b];
  g.resolveRaceContact(0.016);
  assert.equal(a.x, 0);
  a.ghost = false;
  g.resolveRaceContact(0.016);
  assert.ok(a.x !== 0);
  assert.ok((g._dmg || 0) > 0);
  const p = { x: 0, y: 0, spd: 0, dead: false, air: false, finished: false, isP: true, car: { idx: 0 }, pickups: 0, moneyGot: 0 };
  g.R.racers = [p];
  g.R.picks = [{ alive: true, type: 'money', val: 25, x: 0, y: 0, rt: 0 }];
  g.resolveRaceContact(0.016);
  assert.equal(g.save.cash, 35);
  assert.equal(p.pickups, 1);
});
