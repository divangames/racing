////////////////////////////////////////////////////////
//
// Манифест целостности ядра (скрипты и JSON машин).
// Картинки и звуки не хешируем целиком — 8 ГБ, это депо Steam.
//
////////////////////////////////////////////////////////

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const client = path.resolve(__dirname, '..');
const content = path.resolve(client, '..');
const outFile = path.join(client, 'manifest', 'integrity.json');
const game = JSON.parse(fs.readFileSync(path.join(client, 'config', 'game.json'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(client, 'package.json'), 'utf8'));

const FILES = [
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
  'world-intro.js',
  'armory.js',
  'tracks.js',
  'objects.js',
  'vfx/quarks-layer.js',
  'vfx/quarks-presets.js',
  'vfx/quarks-spray.js',
  'vfx/quarks-wreck.js',
  'vfx/quarks-weather.js',
  'vfx/weather-fx.js',
  'vendor/three.module.js',
  'vendor/three.quarks.esm.js',
  'assets/image/game-logo.webp'
];

/**
 * Собирает car.json всех слотов.
 * @returns {string[]}
 */
function carJsonFiles() {
  const dir = path.join(content, 'assets', 'data', 'cars');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => /^\d+$/.test(name))
    .map((name) => path.join('assets', 'data', 'cars', name, 'car.json'))
    .filter((rel) => fs.existsSync(path.join(content, rel)));
}

/**
 * SHA-256.
 * @param {string} filePath
 * @returns {string}
 */
function sha256(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

const files = [];
for (const rel of [...FILES, ...carJsonFiles()]) {
  const full = path.join(content, rel);
  if (!fs.existsSync(full)) {
    console.warn('Нет файла:', rel);
    continue;
  }
  const stat = fs.statSync(full);
  files.push({
    path: rel.replace(/\\/g, '/'),
    size: stat.size,
    sha256: sha256(full)
  });
}

const manifest = {
  id: 'kolesnica-voyny',
  version: game.version || pkg.version,
  created: new Date().toISOString(),
  note: 'Ядро клиента. Полный хеш ассетов — отдельное депо Steam.',
  files
};

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log('Записан манифест:', files.length, 'файлов →', outFile);
