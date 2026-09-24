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
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/track-span.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/track-rail.js'), 'utf8'), g);
  return g;
}

test('Заезд отдаёт файл трассы', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/track.js'));
  assert(out.includes('/__engine/track-rail.js'));
  assert(out.includes('/__engine/track-span.js'));
  assert(engineFile('__engine/track.js').endsWith('track.js'));
});

test('Вложенные эстакады не укорачивают мост, включая переход через старт', () => {
  const api=bootTrack().DiVANEngine.trackSpan;
  let result=api.mergeDecks([{from:.2,to:.6,z:1},{from:.3,to:.4,z:1}]);
  assert.equal(result.length,1);assert.equal(result[0].from,.2);assert.equal(result[0].to,.6);
  result=api.mergeDecks([{from:.8,to:.2,z:1},{from:.9,to:.1,z:1}]);
  assert.equal(result.length,1);assert.equal(result[0].from,.8);assert.equal(result[0].to,.2);
});

test('Прыжок под мостом сохраняет нижний этаж машины', () => {
  const g=bootTrack();
  g.R={N:100,T:{decks:[{from:.5,to:.8,z:1}]}};
  const lower={trackIdx:20,air:true,z:40},upper={trackIdx:60,air:true,z:40};
  assert.equal(g.racerDeck(lower),0);assert.equal(g.racerDeck(upper),1);
  lower.air=false;lower.z=0;assert.equal(g.racerDeck(lower),0);
});

test('Заданный автором верхний маршрут не дополняется автоматическим вторым этажом', () => {
  const g=bootTrack(),cps=[];
  for(let i=0;i<32;i++){const t=i/32*Math.PI*2;cps.push([800+700*Math.sin(t),700+420*Math.sin(2*t)]);}
  const T=g.buildTrack({cps,theme:{},decks:[{from:.1,to:.2,z:1}]},0);
  assert.equal(T.decks.length,1);assert.equal(T.decks[0].from,.1);assert.equal(T.decks[0].to,.2);
});

test('Квадрат контрольных точек даёт замкнутый сплайн и зоны', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../content/rnr.html'), 'utf8');
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
  const mid = g.roadMaterialBlend(T, 0.1);
  assert.equal(mid.matA, 'ice');
  assert.equal(mid.mix, 0);
  const edge = g.roadMaterialBlend({
    zones: [{ from: 0, to: 0.5, material: 'sand' }, { from: 0.5, to: 1, material: 'asphalt' }]
  }, 0.5);
  assert.ok(edge.matA === 'sand' && edge.matB === 'asphalt');
  assert.ok(edge.mix > 0.35 && edge.mix < 0.65);
  g.R = { S: [{ x: 100, y: 100, nx: 0, ny: 1 }] };
  g.carHitHalf = function () { return { hw: 20, hh: 12 }; };
  const car = { x: 100, y: 220, trackIdx: 0, air: false, dead: false, ang: 0, spd: 80, lat: 0 };
  assert.equal(g.keepOnTrack(car, 95), true);
  assert.ok(Math.abs(car.y - 100) <= 95 - 12 - 7 + 0.05);
  g._sparks = 0;
  g.spark = function () { g._sparks += 1; };
  g.gt = 2;
  g.R = { S: [{ x: 100, y: 100, nx: 0, ny: 1 }], parts: [], shocks: [] };
  const slam = { x: 100, y: 220, trackIdx: 0, air: false, dead: false, ang: 0, spd: 30, lat: 140, isP: true };
  assert.equal(g.keepOnTrack(slam, 95), true);
  assert.ok(slam.lat < 0);
  assert.ok(g._sparks > 0);
  assert.ok(g.R.parts.length > 0);
  slam.x = 100; slam.y = 220; slam.lat = 8; slam.spd = 40; slam._railFxAt = null;
  g.keepOnTrack(slam, 95);
  const lat1 = slam.lat;
  slam.y = 220;
  g.gt = 3;
  g.keepOnTrack(slam, 95);
  assert.ok(Math.abs(slam.lat - lat1) < 40);
  g.R = { T: T, N: T.N, weather: { id: 'clear' }, puddles: [] };
  assert.equal(g.wheelSprayKind({ trackIdx: 0, x: 0, y: 0 }, false), 'snow');
  g.R.T = { S: T.S, N: T.N, zones: [] };
  assert.equal(g.wheelSprayKind({ trackIdx: 0, x: 0, y: 0 }, false), 'dust');
  const cracked = g.buildTrack({
    name: 'РАЗЛОМ',
    theme: { ground: '#111', line: '#222' },
    cps: [[0, 0], [200, 0], [200, 200], [0, 200]],
    gaps: [{ from: 0.2, to: 0.28 }],
    decks: [{ from: 0.5, to: 0.62, z: 1 }]
  }, 0);
  assert.equal(g.inTrackGap(cracked, 0.24), true);
  assert.equal(g.inTrackGap(cracked, 0.1), false);
  assert.equal(g.trackDeck(cracked, 0.55), 1);
  assert.equal(g.trackDeck(cracked, 0.1), 0);
  const ramps = g.gapRampsFromTrack(cracked);
  assert.equal(ramps.length, 1);
  assert.equal(ramps[0].gap, true);
  g.R = { T: cracked, N: cracked.N };
  const iOn = Math.floor(cracked.N * 0.55);
  assert.equal(g.racerDeck({ trackIdx: iOn, air: false }), 1);
  const iSeam = Math.max(0, Math.floor(cracked.N * 0.5) - 8);
  assert.equal(g.racerDeck({ trackIdx: iSeam, air: false }), 1);
  const eight = [];
  for (let i = 0; i < 24; i++) {
    const t = i / 24 * Math.PI * 2;
    eight.push([800 + 700 * Math.sin(t), 700 + 420 * Math.sin(2 * t)]);
  }
  const T8 = g.buildTrack({ name: 'РАЗВЯЗКА', theme: { ground: '#111' }, cps: eight }, 0);
  let high = false;
  for (let i = 0; i < T8.N; i++) {
    if (g.trackDeck(T8, i / T8.N) > 0) high = true;
  }
  assert.equal(high, true);
});
