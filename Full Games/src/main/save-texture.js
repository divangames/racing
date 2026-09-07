////////////////////////////////////////////////////////
//
// Каталог и запись текстур трассы (земля, дорога, объекты).
//
////////////////////////////////////////////////////////

'use strict';

const fs = require('fs');
const path = require('path');
const { contentRoot } = require('./paths');

const ID_RE = /^[a-z0-9_]{2,32}$/;
const EXT_OK = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif']);

/**
 * Корень библиотеки.
 * @returns {string}
 */
function texRoot() {
  return path.join(contentRoot(), 'assets', 'data', 'tracks', 'Textures');
}

/**
 * Стоковые биомы карты.
 * @returns {string}
 */
function stockRoot() {
  return path.join(contentRoot(), 'assets', 'image', 'textures', 'map');
}

/**
 * Первый кадр в папке.
 * @param {string} folder
 * @returns {string|null}
 */
function firstImage(folder) {
  if (!fs.existsSync(folder)) return null;
  const names = fs.readdirSync(folder).filter((n) => EXT_OK.has(path.extname(n).slice(1).toLowerCase()));
  names.sort((a, b) => a.localeCompare(b, 'en', {numeric: true}));
  return names[0] || null;
}

/**
 * Каталог для редактора.
 * @returns {{biomes: object[], roads: object[], objects: object[]}}
 */
function listTextures() {
  const biomes = [];
  const stock = stockRoot();
  if (fs.existsSync(stock)) {
    fs.readdirSync(stock).forEach((id) => {
      const folder = path.join(stock, id);
      if (!fs.statSync(folder).isDirectory()) return;
      const file = firstImage(folder);
      if (!file) return;
      biomes.push({id, src: 'assets/image/textures/map/' + id + '/' + file, stock: true});
    });
  }
  const custom = path.join(texRoot(), 'biomes');
  if (fs.existsSync(custom)) {
    fs.readdirSync(custom).forEach((id) => {
      const folder = path.join(custom, id);
      if (!fs.statSync(folder).isDirectory()) return;
      const file = firstImage(folder);
      if (!file) return;
      biomes.push({id, src: 'assets/data/tracks/Textures/biomes/' + id + '/' + file, stock: false});
    });
  }
  const pack = (kind) => {
    const folder = path.join(texRoot(), kind);
    if (!fs.existsSync(folder)) return [];
    return fs.readdirSync(folder).filter((n) => EXT_OK.has(path.extname(n).slice(1).toLowerCase())).map((n) => ({
      id: path.basename(n, path.extname(n)),
      src: 'assets/data/tracks/Textures/' + kind + '/' + n
    }));
  };
  return {biomes, roads: pack('road'), objects: pack('objects')};
}

/**
 * GET /__track-textures.
 * @returns {Response}
 */
function handleListTextures() {
  return new Response(JSON.stringify(listTextures()), {
    status: 200,
    headers: {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'}
  });
}

/**
 * POST /__save-texture.
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function handleSaveTexture(request) {
  let data;
  try {
    const raw = await request.text();
    if (!raw || raw.length > 8_000_000) return new Response('Too large', {status: 400});
    data = JSON.parse(raw);
  } catch (err) {
    return new Response('Bad request', {status: 400});
  }
  const kind = data.kind;
  const dest = data.dest || 'library';
  const id = typeof data.id === 'string' ? data.id : '';
  const ext = String(data.ext || 'png').toLowerCase().replace('jpeg', 'jpg');
  const payload = String(data.data || '');
  if (!ID_RE.test(id) || !EXT_OK.has(ext) || payload.indexOf('base64,') < 0) {
    return new Response('Bad request', {status: 400});
  }
  const buf = Buffer.from(payload.split('base64,')[1], 'base64');
  if (!buf.length) return new Response('Bad request', {status: 400});
  let rel;
  if (kind === 'ground' && dest === 'current') {
    const stockDir = path.join(stockRoot(), id);
    if (fs.existsSync(stockDir) && fs.statSync(stockDir).isDirectory()) {
      rel = 'assets/image/textures/map/' + id + '/lab.' + ext;
      fs.writeFileSync(path.join(contentRoot(), rel), buf);
    } else {
      const folder = path.join(texRoot(), 'biomes', id);
      fs.mkdirSync(folder, {recursive: true});
      rel = 'assets/data/tracks/Textures/biomes/' + id + '/01.' + ext;
      fs.writeFileSync(path.join(contentRoot(), rel), buf);
    }
  } else if (kind === 'ground') {
    const folder = path.join(texRoot(), 'biomes', id);
    fs.mkdirSync(folder, {recursive: true});
    rel = 'assets/data/tracks/Textures/biomes/' + id + '/01.' + ext;
    fs.writeFileSync(path.join(contentRoot(), rel), buf);
  } else if (kind === 'road') {
    const folder = path.join(texRoot(), 'road');
    fs.mkdirSync(folder, {recursive: true});
    rel = 'assets/data/tracks/Textures/road/' + id + '.' + ext;
    fs.writeFileSync(path.join(contentRoot(), rel), buf);
  } else if (kind === 'object') {
    const folder = path.join(texRoot(), 'objects');
    fs.mkdirSync(folder, {recursive: true});
    rel = 'assets/data/tracks/Textures/objects/' + id + '.' + ext;
    fs.writeFileSync(path.join(contentRoot(), rel), buf);
  } else {
    return new Response('Bad request', {status: 400});
  }
  return new Response(JSON.stringify({ok: true, src: rel.replace(/\\/g, '/'), id}), {
    status: 200,
    headers: {'content-type': 'application/json; charset=utf-8'}
  });
}

module.exports = {handleListTextures, handleSaveTexture, listTextures};
