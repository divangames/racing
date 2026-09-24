'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function boot(memory = {}) {
  const writes = [], N = 80;
  const S = Array.from({ length: N }, (_, i) => {
    const a = i / N * Math.PI * 2;
    return { x: 500 + Math.cos(a) * 200, y: 500 + Math.sin(a) * 200, ang: a + Math.PI / 2, nx: Math.cos(a), ny: Math.sin(a) };
  });
  const P = { isP: true, car: { idx: 0, hov: false }, st: { top: 400, acc: 140, grip: .8 }, lvl: { eng: 2 }, ch: { grt: 0 },
    trackIdx: N - 1, x: S[N-1].x, y: S[N-1].y, ang: S[N-1].ang, lap: -1, lapStart: 0, prog: -1,
    spd: 320, lat: 0, z: 0, hp: 70, maxhp: 100, dead: false, air: false, invuln: 0, shield: 0,
    bestLap: 0, lastLap: 0, dmgDealt: 0, kills: 0, wepAmmo: 7, cdW: 2, cdN: 4, cdU: 8, nitro: .8, _drift: { active: false } };
  const c = { console, R: { S, N, T: { id: 'test', S, N, w: 1000, h: 1000, gaps: [], decks: [] },
      racers: [P], shots: [], phase: 'go', time: 0, tIdx: 0 },
    P, state: 'race', labTest: true, paused: false, raceLaps: 3, ROADW: 95, save: { cash: 800, records: {} },
    persistRead: key => memory[key] || null,
    persistWrite(key, value) { memory[key] = value; writes.push({ key, value }); },
    stepVehicle(r) { if (r.next) { Object.assign(r, r.next); delete r.next; } },
    advanceIdx() {}, buildRace() {}, showResults() {}, drawRaceArena() {},
    drawCar(_c, r) { c.drawn = r; },
    kitPushShot(r, a, speed, life, dmg, extra) { const s = Object.assign({ r, life, dmg, x: r.x, y: r.y }, extra); c.R.shots.push(s); return s; },
    kitOnShotHit() {},
    kitOnShotExpire(shot) { for (const victim of shot.targets || []) c.dmgRacer(victim, 30, shot.r); },
    resolveRaceContact() {},
    dmgRacer(v, amount, attacker) { if (v.shield || v.invuln || v.dead) return; const loss = Math.min(v.hp, amount); v.hp -= loss; if (attacker && attacker !== v) attacker.dmgDealt += loss; },
    killRacer(r) { r.dead = true; }, respawn(r) { r.dead = false; r.x += 500; },
    resetWepMag() {}, announce() {}, fmtLap: t => String(t), sBeep() {}, fl() {}, sReload() {},
    finishRacer(r) { r.finished = true; }, inTrackGap(_T, t) { return !!c.gapAt && c.gapAt(t); },
    carHitHalf: () => ({ hw: 27, hh: 16 }), clearKeys() { c.cleared = true; },
    g: { save() {}, restore() {}, translate() {}, rotate() {}, strokeRect() {}, setLineDash() {} }
  };
  c.window = c; c.globalThis = c;
  const load = file => vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine', file), 'utf8'), c);
  load('runtime.js'); load('race-progress.js'); load('race-insights.js'); load('training-ghost.js'); load('race-recovery.js');
  const advance = (index, seconds = .05, extra = {}) => {
    c.R.time += seconds;
    const p = c.R.S[index]; c.P.next = { x: p.x, y: p.y, ang: p.ang, ...extra };
    c.stepVehicle(c.P, 1, 0, seconds); c.advanceIdx(c.P);
  };
  const lap = (seconds = .05) => { for (let i = 1; i <= N; i++) advance(i % N, seconds); };
  return { c, memory, writes, advance, lap };
}

test('Уникальные снаряды: повторное попадание и взрыв в две цели не увеличивают точность выше 100%', () => {
  const { c } = boot();
  const a = { hp: 100, dmgDealt: 0 }, b = { hp: 100, dmgDealt: 0 };
  assert.equal(c.DiVANEngine.insights.snapshot().accuracy, null);
  const shot = c.kitPushShot(c.P, 0, 100, 1, 10);
  c.kitOnShotHit(shot, a); c.kitOnShotHit(shot, a); c.kitOnShotHit(shot, b);
  c.kitPushShot(c.P, 0, 100, 1, 10);
  const mortar = c.kitPushShot(c.P, 0, 100, 1, 30, { targets: [a, b] });
  c.kitOnShotExpire(mortar);
  const stats = c.DiVANEngine.insights.snapshot();
  assert.equal(stats.shotsFired, 3); assert.equal(stats.shotsHit, 2);
  assert.ok(Math.abs(stats.accuracy - 200 / 3) < 1e-9); assert.equal(stats.damageDealt, 60);
  const legacy = { r: c.P, life: 1 }; c.R.shots.push(legacy); c.resolveRaceContact(); c.resolveRaceContact();
  c.kitOnShotHit(legacy, a);
  assert.equal(c.DiVANEngine.insights.snapshot().shotsFired, 4);
});

test('Дрифт учитывает время симуляции, исключая паузу, контакт, полёт и движение после финиша', () => {
  const simulate = hz => {
    const { c } = boot(); c.P._drift.active = true;
    for (let i = 0; i < hz * 2; i++) c.stepVehicle(c.P, 1, 0, 1 / hz);
    const value = c.DiVANEngine.insights.snapshot().driftTime;
    c.paused = true; c.stepVehicle(c.P, 1, 0, .1); c.paused = false;
    for (const key of ['air','dead','finished']) { c.P[key] = true; c.stepVehicle(c.P, 1, 0, .1); c.P[key] = false; }
    c.P._contactGrace = 1; c.stepVehicle(c.P, 1, 0, .1);
    assert.equal(c.DiVANEngine.insights.snapshot().driftTime, value);
    return value;
  };
  assert.ok(Math.abs(simulate(30) - 2) < 1e-9); assert.ok(Math.abs(simulate(144) - 2) < 1e-9);
});

test('Полный чистый круг записывает 20 Гц, медленный круг не перезаписывает рекорд, ghost не участвует в гонке', () => {
  const { c, memory, writes, advance, lap } = boot();
  advance(0); lap();
  const ghost = c.DiVANEngine.trainingGhost;
  assert.equal(ghost.status().available, true);
  assert.ok(Math.abs(ghost.status().bestLap - 4) < .001);
  const record = JSON.parse(memory['rnr.trainingGhost.v1']).records[0];
  assert.equal(record.samples.length, 81); assert.equal(record.samples[0][0], 0); assert.equal(record.samples[80][0], 4);
  assert.equal(writes.length, 1);
  lap(.075); assert.equal(writes.length, 1);
  assert.equal(c.DiVANEngine.insights.snapshot().completedLaps, 2);
  const count = c.R.racers.length; c.drawRaceArena();
  assert.equal(c.drawn._isGhost, true); assert.equal(c.drawn.isP, false); assert.equal(c.R.racers.length, count);
  assert.ok(!c.R.racers.includes(c.drawn)); assert.equal(c.save.cash, 800); assert.deepEqual(c.save.records, {});
  ghost.setEnabled(false); assert.equal(ghost.pose(), null);
  assert.equal(boot(memory).c.DiVANEngine.trainingGhost.status().enabled, false);
});

test('Чужая геометрия и тюнинг изолированы; повреждённая или слишком большая запись не загружается', () => {
  const { c, memory, advance, lap } = boot(); advance(0); lap();
  const api = c.DiVANEngine.trainingGhost, original = api.keyFor(c.R, c.P);
  c.P.lvl.eng++; assert.notEqual(api.keyFor(c.R, c.P), original); c.P.lvl.eng--;
  c.R.S[4].x += 1; assert.notEqual(api.keyFor(c.R, c.P), original);
  const valid = JSON.parse(memory['rnr.trainingGhost.v1']);
  valid.records[0].samples[1][1] = 'bad';
  const corrupted = boot({ 'rnr.trainingGhost.v1': JSON.stringify(valid) });
  assert.equal(corrupted.c.DiVANEngine.trainingGhost.status().available, false);
  const oversized = boot({ 'rnr.trainingGhost.v1': ' '.repeat(api.limits.bytes + 1) });
  assert.equal(oversized.c.DiVANEngine.trainingGhost.status().available, false);
  assert.equal(api.validRecord({ key: original, bestLap: 400, samples: [[0,1,1,0,0],[400,1,1,0,0]] }), false);
});

test('Угол призрака интерполируется через ±π, конец записи не зацикливается', () => {
  const { c } = boot(), api = c.DiVANEngine.trainingGhost;
  const record = { bestLap: .05, samples: [[0,0,0,3.1,0],[.05,10,20,-3.1,4]] };
  const p = api.interpolate(record, .025);
  assert.equal(p.x, 5); assert.equal(p.y, 10); assert.equal(p.z, 2);
  assert.ok(Math.abs(Math.abs(p.ang) - Math.PI) < 1e-9);
  assert.equal(api.interpolate(record, .051), null);
});

test('Ключ призрака разделяет сценарии, заборы, маршруты и значимые условия одной геометрии', () => {
  const { c } = boot(), api = c.DiVANEngine.trainingGhost, initial = api.keyFor(c.R, c.P);
  c.R.T.tactics = { mode: 'heat', period: 22, warning: 4, active: 6,
    innerRoute: [{ x: 10, y: 20 }, { x: 15, y: 30 }], gate: { x: 10, y: 20, maxhp: 32 } };
  const key = api.keyFor(c.R, c.P); assert.notEqual(key, initial);
  c.R.T.tactics = { gate: { maxhp: 32, y: 20, x: 10 }, innerRoute: [{ y: 20, x: 10 }, { y: 30, x: 15 }],
    active: 6, warning: 4, period: 22, mode: 'heat' };
  assert.equal(api.keyFor(c.R, c.P), key, 'порядок полей не меняет условия');
  for (const change of [t => t.mode = 'press', t => t.period++, t => t.active++, t => t.warning++,
    t => t.gate.maxhp++, t => t.gate.x++, t => t.innerRoute[0].x++]) {
    const before = api.keyFor(c.R, c.P); change(c.R.T.tactics); assert.notEqual(api.keyFor(c.R, c.P), before);
  }
  const beforeObjects = api.keyFor(c.R, c.P); c.R.T.labObjects = [{ type: 'wall', x: 40, y: 60 }];
  assert.notEqual(api.keyFor(c.R, c.P), beforeObjects);
  const beforeSeed = api.keyFor(c.R, c.P); c.R.startSpec = { seed: 123 };
  assert.notEqual(api.keyFor(c.R, c.P), beforeSeed);
  const beforeTerrain = api.keyFor(c.R, c.P); c.R.T.theme = { map: 'snow' };
  assert.notEqual(api.keyFor(c.R, c.P), beforeTerrain);
});

test('Статус призрака виден в живом replay и скрыт на паузе; назначенная G не рекламируется', () => {
  const { c } = boot(), labels = [], api = c.DiVANEngine.trainingGhost;
  c.labTest = false; c.R.replay = true;
  const canvas = { save() {}, restore() {}, fillRect() {}, fillText(text, x, y, width) { labels.push({ text, x, y, width }); } };
  api.drawStatus(canvas, 800);
  assert.match(labels[0].text, /ПРИЗРАК: ВКЛ · G/); assert.match(labels[1].text, /ПОЛНЫЙ ЧИСТЫЙ КРУГ/);
  assert.ok(labels[0].x > 200 && labels[0].x + labels[0].width < 600, 'статус не перекрывает боковые реплики/позиции');
  c.paused = true; labels.length = 0; api.drawStatus(canvas, 800); assert.equal(labels.length, 0);
  c.paused = false; c.settings = { controls: { fire: ['KeyG'] } }; api.setEnabled(false);
  api.drawStatus(canvas, 800); assert.equal(labels[0].text, 'ПРИЗРАК: ВЫКЛ');
});

test('Возврат сохраняет ресурсы и обычный прогресс, запрещает рекорд до следующего полного круга', () => {
  const { c, advance, lap, writes } = boot(); advance(0);
  for (let i = 1; i <= 25; i++) advance(i);
  const before = Object.fromEntries(['hp','wepAmmo','cdW','cdN','cdU','trackIdx','lap','prog'].map(k => [k, c.P[k]]));
  let cancelled = false; c.DiVANEngine.weaponCharge = { cancel() { cancelled = true; } };
  c.P.x += 250; const result = c.DiVANEngine.recovery.recover();
  assert.equal(result.ok, true); assert.equal(result.rolledBack, false); assert.equal(cancelled, true);
  for (const [name, value] of Object.entries(before)) assert.equal(c.P[name], value, name);
  assert.equal(c.P.spd, 0); assert.equal(c.P.air, false); assert.equal(c.P._lapInvalid, true);
  assert.equal(c.DiVANEngine.recovery.recover().ok, false);
  for (let i = 26; i <= 80; i++) advance(i % 80, .05, { spd: 320 });
  assert.equal(c.P.bestLap, 0); assert.equal(c.DiVANEngine.insights.snapshot().bestLap, 0);
  assert.equal(writes.length, 0); assert.equal(c.DiVANEngine.insights.snapshot().recoveries, 1);
  lap(); assert.ok(c.P.bestLap > 0); assert.equal(writes.length, 1);
});

test('Разлом у старта откатывает прогресс назад без подаренного круга; занятое место не используется', () => {
  const { c } = boot();
  c.P.lap = 2; c.P.trackIdx = 1; c.P.prog = 161; c.P._lapCheckpoint = 0;
  c.gapAt = t => t < .04;
  const result = c.DiVANEngine.recovery.recover();
  assert.equal(result.ok, true); assert.equal(result.rolledBack, true);
  assert.equal(c.P.lap, 1); assert.ok(c.P.prog < 161); assert.equal(c.P._lapRestore, true);
  assert.equal(c.P._lapInvalid, true);
  const other = boot(); other.c.P.lap = 0; other.c.P.trackIdx = 20; other.c.P.prog = 20;
  const p = other.c.R.S[20]; other.c.R.racers.push({ x: p.x, y: p.y, trackIdx: 20 });
  assert.equal(other.c.DiVANEngine.recovery.recover().ok, true);
  assert.ok(Math.hypot(other.c.P.x - p.x, other.c.P.y - p.y) > 62);
  assert.ok(other.c.P.prog <= 20);
});

test('Призрак доступен в повторе, а перезапуск гонки очищает статистику и cooldown восстановления', () => {
  const { c, advance, lap } = boot(); c.labTest = false; c.R.replay = true;
  advance(0); lap(); assert.equal(c.DiVANEngine.trainingGhost.status().available, true);
  const shot = c.kitPushShot(c.P, 0, 1, 1, 1); c.kitOnShotHit(shot, { hp: 10 });
  assert.equal(c.DiVANEngine.recovery.recover().ok, true);
  c.R = { ...c.R, racers: [c.P], time: 0, shots: [] }; c.P.bestLap = 0;
  assert.equal(c.DiVANEngine.insights.snapshot().shotsFired, 0);
  assert.equal(c.DiVANEngine.recovery.status().cooldown, 0);
});

test('Смерть, телепорт и разворот через финиш не создают запись призрака', () => {
  for (const reason of ['death', 'teleport', 'reverse']) {
    const { c, advance, writes } = boot(); advance(0);
    for (let i = 1; i <= 30; i++) advance(i);
    if (reason === 'death') { c.killRacer(c.P); c.P.dead = false; }
    else if (reason === 'teleport') { c.P.next = { x: c.P.x + 1000 }; c.R.time += .05; c.stepVehicle(c.P, 1, 0, .05); }
    else {
      c.P.trackIdx = 0; c.P.x = c.R.S[79].x; c.P.y = c.R.S[79].y; c.advanceIdx(c.P);
      assert.equal(c.P._lapInvalid, true);
      c.P.trackIdx = 30; c.P.lap = 0;
    }
    for (let i = 31; i <= 80; i++) advance(i % 80);
    assert.equal(writes.length, 0, reason); assert.equal(c.P.bestLap, 0, reason);
  }
});

test('Хранилище призраков ограничено четырьмя записями и запись не ломает гонку при ошибке диска', () => {
  const { c, memory, advance, lap } = boot();
  for (let track = 0; track < 6; track++) {
    c.P = { ...c.P, trackIdx: 79, x: c.R.S[79].x, y: c.R.S[79].y, lap: -1, lapStart: 0, bestLap: 0, lastLap: 0,
      prog: -1, _lapCheckpoint: 0, _lapRestore: false, _lapInvalid: false };
    c.R = { ...c.R, racers: [c.P], time: 0, T: { ...c.R.T, id: 'track-' + track } };
    advance(0); lap();
  }
  const raw = memory['rnr.trainingGhost.v1'], records = JSON.parse(raw).records;
  assert.equal(records.length, 4); assert.ok(raw.length <= c.DiVANEngine.trainingGhost.limits.bytes);
  c.persistWrite = () => { throw new Error('disk unavailable'); };
  assert.doesNotThrow(() => c.DiVANEngine.trainingGhost.setEnabled(false));
  assert.equal(c.DiVANEngine.trainingGhost.status().storageError, true);
});

test('Возврат не меняет машину, если все участки опасны, и статистика не считает стрельбу на паузе', () => {
  const { c } = boot(); c.P.trackIdx = 30; c.P.lap = 0; c.P.prog = 30;
  c.gapAt = () => true;
  const original = JSON.stringify(c.P);
  assert.equal(c.DiVANEngine.recovery.recover().ok, false);
  assert.equal(JSON.stringify(c.P), original);
  c.paused = true; c.kitPushShot(c.P, 0, 100, 1, 10);
  assert.equal(c.DiVANEngine.insights.snapshot().shotsFired, 0);
});

test('Боевой счётчик учитывает броню, остаток HP и щит, исключая урон самому себе', () => {
  const c = { console, R: { shots: [], demo: false }, P: null,
    kitBubbleBlocks: () => true, kitTinAbsorb: () => 1, kitMidAbsorb: () => 1,
    spark() {}, sHit() {}, doShake() {}, boom() {}, sBoom() {}, announce() {},
    racerTag: () => 'racer', LINES_DIE: ['dead'] };
  c.window = c; c.DiVANEngine = { replace(name, fn) { c[name] = fn; } };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/combat.js'), 'utf8'), c);
  const victim = { hp: 100, maxhp: 100, buffArmor: .5, ch: { grt: 4 }, car: { idx: 0 }, shield: 0 };
  const attacker = { isP: true, dmgDealt: 0, kills: 0 };
  c.dmgRacer(victim, 20, attacker); assert.equal(attacker.dmgDealt, 8);
  victim.shield = 1; c.dmgRacer(victim, 100, attacker); assert.equal(attacker.dmgDealt, 8);
  victim.hp = 5; c.dmgRacer(victim, 100, attacker); assert.equal(attacker.dmgDealt, 13);
  assert.equal(attacker.kills, 1);
  const self = { hp: 100, maxhp: 100, ch: { grt: 0 }, car: { idx: 0 }, dmgDealt: 0 };
  c.dmgRacer(self, 10, self); assert.equal(self.dmgDealt, 0); assert.equal(self.hp, 90);
});
