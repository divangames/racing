'use strict';

// Картинки, звук и авторские документы хранятся один раз в общей библиотеке.
// Код игры и редактора принадлежит только десктопному приложению.
const fs = require('node:fs');
const path = require('node:path');
const client = path.resolve(__dirname, '..');
const content = path.resolve(client, require('../config/game.json').contentDevRelative);

function prepareContent() {
  const assets = path.join(content, 'assets');
  if (fs.existsSync(assets)) return assets;
  const shared = path.resolve(client, '../assets');
  if (!fs.existsSync(shared)) throw new Error('Нет библиотеки ассетов: ' + shared);
  fs.mkdirSync(content, { recursive: true });
  // После переноса папки Windows-стык может ссылаться на прежний абсолютный путь.
  const previous = fs.lstatSync(assets, { throwIfNoEntry: false });
  if (previous) {
    if (!previous.isSymbolicLink()) throw new Error('Не удалось прочитать библиотеку: ' + assets);
    fs.rmSync(assets, { force: true }); // Только сам сломанный стык, без обхода цели.
  }
  fs.symlinkSync(shared, assets, process.platform === 'win32' ? 'junction' : 'dir');
  return assets;
}

if (require.main === module) console.log('Библиотека контента:', prepareContent());
module.exports = { prepareContent };
