// Интеграционная проверка игры и лаборатории в настоящем Electron без записи исходных ассетов.
'use strict';
const {app,BrowserWindow}=require('electron');
const fs=require('fs');
const path=require('path');
const assert=require('node:assert/strict');
const output=path.resolve(__dirname,'../build/engine-check');
app.disableHardwareAcceleration();
fs.mkdirSync(output,{recursive:true});
app.setPath('userData',path.join(output,'profile'));
app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');
// Все запросы записи перехватываются: проверка никогда не меняет машины и трассы пользователя.
require('../src/main/save-car').handleSaveCar=async()=>new Response('{"ok":true}');
require('../src/main/save-track').handleSaveTrack=async()=>new Response('{"ok":true}');
require('../src/main/save-texture').handleSaveTexture=async()=>new Response('{"ok":true}');
require('../src/main/save-object').handleSavePack=async()=>new Response('{"ok":true}');
require('../src/main/save-object').handleSaveOblab=async()=>new Response('{"ok":true}');
const protocol=require('../src/main/protocol');
protocol.registerPrivilegedScheme();
const errors=[];
app.on('window-all-closed',()=>{});
const results={};
/** Даёт загрузчику обработать кадры до выполнения условия. */
async function until(win,expression,timeout=90000){
 const started=Date.now();
 while(Date.now()-started<timeout){
  if(await win.webContents.executeJavaScript(expression))return;
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 throw new Error('Истекло время ожидания: '+expression);
}
/** Создаёт невидимое окно и собирает ошибки JS. */
function create(){
 const win=new BrowserWindow({show:false,width:1440,height:900,webPreferences:{offscreen:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
 win.webContents.on('console-message',event=>{if(event.level==='error')errors.push(event.message);});
 win.webContents.on('render-process-gone',(_event,details)=>errors.push('Renderer: '+details.reason));
 return win;
}
app.whenReady().then(async()=>{
 protocol.attachProtocol();
 const win=create();
 await win.loadURL('rnr://game/rnr.html?lab=1&car=0');
 await until(win,"typeof R!=='undefined' && !!R && !!P && window.RnREngine && BOOT.ready");
 results.game=await win.webContents.executeJavaScript(`(()=>{
   R.phase='go';R.countT=0;R.hintT=0;P.invuln=100;P.nitro=2;
   return {engine:RnREngine.version,track:R.T.name,racers:R.racers.length,state,car:P.car.name};
 })()`);
 await new Promise(resolve=>setTimeout(resolve,1500));
 fs.writeFileSync(path.join(output,'race.png'),(await win.webContents.capturePage()).toPNG());
 results.physics=await win.webContents.executeJavaScript(`(()=>{
   paused=true;
   const source=P;
   function run(hz){
     const r={...source,st:{...source.st},car:{...source.car},x:R.S[0].x,y:R.S[0].y,trackIdx:0,ang:R.S[0].ang,spd:0,lat:0,air:false,z:0,vz:0,nitro:0,bolt:0,isP:false,chIdx:-1,finished:false,steerFlt:0,_engineTrail:null};
     for(let i=0;i<hz;i++)stepVehicle(r,1,0,1/hz,false);
     return {speed:r.spd,x:r.x,y:r.y};
   }
   const a=run(30),b=run(60),c=run(120);
   return {a,b,c,finite:[a,b,c].every(r=>Number.isFinite(r.speed)),spread:Math.max(a.speed,b.speed,c.speed)-Math.min(a.speed,b.speed,c.speed)};
 })()`);
 assert(results.physics.finite);
 assert(results.physics.spread<8,'Физика существенно зависит от FPS');
 results.audio=await win.webContents.executeJavaScript(`(()=>{audioInit();settings.sound.sfxOn=false;updEngine(P,false,'race');return {context:!!AU.ctx};})()`);
 results.race=await win.webContents.executeJavaScript(`(()=>{
   labTest=false;buildRace();R.phase='go';R.countT=0;R.hintT=0;R.msg=null;
   const before=R.time;updRace(.1);const elapsed=R.time-before;
   keys.KeyW=true;
   for(let i=0;i<240;i++)updRace(1/60);
   clearKeys();P.nitro=1;
   return {racers:R.racers.length,elapsed,finite:R.racers.every(r=>Number.isFinite(r.x)&&Number.isFinite(r.y)&&Number.isFinite(r.spd)),speed:P.spd};
 })()`);
 assert(results.race.racers>=5);assert(results.race.finite);assert(Math.abs(results.race.elapsed-.1)<.001);
 await new Promise(resolve=>setTimeout(resolve,500));
 fs.writeFileSync(path.join(output,'combat-race.png'),(await win.webContents.capturePage()).toPNG());
 win.destroy();
 const editor=create();await editor.loadURL('rnr://game/Editor.html?tab=map');
 await until(editor,"typeof MapApp!=='undefined' && MapApp.mapOn() && document.querySelector('.studio-summary') && document.getElementById('mapList').children.length>0");
 results.editor=await editor.webContents.executeJavaScript(`(()=>{
   const original=MapApp.getDocument().name;
   const field=document.getElementById('mapName');
   field.value='ПРОВЕРКА ИСТОРИИ';field.dispatchEvent(new Event('input',{bubbles:true}));MapApp.commit();
   document.getElementById('mapUndoBtn').click();
   const undone=MapApp.getDocument().name;
   document.getElementById('mapRedoBtn').click();
   const redone=MapApp.getDocument().name;
   const report=StudioCheck.track(MapApp.getDocument());
   const invalid=StudioCheck.track({name:'x',cps:[[0,0],[0,0],[0,0],[0,0]]});
   return {original,undone,redone,report,invalidErrors:invalid.errors,overflow:document.documentElement.scrollWidth>innerWidth,
     assetDockVisible:document.getElementById('assetDock').getBoundingClientRect().bottom<=innerHeight+2,
     objectTools:typeof MapAssets.inspect==='function'};
 })()`);
 assert.equal(results.editor.undone,results.editor.original);
 assert.equal(results.editor.redone,'ПРОВЕРКА ИСТОРИИ');
 assert(results.editor.invalidErrors.length);
 assert.equal(results.editor.overflow,false);
 assert(results.editor.assetDockVisible);assert(results.editor.objectTools);
 results.documents=await editor.webContents.executeJavaScript(`(async()=>{
   const first=MapApp.getDocument();
   MapApp.importDocument(MapData.fileTrack(first));
   const imported=MapApp.getDocument();imported.name='ВТОРОЙ ДОКУМЕНТ';MapApp.commit();
   document.getElementById('mapList').firstElementChild.click();
   document.getElementById('mapUndoBtn').click();const restoredFirst=MapApp.getDocument().name;
   document.getElementById('mapList').lastElementChild.click();const preserved=MapApp.getDocument().name;
   const saving=MapApp.saveNow();MapApp.getDocument().name='ПРАВКА ВО ВРЕМЯ ЗАПИСИ';MapApp.commit();
   const saved=await saving;const saveStatus=document.getElementById('mapSaveState').textContent;
   const originalSave=MapData.save;MapData.save=async()=>({ok:false,error:'Тестовый отказ'});
   const failed=await MapApp.saveNow();MapData.save=originalSave;
   return {restoredFirst,preserved,saved,saveStatus,failed,unpublished:imported.published===false};
 })()`);
 assert.equal(results.documents.restoredFirst,results.editor.original);
 assert.equal(results.documents.preserved,'ВТОРОЙ ДОКУМЕНТ');assert(results.documents.unpublished);
 assert(results.documents.saved);assert.match(results.documents.saveStatus,/несохран/);assert.equal(results.documents.failed,false);
 await new Promise(resolve=>setTimeout(resolve,1000));
 fs.writeFileSync(path.join(output,'editor.png'),(await editor.webContents.capturePage()).toPNG());
 await editor.webContents.executeJavaScript("MapApp.setTab('car')");
 await new Promise(resolve=>setTimeout(resolve,600));
 fs.writeFileSync(path.join(output,'car-editor.png'),(await editor.webContents.capturePage()).toPNG());
 editor.destroy();
 results.errors=errors;
 assert.equal(errors.length,0,'Обнаружены ошибки рендерера: '+errors.join('\n'));
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));
 console.log(JSON.stringify(results,null,2));
 app.exit(0);
}).catch(error=>{
 fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({error:error.stack,errors,results},null,2));
 console.error(error);app.exit(1);
});
