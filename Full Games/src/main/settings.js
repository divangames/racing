////////////////////////////////////////////////////////
//
// Настройки окна игры.
//
////////////////////////////////////////////////////////

'use strict';

const fs = require('fs');
const { settingsPath } = require('./paths');

const DEFAULTS = {
  fullscreen: true,
  displayId: null
};

/**
 * Читает настройки или заводские значения.
 * @returns {{fullscreen: boolean, displayId: number|null}}
 */
function loadSettings() {
  try {
    const raw = fs.readFileSync(settingsPath(), 'utf8');
    const data = JSON.parse(raw);
    return {
      fullscreen: data.fullscreen !== false,
      displayId: Number.isInteger(data.displayId) ? data.displayId : null
    };
  } catch (err) {
    return { ...DEFAULTS };
  }
}

/**
 * Пишет настройки на диск пользователя.
 * @param {{fullscreen?: boolean, displayId?: number|null}} patch
 * @returns {{fullscreen: boolean, displayId: number|null}}
 */
function saveSettings(patch) {
  const next = { ...loadSettings(), ...patch };
  fs.mkdirSync(require('path').dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2) + '\n', 'utf8');
  return next;
}

module.exports = { loadSettings, saveSettings };
