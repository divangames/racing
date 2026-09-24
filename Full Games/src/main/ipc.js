////////////////////////////////////////////////////////
//
// IPC лаунчера: статус, проверка, старт, выход.
//
////////////////////////////////////////////////////////

'use strict';

const { app, ipcMain } = require('electron');
const { game, contentRoot } = require('./paths');
const { quickCheck, fullVerify } = require('./integrity');
const { loadSettings } = require('./settings');
const { playGame, createLabWindow, gameDisplays, applyGameScreen } = require('./windows');
const { snapshot, installLatest } = require('./update/service');
const { snapshot: launcherSnapshot, applyLatest, localVersion } = require('./update/launcher-self');
const playerStore = require('./player-store');
const { readChangelog } = require('./changelog');

/**
 * Подписка на каналы прелоада лаунчера.
 */
function bindLauncherIpc() {
  ipcMain.handle('launcher:changelog', () => readChangelog(app.isPackaged, process.resourcesPath));

  ipcMain.handle('launcher:status', async () => {
    const check = quickCheck();
    const install = await snapshot();
    const selfUpdate = await launcherSnapshot();
    return {
      title: game.title,
      version: game.version,
      launcherVersion: localVersion(),
      contentRoot: contentRoot(),
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

  ipcMain.on('game:screen-state', (event) => {
    event.returnValue = { settings: loadSettings(), displays: gameDisplays() };
  });
  ipcMain.handle('game:set-screen', (_event, patch) => applyGameScreen(patch || {}));

  ipcMain.handle('launcher:quit', async () => {
    app.quit();
  });

  ipcMain.handle('game:quit', async () => {
    app.quit();
  });

  ipcMain.handle('game:open-editor', async () => {
    createLabWindow();
    return { ok: true };
  });

  ipcMain.on('engine:store-get', (event, key) => {
    try {
      event.returnValue = playerStore.get(key);
    } catch (err) {
      event.returnValue = null;
    }
  });
  ipcMain.on('engine:store-set', (event, key, value) => {
    try {
      event.returnValue = playerStore.set(key, value);
    } catch (err) {
      event.returnValue = false;
    }
  });
  ipcMain.on('engine:store-remove', (event, key) => {
    try {
      event.returnValue = playerStore.remove(key);
    } catch (err) {
      event.returnValue = false;
    }
  });
}

module.exports = { bindLauncherIpc };
