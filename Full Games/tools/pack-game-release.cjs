////////////////////////////////////////////////////////
//
// Zip игры для GitHub Releases: без второй копии и без deflate.
// WebP и музыка уже сжаты — store быстрее, размер почти тот же.
//
////////////////////////////////////////////////////////

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  GAME_ROOT,
  listContentMembers,
  tarZipExcludeArgs,
  assertCoreSounds,
  assertZipCoreSounds
} = require('./ensure-content.cjs');

const DEFAULT_CLIENT = path.resolve(__dirname, '..');
const LIMIT = 1.9 * 1024 * 1024 * 1024;

/**
 * Пишет install.json и копию манифеста во временную папку.
 * @param {string} overlayDir
 * @param {{version: string, clientDir: string}} opts
 */
function writeOverlay(overlayDir, opts) {
  fs.mkdirSync(overlayDir, { recursive: true });
  fs.writeFileSync(
    path.join(overlayDir, 'install.json'),
    JSON.stringify({
      version: opts.version,
      tag: 'game-' + opts.version,
      packedAt: new Date().toISOString()
    }, null, 2) + '\n'
  );
  const manifestSrc = path.join(opts.clientDir, 'manifest', 'integrity.json');
  if (fs.existsSync(manifestSrc)) {
    fs.copyFileSync(manifestSrc, path.join(overlayDir, 'desktop-manifest.json'));
  }
}

/**
 * Собирает zip прямо из папки игры, без staging-копии.
 * @param {{clientDir?: string, gameRoot?: string, version?: string, zipPath?: string}} [opts]
 * @returns {string} путь к zip
 */
function packGameRelease(opts) {
  const clientDir = opts && opts.clientDir ? opts.clientDir : DEFAULT_CLIENT;
  const gameRoot = opts && opts.gameRoot ? opts.gameRoot : GAME_ROOT;
  const game = require(path.join(clientDir, 'config', 'game.json'));
  const version = (opts && opts.version) || game.version;
  const dist = path.join(clientDir, 'dist');
  const zipName = 'kolesnica-content-' + version + '.zip';
  const zipPath = (opts && opts.zipPath) || path.join(dist, zipName);
  const overlayDir = path.join(dist, 'game-zip-meta');
  const leftoverStage = path.join(dist, 'game-stage');

  const members = listContentMembers(gameRoot);
  if (!members.includes('rnr.html')) {
    throw new Error('Нет rnr.html в ' + gameRoot);
  }
  if (!fs.existsSync(path.join(gameRoot, 'assets', 'image', 'game-logo.webp'))) {
    throw new Error('Нет логотипа в ' + gameRoot);
  }
  const editorHtml = path.join(gameRoot, 'Editor.html');
  if (fs.existsSync(editorHtml) && !fs.readFileSync(editorHtml, 'utf8').includes('id="labAudio"')) {
    throw new Error('Editor.html без панели звука двигателя');
  }
  assertCoreSounds(gameRoot);

  fs.mkdirSync(path.dirname(zipPath), { recursive: true });
  if (fs.existsSync(leftoverStage)) {
    fs.rmSync(leftoverStage, { recursive: true, force: true });
  }
  if (fs.existsSync(overlayDir)) fs.rmSync(overlayDir, { recursive: true, force: true });
  writeOverlay(overlayDir, { version, clientDir });
  if (fs.existsSync(zipPath)) fs.rmSync(zipPath, { force: true });

  console.log('Пакую zip без повторного копирования и без сжатия...');
  const packed = spawnSync(
    'tar',
    [
      '--options',
      'zip:compression=store',
      '-a',
      '-cf',
      zipPath,
      ...tarZipExcludeArgs(),
      '-C',
      gameRoot,
      ...members,
      '-C',
      overlayDir,
      'install.json',
      ...(fs.existsSync(path.join(overlayDir, 'desktop-manifest.json')) ? ['desktop-manifest.json'] : [])
    ],
    {
      encoding: 'utf8',
      windowsHide: true
    }
  );
  if (packed.status !== 0) {
    const err = packed.stderr || packed.stdout || 'tar не собрал zip';
    fs.rmSync(overlayDir, { recursive: true, force: true });
    throw new Error(String(err).trim());
  }
  fs.rmSync(overlayDir, { recursive: true, force: true });
  assertZipCoreSounds(zipPath);

  const size = fs.statSync(zipPath).size;
  console.log('Архив:', zipPath);
  console.log('Размер:', (size / (1024 * 1024)).toFixed(1), 'МБ');
  if (size > LIMIT) {
    console.warn('GitHub принимает файл до 2 ГБ. Разбей контент на части или урежь ассеты.');
  }
  console.log('Тег релиза: game-' + version);
  return zipPath;
}

if (require.main === module) {
  try {
    packGameRelease({});
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
}

module.exports = { packGameRelease };
