'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function boot({ compact = true, developer = false, lab = false, width = 640, height = 360 } = {}) {
  const labels = [], frames = [], transforms = [], actions = [];
  const g = new Proxy({ fillText(text, x, y, maxWidth) { labels.push({ text, x, y, maxWidth, font: this.font }); },
    setTransform(...values) { transforms.push(values); } }, { get(target, key) { return key in target ? target[key] : () => {}; } });
  const c = { console, g, R: { phase: 'go', time: 5 }, P: {}, state: 'race', paused: true,
    pauseMenuIndex: 0, labTest: lab, settings: { graphics: { combatHud: compact }, controls: { pause: ['Escape'] } },
    viewS: Math.min(width / 1280, height / 720), hudFx: { hudX: 14, hudY: 6 },
    isDev: () => developer, isConfirm: key => key === 'Enter',
    sClick() {}, clearKeys() {}, tickHudFx() {}, addEventListener() {}, dmgRacer() {}, drawHUD() {},
    openSettings: () => actions.push('settings'), openAchievements: () => actions.push('achievements'),
    restartRace: () => actions.push('restart'), enterTrackPick: () => actions.push('tracks'),
    exitLabTest: () => actions.push('lab'), announce: message => actions.push(message),
    clamp: (n, lo, hi) => Math.max(lo, Math.min(hi, n)) };
  c.viewW = width / c.viewS; c.viewH = height / c.viewS;
  c.window = c; c.globalThis = c;
  c.DiVANEngine = { replace(name, fn) { c[name] = fn; }, wrap(name, factory) { c[name] = factory(c[name]); },
    recovery: { recover() { actions.push('recover'); return { ok: true }; } } };
  const load = name => vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine', name + '.js'), 'utf8'), c);
  for (const name of ['hud-cyber-kit', 'hud-cyber', 'extras', 'hud', 'press-nav', 'combat-hud']) load(name);
  c.DiVANEngine.cyberHud.draw = () => {};
  c.DiVANEngine.combatHud.drawMarkers = () => {};
  c.DiVANEngine.cyberKit.frame = (_c, x, y, w, h) => frames.push({ x, y, w, h });
  return { c, labels, frames, transforms, actions };
}

test('Оба HUD показывают реальный список паузы, стрелки и выделение совпадают на компактном экране', () => {
  for (const compact of [true, false]) for (const developer of [true, false]) for (const lab of [true, false]) {
    const { c, labels, frames, transforms, actions } = boot({ compact, developer, lab });
    const items = Array.from(c.pauseRaceItems()), ui = c.DiVANEngine.cyberHud.viewport();
    assert.equal(items.length, developer ? 7 : 6);
    assert.equal(items[1], 'ВЕРНУТЬСЯ НА ТРАССУ');
    assert.equal(items.at(-1), lab ? 'В ЛАБОРАТОРИЮ' : 'ВЫЙТИ ИЗ ГОНКИ');
    for (let i = 0; i < items.length; i++) {
      labels.length = 0; frames.length = 0; transforms.length = 0;
      c.drawHUD();
      assert.deepEqual(labels.slice(1, -1).map(row => row.text), items);
      const selected = labels[i + 1];
      assert.equal(frames.length, 1);
      assert.equal(frames[0].y + frames[0].h / 2, selected.y);
      assert.equal(frames[0].x + frames[0].w / 2, selected.x);
      assert.deepEqual(transforms.at(-1), [ui.scale, 0, 0, ui.scale, 0, 0]);
      assert.ok(labels[0].y + 24 < labels[1].y, 'заголовок не касается первой строки');
      assert.ok(labels.at(-1).y + 10 < ui.height, 'подсказка внутри экрана');
      c.DiVANEngine.pressNav.race('ArrowDown');
    }
    assert.equal(c.pauseMenuIndex, 0);
    c.DiVANEngine.pressNav.race('ArrowUp'); assert.equal(c.pauseMenuIndex, items.length - 1);
    c.DiVANEngine.pressNav.race('ArrowDown'); c.DiVANEngine.pressNav.race('ArrowDown');
    c.DiVANEngine.pressNav.race('Enter');
    assert.deepEqual(actions, ['recover']); assert.equal(c.paused, false);
    for (const [label, action] of [['НАСТРОЙКИ', 'settings'], ['ДОСТИЖЕНИЯ', 'achievements'], ['РЕСТАРТ ГОНКИ', 'restart']]) {
      c.paused = true; c.pauseMenuIndex = items.indexOf(label); c.DiVANEngine.pressNav.race('Enter');
      assert.equal(actions.at(-1), action, label);
    }
  }
});

test('Полный список с пунктом разработчика помещается в узкое или широкое окно', () => {
  const layout = boot().c.DiVANEngine.hud.pauseLayout;
  for (const [width, height] of [[320, 360], [800, 450], [1280, 720], [2560, 1080]]) for (const count of [6, 7]) {
    const box = layout(width, height, count);
    assert.ok(box.titleY - box.titleSize / 2 >= 0);
    assert.ok(box.titleY + box.titleSize / 2 < box.firstY - box.frameH / 2);
    assert.ok(box.step > box.frameH);
    assert.ok(box.frameX >= 0 && box.frameX + box.frameW <= width);
    assert.ok(box.firstY + (count - 1) * box.step + box.frameH / 2 < box.footerY - 6);
    assert.ok(box.footerY + 6 < height);
  }
});
