////////////////////////////////////////////////////////
//
// Средний класс: кузова 17–23, киты и пул ИИ дивизионов 3–4
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
   passive:{med:true}},
  {nitro:{cd:8},weapon:{cd:.08,dmg:6,name:'ПУЛЕМЁТ',type:'gatling',heat:.075,overheat:3.1},ult:{cd:20,name:'АГР',type:'aggro'},
   passive:{rebound:true,threatSense:true}},
  {nitro:{cd:11},weapon:{cd:.08,dmg:6,name:'ПУЛЕМЁТ',type:'gatling',heat:.075,overheat:3.1},ult:{cd:20,name:'НАПРОЛОМ',type:'foresterCharge'},
   passive:{rebound:true,bigfoot:true}}
];
if (typeof CAR_ABIL !== 'undefined') {
  MID_ABIL.forEach((a, i) => { CAR_ABIL[16 + i] = a; });
}

const MID_LO = 16;
const MID_HI = 22;

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
  if (!r) return 1;
  const marked = (r.intelMark || 0) > 0 ? 1.18 : 1;
  if (r.car.idx !== 19 || (r.vanDoor | 0) <= 0 || src === 'crush') return marked;
  r.vanDoor = 0;
  if (r.isP && !R.demo) fl(r.x, r.y, 'БУФЕР', '#5a6a88');
  return marked * 0.65;
}

/** Ключ на Скорой — средний ремонт, не полный. */
function kitMidWrench(r) {
  const mag = carAbil(r.car.idx).passive;
  if (!(mag && mag.med)) return false;
  r.hp = Math.min(r.maxhp, r.hp + 14);
  if (r.isP) fl(r.x, r.y, '+АПТЕЧКА', '#c42838');
  return true;
}

/** Ближайшая живая машина на том же уровне трассы. */
function midNearestTarget(r) {
  let best = null, bd = Infinity;
  for (const o of (R && R.racers) || []) {
    if (!o || o === r || o.dead || o.finished) continue;
    if (typeof racerDeck === 'function' && racerDeck(r) !== racerDeck(o)) continue;
    if (typeof storyAllyHoldsFire === 'function' && storyAllyHoldsFire(r, o)) continue;
    const d = Math.hypot(o.x - r.x, o.y - r.y);
    if (d < bd) { best = o; bd = d; }
  }
  return best;
}

/** Отскок от Мьёльнира/Форестера и усиленный толчок активного Форестера. */
function kitMidCollisionRebound(a, b, impact) {
  if (!impact) return false;
  let changed = false;
  const shove = function (source, victim, distance, impulse) {
    let dx = victim.x - source.x, dy = victim.y - source.y;
    const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    victim.x += dx * distance; victim.y += dy * distance;
    const fx = Math.cos(victim.ang), fy = Math.sin(victim.ang);
    victim.spd += (dx * fx + dy * fy) * impulse;
    victim.lat = clamp((victim.lat || 0) + (-dx * fy + dy * fx) * impulse, -140, 140);
    victim._contactGrace = Math.max(victim._contactGrace || 0, .32);
    changed = true;
  };
  for (const protectedCar of [a, b]) {
    if (!protectedCar.car || (protectedCar.car.idx !== 21 && protectedCar.car.idx !== 22)) continue;
    const other = protectedCar === a ? b : a;
    if (protectedCar.car.idx === 22 && protectedCar.foresterCharge > 0 && impact.attacker === protectedCar) {
      shove(protectedCar, other, 24, 175);
    } else if (impact.attacker === other) {
      shove(protectedCar, other, 11, 92);
    }
  }
  return changed;
}

/** Мьёльнир отдёргивается от ближайшей пули или мины до попадания. */
function midThreatDodge(r) {
  if (!r || !r.car || r.car.idx !== 21 || r.threatDodge > 0 || !R) return false;
  let side = 0, urgency = Infinity;
  const fx = Math.cos(r.ang), fy = Math.sin(r.ang);
  for (const s of R.shots || []) {
    if (!s || s.r === r) continue;
    const dx = s.x - r.x, dy = s.y - r.y, rvx = (s.vx || 0) - fx * (r.spd || 0), rvy = (s.vy || 0) - fy * (r.spd || 0);
    const vv = rvx * rvx + rvy * rvy;
    if (vv < 1) continue;
    const t = -(dx * rvx + dy * rvy) / vv;
    if (t < 0 || t > .65) continue;
    const cx = dx + rvx * t, cy = dy + rvy * t, miss = Math.hypot(cx, cy);
    if (miss < 42 && t < urgency) { urgency = t; side = (-dx * fy + dy * fx) >= 0 ? -1 : 1; }
  }
  for (const m of R.mines || []) {
    if (!m || m.dead || m.owner === r) continue;
    const dx = m.x - r.x, dy = m.y - r.y, ahead = dx * fx + dy * fy, across = -dx * fy + dy * fx;
    if (ahead > -10 && ahead < 115 && Math.abs(across) < 48 && ahead / Math.max(40, Math.abs(r.spd || 0)) < urgency) {
      urgency = ahead / Math.max(40, Math.abs(r.spd || 0)); side = across >= 0 ? -1 : 1;
    }
  }
  if (!side) return false;
  r.lat = clamp((r.lat || 0) + side * 72, -140, 140);
  r.aiLane = clamp((r.aiLane || 0) + side * 34, -60, 60);
  r.threatDodge = .8;
  if (r.isP && !R.demo) fl(r.x, r.y, 'УГРОЗА · УКЛОН', '#e0b229');
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
  if (t === 'intel') {
    kitPushShot(r, a + noise * 0.18, 940, 0.78, dmg, {intel: true});
    return true;
  }
  if (t === 'breaker') {
    kitPushShot(r, a + noise * 0.12, 820, 0.9, dmg, {breaker: true});
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
  if (t === 'aggro') {
    const target = midNearestTarget(r);
    if (!target) return true;
    target.aggroMark = Math.max(target.aggroMark || 0, 10);
    target.aggroSource = r;
    r.aggroIgnored = Math.max(r.aggroIgnored || 0, 10);
    if (!R.demo) fl(target.x, target.y, 'АГР · 10 СЕК', '#ff3d2e');
    return true;
  }
  if (t === 'foresterCharge') {
    r.foresterCharge = Math.max(r.foresterCharge || 0, kitUltDur(r, 4));
    r.spd = Math.max(r.spd, r.st.top * 1.15);
    r.lat = 0;
    return true;
  }
  return false;
}

/** Тик пассивок среднего класса. */
function tickMidRacer(r, dt) {
  if (r.overtake > 0) r.overtake = Math.max(0, r.overtake - dt);
  if (r.intelMark > 0) r.intelMark = Math.max(0, r.intelMark - dt);
  if (r.aggroMark > 0) r.aggroMark = Math.max(0, r.aggroMark - dt);
  if (r.aggroIgnored > 0) r.aggroIgnored = Math.max(0, r.aggroIgnored - dt);
  if (r.foresterCharge > 0) r.foresterCharge = Math.max(0, r.foresterCharge - dt);
  if (r.threatDodge > 0) r.threatDodge = Math.max(0, r.threatDodge - dt);
  if (r.car && r.car.idx === 21) midThreatDodge(r);
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
  if (s.intel) {
    victim.intelMark = Math.max(victim.intelMark || 0, 4.2);
    if (victim.isP && !R.demo) fl(victim.x, victim.y, 'ПОМЕЧЕН', '#e0b229');
  }
  if (s.breaker) {
    victim.nitro = 0;
    victim.cdN = Math.max(victim.cdN || 0, 2.4);
    victim.slow = Math.max(victim.slow || 0, 0.9);
    victim.shield = 0;
    dmgRacer(victim, Math.min(12, 4 + (victim.maxhp || 100) * 0.045), s.r, 'proj');
  }
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
  const aimOwner = (R.racers || []).find(r => r.car && r.car.idx === 21 && r.isP && r.cdU <= 0);
  const preview = aimOwner ? midNearestTarget(aimOwner) : null;
  for (const r of R.racers || []) {
    const marked = (r.aggroMark || 0) > 0;
    if (!marked && preview !== r) continue;
    const col = marked ? '#ff3d2e' : '#e0b229', radius = marked ? 34 : 29;
    ctx.save(); ctx.translate(r.x, r.y); ctx.rotate((typeof gt === 'number' ? gt : 0) * (marked ? 1.8 : 1.1));
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    if (ctx.setLineDash) ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, TAU); ctx.stroke();
    if (ctx.setLineDash) ctx.setLineDash([]);
    for (let i = 0; i < 4; i++) { ctx.rotate(TAU / 4); ctx.beginPath(); ctx.moveTo(radius - 7, 0); ctx.lineTo(radius + 7, 0); ctx.stroke(); }
    ctx.restore();
    if (typeof txt === 'function') txt(ctx, marked ? 'АГР' : 'АВТО', r.x, r.y - radius - 12, 10, col, 'center', typeof F_B !== 'undefined' ? F_B : undefined);
  }
}
