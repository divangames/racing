////////////////////////////////////////////////////////
//
// Урон, щит, респаун и мина без quarks.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { enhanceHtml, engineFile } = require('../src/main/enhancements');

const TAU = Math.PI * 2;

/** Песочница боя. */
function bootCombat() {
  const victim = {
    dead: false, invuln: 0, finished: false, bubble: 0, shield: 0, hp: 50, maxhp: 50,
    x: 0, y: 0, isP: false, ch: { grt: 0, name: 'ЖЕРТВА' }, car: { idx: 0 },
    buffArmor: 1, paper: 0, bodyDump: 0, trackIdx: 12, aiLane: 0, cdN: 0, nitLvl: 0,
    chIdx: 0, skillLvl: 1, jumps: 0, air: false, spd: 0
  };
  const killer = { isP: true, dmgDealt: 0, kills: 0, ch: { name: 'МЕДВЕДЬ' } };
  const g = {
    console,
    TAU,
    clamp: function (n, a, b) { return n < a ? a : n > b ? b : n; },
    rnd: function (a, b) { return b === undefined ? a * 0.5 : (a + b) * 0.5; },
    partN: function (n) { return Math.max(1, Math.round(n)); },
    vfxLive: function () { return false; },
    kitBubbleBlocks: function (src) { return src !== 'ram' && src !== 'crush'; },
    kitTinAbsorb: function () { return 1; },
    kitMidAbsorb: function () { return 1; },
    wheelSprayKind: function () { return 'dust'; },
    doShake: function (v) { g._shake = (g._shake || 0) + v; },
    sHit: function () { g._hit = true; },
    sBoom: function () { g._boom = true; },
    announce: function (t) { g._ann = t; },
    racerTag: function (r) { return r.ch.name; },
    titleFollowKiller: function () { g._title = true; },
    resetWepMag: function (r) { r.wepAmmo = 0; },
    fl: function () { g._fl = true; },
    swp: function () { g._swp = true; },
    skillVal: function () { return 0; },
    carAbil: function () { return { nitro: { cd: 10, type: 'boost' } }; },
    LINES_DIE: ['ГОРИТ'],
    P: { x: 0, y: 0 },
    R: {
      demo: false, shots: [], parts: [], shocks: [], scorch: [],
      racers: [victim],
      S: Array.from({ length: 20 }, function (_, i) {
        return { x: i * 10, y: 0, nx: 0, ny: 1, ang: 0 };
      }),
      N: 20
    },
    spark: function () {},
    emitWreckFx: function () {},
    spawnCanvasSpray: function () {},
    landDust: function () {},
    boom: function () {},
    irnd4: function () { return 0; },
    nearP: function () { return false; },
    dmgRacer: function () {},
    killRacer: function () {},
    respawn: function () {},
    useNitro: function () {},
    mineExplode: function () {}
  };
  g.victim = victim;
  g.killer = killer;
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/combat-fx.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/combat.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает бой после финиша', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/combat.js'));
  assert(out.includes('/__engine/combat-fx.js'));
  assert(out.indexOf('race-finish.js') < out.indexOf('combat-fx.js'));
  assert(out.indexOf('combat-fx.js') < out.indexOf('combat.js'));
  assert(out.indexOf('combat.js') < out.indexOf('weapons.js'));
  assert(out.indexOf('weapons-tick.js') < out.indexOf('collision.js'));
  assert(engineFile('__engine/combat.js').endsWith('combat.js'));
});

test('Щит, лазер, смерть, респаун Дьявола, мина и нитро', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../rnr.html'), 'utf8');
  assert(html.includes('function dmgRacer('));
  assert(html.includes('function killRacer('));
  assert(html.includes('function respawn('));
  const g = bootCombat();
  const v = g.victim;
  v.invuln = 1;
  g.dmgRacer(v, 10, g.killer, 'proj');
  assert.equal(v.hp, 50);
  v.invuln = 0;
  v.shield = 1;
  g.dmgRacer(v, 10, g.killer, 'proj');
  assert.equal(v.shield, 0);
  assert.equal(v.hp, 50);
  v.shield = 1;
  g.R.shots = [{ laser: true, r: g.killer }];
  g.dmgRacer(v, 10, g.killer, 'proj');
  assert(v.hp < 50);
  v.hp = 5;
  v.shield = 0;
  g.dmgRacer(v, 20, g.killer, 'proj');
  assert.equal(v.dead, true);
  assert.equal(g.killer.kills, 1);
  assert(g.R.scorch.length > 0);
  v.car = { idx: 3 };
  v.trackIdx = 12;
  v.aiLane = 0;
  g.respawn(v);
  assert.equal(v.dead, false);
  assert.equal(v.invuln, 2.2);
  assert.equal(v.shield, 1);
  assert.equal(v.x, 20);
  const other = {
    dead: false, invuln: 0, finished: false, bubble: 0, shield: 0, hp: 80, maxhp: 80,
    x: 0, y: 0, isP: false, ch: { grt: 0 }, car: { idx: 0 }, buffArmor: 1, paper: 0, bodyDump: 0, cloak: 0
  };
  g.R.racers = [other];
  g.mineExplode({ x: 0, y: 0, pow: 36, rad: 100 }, g.killer);
  assert(other.hp < 80);
  g.useNitro(v);
  assert(v.nitro > 1);
  g.carAbil = function () { return { nitro: { cd: 8, type: 'jump' } }; };
  v.cdN = 0;
  v.dead = false;
  v.air = false;
  v.spd = 200;
  g.useNitro(v);
  assert.equal(v.air, true);
  assert.equal(v.jumps, 1);
});
