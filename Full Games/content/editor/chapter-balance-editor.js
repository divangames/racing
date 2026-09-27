// Числовой баланс миссии в инспекторе главы.
(function (global) {
  'use strict';

  const FIELDS = [
    ['redZoneTime', 'Красная зона, сек', .1], ['greenZoneTime', 'Зелёная зона, сек', .1],
    ['redZoneDistance', 'Красная дистанция', 1], ['greenZoneDistance', 'Зелёная дистанция', 1],
    ['playerCoastSpeed', 'Скорость без газа', .01], ['playerMaxSpeed', 'Скорость с газом', .01],
    ['playerAcceleration', 'Разгон игрока', .01], ['truckBaseSpeed', 'Скорость PitterMAX', .01],
    ['introTruckHoldTime', 'Вступление: грузовик, сек', .1], ['introCameraPanTime', 'Вступление: перевод камеры', .1],
    ['chaseStartTime', 'Стартовая подсказка, сек', .1],
    ['tutorialDriveEnd', 'Подсказка цели до, сек', .5], ['tutorialBarrelEnd', 'Подсказка бочек до, сек', .5],
    ['tutorialNitroEnd', 'Подсказка нитро до, сек', .5],
    ['chaseFarCameraZoom', 'Камера при отставании', .01], ['chaseCameraPullSpeed', 'Скорость отдаления камеры', .05],
    ['pressureLearnEnd', 'Обучение до, сек', 1], ['pressureBuildEnd', 'Натиск с, сек', 1],
    ['pressureLearnMin', 'Обучение: мин. пауза', .1], ['pressureLearnMax', 'Обучение: макс. пауза', .1],
    ['pressureBuildMin', 'Давление: мин. пауза', .1], ['pressureBuildMax', 'Давление: макс. пауза', .1],
    ['pressureAttackMin', 'Натиск: мин. пауза', .1], ['pressureAttackMax', 'Натиск: макс. пауза', .1],
    ['pressureGreenMin', 'Финал: мин. пауза', .1], ['pressureGreenMax', 'Финал: макс. пауза', .1],
    ['pressureRedMin', 'Восстановление: мин. пауза', .1], ['pressureRedMax', 'Восстановление: макс. пауза', .1],
    ['pressureStaggerTime', 'Интервал серии бочек', .05],
    ['attackWarningTime', 'Предупреждение перед сбросом, сек', .05],
    ['barrelSpreadTime', 'Выход бочки на полосу, сек', .05], ['barrelRollSpeed', 'Скорость качения бочки', 5],
    ['barrelCollisionRadius', 'Ширина столкновения с бочкой', 1],
    ['barrelHealth', 'Прочность бочки', 1], ['barrelHitSpeedMultiplier', 'Скорость после удара', .05],
    ['barrelSpeedRecoveryTime', 'Восстановление скорости, сек', .1],
    ['weaponHeatPerShot', 'Нагрев за выстрел', .01], ['weaponHeatCoolRate', 'Охлаждение в сек', .01],
    ['weaponOverheatTime', 'Перегрев, сек', .1],
    ['bridgeApproachTime', 'Мост: общий въезд, сек', .05], ['bridgeCollapseTime', 'Мост: обрушение, сек', .02],
    ['bridgeBrakeSnapTime', 'Мост: удар по тормозам', .02], ['bridgeDriftTime', 'Мост: активный занос', .02],
    ['bridgeSettleTime', 'Мост: стабилизация', .02], ['bridgePlayerCloseTime', 'Мост: крупный план Брички', .05],
    ['bridgeSeparationTime', 'Мост: общий план машин', .05], ['bridgeTraverseTime', 'Мост: пролёт через разрыв', .05],
    ['bridgeTruckPanTime', 'Мост: фиксация грузовика', .05], ['bridgeEscapeTime', 'Мост: гудок и уход', .05],
    ['bridgeReturnTime', 'Мост: возврат к Бричке', .05], ['bridgeBlastVisualTime', 'Мост: длительность взрыва', .1],
    ['bridgeWideZoom', 'Мост: общий план', .01], ['bridgeBrakeZoom', 'Мост: камера торможения', .01],
    ['bridgePlayerZoom', 'Мост: план Брички', .01], ['bridgeSeparationZoom', 'Мост: дальний план', .01],
    ['bridgeTruckZoom', 'Мост: план грузовика', .01], ['bridgeReturnZoom', 'Мост: финальный план', .01],
    ['bridgeDriftAngle', 'Мост: финальный угол', .01], ['bridgeDriftPeakAngle', 'Мост: пик заноса', .01],
    ['bridgeDriftOffset', 'Мост: боковое смещение', 1], ['bridgePlayerAdvance', 'Мост: ход к кромке', 1],
    ['bridgeCameraTilt', 'Мост: наклон камеры', .005],
    ['bridgeGapLength', 'Мост: длина разлома', 1],
    ['bridgeTruckTravelSpeed', 'Мост: масштаб движения грузовика', 5],
    ['bridgeStopMargin', 'Мост: запас до обрыва', 1]
  ];

  /** Не даёт пустому полю остановить миссию или сжать монтаж до одного кадра. */
  function bounds(key, step) {
    if (['barrelRollSpeed', 'bridgeTruckTravelSpeed', 'playerSteerSpeed'].includes(key)) return [40, 800];
    if (key === 'nitroSpeedMultiplier') return [1, 2];
    if (/Zoom$/.test(key)) return [.4, 3];
    if (/Tilt$/.test(key)) return [0, .35];
    if (/Angle$/.test(key)) return [0, Math.PI];
    if (/Offset$|Advance$/.test(key)) return [0, 200];
    if (/GapLength$/.test(key)) return [20, 500];
    if (/Distance$/.test(key)) return [1, 500];
    if (/Multiplier$/.test(key)) return [.05, 1];
    if (/Speed$|Acceleration$|CoolRate$|HeatPerShot$/.test(key)) return [.01, 5];
    if (/Health$/.test(key)) return [1, 20];
    if (/Time$/.test(key)) return [.02, 120];
    if (/Min$|Max$/.test(key)) return [Math.max(.01, step), 600];
    return [Math.min(0, step), 600];
  }

  /** Перестраивает поля для активного документа. */
  function render(document, markDirty) {
    const host = document && window.document.getElementById('chapterConfig');
    if (!host) return;
    host.replaceChildren();
    FIELDS.forEach(([key, label, step]) => {
      const field = window.document.createElement('div');
      const caption = window.document.createElement('label');
      const input = window.document.createElement('input');
      const id = 'chapterConfig_' + key;
      const range = bounds(key, step);
      field.className = 'field'; caption.htmlFor = id; caption.textContent = label;
      input.id = id; input.type = 'number'; input.step = String(step);
      input.min = String(range[0]); input.max = String(range[1]); input.value = Number(document.config[key]);
      input.oninput = () => {
        if (input.value.trim() === '') return;
        const value = Number(input.value);
        if (!Number.isFinite(value) || value < range[0] || value > range[1]) return;
        document.config[key] = value; markDirty();
      };
      input.onchange = input.onblur = () => {
        const value = Number(input.value);
        if (input.value.trim() === '' || !Number.isFinite(value)) input.value = String(document.config[key]);
        else {
          const clamped = Math.max(range[0], Math.min(range[1], value));
          input.value = String(clamped);
          if (document.config[key] !== clamped) { document.config[key] = clamped; markDirty(); }
        }
      };
      field.append(caption, input); host.append(field);
    });
  }

  global.ChapterBalanceEditor = {render};
})(window);
