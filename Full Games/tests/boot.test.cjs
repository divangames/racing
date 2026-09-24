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
  assert(out.includes('/__engine/boot-intro.css'));
  assert(out.includes('/__engine/track.js'));
  assert(out.indexOf('theatre.js') < out.indexOf('boot.js'));
  assert(out.indexOf('boot.js') < out.indexOf('boot-net.js'));
  assert(out.indexOf('boot-net.js') < out.indexOf('boot-gate.js'));
  assert(out.indexOf('boot-gate.js') < out.indexOf('track.js'));
  assert(out.indexOf('track.js') < out.indexOf('collision.js'));
  assert(engineFile('__engine/boot.js').endsWith('boot.js'));
  assert(engineFile('__engine/boot-intro.css').endsWith('boot-intro.css'));
});

test('Старт игры перенесён за модули движка', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../content/rnr.html'), 'utf8');
  const out = enhanceHtml(source, { pathname: '/rnr.html' });
  const hook = out.indexOf('/__engine/boot-gate.js');
  const start = out.lastIndexOf('try{bootGo();}catch(e){console.error(e);bootFinish();}');
  assert(hook > 0);
  assert(start > hook);
  assert(!out.slice(out.lastIndexOf('bootFxStart();'), hook).includes('try{bootGo();}'));
  assert(out.includes('id="boot-screen" class="is-load creator-intro-pending"'));
});

test('Ролик входит в обязательные файлы релиза', () => {
  const { ASSET_DIRS, CORE_UI_FILES, assertCoreUi } = require('../tools/ensure-content.cjs');
  assert(ASSET_DIRS.includes('assets/video'));
  assert(CORE_UI_FILES.includes('assets/video/divan_intro.mp4'));
  assert.doesNotThrow(() => assertCoreUi(path.resolve(__dirname, '../content')));
});

test('Подпись этапа, MIME, доля очереди и дедуп fetch', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../content/rnr.html'), 'utf8');
  assert(html.includes('function bootJobLabel('));
  assert(html.includes('function bootGo('));
  assert(html.includes('disclaimer-21plus.svg'));
  assert(html.includes('boot-disclaimer'));
  assert(html.includes('id="boot-screen" class="is-load"'));
  assert(html.includes('disclaimerMs:5000'));
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
  g.BOOT.creatorIntroPlaying = true;
  g.bootPlayMenuIfReady();
  assert.equal(g.playedCat, undefined);
  g.BOOT.creatorIntroPlaying = false;
  g.bootPlayMenuIfReady();
  assert.equal(g.playedCat, 'cast');
  assert.equal(g.lastMusicCat, 'cast');
});

test('После заставки игра открывает меню без пролога', () => {
  const g = bootSandbox();
  Object.assign(g, {
    labTest: false,
    cv: null,
    frame: function () {},
    requestAnimationFrame: function () {},
    setTimeout: function (fn) { fn(); return 1; },
    cancelAnimationFrame: function () {},
    bootFinish: function () {},
    bootAcceptGate: function () {},
    bootPollGate: function () {},
    bootFxStart: function () {},
    bootGo: function () {},
    enterTitle: function () { g._title = true; },
    startWorldIntro: function () { g._intro = true; }
  });
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/boot-gate.js'), 'utf8'), g);
  g.bootFinish();
  assert.equal(g._title, true);
  assert.equal(g._intro, undefined);
});

test('Ролик нельзя пропустить; загрузка идёт во время него, затем дисклеймер держится 5 секунд', async () => {
  const g = bootSandbox();
  let now = 100;
  let releaseLoading;
  let hold = -1;
  let finished = false;
  function element() {
    const listeners = {};
    return {
      children: [], listeners, hidden: false,
      appendChild(child) { this.children.push(child); },
      addEventListener(name, fn) { listeners[name] = fn; },
      removeEventListener(name) { delete listeners[name]; },
      remove() { this.removed = true; },
      removeAttribute(name) { if (name === 'src') this.src = ''; },
      load() {}, pause() {}, play() { return Promise.resolve(); },
      classList: {
        values: new Set(),
        add(name) { this.values.add(name); },
        remove(name) { this.values.delete(name); },
        contains(name) { return this.values.has(name); }
      }
    };
  }
  const root = element();
  g.document = {
    getElementById(id) { return id === 'boot-screen' ? root : null; },
    createElement() { return element(); }
  };
  g.performance.now = () => now;
  g.addEventListener = function () {};
  g.removeEventListener = function () {};
  g.setInterval = function () { return 1; };
  g.clearInterval = function () {};
  g.labTest = false;
  g.bootDiscoverAllMapTiles = () => Promise.resolve();
  g.bootFontsJob = () => Promise.resolve();
  g.bootWaitAll = () => new Promise(resolve => { releaseLoading = resolve; });
  g.bootSleep = ms => { hold = ms; return Promise.resolve(); };
  g.bootGo = function () {};
  g.bootFinish = function () {};
  g.bootAcceptGate = function () {};
  g.bootPollGate = function () {};
  g.bootFxStart = function () {};
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/boot-gate.js'), 'utf8'), g);
  g.bootFinish = () => { finished = true; };

  const boot = g.bootGo();
  const stage = root.children[0];
  const video = stage.children[0];
  assert.equal(video.src, 'assets/video/divan_intro.mp4');
  assert.equal(video.controls, false);
  assert.equal(g.BOOT.creatorIntroPlaying, true);
  assert.equal(typeof releaseLoading, 'function');
  g.bootAcceptGate();
  await Promise.resolve();
  assert.equal(finished, false);
  assert.equal(root.classList.contains('creator-intro-done'), false);

  now = 2000;
  video.listeners.ended();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(g.BOOT.disclaimerT0, 2000);
  assert.equal(root.classList.contains('creator-intro-done'), true);
  assert.equal(hold, 5000);
  assert.equal(root.classList.contains('is-load'), false);
  assert.equal(finished, false);
  releaseLoading();
  await boot;
  assert.equal(finished, true);
});
