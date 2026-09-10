////////////////////////////////////////////////////////
//
// Примитивы холста, театр и persistRead.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { enhanceHtml, engineFile } = require('../src/main/enhancements');

/** Контекст с шириной символа 10. */
function mockCtx() {
  return {
    font: '',
    measureText: function (t) { return { width: String(t).length * 10 }; }
  };
}

/** Песочница gfx + theatre + persist. */
function bootGfx(opts) {
  const mem = Object.create(null);
  const desk = opts && opts.desk;
  const g = {
    console,
    F_D: 'sans-serif',
    F_B: 'sans-serif',
    rr: function () {},
    panel: function () {},
    panelPath: function () {},
    txt: function () {},
    layoutLines: function () { return ['']; },
    wrapText: function () { return 0; },
    fm: function () { return ''; },
    fmtOdds: function () { return ''; },
    drawTheatreBack: function () {},
    drawAchievementsBack: function () {},
    drawAnnounceToast: function () {},
    persistRead: function () { return null; },
    persistWrite: function () {},
    persistDrop: function () {},
    localStorage: {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
      setItem: function (k, v) { mem[k] = String(v); },
      removeItem: function (k) { delete mem[k]; }
    }
  };
  if (desk) g.rnrDesktop = desk;
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  g.__DIVAN_ENGINE_STORE__ = {};
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/storage.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/persist-io.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/gfx.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/theatre.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает gfx, театр и persist-io до коллизий', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/gfx.js'));
  assert(out.includes('/__engine/theatre.js'));
  assert(out.includes('/__engine/persist-io.js'));
  assert(out.indexOf('storage.js') < out.indexOf('persist-io.js'));
  assert(out.indexOf('persist-io.js') < out.indexOf('gfx.js'));
  assert(out.indexOf('gfx.js') < out.indexOf('theatre.js'));
  assert(out.indexOf('theatre.js') < out.indexOf('collision.js'));
  assert(engineFile('__engine/gfx.js').endsWith('gfx.js'));
});

test('Деньги, кэф, перенос строк, эфир и диск сейва', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../rnr.html'), 'utf8');
  assert(html.includes('function fm('));
  assert(html.includes('function drawTheatreBack('));
  assert(html.includes('function persistRead('));
  const g = bootGfx();
  assert.equal(g.DiVANEngine.gfx.fm(1234567), '$1 234 567');
  assert.equal(g.DiVANEngine.gfx.fmtOdds(1.2), '×1.20');
  const lines = g.DiVANEngine.gfx.layoutLines(mockCtx(), 'aa bb', 30, 12, 'sans');
  assert.equal(lines[0], 'aa');
  assert.equal(lines[1], 'bb');
  assert.equal(g.DiVANEngine.theatre.ACH_STRIPE.period, 38);
  assert.equal(g.DiVANEngine.theatre.toastMaxW(1280, false), 500);
  g.persistWrite('k', 'v');
  assert.equal(g.persistRead('k'), 'v');
  g.persistDrop('k');
  assert.equal(g.persistRead('k'), null);
  const disk = { k: 'DISK' };
  const gDisk = bootGfx({
    desk: {
      storeGet: function (key) { return Object.prototype.hasOwnProperty.call(disk, key) ? disk[key] : null; },
      storeSet: function (key, value) { disk[key] = value; return true; },
      storeRemove: function (key) { delete disk[key]; return true; }
    }
  });
  assert.equal(gDisk.persistRead('k'), 'DISK');
});
