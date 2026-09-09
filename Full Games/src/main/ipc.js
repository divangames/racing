////////////////////////////////////////////////////////
//
// IPC лаунчера: статус, проверка, старт, выход.
//
////////////////////////////////////////////////////////

'use strict';

const { app, ipcMain } = require('electron');
const { game, contentRoot } = require('./paths');
const { quickCheck, fullVerify } = require('./integrity');
const { loadSettings, saveSettings } = require('./settings');
const { playGame, createLabWindow } = require('./windows');
const { snapshot, installLatest } = require('./update/service');
const { snapshot: launcherSnapshot, applyLatest, localVersion } = require('./update/launcher-self');

/**
 * Подписка на каналы прелоада лаунчера.
 */
function bindLauncherIpc() {
  ipcMain.handle('launcher:status', async () => {
    const check = quickCheck();
    const settings = loadSettings();
    const install = await snapshot();
    const selfUpdate = await launcherSnapshot();
    return {
      title: game.title,
      version: game.version,
      launcherVersion: localVersion(),
      contentRoot: contentRoot(),
      fullscreen: settings.fullscreen,
      check,
      install,
      selfUpdate
    };
  });

  ipcMain.handle('launcher:verify', async (event, payload) => {
    const full = Boolean(payload && payload.full);
    if (!full) return quickCheck();
    const sender = event.sender;
    return fullVerify((info) => {
      if (!sender.isDestroyed()) sender.send('launcher:verify-progress', info);
    });
  });

  ipcMain.handle('launcher:play', async () => {
    const check = quickCheck();
    if (!check.ok) return check;
    playGame();
    return { ok: true };
  });

  ipcMain.handle('launcher:sync', async (event) => {
    const sender = event.sender;
    const result = await installLatest((info) => {
      if (!sender.isDestroyed()) sender.send('launcher:sync-progress', info);
    });
    if (result.ok) {
      const check = quickCheck();
      return { ok: true, check, install: await snapshot() };
    }
    return { ok: false, issues: result.issues, install: await snapshot() };
  });

  ipcMain.handle('launcher:self-update', async (event) => {
    const sender = event.sender;
    const result = await applyLatest((info) => {
      if (!sender.isDestroyed()) sender.send('launcher:self-progress', info);
    });
    if (result.applying) return result;
    if (result.ok) {
      return { ok: true, applying: false, selfUpdate: await launcherSnapshot() };
    }
    return { ok: false, issues: result.issues, selfUpdate: await launcherSnapshot() };
  });

  ipcMain.handle('launcher:lab', async () => {
    createLabWindow();
    return {ok:true};
  });

  ipcMain.handle('launcher:set-fullscreen', async (_event, value) => {
    return saveSettings({ fullscreen: Boolean(value) });
  });

  ipcMain.handle('launcher:quit', async () => {
    app.quit();
  });

  ipcMain.handle('game:quit', async () => {
    app.quit();
  });
}

module.exports = { bindLauncherIpc };
