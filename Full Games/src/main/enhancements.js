// Подключение модулей десктоп-движка к исходной игре и лаборатории.
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../engine');

/** Возвращает локальный модуль или подмену редактора, не выходя за каталог. */
function engineFile(rel) {
  const name = rel.startsWith('__engine/') ? rel.slice(9) : null;
  if (!name) return null;
  const file = path.resolve(ROOT, name);
  const relative = path.relative(ROOT, file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return fs.existsSync(file) && fs.statSync(file).isFile() ? file : null;
}

/** Подключает модули после исходных скриптов, сохраняя единый игровой контекст. */
function enhanceHtml(html) {
  const editor = html.includes('id="workMap"');
  const game = html.includes('function stepVehicle(');
  if (!editor && !game) return html;
  const files = editor ? ['editor/workbench.js'] : ['driving.js', 'audio.js', 'soundtrack.js', 'loop.js', 'presentation.js'];
  const scripts = files.map(file => `<script src="/__engine/${file}"></script>`).join('\n');
  let result = html.replace('</body>', `${scripts}\n</body>`);
  if (editor) result = result.replace('<script src="editor/map-app.js', '<script src="/__engine/editor/history.js"></script>\n<script src="editor/map-app.js');
  if (editor) result = result.replace('</head>', '<link rel="stylesheet" href="/__engine/editor/workbench.css"></head>');
  return result;
}
module.exports = {engineFile, enhanceHtml};
