////////////////////////////////////////////////////////
//
// Скилы пилота и покупка в тренажёрке без каталога цен.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { enhanceHtml, engineFile } = require('../src/main/enhancements');

/** Песочница скилов и качалки. */
function bootSkills() {
  const g = {
    console,
    clamp: function (n, a, b) { return n < a ? a : n > b ? b : n; },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    fm: function (n) { return String(n); },
    persist: function () { g._persisted = true; },
    sHit: function () { g._hit = true; },
    SFX: { play: function (k) { g._sfx = k; } },
    SKILL_MAX: 6,
    SKILL_COSTS: [150000, 400000, 800000, 1600000, 3200000],
    SKILL_META: [{ n: 'РЕМОНТ-ДРОН' }],
    STAT_COSTS: [150000, 400000, 800000],
    STAT_NAME: { spd: 'СКОРОСТЬ', crn: 'ПОВОРОТ', grt: 'БРОНЯ' },
    CHARS: [{ spd: 3, crn: 1, grt: 2, name: 'МЕДВЕДЬ' }],
    blankCstatsMap: function () { return { 0: { spd: 0, crn: 0, grt: 0 } }; },
    save: { char: 0, cash: 200000, skills: { 0: 1 }, cstats: { 0: { spd: 1, crn: 0, grt: 0 } } },
    garMsg: '',
    garMsgT: 0,
    skillT: function () { return 0; },
    skillVal: function () { return 0; },
    SKILL_DESC: function () { return ''; },
    charEff: function () { return { spd: 0, crn: 0, grt: 0 }; },
    upgradeCharStat: function () {},
    buyGym: function () {}
  };
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/skills.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/gym-act.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает скилы до трассы и качалку после тренажёрки', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/skills.js'));
  assert(out.includes('/__engine/gym-act.js'));
  assert(out.indexOf('persist-save.js') < out.indexOf('skills.js'));
  assert(out.indexOf('skills.js') < out.indexOf('track.js'));
  assert(out.indexOf('training.js') < out.indexOf('gym-act.js'));
  assert(engineFile('__engine/skills.js').endsWith('skills.js'));
});

test('Лечение Медведя, статы качалки и потолок скила', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../rnr.html'), 'utf8');
  assert(html.includes('function skillVal('));
  assert(html.includes('function buyGym('));
  const g = bootSkills();
  assert.equal(g.skillT(1), 0);
  assert.equal(g.skillT(6), 1);
  assert.equal(g.skillVal(0, 1), 10);
  assert.equal(g.skillVal(0, 6), 2);
  assert.equal(g.skillVal(4, 6), 0);
  assert.equal(g.SKILL_DESC(1, 6), 'нитро-кд −15%');
  const eff = g.charEff(0);
  assert.equal(eff.spd, 4);
  assert.equal(eff.crn, 1);
  assert.equal(eff.grt, 2);
  g.save.cstats[0].spd = 0;
  g.save.cash = 200000;
  g.buyGym(0);
  assert.equal(g.save.cstats[0].spd, 1);
  assert.equal(g.save.cash, 50000);
  assert.equal(g.garMsg, 'НАКАЧАНО: СКОРОСТЬ');
  g.save.skills[0] = 6;
  g.buyGym(3);
  assert.equal(g.garMsg, 'МАКСИМАЛЬНЫЙ УРОВЕНЬ');
  g.save.skills[0] = 1;
  g.save.cash = 200000;
  g.buyGym(3);
  assert.equal(g.save.skills[0], 2);
  assert.equal(g._sfx, 'buy');
});
