'use strict';

// Рабочая копия контента для десктопа; общую библиотеку ассетов не дублируем.
const fs = require('node:fs');
const path = require('node:path');
const { GAME_ROOT, ROOT_FILES } = require('./ensure-content.cjs');
const client = path.resolve(__dirname, '..');
const dest = path.resolve(process.argv[2] || path.join(client, 'dist-content'));
if (dest === GAME_ROOT || dest === client || GAME_ROOT.startsWith(dest + path.sep)) {
  throw new Error('Выберите отдельную папку для копии контента.');
}
fs.mkdirSync(dest, { recursive: true });
for (const name of [...ROOT_FILES, 'editor', 'vfx', 'vendor']) {
  const source = path.join(GAME_ROOT, name);
  if (fs.existsSync(source)) fs.cpSync(source, path.join(dest, name), { recursive: true });
}
const assets = path.join(dest, 'assets');
if (!fs.existsSync(assets)) {
  fs.symlinkSync(fs.realpathSync(path.join(GAME_ROOT, 'assets')), assets,
    process.platform === 'win32' ? 'junction' : 'dir');
}
console.log('Десктопный контент:', dest);
