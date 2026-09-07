////////////////////////////////////////////////////////
//
// Zip контента: store, без референсов и без второй копии дерева.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { packGameRelease } = require('../tools/pack-game-release.cjs');

/**
 * Мини-дерево игры для упаковки.
 * @returns {{root: string, client: string}}
 */
function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kolesnica-pack-'));
  const client = path.join(root, 'Full Games');
  fs.mkdirSync(path.join(client, 'config'), { recursive: true });
  fs.mkdirSync(path.join(client, 'manifest'), { recursive: true });
  fs.writeFileSync(path.join(client, 'config', 'game.json'), JSON.stringify({ version: '9.9.9' }) + '\n');
  fs.writeFileSync(path.join(client, 'manifest', 'integrity.json'), '{"files":[]}\n');
  fs.writeFileSync(path.join(root, 'rnr.html'), '<html></html>\n');
  fs.mkdirSync(path.join(root, 'assets', 'image'), { recursive: true });
  fs.mkdirSync(path.join(root, 'assets', 'data', 'ok'), { recursive: true });
  fs.mkdirSync(path.join(root, 'assets', 'data', 'players', '06', 'comics', 'reference'), { recursive: true });
  fs.writeFileSync(path.join(root, 'assets', 'image', 'game-logo.webp'), 'logo');
  const wavs = [
    ['assets', 'sounds', 'engine', 'sound_001.wav'],
    ['assets', 'sounds', 'engine', 'sound_002.wav'],
    ['assets', 'sounds', 'engine', 'sound_003.wav'],
    ['assets', 'sounds', 'engine', 'sound_004.wav'],
    ['assets', 'sounds', 'engine', 'sound_005.wav'],
    ['assets', 'sounds', 'cars', 'wheels', 'sound_025.wav'],
    ['assets', 'sounds', 'cars', 'wheels', 'sound_026.wav'],
    ['assets', 'sounds', 'cars', 'NOSZ', 'sound_084.wav'],
    ['assets', 'sounds', 'cars', 'NOSZ', 'sound_011.wav']
  ];
  for (const parts of wavs) {
    const file = path.join(root, ...parts);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'RIFF');
  }
  fs.writeFileSync(path.join(root, 'assets', 'data', 'ok', 'car.json'), '{}');
  fs.writeFileSync(path.join(root, 'assets', 'data', 'notes.md'), 'skip');
  fs.writeFileSync(path.join(root, 'assets', 'data', 'players', '06', 'comics', 'reference', 'photo.jpg'), 'skip');
  return { root, client };
}

test('Пакует store-zip без reference и markdown', () => {
  const { root, client } = makeFixture();
  const zipPath = path.join(client, 'dist', 'kolesnica-content-9.9.9.zip');
  packGameRelease({ clientDir: client, gameRoot: root, version: '9.9.9', zipPath });
  assert.equal(fs.existsSync(zipPath), true);
  assert.equal(fs.existsSync(path.join(client, 'dist', 'game-stage')), false);

  const listed = spawnSync('tar', ['-tf', zipPath], { encoding: 'utf8' });
  assert.equal(listed.status, 0, listed.stderr);
  const names = listed.stdout.split(/\r?\n/).filter(Boolean);
  assert.ok(names.includes('rnr.html'));
  assert.ok(names.includes('install.json'));
  assert.ok(names.includes('desktop-manifest.json'));
  assert.ok(names.includes('assets/data/ok/car.json') || names.includes('assets\\data\\ok\\car.json'));
  assert.equal(names.some((name) => name.endsWith('.md')), false);
  assert.equal(names.some((name) => /reference/i.test(name) && name.includes('photo')), false);
});
