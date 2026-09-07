////////////////////////////////////////////////////////
//
// Запись JSON трассы из лаборатории (POST /__save-track).
//
////////////////////////////////////////////////////////

'use strict';

const fs = require('fs');
const path = require('path');
const { contentRoot } = require('./paths');
const {writeDocument, validateTrack} = require('./document-store');

const ID_RE = /^[a-z0-9_]{2,40}$/;

/**
 * Пишет JSON.
 * @param {string} filePath
 * @param {object} data
 */
function writeJson(filePath, data) {
  writeDocument(filePath, data);
}

/**
 * Папка трасс.
 * @returns {string}
 */
function tracksDir() {
  return path.join(contentRoot(), 'assets', 'data', 'tracks');
}

/**
 * Имена файлов трасс.
 * @returns {string[]}
 */
function listTrackFiles() {
  const folder = tracksDir();
  if (!fs.existsSync(folder)) return [];
  return fs.readdirSync(folder)
    .filter((name) => name.endsWith('.json') && name !== 'index.json' && ID_RE.test(path.basename(name, '.json')))
    .sort((a, b) => a.localeCompare(b, 'en', {numeric: true}));
}

/**
 * Обновляет index.json.
 */
function writeIndex() {
  writeJson(path.join(tracksDir(), 'index.json'), {files: listTrackFiles()});
}

/**
 * GET /__tracks.
 * @returns {Response}
 */
function handleListTracks() {
  return new Response(JSON.stringify({files: listTrackFiles()}), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

/**
 * POST /__save-track.
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function handleSaveTrack(request) {
  let data;
  try {
    const raw = await request.text();
    if (!raw || raw.length > 2_000_000) return new Response('Bad request', {status: 400});
    data = JSON.parse(raw);
  } catch (err) {
    return new Response('Bad request', {status: 400});
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return new Response('Bad request', {status:400});
  const id = data.id;
  const kind = data.kind || 'work';
  if (!['work','delete'].includes(kind)) return new Response('Unknown operation', {status:400});
  if (typeof id !== 'string' || !ID_RE.test(id)) return new Response('Bad request', {status: 400});
  const dest = path.join(tracksDir(), id + '.json');
  if (kind === 'delete') {
    if (fs.existsSync(dest)) {
      const trash = path.join(tracksDir(), '.trash');
      fs.mkdirSync(trash, {recursive:true});
      fs.renameSync(dest, path.join(trash, id + '-' + require('crypto').randomUUID() + '.json'));
    }
    writeIndex();
    return new Response('{"ok":true}', {status: 200, headers: {'content-type': 'application/json; charset=utf-8'}});
  }
  const track = data.track;
  const error = validateTrack(track);
  if (error) return new Response(error, {status:400});
  track.id = id;
  writeJson(dest, track);
  writeIndex();
  return new Response('{"ok":true}', {status: 200, headers: {'content-type': 'application/json; charset=utf-8'}});
}

module.exports = {handleSaveTrack, handleListTracks};
