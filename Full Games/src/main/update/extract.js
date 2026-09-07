////////////////////////////////////////////////////////
//
// Распаковка zip контента штатным tar Windows.
//
////////////////////////////////////////////////////////

'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

/**
 * Распаковывает zip в папку.
 * @param {string} zipPath
 * @param {string} destDir
 * @returns {Promise<void>}
 */
function extractZip(zipPath, destDir) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(destDir, { recursive: true });
    const child = spawn('tar', ['-xf', zipPath, '-C', destDir], {
      windowsHide: true
    });
    let err = '';
    child.stderr.on('data', (buf) => {
      err += buf.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(err.trim() || 'Распаковка zip не удалась.'));
    });
  });
}

/**
 * Меняет папку установки атомарно.
 * @param {string} staged
 * @param {string} dest
 */
function swapFolder(staged, dest) {
  const bak = dest + '.old';
  if (fs.existsSync(bak)) fs.rmSync(bak, { recursive: true, force: true });
  if (fs.existsSync(dest)) fs.renameSync(dest, bak);
  fs.renameSync(staged, dest);
  if (fs.existsSync(bak)) fs.rmSync(bak, { recursive: true, force: true });
}

/**
 * Если zip внутри одной папки Content — поднимает файлы.
 * @param {string} dest
 * @param {string} entryName
 */
function flattenIfNested(dest, entryName) {
  const nested = path.join(dest, 'Content', entryName);
  if (!fs.existsSync(nested)) return;
  const inner = path.join(dest, 'Content');
  const tmp = dest + '.flat';
  if (fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true, force: true });
  fs.renameSync(inner, tmp);
  for (const name of fs.readdirSync(dest)) {
    fs.rmSync(path.join(dest, name), { recursive: true, force: true });
  }
  for (const name of fs.readdirSync(tmp)) {
    fs.renameSync(path.join(tmp, name), path.join(dest, name));
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}

module.exports = { extractZip, swapFolder, flattenIfNested };
