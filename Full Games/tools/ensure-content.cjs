////////////////////////////////////////////////////////
//
// Копия рантайма и лаборатории: без «Материалы», git, батников.
//
////////////////////////////////////////////////////////

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const GAME_ROOT = path.resolve(__dirname, '../..');

const ROOT_FILES = [
  'rnr.html',
  'Editor.html',
  'career.js',
  'chars.js',
  'music.js',
  'sounds.js',
  'car-audio.js',
  'car-audio-voice.js',
  'car-tires.js',
  'car-nos.js',
  'weapon-audio.js',
  'voice.js',
  'notice.js',
  'combat-kits.js',
  'starter-kits.js',
  'mid-kits.js',
  'world-intro.js',
  'armory.js',
  'tracks.js',
  'objects.js'
];

const CODE_DIRS = ['editor', 'vfx', 'vendor'];

const ASSET_DIRS = [
  'assets/data',
  'assets/fonts',
  'assets/HUD',
  'assets/image',
  'assets/machines',
  'assets/sounds',
  'assets/music',
  'assets/object'
];

const TAR_EXCLUDES = ['reference', '*.md', 'car.backup.json', 'TEMP.svg'];

/** Якоря мотора, шин и нитро — без них в продакшене тишина. */
const CORE_SOUND_FILES = [
  'assets/sounds/engine/sound_001.wav',
  'assets/sounds/engine/sound_002.wav',
  'assets/sounds/engine/sound_003.wav',
  'assets/sounds/engine/sound_004.wav',
  'assets/sounds/engine/sound_005.wav',
  'assets/sounds/cars/wheels/sound_025.wav',
  'assets/sounds/cars/wheels/sound_026.wav',
  'assets/sounds/cars/NOSZ/sound_084.wav',
  'assets/sounds/cars/NOSZ/sound_011.wav'
];

/**
 * Проверяет, что в дереве игры лежат обязательные WAV.
 * @param {string} gameRoot
 */
function assertCoreSounds(gameRoot) {
  const missing = CORE_SOUND_FILES.filter(function (rel) {
    return !fs.existsSync(path.join(gameRoot, rel));
  });
  if (missing.length) {
    throw new Error('Нет звуков авто (двигатель / дрифт / нитро): ' + missing.join(', '));
  }
}

/**
 * Снимает папку или стык, не трогая цель стыка.
 * @param {string} target
 */
function safeRemove(target) {
  let st;
  try {
    st = fs.lstatSync(target);
  } catch (err) {
    return;
  }
  if (st.isSymbolicLink()) {
    fs.rmSync(target, { force: true });
    return;
  }
  fs.rmSync(target, { recursive: true, force: true });
}

/**
 * Коды robocopy 0–7 — успех.
 * @param {number} code
 * @returns {boolean}
 */
function robocopyOk(code) {
  return code >= 0 && code < 8;
}

/**
 * Копирует каталог через robocopy.
 * @param {string} from
 * @param {string} to
 * @param {string[]} extra
 */
function copyDir(from, to, extra) {
  if (!fs.existsSync(from)) {
    console.warn('Нет папки, пропуск:', from);
    return;
  }
  fs.mkdirSync(to, { recursive: true });
  const args = [from, to, '/E', '/MT:16', '/R:2', '/W:2', '/NFL', '/NDL', '/NJH', '/NJS', '/NC', '/NS', '/NP', ...(extra || [])];
  const result = spawnSync('robocopy', args, { stdio: 'inherit' });
  const code = result.status == null ? 1 : result.status;
  if (!robocopyOk(code)) {
    throw new Error('robocopy: ' + from + ' → код ' + code);
  }
}

/**
 * Копирует один файл.
 * @param {string} from
 * @param {string} to
 */
function copyFile(from, to) {
  if (!fs.existsSync(from)) {
    console.warn('Нет файла, пропуск:', from);
    return;
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

/**
 * Копирует в Content только то, что читает клиент.
 * @param {string} unpackedDir
 */
function ensureContent(unpackedDir) {
  if (!unpackedDir) throw new Error('Нет папки билда.');
  const entry = path.join(GAME_ROOT, 'rnr.html');
  if (!fs.existsSync(entry)) {
    throw new Error('Нет rnr.html в ' + GAME_ROOT);
  }
  const dest = path.join(unpackedDir, 'Content');
  console.log('Копирую рантайм в Content (без исходников и «Материалы»)...');
  safeRemove(dest);
  fs.mkdirSync(dest, { recursive: true });

  for (const name of ROOT_FILES) {
    copyFile(path.join(GAME_ROOT, name), path.join(dest, name));
  }
  for (const dir of CODE_DIRS) {
    copyDir(path.join(GAME_ROOT, dir), path.join(dest, dir));
  }

  const assetsSrc = path.join(GAME_ROOT, 'assets');
  const assetsDst = path.join(dest, 'assets');
  copyDir(path.join(assetsSrc, 'data'), path.join(assetsDst, 'data'), [
    '/XD', 'reference',
    '/XF', '*.md', 'car.backup.json'
  ]);
  copyDir(path.join(assetsSrc, 'fonts'), path.join(assetsDst, 'fonts'));
  copyDir(path.join(assetsSrc, 'image'), path.join(assetsDst, 'image'));
  copyDir(path.join(assetsSrc, 'machines'), path.join(assetsDst, 'machines'), [
    '/XF', 'TEMP.svg'
  ]);
  copyDir(path.join(assetsSrc, 'sounds'), path.join(assetsDst, 'sounds'));
  assertCoreSounds(dest);
  copyDir(path.join(assetsSrc, 'music'), path.join(assetsDst, 'music'));
  copyDir(path.join(assetsSrc, 'object'), path.join(assetsDst, 'object'));

  if (!fs.existsSync(path.join(dest, 'rnr.html'))) {
    throw new Error('После копии нет rnr.html в Content');
  }
  if (!fs.existsSync(path.join(dest, 'assets', 'image', 'game-logo.webp'))) {
    throw new Error('После копии нет логотипа');
  }

  const playBat = path.join(unpackedDir, 'Играть.bat');
  fs.writeFileSync(
    playBat,
    '@echo off\r\nchcp 65001 >nul\r\ncd /d "%~dp0"\r\nstart "" "Колесница войны.exe"\r\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(unpackedDir, 'ЧИТАТЬ.txt'),
    'Колесница войны\r\n\r\nЗапуск: «Колесница войны.exe» или Играть.bat.\r\nПапку Content не удаляйте и не отделяйте от exe.\r\nМузыка — из Content\\assets\\music, без сети.\r\n',
    'utf8'
  );
  console.log('Content готов (только файлы игры).');
  return dest;
}

/**
 * Пути внутри zip / Content, которые реально есть на диске.
 * @param {string} gameRoot
 * @returns {string[]}
 */
function listContentMembers(gameRoot) {
  const root = gameRoot || GAME_ROOT;
  const members = [];
  for (const name of ROOT_FILES) {
    if (fs.existsSync(path.join(root, name))) members.push(name);
  }
  for (const dir of [...CODE_DIRS, ...ASSET_DIRS]) {
    if (fs.existsSync(path.join(root, dir))) members.push(dir.replace(/\\/g, '/'));
  }
  return members;
}

/**
 * Zip обязан содержать якоря мотора и шин, иначе лаунчер уедет без звука.
 * @param {string} zipPath
 */
function assertZipCoreSounds(zipPath) {
  const listed = spawnSync('tar', ['-tf', zipPath], { encoding: 'utf8', windowsHide: true });
  if (listed.status !== 0) {
    throw new Error(String(listed.stderr || listed.stdout || 'Не прочитать zip').trim());
  }
  const names = String(listed.stdout || '')
    .split(/\r?\n/)
    .map(function (n) { return n.replace(/\\/g, '/'); });
  const missing = CORE_SOUND_FILES.filter(function (rel) {
    return !names.some(function (n) {
      return n === rel || n.slice(-rel.length) === rel;
    });
  });
  if (missing.length) {
    throw new Error('В zip нет звуков мотора/шин: ' + missing.join(', '));
  }
}

/**
 * Исключения bsdtar: референсы, заметки, бэкапы машин.
 * @returns {string[]}
 */
function tarZipExcludeArgs() {
  const args = [];
  for (const pattern of TAR_EXCLUDES) {
    args.push('--exclude', pattern);
  }
  return args;
}

module.exports = {
  ensureContent,
  GAME_ROOT,
  ROOT_FILES,
  CORE_SOUND_FILES,
  assertCoreSounds,
  listContentMembers,
  tarZipExcludeArgs,
  assertZipCoreSounds
};

if (require.main === module) {
  const unpacked = process.argv[2];
  if (!unpacked) {
    console.error('Укажите папку win-unpacked');
    process.exit(1);
  }
  ensureContent(path.resolve(unpacked));
}
