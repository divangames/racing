// Проверяет редактор дороги в настоящем окне Electron без записи пользовательских трасс.
'use strict';

const {app, BrowserWindow} = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const output = path.resolve(__dirname, '../build/road-editor-check');
fs.mkdirSync(output, {recursive: true});
app.setPath('userData', path.join(output, 'profile'));
app.disableHardwareAcceleration();
const protocol = require('../src/main/protocol');
protocol.registerPrivilegedScheme();

/** Ждёт готовность лаборатории, возвращая последнюю ошибку для диагностики. */
async function until(window, expression) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try { if (await window.webContents.executeJavaScript(expression)) return; } catch (error) {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Не дождались: ' + expression);
}

/** Проверяет фактические размеры элементов и поведение контрольных точек. */
async function inspect(window) {
  return window.webContents.executeJavaScript(`(() => {
    const panel = document.getElementById('mapRoadEditor');
    const toolbar = document.querySelector('.map-editor-toolbar');
    const canvas = document.getElementById('mapStage');
    const original = MapApp.getDocument().cps.length;
    document.querySelector('[data-map-tool="point"]').click();
    canvas.dispatchEvent(new PointerEvent('pointerdown', {button: 0, bubbles: true,
      clientX: canvas.getBoundingClientRect().right - 3,
      clientY: canvas.getBoundingClientRect().bottom - 3}));
    const afterEmptyClick = MapApp.getDocument().cps.length;
    const road = MapLayout.spline(MapApp.getDocument().cps);
    const point = road[Math.floor(road.length / 8)];
    const camera = MapView.center();
    const zoom = Number.parseInt(document.getElementById('mapZoomRead').textContent, 10) / 100;
    const rect = canvas.getBoundingClientRect();
    const x = rect.left + rect.width / 2 + (point.x - camera.x) * zoom;
    const y = rect.top + rect.height / 2 + (point.y - camera.y) * zoom;
    canvas.dispatchEvent(new MouseEvent('dblclick', {button: 0, bubbles: true, clientX: x, clientY: y}));
    const afterRoadClick = MapApp.getDocument().cps.length;
    document.getElementById('mapUndoBtn').click();
    const afterUndo = MapApp.getDocument().cps.length;
    document.getElementById('mapRedoBtn').click();
    const afterRedo = MapApp.getDocument().cps.length;
    document.getElementById('mapRoadNewCrossroads').click();
    const junction = MapData.fileTrack(MapApp.getDocument());
    const current = document.getElementById('mapCrossingMode');
    current.value = 'overpass'; current.dispatchEvent(new Event('change', {bubbles: true}));
    const overpass = MapData.fileTrack(MapApp.getDocument()).crossingMode;
    return {
      panel: !!panel, toolbar: !!toolbar,
      panelWidth: panel?.getBoundingClientRect().width,
      canvasHeight: canvas.getBoundingClientRect().height,
      original, afterEmptyClick, afterRoadClick, afterUndo, afterRedo,
      junctionMode: junction.crossingMode, junctionPoints: junction.cps.length,
      overpass, centerline: document.getElementById('mapRoadShowCenter').checked,
      pointReadout: document.getElementById('mapRoadPointRead').textContent,
      bodyScrollWidth: document.body.scrollWidth, viewportWidth: innerWidth
    };
  })()`);
}

app.whenReady().then(async () => {
  protocol.attachProtocol();
  const window = new BrowserWindow({show: false, width: 1440, height: 900,
    webPreferences: {offscreen: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false}});
  const errors = [];
  window.webContents.on('console-message', event => {
    if (event.level === 'error') errors.push(event.message);
  });
  await window.loadURL('rnr://game/Editor.html?tab=map');
  await until(window, "typeof MapApp !== 'undefined' && MapApp.mapOn() && !!document.getElementById('mapRoadEditor') && !document.getElementById('lab-splash')");
  const result = await inspect(window);
  await window.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  fs.writeFileSync(path.join(output, 'editor.png'), (await window.webContents.capturePage()).toPNG());
  assert(result.panel && result.toolbar && result.centerline);
  assert.equal(result.afterEmptyClick, result.original, 'Клик вне дороги создал точку');
  assert.equal(result.afterRoadClick, result.original + 1, 'Двойной клик по дороге не вставил точку');
  assert.equal(result.afterUndo, result.original, 'Отмена не вернула исходную дорогу');
  assert.equal(result.afterRedo, result.original + 1, 'Повтор не восстановил вставленную точку');
  assert.equal(result.junctionMode, 'junction');
  assert.equal(result.junctionPoints, 20);
  assert.equal(result.overpass, 'overpass');
  assert(result.canvasHeight > 300 && result.panelWidth > 250);
  assert(result.bodyScrollWidth <= result.viewportWidth + 2, 'Появилась горизонтальная прокрутка страницы');
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({...result, errors}, null, 2));
  console.log(JSON.stringify({...result, errors}, null, 2));
  window.destroy(); app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
