////////////////////////////////////////////////////////
//
// Тик ИИ: реверс, ствол, торможение в повороте, съезд.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { enhanceHtml, engineFile } = require('../src/main/enhancements');

/** Песочница тика ИИ. */
function bootAi() {
  const spline = Array.from({ length: 64 }, function (_, i) {
    return { x: i * 12, y: 0, nx: 0, ny: 1, k: 0, ang: 0 };
  });
  const racer = {
    laneT: 4, aiLane: 0, spd: 0, trackIdx: 0, x: 0, y: 0, ang: 0,
    revT: 0, stuckT: 2.6, cdW: 0, cdN: 0, cdU: 0, nitro: 0, skill: 1,
    hp: 80, maxhp: 80, car: { idx: 0 }, st: { top: 360, grip: .7 }, wepOver: 0, wepAmmo: 0, ith: 0, ist: 0, pitSide: null
  };
  const g = {
    console,
    _rand: 0.99,
    Math: Object.assign(Object.create(Math), { random: function () { return g._rand; } }),
    clamp: function (n, a, b) { return n < a ? a : n > b ? b : n; },
    rnd: function () { return 0; },
    angDiff: function (a, b) {
      let d = a - b;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      return d;
    },
    kitAiWantsFire: function () { return false; },
    wepMagMax: function () { return 0; },
    carAbil: function () { return { weapon: { type: 'fang' } }; },
    fireWeapon: function (r) { g._fired = r; },
    useNitro: function (r) { g._nitro = r; },
    useUlt: function (r) { g._ult = r; },
    killRacer: function (r, killer) { r.dead = true; g._killer = killer; return 'killed'; },
    respawn: function (r) { r.dead = false; return 'respawned'; },
    ROADW: 140,
    R: { S: spline, N: spline.length, racers: [racer], demo: false },
    aiThink: function () {},
    finishDrive: function () { return { th: 0, st: 0 }; }
  };
  g.racer = racer;
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/ai-personality.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/ai-think.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает тик ИИ после оружия и до рамок', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/ai-think.js'));
  assert(out.indexOf('weapons-tick.js') < out.indexOf('ai-think.js'));
  assert(out.indexOf('ai-think.js') < out.indexOf('collision.js'));
  assert(out.indexOf('ai-think.js') < out.indexOf('scene.js'));
  assert(engineFile('__engine/ai-think.js').endsWith('ai-think.js'));
});

test('Реверс при застревании, огонь, тормоз в повороте и съезд', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../content/rnr.html'), 'utf8');
  assert(html.includes('function aiThink('));
  assert(html.includes('function finishDrive('));
  const g = bootAi();
  const r = g.racer;
  g.aiThink(r, 0.016);
  assert(r.revT > 0);
  assert.equal(r.ith, -1);
  assert.equal(r.stuckT, 0);

  r.revT = 0; r.stuckT = 0; r.spd = 200; r.cdW = 0;
  g.R.S[24].k = 0.02;
  g.aiThink(r, 0.016);
  assert(r.ith < 0, 'ИИ тормозит до скорости, подходящей для поворота');

  const prey = { dead: false, finished: false, x: 40, y: 0 };
  g.R.racers = [r, prey];
  g.kitAiWantsFire = function () { return true; };
  g._rand = 0;
  r.spd = 80; r.revT = 0; r.stuckT = 0; r.cdU = 1; r.cdN = 1;
  g.aiThink(r, 1);
  assert.equal(g._fired, undefined, 'сначала противник предупреждает об атаке');
  assert.equal(g.DiVANEngine.ai.intent(r).target, prey);
  g.aiThink(r, .4);
  assert.equal(g._fired, r);

  r.x = 10; r.y = 20; r.spd = 80; r.trackIdx = 0; r.pitSide = null;
  g.R.racers = [r];
  const d = g.finishDrive(r);
  assert.equal(r.pitSide, 1);
  assert.equal(d.th, -0.12);
  assert(d.st >= -1 && d.st <= 1);
});

test('Реверс повторно спасает застрявшего соперника, нитро с истёкшим таймером снова доступно', () => {
  const g = bootAi(), r = g.racer;
  r.revT = .001; r.stuckT = 0; r.cdW = r.cdU = r.cdN = 1;
  g.aiThink(r, .016); assert.equal(r.revT, 0);
  for (let i = 0; i < 160; i++) g.aiThink(r, .016);
  assert(r.revT > 0); assert.equal(r.ith, -1);
  r.revT = 0; r.stuckT = 0; r.spd = 260; r.nitro = -.05; r.cdN = 0; g._rand = 0;
  g.aiThink(r, .016); assert.equal(g._nitro, r);
});

test('Характеры дают разные скорости входа и полосы, не меняя мощность и HP', () => {
  const g = bootAi(), policy = g.DiVANEngine.aiPersonality;
  g.R.S[24].k = .02; g.R.S[24].ang = .6;
  const plans = {};
  for (const aiStyle of ['aggressive', 'cautious', 'technical']) {
    const r = { ...g.racer, aiStyle, aiLane: 0, spd: 180, slot: 1 };
    const stats = JSON.stringify(r.st);
    plans[aiStyle] = policy.drivePlan(r, g.R, .1);
    assert.equal(JSON.stringify(r.st), stats); assert.equal(r.hp, 80);
    assert(Math.abs(r.aiLane) <= 55);
  }
  assert(plans.cautious.targetSpeed < plans.technical.targetSpeed);
  assert(plans.technical.targetSpeed < plans.aggressive.targetSpeed);
  assert.equal(plans.cautious.targetLane, 0);
  assert(plans.technical.targetLane > 0, 'техничный выбирает внутреннюю дугу');
  assert(plans.cautious.throttle < plans.aggressive.throttle);
});

test('Осторожный замечает машину раньше; перестроение не выталкивает за край трассы', () => {
  const g = bootAi(), policy = g.DiVANEngine.aiPersonality;
  const front = { x: 115, y: 0, spd: 200 };
  const cautious = { ...g.racer, spd: 200, aiStyle: 'cautious', slot: 1 };
  const aggressive = { ...cautious, aiStyle: 'aggressive' };
  const slow = policy.drivePlan(cautious, { ...g.R, racers: [cautious, front] }, .1);
  const fast = policy.drivePlan(aggressive, { ...g.R, racers: [aggressive, front] }, .1);
  assert.notEqual(slow.targetLane, 0); assert.equal(fast.targetLane, 0);
  assert(Math.abs(cautious.aiLane) <= 55);
});

test('Неподвижного соперника объезжает малым ходом, а перед занятыми полосами ждёт', () => {
  const g = bootAi(), policy = g.DiVANEngine.aiPersonality, r = g.racer;
  Object.assign(r, { spd: 0, stuckT: 0, aiStyle: 'cautious' });
  const front = { x: 40, y: 0, spd: 0 };
  const free = policy.drivePlan(r, { ...g.R, racers: [r, front] }, .1);
  assert.equal(free.blocked, false); assert.notEqual(free.targetLane, 0);
  assert(free.targetSpeed >= 40 && free.targetSpeed < 70); assert(free.throttle > 0);
  const blocked = policy.drivePlan(r, { ...g.R, racers: [r, front, { x: 0, y: -55 }, { x: 0, y: 55 }] }, .1);
  assert.equal(blocked.blocked, true); assert.equal(blocked.targetSpeed, 0);
  r.spd = 20;
  assert(policy.drivePlan(r, { ...g.R, racers: [r, front, { x: 0, y: -55 }, { x: 0, y: 55 }] }, .1).throttle < 0);
});

test('Выбор оружейной цели пропускает машину сзади, другой этаж, маскировку и союзника', () => {
  const g = bootAi(), r = g.racer, policy = g.DiVANEngine.aiPersonality;
  const behind = { x: -20, y: 0 }, otherDeck = { x: 30, y: 0, deck: 1 }, cloaked = { x: 40, y: 0, cloak: 1 };
  const ally = { x: 50, y: 0, ally: true }, target = { x: 130, y: 0 };
  g.racerDeck = racer => racer.deck || 0;
  g.storyAllyHoldsFire = (_r, o) => !!o.ally;
  g.kitAiWantsFire = (self, o) => o.x > self.x;
  g.R.racers = [r, behind, otherDeck, cloaked, ally, target];
  assert.equal(policy.chooseTarget(r, g.R, true).target, target);
});

test('Предупреждение не пропускается на 30/60/120 Гц и отменяется при потере цели', () => {
  for (const hz of [30, 60, 120]) {
    const g = bootAi(), r = g.racer, target = { x: 130, y: 0 };
    r.spd = 180; r.stuckT = 0; r.cdN = r.cdU = 1; g._rand = 0;
    g.R.racers = [r, target]; g.kitAiWantsFire = () => true;
    g.aiThink(r, 1 / hz);
    const pending = g.DiVANEngine.ai.intent(r);
    assert(pending); assert.equal(g._fired, undefined);
    let elapsed = 0;
    while (!g._fired && elapsed < 1) { g.aiThink(r, 1 / hz); elapsed += 1 / hz; }
    assert(elapsed + 1e-8 >= pending.duration && elapsed <= pending.duration + 1 / hz + 1e-8);
    g._fired = null; r._aiAttackRest = 0;
    g.aiThink(r, 1 / hz); assert(g.DiVANEngine.ai.intent(r));
    target.cloak = 1; g.aiThink(r, 1 / hz);
    assert.equal(g.DiVANEngine.ai.intent(r), null); assert.equal(g._fired, null);
  }
});

test('Тяжёлый ствол использует собственный заряд, обычная очередь не предупреждает перед каждой пулей', () => {
  const g = bootAi(), r = g.racer, target = { x: 130, y: 0 };
  r.spd = 180; r.stuckT = 0; r.cdN = r.cdU = 1; g._rand = 0;
  g.R.racers = [r, target]; g.kitAiWantsFire = () => true;
  let shots = 0; g.fireWeapon = () => shots++;
  g.DiVANEngine.weaponCharge = { requiresCharge: () => true, state: () => null };
  g.aiThink(r, 1 / 60); assert.equal(shots, 1); assert.equal(g.DiVANEngine.ai.intent(r), null);
  g.DiVANEngine.weaponCharge.state = () => ({ remaining: .2 }); r._aiAttackRest = 0;
  g.aiThink(r, .3); assert.equal(shots, 1, 'ожидание заряда не запускает вторую атаку');
  g.DiVANEngine.weaponCharge = null; g.carAbil = () => ({ weapon: { type: 'gatling' } });
  g.aiThink(r, .016); assert(g.DiVANEngine.ai.intent(r));
  g.aiThink(r, .4); assert.equal(shots, 2);
  g.aiThink(r, .05); assert.equal(shots, 3); assert.equal(g.DiVANEngine.ai.intent(r), null);
});

test('Смерть и возрождение отменяют старое намерение и очередь без тика ИИ между ними', () => {
  const g = bootAi(), r = g.racer, target = { x: 130, y: 0 };
  r.spd = 180; r.stuckT = 0; r.cdN = r.cdU = 1; g._rand = 0;
  g.R.racers = [r, target]; g.kitAiWantsFire = () => true;
  g.aiThink(r, .016); assert(g.DiVANEngine.ai.intent(r));
  r._aiBurst = { target, remaining: .5 }; r.revT = .4;
  assert.equal(g.killRacer(r, target), 'killed'); assert.equal(g._killer, target);
  assert.equal(r._aiIntent, null); assert.equal(r._aiBurst, null); assert.equal(r.revT, 0);
  // Даже прямое возрождение восстановленного объекта не переносит старую очередь.
  r._aiIntent = { kind: 'weapon', target, remaining: .001, duration: .4 };
  r._aiBurst = { target, remaining: .5 }; r._aiAttackRest = 1; r.stuckT = 3;
  assert.equal(g.respawn(r), 'respawned');
  assert.equal(r._aiIntent, null); assert.equal(r._aiBurst, null); assert.equal(r._aiAttackRest, 0);
  assert.equal(r.stuckT, 0);
  g.aiThink(r, .016);
  assert(g.DiVANEngine.ai.intent(r)); assert.equal(g._fired, undefined);
  assert.equal(g.DiVANEngine.ai.intent(r).remaining, g.DiVANEngine.ai.intent(r).duration);
});

test('Плавность выбранной полосы не зависит от частоты вызова', () => {
  const lanes = [30, 60, 120].map(hz => {
    const g = bootAi(), r = g.racer;
    r.aiStyle = 'technical'; r.spd = 200; r.stuckT = 0;
    g.R.S[24].k = .02; g.R.S[24].ang = .6;
    for (let i = 0; i < hz; i++) g.DiVANEngine.aiPersonality.drivePlan(r, g.R, 1 / hz);
    return r.aiLane;
  });
  assert(Math.max(...lanes) - Math.min(...lanes) < 1e-8);
});

test('Все три характера проезжают тесный и быстрый вираж реальной физикой без внутреннего среза', () => {
  for (const radius of [160, 500]) for (const aiStyle of ['aggressive', 'cautious', 'technical']) {
    const g = bootAi(), r = g.racer, count = Math.round(Math.PI * 2 * radius / 14);
    const S = Array.from({ length: count }, (_, i) => {
      const a = i / count * Math.PI * 2;
      return { x: 5000 + Math.cos(a) * radius, y: 5000 + Math.sin(a) * radius,
        nx: -Math.cos(a), ny: -Math.sin(a), ang: a + Math.PI / 2, k: 1 / radius };
    });
    Object.assign(r, { aiStyle, x: S[0].x, y: S[0].y, ang: S[0].ang, stuckT: 0, chIdx: -1,
      lat: 0, lvl: {}, wheelAngle: 0, wheelRot: 0, bolt: 0, invuln: 0, slow: 0, drone: 0, buffDmgT: 0,
      st: { top: 400, acc: 300, crn: 3.1, sharp: .4, grip: .72, off: .6 } });
    Object.assign(g, { gt: 0, P: null, ROADW: 95, introReduceMotion: true,
      settings: { graphics: { weather: false, skids: false } }, lerp: (a, b, t) => a + (b - a) * t,
      stepVehicle() {}, landDust() {}, wheelSprayKind: () => 'dust', inPuddle: () => false, vfxLive: () => false, spawnCanvasSpray() {} });
    Object.assign(g.R, { S, N: count, div: 1, T: { w: 10000, h: 10000, theme: {} }, oils: [], ramps: [], skids: [], parts: [] });
    for (const file of ['handling.js', 'driving.js']) vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/' + file), 'utf8'), g);
    let maximumError = 0, progress = 0, previous = 0;
    for (let i = 0; i < 2400; i++) {
      const angle = (Math.atan2(r.y - 5000, r.x - 5000) + Math.PI * 2) % (Math.PI * 2);
      const index = Math.round(angle / (Math.PI * 2) * count) % count;
      let delta = index - previous;
      if (delta < -count / 2) delta += count;
      if (delta > count / 2) delta -= count;
      progress += delta; previous = index; r.trackIdx = index;
      g.gt += 1 / 120; g.aiThink(r, 1 / 120); g.stepVehicle(r, r.ith, r.ist, 1 / 120, false);
      maximumError = Math.max(maximumError, Math.abs(Math.hypot(r.x - 5000, r.y - 5000) - radius));
    }
    assert(maximumError < 68, `${aiStyle}, R=${radius}: отклонение ${maximumError}`);
    assert(progress > count, `${aiStyle}: не проехал полный круг`);
    assert([r.x, r.y, r.spd, r.ang].every(Number.isFinite));
  }
});
