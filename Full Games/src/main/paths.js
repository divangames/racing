////////////////////////////////////////////////////////
//
// Пути клиента: корень игры, контент, манифест, userData.
// Браузерный проект не пишется — только чтение контента.
//
////////////////////////////////////////////////////////

'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const game = require('../../config/game.json');

const CLIENT_ROOT = path.resolve(__dirname, '../..');

/**
 * Запуск лаборатории: --lab в аргументах.
 * @returns {boolean}
 */
function isLabMode() {
  return process.argv.includes('--lab');
}

/**
 * Корень десктоп-проекта (Full Games).
 * @returns {string}
 */
function clientRoot() {
  return CLIENT_ROOT;
}

/**
 * Установленная лаунчером копия игры (профиль пользователя).
 * @returns {string}
 */
function installedGameRoot() {
  return path.join(app.getPath('userData'), 'Game');
}

/**
 * Каталог с rnr.html и assets. В разработке — соседняя браузерная игра.
 * @returns {string}
 */
function contentRoot() {
  const source = path.resolve(CLIENT_ROOT, game.contentDevRelative);
  if (!app.isPackaged) {
    return source;
  }
  const exeDir = path.dirname(process.execPath);
  const managed = installedGameRoot();
  if (fs.existsSync(path.join(managed, game.entry))) return managed;
  const candidates = [
    path.join(exeDir, game.contentInstallName),
    path.join(process.resourcesPath, 'content'),
    path.resolve(exeDir, '../../..')
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, game.entry))) return dir;
  }
  return managed;
}

/**
 * Локальные three / quarks, чтобы не ходить на CDN.
 * @returns {string}
 */
function vendorLocalRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'vendor-local');
  }
  return path.join(CLIENT_ROOT, 'vendor-local');
}

/**
 * Манифест целостности: сначала рядом с игрой, потом из пакета лаунчера.
 * @returns {string}
 */
function manifestPath() {
  const name = 'integrity.json';
  const localNames = [
    path.join(contentRoot(), 'desktop-manifest.json'),
    path.join(contentRoot(), 'manifest', name)
  ];
  for (const file of localNames) {
    if (fs.existsSync(file)) return file;
  }
  if (app.isPackaged) {
    const packed = path.join(process.resourcesPath, 'manifest', name);
    if (fs.existsSync(packed)) return packed;
  }
  return path.join(CLIENT_ROOT, 'manifest', name);
}

/**
 * Настройки окна клиента.
 * @returns {string}
 */
function settingsPath() {
  return path.join(app.getPath('userData'), 'client-settings.json');
}

module.exports = {
  game,
  clientRoot,
  contentRoot,
  installedGameRoot,
  vendorLocalRoot,
  manifestPath,
  settingsPath,
  isLabMode
};
