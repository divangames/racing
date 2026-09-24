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
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/title-bg.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/title-menu.js'), 'utf8'), g);
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
  assert.ok(src.includes('assets/data/cats/Titles/'));
  assert.ok(!src.includes('drawTitleRace()'));
  assert.ok(!src.includes('drawVhsOverlay()'));
  assert(out.includes('/__engine/title-menu.js'));
  assert(out.indexOf('title-menu.js') < out.indexOf('screens.js'));
  assert(out.includes('/__engine/title-fx.js'));
  assert(out.indexOf('title-bg.js') < out.indexOf('screens.js'));
  assert(out.indexOf('screens.js') < out.indexOf('title-fx.js'));
  assert(out.indexOf('title-fx.js') < out.indexOf('render.js'));
});

test('Пункты меню и камера мира считаются без canvas', () => {
  const g = bootUi();
  const ids = function (list) { return list.map(function (it) { return it.id; }); };
  const labels = function (list) { return list.map(function (it) { return it.label; }); };
  const items = g.DiVANEngine.screens.titleItems({ race: 0 }, false);
  assert.equal(items[0].id, 'campaign-new');
  assert.equal(items[0].label, 'КАМПАНИЯ');
  assert.ok(ids(items).includes('free-continue'));
  assert.ok(labels(items).includes('СВОБОДНЫЙ ЗАЕЗД') || labels(items).includes('НОВЫЙ СВОБОДНЫЙ ЗАЕЗД'));
  assert.ok(ids(items).includes('cheats'));
  assert.ok(!ids(items).includes('lab'));
  assert.ok(!labels(items).includes('ЛАБОРАТОРИЯ'));
  assert.ok(!ids(items).includes('save-load'));
  assert.ok(!labels(items).includes('СБРОС ПРОГРЕССА'));
  assert.equal(items[items.length - 1].id, 'exit');
  const cont = g.DiVANEngine.screens.titleItems({ race: 0 }, false, { storyCampaign: 'medved_v1', race: 2 });
  assert.equal(cont[0].id, 'campaign-continue');
  assert.equal(cont[1].label, 'НОВАЯ КАМПАНИЯ');
  assert.equal(g.DiVANEngine.titleMenu.titleDefaultIndex(cont), 0);
  const fresh = g.DiVANEngine.screens.titleItems(null, false);
  assert.equal(fresh[0].label, 'КАМПАНИЯ');
  assert.equal(fresh[1].label, 'СВОБОДНЫЙ ЗАЕЗД');
  const dev = g.DiVANEngine.screens.titleItems(null, true);
  assert.equal(dev[0].label, 'КАМПАНИЯ');
  assert.ok(ids(dev).includes('lab'));
  const retail = Object.assign(g, { __RNR_DESKTOP__: true, __RNR_PUBLIC_BUILD__: true });
  assert.ok(!ids(retail.DiVANEngine.screens.titleItems({ race: 0 }, false)).includes('cheats'));
  const lay = g.DiVANEngine.screens.titleLayout({ H: 720, n: 8, logoH: 200, resetArm: false });
  assert.ok(lay.titleStep >= 28 && lay.titleStep <= 48);
  assert.ok(lay.panelH < lay.titleStep, 'Между пунктами остаётся промежуток');
  assert.ok(lay.titleY0 + 7 * lay.titleStep + lay.panelH / 2 < 650, 'Пункты не закрывают нижние подписи');
  assert.equal(lay.colX, 52);
  const wide = g.DiVANEngine.screens.titleLayout({ H: 720, n: 8, logoH: 200, resetArm: false, stageX: -220 });
  assert.equal(wide.colX, -168);
  const pick = g.DiVANEngine.screens.pickTitleBgSrc;
  assert.ok(pick(1920 / 1080).indexOf('1920x1080') >= 0);
  assert.ok(pick(3440 / 1440).indexOf('3440x1440') >= 0);
  assert.ok(pick(2560 / 1080).indexOf('3440x1440') >= 0);
  assert.ok(pick(1280 / 720).indexOf('1920x1080') >= 0);
  assert.ok(pick(16 / 9, 3840, 2160).indexOf('1920x1080') >= 0);
  const cam = g.DiVANEngine.render.worldCamera({ cam: { x: 40, y: 80 }, sx: 2, sy: -3 }, 2, 0.5);
  assert.equal(cam.scale, 1);
  assert.equal(cam.tx, -38);
  assert.equal(cam.ty, -83);
  g.DiVANEngine.screens.paint('race');
  assert.equal(g.arenaHits, 1);
  assert.equal(g.hudHits, 1);
  assert.equal(g.lastTranslate[0], -38);
});

test('Логотип оставляет зазор над первым пунктом с любым числом строк', () => {
  const api = bootUi().DiVANEngine.screens;
  for (const n of [6,7,8,9]) for (const logoH of [132,205,270,360]) {
    const lay = api.titleLayout({H:720,n,logoH,resetArm:false});
    assert(lay.titleY0 - lay.panelH/2 - 2 >= lay.logoY + lay.logoH + 20);
    assert(lay.titleY0 + (n-1)*lay.titleStep + lay.panelH/2 < 630);
    assert(lay.logoW < 380);
  }
});
