// Симуляция погони: скорость, дистанция, бочки, урон и камера.
(function (global) {
  'use strict';

  const CFG = global.MISSION_01;
  const Pressure = global.RnRStoryChasePressure;
  const Bridge = global.RnRStoryChaseBridge;
  if (!CFG || !Pressure || !Bridge) return;
  const BOUNCE_SPANS = [.72, .58, .46, .34];
  const TRUCK_REAR_OFFSET = -76;
  const TRUCK_BARREL_LANE = 28;

  /** Ограничивает число заданным диапазоном. */
  function clamp(value, lo, hi) {
    return Math.max(lo, Math.min(hi, value));
  }

  /** Линейно смешивает два значения. */
  function mix(a, b, t) {
    return a + (b - a) * clamp(t, 0, 1);
  }

  /** Плавно ведёт значение к цели. */
  function approach(value, target, step) {
    return value < target ? Math.min(target, value + step) : Math.max(target, value - step);
  }

  /** Возвращает случайное число в диапазоне. */
  function randomBetween(lo, hi, random) {
    return lo + (hi - lo) * (random || Math.random)();
  }

  /** Определяет цветовую зону дистанции. */
  function zone(distance) {
    if (distance > CFG.redZoneDistance) return 'RED';
    if (distance <= CFG.greenZoneDistance) return 'GREEN';
    return 'YELLOW';
  }

  /** Читает живые настройки дороги из редактора глав. */
  function trackSettings() {
    const doc = global.RnRChapterContent && RnRChapterContent.get();
    const value = doc && doc.track || {};
    const theme = Object.assign({
      ground: '#8b4a2d', dark: '#532719', road: '#43404b', line: '#d9b85f',
      map: 'sand', weather: '', groundSrc: '', roadSrc: '', railSrc: '', groundScale: 1
    }, value.theme || {});
    theme.crowdSound = false;
    return {roadHalfWidth: Number(value.roadHalfWidth) || CFG.roadHalfWidth,
      curveAmount: Number.isFinite(Number(value.curveAmount)) ? Number(value.curveAmount) : 34, theme: theme};
  }

  /** Возвращает текущую ширину половины дороги. */
  function roadHalfWidth() {
    return trackSettings().roadHalfWidth;
  }

  /** Размер игрового кадра. */
  function screenWidth() { return typeof W === 'number' ? W : 1280; }
  function screenHeight() { return typeof H === 'number' ? H : 720; }

  /** Штатный масштаб гоночной камеры. */
  function baseZoom() { return typeof raceZoom === 'function' ? raceZoom() : 1.65; }
  function playerAnchorY() { return screenHeight() * .56; }
  function worldYForScreen(screenY) {
    return playerAnchorY() + (screenY - playerAnchorY()) / baseZoom();
  }

  /** Центр и касательная дороги в точке. */
  function roadCenter(model, y) {
    const travel = y - model.scroll;
    const curve = trackSettings().curveAmount;
    return screenWidth() / 2 + Math.sin(travel * .00155) * curve +
      Math.sin(travel * .00054 + 1.2) * curve * .44;
  }
  function roadHeading(model, y) {
    const sample = 4;
    return Math.atan2(-sample * 2, roadCenter(model, y - sample) - roadCenter(model, y + sample));
  }

  /** Положение босса и игрока в мире погони. */
  function truckY(model) {
    // Монтаж моста целиком живёт в одной мировой системе с игроком и линией разрыва.
    // Повторное преобразование через базовый гоночный zoom подтягивало PitterMAX назад
    // и визуально оставляло его прицеп над уже рухнувшей секцией.
    if (Bridge.active(model)) return Bridge.truckScreenY(model, screenHeight());
    const closeness = clamp((CFG.redZoneDistance - model.distance) /
      (CFG.redZoneDistance - CFG.greenZoneDistance), 0, 1);
    return worldYForScreen(mix(-58, 126, closeness));
  }
  function truckX(model) { return roadCenter(model, truckY(model)) + model.truckLane * CFG.truckLaneWidth; }
  function playerScreenY(model) {
    if (model.phase === 'TRUCK_INTRO') {
      const entry = Bridge.smooth((model.phaseTime - CFG.introTruckHoldTime) / CFG.introCameraPanTime);
      return mix(worldYForScreen(screenHeight() * 1.16), playerAnchorY(), entry);
    }
    // В финале координата остаётся частью мира: камера видит рывок к обрыву.
    if (Bridge.active(model)) return Bridge.playerScreenY(model, screenHeight());
    return playerAnchorY();
  }
  function playerScreenX(model) { return roadCenter(model, playerScreenY(model)) + model.playerX; }

  /** Камера расширяет обзор при отставании и исполняет монтаж мостовой катсцены. */
  function camera(model) {
    const px = playerScreenX(model), py = playerScreenY(model), tx = truckX(model), ty = truckY(model);
    if (model.phase === 'TRUCK_INTRO') {
      const progress = Bridge.smooth((model.phaseTime - CFG.introTruckHoldTime) / CFG.introCameraPanTime);
      return {zoom: baseZoom(), targetX: mix(tx, px, progress), targetY: mix(ty, py, progress),
        anchorX: screenWidth() / 2, anchorY: mix(screenHeight() * .46, playerAnchorY(), progress)};
    }
    if (Bridge.active(model)) return Bridge.camera(model, {baseZoom: baseZoom(), width: screenWidth(),
      height: screenHeight(), playerAnchorY: playerAnchorY(), playerX: px, playerY: py, truckX: tx, truckY: ty});
    const pull = model.phase === 'CHASE' ? model.cameraPull : 0;
    const pose = {zoom: mix(baseZoom(), CFG.chaseFarCameraZoom, pull),
      targetX: mix(px, tx, pull * .34), targetY: mix(py, ty, pull * .34),
      anchorX: screenWidth() / 2, anchorY: playerAnchorY()};
    model.chaseCameraPose = pose;
    return pose;
  }

  /** Создаёт чистое состояние миссии. */
  function create(random) {
    return {
      phase: 'TRUCK_INTRO', phaseTime: 0, elapsed: 0,
      distance: CFG.startDistance, distanceZone: 'YELLOW', lastDistanceZone: 'YELLOW', redTimer: 0, greenTimer: 0,
      playerX: 0, steerVisual: 0, playerSpeed: CFG.truckBaseSpeed,
      maxHp: CFG.playerMaxHp, hp: CFG.playerMaxHp, damageCooldown: 0,
      speedPenalty: 1, penaltyTime: 0, penaltyDuration: 0, penaltyStart: 1, lateralVelocity: 0,
      truckSpeed: CFG.truckBaseSpeed, truckLane: 0, truckLaneTarget: 0,
      laneTimer: randomBetween(CFG.truckLaneChangeMin, CFG.truckLaneChangeMax, random),
      spawnTimer: CFG.pressureLearnMin, pendingDrops: [], waveIndex: 0, pressureStage: 'LEARN',
      barrels: [], bullets: [], fireTimer: 0, weaponHeat: 0, weaponOverheatTime: 0,
      nitroTime: 0, nitroCooldown: 0, scroll: 0, shake: 0, flash: 0,
      barrelsDestroyed: 0, closeCalls: 0, feedback: '', feedbackTime: 0, nitroHeld: false,
      cameraPull: 0, bridgeCollapse: 0, bridgeDrift: 0, bridgeStartX: 0, bridgeDriftSide: -1,
      bridgePlayerOffsetY: 0, bridgePlayerAdvance: 0, bridgeTruckTravel: 0,
      bridgeBrake: 0, bridgeSlip: 0, bridgeSkid: 0, bridgeNoseDive: 0, bridgeSmoke: 0,
      bridgeStartSpeed: 0, bridgeBrakeStartSpeed: 0, bridgeGapY: 0,
      bridgeSkidTrail: [], bridgeBlastEvents: [], bridgeTrailTimer: 0,
      bridgeBlastTime: 0, bridgeBlastStage: 0, bridgeCinematicTime: 0,
      pause: false, failedChoice: 0, failedReason: '', comicIndex: 0, nextId: 1,
      lastGt: typeof gt === 'number' ? gt : 0
    };
  }

  /** Грузовик держит постоянную скорость и не использует скрытый rubber band. */
  function truckTargetSpeed() {
    return CFG.truckBaseSpeed;
  }

  /** Переводит заднюю точку повёрнутого грузовика в координаты мира. */
  function barrelSpawnPoint(model, lane) {
    const y = truckY(model), x = truckX(model), angle = roadHeading(model, y);
    const side = lane * TRUCK_BARREL_LANE;
    return {x: x + Math.cos(angle) * TRUCK_REAR_OFFSET - Math.sin(angle) * side,
      y: y + Math.sin(angle) * TRUCK_REAR_OFFSET + Math.cos(angle) * side};
  }

  /** Сбрасывает бочку строго с задней кромки PitterMAX. */
  function spawnBarrel(model, lane, targetOffset) {
    const point = barrelSpawnPoint(model, lane);
    model.barrels.push({id: model.nextId++, x: point.x, y: point.y, age: 0,
      startOffset: point.x - roadCenter(model, point.y),
      targetOffset: Number.isFinite(targetOffset) ? targetOffset : lane * (roadHalfWidth() - 29),
      health: CFG.barrelHealth, state: 'ROLL', explosionTime: 0, hitPlayer: false});
  }

  /** Удар сразу отнимает скорость; лёгкий взрыв не превращается в полный штраф на следующем кадре. */
  function speedImpact(model, multiplier, duration) {
    model.playerSpeed *= multiplier;
    model.penaltyStart = Math.min(model.speedPenalty, multiplier);
    model.speedPenalty = model.penaltyStart;
    model.penaltyDuration = Math.max(model.penaltyTime, duration);
    model.penaltyTime = model.penaltyDuration;
  }

  /** Наносит корпусу урон и защищает от мгновенной серии взрывов. */
  function damagePlayer(model, amount) {
    if (model.damageCooldown > 0 || model.phase !== 'CHASE') return false;
    model.hp = Math.max(0, model.hp - amount);
    model.damageCooldown = CFG.barrelDamageCooldown;
    model.flash = Math.max(model.flash, .8);
    if (model.hp <= 0) {
      model.phase = 'FAILED'; model.phaseTime = 0; model.failedReason = 'WRECKED';
    }
    return true;
  }

  /** Взрывает бочку, применяя урон и сброс скорости. */
  function explode(model, barrel, direct) {
    if (!barrel || barrel.state === 'EXPLOSION') return;
    barrel.state = 'EXPLOSION'; barrel.explosionTime = 0;
    if (typeof sBoom === 'function') sBoom();
    if (direct) {
      barrel.hitPlayer = true;
      speedImpact(model, CFG.barrelHitSpeedMultiplier, CFG.barrelSpeedRecoveryTime);
      model.feedback = 'УДАР! ВОССТАНОВИ СКОРОСТЬ'; model.feedbackTime = 1.4;
      const side = Math.sign(playerScreenX(model) - barrel.x) || 1;
      model.lateralVelocity = side * CFG.barrelImpactSlide;
      model.shake = Math.max(model.shake, 1);
      damagePlayer(model, CFG.barrelHitDamage);
      if (typeof carImpactPlay === 'function') carImpactPlay('collision', null, .82, { local: true });
      else if (typeof sHit === 'function') sHit();
      return;
    }
    const near = Math.hypot(playerScreenX(model) - barrel.x, playerScreenY(model) - barrel.y) <= CFG.barrelNearRadius;
    model.barrelsDestroyed += 1;
    if (!near) { model.feedback = 'ПУТЬ СВОБОДЕН'; model.feedbackTime = .8; }
    if (near) {
      speedImpact(model, CFG.barrelNearSpeedMultiplier, CFG.barrelSpeedRecoveryTime * .45);
      model.shake = Math.max(model.shake, .32);
      damagePlayer(model, CFG.barrelNearDamage);
    }
  }

  /** Выпускает пулю из машины игрока. */
  function fire(model) {
    if (!model || model.phase !== 'CHASE' || model.pause || model.fireTimer > 0 || model.weaponOverheatTime > 0) return false;
    model.fireTimer = CFG.shotCooldown;
    model.bullets.push({x: playerScreenX(model), y: playerScreenY(model) - 20, life: 1.35});
    model.weaponHeat = Math.min(1, model.weaponHeat + CFG.weaponHeatPerShot);
    if (model.weaponHeat >= 1) {
      model.weaponHeat = 0;
      model.weaponOverheatTime = CFG.weaponOverheatTime;
    }
    if (typeof sShoot === 'function') sShoot();
    return true;
  }

  /** Вычисляет высоту псевдофизического отскока. */
  function barrelBounce(barrel) {
    let time = barrel.age;
    for (let i = 0; i < Math.min(CFG.barrelBounceCount, BOUNCE_SPANS.length); i++) {
      if (time <= BOUNCE_SPANS[i]) return {height: Math.sin(time / BOUNCE_SPANS[i] * Math.PI) *
        34 * Math.pow(CFG.barrelBounceDecay, i), index: i};
      time -= BOUNCE_SPANS[i];
    }
    return {height: 0, index: CFG.barrelBounceCount};
  }

  /** Обновляет бочки, пули и интервал сброса. */
  function updateBarrels(model, dt, random) {
    Pressure.updateQueue(model, dt, spawnBarrel);
    const px = playerScreenX(model), py = playerScreenY(model);
    model.bullets.forEach(function (bullet) {
      bullet.previousY = bullet.y; bullet.y -= CFG.shotSpeed * dt; bullet.life -= dt;
    });
    for (let i = model.barrels.length - 1; i >= 0; i--) {
      const barrel = model.barrels[i]; barrel.age += dt;
      if (barrel.state === 'EXPLOSION') {
        barrel.explosionTime += dt;
        if (barrel.explosionTime >= 8 / CFG.explosionFrameRate) model.barrels.splice(i, 1);
        continue;
      }
      const previousY = barrel.y;
      barrel.y += mix(64, CFG.barrelRollSpeed + model.playerSpeed * 32, clamp(barrel.age / .55, 0, 1)) * dt;
      if (Number.isFinite(barrel.targetOffset)) {
        barrel.x = roadCenter(model, barrel.y) + mix(barrel.startOffset, barrel.targetOffset,
          Bridge.smooth(barrel.age / CFG.barrelSpreadTime));
      }
      for (let j = model.bullets.length - 1; j >= 0; j--) {
        const bullet = model.bullets[j];
        if (Math.abs(bullet.x - barrel.x) < 20 && bullet.y - barrel.y <= 22 &&
          bullet.previousY - previousY >= -22) {
          model.bullets.splice(j, 1); barrel.health -= 1;
          if (barrel.health <= 0) explode(model, barrel, false);
          break;
        }
      }
      if (barrel.state !== 'ROLL') continue;
      if (Math.abs(px - barrel.x) < CFG.barrelCollisionRadius && Math.abs(py - barrel.y) < 36) explode(model, barrel, true);
      else if (!barrel.passed && previousY <= py + 36 && barrel.y > py + 36) {
        barrel.passed = true;
        if (Math.abs(px - barrel.x) < CFG.barrelCollisionRadius + 22) {
          model.closeCalls += 1; model.feedback = 'ЧИСТЫЙ МАНЁВР'; model.feedbackTime = .85;
        }
      }
      else if (barrel.y > screenHeight() + 90) model.barrels.splice(i, 1);
    }
    for (let i = model.bullets.length - 1; i >= 0; i--) {
      const bullet = model.bullets[i];
      if (bullet.life <= 0 || bullet.y < -30) model.bullets.splice(i, 1);
    }
    model.spawnTimer -= dt;
    if (model.spawnTimer <= 0) {
      Pressure.schedule(model, random, spawnBarrel);
      model.spawnTimer = Pressure.nextInterval(model, random);
    }
  }

  /** Делает один шаг симуляции миссии. */
  function step(model, input, dt, random) {
    if (!model || model.pause || model.phase === 'FAILED' || model.phase === 'COMIC') return model;
    dt = clamp(Number(dt) || 0, 0, .05); model.phaseTime += dt;
    model.shake = Math.max(0, model.shake - dt * 4.2); model.flash = Math.max(0, model.flash - dt * 3.4);
    model.fireTimer = Math.max(0, model.fireTimer - dt); model.nitroTime = Math.max(0, model.nitroTime - dt);
    model.nitroCooldown = Math.max(0, model.nitroCooldown - dt);
    model.weaponOverheatTime = Math.max(0, model.weaponOverheatTime - dt);
    model.damageCooldown = Math.max(0, model.damageCooldown - dt);
    model.feedbackTime = Math.max(0, model.feedbackTime - dt);
    model.lateralVelocity = approach(model.lateralVelocity, 0, dt * 72);
    if (model.phase === 'TRUCK_INTRO') {
      const total = CFG.introTruckHoldTime + CFG.introCameraPanTime;
      model.scroll += mix(250, 360, model.phaseTime / total) * dt;
      if (model.phaseTime >= total) { model.phase = 'CHASE_START'; model.phaseTime = 0; }
      return model;
    }
    if (model.phase === 'CHASE_START') {
      model.scroll += 310 * dt;
      if (model.phaseTime >= CFG.chaseStartTime) { model.phase = 'CHASE'; model.phaseTime = 0; }
      return model;
    }
    if (Bridge.active(model)) {
      camera(model);
      Bridge.step(model, dt);
      if (Bridge.active(model)) camera(model);
      return model;
    }
    if (model.phase !== 'CHASE') return model;
    model.elapsed += dt;
    const throttle = clamp(input && input.throttle || 0, -1, 1);
    const steer = clamp(input && input.steer || 0, -1, 1);
    if (model.weaponOverheatTime <= 0 && !(input && input.fire)) {
      model.weaponHeat = Math.max(0, model.weaponHeat - CFG.weaponHeatCoolRate * dt);
    }
    model.steerVisual = approach(model.steerVisual, steer, dt * 5.5);
    if (input && input.nitro && !model.nitroHeld && model.nitroCooldown <= 0) {
      model.nitroTime = CFG.nitroDuration; model.nitroCooldown = CFG.nitroCooldown;
      if (typeof swp === 'function') swp('sawtooth', 150, 500, .4, .2);
    }
    model.nitroHeld = !!(input && input.nitro);
    let target = throttle > .05 ? mix(CFG.playerCoastSpeed, CFG.playerMaxSpeed, throttle) :
      throttle < -.05 ? mix(CFG.playerCoastSpeed, CFG.playerBrakeSpeed, -throttle) : CFG.playerCoastSpeed;
    if (model.penaltyTime > 0) {
      model.penaltyTime = Math.max(0, model.penaltyTime - dt);
      model.speedPenalty = mix(model.penaltyStart, 1,
        1 - model.penaltyTime / Math.max(.01, model.penaltyDuration));
    } else model.speedPenalty = 1;
    target *= model.speedPenalty;
    if (model.nitroTime > 0) target *= CFG.nitroSpeedMultiplier;
    model.playerSpeed = approach(model.playerSpeed, target, CFG.playerAcceleration * dt);
    model.truckSpeed = approach(model.truckSpeed, truckTargetSpeed(model), CFG.truckAcceleration * dt);
    model.distance = clamp(model.distance + (model.truckSpeed - model.playerSpeed) * CFG.distanceSpeedScale * dt,
      CFG.minDistance, CFG.maxDistance);
    const distancePull = clamp((model.distance - CFG.startDistance) /
      Math.max(1, CFG.redZoneDistance - CFG.startDistance), 0, 1);
    const brakePull = clamp((model.truckSpeed - model.playerSpeed) / .34, 0, 1);
    model.cameraPull = approach(model.cameraPull, Math.max(distancePull, brakePull), CFG.chaseCameraPullSpeed * dt);
    model.scroll += model.playerSpeed * 430 * dt;
    model.playerX += (steer * CFG.playerSteerSpeed + model.lateralVelocity) * dt;
    model.playerX = clamp(model.playerX, -roadHalfWidth() + 24, roadHalfWidth() - 24);
    model.laneTimer -= dt;
    if (model.laneTimer <= 0) {
      model.truckLaneTarget = Math.floor((random || Math.random)() * 3) - 1;
      model.laneTimer = randomBetween(CFG.truckLaneChangeMin, CFG.truckLaneChangeMax, random);
    }
    if (!model.pendingDrops.length) model.truckLane = approach(model.truckLane, model.truckLaneTarget, CFG.laneChangeSpeed * dt);
    const nextZone = zone(model.distance);
    Pressure.enterZone(model, model.distanceZone, nextZone);
    model.lastDistanceZone = model.distanceZone;
    model.distanceZone = nextZone;
    if (input && input.fire) fire(model);
    updateBarrels(model, dt, random);
    if (model.phase === 'FAILED') return model;
    if (model.distanceZone === 'RED') {
      model.redTimer += dt; model.greenTimer = 0;
      if (model.redTimer >= CFG.redZoneTime) { model.phase = 'FAILED'; model.phaseTime = 0; model.failedReason = 'ESCAPED'; }
    } else if (model.distanceZone === 'GREEN') {
      model.greenTimer += dt; model.redTimer = 0;
      if (model.greenTimer >= CFG.greenZoneTime) {
        Bridge.begin(model, roadHalfWidth(), {truckY: truckY(model), playerY: playerScreenY(model), camera: camera(model)});
      }
    } else { model.redTimer = 0; model.greenTimer = 0; }
    return model;
  }

  global.RnRStoryChaseModel = {clamp, mix, zone, trackSettings, screenWidth, screenHeight,
    baseZoom, playerAnchorY, roadCenter, roadHeading, truckX, truckY, playerScreenX, playerScreenY,
    camera, create, step, fire, explode, barrelBounce, barrelSpawnPoint};
})(typeof window !== 'undefined' ? window : globalThis);
