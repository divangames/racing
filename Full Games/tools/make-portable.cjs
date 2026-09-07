////////////////////////////////////////////////////////
//
// Готовый портативный билд: unpacked Electron + Content рядом с exe.
//
////////////////////////////////////////////////////////

'use strict';

const fs = require('fs');
const path = require('path');
const { ensureContent } = require('./ensure-content.cjs');

const client = path.resolve(__dirname, '..');
const dist = path.join(client, 'dist');

/**
 * Папка win-unpacked после electron-builder --dir.
 * @returns {string}
 */
function findUnpacked() {
  const direct = path.join(dist, 'win-unpacked');
  if (fs.existsSync(direct)) return direct;
  if (!fs.existsSync(dist)) {
    throw new Error('Нет папки dist. Сначала electron-builder --win dir.');
  }
  const names = fs.readdirSync(dist);
  for (const name of names) {
    const full = path.join(dist, name);
    if (!fs.statSync(full).isDirectory()) continue;
    const hasExe = fs.readdirSync(full).some((f) => f.endsWith('.exe'));
    if (hasExe && name.toLowerCase().includes('unpacked')) return full;
  }
  throw new Error('Не найден win-unpacked в dist.');
}

const unpacked = findUnpacked();
ensureContent(unpacked);
console.log('Готовый билд:', unpacked);
console.log('Запуск: Колесница войны.exe или Играть.bat');
