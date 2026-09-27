// Контроллер миссии 01: ввод, аудиосостояние, экраны и точки запуска.
(function (global) {
  'use strict';

  const CFG = global.MISSION_01;
  const Model = global.RnRStoryChaseModel;
  const View = global.RnRStoryChaseView;
  const Bridge = global.RnRStoryChaseBridge;
  const Horn = global.RnRStoryChaseHorn;
  if (!CFG || !Model || !View || !Bridge || !Horn) return;
  const STATE = 'bearChase';
  const TUTORIAL_CARD_WIDTH = 520;
  const TUTORIAL_CARD_HEIGHT = 62;
  const CINEMATIC_LINES = [
    {id: 'BRIDGE_APPROACH', speaker: 'МЕДВЕДЬ / ЯНОТ', text: 'МЕДВЕДЬ: «Он подпустил нас». ЯНОТ: «Значит, уже выбрал место».'},
    {id: 'BRIDGE_COLLAPSE', speaker: 'ЯНОТ', text: 'Мост! Руль ровно!'},
    {id: 'PLAYER_CLOSEUP', speaker: 'ЯНОТ', text: 'Стоим. Не выходи — край ещё сыплется.'},
    {id: 'TRUCK_ESCAPE', speaker: 'МЕДВЕДЬ', text: 'Он не спасается. Он везёт нас туда, куда ему приказали.'},
    {id: 'AFTERMATH_RETURN', speaker: 'ЯНОТ', text: 'Живы. Значит, поражение ещё можно превратить в улику.'}
  ];
  const audioPlayer = {st: {top: 360}, spd: 0, lat: 0, steerFlt: 0, ith: 0,
    x: 0, y: 0, nitro: 0, air: false, handbrake: false, finished: false, dead: false, isP: true};
  const audioRace = {T: {theme: {weather: '', crowdSound: false}}};
  let chase = null;

  global.storyBearChaseAudioPlayer = audioPlayer;
  global.storyBearChaseRace = audioRace;

  /** Читает штатную ось и кнопки гонки. */
  function liveInput() {
    const axis = global.DiVANEngine && global.DiVANEngine.input && global.DiVANEngine.input.axis
      ? global.DiVANEngine.input.axis() : {throttle: 0, steer: 0};
    return {throttle: axis.throttle || 0, steer: axis.steer || 0,
      fire: typeof ctrlHeld === 'function' ? ctrlHeld('fire') : false,
      nitro: typeof ctrlHeld === 'function' ? ctrlHeld('nitro') : false};
  }

  /** Обновляет данные машины Янот для общих моторных и шинных звуков. */
  function syncAudio(input) {
    audioPlayer.car = typeof CARS !== 'undefined' ? CARS[CFG.tonyaCarIndex] : null;
    audioPlayer.spd = chase.playerSpeed * audioPlayer.st.top;
    // В игровом заносе моста общий шинный канал получает реальное окно контакта.
    const skidStrength = chase.bridgeSlip || chase.bridgeSkid || 0;
    const bridgeSkid = skidStrength > .05;
    audioPlayer.lat = bridgeSkid ? chase.bridgeDriftSide * 88 * skidStrength : chase.lateralVelocity;
    audioPlayer.steerFlt = bridgeSkid ? chase.bridgeDriftSide * skidStrength : chase.steerVisual;
    audioPlayer.handbrake = bridgeSkid;
    if (bridgeSkid) audioPlayer._tireContact = true;
    else delete audioPlayer._tireContact;
    audioPlayer.ith = Bridge.active(chase) ? 0 : Math.max(0, input.throttle);
    audioPlayer._engineThrottle = Bridge.active(chase) ? 0 : input.throttle;
    audioPlayer.x = Model.playerScreenX(chase); audioPlayer.y = Model.playerScreenY(chase);
    audioPlayer.nitro = chase.nitroTime > 0 ? 1 : 0;
    audioPlayer.hp = chase.hp; audioPlayer.maxhp = chase.maxHp;
    audioPlayer.dead = chase.phase === 'COMIC' || chase.phase === 'FAILED';
    audioRace.T.theme = Model.trackSettings().theme;
    audioRace.weather = audioRace.T.theme.weather ? {id: audioRace.T.theme.weather} : null;
    Horn.sync(chase);
  }

  /** Запускает погоню со вступительного проезда PitterMAX. */
  function start() {
    Horn.reset();
    chase = Model.create(); global.storyBearChase = chase;
    audioPlayer.car = typeof CARS !== 'undefined' ? CARS[CFG.tonyaCarIndex] : null;
    audioRace.T.theme = Model.trackSettings().theme;
    audioRace.weather = audioRace.T.theme.weather ? {id: audioRace.T.theme.weather} : null;
    if (typeof clearKeys === 'function') clearKeys();
    state = STATE;
    if (typeof lastMusicCat !== 'undefined') lastMusicCat = null;
    return chase;
  }

  /** Повторяет миссию с полным корпусом. */
  function retry() {
    Horn.reset();
    chase = Model.create(); global.storyBearChase = chase;
    chase.phase = 'CHASE_START';
    audioRace.T.theme = Model.trackSettings().theme;
    audioRace.weather = audioRace.T.theme.weather ? {id: audioRace.T.theme.weather} : null;
    if (typeof clearKeys === 'function') clearKeys();
    state = STATE;
  }

  /** Завершает погоню и переводит сюжет к покупке хлама. */
  function finish() {
    Horn.reset();
    if (typeof storyRobBearGarage === 'function') storyRobBearGarage();
    if (typeof enterCarSel === 'function' && typeof STARTER_LO === 'number') enterCarSel(STARTER_LO);
    else state = 'garage';
  }

  /** Делает кадровый шаг и синхронизирует звук. */
  function tick() {
    if (!chase) return;
    const now = typeof gt === 'number' ? gt : chase.lastGt + 1 / 60;
    const dt = Model.clamp(now - chase.lastGt, 0, .05); chase.lastGt = now;
    const input = liveInput(); Model.step(chase, input, dt); syncAudio(input);
  }

  /** Отображает назначенную игроком кнопку, а не жёстко заданную раскладку. */
  function keyLabel(name, fallback) {
    const controls = typeof settings !== 'undefined' && settings.controls;
    const code = controls && controls[name] && controls[name][0] || fallback;
    return String(code).replace(/^Key/, '').replace(/^Digit/, '').replace('Space', 'ПРОБЕЛ')
      .replace('ArrowUp', '↑').replace('ArrowDown', '↓').replace('ArrowLeft', '←').replace('ArrowRight', '→');
  }

  /** Сначала опасность и обратная связь, затем учебные подсказки. */
  function tutorialMessage(model) {
    if (model.phase === 'CHASE_START') return {
      title: 'ЦЕЛЬ: ДОГОНИ PitterMAX',
      body: keyLabel('up', 'KeyW') + ' — газ  ·  ' + keyLabel('down', 'KeyS') + ' — тормоз  ·  ' +
        keyLabel('left', 'KeyA') + ' / ' + keyLabel('right', 'KeyD') + ' — руль'
    };
    if (model.phase !== 'CHASE') return null;
    if (model.distanceZone === 'RED') return {
      title: 'ГРУЗОВИК УХОДИТ — НАБИРАЙ СКОРОСТЬ',
      body: model.nitroCooldown <= 0 ? keyLabel('nitro', 'KeyX') + ' — нитро готово. Вернись в жёлтую зону!' :
        'Держи газ и объезжай бочки — до потери цели ' + Math.max(0, CFG.redZoneTime-model.redTimer).toFixed(1) + ' с'
    };
    if (model.weaponOverheatTime > 0) return {
      title: 'ОРУЖИЕ ПЕРЕГРЕЛОСЬ', body: 'Объезжай бочки. Стреляй короткими очередями после охлаждения'
    };
    const incoming = model.pendingDrops.find(drop => drop.delay <= drop.warning);
    if (incoming) return {title: incoming.label, body: 'Янтарная метка — полоса сброса. Смени полосу или приготовься стрелять'};
    if (model.feedbackTime > 0) return {title: model.feedback,
      body: 'Расстреливай бочки на расстоянии — близкий взрыв тоже задевает машину'};
    if (model.distanceZone === 'GREEN') return {title: 'ПОЧТИ ДОГНАЛИ — УДЕРЖИ ДИСТАНЦИЮ',
      body: 'Ещё ' + Math.max(0, CFG.greenZoneTime-model.greenTimer).toFixed(1) + ' с. Газ не отпускай, следи за сбросами'};
    if (model.elapsed < CFG.tutorialDriveEnd) return {
      title: 'УДЕРЖИВАЙ МАРКЕР В ЗЕЛЁНОЙ ЗОНЕ 5 СЕКУНД',
      body: 'Следи за шкалой слева: красная зона означает, что грузовик уходит'
    };
    if (model.elapsed < CFG.tutorialBarrelEnd) return {
      title: keyLabel('fire', 'Space') + ' — РАССТРЕЛИВАЙ БОЧКИ ЗАРАНЕЕ',
      body: 'Или объезжай — прямой удар отнимает корпус и скорость'
    };
    if (model.elapsed < CFG.tutorialNitroEnd) return {
      title: keyLabel('nitro', 'KeyX') + ' — НИТРО',
      body: 'Включай вручную, когда после удара PitterMAX начинает отрываться'
    };
    return null;
  }

  /** Короткие реплики оставляют игровой кадр открытым; текст доступен в редакторе главы. */
  function drawCinematicText(model) {
    if (typeof txt !== 'function') return;
    const w=Model.screenWidth(), h=Model.screenHeight();
    if (model.phase === 'TRUCK_INTRO') {
      txt(g, 'PitterMAX  /  МАШИНА МЕДВЕДЯ НА ПЛАТФОРМЕ', w/2, h-65, 13, '#e5d1a6', 'center');
      txt(g, 'ENTER — ПРОПУСТИТЬ ПРОЕЗД', w/2, h-42, 10, '#b8bec5', 'center');
      return;
    }
    if (!Bridge.active(model)) return;
    if (model.phase === 'AFTERMATH_RETURN' && model.phaseTime < CFG.bridgeReturnTime * .55) return;
    const phase = ['BRAKE_HIT', 'DRIFT_STOP', 'DRIFT_SETTLE'].includes(model.phase) ? 'BRIDGE_COLLAPSE' : model.phase;
    const lines = global.RnRChapterContent ? RnRChapterContent.scenes('cinematicScenes', CINEMATIC_LINES) : CINEMATIC_LINES;
    const cue=lines.find(line=>line.id===phase);
    if (!cue) return;
    g.save(); g.shadowColor='rgba(0,0,0,.95)'; g.shadowBlur=8;
    txt(g, cue.speaker, w/2, h-72, 11, '#efbd69', 'center');
    txt(g, cue.text, w/2, h-48, 18, '#f2eee5', 'center');
    g.restore();
  }

  /** Рисует читаемую учебную карточку над штатной нижней панелью гонки. */
  function drawTutorial(model) {
    const message = tutorialMessage(model);
    if (!message || typeof txt !== 'function') return;
    const w = Model.screenWidth(), h = Model.screenHeight();
    const width = Math.min(TUTORIAL_CARD_WIDTH, w - 40), x = (w - width) / 2, y = h - 190;
    if (typeof panel === 'function') panel(g, x, y, width, TUTORIAL_CARD_HEIGHT,
      'rgba(8,12,18,.92)', '#f3bd36', 8);
    else { g.fillStyle = 'rgba(8,12,18,.92)'; g.fillRect(x, y, width, TUTORIAL_CARD_HEIGHT); }
    txt(g, message.title, w / 2, y + 22, 14, '#ffd84b', 'center', typeof F_B !== 'undefined' ? F_B : undefined);
    txt(g, message.body, w / 2, y + 45, 11, '#e8eef4', 'center', typeof F_B !== 'undefined' ? F_B : undefined);
  }

  /** Рисует игровой кадр и поверх него штатный HUD. */
  function draw() {
    if (!chase) return;
    tick();
    const w = Model.screenWidth(), h = Model.screenHeight();
    View.drawWorld(chase);
    if ((chase.phase === 'CHASE_START' || chase.phase === 'CHASE' || chase.phase === 'FAILED') &&
      global.RnRStoryChaseHud) {
      global.RnRStoryChaseHud.draw(chase);
    }
    drawTutorial(chase);
    drawCinematicText(chase);
    if (chase.flash > 0) {
      g.fillStyle = 'rgba(255,102,32,' + chase.flash * .22 + ')'; g.fillRect(0, 0, w, h);
    }
    if (chase.phase === 'FAILED') View.drawFailure(chase);
    if (chase.phase === 'COMIC') View.drawComic(chase);
    if (chase.pause && chase.phase !== 'FAILED' && chase.phase !== 'COMIC') {
      g.fillStyle = 'rgba(3,2,5,.72)'; g.fillRect(0, 0, w, h);
      if (typeof txt === 'function') txt(g, 'ПАУЗА', w / 2, h / 2, 42, '#fff',
        'center', typeof F_B !== 'undefined' ? F_B : undefined);
    }
  }

  /** Подтверждает выбор на экране поражения или листает комикс. */
  function confirm() {
    if (!chase) return;
    if (chase.phase === 'FAILED') {
      if (chase.failedChoice === 0) retry();
      else if (typeof enterTitle === 'function') enterTitle();
      return;
    }
    if (chase.phase === 'COMIC') {
      chase.comicIndex += 1;
      if (chase.comicIndex >= View.comicPages().length) finish();
    }
  }

  /** Переводит симуляцию в выбранную точку редактора. */
  function applyPoint(point, sceneIndex) {
    if (!chase) return false;
    Horn.reset();
    Object.assign(chase, Model.create());
    const id = String(point || 'CHASE_START'); chase.pause = false; chase.phaseTime = 0;
    if (id === 'TRUCK_INTRO') chase.phase = 'TRUCK_INTRO';
    else if (id === 'CHASE') chase.phase = 'CHASE';
    else if (id === 'RED_WARNING') {
      chase.phase = 'CHASE'; chase.distance = CFG.redZoneDistance + 8;
      chase.distanceZone = 'RED'; chase.redTimer = CFG.redZoneTime * .5;
    } else if (id === 'GREEN_HOLD') {
      chase.phase = 'CHASE'; chase.distance = CFG.greenZoneDistance - 2;
      chase.distanceZone = 'GREEN'; chase.greenTimer = CFG.greenZoneTime * .5;
    } else if (['BRIDGE_APPROACH', 'BRIDGE_COLLAPSE', 'BRAKE_HIT', 'DRIFT_STOP', 'DRIFT_SETTLE',
      'PLAYER_CLOSEUP', 'SEPARATION_SHOT', 'GAP_TRAVERSE', 'TRUCK_FOCUS', 'TRUCK_ESCAPE',
      'AFTERMATH_RETURN', 'ENGINE_FAILURE', 'BRIDGE_RETURN'].indexOf(id) >= 0) {
      const phase = id === 'ENGINE_FAILURE' ? 'BRAKE_HIT' : id === 'BRIDGE_RETURN' ? 'AFTERMATH_RETURN' : id;
      // Редактор проигрывает тот же путь симуляции, а не подделывает положение камер и возраст взрывов.
      chase.phase = 'CHASE'; chase.distance = CFG.greenZoneDistance; chase.playerSpeed = CFG.playerMaxSpeed;
      const frame = {truckY: Model.truckY(chase), playerY: Model.playerScreenY(chase), camera: Model.camera(chase)};
      Bridge.begin(chase, Model.trackSettings().roadHalfWidth, frame);
      chase.cinematicSeeking = true;
      for (let guard = 0; chase.phase !== phase && guard < 30000; guard++) Model.step(chase, {}, .01, () => .5);
      const sample = phase === 'TRUCK_ESCAPE' || phase === 'BRIDGE_APPROACH' ? 0 : Bridge.phaseDuration(phase) * .45;
      for (let left = sample; left > .000001; left -= .01) Model.step(chase, {}, Math.min(.01, left), () => .5);
      chase.cinematicSeeking = false; chase.lastGt = typeof gt === 'number' ? gt : 0;
    }
    else if (id === 'POST_COMIC') {
      chase.phase = 'COMIC'; chase.comicIndex = Model.clamp(sceneIndex | 0, 0, Math.max(0, View.comicPages().length - 1));
    } else if (id === 'FAILED') chase.phase = 'FAILED';
    else chase.phase = 'CHASE_START';
    Horn.sync(chase);
    return true;
  }

  /** Обрабатывает меню паузы, поражения и комикса. */
  function pressKey(code) {
    if (!chase || state !== STATE) return false;
    if (chase.phase === 'TRUCK_INTRO' && code === 'Enter') {
      Horn.reset(); chase.phase = 'CHASE_START'; chase.phaseTime = 0;
      if (typeof clearKeys === 'function') clearKeys();
      return true;
    }
    if (global.storyChapterTestMode && code === 'Escape' && global.RnRChapterContent) {
      Horn.reset();
      global.RnRChapterContent.exitTest(); return true;
    }
    if (chase.phase === 'FAILED') {
      if (code === 'ArrowUp' || code === 'ArrowDown' || code === 'KeyW' || code === 'KeyS') {
        chase.failedChoice = 1 - chase.failedChoice;
        if (typeof sClick === 'function') sClick();
      } else if (typeof isConfirm === 'function' ? isConfirm(code) : code === 'Enter') confirm();
      return true;
    }
    if (chase.phase === 'COMIC') {
      if (typeof isConfirm === 'function' ? isConfirm(code) : code === 'Enter') confirm();
      return true;
    }
    if (code === 'Escape' || code === 'KeyP') {
      chase.pause = !chase.pause;
      Horn.sync(chase);
      if (typeof clearKeys === 'function') clearKeys();
    }
    return true;
  }

  /** Обрабатывает клик по кнопкам и огонь по дороге. */
  function click(x, y) {
    if (!chase || state !== STATE) return false;
    if (chase.phase === 'FAILED' && chase.failRects) {
      for (let i = 0; i < chase.failRects.length; i++) {
        const box = chase.failRects[i];
        if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) {
          chase.failedChoice = i; confirm(); return true;
        }
      }
      return true;
    }
    if (chase.phase === 'COMIC') { confirm(); return true; }
    Model.fire(chase); return true;
  }

  Object.assign(global, {startStoryBearChase: start, drawStoryBearChase: draw,
    storyBearChaseStep: Model.step, storyBearChaseZone: Model.zone,
    storyBearChaseCreate: Model.create, storyBearChaseExplode: Model.explode,
    storyBearChaseApplyPoint: applyPoint});

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.storyChase = {config: CFG, transport: global.PITTER_MAX, create: Model.create,
    step: Model.step, zone: Model.zone, start: start, fire: Model.fire,
    explode: Model.explode, applyPoint: applyPoint};
  if (engine.screens && typeof engine.screens.paint === 'function') {
    const previousPaint = engine.screens.paint;
    engine.screens.paint = function (mode) {
      if (mode === STATE) { draw(); return; }
      return previousPaint(mode);
    };
    if (Array.isArray(engine.screens.names) && engine.screens.names.indexOf(STATE) < 0) engine.screens.names.push(STATE);
  }
  if (engine.get('press')) engine.wrap('press', function (previous) {
    return function (code, key) { if (state === STATE && pressKey(code)) return; return previous(code, key); };
  });
  if (engine.get('hubClick')) engine.wrap('hubClick', function (previous) {
    return function (x, y) { if (state === STATE && click(x, y)) return; return previous(x, y); };
  });
})(typeof window !== 'undefined' ? window : globalThis);
