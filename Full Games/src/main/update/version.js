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
 * Три поля WiX/MSI (каждое 0–255) из нашего номера 0.A.B.C → A.B.C.
 * Иначе electron-builder режет 0.2.2.6 до 0.2.2 и апгрейд не идёт.
 * @param {string} ver
 * @returns {string}
 */
function toMsiProductVersion(ver) {
  const p = parts(ver);
  while (p.length < 3) p.push(0);
  let major = p[0];
  let minor = p[1];
  let build = p[2];
  if (p[0] === 0 && p.length >= 4) {
    major = p[1];
    minor = p[2];
    build = p[3];
  }
  const clamp = (n) => Math.max(0, Math.min(255, Number(n) || 0));
  return clamp(major) + '.' + clamp(minor) + '.' + clamp(build);
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

module.exports = { normalizeTag, isNewer, toMsiProductVersion };
