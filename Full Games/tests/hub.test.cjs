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
function bootHub() {
  const g = {
    console,
    drawGarage: function () {},
    drawResults: function () {},
    drawRaceArena: function () {}
  };
  g.window = g;
  g.globalThis = g;
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
});

test('Мост закрывает нижние машины независимо от цели камеры, включая метки и щиты', () => {
  const g=bootHub(), calls=[];
  g.g=new Proxy({}, {get(target,key){return target[key] || function(){};},set(target,key,value){target[key]=value;return true;}});
  g.g.drawImage=(img,...args)=>calls.push([img,...args]);
  Object.assign(g, { TAU:Math.PI*2, gt:0, settings:{graphics:{weather:false}},
    visW:()=>100,visH:()=>100,fillMapTileWorld:()=>{},drawYanotGuide:()=>{},drawFinishZone:()=>{},
    drawCar:(_q,r)=>calls.push(r.id),drawCarShield:(_q,r)=>calls.push(r.id+' shield'),
    drawPlayerRaceTag:(_q,r)=>calls.push(r.id+' tag'),racerDeck:r=>r.deck });
  const low={id:'under',y:90,deck:0,isP:true}, high={id:'over',y:10,deck:1};
  g.R={T:{w:400,h:300,img:'ground',imgHigh:'bridge',S:[],N:0},S:[],cam:{x:0,y:0},racers:[high,low]};
  for(const key of ['shocks','scorch','pads','ramps','oils','mines','picks','shots','parts','floats'])g.R[key]=[];
  for(const focus of [low,high,null]){
    g.R.pl=focus;calls.length=0;g.drawRaceArena();
    assert.deepEqual(calls,[['ground',0,0,400,300],'under','under shield','under tag',['bridge',0,0,400,300],'over','over shield']);
  }
});
