// Общая схема тактики трассы и подбор двух честных траекторий внутри поворота.
(function (global) {
  'use strict';
  const MODES = Object.freeze({
    press: { title: 'ПРЕСС', advice: 'Внутри короче: дождись открытия пресса. Снаружи — без ожидания.', period: 18, warning: 4, active: 4 },
    heat: { title: 'ЖАРОВОЙ СЕКТОР', advice: 'Внутри короче между выбросами. Внешняя голубая полоса безопасна.', period: 22, warning: 4, active: 6 },
    slick: { title: 'СБРОС ОХЛАДИТЕЛЯ', advice: 'Внутри короче, но скользко после сброса. Снаружи держи скорость.', period: 20, warning: 4, active: 7 }
  });
  /** Проверяет документ без молчаливого исправления некорректной настройки. */
  function validate(value) {
    if (value == null) return null;
    if (typeof value !== 'object' || Array.isArray(value) || !['off', 'auto', ...Object.keys(MODES)].includes(value.mode)) return 'Неизвестный сценарий арены';
    return null;
  }
  /** Сохраняет только версионируемый режим; геометрия пересчитывается после правок карты. */
  function normalize(value) { return value == null || validate(value) ? null : { mode: value.mode }; }
  /** Возвращает угол в диапазоне −π…π. */
  function angle(value) { return Math.atan2(Math.sin(value), Math.cos(value)); }
  /** Измеряет настоящую длину полосы, не прибавляя бонус к прогрессу гонщика. */
  function length(points) { return points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - points[i].x, p.y - points[i].y), 0); }
  /** Проверяет долю круга на попадание в разрыв или эстакаду. */
  function covers(span, u) { return span.from <= span.to ? u >= span.from && u <= span.to : u >= span.from || u <= span.to; }
  /** Плавный въезд и выезд: обе траектории начинаются и заканчиваются на оси дороги. */
  function laneOffset(plan, index, risky) {
    if (index < plan.entry || index > plan.exit) return 0;
    const blend = index < plan.a ? (index - plan.entry) / (plan.a - plan.entry) : index > plan.b ? (plan.exit - index) / (plan.exit - plan.b) : 1;
    const t = Math.max(0, Math.min(1, blend));
    if (!t) return 0;
    return plan.side * (risky ? 48 : -48) * t * t * (3 - 2 * t);
  }
  /** Выбирает обычный поворот вдали от старта, разрывов и мостов, с измеримым выигрышем внутри. */
  function plan(T, source) {
    const explicit = normalize(source.tactics);
    if (explicit && explicit.mode === 'off') return null;
    if (!explicit && (source.custom || source.chapter || source.lab)) return null;
    const map = (T.theme || {}).map, deco = (T.theme || {}).deco;
    const mode = explicit && explicit.mode !== 'auto' ? explicit.mode : map === 'snow' ? 'slick' : deco === 'lava' || map === 'sand' ? 'heat' : 'press';
    const S = T.S, N = S.length, span = Math.max(12, Math.floor(N * .08)), offset = 48;
    let best = null;
    for (let a = Math.ceil(N * .08); a + span < N * .92; a += Math.max(1, Math.floor(N * .015))) {
      const b = a + span, entry = Math.max(0, a - 12), exit = Math.min(N - 1, b + 12);
      let turn = 0, total = 0, blocked = false;
      for (let i = entry; i <= exit; i++) {
        if ([...(T.gaps || []), ...(T.decks || [])].some(s => covers(s, i / N))) { blocked = true; break; }
        if (i >= a && i <= b) { const d = angle(S[i].ang - S[Math.max(a, i - 1)].ang); turn += d; total += Math.abs(d); }
        if (S[i].k * offset > .7) blocked = true;
      }
      if (blocked || Math.abs(turn) < .65 || Math.abs(turn) < total * .9) continue;
      const side = Math.sign(turn), inner = [], outer = [];
      for (let i = a; i <= b; i++) {
        const p = S[i];
        inner.push({ x: p.x + p.nx * offset * side, y: p.y + p.ny * offset * side });
        outer.push({ x: p.x - p.nx * offset * side, y: p.y - p.ny * offset * side });
      }
      const shortLength = length(inner), longLength = length(outer), saving = longLength - shortLength;
      if (shortLength >= longLength * .94 || (best && best.saving >= saving)) continue;
      const candidate = { mode, a, b, entry, exit, side, inner, outer, shortLength, longLength, saving, ...MODES[mode] };
      const route = risky => S.slice(entry, exit + 1).map((p, j) => { const off = laneOffset(candidate, entry + j, risky); return { x: p.x + p.nx * off, y: p.y + p.ny * off }; });
      candidate.innerRoute = route(true); candidate.outerRoute = route(false);
      candidate.routeShortLength = length(candidate.innerRoute); candidate.routeLongLength = length(candidate.outerRoute);
      // Считаем и въезд: нарисованный срез действительно короче, без бонусов к прогрессу.
      if (candidate.routeShortLength >= candidate.routeLongLength * .97) continue;
      candidate.routeSaving = candidate.routeLongLength - candidate.routeShortLength;
      const gatePoint = S[a + 2];
      candidate.gate = { x: gatePoint.x + gatePoint.nx * side * offset, y: gatePoint.y + gatePoint.ny * side * offset, angle: gatePoint.ang, index: a + 2, halfWidth: 8, halfSpan: 32, maxhp: 32 };
      best = candidate;
    }
    return best;
  }
  /** Цикл начинается с безопасного окна; отсчёт предупреждения всегда предшествует воздействию. */
  function phase(plan, elapsed) {
    const time = Math.max(0, elapsed) % plan.period, rest = plan.period - plan.warning - plan.active;
    if (time < rest) return { kind: 'open', remaining: rest - time };
    if (time < rest + plan.warning) return { kind: 'warning', remaining: rest + plan.warning - time };
    return { kind: 'active', remaining: plan.period - time };
  }
  const api = { MODES, validate, normalize, plan, phase, laneOffset };
  global.RnRTactics = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
