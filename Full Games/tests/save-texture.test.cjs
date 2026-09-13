////////////////////////////////////////////////////////
//
// Земля трассы: папка проекта перекрывает сток, meta.json — масштаб.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

/** Обработчик текстур с изолированным корнем. */
function handler(root) {
  const file = path.resolve(__dirname, '../src/main/save-texture.js');
  const realRequire = createRequire(file);
  const module = { exports: {} };
  const context = {
    module,
    exports: module.exports,
    Response,
    Buffer,
    console,
    require: (id) => (id === './paths' ? { contentRoot: () => root } : realRequire(id))
  };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  return module.exports;
}

test('Земля пишется в Textures/biomes и перекрывает сток', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rnr-tex-'));
  try {
    fs.mkdirSync(path.join(root, 'assets', 'image', 'textures', 'map', 'sand'), { recursive: true });
    fs.writeFileSync(path.join(root, 'assets', 'image', 'textures', 'map', 'sand', '01.webp'), 'stock');
    const api = handler(root);
    const png = 'data:image/png;base64,' + Buffer.from('lab-ground').toString('base64');
    const res = await api.handleSaveTexture(new Request('http://localhost/', {
      method: 'POST',
      body: JSON.stringify({ kind: 'ground', id: 'sand', ext: 'png', data: png })
    }));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.src, 'assets/data/tracks/Textures/biomes/sand/01.png');
    assert.equal(
      fs.readFileSync(path.join(root, 'assets', 'data', 'tracks', 'Textures', 'biomes', 'sand', '01.png'), 'utf8'),
      'lab-ground'
    );
    const meta = await api.handleSaveTexture(new Request('http://localhost/', {
      method: 'POST',
      body: JSON.stringify({ kind: 'meta', id: 'sand', scale: 1.5 })
    }));
    assert.equal(meta.status, 200);
    const list = api.listTextures();
    const sand = list.biomes.find((b) => b.id === 'sand');
    assert.equal(sand.stock, false);
    assert.equal(sand.src, 'assets/data/tracks/Textures/biomes/sand/01.png');
    assert.equal(sand.scale, 1.5);
    const railPng = 'data:image/png;base64,' + Buffer.from('lab-rail').toString('base64');
    const rail = await api.handleSaveTexture(new Request('http://localhost/', {
      method: 'POST',
      body: JSON.stringify({ kind: 'rail', id: 'rust_bar', ext: 'png', data: railPng })
    }));
    assert.equal(rail.status, 200);
    const railBody = await rail.json();
    assert.equal(railBody.src, 'assets/data/tracks/Textures/rails/rust_bar.png');
    assert.equal(api.listTextures().rails[0].id, 'rust_bar');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
