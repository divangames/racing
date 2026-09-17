// Проверяет переход из редактора в тест пользовательской трассы с текстурой борта.
'use strict';

const {app, BrowserWindow} = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const saveTrack = require('../src/main/save-track');
saveTrack.handleSaveTrack = async () => new Response('{"ok":true}', {headers:{'content-type':'application/json'}});
const saveCar = require('../src/main/save-car');
saveCar.handleSaveCar = async () => new Response('{"ok":true}', {headers:{'content-type':'application/json'}});
const protocol = require('../src/main/protocol');

const OUTPUT = path.resolve(__dirname, '../build/editor-test-check');
const TRACK_ARG = process.argv.find(arg => arg.startsWith('--track='));
const TRACK_ID = TRACK_ARG ? TRACK_ARG.slice('--track='.length) : 'custom_01';
const TIMEOUT_MS = 30000;
const NO_RAIL = process.argv.includes('--no-rail');

fs.mkdirSync(OUTPUT, {recursive:true});
app.setPath('userData', path.join(OUTPUT, 'profile'));
app.disableHardwareAcceleration();
protocol.registerPrivilegedScheme();

/** Ждёт условие внутри renderer без фиксированной задержки. */
async function until(window, expression) {
  const started = Date.now();
  while (Date.now() - started < TIMEOUT_MS) {
    try { if (await window.webContents.executeJavaScript(expression)) return Date.now() - started; }
    catch (error) {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Истекло время ожидания: ' + expression);
}

app.whenReady().then(async () => {
  protocol.attachProtocol();
  const errors = [];
  const window = new BrowserWindow({
    show:false,
    width:1440,
    height:900,
    webPreferences:{offscreen:true, backgroundThrottling:false}
  });
  window.webContents.on('console-message', event => {
    if (event.level === 'error') errors.push(event.message);
  });
  await window.loadURL('rnr://game/Editor.html?tab=map&track=' + TRACK_ID);
  await until(window, "typeof MapApp!=='undefined'&&MapApp.mapOn()&&MapApp.getDocument().id===" + JSON.stringify(TRACK_ID));
  const editor = await window.webContents.executeJavaScript(`(async() => {
    const campaignButtons=Array.from(document.querySelectorAll('#mapChapterList button'));
    const ownButton=document.querySelector('#mapList button');
    if(!MapData.isChapter(MapApp.getDocument()))campaignButtons[0]?.click();
    const campaignSelection={id:MapApp.getDocument().id,chapter:MapApp.getDocument().chapter,idLocked:document.getElementById('mapId').disabled};
    if(${JSON.stringify(TRACK_ID)}.startsWith('ch'))campaignButtons.find(button=>button.classList.contains('active'))?.click();
    else ownButton?.click();
    return {
      rail:MapApp.getDocument().theme.railSrc,
      road:MapApp.getDocument().theme.roadSrc,
      preview:document.getElementById('mapRailPreview').naturalWidth,
      roadPreview:document.getElementById('mapRoadPreview').naturalWidth,
      selected:document.getElementById('mapRailPick').value,
      selectedRoad:document.getElementById('mapRoadPick').value,
      campaignCount:campaignButtons.length,
      campaignLabels:campaignButtons.map(button=>button.textContent),
      campaignSelection,
      catalog:await fetch('/__tracks',{cache:'no-store'}).then(response=>response.json()),
      generated:RnRTracks.chapterTracks().map(track=>track.id),
      loaded:(await MapData.loadAll()).map(track=>({id:track.id,chapter:track.chapter}))
    };
  })()`);
  assert(editor.rail, 'В JSON трассы нет railSrc');
  assert(editor.preview > 1, 'Превью борта не декодировалось');
  assert.equal(editor.selected, editor.rail, 'Библиотека не выбрала борт трассы');
  if (TRACK_ID.startsWith('ch1_arena_')) {
    assert(editor.road.endsWith('/arena_dirt_01.png'), 'Арена не использует отдельную дорогу');
    assert(editor.roadPreview > 1, 'Превью дороги Арены не декодировалось');
    assert.equal(editor.selectedRoad, editor.road, 'Библиотека не выбрала дорогу Арены');
  }
  assert(editor.campaignCount > 0, 'Список карт кампании пуст');
  assert(editor.campaignSelection.chapter > 0, 'Карта кампании не открылась для редактирования');
  assert.equal(editor.campaignSelection.idLocked, true, 'ID карты кампании должен быть защищён');
  await window.webContents.executeJavaScript(`(() => {
    const tab=document.querySelectorAll('.map-source-tabs button')[1];
    if(tab)tab.click();
  })()`);
  await new Promise(resolve => setTimeout(resolve, 80));
  fs.writeFileSync(path.join(OUTPUT, 'campaign-list.png'), (await window.webContents.capturePage()).toPNG());
  await window.webContents.executeJavaScript(`(() => {
    const tab=Array.from(document.querySelectorAll('.map-source-tabs button')).find(button=>button.textContent==='Мои трассы');
    if(tab)tab.click();
  })()`);
  if (NO_RAIL) await window.webContents.executeJavaScript("MapApp.getDocument().theme.railSrc=''");
  const started = Date.now();
  await window.webContents.executeJavaScript("document.getElementById('mapTestBtn').click()");
  await until(window, "location.pathname.endsWith('/rnr.html')&&document.getElementById('boot-screen')");
  const loading = await window.webContents.executeJavaScript(`(() => ({
    heading:document.getElementById('boot-heading').textContent,
    box:getComputedStyle(document.querySelector('.boot-box')).display,
    load:getComputedStyle(document.getElementById('boot-load')).display,
    disclaimer:getComputedStyle(document.getElementById('boot-disclaimer')).display
  }))()`);
  assert.equal(loading.heading,'ТЕСТ ТРАССЫ');
  assert.notEqual(loading.box,'none');
  assert.notEqual(loading.load,'none');
  assert.equal(loading.disclaimer,'none');
  const readyMs = await until(window, "location.pathname.endsWith('/rnr.html')&&typeof R!=='undefined'&&R&&R.phase==='go'&&R.T&&R.T.theme" + (NO_RAIL ? '' : '&&R.T.theme.railSrc'));
  const game = await window.webContents.executeJavaScript(`(() => {
    const data=g.getImageData(0,0,Math.min(320,cv.width),Math.min(180,cv.height)).data;
    let light=0;for(let i=0;i<data.length;i+=4)if(data[i]+data[i+1]+data[i+2]>24)light++;
    return {phase:R.phase,track:R.T.name,rail:R.T.theme.railSrc,light,canvas:[cv.width,cv.height]};
  })()`);
  assert(game.light > 1000, 'Холст теста остался чёрным');
  assert.equal(errors.length, 0, errors.join('\n'));
  fs.writeFileSync(path.join(OUTPUT, 'test-track.png'), (await window.webContents.capturePage()).toPNG());
  await window.webContents.executeJavaScript(`(() => {
    paused=true;
    const start=R.S[0];
    R.cam.x=start.x-visW()/2;
    R.cam.y=start.y-visH()/2;
    R.sx=0;R.sy=0;
  })()`);
  await new Promise(resolve => setTimeout(resolve, 120));
  fs.writeFileSync(path.join(OUTPUT, 'finish-zone.png'), (await window.webContents.capturePage()).toPNG());
  const result = {editor, loading, game, readyMs, totalMs:Date.now()-started, errors};
  fs.writeFileSync(path.join(OUTPUT, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  window.destroy();
  app.exit(0);
}).catch(error => {
  console.error(error);
  app.exit(1);
});
