////////////////////////////////////////////////////////
//
// Копия рантайма и лаборатории: без «Материалы», git, батников.
//
////////////////////////////////////////////////////////

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const GAME_ROOT = path.resolve(__dirname, '..', require('../config/game.json').contentDevRelative);

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
  'assets/object',
  'assets/ui',
  'assets/video'
];

/** Доп. флаги robocopy для отдельных каталогов ассетов. */
const ASSET_COPY_EXTRA = {
  'assets/data': ['/XD', 'reference', '/XF', '*.md', 'car.backup.json'],
  'assets/machines': ['/XF', 'TEMP.svg']
};

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

/** Дисклеймер 21+ на заставке — без файла чёрный экран вместо арта. */
const CORE_UI_FILES = [
  'assets/ui/disclaimer/disclaimer-21plus.svg',
  'assets/video/divan_intro.mp4'
];

/** Фон титула: манифест и оба кадра Медведя. */
const CORE_TITLE_FILES = [
  'assets/data/cats/Titles/titles.json',
  'assets/data/cats/Titles/title-medved_1920x1080.webp',
  'assets/data/cats/Titles/title-medved_3440x1440.webp'
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
 * Проверяет дисклеймер и прочий UI, который читает заставка.
 * @param {string} gameRoot
 */
function assertCoreUi(gameRoot) {
  const missing = CORE_UI_FILES.filter(function (rel) {
    return !fs.existsSync(path.join(gameRoot, rel));
  });
  if (missing.length) {
    throw new Error('Нет UI заставки: ' + missing.join(', '));
  }
}

/**
 * Проверяет кадры главного меню.
 * @param {string} gameRoot
 */
function assertCoreTitles(gameRoot) {
  const missing = CORE_TITLE_FILES.filter(function (rel) {
    return !fs.existsSync(path.join(gameRoot, rel));
  });
  if (missing.length) {
    throw new Error('Нет фонов титула: ' + missing.join(', '));
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

  for (const dir of ASSET_DIRS) {
    const from = path.join(GAME_ROOT, dir);
    const to = path.join(dest, dir);
    copyDir(from, to, ASSET_COPY_EXTRA[dir] || []);
  }
  assertCoreSounds(dest);
  assertCoreUi(dest);
  assertCoreTitles(dest);

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
 * Читает имена файлов внутри zip.
 * @param {string} zipPath
 * @returns {string[]}
 */
function listZipNames(zipPath) {
  const listed = spawnSync('tar', ['-tf', zipPath], { encoding: 'utf8', windowsHide: true });
  if (listed.status !== 0) {
    throw new Error(String(listed.stderr || listed.stdout || 'Не прочитать zip').trim());
  }
  return String(listed.stdout || '')
    .split(/\r?\n/)
    .map(function (n) { return n.replace(/\\/g, '/'); })
    .filter(Boolean);
}

/**
 * Есть ли относительный путь в списке имён zip.
 * @param {string[]} names
 * @param {string} rel
 * @returns {boolean}
 */
function zipHasRel(names, rel) {
  return names.some(function (n) {
    return n === rel || n.slice(-rel.length) === rel;
  });
}

/**
 * Zip обязан содержать якоря мотора и шин, иначе лаунчер уедет без звука.
 * @param {string} zipPath
 */
function assertZipCoreSounds(zipPath) {
  const names = listZipNames(zipPath);
  const missing = CORE_SOUND_FILES.filter(function (rel) {
    return !zipHasRel(names, rel);
  });
  if (missing.length) {
    throw new Error('В zip нет звуков мотора/шин: ' + missing.join(', '));
  }
}

/**
 * Zip обязан содержать дисклеймер 21+, иначе заставка без арта.
 * @param {string} zipPath
 */
function assertZipCoreUi(zipPath) {
  const names = listZipNames(zipPath);
  const missing = CORE_UI_FILES.filter(function (rel) {
    return !zipHasRel(names, rel);
  });
  if (missing.length) {
    throw new Error('В zip нет UI заставки: ' + missing.join(', '));
  }
}

/**
 * Zip обязан содержать пластины титула, иначе меню без кадра каста.
 * @param {string} zipPath
 */
function assertZipCoreTitles(zipPath) {
  const names = listZipNames(zipPath);
  const missing = CORE_TITLE_FILES.filter(function (rel) {
    return !zipHasRel(names, rel);
  });
  if (missing.length) {
    throw new Error('В zip нет фонов титула: ' + missing.join(', '));
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
  ASSET_DIRS,
  CORE_SOUND_FILES,
  CORE_UI_FILES,
  CORE_TITLE_FILES,
  assertCoreSounds,
  assertCoreUi,
  assertCoreTitles,
  listContentMembers,
  tarZipExcludeArgs,
  assertZipCoreSounds,
  assertZipCoreUi,
  assertZipCoreTitles
};

if (require.main === module) {
  const unpacked = process.argv[2];
  if (!unpacked) {
    console.error('Укажите папку win-unpacked');
    process.exit(1);
  }
  ensureContent(path.resolve(unpacked));
}
