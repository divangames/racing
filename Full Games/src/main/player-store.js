////////////////////////////////////////////////////////
//
// Сейвы DiVANEngine: JSON в профиле Windows, ключи как в localStorage.
//
////////////////////////////////////////////////////////

'use strict';

const fs = require('fs');
const path = require('path');
const { writeDocument } = require('./document-store');

const KEY_RE = /^rnr_ru[A-Za-z0-9._-]{0,64}$/;
const MAX_CHARS = 1500000;

/**
 * Каталог сейвов: явный корень или профиль клиента.
 * @param {string} [root]
 * @returns {string}
 */
function resolveRoot(root) {
  if (root) return root;
  return require('./paths').savesRoot();
}

/**
 * Имя ключа безопасное для файла.
 * @param {string} key
 * @returns {boolean}
 */
function validKey(key) {
  return typeof key === 'string' && KEY_RE.test(key);
}

/**
 * Путь файла ключа.
 * @param {string} key
 * @param {string} [root]
 * @returns {string|null}
 */
function keyFile(key, root) {
  if (!validKey(key)) return null;
  return path.join(resolveRoot(root), key + '.json');
}

/**
 * Текст слота или null.
 * @param {string} key
 * @param {string} [root]
 * @returns {string|null}
 */
function get(key, root) {
  const file = keyFile(key, root);
  if (!file || !fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, 'utf8');
  try {
    const data = JSON.parse(raw);
    if (data && data.divan === 1 && typeof data.text === 'string') return data.text;
  } catch (err) {
    return raw;
  }
  return raw;
}

/**
 * Пишет строку как localStorage. Неверный ключ или размер — false.
 * @param {string} key
 * @param {string} value
 * @param {string} [root]
 * @returns {boolean}
 */
function set(key, value, root) {
  if (typeof value !== 'string' || value.length > MAX_CHARS) return false;
  const file = keyFile(key, root);
  if (!file) return false;
  writeDocument(file, { divan: 1, text: value }, false);
  return true;
}

/**
 * Удаляет файл ключа.
 * @param {string} key
 * @param {string} [root]
 * @returns {boolean}
 */
function remove(key, root) {
  const file = keyFile(key, root);
  if (!file) return false;
  if (fs.existsSync(file)) fs.unlinkSync(file);
  const prev = file + '.previous';
  if (fs.existsSync(prev)) fs.unlinkSync(prev);
  return true;
}

/**
 * Все слоты для вставки в HTML до скриптов игры.
 * @param {string} [root]
 * @returns {Record<string, string>}
 */
function exportAll(root) {
  const dir = resolveRoot(root);
  const out = {};
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return out;
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.json') || name.endsWith('.previous.json')) continue;
    const key = name.slice(0, -5);
    const text = get(key, dir);
    if (text != null) out[key] = text;
  }
  return out;
}

module.exports = { validKey, get, set, remove, exportAll, keyFile };
