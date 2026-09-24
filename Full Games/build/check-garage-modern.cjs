'use strict';
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const output = path.join(__dirname, 'garage-modern-check');
fs.mkdirSync(output, { recursive: true });
app.setPath('userData', path.join(output, 'profile'));
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
const denyWrite = async () => new Response('{"ok":true,"checkOnly":true}');
require('../src/main/save-car').handleSaveCar = denyWrite;
require('../src/main/save-track').handleSaveTrack = denyWrite;
for (const key of ['handleSaveTexture', 'handleSaveTextureFile']) require('../src/main/save-texture')[key] = denyWrite;
for (const key of ['handleSavePack', 'handleSaveOblab', 'handleSaveOblabFile']) require('../src/main/save-object')[key] = denyWrite;
const protocol = require('../src/main/protocol');
protocol.registerPrivilegedScheme();
const report = { userData: app.getPath('userData'), scenarios: [], errors: [] };
async function until(win, expression) {
  const started = Date.now();
  while (Date.now() - started < 60000) {
    if (await win.webContents.executeJavaScript(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Timeout: ' + expression);
}
app.whenReady().then(async () => {
  protocol.attachProtocol();
  const win = new BrowserWindow({ show: false, width: 1440, height: 900, webPreferences: {
    offscreen: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false
  } });
  win.webContents.setAudioMuted(true);
  win.webContents.on('console-message', event => { if (event.level === 'error') report.errors.push(event.message); });
  win.webContents.on('render-process-gone', (_event, details) => report.errors.push('Renderer: ' + details.reason));
  await win.loadURL('rnr://game/rnr.html?lab=1&car=0');
  await until(win, "typeof R !== 'undefined' && !!R && !!P && BOOT.ready && !!DiVANEngine.garageAct");
  await win.webContents.executeJavaScript(`(() => {
    paused = true; labTest = true; state = 'garage'; garagePaused = false;
    save = newSave(); save.car = 0; save.char = 0; save.cash = 10000;
    save.playMode = 'free'; save.storyCampaign = null; save.storySlice = null;
    raceTrackOverride = null; raceBoard = null; tuningSel = 1; garMsgT = 0;
    if (window.clientNotice) window.clientNotice = null;
    window.__garageCheckErrors = [];
    window.addEventListener('error', event => window.__garageCheckErrors.push(event.message));
  })()`);
  await win.webContents.executeJavaScript('document.fonts.ready');
  for (const [name, tune] of [['stock', { arm: 0, eng: 0, tir: 0, shk: 0, nit: 0 }], ['partial-old-save', { eng: 1 }]]) {
    const result = await win.webContents.executeJavaScript(`(() => {
      save.tuning[save.car] = ${JSON.stringify(tune)};
      applyResolution(); updateView();
      const before = JSON.stringify(save), texts = [], proto = CanvasRenderingContext2D.prototype;
      const original = proto.fillText;
      proto.fillText = function (value, x, y, ...rest) {
        texts.push({ text: String(value), x, y, width: this.measureText(String(value)).width, align: this.textAlign, font: this.font });
        return original.call(this, value, x, y, ...rest);
      };
      try {
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
        g.setTransform(viewS, 0, 0, viewS, viewOX, viewOY);
        DiVANEngine.screens.paint('garage');
      } finally { proto.fillText = original; }
      const ch = CHARS[save.char], car = CARS[save.car], tun = save.tuning[save.car];
      const st = stats(ch, car, tun), next = stats(ch, car, Object.assign({}, tun, { eng: (tun.eng || 0) + 1 }));
      return { name: ${JSON.stringify(name)}, unchanged: before === JSON.stringify(save), stats: st,
        previews: ['arm', 'eng', 'tir', 'shk', 'nit'].map(k => ({ key: k, text: DiVANEngine.garageAct.tuningPreview(ch, car, tun, k) })),
        expectedEngine: Math.round(st.top * .45) + ' → ' + Math.round(next.top * .45) + ' км/ч',
        texts, rows: g._gar.slice(0, 5), errors: window.__garageCheckErrors, canvas: { width: cv.width, height: cv.height },
        screenshot: cv.toDataURL('image/png') };
    })()`);
    assert(result.unchanged, 'Отрисовка меняет сохранение');
    assert(Object.values(result.stats).every(Number.isFinite), 'Нечисловые характеристики');
    assert(result.previews.find(p => p.key === 'eng').text.startsWith(result.expectedEngine));
    for (const preview of result.previews) assert(result.texts.some(t => t.text === preview.text), 'Превью не попало на экран: ' + preview.key);
    result.previewBounds = result.previews.map((preview, i) => {
      const text = result.texts.find(t => t.text === preview.text), row = result.rows[i];
      const fits = text.x >= row.x && text.x + text.width <= row.x + row.w - 20;
      assert(fits, 'Описание выходит за карточку: ' + preview.key);
      return { key: preview.key, right: text.x + text.width, limit: row.x + row.w - 20, fits };
    });
    assert(result.texts.every(t => !/NaN|undefined/.test(t.text)), 'Неполный тюнинг показывает неверные числа');
    assert.equal(result.errors.length, 0);
    fs.writeFileSync(path.join(output, name + '.png'), Buffer.from(result.screenshot.split(',')[1], 'base64'));
    delete result.screenshot;
    report.scenarios.push(result);
  }
  report.status = 'passed';
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, scenarios: report.scenarios.map(r => ({ name: r.name, previews: r.previews, canvas: r.canvas })), errors: report.errors }, null, 2));
  win.destroy(); app.exit(0);
}).catch(error => {
  report.status = 'failed'; report.failure = error.stack || String(error);
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.error(report.failure); app.exit(1);
});
