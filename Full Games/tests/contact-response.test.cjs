// Реальные SAT-контакты: масса, направление удара, восстановление и обратная связь.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function load(g, file) { vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/' + file), 'utf8'), g); }
function bootImpacts() {
  const g = { console, Math, clamp: (x, a, b) => Math.max(a, Math.min(b, x)),
    carHitHalf: () => ({ hw: 27, hh: 16 }), editorCarConfig: () => null, racerDeck: r => r.deck || 0,
    kitGhost: r => !!r.ghost, kitRamIn: () => 1, kitRamOut: () => 1,
    spark() {}, dmgRacer(r, d) { r.hp -= d; }, nearP: () => false, vfxLive: () => false,
    R: { racers: [], shots: [], mines: [], spikes: [], pads: [], picks: [], parts: [] } };
  g.window = g; g.DiVANEngine = { replace(name, fn) { g[name] = fn; } };
  for (const file of ['collision.js', 'handling.js', 'world.js']) load(g, file);
  return g;
}
function impactCar(x, y, speed = 200, angle = 0, idx = 0) {
  return { x, y, spd: speed, ang: angle, lat: 0, hp: 100, maxhp: 100, car: { idx }, lvl: {},
    st: { top: 400, acc: 300, crn: 3.1, sharp: .4, grip: .72, off: .6 }, isP: true, chIdx: -1,
    trackIdx: 0, slot: 0, wheelAngle: 0, wheelRot: 0, invuln: 0, bolt: 0, nitro: 0,
    cdN: 0, cdW: 0, cdU: 0, slow: 0, drone: 0, buffDmgT: 0 };
}

test('Лобовой удар учитывает встречные скорости; расходящиеся и скользящие вдоль борта не получают урон', () => {
  const g = bootImpacts(), a = impactCar(0, 0), b = impactCar(45, 0, 200, Math.PI);
  g.R.racers = [a, b]; g.resolveRaceContact(1 / 120);
  assert(a.hp < 100 && b.hp < 100);
  assert(Math.abs(a.spd) < 25 && Math.abs(b.spd) < 25);
  assert.equal(a.ang, 0); assert.equal(b.ang, Math.PI);
  const before = [a.hp, b.hp]; a.x = 0; b.x = 45;
  g.resolveRaceContact(1 / 120);
  assert.deepEqual([a.hp, b.hp], before, 'отскок не наносит второй урон');
  const separating = impactCar(0, 0, 100, Math.PI), parked = impactCar(45, 0, 0);
  g.R.racers = [separating, parked]; g.resolveRaceContact(1 / 120);
  assert.equal(separating.hp, 100); assert.equal(separating.spd, 100);
  const fast = impactCar(0, 0, 300), slow = impactCar(0, 26, 100);
  g.R.racers = [fast, slow]; g.resolveRaceContact(1 / 120);
  assert.equal(fast.hp, 100); assert.equal(slow.hp, 100);
  assert.equal(fast.spd, 300); assert.equal(slow.spd, 100);
});

test('Масса распределяет смещение и импульс; порядок машин не меняет результат', () => {
  const simulate = reversed => {
    const g = bootImpacts(), heavy = impactCar(0, 0, 250, 0, 4), light = impactCar(45, 0, 0, 0, 7);
    g.R.racers = reversed ? [light, heavy] : [heavy, light];
    const energy = .5 * g.DiVANEngine.world.contactMass(heavy) * heavy.spd ** 2;
    g.resolveRaceContact(1 / 60);
    const after = .5 * g.DiVANEngine.world.contactMass(heavy) * heavy.spd ** 2 + .5 * g.DiVANEngine.world.contactMass(light) * light.spd ** 2;
    assert(after <= energy);
    assert(Math.abs(heavy.x) < light.x - 45);
    assert(250 - heavy.spd < light.spd);
    assert(heavy.hp > light.hp);
    return [heavy.x, light.x, heavy.spd, light.spd, heavy.hp, light.hp];
  };
  const first = simulate(false), second = simulate(true);
  first.forEach((value, i) => assert(Math.abs(value - second[i]) < 1e-8));
});

test('После финиша машины расходятся без урона; призраки и разные этажи не сталкиваются', () => {
  const g = bootImpacts(), a = impactCar(0, 0), b = impactCar(0, 26);
  a.finished = true; a.lat = 70; b.lat = -20;
  g.R.racers = [a, b]; g.resolveRaceContact(1 / 60);
  assert(a.lat < 70 && b.lat > -20);
  assert(a.lat <= b.lat, 'после импульса машины расходятся по нормали');
  assert.equal(a.hp, 100); assert.equal(b.hp, 100);
  for (const mode of ['ghost', 'deck', 'air']) {
    const x = impactCar(0, 0), y = impactCar(45, 0, 0);
    if (mode === 'deck') y.deck = 1; else x[mode] = true;
    g.R.racers = [x, y]; g.resolveRaceContact(1 / 60);
    assert.equal(x.x, 0); assert.equal(y.x, 45); assert.equal(x.hp, 100);
  }
});

test('Повторный контакт в куче не множит урон и эффекты каждый физический шаг', () => {
  const g = bootImpacts(), a = impactCar(0, 0, 220), b = impactCar(45, 0, 0);
  let sparks = 0, shakes = 0;
  g.spark = () => sparks++; g.doShake = () => shakes++;
  g.R.racers = [a, b]; g.resolveRaceContact(1 / 120);
  const hp = [a.hp, b.hp];
  for (let i = 0; i < 12; i++) {
    a.x = 0; b.x = 45; a.spd = 220; b.spd = 0;
    g.resolveRaceContact(1 / 120);
  }
  assert.deepEqual([a.hp, b.hp], hp); assert.equal(sparks, 1); assert.equal(shakes, 1);
  assert(a._contactGrace <= .28 && b._contactGrace <= .28);
});

test('Восстановление гасит снос, не выключает газ и не вращает кузов при 30/60/120 Гц', () => {
  const outcomes = [30, 60, 120].map(hz => {
    const g = bootImpacts(), r = impactCar(5000, 5000, 240);
    r.lat = 100; r._contactGrace = .28;
    Object.assign(g, { gt: 0, P: null, ROADW: 100000, introReduceMotion: true,
      settings: { graphics: { weather: false, skids: false } }, lerp: (a, b, t) => a + (b - a) * t,
      landDust() {}, wheelSprayKind: () => 'dust', inPuddle: () => false });
    Object.assign(g.R, { S: [{ x: 5000, y: 5000 }], N: 1, T: { w: 100000, h: 100000, theme: {} }, racers: [r], oils: [], ramps: [], skids: [] });
    load(g, 'driving.js');
    for (let i = 0; i < hz * .6; i++) { g.gt += 1 / hz; g.stepVehicle(r, 1, 0, 1 / hz, false); g.resolveRaceContact(1 / hz); }
    assert.equal(r._contactGrace, 0); assert.equal(r.ang, 0);
    assert(Math.abs(r.lat) < 4); assert(r.spd > 300);
    return r.lat;
  });
  assert(Math.max(...outcomes) - Math.min(...outcomes) < .4);
});

test('Боковой удар ограничен и не вращает кузов; тихое касание звучит один раз', () => {
  const g = bootImpacts(), a = impactCar(0, 0, 500, Math.PI / 2, 4), b = impactCar(0, 26, 0, 0, 7);
  g.R.racers = [a, b]; g.resolveRaceContact(1 / 60);
  assert(Math.abs(b.lat) <= 100); assert.equal(a.ang, Math.PI / 2); assert.equal(b.ang, 0);
  let sounds = 0; g.sHit = () => sounds++;
  const c = impactCar(0, 0, 40), d = impactCar(45, 0, 0);
  g.R.racers = [c, d]; g.resolveRaceContact(1 / 60);
  assert.equal(c.hp, 100); assert.equal(d.hp, 100); assert.equal(sounds, 1);
});
