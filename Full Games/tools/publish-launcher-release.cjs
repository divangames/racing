////////////////////////////////////////////////////////
//
// Заливка MSI лаунчера на тег launcher-*.
//
////////////////////////////////////////////////////////

'use strict';

const fs = require('fs');
const path = require('path');
const { publishRelease } = require('./publish-github-release.cjs');

const client = path.resolve(__dirname, '..');

/**
 * Точка входа батника.
 */
async function main() {
  const cfg = JSON.parse(fs.readFileSync(path.join(client, 'config', 'update.json'), 'utf8'));
  const launcher = JSON.parse(fs.readFileSync(path.join(client, 'config', 'launcher.json'), 'utf8'));
  const ver = String(launcher.version);
  const tag = 'launcher-' + ver;
  const msiName = 'KolesnicaVoyny-' + ver + '.msi';
  const candidates = [
    path.join(client, 'dist', msiName),
    path.join(client, 'out-msi', msiName)
  ];
  const msiPath = candidates.find((file) => fs.existsSync(file));
  if (!msiPath) throw new Error('Нет установщика: ' + msiName);
  const repo = cfg.owner + '/' + cfg.repo;
  console.log('MSI:', msiPath);
  console.log('Тег:', tag);
  const result = await publishRelease({
    repo,
    tag,
    filePath: msiPath,
    title: 'Лаунчер ' + ver,
    notes: 'Установщик лаунчера. Игра качается отдельно тегом game-* (zip kolesnica-content).',
    contentType: 'application/octet-stream'
  });
  console.log('Релиз ' + tag + ' готов (' + result.via + ').');
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message || String(err));
    process.exit(1);
  });
}
