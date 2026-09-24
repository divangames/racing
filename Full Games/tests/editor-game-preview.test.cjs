'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { enhanceHtml, engineFile } = require('../src/main/enhancements');

test('Редактор подключает общую графику финиша после своих модулей', () => {
  const html = enhanceHtml('<body><script src="editor/map-view.js"></script></body>', { pathname: '/Editor.html' });
  assert(html.indexOf('editor/map-view.js') < html.indexOf('/__engine/finish-gate.js'));
  assert(html.indexOf('/__engine/finish-gate.js') < html.indexOf('/__engine/editor/game-preview.js'));
  assert(html.indexOf('/__engine/arena-effects.js') < html.indexOf('/__engine/editor/game-preview.js'));
  assert(engineFile('__engine/editor/game-preview.js'));
  assert(engineFile('__engine/editor/game-preview.css'));
});

test('Предпросмотр использует реальные спрайты, поворот трамплина и арт финиша', () => {
  const calls = [];
  let tick;
  const context = {
    console, Math, performance: { now: () => 1000 },
    __DIVAN_ENGINE_META__: { host: 'lab' },
    document: { getElementById: () => null, visibilityState: 'visible' },
    setInterval(callback) { tick = callback; },
    Image: class {
      constructor() { this.complete = true; this.naturalWidth = 1254; this.naturalHeight = 1254; }
    }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(`
    const MapMarks = { drawAll() {}, drawRamp() {}, drawStart() {} };
    const MapPreview = { ROADW: 95, drawItem() {} };
    const MapLayout = { visible() { return { ramps: [{ x: 100, y: 100, ang: 0 }], pads: [{ x: 100, y: 100, cool: 0 }] }; } };
    const MapView = {
      draw() {}, _selection: null, _tool: 'select',
      selection() { return this._selection; }, setSelection(value) { this._selection = value; },
      tool() { return this._tool; }, setTool(value) { this._tool = value; }
    };
    const MapApp = { mapOn() { return false; } };
    window.MapAssets = { packId() { return 'none'; }, paint() {} };
  `, context);
  for (const file of ['finish-gate.js', 'arena-effects.js', 'editor/game-preview.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/engine', file), 'utf8'), context);
  }
  assert(context.MapGamePreview);
  const canvas = new Proxy({}, {
    get(target, key) { return target[key] || ((...args) => {
      calls.push([key, ...args]);
      if (key === 'createRadialGradient') return { addColorStop: (...values) => calls.push(['addColorStop', ...values]) };
    }); },
    set(target, key, value) { target[key] = value; return true; }
  });
  context.canvas = canvas;
  vm.runInContext(`
    MapMarks.drawAll(canvas, {
      start: { x: 0, y: 0, ang: 0 },
      hazards: {
        ramps: [{ x: 100, y: 100, ang: .3 }],
        mines: [{ x: 130, y: 100 }], oils: [{ x: 160, y: 100, rot: .4 }],
        pads: [{ x: 190, y: 100, ang: .3 }]
      }, shortcuts: []
    }, null, 1000, null);
    MapPreview.drawItem(canvas, { type: 'wrench', x: 200, y: 200 }, 1);
  `, context);
  const sources = calls.filter(call => call[0] === 'drawImage').map(call => call[1].src);
  for (const name of ['finish-tower.png', 'arena-ramp.png', 'arena-mine.png', 'arena-oil.png', 'arena-pad.png', 'arena-wrench.png']) {
    assert(sources.some(source => source.endsWith(name)), name);
  }
  assert(calls.some(call => call[0] === 'rotate' && Math.abs(call[1] - (.3 - Math.PI / 2)) < 1e-9));
  assert(calls.some(call => call[0] === 'fill' && call[1] === 'evenodd'));
  assert(calls.some(call => call[0] === 'createRadialGradient'));
  const visible = vm.runInContext('MapLayout.visible({}, [])', context);
  assert.equal(visible.pads.length, 1);
  assert(Math.hypot(visible.pads[0].x - visible.ramps[0].x, visible.pads[0].y - visible.ramps[0].y) >= 85);

  class Element {
    constructor() {
      this.children = []; this.dataset = {}; this.className = ''; this.title = '';
      this.classList = { toggle() {} };
    }
    appendChild(child) { this.children.push(child); return child; }
    append(...children) { this.children.push(...children); }
    setAttribute(name, value) { this[name] = value; }
    getContext() { return canvas; }
    querySelector(selector) {
      if (selector === '.cb-thumb-item') return this.children.find(child => child.className === 'cb-thumb cb-thumb-item') || null;
      if (selector === 'img') return this.children.find(child => child.tag === 'img') || null;
      if (selector === 'canvas') return this.children.find(child => child.tag === 'canvas') || null;
      const type = /data-game-preview="([^"]+)"/.exec(selector)?.[1];
      return type ? this.children.find(child => child.dataset.gamePreview === type) || null : null;
    }
    querySelectorAll(selector) {
      if (selector === '.cb-tile:not(.game-preview-extra)') return this.children.filter(child => child.className === 'cb-tile');
      if (selector === '.cb-tile') return this.children.filter(child => child.className.includes('cb-tile'));
      return [];
    }
  }
  const grid = new Element(), tile = new Element(), thumb = new Element(), toolbar = new Element(), count = {};
  tile.className = 'cb-tile'; tile.title = 'Деньги'; thumb.className = 'cb-thumb cb-thumb-item';
  tile.appendChild(thumb); grid.appendChild(tile);
  context.RnRTracks = { ITEMS: [{ id: 'money', name: 'Деньги' }] };
  context.MapAssets.packId = () => 'items';
  context.document = {
    visibilityState: 'visible',
    createElement(tag) { const el = new Element(); el.tag = tag; return el; },
    getElementById(id) { return { assetDockRow: grid, assetSearch: { value: '' }, assetCount: count }[id] || null; },
    querySelector(selector) {
      if (selector === '.stage-tools') return toolbar;
      const type = /data-game-preview="([^"]+)"/.exec(selector)?.[1];
      const found = type && grid.querySelector('[data-game-preview="' + type + '"]');
      return found && selector.endsWith(' canvas') ? found.children[0].children[0] : found || null;
    }
  };
  context.MapGamePreview.updateCards();
  assert.equal(thumb.querySelector('canvas').className, 'game-preview-item');
  assert.equal(grid.querySelectorAll('.cb-tile').length, 6);
  const finishCard = grid.querySelector('[data-game-preview="finish"]');
  assert(finishCard);
  assert.equal(finishCard.children[0].children[0].tag, 'canvas');
  assert.equal(grid.querySelector('[data-game-preview="pad"]').children[0].children[0].tag, 'canvas');
  assert.equal(grid.querySelector('[data-game-preview="mine"]').children[0].children[0].tag, 'canvas');
  assert.equal(count.textContent, '6 шт.');
  calls.length = 0;
  tick();
  assert(calls.some(call => call[0] === 'createRadialGradient'));
  assert(calls.some(call => call[0] === 'drawImage' && call[1].src.endsWith('arena-money.png')));
  vm.runInContext('MapView.setSelection({ kind: "ramp", i: 0 })', context);
  context.MapGamePreview.installPreviewToggle();
  const toggle = toolbar.children[0];
  assert.equal(toggle.textContent, 'Чистый просмотр');
  toggle.onclick();
  assert.equal(vm.runInContext('MapView.selection()', context), null);
  assert.equal(vm.runInContext('MapView.tool()', context), 'pan');
  toggle.onclick();
  assert.equal(vm.runInContext('MapView.selection().kind', context), 'ramp');
  assert.equal(vm.runInContext('MapView.tool()', context), 'select');
});
