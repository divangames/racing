////////////////////////////////////////////////////////
//
// Личные киты Бестии и Утюга.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function bootKits() {
  const g = {
    console,
    CAR_ABIL: [],
    TAU: Math.PI * 2,
    gt: 0,
    clamp: (n, a, b) => Math.max(a, Math.min(b, n)),
    kitUltDur: (r, n) => n,
    kitUltRad: (r, n) => n,
    fl: function () { g._flash = Array.from(arguments); },
    R: { demo: false, racers: [], shots: [], mines: [], shocks: [], slicks: [] }
  };
  g.window = g;
  g.globalThis = g;
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../content/mid-kits.js'), 'utf8'), g);
  return g;
}

test('Мьёльнир и Форестер используют пулемёт с перегревом', () => {
  const g = bootKits();
  assert.equal(g.CAR_ABIL[21].weapon.type, 'gatling');
  assert.equal(g.CAR_ABIL[22].weapon.type, 'gatling');
  assert.equal(g.CAR_ABIL[21].ult.type, 'aggro');
  assert.equal(g.CAR_ABIL[22].ult.type, 'foresterCharge');
});

test('АГР метит ближайшую машину на 10 секунд и скрывает Мьёльнир', () => {
  const g = bootKits();
  const source = { x: 0, y: 0, car: { idx: 21 } };
  const near = { x: 30, y: 0, car: { idx: 0 } };
  const far = { x: 90, y: 0, car: { idx: 1 } };
  g.R.racers = [source, far, near];
  assert.equal(g.useMidUlt(source, g.CAR_ABIL[21].ult, 'aggro', 0), true);
  assert.equal(near.aggroMark, 10);
  assert.equal(near.aggroSource, source);
  assert.equal(source.aggroIgnored, 10);
  assert.equal(far.aggroMark, undefined);
});

test('Мьёльнир автоматически уклоняется от сходящейся пули', () => {
  const g = bootKits();
  const car = { x: 0, y: 0, ang: 0, spd: 0, lat: 0, aiLane: 0, isP: true, car: { idx: 21 } };
  g.R.racers = [car];
  g.R.shots = [{ x: 100, y: 0, vx: -200, vy: 0, r: {} }];
  assert.equal(g.midThreatDodge(car), true);
  assert.notEqual(car.lat, 0);
  assert.equal(car.threatDodge, .8);
});

test('Форестер входит в прямолинейный разгон, а оба кузова отбрасывают таранящего', () => {
  const g = bootKits();
  const forester = { x: 0, y: 0, ang: 0, spd: 10, lat: 20, st: { top: 100 }, car: { idx: 22 } };
  g.useMidUlt(forester, g.CAR_ABIL[22].ult, 'foresterCharge', 0);
  assert.equal(forester.foresterCharge, 4);
  assert.ok(Math.abs(forester.spd - 115) < 1e-9);
  assert.equal(forester.lat, 0);

  const attacker = { x: 2, y: 0, ang: 0, spd: -20, lat: 0, car: { idx: 0 } };
  const before = attacker.x;
  assert.equal(g.kitMidCollisionRebound(forester, attacker, { attacker }), true);
  assert.ok(attacker.x > before);
});

test('Имена личных машин совпадают в игре и редакторе', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../content/rnr.html'), 'utf8');
  const editor = fs.readFileSync(path.resolve(__dirname, '../content/editor/data.js'), 'utf8');
  assert.match(html, /name:'«МЬЁЛЬНИР»'/);
  assert.match(html, /name:'«ФОРЕСТЕР»'/);
  assert.match(editor, /\['22', 'МЬЁЛЬНИР'\]/);
  assert.match(editor, /\['23', 'ФОРЕСТЕР'\]/);
});
