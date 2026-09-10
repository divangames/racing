////////////////////////////////////////////////////////
//
// Сплайн трассы DiVANEngine без холста.
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

/** Песочница геометрии трассы. */
function bootTrack() {
  const g = {
    console,
    TAU,
    angDiff: function (a, b) {
      let d = (a - b) % TAU;
      if (d > Math.PI) d -= TAU;
      if (d < -Math.PI) d += TAU;
      return d;
    },
    mulberry: function (seed) {
      return function () {
        seed |= 0;
        seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    },
    R: null,
    buildTrack: function () { return {}; },
    distToTrack: function () { return 0; },
    roadMaterial: function () { return 'asphalt'; },
    makePuddles: function () { return []; },
    inPuddle: function () { return false; },
    racerRoadMat: function () { return 'asphalt'; },
    wheelSprayKind: function () { return 'dust'; }
  };
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/track.js'), 'utf8'), g);
  return g;
}

test('Заезд отдаёт файл трассы', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/track.js'));
  assert(engineFile('__engine/track.js').endsWith('track.js'));
});

test('Квадрат контрольных точек даёт замкнутый сплайн и зоны', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../rnr.html'), 'utf8');
  assert(html.includes('function buildTrack('));
  assert(html.includes('function roadMaterial('));
  const g = bootTrack();
  const T = g.buildTrack({
    name: 'ПОЛИГОН',
    theme: { ground: '#111', line: '#222' },
    cps: [[0, 0], [200, 0], [200, 200], [0, 200]],
    zones: [{ from: 0, to: 0.5, material: 'ice' }]
  }, 0);
  assert(T.S.length > 20);
  assert.equal(T.N, T.S.length);
  assert(T.w > 200);
  assert(T.h > 200);
  assert(Number.isFinite(T.S[0].x) && Number.isFinite(T.S[0].ang));
  assert.equal(g.roadMaterial(T, 0.1), 'ice');
  assert.equal(g.roadMaterial(T, 0.8), 'asphalt');
  const on = T.S[0];
  assert(g.distToTrack(T, on.x, on.y) < 40);
  g.R = { T: T, N: T.N, weather: { id: 'clear' }, puddles: [] };
  assert.equal(g.wheelSprayKind({ trackIdx: 0, x: 0, y: 0 }, false), 'snow');
  g.R.T = { S: T.S, N: T.N, zones: [] };
  assert.equal(g.wheelSprayKind({ trackIdx: 0, x: 0, y: 0 }, false), 'dust');
});
