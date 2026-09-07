////////////////////////////////////////////////////////
//
// Качает WiX и 7zip через gh в кэш electron-builder.
// Обход обрыва TLS у got при сборке MSI.
//
////////////////////////////////////////////////////////

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const CACHE = process.env.ELECTRON_BUILDER_CACHE
  || path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'electron-builder', 'Cache');

const FILES = [
  {
    tag: '7zip@1.0.0',
    name: '7zip-win-x64.tar.gz',
    sha256: 'be071f15bd6da2f78fe81c6ddef2009b0c4d8a51f36b780cb806c7e6df95e1b3'
  },
  {
    tag: 'wix-4.0.0.5512.2',
    name: 'wix-4.0.0.5512.2.7z',
    sha256: 'fe677fcd837b18c9b912985d91636bbd8a1e800c3b3a6a841b6f96e89624e839'
  }
];

const REPO = 'electron-userland/electron-builder-binaries';

/**
 * SHA-256 файла.
 * @param {string} file
 * @returns {string}
 */
function hashFile(file) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(file));
  return hash.digest('hex');
}

/**
 * Скачивает актив релиза, сначала прямым URL, потом gh.
 * @param {object} item
 * @param {string} dest
 */
function download(item, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest) && hashFile(dest) === item.sha256) {
    console.log('Уже в кэше:', item.name);
    return;
  }
  const url = 'https://github.com/' + REPO + '/releases/download/' + encodeURIComponent(item.tag).replace('%40', '@') + '/' + item.name;
  let lastErr = '';
  for (let i = 1; i <= 6; i++) {
    console.log('Качаю', item.name, '(попытка ' + i + ')');
    const tmp = dest + '.part';
    if (fs.existsSync(tmp)) fs.rmSync(tmp, { force: true });
    const curl = spawnSync(
      'curl.exe',
      ['-L', '--retry', '5', '--retry-delay', '2', '--retry-all-errors', '--connect-timeout', '30', '-f', '-o', tmp, url],
      { encoding: 'utf8', windowsHide: true }
    );
    if (curl.status === 0 && fs.existsSync(tmp) && hashFile(tmp) === item.sha256) {
      fs.renameSync(tmp, dest);
      console.log('Готово:', dest);
      return;
    }
    lastErr = (curl.stderr || curl.stdout || '').trim() || ('curl код ' + curl.status);
    if (fs.existsSync(tmp)) fs.rmSync(tmp, { force: true });
    const gh = spawnSync(
      'gh',
      ['release', 'download', item.tag, '--repo', REPO, '--pattern', item.name, '--dir', path.dirname(dest), '--clobber'],
      { encoding: 'utf8', windowsHide: true }
    );
    if (gh.status === 0 && fs.existsSync(dest) && hashFile(dest) === item.sha256) {
      console.log('Готово через gh:', dest);
      return;
    }
    lastErr = lastErr + ' | ' + ((gh.stderr || gh.stdout || '').trim() || ('gh код ' + gh.status));
    console.warn(lastErr);
  }
  throw new Error('Не скачался ' + item.name + ': ' + lastErr);
}

for (const item of FILES) {
  const dest = path.join(CACHE, item.tag, item.name);
  download(item, dest);
}
console.log('Кэш electron-builder:', CACHE);
