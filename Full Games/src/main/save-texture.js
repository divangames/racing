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
const MAX_TEXTURE_BYTES = 32 * 1024 * 1024;

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
 * Кадры биома по имени: 01, затем 02…
 * @param {string} folder
 * @returns {string[]}
 */
function folderImages(folder) {
  if (!fs.existsSync(folder)) return [];
  const names = fs.readdirSync(folder).filter((n) => EXT_OK.has(path.extname(n).slice(1).toLowerCase()));
  names.sort((a, b) => a.localeCompare(b, 'en', {numeric: true}));
  const preferred = names.find((n) => /^01\./i.test(n));
  if (!preferred) return names;
  return [preferred].concat(names.filter((n) => n !== preferred));
}

/**
 * Первый кадр в папке.
 * @param {string} folder
 * @returns {string|null}
 */
function firstImage(folder) {
  return folderImages(folder)[0] || null;
}

/**
 * Масштаб клетки фона из meta.json лаборатории.
 * @param {string} folder
 * @returns {number}
 */
function readScale(folder) {
  const file = path.join(folder, 'meta.json');
  if (!fs.existsSync(file)) return 1;
  try {
    const n = +JSON.parse(fs.readFileSync(file, 'utf8')).scale;
    return Number.isFinite(n) ? Math.max(0.25, Math.min(4, n)) : 1;
  } catch (err) {
    return 1;
  }
}

/**
 * Пишет 01.* и убирает другой формат той же клетки.
 * @param {string} folder
 * @param {string} ext
 * @param {Buffer} buf
 */
function writeBiomeImage(folder, ext, buf) {
  fs.mkdirSync(folder, {recursive: true});
  ['png', 'jpg', 'jpeg', 'webp', 'gif'].forEach((old) => {
    if (old === ext) return;
    const stale = path.join(folder, '01.' + old);
    if (fs.existsSync(stale)) fs.unlinkSync(stale);
  });
  fs.writeFileSync(path.join(folder, '01.' + ext), buf);
}

/**
 * Нормализует имя файла библиотеки без повторного расширения в id.
 * @param {string} value
 * @returns {string}
 */
function textureId(value) {
  const base = path.basename(String(value || ''), path.extname(String(value || '')));
  return base.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '').slice(0, 32);
}

/**
 * Записывает байты текстуры и возвращает её игровой путь.
 * @param {string} kind
 * @param {string} id
 * @param {string} ext
 * @param {Buffer} buf
 * @returns {{ok: boolean, src: string, id: string}}
 */
function writeTexture(kind, id, ext, buf) {
  if (!ID_RE.test(id) || !EXT_OK.has(ext) || !Buffer.isBuffer(buf) || !buf.length || buf.length > MAX_TEXTURE_BYTES) {
    throw new Error('Bad texture');
  }
  let rel;
  if (kind === 'ground') {
    const folder = path.join(texRoot(), 'biomes', id);
    writeBiomeImage(folder, ext, buf);
    rel = 'assets/data/tracks/Textures/biomes/' + id + '/01.' + ext;
  } else if (kind === 'road' || kind === 'rail') {
    const dir = kind === 'rail' ? 'rails' : 'road';
    const folder = path.join(texRoot(), dir);
    fs.mkdirSync(folder, {recursive: true});
    // Замена должна оставлять в каталоге ровно один файл этого id, даже если
    // новый вариант загружен в другом формате.
    EXT_OK.forEach((old) => {
      if (old === ext) return;
      const stale = path.join(folder, id + '.' + old);
      if (fs.existsSync(stale)) fs.unlinkSync(stale);
    });
    rel = 'assets/data/tracks/Textures/' + dir + '/' + id + '.' + ext;
    fs.writeFileSync(path.join(contentRoot(), rel), buf);
  } else if (kind === 'object') {
    const folder = path.join(texRoot(), 'objects');
    fs.mkdirSync(folder, {recursive: true});
    rel = 'assets/data/tracks/Textures/objects/' + id + '.' + ext;
    fs.writeFileSync(path.join(contentRoot(), rel), buf);
  } else {
    throw new Error('Bad texture kind');
  }
  return {ok: true, src: rel.replace(/\\/g, '/'), id};
}

/**
 * Каталог для редактора.
 * @returns {{biomes: object[], roads: object[], rails: object[], objects: object[]}}
 */
function listTextures() {
  const byId = Object.create(null);
  const stock = stockRoot();
  if (fs.existsSync(stock)) {
    fs.readdirSync(stock).forEach((id) => {
      const folder = path.join(stock, id);
      if (!fs.statSync(folder).isDirectory()) return;
      const files = folderImages(folder);
      if (!files.length) return;
      const rel = 'assets/image/textures/map/' + id + '/';
      byId[id] = {
        id,
        src: rel + files[0],
        tiles: files.map((file) => rel + file),
        stock: true,
        scale: readScale(path.join(texRoot(), 'biomes', id))
      };
    });
  }
  const custom = path.join(texRoot(), 'biomes');
  if (fs.existsSync(custom)) {
    fs.readdirSync(custom).forEach((id) => {
      const folder = path.join(custom, id);
      if (!fs.statSync(folder).isDirectory()) return;
      const files = folderImages(folder);
      if (!files.length) return;
      const rel = 'assets/data/tracks/Textures/biomes/' + id + '/';
      byId[id] = {
        id,
        src: rel + files[0],
        tiles: files.map((file) => rel + file),
        stock: false,
        scale: readScale(folder)
      };
    });
  }
  const biomes = Object.keys(byId).sort().map((id) => byId[id]);
  const pack = (kind) => {
    const folder = path.join(texRoot(), kind);
    if (!fs.existsSync(folder)) return [];
    return fs.readdirSync(folder).filter((n) => EXT_OK.has(path.extname(n).slice(1).toLowerCase())).map((n) => ({
      id: path.basename(n, path.extname(n)),
      src: 'assets/data/tracks/Textures/' + kind + '/' + n
    }));
  };
  return {biomes, roads: pack('road'), rails: pack('rails'), objects: pack('objects')};
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
  const id = textureId(typeof data.id === 'string' ? data.id : '');
  if (!ID_RE.test(id)) return new Response('Bad request', {status: 400});
  if (kind === 'meta') {
    const scale = Math.max(0.25, Math.min(4, Number.isFinite(+data.scale) ? +data.scale : 1));
    const folder = path.join(texRoot(), 'biomes', id);
    fs.mkdirSync(folder, {recursive: true});
    fs.writeFileSync(path.join(folder, 'meta.json'), JSON.stringify({scale: scale}, null, 2) + '\n');
    return new Response(JSON.stringify({ok: true, id, scale}), {
      status: 200,
      headers: {'content-type': 'application/json; charset=utf-8'}
    });
  }
  const ext = String(data.ext || 'png').toLowerCase().replace('jpeg', 'jpg');
  const payload = String(data.data || '');
  if (!EXT_OK.has(ext) || payload.indexOf('base64,') < 0) {
    return new Response('Bad request', {status: 400});
  }
  const buf = Buffer.from(payload.split('base64,')[1], 'base64');
  if (!buf.length) return new Response('Bad request', {status: 400});
  let result;
  try { result = writeTexture(kind, id, ext, buf); }
  catch (err) { return new Response('Bad request', {status: 400}); }
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: {'content-type': 'application/json; charset=utf-8'}
  });
}

/**
 * POST /__save-texture-file: принимает исходные байты без медленного Base64/JSON.
 * @param {Request} request
 * @param {URL} url
 * @returns {Promise<Response>}
 */
async function handleSaveTextureFile(request, url) {
  const kind = String(url.searchParams.get('kind') || '');
  const ext = String(url.searchParams.get('ext') || 'png').toLowerCase().replace('jpeg', 'jpg');
  const id = textureId(url.searchParams.get('id') || '');
  const declared = Number(request.headers.get('content-length')) || 0;
  if (!ID_RE.test(id) || !EXT_OK.has(ext) || declared > MAX_TEXTURE_BYTES) {
    return new Response('Bad request', {status: 400});
  }
  let buf;
  try { buf = Buffer.from(await request.arrayBuffer()); }
  catch (err) { return new Response('Bad request', {status: 400}); }
  let result;
  try { result = writeTexture(kind, id, ext, buf); }
  catch (err) { return new Response('Bad request', {status: 400}); }
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'}
  });
}

module.exports = {handleListTextures, handleSaveTexture, handleSaveTextureFile, listTextures, textureId};
