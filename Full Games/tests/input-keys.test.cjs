////////////////////////////////////////////////////////
//
// Код клавиши, подтверждение и сброс залипания.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { enhanceHtml, engineFile } = require('../src/main/enhancements');

const HOOKS = [
  'ctrlHeld', 'isEnter', 'isConfirm', 'isBack', 'codeFromEvent', 'clearKeys', 'blockBrowserKeys'
];

/** Песочница клавиш. */
function bootInput() {
  const g = {
    console,
    settings: { controls: { up: ['KeyW'] } },
    keys: { KeyW: true, KeyA: true }
  };
  HOOKS.forEach(function (n) { g[n] = function () {}; });
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/input.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает input до сцены', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/input.js'));
  assert(engineFile('__engine/input.js').endsWith('input.js'));
});

test('Numpad Enter, Esc из key, clearKeys, preventDefault', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../content/rnr.html'), 'utf8');
  assert(html.includes('function codeFromEvent('));
  const g = bootInput();
  assert.equal(g.isEnter('NumpadEnter'), true);
  assert.equal(g.isConfirm('Space'), true);
  assert.equal(g.isBack('Escape'), true);
  assert.equal(g.codeFromEvent({ key: 'Esc' }), 'Escape');
  assert.equal(g.codeFromEvent({ code: 'KeyZ', key: 'z' }), 'KeyZ');
  g.clearKeys();
  assert.equal(g.keys.KeyW, false);
  let n = 0;
  g.blockBrowserKeys({ preventDefault: function () { n++; }, ctrlKey: true }, 'KeyW');
  assert.ok(n >= 1);
});

test('Геймпад ведёт машину, меню получает фронты кнопок и отключение обнуляет ввод', () => {
  const g = bootInput();
  g.settings.controls.pause = ['Escape'];
  g.paused = false;
  const pad = { connected: true, axes: [0.7, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })) };
  let connected = true;
  g.navigator = { getGamepads: () => connected ? [pad] : [] };
  const events = [];
  const poll = (state, dt = 1 / 60) => g.DiVANEngine.input.pollPad(state, dt, code => events.push(code));
  pad.buttons[7] = { pressed: true, value: 0.8 };
  pad.buttons[0] = { pressed: true, value: 1 };
  poll('race');
  assert.equal(g.DiVANEngine.input.axis().throttle, 0.8);
  assert.ok(g.DiVANEngine.input.axis().steer > 0.6);
  assert.equal(g.ctrlHeld('fire'), true);
  assert.deepEqual(events, [], 'огонь не нажимает Enter во время заезда');
  pad.buttons[9] = { pressed: true, value: 1 };
  poll('race');
  poll('race');
  assert.deepEqual(events, ['Escape'], 'удержание Start даёт одну паузу');
  pad.buttons[9] = { pressed: false, value: 0 };
  pad.buttons[0] = { pressed: false, value: 0 };
  pad.buttons[13] = { pressed: true, value: 1 };
  poll('title');
  assert.equal(events.at(-1), 'ArrowDown');
  pad.buttons[13] = { pressed: false, value: 0 };
  pad.buttons[0] = { pressed: true, value: 1 };
  poll('title');
  assert.equal(events.at(-1), 'Enter');
  connected = false;
  g.keys.KeyW = false;
  poll('race');
  assert.equal(g.DiVANEngine.input.axis().throttle, 0);
  assert.equal(g.ctrlHeld('fire'), false);
});

test('Курки дозируют газ и тормоз независимо от диагонали стика; тормоз имеет приоритет', () => {
  const g = bootInput();
  g.clearKeys();
  const pad = { connected: true, mapping: 'standard', axes: [.7, 1], buttons: Array(16).fill(0) };
  g.navigator = { getGamepads: () => [pad] };
  const input = g.DiVANEngine.input;
  input.pollPad('race', 1 / 60);
  assert.equal(input.axis().throttle, 0, 'поворот по диагонали не включает задний ход');
  pad.buttons[7] = .4;
  assert.equal(input.axis().throttle, .4);
  pad.axes[1] = -1;
  assert.equal(input.axis().throttle, .4, 'наклон вперёд не добавляет газ');
  pad.buttons[6] = .65;
  assert.equal(input.axis().throttle, -.65, 'тормоз работает и при зажатом газе');
  assert.ok(input.axis().steer > .6);
  pad.buttons[6] = .025;
  pad.buttons[7] = .025;
  assert.equal(input.axis().throttle, 0, 'дрожание отпущенных курков отсекается');
});

test('Простой джойстик без курков сохраняет газ на оси Y и старые клавиши работают', () => {
  const g = bootInput();
  g.clearKeys();
  g.settings.controls = { up: ['KeyI'], down: ['KeyK'], left: ['KeyJ'], right: ['KeyL'], handbrake: ['Space'] };
  const pad = { connected: true, axes: [0, -.8], buttons: Array(8).fill(0) };
  g.navigator = { getGamepads: () => [pad] };
  const input = g.DiVANEngine.input;
  input.pollPad('race', 1 / 60);
  assert.ok(input.axis().throttle > .7);
  pad.axes[1] = 0;
  g.keys.KeyI = true; g.keys.KeyL = true; g.keys.Space = true;
  assert.equal(input.axis().throttle, 1);
  assert.equal(input.axis().steer, 1);
  assert.equal(input.axis().handbrake, true);
});

test('Некорректные показания контроллера не выходят за диапазон и не отравляют физику', () => {
  const g = bootInput();
  g.clearKeys();
  const pad = { connected: true, mapping: 'standard', axes: [Infinity, NaN], buttons: Array(16).fill(0) };
  g.navigator = { getGamepads: () => [pad] };
  const input = g.DiVANEngine.input;
  input.pollPad('race', 1 / 60);
  pad.buttons[7] = Infinity;
  assert.equal(input.axis().throttle, 0);
  assert.equal(input.axis().steer, 0);
  pad.buttons[7] = 2;
  pad.axes[0] = -2;
  assert.equal(input.axis().throttle, 1);
  assert.equal(input.axis().steer, -1);
});

test('Подтверждение паузы не стреляет и не переносит удерживаемые курки в заезд', () => {
  const g = bootInput();
  g.clearKeys(); g.paused = true;
  const pad = { connected: true, mapping: 'standard', axes: [0, 0], buttons: Array(16).fill(0) };
  g.navigator = { getGamepads: () => [pad] };
  const input = g.DiVANEngine.input, events = [];
  const poll = () => input.pollPad('race', 1 / 60, code => {
    events.push(code);
    if (code === 'Enter') { g.paused = false; g.clearKeys(); }
  });
  poll();
  pad.buttons[0] = 1; pad.buttons[7] = .8; pad.axes[0] = .8;
  poll();
  assert.equal(g.paused, false);
  assert.equal(g.ctrlHeld('fire'), false);
  assert.equal(input.axis().throttle, 0);
  assert.equal(input.axis().steer, 0);
  poll();
  assert.equal(g.ctrlHeld('fire'), false, 'удержание после меню всё ещё заблокировано');
  pad.buttons.fill(0); pad.axes[0] = 0; poll();
  pad.buttons[0] = 1; pad.buttons[7] = .8; pad.axes[0] = .8; poll();
  assert.equal(g.ctrlHeld('fire'), true);
  assert.equal(input.axis().throttle, .8);
  assert.ok(input.axis().steer > 0);
  assert.deepEqual(events, ['ArrowRight', 'Enter']);
});

test('Alt+Tab выключает геймпад; возврат требует отпустить прежний ввод', () => {
  const g = bootInput();
  g.clearKeys(); g.paused = false;
  let active = true;
  g.document = { hidden: false, hasFocus: () => active };
  const pad = { connected: true, mapping: 'standard', axes: [.8, 0], buttons: Array(16).fill(0) };
  g.navigator = { getGamepads: () => [pad] };
  const input = g.DiVANEngine.input, events = [];
  const poll = () => input.pollPad('race', 1 / 60, code => events.push(code));
  pad.buttons[0] = 1; pad.buttons[7] = .8; poll();
  assert.equal(g.ctrlHeld('fire'), true);
  active = false; g.clearKeys(); pad.buttons[9] = 1; poll();
  assert.equal(g.ctrlHeld('fire'), false);
  assert.equal(input.axis().throttle, 0);
  assert.equal(input.axis().steer, 0);
  assert.deepEqual(events, [], 'фон не нажимает паузу и не управляет меню');
  active = true; poll();
  assert.equal(g.ctrlHeld('fire'), false);
  assert.equal(input.axis().throttle, 0);
  pad.buttons.fill(0); pad.axes[0] = 0; poll();
  pad.buttons[0] = 1; pad.buttons[7] = .8; poll();
  assert.equal(g.ctrlHeld('fire'), true);
  assert.equal(input.axis().throttle, .8);
});

test('Переподключение с удерживаемыми кнопками не даёт выстрел, газ и фантомное меню', () => {
  const g = bootInput();
  g.clearKeys(); g.paused = false;
  let connected = true;
  const pad = { id: 'test-pad', connected: true, mapping: 'standard', axes: [.8, 0], buttons: Array(16).fill(0) };
  g.navigator = { getGamepads: () => connected ? [pad] : [] };
  const input = g.DiVANEngine.input, events = [];
  const poll = () => input.pollPad('race', 1 / 60, code => events.push(code));
  pad.buttons[0] = 1; pad.buttons[7] = .8; poll();
  connected = false; poll();
  assert.equal(g.ctrlHeld('fire'), false);
  connected = true; pad.buttons[9] = 1; poll();
  assert.equal(g.ctrlHeld('fire'), false);
  assert.equal(input.axis().throttle, 0);
  assert.equal(input.axis().steer, 0);
  assert.deepEqual(events, []);
  pad.buttons.fill(0); pad.axes[0] = 0; poll();
  pad.buttons[0] = 1; pad.buttons[7] = .8; poll();
  assert.equal(g.ctrlHeld('fire'), true);
  assert.equal(input.axis().throttle, .8);
});
