////////////////////////////////////////////////////////
//
// Тик ИИ: реверс, ствол, торможение в повороте, съезд.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { enhanceHtml, engineFile } = require('../src/main/enhancements');

/** Песочница тика ИИ. */
function bootAi() {
  const spline = Array.from({ length: 64 }, function (_, i) {
    return { x: i * 12, y: 0, nx: 0, ny: 1, k: 0, ang: 0 };
  });
  const racer = {
    laneT: 4, aiLane: 0, spd: 0, trackIdx: 0, x: 0, y: 0, ang: 0,
    revT: 0, stuckT: 2.6, cdW: 0, cdN: 0, cdU: 0, nitro: 0, skill: 1,
    hp: 80, maxhp: 80, car: { idx: 0 }, wepOver: 0, wepAmmo: 0, ith: 0, ist: 0, pitSide: null
  };
  const g = {
    console,
    _rand: 0.99,
    Math: {
      PI: Math.PI,
      abs: Math.abs,
      sin: Math.sin,
      cos: Math.cos,
      atan2: Math.atan2,
      hypot: Math.hypot,
      random: function () { return g._rand; }
    },
    clamp: function (n, a, b) { return n < a ? a : n > b ? b : n; },
    rnd: function () { return 0; },
    angDiff: function (a, b) {
      let d = a - b;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      return d;
    },
    kitAiWantsFire: function () { return false; },
    wepMagMax: function () { return 0; },
    carAbil: function () { return { weapon: { type: 'fang' } }; },
    fireWeapon: function (r) { g._fired = r; },
    useNitro: function (r) { g._nitro = r; },
    useUlt: function (r) { g._ult = r; },
    ROADW: 140,
    R: { S: spline, N: spline.length, racers: [racer], demo: false },
    aiThink: function () {},
    finishDrive: function () { return { th: 0, st: 0 }; }
  };
  g.racer = racer;
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/ai-think.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает тик ИИ после оружия и до рамок', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/ai-think.js'));
  assert(out.indexOf('weapons-tick.js') < out.indexOf('ai-think.js'));
  assert(out.indexOf('ai-think.js') < out.indexOf('collision.js'));
  assert(out.indexOf('ai-think.js') < out.indexOf('scene.js'));
  assert(engineFile('__engine/ai-think.js').endsWith('ai-think.js'));
});

test('Реверс при застревании, огонь, тормоз в повороте и съезд', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../rnr.html'), 'utf8');
  assert(html.includes('function aiThink('));
  assert(html.includes('function finishDrive('));
  const g = bootAi();
  const r = g.racer;
  g.aiThink(r, 0.016);
  assert(r.revT > 0);
  assert.equal(r.ith, -1);
  assert.equal(r.stuckT, 0);

  r.revT = 0; r.stuckT = 0; r.spd = 200; r.cdW = 0;
  g.R.S[24].k = 0.02;
  g.aiThink(r, 0.016);
  assert.equal(r.ith, -0.15);

  const prey = { dead: false, finished: false, x: 40, y: 0 };
  g.R.racers = [r, prey];
  g.kitAiWantsFire = function () { return true; };
  g._rand = 0;
  r.spd = 80; r.revT = 0; r.stuckT = 0; r.cdU = 1; r.cdN = 1;
  g.aiThink(r, 1);
  assert.equal(g._fired, r);

  r.x = 10; r.y = 20; r.spd = 80; r.trackIdx = 0; r.pitSide = null;
  g.R.racers = [r];
  const d = g.finishDrive(r);
  assert.equal(r.pitSide, 1);
  assert.equal(d.th, -0.12);
  assert(d.st >= -1 && d.st <= 1);
});
