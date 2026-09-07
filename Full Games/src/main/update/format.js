////////////////////////////////////////////////////////
//
// Подписи размера и скорости для статус-бара.
//
////////////////////////////////////////////////////////

'use strict';

/**
 * Байты в читаемую строку.
 * @param {number} n
 * @returns {string}
 */
function formatBytes(n) {
  const v = Number(n) || 0;
  if (v < 1024) return v + ' Б';
  if (v < 1024 * 1024) return (v / 1024).toFixed(1) + ' КБ';
  if (v < 1024 * 1024 * 1024) return (v / (1024 * 1024)).toFixed(1) + ' МБ';
  return (v / (1024 * 1024 * 1024)).toFixed(2) + ' ГБ';
}

/**
 * Байт/с в строку.
 * @param {number} n
 * @returns {string}
 */
function formatSpeed(n) {
  return formatBytes(n) + '/с';
}

module.exports = { formatBytes, formatSpeed };
