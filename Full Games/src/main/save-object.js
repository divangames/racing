////////////////////////////////////////////////////////
//
// Пакеты ассетов: *.labr / *.oblab и картинка PNG WebP GIF.
//
////////////////////////////////////////////////////////

'use strict';

const fs = require('fs');
const path = require('path');
const { contentRoot } = require('./paths');

const PACK_RE = /^[a-z0-9_]{2,32}$/;
const OBJ_RE = /^[a-z0-9_]{2,40}$/;
const EXT_OK = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif']);

/** Корень ассетов. */
function objectRoot() {
  return path.join(contentRoot(), 'assets', 'object');
}

/** JSON с диска. */
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (err) { return null; }
}

/** Вершины полигона. */
function verts(poly) {
  if (!Array.isArray(poly)) return [];
  return poly.filter((p) => Array.isArray(p) && p.length >= 2).map((p) => [+p[0] || 0, +p[1] || 0]);
}

/** Коллизия: несколько тел и запасной poly. */
function collisionOf(raw, layer) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const bodies = [];
  if (Array.isArray(s.bodies)) {
    s.bodies.forEach((b) => {
      const poly = verts(b && b.poly);
      if (poly.length >= 3) bodies.push({poly});
    });
  }
  if (!bodies.length) {
    const poly = verts(s.poly);
    if (poly.length >= 3) bodies.push({poly});
  }
  return {
    solid: layer === 'under' ? false : s.solid !== false,
    bodies,
    poly: bodies[0] ? bodies[0].poly : []
  };
}

/** Каталог паков. */
function listPacks() {
  const base = objectRoot();
  const packs = [];
  if (!fs.existsSync(base)) return {packs};
  fs.readdirSync(base).filter((n) => n.toLowerCase().endsWith('.labr')).sort().forEach((name) => {
    const folder = path.join(base, name);
    if (!fs.statSync(folder).isDirectory()) return;
    const packId = name.slice(0, -5);
    if (!PACK_RE.test(packId)) return;
    const meta = readJson(path.join(folder, 'pack.labr')) || {};
    const rel = 'assets/object/' + name;
    const objects = fs.readdirSync(folder).filter((n) => n.toLowerCase().endsWith('.oblab')).sort().map((fn) => {
      const raw = readJson(path.join(folder, fn)) || {};
      const id = String(raw.id || path.basename(fn, '.oblab'));
      const srcRaw = String(raw.src || (id + '.webp')).replace(/\\/g, '/');
      const srcName = srcRaw.split('/').pop();
      const src = srcRaw.indexOf('assets/') === 0 ? srcRaw : (rel + '/' + srcName);
      const layer = raw.layer === 'over' ? 'over' : 'under';
      return {
        pack: packId,
        id,
        name: String(raw.name || id).slice(0, 42),
        src,
        file: srcName,
        w: Math.max(8, +raw.w || 128),
        h: Math.max(8, +raw.h || 128),
        lockRatio: raw.lockRatio !== false,
        layer,
        collision: collisionOf(raw.collision, layer)
      };
    });
    packs.push({id: packId, name: String(meta.name || packId.toUpperCase()), folder: rel, objects});
  });
  return {packs};
}

/** GET /__object-packs. */
function handleListPacks() {
  return new Response(JSON.stringify(listPacks()), {
    status: 200,
    headers: {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'}
  });
}

/** Создаёт пак. */
function writePack(data) {
  const id = String(data.id || '').toLowerCase();
  if (!PACK_RE.test(id)) return null;
  const folder = path.join(objectRoot(), id + '.labr');
  fs.mkdirSync(folder, {recursive: true});
  const name = String(data.name || id).slice(0, 42);
  fs.writeFileSync(path.join(folder, 'pack.labr'), JSON.stringify({id, name, format: 'labr'}, null, 2));
  return {ok: true, id, folder: 'assets/object/' + id + '.labr'};
}

/** POST /__save-pack. */
async function handleSavePack(request) {
  let data;
  try {
    const raw = await request.text();
    if (!raw || raw.length > 20000) return new Response('Too large', {status: 400});
    data = JSON.parse(raw);
  } catch (err) {
    return new Response('Bad request', {status: 400});
  }
  const out = writePack(data);
  if (!out) return new Response('Bad request', {status: 400});
  return new Response(JSON.stringify(out), {status: 200, headers: {'content-type': 'application/json; charset=utf-8'}});
}

/** POST /__save-oblab. */
async function handleSaveOblab(request) {
  let data;
  try {
    const raw = await request.text();
    if (!raw || raw.length > 8_000_000) return new Response('Too large', {status: 400});
    data = JSON.parse(raw);
  } catch (err) {
    return new Response('Bad request', {status: 400});
  }
  const pack = String(data.pack || '').toLowerCase();
  const id = String(data.id || '').toLowerCase();
  if (!PACK_RE.test(pack) || !OBJ_RE.test(id)) return new Response('Bad request', {status: 400});
  let folder = path.join(objectRoot(), pack + '.labr');
  if (data.kind === 'delete') {
    const ob = path.join(folder, id + '.oblab');
    if (fs.existsSync(ob)) {
      const meta = readJson(ob) || {};
      const srcRaw = String(meta.src || '');
      fs.unlinkSync(ob);
      const img = path.join(folder, srcRaw.replace(/\\/g, '/').split('/').pop());
      if (srcRaw && fs.existsSync(img) && srcRaw.replace(/\\/g, '/').indexOf('assets/image') !== 0) fs.unlinkSync(img);
    }
    return new Response(JSON.stringify({ok: true, deleted: true, id}), {status: 200, headers: {'content-type': 'application/json; charset=utf-8'}});
  }
  if (!fs.existsSync(folder)) {
    const made = writePack({id: pack, name: pack});
    if (!made) return new Response('Bad request', {status: 400});
    folder = path.join(objectRoot(), pack + '.labr');
  }
  let ext = String(data.ext || 'webp').toLowerCase().replace('jpeg', 'jpg');
  if (!EXT_OK.has(ext)) ext = 'webp';
  let srcIn = String(data.src || (id + '.' + ext)).replace(/\\/g, '/');
  let srcName = srcIn.split('/').pop();
  const payload = String(data.data || '');
  if (payload.indexOf('base64,') >= 0) {
    const buf = Buffer.from(payload.split('base64,')[1], 'base64');
    if (!buf.length) return new Response('Bad request', {status: 400});
    srcName = id + '.' + ext;
    srcIn = srcName;
    fs.writeFileSync(path.join(folder, srcName), buf);
  }
  const layer = data.layer === 'over' ? 'over' : 'under';
  const storeSrc = srcIn.indexOf('assets/') === 0 ? srcIn : srcName;
  const body = {
    id,
    name: String(data.name || id).slice(0, 42),
    src: storeSrc,
    w: Math.max(8, +data.w || 128),
    h: Math.max(8, +data.h || 128),
    lockRatio: data.lockRatio !== false,
    layer,
    collision: collisionOf(data.collision, layer)
  };
  fs.writeFileSync(path.join(folder, id + '.oblab'), JSON.stringify(body, null, 2));
  const outSrc = storeSrc.indexOf('assets/') === 0 ? storeSrc : ('assets/object/' + pack + '.labr/' + srcName);
  return new Response(JSON.stringify({ok: true, pack, id, src: outSrc}), {
    status: 200,
    headers: {'content-type': 'application/json; charset=utf-8'}
  });
}

module.exports = {handleListPacks, handleSavePack, handleSaveOblab, listPacks};
