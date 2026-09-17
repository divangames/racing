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
const textureApi=require('../src/main/save-texture');
textureApi.handleSaveTexture=async()=>new Response('{"ok":true}');
textureApi.handleSaveTextureFile=async()=>new Response(JSON.stringify({ok:true,src:'assets/data/maps/bord road/Bort_01.png',id:'bort_01'}),{headers:{'content-type':'application/json'}});
require('../src/main/save-object').handleSavePack=async()=>new Response('{"ok":true}');
require('../src/main/save-object').handleSaveOblab=async()=>new Response('{"ok":true}');
require('../src/main/save-object').handleSaveOblabFile=async(_request,url)=>new Response(JSON.stringify({ok:true,pack:url.searchParams.get('pack'),id:url.searchParams.get('id'),src:'assets/object/world.labr/'+url.searchParams.get('id')+'.png'}),{headers:{'content-type':'application/json'}});
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
 await until(win,"typeof R!=='undefined' && !!R && !!P && window.DiVANEngine && BOOT.ready");
 results.game=await win.webContents.executeJavaScript(`(()=>{
   R.phase='go';R.countT=0;R.hintT=0;P.invuln=100;P.nitro=2;
   return {
     engine:DiVANEngine.version,track:R.T.name,racers:R.racers.length,state,car:P.car.name,
     zoom:raceZoom(),
     music:musicCat(),
     hit:carHitHalf(P),
     classD1junk:fieldCarClassOk(12,1),
     classD1stock:fieldCarClassOk(0,1),
     classD3mid:fieldCarClassOk(16,3)
   };
 })()`);
 assert(results.game.classD1junk,'1 дивизион должен пускать хлам');
 assert.equal(results.game.classD1stock,false);
 assert(results.game.classD3mid,'3 дивизион должен пускать средний класс');
 assert(results.game.zoom>=1.25&&results.game.zoom<=2.2);
 assert.equal(results.game.music,'racing');
 assert(results.game.hit.hw>0&&results.game.hit.hh>0);
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
 results.feel=await win.webContents.executeJavaScript(`(()=>{
   const slot=typeof carWeaponSlot==='function'?carWeaponSlot(0,'wep'):null;
   const wound=racerWoundLvl({hp:18,maxhp:100,car:{idx:0}});
   const dmg=CAR_DAMAGE[0]&&CAR_DAMAGE[0][Math.max(1,wound)];
   const dmgReady=!!(CAR_DAMAGE[0]&&[1,2,3,4,5,6].every(l=>CAR_DAMAGE[0][l]&&CAR_DAMAGE[0][l].naturalWidth>0));
   P.hp=Math.max(1,P.maxhp*0.18);P.smokeT=0;
   if(typeof emitWreckFx==='function')emitWreckFx(P,0.2);
   settings.graphics.weather=true;settings.graphics.particles='high';
   R.weather=Object.assign({},RnRWeather.catalog.rain);
   const cam={x:R.cam.x-220,y:R.cam.y-160,w:440,h:320};
   RnRWeather.tick(R,0.05,cam,viewW,viewH,settings);
   audioInit();settings.sound.sfxOn=true;P.spd=Math.max(P.spd,48);
   updEngine(P,false,'race');
   return {
     idx:P.car.idx,
     name:P.car.name,
     near:slot&&slot.near,
     far:slot&&slot.far,
     nearUrl:slot&&carWeaponUrl(slot,slot.near),
     farUrl:slot&&carWeaponUrl(slot,slot.far),
     pack:typeof carEnginePackName==='function'?carEnginePackName(0):'',
     wound,
     dmgReady,
     dmgSrc:dmg&&dmg.src||'',
     wreck:R.parts.some(p=>/18,16,14|255,140/.test(String(p.col||'')))||!!(window.RnRVfx&&typeof RnRVfx.wreck==='function'),
     wxParts:R.wxFx?R.wxFx.parts.length:-1,
     vfxOk:!!(window.RnRVfx&&RnRVfx.ok),
     weatherOn:!!(window.RnRVfx&&RnRVfx.weatherOn)
   };
 })()`);
 assert.equal(results.feel.idx,0,'прогон на Дьяволе, не на Молоте');
 assert.equal(results.feel.near,'shoot.wav');
 assert.equal(results.feel.far,'distant0.wav');
 assert.notEqual(results.feel.nearUrl,results.feel.farUrl);
 assert.equal(results.feel.pack,'01 Nissan GTR');
 assert.ok(results.feel.dmgReady,'нет слоя мятости Дьявола');
 assert(results.feel.wreck,'подбитый Дьявол должен дымить');
 if(results.feel.vfxOk){
  assert.equal(results.feel.wxParts,0,'при quarks капли не на холсте камеры');
 }
 results.divField=await win.webContents.executeJavaScript(`(()=>{
   function aiIdx(board){return board.specs.filter(s=>!s.isP).map(s=>s.car.idx);}
   const race0=save.race;
   save.race=0;
   const d1=aiIdx(makeRaceBoard());
   save.race=TRACKDEFS.length*2;
   const d3=aiIdx(makeRaceBoard());
   save.race=race0;
   return {d1,d3};
 })()`);
 assert(results.divField.d1.every(i=>i>=11&&i<=15),'1 дивизион пустил не хлам 12–16');
 assert(results.divField.d3.every(i=>i>=11&&i<=20),'3 дивизион пустил кузов вне хлама и среднего');
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
   const assetTile=document.querySelector('.cb-tile:not(.cb-tile-add)');
   if(assetTile)assetTile.click();
   document.querySelector('[data-asset-road="under"]').click();
   document.querySelector('[data-asset-car="over"]').click();
   const placement=MapAssets.current();
   return {original,undone,redone,report,invalidErrors:invalid.errors,overflow:document.documentElement.scrollWidth>innerWidth,
     assetDockVisible:document.getElementById('assetDock').getBoundingClientRect().bottom<=innerHeight+2,
     objectTools:typeof MapAssets.inspect==='function',
     sourceTabs:[...document.querySelectorAll('.map-source-tabs button')].map(button=>button.textContent),
     inspector:!!document.querySelector('.map-inspector-head'),
     replaceRoad:document.getElementById('mapRoadReplaceBtn')?.textContent,
     roadPlacement:[...document.querySelectorAll('[data-asset-road]')].map(button=>button.textContent),
     carPlacement:[...document.querySelectorAll('[data-asset-car]')].map(button=>button.textContent),
     newRoad:placement&&placement.roadLayer,newCar:placement&&placement.carLayer};
 })()`);
 assert.equal(results.editor.undone,results.editor.original);
 assert.equal(results.editor.redone,'ПРОВЕРКА ИСТОРИИ');
 assert(results.editor.invalidErrors.length);
 assert.equal(results.editor.overflow,false);
 assert(results.editor.assetDockVisible);assert(results.editor.objectTools);
 assert.deepEqual(results.editor.sourceTabs,['Мои трассы','Кампания']);assert(results.editor.inspector);
 assert.equal(results.editor.replaceRoad,'Заменить выбранную дорогу');
 assert.deepEqual(results.editor.roadPlacement,['Под трассой','Над трассой']);
 assert.deepEqual(results.editor.carPlacement,['Под машиной','Над машиной']);
 assert.equal(results.editor.newRoad,'under');assert.equal(results.editor.newCar,'over');
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
 results.assetLayers=await editor.webContents.executeJavaScript(`(()=>{
   const def=MapAssets.current(),d=MapApp.getDocument();if(!def)return null;
   d.objects.push({pack:def.pack,id:def.id,x:100,y:100,w:def.w,h:def.h,layer:'under',carLayer:'under',roadLayer:'over'});
   MapView.setSelection({kind:'asset',i:d.objects.length-1});
   document.querySelector('[data-asset-road="under"]').click();
   document.querySelector('[data-asset-car="over"]').click();
   const object=d.objects[d.objects.length-1];
   return {road:object.roadLayer,car:object.carLayer,legacy:object.layer,status:document.getElementById('mapSaveState').textContent};
 })()`);
 assert.deepEqual(results.assetLayers,{road:'under',car:'over',legacy:'over',status:'Слои выделенного ассета изменены'});
 results.texture=await editor.webContents.executeJavaScript(`(async()=>{
   const input=document.getElementById('mapRailFile'),transfer=new DataTransfer();
   transfer.items.add(new File([new Uint8Array([137,80,78,71])],'Bort_01.png',{type:'image/png'}));
   input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));
   const started=Date.now();while(!/Bort_01\.png/.test(document.getElementById('mapSaveState').textContent)&&Date.now()-started<10000)await new Promise(resolve=>setTimeout(resolve,50));
   return {src:MapApp.getDocument().theme.railSrc,status:document.getElementById('mapSaveState').textContent};
 })()`);
 assert.equal(results.texture.src,'assets/data/maps/bord road/Bort_01.png');
 assert.match(results.texture.status,/Борта применены/);
 results.assetImport=await editor.webContents.executeJavaScript(`(async()=>{
   const canvas=document.createElement('canvas');canvas.width=16;canvas.height=8;
   const q=canvas.getContext('2d');q.fillStyle='#c65b27';q.fillRect(0,0,16,8);
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
   const input=document.getElementById('assetFile'),transfer=new DataTransfer();
   transfer.items.add(new File([blob],'Колесо арены.png',{type:'image/png'}));
   input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));
   const started=Date.now();while(!/Ассет импортирован/.test(document.getElementById('mapSaveState').textContent)&&Date.now()-started<10000)await new Promise(resolve=>setTimeout(resolve,50));
   return {status:document.getElementById('mapSaveState').textContent};
 })()`);
 assert.match(results.assetImport.status,/Ассет импортирован · Колесо арены\.png/);
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
