// Совместимое расширение актуального редактора без подмены библиотеки объектов старой копией.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const session = fs.readFileSync(path.join(__dirname, '../engine/editor/map-app.js'), 'utf8').replace(/\r\n/g, '\n');

/** Находит функцию с отступом уровня замыкания MapApp. */
function functionPattern(name) {
  return new RegExp('  (?:async )?function ' + name + '\\([^]*?\\n  \\}');
}
/** Заменяет единственный известный участок и обнаруживает несовместимое обновление. */
function replaceOnce(source, before, after) {
  if (source.split(before).length !== 2) throw new Error('Не найден однозначный контракт редактора: ' + before.slice(0, 70));
  return source.replace(before, () => after);
}
/** Добавляет историю и API документов, сохраняя новые инструменты исходного MapApp. */
function enhanceEditorScript(source) {
  let out = source.replace(/\r\n/g, '\n');
  if (out.includes('getDocument:cur')) return out;
  out = replaceOnce(out, 'let hist = {list: [], at: -1};', 'let hist = new StudioHistory();\n  const histories = new WeakMap();\n  const saved = new WeakMap();');
  for (const name of ['commit', 'undo', 'redo', 'select', 'saveNow']) {
    const pattern = functionPattern(name);
    const replacement = session.match(pattern)?.[0];
    if (!replacement || !pattern.test(out)) throw new Error('Нет функции редактора: ' + name);
    out = out.replace(pattern, () => replacement);
  }
  const helpers = ['syncHistory', 'importDocument', 'restoreDocument'].map(name => {
    const match = session.match(functionPattern(name));
    if (!match) throw new Error('Нет дополнения редактора: ' + name);
    return match[0];
  }).join('\n\n');
  out = replaceOnce(out, '  return {start, mapOn, saveNow, setTab};', helpers + '\n\n  return {start, mapOn, saveNow, setTab, getDocument:cur, importDocument, restoreDocument, commit};');
  out = replaceOnce(out, '    await saveNow();', '    if (!await saveNow()) return;');
  out = replaceOnce(out, "cur().name = $('mapName').value; dirty = true; fill();", "cur().name = $('mapName').value; dirty = true; renderList();");
  out = replaceOnce(out, '      const loaded = await MapData.loadAll();', '      const loaded = await MapData.loadAll();\n      loaded.forEach(d => saved.set(d, JSON.stringify(MapData.fileTrack(d))));');
  out = replaceOnce(out, "      try { await MapData.save(cur(), 'delete'); } catch (err) {}", `      try {
        const result = await MapData.save(cur(), 'delete');
        if (!result.ok) { $('mapSaveState').textContent = result.error; return; }
      } catch (err) { $('mapSaveState').textContent = 'Удаление не выполнено: ' + err.message; return; }
      try { localStorage.removeItem('rnr.studio.draft.' + cur().id); } catch (err) {}`);
  out = replaceOnce(out, '      select(Math.max(0, idx - 1));', '      hist = new StudioHistory();\n      select(Math.max(0, idx - 1));');
  out = replaceOnce(out, '    bind();', `    bind();
    document.addEventListener('change', e => {
      if (e.target.closest('#workMap')) setTimeout(() => commit(), 0);
    });
    window.addEventListener('beforeunload', e => {
      commit();
      if (docs.some(d => JSON.stringify(MapData.fileTrack(d)) !== saved.get(d))) { e.preventDefault(); e.returnValue = ''; }
    });`);
  new vm.Script(out, {filename:'editor/map-app.js'});
  return out;
}
module.exports = {enhanceEditorScript};
