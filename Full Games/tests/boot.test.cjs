////////////////////////////////////////////////////////
//
// Очередь заставки DiVANEngine.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { enhanceHtml, engineFile } = require('../src/main/enhancements');

/** Песочница boot без сети. */
function bootSandbox() {
  const g = {
    console,
    BOOT: {
      ready: false, started: false, giveUp: false, jobs: [], t0: 0, vpnShown: false,
      els: null, gateRaf: 0, media: Object.create(null), menuMusic: false
    },
    document: { getElementById: function () { return null; } },
    performance: { now: function () { return 0; } },
    URL: { createObjectURL: function () { return 'blob:x'; }, revokeObjectURL: function () {} },
    bootJobLabel: function () { return ''; },
    bootMediaSrc: function (u) { return u; },
    bootKeepMedia: function () {},
    bootEnqueue: function () {},
    bootEnqueueFetch: function () {},
    bootEls: function () { return {}; },
    bootRatio: function () { return 0; },
    bootPaint: function () {},
    bootMime: function () { return ''; },
    bootSleep: function () { return Promise.resolve(); },
    bootPlayMenuIfReady: function () {},
    bootEnqueueAudioCatalog: function () {},
    bootEnqueueSfx: function () {},
    lastMusicCat: null,
    MUSIC_TRACKS: { main: ['assets/music/main/0.mp3'], cast: ['assets/music/cast/03 A thug approaches.mp3'] },
    MUSIC: { play: function (cat) { g.playedCat = cat; } }
  };
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/boot.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает boot и трассу до коллизий', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/boot.js'));
  assert(out.includes('/__engine/boot-net.js'));
  assert(out.includes('/__engine/boot-gate.js'));
  assert(out.includes('/__engine/track.js'));
  assert(out.indexOf('theatre.js') < out.indexOf('boot.js'));
  assert(out.indexOf('boot.js') < out.indexOf('boot-net.js'));
  assert(out.indexOf('boot-net.js') < out.indexOf('boot-gate.js'));
  assert(out.indexOf('boot-gate.js') < out.indexOf('track.js'));
  assert(out.indexOf('track.js') < out.indexOf('collision.js'));
  assert(engineFile('__engine/boot.js').endsWith('boot.js'));
});

test('Подпись этапа, MIME, доля очереди и дедуп fetch', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../rnr.html'), 'utf8');
  assert(html.includes('function bootJobLabel('));
  assert(html.includes('function bootGo('));
  const g = bootSandbox();
  assert.equal(g.DiVANEngine.boot.jobLabel({ urls: ['assets/data/comics/01.webp'] }), 'Комиксы');
  assert.equal(g.DiVANEngine.boot.jobLabel({ label: 'Шрифты', urls: ['x'] }), 'Шрифты');
  assert.equal(g.DiVANEngine.boot.mime('car.webp', 'application/octet-stream'), 'image/webp');
  assert.equal(g.DiVANEngine.boot.mime('a.mp3', ''), 'audio/mpeg');
  g.bootEnqueue(null, ['a.webp']);
  g.BOOT.jobs[0].done = true;
  g.bootEnqueueFetch(['m.mp3'], true);
  g.bootEnqueueFetch(['m.mp3'], true);
  assert.equal(g.BOOT.jobs.length, 2);
  assert.equal(g.DiVANEngine.boot.ratio(), 0.5);
});

test('Тема меню переключается на cast, когда трек уже в кэше', () => {
  const g = bootSandbox();
  g.BOOT.media['assets/music/cast/03 A thug approaches.mp3'] = 'blob:cast';
  g.bootPlayMenuIfReady();
  assert.equal(g.playedCat, 'cast');
  assert.equal(g.lastMusicCat, 'cast');
});
