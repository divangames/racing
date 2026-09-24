'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { GAME_ROOT, ROOT_FILES } = require('../tools/ensure-content.cjs');
const { buildSite } = require('../tools/build-site.cjs');

test('Единственный источник игры находится внутри десктопного проекта', () => {
  assert.equal(GAME_ROOT, path.resolve(__dirname, '../content'));
  for (const name of ROOT_FILES) assert(fs.existsSync(path.join(GAME_ROOT, name)), name);
  assert(fs.existsSync(path.join(GAME_ROOT, 'assets/data/cars/01/car.json')));
});

test('Публикация сайта не включает исполняемую веб-копию и внутренний контент', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-site-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'site'));
  fs.mkdirSync(path.join(root, 'Full Games/content'), { recursive: true });
  fs.writeFileSync(path.join(root, 'index.html'), 'Download Windows');
  fs.writeFileSync(path.join(root, 'rnr.html'), '<script>startGame()</script>');
  fs.writeFileSync(path.join(root, 'Full Games/content/rnr.html'), 'native game');
  fs.writeFileSync(path.join(root, 'site/press.js'), 'presentation');
  const output = buildSite(root, path.join(root, 'output'));
  assert(fs.existsSync(path.join(output, 'index.html')));
  assert(fs.existsSync(path.join(output, 'site/press.js')));
  assert(!fs.existsSync(path.join(output, 'rnr.html')));
  assert(!fs.existsSync(path.join(output, 'Full Games')));
  assert.throws(() => buildSite(root, output), /пустым/);
});
