// Проверяет настоящие kitPushShot, кулдауны, отмену подготовки и однократный захват ракеты.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function boot(type = 'plasma') {
  const c = { console, paused: false,
    clamp: (n, a, b) => Math.max(a, Math.min(b, n)), angDiff: (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b)),
    carAbil: () => ({ weapon: { type, cd: 1.4, dmg: 30, ammo: 40, overheat: 3 }, ult: {} }),
    vfxLive: () => false, nearP: () => false, sShoot() {}, spark() {}, fl() {}, boom() {}, sBoom() {}, doShake() {},
    rnd: a => a, carHitHalf: () => ({ hw: 22, hh: 12 }), dmgRacer(r, damage) { r.hp -= damage; },
    drawRaceArena() {}, drawHUD() {}, killRacer(r) { r.dead = true; }, respawn(r) { r.dead = false; },
    R: { phase: 'go', time: 0, demo: false, racers: [], shots: [], mines: [], spikes: [], shocks: [], pads: [], picks: [], parts: [], T: { w: 3000, h: 3000 } }
  };
  c.window = c; c.DiVANEngine = { replace(name, fn) { c[name] = fn; }, wrap(name, make) { c[name] = make(c[name]); } };
  vm.createContext(c);
  for (const file of ['weapons.js', 'weapons-fire.js', 'weapons-tick.js', 'collision.js', 'world.js', 'weapon-charge.js']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../src/engine', file), 'utf8'), c);
  c.racer = { car: { idx: 0 }, x: 100, y: 200, ang: 0, spd: 180, hp: 100, cdW: 0, buffDmg: 1, dmgMul: 1, wepLvl: 0, wepAmmo: 40, wepOver: 0 };
  c.R.racers = [c.racer];
  return c;
}
test('Каждое тяжёлое оружие предупреждает и выпускает один снаряд по старому курсу при 30/60/120 Гц', () => {
  for (const type of ['homing', 'mortar', 'plasma']) for (const hz of [30, 60, 120]) {
    const c = boot(type), r = c.racer, api = c.DiVANEngine.weaponCharge;
    let tracked = 0; const push = c.kitPushShot; c.kitPushShot = (...args) => { tracked++; return push(...args); };
    c.fireWeapon(r); const seconds = api.state(r).total;
    assert(api.requiresCharge(r)); assert.equal(c.R.shots.length, 0); assert.equal(r.cdW, 0);
    r.ang = Math.PI / 2; r.x += 15;
    for (let i = 0; i < Math.ceil(seconds * hz); i++) { c.fireWeapon(r); c.tickCarKits(r, 1 / hz); }
    assert.equal(c.R.shots.length, 1); assert.equal(tracked, 1); assert.equal(r.ang, Math.PI / 2); assert.equal(api.state(r), null);
    assert(r.cdW > 0); assert(c.R.shots[0].vx > 400); assert.equal(c.R.shots[0].vy, 0); assert.equal(c.R.shots[0].x, r.x + 26);
    c.fireWeapon(r); assert.equal(c.R.shots.length, 1); assert.equal(api.state(r), null);
  }
});
test('Пауза замораживает заряд; смерть, респаун, финиш, смена машины и заезда отменяют выстрел', () => {
  const c = boot(), r = c.racer; c.fireWeapon(r);
  c.paused = true; c.tickCarKits(r, 1); assert.equal(r.weaponCharge.remaining, .4); c.paused = false;
  for (const change of [() => c.killRacer(r), () => c.respawn(r), () => { r.finished = true; }, () => { r.car.idx++; }, () => { c.R = { ...c.R, shots: [] }; }]) {
    r.finished = false; r.dead = false; r.cdW = 0; c.fireWeapon(r); change(); c.tickCarKits(r, 1);
    assert.equal(c.R.shots.length, 0); assert.equal(c.DiVANEngine.weaponCharge.state(r), null);
  }
});
test('Автоматическое оружие не задержано, маскировка снимается в начале подготовки', () => {
  const c = boot('minigun'); c.fireWeapon(c.racer); assert.equal(c.R.shots.length, 1); assert.equal(c.racer.wepAmmo, 39);
  assert.equal(c.DiVANEngine.weaponCharge.requiresCharge(c.racer), false);
  const h = boot('homing'); h.racer.cloak = 2; h.fireWeapon(h.racer); assert.equal(h.racer.cloak, 0); assert(h.racer.weaponCharge);
});
test('Ракета выбирает цель впереди один раз, скорость поворота ограничена, ближний сосед не перехватывает её', () => {
  const c = boot('homing'), r = c.racer;
  const target = { car: { idx: 1 }, x: 410, y: 245, ang: 0, spd: 0, hp: 100 }, behind = { car: { idx: 2 }, x: 65, y: 205, ang: 0, spd: 0, hp: 100 };
  c.R.racers.push(target, behind); c.fireWeapon(r); c.tickCarKits(r, .45);
  const s = c.R.shots[0]; c.resolveRaceContact(.02);
  assert.equal(s.target, target); assert(s.targetLocked); assert(Math.atan2(s.vy, s.vx) <= .4 * .02 + 1e-9);
  behind.x = 300; behind.y = 195; c.resolveRaceContact(.02); assert.equal(s.target, target);
  target.cloak = 1; c.resolveRaceContact(.02); assert.equal(s.target, null);
  target.cloak = 0; c.resolveRaceContact(.02); assert.equal(s.target, null, 'сорванный захват не восстанавливается');
});
test('Резкая смена полосы срывает захват; ракета без цели не захватывает появившуюся позже', () => {
  const c = boot('homing'), r = c.racer, target = { car: { idx: 1 }, x: 350, y: 200, ang: 0, spd: 0, hp: 100 };
  c.R.racers.push(target); c.fireWeapon(r); c.tickCarKits(r, .45);
  const s = c.R.shots[0]; c.resolveRaceContact(.01); assert.equal(s.target, target);
  target.x = s.x + 5; target.y = s.y + 110; c.resolveRaceContact(.01); assert.equal(s.target, null);
  target.x = s.x + 200; target.y = s.y; c.resolveRaceContact(.01); assert.equal(s.target, null);
  r.cdW = 0; c.R.racers = [r]; c.fireWeapon(r); c.tickCarKits(r, .45);
  const empty = c.R.shots.at(-1); c.resolveRaceContact(.01); assert.equal(empty.target, null);
  c.R.racers.push({ ...target, x: empty.x + 200, y: empty.y }); c.resolveRaceContact(.01); assert.equal(empty.target, null);
});

test('Манёвр настоящего автомобиля уводит его от ракеты, прямое движение получает попадание', () => {
  function run(dodge, hz) {
    const c = boot('homing');
    Object.assign(c, { gt: 0, ROADW: 95, introReduceMotion: true, settings: { graphics: { weather: false, skids: false } },
      lerp: (a, b, t) => a + (b - a) * t, landDust() {}, wheelSprayKind: () => 'dust', inPuddle: () => false });
    const S = Array.from({ length: 200 }, (_, i) => ({ x: 20 + i * 14, y: 200, tx: 1, ty: 0, nx: 0, ny: 1, ang: 0, k: 0 }));
    Object.assign(c.R, { S, N: S.length, oils: [], ramps: [], skids: [] }); c.R.T.theme = {};
    for (const file of ['handling.js', 'driving.js', 'track-rail.js', 'race-progress.js']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../src/engine', file), 'utf8'), c);
    c.racer.y = 160;
    const target = { ...c.racer, x: 370, ang: 0, spd: 210, lat: 0, maxhp: 100, isP: true, chIdx: -1, slot: 1, trackIdx: 25, lap: 0, prog: 25,
      st: { top: 400, acc: 300, crn: 3.1, sharp: .4, grip: .72, off: .6 }, lvl: {}, wheelAngle: 0, wheelRot: 0,
      invuln: 0, bolt: 0, nitro: 0, cdN: 0, cdU: 0, slow: 0, drone: 0, buffDmgT: 0 };
    c.P = target; c.R.racers.push(target); c.fireWeapon(c.racer); c.tickCarKits(c.racer, .45);
    for (let frame = 0; frame < hz * 2.4 && c.R.shots.length; frame++) {
      const elapsed = frame / hz, steer = dodge ? elapsed < .35 ? 1 : elapsed < .7 ? -1 : 0 : 0;
      c.gt += 1 / hz; c.stepVehicle(target, .15, steer, 1 / hz, false); c.advanceIdx(target); c.resolveRaceContact(1 / hz);
      assert.equal(target._railHitN || 0, 0, 'манёвр помещается на настоящем дорожном полотне');
    }
    return target.hp;
  }
  for (const hz of [30, 60, 120]) {
    assert(run(false, hz) < 100, 'прямая траектория уязвима');
    assert.equal(run(true, hz), 100, 'смена полосы позволяет ответить');
  }
});
