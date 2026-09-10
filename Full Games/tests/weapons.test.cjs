////////////////////////////////////////////////////////
//
// Магазин минигана, клык, рывок и купол без каталога CAR_ABIL.
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
  'kitLvW', 'kitLvU', 'kitWepCd', 'kitUltCd', 'kitOverheat', 'kitHeatStep',
  'kitUltDur', 'kitUltRad', 'abilHudLine', 'wepMagMax', 'resetWepMag', 'kitWepDmg',
  'kitSliding', 'kitMineId', 'kitPushShot', 'kitMortarBoom', 'kitRamOut', 'kitRamIn',
  'kitBubbleBlocks', 'kitGhost', 'kitGunSound', 'fireWeapon', 'kitShove', 'useUlt',
  'tickCarKits', 'tickCrawlMines', 'kitOnShotHit', 'kitOnShotExpire', 'kitAiWantsFire', 'kitShotStyle'
];

/** Песочница ствола и ульт. */
function bootWeapons() {
  const racer = {
    dead: false, cdW: 0, cdU: 0, car: { idx: 0 }, ang: 0, x: 0, y: 0,
    wepLvl: 0, ultLvl: 0, buffDmg: 1, dmgMul: 1, cloak: 0, dash: 0, blind: 0,
    isP: false, wepAmmo: 50, wepOver: 0, wepHeat: 0, spd: 100, st: { top: 200 },
    shield: 0, berserk: 0, ghost: 0, paper: 0, haze: 0, nitro: 0, lat: 0, handbrake: false
  };
  const g = {
    console,
    clamp: function (n, a, b) { return n < a ? a : n > b ? b : n; },
    vfxLive: function () { return false; },
    fl: function () { g._fl = true; },
    swp: function () { g._swp = true; },
    sShoot: function () { g._shoot = true; },
    spark: function () {},
    boom: function () { g._boom = true; },
    sBoom: function () {},
    nearP: function () { return false; },
    doShake: function () {},
    dmgRacer: function () { g._dmg = true; },
    angDiff: function (a, b) { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; },
    carAbil: function () {
      return {
        nitro: { cd: 10, type: 'boost' },
        weapon: { cd: 1.05, dmg: 20, name: 'КЛЫК', type: 'fang' },
        ult: { cd: 8, name: 'ПЕРЕГОВОРЫ', type: 'dash' }
      };
    },
    R: {
      demo: false, shots: [], mines: [], spikes: [], shocks: [],
      racers: [racer],
      T: { w: 2000, h: 2000 }
    }
  };
  g.racer = racer;
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  for (const name of HOOKS) g[name] = function () {};
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/weapons.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/weapons-fire.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/weapons-tick.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает оружие после боя и до рамок', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/weapons.js'));
  assert(out.includes('/__engine/weapons-fire.js'));
  assert(out.includes('/__engine/weapons-tick.js'));
  assert(out.indexOf('combat.js') < out.indexOf('weapons.js'));
  assert(out.indexOf('weapons.js') < out.indexOf('weapons-fire.js'));
  assert(out.indexOf('weapons-fire.js') < out.indexOf('weapons-tick.js'));
  assert(out.indexOf('weapons-tick.js') < out.indexOf('collision.js'));
  assert(engineFile('__engine/weapons.js').endsWith('weapons.js'));
});

test('Миниган, клык, рывок и купол', () => {
  const kits = fs.readFileSync(path.resolve(__dirname, '../../combat-kits.js'), 'utf8');
  assert(kits.includes('function fireWeapon('));
  assert(kits.includes('function useUlt('));
  assert(kits.includes('const CAR_ABIL'));
  const g = bootWeapons();
  const r = g.racer;
  g.carAbil = function () {
    return {
      nitro: { cd: 10, type: 'jump' },
      weapon: { cd: 0.07, dmg: 7, name: 'МИНИГАН', type: 'minigun', ammo: 50, overheat: 3.2 },
      ult: { cd: 14, name: 'ТАБУН', type: 'shove', rad: 92 }
    };
  };
  r.wepLvl = 0;
  assert.equal(g.wepMagMax(r), 50);
  r.wepLvl = 2;
  assert.equal(g.wepMagMax(r), 66);
  g.resetWepMag(r);
  assert.equal(r.wepAmmo, 66);
  assert.equal(r.wepOver, 0);

  g.carAbil = function () {
    return {
      nitro: { cd: 10 },
      weapon: { cd: 1.05, dmg: 20, name: 'КЛЫК', type: 'fang' },
      ult: { cd: 8, name: 'ПЕРЕГОВОРЫ', type: 'dash' }
    };
  };
  r.wepLvl = 0; r.cdW = 0; r.buffDmg = 1; r.dmgMul = 1; r.dead = false;
  g.R.shots = [];
  g.fireWeapon(r);
  assert.equal(g.R.shots.length, 3);
  assert(g.R.shots.every(function (s) { return s.fang; }));

  r.cdU = 0; r.spd = 100; r.st = { top: 200 }; r.ultLvl = 0;
  g.useUlt(r);
  assert(r.dash > 0);
  assert.equal(r.buffDmg, 2);

  assert.equal(g.kitBubbleBlocks('ram'), false);
  assert.equal(g.kitBubbleBlocks('proj'), true);
  r.car = { idx: 0 }; r.dash = 1; r.berserk = 0;
  assert.equal(g.kitRamOut(r), 2 * 1.15);

  r.dash = 1.5; r.cdW = 0; r.wepHeat = 0;
  g.tickCarKits(r, 0.5);
  assert.equal(r.dash, 1);
});
