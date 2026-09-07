////////////////////////////////////////////////////////
//
// Стартовый мусорный класс: кузова 12–16, киты и сдача в тюнинг
//
////////////////////////////////////////////////////////
'use strict';

const STARTER_ABIL = [
  {nitro:{cd:12},weapon:{cd:1.4,dmg:9,name:'БАКЛАГА',type:'can'},ult:{cd:16,name:'ХЛОПОК',type:'backfire'},
   passive:{tin:true}},
  {nitro:{cd:11},weapon:{cd:0.85,dmg:6,name:'ГАЙКА',type:'bolts'},ult:{cd:18,name:'СБРОС КУЗОВА',type:'dumpbody'},
   passive:{mouse:true}},
  {nitro:{cd:11},weapon:{cd:1.6,dmg:4,name:'ЖЕЗЛ',type:'baton'},ult:{cd:20,name:'МИГАЛКА',type:'strobe'},
   passive:{asphalt:true}},
  {nitro:{cd:12},weapon:{cd:1.8,dmg:14,name:'ПОДСТВОЛЬЕ',type:'roofshot'},ult:{cd:17,name:'ЛЕБЁДКА',type:'winch'},
   passive:{dirt:true}},
  {nitro:{cd:13},weapon:{cd:1.25,dmg:16,name:'ЛОМ',type:'crowbar'},ult:{cd:19,name:'ОТЦЕП',type:'dropbox'},
   passive:{scrap:true}}
];
if (typeof CAR_ABIL !== 'undefined') {
  STARTER_ABIL.forEach((a, i) => { CAR_ABIL[11 + i] = a; });
}

const STARTER_LO = 11;
const STARTER_HI = 15;
const JUNK_TUNE_GIFT = 2;
const JUNK_TUNE_KEYS = [
  {k: 'eng', n: 'ДВИГАТЕЛЬ'},
  {k: 'tir', n: 'ШИНЫ'},
  {k: 'shk', n: 'АМОРТИЗАТОРЫ'},
  {k: 'nit', n: 'НИТРО'},
  {k: 'wep', n: 'СТВОЛ'},
  {k: 'ult', n: 'УЛЬТА'}
];

let junkTuneCar = -1;
let junkTuneLeft = 0;
let junkTuneSel = 0;

/** Магазинный хлам, слабее всех стоковых. */
function isStarterCar(i) {
  i = i | 0;
  return i >= STARTER_LO && i <= STARTER_HI;
}

/** Дивизионы 1–2 едут только на стартовых кузовах. */
function starterFieldOnly(div) {
  return (div | 0) <= 2;
}

////////////////////////////////////////////////////////
//
// Покупка: два уровня на пустые слоты
//
////////////////////////////////////////////////////////

/** После покупки хлама сразу даёт два уровня в пустые слоты и открывает гараж. */
function beginJunkTune(idx) {
  if (!save) return false;
  if (!isStarterCar(idx)) return false;
  if (!save.tuning) save.tuning = typeof allTunes === 'function' ? allTunes() : {};
  if (!save.tuning[idx]) save.tuning[idx] = blankTune();
  if (typeof ensureTuneGuns === 'function') ensureTuneGuns(save.tuning[idx]);
  const tun = save.tuning[idx];
  const got = [];
  let left = JUNK_TUNE_GIFT;
  for (let i = 0; i < JUNK_TUNE_KEYS.length && left > 0; i++) {
    const key = JUNK_TUNE_KEYS[i];
    if ((tun[key.k] | 0) >= 6) continue;
    tun[key.k] = (tun[key.k] | 0) + 1;
    got.push(key.n);
    left--;
  }
  persist();
  state = 'garage';
  const car = CARS[idx];
  garMsg = car
    ? ('КУПЛЕНА: ' + car.name + (got.length ? ' · +' + got.join(' + ') : ''))
    : 'КУПЛЕНА';
  garMsgT = 2.8;
  if (typeof SFX !== 'undefined' && SFX.play) SFX.play('tune');
  return true;
}

/** Ставит один подарочный уровень в выбранный слот. */
function applyJunkTunePoint() {
  if (junkTuneLeft <= 0 || junkTuneCar < 0 || !save) return;
  const key = JUNK_TUNE_KEYS[junkTuneSel];
  if (!key) return;
  const tun = save.tuning[junkTuneCar] || blankTune();
  if (typeof ensureTuneGuns === 'function') ensureTuneGuns(tun);
  save.tuning[junkTuneCar] = tun;
  if ((tun[key.k] | 0) >= 6) {
    if (typeof sHit === 'function') sHit();
    return;
  }
  tun[key.k] = (tun[key.k] | 0) + 1;
  junkTuneLeft--;
  if (typeof SFX !== 'undefined' && SFX.play) SFX.play('tune');
  if (junkTuneLeft <= 0) finishJunkTune();
  else persist();
}

/** Выход в гараж после сдачи или пропуска. */
function finishJunkTune() {
  const car = CARS[junkTuneCar];
  junkTuneCar = -1;
  junkTuneLeft = 0;
  persist();
  state = 'garage';
  garMsg = car ? ('КУПЛЕНА: ' + car.name + ' · сдача в слоты') : 'КУПЛЕНА';
  garMsgT = 2.4;
}

/** Клавиши экрана сдачи. */
function handleJunkTuneKey(c) {
  if (state !== 'junkTune') return false;
  if (c === 'ArrowLeft') {
    junkTuneSel = (junkTuneSel + JUNK_TUNE_KEYS.length - 1) % JUNK_TUNE_KEYS.length;
    if (typeof sClick === 'function') sClick();
    return true;
  }
  if (c === 'ArrowRight') {
    junkTuneSel = (junkTuneSel + 1) % JUNK_TUNE_KEYS.length;
    if (typeof sClick === 'function') sClick();
    return true;
  }
  if (typeof isConfirm === 'function' ? isConfirm(c) : (c === 'Enter' || c === 'Space')) {
    applyJunkTunePoint();
    return true;
  }
  if (typeof isBack === 'function' ? isBack(c) : (c === 'Escape')) {
    finishJunkTune();
    if (typeof sClick === 'function') sClick();
    return true;
  }
  return true;
}

/** Клики по слотам сдачи. */
function handleJunkTuneClick(x, y) {
  if (state !== 'junkTune') return false;
  const hits = g._junkHits || [];
  for (const b of hits) {
    if (x < b.x || x > b.x + b.w || y < b.y || y > b.y + b.h) continue;
    if (b.act === 'skip') {
      finishJunkTune();
      if (typeof sClick === 'function') sClick();
      return true;
    }
    if (b.i != null) {
      junkTuneSel = b.i | 0;
      applyJunkTunePoint();
      return true;
    }
  }
  return false;
}

/** Карточка сдачи в рамке гаража, не пустой чёрный кадр. */
function drawJunkTune() {
  try {
    const car = CARS[junkTuneCar] || CARS[save && save.car];
    const ch = CHARS[save && save.char];
    drawHubBackdrop('rgba(255,210,63,.08)');
    drawHubHeader('СДАЧА С КАССЫ', (car ? car.name : 'КУЗОВ') + ' · осталось ' + junkTuneLeft, '#ffd23f');
    const bayX = HUB_PAD + HUB_STAGE_W + HUB_STAGE_GAP;
    const bayW = W - HUB_PAD - bayX;
    if (ch) drawPilotStage(HUB_PAD, HUB_TOP, HUB_STAGE_W, HUB_FOOT - HUB_TOP, ch, {
      title: ch.name, sub: car ? car.name : '', subCol: '#9a93a8'
    });
    drawHubCard(bayX, HUB_TOP, bayW, HUB_FOOT - HUB_TOP);
    txt(g, 'два уровня на пустые слоты', bayX + 24, HUB_TOP + 36, 16, '#e8e2d0', 'left', F_B);
    txt(g, 'клик или ENTER — вкачать · ESC — голый сток', bayX + 24, HUB_TOP + 60, 13, '#8a8498', 'left', F_B);
    const px = bayX + 16, py = HUB_TOP + 80, pw = bayW - 32, previewH = 220;
    g.save();
    rr(g, px, py, pw, previewH, 12);
    g.clip();
    if (car && ch) drawDrivingCarPreview(g, px + pw / 2, py + previewH / 2, pw, previewH, car, ch);
    g.restore();
    g._junkHits = [];
    const tun = (save && save.tuning && save.tuning[junkTuneCar]) || {};
    const rowY = py + previewH + 28;
    const cardW = Math.min(132, (pw - 12) / JUNK_TUNE_KEYS.length);
    JUNK_TUNE_KEYS.forEach((slot, i) => {
      const x = bayX + 16 + i * cardW;
      const on = i === junkTuneSel;
      const maxed = (tun[slot.k] | 0) >= 6;
      panel(g, x + 4, rowY, cardW - 8, 88, on ? 'rgba(255,210,63,.2)' : 'rgba(20,16,28,.85)', on ? '#ffd23f' : '#3a3548', 10);
      txt(g, slot.n, x + cardW / 2, rowY + 28, 12, on ? '#ffd23f' : '#c8c0d4', 'center', F_B);
      txt(g, maxed ? 'МАКС' : String(tun[slot.k] | 0), x + cardW / 2, rowY + 58, 22, maxed ? '#58ff6b' : '#e8e2d0', 'center', F_D);
      g._junkHits.push({x: x + 4, y: rowY, w: cardW - 8, h: 88, i: i});
    });
    const skipY = HUB_FOOT - 56;
    panel(g, bayX + 16, skipY, 220, 40, 'rgba(255,61,46,.12)', '#ff3d2e', 8);
    txt(g, 'ПРОПУСТИТЬ', bayX + 126, skipY + 20, 14, '#ff6b4a', 'center', F_B);
    g._junkHits.push({x: bayX + 16, y: skipY, w: 220, h: 40, act: 'skip'});
  } catch (err) {
    console.error(err);
    finishJunkTune();
  }
}

////////////////////////////////////////////////////////
//
// Пассивки и хитбокс
//
////////////////////////////////////////////////////////

/** Множитель рамки при сбросе кузова Каблука. */
function kitHitScale(r) {
  if ((r && r.bodyDump) > 0) return 0.78;
  return 1;
}

/** Первый удар круга на Тазике режется пополам. */
function kitTinAbsorb(r, src) {
  if (!r || r.car.idx !== 11 || (r.tinDoor | 0) <= 0) return 1;
  if (src === 'crush') return 1;
  r.tinDoor = 0;
  if (r.isP && !R.demo) fl(r.x, r.y, 'ЖЕСТЬ', '#c45c28');
  return 0.5;
}

/** Бездорожье Козла слабее Урала. */
function kitStarterOff(car, off) {
  if (car && car.idx === 14) return Math.min(0.88, off + 0.08);
  return off;
}

////////////////////////////////////////////////////////
//
// Оружие и ульты хлама
//
////////////////////////////////////////////////////////

/** Стрельба стартовых кузовов. true — обработано. */
function fireStarterWeapon(r, ab, t, a, dmg, noise, lv) {
  if (t === 'can') {
    kitPushShot(r, a + noise, 520, 0.95, dmg, {can: true});
    return true;
  }
  if (t === 'bolts') {
    for (const off of [-0.28, -0.12, 0.12, 0.28]) {
      kitPushShot(r, a + off + noise, 780, 0.38, dmg, {bolts: true});
    }
    return true;
  }
  if (t === 'baton') {
    kitPushShot(r, a + noise * 0.4, 640, 0.7, dmg, {baton: true});
    return true;
  }
  if (t === 'roofshot') {
    for (const off of [-0.22, -0.1, 0, 0.1, 0.22]) {
      kitPushShot(r, a + off + noise, 700, 0.32, dmg / 5, {fang: true});
    }
    return true;
  }
  if (t === 'crowbar') {
    let hit = 0;
    for (const o of R.racers) {
      if (o === r || o.dead || o.air || o.finished) continue;
      const dx = o.x - r.x, dy = o.y - r.y, dist = Math.hypot(dx, dy);
      if (dist > 52 + lv * 3) continue;
      const ahead = Math.cos(a) * dx + Math.sin(a) * dy;
      const side = Math.abs(-Math.sin(a) * dx + Math.cos(a) * dy);
      if (ahead > -8 && ahead < 36 && side > 8) {
        dmgRacer(o, dmg, r, 'ram');
        hit++;
        spark(o.x, o.y, '#8a3020', 8, 160);
      }
    }
    if (r.isP && !R.demo) fl(r.x, r.y, hit ? 'ЛОМ!' : 'МИМО', '#8a3020');
    return true;
  }
  return false;
}

/** Ульты стартовых кузовов. true — обработано. */
function useStarterUlt(r, ab, t, u) {
  if (t === 'backfire') {
    r.soot = kitUltDur(r, 2);
    r.sootRad = kitUltRad(r, 92);
    return true;
  }
  if (t === 'dumpbody') {
    r.bodyDump = kitUltDur(r, 2.5);
    return true;
  }
  if (t === 'strobe') {
    const rad = kitUltRad(r, 140);
    const dur = kitUltDur(r, 1.8);
    for (const o of R.racers) {
      if (o === r || o.dead) continue;
      if (Math.hypot(o.x - r.x, o.y - r.y) < rad) {
        o.flipSteer = Math.max(o.flipSteer || 0, dur);
        o.blind = Math.max(o.blind || 0, dur * 0.6);
      }
    }
    return true;
  }
  if (t === 'winch') {
    const dist = 86 + u * 6;
    r.x += Math.cos(r.ang) * dist;
    r.y += Math.sin(r.ang) * dist;
    r.spd = Math.max(r.spd, r.st.top * 0.72);
    spark(r.x, r.y, '#5a7a42', 14, 200);
    return true;
  }
  if (t === 'dropbox') {
    if (!R.crates) R.crates = [];
    const back = r.ang + Math.PI;
    R.crates.push({
      x: r.x + Math.cos(back) * 38,
      y: r.y + Math.sin(back) * 38,
      life: 6 + u * 0.4,
      hw: 18,
      hh: 14
    });
    return true;
  }
  return false;
}

/** Тик пассивок хлама на гонщике. */
function tickStarterRacer(r, dt) {
  if (r.soot > 0) {
    r.soot = Math.max(0, r.soot - dt);
    for (const o of R.racers) {
      if (o === r || o.dead) continue;
      if (Math.hypot(o.x - r.x, o.y - r.y) < (r.sootRad || 92)) {
        o.slow = Math.max(o.slow || 0, 0.35);
      }
    }
  }
  if (r.bodyDump > 0) r.bodyDump = Math.max(0, r.bodyDump - dt);
  if (r.flipSteer > 0) r.flipSteer = Math.max(0, r.flipSteer - dt);
}

/** Лужа огня и холодильник на трассе. */
function tickStarterWorld(dt) {
  if (!R) return;
  if (!R.fires) R.fires = [];
  if (!R.crates) R.crates = [];
  for (let i = R.fires.length - 1; i >= 0; i--) {
    const f = R.fires[i];
    f.life -= dt;
    if (f.life <= 0) { R.fires.splice(i, 1); continue; }
    for (const o of R.racers) {
      if (o.dead || o.air) continue;
      if (Math.hypot(o.x - f.x, o.y - f.y) < (f.rad || 28)) {
        dmgRacer(o, (f.dps || 8) * dt, f.owner, 'proj');
      }
    }
  }
  for (let i = R.crates.length - 1; i >= 0; i--) {
    const c = R.crates[i];
    c.life -= dt;
    if (c.life <= 0) { R.crates.splice(i, 1); continue; }
    for (const o of R.racers) {
      if (o.dead || o.air) continue;
      const d = Math.hypot(o.x - c.x, o.y - c.y);
      if (d < 28) {
        const nx = (o.x - c.x) / (d || 1), ny = (o.y - c.y) / (d || 1);
        o.x += nx * 10;
        o.y += ny * 10;
        o.spd *= 0.82;
      }
    }
  }
}

/** Канистра оставляет лужу; жезл оглушает руль. */
function kitStarterShotHit(s, victim) {
  if (s.can) starterSpawnFire(s.x, s.y, s.r);
  if (s.baton) victim.flipSteer = Math.max(victim.flipSteer || 0, 0.45);
  if (s.bolts) victim.lat = clamp((victim.lat || 0) + (Math.random() > 0.5 ? 40 : -40), -140, 140);
}

/** Канистра рвётся в конце полёта. */
function kitStarterShotExpire(s) {
  if (s.can) starterSpawnFire(s.x, s.y, s.r);
}

/** Огненная лужа от бака. */
function starterSpawnFire(x, y, owner) {
  if (!R.fires) R.fires = [];
  R.fires.push({x: x, y: y, life: 1.2, rad: 30, dps: 11, owner: owner});
  spark(x, y, '#ff6b2e', 10, 140);
}

/** Ключ на Борте — крошечный корпус, не полный ремонт. */
function kitStarterWrench(r) {
  const mag = carAbil(r.car.idx).passive;
  if (!(mag && mag.scrap)) return false;
  r.hp = Math.min(r.maxhp, r.hp + 4);
  if (r.isP) fl(r.x, r.y, '+ХЛАМ', '#6e6a66');
  return true;
}

/** Рисунок луж и ящика. */
function drawStarterWorld(ctx) {
  if (!R) return;
  for (const f of R.fires || []) {
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#ff6b2e';
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.rad || 28, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  for (const c of R.crates || []) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.fillStyle = '#4a5560';
    ctx.fillRect(-16, -12, 32, 24);
    ctx.fillStyle = '#8a9aa8';
    ctx.fillRect(-12, -8, 24, 6);
    ctx.restore();
  }
  for (const r of R.racers || []) {
    if (r.soot > 0) {
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = '#2a2624';
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.sootRad || 92, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }
}
