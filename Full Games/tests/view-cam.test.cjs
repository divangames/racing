////////////////////////////////////////////////////////
//
// Зум камеры и letterbox холста.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { enhanceHtml, engineFile } = require('../src/main/enhancements');

const HOOKS = [
  'applyResolution', 'updateView', 'stageX0', 'stageY0', 'raceZoom',
  'snapCameraZoom', 'setCameraZoom', 'nudgeCameraZoom', 'visW', 'visH'
];

/** Песочница камеры. */
function bootView() {
  const g = {
    console,
    W: 1280,
    H: 720,
    CAM_ZOOM_MIN: 1.75,
    CAM_ZOOM_MAX: 2.2,
    CAM_ZOOM_STEP: 0.05,
    CAM_ZOOM_DEF: 2,
    clamp: function (n, a, b) { return n < a ? a : n > b ? b : n; },
    cv: { width: 2560, height: 1080 },
    viewS: 1, viewOX: 0, viewOY: 0, viewW: 1280, viewH: 720,
    settings: { graphics: { resolution: 3, cameraZoom: 2 } },
    RESOLUTIONS: [{ w: 0, h: 0 }, { w: 1280, h: 720 }, { w: 1920, h: 1080 }, { w: 1920, h: 1080 }],
    fit: function () { g._fit = true; },
    saveSettings: function () { g._saved = true; },
    innerWidth: 800,
    innerHeight: 600,
    devicePixelRatio: 1
  };
  HOOKS.forEach(function (n) { g[n] = function () {}; });
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/view-cam.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает view-cam после холста', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/view-cam.js'));
  assert(out.indexOf('gfx.js') < out.indexOf('view-cam.js'));
  assert(engineFile('__engine/view-cam.js').endsWith('view-cam.js'));
});

test('Зум в коридоре, snap к шагу, letterbox даёт поля', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../rnr.html'), 'utf8');
  assert(html.includes('function raceZoom('));
  const g = bootView();
  g.settings.graphics.cameraZoom = 9;
  assert.equal(g.raceZoom(), 2.2);
  g.settings.graphics.cameraZoom = 1;
  assert.equal(g.raceZoom(), 1.75);
  assert.equal(g.snapCameraZoom(1.77), 1.75);
  g.setCameraZoom(2.2);
  assert.equal(g.settings.graphics.cameraZoom, 2.2);
  assert.equal(g._saved, true);
  g.updateView();
  assert.ok(g.viewOX > 300);
  assert.equal(g.viewH, 1080 / g.viewS);
});
