////////////////////////////////////////////////////////
//
// Готовит dist-content: код копируется, assets — стык на оригинал.
//
////////////////////////////////////////////////////////

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const client = path.resolve(__dirname, '..');
const source = path.resolve(client, '..');
const dest = path.resolve(process.argv[2] || path.join(client, 'dist-content'));

const CODE = [
  'rnr.html',
  'career.js',
  'chars.js',
  'music.js',
  'sounds.js',
  'car-audio.js',
  'car-audio-voice.js',
  'car-tires.js',
  'car-nos.js',
  'weapon-audio.js',
  'voice.js',
  'notice.js',
  'combat-kits.js',
  'starter-kits.js',
  'mid-kits.js',
  'armory.js',
  'tracks.js',
  'objects.js'
];

/**
 * Копирует файл, создавая папки.
 * @param {string} from
 * @param {string} to
 */
function copyFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

/**
 * Рекурсивное копирование каталога.
 * @param {string} from
 * @param {string} to
 */
function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const name of fs.readdirSync(from)) {
    const a = path.join(from, name);
    const b = path.join(to, name);
    if (fs.statSync(a).isDirectory()) copyDir(a, b);
    else copyFile(a, b);
  }
}

if (fs.existsSync(dest)) {
  fs.rmSync(dest, { recursive: true, force: true });
}
fs.mkdirSync(dest, { recursive: true });

for (const rel of CODE) {
  const from = path.join(source, rel);
  if (fs.existsSync(from)) copyFile(from, path.join(dest, rel));
}

for (const dir of ['vfx', 'vendor']) {
  const from = path.join(source, dir);
  if (fs.existsSync(from)) copyDir(from, path.join(dest, dir));
}

const assetsLink = path.join(dest, 'assets');
const assetsSrc = path.join(source, 'assets');
if (process.platform === 'win32' && fs.existsSync(assetsSrc)) {
  const result = spawnSync('cmd', ['/c', 'mklink', '/J', assetsLink, assetsSrc], {
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    console.warn('Стык assets не создан. Игра в разработке читает папку браузерного проекта напрямую.');
    console.warn((result.stderr || result.stdout || '').trim());
  } else {
    console.log('Стык assets →', assetsSrc);
  }
}

console.log('Контент:', dest);
