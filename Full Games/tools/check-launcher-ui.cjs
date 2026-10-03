'use strict';
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const output = path.resolve(__dirname, '../build/launcher-ui-check');
fs.mkdirSync(output, { recursive: true });
app.setPath('userData', fs.mkdtempSync(path.join(output, 'profile-')));
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const errors = [];
  const win = new BrowserWindow({ show: false, width: 1280, height: 720,
    webPreferences: { offscreen: true, backgroundThrottling: false } });
  win.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
  await win.loadFile(path.resolve(__dirname, '../src/launcher/index.html'));
  async function capture(name, width, height, setup) {
    win.setContentSize(width, height);
    await new Promise(resolve => setTimeout(resolve, 150));
    const info = await win.webContents.executeJavaScript(`(() => {
      ${setup}
      const rail = document.querySelector('.rail').getBoundingClientRect();
      const actions = document.querySelector('.actions').getBoundingClientRect();
      const dock = document.querySelector('.dock').getBoundingClientRect();
      return {rail:{x:rail.x,y:rail.y,w:rail.width,h:rail.height},actions:{x:actions.x,y:actions.y,w:actions.width,h:actions.height},dock:{x:dock.x,y:dock.y,w:dock.width,h:dock.height},height:innerHeight,width:innerWidth};
    })()`);
    fs.writeFileSync(path.join(output, name + '.png'), (await win.webContents.capturePage()).toPNG());
    return info;
  }
  const ready = "document.querySelector('.stage').className='stage is-ready';document.querySelector('#btn-play').disabled=false";
  const regular = await capture('regular', 1280, 720, ready);
  const updating = await capture('updating', 1280, 720, ready + ";document.querySelector('#btn-self').hidden=false;document.querySelector('#btn-sync').hidden=false");
  const compact = await capture('compact', 1024, 576, ready + ";document.querySelector('#btn-self').hidden=false;document.querySelector('#btn-sync').hidden=false");
  for (const screen of [regular, updating, compact]) {
    assert(screen.actions.y >= 44, 'Actions overlap title bar');
    assert(screen.actions.y + screen.actions.h <= screen.dock.y - 8, 'Actions overlap status');
    assert(screen.dock.y + screen.dock.h <= screen.height + 1, 'Status leaves viewport');
  }
  const failures = await win.webContents.executeJavaScript(`(async () => {
    window.rnrLauncher = {
      onVerifyProgress() {}, onSyncProgress() {}, onSelfProgress() {},
      status: async () => { throw Error('status failure'); },
      verify: async () => { throw Error('verify failure'); },
      play: async () => { throw Error('play failure'); }
    };
    await boot();
    const status = document.querySelector('#status').textContent;
    document.querySelector('#btn-verify').click();
    await new Promise(resolve => setTimeout(resolve, 0));
    const verify = { text: document.querySelector('#status').textContent, enabled: !document.querySelector('#btn-verify').disabled };
    document.querySelector('#btn-play').disabled = false;
    document.querySelector('#btn-play').click();
    await new Promise(resolve => setTimeout(resolve, 0));
    const play = { text: document.querySelector('#status').textContent, enabled: !document.querySelector('#btn-play').disabled };
    return {status, verify, play};
  })()`);
  assert.match(failures.status, /status failure/);
  assert.match(failures.verify.text, /verify failure/); assert(failures.verify.enabled);
  assert.match(failures.play.text, /play failure/); assert(failures.play.enabled);
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ regular, updating, compact, failures, errors }, null, 2));
  console.log(JSON.stringify({ regular, updating, compact, failures, errors }, null, 2));
  win.destroy(); app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
