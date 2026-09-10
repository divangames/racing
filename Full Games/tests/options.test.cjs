////////////////////////////////////////////////////////
//
// Настройки, интро и колонки старта заезда без окна.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { enhanceHtml, engineFile } = require('../src/main/enhancements');

/** Песочница runtime + options + intro + prerace. */
function bootOptions() {
  const g = {
    console,
    drawSettingsBackdrop: function () {},
    drawSideShade: function () {},
    drawZoomBar: function () {},
    drawCameraSetup: function () {},
    drawSettings: function () {},
    drawIntro: function () {},
    drawPreRace: function () {}
  };
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/options.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/intro.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/prerace.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает options, intro и prerace до кадра', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/options.js'));
  assert(out.includes('/__engine/intro.js'));
  assert(out.includes('/__engine/prerace.js'));
  assert(out.indexOf('training.js') < out.indexOf('options.js'));
  assert(out.indexOf('options.js') < out.indexOf('intro.js'));
  assert(out.indexOf('intro.js') < out.indexOf('prerace.js'));
  assert(out.indexOf('prerace.js') < out.indexOf('loop.js'));
  assert(engineFile('__engine/options.js').endsWith('options.js'));
});

test('Зум камеры, панель интро и колонки ставки', () => {
  const g = bootOptions();
  assert.equal(g.DiVANEngine.options.SETTINGS_MAIN.join(','), 'НАСТРОЙКА ГРАФИКИ,НАСТРОЙКИ ЗВУКА,НАСТРОЙКА ИГРЫ,НАЗАД');
  assert.equal(g.DiVANEngine.options.zoomT(1.5, 1, 2), 0.5);
  assert.equal(g.DiVANEngine.intro.introPanelH(720), 461);
  assert.equal(g.DiVANEngine.intro.skipRatio(0.5, 1), 0.5);
  assert.equal(g.DiVANEngine.intro.skipRatio(3, 1), 1);
  const col = g.DiVANEngine.prerace.preraceColumns(1280, 48);
  assert.equal(col.stage, 300);
  assert.equal(col.rightX, 370);
  assert.equal(col.chipW, 399);
});
