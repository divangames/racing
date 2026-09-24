////////////////////////////////////////////////////////
//
// После выкладки MSI: ссылки на пейдже → commit → push Pages.
//
////////////////////////////////////////////////////////

'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const { updateLauncherDownloadLinks } = require('./update-launcher-download-links.cjs');

const client = path.resolve(__dirname, '..');
const root = path.resolve(client, '..');

/**
 * git с safe.directory на корень Racing.
 * @param {string[]} args
 * @returns {ReturnType<typeof spawnSync>}
 */
function git(args) {
  return spawnSync(
    'git',
    ['-c', 'safe.directory=' + root.replace(/\\/g, '/')].concat(args),
    {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true
    }
  );
}

/**
 * Обновляет ссылки, коммитит и пушит main для GitHub Pages.
 * @param {string} [explicit]
 * @returns {{version: string, changed: string[], committed: boolean, pushed: boolean}}
 */
function publishLauncherPageLinks(explicit) {
  const result = updateLauncherDownloadLinks(explicit);
  const files = [
    'index.html',
    'README.md',
    'dizdoc/index.html',
    'Full Games/README.md'
  ];
  const add = git(['add', '--'].concat(files));
  if (add.status !== 0) {
    throw new Error((add.stderr || add.stdout || 'git add не удался').trim());
  }
  const status = git(['status', '--porcelain', '--'].concat(files));
  const pending = String(status.stdout || '').trim();
  if (!pending) {
    console.log('На пейдже ссылки уже актуальные, коммитить нечего.');
    return { version: result.version, changed: result.changed, committed: false, pushed: false };
  }
  const msg =
    'Пейдж: ссылки скачивания MSI лаунчера ' + result.version + '.';
  const commit = git(['commit', '--only', '-m', msg, '--'].concat(files));
  if (commit.status !== 0) {
    throw new Error((commit.stderr || commit.stdout || 'git commit не удался').trim());
  }
  console.log('Коммит:', msg);
  const push = git(['push', 'origin', 'main']);
  if (push.status !== 0) {
    throw new Error((push.stderr || push.stdout || 'git push не удался').trim());
  }
  console.log('Пуш main — GitHub Pages подхватит ссылки.');
  return { version: result.version, changed: result.changed, committed: true, pushed: true };
}

if (require.main === module) {
  try {
    const out = publishLauncherPageLinks(process.argv[2]);
    console.log('Версия на пейдже:', out.version);
  } catch (err) {
    console.error(err.message || String(err));
    process.exit(1);
  }
}

module.exports = { publishLauncherPageLinks };
