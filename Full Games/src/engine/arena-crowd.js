////////////////////////////////////////////////////////
//
// DiVANEngine: коэффициент трибуны — обгон, смерть, финиш, характер.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  const engine = global.DiVANEngine;
  if (!engine) return;

  let randomIn = 12;

  /**
   * Плеер толпы.
   * @returns {object|null}
   */
  function api() {
    return global.RnRArenaCrowd || null;
  }

  /**
   * Ключ гонщика.
   * @param {object} r
   * @returns {string}
   */
  function rid(r) {
    if (!r) return '';
    if (r.slot != null) return 's' + r.slot;
    if (r.chIdx != null) return 'c' + r.chIdx;
    return r.ch && r.ch.name ? String(r.ch.name) : 'x';
  }

  /**
   * Сдвиг «чьей темы».
   * @param {object} r
   * @param {number} d
   */
  function addFavor(r, d) {
    if (!r) return;
    r.crowdFavor = Math.max(-8, Math.min(8, (r.crowdFavor || 0) + d));
  }

  /**
   * Герой кадра для трибуны.
   * @param {object} R
   * @returns {object|null}
   */
  function darling(R) {
    const list = R.racers || [];
    let best = null;
    let score = -1e9;
    for (let i = 0; i < list.length; i++) {
      const v = list[i].crowdFavor || 0;
      if (v > score) { score = v; best = list[i]; }
    }
    return best;
  }

  /**
   * Игрок уже любимчик и ведёт.
   * @param {object} R
   * @returns {boolean}
   */
  function playerHot(R) {
    const p = global.P;
    const d = darling(R);
    return !!(p && d === p && (p.crowdFavor || 0) > 1.7);
  }

  /**
   * Реакция банки по событию.
   * @param {object} R
   * @param {string} kind
   * @param {object|null} who
   * @param {object|null} other
   */
  function react(R, kind, who, other) {
    const snd = api();
    if (!snd) return;
    const d = darling(R);
    const hot = playerHot(R);
    if (kind === 'kill') {
      addFavor(other, 1.45);
      addFavor(who, -1.15);
      if (other && (other === d || (other.isP && hot))) snd.playShot('aplodisment', true);
      else if (who === d) snd.playShot('nedovolny', true);
      else snd.playShot(Math.random() < 0.6 ? 'aplodisment' : 'nedovolny', true);
      return;
    }
    if (kind === 'overtake') {
      addFavor(who, 0.55);
      addFavor(other, -0.5);
      if (other === d) snd.playShot('nedovolny', false);
      else if (who === d || (who && who.isP && hot)) snd.playShot('aplodisment', false);
      else if (Math.random() < 0.42) snd.playShot(who && who.isP ? 'aplodisment' : 'nedovolny', false);
      return;
    }
    if (kind === 'finish') {
      if (R.firstDone === who) {
        addFavor(who, 2.1);
        snd.playShot('aplodisment', true);
      } else {
        addFavor(who, -0.85);
        snd.playShot('nedovolny', true);
      }
    }
  }

  /**
   * Обгон на одну позицию.
   * @param {object} R
   */
  function notePlaces(R) {
    if (!R.crowd) R.crowd = { place: Object.create(null) };
    const order = R.order || [];
    for (let i = 0; i < order.length; i++) {
      const r = order[i];
      const id = rid(r);
      const prev = R.crowd.place[id];
      if (prev != null && i === prev - 1) react(R, 'overtake', r, order[i + 1] || null);
      R.crowd.place[id] = i;
    }
  }

  /**
   * Лидер греется, хвост стынет, киллы игрока копят тему.
   * @param {object} R
   * @param {number} dt
   */
  function dripFavor(R, dt) {
    const order = R.order || [];
    for (let i = 0; i < order.length; i++) {
      const r = order[i];
      if (!r) continue;
      if (r.dead) { addFavor(r, -0.15 * dt); continue; }
      if (i === 0) addFavor(r, 0.38 * dt);
      else if (i === 1) addFavor(r, 0.08 * dt);
      else if (i >= 4) addFavor(r, -0.12 * dt);
    }
    const p = global.P;
    if (p && p.isP && !p.dead && (p.kills || 0) > 0) addFavor(p, Math.min(0.2, p.kills * 0.04) * dt);
  }

  /**
   * Random_NN — характер, когда трибуна уже выбрала сторону.
   * @param {object} R
   * @param {number} dt
   */
  function tickRandom(R, dt) {
    const snd = api();
    if (!snd) return;
    const d = darling(R);
    const heat = d ? Math.abs(d.crowdFavor || 0) : 0;
    randomIn -= dt;
    if (randomIn > 0) return;
    randomIn = heat > 2.2 ? 7 + Math.random() * 7 : 14 + Math.random() * 10;
    if (heat < 1.4) return;
    snd.playShot('random', false);
  }

  /**
   * Шаг после физики заезда.
   * @param {object|null} R
   * @param {number} dt
   */
  function afterRace(R, dt) {
    const snd = api();
    if (!snd) return;
    if (!snd.arenaLive(R)) { snd.halt(); return; }
    dripFavor(R, dt);
    notePlaces(R);
    tickRandom(R, dt);
    snd.tickBed(dt);
  }

  if (typeof global.killRacer === 'function') {
    engine.wrap('killRacer', function (orig) {
      return function (r, killer) {
        orig(r, killer);
        const snd = api();
        if (snd && snd.arenaLive(global.R)) react(global.R, 'kill', r, killer && killer !== r ? killer : null);
      };
    });
  }

  if (typeof global.finishRacer === 'function') {
    engine.wrap('finishRacer', function (orig) {
      return function (r) {
        orig(r);
        const snd = api();
        if (snd && snd.arenaLive(global.R)) react(global.R, 'finish', r, null);
      };
    });
  }

  engine.arenaCrowd = { afterRace: afterRace, react: react };
})(typeof window !== 'undefined' ? window : globalThis);
