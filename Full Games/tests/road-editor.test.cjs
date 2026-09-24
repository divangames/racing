// Проверяет геометрию редактора дороги и различие перекрёстка с эстакадой в заезде.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

/** Загружает геометрию и игровую сборку в изолированный контекст. */
function load() {
  const replaced = {};
  const context = {
    DiVANEngine: {replace: (name, value) => { replaced[name] = value; }},
    angDiff: (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b))
  };
  vm.createContext(context);
  for (const file of ['editor/road-geometry.js', 'track-span.js', 'track.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'src/engine', file), 'utf8'), context);
  }
  return {geometry: context.RoadGeometry, buildTrack: replaced.buildTrack};
}

test('точка появляется на кривой, а клик вне дороги ничего не добавляет', () => {
  const {geometry} = load();
  const cps = geometry.highway([1600, 1000]);
  const initial = cps.length;
  assert.equal(geometry.insertOnCurve(cps, -5000, -5000, .3, 20), null);
  assert.equal(cps.length, initial);
  const hit = geometry.nearestCurve(cps, 1760, 640);
  assert(hit && hit.distance < 30);
  const index = geometry.insertOnCurve(cps, hit.x, hit.y, .3, 20);
  assert.equal(typeof index, 'number');
  assert.equal(cps.length, initial + 1);
  assert(Math.hypot(cps[index][0] - hit.x, cps[index][1] - hit.y) < 2);
});

test('перекрёсток остаётся на земле, эстакада поднимает одну ветвь', () => {
  const {geometry, buildTrack} = load();
  const cps = geometry.crossroads([1600, 1000]);
  const base = {id:'crossroads', name:'ПЕРЕКРЁСТОК', cps, theme:{}, zones:[], objects:[], decals:[], shortcuts:[]};
  const junction = buildTrack({...base, crossingMode:'junction'}, 0);
  const overpass = buildTrack({...base, crossingMode:'overpass'}, 0);
  assert.equal(junction.decks.length, 0);
  assert(overpass.decks.length > 0);
  assert(overpass.decks.every(deck => deck.z === 1));
  assert.equal(buildTrack({...base, crossingMode:'junction', decks: overpass.decks}, 0).decks.length, 0);
});
