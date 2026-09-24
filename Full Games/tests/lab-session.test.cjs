// Проверяет тест черновика, возврат документов и безопасный отказ без записи трасс.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/** Возвращает независимый документ, пригодный для настоящего валидатора трассы. */
function track(id, name) {
  return { id, name, cps: [[0, 0], [1000, 0], [1000, 1000], [0, 1000]], objects: [], hazards: {} };
}

/** Клонирует данные между имитацией диска и сеансами страницы. */
function clone(value) { return JSON.parse(JSON.stringify(value)); }

/** Создаёт страницу редактора с общим временным хранилищем и изолированными документами. */
function editorPage(disk, storage = new Map(), href = 'rnr://game/Editor.html?tab=map&car=2') {
  let url = new URL(href), selected = 0, docs = clone(disk), selection = null, tool = 'select', writes = 0;
  const baselines = new WeakMap(), histories = new WeakMap(), field = { textContent: '' };
  const location = {
    get href() { return url.href; }, set href(value) { url = new URL(value, url); },
    get search() { return url.search; }
  };
  const context = {
    console, URL, URLSearchParams, location, crypto: { randomUUID: () => 'test-token' },
    history: { replaceState(_state, _title, href) { location.href = href; } },
    setTimeout(callback) { callback(); },
    sessionStorage: {
      getItem: key => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key)
    },
    document: { getElementById: () => field },
    MapData: {
      ID_RE: /^[a-z0-9_]{2,40}$/, fileTrack: clone,
      save() { writes++; throw new Error('Тест не должен сохранять трассу'); }
    },
    RnRTracks: { normalize: clone },
    MapView: {
      selection: () => selection, setSelection: value => { selection = value; },
      tool: () => tool, setTool: value => { tool = value; }, draw() {}
    }
  };
  context.window = context;
  vm.createContext(context);
  for (const name of ['editor/history.js', 'lab-session.js', 'editor/test-session.js']) {
    vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../src/engine', name), 'utf8'), context);
  }
  const workbench = fs.readFileSync(path.resolve(__dirname, '../src/engine/editor/workbench.js'), 'utf8');
  vm.runInContext(workbench.slice(0, workbench.indexOf('(() => {')), context);
  const newHistory = () => vm.runInContext('new StudioHistory()', context);
  const adapter = {
    documents: () => docs, current: () => docs[selected], baseline: doc => baselines.get(doc),
    history: doc => histories.get(doc),
    commit() {
      const doc = docs[selected], history = histories.get(doc) || newHistory();
      history.record(JSON.stringify(doc)); histories.set(doc, history);
    },
    restoreBaseline: (doc, baseline) => baselines.set(doc, baseline),
    restoreHistory: (doc, history) => histories.set(doc, history),
    replaceDocuments: next => { docs = next; selected = 0; },
    select: id => { selected = docs.findIndex(doc => doc.id === id); adapter.commit(); },
    setToolUi() {}
  };
  docs.forEach(doc => baselines.set(doc, JSON.stringify(doc)));
  adapter.commit();
  const controller = context.StudioTestSession.create(adapter);
  return { context, controller, adapter, storage, field, get writes() { return writes; } };
}

/** Подключает игровой хук к странице с тем же хранилищем. */
function attachGame(page, diskTrack) {
  const context = page.context;
  context.resolveLabTrack = () => clone(diskTrack);
  context.exitLabTest = () => { context.location.href = 'Editor.html'; };
  context.DiVANEngine = { wrap(name, factory) { context[name] = factory(context[name]); } };
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/lab-preview.js'), 'utf8'), context);
}

test('Тест существующей трассы берёт черновик, обычный заезд продолжает брать диск', () => {
  const disk = track('custom_01', 'С диска');
  const page = editorPage([disk]);
  page.adapter.current().name = 'Из черновика';
  page.adapter.current().cps[1][0] = 1400;
  assert.equal(page.controller.start(), true);
  assert.equal(page.writes, 0);
  assert.equal(page.controller.leaving, true);
  attachGame(page, disk);
  assert.equal(page.context.resolveLabTrack().name, 'Из черновика');
  assert.equal(page.context.resolveLabTrack().cps[1][0], 1400);
  page.context.location.href = 'rnr.html?lab=1&from=map&track=custom_02&preview=test-token';
  assert.throws(() => page.context.resolveLabTrack(), /Черновик теста недоступен/);
  page.context.location.href = 'rnr.html?lab=1&track=custom_01';
  assert.equal(page.context.resolveLabTrack().name, 'С диска');
});

test('Возврат сохраняет новую карту, несохранённые правки и ветку redo нескольких документов', () => {
  const disk = [track('custom_01', 'Первая'), track('custom_02', 'Вторая')];
  const page = editorPage(disk);
  page.adapter.current().name = 'Первая — черновик'; page.adapter.commit();
  page.adapter.current().name = 'Первая — следующая правка'; page.adapter.commit();
  const firstHistory = page.adapter.history(page.adapter.current());
  firstHistory.at--;
  Object.assign(page.adapter.current(), JSON.parse(firstHistory.list[firstHistory.at]));
  const fresh = track('custom_03', 'Ещё не сохранена');
  page.adapter.documents().push(fresh); page.adapter.select(fresh.id);
  page.adapter.current().cps[0][0] = 120; page.adapter.commit();
  page.context.MapView.setTool('cp'); page.context.MapView.setSelection({ kind: 'cp', i: 0 });
  assert.equal(page.controller.start(), true);
  attachGame(page, disk[0]);
  assert.equal(page.context.resolveLabTrack().id, 'custom_03');
  page.context.exitLabTest();
  const updatedDisk = clone(disk); updatedDisk[0].name = 'Внешняя правка на диске';
  const returned = editorPage(updatedDisk, page.storage, page.context.location.href);
  assert.equal(returned.controller.restore(), true);
  assert.equal(returned.adapter.current().name, 'Ещё не сохранена');
  assert.equal(returned.adapter.current().cps[0][0], 120);
  assert.equal(returned.adapter.baseline(returned.adapter.current()), undefined);
  assert.equal(returned.context.MapView.selection().i, 0);
  assert.equal(returned.context.MapView.tool(), 'cp');
  returned.adapter.select('custom_01');
  assert.equal(returned.adapter.current().name, 'Первая — черновик');
  const history = returned.adapter.history(returned.adapter.current());
  assert.equal(history.at, 1);
  assert.equal(JSON.parse(history.list[history.at + 1]).name, 'Первая — следующая правка');
  assert.equal(JSON.parse(returned.adapter.baseline(returned.adapter.current())).name, 'Внешняя правка на диске');
  assert.equal(returned.storage.size, 0);
  assert.equal(new URL(returned.context.location.href).searchParams.has('preview'), false);
  assert.equal(returned.writes, 0);
});

test('Некорректная трасса и переполненное хранилище оставляют автора в редакторе', () => {
  const page = editorPage([track('custom_01', 'Карта')]);
  const href = page.context.location.href;
  page.adapter.current().cps = [[0, 0], [0, 0], [0, 0], [0, 0]];
  assert.equal(page.controller.start(), false);
  assert.match(page.field.textContent, /четыре различные точки/);
  Object.assign(page.adapter.current(), track('custom_01', 'Карта'));
  page.context.sessionStorage.setItem = () => {
    const error = new Error('Quota'); error.name = 'QuotaExceededError'; throw error;
  };
  assert.equal(page.controller.start(), false);
  assert.match(page.field.textContent, /не хватает места/);
  assert.equal(page.context.location.href, href);
  assert.equal(page.controller.leaving, false);
  assert.equal(page.writes, 0);
});

test('Повреждённый снимок не заменяет документы частично и не удаляется автоматически', () => {
  const disk = [track('custom_01', 'Первая'), track('custom_02', 'Вторая')];
  const page = editorPage(disk);
  const session = page.context.DiVANLabSession.write({ activeId: 'custom_01', documents: [
    { track: track('custom_01', 'Черновик'), history: null },
    { track: disk[1], history: { list: ['not json'], at: 0 } }
  ] });
  page.context.location.href = 'Editor.html?track=custom_01&preview=' + session.token;
  assert.equal(page.controller.restore(), false);
  assert.equal(page.adapter.documents()[0].name, 'Первая');
  assert.equal(page.storage.size, 1);
  assert.match(page.field.textContent, /Возврат из теста/);
});
