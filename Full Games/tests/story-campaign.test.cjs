////////////////////////////////////////////////////////
//
// Сюжет Медведя: поля сейва, stolen, времянка, цель.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');
const vm = require('node:vm');
const { enhanceHtml, engineFile } = require('../src/main/enhancements');

const ENGINE = path.resolve(__dirname, '../src/engine');

/**
 * Песочница среза: владение + сюжет.
 * @returns {object}
 */
function bootStory() {
  const CARS = [];
  for (let i = 0; i < 16; i++) CARS.push({ price: i >= 11 ? 200 : 0, idx: i });
  CARS[0].owner = 0;
  CARS[6].owner = 3;
  CARS[7].owner = 1;
  CARS[8].owner = 2;
  CARS[10].owner = 5;
  const g = {
    console,
    CARS,
    CHARS: [
      { name: 'МЕДВЕДЬ' },
      { name: 'ЕРШ' },
      { name: 'БЕГЕМОТИК' },
      { name: 'БАШКИР' },
      { name: 'БОРИС БЫК', npc: true },
      { name: 'ЯНОТ' }
    ],
    STARTER_LO: 11,
    STARTER_HI: 15,
    save: {
      cash: 1000,
      char: 0,
      car: 0,
      race: 0,
      dev: 0,
      carOwned: { 0: true }
    },
    state: 'intro',
    selCar: 0,
    autoparkSel: 0,
    W: 1280,
    g: {},
    F_B: 'sans',
    isDev: function () { return false; },
    isConfirm: function (c) { return c === 'Enter'; },
    sHit: function () { g._hit = true; },
    persist: function () { g._persisted = true; },
    charCarIdx: function (chI) {
      return CARS.findIndex(function (c) { return c && c.owner === chI; });
    },
    carOwnerIdx: function (i) { return CARS[i] && CARS[i].owner != null ? CARS[i].owner : null; },
    carIsOwned: function (carI) {
      if (g.carOwnerIdx(carI) === g.save.char) return true;
      return !!(g.save.carOwned && g.save.carOwned[carI]);
    },
    applyCharCar: function (chI) {
      g.save.char = chI;
      g.save.car = g.charCarIdx(chI);
      g.save.carOwned[g.save.car] = true;
    },
    enterCarSel: function (idx) { g._carSel = idx; g.state = 'car'; },
    endIntro: function (goCar) { if (goCar) g.enterCarSel(g.charCarIdx(g.save.char)); },
    carSelStatus: function () { return { t: 'ТВОЯ', col: '#0f0' }; },
    drawGarage: function () { g._garage = true; },
    careerMakeBrief: function () {
      return { news: [{ title: 'ПРИЗ', text: 'x' }], actions: [] };
    },
    careerTrackIdx: function () { return 4; },
    planRaceField: function () {
      return [
        { isP: true, ch: { name: 'МЕДВЕДЬ' } },
        { isP: false, isBoss: true, ch: { name: 'БЫК' }, lvl: {} },
        { isP: false, isBoss: false, ch: { name: 'ИИ' }, lvl: {} }
      ];
    },
    careerAfterResults: function () {},
    drawPreRace: function () { g._pre = true; },
    TRACKDEFS: [
      { name: 'ОВАЛ' },
      { name: 'ПЕРЕКРЁСТОК СМЕРТИ' },
      { name: 'КАНЬОН «КРУШЕНИЕ»' },
      { name: 'ЛЕДЯНОЙ ПЕРЕВАЛ' },
      { name: 'ВУЛКАН' }
    ],
    raceTrackOverride: null,
    R: { place: 0, countsForCareer: true },
    aiBossTune: function () { return { arm: 0, eng: 0 }; },
    txt: function () {},
    careerPatchSave: function () {},
    stats: function () { return { top: 100, acc: 100, crn: 2, grip: 1, maxhp: 100, off: 0.5, sharp: 0.5 }; }
  };
  g.window = g;
  g.globalThis = g;
  g.__DIVAN_ENGINE_META__ = { name: 'DiVANEngine', abi: 1, host: 'game' };
  vm.runInNewContext(fs.readFileSync(path.join(ENGINE, 'runtime.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.join(ENGINE, 'story-campaign.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.join(ENGINE, 'story-hunt.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.join(ENGINE, 'story-repair.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.join(ENGINE, 'story-gift.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.join(ENGINE, 'story-invite.js'), 'utf8'), g);
  vm.runInNewContext(fs.readFileSync(path.join(ENGINE, 'story-family.js'), 'utf8'), g);
  return g;
}

test('Заезд подключает сюжет после клавиатуры хаба', () => {
  const out = enhanceHtml('<head></head><body></body>', { pathname: '/rnr.html' });
  assert(out.includes('/__engine/story-campaign.js'));
  assert(out.includes('/__engine/story-hunt.js'));
  assert(out.includes('/__engine/story-repair.js'));
  assert(out.includes('/__engine/story-gift.js'));
  assert(out.includes('/__engine/story-invite.js'));
  assert(out.includes('/__engine/story-family.js'));
  assert(out.indexOf('press.js') < out.indexOf('story-campaign.js'));
  assert(out.indexOf('story-campaign.js') < out.indexOf('story-hunt.js'));
  assert(out.indexOf('story-hunt.js') < out.indexOf('story-repair.js'));
  assert(out.indexOf('story-repair.js') < out.indexOf('story-gift.js'));
  assert(out.indexOf('story-gift.js') < out.indexOf('story-invite.js'));
  assert(out.indexOf('story-invite.js') < out.indexOf('story-family.js'));
  assert(engineFile('__engine/story-campaign.js').endsWith('story-campaign.js'));
  assert(engineFile('__engine/story-hunt.js').endsWith('story-hunt.js'));
  assert(engineFile('__engine/story-repair.js').endsWith('story-repair.js'));
  assert(engineFile('__engine/story-gift.js').endsWith('story-gift.js'));
  assert(engineFile('__engine/story-invite.js').endsWith('story-invite.js'));
  assert(engineFile('__engine/story-family.js').endsWith('story-family.js'));
});

test('Старый сейв без сюжета остаётся свободной карьерой', () => {
  const g = bootStory();
  const old = { cash: 50, race: 2, char: 0, car: 0, carOwned: { 0: true } };
  g.storyPatchSave(old);
  assert.equal(old.storyCampaign, null);
  assert.equal(old.personalCarState, 'owned');
  assert.equal(old.cash, 50);
  assert.equal(old.car, 0);
});

test('Ограбление: Camaro stolen, деньги целы, времянка, повтор без дубля', () => {
  const g = bootStory();
  g.save.playMode = 'campaign';
  g.applyCharCar(0);
  assert.equal(g.save.storyCampaign, 'medved_v1');
  assert.equal(g.save.personalCarState, 'owned');
  assert.equal(g.carIsOwned(0), true);
  const cash = g.save.cash;
  assert.equal(g.storyApplyGarageRobbery(), true);
  assert.equal(g.save.cash, cash);
  assert.equal(g.save.personalCarState, 'stolen');
  assert.equal(g.save.storyMission, 'find_bronekouznets');
  assert.equal(g.save.temporaryCar, 11);
  assert.equal(g.save.car, 11);
  assert.equal(g.carIsOwned(0), false);
  assert.equal(g.carIsOwned(11), true);
  assert.equal(g.storyBlocksTake(0), true);
  assert.equal(g.storyApplyGarageRobbery(), false);
  assert.match(g.storyMissionHud(), /БРОНЕКУЗНЕЦ/);
  g.save.car = 0;
  g.storyFixActiveCar(g.save);
  assert.equal(g.save.car, 11);
  g.storyFinishCampaignIntro();
  assert.equal(g._carSel, 11);
  const st = g.carSelStatus(0, true);
  assert.match(st.t, /УКРАДЕНА/);
  const brief = g.careerMakeBrief(0, true, 0, 0, []);
  assert.equal(brief.news[0].title, 'НАЙТИ БРОНЕКУЗНЕЦА');
  assert.equal(g.save.storyFlags.bronekouznetsHint, true);
});

test('Свободный Медведь не запускает ограбление', () => {
  const g = bootStory();
  g.applyCharCar(0);
  assert.equal(g.save.storyCampaign, null);
  assert.equal(g.storyApplyGarageRobbery(), false);
  assert.equal(g.carIsOwned(0), true);
});

test('Ерш не включает кампанию Медведя', () => {
  const g = bootStory();
  g.applyCharCar(1);
  assert.equal(g.save.storyCampaign, null);
  assert.equal(g.save.char, 1);
  assert.equal(g.storyApplyGarageRobbery(), false);
  assert.equal(g.storyMissionHud(), '');
});

test('Охота: кузнец в сетке, корпус один раз за первое место', () => {
  const g = bootStory();
  g.save.playMode = 'campaign';
  g.applyCharCar(0);
  g.storyApplyGarageRobbery();
  assert.equal(g.storyHuntActive(), true);
  assert.equal(g.careerTrackIdx(), 2);
  const field = g.planRaceField(1);
  assert.equal(field[1].ch.name, 'БРОНЕКУЗНЕЦ');
  assert.equal(g.storyResolveHunt(2, false), false);
  assert.equal(g.storyHuntActive(), true);
  assert.equal(g.storyResolveHunt(0, false), true);
  assert.equal(g.save.personalCarState, 'recovering');
  assert.equal(g.carIsOwned(0), true);
  assert.equal(g.storyHuntActive(), false);
  assert.equal(g.storyResolveHunt(0, false), false);
  const brief = g.careerMakeBrief(0, true, 0, 0, []);
  assert.equal(brief.news[0].title, 'КОРПУС ВЕРНУЛСЯ');
  assert.equal(brief.news[1].title, 'СОБЕРИ ХОДОВУЮ');
  const st = g.carSelStatus(0, true);
  assert.match(st.t, /КОРПУС/);
});

test('Охота не трогает свободный заезд; 1 место через результаты один раз', () => {
  const g = bootStory();
  g.applyCharCar(0);
  const field = g.planRaceField(1);
  assert.equal(field[1].ch.name, 'БЫК');
  assert.equal(g.careerTrackIdx(), 4);
  g.save.playMode = 'campaign';
  g.applyCharCar(0);
  g.storyApplyGarageRobbery();
  g.R.place = 1;
  g.careerAfterResults(0, []);
  assert.equal(g.storyHuntActive(), true);
  g.R.place = 0;
  g.careerAfterResults(0, []);
  assert.equal(g.save.personalCarState, 'recovering');
  assert.equal(g.save.storyMission, 'repair_devil');
  const owned = g.save.carOwned[0];
  g.careerAfterResults(0, []);
  assert.equal(g.save.carOwned[0], owned);
  assert.equal(g.save.personalCarState, 'manual');
  assert.equal(g.save.storyMission, 'gift_bashkir');
});

test('Ходовая: овал, 1 место один раз, ручной режим без ящика', () => {
  const g = bootStory();
  g.save.playMode = 'campaign';
  g.applyCharCar(0);
  g.storyApplyGarageRobbery();
  g.storyResolveHunt(0);
  assert.equal(g.storyRepairActive(), true);
  assert.equal(g.careerTrackIdx(), 0);
  const field = g.planRaceField(1);
  assert.equal(field[1].ch.name, 'БЫК');
  assert.equal(g.storyResolveRepair(2), false);
  assert.equal(g.storyRepairActive(), true);
  assert.equal(g.storyResolveRepair(0), true);
  assert.equal(g.save.personalCarState, 'manual');
  assert.equal(g.save.storyMission, 'gift_bashkir');
  assert.equal(g.storyRepairActive(), false);
  assert.equal(g.storyResolveRepair(0), false);
  assert.equal(g.storyGiftActive(), true);
  assert.match(g.storyMissionHud(), /БАШКИР/);
  const brief = g.careerMakeBrief(0, true, 0, 0, []);
  assert.equal(brief.news[0].title, 'ПОДАРОК С ЦЕНОЙ');
  g.save.car = 0;
  const st = g.carSelStatus(0, true);
  assert.match(st.t, /РУЧНОЙ/);
});

test('Без ходовой Дьявол слабее; свободный заезд не режет статы', () => {
  const g = bootStory();
  const car = { idx: 0, hp: 100, top: 1, acc: 1, crn: 1 };
  g.applyCharCar(0);
  const free = g.stats(g.CHARS[0], car, { arm: 0, eng: 0, tir: 0, shk: 0 }, undefined, 0);
  assert.equal(free.top, 100);
  g.save.playMode = 'campaign';
  g.applyCharCar(0);
  g.storyApplyGarageRobbery();
  g.storyResolveHunt(0);
  const body = g.stats(g.CHARS[0], car, { arm: 0, eng: 0, tir: 0, shk: 0 }, undefined, 0);
  assert.ok(body.top < 60);
  const junk = g.stats(g.CHARS[0], { idx: 11 }, { arm: 0, eng: 0, tir: 0, shk: 0 }, undefined, 0);
  assert.equal(junk.top, 100);
  g.storyResolveRepair(0);
  const manual = g.stats(g.CHARS[0], car, { arm: 0, eng: 0, tir: 0, shk: 0 }, undefined, 0);
  assert.ok(manual.top > body.top && manual.top < 100);
  g.storyResolveGift(0);
  const gifted = g.stats(g.CHARS[0], car, { arm: 0, eng: 0, tir: 0, shk: 0 }, undefined, 0);
  assert.ok(gifted.top < manual.top);
});

test('Подарок: Башкир в сетке, модуль один раз, приглашение на арену', () => {
  const g = bootStory();
  g.save.playMode = 'campaign';
  g.applyCharCar(0);
  g.storyApplyGarageRobbery();
  g.storyResolveHunt(0);
  g.storyResolveRepair(0);
  assert.equal(g.storyGiftActive(), true);
  assert.equal(g.careerTrackIdx(), 1);
  const field = g.planRaceField(1);
  assert.equal(field[1].ch.name, 'БАШКИР');
  assert.equal(field[1].isAlly, true);
  assert.equal(field[1].isBoss, false);
  assert.equal(g.storyResolveGift(2), false);
  assert.equal(g.storyGiftActive(), true);
  assert.equal(g.storyResolveGift(0), true);
  assert.equal(g.save.storyFlags.powerModuleGiven, true);
  assert.equal(g.save.storyChapter, 6);
  assert.equal(g.save.storyMission, 'arena_invite');
  assert.equal(g.save.personalCarState, 'manual');
  assert.equal(g.storyGiftActive(), false);
  assert.equal(g.storyResolveGift(0), false);
  assert.match(g.storyMissionHud(), /АРЕНУ/);
  const brief = g.careerMakeBrief(0, true, 0, 0, []);
  assert.equal(brief.news[0].title, 'ПРИГЛАШЕНИЕ');
  assert.equal(g.storyInviteActive(), true);
  assert.equal(g.careerTrackIdx(), 3);
  const after = g.planRaceField(1);
  assert.equal(after[1].ch.name, 'ЯНОТ');
});

test('Арена: Янот в сетке, 1 место один раз, живые на табло', () => {
  const g = bootStory();
  g.save.playMode = 'campaign';
  g.applyCharCar(0);
  g.storyApplyGarageRobbery();
  g.storyResolveHunt(0);
  g.storyResolveRepair(0);
  g.storyResolveGift(0);
  assert.equal(g.storyInviteActive(), true);
  assert.equal(g.storyResolveInvite(2), false);
  assert.equal(g.storyResolveInvite(0), true);
  assert.equal(g.save.storyFlags.arenaPass, true);
  assert.equal(g.save.storyChapter, 8);
  assert.equal(g.save.storyMission, 'family_board');
  assert.equal(g.storyInviteActive(), false);
  assert.equal(g.storyResolveInvite(0), false);
  assert.match(g.storyMissionHud(), /СВОИХ/);
  const brief = g.careerMakeBrief(0, true, 0, 0, []);
  assert.equal(brief.news[0].title, 'ЖИВЫЕ НА ТАБЛО');
  assert.equal(g.storyFamilyActive(), true);
  assert.equal(g.careerTrackIdx(), 4);
  const after = g.planRaceField(1);
  assert.equal(after[1].ch.name, 'ЕРШ');
  assert.equal(after[1].isAlly, true);
  assert.equal(after[2].ch.name, 'БЕГЕМОТИК');
  assert.equal(after[2].isAlly, true);
});

test('Табло: Ерш и Бегемотик в сетке, 1 место без крови, правда в тоннеле', () => {
  const g = bootStory();
  g.save.playMode = 'campaign';
  g.applyCharCar(0);
  g.storyApplyGarageRobbery();
  g.storyResolveHunt(0);
  g.storyResolveRepair(0);
  g.storyResolveGift(0);
  g.storyResolveInvite(0);
  assert.equal(g.storyFamilyActive(), true);
  assert.equal(g.storyResolveFamily(2), false);
  g.storyFamilyKillFlag = true;
  assert.equal(g.storyResolveFamily(0), false);
  assert.equal(g.storyFamilyActive(), true);
  g.storyFamilyKillFlag = false;
  assert.equal(g.storyResolveFamily(0), true);
  assert.equal(g.save.storyFlags.familySeen, true);
  assert.equal(g.save.storyChapter, 9);
  assert.equal(g.save.storyMission, 'truth_tunnel');
  assert.equal(g.storyFamilyActive(), false);
  assert.equal(g.storyResolveFamily(0), false);
  assert.match(g.storyMissionHud(), /ПРАВДУ/);
  const brief = g.careerMakeBrief(0, true, 0, 0, []);
  assert.equal(brief.news[0].title, 'ПРАВДА В ТОННЕЛЕ');
});
