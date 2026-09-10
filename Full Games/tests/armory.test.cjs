////////////////////////////////////////////////////////
//
// Верстак: подпись минигана, покупка ствола, вход в оружейку.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { enhanceHtml, engineFile } = require('../src/main/enhancements');

/** Песочница оружейки. */
function bootArmory() {
  const g = {
    console,
    ARM_MAX: 6,
    ARM_COSTS: { wep: [950, 1700, 3000, 5200, 8600, 14000], ult: [1200, 2100, 3600, 6200, 10000, 16500] },
    blankTune: function () { return { arm: 0, eng: 0, tir: 0, shk: 0, nit: 0, wep: 0, ult: 0 }; },
    carAbil: function () {
      return {
        weapon: { type: 'minigun', name: 'МИНИГАН' },
        ult: { type: 'dash', name: 'ПЕРЕГОВОРЫ' }
      };
    },
    fm: function (n) { return String(n); },
    persist: function () { g._persisted = true; },
    sHit: function () { g._hit = true; },
    sClick: function () { g._click = true; },
    isBack: function (c) { return c === 'Escape'; },
    isConfirm: function (c) { return c === 'Enter'; },
    SFX: { play: function (k) { g._sfx = k; } },
    save: { car: 0, cash: 2000, tuning: { 0: { arm: 0, eng: 0, tir: 0, shk: 0, nit: 0 } } },
    state: 'garage',
    armorySel: 1,
    garMsg: '',
    garMsgT: 0,
    g: { _armHits: [] },
    ensureTuneGuns: function (t) { return t; },
    armWepBlurb: function () { return ''; },
    armUltBlurb: function () { return ''; },
    enterArmory: function () {},
    buyArmory: function () {},
    armoryPress: function () {},
    armoryClick: function () {}
  };
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/armory-tune.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/armory-act.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает оружейку после тренажёрки', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/armory-tune.js'));
  assert(out.includes('/__engine/armory-act.js'));
  assert(out.indexOf('gym-act.js') < out.indexOf('armory-tune.js'));
  assert(out.indexOf('armory-tune.js') < out.indexOf('armory-act.js'));
  assert(engineFile('__engine/armory-act.js').endsWith('armory-act.js'));
});

test('Миниган, рывок, покупка ствола и вход', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../../armory.js'), 'utf8');
  assert(src.includes('function buyArmory('));
  assert(src.includes('const ARM_COSTS'));
  const g = bootArmory();
  const tun = g.ensureTuneGuns({ arm: 1 });
  assert.equal(tun.wep, 0);
  assert.equal(tun.ult, 0);
  assert(g.armWepBlurb(0, 0).indexOf('сток') >= 0);
  assert(g.armWepBlurb(0, 2).indexOf('магазин 66') >= 0);
  assert(g.armUltBlurb(0, 1).indexOf('рывок') >= 0);
  g.enterArmory();
  assert.equal(g.state, 'armory');
  assert.equal(g.armorySel, 0);
  g.buyArmory('wep');
  assert.equal(g.save.tuning[0].wep, 1);
  assert.equal(g.save.cash, 1050);
  assert.equal(g._sfx, 'tune');
  assert(g.garMsg.indexOf('МИНИГАН') >= 0);
  g.save.tuning[0].wep = 6;
  g.buyArmory('wep');
  assert.equal(g.garMsg, 'МАКСИМАЛЬНЫЙ УРОВЕНЬ');
});
