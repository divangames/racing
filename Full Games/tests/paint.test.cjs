////////////////////////////////////////////////////////
//
// Портреты, кузов и гейт VFX DiVANEngine.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { enhanceHtml, engineFile } = require('../src/main/enhancements');

/** Песочница портретов, кузова и vfx. */
function bootPaint() {
  const g = {
    console,
    drawCarGroundShadow: function () {},
    drawCarShield: function () {},
    drawCar: function () {},
    hexToRgb: function () { return [0, 0, 0]; },
    drawPortrait: function () {},
    drawFullbodyFit: function () {},
    drawPilotStage: function () {},
    drawLeaderAvatar: function () {},
    drawCarOwnerMark: function () {},
    drawCarOwnerCorner: function () {},
    vfxLive: function () { return false; }
  };
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/car-fx.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/car-fallback.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/car-paint.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/portraits.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/vfx.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает кузов, портреты и vfx до арены', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/car-paint.js'));
  assert(out.includes('/__engine/portraits.js'));
  assert(out.includes('/__engine/vfx.js'));
  assert(out.indexOf('car-fx.js') < out.indexOf('car-fallback.js'));
  assert(out.indexOf('car-fallback.js') < out.indexOf('car-paint.js'));
  assert(out.indexOf('car-paint.js') < out.indexOf('portraits.js'));
  assert(out.indexOf('vfx.js') < out.indexOf('arena.js'));
  assert(engineFile('__engine/portraits.js').endsWith('portraits.js'));
});

test('Вынос колёс, портрет ×2, гейт quarks', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../rnr.html'), 'utf8');
  assert(html.includes('function drawCar('));
  assert(html.includes('function drawPortrait('));
  assert(html.includes('function vfxLive('));
  const g = bootPaint();
  const L0 = g.DiVANEngine.carPaint.stockWheelLayout(0);
  assert.equal(L0.xR, -15.5);
  assert.equal(L0.xF, 14.2);
  const L6 = g.DiVANEngine.carPaint.stockWheelLayout(6);
  assert.equal(L6.xM, -30.2);
  const p = g.DiVANEngine.portraits;
  assert.equal(p.portraitZoom(1), 2);
  const rgb = p.hexToRgb('#ffd23f');
  assert.equal(rgb[0], 255);
  assert.equal(rgb[1], 210);
  assert.equal(rgb[2], 63);
  const fit = p.fullbodyFit(100, 200, 80, 160, 1);
  assert.equal(fit.dw, 80);
  assert.equal(fit.dh, 160);
  const vfx = g.DiVANEngine.vfx.vfxAllowed;
  assert.equal(vfx({ ok: true }, { particles: 'medium' }, false), true);
  assert.equal(vfx({ ok: true }, { particles: 'low' }, false), false);
  assert.equal(vfx({ ok: true }, { particles: 'high' }, true), false);
  assert.equal(vfx({ ok: false }, { particles: 'high' }, false), false);
});
