// Возврат ищет свободную позицию с учётом живого тактического забора и реального OBB кузова.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function boot(angle, broken) {
  const ca = Math.cos(angle), sa = Math.sin(angle), N = 50, index = 20;
  const S = Array.from({ length: N }, (_, i) => ({
    x: 1000 + (i - index) * 14 * ca, y: 1000 + (i - index) * 14 * sa, ang: angle, nx: -sa, ny: ca
  }));
  const p = S[index];
  const player = { isP: true, car: { idx: 0 }, x: p.x, y: p.y, ang: angle, trackIdx: index,
    lap: 0, prog: index, hp: 65, maxhp: 100, wepAmmo: 17, cdW: 2, cdN: 3, cdU: 4 };
  // Один сосед закрывает центр и внешнюю полосу, но оставляет внутренние +48 свободными.
  const other = { car: { idx: 1 }, x: p.x - p.nx * 30, y: p.y - p.ny * 30, ang: angle, trackIdx: index };
  const gate = { x: p.x + p.nx * 48, y: p.y + p.ny * 48, angle, halfWidth: 8, halfSpan: 32, hp: broken ? 0 : 32, broken };
  const c = { console, P: player, state: 'race', ROADW: 95,
    R: { phase: 'go', time: 1, S, N, T: { w: 2000, h: 2000 }, racers: [player, other], tacticGate: gate },
    carHitHalf: () => ({ hw: 27, hh: 16 }), carObb() {}, pointInObb() {}, obbOverlap() {}, stepVehicle() {},
    inTrackGap: () => false, clearKeys() {}, announce() {}
  };
  c.window = c; c.DiVANEngine = { replace(name, fn) { c[name] = fn; }, wrap(name, make) { c[name] = make(c[name]); } };
  vm.createContext(c);
  for (const file of ['collision.js', 'race-recovery.js']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../src/engine', file), 'utf8'), c);
  return { c, gate, index, p };
}
function overlap(c, gate) {
  return c.obbOverlap(c.carObb(c.P), { cx: gate.x, cy: gate.y, hw: gate.halfWidth, hh: gate.halfSpan,
    ca: Math.cos(gate.angle), sa: Math.sin(gate.angle) });
}

test('Возврат не ставит корпус в целый забор при занятом объезде и не продвигает игрока', () => {
  for (const angle of [0, .7, Math.PI / 2, -2.4]) {
    const { c, gate, index } = boot(angle, false), before = { hp: c.P.hp, ammo: c.P.wepAmmo, cd: c.P.cdW };
    const result = c.DiVANEngine.recovery.recover();
    assert(result.ok); assert(result.rolledBack); assert(c.P.trackIdx < index); assert(c.P.prog <= index);
    assert.equal(overlap(c, gate), null, 'возвращённый корпус не перекрывает повёрнутый забор');
    assert.equal(c.P.hp, before.hp); assert.equal(c.P.wepAmmo, before.ammo); assert.equal(c.P.cdW, before.cd);
    assert.equal(gate.hp, 32); assert.equal(gate.broken, false);
  }
});

test('Разрушенный забор освобождает внутреннюю полосу для возврата на том же участке', () => {
  for (const angle of [0, .7, Math.PI / 2, -2.4]) {
    const { c, gate, index } = boot(angle, true);
    const result = c.DiVANEngine.recovery.recover();
    assert(result.ok); assert.equal(result.rolledBack, false); assert.equal(c.P.trackIdx, index); assert.equal(c.P.prog, index);
    assert(Math.hypot(c.P.x - gate.x, c.P.y - gate.y) < 1e-9, 'обломки больше не занимают место');
  }
});

test('Если свободного места вне целого забора нет, возврат не перемещает машину', () => {
  const { c, index } = boot(.7, false), before = { x: c.P.x, y: c.P.y, hp: c.P.hp, prog: c.P.prog };
  c.inTrackGap = (_track, fraction) => Math.round(fraction * c.R.N) !== index;
  const result = c.DiVANEngine.recovery.recover();
  assert.equal(result.ok, false); assert.equal(result.reason, 'НЕТ СВОБОДНОГО МЕСТА');
  assert.deepEqual({ x: c.P.x, y: c.P.y, hp: c.P.hp, prog: c.P.prog }, before);
});
