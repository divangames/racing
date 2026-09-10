////////////////////////////////////////////////////////
//
// Комикс, титул и выбор машины без кадров CHAR_INTROS.
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
  'enterCarSel', 'startIntro', 'endIntro', 'confirmCharPick', 'enterTitle', 'dismissPressStart'
];

/** Песочница входа в комикс и меню. */
function bootIntro() {
  const g = {
    console,
    CHAR_INTROS: [{ name: 'МЕДВЕДЬ' }, null],
    save: { char: 0 },
    selChar: -1,
    bioOpen: 3,
    state: 'bio',
    introChar: -1,
    introFrame: 9,
    introDone: true,
    introSkipT: 4,
    introAudio: null,
    introAudioSrc: 'x',
    lastMusicCat: 'main',
    carConfirmed: true,
    selCar: 9,
    carSelScroll: 0,
    carSelDriveT: 0,
    gt: 3,
    settings: { sound: { music: 50, musicOn: false } },
    MUSIC: { stop: function () { g._music = true; } },
    CHIP: { stop: function () { g._chip = true; } },
    stopCharVoice: function () { g._voice = true; },
    resetIntroType: function () { g._reset = true; },
    introMusicUrl: function () { return ''; },
    charCarIdx: function () { return 2; },
    carCatalogPos: function () { return 2; },
    applyCharCar: function (i) { g._applied = i; },
    persist: function () { g._persisted = true; },
    newSave: function () { return { char: 0 }; },
    carEngineHalt: function () { g._engHalt = true; },
    initTitleRace: function () { g._titleRace = true; },
    sClick: function () { g._click = true; },
    clearKeys: function () { g._keys = true; }
  };
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  HOOKS.forEach(function (name) { g[name] = function () {}; });
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/intro-flow.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает поток интро после отрисовки комикса', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/intro-flow.js'));
  assert(out.indexOf('intro.js') < out.indexOf('intro-flow.js'));
  assert(engineFile('__engine/intro-flow.js').endsWith('intro-flow.js'));
});

test('Комикс Медведя, выбор машины и титул', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../rnr.html'), 'utf8');
  assert(html.includes('function startIntro('));
  assert(html.includes('function enterTitle('));
  const g = bootIntro();
  g.confirmCharPick(0);
  assert.equal(g._applied, 0);
  assert.equal(g.state, 'intro');
  assert.equal(g.introChar, 0);
  assert.equal(g._music, true);
  g.endIntro(true);
  assert.equal(g.state, 'car');
  assert.equal(g.selCar, 2);
  g.confirmCharPick(1);
  assert.equal(g.state, 'car');
  g.enterTitle();
  assert.equal(g.state, 'title');
  assert.equal(g._titleRace, undefined);
  assert.equal(g._engHalt, true);
  assert.equal(g.titleSim, null);
  assert.equal(g.titleFocus, null);
  g.state = 'press';
  g.dismissPressStart();
  assert.equal(g.state, 'title');
});
