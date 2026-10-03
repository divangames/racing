'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function boot() {
  const context = { state: 'title', gt: 10, selTitle: 0, lastMusicCat: 'cast',
    fetch: async () => ({ ok: true, text: async () => 'Разработчик\nИван Радыгин', blob: async () => ({}) }),
    Image: function () {}, URL: { createObjectURL: () => 'blob:image' },
    MUSIC: { list: cat => [cat + '.mp3'], play(cat) { this.category = cat; }, stop() { this.stopped = true; } },
    DiVANEngine: { titleMenu: { reset() {} } },
    enterTitle() { context.state = 'title'; } };
  context.window = context;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/engine/credits.js'), 'utf8'), context);
  return context;
}
test('Титры сохраняют имена и убирают служебные разделители', () => {
  const c = boot();
  assert.deepEqual(Array.from(c.DiVANEngine.credits.parse('\uFEFFРазработчик\r\nИван Радыгин\r\n=======\n Янот ')),
    ['Разработчик', 'Иван Радыгин', '', 'Янот']);
});
test('Музыка титров переключается отдельно и возвращается к меню', () => {
  const c = boot(), credits = c.DiVANEngine.credits;
  credits.open(); assert.equal(c.state, 'developers'); assert.equal(c.MUSIC.category, 'developers');
  assert.deepEqual(Array.from(c.MUSIC.list('developers')), ['assets/data/cats/Titles/cast/01.mp3']);
  assert.deepEqual(Array.from(c.MUSIC.list('garage')), ['garage.mp3']);
  credits.close(); assert.equal(c.state, 'title'); assert.equal(c.MUSIC.category, 'cast');
  assert.equal(c.MUSIC.stopped, true); assert.equal(c.selTitle, 4);
});
test('Камера чередует приближение, отдаление и направления без выхода за изображение', () => {
  const camera = boot().DiVANEngine.credits.camera;
  for (let shot = 0; shot < 20; shot++) {
    const a = camera(shot, 0), b = camera(shot, 1);
    assert.equal(Math.sign(b.zoom - a.zoom), shot % 2 ? -1 : 1);
    assert.equal(a.x, -b.x); assert.equal(a.y, -b.y);
    for (let p = 0; p <= 1; p += .01) {
      const c = camera(shot, p); assert(c.zoom >= 1.08 && c.zoom <= 1.24);
      assert(Math.abs(c.x) <= 1 && Math.abs(c.y) <= 1);
    }
  }
});
