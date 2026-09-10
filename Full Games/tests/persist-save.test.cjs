////////////////////////////////////////////////////////
//
// Снимок карьеры: newSave, persist, loadSave.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { enhanceHtml, engineFile } = require('../src/main/enhancements');

/** Песочница сейва карьеры. */
function bootSave() {
  const mem = Object.create(null);
  const CARS = [{ owner: 0 }, { custom: true }, { owner: 1 }];
  const CHARS = [{ name: 'A' }, { npc: true }];
  const g = {
    console,
    CARS,
    CHARS,
    labTest: false,
    SKEY: 'rnr_ru_v1',
    SLOTS_KEY: 'rnr_ru_slots',
    slots: new Array(10).fill(null),
    save: null,
    saveFlash: 0,
    persistRead: function () { return null; },
    persistWrite: function () {},
    persistDrop: function () {},
    blankSkillsMap: function () { return {}; },
    blankCstatsMap: function () { return {}; },
    newSave: function () { return {}; },
    persist: function () {},
    loadSave: function () {},
    charCarIdx: function (chI) {
      const i = CARS.findIndex(function (c) { return c && c.owner === chI; });
      return i >= 0 ? i : 0;
    },
    blankTune: function () { return { arm: 0, eng: 0, tir: 0, shk: 0, nit: 0, wep: 0, ult: 0 }; },
    allTunes: function () {
      const o = {};
      for (let i = 0; i < CARS.length; i++) o[i] = { arm: 0, eng: 0, tir: 0, shk: 0, nit: 0, wep: 0, ult: 0 };
      return o;
    },
    isForeignSignature: function (carI) {
      const o = CARS[carI] && CARS[carI].owner;
      return o != null && g.save && o !== g.save.char;
    },
    saveSlots: function () { g._slotsSaved = true; },
    localStorage: {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
      setItem: function (k, v) { mem[k] = String(v); },
      removeItem: function (k) { delete mem[k]; }
    }
  };
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  g.__DIVAN_ENGINE_STORE__ = {};
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/storage.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/persist-io.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/persist-save.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает persist-save после persist-io', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/persist-save.js'));
  assert(out.indexOf('persist-io.js') < out.indexOf('persist-save.js'));
  assert(out.indexOf('persist-save.js') < out.indexOf('gfx.js'));
  assert(engineFile('__engine/persist-save.js').endsWith('persist-save.js'));
});

test('Новая карьера, запись и допись ракет из старого JSON', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../rnr.html'), 'utf8');
  assert(html.includes('function newSave('));
  assert(html.includes('function loadSave('));
  const g = bootSave();
  const fresh = g.newSave();
  assert.equal(fresh.cash, 1000);
  assert.equal(fresh.race, 0);
  assert.equal(fresh.car, 0);
  assert.equal(fresh.carOwned[0], true);
  g.save = { cash: 50, race: 2, char: 0 };
  g.persist();
  assert.equal(g.saveFlash, 1.6);
  g.save = null;
  g.loadSave();
  assert.equal(g.save.cash, 50);
  assert.equal(g.save.race, 2);
  assert.equal(g.save.rockets, 2);
  g.save = { cash: 1, race: 0, char: 1 };
  g.persistWrite(g.SKEY, JSON.stringify(g.save));
  g.loadSave();
  assert.equal(g.save.char, 0);
});
