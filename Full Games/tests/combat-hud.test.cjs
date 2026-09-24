// Проверяет достоверность боевых подсказок и совместимость компактного HUD с полным режимом.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
/** Загружает HUD без Canvas для проверки расчётов и событий. */
function boot() {
  const c = { clamp: (n, a, b) => Math.max(a, Math.min(b, n)), R: { time: 1 },
    P: {}, paused: true, state: 'race', settings: { graphics: {}, controls: {} },
    drawHUD() { c.full = true; }, killRacer() {}, dmgRacer(r, damage) { if (!r.invuln) r.hp -= damage; },
    saveSettings() { c.saved = true; }, addEventListener(type, fn) { c.keydown = fn; },
    kitSliding: r => Math.abs(r.lat || 0) > 38 || (r.handbrake && Math.abs(r.spd) > 48)
  };
  c.window = c; c.DiVANEngine = { wrap(name, factory) { c[name] = factory(c[name]); }, replace(name, fn) { c[name] = fn; } };
  for (const name of ['hud-cyber-kit', 'hud-cyber-panels', 'hud-curvature', 'hud-cyber']) vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/'+name+'.js'), 'utf8'), c);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/engine/combat-hud.js'), 'utf8'), c);
  return c;
}
test('Магазин, кулдаун и перегрев не сообщают ложную готовность', () => {
  const state = boot().DiVANEngine.combatHud.weaponState;
  assert.equal(state({ wepAmmo: 4, cdW: .2 }, { type: 'gun' }, 8, 2).ready, false);
  assert.equal(state({ wepAmmo: 0, cdW: 0 }, { type: 'gun' }, 8, 2).ready, false);
  assert.equal(state({ wepAmmo: 4, cdW: 0 }, { type: 'gun' }, 8, 2).text, '4 / 8');
  assert.match(state({ wepOver: 1 }, { type: 'gatling' }, 0, 2).text, /ОХЛАЖДЕНИЕ/);
});

test('Шпилька сообщает о необходимости заноса, уничтоженная машина не показывает готовность', () => {
  const state = boot().DiVANEngine.combatHud.weaponState;
  assert.equal(state({ cdW: 0, lat: 0 }, { type: 'nails' }, 0, 3).text, 'НУЖЕН ЗАНОС');
  assert.equal(state({ cdW: 0, lat: 40 }, { type: 'nails' }, 0, 3).ready, true);
  assert.equal(state({ cdW: .5, lat: 40 }, { type: 'nails' }, 0, 3).ready, false);
  assert.equal(state({ dead: true, cdW: 0, wepAmmo: 50 }, { type: 'minigun' }, 50, 3).ready, false);
});
test('Угроза — приближающийся вражеский снаряд; уходящий, свой и дальний не засоряют HUD', () => {
  const p = { x: 0, y: 0, ang: 0, spd: 0 };
  const shot = { x: 100, y: 0, vx: -200, vy: 0, life: 2 };
  const race = { shots: [shot, { ...shot, r: p }, { ...shot, vx: 200 }, { ...shot, y: 300 }], mines: [{ x: 30, y: 10, arm: 1 }] };
  const found = boot().DiVANEngine.combatHud.threats(race, p);
  assert.equal(found.length, 1); assert.equal(found[0].kind, 'СНАРЯД');
});
test('Отклик показывает реальную потерю HP, а не урон по неуязвимой машине', () => {
  const c = boot(), enemy = { hp: 100, x: 100, y: 0 }, player = { isP: true, hp: 80, x: 0, y: 0, invuln: 1 };
  c.dmgRacer(player, 20, enemy, 'ram'); assert.equal(c.DiVANEngine.combatHud.feedback().incoming, null);
  player.invuln = 0; c.dmgRacer(player, 20, enemy, 'ram');
  assert.equal(c.DiVANEngine.combatHud.feedback().incoming.text, 'ТАРАН −20');
  c.dmgRacer(enemy, 200, player, 'proj'); assert.equal(c.DiVANEngine.combatHud.feedback().outgoing.damage, 100);
});

test('Предупреждение показывает намерение атаковать игрока и захваченную ракету до попадания', () => {
  const c = boot(), player = { x: 0, y: 0, ang: 0, spd: 0 };
  const rival = { x: 140, y: 0 }, hidden = { x: 100, y: 0, cloak: 1 }, other = {};
  const pending = { target: player, remaining: .2, duration: .4, progress: .5, kind: 'weapon' };
  c.DiVANEngine.ai = { intent: r => r === other ? { ...pending, target: rival } : pending };
  const race = { racers: [player, rival, hidden, other], shots: [{ x: 180, y: 10, vx: 100, vy: 0, life: 2, rocket: true, target: player }], mines: [] };
  const threats = c.DiVANEngine.combatHud.threats(race, player);
  assert.equal(threats.length, 2);
  assert.equal(threats[0].kind, 'ПРИЦЕЛ'); assert.equal(threats[0].progress, .5);
  assert.equal(threats[1].kind, 'РАКЕТА', 'захваченная ракета предупреждает и во время разворота');
  player.finished = true;
  assert.equal(c.DiVANEngine.combatHud.threats(race, player).length, 0);
});

test('Оба режима HUD рисуют одно предупреждение, а полное табло не дублирует метки машин', () => {
  const c = boot(), labels = [];
  c.g = new Proxy({ fillText(value) { labels.push(value); } }, { get(target, key) { return target[key] || (() => {}); } });
  Object.assign(c, { F_B: 'sans-serif', viewW: 1280, viewH: 720, viewS: 1, paused: false,
    raceZoom: () => 1, carHitHalf: () => ({ hw: 20, hh: 12 }), tickHudFx() {} });
  const player = { x: 600, y: 350, ang: 0, spd: 100, isP: true }, rival = { x: 800, y: 350, hp: 100, maxhp: 100 };
  c.P = player; c.R = { phase: 'go', time: 5, cam: { x: 0, y: 0 }, sx: 0, sy: 0,
    racers: [player, rival], order: [player, rival] };
  c.DiVANEngine.ai = { intent: r => r === rival ? { target: player, kind: 'weapon', progress: .5, remaining: .2 } : null };
  c.DiVANEngine.cyberHud.draw = () => {};
  for (const compact of [true, false]) {
    labels.length = 0; c.full = false; c.settings.graphics.combatHud = compact;
    c.drawHUD();
    assert.equal(labels.filter(text => text === 'ПРИЦЕЛ 0.2с').length, 1);
    assert.equal(labels.filter(text => /МЕСТО|ВЫ/.test(text)).length, compact ? 2 : 0);
    assert.equal(c.full, !compact);
  }
});
test('Полный HUD остаётся на паузе; F6 переключает и сохраняет режим, но не крадёт назначенную клавишу', () => {
  const c = boot(); c.drawHUD(); assert(c.full);
  const event = { code: 'F6', preventDefault() {} };
  c.keydown(event); assert.equal(c.settings.graphics.combatHud, false); assert(c.saved);
  c.keydown(event); assert.equal(c.settings.graphics.combatHud, true);
  c.settings.controls.fire = ['F6']; c.keydown(event); assert.equal(c.settings.graphics.combatHud, true);
  for (const [physicalW, physicalH] of [[640, 360], [1280, 720], [2560, 1080], [3840, 2160]]) {
    c.viewS=Math.min(physicalW/1280,physicalH/720);c.viewW=physicalW/c.viewS;c.viewH=physicalH/c.viewS;
    const {width:w,height:h,scale}=c.DiVANEngine.cyberHud.viewport();
    if(physicalH===2160) assert.equal(scale,3,'На 4K размер HUD должен удвоиться относительно 1080p');
    const b = c.DiVANEngine.combatHud.layout(w, h);
    assert(b.x >= 0 && b.x + b.w <= w && b.y + b.h <= h && b.h <= h * .3);
    const layout = c.DiVANEngine.cyberHud.layout(w, h);
    const boxes = ['vehicle','clock','task','speed','arsenal','map'].map(k=>layout[k]);
    assert(boxes.reduce((sum,b)=>sum+b.w*b.h,0)/(w*h)<(layout.small?.22:.2),'Постоянные панели перекрывают слишком много экрана');
    for(const [i,a] of boxes.entries()) {
      assert(a.x>=0 && a.y>=0 && a.x+a.w<=w && a.y+a.h<=h);
      for(const other of boxes.slice(i+1)) assert(a.x+a.w<=other.x || other.x+other.w<=a.x || a.y+a.h<=other.y || other.y+other.h<=a.y);
    }
  }
});

test('Диалоги показывают обоих гонщиков, отбрасывают истёкшие реплики и прошлый заезд', () => {
  const c=boot(), player={isP:true}, rival={}, stale={};
  c.R={time:5,racers:[player,rival]}; c.labTest=false;
  c.VOICE={shown:[{r:player,text:'Игрок',t0:4,life:3},{r:rival,text:'Соперник',t0:4,life:3},{r:stale,text:'Прошлый заезд',t0:4,life:3}]};
  assert.deepEqual(Array.from(c.DiVANEngine.cyberHud.activeVoices(),s=>s.text),['Игрок','Соперник']);
  c.R.time=8; assert.equal(c.DiVANEngine.cyberHud.activeVoices().length,0);
});

test('Изгиб сохраняет центр, симметрично загибает края и удерживает HUD в кадре', () => {
  const {project}=boot().DiVANEngine.hudCurvature;
  const center=project(0,0); assert.equal(center.x,0); assert.equal(center.y,0);
  assert(Math.abs(project(.1,.5).y-project(0,.5).y)<.003,'Центральная область должна оставаться почти ровной');
  assert(project(.95,.9).y>project(0,.9).y+.06,'Край должен выгибаться наружу, в обратную сторону');
  for(let i=0;i<=20;i++) for(let j=0;j<=20;j++) {
    const x=i/20,y=j/20,a=project(x,y),b=project(-x,-y);
    assert(Math.abs(a.x)<=1 && Math.abs(a.y)<=1,'Панель вышла за границы кадра');
    assert(Math.abs(a.x+b.x)<1e-9 && Math.abs(a.y+b.y)<1e-9,'Изгиб несимметричен');
  }
});

test('Без WebGL HUD продолжает рисоваться штатным Canvas без повторных попыток каждый кадр', () => {
  const c=boot(); let created=0,calls=0; const destination={};
  c.document={createElement(){created++;return {getContext:()=>null};}};
  const hud=c.DiVANEngine.hudCurvature;
  for(let i=0;i<3;i++) hud.render(destination,context=>{assert.equal(context,destination);calls++;});
  assert.equal(calls,3); assert.equal(created,2); assert.equal(hud.status().active,false);
});

test('Места над игроком и NPC обновляются при обгоне и не раскрывают невидимых соперников', () => {
  const c=boot(),labels=[];
  c.g=new Proxy({fillText(value){labels.push(value);}}, {get(target,key){return target[key]||(()=>{});}});
  c.F_B='sans-serif';c.viewW=1280;c.viewH=720;c.raceZoom=()=>1;c.carHitHalf=()=>({hw:20,hh:12});
  const player={x:600,y:350,isP:true},rival={x:800,y:350,hp:100,maxhp:100};
  const hidden={...rival,cloak:1},dead={...rival,dead:true},offscreen={...rival,x:1500};
  c.P=player;c.R={time:5,cam:{x:0,y:0},sx:0,sy:0,racers:[player,rival,hidden,dead,offscreen],order:[rival,player,hidden,dead,offscreen]};
  c.DiVANEngine.combatHud.drawMarkers();
  assert.deepEqual(labels,['2 · ВЫ','1 МЕСТО']);
  labels.length=0;c.R.order=[player,rival,hidden,dead,offscreen];c.DiVANEngine.combatHud.drawMarkers();
  assert.deepEqual(labels,['1 · ВЫ','2 МЕСТО']);
  labels.length=0;c.labTest=true;c.DiVANEngine.combatHud.drawMarkers();assert.deepEqual(labels,[]);
});
