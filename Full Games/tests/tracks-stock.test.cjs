////////////////////////////////////////////////////////
//
// Сток: три развязки на каждый биом, эстакада на пересечении.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const TAU = Math.PI * 2;
const ROOT = path.resolve(__dirname, '../..');
const ENGINE = path.resolve(__dirname, '../src/engine');

/** Песочница каталога трасс и сплайна. */
function boot() {
  const g = {
    console,
    TAU,
    ROADW: 95,
    Image: function () {
      this.complete = false;
      this.naturalWidth = 0;
    },
    angDiff: function (a, b) {
      let d = (a - b) % TAU;
      if (d > Math.PI) d -= TAU;
      if (d < -Math.PI) d += TAU;
      return d;
    },
    mulberry: function () { return function () { return 0.5; }; },
    R: null,
    buildTrack: function () { return {}; },
    distToTrack: function () { return 0; },
    roadMaterial: function () { return 'asphalt'; },
    makePuddles: function () { return []; },
    inPuddle: function () { return false; },
    racerRoadMat: function () { return 'asphalt'; },
    wheelSprayKind: function () { return 'dust'; }
  };
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'tracks.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.join(ENGINE, 'runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.join(ENGINE, 'track.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.join(ENGINE, 'track-span.js'), 'utf8'), g);
  return g;
}

test('У каждого биома три стоковые развязки с эстакадой', () => {
  const g = boot();
  const stock = g.RnRTracks.STOCK;
  assert.equal(stock.length, 15);
  assert.equal(g.RnRTracks.THEMES.length, 5);
  const byMap = {};
  stock.forEach(function (t) {
    const id = t.theme.map || t.theme.deco || t.theme.id;
    byMap[id] = (byMap[id] || 0) + 1;
    assert.ok(t.cps.length >= 12);
    const T = g.buildTrack(t, 0);
    let high = false;
    for (let i = 0; i < T.N; i++) {
      if (g.trackDeck(T, i / T.N) > 0) { high = true; break; }
    }
    assert.equal(high, true, t.name);
  });
  assert.equal(byMap.sand, 3);
  assert.equal(byMap.garden, 3);
  assert.equal(byMap.desert, 3);
  assert.equal(byMap.snow, 3);
  assert.equal(byMap.lava, 3);
  assert.ok(stock.some(function (t) { return String(t.name).indexOf('ПЕРЕКРЁСТОК') >= 0; }));
  assert.ok(stock.some(function (t) { return String(t.name).indexOf('ВУЛКАН') >= 0; }));
  assert.ok(stock.some(function (t) { return String(t.name).indexOf('КРУШЕНИЕ') >= 0; }));
  assert.ok(stock.some(function (t) { return String(t.name).indexOf('ЛЕДЯН') >= 0; }));
  assert.ok(stock.some(function (t) { return String(t.name).indexOf('ОВАЛ') >= 0; }));
});

/** Enumerate true intersections without using the engine's detector. */
function intersections(T) {
  const hits=[];
  for(let i=0;i<T.N;i++)for(let j=i+16;j<T.N && T.N-(j-i)>=16;j++){
    const a=T.S[i],b=T.S[(i+1)%T.N],c=T.S[j],d=T.S[(j+1)%T.N];
    const ax=b.x-a.x,ay=b.y-a.y,bx=d.x-c.x,by=d.y-c.y,det=ax*by-ay*bx;
    if(Math.abs(det)<1e-6)continue;
    const dx=c.x-a.x,dy=c.y-a.y,u=(dx*by-dy*bx)/det,v=(dx*ay-dy*ax)/det;
    if(u>=0&&u<1&&v>=0&&v<1)hits.push([i,j]);
  }
  return hits;
}

test('В каждом реальном пересечении ровно одна верхняя дорога, включая карты лаборатории', () => {
  const g=boot();
  const custom=fs.readdirSync(path.join(ROOT,'assets/data/tracks')).filter(f=>/^custom_.*\.json$/.test(f))
    .map(f=>JSON.parse(fs.readFileSync(path.join(ROOT,'assets/data/tracks',f),'utf8')));
  for(const def of [...g.RnRTracks.STOCK,...custom]){
    const T=g.buildTrack(def,0);
    for(const [i,j] of intersections(T)){
      assert.notEqual(g.trackDeck(T,i/T.N),g.trackDeck(T,j/T.N),def.name+' crossing '+i+'/'+j);
    }
  }
});
