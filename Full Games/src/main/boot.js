////////////////////////////////////////////////////////
//
// Точка входа Electron. Схему rnr:// регистрируем до ready.
//
////////////////////////////////////////////////////////

'use strict';

const { app, dialog } = require('electron');
const { registerPrivilegedScheme, attachProtocol } = require('./protocol');
const { bindLauncherIpc } = require('./ipc');
const { createLauncherWindow, createGameWindow, createLabWindow, focusExisting } = require('./windows');
const { game, isLabMode } = require('./paths');

registerPrivilegedScheme();

app.setName(game.title);
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const startGameDirect = process.argv.includes('--game');
const startLab = isLabMode();

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    focusExisting();
  });
  app.whenReady().then(() => {
    attachProtocol();
    bindLauncherIpc();
    if (startLab) {
      createLabWindow();
    } else if (startGameDirect) {
      createGameWindow();
    } else {
      createLauncherWindow();
    }
  }).catch((err) => {
    console.error(err);
    dialog.showErrorBox(game.title, String(err && err.message ? err.message : err));
    app.quit();
  });
}

app.on('window-all-closed', () => {
  app.quit();
});
