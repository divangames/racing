// Регрессии: маршрутизация модулей, история и безопасное сохранение документов.
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const vm=require('node:vm');
const {createRequire}=require('node:module');
const {writeDocument,validateTrack,validateCar}=require('../src/main/document-store');
const {enhanceHtml,engineFile}=require('../src/main/enhancements');
const {enhanceEditorScript}=require('../src/main/editor-enhancements');
const valid=()=>({id:'custom_01',name:'Полигон',cps:[[0,0],[1000,0],[1000,1000],[0,1000]],hazards:{ramps:[],mines:[]}});

/** Загружает обработчик с изолированным корнем файлов вместо каталога игры. */
function handler(name,root){
 const file=path.resolve(__dirname,'../src/main/'+name+'.js'),realRequire=createRequire(file),module={exports:{}};
 const context={module,exports:module.exports,Response,Buffer,console,require:id=>id==='./paths'?{contentRoot:()=>root}:realRequire(id)};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),context,{filename:file});return module.exports;
}
/** Запрос редактора без сети. */
function request(data){return new Request('http://localhost/',{method:'POST',body:JSON.stringify(data)});}

test('Модули подключаются по пути и meta, не по тексту stepVehicle',()=>{
 const sniff='<head></head><body><script>function stepVehicle(){}</script></body>';
 assert.equal(enhanceHtml(sniff),sniff);
 const byPath=enhanceHtml('<head></head><body></body>',{pathname:'/rnr.html'});
 assert(byPath.includes('/__engine/runtime.js'));
 assert(byPath.includes('/__engine/driving.js'));
 assert(byPath.includes('__DIVAN_ENGINE_META__'));
 const byMeta=enhanceHtml('<head><meta name="divan-engine" content="game"></head><body></body>');
 assert(byMeta.includes('/__engine/loop.js'));
 assert.equal(enhanceHtml('<body>hello</body>'),'<body>hello</body>');
});
test('История загружается раньше приложения карты',()=>{
 const out=enhanceHtml('<head></head><body><main id="workMap"></main><script src="editor/map-app.js?v=1"></script></body>',{pathname:'/Editor.html'});
 assert(out.indexOf('/__engine/editor/history.js')<out.indexOf('src="editor/map-app'));
 assert(out.indexOf('/__engine/lab-session.js')<out.indexOf('/__engine/editor/test-session.js'));
 assert(out.indexOf('/__engine/editor/test-session.js')<out.indexOf('src="editor/map-app'));
 assert(out.includes('workbench.css'));
 assert(out.includes('busy.css'));
 assert(out.includes('/__engine/editor/busy.js'));
 assert(out.includes('splash.css'));
 assert(out.includes('/__engine/runtime.js'));
 assert(out.includes('id="lab-splash"'));
 assert(out.includes('lab-splash-version'));
 assert(out.includes('lab-splash-files'));
});
test('Десктопная лаборатория подменяет модули дерева паков',()=>{
 const {overrideEditorHtml}=require('../src/main/protocol');
 const html='<html><head></head><body><script src="objects.js?v=1"></script><script src="editor/map-assets.js?v=1"></script><script src="editor/map-asset-coll.js?v=1"></script><script src="editor/map-asset-edit.js?v=1"></script></body></html>';
 const out=overrideEditorHtml(html,'/Editor.html');
 assert(out.includes('/__engine/editor/objects.js'));
 assert(out.includes('/__engine/editor/map-assets.js'));
 assert(out.includes('/__engine/editor/map-asset-coll.js'));
 assert(out.includes('/__engine/editor/map-asset-edit.js'));
 assert(out.includes('/__engine/editor/asset-library.css'));
});
test('Ассеты редактора рисуются на трассе и над трассой в правильном порядке',()=>{
 const view=fs.readFileSync(path.resolve(__dirname,'../content/editor/map-view.js'),'utf8');
 const road=view.indexOf('MapPreview.strokeRoad');
 const belowRoad=view.indexOf("RnRObjects.drawLayer(ctx, t.objects, 'underRoad'");
 const onTrack=view.indexOf("RnRObjects.drawLayer(ctx, t.objects, 'under'");
 const above=view.indexOf("RnRObjects.drawLayer(ctx, t.objects, 'over'");
 assert(belowRoad>=0&&belowRoad<road&&onTrack>road&&above>onTrack);
 const html=fs.readFileSync(path.resolve(__dirname,'../content/Editor.html'),'utf8');
 assert(html.includes('data-asset-road="under"'));
 assert(html.includes('data-asset-road="over"'));
 assert(html.includes('data-asset-car="under"'));
 assert(html.includes('data-asset-car="over"'));
 assert(html.includes('id="assetEditRoadUnder"'));
 assert(html.includes('id="assetEditUnder"'));
});
test('Расширение текущего редактора сохраняет библиотеку объектов и стартовую клетку',()=>{
 const source=fs.readFileSync(path.resolve(__dirname,'../content/editor/map-app.js'),'utf8');
 const enhanced=enhanceEditorScript(source);
 assert(enhanced.includes('MapAssets.init('));assert(enhanced.includes('MapAssets.setOpen('));
 assert(enhanced.includes('function addStart('));assert(enhanced.includes('getDocument:cur'));
 assert.equal(enhanceEditorScript(enhanced),enhanced);
 assert(!enhanced.includes('window.MapData && MapData.isChapter'));
 assert(enhanced.includes("typeof MapData !== 'undefined' && MapData.isChapter"));
 assert.throws(()=>enhanceEditorScript('const MapApp={};'),/контракт/);
});
test('Возврат из теста карты несёт id трассы',()=>{
 const html=fs.readFileSync(path.resolve(__dirname,'../content/rnr.html'),'utf8');
 const map=fs.readFileSync(path.resolve(__dirname,'../content/editor/map-app.js'),'utf8');
 assert.match(html,/function exitLabTest/);
 assert.match(html,/&track=/);
 assert.match(map,/applyStartDoc/);
 assert.match(map,/rnr\.mapSel/);
 assert.match(map,/__mapFillLock/);
 assert.match(map,/if \(fillLock\) return;/);
 const enhanced=enhanceEditorScript(map);
 assert.match(enhanced,/__mapFillLock/);
});
test('Живые rnr.html и Editor.html получают рантайм по meta',()=>{
 const gameHtml=fs.readFileSync(path.resolve(__dirname,'../content/rnr.html'),'utf8');
 const labHtml=fs.readFileSync(path.resolve(__dirname,'../content/Editor.html'),'utf8');
 assert(gameHtml.includes('name="divan-engine" content="game"'));
 assert(labHtml.includes('name="divan-engine" content="lab"'));
 assert(enhanceHtml(gameHtml).includes('/__engine/driving.js'));
 assert(enhanceHtml(labHtml).includes('/__engine/editor/workbench.js'));
 assert(enhanceHtml(labHtml).includes('/__engine/track-ribbon.js'));
 assert(enhanceHtml(labHtml).includes('/__engine/track-span.js'));
 assert(enhanceHtml(labHtml).includes('/__engine/editor/splash.js'));
});
test('Хуки движка оборачивают исходную функцию, а не молча падают',()=>{
 const src=fs.readFileSync(path.resolve(__dirname,'../src/engine/runtime.js'),'utf8');
 const context={window:{},console,globalThis:null};
 context.globalThis=context.window;
 context.window.__DIVAN_ENGINE_META__={abi:1,version:'0.2.2.6',runtime:'html-legacy',host:'game'};
 vm.runInNewContext(src,context);
 const g=context.window;
 let n=0;
 g.stepVehicle=function(){n+=1;};
 g.DiVANEngine.wrap('stepVehicle',orig=>function(){orig();n+=10;});
 g.stepVehicle();
 assert.equal(n,11);
 assert.equal(g.DiVANEngine.version,'0.2.2.6');
 assert.equal(g.DiVANEngine.name,'DiVANEngine');
 assert.equal(g.DiVANEngine.replace('нетТакого',function(){}),false);
});
test('Маршрутизация модулей запрещает выход из каталога',()=>{
 assert.equal(engineFile('__engine/../../package.json'),null);
 assert.equal(engineFile('assets/anything.png'),null);
 assert.equal(engineFile('editor/map-app.js'),null);
 assert(engineFile('__engine/editor/workbench.js').endsWith('workbench.js'));
 assert(engineFile('__engine/runtime.js').endsWith('runtime.js'));
});
test('Валидация принимает документ трассы',()=>assert.equal(validateTrack(valid()),null));
for(const [name,doc] of [['null',null],['массив',[]],['повторяющиеся точки',{...valid(),cps:[[0,0],[0,0],[0,0],[0,0]]}],['NaN',{...valid(),cps:[[NaN,0],[1,2],[3,4],[5,6]]}],['пустой объект деколи',{...valid(),decals:[null]}],['опасность без координат',{...valid(),hazards:{ramps:[{}]}}]]) {
 test('Отклоняется повреждённый документ: '+name,()=>assert(validateTrack(doc)));
}
test('Машина требует кузов и конечные координаты колёс',()=>{
 assert.equal(validateCar({body:{x:0,y:0,scale:1},w:[[2,3]]}),null);
 assert(validateCar({body:{scale:null},w:[[NaN,0]]}));assert(validateCar([]));
});
test('Атомарная запись сохраняет предыдущую версию и переживает ошибку сериализации',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rnr-store-')),file=path.join(root,'test.json');
 try {
  writeDocument(file,{version:1});writeDocument(file,{version:2});
  assert.equal(JSON.parse(fs.readFileSync(file)).version,2);
  assert.equal(JSON.parse(fs.readFileSync(file+'.previous')).version,1);
  const circular={};circular.self=circular;assert.throws(()=>writeDocument(file,circular));
  assert.equal(JSON.parse(fs.readFileSync(file)).version,2);
  assert(!fs.readdirSync(root).some(n=>n.endsWith('.tmp')));
 } finally {fs.rmSync(root,{recursive:true,force:true});}
});
test('Сохранение трассы обновляет индекс, удаление перемещает файл в корзину',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rnr-api-'));
 try {
  const api=handler('save-track',root),doc=valid();
  assert.equal((await api.handleSaveTrack(request({id:doc.id,track:doc}))).status,200);
  doc.name='Обновлённая';assert.equal((await api.handleSaveTrack(request({id:doc.id,track:doc}))).status,200);
  assert.deepEqual(await api.handleListTracks().json(),{files:['custom_01.json'],chapters:[]});
  assert.equal((await api.handleSaveTrack(request({id:doc.id,kind:'delete'}))).status,200);
  assert.deepEqual(await api.handleListTracks().json(),{files:[],chapters:[]});
  assert.equal(fs.readdirSync(path.join(root,'assets/data/tracks/.trash')).length,1);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('Сюжетная трасса пишется в chapters и не удаляется',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rnr-ch-'));
 try {
  const api=handler('save-track',root);
  const doc={id:'ch1_arena_01',name:'Ночной овал',chapter:1,cps:[[0,0],[1000,0],[1000,1000],[0,1000]],hazards:{ramps:[],mines:[]}};
  assert.equal((await api.handleSaveTrack(request({id:doc.id,track:doc}))).status,200);
  const listed=await api.handleListTracks().json();
  assert.deepEqual(listed.files,[]);
  assert.deepEqual(listed.chapters,['chapters/ch1_arena_01.json']);
  assert.equal(fs.existsSync(path.join(root,'assets/data/tracks/chapters/ch1_arena_01.json')),true);
  assert.equal((await api.handleSaveTrack(request({id:doc.id,track:doc,kind:'delete'}))).status,400);
  assert.equal(fs.existsSync(path.join(root,'assets/data/tracks/chapters/ch1_arena_01.json')),true);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('Обработчики возвращают 400 для null и неизвестной операции без записи',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rnr-invalid-'));
 try {
  const track=handler('save-track',root),car=handler('save-car',root);
  for(const data of [null,[],{id:'../escape',track:valid()},{id:'safe',track:valid(),kind:'unknown'}])assert.equal((await track.handleSaveTrack(request(data))).status,400);
  assert.equal((await car.handleSaveCar(request(null))).status,400);
  assert.equal(fs.readdirSync(root).length,0);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('Запись .oblab в клиенте сохраняет несколько тел коллизии',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rnr-obj-'));
 try {
  const api=handler('save-object',root);
  const box={pack:'world',id:'crate',name:'Ящик',w:64,h:64,layer:'over',collision:{solid:true,bodies:[{poly:[[-10,-10],[10,-10],[10,10],[-10,10]]},{poly:[[20,-5],[30,-5],[30,5],[20,5]]}]}};
  assert.equal((await api.handleSaveOblab(request(box))).status,200);
  const listed=await api.handleListPacks().json();
  const obj=listed.packs[0].objects[0];
  assert.equal(obj.collision.bodies.length,2);
  assert.equal(obj.collision.poly.length,4);
 } finally {fs.rmSync(root,{recursive:true,force:true});}
});
test('Ассет импортируется исходными байтами и сохраняет русское название',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rnr-obj-file-'));
 try {
  const api=handler('save-object',root);
  const url=new URL('http://localhost/__save-oblab-file?pack=world&id=arena_koleso&name='+encodeURIComponent('Колесо арены')+'&ext=png&w=640&h=320');
  const res=await api.handleSaveOblabFile(new Request(url,{method:'POST',body:Buffer.from('png-binary')}),url);
  assert.equal(res.status,200);
  const out=await res.json();
  assert.equal(out.src,'assets/object/world.labr/arena_koleso.png');
  assert.equal(fs.readFileSync(path.join(root,out.src),'utf8'),'png-binary');
  const object=api.listPacks().packs[0].objects[0];
  assert.equal(object.name,'Колесо арены');
  assert.equal(object.w,640);assert.equal(object.h,320);assert.equal(object.layer,'under');
 } finally {fs.rmSync(root,{recursive:true,force:true});}
});
test('Замена картинки сохраняет размер, слои и коллизию ассета',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rnr-obj-replace-'));
 try {
  const api=handler('save-object',root);
  const original={pack:'world',id:'tower',name:'Башня',src:'tower.png',w:96,h:180,lockRatio:false,layer:'over',carLayer:'over',roadLayer:'under',collision:{solid:true,bodies:[{poly:[[-20,-40],[20,-40],[20,40],[-20,40]]}]}};
  assert.equal((await api.handleSaveOblab(request(original))).status,200);
  const url=new URL('http://localhost/__save-oblab-file?pack=world&id=tower&name='+encodeURIComponent('Новая башня')+'&ext=webp&w=2048&h=4096&replace=1');
  assert.equal((await api.handleSaveOblabFile(new Request(url,{method:'POST',body:Buffer.from('new-image')}),url)).status,200);
  const object=api.listPacks().packs[0].objects[0];
  assert.equal(object.w,96);assert.equal(object.h,180);assert.equal(object.lockRatio,false);
  assert.equal(object.carLayer,'over');assert.equal(object.roadLayer,'under');assert.equal(object.collision.solid,true);
  assert.equal(object.collision.bodies[0].poly.length,4);
  assert.equal(fs.readFileSync(path.join(root,'assets/object/world.labr/tower.webp'),'utf8'),'new-image');
 } finally {fs.rmSync(root,{recursive:true,force:true});}
});
test('Карта даёт объектам квадратные превью, буфер обмена, отражение и параметры теста',()=>{
 const assets=fs.readFileSync(path.resolve(__dirname,'../src/engine/editor/map-assets.js'),'utf8');
 const objects=fs.readFileSync(path.resolve(__dirname,'../src/engine/editor/objects.js'),'utf8');
 const edit=fs.readFileSync(path.resolve(__dirname,'../src/engine/editor/map-asset-edit.js'),'utf8');
 const session=fs.readFileSync(path.resolve(__dirname,'../src/engine/editor/test-session.js'),'utf8');
 const css=fs.readFileSync(path.resolve(__dirname,'../src/engine/editor/asset-library.css'),'utf8');
 assert.match(css,/aspect-ratio:\s*1\s*\/\s*1/);
 assert.match(assets,/KeyC/);assert.match(assets,/KeyV/);assert.match(assets,/assetInstanceFlipX/);assert.match(assets,/Пропорционально/);
 assert.match(objects,/inst\.flipX/);assert.match(objects,/inst\.flipY/);
 assert.match(edit,/Заменить изображение/);assert.match(edit,/scaleCollision/);
 assert.match(edit,/card\.appendChild\(footer\)/);assert.match(edit,/Изображение и размер/);assert.match(edit,/Расположение/);
 assert.match(css,/\.asset-edit-footer\s*\{/);assert.match(css,/overflow-y:\s*auto/);assert.match(css,/scrollbar-gutter:\s*stable/);
 assert.match(session,/Добавить соперников/);assert.match(session,/mapTestDifficulty/);assert.match(session,/mapTestLaps/);
});
test('Паки хранят цвет и дерево, а системный пак нельзя изменить',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rnr-pack-'));
 try {
  const api=handler('save-object',root);
  assert.equal(api.mutatePack({action:'create',id:'parent_pack',name:'Родитель',color:'#123456'}).ok,true);
  assert.equal(api.mutatePack({action:'create',id:'child_pack',name:'Дочерний',color:'#abcdef'}).ok,true);
  assert.equal(api.mutatePack({action:'update',id:'child_pack',name:'Вложенный',color:'#fedcba',parent:'parent_pack'}).ok,true);
  api.writePack && api.writePack({id:'world',name:'МИР'});
  const packs=api.listPacks();
  const child=packs.packs.find(pack=>pack.id==='child_pack');
  assert.equal(child.parent,'parent_pack');
  assert.equal(child.color,'#fedcba');
  fs.mkdirSync(path.join(root,'assets','object','world.labr'),{recursive:true});
  fs.writeFileSync(path.join(root,'assets','object','world.labr','pack.labr'),'{}');
  assert.equal(api.listPacks().packs.find(pack=>pack.id==='world').system,true);
  assert.equal(api.mutatePack({action:'delete',id:'world'}),null);
 } finally {fs.rmSync(root,{recursive:true,force:true});}
});
test('Редактор ассета поддерживает двойной клик по ребру и Delete для вершины',()=>{
 const coll=fs.readFileSync(path.resolve(__dirname,'../src/engine/editor/map-asset-coll.js'),'utf8');
 const edit=fs.readFileSync(path.resolve(__dirname,'../src/engine/editor/map-asset-edit.js'),'utf8');
 const context={window:{}};vm.runInNewContext(coll,context);
 const api=context.window.MapAssetColl;
 const def={layer:'over',collision:{solid:true,bodies:[{poly:[[-10,-10],[10,-10],[10,10],[-10,10]]}],poly:[]}};
 assert.equal(api.onDoubleClick(def,{x:0,y:-10},1),true);
 assert.equal(def.collision.bodies[0].poly.length,5);
 api.onDown({button:0,altKey:false},def,{x:0,y:-10},1);
 assert.equal(api.removeSelectedVertex(def),true);
 assert.equal(def.collision.bodies[0].poly.length,4);
 assert(edit.includes("addEventListener('dblclick', onDoubleClick)"));
 assert(edit.includes("addEventListener('keydown', onKeyDown)"));
});
test('Вершины коллизии видны и доступны даже при выключенном столкновении',()=>{
 const coll=fs.readFileSync(path.resolve(__dirname,'../src/engine/editor/map-asset-coll.js'),'utf8');
 const context={window:{}};vm.runInNewContext(coll,context);
 let arcs=0,strokes=0;
 const ctx={save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},stroke(){strokes++;},setLineDash(){},arc(){arcs++;},fillRect(){},strokeRect(){}};
 const def={layer:'over',collision:{solid:false,bodies:[{poly:[[-10,-10],[10,-10],[10,10],[-10,10]]}],poly:[]}};
 context.window.MapAssetColl.paint(ctx,def,1);
 assert.equal(arcs,8);assert(strokes>=3);
});
test('Отражение экземпляра применяется к изображению и коллизии на карте',()=>{
 const source=fs.readFileSync(path.resolve(__dirname,'../src/engine/editor/objects.js'),'utf8');
 const scales=[];
 const context={window:{},Image:function(){this.complete=true;this.naturalWidth=64;}};
 vm.runInNewContext(source,context);
 const def={pack:'world',id:'tower',src:'tower.png',w:64,h:80,layer:'over',carLayer:'over',roadLayer:'over',collision:{solid:true,bodies:[{poly:[[-10,-10],[10,-10],[10,10],[-10,10]]}],poly:[]}};
 context.window.RnRObjects.packs=[{id:'world',objects:[def]}];
 const ctx={save(){},restore(){},translate(){},rotate(){},scale(x,y){scales.push([x,y]);},drawImage(){},fillRect(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},stroke(){},setLineDash(){},strokeRect(){}};
 const object={pack:'world',id:'tower',x:0,y:0,w:64,h:80,flipX:true,flipY:true};
 context.window.RnRObjects.drawOne(ctx,object);
 context.window.RnRObjects.drawCollision(ctx,object);
 assert.deepEqual(scales,[[-1,-1],[-1,-1]]);
});
test('История сохраняет redo при повторе снимка и обрезает ветку при новой правке',()=>{
 const context={};vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../src/engine/editor/history.js'),'utf8')+'\nglobalThis.History=StudioHistory;',context);
 const h=new context.History(3);h.record('a');h.record('b');h.record('c');h.at--;h.record('b');assert.equal(h.list.length,3);
 h.record('d');assert.equal(h.list.join(','),'a,b,d');h.record('e');assert.equal(h.list.join(','),'b,d,e');assert.equal(h.at,2);
});
test('С выбора гонщика ESC возвращает в главное меню',()=>{
 const html=fs.readFileSync(path.resolve(__dirname,'../content/rnr.html'),'utf8');
 assert(html.includes('function leaveCharSel()'));
 assert(/if\(state==='char'\)[\s\S]{0,400}if\(isBack\(c\)\)\{leaveCharSel\(\)/.test(html));
});
test('Каталог звуков лаборатории отдаёт паки двигателя и оружия',()=>{
 const {listLabSounds}=require('../src/main/lab-sounds');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rnr-snd-'));
 try {
  const eng=path.join(root,'assets','sounds','cars','engine','01 Test Car','sound');
  const wep=path.join(root,'assets','sounds','weapon','Ak47');
  const skip=path.join(root,'assets','sounds','weapon','generic');
  fs.mkdirSync(eng,{recursive:true});
  fs.mkdirSync(wep,{recursive:true});
  fs.mkdirSync(skip,{recursive:true});
  fs.writeFileSync(path.join(eng,'sound_001.wav'),'x');
  fs.writeFileSync(path.join(wep,'shoot.wav'),'x');
  fs.writeFileSync(path.join(skip,'step.wav'),'x');
  const cat=listLabSounds(root);
  assert.equal(cat.engines.length,1);
  assert.equal(cat.engines[0].id,'01 Test Car');
  assert.deepEqual(cat.engines[0].clips,['sound_001.wav']);
  assert.equal(cat.weapons.length,1);
  assert.equal(cat.weapons[0].id,'Ak47');
 } finally {fs.rmSync(root,{recursive:true,force:true});}
});
test('WAV для мотора отдаётся буфером, не Node-потоком', async () => {
  const {serveLocalFile, shouldBufferAudio} = require('../src/main/serve-file');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rnr-wav-'));
  const file = path.join(dir, 'sound_001.wav');
  const payload = Buffer.from('RIFFWAVTEST');
  try {
    fs.writeFileSync(file, payload);
    assert.equal(shouldBufferAudio(file), true);
    const res = serveLocalFile(file, new Request('http://rnr/sound_001.wav'));
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-length'), String(payload.length));
    const got = Buffer.from(await res.arrayBuffer());
    assert.deepEqual(got, payload);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test('MP4 для заставки отдаётся как видео с поддержкой Range', async () => {
  const { serveLocalFile } = require('../src/main/serve-file');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rnr-video-'));
  const file = path.join(dir, 'intro.mp4');
  const payload = Buffer.from('0123456789');
  try {
    fs.writeFileSync(file, payload);
    const request = new Request('http://rnr/intro.mp4', { headers: { range: 'bytes=2-5' } });
    const res = serveLocalFile(file, request);
    assert.equal(res.status, 206);
    assert.equal(res.headers.get('content-type'), 'video/mp4');
    assert.equal(res.headers.get('content-range'), 'bytes 2-5/10');
    assert.deepEqual(Buffer.from(await res.arrayBuffer()), Buffer.from('2345'));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
