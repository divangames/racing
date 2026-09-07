////////////////////////////////////////////////////////
//
// Проверка номера, который пишут в батник выкладки.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeVersion, isGameVersion } = require('../tools/set-game-version.cjs');

test('Срезает v и принимает четыре части', () => {
  assert.equal(normalizeVersion(' v0.2.1.0 '), '0.2.1.0');
  assert.equal(isGameVersion('0.2.1.0'), true);
  assert.equal(isGameVersion('0.2.1'), true);
  assert.equal(isGameVersion(''), false);
  assert.equal(isGameVersion('game-0.2.1'), false);
});

test('Четыре части для npm: 0.2.1.3 → 0.2.1-3', () => {
  const { toNpmVersion } = require('../tools/set-game-version.cjs');
  assert.equal(toNpmVersion('0.2.1'), '0.2.1');
  assert.equal(toNpmVersion('0.2.1.3'), '0.2.1-3');
  assert.equal(toNpmVersion('1'), '1.0.0');
});
