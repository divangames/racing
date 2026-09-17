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
    fs.writeFileSync(path.join(root, 'assets', 'image', 'textures', 'map', 'sand', '02.webp'), 'stock-2');
    fs.mkdirSync(path.join(root, 'assets', 'image', 'textures', 'map', 'garden'), { recursive: true });
    fs.writeFileSync(path.join(root, 'assets', 'image', 'textures', 'map', 'garden', '01.webp'), 'g1');
    fs.writeFileSync(path.join(root, 'assets', 'image', 'textures', 'map', 'garden', '03.webp'), 'g3');
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
    assert.equal(sand.tiles.join(','), 'assets/data/tracks/Textures/biomes/sand/01.png');
    const garden = list.biomes.find((b) => b.id === 'garden');
    assert.equal(garden.stock, true);
    assert.equal(
      garden.tiles.join(','),
      'assets/image/textures/map/garden/01.webp,assets/image/textures/map/garden/03.webp'
    );
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

test('Дорога и борта принимаются байтами без Base64 и двойного расширения', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rnr-tex-file-'));
  try {
    const api = handler(root);
    const railUrl = new URL('http://localhost/__save-texture-file?kind=rail&id=Bort_01.png&ext=png');
    const rail = await api.handleSaveTextureFile(new Request(railUrl, {
      method: 'POST',
      headers: {'content-type': 'image/png'},
      body: Buffer.from('rail-bytes')
    }), railUrl);
    assert.equal(rail.status, 200);
    const railBody = await rail.json();
    assert.equal(railBody.src, 'assets/data/tracks/Textures/rails/bort_01.png');
    assert.equal(fs.readFileSync(path.join(root, railBody.src), 'utf8'), 'rail-bytes');

    const roadUrl = new URL('http://localhost/__save-texture-file?kind=road&id=Road_Asphalt.webp&ext=webp');
    const road = await api.handleSaveTextureFile(new Request(roadUrl, {
      method: 'POST',
      headers: {'content-type': 'image/webp'},
      body: Buffer.from('road-bytes')
    }), roadUrl);
    assert.equal(road.status, 200);
    const roadBody = await road.json();
    assert.equal(roadBody.src, 'assets/data/tracks/Textures/road/road_asphalt.webp');
    assert.equal(api.listTextures().roads[0].id, 'road_asphalt');

    const replaceUrl = new URL('http://localhost/__save-texture-file?kind=road&id=road_asphalt&ext=png');
    const replaced = await api.handleSaveTextureFile(new Request(replaceUrl, {
      method: 'POST', body: Buffer.from('replacement-road')
    }), replaceUrl);
    assert.equal(replaced.status, 200);
    assert.equal(fs.existsSync(path.join(root, 'assets/data/tracks/Textures/road/road_asphalt.webp')), false);
    assert.equal(fs.readFileSync(path.join(root, 'assets/data/tracks/Textures/road/road_asphalt.png'), 'utf8'), 'replacement-road');
    assert.equal(api.listTextures().roads.filter((item) => item.id === 'road_asphalt').length, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
