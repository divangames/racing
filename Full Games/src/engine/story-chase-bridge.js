// Игровая катсцена моста: физический занос, пролёт через разрыв и уход PitterMAX.
(function (global) {
  'use strict';

  const CFG = global.MISSION_01;
  if (!CFG) return;
  const PHASES = [
    'BRIDGE_APPROACH', 'BRIDGE_COLLAPSE', 'BRAKE_HIT', 'DRIFT_STOP', 'DRIFT_SETTLE',
    'PLAYER_CLOSEUP', 'SEPARATION_SHOT', 'GAP_TRAVERSE', 'TRUCK_FOCUS',
    'TRUCK_ESCAPE', 'AFTERMATH_RETURN'
  ];
  const BOOM_CUES = [0, .11, .26];
  const TRAIL_SAMPLE_TIME = .025;

  /** Ограничивает значение заданным диапазоном. */
  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  /** Плавно смешивает два значения. */
  function mix(from, to, progress) {
    return from + (to - from) * clamp(progress, 0, 1);
  }

  /** Кубическая кривая без рывка в начале и конце. */
  function smooth(progress) {
    const value = clamp(progress, 0, 1);
    return value * value * (3 - 2 * value);
  }

  /** Более мягкая кривая для длинных операторских проездов. */
  function smoother(progress) {
    const value = clamp(progress, 0, 1);
    return value * value * value * (value * (value * 6 - 15) + 10);
  }

  /** Быстрое торможение с мягким окончанием. */
  function outCubic(progress) {
    const value = 1 - clamp(progress, 0, 1);
    return 1 - value * value * value;
  }

  /** Резкий боковой срыв с затухающим окончанием. */
  function outQuart(progress) {
    const value = 1 - clamp(progress, 0, 1);
    return 1 - value * value * value * value;
  }

  /** Ведёт значение к цели с ограниченной скоростью. */
  function approach(value, target, amount) {
    return value < target ? Math.min(target, value + amount) : Math.max(target, value - amount);
  }

  /** Проверяет, находится ли миссия внутри мостовой катсцены. */
  function active(model) {
    return !!model && PHASES.indexOf(model.phase) >= 0;
  }

  /** Восстанавливает служебные поля при запуске прямо из редактора главы. */
  function ensureState(model) {
    if (!Number.isFinite(model.bridgeTruckTravel)) model.bridgeTruckTravel = 0;
    if (!Number.isFinite(model.bridgePlayerAdvance)) model.bridgePlayerAdvance = 0;
    if (!Number.isFinite(model.bridgeCollapse)) model.bridgeCollapse = 0;
    if (!Number.isFinite(model.bridgeDrift)) model.bridgeDrift = 0;
    if (!Number.isFinite(model.bridgeBlastTime)) model.bridgeBlastTime = 0;
    if (!Number.isFinite(model.bridgeBlastStage)) model.bridgeBlastStage = 0;
    if (!Number.isFinite(model.bridgeCinematicTime)) model.bridgeCinematicTime = 0;
    if (!Number.isFinite(model.bridgeDriftSide) || !model.bridgeDriftSide) {
      model.bridgeDriftSide = model.playerX > 6 ? -1 : model.playerX < -6 ? 1 : -1;
    }
    if (!Number.isFinite(model.bridgeRoadHalfWidth)) model.bridgeRoadHalfWidth = CFG.roadHalfWidth;
    if (!Number.isFinite(model.bridgeDriftTargetX)) {
      model.bridgeDriftTargetX = clamp(model.playerX + model.bridgeDriftSide * CFG.bridgeDriftOffset,
        -(model.bridgeRoadHalfWidth - 28), model.bridgeRoadHalfWidth - 28);
    }
    if (!model.bridgeBlastEvents) model.bridgeBlastEvents = [];
    if (!model.bridgeSkidTrail) model.bridgeSkidTrail = [];
    if (!Number.isFinite(model.bridgeTrailTimer)) model.bridgeTrailTimer = 0;
  }

  /** Возвращает длительность монтажной фазы из живого конфига главы. */
  function phaseDuration(phase) {
    const durations = {
      BRIDGE_APPROACH: CFG.bridgeApproachTime,
      BRIDGE_COLLAPSE: CFG.bridgeCollapseTime,
      BRAKE_HIT: CFG.bridgeBrakeSnapTime,
      DRIFT_STOP: CFG.bridgeDriftTime,
      DRIFT_SETTLE: CFG.bridgeSettleTime,
      PLAYER_CLOSEUP: CFG.bridgePlayerCloseTime,
      SEPARATION_SHOT: CFG.bridgeSeparationTime,
      GAP_TRAVERSE: CFG.bridgeTraverseTime,
      TRUCK_FOCUS: CFG.bridgeTruckPanTime,
      TRUCK_ESCAPE: CFG.bridgeEscapeTime,
      AFTERMATH_RETURN: CFG.bridgeReturnTime
    };
    return Math.max(.01, Number(durations[phase]) || .01);
  }

  /** Копирует позу камеры, чтобы следующий план начинался без скачка. */
  function copyPose(pose) {
    if (!pose) return null;
    return {zoom: pose.zoom, targetX: pose.targetX, targetY: pose.targetY,
      anchorX: pose.anchorX, anchorY: pose.anchorY, rotation: pose.rotation || 0};
  }

  /** Запускает катсцену после честного удержания зелёной зоны. */
  function begin(model, roadHalfWidth, frame) {
    const h = typeof H === 'number' ? H : 720;
    const start = frame || {truckY: h * .12, playerY: h * .56, camera: model.chaseCameraPose};
    model.phase = 'BRIDGE_APPROACH';
    model.phaseTime = 0;
    model.bridgeCollapse = 0;
    model.bridgeDrift = 0;
    model.bridgeSlip = 0;
    model.bridgeBrake = 0;
    model.bridgePlayerAdvance = 0;
    model.bridgeTruckTravel = 0;
    model.bridgeStartTruckY = start.truckY;
    model.bridgeStartPlayerY = start.playerY;
    model.bridgeStopY = start.playerY - CFG.bridgePlayerAdvance;
    model.bridgeGapBottom = model.bridgeStopY - CFG.bridgeStopMargin;
    model.bridgeRoadScroll = model.scroll;
    model.bridgeBlastTime = 0;
    model.bridgeBlastStage = 0;
    model.bridgeCinematicTime = 0;
    model.bridgeBlastStarted = false;
    model.bridgeBlastEvents = [];
    model.bridgeSkidTrail = [];
    model.bridgeTrailTimer = 0;
    model.bridgeStartX = model.playerX;
    model.bridgeDriftSide = model.playerX > 6 ? -1 : model.playerX < -6 ? 1 : -1;
    model.bridgeRoadHalfWidth = Math.max(70, Number(roadHalfWidth) || CFG.roadHalfWidth);
    model.bridgeDriftTargetX = clamp(model.bridgeStartX + model.bridgeDriftSide * CFG.bridgeDriftOffset,
      -(model.bridgeRoadHalfWidth - 28), model.bridgeRoadHalfWidth - 28);
    model.bridgeCameraPose = copyPose(start.camera);
    model.bridgeCameraFrom = copyPose(start.camera);
    model.bridgeEscapeLock = null;
    model.nitroTime = 0;
    model.bridgeSkid = 0; model.bridgeSmoke = 0;
    if (model.barrels) model.barrels.length = 0;
    if (model.bullets) model.bullets.length = 0;
    if (model.pendingDrops) model.pendingDrops.length = 0;
  }

  /** Переводит катсцену в следующий монтажный план и сохраняет непрерывность камеры. */
  function enter(model, phase) {
    model.bridgeCameraFrom = copyPose(model.bridgeCameraPose);
    model.phase = phase;
    model.phaseTime = 0;
    if (phase === 'BRIDGE_COLLAPSE') {
      model.bridgeBlastStarted = true;
      model.bridgeBlastTime = 0;
      model.bridgeBlastStage = 0;
    }
    if (phase === 'BRAKE_HIT') {
      model.bridgeBrakeStartSpeed = model.playerSpeed;
      model.bridgeBrakeStartX = model.playerX;
    }
    if (phase === 'DRIFT_STOP') {
      model.bridgeDriftStartSpeed = model.playerSpeed;
      model.bridgeDriftStartX = model.playerX;
      model.bridgeDriftStartAdvance = model.bridgePlayerAdvance;
    }
    if (phase === 'DRIFT_SETTLE') model.bridgeSettleStartSpeed = model.playerSpeed;
    if (phase === 'TRUCK_ESCAPE') model.bridgeEscapeLock = null;
  }

  /** Старит события обрушения и удаляет закончившиеся частицы. */
  function ageEffects(model, dt) {
    const events = model.bridgeBlastEvents || (model.bridgeBlastEvents = []);
    events.forEach(function (event) { event.age += dt; });
    for (let index = events.length - 1; index >= 0; index--) {
      if (events[index].age > CFG.bridgeBlastVisualTime) events.splice(index, 1);
    }
    const trail = model.bridgeSkidTrail || (model.bridgeSkidTrail = []);
    trail.forEach(function (sample) { sample.age += dt; });
    while (trail.length > 96 || trail.length && trail[0].age > 12) trail.shift();
  }

  /** Создаёт независимые удары разрушения у разных опор моста. */
  function updateBlast(model) {
    while (model.bridgeBlastStage < BOOM_CUES.length &&
      model.phaseTime >= BOOM_CUES[model.bridgeBlastStage]) {
      const stage = model.bridgeBlastStage++;
      model.bridgeBlastEvents.push({id: stage, age: 0, side: stage - 1,
        power: 1 - stage * .12});
      model.shake = Math.max(model.shake || 0, 1.55 - stage * .17);
      model.flash = Math.max(model.flash || 0, 1.08 - stage * .18);
      if (!model.cinematicSeeking && typeof sBoom === 'function') sBoom();
    }
  }

  /** Запоминает настоящую дугу задней оси, а не прямые линии под машиной. */
  function sampleSkidTrail(model, dt, strength) {
    model.bridgeTrailTimer = (model.bridgeTrailTimer || 0) + dt;
    while (model.bridgeTrailTimer >= TRAIL_SAMPLE_TIME) {
      model.bridgeTrailTimer -= TRAIL_SAMPLE_TIME;
      model.bridgeSkidTrail.push({x: model.playerX, yOffset: -model.bridgePlayerAdvance,
        scroll: model.scroll, angle: model.bridgeDrift, strength: clamp(strength, 0, 1), age: 0});
    }
  }

  /** Интегрирует относительное удаление грузовика и движение полотна. */
  function integrateTravel(model, dt) {
    model.truckSpeed = CFG.truckBaseSpeed;
    const relativeSpeed = Math.max(0, model.truckSpeed - model.playerSpeed);
    model.bridgeTruckTravel += relativeSpeed * CFG.bridgeTruckTravelSpeed * dt;
    model.distance += relativeSpeed * CFG.distanceSpeedScale * dt;
    model.scroll += model.playerSpeed * 390 * dt;
  }

  /** Обновляет физику торможения, заноса и последовательность монтажных планов. */
  function step(model, dt) {
    dt = clamp(Number(dt) || 0, 0, .05);
    ensureState(model);
    model.bridgeCinematicTime += dt;
    ageEffects(model, dt);
    const progress = clamp(model.phaseTime / phaseDuration(model.phase), 0, 1);
    const side = model.bridgeDriftSide || -1;

    if (model.phase === 'BRIDGE_APPROACH') {
      model.playerSpeed = approach(model.playerSpeed, CFG.truckBaseSpeed, dt * .45);
      model.bridgeBrake = 0;
      if (progress >= 1) enter(model, 'BRIDGE_COLLAPSE');
    } else if (model.phase === 'BRIDGE_COLLAPSE') {
      model.bridgeBlastStarted = true;
      model.playerSpeed = approach(model.playerSpeed, CFG.truckBaseSpeed, dt * .3);
      model.bridgeCollapse = mix(0, .16, smooth(progress));
      updateBlast(model);
      if (progress >= 1) enter(model, 'BRAKE_HIT');
    } else if (model.phase === 'BRAKE_HIT') {
      const brake = outCubic(progress);
      model.bridgeBrake = brake;
      model.playerSpeed = mix(model.bridgeBrakeStartSpeed || CFG.truckBaseSpeed,
        CFG.truckBaseSpeed * .56, brake);
      model.bridgeCollapse = mix(.16, .44, smooth(progress));
      model.bridgeDrift = side * mix(0, .20, smooth(progress));
      const brakeX = Number.isFinite(model.bridgeBrakeStartX) ? model.bridgeBrakeStartX : model.playerX;
      model.playerX = mix(brakeX, brakeX + side * 4, outQuart(progress));
      model.bridgePlayerAdvance = mix(0, 4, brake);
      model.bridgeSlip = mix(.12, .58, smooth(progress));
      model.steerVisual = mix(0, -side * .42, smooth(progress));
      model.shake = Math.max(model.shake, Math.sin(progress * Math.PI) * .5);
      sampleSkidTrail(model, dt, model.bridgeSlip);
      if (progress >= 1) enter(model, 'DRIFT_STOP');
    } else if (model.phase === 'DRIFT_STOP') {
      const driftSpeed = Number.isFinite(model.bridgeDriftStartSpeed) ?
        model.bridgeDriftStartSpeed : CFG.truckBaseSpeed * .56;
      const driftX = Number.isFinite(model.bridgeDriftStartX) ? model.bridgeDriftStartX : model.playerX;
      const driftAdvance = Number.isFinite(model.bridgeDriftStartAdvance) ? model.bridgeDriftStartAdvance : 4;
      model.bridgeBrake = 1;
      model.playerSpeed = mix(driftSpeed, .04, outCubic(progress));
      model.bridgeCollapse = mix(.44, 1, smooth(clamp(progress / .78, 0, 1)));
      model.bridgeDrift = side * mix(.20, CFG.bridgeDriftPeakAngle, smoother(progress));
      model.playerX = mix(driftX, model.bridgeDriftTargetX, outQuart(progress));
      model.bridgePlayerAdvance = mix(driftAdvance, CFG.bridgePlayerAdvance, outCubic(progress));
      model.bridgeSlip = Math.sin(progress * Math.PI * .82) * .38 + .62;
      model.steerVisual = mix(-side * .42, -side * .78, smooth(clamp(progress * 1.7, 0, 1)));
      sampleSkidTrail(model, dt, model.bridgeSlip);
      if (progress >= 1) enter(model, 'DRIFT_SETTLE');
    } else if (model.phase === 'DRIFT_SETTLE') {
      const oscillation = Math.exp(-5 * progress) * Math.cos(progress * Math.PI * 2.6);
      model.playerSpeed = mix(model.bridgeSettleStartSpeed || .04, 0, outCubic(progress));
      model.bridgeCollapse = 1;
      model.bridgeDrift = side * (CFG.bridgeDriftAngle +
        (CFG.bridgeDriftPeakAngle - CFG.bridgeDriftAngle) * oscillation);
      model.playerX = mix(model.bridgeDriftTargetX, model.bridgeDriftTargetX - side * 3, smooth(progress));
      model.bridgePlayerAdvance = CFG.bridgePlayerAdvance;
      model.bridgeSlip = 1 - outCubic(progress);
      model.steerVisual = mix(-side * .78, -side * .18, smooth(progress));
      sampleSkidTrail(model, dt, model.bridgeSlip);
      if (progress >= 1) enter(model, 'PLAYER_CLOSEUP');
    } else {
      model.playerSpeed = approach(model.playerSpeed, 0, dt * 2.4);
      model.bridgeCollapse = 1;
      model.bridgeDrift = side * CFG.bridgeDriftAngle;
      model.bridgeSlip = 0;
      model.bridgeBrake = 1;
      model.bridgePlayerAdvance = CFG.bridgePlayerAdvance;
      model.steerVisual = approach(model.steerVisual, 0, dt * .8);
      const next = {
        PLAYER_CLOSEUP: 'SEPARATION_SHOT', SEPARATION_SHOT: 'GAP_TRAVERSE',
        GAP_TRAVERSE: 'TRUCK_FOCUS', TRUCK_FOCUS: 'TRUCK_ESCAPE',
        TRUCK_ESCAPE: 'AFTERMATH_RETURN', AFTERMATH_RETURN: 'COMIC'
      };
      if (progress >= 1 && next[model.phase]) {
        enter(model, next[model.phase]);
        if (model.phase === 'COMIC') model.comicIndex = 0;
      }
    }
    if (model.bridgeBlastStarted) model.bridgeBlastTime += dt;
    integrateTravel(model, dt);
    // Полотно раскрывается вслед за задней осью PitterMAX. Ни одна секция не исчезает под ним.
    const clearance = (model.bridgeGapBottom - truckScreenY(model, typeof H === 'number' ? H : 720) - 94) /
      Math.max(1, CFG.bridgeGapLength);
    model.bridgeCollapse = Math.min(model.bridgeCollapse, clamp(clearance, 0, 1));
  }

  /** Возвращает экранную высоту грузовика с непрерывным физическим удалением. */
  function truckScreenY(model, height) {
    const start = Number.isFinite(model.bridgeStartTruckY) ? model.bridgeStartTruckY : height * .12;
    return start - (model.bridgeTruckTravel || 0);
  }

  /** Возвращает высоту Мьёльнира с реальным продвижением к кромке. */
  function playerScreenY(model, height) {
    return (Number.isFinite(model.bridgeStartPlayerY) ? model.bridgeStartPlayerY : height * .56) -
      (model.bridgePlayerAdvance || 0);
  }

  /** Возвращает мировую линию разрыва между PitterMAX и точкой остановки. */
  function gapScreenY(model, height) {
    const bottom = Number.isFinite(model.bridgeGapBottom) ? model.bridgeGapBottom :
      height * .56 - CFG.bridgePlayerAdvance - CFG.bridgeStopMargin;
    return bottom - CFG.bridgeGapLength * (model.bridgeCollapse || 0) * .52;
  }

  /** Смешивает две полные позы камеры. */
  function blendPose(from, to, progress) {
    return {zoom: mix(from.zoom, to.zoom, progress),
      targetX: mix(from.targetX, to.targetX, progress), targetY: mix(from.targetY, to.targetY, progress),
      anchorX: mix(from.anchorX, to.anchorX, progress), anchorY: mix(from.anchorY, to.anchorY, progress),
      rotation: mix(from.rotation || 0, to.rotation || 0, progress)};
  }

  /** Квадратичная кривая операторского пролёта через разрыв. */
  function quadratic(from, control, to, progress) {
    const inverse = 1 - progress;
    return inverse * inverse * from + 2 * inverse * progress * control + progress * progress * to;
  }

  /** Фиксирует вычисленную позу как точный старт следующего плана. */
  function rememberCamera(model, pose) {
    pose.roll = pose.rotation || 0;
    model.bridgeCameraPose = copyPose(pose);
    return pose;
  }

  /** Создаёт непрерывную кинематографическую камеру без монтажных телепортаций. */
  function camera(model, frame) {
    const phase = model.phase, progress = clamp(model.phaseTime / phaseDuration(phase), 0, 1);
    const eased = smoother(progress), centerX = frame.width / 2;
    const roadPose = {zoom: frame.baseZoom, targetX: frame.playerX, targetY: frame.playerY,
      anchorX: centerX, anchorY: frame.playerAnchorY, rotation: 0};
    const bothX = mix(frame.playerX, frame.truckX, .48);
    const bothY = mix(frame.playerY, frame.truckY, .48);
    // Длинный PitterMAX целиком помещается в общем плане вместе с остановившейся машиной.
    const fitZoom = Math.min(CFG.bridgeSeparationZoom, frame.height * .73 /
      Math.max(160, frame.playerY - frame.truckY + 140));
    const gapY = gapScreenY(model, frame.height);
    const gapX = mix(frame.playerX, frame.truckX, .5);
    const side = model.bridgeDriftSide || -1;
    let from = model.bridgeCameraFrom || roadPose;
    let target;

    if (phase === 'BRIDGE_APPROACH') {
      target = {zoom: CFG.bridgeWideZoom, targetX: bothX, targetY: bothY,
        anchorX: centerX, anchorY: frame.height * .5, rotation: 0};
    } else if (phase === 'BRIDGE_COLLAPSE') {
      from = model.bridgeCameraFrom || {zoom: CFG.bridgeWideZoom, targetX: bothX, targetY: bothY,
        anchorX: centerX, anchorY: frame.height * .5, rotation: 0};
      target = {zoom: CFG.bridgeWideZoom, targetX: bothX, targetY: bothY,
        anchorX: centerX, anchorY: frame.height * .5,
        rotation: Math.sin(progress * Math.PI * 3) * CFG.bridgeCameraTilt * .28 * (1 - progress)};
    } else if (phase === 'BRAKE_HIT') {
      target = {zoom: CFG.bridgeBrakeZoom, targetX: frame.playerX, targetY: mix(frame.playerY, gapY, .22),
        anchorX: centerX, anchorY: frame.height * .59,
        rotation: -side * CFG.bridgeCameraTilt * .45 * Math.sin(progress * Math.PI)};
    } else if (phase === 'DRIFT_STOP') {
      target = {zoom: CFG.bridgePlayerZoom * .9, targetX: frame.playerX, targetY: frame.playerY,
        anchorX: centerX, anchorY: frame.height * .6,
        rotation: -side * CFG.bridgeCameraTilt * Math.sin(progress * Math.PI)};
    } else if (phase === 'DRIFT_SETTLE' || phase === 'PLAYER_CLOSEUP') {
      target = {zoom: CFG.bridgePlayerZoom, targetX: frame.playerX, targetY: frame.playerY,
        anchorX: centerX, anchorY: frame.height * .61,
        rotation: phase === 'DRIFT_SETTLE' ? -side * CFG.bridgeCameraTilt * .24 * (1 - eased) : 0};
    } else if (phase === 'SEPARATION_SHOT') {
      target = {zoom: fitZoom, targetX: bothX, targetY: bothY,
        anchorX: centerX, anchorY: frame.height * .5, rotation: 0};
      // Быстро раскрываем географию, затем держим обе стороны разрыва в одном плане.
      return rememberCamera(model, blendPose(from, target, smoother(progress / .65)));
    } else if (phase === 'GAP_TRAVERSE') {
      const start = model.bridgeCameraFrom || {zoom: fitZoom,
        targetX: bothX, targetY: bothY, anchorX: centerX, anchorY: frame.height * .5, rotation: 0};
      const pose = {zoom: mix(start.zoom, CFG.bridgeTruckZoom, eased),
        targetX: quadratic(start.targetX, gapX, frame.truckX, eased),
        targetY: mix(start.targetY, frame.truckY, eased),
        anchorX: centerX, anchorY: mix(start.anchorY, frame.height * .44, eased),
        rotation: side * CFG.bridgeCameraTilt * .16 * Math.sin(progress * Math.PI)};
      return rememberCamera(model, pose);
    } else if (phase === 'TRUCK_FOCUS') {
      target = {zoom: CFG.bridgeTruckZoom, targetX: frame.truckX, targetY: frame.truckY,
        anchorX: centerX, anchorY: frame.height * .44, rotation: 0};
    } else if (phase === 'TRUCK_ESCAPE') {
      if (progress < .32 || !model.bridgeEscapeLock) {
        model.bridgeEscapeLock = {x: frame.truckX, y: frame.truckY};
      }
      target = {zoom: mix(CFG.bridgeTruckZoom, Math.max(CFG.bridgeSeparationZoom,
        CFG.bridgeTruckZoom * .88), smooth(clamp((progress - .28) / .72, 0, 1))),
        targetX: model.bridgeEscapeLock.x, targetY: model.bridgeEscapeLock.y,
        anchorX: centerX, anchorY: frame.height * .44, rotation: 0};
      // Сначала ведём грузовик в скорости, затем отпускаем из неподвижного кадра.
      // Смешивание с замороженным началом плана здесь тормозило саму камеру.
      return rememberCamera(model, target);
    } else {
      target = {zoom: CFG.bridgeReturnZoom, targetX: frame.playerX, targetY: frame.playerY,
        anchorX: centerX, anchorY: frame.height * .61,
        rotation: side * CFG.bridgeCameraTilt * .12 * Math.sin(progress * Math.PI)};
      const travel = smoother(progress / .65);
      const pose = blendPose(from, target, travel);
      pose.zoom -= Math.sin(travel * Math.PI) * .32;
      return rememberCamera(model, pose);
    }
    return rememberCamera(model, blendPose(from, target, eased));
  }

  global.RnRStoryChaseBridge = {active, begin, step, camera, truckScreenY, playerScreenY,
    gapScreenY, phaseDuration, smooth, smoother};
})(typeof window !== 'undefined' ? window : globalThis);
