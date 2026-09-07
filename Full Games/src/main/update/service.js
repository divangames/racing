////////////////////////////////////////////////////////
//
// Лаунчер качает zip игры с GitHub и ставит в профиль.
//
////////////////////////////////////////////////////////

'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { game, installedGameRoot, contentRoot } = require('../paths');
const { fetchLatestGame } = require('./github');
const { downloadFile } = require('./download');
const { extractZip, swapFolder, flattenIfNested } = require('./extract');
const { isNewer, normalizeTag } = require('./version');
const { formatBytes } = require('./format');

const FRESH_FILES = [
  'Editor.html',
  'editor/lab-audio.js',
  'assets/sounds/lab-catalog.json',
  'assets/sounds/engine/sound_001.wav',
  'assets/sounds/cars/wheels/sound_025.wav'
];

let busy = false;
let lastProgress = null;

/**
 * Локальная запись об установленной игре.
 * @returns {{version: string}|null}
 */
function readInstall() {
  try {
    const file = path.join(installedGameRoot(), 'install.json');
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    return null;
  }
}

/**
 * Игра уже лежит на диске.
 * @returns {boolean}
 */
function hasGameFiles() {
  return fs.existsSync(path.join(contentRoot(), game.entry));
}

/**
 * Старый Content без лаборатории звука или мотора — надо скачать заново.
 * @param {string} root
 * @returns {boolean}
 */
function contentLooksStale(root) {
  for (let i = 0; i < FRESH_FILES.length; i++) {
    if (!fs.existsSync(path.join(root, FRESH_FILES[i]))) return true;
  }
  try {
    const html = fs.readFileSync(path.join(root, 'Editor.html'), 'utf8');
    if (html.indexOf('id="labAudio"') < 0) return true;
  } catch (err) {
    return true;
  }
  return false;
}

/**
 * Снимок для UI.
 * @returns {Promise<object>}
 */
async function snapshot() {
  const local = readInstall();
  const installed = hasGameFiles();
  let remote = null;
  let remoteError = '';
  if (app.isPackaged) {
    try {
      remote = await fetchLatestGame();
    } catch (err) {
      remoteError = err.message || String(err);
    }
  }
  const localVer = local && local.version;
  const stale = contentLooksStale(contentRoot());
  const sizeChanged = Boolean(remote && local && local.size && remote.size && Number(local.size) !== Number(remote.size));
  const needUpdate = Boolean(
    app.isPackaged && remote && (isNewer(remote.tag, localVer) || stale || sizeChanged)
  );
  const needInstall = Boolean(app.isPackaged && !installed);
  return {
    packaged: app.isPackaged,
    installed,
    busy,
    needInstall,
    needUpdate,
    localVersion: localVer || '',
    remoteTag: remote ? remote.tag : '',
    remoteName: remote ? remote.name : '',
    remoteSize: remote ? remote.size : 0,
    remoteError,
    playable: installed,
    progress: lastProgress
  };
}

/**
 * Ставит игру из последнего релиза.
 * @param {(info: object) => void} onProgress
 * @returns {Promise<object>}
 */
async function installLatest(onProgress) {
  if (busy) return { ok: false, issues: ['Уже идёт установка.'] };
  if (!app.isPackaged) {
    return { ok: false, issues: ['В разработке игра читается с диска проекта.'] };
  }
  busy = true;
  const dest = installedGameRoot();
  const cache = path.join(app.getPath('userData'), 'Cache');
  const zipPath = path.join(cache, 'kolesnica-content.zip');
  const staged = dest + '.staging';
  const emit = (info) => {
    lastProgress = info;
    if (onProgress) onProgress(info);
  };
  try {
    emit({ phase: 'check', pct: 2, label: 'Спрашиваю GitHub…' });
    const remote = await fetchLatestGame();
    if (!remote) {
      throw new Error('В релизах нет файла kolesnica-content*.zip.');
    }
    emit({
      phase: 'download',
      pct: 4,
      label: 'Скачиваю ' + remote.name + ' (' + formatBytes(remote.size) + ')'
    });
    await downloadFile(remote.url, zipPath, emit);
    emit({ phase: 'extract', pct: 92, label: 'Распаковываю файлы…' });
    if (fs.existsSync(staged)) fs.rmSync(staged, { recursive: true, force: true });
    await extractZip(zipPath, staged);
    flattenIfNested(staged, game.entry);
    if (!fs.existsSync(path.join(staged, game.entry))) {
      throw new Error('В архиве нет ' + game.entry + '.');
    }
    const record = {
      version: normalizeTag(remote.tag),
      tag: remote.tag,
      asset: remote.name,
      size: remote.size,
      installedAt: new Date().toISOString()
    };
    fs.writeFileSync(path.join(staged, 'install.json'), JSON.stringify(record, null, 2) + '\n');
    emit({ phase: 'swap', pct: 97, label: 'Подключаю игру…' });
    swapFolder(staged, dest);
    try {
      fs.rmSync(zipPath, { force: true });
    } catch (err) {
      /* кэш не критичен */
    }
    lastProgress = { phase: 'done', pct: 100, label: 'Игра установлена.' };
    return { ok: true, install: record };
  } catch (err) {
    lastProgress = { phase: 'error', pct: 0, label: err.message || String(err) };
    return { ok: false, issues: [err.message || String(err)] };
  } finally {
    busy = false;
  }
}

module.exports = { snapshot, installLatest, readInstall, hasGameFiles };
