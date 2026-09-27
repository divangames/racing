// Проверка выбора колёс, оси спрайт-листа и автоповорота вертикальных кадров.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const sprites = require('../src/engine/wheel-sprites');
const lights = require('../src/engine/car-lights');

test('Каталог принимает только известные комплекты', () => {
  assert.equal(sprites.normalize('offroad'), 'offroad');
  assert.equal(sprites.normalize('standard'), 'standard');
  assert.equal(sprites.normalize('unknown'), 'standard');
  assert.equal(sprites.DEFINITIONS.offroad.sources[0], 'assets/machines/wheels/wheel-offroad.png');
});

test('Горизонтальная и вертикальная ленты режутся по своей оси', () => {
  assert.deepEqual(sprites.layout({ naturalWidth: 1024, naturalHeight: 96 }, 8), {
    frames: 8, verticalStrip: false, frameWidth: 128, frameHeight: 96, rotated: false
  });
  assert.deepEqual(sprites.layout({ naturalWidth: 96, naturalHeight: 1024 }, 8), {
    frames: 8, verticalStrip: true, frameWidth: 96, frameHeight: 128, rotated: true
  });
  const offroad = sprites.layout({ naturalWidth: 2172, naturalHeight: 724 }, 8);
  assert.equal(offroad.verticalStrip, false);
  assert.equal(offroad.frameWidth, 271.5);
  assert.equal(offroad.rotated, true);
});

test('Неравные промежутки между кадрами дают восемь реальных областей, а не равную сетку', () => {
  const projection = [0, 4, 5, 0, 0, 7, 8, 9, 0, 6, 6, 0, 0, 5, 0, 9, 9, 0, 0, 4, 4, 0, 8, 0, 0, 6, 6, 0];
  assert.deepEqual(sprites.activeRuns(projection, 1), [
    { start: 1, end: 2 }, { start: 5, end: 7 }, { start: 9, end: 10 }, { start: 13, end: 13 },
    { start: 15, end: 16 }, { start: 19, end: 20 }, { start: 22, end: 22 }, { start: 25, end: 26 }
  ]);
});

test('Вертикально нарисованный кадр поворачивается и сохраняет логический размер', () => {
  const calls = [];
  const context = {
    save: () => calls.push(['save']), translate: (x, y) => calls.push(['translate', x, y]),
    rotate: angle => calls.push(['rotate', angle]),
    drawImage: (...args) => calls.push(['drawImage', ...args]), restore: () => calls.push(['restore'])
  };
  const image = { complete: true, naturalWidth: 2172, naturalHeight: 724 };
  assert.equal(sprites.draw(context, image, 3, 12, 6, 8, {x: 10, y: -5}), true);
  assert.deepEqual(calls[0], ['save']);
  assert.deepEqual(calls[1], ['translate', 1.2, -0.3]);
  assert.deepEqual(calls[2], ['rotate', Math.PI / 2]);
  assert.deepEqual(calls[3].slice(-4), [-3, -6, 6, 12]);
  assert.deepEqual(calls[4], ['restore']);
});

test('Выбор внедорожных колёс проходит JSON-цикл редактора', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../content/editor/data.js'), 'utf8');
  const context = vm.createContext({
    RnRCarLights: lights,
    RnRWheelSprites: sprites,
    localStorage: { getItem: () => null, setItem() {} },
    fetch: () => Promise.resolve({ ok: true })
  });
  vm.runInContext(source + '\nthis.data = EditorData;', context);
  const car = context.data.factory(0);
  car.wheelStyle = 'offroad';
  car.wheelCenter = {x: 12.5, y: -4};
  car.bodySrc = 'assets/data/cars/01/mods/body-test.webp';
  const saved = context.data.fileCar(car);
  assert.equal(saved.wheelStyle, 'offroad');
  assert.deepEqual(JSON.parse(JSON.stringify(saved.wheelCenter)), {x: 12.5, y: -4});
  assert.equal(saved.bodySrc, car.bodySrc);
  assert.equal(context.data.mergeCar(0, saved).wheelStyle, 'offroad');
  assert.deepEqual(JSON.parse(JSON.stringify(context.data.mergeCar(0, saved).wheelCenter)), {x: 12.5, y: -4});
  assert.equal(context.data.mergeCar(0, { wheelStyle: 'broken' }).wheelStyle, 'standard');
  assert.equal(context.data.mergeCar(0, {bodySrc: '../bad.png'}).bodySrc, undefined);
});
