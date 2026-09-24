// Геометрия контрольной линии: поиск участка и заготовки трасс.
(function (global) {
  'use strict';

  const CURVE_STEPS = 16;
  const DEFAULT_CENTER = [1600, 1000];

  /** Вычисляет точку кривой Catmull–Rom; p0–p3 — контрольные точки, t — доля участка. */
  function catmull(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t;
    return [0, 1].map((axis) => .5 * (
      2 * p1[axis] + (-p0[axis] + p2[axis]) * t
      + (2 * p0[axis] - 5 * p1[axis] + 4 * p2[axis] - p3[axis]) * t2
      + (-p0[axis] + 3 * p1[axis] - 3 * p2[axis] + p3[axis]) * t3
    ));
  }

  /** Возвращает ближайшую проекцию курсора на видимую кривую и индекс её контрольного участка. */
  function nearestCurve(cps, x, y) {
    if (!Array.isArray(cps) || cps.length < 4) return null;
    let best = null;
    for (let i = 0; i < cps.length; i++) {
      const n = cps.length;
      const a = cps[(i + n - 1) % n], b = cps[i];
      const c = cps[(i + 1) % n], d = cps[(i + 2) % n];
      let previous = b;
      for (let step = 1; step <= CURVE_STEPS; step++) {
        const next = catmull(a, b, c, d, step / CURVE_STEPS);
        const vx = next[0] - previous[0], vy = next[1] - previous[1];
        const u = Math.max(0, Math.min(1,
          ((x - previous[0]) * vx + (y - previous[1]) * vy) / (vx * vx + vy * vy || 1)));
        const px = previous[0] + vx * u, py = previous[1] + vy * u;
        const distance = Math.hypot(x - px, y - py);
        if (!best || distance < best.distance) best = {i, x: px, y: py, distance};
        previous = next;
      }
    }
    return best;
  }

  /** Ищет ближайшую ручку в радиусе, заданном в пикселях экрана. */
  function nearestPoint(cps, x, y, zoom, pixels) {
    let best = null;
    const radius = pixels / Math.max(.08, zoom);
    (cps || []).forEach((point, i) => {
      const distance = Math.hypot(x - point[0], y - point[1]);
      if (distance <= radius && (!best || distance < best.distance)) best = {i, distance};
    });
    return best;
  }

  /** Вставляет точку только рядом с кривой и не создаёт совпадающие вершины. */
  function insertOnCurve(cps, x, y, zoom, pixels) {
    const hit = nearestCurve(cps, x, y);
    if (!hit || hit.distance * zoom > pixels) return null;
    const before = cps[hit.i], after = cps[(hit.i + 1) % cps.length];
    const minGap = Math.max(10, 8 / Math.max(.08, zoom));
    if (Math.hypot(hit.x - before[0], hit.y - before[1]) < minGap
      || Math.hypot(hit.x - after[0], hit.y - after[1]) < minGap) return null;
    const index = hit.i + 1;
    cps.splice(index, 0, [Math.round(hit.x), Math.round(hit.y)]);
    return index;
  }

  /** Магистраль: длинные прямые и плавные развороты в замкнутом круге. */
  function highway(center) {
    const [cx, cy] = center || DEFAULT_CENTER;
    return [
      [-640, -340], [-320, -360], [0, -360], [320, -360], [640, -340],
      [800, -250], [830, 0], [800, 250], [640, 340], [320, 360],
      [0, 360], [-320, 360], [-640, 340], [-800, 250], [-830, 0], [-800, -250]
    ].map(([x, y]) => [cx + x, cy + y]);
  }

  /** Пересечение: два проезда через один центр на одной замкнутой петле. */
  function crossroads(center) {
    const [cx, cy] = center || DEFAULT_CENTER;
    return Array.from({length: 20}, (_, i) => {
      const angle = i * Math.PI * 2 / 20;
      return [Math.round(cx + 800 * Math.sin(angle)), Math.round(cy + 500 * Math.sin(2 * angle))];
    });
  }

  global.RoadGeometry = {nearestCurve, nearestPoint, insertOnCurve, highway, crossroads};
})(typeof window !== 'undefined' ? window : globalThis);
