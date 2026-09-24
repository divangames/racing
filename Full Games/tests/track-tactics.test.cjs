// Проверяет честную длину маршрутов, предупреждения, безопасность обхода и JSON редактора.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const tactics = require('../src/engine/track-tactics');
const { enhanceTacticsContent } = require('../src/main/tactics-content');
const { validateTrack } = require('../src/main/document-store');
/** Загружает настоящие трассы и геометрию без холста и дисковой записи. */
function boot(physical = false) {
  const c = { console, RnRTactics: tactics, ROADW: 95, TAU: Math.PI * 2, paused: false,
    angDiff: (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b)),
    clamp: (n, a, b) => Math.max(a, Math.min(b, n)),
    dmgRacer(r, d) { r.hp -= d; }, carHitHalf: () => ({ hw: 24, hh: 14 }),
    buildTrack() {}, buildRace() {}, placeTrackHazards() {}, stepVehicle() {}, aiThink() {}, drawHUD() {}, resolveRaceContact() {} };
  c.window = c; c.DiVANEngine = { replace(name, fn) { c[name] = fn; }, wrap(name, make) { c[name] = make(c[name]); } };
  if (physical) Object.assign(c, { gt: 0, P: null, introReduceMotion: true, settings: { graphics: { weather: false, skids: false } },
    lerp: (a, b, t) => a + (b - a) * t, landDust() {}, spark() {}, wheelSprayKind: () => 'dust', inPuddle: () => false, vfxLive: () => false });
  vm.createContext(c);
  const source = fs.readFileSync(path.resolve(__dirname, '../content/tracks.js'), 'utf8');
  vm.runInContext(enhanceTacticsContent(source, '/tracks.js'), c);
  for (const name of ['track.js', 'track-span.js', 'collision.js', ...(physical ? ['handling.js', 'driving.js', 'track-rail.js', 'race-progress.js'] : []), 'arena-tactics.js']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../src/engine', name), 'utf8'), c);
  return c;
}
test('Все 15 штатных трасс получают измеримый выбор длины без изменения кругов', () => {
  const c = boot();
  const reports = c.RnRTracks.STOCK.map((def, i) => {
    const T = c.buildTrack(def, i), p = T.tactics;
    assert(p, def.name + ': не найден поворот');
    assert(p.shortLength < p.longLength * .94, def.name);
    assert(p.routeShortLength < p.routeLongLength * .97, def.name + ': учитываются оба общих въезда');
    assert.deepEqual(p.innerRoute[0], p.outerRoute[0]);
    assert.deepEqual(p.innerRoute.at(-1), p.outerRoute.at(-1));
    assert.equal(tactics.laneOffset(p, p.entry, true), 0);
    assert.equal(tactics.laneOffset(p, p.exit, false), 0);
    assert(p.a > 0 && p.b < T.N && p.a < p.b);
    return p.mode;
  });
  assert.equal(reports.length, 15); assert.equal(new Set(reports).size, 3);
});
test('Кампания и пользовательские карты не меняются без выбора автора', () => {
  const c = boot(), base = c.RnRTracks.STOCK[0];
  for (const flags of [{ chapter: 1 }, { custom: true }, { lab: true }, { tactics: { mode: 'off' } }]) assert.equal(c.buildTrack({ ...base, ...flags }, 0).tactics, null);
  assert.equal(c.buildTrack({ ...base, custom: true, tactics: { mode: 'press' } }, 0).tactics.mode, 'press');
});
test('До воздействия всегда есть предупреждение, каждый цикл возвращается в безопасную фазу', () => {
  for (const p of Object.values(tactics.MODES)) {
    const rest = p.period - p.warning - p.active;
    assert.equal(tactics.phase(p, 0).kind, 'open');
    assert.equal(tactics.phase(p, rest).kind, 'warning');
    assert.equal(tactics.phase(p, rest + p.warning).kind, 'active');
    assert.equal(tactics.phase(p, p.period).kind, 'open');
  }
});
test('Внешняя полоса безопасна от события; урон не зависит от FPS и не двигает прогресс', () => {
  for (const hz of [30, 60, 120]) {
    const c = boot(), T = c.buildTrack({ ...c.RnRTracks.STOCK[0], tactics: { mode: 'heat' } }, 0), p = T.tactics;
    const i = Math.floor((p.a + p.b) / 2), s = T.S[i];
    c.R = { T, S: T.S, N: T.N, phase: 'go', _tacticStart: 0, time: p.period - p.active + .1 };
    const make = side => ({ x: s.x + s.nx * side * p.side * 48, y: s.y + s.ny * side * p.side * 48, trackIdx: i, hp: 100, spd: 200, prog: i });
    const risky = make(1), safe = make(-1);
    for (let n = 0; n < hz; n++) { c.DiVANEngine.tactics.affect(risky, 1 / hz); c.DiVANEngine.tactics.affect(safe, 1 / hz); }
    assert.equal(risky.hp, 90); assert.equal(safe.hp, 100); assert.equal(risky.prog, i);
    c.paused = true; const hp = risky.hp; c.DiVANEngine.tactics.affect(risky, 1); assert.equal(risky.hp, hp);
  }
});
test('Нормализация, клон стока, undo-снимок и JSON сохраняют сценарий; неверный режим отвергается', () => {
  const c = boot();
  vm.runInContext(enhanceTacticsContent(fs.readFileSync(path.resolve(__dirname, '../content/editor/map-data.js'), 'utf8'), '/editor/map-data.js'), c);
  const doc = vm.runInContext("MapData.fileTrack(MapData.fromStock({...RnRTracks.STOCK[0], tactics:{mode:'slick'}}, 'tactic_test', 0))", c);
  assert.equal(doc.tactics.mode, 'slick'); assert.equal(validateTrack(doc), null);
  assert.equal(c.RnRTracks.normalize(JSON.parse(JSON.stringify(doc))).tactics.mode, 'slick');
  doc.tactics.mode = 'bad'; assert.match(validateTrack(doc), /сценарий/);
});

test('Нормализация трассы сохраняет отражение объектов', () => {
  const c = boot();
  const object = c.RnRTracks.normalize({id:'flip_test',cps:[[0,0],[100,0],[100,100],[0,100]],objects:[{pack:'world',id:'tower',x:10,y:20,w:30,h:40,flipX:true,flipY:true}]}).objects[0];
  assert.equal(object.flipX,true);assert.equal(object.flipY,true);
});

test('Пресс тормозит, охладитель снижает сцепление только внутри активного сектора', () => {
  for (const mode of ['press', 'slick']) {
    const c = boot(), T = c.buildTrack({ ...c.RnRTracks.STOCK[0], tactics: { mode } }, 0), p = T.tactics;
    const i = Math.floor((p.a + p.b) / 2), s = T.S[i];
    c.R = { T, S: T.S, N: T.N, phase: 'go', _tacticStart: 0, time: p.period - p.active + .1 };
    const r = { x: s.x + s.nx * p.side * 48, y: s.y + s.ny * p.side * 48, trackIdx: i, hp: 100, spd: 200 };
    c.DiVANEngine.tactics.affect(r, .5);
    assert.equal(r.hp, mode === 'press' ? 91 : 100);
    assert.equal(r._tacticGrip, mode === 'slick' ? .42 : 1);
    assert.equal(r.spd < 200, mode === 'press');
    r.x = s.x - s.nx * p.side * 48; r.y = s.y - s.ny * p.side * 48;
    c.DiVANEngine.tactics.affect(r, .1);
    assert.equal(r._tacticGrip, 1); assert.equal(r._tacticDamage, 0);
  }
});

test('Стартовый отсчёт не расходует окно; ИИ выбирает обход во время предупреждения', () => {
  const c = boot(), T = c.buildTrack({ ...c.RnRTracks.STOCK[0], tactics: { mode: 'heat' } }, 0), p = T.tactics;
  const s = T.S[p.a];
  c.R = { T, S: T.S, N: T.N, phase: 'count', time: 10 };
  assert.equal(c.DiVANEngine.tactics.state(c.R).kind, 'open'); assert.equal(c.R._tacticStart, undefined);
  c.R.phase = 'go'; c.R.time = 13;
  assert.equal(c.DiVANEngine.tactics.state(c.R).remaining, p.period - p.active - p.warning);
  const r = { x:s.x, y:s.y, trackIdx:p.a, spd:500, hp:100, maxhp:100, ang:0 };
  c.aiThink(r, 1/60); assert.equal(r.aiLane, p.side * 48);
  c.R.time = 13 + p.period - p.active - 2;
  c.aiThink(r, 1/60); assert.equal(r.aiLane, -p.side * 48); assert(Number.isFinite(r.ist));
});

function gateScene() {
  const c = boot(), T = c.buildTrack(c.RnRTracks.STOCK[0], 0);
  c.R = { T, S: T.S, N: T.N, time: 0, phase: 'go', racers: [], shots: [] };
  return c;
}
function gateRacer(c, across, along, speed) {
  const f = c.DiVANEngine.tactics.gate(c.R), ca = Math.cos(f.angle), sa = Math.sin(f.angle);
  return { x: f.x + ca * along - sa * across, y: f.y + sa * along + ca * across,
    ang: f.angle, spd: speed, lat: 0, hp: 100, maxhp: 100, car: { idx: 0 }, trackIdx: f.index, prog: f.index };
}
test('Внутренний забор останавливает медленный корпус, внешний путь свободен и прогресс честный', () => {
  const c = gateScene(), api = c.DiVANEngine.tactics, f = api.gate(c.R);
  const inside = gateRacer(c, 0, -20, 60), outer = gateRacer(c, -c.R.T.tactics.side * 96, -20, 60);
  const prevIn = gateRacer(c, 0, -40, 60), prevOut = gateRacer(c, -c.R.T.tactics.side * 96, -40, 60);
  const outerBefore = { ...outer }, prog = inside.prog;
  api.contactGate(inside, prevIn, 1 / 60); api.contactGate(outer, prevOut, 1 / 60);
  assert.equal(f.hp, f.maxhp); assert.equal(f.broken, false);
  assert.equal(c.obbOverlap(c.carObb(inside), { cx: f.x, cy: f.y, ca: Math.cos(f.angle), sa: Math.sin(f.angle), hw: 8, hh: 32 }), null);
  assert.equal(outer.x, outerBefore.x); assert.equal(outer.y, outerBefore.y); assert.equal(outer.hp, 100);
  assert.equal(inside.prog, prog); assert.equal(inside.hp, 100);
});
test('Таран пробивает забор с ценой корпуса/скорости один раз, новый заезд восстанавливает его', () => {
  const c = gateScene(), api = c.DiVANEngine.tactics, f = api.gate(c.R);
  const r = gateRacer(c, 0, 50, 220), before = gateRacer(c, 0, -70, 220);
  api.contactGate(r, before, 1 / 30);
  assert(f.broken); assert.equal(f.hp, 0); assert(r.hp >= 93 && r.hp < 100); assert(r.spd > 160 && r.spd < 220);
  const hp = r.hp; api.contactGate(r, before, 1 / 30); assert.equal(r.hp, hp);
  assert.equal(c.R.T.tactics.gate.hp, undefined, 'исходная геометрия не меняется');
  c.buildRace(); assert.equal(api.gate(c.R).broken, false); assert.equal(api.gate(c.R).hp, 32);
});
test('Быстрые снаряды попадают в забор между кадрами; призрак и полёт его обходят', () => {
  for (const hz of [30, 60, 120]) {
    const c = gateScene(), api = c.DiVANEngine.tactics, f = api.gate(c.R), ca = Math.cos(f.angle), sa = Math.sin(f.angle);
    for (let n = 0; n < 4; n++) {
      c.R.shots.push({ x: f.x - ca * 10, y: f.y - sa * 10, vx: ca * 1800, vy: sa * 1800, dmg: 8, r: {} });
      c.resolveRaceContact(1 / hz);
    }
    assert(f.broken); assert.equal(c.R.shots.length, 0);
  }
  const c = gateScene(), api = c.DiVANEngine.tactics;
  c.kitGhost = r => !!r.ghost;
  for (const flag of ['air', 'ghost', 'finished', 'dead']) {
    const r = gateRacer(c, 0, -20, 220), before = gateRacer(c, 0, -40, 220); r[flag] = true;
    api.contactGate(r, before, 1 / 60); assert.equal(r.hp, 100); assert.equal(api.gate(c.R).hp, 32);
  }
});

test('Обе полосы проезжаются настоящей физикой и учётом прогресса; открытый внутренний путь экономит время', () => {
  function drive(track, risky) {
    const c = boot(true), T = c.buildTrack(c.RnRTracks.STOCK[track], track), p = T.tactics, s = T.S[p.entry];
    c.R = { T, S: T.S, N: T.N, phase: 'go', time: 0, _tacticStart: 0, racers: [], oils: [], ramps: [], parts: [], skids: [], shocks: [] };
    const r = { x: s.x, y: s.y, ang: s.ang, spd: 180, lat: 0, car: { idx: 0 },
      st: { top: 400, acc: 300, crn: 3.1, sharp: .4, grip: .72, off: .6 },
      trackIdx: p.entry, lap: 0, prog: p.entry, hp: 100, maxhp: 100, isP: true, chIdx: -1, slot: 0, lvl: {},
      wheelAngle: 0, wheelRot: 0, invuln: 0, bolt: 0, nitro: 0, cdN: 0, cdW: 0, cdU: 0, slow: 0, drone: 0, buffDmgT: 0 };
    c.R.racers = [r]; c.P = r;
    const gate = c.DiVANEngine.tactics.gate(c.R); gate.broken = true; gate.hp = 0;
    let rails = 0;
    for (let frame = 0; frame < 3600 && r.trackIdx < p.exit; frame++) {
      const index = Math.min(T.N - 1, r.trackIdx + 5), next = T.S[index], offset = tactics.laneOffset(p, index, risky);
      const dx = next.x + next.nx * offset - r.x, dy = next.y + next.ny * offset - r.y;
      const steer = c.clamp(c.angDiff(Math.atan2(dy, dx), r.ang) * 3.4, -1, 1);
      const throttle = c.clamp((180 - r.spd) / 35, -.3, 1), before = r.trackIdx;
      c.gt += 1 / 120; c.R.time += 1 / 120; c.stepVehicle(r, throttle, steer, 1 / 120, false); c.advanceIdx(r);
      if (r._railHitN) rails++;
      assert(r.trackIdx - before < 4, 'нет скачка к выходу среза');
      assert.equal(r.prog, r.trackIdx, 'прогресс задан реальным индексом');
    }
    assert(r.trackIdx >= p.exit, 'автомобиль добрался до общего выхода');
    assert.equal(rails, 0, T.name + ': рельс не корректирует доступную траекторию');
    assert.equal(r.hp, 100); assert.equal(r.lap, 0);
    return c.R.time;
  }
  for (let track = 0; track < 15; track++) {
    const inner = drive(track, true), outer = drive(track, false);
    assert(inner < outer * .97, JSON.stringify({ track, inner, outer }));
  }
});
