// Проверяет настоящий цикл редактор → черновой заезд → редактор без записи пользовательских трасс.
'use strict';
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const OUTPUT = path.resolve(__dirname, '../build/draft-test-check');
const TRACK_ROOT = path.resolve(__dirname, '../content/assets/data/tracks');
const TRACK_ID = 'custom_01';
const TIMEOUT_MS = 60000;
let trackWrites = 0;

// Перехват установлен до подключения протокола: даже ошибочный Save не пишет в каталог игры.
require('../src/main/save-track').handleSaveTrack = async () => {
  trackWrites++;
  return new Response('{"ok":true}', { headers: { 'content-type': 'application/json' } });
};
require('../src/main/save-car').handleSaveCar = async () => new Response('{"ok":true}');
const protocol = require('../src/main/protocol');
protocol.registerPrivilegedScheme();
fs.mkdirSync(OUTPUT, { recursive: true });
app.setPath('userData', path.join(OUTPUT, 'profile'));
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

/** Ожидает состояние страницы, допускает смену контекста при переходе. */
async function until(window, expression) {
  const started = Date.now();
  while (Date.now() - started < TIMEOUT_MS) {
    try { if (await window.webContents.executeJavaScript(expression)) return; } catch (error) {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const state = await window.webContents.executeJavaScript(`({
    url: location.href, ready: document.readyState, app: typeof MapApp,
    map: typeof MapApp !== 'undefined' && MapApp.mapOn(),
    track: typeof MapApp !== 'undefined' && MapApp.getDocument && MapApp.getDocument().id,
    status: document.getElementById('mapSaveState')?.textContent
  })`).catch(error => ({ error: error.message }));
  throw new Error('Истекло ожидание: ' + expression + '\n' + JSON.stringify(state));
}

/** Запускает тест и проверяет именно выбранный снимок, включая имя и геометрию. */
async function drive(window, expected) {
  const started = Date.now();
  await window.webContents.executeJavaScript("document.getElementById('mapTestBtn').click()");
  await until(window, "location.pathname.endsWith('/rnr.html') && typeof R !== 'undefined' && R && R.phase === 'go'");
  const actual = await window.webContents.executeJavaScript('({track:resolveLabTrack(),name:R.T.name})');
  assert.equal(actual.name, expected.name);
  assert.equal(actual.track.id, expected.id);
  assert.deepEqual(actual.track.cps, expected.cps);
  assert.deepEqual(actual.track.objects, expected.objects);
  assert.equal(trackWrites, 0, 'Тест черновика вызвал запись трассы');
  return Date.now() - started;
}

/** Возвращается игровым действием и ждёт восстановления документа и инспектора. */
async function returnToEditor(window, id) {
  await window.webContents.executeJavaScript('exitLabTest()');
  await until(window, "location.pathname.endsWith('/Editor.html') && typeof MapApp !== 'undefined' && MapApp.mapOn() && MapApp.getDocument().id === "
    + JSON.stringify(id) + " && document.querySelector('.studio-summary') && !new URLSearchParams(location.search).has('preview')");
  await until(window, "!document.getElementById('lab-splash')");
}

app.whenReady().then(async () => {
  const diskFiles = [TRACK_ID + '.json', TRACK_ID + '.json.previous', 'index.json']
    .filter(name => fs.existsSync(path.join(TRACK_ROOT, name)))
    .map(name => [name, fs.readFileSync(path.join(TRACK_ROOT, name))]);
  const errors = [];
  protocol.attachProtocol();
  const window = new BrowserWindow({ show: false, width: 1440, height: 900,
    webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
  window.webContents.setAudioMuted(true);
  window.webContents.on('console-message', event => {
    if (event.level === 'error') { errors.push(event.message); console.error(event.message); }
  });
  await window.loadURL('rnr://game/Editor.html?tab=map&track=' + TRACK_ID);
  await until(window, "typeof MapApp !== 'undefined' && MapApp.mapOn() && MapApp.getDocument().id === 'custom_01' && !!window.StudioCheck");
  await until(window, "!document.getElementById('lab-splash')");
  const setup = await window.webContents.executeJavaScript(`(() => {
    const original = MapData.fileTrack(MapApp.getDocument());
    MapApp.getDocument().name = 'ЧЕРНОВИК · ПРОВЕРКА';
    MapApp.getDocument().cps[1][0] += 80;
    MapApp.commit();
    MapApp.getDocument().name = 'СЛЕДУЮЩАЯ ПРАВКА';
    MapApp.commit();
    document.getElementById('mapUndoBtn').click();
    const expected = MapData.fileTrack(MapApp.getDocument());
    MapApp.importDocument({ ...original, name: 'НОВАЯ · НЕ СОХРАНЕНА' });
    MapApp.commit();
    const fresh = MapData.fileTrack(MapApp.getDocument());
    [...document.querySelectorAll('#mapList button')].find(button => button.textContent === expected.name).click();
    MapView.setTool('cp'); MapView.setSelection({ kind: 'cp', i: 1 });
    return { original, expected, fresh, redo: !document.getElementById('mapRedoBtn').disabled };
  })()`);
  assert(setup.redo, 'До теста должна быть доступна ветка повтора');
  assert(!fs.existsSync(path.join(TRACK_ROOT, setup.fresh.id + '.json')));
  const existingReadyMs = await drive(window, setup.expected);
  fs.writeFileSync(path.join(OUTPUT, 'draft-race.png'), (await window.webContents.capturePage()).toPNG());
  await returnToEditor(window, setup.expected.id);
  const restored = await window.webContents.executeJavaScript(`(() => ({
    track: MapData.fileTrack(MapApp.getDocument()),
    selection: MapView.selection(), tool: MapView.tool(),
    redo: !document.getElementById('mapRedoBtn').disabled,
    state: document.getElementById('mapSaveState').textContent,
    fresh: [...document.querySelectorAll('#mapList button')].some(button => button.textContent === 'НОВАЯ · НЕ СОХРАНЕНА')
  }))()`);
  assert.deepEqual(restored.track, setup.expected);
  assert.deepEqual(restored.selection, { kind: 'cp', i: 1 });
  assert.equal(restored.tool, 'cp');
  assert(restored.redo && restored.fresh);
  assert.match(restored.state, /несохранённые/);
  fs.writeFileSync(path.join(OUTPUT, 'returned-editor.png'), (await window.webContents.capturePage()).toPNG());
  await window.webContents.executeJavaScript("document.getElementById('mapRedoBtn').click()");
  assert.equal(await window.webContents.executeJavaScript('MapApp.getDocument().name'), 'СЛЕДУЮЩАЯ ПРАВКА');
  await window.webContents.executeJavaScript("document.getElementById('mapUndoBtn').click()");
  await window.webContents.executeJavaScript("[...document.querySelectorAll('#mapList button')].find(button => button.textContent === 'НОВАЯ · НЕ СОХРАНЕНА').click()");
  const freshReadyMs = await drive(window, setup.fresh);
  await returnToEditor(window, setup.fresh.id);
  assert.equal(trackWrites, 0);
  assert.deepEqual(await window.webContents.executeJavaScript('MapData.fileTrack(MapApp.getDocument())'), setup.fresh);
  assert.equal(await window.webContents.executeJavaScript('MapApp.saveNow()'), true);
  assert.equal(trackWrites, 1, 'Только явное сохранение должно вызвать API записи');
  for (const [name, content] of diskFiles) assert.deepEqual(fs.readFileSync(path.join(TRACK_ROOT, name)), content);
  assert(!fs.existsSync(path.join(TRACK_ROOT, setup.fresh.id + '.json')));
  assert.deepEqual(errors, []);
  const result = { existingReadyMs, freshReadyMs, restoredHistory: true, restoredSelection: true,
    preservedOtherDocuments: true, previewWrites: 0, explicitSaveCalls: trackWrites, diskUnchanged: true, errors };
  fs.writeFileSync(path.join(OUTPUT, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  window.destroy(); app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
