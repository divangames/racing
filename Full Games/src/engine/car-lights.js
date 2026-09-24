// Общие координаты света: игровые единицы относительно центра машины, нос смотрит по +X.
(function (global) {
  'use strict';
  const MAX_POINTS = 8;
  const MAX_COORD = 500;
  const GROUPS = ['head', 'brake'];

  function validGroup(points) {
    if (!Array.isArray(points) || points.length > MAX_POINTS) return false;
    for (const point of points) {
      if (!Array.isArray(point) || point.length !== 2 ||
          !Number.isFinite(point[0]) || !Number.isFinite(point[1]) ||
          Math.abs(point[0]) > MAX_COORD || Math.abs(point[1]) > MAX_COORD) return false;
    }
    return true;
  }

  /** Ошибка документа до записи; старые машины без lights остаются совместимыми. */
  function validate(lights) {
    if (lights == null) return null;
    if (typeof lights !== 'object' || Array.isArray(lights)) return 'Некорректные настройки света';
    for (const group of GROUPS) {
      if (Object.prototype.hasOwnProperty.call(lights, group) && !validGroup(lights[group])) {
        return (group === 'head' ? 'Фары' : 'Стоп-сигналы') + ': до 8 точек [X, Y], координаты от −500 до 500';
      }
    }
    return null;
  }

  /** Копирует только корректные группы. Отсутствие группы — авто, [] — выключена. */
  function normalize(lights) {
    if (!lights || typeof lights !== 'object' || Array.isArray(lights)) return undefined;
    const result = {};
    for (const group of GROUPS) {
      if (Object.prototype.hasOwnProperty.call(lights, group) && validGroup(lights[group])) {
        result[group] = lights[group].map(function (point) { return point.slice(); });
      }
    }
    return result;
  }

  /** body.scale/x/y уже отражены в холсте редактора: к ручным точкам их не применяем. */
  function resolve(config, half) {
    const lights = normalize(config && config.lights) || {};
    const hw = half && Number.isFinite(half.hw) && half.hw > 0 ? half.hw : 27;
    const hh = half && Number.isFinite(half.hh) && half.hh > 0 ? half.hh : 16;
    const front = Math.max(16, hw * .84), side = Math.max(6, hh * .62);
    return {
      head: lights.head || [[front, -side], [front, side]],
      brake: lights.brake || [[-front, -side], [-front, side]]
    };
  }

  const api = { MAX_POINTS, MAX_COORD, validate, normalize, resolve };
  global.RnRCarLights = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
