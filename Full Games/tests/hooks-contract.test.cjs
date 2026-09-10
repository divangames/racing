////////////////////////////////////////////////////////
//
// Каждый replace/wrap движка должен совпасть с function в контенте.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const ENGINE = path.resolve(__dirname, '../src/engine');
const CFG = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../config/engine.json'), 'utf8'));

/** Имена хуков из модулей хоста. */
function hookNames(scripts) {
  const names = new Set();
  for (const file of scripts) {
    const src = fs.readFileSync(path.join(ENGINE, file), 'utf8');
    for (const m of src.matchAll(/(?:engine|DiVANEngine)\.(?:replace|wrap)\(\s*['"]([^'"]+)['"]/g)) {
      names.add(m[1]);
    }
  }
  return [...names].sort();
}

/** Текст контента, где живут исходные function. */
function contentBlob() {
  const files = [
    'rnr.html', 'career.js', 'combat-kits.js', 'starter-kits.js', 'mid-kits.js',
    'armory.js', 'chars.js', 'voice.js', 'music.js', 'sounds.js'
  ];
  return files.map(function (f) {
    return fs.readFileSync(path.join(ROOT, f), 'utf8');
  }).join('\n');
}

test('Каждый хук заезда есть function в контенте', () => {
  const names = hookNames(CFG.hosts.game.scripts);
  assert.ok(names.length > 40, 'мало хуков: ' + names.length);
  const blob = contentBlob();
  const missing = names.filter(function (n) {
    return !new RegExp('function\\s+' + n + '\\s*\\(').test(blob);
  });
  assert.deepEqual(missing, [], 'нет function: ' + missing.join(', '));
});

test('Файлы engine.json лежат в src/engine', () => {
  for (const file of CFG.hosts.game.scripts) {
    assert.ok(fs.existsSync(path.join(ENGINE, file)), file);
  }
});
