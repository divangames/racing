////////////////////////////////////////////////////////
//
// Карьера после финиша: приз, серия, что открылось, куда ехать
//
////////////////////////////////////////////////////////
'use strict';

/** Побед подряд → бонус (дальше множитель дивизиона). */
const CAREER_STREAK_PAY = {3: 420, 5: 900, 8: 1600};
/** Этапов карьеры в пачке — отдельный бонус. */
const CAREER_PACK = 3;
const CAREER_PACK_PAY = 360;
/** Побед, после которых можно выбрать уже проеханную трассу. */
const CAREER_PICK_WINS = 5;

/** Индекс трассы для гаража, ставки и старта. */
function careerTrackIdx() {
 if (typeof labTest !== 'undefined' && labTest) return 0;
 if (typeof raceTrackOverride !== 'undefined' && raceTrackOverride != null) {
  return ((raceTrackOverride % TRACKDEFS.length) + TRACKDEFS.length) % TRACKDEFS.length;
 }
 return (save.race | 0) % TRACKDEFS.length;
}

/** Поля сейва, которых не было в старых слотах. */
function careerPatchSave(s) {
 if (!s) return;
 if (typeof s.winStreak !== 'number') s.winStreak = 0;
 if (typeof s.bestStreak !== 'number') s.bestStreak = 0;
 if (typeof s.careerWins !== 'number') s.careerWins = 0;
}

/** Трассы, которые уже были в календаре (реванш не считает). */
function careerVisitedIdx() {
 const n = TRACKDEFS.length;
 const done = save.race | 0;
 const seen = {};
 for (let i = 0; i < done; i++) seen[i % n] = true;
 if (R && R.tIdx != null) seen[R.tIdx] = true;
 return Object.keys(seen).map(Number).sort(function (a, b) { return a - b; });
}

/** Очки места 1 / 2 / 3 для подписи. */
function careerPlaceWord(place) {
 if (place === 0) return '1 МЕСТО';
 if (place === 1) return '2 МЕСТО';
 if (place === 2) return '3 МЕСТО';
 return (place + 1) + ' МЕСТО';
}

/** Пишет сейв и R.career после призов. */
function careerAfterResults(prevRace, newAch) {
 careerPatchSave(save);
 const counts = !labTest && R.countsForCareer !== false;
 if (R.place === 0) {
  save.winStreak = (save.winStreak | 0) + 1;
  save.careerWins = (save.careerWins | 0) + 1;
  if (save.winStreak > (save.bestStreak | 0)) save.bestStreak = save.winStreak;
 } else {
  save.winStreak = 0;
 }
 let streakPay = 0;
 const streakKey = save.winStreak | 0;
 if (R.place === 0 && CAREER_STREAK_PAY[streakKey]) {
  streakPay = Math.round(CAREER_STREAK_PAY[streakKey] * prizeDivMult(R.div));
  save.cash += streakPay;
 }
 let packPay = 0;
 if (counts) save.race++;
 if (counts && save.race > 0 && save.race % CAREER_PACK === 0) {
  packPay = Math.round(CAREER_PACK_PAY * prizeDivMult(R.div));
  save.cash += packPay;
 }
 persist();
 R.career = careerMakeBrief(prevRace, counts, streakPay, packPay, newAch || []);
}

/** Карточки «что случилось» и кнопки. */
function careerMakeBrief(prevRace, counts, streakPay, packPay, newAch) {
 const prize = (R.prize && R.prize[R.place]) || 0;
 const news = [];
 const ink = R.place === 0 ? '#ffd23f' : R.place <= 2 ? '#58ff6b' : '#9a93a8';
 news.push({
  kind: 'prize',
  title: careerPlaceWord(R.place),
  text: prize > 0
   ? ('призовые ' + fm(prize) + (R.place <= 2 ? ' · подиум' : ''))
   : 'вне призовой тройки — касса не выросла от места',
  col: ink
 });
 if ((R.betStake || 0) > 0) {
  news.push({
   kind: 'bet',
   title: (R.betPay || 0) > 0 ? 'СТАВКА СЫГРАЛА' : 'СТАВКА СГОРЕЛА',
   text: (R.betPay || 0) > 0
    ? ('+' + fm(R.betPay) + ' · ' + (R.betName || 'пилот'))
    : ((R.betName || 'пилот') + ' не на подиуме'),
   col: (R.betPay || 0) > 0 ? '#58ff6b' : '#ff6b4a'
  });
 }
 if (streakPay > 0) {
  news.push({
   kind: 'streak',
   title: 'СЕРИЯ ×' + save.winStreak,
   text: 'три и больше побед подряд · бонус ' + fm(streakPay),
   col: '#ff9d2e'
  });
 } else if (R.place === 0 && save.winStreak > 0 && save.winStreak < 3) {
  news.push({
   kind: 'streak',
   title: 'СЕРИЯ ×' + save.winStreak,
   text: 'ещё ' + (3 - save.winStreak) + ' подряд — бонус за серию',
   col: '#c8c2d4'
  });
 } else if (R.place > 0 && prevRace >= 0) {
  news.push({
   kind: 'streak',
   title: 'СЕРИЯ СБРОШЕНА',
   text: 'бонус за победы подряд только с первого места',
   col: '#6f6880'
  });
 }
 if (packPay > 0) {
  news.push({
   kind: 'pack',
   title: 'ТРИ ЭТАПА',
   text: 'закрыта пачка календаря · бонус ' + fm(packPay),
   col: '#35e0ff'
  });
 }
 const n = TRACKDEFS.length;
 const prevDiv = 1 + ((prevRace / n) | 0);
 const nowDiv = 1 + ((save.race / n) | 0);
 if (counts && nowDiv > prevDiv) {
  news.push({
   kind: 'div',
   title: 'ДИВИЗИОН ' + DIVN[Math.min(3, nowDiv - 1)],
   text: 'призы выше, боссы злее. Этап ' + (save.race + 1),
   col: '#ff9d2e'
  });
 }
 if (counts) {
  for (let i = 0; i < CAR_UNLOCK.length; i++) {
   const u = CAR_UNLOCK[i];
   const car = CARS[i];
   if (!u || !car || car.custom) continue;
   if (carOwnerIdx(i) != null) continue;
   const need = u.race | 0;
   if (need > prevRace && save.race >= need) {
    news.push({
     kind: 'car',
     title: 'ОТКРЫТ КУЗОВ',
     text: car.name + ' — этап ' + (need + 1) + '. Купить в автопарке, если хватит кассы.',
     col: car.col || '#ffd23f'
    });
   }
  }
 }
 const nextDef = TRACKDEFS[save.race % n];
 if (counts && nextDef) {
  news.push({
   kind: 'track',
   title: 'СЛЕДУЮЩИЙ ЭТАП',
   text: nextDef.name + ' · этап ' + (save.race + 1),
   col: '#e8e2d0'
  });
 } else if (!counts) {
  news.push({
   kind: 'track',
   title: 'РЕВАНШ НЕ СДВИНУЛ ЭТАП',
   text: 'календарь: ' + (nextDef ? nextDef.name : '—') + ' · этап ' + (save.race + 1),
   col: '#9a93a8'
  });
 }
 (newAch || []).forEach(function (a) {
  if (!a) return;
  news.push({
   kind: 'ach',
   title: 'ДОСТИЖЕНИЕ',
   text: a.name,
   col: '#ffd23f'
  });
 });
 const wins = save.careerWins | 0;
 const canPick = wins >= CAREER_PICK_WINS;
 if (!canPick) {
  news.push({
   kind: 'hint',
   title: 'ВЫБОР ТРАССЫ',
   text: 'ещё ' + Math.max(0, CAREER_PICK_WINS - wins) + ' побед — реванш на любой уже открытой',
   col: '#6f6880'
  });
 }
 const lastName = (R.T && R.T.name) || 'эта трасса';
 const actions = [
  {id: 'garage', label: 'ГАРАЖ', sub: counts ? ('дальше: ' + (nextDef ? nextDef.name : '')) : 'календарь без сдвига'},
  {id: 'rematch', label: 'РЕВАНШ', sub: lastName}
 ];
 if (canPick) actions.push({id: 'pick', label: 'ДРУГАЯ ТРАССА', sub: 'уже проеханные'});
 return {news: news.slice(0, 6), actions: actions, sel: 0, t0: gt};
}

/** С подиума — на смысл карьеры, не сразу в гараж. */
function careerOpenFromResults() {
 if (labTest) {
  exitLabTest();
  return;
 }
 if (!R || !R.career) {
  state = 'garage';
  return;
 }
 R.career.sel = 0;
 R.career.t0 = gt;
 state = 'career';
}

/** Выполнить кнопку экрана карьеры. */
function careerDo(id) {
 if (id === 'garage') {
  raceTrackOverride = null;
  raceBoard = null;
  state = 'garage';
  sClick();
  return;
 }
 if (id === 'rematch') {
  if (R && R.tIdx != null) raceTrackOverride = R.tIdx;
  raceBoard = null;
  state = 'garage';
  sClick();
  return;
 }
 if (id === 'pick') {
  careerEnterTrackPick();
  sClick();
 }
}

/** Сетка уже открытых трасс (не dev-старт). */
function careerEnterTrackPick() {
 const list = careerVisitedIdx();
 careerPickSel = list.indexOf(R && R.tIdx != null ? R.tIdx : careerTrackIdx());
 if (careerPickSel < 0) careerPickSel = 0;
 careerPickList = list;
 state = 'careerTracks';
}

let careerPickSel = 0;
let careerPickList = [];

/** Клавиши экрана «что дальше». */
function careerPress(c) {
 if (state === 'careerTracks') {
  const n = careerPickList.length;
  if (!n) { state = 'career'; return; }
  if (c === 'ArrowLeft') { careerPickSel = (careerPickSel + n - 1) % n; sClick(); return; }
  if (c === 'ArrowRight') { careerPickSel = (careerPickSel + 1) % n; sClick(); return; }
  if (c === 'ArrowUp') { careerPickSel = (careerPickSel + n - 1) % n; sClick(); return; }
  if (c === 'ArrowDown') { careerPickSel = (careerPickSel + 1) % n; sClick(); return; }
  if (isBack(c)) { state = 'career'; sClick(); return; }
  if (isConfirm(c)) {
   raceTrackOverride = careerPickList[careerPickSel];
   raceBoard = null;
   state = 'garage';
   sClick();
  }
  return;
 }
 if (state !== 'career' || !R || !R.career) return;
 const acts = R.career.actions || [];
 const n = acts.length;
 if (!n) { careerOpenFromResults(); return; }
 if (c === 'ArrowLeft' || c === 'ArrowUp') {
  R.career.sel = (R.career.sel + n - 1) % n; sClick(); return;
 }
 if (c === 'ArrowRight' || c === 'ArrowDown') {
  R.career.sel = (R.career.sel + 1) % n; sClick(); return;
 }
 if (isConfirm(c)) careerDo(acts[R.career.sel | 0].id);
}

/** Клик по кнопкам карьеры. */
function careerClick(x, y) {
 if (state === 'careerTracks' && g._careerTiles) {
  for (let i = 0; i < g._careerTiles.length; i++) {
   const b = g._careerTiles[i];
   if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) {
    if (careerPickSel === i) {
     raceTrackOverride = careerPickList[i];
     raceBoard = null;
     state = 'garage';
    } else careerPickSel = i;
    sClick();
    return;
   }
  }
  return;
 }
 if (state !== 'career' || !g._careerBtns) return;
 for (const b of g._careerBtns) {
  if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
   R.career.sel = b.i;
   careerDo(b.id);
   return;
  }
 }
}

/** Экран после результатов: крупный следующий шаг, не таблица Excel. */
function drawCareer() {
 const brief = R && R.career;
 if (!brief) { drawTheatreBack(); return; }
 const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
 const age = reduce ? 9 : Math.max(0, gt - (brief.t0 || 0));
 drawTheatreBack();
 const pad = 40;
 const ink = R.place === 0 ? '#ffd23f' : R.place <= 2 ? '#ff9d2e' : '#e8e2d0';
 txt(g, 'ЧТО ДАЛЬШЕ', pad, 52, 32, ink);
 txt(g, (R.T && R.T.name) || '', W / 2, 48, 14, '#8f88a0', 'center', F_B);
 const cash = fm(save.cash);
 g.font = '20px ' + F_D;
 const cashW = Math.max(168, g.measureText(cash).width + 36);
 panel(g, W - pad - cashW, 28, cashW, 40, 'rgba(255,210,63,.08)', 'rgba(255,210,63,.38)', 10);
 txt(g, cash, W - pad - 18, 48, 20, '#ffd23f', 'right');

 const heroY = 88;
 const heroH = 118;
 rr(g, pad, heroY, W - pad * 2, heroH, 16);
 g.fillStyle = 'rgba(18,15,26,.92)'; g.fill();
 g.strokeStyle = ink + '66'; g.lineWidth = 2; g.stroke();
 const pop = reduce ? 1 : Math.min(1, age / 0.28);
 g.globalAlpha = pop;
 txt(g, careerPlaceWord(R.place), pad + 28, heroY + 36, 18, ink, 'left', F_B);
 const nextDef = TRACKDEFS[save.race % TRACKDEFS.length];
 const hero = R.place === 0 ? 'ТЫ РАЗОРВАЛ КЛЕТКУ' : (R.place <= 2 ? 'ПОДИУМ. ДЕНЬГИ ЕСТЬ.' : 'СЛЕДУЮЩИЙ ЗАЕЗД ВСЁ ЕЩЁ ТВОЙ');
 txt(g, hero, pad + 28, heroY + 72, 28, '#e8e2d0', 'left');
 txt(g, nextDef ? ('этап ' + (save.race + 1) + ' · ' + nextDef.name) : '', pad + 28, heroY + 98, 14, '#8f88a0', 'left', F_B);
 g.globalAlpha = 1;

 const news = brief.news || [];
 const listTop = heroY + heroH + 16;
 const listH = 330;
 const gap = 8;
 const rowH = news.length ? Math.min(52, (listH - (news.length - 1) * gap) / news.length) : 48;
 news.forEach(function (n, i) {
  const y = listTop + i * (rowH + gap);
  const a = reduce ? 1 : Math.min(1, Math.max(0, (age - 0.12 - i * 0.07) / 0.2));
  g.globalAlpha = a;
  rr(g, pad, y, W - pad * 2, rowH, 10);
  g.fillStyle = 'rgba(16,13,22,.94)'; g.fill();
  g.fillStyle = n.col || '#ffd23f';
  g.fillRect(pad, y + 10, 4, rowH - 20);
  txt(g, n.title, pad + 24, y + rowH * 0.38, 14, n.col || '#ffd23f', 'left', F_B);
  txt(g, n.text, pad + 24, y + rowH * 0.72, 12, '#9a93a8', 'left', F_B);
  g.globalAlpha = 1;
 });

 const acts = brief.actions || [];
 const btnY = H - 92;
 const btnH = 56;
 const btnGap = 14;
 const btnW = acts.length ? (W - pad * 2 - (acts.length - 1) * btnGap) / acts.length : 200;
 g._careerBtns = [];
 acts.forEach(function (act, i) {
  const x = pad + i * (btnW + btnGap);
  const sel = (brief.sel | 0) === i;
  const hot = mx > x && mx < x + btnW && my > btnY && my < btnY + btnH;
  panel(g, x, btnY, btnW, btnH, sel || hot ? 'rgba(255,157,46,.16)' : 'rgba(16,13,22,.94)', sel || hot ? '#ffd23f' : '#3a3548', 12);
  txt(g, act.label, x + btnW / 2, btnY + 22, sel ? 18 : 16, sel ? '#ffd23f' : '#e8e2d0', 'center');
  txt(g, act.sub || '', x + btnW / 2, btnY + 42, 11, '#8f88a0', 'center', F_B);
  g._careerBtns.push({x: x, y: btnY, w: btnW, h: btnH, i: i, id: act.id});
 });
 txt(g, '← →  выбор   ·   ENTER — поехать', W / 2, H - 22, 13, '#6f6880', 'center', F_B);
}

/** Выбор реванша: только уже открытые трассы. */
function drawCareerTracks() {
 drawTheatreBack();
 txt(g, 'РЕВАНШ', HUB_PAD, 52, 32, '#ffd23f');
 txt(g, 'только трассы, которые уже были в карьере', W / 2, 48, 14, '#8f88a0', 'center', F_B);
 g._careerTiles = [];
 careerPickList.forEach(function (idx, slot) {
  const def = TRACKDEFS[idx];
  const r = trackTileRect(slot);
  const sel = slot === careerPickSel;
  panel(g, r.x, r.y, r.w, r.h, sel ? 'rgba(255,157,46,.16)' : 'rgba(20,17,28,.92)', sel ? '#ffd23f' : '#3a3548', 10);
  const th = def.theme || {};
  g.fillStyle = th.ground || '#2a2434';
  rr(g, r.x + 10, r.y + 10, r.w - 20, r.h - 52, 8); g.fill();
  drawTrackOutline(g, def, r.x + 10, r.y + 10, r.w - 20, r.h - 52);
  txt(g, def.name, r.x + r.w / 2, r.y + r.h - 22, 16, sel ? '#ffd23f' : '#c8c0d4', 'center');
  g._careerTiles.push(r);
 });
 txt(g, 'ENTER — в гараж на этой трассе · ESC — назад', W / 2, H - 28, 14, '#6f6880', 'center', F_B);
}
