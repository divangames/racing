////////////////////////////////////////////////////////
//
// Сборка заезда и опасности сплайна.
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

/** Кольцо точек для трамплинов. */
function ringS(n) {
  const S = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU;
    S.push({
      x: 400 + Math.cos(a) * 200,
      y: 400 + Math.sin(a) * 200,
      nx: Math.cos(a),
      ny: Math.sin(a),
      ang: a,
      k: i % 17 === 0 ? 0.001 : 0.02
    });
  }
  return S;
}

/** Песочница заезда. */
function bootRace(previewOptions) {
  const S = ringS(80);
  const Tlab = { S: S, N: 80, lab: true, theme: { ground: '#111', dark: '#000' }, shortcuts: [], labObjects: [] };
  const g = {
    console,
    TAU,
    ROADW: 95,
    labTest: true,
    raceTrackOverride: null,
    raceTrackCustom: null,
    raceBoard: null,
    raceDiv: 0,
    raceLaps: 1,
    R: null,
    P: null,
    state: 'title',
    paused: true,
    save: { char: 0, car: 0, race: 0, bet: 0, tuning: { 0: { arm: 0, eng: 0, tir: 0, shk: 0, nit: 0 } } },
    CHARS: [{ name: 'МЕДВЕДЬ', short: 'МЕД', col: '#a00' }],
    CARS: [{ idx: 0 }],
    TRACKDEFS: [{}, {}, {}, {}, {}],
    BET_TABLE: [{ cost: 0 }, { cost: 350 }],
    SHORTCUTS: {},
    WEATHER_CLEAR: { id: 'clear', name: 'ЯСНО', mod: 1, parts: 0, col: '#fff', vis: 1 },
    document: {
      createElement: function () {
        const ctx = { fillStyle: '', fillRect: function () {} };
        return { width: 0, height: 0, getContext: function () { return ctx; } };
      }
    },
    g: { createPattern: function () { return 'pat'; } },
    mulberry: function () { return function () { return 0.4; }; },
    stats: function () { return { maxhp: 80, top: 1, acc: 1 }; },
    resetWepMag: function () {},
    aiSkillLvl: function () { return 1; },
    skillVal: function () { return 0; },
    resolveLabTrack: function () { return { lab: true, name: 'ПОЛИГОН' }; },
    buildTrack: function () { return Tlab; },
    prerender: function () { return { w: 1 }; },
    bakeMapTile: function (img) { return img; },
    pickMapTile: function () { return null; },
    makePuddles: function () { return []; },
    persist: function () {},
    resetHudFx: function () { g._hud = true; },
    clearKeys: function () { g._keys = true; },
    weatherOf: function () { return { id: 'x' }; },
    makeRacer: function () { return {}; },
    planRaceField: function () {
      return [
        {id:0,isP:true,ch:g.CHARS[0],car:g.CARS[0],lvl:{},slot:4,skill:1},
        {id:1,isP:false,ch:g.CHARS[0],car:g.CARS[0],lvl:{},slot:0,skill:.7,isBoss:true},
        {id:2,isP:false,ch:g.CHARS[0],car:g.CARS[0],lvl:{},slot:1,skill:.7},
        {id:3,isP:false,ch:g.CHARS[0],car:g.CARS[0],lvl:{},slot:2,skill:.7},
        {id:4,isP:false,ch:g.CHARS[0],car:g.CARS[0],lvl:{},slot:3,skill:.7}
      ];
    },
    makeTrackPattern: function () {},
    placeLabRamps: function () { return []; },
    placeTrackHazards: function () { return { pads: [], ramps: [], mines: [], oils: [], picks: [] }; },
    buildRace: function () {},
    restartRace: function () {},
    announce: function () {}
  };
  g.window = g;
  g.globalThis = g;
  if (previewOptions) g.DiVANLabPreview = {testOptions: function () { return previewOptions; }};
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/arena-effects.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/race-hazards.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/race-build.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает hazards и build до коллизий', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/race-hazards.js'));
  assert(out.includes('/__engine/race-build.js'));
  assert(out.indexOf('arena-effects.js') < out.indexOf('race-hazards.js'));
  assert(out.indexOf('track-paint.js') < out.indexOf('race-hazards.js'));
  assert(out.indexOf('race-hazards.js') < out.indexOf('race-build.js'));
  assert(out.indexOf('race-build.js') < out.indexOf('collision.js'));
  assert(engineFile('__engine/race-build.js').endsWith('race-build.js'));
});

test('Клетка, полигон без мин и старт лаборатории', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../content/rnr.html'), 'utf8');
  assert(html.includes('function buildRace('));
  assert(html.includes('function placeTrackHazards('));
  const g = bootRace();
  assert.equal(g.DiVANEngine.race.trackIndex(), 0);
  assert.equal(g.DiVANEngine.race.division(), 1);
  assert.equal(g.DiVANEngine.race.gridIndex(100, 5), 70);
  assert.equal(g.DiVANEngine.race.gridLat(5), 38);
  const hz = g.placeTrackHazards({ lab: true, S: ringS(200), N: 200 }, 1);
  assert.equal(hz.mines.length, 0);
  assert.equal(hz.pads.length, 0);
  assert.equal(hz.ramps.length, 2);
  assert.equal(g.weatherOf({}, true).id, 'clear');
  g.buildRace();
  assert.equal(g.state, 'race');
  assert.equal(g.R.phase, 'count');
  assert.equal(g.R.div, 1);
  assert.equal(g.P.isP, true);
  assert.equal(g._hud, true);
  assert.equal(g.R.countsForCareer, false);
  g.announce('СТАРТ', true);
  assert.equal(g.R.msg.txt, 'СТАРТ');
});

test('Площадки ускорения сохраняются и стоят отдельно от трамплина', () => {
  const g = bootRace();
  g.RnRTracks = {
    fromPlan() {
      return {
        pads: [{ x: 100, y: 100 }, { x: 180, y: 100 }, { x: 300, y: 300 }],
        ramps: [{ i: 10, x: 100, y: 100, ang: 0 }],
        mines: [], oils: [], picks: []
      };
    }
  };
  const hz = g.placeTrackHazards({ lab: false, autoHazards: false, hazardPlan: {}, N: 100, S: ringS(100) }, 1);
  assert.equal(hz.ramps.length, 1);
  assert.equal(hz.pads.length, 3);
  assert(hz.pads.every((pad) => hz.ramps.every((ramp) => Math.hypot(pad.x - ramp.x, pad.y - ramp.y) >= 85)));
  assert.equal(hz.pads[0].x, -15);
  assert.equal(hz.pads[2].x, 300);
});

test('Тест карты запускает выбранных соперников, сложность и число кругов', () => {
  const g = bootRace({opponents:3,difficulty:'hard',laps:5});
  g.buildRace();
  assert.equal(g.R.racers.length,4);
  assert.equal(g.R.racers.filter(r=>!r.isP).length,3);
  assert.equal(g.R.div,6);
  assert.equal(g.raceLaps,5);
});

test('Повтор сохраняет трассу, сетку, параметры и круги после продвижения карьеры', () => {
  const g = bootRace(); g.labTest = false; g.raceLaps = 4;
  g.buildRace();
  const first = g.R, stats = JSON.stringify(g.R.racers.map(r => r.st));
  g.save.race += 8; g.raceLaps = 9; g.R.career = {title: 'Награда получена'};
  assert(g.DiVANEngine.race.replayLastRace());
  assert.notEqual(g.R, first); assert.equal(g.R.replay, true);
  assert.equal(g.R.tIdx, first.tIdx); assert.equal(g.R.div, first.div); assert.equal(g.raceLaps, 4);
  assert.equal(JSON.stringify(g.R.racers.map(r => r.st)), stats);
  assert.equal(g.R.betStake, 0); assert.equal(g.R.countsForCareer, false);
  assert.equal(g.R.career.title, 'Награда получена');
  g.restartRace(); assert(g.R.replay); assert.equal(g.R.betStake, 0);
  g.buildRace(); assert.equal(g.R.replay, false, 'обычный новый старт не наследует повтор');
});
