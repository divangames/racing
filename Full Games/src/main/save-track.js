////////////////////////////////////////////////////////
//
// Запись JSON трассы из лаборатории (POST /__save-track).
// Свои петли — в корне tracks, сюжетные — в tracks/chapters.
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
 * Папка сюжетных петель.
 * @returns {string}
 */
function chaptersDir() {
  return path.join(tracksDir(), 'chapters');
}

/**
 * Сюжетный id или поле chapter.
 * @param {string} id
 * @param {object} [track]
 * @returns {boolean}
 */
function isChapterTrack(id, track) {
  if (track && ((track.chapter | 0) > 0 || track.chapterId)) return true;
  return /^ch\d+_/.test(id);
}

/**
 * Имена своих JSON.
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
 * Пути сюжетных JSON относительно tracks/.
 * @returns {string[]}
 */
function listChapterFiles() {
  const folder = chaptersDir();
  if (!fs.existsSync(folder)) return [];
  return fs.readdirSync(folder)
    .filter((name) => name.endsWith('.json') && name !== 'index.json' && ID_RE.test(path.basename(name, '.json')))
    .sort((a, b) => a.localeCompare(b, 'en', {numeric: true}))
    .map((name) => 'chapters/' + name);
}

/**
 * Обновляет index.json своих и глав.
 */
function writeIndex() {
  writeJson(path.join(tracksDir(), 'index.json'), {files: listTrackFiles(), chapters: listChapterFiles()});
  fs.mkdirSync(chaptersDir(), {recursive: true});
  writeJson(path.join(chaptersDir(), 'index.json'), {
    files: listChapterFiles().map((rel) => path.basename(rel))
  });
}

/**
 * Файл трассы: глава или своя.
 * @param {string} id
 * @param {object} [track]
 * @returns {string}
 */
function destFor(id, track) {
  if (isChapterTrack(id, track)) return path.join(chaptersDir(), id + '.json');
  return path.join(tracksDir(), id + '.json');
}

/**
 * GET /__tracks.
 * @returns {Response}
 */
function handleListTracks() {
  return new Response(JSON.stringify({files: listTrackFiles(), chapters: listChapterFiles()}), {
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
  const dest = destFor(id, data.track);
  if (kind === 'delete') {
    if (isChapterTrack(id, data.track)) {
      return new Response('Сюжетную трассу нельзя удалить', {status: 400});
    }
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
  if (isChapterTrack(id, track) && !(track.chapter | 0)) {
    const m = id.match(/^ch(\d+)_/);
    track.chapter = m ? +m[1] : 1;
  }
  writeJson(dest, track);
  writeIndex();
  return new Response('{"ok":true}', {status: 200, headers: {'content-type': 'application/json; charset=utf-8'}});
}

module.exports = {handleSaveTrack, handleListTracks};
