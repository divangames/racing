// Сквозная проверка: редактор главы → выбранная точка погони → возврат.
'use strict';

const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
// Редактор машин инициализируется вместе с главами. Этот тест проверяет только черновик
// главы и не должен автосохранением затронуть пользовательские car.json.
let isolatedCarSaves = 0;
require('../src/main/save-car').handleSaveCar = async () => {
  isolatedCarSaves += 1;
  return new Response(null, {status:204});
};
const protocol = require('../src/main/protocol');

const output = path.resolve(__dirname, '../build/chapter-editor-check');
fs.mkdirSync(output, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'rnr-chapter-editor-'));
app.setPath('userData', profile);
app.on('quit', () => { try { fs.rmSync(profile, {recursive:true, force:true}); } catch (error) {} });
app.disableHardwareAcceleration();
protocol.registerPrivilegedScheme();

const errors = [];
app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  protocol.attachProtocol();
  const win = new BrowserWindow({
    show: false,
    width: 1600,
    height: 960,
    webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false }
  });
  win.webContents.on('console-message', (event) => {
    if (event.level === 'error') errors.push({ message: event.message, source: event.source, line: event.lineNumber });
  });
  const run = (code) => win.webContents.executeJavaScript(code);
  async function until(code, timeout = 60000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (await run(code)) return;
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    throw new Error('Timeout: ' + code);
  }

  await win.loadURL('rnr://game/Editor.html?tab=chapter&chapter=mission-01&point=GREEN_HOLD');
  await until("window.ChapterEditor && ChapterEditor.current() && window.__labTab === 'chapter'");
  await until("document.querySelectorAll('#mapList button').length > 0");
  await until("!document.getElementById('lab-splash')");
  const editor = await run(`(() => ({
    title: ChapterEditor.current().title,
    chapters: document.querySelectorAll('.chapter-mission').length,
    points: document.querySelectorAll('.chapter-point').length,
    frames: document.querySelectorAll('.chapter-scene').length,
    visible: !document.getElementById('workChapter').hidden
  }))()`);
  assert.equal(editor.title, 'Колесница смерти — Погоня');
  assert.equal(editor.chapters, 1);
  assert.ok(editor.points >= 10);
  assert.ok(editor.frames >= 3);
  assert.equal(editor.visible, true);
  fs.writeFileSync(path.join(output, '01-editor.png'), (await win.webContents.capturePage()).toPNG());

  await run(`(() => {
    const input = document.getElementById('chapterConfig_redZoneTime');
    input.value = '6.5'; input.dispatchEvent(new Event('input', {bubbles:true}));
    ChapterEditor.selectPoint('GREEN_HOLD'); ChapterEditor.test();
  })()`);
  await until("location.search.includes('chapterTest=1') && typeof storyBearChase !== 'undefined' && state === 'bearChase'");
  await until("!document.getElementById('boot-screen')");
  const game = await run(`(() => ({
    state, phase: storyBearChase.phase, zone: storyBearChase.distanceZone,
    greenTimer: storyBearChase.greenTimer, redTime: MISSION_01.redZoneTime,
    testMode: RnRChapterContent.testMode
  }))()`);
  assert.equal(game.phase, 'CHASE');
  assert.equal(game.zone, 'GREEN');
  assert.ok(game.greenTimer > 0);
  assert.equal(game.redTime, 6.5);
  assert.equal(game.testMode, true);
  await run('updateView(); g.setTransform(viewS,0,0,viewS,viewOX,viewOY); DiVANEngine.screens.paint(state)');
  fs.writeFileSync(path.join(output, '02-green-hold.png'), (await win.webContents.capturePage()).toPNG());

  await run("press('Escape')");
  await until("location.pathname.toLowerCase().endsWith('/editor.html') && window.ChapterEditor && window.__labTab === 'chapter'");
  await until("document.querySelectorAll('#mapList button').length > 0");
  await until("window.ChapterEditor && ChapterEditor.current()");
  await run(`(() => {
    document.querySelector('[data-scene-kind="chase-cinematic"]').click();
    const field=document.getElementById('chapterText');
    field.value='ПРОВЕРКА РЕПЛИКИ МОСТА'; field.dispatchEvent(new Event('input',{bubbles:true}));
    const speed=document.getElementById('chapterConfig_bridgeTruckTravelSpeed');
    speed.value='340'; speed.dispatchEvent(new Event('input',{bubbles:true}));
    ChapterEditor.test();
  })()`);
  await until("typeof storyBearChase !== 'undefined' && state === 'bearChase' && RnRChapterContent.get()");
  const cinematic = await run(`({point:new URLSearchParams(location.search).get('point'),
    text:RnRChapterContent.scenes('cinematicScenes')[0].text,speed:MISSION_01.bridgeTruckTravelSpeed})`);
  assert.equal(cinematic.point,'BRIDGE_APPROACH');
  assert.equal(cinematic.text,'ПРОВЕРКА РЕПЛИКИ МОСТА');
  assert.equal(cinematic.speed,340);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ editor, game, cinematic, returned: true, isolatedCarSaves, errors }, null, 2));
  win.destroy();
  app.exit(0);
}).catch((error) => {
  console.error(error);
  console.error('renderer errors:', errors);
  app.exit(1);
});
