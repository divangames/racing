////////////////////////////////////////////////////////
//
// Сравнение версий тегов релиза игры.
//
////////////////////////////////////////////////////////

'use strict';

/**
 * Срезает префиксы тега до номера.
 * @param {string} tag
 * @returns {string}
 */
function normalizeTag(tag) {
  return String(tag || '')
    .trim()
    .replace(/^v/i, '')
    .replace(/^(game|content|launcher)[-_]/i, '');
}

/**
 * Разбивает номер на части.
 * @param {string} ver
 * @returns {number[]}
 */
function parts(ver) {
  return normalizeTag(ver).split(/[^\d]+/).filter(Boolean).map((n) => parseInt(n, 10) || 0);
}

/**
 * remote новее local (пустой local — всегда да).
 * @param {string} remote
 * @param {string} local
 * @returns {boolean}
 */
function isNewer(remote, local) {
  if (!remote) return false;
  if (!local) return true;
  const a = parts(remote);
  const b = parts(local);
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

module.exports = { normalizeTag, isNewer };
