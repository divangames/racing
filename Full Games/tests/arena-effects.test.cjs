'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = { Math };
context.window = context;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/engine/arena-effects.js'), 'utf8'), context);
const effects = context.RnRArenaEffects;

test('трамплин запускает только при прямом въезде по ходу трассы', () => {
  const ramp = { x: 100, y: 100, ang: 0 };
  assert.equal(effects.canLaunchRamp({ x: 110, y: 100, ang: 0, spd: 170 }, ramp), true);
  assert.equal(effects.canLaunchRamp({ x: 110, y: 100, ang: Math.PI, spd: 170 }, ramp), false);
  assert.equal(effects.canLaunchRamp({ x: 110, y: 135, ang: 0, spd: 170 }, ramp), false);
  assert.equal(effects.canLaunchRamp({ x: 150, y: 100, ang: 0, spd: 170 }, ramp), false);
  assert.equal(effects.canLaunchRamp({ x: 110, y: 100, ang: 0, spd: -170 }, ramp), false);
  assert.equal(effects.canLaunchRamp({ x: 105, y: 100, ang: 0, spd: 110 }, { ...ramp, gap: true }), true);
});

test('три стрелки ускорения зажигаются по очереди, мина мигает', () => {
  const fills = [];
  const ctx = {
    save() {}, restore() {}, translate() {}, rotate() {}, beginPath() {},
    moveTo() {}, lineTo() {}, closePath() {}, arc() {},
    fill() { fills.push({ color: this.fillStyle, blur: this.shadowBlur }); }
  };
  const lit = [0, .21, .41].map((time) => effects.drawPadLights(ctx, 0, 0, 0, time, true));
  assert.deepEqual(lit, [0, 1, 2]);
  assert.equal(fills.filter((call) => call.color === 'rgba(183,255,245,.98)').length, 3);
  fills.length = 0;
  effects.drawPadLights(ctx, 0, 0, 0, .1, false);
  assert(!fills.some((call) => call.color === 'rgba(183,255,245,.98)'));
  assert.equal(effects.drawMineLight(ctx, 0, 0, 0, 0), true);
  assert.equal(effects.drawMineLight(ctx, 0, 0, .35, 0), false);
});

test('бонусы освещают трассу, ускорение не получает ореол', () => {
  const stops = [];
  let gradients = 0;
  const ctx = {
    save() {}, restore() {}, beginPath() {}, arc() {}, fill() {},
    createRadialGradient() {
      gradients++;
      return { addColorStop(position, color) { stops.push([position, color]); } };
    }
  };
  for (const type of ['money', 'wrench', 'wep', 'ult', 'nit', 'shield', 'bolt']) {
    assert.equal(effects.drawPickupGlow(ctx, type, 0, 0, 0, 0), true);
  }
  assert.equal(gradients, 7);
  assert(stops.some(([position, color]) => position === 0 && !color.endsWith(',0)')));
  assert.equal(effects.drawPickupGlow(ctx, 'pad', 0, 0, 0, 0), false);
  assert.equal(gradients, 7);
});
