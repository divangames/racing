////////////////////////////////////////////////////////
//
// Проверка локальных файлов: быстрый список и полный SHA-256.
// Готово к лаунчеру Steam: тот же манифест пойдёт в депо.
//
////////////////////////////////////////////////////////

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { contentRoot, manifestPath, game } = require('./paths');

/**
 * Читает манифест, если он уже собран.
 * @returns {object|null}
 */
function readManifest() {
  try {
    return JSON.parse(fs.readFileSync(manifestPath(), 'utf8'));
  } catch (err) {
    return null;
  }
}

/**
 * Якорные файлы: без них игра не стартует.
 * @returns {string[]}
 */
function requiredAnchors() {
  return [
    game.entry,
    'career.js',
    'chars.js',
    'music.js',
    'sounds.js',
    'car-audio.js',
    'car-audio-voice.js',
    'car-tires.js',
    'car-nos.js',
    'weapon-audio.js',
    'combat-kits.js',
    'starter-kits.js',
    'mid-kits.js',
    'world-intro.js',
    'armory.js',
    'tracks.js',
    'objects.js',
    'assets/image/game-logo.webp',
    'Editor.html',
    'editor/lab-audio.js',
    'assets/sounds/engine/sound_001.wav',
    'assets/sounds/cars/wheels/sound_025.wav'
  ];
}

/**
 * JSON машин крутят в лаборатории — размер может разъехаться с манифестом лаунчера.
 * @param {string} rel
 * @returns {boolean}
 */
function isCarTuneFile(rel) {
  return /^assets\/data\/cars\/\d+\/car\.json$/i.test(String(rel || '').replace(/\\/g, '/'));
}
/**
 * SHA-256 файла потоком.
 * @param {string} filePath
 * @returns {Promise<string>}
 */
function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

/**
 * Быстрая проверка: вход и якоря на месте.
 * @returns {{ok: boolean, mode: string, issues: string[], contentRoot: string}}
 */
function quickCheck() {
  const root = contentRoot();
  const issues = [];
  const warns = [];
  if (!fs.existsSync(root)) {
    return { ok: false, mode: 'quick', issues: ['Нет папки контента: ' + root], warns, contentRoot: root };
  }
  for (const rel of requiredAnchors()) {
    const full = path.join(root, rel);
    if (!fs.existsSync(full)) issues.push('Нет файла: ' + rel);
  }
  const manifest = readManifest();
  const packed = Boolean(app.isPackaged);
  if (manifest && Array.isArray(manifest.files)) {
    for (const item of manifest.files) {
      const full = path.join(root, item.path);
      if (!fs.existsSync(full)) {
        issues.push('Нет файла из манифеста: ' + item.path);
        continue;
      }
      const size = fs.statSync(full).size;
      if (typeof item.size === 'number' && size !== item.size) {
        const msg = 'Размер не совпал: ' + item.path;
        if (packed && !isCarTuneFile(item.path)) issues.push(msg);
        else warns.push(msg);
      }
    }
  }
  return {
    ok: issues.length === 0,
    mode: 'quick',
    issues,
    warns,
    contentRoot: root,
    hasManifest: Boolean(manifest)
  };
}

/**
 * Полная проверка SHA-256 по манифесту (без хешей — только размеры).
 * @param {(info: object) => void} onProgress
 * @returns {Promise<object>}
 */
async function fullVerify(onProgress) {
  const quick = quickCheck();
  const manifest = readManifest();
  if (!manifest || !Array.isArray(manifest.files) || manifest.files.length === 0) {
    return {
      ...quick,
      mode: 'full',
      ok: quick.ok,
      issues: quick.ok
        ? ['Манифест ещё не собран: размеры якорей в порядке. Запустите npm run manifest']
        : quick.issues
    };
  }
  const root = contentRoot();
  const packed = Boolean(app.isPackaged);
  const issues = [];
  const warns = [];
  const total = manifest.files.length;
  let done = 0;
  for (const item of manifest.files) {
    const full = path.join(root, item.path);
    done += 1;
    if (onProgress) {
      onProgress({ done, total, path: item.path });
    }
    if (!fs.existsSync(full)) {
      issues.push('Нет файла: ' + item.path);
      continue;
    }
    const stat = fs.statSync(full);
    if (typeof item.size === 'number' && stat.size !== item.size) {
      const msg = 'Размер не совпал: ' + item.path;
      if (packed && !isCarTuneFile(item.path)) issues.push(msg);
      else warns.push(msg);
      continue;
    }
    if (item.sha256) {
      const digest = await hashFile(full);
      if (digest !== item.sha256) {
        const msg = 'Хеш не совпал: ' + item.path;
        if (packed && !isCarTuneFile(item.path)) issues.push(msg);
        else warns.push(msg);
      }
    }
  }
  return {
    ok: issues.length === 0,
    mode: 'full',
    issues,
    warns,
    contentRoot: root,
    checked: total,
    version: manifest.version || game.version
  };
}

module.exports = { readManifest, quickCheck, fullVerify, hashFile, isCarTuneFile };
