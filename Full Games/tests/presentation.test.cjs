'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function boot(count = 1) {
  const draws = [], media = { matches: false };
  const canvas = {
    globalAlpha: 1,
    save() {}, restore() {}, beginPath() {}, rect() {}, clip() {}, moveTo() {}, lineTo() {},
    stroke() { draws.push('stroke'); }, fill() {}, arc() {}, fillRect() {},
    createRadialGradient() { return { addColorStop() {} }; }
  };
  const player = { x: 200, y: 200, ang: 0, spd: 420, lat: 35, st: { top: 440 },
    car: { idx: 0 }, isP: true, hp: 100, maxhp: 100, nitro: 10, bolt: 0 };
  const racers = Array.from({ length: count }, (_, i) => i ? { ...player, isP: false, car: { idx: i } } : player);
  const c = {
    console, settings: { graphics: { particles: 'high' } }, P: player,
    R: { racers, time: 0, sx: 0, sy: 0 }, paused: false, state: 'race',
    g: canvas, TAU: Math.PI * 2, viewW: 1280, viewH: 720,
    matchMedia: () => media, hudMotionOk: () => true,
    stepVehicle(r, throttle, steer, dt, handbrake) {
      r.x += Math.cos(r.ang) * r.spd * dt; r.y += Math.sin(r.ang) * r.spd * dt; r.handbrake = handbrake;
    },
    updRace(dt) {
      c.R.time += dt;
      for (const r of c.R.racers) c.stepVehicle(r, c.throttle == null ? 1 : c.throttle, 0, dt, false);
    },
    drawCar() { draws.push('body'); }, drawHudCockpit() {}, drawRaceArena() {}, drawRaceWorld() {},
    dmgRacer(r, damage) { if (!r.shield) r.hp = Math.max(0, r.hp - damage); return 'result'; }
  };
  c.DiVANEngine = {
    carFx: { drawDrivingLights(_ctx, _r, options) { draws.push({ lights: options }); } },
    wrap(name, factory) { c[name] = factory(c[name]); },
    replace(name, impl) { c[name] = impl; }
  };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/presentation.js'), 'utf8'), c);
  return { c, draws, media };
}

test('Следы и пыль сохраняют плотность на 30 и 144 Гц и ограничены при большом пелотоне', () => {
  const run = fps => {
    const { c } = boot(16);
    for (let i = 0; i < fps * 3; i++) c.updRace(1 / fps);
    return { c, stats: c.DiVANEngine.presentation.stats() };
  };
  const low = run(30), high = run(144);
  assert.equal(low.stats.particles, high.stats.particles);
  assert.equal(low.stats.trails, high.stats.trails);
  assert.ok(low.stats.particles > 0 && low.stats.particles <= 140);
  assert.ok(low.stats.trails > 0 && low.stats.trails <= 16 * 9);
  assert.ok(Math.abs(low.stats.speed - high.stats.speed) < 1e-9);
  high.c.settings.graphics.particles = 'low'; high.c.updRace(1 / 60);
  const reduced = high.c.DiVANEngine.presentation.stats();
  assert.ok(reduced.particles <= 32);
  assert.equal(reduced.trails, 0);
});

test('Reduced motion очищает движение и тряску, сохраняя спокойный свет машин', () => {
  const { c, media, draws } = boot();
  c.updRace(.25); c.dmgRacer(c.P, 10);
  assert.ok(c.DiVANEngine.presentation.stats().trails > 1);
  media.matches = true; c.R.sx = 5; c.R.sy = 4; c.updRace(1 / 60);
  const stats = c.DiVANEngine.presentation.stats();
  assert.equal(stats.particles, 0); assert.equal(stats.trails, 0);
  assert.equal(stats.speed, 0); assert.equal(stats.impact, 0);
  assert.equal(c.R.sx, 0); assert.equal(c.R.sy, 0);
  c.drawCar(c.g, c.P, 1); c.drawRaceWorld();
  assert.ok(draws.some(item => item.lights));
  assert.ok(!draws.includes('stroke'));
});

test('Камуфляж не выдаётся следом или светом, а стоп-сигналы загораются до отрисовки кузова', () => {
  const { c, draws } = boot();
  c.throttle = -1; c.updRace(1 / 60); c.drawCar(c.g, c.P, 1);
  assert.equal(draws[0].lights.brake, true); assert.equal(draws[1], 'body');
  draws.length = 0; c.P.cloak = 3; c.updRace(.25); c.drawCar(c.g, c.P, 1);
  assert.deepEqual(draws, ['body']); assert.equal(c.DiVANEngine.presentation.stats().trails, 0);
});

test('Телепорт обрывает нитро, смена гонки очищает эффекты, щит не даёт ложный урон', () => {
  const { c } = boot();
  c.updRace(.2); assert.ok(c.DiVANEngine.presentation.stats().trails > 1);
  c.P.x += 1000; c.updRace(1 / 30);
  assert.equal(c.DiVANEngine.presentation.stats().trails, 1);
  c.P.shield = 1; assert.equal(c.dmgRacer(c.P, 40), 'result');
  assert.equal(c.DiVANEngine.presentation.stats().impact, 0);
  c.P.shield = 0; c.dmgRacer(c.P, 40);
  assert.ok(c.DiVANEngine.presentation.stats().impact > 0);
  c.R = { racers: [], time: 0, sx: 0, sy: 0 }; c.updRace(1 / 120);
  assert.equal(c.DiVANEngine.presentation.stats().trails, 0);
  assert.equal(c.DiVANEngine.presentation.stats().particles, 0);
  assert.equal(c.DiVANEngine.presentation.stats().impact, 0);
});

test('Линии скорости используют фактический снос и не появляются на стоящей машине', () => {
  const { c } = boot();
  const fx = c.DiVANEngine.presentation;
  c.P.ang = Math.PI / 2; c.P.spd = 100; c.P.lat = 20;
  const v = fx.velocity(c.P);
  assert.ok(Math.abs(v.x + 20) < 1e-9); assert.ok(Math.abs(v.y - 100) < 1e-9);
  c.P.spd = 0; assert.equal(fx.speedIntensity(c.P), 0);
  c.settings.graphics.particles = 'off'; c.updRace(.25);
  assert.equal(fx.budget(), 0); assert.equal(fx.stats().particles, 0); assert.equal(fx.stats().trails, 0);
});
