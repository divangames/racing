// Режиссёр давления миссии 01: этапы сложности и гарантированно проходимые волны бочек.
(function (global) {
  'use strict';

  const CFG = global.MISSION_01;
  if (!CFG) return;
  const LANES = [-1, 0, 1];

  /** Возвращает случайное число в заданном диапазоне. */
  function between(minimum, maximum, random) {
    return minimum + (maximum - minimum) * (random || Math.random)();
  }

  /** Определяет текущий этап давления без скрытой коррекции скорости босса. */
  function profile(model) {
    if (model.distanceZone === 'RED') {
      return {id: 'RECOVERY', min: CFG.pressureRedMin, max: CFG.pressureRedMax, pattern: 'SINGLE'};
    }
    if (model.distanceZone === 'GREEN') {
      return {id: 'FINAL', min: CFG.pressureGreenMin, max: CFG.pressureGreenMax, pattern: 'ZIGZAG'};
    }
    if (model.elapsed < CFG.pressureLearnEnd) {
      return {id: 'LEARN', min: CFG.pressureLearnMin, max: CFG.pressureLearnMax, pattern: 'SINGLE'};
    }
    if (model.elapsed < CFG.pressureBuildEnd) {
      return {id: 'BUILD', min: CFG.pressureBuildMin, max: CFG.pressureBuildMax, pattern: 'MIXED'};
    }
    return {id: 'ATTACK', min: CFG.pressureAttackMin, max: CFG.pressureAttackMax, pattern: 'HARD'};
  }

  /** Выбирает полосу детерминированно по номеру волны с небольшой случайностью старта. */
  function safeLane(model, random) {
    const offset = Math.floor((random || Math.random)() * LANES.length);
    return LANES[(model.waveIndex + offset) % LANES.length];
  }

  /** Фиксирует намерение до атаки: грузовик больше не целится вслед за уклоняющимся игроком. */
  function schedule(model, random) {
    const current = profile(model), safe = safeLane(model, random);
    model.pressureStage = current.id;
    model.waveIndex += 1;
    const half = global.RnRStoryChaseModel ? global.RnRStoryChaseModel.trackSettings().roadHalfWidth : CFG.roadHalfWidth;
    const laneWidth = Math.max(38, half - 29);
    const aim = Math.max(-laneWidth, Math.min(laneWidth, model.playerX));
    const single = current.pattern === 'SINGLE' || current.pattern === 'MIXED' && model.waveIndex % 2;
    const lanes = single ? [Math.round(aim / laneWidth)] : LANES.filter(lane => lane !== safe);
    const warning = CFG.attackWarningTime + (current.id === 'LEARN' ? .35 : 0);
    const name = single ? 'ПРИЦЕЛЬНЫЙ СБРОС' : 'ДВОЙНОЙ СБРОС';
    lanes.forEach(lane => model.pendingDrops.push({delay: warning, warning: warning, lane: lane,
      targetOffset: single ? aim : lane * laneWidth, label: name, wave: model.waveIndex}));
    // Третья бочка получает отдельное предупреждение и приходит после прохода первой пары.
    if (!single && (current.pattern === 'ZIGZAG' || current.pattern === 'HARD' && model.waveIndex % 2 === 0)) {
      model.pendingDrops.push({delay: warning + Math.max(1.05, CFG.pressureStaggerTime), warning: warning,
        lane: safe, targetOffset: safe * laneWidth, label: 'ЕЩЁ ОДНА!', wave: model.waveIndex});
    }
  }

  /** Возвращает следующий интервал сброса для текущего этапа. */
  function nextInterval(model, random) {
    const current = profile(model);
    model.pressureStage = current.id;
    return between(current.min, current.max, random);
  }

  /** Выпускает отложенные бочки из актуального положения грузовика. */
  function updateQueue(model, dt, spawn) {
    for (let index = model.pendingDrops.length - 1; index >= 0; index--) {
      const item = model.pendingDrops[index];
      item.delay -= dt;
      if (item.delay > 0) continue;
      spawn(model, item.lane, item.targetOffset);
      model.pendingDrops.splice(index, 1);
    }
  }

  /** При смене зоны включает финальную атаку или освобождает окно восстановления. */
  function enterZone(model, previous, next) {
    if (previous === next) return;
    if (next === 'GREEN') model.spawnTimer = Math.min(model.spawnTimer, .45);
    if (next === 'RED') {
      model.pendingDrops.length = 0;
      model.spawnTimer = Math.max(model.spawnTimer, CFG.pressureRedMin);
    }
  }

  global.RnRStoryChasePressure = {profile, schedule, nextInterval, updateQueue, enterZone};
})(typeof window !== 'undefined' ? window : globalThis);
