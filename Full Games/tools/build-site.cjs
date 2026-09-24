'use strict';

// На Pages публикуется презентация и иллюстрации, без кода игры и редактора.
const fs = require('node:fs');
const path = require('node:path');
const MEDIA = /\.(png|jpe?g|webp|gif|svg|ico|woff2?|otf|ttf|css)$/i;
function buildSite(root, output) {
  root = path.resolve(root);
  output = path.resolve(output);
  if (output === root || root.startsWith(output + path.sep)) throw new Error('Нужен отдельный каталог сайта.');
  // Отдельный чистый каталог не позволяет старому rnr.html попасть в публикацию.
  if (fs.existsSync(output) && fs.readdirSync(output).length) throw new Error('Каталог сайта должен быть пустым: ' + output);
  fs.mkdirSync(output, { recursive: true });
  for (const name of ['index.html', 'rnr.html', 'Editor.html', '.nojekyll', 'site', 'dizdoc']) {
    const source = path.join(root, name);
    if (!fs.existsSync(source)) continue;
    if (/^(rnr|Editor)\.html$/.test(name) && !fs.readFileSync(source, 'utf8').includes('desktop-only-redirect')) continue;
    fs.cpSync(source, path.join(output, name), { recursive: true });
  }
  for (const name of ['image', 'fonts', 'HUD/cursor', 'data/players', 'data/cars', 'data/cats/00']) {
    const source = path.join(root, 'assets', name);
    if (!fs.existsSync(source)) continue;
    fs.cpSync(source, path.join(output, 'assets', name), { recursive: true,
      filter: file => fs.statSync(file).isDirectory() || MEDIA.test(file) });
  }
  return output;
}
if (require.main === module) console.log(buildSite(path.resolve(__dirname, '../..'), process.argv[2] || path.resolve(__dirname, '../build/site-preview')));
module.exports = { buildSite };
