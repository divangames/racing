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
 const context={module,exports:module.exports,Response,console,require:id=>id==='./paths'?{contentRoot:()=>root}:realRequire(id)};
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
 assert(out.includes('workbench.css'));
 assert(out.includes('/__engine/runtime.js'));
});
test('Расширение текущего редактора сохраняет библиотеку объектов и стартовую клетку',()=>{
 const source=fs.readFileSync(path.resolve(__dirname,'../../editor/map-app.js'),'utf8');
 const enhanced=enhanceEditorScript(source);
 assert(enhanced.includes('MapAssets.init('));assert(enhanced.includes('MapAssets.setOpen('));
 assert(enhanced.includes('function addStart('));assert(enhanced.includes('getDocument:cur'));
 assert.throws(()=>enhanceEditorScript('const MapApp={};'),/контракт/);
});
test('Живые rnr.html и Editor.html получают рантайм по meta',()=>{
 const gameHtml=fs.readFileSync(path.resolve(__dirname,'../../rnr.html'),'utf8');
 const labHtml=fs.readFileSync(path.resolve(__dirname,'../../Editor.html'),'utf8');
 assert(gameHtml.includes('name="divan-engine" content="game"'));
 assert(labHtml.includes('name="divan-engine" content="lab"'));
 assert(enhanceHtml(gameHtml).includes('/__engine/driving.js'));
 assert(enhanceHtml(labHtml).includes('/__engine/editor/workbench.js'));
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
  assert.deepEqual(await api.handleListTracks().json(),{files:['custom_01.json']});
  assert.equal((await api.handleSaveTrack(request({id:doc.id,kind:'delete'}))).status,200);
  assert.deepEqual(await api.handleListTracks().json(),{files:[]});
  assert.equal(fs.readdirSync(path.join(root,'assets/data/tracks/.trash')).length,1);
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
test('История сохраняет redo при повторе снимка и обрезает ветку при новой правке',()=>{
 const context={};vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../src/engine/editor/history.js'),'utf8')+'\nglobalThis.History=StudioHistory;',context);
 const h=new context.History(3);h.record('a');h.record('b');h.record('c');h.at--;h.record('b');assert.equal(h.list.length,3);
 h.record('d');assert.equal(h.list.join(','),'a,b,d');h.record('e');assert.equal(h.list.join(','),'b,d,e');assert.equal(h.at,2);
});
test('С выбора гонщика ESC возвращает в главное меню',()=>{
 const html=fs.readFileSync(path.resolve(__dirname,'../../rnr.html'),'utf8');
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
