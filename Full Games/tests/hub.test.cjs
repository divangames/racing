////////////////////////////////////////////////////////
//
// Гараж, эфир результатов и порядок машин на арене.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { enhanceHtml, engineFile } = require('../src/main/enhancements');

/** Песочница runtime + hub + arena. */
function bootHub(ImageClass) {
  const g = {
    console,
    drawGarage: function () {},
    drawResults: function () {},
    drawFinishZone: function () {},
    drawRaceArena: function () {}
  };
  g.window = g;
  g.globalThis = g;
  if (ImageClass) g.Image = ImageClass;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/hub.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/arena.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает hub и arena до кадра и HUD', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/hub.js'));
  assert(out.includes('/__engine/arena.js'));
  assert(out.indexOf('render.js') < out.indexOf('hub.js'));
  assert(out.indexOf('hub.js') < out.indexOf('arena.js'));
  assert(out.indexOf('arena.js') < out.indexOf('loop.js'));
  assert(out.indexOf('arena.js') < out.indexOf('presentation.js'));
  assert(engineFile('__engine/hub.js').endsWith('hub.js'));
  assert(engineFile('__engine/arena.js').endsWith('arena.js'));
});

test('Колонки гаража, эфир доски и порядок машин по Y', () => {
  const g = bootHub();
  const hub = g.DiVANEngine.hub;
  assert.equal(hub.TUNING_KEYS.join(','), 'arm,eng,tir,shk,nit');
  const col = hub.garageColumns(1280, 48, 280, 24);
  assert.equal(col.midX, 352);
  assert.equal(col.midW, 400);
  assert.ok(col.rightW > 200);
  assert.equal(hub.resultsShown(4, 0, 0.95, false), 1);
  assert.equal(hub.resultsShown(4, 2, 0.95, false), 3);
  assert.equal(hub.resultsShown(4, 0, 0.95, true), 4);
  assert.equal(hub.resultsBoard(['a', 'b', 'c', 'd', 'e'], 4).length, 4);
  const pad = g.DiVANEngine.render.arenaPad({ x: 100, y: 50 }, 800, 450, 64);
  assert.equal(pad.x, 36);
  assert.equal(pad.w, 928);
  const order = g.DiVANEngine.render.racerDrawOrder([{ y: 30, id: 1 }, { y: 10, id: 2 }]);
  assert.equal(order[0].id, 2);
  assert.equal(order[1].id, 1);
  const labels = g.DiVANEngine.render.finishLabelPoints({x:400,y:300,ang:Math.PI/2},100);
  assert.equal(labels[0].x,400);
  assert.equal(labels[1].x,400);
  assert.equal(labels[0].y,182);
  assert.equal(labels[1].y,418);
});

test('Текстуры трамплина, масла и всех наград доступны и рисуются сверху', () => {
  class ReadyImage {
    constructor() { this.complete = true; this.naturalWidth = 1254; }
  }
  const g = bootHub(ReadyImage);
  const calls = [];
  const context = {
    save() {}, restore() {}, translate() {}, rotate() {},
    drawImage(image, ...args) { calls.push({ src: image.src, args }); }
  };
  const textures = [
    ['pad', 66, 48], ['ramp', 76, 84], ['oil', 66, 48], ['mine', 26, 26],
    ...['money', 'wrench', 'wep', 'ult', 'nit', 'shield', 'bolt'].map(type => [type, 31, 31])
  ];
  for (const [type, width, height] of textures) {
    assert(fs.existsSync(engineFile('__engine/sprites/arena-' + type + '.png')));
    assert.equal(g.DiVANEngine.render.drawArenaTexture(context, type, 10, 20, width, height, .5), true);
    const draw = calls.at(-1);
    assert(draw.src.endsWith('arena-' + type + '.png'));
    assert.deepEqual(draw.args, [-width / 2, -height / 2, width, height]);
  }
});

test('Рисунок трамплина развёрнут на 180 градусов в заезде', () => {
  class ReadyImage {
    constructor() { this.complete = true; this.naturalWidth = 1254; }
  }
  const g = bootHub(ReadyImage), rotations = [], images = [];
  g.g = new Proxy({}, {
    get(target, key) { return target[key] || function () {}; },
    set(target, key, value) { target[key] = value; return true; }
  });
  g.g.rotate = angle => rotations.push(angle);
  g.g.drawImage = (image, ...args) => images.push({ image, args });
  Object.assign(g, { TAU: Math.PI * 2, gt: 0, settings: { graphics: { weather: false } },
    visW: () => 100, visH: () => 100, fillMapTileWorld() {}, drawYanotGuide() {}, drawFinishZone() {} });
  const S = Array.from({ length: 32 }, () => ({ x: 100, y: 100, ang: .3 }));
  g.R = { T: { w: 400, h: 300, img: 'ground', S, N: 32 }, S, N: 32,
    cam: { x: 0, y: 0 }, racers: [], pads: [], ramps: [{ i: 16, x: 100, y: 100, ang: .3 }],
    oils: [], mines: [], picks: [], shocks: [], scorch: [], shots: [], parts: [], floats: [] };
  g.drawRaceArena();
  assert(rotations.includes(-Math.PI / 2));
  const ramp = images.find(entry => entry.image.src && entry.image.src.endsWith('arena-ramp.png'));
  assert(ramp);
  assert.deepEqual(ramp.args, [-38, -42, 76, 84]);
});

test('Мост закрывает нижние машины независимо от цели камеры, включая метки и щиты', () => {
  const g=bootHub(), calls=[];
  g.g=new Proxy({}, {get(target,key){return target[key] || function(){};},set(target,key,value){target[key]=value;return true;}});
  g.g.drawImage=(img,...args)=>calls.push([img,...args]);
  g.DiVANEngine.render.drawFinishGateOverhead=()=>calls.push('finish overhead');
  Object.assign(g, { TAU:Math.PI*2, gt:0, settings:{graphics:{weather:false}},
    visW:()=>100,visH:()=>100,fillMapTileWorld:()=>{},drawYanotGuide:()=>{},drawFinishZone:()=>{},
    drawCar:(_q,r)=>calls.push(r.id),drawCarShield:(_q,r)=>calls.push(r.id+' shield'),
    drawPlayerRaceTag:(_q,r)=>calls.push(r.id+' tag'),racerDeck:r=>r.deck });
  const low={id:'under',y:90,deck:0,isP:true}, high={id:'over',y:10,deck:1};
  g.R={T:{w:400,h:300,img:'ground',imgHigh:'bridge',S:[],N:0},S:[],cam:{x:0,y:0},racers:[high,low]};
  for(const key of ['shocks','scorch','pads','ramps','oils','mines','picks','shots','parts','floats'])g.R[key]=[];
  for(const focus of [low,high,null]){
    g.R.pl=focus;calls.length=0;g.drawRaceArena();
    assert.deepEqual(calls,[['ground',0,0,400,300],'under','under shield','finish overhead','under tag',['bridge',0,0,400,300],'over','over shield']);
  }
  low.isP=false;high.isP=true;calls.length=0;g.drawRaceArena();
  assert.deepEqual(calls,[['ground',0,0,400,300],'under','under shield','finish overhead',['bridge',0,0,400,300],'over','over shield','over tag']);
});
