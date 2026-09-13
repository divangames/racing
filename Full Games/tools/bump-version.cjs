////////////////////////////////////////////////////////
//
// Автономер для команд «Обнови игру» / «Обнови лаунчер».
//
////////////////////////////////////////////////////////

'use strict';

const fs = require('fs');
const path = require('path');
const { bumpLastSegment, setGameVersion } = require('./set-game-version.cjs');
const { setLauncherVersion } = require('./set-launcher-version.cjs');

const client = path.resolve(__dirname, '..');

/**
 * Читает текущий номер из JSON.
 * @param {string} relativePath
 * @returns {string}
 */
function readVersion(relativePath) {
  const data = JSON.parse(fs.readFileSync(path.join(client, relativePath), 'utf8'));
  return String(data.version || '');
}

/**
 * Пишет новый номер игры или лаунчера.
 * @param {'game'|'launcher'} target
 * @param {string} [explicit]
 * @returns {string}
 */
function bumpVersion(target, explicit) {
  if (target !== 'game' && target !== 'launcher') {
    throw new Error('Нужно game или launcher.');
  }
  const file = target === 'game' ? 'config/game.json' : 'config/launcher.json';
  const next = explicit ? String(explicit).trim() : bumpLastSegment(readVersion(file));
  return target === 'game' ? setGameVersion(next) : setLauncherVersion(next);
}

if (require.main === module) {
  try {
    const version = bumpVersion(process.argv[2], process.argv[3]);
    console.log(version);
  } catch (err) {
    console.error(err.message || String(err));
    process.exit(1);
  }
}

module.exports = { bumpVersion };
