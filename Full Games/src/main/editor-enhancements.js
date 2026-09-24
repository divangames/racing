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

/**
 * Глобальная const MapData доступна по имени, но не как свойство window.
 * Исправляет классификацию сюжетных трасс в актуальном редакторе контента.
 * @param {string} source
 * @returns {string}
 */
function fixChapterClassification(source) {
  return source.replace(
    'return !(window.MapData && MapData.isChapter && MapData.isChapter(d));',
    "return !(typeof MapData !== 'undefined' && MapData.isChapter && MapData.isChapter(d));"
  );
}
/** Добавляет историю и API документов, сохраняя новые инструменты исходного MapApp. */
function enhanceEditorScript(source) {
  let out = fixChapterClassification(source.replace(/\r\n/g, '\n'));
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
  const testAdapter = `  const testSession = window.StudioTestSession.create({
    documents: () => docs, current: cur, commit, setToolUi,
    history: doc => doc === docs[idx] ? hist : histories.get(doc),
    baseline: doc => saved.get(doc),
    restoreHistory: (doc, history) => histories.set(doc, history),
    restoreBaseline: (doc, baseline) => saved.set(doc, baseline),
    replaceDocuments: next => { docs = next; idx = 0; hist = new StudioHistory(); },
    select: id => select(Math.max(0, docs.findIndex(doc => doc.id === id)))
  });`;
  out = replaceOnce(out, '  return {start, mapOn, saveNow, setTab};', helpers + '\n\n' + testAdapter + '\n\n  return {start, mapOn, saveNow, setTab, getDocument:cur, importDocument, restoreDocument, commit};');
  const testDrive = out.match(functionPattern('testDrive'))?.[0];
  if (!testDrive) throw new Error('Нет функции редактора: testDrive');
  out = replaceOnce(out, testDrive, '  function testDrive() {\n    return testSession.start();\n  }');
  out = replaceOnce(out, '    applyStartDoc();', '    if (!testSession.restore()) applyStartDoc();');
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
      if (window.__mapFillLock) return;
      if (e.target.closest('#workMap')) setTimeout(() => { if (!window.__mapFillLock) commit(); }, 0);
    });
    window.addEventListener('beforeunload', e => {
      if (testSession.leaving) return;
      commit();
      if (docs.some(d => JSON.stringify(MapData.fileTrack(d)) !== saved.get(d))) { e.preventDefault(); e.returnValue = ''; }
    });`);
  new vm.Script(out, {filename:'editor/map-app.js'});
  return out;
}

/** Показывает ручки контрольных точек только во время правки геометрии. */
function enhanceMapViewScript(source) {
  const before = `    t.cps.forEach((p, i) => {
      ctx.fillStyle = st.sel && st.sel.kind === 'cp' && st.sel.i === i ? '#3d9eff' : '#ededed';
      ctx.beginPath();
      ctx.arc(p[0], p[1], (st.sel && st.sel.kind === 'cp' && st.sel.i === i ? 10 : 7) / cam.z, 0, TAU);
      ctx.fill();
    });`;
  const after = `    if (st.tool === 'point') t.cps.forEach((p, i) => {
      const selected = st.sel && st.sel.kind === 'cp' && st.sel.i === i;
      ctx.beginPath();
      ctx.arc(p[0], p[1], (selected ? 10 : 7) / cam.z, 0, TAU);
      ctx.fillStyle = selected ? '#ffd166' : '#87e7ef';
      ctx.fill();
      ctx.lineWidth = 2 / cam.z;
      ctx.strokeStyle = '#09202b';
      ctx.stroke();
    });`;
  let out = replaceOnce(source.replace(/\r\n/g, '\n'), before, after);
  out = replaceOnce(out, '    MapGizmo.draw(ctx, cam, MapGizmo.resolve(t, st.sel), st.gizmoHover);',
    "    if (!(st.tool === 'point' && st.sel && st.sel.kind === 'cp')) MapGizmo.draw(ctx, cam, MapGizmo.resolve(t, st.sel), st.gizmoHover);");
  new vm.Script(out, {filename:'editor/map-view.js'});
  return out;
}

/** В редакторе рисует пересечение на том же этаже, который получит заезд. */
function enhanceMapPreviewScript(source) {
  let out = source.replace(/\r\n/g, '\n');
  out = replaceOnce(out, "      (th.railSrc || '') + '|' + rw + '|' + lw + '|' + zs + '|' + S.length;",
    "      (th.railSrc || '') + '|' + rw + '|' + lw + '|' + zs + '|' + (t.crossingMode || '') + '|' + JSON.stringify(t.decks || []) + '|' + S.length;");
  out = replaceOnce(out, '    const T = { S: S, N: S.length, theme: t.theme || {}, zones: t.zones || [] };',
    `    const span = window.DiVANEngine && DiVANEngine.trackSpan;
    let decks = t.crossingMode === 'junction' ? [] : (span ? span.normalizeDecks(t.decks) : (t.decks || []));
    if (span && !decks.length && t.crossingMode !== 'junction') {
      decks = span.detectCrossingDecks(S, S.length, ROADW);
    }
    const T = { S: S, N: S.length, theme: t.theme || {}, zones: t.zones || [], decks };`);
  out = replaceOnce(out, "      if (typeof ribbon.paintDeck === 'function') ribbon.paintDeck(q, T, ROADW, 0);",
    "      if (typeof ribbon.paintDeck === 'function') {\n        ribbon.paintDeck(q, T, ROADW, 0);\n        if (decks.length) ribbon.paintDeck(q, T, ROADW, 1);\n      }");
  new vm.Script(out, {filename:'editor/map-preview.js'});
  return out;
}

module.exports = {enhanceEditorScript, enhanceMapViewScript, enhanceMapPreviewScript};
