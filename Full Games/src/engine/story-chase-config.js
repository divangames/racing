////////////////////////////////////////////////////////
//
// Миссия 01 «Погоня»: баланс и уникальный транспорт.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  const config = {
    id: 'MISSION_01',
    redZoneTime: 5,
    greenZoneTime: 5,
    redZoneDistance: 108,
    greenZoneDistance: 34,
    startDistance: 83,
    minDistance: 22,
    maxDistance: 138,

    playerCruiseSpeed: .65,
    playerCoastSpeed: .48,
    playerMaxSpeed: 1,
    playerBrakeSpeed: .34,
    playerAcceleration: .62,
    playerSteerSpeed: 260,
    // «Мьёльнир» Бестии: отдельная от Camaro Медведя на платформе.
    chaseCarIndex: 21,
    chaseDriverIndex: 13,
    distanceSpeedScale: 14,
    distancePixelScale: 2.15,
    introTruckHoldTime: 15,
    introCameraPanTime: 2.6,
    chaseStartTime: 3.6,
    tutorialDriveEnd: 6,
    tutorialBarrelEnd: 12,
    tutorialNitroEnd: 18,
    nitroDuration: 1.65,
    nitroCooldown: 5.5,
    nitroSpeedMultiplier: 1.13,
    chaseFarCameraZoom: 1.12,
    chaseCameraPullSpeed: 1.15,

    truckBaseSpeed: .82,
    truckMaxSpeed: .82,
    truckAcceleration: .18,
    laneChangeSpeed: .72,
    targetDistance: 68,
    catchupDistance: 92,
    escapeDistance: 46,
    truckLaneWidth: 36,
    truckLaneChangeMin: 3.2,
    truckLaneChangeMax: 6.2,

    barrelSpawnMin: 2.5,
    barrelSpawnMax: 5,
    barrelHealth: 2,
    barrelBounceCount: 4,
    barrelBounceDecay: .6,
    barrelHitSpeedMultiplier: .4,
    barrelSpeedRecoveryTime: 2,
    barrelNearRadius: 74,
    barrelNearSpeedMultiplier: .82,
    barrelHitDamage: 20,
    barrelNearDamage: 6,
    barrelDamageCooldown: .35,
    barrelImpactSlide: 38,
    playerMaxHp: 108,
    barrelFrameRate: 19,
    explosionFrameRate: 13,
    shotCooldown: .16,
    shotSpeed: 650,
    weaponHeatPerShot: .12,
    weaponHeatCoolRate: .34,
    weaponOverheatTime: 1.8,

    pressureLearnEnd: 15,
    pressureBuildEnd: 40,
    pressureLearnMin: 3.8,
    pressureLearnMax: 4.8,
    pressureBuildMin: 2.8,
    pressureBuildMax: 3.8,
    pressureAttackMin: 2.2,
    pressureAttackMax: 3.1,
    pressureGreenMin: 1.8,
    pressureGreenMax: 2.4,
    pressureRedMin: 4.2,
    pressureRedMax: 5.2,
    pressureStaggerTime: .55,
    attackWarningTime: .8,
    barrelSpreadTime: .75,
    barrelRollSpeed: 228,
    barrelCollisionRadius: 23,
    bridgeTruckTravelSpeed: 330,
    bridgeStopMargin: 30,

    bridgeApproachTime: 1.1,
    bridgeCollapseTime: .38,
    bridgeBrakeSnapTime: .24,
    bridgeDriftTime: .86,
    bridgeSettleTime: .42,
    bridgePlayerCloseTime: 1.05,
    bridgeSeparationTime: 1.25,
    bridgeTraverseTime: 1.4,
    bridgeTruckPanTime: .8,
    bridgeEscapeTime: 5,
    bridgeReturnTime: 1.8,
    bridgeBlastVisualTime: 2.4,
    bridgeWideZoom: .94,
    bridgeBrakeZoom: 1.22,
    bridgePlayerZoom: 1.68,
    bridgeSeparationZoom: .9,
    bridgeTruckZoom: 1.34,
    bridgeReturnZoom: 1.52,
    bridgeDriftAngle: 1.22,
    bridgeDriftPeakAngle: 1.34,
    bridgeDriftOffset: 48,
    bridgePlayerAdvance: 42,
    bridgeCameraTilt: .035,
    bridgeGapLength: 148,
    roadHalfWidth: 95
  };

  const pitterMax = Object.freeze({
    id: 'PitterMAX',
    category: 'UNIQUE',
    ai: 'MISSION',
    sprites: Object.freeze({
      cargo: 'assets/data/cars/PitterMAX/1.png',
      empty: 'assets/data/cars/PitterMAX/1_none.png'
    }),
    anchors: Object.freeze({
      BARREL_SPAWN: Object.freeze({ x: -112, y: 0 }),
      BARREL_SPAWN_LEFT: Object.freeze({ x: -112, y: -28 }),
      BARREL_SPAWN_CENTER: Object.freeze({ x: -112, y: 0 }),
      BARREL_SPAWN_RIGHT: Object.freeze({ x: -112, y: 28 })
    }),
    movement: Object.freeze({
      baseSpeed: config.truckBaseSpeed,
      maxSpeed: config.truckMaxSpeed,
      acceleration: config.truckAcceleration,
      laneChangeSpeed: config.laneChangeSpeed,
      targetDistance: config.targetDistance,
      catchupDistance: config.catchupDistance,
      escapeDistance: config.escapeDistance
    })
  });

  const transport = global.RnRTransport || (global.RnRTransport = {
    PLAYER: Object.create(null),
    ENEMY: Object.create(null),
    UNIQUE: Object.create(null)
  });
  if (!transport.UNIQUE) transport.UNIQUE = Object.create(null);
  transport.UNIQUE.PitterMAX = pitterMax;

  global.MISSION_01 = config;
  global.PITTER_MAX = pitterMax;
})(typeof window !== 'undefined' ? window : globalThis);
