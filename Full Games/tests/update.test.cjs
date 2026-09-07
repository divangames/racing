////////////////////////////////////////////////////////
//
// Версии и формат прогресса без Electron.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isNewer, normalizeTag } = require('../src/main/update/version');
const { formatBytes, formatSpeed } = require('../src/main/update/format');
const { pickContentAsset } = require('../src/main/update/github');

test('Нормализует теги игры', () => {
  assert.equal(normalizeTag('v0.2.0'), '0.2.0');
  assert.equal(normalizeTag('game-0.2.1'), '0.2.1');
});

test('Видит более новый релиз', () => {
  assert.equal(isNewer('0.2.1', '0.2.0'), true);
  assert.equal(isNewer('0.2.1.0', '0.2.0'), true);
  assert.equal(isNewer('0.2.2.0', '0.2.1.9'), true);
  assert.equal(isNewer('0.2.0', '0.2.0'), false);
  assert.equal(isNewer('0.2.0', ''), true);
  assert.equal(isNewer('', '0.1.0'), false);
});

test('Формат размера и скорости', () => {
  assert.equal(formatBytes(500), '500 Б');
  assert.equal(formatSpeed(1024 * 1024), '1.0 МБ/с');
});

test('Выбирает zip контента из релиза', () => {
  const asset = pickContentAsset({
    assets: [
      { name: 'KolesnicaVoyny-0.2.0.msi' },
      { name: 'kolesnica-content-0.2.0.zip', browser_download_url: 'https://example' }
    ]
  });
  assert.equal(asset.name, 'kolesnica-content-0.2.0.zip');
});
