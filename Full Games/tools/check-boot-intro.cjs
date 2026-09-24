// Проверка ролика и дисклеймера в настоящем окне Electron.
'use strict';

const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const protocol = require('../src/main/protocol');

const profile = path.resolve(__dirname, '../build/boot-intro-check-profile');
fs.mkdirSync(profile, { recursive: true });
app.setPath('userData', profile);
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
protocol.registerPrivilegedScheme();
app.on('window-all-closed', () => {});

async function waitFor(win, expression, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await win.webContents.executeJavaScript(expression);
    if (value) return value;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Не дождались: ' + expression);
}

app.whenReady().then(async () => {
  protocol.attachProtocol();
  const win = new BrowserWindow({
    show: false, width: 1280, height: 720,
    webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false }
  });
  try {
    await win.loadURL('rnr://game/rnr.html');
    const intro = await waitFor(win, `(() => {
      const video = document.querySelector('.boot-creator-video');
      return video && video.currentTime > 0.2 && {
        time: video.currentTime, duration: video.duration, jobs: BOOT.jobs.length,
        playing: BOOT.creatorIntroPlaying, disclaimer: BOOT.disclaimerT0
      };
    })()`, 20000);
    assert(intro.playing);
    assert(intro.jobs > 0, 'Контент должен загружаться во время ролика');
    assert.equal(intro.disclaimer, undefined);
    await win.webContents.executeJavaScript("document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', code:'Escape', bubbles:true}))");
    const afterKey = await win.webContents.executeJavaScript('BOOT.creatorIntroPlaying && !BOOT.disclaimerT0');
    assert(afterKey, 'Escape не должен пропускать ролик');
    const disclaimerT0 = await waitFor(win, 'BOOT.disclaimerT0 && BOOT.disclaimerT0', 120000);
    assert(disclaimerT0 > 0);
    const beforeFive = await win.webContents.executeJavaScript('BOOT.ready');
    assert.equal(beforeFive, false);
    await waitFor(win, 'BOOT.ready && BOOT.ready', 120000);
    const held = await win.webContents.executeJavaScript('performance.now() - BOOT.disclaimerT0');
    assert(held >= 5000, 'Дисклеймер должен идти не меньше 5 секунд');
    console.log(JSON.stringify({ intro, disclaimerHeldMs: Math.round(held) }));
  } finally {
    win.destroy();
    app.quit();
  }
}).catch(error => { console.error(error); app.exit(1); });
