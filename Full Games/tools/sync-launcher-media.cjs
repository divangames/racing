////////////////////////////////////////////////////////
//
// Копирует арт и музыку Load в папку лаунчера для MSI.
//
////////////////////////////////////////////////////////

'use strict';

const fs = require('fs');
const path = require('path');

const client = path.resolve(__dirname, '..');
const game = path.resolve(client, '..');
const dest = path.join(client, 'src', 'launcher', 'media');
const musicSrc = path.join(game, 'assets', 'music', 'Load');

/**
 * Копирует файл, если он есть.
 * @param {string} from
 * @param {string} to
 */
function copyIf(from, to) {
  if (!fs.existsSync(from)) {
    console.warn('Нет файла:', from);
    return false;
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  return true;
}

if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });

copyIf(path.join(game, 'assets', 'image', 'launcher-hero.webp'), path.join(dest, 'launcher-hero.webp'));
copyIf(path.join(game, 'assets', 'image', 'game-logo.webp'), path.join(dest, 'game-logo.webp'));
copyIf(path.join(game, 'assets', 'sounds', 'FX', 'PianoHit.mp3'), path.join(dest, 'play-ready.mp3'));

const fontSrc = path.join(game, 'assets', 'fonts', 'bender');
if (fs.existsSync(fontSrc)) {
  for (const name of fs.readdirSync(fontSrc).filter((file) => /\.otf$/i.test(file))) {
    copyIf(path.join(fontSrc, name), path.join(dest, 'fonts', 'bender', name));
  }
}

const tracks = [];
if (fs.existsSync(musicSrc)) {
  const names = fs.readdirSync(musicSrc)
    .filter((name) => /\.(mp3|ogg|wav)$/i.test(name))
    .sort();
  for (const name of names) {
    copyIf(path.join(musicSrc, name), path.join(dest, 'load', name));
    tracks.push('media/load/' + name);
  }
}
fs.writeFileSync(path.join(dest, 'tracks.json'), JSON.stringify(tracks, null, 2) + '\n');
console.log('Медиа лаунчера:', dest);
console.log('Треки Load:', tracks.length);
console.log('Шрифт Bender и сигнал «Играть» скопированы в media.');
