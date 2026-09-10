////////////////////////////////////////////////////////
//
// Выключатель музыки и папка плейлиста. Чип остаётся в HTML.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { enhanceHtml, engineFile } = require('../src/main/enhancements');

/** Песочница гейта музыки. */
function bootMusic() {
  const g = {
    console,
    settings: { sound: { musicOn: true } },
    state: 'title',
    musicOn: function () { return false; },
    musicCat: function () { return 'x'; },
    musicSources: function (u) { return [u, 'https://example.com/x']; },
    sfxSources: function (u) { return [u]; }
  };
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/music-gate.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает music-gate после soundtrack', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/music-gate.js'));
  assert(out.indexOf('soundtrack.js') < out.indexOf('music-gate.js'));
  assert(engineFile('__engine/music-gate.js').endsWith('music-gate.js'));
});

test('Гонка — racing, гараж — garage, выключатель глушит', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../rnr.html'), 'utf8');
  assert(html.includes('function musicOn('));
  assert(html.includes('function musicCat('));
  const g = bootMusic();
  g.state = 'title';
  assert.equal(g.musicCat(), 'cast');
  g.state = 'press';
  assert.equal(g.musicCat(), 'cast');
  g.state = 'race';
  assert.equal(g.musicCat(), 'racing');
  g.state = 'garage';
  assert.equal(g.musicCat(), 'garage');
  g.state = 'car';
  assert.equal(g.musicCat(), 'change');
  g.settings.sound.musicOn = false;
  assert.equal(g.musicOn(), false);
  g.__RNR_DESKTOP__ = true;
  const local = g.musicSources('assets/music/racing/0.mp3');
  assert.deepEqual(local, ['assets/music/racing/0.mp3']);
});
