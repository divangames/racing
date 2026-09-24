'use strict';
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const output = path.join(__dirname, 'visual-polish-check');
fs.mkdirSync(output, { recursive: true });
app.disableHardwareAcceleration();
app.setPath('userData', path.join(output, 'profile'));
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
const protocol = require('../src/main/protocol');
protocol.registerPrivilegedScheme();
const errors = [];
app.on('window-all-closed', () => {});
async function ready(win) {
  const started = Date.now();
  while (Date.now() - started < 90000) {
    if (await win.webContents.executeJavaScript("typeof R !== 'undefined' && !!R && !!P && BOOT.ready && !!DiVANEngine.presentation")) return;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Race did not load');
}
app.whenReady().then(async () => {
  protocol.attachProtocol();
  const win = new BrowserWindow({ show: false, width: 1440, height: 900, webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
  win.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
  await win.loadURL('rnr://game/rnr.html?lab=1&car=0');
  await ready(win);
  const result = await win.webContents.executeJavaScript(`(() => {
    R.phase = 'go'; R.countT = 0; R.hintT = 0; P.invuln = 100; P.nitro = 6;
    settings.graphics.particles = 'high'; settings.graphics.combatHud = false;
    const point = R.S[Math.min(80, R.S.length - 1)];
    P.x = point.x; P.y = point.y; P.ang = point.ang; P.spd = P.st.top;
    paused = false;
    for (let i = 0; i < 36; i++) updRace(1 / 120);
    R.time = 5; R.msg = null; P.invuln = 0;
    R.cam.x = P.x - visW() / 2; R.cam.y = P.y - visH() / 2;
    drawRaceWorld(); drawHUD();
    const high = cv.toDataURL('image/png');
    const stats = DiVANEngine.presentation.stats();
    settings.graphics.particles = 'low'; drawRaceWorld(); drawHUD();
    const low = cv.toDataURL('image/png');
    hudMotionOk = () => false; settings.graphics.particles = 'high';
    paused = false; updRace(1 / 60);
    drawRaceWorld(); drawHUD();
    return { high, low, reduced: cv.toDataURL('image/png'), stats, reducedStats: DiVANEngine.presentation.stats(), car:P.car.name, track:R.T.name };
  })()`);
  for (const key of ['high', 'low', 'reduced']) {
    fs.writeFileSync(path.join(output, key + '.png'), Buffer.from(result[key].split(',')[1], 'base64'));
    delete result[key];
  }
  result.errors = errors;
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  win.destroy(); app.exit(errors.length ? 1 : 0);
}).catch(error => { console.error(error, errors); app.exit(1); });
