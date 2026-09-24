////////////////////////////////////////////////////////
//
// Сплайн редактора и авто-расстановка как в заезде.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/** Загружает map-layout.js в песочницу. */
function boot() {
  const g = { Math, console };
  g.window = g;
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../content/editor/map-layout.js'), 'utf8'), g);
  return g;
}

test('Сплайн овала даёт нормали, авто ставит трамплины и бонусы', () => {
  const g = boot();
  const cps = [
    [420, 610], [1150, 420], [1980, 560], [2560, 380], [3180, 640], [3280, 1320],
    [2860, 1930], [2050, 2080], [1300, 1940], [760, 2060], [380, 1600], [300, 1000]
  ];
  const S = g.MapLayout.spline(cps);
  assert.ok(S.length > 80);
  assert.ok(Number.isFinite(S[0].nx) && Number.isFinite(S[0].ang));
  const t = { id: 'dust', autoHazards: true, cps: cps, stockIdx: 0, hazards: { ramps: [], mines: [], oils: [], pads: [] }, items: [] };
  const vis = g.MapLayout.visible(t, S);
  assert.ok(vis.ramps.length >= 1);
  assert.ok(vis.picks.length >= 10);
  t.autoHazards = false;
  t.items = [{ type: 'money', x: 1, y: 2 }];
  const hand = g.MapLayout.visible(t, S);
  assert.equal(hand.picks.length, 1);
  assert.equal(hand.ramps.length, 0);
  const again = g.MapLayout.spline(cps);
  assert.equal(again, S);
});

test('Холст карты вызывает paintDeck, не старый paintRails(сплайн)', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../content/editor/map-preview.js'), 'utf8');
  assert.match(src, /paintDeck/);
  assert.equal(src.includes('paintRails(q, S,'), false);
});
