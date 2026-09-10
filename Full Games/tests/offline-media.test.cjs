////////////////////////////////////////////////////////
//
// Офлайн: музыка и FX с диска, десктоп не ходит на CDN.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '../..');
const CATS = ['main', 'change', 'garage', 'intro', 'racing', 'Load', 'cast'];
const AUDIO_EXT = /\.(mp3|ogg|wav|m4a)$/i;

/** Есть хотя бы один трек в папке. */
function catHasTrack(cat) {
  const dir = path.join(ROOT, 'assets', 'music', cat);
  if (!fs.existsSync(dir)) return false;
  return fs.readdirSync(dir).some(function (n) {
    return AUDIO_EXT.test(n) && fs.statSync(path.join(dir, n)).isFile();
  });
}

test('Папки музыки и FX лежат на диске', () => {
  for (const cat of CATS) {
    assert.ok(catHasTrack(cat), 'пустая папка музыки: ' + cat);
  }
  const fx = path.join(ROOT, 'assets', 'sounds', 'FX');
  ['money.mp3', 'CashBay.mp3', 'carPay.wav'].forEach(function (name) {
    assert.ok(fs.existsSync(path.join(fx, name)), 'нет эффекта: ' + name);
  });
  assert.ok(fs.existsSync(path.join(ROOT, 'assets', 'image', 'cast', '01.png')), 'нет фона титула');
  assert.ok(fs.existsSync(path.join(ROOT, 'assets', 'divan_games', 'DIVAN_none.png')), 'нет марки студии');
  assert.ok(fs.existsSync(path.join(ROOT, 'assets', 'sounds', 'embirnt', 'rain.mp3')), 'нет эмбиента дождя');
});

test('Десктоп даёт только локальные URL музыки и FX', () => {
  const g = {
    console,
    window: null,
    __RNR_DESKTOP__: true,
    fetch: function () { return Promise.resolve({ ok: false, text: function () { return Promise.resolve(''); } }); }
  };
  g.window = g;
  g.globalThis = g;
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'music.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'sounds.js'), 'utf8'), g);
  const tracks = g.musicSources('assets/music/main/0.mp3');
  assert.equal(tracks.length, 1);
  assert.equal(tracks[0], 'assets/music/main/0.mp3');
  const fx = g.sfxSources('assets/sounds/FX/money.mp3');
  assert.equal(fx.length, 1);
  assert.equal(fx[0], 'assets/sounds/FX/money.mp3');
  g.__RNR_DESKTOP__ = false;
  const web = g.musicSources('assets/music/main/0.mp3');
  assert.equal(web[0], 'assets/music/main/0.mp3');
  assert.ok(web.some(function (u) { return u.indexOf('ikrinka24.com') >= 0; }));
});

test('Заставка на десктопе пропускает http CDN', () => {
  const g = {
    console,
    BOOT: { giveUp: false, jobs: [], media: Object.create(null) },
    bootFetchUrl: function () {},
    bootBind: function () {},
    bootImgTag: function () {},
    bootAudioTag: function () {},
    bootRunJob: function () {},
    bootWaitAll: function () {},
    bootFontsJob: function () {},
    bootPaint: function () {},
    bootMime: function () { return ''; },
    bootKeepMedia: function () {},
    bootPlayMenuIfReady: function () {},
    bootSleep: function () { return Promise.resolve(); },
    __RNR_DESKTOP__: true
  };
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/boot-net.js'), 'utf8'), g);
  const skip = g.DiVANEngine.boot.skipRemoteOnDesktop;
  assert.equal(skip('https://ikrinka24.com/ROCK/music/main/0.mp3'), true);
  assert.equal(skip('assets/music/main/0.mp3'), false);
  assert.equal(skip('rnr://game/assets/sounds/FX/money.mp3'), false);
});
