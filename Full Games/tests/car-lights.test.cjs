'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const lights = require('../src/engine/car-lights');
const { validateCar } = require('../src/main/document-store');

const plain = value => JSON.parse(JSON.stringify(value));
const source = name => fs.readFileSync(path.resolve(__dirname, '..', name), 'utf8');

test('Старые машины сохраняют автоматические позиции; пустая группа выключает только её', () => {
  const half = { hw: 30, hh: 15 };
  const expected = { head: [[25.2, -9.3], [25.2, 9.3]], brake: [[-25.2, -9.3], [-25.2, 9.3]] };
  assert.deepEqual(lights.resolve(null, half), expected);
  assert.deepEqual(lights.resolve({ lights: {} }, half), expected);
  assert.deepEqual(lights.resolve({ lights: { head: [] } }, half), { head: [], brake: expected.brake });
  assert.deepEqual(lights.resolve({ lights: { brake: [] } }, half), { head: expected.head, brake: [] });
  assert.deepEqual(lights.resolve({}, { hw: 1, hh: 1 }), {
    head: [[16, -6], [16, 6]], brake: [[-16, -6], [-16, 6]]
  });
});

test('Ручные координаты независимы от размеров и смещения кузова, результат не меняет документ', () => {
  const car = { body: { x: 17, y: -3, scale: 1.65, sx: 2, sy: .5 }, lights: { head: [[40, -12], [40, 12]], brake: [[-50, 0]] } };
  const resolved = lights.resolve(car, { hw: 110, hh: 20 });
  assert.deepEqual(resolved, car.lights);
  resolved.head[0][0] = 400;
  resolved.brake.push([0, 0]);
  assert.deepEqual(car.lights, { head: [[40, -12], [40, 12]], brake: [[-50, 0]] });
});

test('Проверка световых точек до сохранения не принимает строки, NaN, длинные и разреженные массивы', () => {
  const maximum = Array.from({ length: 8 }, () => [-500, 500]);
  assert.equal(lights.validate({ head: maximum, brake: [] }), null);
  for (const bad of [false, [], { head: null }, { head: [[1, '2']] }, { head: [[NaN, 2]] },
    { head: [[Infinity, 2]] }, { head: [[501, 0]] }, { head: [[0, -501]] }, { head: [[0, 0, 0]] },
    { head: Array(2) }, { head: [Array(2)] }, { brake: Array.from({ length: 9 }, () => [0, 0]) }]) {
    assert.equal(typeof lights.validate(bad), 'string', JSON.stringify(bad));
    assert.equal(typeof validateCar({ body: {}, w: [], lights: bad }), 'string');
  }
  assert.equal(validateCar({ body: {}, w: [], lights: { head: maximum } }), null);
  assert.equal(validateCar({ body: {}, w: [] }), null);
});

test('Повреждённая группа безопасно заменяется авто, корректная и отключённая не теряются', () => {
  const expected = lights.resolve({}, { hw: 27, hh: 16 });
  assert.deepEqual(lights.resolve({ lights: { head: [[Infinity, 0]], brake: [] } }, { hw: 27, hh: 16 }), {
    head: expected.head, brake: []
  });
  assert.deepEqual(lights.resolve({ lights: { head: [[3, 4]], brake: [null] } }, { hw: NaN, hh: Infinity }), {
    head: [[3, 4]], brake: expected.brake
  });
});

function editorContext() {
  const storage = new Map();
  const requests = [];
  const context = vm.createContext({
    RnRCarLights: lights, console,
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    fetch: (url, options) => { requests.push({ url, options }); return Promise.resolve({ ok: true }); }
  });
  vm.runInContext(source('content/editor/data.js') + '\nthis.data = EditorData;', context);
  return { data: context.data, requests };
}

test('Позиции проходят редактор, JSON, localStorage, базу и бэкап; старый документ не получает лишних точек', async () => {
  const { data, requests } = editorContext();
  const custom = { head: [[38.5, -13], [38.5, 13]], brake: [] };
  const car = data.mergeCar(6, { lights: custom });
  assert.deepEqual(plain(data.fileCar(car).lights), custom);
  assert.deepEqual(plain(data.mergeCar(6, data.fileCar(car)).lights), custom);
  assert.notEqual(car.lights.head, custom.head);
  data.save({ cars: { 6: car } });
  assert.deepEqual(plain(data.load().cars[6].lights), custom);
  await data.saveAsBase(6, car);
  await data.saveBackup(6, car);
  assert.equal(requests.length, 2);
  for (const request of requests) {
    assert.equal(request.url, '/__save-car');
    assert.deepEqual(JSON.parse(request.options.body).car.lights, custom);
  }
  assert.equal(Object.hasOwn(data.fileCar(data.factory(0)), 'lights'), false);
  assert.equal(Object.hasOwn(data.mergeCar(0, { body: { x: 3 } }), 'lights'), false);
  assert.deepEqual(plain(data.fileCar(data.mergeCar(0, { lights: { brake: [] } })).lights), { brake: [] });
});

function drivingContext(config) {
  let count = 0;
  const atlasContext = {
    createRadialGradient: () => ({ addColorStop() {} }), createLinearGradient: () => ({ addColorStop() {} }),
    fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {}
  };
  const context = vm.createContext({
    RnRCarLights: lights, DiVANEngine: { replace() {} },
    editorCarConfig: idx => { assert.equal(idx, 6); return config; },
    carHitHalf: () => ({ hw: 30, hh: 15 }),
    document: { createElement: () => ({ id: count++, getContext: () => atlasContext }) }
  });
  vm.runInContext(source('src/engine/car-fx.js'), context);
  const calls = [];
  const canvas = { globalAlpha: .8, save() {}, restore() {}, translate() {}, rotate() {},
    drawImage: (atlas, ...args) => calls.push({ atlas: atlas.id, args }) };
  return { calls, draw: options => context.DiVANEngine.carFx.drawDrivingLights(canvas,
    { car: { idx: 6 }, x: 10, y: 20, ang: .3, isP: true }, options) };
}

test('Гонка рисует ручные фары и стопы в координатах редактора и учитывает отключённые группы', () => {
  const { calls, draw } = drivingContext({ body: { x: 8, y: -2, scale: 1.65 }, lights: { head: [[41, 13]], brake: [[-32, 7]] } });
  draw({ quality: 2, brake: true });
  assert.deepEqual(calls, [
    { atlas: 0, args: [41, -18, 98, 62] },
    { atlas: 1, args: [31, 3, 20, 20] },
    { atlas: 2, args: [-48, -9, 32, 32] }
  ]);
  const off = drivingContext({ lights: { head: [], brake: [] } });
  off.draw({ quality: 2, brake: true });
  assert.equal(off.calls.length, 0);
});

test('Гонка сохраняет размеры и авто-позиции прежнего света', () => {
  const { calls, draw } = drivingContext(null);
  draw({ quality: 2, brake: false });
  assert.equal(calls.length, 6);
  const head = calls.filter(call => call.atlas === 1);
  const brake = calls.filter(call => call.atlas === 2);
  assert.deepEqual(head, [
    { atlas: 1, args: [15.2, -19.3, 20, 20] }, { atlas: 1, args: [15.2, -.6999999999999993, 20, 20] }
  ]);
  assert.deepEqual(brake, [
    { atlas: 2, args: [-33.2, -17.3, 16, 16] }, { atlas: 2, args: [-33.2, 1.3000000000000007, 16, 16] }
  ]);
});
