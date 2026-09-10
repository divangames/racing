////////////////////////////////////////////////////////
//
// Отдача файлов движка и вставка рантайма в HTML.
//
////////////////////////////////////////////////////////

'use strict';

const fs = require('fs');
const path = require('path');
const { injectRuntime } = require('./engine-host');

const ROOT = path.resolve(__dirname, '../engine');

/**
 * Локальный модуль __engine/..., без выхода из каталога.
 * @param {string} rel
 * @returns {string|null}
 */
function engineFile(rel) {
  const name = rel.startsWith('__engine/') ? rel.slice(9) : null;
  if (!name) return null;
  const file = path.resolve(ROOT, name);
  const relative = path.relative(ROOT, file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return fs.existsSync(file) && fs.statSync(file).isFile() ? file : null;
}

/**
 * Подключает модули к игре или лаборатории.
 * @param {string} html
 * @param {{pathname?: string}} [options]
 * @returns {string}
 */
function enhanceHtml(html, options) {
  return injectRuntime(html, options);
}

module.exports = { engineFile, enhanceHtml };
