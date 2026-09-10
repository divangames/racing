////////////////////////////////////////////////////////
//
// Сюжетный срез Медведя: сейв, stolen Camaro, времянка, Бронекузнец.
// Скарабея нет. Старый сейв без полей = свободная карьера.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  const STORY_MEDVED = 'medved_v1';
  const MISSION_BRONE = 'find_bronekouznets';
  const MISSION_REPAIR = 'repair_devil';
  const MISSION_MANUAL = 'drive_manual';
  const MISSION_GIFT = 'gift_bashkir';
  const MISSION_INVITE = 'arena_invite';
  const MISSION_FAMILY = 'family_board';
  const MISSION_TRUTH = 'truth_tunnel';

  /**
   * Индекс хлама по умолчанию.
   * @returns {number}
   */
  function storyJunkLo() {
    return typeof STARTER_LO === 'number' ? STARTER_LO : 11;
  }

  /**
   * Личный кузов текущего героя украден и недоступен.
   * @param {object} s
   * @param {number} carI
   * @returns {boolean}
   */
  function storyCarStolenFromHero(s, carI) {
    if (!s || s.personalCarState !== 'stolen') return false;
    if (typeof isDev === 'function' && isDev()) return false;
    return typeof carOwnerIdx === 'function' && carOwnerIdx(carI) === s.char;
  }

  /**
   * Нельзя сесть и нельзя «купить за 0» украденный личный кузов.
   * @param {number} carI
   * @returns {boolean}
   */
  function storyBlocksTake(carI) {
    return storyCarStolenFromHero(save, carI);
  }

  /**
   * Активный слот не должен оставаться на украденном Camaro.
   * @param {object} s
   */
  function storyFixActiveCar(s) {
    if (!s || s.personalCarState !== 'stolen') return;
    const own = typeof charCarIdx === 'function' ? charCarIdx(s.char) : 0;
    if (s.car !== own && s.car != null) return;
    if (s.temporaryCar != null) s.car = s.temporaryCar;
    else s.car = storyJunkLo();
  }

  /**
   * Дописывает сюжетные поля. Старые слоты остаются свободной карьерой.
   * @param {object} s
   */
  function storyPatchSave(s) {
    if (!s) return;
    if (s.selectedHero == null) s.selectedHero = typeof s.char === 'number' ? s.char : 0;
    if (s.storyCampaign === undefined) s.storyCampaign = null;
    if (typeof s.storyChapter !== 'number') s.storyChapter = 0;
    if (s.storyMission === undefined) s.storyMission = null;
    if (!s.personalCarState) s.personalCarState = 'owned';
    if (s.temporaryCar === undefined) s.temporaryCar = null;
    if (!s.garageState) s.garageState = 'home';
    if (!s.storyFlags || typeof s.storyFlags !== 'object') s.storyFlags = {};
    storyFixActiveCar(s);
  }

  /**
   * Старт кампании Медведя из меню, не из свободного заезда.
   */
  function storyBeginIfMedved(chI) {
    if (!save || chI !== 0) return;
    if (save.playMode !== 'campaign') return;
    if (save.storyCampaign) return;
    save.storyCampaign = STORY_MEDVED;
    save.storyChapter = 0;
    save.personalCarState = 'owned';
    save.garageState = 'home';
    save.selectedHero = 0;
  }

  /**
   * Текст ролика, если JSON ещё не пришёл.
   * @returns {object[]}
   */
  function campaignIntroFallbackScenes() {
    return [
      {img: 0, text: 'Дождь. Гараж. Янот курит, красный Camaro Медведя ещё цел. «Сколько тебя не будет?» — «Три дня».'},
      {img: 1, text: 'Сообщение: не бери Лаурята в машину. Медведь стирает. Садится рядом с названым братом.'},
      {img: 2, text: '«Ночь зубов». Карта врёт. Дроны, мины, ворота изнутри. На транспорте — знак арены, которой ещё нет.'},
      {img: 3, text: 'Он вылезает один. Фото Янот: «Следующая». Уезжает. Спасает её. Ломает себя.'},
      {img: 4, text: 'Башкир, Ерш, Бегемотик, Медведь. Их личные машины. Арена ставит на табло тех, кого нельзя убить.'},
      {img: 5, text: 'Пустые крепления. Camaro на эвакуаторе. Чёрный ящик вынут. Лаурят сказал: он сам приедет.'},
      {img: 6, text: 'Личную машину украли, не убили. Дешёвый кузов на время. Не умереть дешёвыми. Садись. Верни своё.'}
    ];
  }

  /**
   * Новая кампания: отдельный сейв, ролик Медведя.
   */
  function storyStartNewCampaign() {
    save = typeof newSave === 'function' ? newSave() : save;
    if (!save) return;
    save.playMode = 'campaign';
    if (typeof applyCharCar === 'function') applyCharCar(0);
    else save.char = 0;
    storyBeginIfMedved(0);
    if (typeof persist === 'function') persist();
    if (typeof startCampaignIntro === 'function') startCampaignIntro();
  }

  /**
   * Продолжить кампанию, не трогая свободную карьеру.
   */
  function storyContinueCampaign() {
    const key = typeof STORY_SKEY === 'string' ? STORY_SKEY : 'rnr_ru_story_v1';
    if (typeof loadSave === 'function') loadSave(undefined, key);
    if (!save || save.playMode !== 'campaign') return;
    state = 'garage';
  }

  /**
   * Конец ролика кампании: ограбление и времянка.
   */
  function storyFinishCampaignIntro() {
    storyApplyGarageRobbery();
    if (typeof enterCarSel === 'function') enterCarSel(save && save.car);
  }

  /**
   * Ограбление гаража: кузов stolen, деньги целы, выдаётся дешёвый слот.
   * Повторно не срабатывает.
   * @returns {boolean}
   */
  function storyApplyGarageRobbery() {
    if (!save || save.char !== 0) return false;
    if (save.storyCampaign !== STORY_MEDVED) return false;
    if (save.storyFlags && save.storyFlags.garageRobbed) return false;
    const junk = storyJunkLo();
    save.storyFlags = save.storyFlags || {};
    save.storyFlags.garageRobbed = true;
    save.personalCarState = 'stolen';
    save.storyChapter = 5;
    save.storyMission = MISSION_BRONE;
    save.garageState = 'temp';
    save.temporaryCar = junk;
    save.carOwned = save.carOwned || {};
    save.carOwned[junk] = true;
    save.car = junk;
    if (typeof persist === 'function') persist();
    return true;
  }

  /**
   * Строка цели для гаража и карьеры.
   * @returns {string}
   */
  function storyMissionHud() {
    if (!save || save.playMode !== 'campaign') return '';
    if (save.storyMission === MISSION_BRONE) return 'ЦЕЛЬ: НАЙТИ БРОНЕКУЗНЕЦА · ЗАВОД';
    if (save.storyMission === MISSION_REPAIR) return 'ЦЕЛЬ: СОБЕРИ ХОДОВУЮ · ОВАЛ';
    if (save.storyMission === MISSION_GIFT || save.storyMission === MISSION_MANUAL) {
      return 'ЦЕЛЬ: ДОВЕЗИ МОДУЛЬ БАШКИРУ · ЗАСАДА';
    }
    if (save.storyMission === MISSION_INVITE) return 'ЦЕЛЬ: ПРОПУСК НА АРЕНУ · ЯНОТ';
    if (save.storyMission === MISSION_FAMILY) return 'ЦЕЛЬ: НЕ УБЕЙ СВОИХ · ЕРШ И БЕГЕМОТИК';
    if (save.storyMission === MISSION_TRUTH) return 'БАШКИР ТРЕБУЕТ ПРАВДУ · ТОННЕЛЬ';
    return '';
  }

  /**
   * Запомнить выбранный хлам как времянку.
   */
  function storySyncTemporaryCar() {
    if (!save || save.personalCarState !== 'stolen') return;
    const lo = storyJunkLo();
    const hi = typeof STARTER_HI === 'number' ? STARTER_HI : 15;
    if (save.car >= lo && save.car <= hi) save.temporaryCar = save.car;
  }

  /**
   * Подтверждение слота не берёт украденный личный кузов.
   * @param {string} c
   * @returns {boolean}
   */
  function storyBlockConfirm(c) {
    if (typeof isConfirm !== 'function' || !isConfirm(c)) return false;
    if (state === 'car' && storyBlocksTake(selCar)) {
      if (typeof sHit === 'function') sHit();
      return true;
    }
    if (state === 'detail' && storyBlocksTake(autoparkSel)) {
      if (typeof sHit === 'function') sHit();
      return true;
    }
    return false;
  }

  global.storyPatchSave = storyPatchSave;
  global.storyFixActiveCar = storyFixActiveCar;
  global.storyApplyGarageRobbery = storyApplyGarageRobbery;
  global.storyBeginIfMedved = storyBeginIfMedved;
  global.storyMissionHud = storyMissionHud;
  global.storyBlocksTake = storyBlocksTake;
  global.storyStartNewCampaign = storyStartNewCampaign;
  global.storyContinueCampaign = storyContinueCampaign;
  global.storyFinishCampaignIntro = storyFinishCampaignIntro;
  global.campaignIntroFallbackScenes = campaignIntroFallbackScenes;

  const engine = global.DiVANEngine;
  if (!engine) return;

  engine.wrap('carIsOwned', function (prev) {
    return function (carI) {
      if (storyCarStolenFromHero(save, carI)) return false;
      return prev(carI);
    };
  });

  engine.wrap('applyCharCar', function (prev) {
    return function (chI) {
      prev(chI);
      if (!save) return;
      storyPatchSave(save);
      save.selectedHero = chI;
      if (save.playMode === 'campaign') storyBeginIfMedved(chI);
      storyFixActiveCar(save);
    };
  });

  engine.wrap('enterCarSel', function (prev) {
    return function (idx) {
      let start = idx;
      if (save && save.personalCarState === 'stolen') {
        const own = charCarIdx(save.char);
        if (start == null || start === own) {
          start = save.temporaryCar != null ? save.temporaryCar : storyJunkLo();
        }
      }
      prev(start);
    };
  });

  engine.wrap('carSelStatus', function (prev) {
    return function (i, owned) {
      if (storyCarStolenFromHero(save, i)) {
        return { t: 'УКРАДЕНА · БРОНЕКУЗНЕЦ', col: '#ff6b4a' };
      }
      if (typeof carOwnerIdx === 'function' && save && carOwnerIdx(i) === save.char) {
        if (save.personalCarState === 'recovering') {
          return { t: save.car === i ? 'КОРПУС · БЕЗ ХОДОВОЙ' : 'КОРПУС ДОМА', col: '#ffd23f' };
        }
        if (save.personalCarState === 'manual') {
          return { t: save.car === i ? 'РУЧНОЙ · БЕЗ ЯЩИКА' : 'РУЧНОЙ РЕЖИМ', col: '#ffd23f' };
        }
      }
      return prev(i, owned);
    };
  });

  engine.wrap('drawGarage', function (prev) {
    return function () {
      prev();
      const line = storyMissionHud();
      if (!line || typeof txt !== 'function' || typeof W === 'undefined') return;
      txt(g, line, W / 2, 74, 13, '#ff9d2e', 'center', typeof F_B !== 'undefined' ? F_B : undefined);
    };
  });

  engine.wrap('careerMakeBrief', function (prev) {
    return function (prevRace, counts, streakPay, packPay, newAch) {
      const brief = prev(prevRace, counts, streakPay, packPay, newAch);
      if (!brief || !save || save.playMode !== 'campaign') return brief;
      if (!save.storyFlags) save.storyFlags = {};
      brief.news = brief.news || [];
      if (save.storyMission === MISSION_TRUTH) {
        brief.news.unshift({
          kind: 'story',
          title: 'ПРАВДА В ТОННЕЛЕ',
          text: 'Башкир больше не просит. Он требует, сколько правды ты выдержал за сына.',
          col: '#7fb2ff'
        });
      } else if (save.storyMission === MISSION_FAMILY) {
        brief.news.unshift({
          kind: 'story',
          title: 'ЖИВЫЕ НА ТАБЛО',
          text: 'Ерш смотрит в камеру. Бегемотик показывает два пальца. Довези их живыми.',
          col: '#9dff4a'
        });
      } else if (save.storyMission === MISSION_INVITE) {
        brief.news.unshift({
          kind: 'story',
          title: 'ПРИГЛАШЕНИЕ',
          text: 'Пропуск на «Колесницу». Подпись Лаурята. Башкиру пока молчи.',
          col: '#ffd23f'
        });
      } else if (save.storyMission === MISSION_GIFT || save.storyMission === MISSION_MANUAL) {
        brief.news.unshift({
          kind: 'story',
          title: 'ПОДАРОК С ЦЕНОЙ',
          text: 'Довези силовой модуль через засаду. Это не делает вас друзьями.',
          col: '#ff9d2e'
        });
      } else if (save.storyMission === MISSION_REPAIR) {
        brief.news.unshift({
          kind: 'story',
          title: 'СОБЕРИ ХОДОВУЮ',
          text: 'Пыльный овал. Первый — мост и коробка. Проигрыш цель не сбрасывает.',
          col: '#ff9d2e'
        });
        brief.news.unshift({
          kind: 'story',
          title: 'КОРПУС ВЕРНУЛСЯ',
          text: 'Чёрный ящик ещё у них. Без ходовой Дьявол едва ползёт.',
          col: '#ffd23f'
        });
      } else if (save.storyMission === MISSION_BRONE) {
        save.storyFlags.bronekouznetsHint = true;
        brief.news.unshift({
          kind: 'story',
          title: 'НАЙТИ БРОНЕКУЗНЕЦА',
          text: 'Старый завод. Первый — и корпус твой. Проигрыш цель не сбрасывает.',
          col: '#ff9d2e'
        });
      }
      brief.news = brief.news.slice(0, 6);
      return brief;
    };
  });

  const pressHub = engine.pressHub;
  if (pressHub && typeof pressHub.pickers === 'function') {
    const prevPick = pressHub.pickers;
    pressHub.pickers = function (c) {
      if (storyBlockConfirm(c)) return true;
      const hit = prevPick(c);
      storySyncTemporaryCar();
      return hit;
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
