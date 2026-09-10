////////////////////////////////////////////////////////
//
// Догрузка лиц гонщиков DiVANEngine.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { enhanceHtml, engineFile } = require('../src/main/enhancements');

/** Песочница лиц с поддельным Image. */
function bootFaces() {
  function FakeImage() {
    this.complete = false;
    this.naturalWidth = 0;
    this._src = '';
  }
  Object.defineProperty(FakeImage.prototype, 'src', {
    get: function () { return this._src || ''; },
    set: function (v) {
      this._src = v;
      this.complete = true;
      this.naturalWidth = 12;
      if (typeof this.onload === 'function') this.onload();
    }
  });
  const ch = { name: 'МЕДВЕДЬ' };
  const slot = { complete: false, naturalWidth: 0, src: '' };
  const g = {
    console,
    Image: FakeImage,
    CHARS: [ch],
    AVATARS: [slot],
    FULLBODIES: [slot],
    playerImgUrls: function (i, suffix) {
      return ['assets/data/players/01/01_Player' + (suffix || '') + '.webp'];
    },
    kickPlayerImg: function () {},
    avatarImage: function () { return null; },
    fullbodyImage: function () { return null; }
  };
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/faces.js'), 'utf8'), g);
  return { g, ch, slot };
}

test('Заезд подключает лица до арены', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/faces.js'));
  assert(out.indexOf('vfx.js') < out.indexOf('faces.js'));
  assert(out.indexOf('faces.js') < out.indexOf('arena.js'));
  assert(engineFile('__engine/faces.js').endsWith('faces.js'));
});

test('Слот готов или догрузка webp из папки гонщика', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../rnr.html'), 'utf8');
  const chars = fs.readFileSync(path.resolve(__dirname, '../../chars.js'), 'utf8');
  assert(html.includes('function avatarImage('));
  assert(html.includes('function kickPlayerImg('));
  assert(chars.includes('assets/data/players/'));
  const { g, ch, slot } = bootFaces();
  const faces = g.DiVANEngine.faces;
  assert.equal(faces.spriteReady(null), false);
  assert.equal(faces.spriteReady({ complete: true, naturalWidth: 0 }), false);
  assert.equal(faces.spriteReady({ complete: true, naturalWidth: 8 }), true);
  assert.equal(g.avatarImage(ch), null);
  assert.equal(slot._kick, true);
  assert.equal(slot.src, 'assets/data/players/01/01_Player.webp');
  g.kickPlayerImg(slot, 0, '');
  assert.equal(slot.src, 'assets/data/players/01/01_Player.webp');
});
