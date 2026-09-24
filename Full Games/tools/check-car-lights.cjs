// Настоящий редактор Electron: жесты, история и дисковый цикл света без записи ассетов игры.
'use strict';

const {app, BrowserWindow} = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');

const output = path.resolve(__dirname, '../build/car-lights-check');
fs.mkdirSync(output, {recursive: true});
const run = fs.mkdtempSync(path.join(output, 'run-'));
const redirectedContent = path.join(run, 'saved');
app.setPath('userData', path.join(run, 'profile'));
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// Сервис сохранения захватывает временный корень; чтение остальных ресурсов остаётся настоящим.
const paths = require('../src/main/paths');
const actualContentRoot = paths.contentRoot;
const sourceCars = path.join(actualContentRoot(), 'assets/data/cars');
paths.contentRoot = () => redirectedContent;
const saves = require('../src/main/save-car');
paths.contentRoot = actualContentRoot;
const actualSaveCar = saves.handleSaveCar;
const writes = [];
saves.handleSaveCar = async request => {
  const payload = await request.clone().json();
  const response = await actualSaveCar(request);
  writes.push({slot: payload.slot, kind: payload.kind || 'work', status: response.status});
  return response;
};
for (const [moduleName, functions] of [
  ['save-track', ['handleSaveTrack']],
  ['save-texture', ['handleSaveTexture', 'handleSaveTextureFile']],
  ['save-object', ['handleSavePack', 'handleSaveOblab', 'handleSaveOblabFile']]
]) {
  const service = require('../src/main/' + moduleName);
  for (const name of functions) service[name] = async () => {
    throw new Error('Проверка света неожиданно попыталась записать: ' + name);
  };
}

// После сохранения штатный hydrateFromDisk видит временные car.json, включая базу и бэкап.
const serving = require('../src/main/serve-file');
const actualServe = serving.serveLocalFile;
serving.serveLocalFile = (file, request, override) => {
  const relative = path.relative(sourceCars, file);
  if (/^\d{2}[\\/]car(?:\.base|\.backup)?\.json$/.test(relative)) {
    const replacement = path.join(redirectedContent, 'assets/data/cars', relative);
    if (fs.existsSync(replacement)) return actualServe(replacement, request, override);
  }
  return actualServe(file, request, override);
};
const protocol = require('../src/main/protocol');
protocol.registerPrivilegedScheme();
const errors = [];
const results = {run};
let editor;

function diskHashes() {
  const out = {};
  for (const entry of fs.readdirSync(sourceCars, {withFileTypes: true})) {
    if (!entry.isDirectory()) continue;
    for (const name of fs.readdirSync(path.join(sourceCars, entry.name))) {
      if (!/^car.*\.json(?:\.previous)?$/.test(name)) continue;
      const key = path.join(entry.name, name);
      out[key] = createHash('sha256').update(fs.readFileSync(path.join(sourceCars, key))).digest('hex');
    }
  }
  return out;
}
const originalHashes = diskHashes();

async function until(window, expression, timeout = 45000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try { if (await window.webContents.executeJavaScript(expression)) return; } catch (error) {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Не дождались: ' + expression);
}
function evaluate(expression) { return editor.webContents.executeJavaScript(expression); }
async function settle() { await new Promise(resolve => setTimeout(resolve, 850)); }
async function screenshot(name) {
  fs.writeFileSync(path.join(output, name + '.png'), (await editor.webContents.capturePage()).toPNG());
}
function readSaved(slot = 0, name = 'car.json') {
  return JSON.parse(fs.readFileSync(path.join(redirectedContent, 'assets/data/cars', String(slot + 1).padStart(2, '0'), name), 'utf8'));
}
function assertPoints(actual, expected, message) {
  assert.equal(actual.length, expected.length, message);
  actual.forEach((point, i) => point.forEach((value, axis) => {
    assert(Math.abs(value - expected[i][axis]) < 1e-8, message + ': точка ' + i + ', ось ' + axis);
  }));
}

app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  protocol.attachProtocol();
  editor = new BrowserWindow({show: false, width: 1440, height: 900,
    webPreferences: {offscreen: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false}});
  editor.webContents.setAudioMuted(true);
  editor.webContents.on('console-message', event => {
    if (event.level === 'error') errors.push(event.message);
  });
  editor.webContents.on('render-process-gone', (_event, details) => errors.push('Renderer: ' + details.reason));
  await editor.loadURL('rnr://game/Editor.html?tab=car');
  await until(editor, "typeof EditorApp !== 'undefined' && !!EditorApp.car() && typeof RnRCarLights !== 'undefined' && document.querySelectorAll('#carList button').length >= 21");
  await until(editor, "!document.getElementById('lab-splash')");

  await until(editor, "!!window.CarLightEditor && !!document.getElementById('carLightsToggle')");
  results.initial = await evaluate(`(() => {
    document.querySelector('#carList button').click();
    EditorView.setPlay(false); EditorView.setTest(false); EditorView.setYaw(0);
    document.getElementById('carLightsToggle').click();
    document.getElementById('lightMirror').checked = false;
    document.getElementById('lightMirror').dispatchEvent(new Event('change', {bubbles:true}));
    document.getElementById('snapToggle').checked = false;
    document.getElementById('snapToggle').dispatchEvent(new Event('change', {bubbles:true}));
    const car = EditorData.fileCar(EditorApp.car());
    return {slot:EditorApp.index(), car, positions:CarLightEditor.positions(), active:CarLightEditor.active()};
  })()`);
  assert.equal(results.initial.slot, 0);
  assert(results.initial.active, 'Кнопка Свет не включила редактирование');
  const gesture = await evaluate(`(() => {
    CarLightEditor.select('head', 0);
    const point = CarLightEditor.positions().head[0];
    const from = EditorView.toScreen({x:point[0],y:point[1]});
    const to = EditorView.toScreen({x:point[0]+2,y:point[1]+3});
    const start={x:Math.round(from.x),y:Math.round(from.y)},end={x:Math.round(to.x),y:Math.round(to.y)};
    const a=EditorView.toWorld({clientX:start.x,clientY:start.y}),b=EditorView.toWorld({clientX:end.x,clientY:end.y});
    return {start,end,expected:[point[0]+b.x-a.x,point[1]+b.y-a.y]};
  })()`);
  editor.webContents.sendInputEvent({type:'mouseMove',...gesture.start});
  editor.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...gesture.start});
  editor.webContents.sendInputEvent({type:'mouseMove',...gesture.end});
  editor.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...gesture.end});
  await new Promise(resolve=>setTimeout(resolve,100));
  results.drag = await evaluate(`({positions:CarLightEditor.positions(),car:EditorData.fileCar(EditorApp.car()),
    fieldsValid:['lightX','lightY'].every(id=>document.getElementById(id).checkValidity())})`);
  results.drag.positions.head[0].forEach((n, i) => assert(Math.abs(n - gesture.expected[i]) < .03, 'Перетаскивание не изменило точку фары'));
  assert(results.drag.fieldsValid, 'Координаты после перетаскивания считаются некорректными полями');
  assert.deepEqual(results.drag.positions.head.slice(1), results.initial.positions.head.slice(1), 'Отключённое зеркало изменило вторую фару');
  assert.deepEqual(results.drag.positions.brake, results.initial.positions.brake, 'Перетаскивание фары изменило стоп-сигналы');
  for (const key of ['body','w','nitro']) assert.deepEqual(results.drag.car[key], results.initial.car[key], 'Перетаскивание света изменило ' + key);

  // Второй незавершённый жест переживает таймер autosave и отменяется Escape.
  const cancelledGesture = await evaluate(`(() => {
    const p=CarLightEditor.positions().head[0],a=EditorView.toScreen({x:p[0],y:p[1]}),b=EditorView.toScreen({x:p[0]+1,y:p[1]+2});
    return {start:{x:Math.round(a.x),y:Math.round(a.y)},end:{x:Math.round(b.x),y:Math.round(b.y)}};
  })()`);
  editor.webContents.sendInputEvent({type:'mouseMove',...cancelledGesture.start});
  editor.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...cancelledGesture.start});
  editor.webContents.sendInputEvent({type:'mouseMove',...cancelledGesture.end});
  await new Promise(resolve=>setTimeout(resolve,400));
  results.cancelledDrag = {during:await evaluate('CarLightEditor.positions()')};
  assert.notDeepEqual(results.cancelledDrag.during.head, results.drag.positions.head, 'Отменяемое перетаскивание не началось');
  editor.webContents.sendInputEvent({type:'keyDown',keyCode:'Escape'});
  editor.webContents.sendInputEvent({type:'keyUp',keyCode:'Escape'});
  editor.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...cancelledGesture.end});
  await settle();
  results.cancelledDrag.after = await evaluate('CarLightEditor.positions()');
  results.cancelledDrag.saved = readSaved().lights;
  assert.deepEqual(results.cancelledDrag.after, results.drag.positions, 'Escape не вернул последний завершённый жест');
  assert.deepEqual(results.cancelledDrag.saved, results.drag.car.lights, 'Autosave записал отменённый жест на диск');

  // Средняя кнопка должна двигать камеру даже при начале панорамы прямо на маркере.
  const pan = await evaluate(`(() => {
    const p=CarLightEditor.positions().head[0],s=EditorView.toScreen({x:p[0],y:p[1]});
    return {start:{x:Math.round(s.x),y:Math.round(s.y)},camera:{...EditorView.cam},positions:CarLightEditor.positions()};
  })()`);
  editor.webContents.sendInputEvent({type:'mouseMove',...pan.start});
  editor.webContents.sendInputEvent({type:'mouseDown',button:'middle',clickCount:1,...pan.start});
  editor.webContents.sendInputEvent({type:'mouseMove',x:pan.start.x+50,y:pan.start.y+30});
  editor.webContents.sendInputEvent({type:'mouseUp',button:'middle',clickCount:1,x:pan.start.x+50,y:pan.start.y+30});
  await new Promise(resolve=>setTimeout(resolve,100));
  results.pan = await evaluate('({camera:{...EditorView.cam},positions:CarLightEditor.positions()})');
  assert(Math.hypot(results.pan.camera.x-pan.camera.x,results.pan.camera.y-pan.camera.y)>.1, 'Панорама через маркер не сдвинула камеру');
  assert.deepEqual(results.pan.positions, pan.positions, 'Панорама изменила точки света');
  await evaluate('EditorView.fit()');
  results.history = await evaluate(`(() => {
    document.getElementById('undoBtn').click();
    const undone=CarLightEditor.positions();
    document.getElementById('redoBtn').click();
    return {undone,redone:CarLightEditor.positions()};
  })()`);
  assert.deepEqual(results.history.undone, results.initial.positions, 'Отмена не вернула исходный свет');
  assert.deepEqual(results.history.redone, results.drag.positions, 'Повтор не вернул перетаскивание');

  // Команда без изменений не должна отменять ожидающую запись предыдущей правки.
  results.noopAutosave = await evaluate(`(() => {
    CarLightEditor.select('head',0);
    const field=document.getElementById('lightX');field.value='31.5';
    field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));
    const expected=EditorData.fileCar(EditorApp.car());
    CarLightEditor.select('brake',0);document.getElementById('lightReset').click();
    return {expected,afterReset:EditorData.fileCar(EditorApp.car())};
  })()`);
  assert.equal(results.noopAutosave.expected.lights.head[0][0],31.5);
  assert.deepEqual(results.noopAutosave.afterReset.lights,results.noopAutosave.expected.lights);
  await settle();
  assert.deepEqual(readSaved().lights,results.noopAutosave.expected.lights,'Команда без изменений потеряла ожидающую запись');
  await evaluate("document.getElementById('undoBtn').click()");
  assert.deepEqual(await evaluate('CarLightEditor.positions()'),results.drag.positions);

  // Переключение до истечения debounce проверяет правильный адрес отложенного сохранения.
  results.switching = await evaluate(`(() => {
    const originalOther=EditorData.fileCar(EditorData.load().cars[1]);
    CarLightEditor.select('brake',0);
    const old=CarLightEditor.positions().brake[0][0],target=-19.5;
    const field=document.getElementById('lightX');field.value=String(target);
    field.dispatchEvent(new Event('input',{bubbles:true}));
    field.dispatchEvent(new Event('change',{bubbles:true}));
    const expected=EditorData.fileCar(EditorApp.car());
    document.querySelectorAll('#carList button')[1].click();
    document.getElementById('undoBtn').click();
    return {old,target,expected,originalOther,other:EditorData.fileCar(EditorApp.car()),slot:EditorApp.index()};
  })()`);
  assert.equal(results.switching.slot, 1);
  assert.equal(results.switching.expected.lights.brake[0][0], results.switching.target, 'Поле X не изменило стоп-сигнал');
  assert.deepEqual(results.switching.other.lights, results.switching.originalOther.lights, 'Свет протёк в соседний слот');
  await settle();
  assert.deepEqual(readSaved().lights, results.switching.expected.lights, 'Отложенная запись потеряла правку прежнего автомобиля');
  results.returned = await evaluate(`(() => {
    document.querySelector('#carList button').click();
    const current=EditorData.fileCar(EditorApp.car());
    document.getElementById('undoBtn').click();const undone=CarLightEditor.positions();
    document.getElementById('redoBtn').click();
    return {current,undone,redone:EditorData.fileCar(EditorApp.car())};
  })()`);
  assert.deepEqual(results.returned.current.lights, results.switching.expected.lights);
  assert.deepEqual(results.returned.undone, results.drag.positions, 'История первого автомобиля не сохранилась');
  assert.deepEqual(results.returned.redone.lights, results.switching.expected.lights);
  results.pointTools = await evaluate(`(() => {
    CarLightEditor.select('head',0);
    const before=CarLightEditor.positions();
    document.getElementById('lightDuplicate').click();const duplicated=CarLightEditor.positions();
    document.getElementById('lightRemove').click();const removed=CarLightEditor.positions();
    document.getElementById('undoBtn').click();document.getElementById('undoBtn').click();
    const restored=CarLightEditor.positions();
    document.getElementById('lightReset').click();const reset=CarLightEditor.positions();
    document.getElementById('undoBtn').click();
    return {before,duplicated,removed,restored,reset,undoReset:CarLightEditor.positions()};
  })()`);
  assert.equal(results.pointTools.duplicated.head.length, results.pointTools.before.head.length + 1, 'Зеркальная копия не добавила точку');
  assert.equal(results.pointTools.removed.head.length, results.pointTools.before.head.length, 'Удаление не убрало точку');
  assert.deepEqual(results.pointTools.restored, results.pointTools.before, 'Отмена операций с точками потеряла данные');
  assert.deepEqual(results.pointTools.reset.head, results.initial.positions.head, 'Возврат к автоматическим фарам не сработал');
  assert.deepEqual(results.pointTools.reset.brake, results.pointTools.before.brake, 'Сброс фар затронул стопы');
  assert.deepEqual(results.pointTools.undoReset, results.pointTools.before, 'Отмена сброса потеряла ручные точки');
  results.mapShortcutGuard = await evaluate(`(() => {
    const before=EditorData.fileCar(EditorApp.car());
    MapApp.setTab('map');
    document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',code:'ArrowRight',bubbles:true}));
    const after=EditorData.fileCar(EditorApp.car());
    MapApp.setTab('car');
    return {unchanged:JSON.stringify(before)===JSON.stringify(after)};
  })()`);
  assert(results.mapShortcutGuard.unchanged, 'Клавиша во вкладке трасс изменила скрытый автомобиль');
  await settle();
  await screenshot('editor-1440');

  results.pendingField = await evaluate(`(() => {
    CarLightEditor.select('brake',0);
    const field=document.getElementById('lightX'),before=CarLightEditor.positions().brake[0][0];
    field.focus();field.value='-21.1';field.dispatchEvent(new Event('input',{bubbles:true}));
    return {before,beforeSave:CarLightEditor.positions().brake[0][0],target:-21.1,focused:document.activeElement===field};
  })()`);
  assert(results.pendingField.focused);
  assert.equal(results.pendingField.beforeSave,results.pendingField.before,'Поле неожиданно применилось до change/сохранения');
  editor.webContents.sendInputEvent({type:'keyDown',keyCode:'S',modifiers:['control']});
  editor.webContents.sendInputEvent({type:'keyUp',keyCode:'S',modifiers:['control']});
  await until(editor, "document.getElementById('saveState').textContent.includes('База') || document.getElementById('fileNoteTitle').textContent.includes('записан')");
  await settle();
  assert(writes.some(write => write.slot === 0 && write.kind === 'base' && write.status === 200), 'Кнопка сохранения не вызвала реальный сервис записи базы');
  const saved = readSaved();
  assert.equal(saved.lights.brake[0][0],results.pendingField.target,'Ctrl+S без blur не записал введённую координату');
  assert.deepEqual(saved.lights.head, results.switching.expected.lights.head);
  assert.deepEqual(saved.lights.brake.slice(1), results.switching.expected.lights.brake.slice(1));
  assert.deepEqual(readSaved(0, 'car.base.json').lights, saved.lights);

  // Убираем только профиль проверки: повторная загрузка обязана прочитать временный диск.
  await evaluate(`Object.keys(localStorage).filter(key=>key.startsWith(EditorData.KEY)).forEach(key=>localStorage.removeItem(key))`);
  await editor.loadURL('rnr://game/Editor.html?tab=car');
  await until(editor, "typeof EditorApp !== 'undefined' && !!window.CarLightEditor && document.querySelectorAll('#carList button').length >= 21 && !document.getElementById('lab-splash')");
  results.reloaded = await evaluate(`(() => {
    document.querySelector('#carList button').click();
    document.getElementById('carLightsToggle').click();
    return {car:EditorData.fileCar(EditorApp.car()),positions:CarLightEditor.positions()};
  })()`);
  assert.deepEqual(results.reloaded.car.lights, saved.lights, 'После загрузки с диска свет потерян');
  results.sizes = [];
  for (const [width,height] of [[1440,900],[1280,720],[1920,1080]]) {
    editor.setSize(width,height);
    await new Promise(resolve=>setTimeout(resolve,200));
    const layout = await evaluate(`(() => {
      const r=document.getElementById('stage').getBoundingClientRect();
      return {width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth+1,
        canvas:{width:r.width,height:r.height,left:r.left,right:r.right,top:r.top,bottom:r.bottom}};
    })()`);
    assert.equal(layout.overflow, false, 'Редактор выходит за ширину окна');
    assert(layout.canvas.width > 100 && layout.canvas.height > 100, 'Холст исчез на ' + width + '×' + height);
    results.sizes.push(layout);
    await screenshot('editor-' + width);
  }
  // Автоматический свет должен учитывать пропорции выбранной брони, как в заезде.
  await evaluate(`(() => {
    document.querySelectorAll('#carList button')[9].click();
    document.querySelector('#armorRow [data-armor="6"]').click();
    CarLightEditor.select('head',0);document.getElementById('lightReset').click();
    CarLightEditor.select('brake',0);document.getElementById('lightReset').click();
  })()`);
  await until(editor, "document.querySelector('#armorRow [data-armor=\"6\"] .armor-plate').naturalWidth > 0");
  await settle();
  results.automaticArmor = await evaluate('({slot:EditorApp.index(),car:EditorData.fileCar(EditorApp.car()),positions:CarLightEditor.positions(),bounds:EditorView.lightBounds(EditorApp.car())})');
  assert.equal(results.automaticArmor.slot,9);
  assert.equal(results.automaticArmor.car.body.armor,6);
  assert(!results.automaticArmor.car.lights?.head && !results.automaticArmor.car.lights?.brake, 'Проверяется ручной свет вместо автоматического');
  assert.equal(readSaved(9).body.armor,6);
  await screenshot('armor-auto');
  await evaluate("document.querySelector('#carList button').click()");

  // Проверяем реальные drawImage в заезде, а не только тот же вспомогательный resolve.
  const game = new BrowserWindow({show:false,width:1280,height:720,
    webPreferences:{offscreen:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
  game.webContents.setAudioMuted(true);
  game.webContents.on('console-message', event => {if(event.level==='error')errors.push(event.message);});
  await game.loadURL('rnr://game/rnr.html?lab=1&car=0');
  await until(game, "typeof P !== 'undefined' && P && window.DiVANEngine && DiVANEngine.carFx && BOOT.ready");
  results.render = await game.webContents.executeJavaScript(`(() => {
    paused=true;
    const car=editorCarConfig(0), calls=[];
    const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
    const c=canvas.getContext('2d'),draw=c.drawImage.bind(c);
    c.drawImage=(...args)=>{calls.push(args.slice(1));draw(...args);};
    const racer={...P,car:{...P.car,idx:0},x:200,y:200,ang:0,dead:false,cloak:0,z:0,bob:0,air:false,nitro:0,bolt:0,isP:true};
    DiVANEngine.carFx.drawDrivingLights(c,racer,{quality:2,brake:true});
    const centers=size=>calls.filter(call=>call.length===4&&call[2]===size&&call[3]===size).map(call=>[call[0]+size/2,call[1]+size/2]);
    const result={lights:car.lights,head:centers(20),brake:centers(32),beams:calls.filter(call=>call[2]===98&&call[3]===62).map(call=>[call[0],call[1]+31])};
    calls.length=0;racer.car={...CARS[9],idx:9};
    DiVANEngine.carFx.drawDrivingLights(c,racer,{quality:2,brake:true});
    result.automaticArmor={armor:editorCarConfig(9).body.armor,head:centers(20),brake:centers(32),bounds:carHitHalf(racer)};
    return result;
  })()`);
  assert.deepEqual(results.render.lights, saved.lights, 'Заезд не подхватил сохранённую конфигурацию');
  assertPoints(results.render.head, results.reloaded.positions.head, 'Фары заезда расходятся с редактором');
  assertPoints(results.render.brake, results.reloaded.positions.brake, 'Стоп-сигналы заезда расходятся с редактором');
  assertPoints(results.render.beams, results.reloaded.positions.head, 'Лучи начинаются не в точках фар');
  assert.equal(results.render.automaticArmor.armor,6);
  assertPoints(results.render.automaticArmor.head, results.automaticArmor.positions.head, 'Автопозиции фар брони расходятся с заездом');
  assertPoints(results.render.automaticArmor.brake, results.automaticArmor.positions.brake, 'Автопозиции стопов брони расходятся с заездом');
  game.destroy();

  results.writes = writes;
  assert.deepEqual(diskHashes(), originalHashes, 'Проверка изменила исходные car.json');
  results.sourceAssetsUnchanged = true;
  assert.deepEqual(errors, [], 'Ошибки редактора: ' + errors.join('\n'));
  results.errors = errors;
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(results, null, 2));
  for (const name of ['failure.json','failure.png']) {
    const stale = path.join(output,name);
    if (fs.existsSync(stale)) fs.unlinkSync(stale);
  }
  console.log(JSON.stringify({ok:true,report:path.join(output,'result.json'),
    checked:['pointer drag','coordinate validity','cancelled drag autosave','pan from marker','undo/redo','point clone/remove/reset','noop preserves autosave',
      'slot isolation','autosave on slot switch','map shortcut isolation','Ctrl+S with focused coordinate','real disk save','disk reload','game render positions','automatic armor light positions'],
    sizes:results.sizes.map(size=>[size.width,size.height]),writes:writes.length,
    sourceAssetsUnchanged:results.sourceAssetsUnchanged,errors}, null, 2));
  editor.destroy();
  app.exit(0);
}).catch(async error => {
  results.error = error.stack;
  results.errors = errors;
  results.writes = writes;
  results.sourceAssetsUnchanged = JSON.stringify(diskHashes()) === JSON.stringify(originalHashes);
  if (editor && !editor.isDestroyed()) await screenshot('failure').catch(() => {});
  fs.writeFileSync(path.join(output, 'failure.json'), JSON.stringify(results, null, 2));
  console.error(error);
  app.exit(1);
});
