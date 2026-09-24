// Измеряет торможение, снос и воспроизводимость управления всего автопарка.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/** Минимальная ровная площадка без погоды, препятствий, бонусов и эффектов. */
function boot() {
  const c = { console, Math, gt: 0, ROADW: 100000, P: null, introReduceMotion: true,
    settings: { graphics: { weather: true, skids: false } },
    R: { S: [{ x: 5000, y: 5000 }], N: 1, T: { w: 100000, h: 100000, theme: {} }, oils: [], ramps: [], racers: [], parts: [], skids: [] },
    clamp: (n, a, b) => Math.max(a, Math.min(b, n)), lerp: (a, b, t) => a + (b - a) * t,
    landDust() {}, wheelSprayKind: () => 'dust', inPuddle: () => false, vfxLive: () => false, rnd: (a, b) => (a + b) / 2
  };
  c.window = c;
  c.DiVANEngine = { replace(name, fn) { c[name] = fn; } };
  vm.createContext(c);
  for (const name of ['handling.js', 'driving.js']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../src/engine', name), 'utf8'), c);
  return c;
}
/** Одинаковые статы отделяют действие профиля от двигателя и прокачки пилота. */
function racer(idx) {
  return { car: { idx, hov: idx === 3 }, st: { top: 400, acc: 300, crn: 3.1, sharp: .4, grip: .72, off: .6 },
    x: 5000, y: 5000, ang: 0, spd: 240, lat: 0, trackIdx: 0, hp: 100, maxhp: 100,
    isP: true, chIdx: -1, slot: 0, lvl: {}, wheelAngle: 0, wheelRot: 0, invuln: 0,
    bolt: 0, nitro: 0, cdN: 0, cdW: 0, cdU: 0, slow: 0, drone: 0, buffDmgT: 0 };
}
/** Выполняет ровно указанное время независимо от частоты внешнего вызова. */
function run(c, r, seconds, throttle, steer, hand = false, hz = 120) {
  for (let i = 0; i < Math.round(seconds * hz); i++) { c.gt += 1 / hz; c.stepVehicle(r, throttle, steer, 1 / hz, hand); }
  return r;
}
test('Тормозной путь: лёгкая < универсальная < тяжёлая; нет броска в задний ход', () => {
  const paths = [7, 0, 4].map(idx => {
    const c = boot(), r = racer(idx);
    for (let i = 0; i < 240 && r.spd > .5; i++) c.stepVehicle(r, -1, 0, 1 / 120, false);
    assert.equal(r.spd, 0);
    const distance = r.x - 5000;
    run(c, r, .1, -1, 0); assert.equal(r.spd, 0);
    run(c, r, .25, -1, 0); assert(r.spd < 0);
    return distance;
  });
  assert(paths[0] < paths[1] && paths[1] < paths[2], JSON.stringify(paths));
});
test('Лёгкая острее входит в поворот; тяжёлая спокойнее; ручник создаёт управляемый снос', () => {
  const angles = [7, 0, 4].map(idx => { const c = boot(); return run(c, racer(idx), .4, 1, 1).ang; });
  assert(angles[0] > angles[1] && angles[1] > angles[2]);
  for (const idx of [7, 0, 4]) {
    const c = boot(), normal = run(c, racer(idx), .4, 1, 1), slide = run(c, racer(idx), .4, 1, 1, true);
    assert(Math.abs(slide.lat) > Math.abs(normal.lat) * 2);
    const before = Math.abs(slide.lat); run(c, slide, .6, 1, 0);
    assert(Math.abs(slide.lat) < before * .25);
  }
});
test('Дождь и лёд не поворачивают машины на прямой', () => {
  for (let idx = 0; idx < 21; idx++) {
    const c = boot(); c.R.weather = { id: 'rain', mod: .5 }; c.R.T.theme.deco = 'ice';
    const r = run(c, racer(idx), 1, 1, 0); assert.equal(r.ang, 0); assert.equal(r.lat, 0);
  }
});
test('Поведение конечно и близко при 30/60/120 Гц', () => {
  for (let idx = 0; idx < 21; idx++) {
    const results = [30, 60, 120].map(hz => run(boot(), racer(idx), 1, 1, .4, false, hz));
    assert(results.every(r => [r.x, r.y, r.spd, r.lat, r.ang].every(Number.isFinite)));
    assert(Math.max(...results.map(r => r.ang)) - Math.min(...results.map(r => r.ang)) < .05);
    assert(Math.max(...results.map(r => r.spd)) - Math.min(...results.map(r => r.spd)) < 6);
  }
});

test('Все штатные кузова покрыты явными неизменяемыми профилями', () => {
  const h = boot().DiVANEngine.handling;
  assert.equal(Object.keys(h.profiles).length, 21);
  for (let idx = 0; idx < 21; idx++) {
    const p = h.profile(racer(idx).car);
    assert(Object.isFrozen(p));
    for (const field of ['brake', 'response', 'turn', 'stability', 'hold', 'drift', 'recovery']) assert(Number.isFinite(p[field]));
    assert(p.brake >= 400 && p.brake <= 750);
    assert.equal(p, h.profiles[idx]);
  }
});

test('Пользовательский профиль следует редактору, не переписывая характеристики', () => {
  const h = boot().DiVANEngine.handling, car = { idx: 27, custom: true, hp: 80, top: 1 };
  const before = JSON.stringify(car);
  assert.equal(h.profile(car), h.families.light); assert.equal(JSON.stringify(car), before);
  car.top = 1.2; assert.equal(h.profile(car), h.families.sport);
  car.hp = 150; assert.equal(h.profile(car), h.families.heavy);
  car.hov = true; assert.equal(h.profile(car), h.families.hover);
  car.hov = false; car.hp = NaN; car.top = Infinity; assert.equal(h.profile(car), h.families.balanced);
  assert.equal(h.profile({ idx: 0, hov: true }), h.families.hover);
  assert.notEqual(h.profile({ idx: 3, hov: false }), h.families.hover);
});

test('Весь автопарк останавливается до реверса, ховер не получает ручник и боковой снос', () => {
  for (let idx = 0; idx < 21; idx++) {
    const c = boot(), r = racer(idx);
    for (let i = 0; i < 240 && r.spd > .5; i++) c.stepVehicle(r, -1, 0, 1 / 120, false);
    assert.equal(r.spd, 0, String(idx));
    run(c, r, .1, -1, 0); assert.equal(r.spd, 0);
    run(c, r, .3, -1, 0); assert(r.spd < 0);
  }
  const c = boot(), r = run(c, racer(3), .4, 1, 1, true);
  assert.equal(r.handbrake, false); assert.equal(r.lat, 0);
});

test('Шпилька сохраняет занос для оружия; мокрая трасса снижает сцепление колёсных машин', () => {
  const c = boot(), drift = run(c, racer(8), .4, 1, 1, true);
  assert(Math.abs(drift.lat) > 38 && drift.spd > 48);
  const plain = run(boot(), racer(0), .4, 1, 1, true);
  const before = Math.abs(drift.lat), normalBefore = Math.abs(plain.lat);
  run(c, drift, .6, 1, 0); run(boot(), plain, .6, 1, 0);
  assert(Math.abs(drift.lat) / before > Math.abs(plain.lat) / normalBefore);
  for (let idx = 0; idx < 21; idx++) {
    if (idx === 3) continue;
    const dry = run(boot(), racer(idx), .5, 1, .5);
    const wet = boot(); wet.R.weather = { id: 'rain', mod: .4 }; wet.R.T.theme.deco = 'ice';
    assert(Math.abs(run(wet, racer(idx), .5, 1, .5).lat) > Math.abs(dry.lat));
  }
});

test('Аналоговый газ дозирует ускорение, отпускание курка не включает торможение', () => {
  const full = racer(0), half = racer(0);
  full.spd = 0; half.spd = 0;
  run(boot(), full, .5, 1, 0);
  run(boot(), half, .5, .5, 0);
  assert.ok(Math.abs(half.spd / full.spd - .5) < .01);
  const coast = racer(0), eased = racer(0);
  coast.spd = 320; eased.spd = 320;
  run(boot(), coast, .5, 0, 0);
  run(boot(), eased, .5, .25, 0);
  assert.ok(eased.spd > coast.spd, 'частичный газ не замедляет сильнее свободного наката');
  assert.ok(eased.spd <= eased.st.top);
});

test('Задний ход можно отпустить и снова нажать без мгновенной остановки', () => {
  const c = boot(), r = racer(0);
  r.spd = -80;
  run(c, r, .1, 0, 0);
  const coasting = r.spd;
  c.stepVehicle(r, -1, 0, 1 / 120, false);
  assert.ok(r.spd < coasting, 'повторный курок продолжает разгон назад без повторной задержки');
});

test('Газ при движении назад сначала тормозит до нуля; боковой снос не включает реверс', () => {
  const c = boot(), r = racer(0);
  r.spd = -80;
  for (let i = 0; i < 120 && r.spd < 0; i++) c.stepVehicle(r, 1, 0, 1 / 120, false);
  assert.equal(r.spd, 0);
  c.stepVehicle(r, 1, 0, 1 / 120, false);
  assert.ok(r.spd > 0);
  r.spd = 1; r.lat = 90;
  c.stepVehicle(r, -1, 0, 1 / 120, false);
  assert.equal(r.spd, 0, 'боковой снос не проталкивает продольную скорость через ноль');
});

test('Выпрямление и контрруление отзывчивы и одинаковы при разной частоте кадров', () => {
  const h = boot().DiVANEngine.handling;
  const residual = [30, 60, 120].map(hz => {
    let value = 1;
    for (let i = 0; i < hz / 5; i++) value = h.steering(value, 0, 10, 1 / hz);
    return value;
  });
  assert.ok(residual.every(value => value < .04 && value >= 0));
  assert.ok(Math.max(...residual) - Math.min(...residual) < .000001);
  assert.ok(h.steering(1, -1, 10, .06) < 0, 'контрруление быстрее пересекает центр');
  const c = boot(), r = racer(0);
  c.stepVehicle(r, NaN, Infinity, 1 / 60, false);
  assert.ok([r.x, r.y, r.spd, r.lat, r.ang].every(Number.isFinite));
});

test('Масса принадлежит кузову, броня не стирает различие лёгкого и тяжёлого', () => {
  const h = boot().DiVANEngine.handling;
  const light = racer(7), heavy = racer(4);
  light.lvl.arm = 6; light.lvl.eng = 6;
  assert(h.mass(light) < h.mass(heavy));
  const before = h.mass(light); light.lvl.eng = 0;
  assert.equal(h.mass(light), before);
  assert(h.traction(h.profile(light.car), .8, 1, 1, 0, false, .7).slip >
    h.traction(h.profile(heavy.car), .8, 1, 1, 0, false, .7).slip);
});

test('Контрруление ловит занос быстрее удержания поворота, выход под газом сохраняет скорость', () => {
  const initial = run(boot(), racer(0), .4, 1, 1, true);
  assert(initial._drift.active);
  const counter = JSON.parse(JSON.stringify(initial)), inside = JSON.parse(JSON.stringify(initial));
  run(boot(), counter, .18, .65, -.65);
  run(boot(), inside, .18, .65, .65);
  assert(Math.abs(counter.lat) < Math.abs(inside.lat));
  const power = JSON.parse(JSON.stringify(initial)), coast = JSON.parse(JSON.stringify(initial));
  run(boot(), power, .5, .65, 0); run(boot(), coast, .5, 0, 0);
  assert(power.spd > coast.spd);
  assert(Math.abs(power.lat) < Math.abs(coast.lat));
});

test('Занос не учитывает полёт, удар, ховер и парковку; частота кадров не меняет состояние', () => {
  const h = boot().DiVANEngine.handling;
  for (const hz of [30, 60, 120]) {
    const r = racer(0); r.lat = 55;
    for (let i = 0; i < hz / 2; i++) h.driftState(r, 1 / hz);
    assert(r._drift.active);
    r._contactGrace = .2; h.driftState(r, 1 / hz); assert.equal(r._drift.active, false);
    r._contactGrace = 0; r.air = true; h.driftState(r, 1 / hz); assert.equal(r._drift.intensity, 0);
    r.air = false; r.car.hov = true; h.driftState(r, 1 / hz); assert.equal(r._drift.active, false);
    r.car.hov = false; r.spd = 0; h.driftState(r, 1 / hz); assert.equal(r._drift.intensity, 0);
  }
});

test('Нитро вытягивает выход из поворота, буксует на скользком и не зависит от видимости дождя', () => {
  const normal = racer(0), dry = racer(0), slick = racer(0);
  for (const r of [normal, dry, slick]) r.spd = 110;
  dry.nitro = slick.nitro = 2;
  run(boot(), normal, .25, 1, 0); run(boot(), dry, .25, 1, 0);
  const ice = boot(); ice.R.T.theme.deco = 'ice'; slick._tacticGrip = .45;
  run(ice, slick, .25, 1, 0);
  assert(dry.spd > normal.spd + 25);
  assert(dry.spd > slick.spd + 20);
  const rain = shown => { const c = boot(); c.settings.graphics.weather = shown;
    c.R.weather = {id: 'rain', mod: .4}; return run(c, racer(0), .7, 1, .8); };
  assert.equal(rain(true).lat, rain(false).lat);
  assert.equal(rain(true).spd, rain(false).spd);
});
