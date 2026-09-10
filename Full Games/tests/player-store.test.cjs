////////////////////////////////////////////////////////
//
// Сейвы карьеры на диск, без Electron.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { enhanceHtml } = require('../src/main/enhancements');
const { get, set, remove, exportAll, validKey } = require('../src/main/player-store');

test('Ключи сейвов только префикса карьеры', () => {
  assert.equal(validKey('rnr_ru_v1'), true);
  assert.equal(validKey('rnr_ru_slots_3'), true);
  assert.equal(validKey('../escape'), false);
  assert.equal(validKey('rnr.carEditor.v1'), false);
});

test('Запись, чтение, снимок и удаление слота', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'divan-saves-'));
  try {
    assert.equal(set('rnr_ru_v1', '{"cash":1000,"race":0}', root), true);
    assert.equal(get('rnr_ru_v1', root), '{"cash":1000,"race":0}');
    assert.equal(set('bad key', '{}', root), false);
    const dump = exportAll(root);
    assert.equal(dump.rnr_ru_v1, '{"cash":1000,"race":0}');
    assert.equal(remove('rnr_ru_v1', root), true);
    assert.equal(get('rnr_ru_v1', root), null);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Снимок сейвов вставляется в head заезда', () => {
  const html = '<head></head><body></body>';
  const out = enhanceHtml(html, { pathname: '/rnr.html', storeDump: { rnr_ru_v1: '{"race":2}' } });
  assert(out.includes('__DIVAN_ENGINE_STORE__'));
  assert(out.includes('rnr_ru_v1'));
  assert(out.indexOf('__DIVAN_ENGINE_STORE__') < out.indexOf('</head>'));
  assert(out.includes('/__engine/storage.js'));
});

test('Игра читает карьеру через persistRead', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../rnr.html'), 'utf8');
  assert(html.includes('function persistRead('));
  assert(html.includes('function persistWrite('));
  assert(html.includes('DiVANEngine.storage'));
});
