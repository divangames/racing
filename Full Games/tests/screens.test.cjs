////////////////////////////////////////////////////////
//
// Меню и камера мира DiVANEngine без окна заезда.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { enhanceHtml, engineFile } = require('../src/main/enhancements');

/** Песочница runtime + screens + render. */
function bootUi() {
  const g = {
    console,
    save: { race: 2 },
    isDev: function () { return true; },
    cheatsAllowed: function () { return true; },
    submitCheat: function () {},
    selTitle: 0,
    resetArm: false,
    W: 1280,
    H: 720,
    titleLogo: { complete: false, naturalWidth: 0 },
    F_B: 'sans-serif',
    drawTitleStage: function () {},
    drawPressStart: function () {},
    panel: function () {},
    txt: function () {},
    drawVhsOverlay: function () {},
    drawLabWarn: function () {},
    drawExitWarn: function () {},
    drawTitle: function () { g.titleHits = (g.titleHits || 0) + 1; },
    drawRaceWorld: function () { g.worldHits = (g.worldHits || 0) + 1; },
    drawRaceArena: function () { g.arenaHits = (g.arenaHits || 0) + 1; },
    drawHUD: function () { g.hudHits = (g.hudHits || 0) + 1; },
    raceZoom: function () { return 1.25; },
    viewS: 1,
    viewW: 1280,
    viewH: 720,
    R: { cam: { x: 40, y: 80 }, sx: 2, sy: -3 },
    settings: { sound: { musicOn: true }, graphics: { weather: false } },
    g: {
      setTransform: function () { g.transforms = (g.transforms || 0) + 1; },
      save: function () {},
      restore: function () {},
      translate: function (x, y) { g.lastTranslate = [x, y]; }
    }
  };
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/cheats-gate.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/screens.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/render.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает screens и render до кадра', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/screens.js'));
  assert(out.includes('/__engine/render.js'));
  assert(out.indexOf('screens.js') < out.indexOf('render.js'));
  assert(out.indexOf('render.js') < out.indexOf('loop.js'));
  assert(out.indexOf('loop.js') < out.indexOf('presentation.js'));
  assert(engineFile('__engine/screens.js').endsWith('screens.js'));
  const src = fs.readFileSync(path.resolve(__dirname, '../src/engine/screens.js'), 'utf8');
  assert.ok(src.includes('assets/image/cast/01.png'));
  assert.ok(!src.includes('drawTitleRace()'));
  assert.ok(!src.includes('drawVhsOverlay()'));
  assert(out.includes('/__engine/title-fx.js'));
  assert(out.indexOf('screens.js') < out.indexOf('title-fx.js'));
  assert(out.indexOf('title-fx.js') < out.indexOf('render.js'));
});

test('Пункты меню и камера мира считаются без canvas', () => {
  const g = bootUi();
  const items = g.DiVANEngine.screens.titleItems({ race: 0 }, false);
  assert.equal(items[0], 'КАМПАНИЯ');
  assert.ok(items.includes('ПРОДОЛЖИТЬ (ЭТАП 1)'));
  assert.ok(items.includes('НОВАЯ ИГРА'));
  assert.ok(items.includes('ЧИТЫ'));
  assert.ok(!items.includes('ЛАБОРАТОРИЯ'));
  assert.equal(items[items.length - 1], 'ВЫХОД');
  const cont = g.DiVANEngine.screens.titleItems({ race: 0 }, false, { storyCampaign: 'medved_v1', race: 2 });
  assert.equal(cont[0], 'ПРОДОЛЖИТЬ КАМПАНИЮ');
  const dev = g.DiVANEngine.screens.titleItems(null, true);
  assert.equal(dev[0], 'КАМПАНИЯ');
  assert.ok(dev.includes('ЛАБОРАТОРИЯ'));
  const retail = Object.assign(g, { __RNR_DESKTOP__: true, __RNR_PUBLIC_BUILD__: true });
  assert.ok(!retail.DiVANEngine.screens.titleItems({ race: 0 }, false).includes('ЧИТЫ'));
  const lay = g.DiVANEngine.screens.titleLayout({ H: 720, n: 8, logoH: 200, resetArm: false });
  assert.ok(lay.titleStep >= 22 && lay.titleStep <= 34);
  assert.equal(lay.colX, 52);
  const cam = g.DiVANEngine.render.worldCamera({ cam: { x: 40, y: 80 }, sx: 2, sy: -3 }, 2, 0.5);
  assert.equal(cam.scale, 1);
  assert.equal(cam.tx, -38);
  assert.equal(cam.ty, -83);
  g.DiVANEngine.screens.paint('race');
  assert.equal(g.arenaHits, 1);
  assert.equal(g.hudHits, 1);
  assert.equal(g.lastTranslate[0], -38);
});
