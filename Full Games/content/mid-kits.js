////////////////////////////////////////////////////////
//
// Средний класс: кузова 17–21, киты и пул ИИ дивизионов 3–4
//
////////////////////////////////////////////////////////
'use strict';

const MID_ABIL = [
  {nitro:{cd:10},weapon:{cd:1.15,dmg:12,name:'СЧЁТЧИК',type:'meter'},ult:{cd:16,name:'ГУДОК',type:'horn'},
   passive:{fare:true}},
  {nitro:{cd:11},weapon:{cd:1.5,dmg:10,name:'МАСЛО',type:'oil'},ult:{cd:17,name:'ОТКИД',type:'bed'},
   passive:{haul:true}},
  {nitro:{cd:9},weapon:{cd:1.7,dmg:6,name:'ФАРА',type:'lamp'},ult:{cd:14,name:'ОБГОН',type:'overtake'},
   passive:{slick:true}},
  {nitro:{cd:12},weapon:{cd:1.35,dmg:18,name:'ДВЕРЬ',type:'door'},ult:{cd:18,name:'ШТОРКА',type:'curtain'},
   passive:{bumper:true}},
  {nitro:{cd:10},weapon:{cd:1.2,dmg:11,name:'ШПРИЦ',type:'dart'},ult:{cd:16,name:'СИРЕНА',type:'siren'},
   passive:{med:true}}
];
if (typeof CAR_ABIL !== 'undefined') {
  MID_ABIL.forEach((a, i) => { CAR_ABIL[16 + i] = a; });
}

const MID_LO = 16;
const MID_HI = 20;

/** Магазинный средний класс: сильнее хлама, слабее V8. DiVANEngine подменяет isMidCar. */
function isMidCar(i) {
  i = i | 0;
  return i >= MID_LO && i <= MID_HI;
}

/** Дивизионы 3–4 ещё не пускают V8 и выше. DiVANEngine подменяет midFieldOnly. */
function midFieldOnly(div) {
  return (div | 0) <= 4;
}

/** Класс кузова для сетки ИИ. DiVANEngine подменяет fieldCarClassOk. Диапазоны MID_* остаются здесь. */
function fieldCarClassOk(i, div) {
  if (typeof starterFieldOnly === 'function' && starterFieldOnly(div)) {
    return typeof isStarterCar === 'function' ? isStarterCar(i) : false;
  }
  if (midFieldOnly(div)) {
    const junk = typeof isStarterCar === 'function' && isStarterCar(i);
    return junk || isMidCar(i);
  }
  return true;
}

////////////////////////////////////////////////////////
//
// Пассивки
//
////////////////////////////////////////////////////////

/** Полоса Жезла и слики Купе на асфальте. */
function kitAsphaltMul(r, off) {
  if (off || !r || !r.car) return 1;
  if (r.car.idx === 13) return 1.08;
  if (r.car.idx === 18) return 1.06;
  return 1;
}

/** Первый удар круга на Фургоне режется. */
function kitMidAbsorb(r, src) {
  if (!r || r.car.idx !== 19 || (r.vanDoor | 0) <= 0) return 1;
  if (src === 'crush') return 1;
  r.vanDoor = 0;
  if (r.isP && !R.demo) fl(r.x, r.y, 'БУФЕР', '#5a6a88');
  return 0.65;
}

/** Ключ на Скорой — средний ремонт, не полный. */
function kitMidWrench(r) {
  const mag = carAbil(r.car.idx).passive;
  if (!(mag && mag.med)) return false;
  r.hp = Math.min(r.maxhp, r.hp + 14);
  if (r.isP) fl(r.x, r.y, '+АПТЕЧКА', '#c42838');
  return true;
}

////////////////////////////////////////////////////////
//
// Оружие и ульты
//
////////////////////////////////////////////////////////

/** Стрельба среднего класса. true — обработано. */
function fireMidWeapon(r, ab, t, a, dmg, noise, lv) {
  if (t === 'meter') {
    kitPushShot(r, a + noise * 0.4, 720, 0.85, dmg, {meter: true});
    return true;
  }
  if (t === 'oil') {
    kitPushShot(r, a + Math.PI + noise * 0.3, 280, 0.55, dmg, {oilcan: true});
    return true;
  }
  if (t === 'lamp') {
    let hit = 0;
    const rad = 88 + lv * 6;
    for (const o of R.racers) {
      if (o === r || o.dead || o.air) continue;
      const dx = o.x - r.x, dy = o.y - r.y, dist = Math.hypot(dx, dy);
      if (dist > rad) continue;
      const ahead = Math.cos(a) * dx + Math.sin(a) * dy;
      if (ahead < 8) continue;
      o.blind = Math.max(o.blind || 0, 0.85 + lv * 0.08);
      hit++;
    }
    if (r.isP && !R.demo) fl(r.x, r.y, hit ? 'ФАРА!' : 'МИМО', '#c42838');
    return true;
  }
  if (t === 'door') {
    let hit = 0;
    for (const o of R.racers) {
      if (o === r || o.dead || o.air || o.finished) continue;
      const dx = o.x - r.x, dy = o.y - r.y, dist = Math.hypot(dx, dy);
      if (dist > 56 + lv * 3) continue;
      const side = Math.abs(-Math.sin(a) * dx + Math.cos(a) * dy);
      const ahead = Math.abs(Math.cos(a) * dx + Math.sin(a) * dy);
      if (side > 6 && ahead < 28) {
        dmgRacer(o, dmg, r, 'ram');
        o.lat = clamp((o.lat || 0) + (dy > 0 ? 50 : -50), -140, 140);
        hit++;
        spark(o.x, o.y, '#5a6a88', 8, 160);
      }
    }
    if (r.isP && !R.demo) fl(r.x, r.y, hit ? 'ДВЕРЬ!' : 'МИМО', '#5a6a88');
    return true;
  }
  if (t === 'dart') {
    kitPushShot(r, a + noise * 0.25, 860, 0.7, dmg, {dart: true});
    return true;
  }
  return false;
}

/** Ульты среднего класса. true — обработано. */
function useMidUlt(r, ab, t, u) {
  if (t === 'horn') {
    const rad = kitUltRad(r, 110);
    const dur = kitUltDur(r, 1.1);
    for (const o of R.racers) {
      if (o === r || o.dead) continue;
      if (Math.hypot(o.x - r.x, o.y - r.y) < rad) {
        o.flipSteer = Math.max(o.flipSteer || 0, dur);
      }
    }
    return true;
  }
  if (t === 'bed') {
    kitShove(r, kitUltRad(r, 88), true);
    return true;
  }
  if (t === 'overtake') {
    const dur = kitUltDur(r, 1.6);
    r.overtake = dur;
    r.spd = Math.max(r.spd, r.st.top * 1.05);
    return true;
  }
  if (t === 'curtain') {
    r.haze = kitUltDur(r, 2.8);
    r.hazeRad = kitUltRad(r, 108);
    return true;
  }
  if (t === 'siren') {
    const rad = kitUltRad(r, 128);
    const sl = kitUltDur(r, 1.8);
    for (const o of R.racers) {
      if (o === r || o.dead) continue;
      if (Math.hypot(o.x - r.x, o.y - r.y) < rad) {
        o.slow = Math.max(o.slow || 0, sl);
        o.blind = Math.max(o.blind || 0, sl * 0.4);
      }
    }
    return true;
  }
  return false;
}

/** Тик пассивок среднего класса. */
function tickMidRacer(r, dt) {
  if (r.overtake > 0) r.overtake = Math.max(0, r.overtake - dt);
}

/** Лужа масла от Пикапа — отдельно от штатных масляных пятен трассы. */
function midSpawnOil(x, y) {
  if (!R.slicks) R.slicks = [];
  R.slicks.push({x: x, y: y, life: 4.2});
  spark(x, y, '#3a3020', 8, 80);
}

/** Сколько на луже Пикапа. */
function kitOnSlick(r) {
  for (const o of (R && R.slicks) || []) {
    if (Math.hypot(r.x - o.x, r.y - o.y) < 34) return true;
  }
  return false;
}

/** Тик луж. */
function tickMidWorld(dt) {
  if (!R || !R.slicks) return;
  for (let i = R.slicks.length - 1; i >= 0; i--) {
    R.slicks[i].life -= dt;
    if (R.slicks[i].life <= 0) R.slicks.splice(i, 1);
  }
}

/** Масло и шприц на попадании. */
function kitMidShotHit(s, victim) {
  if (s.meter) victim.slow = Math.max(victim.slow || 0, 0.9);
  if (s.dart) victim.slow = Math.max(victim.slow || 0, 1.1);
  if (s.oilcan) midSpawnOil(s.x, s.y);
}

/** Канистра масла рвётся в конце полёта. */
function kitMidShotExpire(s) {
  if (s.oilcan) midSpawnOil(s.x, s.y);
}

/** Рисунок масла среднего класса — те же лужи, что скользят в физике. */
function drawMidWorld(ctx) {
  if (!R) return;
  for (const o of R.slicks || []) {
    ctx.save();
    ctx.globalAlpha = 0.38;
    ctx.fillStyle = '#2a2418';
    ctx.beginPath();
    ctx.arc(o.x, o.y, 30, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}
