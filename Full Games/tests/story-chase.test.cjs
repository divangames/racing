////////////////////////////////////////////////////////
//
// Миссия 01: зоны дистанции, таймеры, PitterMAX и бочки.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { enhanceHtml, engineFile } = require('../src/main/enhancements');

const ENGINE = path.resolve(__dirname, '../src/engine');

function boot() {
  const g = {
    console,
    Math,
    state: 'title',
    W: 1280,
    H: 720,
    gt: 0,
    Image: function () { this.complete = false; this.naturalWidth = 0; },
    DiVANEngine: {
      input: { axis: function () { return { throttle: 0, steer: 0 }; } },
      screens: { names: [], paint: function () {} },
      get: function () { return null; }
    }
  };
  g.window = g;
  g.globalThis = g;
  vm.runInNewContext(fs.readFileSync(path.join(ENGINE, 'story-chase-config.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.join(ENGINE, 'story-chase-pressure.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.join(ENGINE, 'story-chase-bridge.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.join(ENGINE, 'story-chase-model.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.join(ENGINE, 'story-chase-scenery.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.join(ENGINE, 'story-chase-view.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.join(ENGINE, 'story-chase-horn.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.join(ENGINE, 'story-chase.js'), 'utf8'), g);
  return g;
}

function run(g, model, seconds, input) {
  const steps = Math.ceil(seconds / .05);
  for (let i = 0; i < steps; i++) g.storyBearChaseStep(model, input || {}, .05, function () { return .5; });
}

function bootHorn(options = {}) {
  const audios = [];
  const listeners = Object.create(null);
  const document = {
    hidden: false,
    addEventListener(type, listener) {
      (listeners[type] || (listeners[type] = [])).push(listener);
    },
    dispatch(type) {
      (listeners[type] || []).forEach(listener => listener());
    }
  };
  class FakeAudio {
    constructor(src) {
      this.src = src;
      this.currentTime = 0;
      this.paused = true;
      this.ended = false;
      this.loop = false;
      this.playCalls = 0;
      this.pauseCalls = 0;
      this.listeners = Object.create(null);
      audios.push(this);
    }
    addEventListener(type, listener) {
      (this.listeners[type] || (this.listeners[type] = [])).push(listener);
    }
    play() {
      this.playCalls += 1;
      this.paused = false;
      this.ended = false;
      if (options.play) return options.play(this);
      return Promise.resolve();
    }
    pause() {
      this.pauseCalls += 1;
      this.paused = true;
    }
    finish() {
      this.paused = true;
      this.ended = true;
      (this.listeners.ended || []).forEach(listener => listener());
    }
  }
  const g = {
    console,
    Math,
    state: 'title',
    W: 1280,
    H: 720,
    gt: 0,
    document,
    Audio: FakeAudio,
    Image: function () { this.complete = false; this.naturalWidth = 0; },
    settings: {sound: {sfxOn: true, sfx: 80}},
    DiVANEngine: {
      audioMix: {routeMedia: () => true},
      input: {axis: () => ({throttle: 0, steer: 0})},
      screens: {names: [], paint: function () {}},
      get: () => null
    }
  };
  g.window = g;
  g.globalThis = g;
  if (options.full) {
    vm.runInNewContext(fs.readFileSync(path.join(ENGINE, 'story-chase-config.js'), 'utf8'), g);
    vm.runInNewContext(fs.readFileSync(path.join(ENGINE, 'story-chase-pressure.js'), 'utf8'), g);
    vm.runInNewContext(fs.readFileSync(path.join(ENGINE, 'story-chase-bridge.js'), 'utf8'), g);
    vm.runInNewContext(fs.readFileSync(path.join(ENGINE, 'story-chase-model.js'), 'utf8'), g);
    vm.runInNewContext(fs.readFileSync(path.join(ENGINE, 'story-chase-view.js'), 'utf8'), g);
  }
  vm.runInNewContext(fs.readFileSync(path.join(ENGINE, 'story-chase-horn.js'), 'utf8'), g);
  if (options.full) vm.runInNewContext(fs.readFileSync(path.join(ENGINE, 'story-chase.js'), 'utf8'), g);
  return {g, horn: g.RnRStoryChaseHorn, audios, document};
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

test('модули погони подключаются между главой Медведя и циклом', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/story-chase-config.js'));
  assert(out.includes('/__engine/story-chase-pressure.js'));
  assert(out.includes('/__engine/story-chase-bridge.js'));
  assert(out.includes('/__engine/story-chase-model.js'));
  assert(out.includes('/__engine/story-chase-view.js'));
  assert(out.includes('/__engine/story-chase-horn.js'));
  assert(out.includes('/__engine/story-chase.js'));
  assert(out.indexOf('story-bear-chapter.js') < out.indexOf('story-chase-config.js'));
  assert(out.indexOf('story-chase-config.js') < out.indexOf('story-chase-pressure.js'));
  assert(out.indexOf('story-chase-pressure.js') < out.indexOf('story-chase-bridge.js'));
  assert(out.indexOf('story-chase-bridge.js') < out.indexOf('story-chase-model.js'));
  assert(out.indexOf('story-chase-model.js') < out.indexOf('story-chase-view.js'));
  assert(out.indexOf('story-chase-view.js') < out.indexOf('story-chase-horn.js'));
  assert(out.indexOf('story-chase-horn.js') < out.indexOf('story-chase.js'));
  assert(out.indexOf('story-chase.js') < out.indexOf('loop.js'));
  assert(out.indexOf('hud-cyber.js') < out.indexOf('story-chase-hud.js'));
  assert(engineFile('__engine/story-chase.js').endsWith('story-chase.js'));
});

test('PitterMAX находится только в UNIQUE и хранит оба состояния спрайта', () => {
  const g = boot();
  assert.equal(g.RnRTransport.UNIQUE.PitterMAX.category, 'UNIQUE');
  assert.match(g.PITTER_MAX.sprites.cargo, /PitterMAX\/1\.png$/);
  assert.match(g.PITTER_MAX.sprites.empty, /PitterMAX\/1_none\.png$/);
  assert.equal(g.RnRTransport.PLAYER.PitterMAX, undefined);
  assert.equal(g.MISSION_01.chaseCarIndex, 21);
  assert.equal(g.MISSION_01.chaseDriverIndex, 13);
  const hud = fs.readFileSync(path.join(ENGINE, 'story-chase-hud.js'), 'utf8');
  const view = fs.readFileSync(path.join(ENGINE, 'story-chase-view.js'), 'utf8');
  assert.match(hud, /CARS\[CFG\.chaseCarIndex\]/);
  assert.match(hud, /name: 'МЬЁЛЬНИР'/);
  assert.match(hud, /CHARS\[CFG\.chaseDriverIndex\]/);
  assert.match(view, /CHARS\[CFG\.chaseDriverIndex\]/);
});

test('погоня использует гоночную камеру, дорожный ribbon и звук заезда без трибун', () => {
  const chase = fs.readFileSync(path.join(ENGINE, 'story-chase.js'), 'utf8');
  const model = fs.readFileSync(path.join(ENGINE, 'story-chase-model.js'), 'utf8');
  const view = fs.readFileSync(path.join(ENGINE, 'story-chase-view.js'), 'utf8');
  const audio = fs.readFileSync(path.join(ENGINE, 'audio.js'), 'utf8');
  const music = fs.readFileSync(path.join(ENGINE, 'music-gate.js'), 'utf8');
  const loop = fs.readFileSync(path.join(ENGINE, 'loop.js'), 'utf8');
  const tires = fs.readFileSync(path.resolve(__dirname, '../content/car-tires.js'), 'utf8');
  assert.match(model, /raceZoom\(\)/);
  assert.match(view, /ribbon\.blitSeg/);
  assert.match(audio, /screen === 'bearChase'/);
  assert.match(music, /state === 'bearChase'/);
  assert.match(music, /missions\/01/);
  assert.match(tires, /state === 'bearChase'/);
  assert.match(loop, /state==='race'&&!paused[\s\S]*arenaCrowd/);
  assert.doesNotMatch(loop, /state==='bearChase'[^\n]*arenaCrowd/);
});

test('PitterMAX пятнадцать секунд занимает кадр, затем камера спускается к Мьёльниру', () => {
  const g = boot();
  const m = g.storyBearChaseCreate(function () { return .5; });
  assert.equal(m.phase, 'TRUCK_INTRO');
  run(g, m, g.MISSION_01.introTruckHoldTime - .1, {});
  assert.equal(m.phase, 'TRUCK_INTRO');
  const truckPlan = g.RnRStoryChaseModel.camera(m);
  assert.ok(Math.abs(truckPlan.targetY - g.RnRStoryChaseModel.truckY(m)) < .01);
  run(g, m, g.MISSION_01.introCameraPanTime + .2, {});
  assert.equal(m.phase, 'CHASE_START');
  const horn = fs.readFileSync(path.join(ENGINE, 'story-chase-horn.js'), 'utf8');
  assert.match(horn, /Missions\/01\/gudok\.mp3/);
  assert.match(horn, /TRUCK_ESCAPE/);
  assert.match(horn, /audio\.loop = false/);
});

test('гудок играет по одному разу только во вступлении и уходе PitterMAX', async () => {
  const h = bootHorn();
  const model = {phase: 'CHASE', pause: false};
  h.horn.sync(model);
  assert.equal(h.audios.length, 0);

  model.phase = 'TRUCK_INTRO';
  h.horn.sync(model);
  await flushPromises();
  const audio = h.audios[0];
  assert.equal(audio.loop, false);
  assert.equal(audio.playCalls, 1);
  for (let i = 0; i < 120; i++) h.horn.sync(model);
  audio.finish();
  for (let i = 0; i < 120; i++) h.horn.sync(model);
  model.pause = true;
  h.horn.sync(model);
  model.pause = false;
  h.horn.sync(model);
  assert.equal(audio.playCalls, 1);

  model.phase = 'CHASE';
  h.horn.sync(model);
  assert.equal(audio.paused, true);
  assert.equal(audio.currentTime, 0);
  model.phase = 'TRUCK_ESCAPE';
  h.horn.sync(model);
  await flushPromises();
  assert.equal(audio.playCalls, 2);
  audio.finish();
  for (let i = 0; i < 120; i++) h.horn.sync(model);
  assert.equal(audio.playCalls, 2);
});

test('пауза и скрытие окна возобновляют гудок с той же позиции', async () => {
  const h = bootHorn();
  const model = {phase: 'TRUCK_INTRO', pause: false};
  h.horn.sync(model);
  await flushPromises();
  const audio = h.audios[0];
  audio.currentTime = 1.25;

  model.pause = true;
  h.horn.sync(model);
  assert.equal(audio.paused, true);
  assert.equal(audio.currentTime, 1.25);
  for (let i = 0; i < 30; i++) h.horn.sync(model);
  assert.equal(audio.playCalls, 1);

  model.pause = false;
  h.horn.sync(model);
  await flushPromises();
  assert.equal(audio.paused, false);
  assert.equal(audio.currentTime, 1.25);
  assert.equal(audio.playCalls, 2);

  audio.currentTime = 1.8;
  h.document.hidden = true;
  h.document.dispatch('visibilitychange');
  assert.equal(audio.paused, true);
  assert.equal(audio.currentTime, 1.8);
  h.document.hidden = false;
  h.document.dispatch('visibilitychange');
  await flushPromises();
  assert.equal(audio.paused, false);
  assert.equal(audio.currentTime, 1.8);
  assert.equal(audio.playCalls, 3);
});

test('отклонённый play() не спамит повторами, а смена фазы сразу гасит клип', async () => {
  const h = bootHorn({play(audio) {
    audio.paused = true;
    return Promise.reject(new Error('autoplay blocked'));
  }});
  const model = {phase: 'TRUCK_INTRO', pause: false};
  h.horn.sync(model);
  await flushPromises();
  const audio = h.audios[0];
  for (let i = 0; i < 120; i++) h.horn.sync(model);
  assert.equal(audio.playCalls, 1);

  audio.currentTime = .7;
  model.phase = 'CHASE';
  h.horn.sync(model);
  assert.equal(audio.paused, true);
  assert.equal(audio.currentTime, 0);
  assert.equal(audio.playCalls, 1);

  model.phase = 'TRUCK_ESCAPE';
  h.horn.sync(model);
  await flushPromises();
  for (let i = 0; i < 120; i++) h.horn.sync(model);
  assert.equal(audio.playCalls, 2);
});

test('переход на точку редактора гасит гудок без ожидания следующего кадра', async () => {
  const h = bootHorn({full: true});
  const model = h.g.startStoryBearChase();
  h.horn.sync(model);
  await flushPromises();
  const audio = h.audios[0];
  audio.currentTime = .9;

  assert.equal(h.g.storyBearChaseApplyPoint('CHASE'), true);
  assert.equal(audio.paused, true);
  assert.equal(audio.currentTime, 0);
  assert.equal(audio.playCalls, 1);
});

test('нитро не включается от скорости и запускается только назначенной кнопкой', () => {
  const g = boot();
  const m = g.storyBearChaseCreate(function () { return .5; });
  m.phase = 'CHASE'; m.playerSpeed = g.MISSION_01.playerMaxSpeed;
  run(g, m, .5, {throttle: 1});
  assert.equal(m.nitroTime, 0);
  g.storyBearChaseStep(m, {throttle: 1, nitro: true}, .05, function () { return .5; });
  assert.ok(m.nitroTime > 0);
  assert.ok(m.nitroCooldown > m.nitroTime);
});

test('погоня требует ручного газа: без него машина катится, с ним разгоняется', () => {
  const g = boot();
  const m = g.storyBearChaseCreate(function () { return .5; });
  m.phase = 'CHASE'; m.spawnTimer = 999;
  m.playerSpeed = g.MISSION_01.playerMaxSpeed;
  run(g, m, 1, {throttle: 0});
  const coastSpeed = m.playerSpeed;
  assert.ok(coastSpeed < g.MISSION_01.playerMaxSpeed - .2);
  assert.ok(coastSpeed >= g.MISSION_01.playerCoastSpeed);
  run(g, m, 1, {throttle: 1});
  assert.ok(m.playerSpeed > coastSpeed + .2);
});

test('длительная стрельба перегревает оружие и требует охлаждения', () => {
  const g = boot();
  const m = g.storyBearChaseCreate(function () { return .5; });
  m.phase = 'CHASE'; m.spawnTimer = 999;
  run(g, m, 2, {throttle: 1, fire: true});
  assert.ok(m.weaponOverheatTime > 0);
  assert.equal(g.RnRStoryChaseModel.fire(m), false);
  run(g, m, g.MISSION_01.weaponOverheatTime + .1, {throttle: 1});
  assert.equal(m.weaponOverheatTime, 0);
  assert.equal(g.RnRStoryChaseModel.fire(m), true);
});

test('режиссёр давления наращивает темп, даёт восстановиться в красной зоне и защищает финал', () => {
  const g = boot();
  const m = g.storyBearChaseCreate(function () { return .5; });
  m.distanceZone = 'YELLOW'; m.elapsed = 0;
  assert.equal(g.RnRStoryChasePressure.profile(m).id, 'LEARN');
  m.elapsed = 20;
  assert.equal(g.RnRStoryChasePressure.profile(m).id, 'BUILD');
  m.elapsed = 50;
  assert.equal(g.RnRStoryChasePressure.profile(m).id, 'ATTACK');
  m.distanceZone = 'RED';
  const recovery = g.RnRStoryChasePressure.profile(m);
  assert.equal(recovery.id, 'RECOVERY');
  assert.ok(recovery.min > g.MISSION_01.pressureAttackMax);
  m.distanceZone = 'GREEN';
  const final = g.RnRStoryChasePressure.profile(m);
  assert.equal(final.id, 'FINAL');
  assert.ok(final.min < g.MISSION_01.pressureAttackMin);
  assert.ok(final.max <= g.MISSION_01.pressureAttackMax);
  m.spawnTimer = .2; m.pendingDrops = [{delay: .1, lane: 0}];
  g.RnRStoryChasePressure.enterZone(m, 'YELLOW', 'RED');
  assert.equal(m.pendingDrops.length, 0);
  assert.ok(m.spawnTimer >= g.MISSION_01.pressureRedMin);
});

test('сложная волна оставляет проезд и добрасывает бочки по очереди', () => {
  const g = boot();
  const m = g.storyBearChaseCreate(function () { return .5; });
  m.distanceZone = 'GREEN'; m.elapsed = 50;
  const lanes = [];
  g.RnRStoryChasePressure.schedule(m, () => .5);
  assert.equal(m.pendingDrops.length, 3);
  assert.equal(new Set(m.pendingDrops.slice(0, 2).map(drop => drop.targetOffset)).size, 2);
  const receive = (model, lane) => lanes.push(lane);
  g.RnRStoryChasePressure.updateQueue(m, g.MISSION_01.attackWarningTime - .01, receive);
  assert.equal(lanes.length, 0, 'ни одной бочки до окончания предупреждения');
  g.RnRStoryChasePressure.updateQueue(m, .02, receive);
  assert.equal(lanes.length, 2);
  assert.equal(new Set(lanes).size, 2);
  assert.equal(m.pendingDrops.length, 1);
  assert.ok(m.pendingDrops[0].delay >= 1, 'третья полоса не закрывает проход вместе с парой');
  g.RnRStoryChasePressure.updateQueue(m, 1.06, receive);
  assert.equal(lanes.length, 3);
});

test('красная зона даёт ровно пять секунд и сбрасывается в жёлтой', () => {
  const g = boot();
  const m = g.storyBearChaseCreate(function () { return .5; });
  m.phase = 'CHASE';
  m.distance = g.MISSION_01.redZoneDistance + 3;
  m.playerSpeed = g.MISSION_01.playerCruiseSpeed;
  m.truckSpeed = g.MISSION_01.playerCruiseSpeed;
  run(g, m, 4.9, { throttle: 0 });
  assert.equal(m.phase, 'CHASE');
  assert(m.redTimer > 4.8);
  m.distance = 70;
  g.storyBearChaseStep(m, {}, .05, function () { return .5; });
  assert.equal(m.redTimer, 0);
  m.distance = g.MISSION_01.redZoneDistance + 3;
  run(g, m, 5.1, { throttle: 0 });
  assert.equal(m.phase, 'FAILED');
});

test('пять секунд в зелёной зоне честно запускают мостовую катсцену и затем комикс', () => {
  const g = boot();
  const m = g.storyBearChaseCreate(function () { return .5; });
  m.phase = 'CHASE';
  m.spawnTimer = 999;
  m.distance = g.MISSION_01.greenZoneDistance - 4;
  m.distanceZone = 'GREEN';
  m.playerSpeed = g.MISSION_01.playerMaxSpeed;
  m.truckSpeed = g.MISSION_01.playerMaxSpeed;
  run(g, m, 5.2, { throttle: 1 });
  assert.equal(m.phase, 'BRIDGE_APPROACH');
  assert.equal(m.barrels.length, 0);
  const cinematicTime = ['BRIDGE_APPROACH', 'BRIDGE_COLLAPSE', 'BRAKE_HIT', 'DRIFT_STOP',
    'DRIFT_SETTLE', 'PLAYER_CLOSEUP', 'SEPARATION_SHOT', 'GAP_TRAVERSE', 'TRUCK_FOCUS',
    'TRUCK_ESCAPE', 'AFTERMATH_RETURN'].reduce((sum, phase) =>
    sum + g.RnRStoryChaseBridge.phaseDuration(phase), 0);
  run(g, m, cinematicTime + .5, {});
  assert.equal(m.phase, 'COMIC');
});

test('попадание бочки режет скорость до 40% и восстанавливает её', () => {
  const g = boot();
  const m = g.storyBearChaseCreate(function () { return .5; });
  m.phase = 'CHASE';
  const barrel = { x: 0, y: 0, state: 'ROLL', explosionTime: 0 };
  g.storyBearChaseExplode(m, barrel, true);
  assert.equal(m.speedPenalty, .4);
  assert.equal(m.penaltyTime, 2);
  assert.equal(m.hp, m.maxHp - g.MISSION_01.barrelHitDamage);
  run(g, m, 2.1, { throttle: 1 });
  assert.equal(m.penaltyTime, 0);
  assert.equal(m.speedPenalty, 1);
  assert.equal(barrel.state, 'EXPLOSION');
});

test('грузовик не тормозит и реально увеличивает отрыв при торможении игрока', () => {
  const g = boot();
  const m = g.storyBearChaseCreate(function () { return .5; });
  m.phase = 'CHASE'; m.distance = 70; m.spawnTimer = 999;
  m.playerSpeed = g.MISSION_01.playerCruiseSpeed;
  m.truckSpeed = g.MISSION_01.truckBaseSpeed;
  const before = m.distance;
  const beforeZoom = g.RnRStoryChaseModel.camera(m).zoom;
  run(g, m, 1.5, {throttle: -1});
  assert.ok(m.distance > before + 4);
  assert.equal(m.truckSpeed, g.MISSION_01.truckBaseSpeed);
  assert.ok(m.cameraPull > .5);
  assert.ok(g.RnRStoryChaseModel.camera(m).zoom < beforeZoom);
});

test('бочка появляется ровно на задней кромке повёрнутого PitterMAX', () => {
  const g = boot();
  const m = g.storyBearChaseCreate(function () { return .5; });
  m.phase = 'CHASE'; m.distance = 72; m.spawnTimer = 0;
  g.storyBearChaseStep(m, {}, .001, () => .5);
  assert.equal(m.barrels.length, 0);
  m.pendingDrops[0].delay = 0;
  const point = g.RnRStoryChaseModel.barrelSpawnPoint(m, 0);
  g.storyBearChaseStep(m, {}, .01, function () { return .5; });
  assert.equal(m.barrels.length, 1);
  assert.ok(Math.abs(m.barrels[0].x - point.x) < 1);
  assert.ok(Math.abs(m.barrels[0].y - point.y) < 1);
});

test('серия прямых попаданий снимает корпус и завершает миссию', () => {
  const g = boot();
  const m = g.storyBearChaseCreate(function () { return .5; });
  m.phase = 'CHASE'; m.spawnTimer = 999;
  for (let i = 0; i < 6; i++) {
    g.storyBearChaseExplode(m, {state: 'ROLL', explosionTime: 0, x: 0, y: 0}, true);
    m.damageCooldown = 0;
  }
  assert.equal(m.hp, 0);
  assert.equal(m.phase, 'FAILED');
  assert.equal(m.failedReason, 'WRECKED');
});

test('мост рушится после грузовика, машина останавливается в заносе', () => {
  const g = boot();
  const m = g.storyBearChaseCreate(function () { return .5; });
  g.RnRStoryChaseBridge.begin(m);
  const gapY = g.RnRStoryChaseBridge.gapScreenY(m, g.H);
  assert.ok(g.RnRStoryChaseModel.truckY(m) < gapY);
  assert.ok(gapY - g.RnRStoryChaseModel.truckY(m) > g.MISSION_01.bridgeGapLength * .7,
    'PitterMAX должен целиком миновать секцию до обрушения');
  assert.ok(gapY < g.RnRStoryChaseModel.playerScreenY(m));
  const lowerEdge = gapY + g.MISSION_01.bridgeGapLength * m.bridgeCollapse * .52;
  assert.ok(g.RnRStoryChaseModel.playerScreenY(m) - lowerEdge > 18,
    'Мьёльнир должен остановиться перед нижней кромкой, а не над провалом');
  run(g, m, g.MISSION_01.bridgeApproachTime + .05, {});
  const cinematicTime = m.bridgeCinematicTime;
  run(g, m, g.MISSION_01.bridgeCollapseTime, {});
  assert.ok(m.bridgeCinematicTime > cinematicTime && m.phaseTime < m.bridgeCinematicTime,
    'letterbox использует общий таймер катсцены и не сбрасывается между планами');
  g.RnRStoryChaseBridge.begin(m);
  run(g, m, g.MISSION_01.bridgeApproachTime + g.MISSION_01.bridgeCollapseTime +
    g.MISSION_01.bridgeBrakeSnapTime + g.MISSION_01.bridgeDriftTime * .62, {});
  assert.equal(m.phase, 'DRIFT_STOP');
  assert.ok(m.bridgeCollapse > .4);
  assert.ok(Math.abs(m.bridgeDrift) > .4);
  assert.ok(m.playerSpeed < g.MISSION_01.playerCoastSpeed);
  assert.ok(m.bridgePlayerAdvance > 20);
  assert.ok(m.bridgeSkidTrail.length > 8);
  assert.ok(m.bridgeTruckTravel > 0);
  assert.equal(m.truckSpeed, g.MISSION_01.truckBaseSpeed);
  run(g, m, g.MISSION_01.bridgeDriftTime * .5 + g.MISSION_01.bridgeSettleTime + .1, {});
  assert.equal(m.phase, 'PLAYER_CLOSEUP');
  assert.equal(m.playerSpeed, 0);
  assert.ok(Math.abs(Math.abs(m.bridgeDrift) - g.MISSION_01.bridgeDriftAngle) < .02);
  const narrow = g.storyBearChaseCreate(function () { return .5; });
  g.RnRStoryChaseBridge.begin(narrow, 70);
  assert.ok(Math.abs(narrow.bridgeDriftTargetX) <= 42);
});

test('камера берёт торможение, разрыв, PitterMAX и возвращается к Мьёльниру', () => {
  const g = boot();
  const m = g.storyBearChaseCreate(function () { return .5; });
  g.RnRStoryChaseBridge.begin(m);
  const plans = {}, positions = {};
  let maxRotation = 0, guard = 0;
  while (m.phase !== 'COMIC' && guard++ < 400) {
    g.storyBearChaseStep(m, {}, .05, function () { return .5; });
    if (!g.RnRStoryChaseBridge.active(m)) continue;
    const plan = g.RnRStoryChaseModel.camera(m);
    plans[m.phase] = plan;
    positions[m.phase] = {truckY: g.RnRStoryChaseModel.truckY(m), playerY: g.RnRStoryChaseModel.playerScreenY(m)};
    maxRotation = Math.max(maxRotation, Math.abs(plan.rotation || 0));
  }
  assert.equal(m.phase, 'COMIC');
  assert.ok(maxRotation > .01);
  assert.ok(Math.abs(plans.PLAYER_CLOSEUP.zoom - g.MISSION_01.bridgePlayerZoom) < .02);
  assert.ok(plans.SEPARATION_SHOT.zoom < plans.PLAYER_CLOSEUP.zoom);
  assert.ok(plans.GAP_TRAVERSE.targetY < plans.SEPARATION_SHOT.targetY);
  assert.ok(Math.abs(plans.TRUCK_FOCUS.targetY - positions.TRUCK_FOCUS.truckY) < 3);
  assert.ok(positions.TRUCK_ESCAPE.truckY < plans.TRUCK_ESCAPE.targetY - 40);
  assert.ok(Math.abs(plans.AFTERMATH_RETURN.targetY - positions.AFTERMATH_RETURN.playerY) < 4);
});

test('все планы моста запускаются из редактора без NaN и промежуточных гудков', () => {
  const g = boot();
  const model = g.startStoryBearChase();
  const points = ['BRIDGE_APPROACH', 'BRIDGE_COLLAPSE', 'BRAKE_HIT', 'DRIFT_STOP', 'DRIFT_SETTLE',
    'PLAYER_CLOSEUP', 'SEPARATION_SHOT', 'GAP_TRAVERSE', 'TRUCK_FOCUS', 'TRUCK_ESCAPE', 'AFTERMATH_RETURN'];
  points.forEach((point) => {
    assert.equal(g.storyBearChaseApplyPoint(point), true);
    assert.equal(model.phase, point);
    const blastAge = model.bridgeBlastEvents[0] && model.bridgeBlastEvents[0].age;
    const plan = g.RnRStoryChaseModel.camera(model);
    [model.playerSpeed, model.playerX, model.bridgeDrift, plan.zoom, plan.targetX, plan.targetY]
      .forEach((value) => assert.ok(Number.isFinite(value), point + ': ' + value));
    if (point === 'DRIFT_STOP') assert.equal(model.bridgeCameraFrom.zoom, g.MISSION_01.bridgeBrakeZoom);
    g.storyBearChaseStep(model, {}, .01, function () { return .5; });
    if (Number.isFinite(blastAge)) assert.ok(model.bridgeBlastEvents[0].age > blastAge);
  });
  assert.equal(g.storyBearChaseApplyPoint('CHASE'), true);
  assert.equal(model.phase, 'CHASE');
});

test('параллакс не подменяется в финале, а фермы моста видны всю погоню', () => {
  const view = fs.readFileSync(path.join(ENGINE, 'story-chase-view.js'), 'utf8');
  const scenery = fs.readFileSync(path.join(ENGINE, 'story-chase-scenery.js'), 'utf8');
  assert.doesNotMatch(view, /drawBridgeUnderlay/);
  assert.match(view, /drawGround\(model, theme\);/);
  assert.match(view, /drawBridgeDeck\(model, theme\);/);
  assert.match(scenery, /Bridge\.gapScreenY/);
  assert.match(scenery, /bridgeBlastEvents/);
  assert.doesNotMatch(view, /fillStyle = '#070609'/);
  assert.match(scenery, /fallingDeck/);
  assert.match(scenery, /brokenLip/);
});

test('шкала дистанции живёт под корпусом внутри общей 3D-проекции HUD', () => {
  const g = boot();
  vm.runInNewContext(fs.readFileSync(path.join(ENGINE, 'story-chase-hud.js'), 'utf8'), g);
  const layout = {
    vehicle: {x: 12, y: 12, w: 230, h: 60},
    clock: {x: 510, y: 12, w: 260, h: 44}
  };
  const box = g.RnRStoryChaseHud.distanceBox(layout);
  assert.equal(box.x, layout.vehicle.x);
  assert.equal(box.y, layout.vehicle.y + layout.vehicle.h + 18);
  assert.ok(box.y >= layout.clock.y + layout.clock.h);
  const hud = fs.readFileSync(path.join(ENGINE, 'story-chase-hud.js'), 'utf8');
  assert.match(hud, /cyberHud\.draw\(false, function \(context, layout\)/);
  assert.doesNotMatch(hud, /drawDistance[\s\S]*setTransform/);
});

test('прицел одиночной атаки фиксируется до сброса и не следует за уклонением', () => {
  const g=boot(), m=g.storyBearChaseCreate(()=>.5), director=g.RnRStoryChasePressure;
  m.playerX=37;
  director.schedule(m,()=>.5);
  assert.equal(m.pendingDrops.length,1);
  assert.equal(m.pendingDrops[0].targetOffset,37);
  m.playerX=-60;
  const drops=[];
  director.updateQueue(m,2,(_,lane,target)=>drops.push(target));
  assert.deepEqual(drops,[37]);
});

test('удар мгновенно снижает скорость, близкий взрыв восстанавливается без усиления штрафа', () => {
  const g=boot(), M=g.RnRStoryChaseModel, m=M.create(()=>.5);
  m.phase='CHASE'; m.spawnTimer=999; m.playerSpeed=1;
  M.explode(m,{state:'ROLL',x:0,y:0},true);
  assert.equal(m.playerSpeed,.4);
  const near=M.create(()=>.5);
  near.phase='CHASE'; near.spawnTimer=999; near.playerSpeed=1;
  M.explode(near,{state:'ROLL',x:M.playerScreenX(near)+45,y:M.playerScreenY(near)},false);
  assert.equal(near.playerSpeed,g.MISSION_01.barrelNearSpeedMultiplier);
  assert.equal(near.hp,near.maxHp-g.MISSION_01.barrelNearDamage);
  const penalty=near.speedPenalty;
  M.step(near,{throttle:1},.05,()=>.5);
  assert.ok(near.speedPenalty>=penalty);
  assert.ok(near.playerSpeed>=g.MISSION_01.barrelNearSpeedMultiplier);
});

test('уничтоженная пулей бочка не наносит ещё и прямой удар в том же кадре', () => {
  const g=boot(), M=g.RnRStoryChaseModel, m=M.create(()=>.5);
  m.phase='CHASE'; m.spawnTimer=999; m.playerSpeed=1;
  const x=M.playerScreenX(m), y=M.playerScreenY(m);
  m.barrels=[{state:'ROLL',health:1,x,y:y-24,age:0}];
  m.bullets=[{x,y:y-10,life:1}];
  M.step(m,{throttle:1},.05,()=>.5);
  assert.equal(m.barrels[0].state,'EXPLOSION');
  assert.equal(m.hp,m.maxHp-g.MISSION_01.barrelNearDamage);
  assert.equal(m.barrelsDestroyed,1);
  assert.ok(m.playerSpeed>.8);
});

test('смертельный удар в последний кадр зелёного удержания не превращается в победу', () => {
  const g=boot(), M=g.RnRStoryChaseModel, m=M.create(()=>.5);
  m.phase='CHASE'; m.spawnTimer=999; m.distance=25; m.hp=1; m.greenTimer=4.99;
  m.barrels=[{state:'ROLL',health:2,x:M.playerScreenX(m),y:M.playerScreenY(m),age:0}];
  M.step(m,{throttle:1},.02,()=>.5);
  assert.equal(m.phase,'FAILED');
  assert.equal(m.failedReason,'WRECKED');
});

test('отпущенный руль не возвращает машину в центр, удержание нитро не повторяет активацию', () => {
  const g=boot(), M=g.RnRStoryChaseModel, m=M.create(()=>.5);
  m.phase='CHASE'; m.spawnTimer=999; m.playerX=50;
  run(g,m,6,{throttle:1,nitro:true});
  assert.equal(m.playerX,50);
  assert.equal(m.nitroTime,0);
  assert.equal(m.nitroCooldown,0);
  M.step(m,{throttle:1,nitro:false},.02,()=>.5);
  M.step(m,{throttle:1,nitro:true},.02,()=>.5);
  assert.ok(m.nitroTime>0);
});

test('геометрия поворота движется вниз вместе с полотном, нулевой изгиб поддерживается', () => {
  const g=boot(), M=g.RnRStoryChaseModel, m=M.create(()=>.5);
  const x=M.roadCenter(m,180);
  m.scroll+=50;
  assert.ok(Math.abs(M.roadCenter(m,230)-x)<.00001);
  g.RnRChapterContent={get:()=>({track:{curveAmount:0}})};
  assert.equal(M.roadCenter(m,0),g.W/2);
  assert.equal(M.roadCenter(m,900),g.W/2);
});

test('вступление передаёт игрока и грузовик в погоню без скачка координат камеры', () => {
  const g=boot(), M=g.RnRStoryChaseModel, m=M.create(()=>.5);
  m.phaseTime=g.MISSION_01.introTruckHoldTime+g.MISSION_01.introCameraPanTime;
  const before=M.camera(m), truck=M.truckY(m), player=M.playerScreenY(m);
  M.step(m,{},0,()=>.5);
  const after=M.camera(m);
  assert.equal(m.phase,'CHASE_START');
  assert.equal(truck,M.truckY(m)); assert.equal(player,M.playerScreenY(m));
  for(const key of ['zoom','targetX','targetY','anchorX','anchorY']) assert.ok(Math.abs(before[key]-after[key])<.001,key);
});

test('финал непрерывен без вызовов рисования, грузовик и Мьёльнир остаются на своих берегах', () => {
  for(const dt of [.01,.025,.05]) {
    const g=boot(), M=g.RnRStoryChaseModel, B=g.RnRStoryChaseBridge, m=M.create(()=>.5);
    m.phase='CHASE'; m.distance=25; m.spawnTimer=999; m.greenTimer=4.999; m.playerSpeed=1;
    const before=M.camera(m), ty=M.truckY(m), py=M.playerScreenY(m);
    M.step(m,{throttle:1},dt,()=>.5);
    assert.equal(m.phase,'BRIDGE_APPROACH');
    assert.equal(ty,M.truckY(m)); assert.equal(py,M.playerScreenY(m));
    assert.ok(Math.abs(before.zoom-M.camera(m).zoom)<.001);
    let separation=false, guard=0;
    while(B.active(m) && guard++<2000) {
      M.step(m,{},dt,()=>.5);
      if(!B.active(m)) break;
      if(m.bridgeCollapse>.01) {
        const length=g.MISSION_01.bridgeGapLength*m.bridgeCollapse, center=B.gapScreenY(m,g.H);
        assert.ok(M.truckY(m)+85 <= center-length*.48+1,'весь прицеп уже над целой дорогой');
        assert.ok(M.playerScreenY(m)-20 > center+length*.52,'машина не висит над разрывом');
      }
      assert.equal(m.truckSpeed,g.MISSION_01.truckBaseSpeed);
      if(m.phase==='SEPARATION_SHOT' && m.phaseTime>B.phaseDuration(m.phase)*.95) {
        separation=true;
        const camera=m.bridgeCameraPose;
        const top=(M.truckY(m)-85-camera.targetY)*camera.zoom+camera.anchorY;
        const bottom=(M.playerScreenY(m)+28-camera.targetY)*camera.zoom+camera.anchorY;
        assert.ok(top>26 && bottom<g.H-26, 'обе машины целиком в общем плане');
      }
    }
    assert.equal(m.phase,'COMIC'); assert.equal(separation,true);
  }
});

test('пассивный газ не проходит миссию, чтение предупреждений позволяет пройти без обязательного урона', () => {
  const g=boot(), M=g.RnRStoryChaseModel;
  function drive(active) {
    const m=M.create(()=>.5); m.phase='CHASE';
    for(let i=0;i<6000 && m.phase==='CHASE';i++) {
      const py=M.playerScreenY(m);
      const risks=m.pendingDrops.map(b=>({x:b.targetOffset,w:2})).concat(m.barrels
        .filter(b=>b.state==='ROLL' && b.y<py+36).map(b=>({x:b.targetOffset,w:b.y>py-150?4:1})));
      const score=x=>risks.reduce((sum,r)=>sum+r.w*Math.max(0,55-Math.abs(x-r.x)),0);
      const target=[-65,0,65].sort((a,b)=>score(a)-score(b)||Math.abs(a-m.playerX)-Math.abs(b-m.playerX))[0];
      M.step(m,{throttle:1,steer:active?Math.max(-1,Math.min(1,(target-m.playerX)/12)):0},.02,()=>.5);
    }
    return m;
  }
  assert.equal(drive(false).phase,'FAILED');
  const active=drive(true);
  assert.equal(active.phase,'BRIDGE_APPROACH'); assert.equal(active.hp,active.maxHp);
});
