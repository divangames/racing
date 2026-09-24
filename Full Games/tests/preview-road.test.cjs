'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { enhanceHtml } = require('../src/main/enhancements');

test('car preview uses the track asphalt after the legacy game script', () => {
  const html = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert.ok(html.indexOf('/__engine/track-strip.js') < html.indexOf('/__engine/preview-road.js'));

  const calls = [];
  const canvas = {
    drawImage() { calls.push('asphalt'); },
    fillRect() { calls.push('dash'); }
  };
  const world = {
    DiVANEngine: { trackStrip: { bakeRoadStrip(mat, color) {
      assert.equal(mat, 'asphalt');
      assert.equal(color, '#43404b');
      return {};
    } } }
  };
  world.window = world;
  vm.createContext(world);
  vm.runInContext('const g = canvas; let gt = 0.5; function drawPreviewRoad() { throw Error("legacy road"); }',
    Object.assign(world, { canvas }));
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/preview-road.js'), 'utf8'), world);
  world.drawPreviewRoad(400, 300, true, 0);
  assert.ok(calls.includes('asphalt'));
  assert.ok(calls.includes('dash'));
});
