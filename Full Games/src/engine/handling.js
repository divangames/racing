// Профили всего автопарка без изменения мощности, здоровья, оружия и экономики машин.
(function (global) {
  'use strict';
  const FAMILIES = Object.freeze({
    light: Object.freeze({ name: 'ЛЁГКАЯ', mass: .78, cornerGrip: .86, brake: 690, response: 1.35, turn: 1.12, stability: .30, hold: 1.16, drift: 2.5, recovery: 1.18 }),
    balanced: Object.freeze({ name: 'УНИВЕРСАЛЬНАЯ', mass: 1, cornerGrip: 1, brake: 570, response: 1.10, turn: 1, stability: .28, hold: 1.05, drift: 2.8, recovery: 1.06 }),
    heavy: Object.freeze({ name: 'ТЯЖЁЛАЯ', mass: 1.65, cornerGrip: 1.12, brake: 440, response: .80, turn: .91, stability: .36, hold: .92, drift: 3.0, recovery: .88 }),
    sport: Object.freeze({ name: 'СПОРТИВНАЯ', mass: .93, cornerGrip: 1.09, brake: 650, response: 1.20, turn: 1.03, stability: .34, hold: 1.10, drift: 2.7, recovery: 1.12 }),
    hover: Object.freeze({ name: 'ХОВЕР', mass: 1.04, cornerGrip: 1, brake: 630, response: .95, turn: .96, stability: .24, hold: 1, drift: 0, recovery: 1 })
  });
  /** Создаёт неизменяемый вариант семейства с характером конкретного кузова. */
  function variant(family, name, overrides = {}) { return Object.freeze({ ...FAMILIES[family], name, ...overrides }); }
  const PROFILES = Object.freeze({
    0: FAMILIES.balanced,
    1: variant('sport', 'ПЕРЕХВАТЧИК', { brake: 600, response: 1.12, stability: .37 }),
    2: variant('sport', 'МАНЁВРЕННЫЙ БОЕЦ', { brake: 630, turn: 1.02, recovery: 1.16 }),
    3: FAMILIES.hover,
    4: FAMILIES.heavy,
    5: variant('sport', 'ЛЁГКИЙ СПОРТ', { brake: 700, response: 1.30, turn: 1.04, stability: .38, recovery: 1.20 }),
    6: variant('heavy', 'ГРУЗОВОЙ ВСЕДОРОЖНИК', { brake: 485, response: .88, turn: .95, hold: 1.02, recovery: .96 }),
    7: FAMILIES.light,
    8: variant('balanced', 'ДРИФТ', { brake: 590, response: 1.18, turn: 1.08, hold: .94, drift: 3.25, recovery: .82 }),
    9: variant('sport', 'СКОРОСТНОЙ ПРЫГУН', { brake: 620, response: 1.10, turn: 1, stability: .36 }),
    10: variant('balanced', 'МАНЁВРЕННЫЙ УНИВЕРСАЛ', { brake: 580, response: 1.15, turn: 1.04, recovery: 1.10 }),
    11: variant('light', 'ЛЁГКИЙ ХЛАМ', { brake: 550, response: 1.05, turn: 1.02, hold: .97, drift: 2.9, recovery: .95 }),
    12: variant('light', 'КОМПАКТ', { brake: 640, response: 1.25, turn: 1.10, hold: 1.08, recovery: 1.10 }),
    13: variant('balanced', 'ДОРОЖНЫЙ ХЛАМ', { brake: 560, response: 1.02, stability: .33, hold: 1.02 }),
    14: variant('balanced', 'ЛЁГКИЙ ВСЕДОРОЖНИК', { brake: 530, response: 1.03, turn: 1.04, hold: 1.10 }),
    15: variant('heavy', 'ГРУЗОВОЙ ХЛАМ', { brake: 475, response: .88, turn: .95, hold: .95, recovery: .92 }),
    16: variant('balanced', 'ГОРОДСКОЙ МАНЁВРЕННЫЙ', { brake: 615, response: 1.22, turn: 1.08, recovery: 1.12 }),
    17: variant('heavy', 'ГРУЗОВОЙ БОЕЦ', { brake: 490, response: .92, turn: .97, hold: 1.04, recovery: .97 }),
    18: variant('sport', 'ДОРОЖНОЕ КУПЕ', { brake: 635, response: 1.23, turn: 1.08, stability: .32 }),
    19: variant('heavy', 'ФУРГОН', { brake: 465, response: .84, turn: .93, hold: .99, recovery: .92 }),
    20: variant('balanced', 'СЛУЖЕБНЫЙ УНИВЕРСАЛ', { brake: 550, response: 1.03, turn: .99, stability: .32, hold: 1.08 })
  });
  const CUSTOM_LIMITS = Object.freeze({ heavyHp: 125, sportTop: 1.12, lightHp: 85 });
  const STOP_SPEED = .5, REVERSE_DELAY = .18;
  /** Выбирает живой профиль: смена ховера и характеристик в редакторе не требует сброса кэша. */
  function profile(car) {
    if (!car) return null;
    // Ховер всегда остаётся ховером, даже если флаг добавлен штатному кузову в редакторе.
    if (car.hov) return FAMILIES.hover;
    if (!car.custom && car.idx !== 3 && Object.prototype.hasOwnProperty.call(PROFILES, car.idx)) return PROFILES[car.idx];
    if (Number.isFinite(car.hp) && car.hp >= CUSTOM_LIMITS.heavyHp) return FAMILIES.heavy;
    if (Number.isFinite(car.top) && car.top >= CUSTOM_LIMITS.sportTop) return FAMILIES.sport;
    if (Number.isFinite(car.hp) && car.hp <= CUSTOM_LIMITS.lightHp) return FAMILIES.light;
    return FAMILIES.balanced;
  }
  /** Тормозит до нуля; задний ход включается после короткого удержания, без броска через ноль. */
  function brake(r, speed, input, dt, top, acceleration, amount) {
    if (input >= 0) { r._reverseHold = 0; return speed; }
    if (speed > STOP_SPEED) {
      r._reverseHold = 0;
      const next = Math.max(0, speed + input * amount * dt);
      return next <= STOP_SPEED ? 0 : next;
    }
    // После отпускания курка уже движущаяся назад машина не замирает
    // на время задержки: она нужна только для включения задней передачи.
    if (speed < -STOP_SPEED) return Math.max(-top * .35, speed + acceleration * .42 * input * dt);
    r._reverseHold = (r._reverseHold || 0) + dt;
    return r._reverseHold < REVERSE_DELAY ? 0 : Math.max(-top * .35, speed + acceleration * .42 * input * dt);
  }
  /** Руль быстро возвращается в центр и охотнее ловит машину контррулением. */
  function steering(previous, target, response, dt) {
    const multiplier = target === 0 ? 1.65 : previous * target < 0 ? 1.35 : 1;
    const next = previous + (target - previous) * (1 - Math.exp(-response * multiplier * dt));
    return target === 0 && Math.abs(next) < .001 ? 0 : next;
  }
  /** Масса определяется кузовом; броня добавляет лишь небольшой вес, двигатель её не меняет. */
  function mass(racer) {
    const p = profile(racer && racer.car);
    const armor = Math.max(0, Math.min(6, Number(racer && racer.lvl && racer.lvl.arm) || 0));
    return (p ? p.mass : 1) * (1 + armor * .025);
  }
  /** Сцепление срывается постепенно. Контрруление и выход под газом помогают поймать машину. */
  function traction(p, speed, steer, throttle, lateral, hand, grip) {
    const load = Math.abs(steer) * speed * speed / Math.max(.35, grip * (p ? p.cornerGrip : 1));
    const slip = Math.max(0, Math.min(.55, (load - .72) / .9));
    const counter = !hand && lateral * steer > 0 ? Math.min(1, Math.abs(lateral) / 40) * Math.abs(steer) * .65 : 0;
    const exit = !hand && Math.abs(steer) < .4 ? Math.max(0, throttle) * .14 : 0;
    return { load, slip, recovery: (1 - slip * .5) * (1 + counter + exit) };
  }
  /** Общий признак заноса для звука, эффекта и результатов; удар сам по себе не приносит рекорд. */
  function driftState(r, dt) {
    const state = r._drift || (r._drift = { active: false, angle: 0, intensity: 0, held: 0 });
    state.angle = Math.atan2(Math.abs(r.lat || 0), Math.max(1, Math.abs(r.spd || 0)));
    const sliding = !r.car.hov && !r.dead && !r.air && !r.finished && !(r._contactGrace > 0) &&
      r.spd > 90 && Math.abs(r.lat || 0) > 20 && state.angle > (state.active ? .085 : .12);
    state.held = sliding ? state.held + dt : 0;
    state.active = sliding && state.held >= .1;
    state.intensity = sliding ? Math.min(1, Math.max(0, (state.angle - .06) / .32)) : 0;
    return state;
  }
  global.DiVANEngine.handling = { profile, brake, steering, mass, traction, driftState, profiles: PROFILES, families: FAMILIES };
})(typeof window !== 'undefined' ? window : globalThis);
