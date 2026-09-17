////////////////////////////////////////////////////////
//
// Заливка MSI лаунчера на тег launcher-*.
//
////////////////////////////////////////////////////////

'use strict';

const fs = require('fs');
const path = require('path');
const { publishRelease } = require('./publish-github-release.cjs');
const { updateLauncherDownloadLinks } = require('./update-launcher-download-links.cjs');

const client = path.resolve(__dirname, '..');

/**
 * Ищет уже собранный MSI этой версии.
 * @param {string} ver
 * @returns {string|null}
 */
function findLauncherMsi(ver) {
  const msiName = 'KolesnicaVoyny-' + ver + '.msi';
  const candidates = [
    path.join(client, 'dist', msiName),
    path.join(client, 'out-msi', msiName)
  ];
  return candidates.find((file) => fs.existsSync(file)) || null;
}

/**
 * Точка входа батника.
 */
async function main() {
  const cfg = JSON.parse(fs.readFileSync(path.join(client, 'config', 'update.json'), 'utf8'));
  const launcher = JSON.parse(fs.readFileSync(path.join(client, 'config', 'launcher.json'), 'utf8'));
  const ver = String(launcher.version);
  const tag = 'launcher-' + ver;
  const msiPath = findLauncherMsi(ver);
  if (!msiPath) throw new Error('Нет установщика: KolesnicaVoyny-' + ver + '.msi');
  const repo = cfg.owner + '/' + cfg.repo;
  console.log('MSI:', msiPath);
  console.log('Тег:', tag);
  const result = await publishRelease({
    repo,
    tag,
    filePath: msiPath,
    title: 'Лаунчер ' + ver,
    notes:
      'Установщик лаунчера Колесницы войны.\n\n' +
      'Уже установленный клиент сам находит тег `launcher-*`, качает этот MSI и ставит через msiexec.\n' +
      'Игра — отдельно, тег `game-*` (zip `kolesnica-content`).',
    contentType: 'application/octet-stream'
  });
  console.log('Релиз ' + tag + ' готов (' + result.via + ').');
  console.log('URL: https://github.com/' + repo + '/releases/tag/' + tag);
  console.log(
    'MSI: https://github.com/' +
      repo +
      '/releases/download/' +
      tag +
      '/' +
      path.basename(msiPath)
  );
  const links = updateLauncherDownloadLinks(ver);
  if (links.changed.length) {
    console.log('Ссылки на пейдже обновлены:', links.changed.join(', '));
  } else {
    console.log('Ссылки на пейдже уже совпадали с ' + ver + '.');
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message || String(err));
    process.exit(1);
  });
}

module.exports = { findLauncherMsi, main };
