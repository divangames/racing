////////////////////////////////////////////////////////
//
// Настройки клиента: полный экран, не смешиваются с браузером.
//
////////////////////////////////////////////////////////

'use strict';

const fs = require('fs');
const { settingsPath } = require('./paths');

const DEFAULTS = {
  fullscreen: true
};

/**
 * Читает настройки или заводские значения.
 * @returns {{fullscreen: boolean}}
 */
function loadSettings() {
  try {
    const raw = fs.readFileSync(settingsPath(), 'utf8');
    const data = JSON.parse(raw);
    return {
      fullscreen: data.fullscreen !== false
    };
  } catch (err) {
    return { ...DEFAULTS };
  }
}

/**
 * Пишет настройки на диск пользователя.
 * @param {{fullscreen?: boolean}} patch
 * @returns {{fullscreen: boolean}}
 */
function saveSettings(patch) {
  const next = { ...loadSettings(), ...patch };
  fs.mkdirSync(require('path').dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2) + '\n', 'utf8');
  return next;
}

module.exports = { loadSettings, saveSettings };
