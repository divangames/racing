////////////////////////////////////////////////////////
//
// Круг сплайна: полигон, финиш, откат и двери кузова.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { enhanceHtml, engineFile } = require('../src/main/enhancements');

/** Песочница прогресса круга. */
function bootProgress() {
  const N = 40;
  const S = Array.from({ length: N }, function (_, i) {
    return { x: i * 10, y: 0 };
  });
  const racer = {
    trackIdx: 35, x: 20, y: 0, lap: 0, lapStart: 0, lastLap: 0, bestLap: 0,
    finished: false, isP: true, hp: 40, maxhp: 100, cdN: 6, cdW: 3, cdU: 8,
    car: { idx: 0 }, prog: 0, tinDoor: 0, vanDoor: 0
  };
  const g = {
    console,
    labTest: false,
    raceLaps: 3,
    fmtLap: function (t) { return String(t); },
    announce: function (t) { g._ann = t; },
    sBeep: function (n) { g._beep = n; },
    sReload: function () { g._reload = true; },
    fl: function () { g._fl = true; },
    resetWepMag: function (r) { r.wepAmmo = 99; },
    finishRacer: function (r) { r.finished = true; g._fin = r; },
    voiceSay: function (r, k) { g._voice = k; },
    R: { S: S, N: N, time: 12, demo: false },
    advanceIdx: function () {}
  };
  g.racer = racer;
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/race-progress.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает круг после ИИ и до рамок', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/race-progress.js'));
  assert(out.indexOf('ai-think.js') < out.indexOf('race-progress.js'));
  assert(out.indexOf('race-progress.js') < out.indexOf('collision.js'));
  assert(engineFile('__engine/race-progress.js').endsWith('race-progress.js'));
});

test('Полигон, финиш, откат круга и двери жести', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../rnr.html'), 'utf8');
  assert(html.includes('function advanceIdx('));
  const g = bootProgress();
  const r = g.racer;
  g.labTest = true;
  g.advanceIdx(r);
  assert.equal(r.lap, 1);
  assert.equal(r.trackIdx, 2);
  assert.equal(r.prog, 40 + 2);
  assert.equal(r.bestLap, 12);
  assert.equal(g._beep, 880);
  assert.equal(r.finished, false);

  r.trackIdx = 2; r.x = 350; r.y = 0; r.lap = 1; r.finished = false;
  g.advanceIdx(r);
  assert.equal(r.lap, 0);
  assert.equal(r.trackIdx, 38);

  g.labTest = false;
  r.trackIdx = 35; r.x = 20; r.y = 0; r.lap = 0; r.hp = 40; r.cdN = 6; r.cdW = 3; r.cdU = 8;
  g.advanceIdx(r);
  assert.equal(r.lap, 1);
  assert.equal(r.hp, 80);
  assert.equal(r.cdN, 1);
  assert(g._fl);
  assert.equal(g._ann, 'КРУГ 2 ИЗ 3');

  r.trackIdx = 35; r.x = 20; r.lap = 2; r.finished = false; r.hp = 50; r.maxhp = 100;
  g.advanceIdx(r);
  assert.equal(g._fin, r);
  assert.equal(r.finished, true);
  assert.equal(r.hp, 100);

  r.finished = true; r.lap = 3; r.trackIdx = 35; r.x = 20;
  g._fin = null;
  g.advanceIdx(r);
  assert.equal(g._fin, null);
  assert.equal(r.trackIdx, 2);

  r.finished = false; r.lap = 2; r.trackIdx = 35; r.x = 20; r.car = { idx: 11 };
  g.R.demo = true; g._fin = null;
  g.advanceIdx(r);
  assert.equal(r.lap, 0);
  assert.equal(r.tinDoor, 1);
  assert.equal(g._fin, null);
});
