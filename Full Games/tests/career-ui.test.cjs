////////////////////////////////////////////////////////
//
// Клик настроек и экран карьеры DiVANEngine.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { enhanceHtml, engineFile } = require('../src/main/enhancements');

/** Песочница клика настроек и UI карьеры. */
function bootCareerUi() {
  const g = {
    console,
    hitSettings: function () { return null; },
    clickCameraSetup: function () {},
    clickSettings: function () {},
    careerPress: function () {},
    careerClick: function () {},
    drawCareer: function () {},
    drawCareerTracks: function () {}
  };
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/settings-input.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/career-ui.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает клик настроек и UI карьеры до кадра', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/settings-input.js'));
  assert(out.includes('/__engine/career-ui.js'));
  assert(out.indexOf('options.js') < out.indexOf('settings-input.js'));
  assert(out.indexOf('settings-input.js') < out.indexOf('intro.js'));
  assert(out.indexOf('extras.js') < out.indexOf('career-ui.js'));
  assert(out.indexOf('career-ui.js') < out.indexOf('pointer.js'));
  assert(engineFile('__engine/career-ui.js').endsWith('career-ui.js'));
});

test('Край настроек входит, кнопки карьеры и герой кадра', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../rnr.html'), 'utf8');
  const career = fs.readFileSync(path.resolve(__dirname, '../../career.js'), 'utf8');
  assert(html.includes('function clickSettings('));
  assert(html.includes('function hitSettings('));
  assert(career.includes('function drawCareer('));
  assert(career.includes('function careerClick('));
  const g = bootCareerUi();
  const box = { x: 0, y: 0, w: 20, h: 20, act: 'main' };
  assert.equal(g.DiVANEngine.settingsInput.hitSettingsAt(0, 10, [box]).act, 'main');
  assert.equal(g.DiVANEngine.settingsInput.hitSettingsAt(-1, 10, [box]), null);
  const ui = g.DiVANEngine.careerUi;
  assert.equal(ui.careerHeroLine(0), 'ТЫ РАЗОРВАЛ КЛЕТКУ');
  assert.equal(ui.careerHeroLine(1), 'ПОДИУМ. ДЕНЬГИ ЕСТЬ.');
  assert.equal(ui.careerHeroLine(3), 'СЛЕДУЮЩИЙ ЗАЕЗД ВСЁ ЕЩЁ ТВОЙ');
  const lay = ui.careerBtnLayout(1280, 720, 2);
  assert.equal(lay.btnY, 628);
  assert.equal(lay.btnW, 593);
});
