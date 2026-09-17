////////////////////////////////////////////////////////
//
// Пункты титула: кампания, свободный заезд, подтверждение стирания.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { enhanceHtml, engineFile } = require('../src/main/enhancements');

/** Песочница title-menu. */
function bootMenu() {
  const g = {
    console,
    state: 'title',
    save: null,
    selChar: 0,
    selCar: 0,
    carConfirmed: false,
    cheatMsgT: 0,
    cheatsAllowed: function () { return true; },
    openTitleConfirm: function (kind) { g.confirmKind = kind; },
    storyStartNewCampaign: function () { g.startedCamp = true; },
    storyContinueCampaign: function () { g.continuedCamp = true; },
    newSave: function () { return { race: 0 }; },
    persist: function () { g.persisted = true; },
    enterCameraSetup: function () { g.camera = true; },
    loadSave: function () { g.loaded = true; },
    openSettings: function (from) { g.settingsFrom = from; },
    openExitWarn: function () { g.exit = true; }
  };
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/title-menu.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает title-menu до screens', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/title-menu.js'));
  assert(out.indexOf('title-menu.js') < out.indexOf('screens.js'));
  assert(engineFile('__engine/title-menu.js').endsWith('title-menu.js'));
});

test('Новая кампания с сейвом спрашивает, без сейва стартует', () => {
  const g = bootMenu();
  const api = g.DiVANEngine.titleMenu;
  api.applyTitleAction('campaign-new', { story: null, free: null });
  assert.equal(g.startedCamp, true);
  assert.equal(g.confirmKind, undefined);
  g.startedCamp = false;
  api.applyTitleAction('campaign-new', { story: { storyCampaign: 'medved_v1' }, free: null });
  assert.equal(g.confirmKind, 'campaign-new');
  assert.equal(g.startedCamp, false);
  api.confirmTitleWipe('campaign-new');
  assert.equal(g.startedCamp, true);
  api.applyTitleAction('free-new', { story: null, free: { race: 2 } });
  assert.equal(g.confirmKind, 'free-new');
  api.applyTitleAction('free-continue', { free: { race: 1 } });
  assert.equal(g.loaded, true);
  assert.equal(g.state, 'garage');
});
