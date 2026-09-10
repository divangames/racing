////////////////////////////////////////////////////////
//
// Пролог «Чёрный Пояс»: семь кадров на диске.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '../..');
const DIR = path.join(ROOT, 'assets', 'data', 'cats', '00');

test('Пролог: 01.webp–07.webp и lines.json на месте', () => {
  assert.ok(fs.existsSync(path.join(DIR, 'lines.json')));
  for (let n = 1; n <= 7; n++) {
    const file = path.join(DIR, String(n).padStart(2, '0') + '.webp');
    assert.ok(fs.existsSync(file), 'нет кадра: ' + path.basename(file));
    assert.ok(fs.statSync(file).size > 10000, 'пустой кадр: ' + path.basename(file));
  }
  const lines = JSON.parse(fs.readFileSync(path.join(DIR, 'lines.json'), 'utf8'));
  assert.equal(lines.frames, 7);
  assert.equal(lines.scenes.length, 7);
});

test('Ролик кампании: 01.webp–07.webp и lines.json', () => {
  const dir = path.join(ROOT, 'assets', 'data', 'cats', 'campaign');
  assert.ok(fs.existsSync(path.join(dir, 'lines.json')));
  for (let n = 1; n <= 7; n++) {
    const file = path.join(dir, String(n).padStart(2, '0') + '.webp');
    assert.ok(fs.existsSync(file), 'нет кадра: ' + path.basename(file));
    assert.ok(fs.statSync(file).size > 10000, 'пустой кадр: ' + path.basename(file));
  }
});

test('Пролог ищет webp с нулём в имени', () => {
  const g = {
    console,
    location: { href: 'rnr://game/rnr.html' },
    URL: URL,
    Image: function () { this.naturalWidth = 0; },
    fetch: function () { return Promise.resolve({ ok: false }); },
    bootEnqueue: function () {}
  };
  g.window = g;
  g.globalThis = g;
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'world-intro.js'), 'utf8'), g);
  const urls = g.worldIntroImgUrls(1);
  assert.ok(urls.some(function (u) { return u.indexOf('01.webp') >= 0; }));
  assert.equal(g.WORLD_INTRO.imgs.length, 7);
});
