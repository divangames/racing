////////////////////////////////////////////////////////
//
// Номер лаунчера: MSI, package.json и тег launcher-*.
//
////////////////////////////////////////////////////////

'use strict';

const fs = require('fs');
const path = require('path');
const {
  normalizeVersion,
  isGameVersion,
  toNpmVersion,
  writeJsonVersion,
  writeLockRootVersion
} = require('./set-game-version.cjs');

const client = path.resolve(__dirname, '..');

/**
 * Пишет версию лаунчера, не трогая zip игры.
 * @param {string} raw
 * @returns {string}
 */
function setLauncherVersion(raw) {
  const version = normalizeVersion(raw);
  if (!isGameVersion(version)) {
    throw new Error('Версия должна быть числом с точками, например 0.2.2.5');
  }
  const npmVersion = toNpmVersion(version);
  writeJsonVersion(path.join(client, 'config', 'launcher.json'), version);
  writeJsonVersion(path.join(client, 'package.json'), npmVersion);
  const lockPath = path.join(client, 'package-lock.json');
  if (fs.existsSync(lockPath)) writeLockRootVersion(lockPath, npmVersion);
  return version;
}

if (require.main === module) {
  try {
    const version = setLauncherVersion(process.argv[2]);
    console.log('Версия лаунчера:', version);
  } catch (err) {
    console.error(err.message || String(err));
    process.exit(1);
  }
}

module.exports = { setLauncherVersion };
