////////////////////////////////////////////////////////
//
// Окна лаунчера и игры. Меню Chromium скрыто.
//
////////////////////////////////////////////////////////

'use strict';

const fs = require('fs');
const path = require('path');
const { BrowserWindow, Menu, shell, screen } = require('electron');
const { gameStartUrl, labStartUrl } = require('./protocol');
const { loadSettings, saveSettings } = require('./settings');
const { game, clientRoot } = require('./paths');

/** Заголовок отдельного приложения редактора. */
const EDITOR_TITLE = 'DiVANEngine';

/**
 * Иконка окна: та же, что у клиента, если файл на месте.
 * @returns {string|undefined}
 */
function windowIcon() {
  const file = path.join(clientRoot(), 'build', 'icon.ico');
  return fs.existsSync(file) ? file : undefined;
}

let launcherWindow = null;
let gameWindow = null;
let labWindow = null;

/** Мониторы в стабильном порядке для меню графики. */
function gameDisplays() {
  const primary = screen.getPrimaryDisplay();
  return screen.getAllDisplays().map((display, index) => ({
    id: display.id,
    name: 'Экран ' + (index + 1) + (display.id === primary.id ? ' · основной' : ''),
    primary: display.id === primary.id
  }));
}

/** Положение и режим окна меняются вместе, без потери окна при отключении монитора. */
function applyGameScreen(patch) {
  const current = loadSettings();
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  const requestedId = patch && Number.isInteger(patch.displayId) ? patch.displayId : current.displayId;
  const target = displays.find((display) => display.id === requestedId) || primary;
  const fullscreen = patch && typeof patch.fullscreen === 'boolean' ? patch.fullscreen : current.fullscreen;
  const next = saveSettings({ fullscreen, displayId: target.id });
  if (gameWindow && !gameWindow.isDestroyed()) {
    const moving = screen.getDisplayMatching(gameWindow.getBounds()).id !== target.id;
    const wasFullscreen = gameWindow.isFullScreen();
    if (moving) {
      if (wasFullscreen) gameWindow.setFullScreen(false);
      const bounds = gameWindow.getBounds();
      gameWindow.setBounds({
        x: target.workArea.x + Math.max(0, Math.floor((target.workArea.width - bounds.width) / 2)),
        y: target.workArea.y + Math.max(0, Math.floor((target.workArea.height - bounds.height) / 2)),
        width: Math.min(bounds.width, target.workArea.width),
        height: Math.min(bounds.height, target.workArea.height)
      });
    }
    if (gameWindow.isFullScreen() !== fullscreen) gameWindow.setFullScreen(fullscreen);
  }
  return next;
}

/**
 * Общие флаги окна: без Node в странице.
 * @param {string} preloadFile
 * @returns {object}
 */
function webPrefs(preloadFile) {
  const prefs = {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    spellcheck: false
  };
  if (preloadFile) prefs.preload = preloadFile;
  return prefs;
}

/**
 * Окно лаунчера.
 * @returns {Electron.BrowserWindow}
 */
function createLauncherWindow() {
  if (launcherWindow && !launcherWindow.isDestroyed()) {
    launcherWindow.show();
    return launcherWindow;
  }
  launcherWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 1280,
    minHeight: 720,
    maxWidth: 1280,
    maxHeight: 720,
    useContentSize: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    backgroundColor: '#050409',
    frame: false,
    autoHideMenuBar: true,
    title: game.title,
    webPreferences: webPrefs(path.join(__dirname, '../preload/launcher.js'))
  });
  launcherWindow.setResizable(false);
  launcherWindow.setMenuBarVisibility(false);
  launcherWindow.webContents.on('context-menu', (event) => {
    event.preventDefault();
  });
  launcherWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });
  launcherWindow.webContents.session.on('will-download', (event) => {
    event.preventDefault();
  });
  launcherWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('Лаунчер не загрузился', code, desc, url);
  });
  launcherWindow.loadFile(path.join(__dirname, '../launcher/index.html'));
  launcherWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  launcherWindow.on('closed', () => {
    launcherWindow = null;
  });
  return launcherWindow;
}

/**
 * Окно заезда: контент с rnr://.
 * @returns {Electron.BrowserWindow}
 */
function createGameWindow() {
  if (gameWindow && !gameWindow.isDestroyed()) {
    gameWindow.show();
    return gameWindow;
  }
  gameWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1024,
    minHeight: 576,
    backgroundColor: '#050409',
    autoHideMenuBar: true,
    fullscreen: false,
    title: game.title,
    webPreferences: webPrefs(path.join(__dirname, '../preload/game.js'))
  });
  gameWindow.setMenuBarVisibility(false);
  gameWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('Игра не загрузилась', code, desc, url);
    if (launcherWindow && !launcherWindow.isDestroyed()) {
      muteLauncherAudio(false);
      launcherWindow.show();
    }
  });
  gameWindow.webContents.once('did-finish-load', () => {
    if (launcherWindow && !launcherWindow.isDestroyed()) {
      muteLauncherAudio(true);
      launcherWindow.hide();
    }
    applyGameScreen({});
  });
  gameWindow.loadURL(gameStartUrl());
  gameWindow.on('closed', () => {
    gameWindow = null;
    if (launcherWindow && !launcherWindow.isDestroyed()) {
      muteLauncherAudio(false);
      launcherWindow.show();
    }
  });
  return gameWindow;
}

/**
 * Окно редактора DiVANEngine: машины и трассы, запись в папку игры.
 * @returns {Electron.BrowserWindow}
 */
function createLabWindow() {
  if (labWindow && !labWindow.isDestroyed()) {
    if (labWindow.isMinimized()) labWindow.restore();
    labWindow.show();
    labWindow.focus();
    return labWindow;
  }
  const icon = windowIcon();
  labWindow = new BrowserWindow({
    width: 1680,
    height: 960,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0c121a',
    autoHideMenuBar: true,
    title: EDITOR_TITLE,
    show: false,
    icon,
    webPreferences: webPrefs(path.join(__dirname, '../preload/game.js'))
  });
  Menu.setApplicationMenu(null);
  labWindow.setMenuBarVisibility(false);
  labWindow.webContents.on('context-menu', (event) => {
    event.preventDefault();
  });
  labWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  labWindow.once('ready-to-show', () => {
    if (labWindow && !labWindow.isDestroyed()) labWindow.show();
  });
  labWindow.loadURL(labStartUrl());
  labWindow.on('closed', () => {
    labWindow = null;
  });
  return labWindow;
}

/**
 * Глушит звук скрытого окна лаунчера.
 * @param {boolean} mute
 */
function muteLauncherAudio(mute) {
  if (launcherWindow && !launcherWindow.isDestroyed()) {
    launcherWindow.webContents.setAudioMuted(Boolean(mute));
  }
}

/**
 * Старт заезда из лаунчера.
 */
function playGame() {
  muteLauncherAudio(true);
  createGameWindow();
}

/**
 * Показать уже открытое окно (второй клик по ярлыку).
 */
function focusExisting() {
  const win = gameWindow && !gameWindow.isDestroyed()
    ? gameWindow
    : (labWindow && !labWindow.isDestroyed()
      ? labWindow
      : launcherWindow);
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

/**
 * Есть ли живое окно заезда.
 * @returns {boolean}
 */
function hasGameWindow() {
  return Boolean(gameWindow && !gameWindow.isDestroyed());
}

module.exports = {
  createLauncherWindow,
  createGameWindow,
  createLabWindow,
  playGame,
  gameDisplays,
  applyGameScreen,
  hasGameWindow,
  focusExisting
};
