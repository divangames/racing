////////////////////////////////////////////////////////
//
// Копирует Three и quarks из десктопного контента в vendor-local.
//
////////////////////////////////////////////////////////

'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const parent = path.resolve(root, require('../config/game.json').contentDevRelative);
const dest = path.join(root, 'vendor-local');

const copies = [
  [path.join(parent, 'vendor', 'three.module.js'), 'three.module.js'],
  [path.join(parent, 'vendor', 'three.quarks.esm.js'), 'three.quarks.esm.js'],
  [path.join(root, 'node_modules', 'quarks.core', 'dist', 'quarks.core.esm.js'), 'quarks.core.esm.js']
];

fs.mkdirSync(dest, { recursive: true });

for (const [from, name] of copies) {
  if (!fs.existsSync(from)) {
    console.warn('Нет файла, пропуск:', from);
    continue;
  }
  fs.copyFileSync(from, path.join(dest, name));
  console.log('Скопирован', name);
}
