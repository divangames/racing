// Штатный гоночный HUD для миссии 01 и встроенная шкала дистанции.
(function (global) {
  'use strict';

  const CFG = global.MISSION_01;
  const MAP_WIDTH = 60;
  const MAP_HEIGHT = 900;
  const DISTANCE_HEIGHT = 42;
  const DISTANCE_GAP = 18;
  let player = null;
  let truck = null;
  let race = null;

  /** Создаёт совместимое с HUD состояние Янот на машине из cars/11. */
  function makePlayer() {
    const car = CARS[CFG.tonyaCarIndex];
    const pilot = CHARS[5] || CHARS[save.char] || CHARS[0];
    if (typeof makeRacer === 'function') {
      const racer = makeRacer(pilot, car, true, typeof blankTune === 'function' ? blankTune() : {}, 4, {noAiScale: true});
      racer.lap = 0;
      return racer;
    }
    return {car, ch: pilot, chIdx: 5, skillLvl: 1, st: {top: 360, maxhp: 100},
      hp: 100, maxhp: 100, lap: 0, cdN: 0, cdW: 0, cdU: 0, nitro: 0,
      shield: 0, bubble: 0, invuln: 0, dead: false, air: false, handbrake: false};
  }

  /** Создаёт прямую вертикальную миникарту и цель впереди игрока. */
  function ensure() {
    if (race) return;
    player = makePlayer();
    truck = {x: 30, y: 130, ang: -Math.PI / 2, dead: false, isP: false,
      aiCol: '#ff3158', ch: {short: 'PitterMAX', name: 'PitterMAX'}, car: {idx: -1}};
    const points = [[22, MAP_HEIGHT], [18, 680], [30, 470], [23, 250], [28, 0],
      [38, 0], [33, 250], [42, 470], [34, 680], [40, MAP_HEIGHT]];
    race = {phase: 'go', time: 0, racers: [truck, player], order: [truck, player],
      picks: [], S: [{x: 30, y: MAP_HEIGHT}], msg: null, endTimer: 0,
      map: {mnx: 0, mny: 0, ms: 1, mw: MAP_WIDTH, mh: MAP_HEIGHT, pts: points}};
  }

  /** Переносит живые значения погони в формат обычного гоночного HUD. */
  function sync(model) {
    ensure();
    player.x = 30; player.y = 760; player.ang = -Math.PI / 2;
    player.spd = model.playerSpeed * player.st.top;
    player.lat = model.lateralVelocity; player.steerFlt = model.steerVisual;
    player.hp = model.hp; player.maxhp = model.maxHp;
    player.nitro = model.nitroTime > 0 ? 1 : 0;
    player.cdN = model.nitroCooldown; player.cdW = model.fireTimer;
    player.chaseWeaponHeat = true;
    player.wepHeat = model.weaponHeat; player.wepOver = model.weaponOverheatTime;
    player.dead = model.phase === 'FAILED' || model.phase === 'COMIC';
    truck.x = 30 + model.truckLane * 8;
    truck.y = 150 + Math.max(0, model.distance - CFG.greenZoneDistance) * 4.2;
    race.time = model.elapsed;
  }

  /** Размещает шкалу под корпусом слева, оставляя часы и дорогу полностью свободными. */
  function distanceBox(layout) {
    return {x: layout.vehicle.x, y: layout.vehicle.y + layout.vehicle.h + DISTANCE_GAP,
      w: layout.vehicle.w, h: DISTANCE_HEIGHT};
  }

  /** Рисует компактную шкалу в отдельной левой колонке теми же примитивами HUD. */
  function drawDistance(model, context, layout) {
    const kit = global.DiVANEngine.cyberKit;
    if (!context || !layout || !kit) return;
    const box = distanceBox(layout), x = box.x, y = box.y, width = box.w, height = box.h;
    const range = Math.max(1, CFG.maxDistance - CFG.minDistance);
    const red = (width - 24) * (CFG.maxDistance - CFG.redZoneDistance) / range;
    const green = (width - 24) * (CFG.greenZoneDistance - CFG.minDistance) / range;
    const meterX = x + 12, meterY = y + 25, meterW = width - 24;
    const t = 1 - Math.max(0, Math.min(1, (model.distance - CFG.minDistance) / (CFG.maxDistance - CFG.minDistance)));
    const status = model.distanceZone === 'RED' ? 'ГРУЗОВИК УХОДИТ' :
      model.distanceZone === 'GREEN' ? 'ДЕРЖИСЬ РЯДОМ' : 'ДИСТАНЦИЯ';
    const color = model.distanceZone === 'RED' ? kit.colors.red : model.distanceZone === 'GREEN' ? '#58ff6b' : kit.colors.gold;
    kit.frame(context, x, y, width, height, color);
    kit.text(context, status, x + 12, y + 12, 9, color, 'left', width - 76, true);
    const timer = model.distanceZone === 'RED' ? Math.max(0, CFG.redZoneTime - model.redTimer).toFixed(1) + ' С' :
      model.distanceZone === 'GREEN' ? model.greenTimer.toFixed(1) + ' / ' + CFG.greenZoneTime.toFixed(1) : Math.round(model.distance) + ' М';
    kit.text(context, timer, x + width - 12, y + 12, 10, kit.colors.ice, 'right', 70, true);
    context.fillStyle = '#a82b3c'; context.fillRect(meterX, meterY, red, 5);
    context.fillStyle = '#c99a30'; context.fillRect(meterX + red, meterY, meterW - red - green, 5);
    context.fillStyle = '#2fa95b'; context.fillRect(meterX + meterW - green, meterY, green, 5);
    const marker = meterX + t * meterW;
    context.fillStyle = kit.colors.ice; context.fillRect(marker - 2, meterY - 3, 4, 11);
  }

  /** Временно подставляет миссию в штатный композитор HUD и возвращает гонку. */
  function draw(model) {
    if (!global.DiVANEngine.cyberHud || model.phase === 'COMIC') return false;
    sync(model);
    const oldPlayer = P, oldRace = R, oldLab = labTest, oldLaps = raceLaps;
    try {
      P = player; R = race; labTest = false; raceLaps = 1;
      global.DiVANEngine.cyberHud.draw(false, function (context, layout) {
        if (model.phase === 'CHASE' || model.phase === 'CHASE_START') drawDistance(model, context, layout);
      });
    } finally {
      P = oldPlayer; R = oldRace; labTest = oldLab; raceLaps = oldLaps;
    }
    return true;
  }

  global.RnRStoryChaseHud = {draw, sync, distanceBox};
})(typeof window !== 'undefined' ? window : globalThis);
