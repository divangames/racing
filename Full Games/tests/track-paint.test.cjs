////////////////////////////////////////////////////////
//
// Запекание полотна и тайлов земли без GPU.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { enhanceHtml, engineFile } = require('../src/main/enhancements');

/** Заглушка Path2D. */
function FakePath() {}
FakePath.prototype.moveTo = function () {};
FakePath.prototype.lineTo = function () {};
FakePath.prototype.closePath = function () {};

/** Контекст 2D с журналом вызовов. */
function fakeCtx() {
  const calls = [];
  const rects = [];
  return {
    calls: calls,
    rects: rects,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineJoin: '',
    lineCap: '',
    globalAlpha: 1,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: '',
    fillRect: function (...args) { calls.push('fillRect'); rects.push(args); },
    stroke: function () { calls.push('stroke'); },
    beginPath: function () {},
    moveTo: function () {},
    lineTo: function () {},
    closePath: function () {},
    save: function () {},
    restore: function () {},
    translate: function () {},
    rotate: function () {},
    scale: function () { calls.push('scale'); },
    transform: function () { calls.push('transform'); },
    clip: function () { calls.push('clip'); },
    fill: function () {},
    arc: function () {},
    ellipse: function () {},
    setLineDash: function () {},
    quadraticCurveTo: function () {},
    createPattern: function () { return null; },
    drawImage: function () { calls.push('drawImage'); }
  };
}

/** Песочница запекания. */
function bootPaint() {
  function makeCanvas() {
    const ctx = fakeCtx();
    return { width: 0, height: 0, getContext: function () { return ctx; }, _ctx: ctx };
  }
  const g2d = fakeCtx();
  const g = {
    console,
    TAU: Math.PI * 2,
    ROADW: 95,
    MAP_TILE_CELL: 64,
    MAP_TILE_CACHE: 512,
    MAP_TILES: {},
    MAP_BIOME_SCALE: {},
    ROAD_MATERIALS: { asphalt: { road: '#43404b' }, ice: { road: '#72b8d1' } },
    Path2D: FakePath,
    document: { createElement: function (tag) { return tag === 'canvas' ? makeCanvas() : {}; } },
    g: g2d,
    mulberry: function () { return function () { return 0.5; }; },
    distToTrack: function () { return 999; },
    roadMaterial: function () { return 'asphalt'; },
    mapTileList: function () { return []; },
    pickMapTile: function () { return null; },
    bakeMapTile: function () { return {}; },
    fillMapTileWorld: function () {},
    labPolygonCps: function () { return []; },
    prerenderLabTrack: function () { return {}; },
    prerender: function () { return {}; }
  };
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/track-strip.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/track-ribbon.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/track-ribbon-deck.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/track-paint.js'), 'utf8'), g);
  return g;
}

/** Минимальный сплайн для пререндера. */
function miniTrack(lab) {
  return {
    lab: !!lab,
    w: 400,
    h: 400,
    idx: 0,
    theme: { ground: '#161616', dark: '#121212', road: '#3d3d42', line: '#3d9eff', deco: 'rock' },
    S: [
      { x: 80, y: 80, nx: 0, ny: 1, ang: 0, k: 0 },
      { x: 220, y: 80, nx: 0, ny: 1, ang: 0, k: 0.02 },
      { x: 220, y: 220, nx: -1, ny: 0, ang: 1, k: 0 },
      { x: 80, y: 220, nx: 0, ny: -1, ang: 2, k: 0 }
    ]
  };
}

test('Заезд подключает track-paint после сплайна', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/track-paint.js'));
  assert(out.includes('/__engine/track-ribbon.js'));
  assert(out.includes('/__engine/track-ribbon-deck.js'));
  assert(out.includes('/__engine/track-strip.js'));
  assert(out.indexOf('track.js') < out.indexOf('track-strip.js'));
  assert(out.indexOf('track-span.js') < out.indexOf('track-ribbon.js'));
  assert(out.indexOf('track-strip.js') < out.indexOf('track-ribbon.js'));
  assert(out.indexOf('track-ribbon.js') < out.indexOf('track-ribbon-deck.js'));
  assert(out.indexOf('track-ribbon-deck.js') < out.indexOf('track-paint.js'));
  assert(out.indexOf('track-paint.js') < out.indexOf('collision.js'));
  assert(engineFile('__engine/track-paint.js').endsWith('track-paint.js'));
  const strip = fs.readFileSync(path.resolve(__dirname, '../src/engine/track-strip.js'), 'utf8');
  assert(strip.includes('function mulberry32'));
  assert(!strip.includes('typeof mulberry === \'function\''));
});

test('Тайл, полигон, запекание лаборатории и земли', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../content/rnr.html'), 'utf8');
  assert(html.includes('function prerender('));
  assert(html.includes('function bakeMapTile('));
  const g = bootPaint();
  const live = { complete: true, naturalWidth: 8 };
  g.MAP_TILES.sand = [live, { complete: false, naturalWidth: 0 }];
  assert.equal(g.mapTileList('sand').length, 1);
  assert.equal(g.pickMapTile('sand'), live);
  assert.equal(g.pickMapTile('missing'), null);
  const pts = g.labPolygonCps();
  assert(pts.length > 20);
  assert(Number.isFinite(pts[0][0]));
  const bake = g.bakeMapTile(live);
  assert.equal(bake.width, 512);
  assert(bake._ctx.calls.includes('drawImage'));
  const lab = miniTrack(true);
  const cLab = g.prerender(lab);
  assert.equal(lab.mapTile, null);
  assert(cLab._ctx.calls.includes('stroke'));
  const world = miniTrack(false);
  const cWorld = g.prerender(world);
  assert(cWorld._ctx.calls.includes('fillRect'));
  assert(cWorld._ctx.calls.includes('drawImage'));
  assert(!cWorld._ctx.rects.some(([x, y, w, h]) => x === -24 && y === -96 && w === 12 && h === 12), 'старая ровная шашка не должна запекаться под новым финишем');
  assert(g.DiVANEngine.trackRibbon);
  g.fillMapTileWorld(0, 0, 10, 10, { theme: { ground: '#abc' } });
  assert(g.g.calls.includes('fillRect'));
  g.g.calls.length = 0;
  g.fillMapTileWorld(0, 0, 10, 10, {
    pat: {},
    mapBake: { width: 64 },
    theme: { groundScale: 2, map: 'sand' }
  });
  assert(g.g.calls.includes('scale'));
});

test('Запекание сохраняет детали зума и ограничивает суммарную память этажей', () => {
  const g=bootPaint(), make=g.DiVANEngine.trackPaint.createTrackCanvas;
  const small=make({w:400,h:300},2);
  assert.equal(small.width,1200);assert.equal(small.height,900);
  const large=make({w:6000,h:4000},2);
  assert(large.width<=8192 && large.height<=8192);
  assert(large.width*large.height*2<=48*1024*1024);
  assert(Math.abs(large.width/large.height-1.5)<.001);
});

test('Покрытие наносится после всей базы, а текстуры сохраняют мировой масштаб', () => {
  const g=bootPaint(), q=fakeCtx(), events=[];
  q.fill=()=>events.push('base');q.stroke=()=>events.push('base');
  q.drawImage=()=>events.push('texture');
  g.DiVANEngine.trackRibbon.paintRoadBody(q,miniTrack(false),95,0);
  assert(events.indexOf('texture')>0);
  assert(!events.slice(events.indexOf('texture')).includes('base'));
  const strip=g.DiVANEngine.trackStrip.bakeRoadStrip('asphalt','#333333');
  assert.equal(strip.width/strip.worldWidth,3);
  const transforms=[];
  q.transform=(...args)=>transforms.push(args);
  g.DiVANEngine.trackRibbon.blitSeg(q,{x:0,y:0,nx:0,ny:1},{x:20,y:0,nx:0,ny:1},strip,95,505);
  assert(transforms.length>=4,'UV wrap must render both sides of the repeat');
  assert(transforms.flat().every(Number.isFinite));
  q.calls.length=0;
  g.DiVANEngine.trackRibbon.blitSeg(q,{x:0,y:0,nx:0,ny:1},{x:20,y:0,nx:0,ny:1},strip,9,0,true);
  assert(q.calls.includes('scale'),'вторая сторона борта должна отражаться поперёк ленты');
});

test('Пользовательский борт тонкий, пропорциональный и запекается с запасом качества', () => {
  const g=bootPaint();
  const original={width:934,height:108};
  const strip=g.DiVANEngine.trackRibbon.compactStrip(original,64);
  assert.equal(strip.height,64);
  assert.equal(strip.width,Math.round(original.width/original.height*strip.height));
  assert(strip.width<original.width);
  assert.equal(strip.worldWidth,undefined,'отдельный горизонтальный масштаб искажает пропорции');
  assert(strip._ctx.calls.includes('drawImage'));
  const source=fs.readFileSync(path.resolve(__dirname,'../src/engine/track-ribbon-deck.js'),'utf8');
  assert(source.includes('MAX_SMOOTH_SAMPLES'));
  assert(source.includes('CUSTOM_RAIL_HEIGHT_SCALE = 0.5'));
  assert(source.includes('CUSTOM_RAIL_TEXTURE_SUPERSAMPLE = 4'));
});
