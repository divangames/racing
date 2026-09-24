'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { enhanceHtml, engineFile } = require('../src/main/enhancements');

test('Финиш отделяет дорожную разметку от верхнего слоя с рваными флагами', () => {
  const html = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(html.indexOf('/__engine/arena.js') < html.indexOf('/__engine/finish-gate.js'));
  assert(engineFile('__engine/sprites/finish-tower.png').endsWith('finish-tower.png'));
  assert(engineFile('__engine/sprites/finish-cloth-red.png').endsWith('finish-cloth-red.png'));
  assert(engineFile('__engine/sprites/finish-cloth-bone.png').endsWith('finish-cloth-bone.png'));
  const calls = [];
  const original = () => calls.push(['lab']);
  const game = { console, drawFinishZone: original, drawRaceArena() {}, ROADW: 95, gt: 0, F_D: 'sans-serif' };
  game.window = game;
  game.globalThis = game;
  game.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', host: 'game' };
  for (const name of ['runtime.js', 'arena.js', 'finish-gate.js']) {
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/engine', name), 'utf8'), game);
  }
  const canvas = new Proxy({}, {
    get(target, key) { return target[key] || ((...args) => calls.push([key, ...args])); },
    set(target, key, value) { target[key] = value; return true; }
  });
  const point = { x: 300, y: 250, ang: .4 };
  game.R = { T: { lab: true }, time: 0 };
  game.drawFinishZone(canvas, point);
  assert.deepEqual(calls, [['lab']]);

  calls.length = 0;
  game.R.T.lab = false;
  game.drawFinishZone(canvas, point);
  const paintedSquares = calls.filter(call => call[0] === 'fill' && call[1] === 'evenodd').length;
  const chippedSquares = calls.filter(call => call[0] === 'ellipse').length;
  assert(paintedSquares > 50);
  assert(chippedSquares > 0 && chippedSquares < paintedSquares / 2);
  assert(!calls.some(call => call[0] === 'fillRect' && call[3] >= 18 && call[4] >= 100));
  assert.equal(calls.filter(call => call[0] === 'fillText').length, 4);
  assert.equal(calls.filter(call => call[0] === 'strokeText').length, 2);
  calls.length = 0;
  game.DiVANEngine.render.drawFinishGateOverhead(canvas, point);
  assert.equal(calls.filter(call => call[0] === 'fill' && call[1] === 'evenodd').length, 11);
  assert.equal(calls.find(call => call[0] === 'fill')[1], 'evenodd');
  assert(calls.some(call => call[0] === 'scale' && call[1] === .62 && call[2] === .62));
  assert(calls.some(call => call[0] === 'fillText' && call[1] === 'ФИНИШ'));
  const firstFrame = calls.filter(call => call[0] === 'lineTo').map(call => call.slice(1));
  calls.length = 0;
  game.gt = 1.5;
  game.DiVANEngine.render.drawFinishGateOverhead(canvas, point);
  assert.deepEqual(firstFrame, calls.filter(call => call[0] === 'lineTo').map(call => call.slice(1)));
  calls.length = 0;
  game.R.time = 1.5;
  game.DiVANEngine.render.drawFinishGateOverhead(canvas, point);
  const nextFrame = calls.filter(call => call[0] === 'lineTo').map(call => call.slice(1));
  assert.notDeepEqual(firstFrame, nextFrame);
  assert(!calls.some(call => call[0] === 'lab'));
  calls.length = 0;
  game.DiVANEngine.render.drawFinishGateOverhead(canvas, { ...point, ang: Math.PI / 2 });
  assert(calls.some(call => call[0] === 'rotate' && call[1] === -Math.PI / 2));
  game.matchMedia = () => ({ matches: true });
  calls.length = 0;
  game.DiVANEngine.render.drawFinishGateOverhead(canvas, point);
  const stillFrame = calls.filter(call => call[0] === 'lineTo').map(call => call.slice(1));
  calls.length = 0;
  game.R.time = 12;
  game.DiVANEngine.render.drawFinishGateOverhead(canvas, point);
  assert.deepEqual(stillFrame, calls.filter(call => call[0] === 'lineTo').map(call => call.slice(1)));
});

test('Загруженная ткань рисуется внутри прорезанного контура флагов', () => {
  const calls = [];
  class ReadyImage {
    constructor() { this.complete = true; this.naturalWidth = 1254; this.naturalHeight = 1254; }
  }
  const game = {
    console, Image: ReadyImage, ROADW: 95, F_D: 'sans-serif', R: { T: { lab: false }, time: 1 },
    drawFinishZone() {}, DiVANEngine: {
      render: {}, wrap(name, factory) { game[name] = factory(game[name]); }
    }
  };
  game.window = game;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/engine/finish-gate.js'), 'utf8'), game);
  const canvas = new Proxy({}, {
    get(target, key) { return target[key] || ((...args) => calls.push([key, ...args])); },
    set(target, key, value) { target[key] = value; return true; }
  });
  game.DiVANEngine.render.drawFinishGateOverhead(canvas, { x: 0, y: 0, ang: 0 });
  const images = calls.filter(call => call[0] === 'drawImage').map(call => call[1].src);
  assert.equal(images.filter(src => src.endsWith('finish-tower.png')).length, 2);
  assert(images.some(src => src.endsWith('finish-cloth-red.png')));
  assert(images.some(src => src.endsWith('finish-cloth-bone.png')));
  assert(calls.findIndex(call => call[0] === 'clip' && call[1] === 'evenodd') < calls.findIndex(call => call[0] === 'drawImage'));
});
