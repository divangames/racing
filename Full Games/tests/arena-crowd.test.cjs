////////////////////////////////////////////////////////
//
// Трибуна арены: банки имя_NN, финиш, смерть, без наслоения.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '../..');
const ENGINE = path.resolve(__dirname, '../src/engine');
const ARENA = path.join(ROOT, 'assets', 'sounds', 'embirnt', 'arena');
const FILE_RE = /^(.+)_(\d+)\.(mp3|ogg|wav|m4a)$/i;

/**
 * Банки по файлам имя_NN в папке.
 * @param {string} dir
 * @returns {object}
 */
function scanBanks(dir) {
  const banks = {};
  fs.readdirSync(dir).forEach(function (name) {
    const m = name.match(FILE_RE);
    if (!m) return;
    const bank = m[1].toLowerCase();
    if (!banks[bank]) banks[bank] = [];
    banks[bank].push(name);
  });
  Object.keys(banks).forEach(function (k) { banks[k].sort(); });
  return banks;
}

/** Песочница трибуны и коэффициента. */
function bootCrowd() {
  const plays = [];
  function Audio() {
    this.loop = false;
    this.paused = true;
    this.ended = false;
    this.volume = 1;
    this.src = '';
    this.duration = 4;
    this.currentTime = 0;
    this.preload = '';
    this.referrerPolicy = '';
    this.play = function () {
      plays.push(this.src);
      this.paused = false;
      this.ended = false;
      return Promise.resolve();
    };
    this.pause = function () { this.paused = true; };
  }
  const g = {
    console,
    state: 'race',
    labTest: false,
    settings: { sound: { sfxOn: true, sfx: 80, biome: 80, crowd: 80 } },
    document: { hidden: false, addEventListener: function () {} },
    Audio: Audio,
    fetch: function () { return Promise.reject(new Error('offline')); },
    bootEnqueueFetch: function (urls) { g.queued = (g.queued || []).concat(urls); },
    P: null,
    R: null,
    killRacer: function () {},
    finishRacer: function () {},
    updRace: function () {},
    applyAudioSettings: function () {}
  };
  g.window = g;
  g.globalThis = g;
  g.plays = plays;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.join(ENGINE, 'runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'vfx/arena-crowd.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.join(ENGINE, 'arena-crowd.js'), 'utf8'), g);
  return g;
}

test('index.json совпадает с файлами имя_NN на диске', () => {
  const disk = scanBanks(ARENA);
  const idx = JSON.parse(fs.readFileSync(path.join(ARENA, 'index.json'), 'utf8'));
  const listed = {};
  Object.keys(idx.banks).forEach(function (k) {
    listed[k] = idx.banks[k].slice().sort();
  });
  assert.deepEqual(listed, disk);
  assert.ok(disk.aplodisment.length >= 1);
  assert.ok(disk.atmos.length >= 1);
  assert.ok(disk.nedovolny.length >= 1);
  assert.ok(disk.random.length >= 1);
});

test('rnr.html и движок подключают трибуну', () => {
  const html = fs.readFileSync(path.join(ROOT, 'rnr.html'), 'utf8');
  assert.ok(html.includes('vfx/arena-crowd.js'));
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/engine.json'), 'utf8'));
  assert.ok(cfg.hosts.game.scripts.indexOf('arena-crowd.js') >= 0);
});

test('На любой трассе атмосфера, реакции не стакаются', () => {
  const g = bootCrowd();
  assert.ok((g.queued || []).some(function (u) { return String(u).indexOf('arena/index.json') >= 0; }));
  const a = { slot: 0, isP: true, crowdFavor: 0, dead: false, kills: 0 };
  const b = { slot: 1, isP: false, crowdFavor: 0, dead: false };
  g.P = a;
  g.R = { demo: false, T: { theme: { map: 'sand' } }, racers: [a, b], order: [a, b], firstDone: a };
  assert.equal(g.RnRArenaCrowd.arenaLive(g.R), true);
  g.RnRArenaCrowd.tickBed(0.05);
  assert.ok(g.plays.some(function (u) { return String(u).indexOf('atmos_') >= 0; }));
  g.plays.length = 0;
  assert.equal(g.RnRArenaCrowd.playShot('aplodisment', true), true);
  assert.equal(g.RnRArenaCrowd.playShot('nedovolny', false), false);
  assert.ok(g.plays.some(function (u) { return String(u).indexOf('aplodisment_') >= 0; }));
});

test('Выключатель theme.crowdSound глушит трибуну', () => {
  const g = bootCrowd();
  const R = { demo: false, T: { theme: { map: 'arena', crowdSound: false } } };
  assert.equal(g.RnRArenaCrowd.arenaLive(R), false);
});

test('Web Audio контекст не глушит HTML-атмосферу', () => {
  const g = bootCrowd();
  g.AU = { ctx: { state: 'running', currentTime: 0 }, sfx: { gain: { value: 0.9 } } };
  const a = { slot: 0, isP: true, crowdFavor: 0, dead: false, kills: 0 };
  g.R = { demo: false, T: { theme: { map: 'garden' } }, racers: [a], order: [a] };
  g.RnRArenaCrowd.tickBed(0.05);
  assert.ok(g.plays.some(function (u) { return String(u).indexOf('atmos_') >= 0; }));
});

test('Ползунок арены отдельно от эффектов', () => {
  const g = bootCrowd();
  g.settings.sound.sfx = 0;
  g.settings.sound.sfxOn = false;
  g.settings.sound.crowd = 80;
  const a = { slot: 0, isP: true, crowdFavor: 0, dead: false, kills: 0 };
  g.R = { demo: false, T: { theme: { map: 'sand' } }, racers: [a], order: [a] };
  g.RnRArenaCrowd.tickBed(0.05);
  assert.ok(g.plays.some(function (u) { return String(u).indexOf('atmos_') >= 0; }));
  g.plays.length = 0;
  g.settings.sound.crowd = 0;
  g.RnRArenaCrowd.tickBed(0.05);
  assert.equal(g.plays.length, 0);
});

test('Редактор имеет флажок звука трибуны', () => {
  const html = fs.readFileSync(path.join(ROOT, 'Editor.html'), 'utf8');
  assert.ok(html.includes('id="mapCrowdSound"'));
  assert.ok(html.includes('Звук трибуны'));
});

test('Финиш не первый — ропот, убийство любимчика поднимает киллера', () => {
  const g = bootCrowd();
  const p = { slot: 0, isP: true, crowdFavor: 3, dead: false, kills: 0 };
  const n = { slot: 1, isP: false, crowdFavor: 0.2, dead: false };
  g.P = p;
  g.R = { demo: false, T: { theme: { map: 'arena' } }, racers: [p, n], order: [n, p], firstDone: n };
  g.plays.length = 0;
  g.DiVANEngine.arenaCrowd.react(g.R, 'finish', p, null);
  assert.ok(g.plays.some(function (u) { return String(u).indexOf('nedovolny_') >= 0; }));
  g.plays.length = 0;
  g.DiVANEngine.arenaCrowd.react(g.R, 'kill', p, n);
  assert.ok(n.crowdFavor > 0.2);
  assert.ok(g.plays.some(function (u) { return String(u).indexOf('nedovolny_') >= 0 || String(u).indexOf('aplodisment_') >= 0; }));
});
