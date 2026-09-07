////////////////////////////////////////////////////////
//
// Подпись Authenticode: SignTool ломает путь с кириллицей,
// поэтому файл и pfx копируются в %TEMP% (только ASCII).
//
////////////////////////////////////////////////////////

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

/**
 * Ищет signtool.exe в кэше electron-builder и Windows SDK.
 * @returns {string}
 */
function findSignTool() {
  const hits = [];
  const roots = [
    path.join(process.env.LOCALAPPDATA || '', 'electron-builder', 'Cache'),
    'C:\\Program Files (x86)\\Windows Kits\\10\\bin',
    'C:\\Program Files (x86)\\Windows Kits\\10\\App Certification Kit'
  ];
  /**
   * @param {string} dir
   * @param {number} depth
   */
  function walk(dir, depth) {
    if (depth < 0 || !fs.existsSync(dir)) return;
    let names;
    try {
      names = fs.readdirSync(dir);
    } catch (err) {
      return;
    }
    for (const name of names) {
      const full = path.join(dir, name);
      if (name.toLowerCase() === 'signtool.exe') hits.push(full);
      else {
        try {
          if (fs.statSync(full).isDirectory()) walk(full, depth - 1);
        } catch (err) {
          /* нет доступа */
        }
      }
    }
  }
  for (const root of roots) walk(root, 6);
  const prefer = hits.find((item) => /\\x64\\/i.test(item)) || hits[0];
  if (!prefer) throw new Error('Не найден signtool.exe. Поставь Windows SDK или собери MSI ещё раз, чтобы electron-builder скачал winCodeSign.');
  return prefer;
}

/**
 * Меняет путь файла и сертификата в аргументах SignTool на ASCII-копии.
 * @param {string[]} args
 * @param {string} stagedFile
 * @param {string} stagedPfx
 * @returns {string[]}
 */
function rewriteArgs(args, stagedFile, stagedPfx) {
  const next = args.slice();
  next[next.length - 1] = stagedFile;
  for (let i = 0; i < next.length; i++) {
    if (next[i] === '/f' && next[i + 1]) next[i + 1] = stagedPfx;
    if ((next[i] === '/tr' || next[i] === '/t') && (!next[i + 1] || next[i + 1] === 'null')) {
      next.splice(i, 2);
      i -= 1;
    }
  }
  if (process.env.ELECTRON_BUILDER_OFFLINE === 'true') {
    for (let i = 0; i < next.length; i++) {
      if (next[i] === '/tr' || next[i] === '/t' || next[i] === '/td') {
        const drop = next[i] === '/td' ? 2 : 2;
        next.splice(i, drop);
        i -= 1;
      }
    }
  }
  return next;
}

/**
 * Хука electron-builder: подписывает configuration.path.
 * @param {object} configuration
 */
module.exports = async function signWindows(configuration) {
  const src = configuration.path;
  if (!src || !fs.existsSync(src)) {
    throw new Error('Нет файла для подписи: ' + src);
  }
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'divan-sign-'));
  const stagedFile = path.join(stage, path.basename(src));
  const stagedPfx = path.join(stage, 'cert.pfx');
  fs.copyFileSync(src, stagedFile);
  const raw = configuration.computeSignToolArgs(true);
  const fromFlag = raw.indexOf('/f') >= 0 ? raw[raw.indexOf('/f') + 1] : '';
  const fromCert = configuration.cscInfo && configuration.cscInfo.file;
  const pfxSrc = [fromCert, fromFlag].find((item) => item && fs.existsSync(item));
  if (!pfxSrc) throw new Error('Нет pfx для подписи.');
  fs.copyFileSync(pfxSrc, stagedPfx);
  const args = rewriteArgs(raw, stagedFile, stagedPfx);
  const tool = findSignTool();
  const result = spawnSync(tool, args, { stdio: 'inherit', windowsHide: true });
  if (result.status !== 0) {
    throw new Error('SignTool вернул код ' + result.status + ' для ' + path.basename(src));
  }
  fs.copyFileSync(stagedFile, src);
  fs.rmSync(stage, { recursive: true, force: true });
};

module.exports.findSignTool = findSignTool;
module.exports.rewriteArgs = rewriteArgs;
