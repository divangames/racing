////////////////////////////////////////////////////////
//
// Каталог паков двигателя и оружия для лаборатории.
//
////////////////////////////////////////////////////////

'use strict';

const fs = require('fs');
const path = require('path');

const WAV = new Set(['.wav']);
const SKIP_WEAPON = new Set(['generic']);

/** Имя папки без выхода наверх. */
function safePackName(name) {
  const s = String(name || '').trim();
  if (!s || s.length > 80 || s.includes('..') || /[\\/]/.test(s)) return '';
  return s;
}

/** WAV в папке, без служебных .earshot. */
function listWav(folder) {
  if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) return [];
  return fs.readdirSync(folder)
    .filter((n) => WAV.has(path.extname(n).toLowerCase()) && fs.statSync(path.join(folder, n)).isFile())
    .sort((a, b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'}));
}

/** Паки `assets/sounds/cars/engine`. */
function listEnginePacks(root) {
  const base = path.join(root, 'assets', 'sounds', 'cars', 'engine');
  const out = [];
  if (!fs.existsSync(base) || !fs.statSync(base).isDirectory()) return out;
  for (const name of fs.readdirSync(base)) {
    const id = safePackName(name);
    if (!id) continue;
    const dir = path.join(base, name);
    if (!fs.statSync(dir).isDirectory()) continue;
    const clips = listWav(path.join(dir, 'sound'));
    if (!clips.length) continue;
    out.push({id, clips});
  }
  out.sort((a, b) => a.id.localeCompare(b.id, undefined, {numeric: true, sensitivity: 'base'}));
  return out;
}

/** Папки `assets/sounds/weapon`, без generic. */
function listWeaponPacks(root) {
  const base = path.join(root, 'assets', 'sounds', 'weapon');
  const out = [];
  if (!fs.existsSync(base) || !fs.statSync(base).isDirectory()) return out;
  for (const name of fs.readdirSync(base)) {
    const id = safePackName(name);
    if (!id || SKIP_WEAPON.has(id.toLowerCase())) continue;
    const dir = path.join(base, name);
    if (!fs.statSync(dir).isDirectory()) continue;
    const files = listWav(dir);
    if (!files.length) continue;
    out.push({id, files});
  }
  out.sort((a, b) => a.id.localeCompare(b.id, 'en', {sensitivity: 'base'}));
  return out;
}

/**
 * JSON для GET /__lab-sounds.
 * @param {string} root корень контента
 */
function listLabSounds(root) {
  return {engines: listEnginePacks(root), weapons: listWeaponPacks(root)};
}

module.exports = {listLabSounds, safePackName};
