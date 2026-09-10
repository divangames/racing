////////////////////////////////////////////////////////
//
// Демо-заезд титула: R/P, лидер, искры, шесть машин.
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
  'bindTitleSim', 'unbindTitleSim', 'withTitleSim', 'titleAliveLead', 'titleFollowKiller',
  'updRaceFx', 'initTitleRace', 'updateTitleRace', 'drawTitleRace'
];

/** Песочница демо титула. */
function bootTitle() {
  const pt = { x: 10, y: 20, nx: 0, ny: 1, ang: 0 };
  const g = {
    console,
    Math,
    W: 1280,
    H: 720,
    TAU: Math.PI * 2,
    TRACKDEFS: [{}],
    CARS: [{}, {}, {}, {}, {}, {}, {}, {}, {}],
    CHARS: [{ col: '#a' }, { col: '#b' }, { col: '#c' }, { col: '#d' }, { col: '#e' }, { col: '#f' }],
    R: { id: 'live' },
    P: { id: 'player' },
    titleSim: null,
    titleFocus: null,
    titleFocusHold: 0,
    titleCam: { x: 0, y: 0 },
    titleHoldR: null,
    titleHoldP: null,
    raceDiv: 0,
    buildTrack: function () {
      return { S: [pt], N: 1, labObjects: [] };
    },
    prerender: function () { return 'img'; },
    makeTrackPattern: function () {},
    placeTrackHazards: function () {
      return { pads: [], ramps: [], mines: [], oils: [], picks: [] };
    },
    makeRacer: function (ch) {
      g._made = (g._made || 0) + 1;
      return { ch: ch, dead: false, prog: 0, x: 0, y: 0, ang: 0, spd: 0 };
    },
    weatherOf: function () { return { id: 'clear' }; },
    makePuddles: function () { return []; }
  };
  HOOKS.forEach(function (name) { g[name] = function () {}; });
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/title-race.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает title-race после intro-flow', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/title-race.js'));
  assert(out.indexOf('intro-flow.js') < out.indexOf('title-race.js'));
  assert(engineFile('__engine/title-race.js').endsWith('title-race.js'));
});

test('Демо не оставляет R, лидер по prog, искры гаснут, шесть машин', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../rnr.html'), 'utf8');
  assert(html.includes('function initTitleRace('));
  assert(html.includes('function withTitleSim('));
  const g = bootTitle();
  const live = g.R;
  g.titleSim = { racers: [{ dead: true, prog: 9 }, { dead: false, prog: 1 }, { dead: false, prog: 4 }] };
  g.withTitleSim(function () {
    assert.equal(g.R, g.titleSim);
  });
  assert.equal(g.R, live);
  const lead = g.titleAliveLead();
  assert.equal(lead.prog, 4);
  const killer = { dead: false, id: 'k' };
  g.titleFollowKiller(killer);
  assert.equal(g.titleFocus, killer);
  assert.equal(g.titleFocusHold, 2.8);
  g.R = { parts: [{ t: 0.01, x: 0, y: 0, vx: 0, vy: 0 }], skids: [{ t: 1 }], shocks: [], scorch: [], floats: [] };
  g.updRaceFx(0.02);
  assert.equal(g.R.parts.length, 0);
  g.initTitleRace();
  assert.equal(g._made, 6);
  assert.equal(g.titleSim.demo, true);
  assert.equal(g.titleSim.racers.length, 6);
  assert.equal(g.raceDiv, 2);
});
