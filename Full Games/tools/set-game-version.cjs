////////////////////////////////////////////////////////
//
// Пишет номер zip-игры в game.json и движок. Лаунчер — set-launcher-version.
//
////////////////////////////////////////////////////////

'use strict';

const fs = require('fs');
const path = require('path');

const client = path.resolve(__dirname, '..');

/**
 * Обрезает префикс v и пробелы.
 * @param {string} raw
 * @returns {string}
 */
function normalizeVersion(raw) {
  return String(raw || '')
    .trim()
    .replace(/^v/i, '');
}

/**
 * Номер вида 0.2.1 или 0.2.1.0 (1–4 части).
 * @param {string} ver
 * @returns {boolean}
 */
function isGameVersion(ver) {
  return /^\d+(\.\d+){0,3}$/.test(ver);
}

/**
 * Поднимает последний сегмент: 0.2.2.6 → 0.2.2.7.
 * @param {string} ver
 * @returns {string}
 */
function bumpLastSegment(ver) {
  const version = normalizeVersion(ver);
  if (!isGameVersion(version)) {
    throw new Error('Нельзя поднять номер: ' + ver);
  }
  const bits = version.split('.');
  bits[bits.length - 1] = String(Number(bits[bits.length - 1]) + 1);
  return bits.join('.');
}

/**
 * electron-builder требует SemVer из трёх частей.
 * Четвёртая становится пререлизом: 0.2.1.3 → 0.2.1-3.
 * @param {string} ver
 * @returns {string}
 */
function toNpmVersion(ver) {
  const bits = String(ver).split('.');
  while (bits.length < 3) bits.push('0');
  if (bits.length === 3) return bits.join('.');
  return bits.slice(0, 3).join('.') + '-' + bits[3];
}

/**
 * Меняет поле version в JSON-файле.
 * @param {string} filePath
 * @param {string} version
 */
function writeJsonVersion(filePath, version) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  data.version = version;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/**
 * Только корневая версия lockfile, без перезаписи всего файла.
 * @param {string} filePath
 * @param {string} version
 */
function writeLockRootVersion(filePath, version) {
  let text = fs.readFileSync(filePath, 'utf8');
  const next = text
    .replace(/^  "version": "[^"]+",/m, '  "version": "' + version + '",')
    .replace(
      /(\n    "": \{\r?\n      "name": "kolesnica-voyny",\r?\n      "version": ")[^"]+(")/,
      '$1' + version + '$2'
    );
  if (next === text) {
    const root = text.match(/^  "version": "([^"]+)"/m);
    const nested = text.match(
      /\n    "": \{\r?\n      "name": "kolesnica-voyny",\r?\n      "version": "([^"]+)"/
    );
    if (root && root[1] === version && nested && nested[1] === version) return;
    throw new Error('Не удалось прописать версию в package-lock.json.');
  }
  fs.writeFileSync(filePath, next, 'utf8');
}

/**
 * Записывает версию во все канонические файлы клиента.
 * Номер рантайма в окне берётся из game.json при отдаче HTML.
 * @param {string} raw
 * @returns {string}
 */
function setGameVersion(raw) {
  const version = normalizeVersion(raw);
  if (!isGameVersion(version)) {
    throw new Error('Версия должна быть числом с точками, например 0.2.1.0');
  }
  writeJsonVersion(path.join(client, 'config', 'game.json'), version);
  return version;
}

if (require.main === module) {
  try {
    const version = setGameVersion(process.argv[2]);
    console.log('Версия игры:', version);
  } catch (err) {
    console.error(err.message || String(err));
    process.exit(1);
  }
}

module.exports = {
  normalizeVersion,
  isGameVersion,
  bumpLastSegment,
  toNpmVersion,
  writeJsonVersion,
  writeLockRootVersion,
  setGameVersion
};
