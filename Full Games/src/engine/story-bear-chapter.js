////////////////////////////////////////////////////////
//
// Глава Медведя, срез 1: комикс → А → взнос 5 000 →
// Б (ложный взнос) → ограбление → хлам → цикл А/Б на арене.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  const FEE = 5000;
  const JUNK_CHOICE_COUNT = 3;
  const ARENA_CLASS_TRACKS = 10;
  let feeAsk = false;
  let feeAskYes = true;
  let bestiaGuideRace = null;
  let bestiaGuideStep = 0;
  const BESTIA_GUIDE = [
    { at: .4, cue: 'guide_start', text: 'Не борись с машиной. Почувствуй момент, когда она перестаёт тебе верить, и верни ей дорогу.' },
    { at: 5, cue: 'guide_weapon', text: 'Ствол нужен не ради попадания. Заставь соперника выбрать плохую траекторию — и нажми огонь.' },
    { at: 10, cue: 'guide_nitro', text: 'Нитро — не скорость. Это право один раз исправить ошибку, пока трасса ещё не вынесла приговор.' },
    { at: 15, cue: 'guide_ult', text: 'Ульту держи до момента, когда ситуация перестанет принадлежать тебе. Раньше — это шум, позже — эпитафия.' },
    { at: 20, cue: 'guide_lords', text: 'Корона Лордов не обещает власть. Она напоминает, за кого ты отвечаешь, когда возвращаются не все.' }
  ];

  /**
   * Каталог заезда: в главе 1 — десять петель арены, иначе сток карьеры.
   */
  function syncCatalog() {
    if (typeof TRACKDEFS === 'undefined' || !Array.isArray(TRACKDEFS)) return;
    const api = typeof RnRTracks !== 'undefined' ? RnRTracks : null;
    if (!api || typeof api.chapterTracks !== 'function' || !api.STOCK || !api.STOCK.length) return;
    const classB = active() && (save.storyMission === 'race_b' ||
      (save.storyMission === 'restart_races' && (save.race | 0) >= ARENA_CLASS_TRACKS));
    const src = active() ? api.chapterTracks(1, classB ? 'B' : 'A') : api.STOCK;
    if (!src || !src.length) return;
    TRACKDEFS.length = 0;
    for (let i = 0; i < src.length; i++) TRACKDEFS.push(src[i]);
  }

  /**
   * Кампания Медведя на этом срезе.
   * @returns {boolean}
   */
  function active() {
    return !!(save && save.playMode === 'campaign' && save.char === 0 && save.storySlice === 'bear_chapter_1');
  }

  /** В сюжетной покупке доступны первые три кузова хлама. */
  function storyJunk(i) {
    return i >= STARTER_LO && i < STARTER_LO + JUNK_CHOICE_COUNT;
  }

  /**
   * Деньги после кражи не меняют цену хлама: при необходимости касса
   * пополняется ровно до самого дешёвого из трёх сюжетных кузовов.
   */
  function ensureJunkBudget() {
    if (!active()) return 0;
    const prices = [];
    for (let i = STARTER_LO; i < Math.min(CARS.length, STARTER_LO + JUNK_CHOICE_COUNT); i++) {
      const price = Number(CARS[i] && CARS[i].price);
      if (Number.isFinite(price) && price > 0) prices.push(price);
    }
    if (!prices.length) return 0;
    const need = Math.min.apply(null, prices);
    const cash = Math.max(0, Number(save.cash) || 0);
    const aid = Math.max(0, need - cash);
    if (aid > 0) {
      save.cash = cash + aid;
      flags().junkCashAid = (flags().junkCashAid | 0) + aid;
    }
    return aid;
  }

  /**
   * Флаги главы.
   * @returns {object}
   */
  function flags() {
    return save.storyFlags || (save.storyFlags = {});
  }

  /** Текстовая радиоподсказка Бестии; MP3 подключится поверх того же cue после озвучки. */
  function bestiaGuideSay(cue, fallback) {
    let take = null;
    if (typeof VOICE !== 'undefined' && VOICE.banks) {
      take = typeof voicePickTake === 'function' ? voicePickTake(VOICE.banks[13], cue) : null;
    }
    const line = String((take && take.text) || fallback || '');
    if (typeof announce === 'function' && line) announce('БЕСТИЯ · ' + line, true);
    if (take && take.file && typeof voicePlayFile === 'function' && typeof voiceDirOf === 'function') {
      voicePlayFile(voiceDirOf(13) + take.file);
    }
  }

  /** Первый заезд А: Бестия учит механике и одновременно вводит смысл знака Лордов. */
  function tickBestiaGuide() {
    if (!active() || save.storyMission !== 'race_a' || flags().bestiaGuideComplete ||
      typeof R === 'undefined' || !R || R.demo || R.phase !== 'go') return;
    if (bestiaGuideRace !== R) {
      bestiaGuideRace = R;
      bestiaGuideStep = 0;
      if (typeof voicePreload === 'function') voicePreload();
    }
    while (bestiaGuideStep < BESTIA_GUIDE.length && R.time >= BESTIA_GUIDE[bestiaGuideStep].at) {
      const beat = BESTIA_GUIDE[bestiaGuideStep++];
      bestiaGuideSay(beat.cue, beat.text);
    }
    if (bestiaGuideStep >= BESTIA_GUIDE.length) {
      flags().bestiaGuideComplete = true;
      if (typeof persist === 'function') persist();
    }
  }

  /**
   * Комикс кражи ещё не закрыт.
   * @returns {boolean}
   */
  function pending() {
    return active() && !!flags().robberyPending;
  }

  /**
   * Надо купить корпус.
   * @returns {boolean}
   */
  function buying() {
    return active() && save.storyMission === 'buy_junk';
  }

  /** До сюжетной покупки хлама новые машины в кампании недоступны. */
  function purchasesLocked() {
    return active() && !buying();
  }

  /** В главе Медведя автопарк закрыт: сюжет использует отдельный выбор машины. */
  function autoparkLocked() {
    return active();
  }

  /** Подпись основной кнопки автопарка. */
  function carShopHint(i) {
    if (!purchasesLocked()) return '';
    return typeof carIsOwned === 'function' && carIsOwned(i)
      ? 'ENTER — ВЫБРАТЬ · ПОКУПКА МАШИН ПОКА НЕДОСТУПНА'
      : 'ПОКУПКА МАШИН ПОКА НЕДОСТУПНА · ESC — НАЗАД';
  }

  /**
   * Сколько не хватает до взноса.
   * @returns {number}
   */
  function lack() {
    return Math.max(0, FEE - (save.cash | 0));
  }

  /**
   * Взнос в Б после хотя бы одного заезда А.
   * @returns {boolean}
   */
  function canPayA() {
    return active() && save.storyMission === 'race_a' && flags().raceACompleted && save.cash >= FEE;
  }

  /**
   * Ложный взнос «дальше» после хотя бы одного заезда Б.
   * @returns {boolean}
   */
  function canPayB() {
    return active() && save.storyMission === 'race_b' && flags().raceBCompleted &&
      save.cash >= FEE && !flags().garageRobbed;
  }

  /**
   * Кнопка взноса на экране.
   * @returns {boolean}
   */
  function canPay() {
    return canPayA() || canPayB();
  }

  /**
   * Прогресс кассы.
   * @returns {string}
   */
  function feeHud() {
    return Math.min(FEE, save.cash | 0).toLocaleString('ru-RU') + ' / 5 000';
  }

  /**
   * Цель в гараже и на доске.
   * @returns {string}
   */
  function missionHud() {
    if (save.storyMission === 'race_a') {
      if (canPayA()) return 'ЗАЕЗДЫ А · ' + feeHud() + ' · F — ВНЕСТИ В Б';
      if (lack()) return 'ЗАЕЗДЫ А · ' + feeHud() + ' · ещё ' + lack().toLocaleString('ru-RU');
      return 'ЗАЕЗДЫ А · ' + feeHud() + ' · сначала прокатись';
    }
    if (save.storyMission === 'race_b') {
      if (canPayB()) return 'ЗАЕЗДЫ Б · ' + feeHud() + ' · F — ВНЕСТИ «ДАЛЬШЕ»';
      if (lack()) return 'ЗАЕЗДЫ Б · ' + feeHud() + ' · ещё ' + lack().toLocaleString('ru-RU');
      return 'ЗАЕЗДЫ Б · ' + feeHud() + ' · прокатись, как в А';
    }
    if (buying()) return 'ГАРАЖ ОГРАБЛЕН · ВЫБЕРИ ОДИН ИЗ ТРЁХ СТАРЫХ КУЗОВОВ';
    if (save.storyMission === 'restart_races') {
      const cls = (save.race | 0) < ARENA_CLASS_TRACKS ? 'А' : 'Б';
      return 'ХЛАМ · ЗАЕЗДЫ ' + cls + ' НА АРЕНЕ';
    }
    return 'ХЛАМ · АРЕНА · ГОНЯЙ';
  }

  /**
   * Пак комикса Медведя.
   * @returns {object|null}
   */
  function medvedPack() {
    return typeof CHAR_INTROS !== 'undefined' ? CHAR_INTROS[0] : null;
  }

  /**
   * Вступление — комикс пилота. Кража — те же кадры, пока нет отдельных.
   * @param {boolean} robbery
   * @param {number} [sceneIndex]
   * @returns {boolean}
   */
  function openComic(robbery, sceneIndex) {
    if (!active()) return false;
    const pack = medvedPack();
    WORLD_INTRO.kind = 'campaign';
    WORLD_INTRO.title = robbery ? 'МЕДВЕДЬ · ОГРАБЛЕНИЕ ГАРАЖА' : 'МЕДВЕДЬ · ПЕРВЫЙ ВЗНОС';
    WORLD_INTRO.accent = '#ff9d2e';
    WORLD_INTRO.dir = typeof playerComicsDir === 'function' ? playerComicsDir(0) : 'assets/data/players/01/comics/';
    if (pack && pack.imgs && pack.imgs.length) WORLD_INTRO.imgs = pack.imgs;
    else if (typeof worldIntroEnqueueImgs === 'function') worldIntroEnqueueImgs();
    const fallback = robbery ? [
        { img: 0, text: 'Крепления были срезаны изнутри. Тот, кто забрал Camaro, знал гараж лучше, чем должен. PitterMAX уже выходил на мост.' },
        { img: 5, text: 'МЕДВЕДЬ: «Если они вскроют память машины, исчезнет оригинал приказа». ЯНОТ: «Тогда не кричи на меня. Смотри, как они будут нас убивать».' },
        { img: 6, text: 'ЯНОТ: «Он не уходит. Он ведёт нас». МЕДВЕДЬ: «Знаю». Платформа открывается, и первая бочка падает на трассу.' }
      ] : (pack && pack.scenes ? pack.scenes.slice() : (
        typeof campaignIntroFallbackScenes === 'function' ? campaignIntroFallbackScenes() : []
      )).concat([
        { img: 6, text: 'БЕСТИЯ: «Пять тысяч покупают допуск. Доверие придётся оплачивать иначе». МЕДВЕДЬ: «Чьё?» БЕСТИЯ: «Сначала своё. Остальные посмотрят, доедешь ли ты».' }
      ]);
    const runtimeKey = robbery ? 'introScenes' : 'chapterIntroScenes';
    const editable = global.RnRChapterContent && RnRChapterContent.scenes(runtimeKey, []);
    if (editable && editable.length && typeof Image !== 'undefined') {
      WORLD_INTRO.imgs = editable.map(function (scene) {
        const image = new Image();
        if (scene.image && typeof worldIntroFetchImg === 'function') worldIntroFetchImg(image, [scene.image]);
        else if (scene.image) image.src = scene.image;
        return image;
      });
      WORLD_INTRO.scenes = editable.map(function (scene, index) {
        const speaker = scene.speaker ? scene.speaker + ': ' : '';
        return { img: index, text: speaker + scene.text + (scene.sub ? '\n' + scene.sub : '') };
      });
      const chapter = RnRChapterContent.get();
      if (chapter && chapter.title && robbery) WORLD_INTRO.title = chapter.title.toUpperCase();
    } else WORLD_INTRO.scenes = fallback;
    worldIntroBeginScreen();
    if (robbery && Number(sceneIndex) > 0) {
      WORLD_INTRO.frame = Math.min(WORLD_INTRO.scenes.length - 1, Math.max(0, Number(sceneIndex) | 0));
      if (typeof worldIntroResetType === 'function') worldIntroResetType();
    }
    return true;
  }

  /**
   * Списание допуска в Б. Второй раз не берём.
   * @returns {boolean}
   */
  function pay() {
    if (!canPayA()) return false;
    feeAsk = false;
    save.cash -= FEE;
    flags().entryBPaid = true;
    save.storyMission = 'race_b';
    save.race = TRACKDEFS.length;
    raceTrackOverride = null;
    raceBoard = null;
    persist();
    state = 'garage';
    return true;
  }

  /**
   * Ложный взнос: деньги целы, открывается кража.
   * @returns {boolean}
   */
  function fakePay() {
    if (!canPayB()) return false;
    flags().robberyPending = true;
    openComic(true);
    return true;
  }

  /**
   * Кнопка взноса: в А — подтверждение, в Б — сразу кража.
   * @returns {boolean}
   */
  function requestPay() {
    if (canPayB()) return fakePay();
    if (!canPayA()) return false;
    feeAsk = true;
    feeAskYes = true;
    return true;
  }

  /**
   * После заезда: А и Б не растут сами; кража только по кнопке «дальше».
   * @param {number} prevRace
   * @param {boolean} counts
   */
  function afterRace(prevRace, counts) {
    if (!active() || !counts) return;
    const n = TRACKDEFS.length;
    if (save.storyMission === 'race_a') {
      flags().raceACompleted = true;
      save.race = (prevRace + 1) % n;
    } else if (save.storyMission === 'race_b') {
      flags().raceBCompleted = true;
      save.race = n + ((prevRace + 1) % n);
    } else if (save.storyMission === 'restart_races') {
      // После кражи остаёмся только в классах А/Б этой арены.
      save.race = (prevRace + 1) % (n * 2);
    }
  }

  /**
   * Кража: кузова сброшены, касса цела.
   * @returns {boolean}
   */
  function rob() {
    if (!pending() || flags().garageRobbed) return false;
    flags().garageRobbed = true;
    flags().robberyPending = false;
    save.personalCarState = 'stolen';
    save.garageState = 'temp';
    save.storyChapter = 2;
    save.storyMission = 'buy_junk';
    save.carOwned = {};
    save.tuning = allTunes();
    save.temporaryCar = null;
    save.car = STARTER_LO;
    save.race = 0;
    save.winStreak = 0;
    save.careerWins = 0;
    save.bet = 0;
    ensureJunkBudget();
    raceTrackOverride = null;
    raceBoard = null;
    persist();
    return true;
  }

  /**
   * Конец ролика: машина уже выбрана, поэтому сразу в гараж.
   * @returns {boolean}
   */
  function finishComic() {
    if (!active()) return false;
    if (pending()) {
      if (typeof startStoryBearChase === 'function') startStoryBearChase();
      else {
        rob();
        enterCarSel(STARTER_LO);
      }
    } else if (!flags().introComplete) {
      flags().introComplete = true;
      save.storyChapter = 1;
      persist();
      state = 'garage';
    } else if (buying()) enterCarSel(STARTER_LO);
    else state = 'garage';
    return true;
  }

  /**
   * Продолжить срез.
   * @returns {boolean}
   */
  function resume() {
    if (!active()) return false;
    if (pending()) return openComic(true);
    if (!flags().campaignLoreComplete) {
      startCampaignIntro();
      return true;
    }
    if (!flags().introComplete) {
      if (flags().introCarChosen) return openComic(false);
      enterCameraSetup('car');
      return true;
    }
    if (buying()) { enterCarSel(STARTER_LO); return true; }
    return false;
  }

  /**
   * Кнопка под строкой цели, не на кассе.
   * @returns {{x:number,y:number,w:number,h:number}}
   */
  function feeRect() {
    return { x: W / 2 - 110, y: 86, w: 220, h: 28 };
  }

  /**
   * Кнопки «Нет / Да» на подтверждении взноса.
   * @returns {{no:{x:number,y:number,w:number,h:number},yes:{x:number,y:number,w:number,h:number}}}
   */
  function askPair() {
    const y = H / 2 + 28, w = 140, h = 44;
    return {
      no: { x: W / 2 - 154, y: y, w: w, h: h },
      yes: { x: W / 2 + 14, y: y, w: w, h: h }
    };
  }

  /**
   * Карточка подтверждения взноса.
   */
  function drawFeeAsk() {
    if (!feeAsk) return;
    g.fillStyle = 'rgba(4,3,8,.72)';
    g.fillRect(0, 0, W, H);
    panel(g, W / 2 - 280, H / 2 - 110, 560, 220, 'rgba(16,12,10,.97)', '#ff9d2e', 16);
    txt(g, 'ВЗНОС В ЗАЕЗДЫ Б', W / 2, H / 2 - 64, 22, '#ffd23f', 'center', F_B);
    txt(g, 'Списать 5 000 с кассы? Тюнинг и пушки с собой не вернут.', W / 2, H / 2 - 24, 14, '#c8c0d4', 'center');
    const p = askPair();
    panel(g, p.no.x, p.no.y, p.no.w, p.no.h, !feeAskYes ? 'rgba(88,255,107,.16)' : 'rgba(20,17,28,.9)', !feeAskYes ? '#58ff6b' : '#3a3548', 10);
    txt(g, 'НЕТ', p.no.x + p.no.w / 2, p.no.y + 22, 18, !feeAskYes ? '#58ff6b' : '#8f88a0', 'center');
    panel(g, p.yes.x, p.yes.y, p.yes.w, p.yes.h, feeAskYes ? 'rgba(255,61,46,.2)' : 'rgba(20,17,28,.9)', feeAskYes ? '#ff3d2e' : '#3a3548', 10);
    txt(g, 'ДА', p.yes.x + p.yes.w / 2, p.yes.y + 22, 18, feeAskYes ? '#ff3d2e' : '#8f88a0', 'center');
  }

  /**
   * Клавиши карточки взноса.
   * @param {string} c
   * @returns {boolean}
   */
  function pressFeeAsk(c) {
    if (!feeAsk) return false;
    if (c === 'ArrowLeft' || c === 'ArrowRight' || c === 'ArrowUp' || c === 'ArrowDown') {
      feeAskYes = !feeAskYes; sClick(); return true;
    }
    if (typeof isBack === 'function' && isBack(c)) { feeAsk = false; sClick(); return true; }
    if (typeof isConfirm === 'function' && isConfirm(c)) {
      if (feeAskYes) pay(); else feeAsk = false;
      sClick(); return true;
    }
    return true;
  }

  /**
   * Клик по карточке взноса.
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  function clickFeeAsk(x, y) {
    if (!feeAsk) return false;
    const p = askPair();
    const hit = function (b) { return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h; };
    if (hit(p.no)) { feeAsk = false; sClick(); return true; }
    if (hit(p.yes)) { pay(); sClick(); return true; }
    return true;
  }

  Object.assign(global, {
    storyBearChapterActive: active,
    storyBearMissionHud: missionHud,
    storyAfterCareerRace: afterRace,
    storyPayBearEntry: pay,
    storyRequestBearEntry: requestPay,
    storyRobBearGarage: rob,
    storyFinishBearComic: finishComic,
    storyResumeBearChapter: resume,
    storySyncChapterTracks: syncCatalog,
    storyCarShopHint: carShopHint,
    storyBearAutoparkLocked: autoparkLocked,
    storyEnsureJunkBudget: ensureJunkBudget,
    storyOpenBearComic: openComic
  });

  const startCamp = global.storyStartNewCampaign;
  if (typeof startCamp === 'function') {
    global.storyStartNewCampaign = function () {
      const r = startCamp.apply(this, arguments);
      syncCatalog();
      return r;
    };
  }
  const contCamp = global.storyContinueCampaign;
  if (typeof contCamp === 'function') {
    global.storyContinueCampaign = function () {
      const r = contCamp.apply(this, arguments);
      syncCatalog();
      return r;
    };
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  function wrap(name, factory) { if (engine.get(name)) engine.wrap(name, factory); }

  wrap('startCampaignIntro', prev => function () {
    if (!active()) { prev(); return; }
    startWorldIntro();
    WORLD_INTRO.kind = 'campaignLore';
  });
  wrap('endWorldIntro', prev => function () {
    if (!active() || WORLD_INTRO.kind !== 'campaignLore') return prev();
    WORLD_INTRO.kind = 'lore';
    WORLD_INTRO.dir = 'assets/data/cats/00/';
    if (typeof worldIntroStopMusic === 'function') worldIntroStopMusic();
    WORLD_INTRO.skipT = 0;
    if (typeof lastMusicCat !== 'undefined') lastMusicCat = null;
    flags().campaignLoreComplete = true;
    persist();
    enterCameraSetup('car');
  });
  wrap('worldIntroApplyJson', prev => function (data) {
    if (active() && WORLD_INTRO.kind === 'campaign') return;
    return prev(data);
  });
  wrap('persist', prev => function () {
    if (buying() && storyJunk(save.car) && save.carOwned && save.carOwned[save.car]) {
      save.temporaryCar = save.car;
      save.storyMission = 'restart_races';
      flags().junkPurchased = true;
      if (typeof garMsg !== 'undefined') {
        garMsg = 'СНОВА ПЕРВЫЙ ДИВИЗИОН · СТАРЫЙ КОРПУС';
        garMsgT = 3.4;
      }
    }
    const out = prev.apply(this, arguments);
    syncCatalog();
    return out;
  });
  wrap('loadSave', prev => function () {
    const r = prev.apply(this, arguments);
    syncCatalog();
    return r;
  });
  wrap('updRace', prev => function (dt) {
    const out = prev(dt);
    tickBestiaGuide();
    return out;
  });
  wrap('careerOpenFromResults', prev => function () {
    if (pending()) { openComic(true); return; }
    return prev();
  });
  wrap('enterPreRace', prev => function () {
    if (pending()) { openComic(true); return; }
    if (buying()) { enterCarSel(STARTER_LO); return; }
    return prev();
  });
  wrap('enterAutopark', prev => function () {
    if (!autoparkLocked()) return prev();
    if (typeof garMsg !== 'undefined') {
      garMsg = 'АВТОПАРК ВРЕМЕННО НЕДОСТУПЕН';
      garMsgT = 2.4;
    }
    if (typeof sHit === 'function') sHit();
  });
  wrap('carSelStatus', prev => function (i, owned) {
    if (purchasesLocked() && !owned) {
      return { t: 'ПОКУПКА МАШИН ПОКА НЕДОСТУПНА', col: '#8f88a0' };
    }
    return prev.apply(this, arguments);
  });
  wrap('careerMakeBrief', prev => function () {
    const brief = prev.apply(this, arguments);
    if (!active() || !brief) return brief;
    brief.news = (brief.news || []).filter(n => n.kind !== 'div');
    const title = save.storyMission === 'restart_races'
      ? ('АРЕНА · ЗАЕЗДЫ ' + ((save.race | 0) < ARENA_CLASS_TRACKS ? 'А' : 'Б'))
      : save.storyMission === 'race_b' ? 'ЗАЕЗДЫ Б' : 'ГЛАВА МЕДВЕДЯ';
    brief.news.unshift({ kind: 'story', title: title, text: missionHud(), col: '#ff9d2e' });
    brief.news = brief.news.slice(0, 6);
    if (canPay()) {
      const sub = canPayB() ? 'якобы следующий уровень' : 'допуск в заезды Б';
      brief.actions = [{ id: 'bear_entry', label: 'ВНЕСТИ 5 000', sub: sub }].concat(brief.actions || []);
    }
    return brief;
  });
  wrap('careerDo', prev => function (id) {
    if (id === 'bear_entry') { requestPay(); return; }
    return prev(id);
  });
  wrap('careerPress', prev => function (c) {
    if (pressFeeAsk(c)) return;
    return prev(c);
  });
  wrap('careerClick', prev => function (x, y) {
    if (clickFeeAsk(x, y)) return;
    return prev(x, y);
  });
  wrap('drawCareer', prev => function () {
    prev();
    drawFeeAsk();
  });
  wrap('carCatalogOrder', prev => function () {
    const list = prev();
    return buying() ? list.filter(storyJunk) : list;
  });
  wrap('press', prev => function (c, k) {
    const introPick = active() && !flags().introComplete && state === 'car' &&
      isConfirm(c) && !carConfirmed;
    if (active()) {
      if (pressFeeAsk(c)) return;
      if (state === 'garage' && c === 'KeyF' && !(typeof garagePaused !== 'undefined' && garagePaused) && canPay()) {
        requestPay(); return;
      }
      if (buying() && state === 'car' && isBack(c)) { enterTitle(); return; }
      if (isConfirm(c) && (state === 'car' || state === 'detail')) {
        const i = state === 'car' ? selCar : autoparkSel;
        const unowned = typeof carIsOwned === 'function' && !carIsOwned(i);
        if (storyBlocksTake(i) || (buying() && !storyJunk(i)) || (purchasesLocked() && unowned)) { sHit(); return; }
      }
    }
    const out = prev(c, k);
    if (introPick && carConfirmed && save.car === selCar) {
      flags().introCarChosen = true;
      persist();
      openComic(false);
    }
    return out;
  });
  wrap('drawGarage', prev => function () {
    prev();
    if (canPay() && !feeAsk) {
      const b = feeRect();
      panel(g, b.x, b.y, b.w, b.h, '#241b13', '#ff9d2e', 6);
      txt(g, canPayB() ? 'ВНЕСТИ 5 000 · ДАЛЬШЕ' : 'ВНЕСТИ 5 000 · Б', b.x + b.w / 2, b.y + 14, 13, '#ffd23f', 'center', F_B);
    }
    drawFeeAsk();
  });
  wrap('hubClick', prev => function (x, y) {
    if (clickFeeAsk(x, y)) return;
    if (state === 'garage' && canPay() && !feeAsk && !(typeof garagePaused !== 'undefined' && garagePaused)) {
      const b = feeRect();
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { requestPay(); return; }
    }
    return prev(x, y);
  });
  syncCatalog();
})(typeof window !== 'undefined' ? window : globalThis);
