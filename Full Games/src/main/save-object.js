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
const COLOR_RE = /^#[0-9a-f]{6}$/i;
const EXT_OK = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif']);
const SYSTEM_PACKS = new Set(['world']);
const MAX_ASSET_BYTES = 32 * 1024 * 1024;

/** Корень ассетов. */
function objectRoot() {
  return path.join(contentRoot(), 'assets', 'object');
}

/** JSON с диска. */
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (err) { return null; }
}

/** Безопасный цвет пака. */
function packColor(value, fallback) {
  return COLOR_RE.test(String(value || '')) ? String(value).toLowerCase() : fallback;
}

/** Метаданные пака с защитой системных полей. */
function packMeta(folder, id) {
  const raw = readJson(path.join(folder, 'pack.labr')) || {};
  return {
    id,
    name: String(raw.name || id.toUpperCase()).slice(0, 42),
    parent: PACK_RE.test(String(raw.parent || '')) ? String(raw.parent) : '',
    color: packColor(raw.color, SYSTEM_PACKS.has(id) ? '#d4a84a' : '#79dce6'),
    system: SYSTEM_PACKS.has(id)
  };
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
    const meta = packMeta(folder, packId);
    const rel = 'assets/object/' + name;
    const objects = fs.readdirSync(folder).filter((n) => n.toLowerCase().endsWith('.oblab')).sort().map((fn) => {
      const raw = readJson(path.join(folder, fn)) || {};
      const id = String(raw.id || path.basename(fn, '.oblab'));
      const srcRaw = String(raw.src || (id + '.webp')).replace(/\\/g, '/');
      const srcName = srcRaw.split('/').pop();
      const src = srcRaw.indexOf('assets/') === 0 ? srcRaw : (rel + '/' + srcName);
      const carLayer = raw.carLayer === 'over' || raw.layer === 'over' ? 'over' : 'under';
      const roadLayer = raw.roadLayer === 'under' ? 'under' : 'over';
      return {
        pack: packId,
        id,
        name: String(raw.name || id).slice(0, 42),
        src,
        file: srcName,
        w: Math.max(8, +raw.w || 128),
        h: Math.max(8, +raw.h || 128),
        lockRatio: raw.lockRatio !== false,
        layer: carLayer,
        carLayer,
        roadLayer,
        collision: collisionOf(raw.collision, carLayer)
      };
    });
    packs.push({...meta, folder: rel, objects});
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
  const color = packColor(data.color, '#79dce6');
  fs.writeFileSync(path.join(folder, 'pack.labr'), JSON.stringify({id, name, color, parent: '', format: 'labr'}, null, 2));
  return {ok: true, id, folder: 'assets/object/' + id + '.labr'};
}

/** Меняет, переносит или удаляет пользовательский пак. */
function mutatePack(data) {
  const id = String(data.id || '').toLowerCase();
  const action = String(data.action || 'create');
  if (!PACK_RE.test(id) || SYSTEM_PACKS.has(id)) return null;
  if (action === 'create') {
    const folder = path.join(objectRoot(), id + '.labr');
    if (fs.existsSync(folder)) return null;
    return writePack(data);
  }
  const folder = path.join(objectRoot(), id + '.labr');
  if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) return null;
  const current = packMeta(folder, id);
  const all = listPacks().packs;
  if (action === 'delete') {
    if (all.some((pack) => pack.parent === id)) return {ok: false, error: 'Сначала перенесите вложенные паки'};
    fs.rmSync(folder, {recursive: true, force: false});
    return {ok: true, deleted: true, id};
  }
  if (action === 'update') {
    const parent = String(data.parent || '').toLowerCase();
    if (parent && (!PACK_RE.test(parent) || parent === id || !all.some((pack) => pack.id === parent))) return null;
    let cursor = parent;
    while (cursor) {
      if (cursor === id) return {ok: false, error: 'Пак нельзя вложить в самого себя'};
      const node = all.find((pack) => pack.id === cursor);
      cursor = node ? node.parent : '';
    }
    const body = {
      id,
      name: String(data.name == null ? current.name : data.name).trim().slice(0, 42) || current.name,
      color: packColor(data.color, current.color),
      parent,
      format: 'labr'
    };
    fs.writeFileSync(path.join(folder, 'pack.labr'), JSON.stringify(body, null, 2));
    return {ok: true, ...body};
  }
  return null;
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
  const out = mutatePack(data);
  if (!out) return new Response('Bad request', {status: 400});
  return new Response(JSON.stringify(out), {status: out.ok === false ? 409 : 200, headers: {'content-type': 'application/json; charset=utf-8'}});
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
  const carLayer = data.carLayer === 'over' || data.layer === 'over' ? 'over' : 'under';
  const roadLayer = data.roadLayer === 'under' ? 'under' : 'over';
  const storeSrc = srcIn.indexOf('assets/') === 0 ? srcIn : srcName;
  const body = {
    id,
    name: String(data.name || id).slice(0, 42),
    src: storeSrc,
    w: Math.max(8, +data.w || 128),
    h: Math.max(8, +data.h || 128),
    lockRatio: data.lockRatio !== false,
    layer: carLayer,
    carLayer,
    roadLayer,
    collision: collisionOf(data.collision, carLayer)
  };
  fs.writeFileSync(path.join(folder, id + '.oblab'), JSON.stringify(body, null, 2));
  const outSrc = storeSrc.indexOf('assets/') === 0 ? storeSrc : ('assets/object/' + pack + '.labr/' + srcName);
  return new Response(JSON.stringify({ok: true, pack, id, src: outSrc}), {
    status: 200,
    headers: {'content-type': 'application/json; charset=utf-8'}
  });
}

/** POST /__save-oblab-file: импортирует картинку ассета исходными байтами. */
async function handleSaveOblabFile(request, url) {
  const pack = String(url.searchParams.get('pack') || '').toLowerCase();
  const id = String(url.searchParams.get('id') || '').toLowerCase();
  const ext = String(url.searchParams.get('ext') || 'webp').toLowerCase().replace('jpeg', 'jpg');
  const name = String(url.searchParams.get('name') || id).trim().slice(0, 42) || id;
  const width = Math.max(8, Math.min(16384, +url.searchParams.get('w') || 128));
  const height = Math.max(8, Math.min(16384, +url.searchParams.get('h') || 128));
  const replace = url.searchParams.get('replace') === '1';
  const declared = Number(request.headers.get('content-length')) || 0;
  if (!PACK_RE.test(pack) || !OBJ_RE.test(id) || !EXT_OK.has(ext) || declared > MAX_ASSET_BYTES) {
    return new Response('Bad request', {status: 400});
  }
  let bytes;
  try { bytes = Buffer.from(await request.arrayBuffer()); }
  catch (err) { return new Response('Bad request', {status: 400}); }
  if (!bytes.length || bytes.length > MAX_ASSET_BYTES) return new Response('Bad request', {status: 400});
  let folder = path.join(objectRoot(), pack + '.labr');
  if (!fs.existsSync(folder)) {
    const made = writePack({id: pack, name: pack});
    if (!made) return new Response('Bad request', {status: 400});
    folder = path.join(objectRoot(), pack + '.labr');
  }
  EXT_OK.forEach((old) => {
    if (old === ext) return;
    const stale = path.join(folder, id + '.' + old);
    if (fs.existsSync(stale)) fs.unlinkSync(stale);
  });
  const srcName = id + '.' + ext;
  fs.writeFileSync(path.join(folder, srcName), bytes);
  const current = replace ? readJson(path.join(folder, id + '.oblab')) : null;
  const carLayer = current && (current.carLayer === 'over' || current.layer === 'over') ? 'over' : 'under';
  const body = current ? {
    id,
    name: String(current.name || name).slice(0, 42),
    src: srcName,
    w: Math.max(8, +current.w || width),
    h: Math.max(8, +current.h || height),
    lockRatio: current.lockRatio !== false,
    layer: carLayer,
    carLayer,
    roadLayer: current.roadLayer === 'under' ? 'under' : 'over',
    collision: collisionOf(current.collision, carLayer)
  } : {
    id, name, src: srcName, w: width, h: height, lockRatio: true,
    layer: 'under', carLayer: 'under', roadLayer: 'over',
    collision: collisionOf({solid: false, poly: [], bodies: []}, 'under')
  };
  fs.writeFileSync(path.join(folder, id + '.oblab'), JSON.stringify(body, null, 2));
  return new Response(JSON.stringify({ok: true, pack, id, src: 'assets/object/' + pack + '.labr/' + srcName}), {
    status: 200,
    headers: {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'}
  });
}

module.exports = {handleListPacks, handleSavePack, handleSaveOblab, handleSaveOblabFile, listPacks, mutatePack};
