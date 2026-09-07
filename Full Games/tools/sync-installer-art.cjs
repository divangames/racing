////////////////////////////////////////////////////////
//
// Копирует арт установщика из assets/install в build/msi.
//
////////////////////////////////////////////////////////

'use strict';

const fs = require('fs');
const path = require('path');

const client = path.resolve(__dirname, '..');
const src = path.resolve(client, '..', 'assets', 'install');
const dest = path.join(client, 'build', 'msi');
const names = [
  'banner.bmp',
  'dialog.bmp',
  'icon.ico',
  'exclamation.ico',
  'info.ico',
  'newfolder.ico',
  'upfolder.ico'
];

fs.mkdirSync(dest, { recursive: true });
let copied = 0;
for (const name of names) {
  const from = path.join(src, name);
  if (!fs.existsSync(from)) continue;
  fs.copyFileSync(from, path.join(dest, name));
  copied += 1;
}
console.log('Арт установщика:', copied, 'файлов →', dest);
