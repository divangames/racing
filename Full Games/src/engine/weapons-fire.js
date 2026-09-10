////////////////////////////////////////////////////////
//
// DiVANEngine: выстрел Z, звук ствола, толчок и ульта C.
// Типы среднего/стартового класса остаются в контенте.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Выстрел из кита: семпл лаборатории или синтез.
   * @param {object} r
   * @param {string} [kind]
   */
  function kitGunSoundEngine(r, kind) {
    if (typeof R !== 'undefined' && R.demo) {
      if (typeof playCarWeapon === 'function') playCarWeapon(r, kind || 'wep');
      return;
    }
    if (typeof playCarWeapon === 'function' && playCarWeapon(r, kind || 'wep')) return;
    if (r.isP || (typeof nearP === 'function' && nearP(r.x, r.y, 600))) sShoot();
  }

  /**
   * Стрельба Z: миниган, гатлинг, клык и делегат в киты контента.
   * @param {object} r
   */
  function fireWeaponEngine(r) {
    if (r.dead || r.cdW > 0) return;
    const ab = carAbil(r.car.idx).weapon;
    const t = ab.type;
    if (t === 'minigun') {
      if ((r.wepOver || 0) > 0 || (r.wepAmmo | 0) <= 0) return;
      r.cdW = kitWepCd(r, ab); r.wepAmmo--;
      const a = r.ang, off = (Math.random() - 0.5) * 0.14, dmg = kitWepDmg(r, ab);
      kitPushShot(r, a + off, 980, 0.42, dmg);
      if (vfxLive()) RnRVfx.muzzle(r.x + Math.cos(a) * 28, r.y + Math.sin(a) * 28, a, 'minigun');
      if (r.wepAmmo <= 0) {
        r.wepOver = kitOverheat(r, ab);
        if (r.isP && !R.demo) fl(r.x, r.y, 'ПЕРЕГРЕВ', '#ff9d2e');
      }
      kitGunSound(r, 'wep');
      return;
    }
    if (t === 'gatling') {
      if ((r.wepOver || 0) > 0) return;
      r.cdW = kitWepCd(r, ab);
      r.wepHeat = Math.min(1, (r.wepHeat || 0) + kitHeatStep(r, ab));
      const a = r.ang, off = (Math.random() - 0.5) * 0.18, dmg = kitWepDmg(r, ab);
      kitPushShot(r, a + off, 1020, 0.4, dmg);
      if (r.wepHeat >= 1) {
        r.wepOver = kitOverheat(r, ab); r.wepHeat = 0;
        if (r.isP && !R.demo) fl(r.x, r.y, 'СТВОЛ КИПИТ', '#ff9d2e');
      }
      if (vfxLive()) RnRVfx.muzzle(r.x + Math.cos(a) * 28, r.y + Math.sin(a) * 28, a, 'gatling');
      kitGunSound(r, 'wep');
      return;
    }
    if (t === 'nails' && !kitSliding(r)) {
      if (r.isP && !R.demo) fl(r.x, r.y, 'НУЖЕН ЗАНОС', '#ff5db1');
      return;
    }
    if (r.cloak > 0) r.cloak = 0;
    r.cdW = kitWepCd(r, ab);
    const a = r.ang, dmg = kitWepDmg(r, ab);
    const noise = r.blind > 0 ? 0.28 : 0;
    const lv = kitLvW(r);
    if (typeof fireStarterWeapon === 'function' && fireStarterWeapon(r, ab, t, a, dmg, noise, lv)) {
      /* стартовый хлам */
    } else if (typeof fireMidWeapon === 'function' && fireMidWeapon(r, ab, t, a, dmg, noise, lv)) {
      /* средний класс */
    } else if (t === 'fang') {
      let close = 1;
      for (const o of R.racers) {
        if (o === r || o.dead) continue;
        const dx = o.x - r.x, dy = o.y - r.y, dist = Math.hypot(dx, dy);
        const ahead = Math.cos(a) * dx + Math.sin(a) * dy;
        if (ahead > 8 && ahead < 86 && dist < 96) close = 1.55;
      }
      if (r.dash > 0) close *= 1.22;
      for (const off of [-0.18, 0, 0.18]) kitPushShot(r, a + off + noise, 920, 0.55, (dmg * close) / 3, { fang: true });
    } else if (t === 'saw') {
      let hit = 0;
      for (const o of R.racers) {
        if (o === r || o.dead || o.air || o.finished) continue;
        const dx = o.x - r.x, dy = o.y - r.y, dist = Math.hypot(dx, dy);
        if (dist > 62 + lv * 4) continue;
        const ahead = Math.cos(a) * dx + Math.sin(a) * dy;
        const side = Math.abs(-Math.sin(a) * dx + Math.cos(a) * dy);
        if (ahead > -18 && ahead < 42 && side > 10) {
          dmgRacer(o, dmg, r, 'ram'); hit++; spark(o.x, o.y, '#37c94f', 10, 180);
        }
      }
      if (r.isP && !R.demo) fl(r.x, r.y, hit ? 'ЗУБ!' : 'МИМО', '#37c94f');
    } else if (t === 'homing') {
      kitPushShot(r, a, 640, 2.3, dmg, { rocket: true });
    } else if (t === 'mortar') {
      kitPushShot(r, a, 430, 1.35, dmg, { mortar: true, mrad: 108 + lv * 6 });
    } else if (t === 'plasma') {
      kitPushShot(r, a + noise, 760, 1.05, dmg, { plasma: true });
    } else if (t === 'spikes') {
      if (!R.spikes) R.spikes = [];
      const bx = r.x - Math.cos(a) * 32, by = r.y - Math.sin(a) * 32;
      const px = -Math.sin(a), py = Math.cos(a);
      const span = lv >= 4 ? 3 : 2;
      for (let k = -span; k <= span; k++) R.spikes.push({ x: bx + px * k * 16, y: by + py * k * 16, rot: a, life: 7.5 + lv * 0.5, owner: r });
    } else if (t === 'mine') {
      const bx = r.x - Math.cos(a) * 36, by = r.y - Math.sin(a) * 36;
      R.mines.push({ x: bx, y: by, dead: false, pow: dmg, rad: 92 + lv * 4, i: kitMineId(), arm: 0.45, owner: r, life: 11 });
    } else if (t === 'nails') {
      const back = a + Math.PI;
      for (const off of [-0.42, -0.21, 0, 0.21, 0.42]) kitPushShot(r, back + off, 820, 0.48, dmg, { nails: true });
    } else if (t === 'hook') {
      let bestP = null, pd = 140 + lv * 14;
      for (const p of R.picks || []) {
        if (!p.alive) continue;
        const d = Math.hypot(p.x - r.x, p.y - r.y);
        if (d < pd) { pd = d; bestP = p; }
      }
      if (bestP) {
        bestP.x = r.x; bestP.y = r.y;
        if (r.isP && !R.demo) fl(r.x, r.y, 'СКОБА', '#d45a1a');
      } else {
        let best = null, bd = 118 + lv * 10;
        for (const o of R.racers) {
          if (o === r || o.dead || o.air) continue;
          const d = Math.hypot(o.x - r.x, o.y - r.y);
          if (d < bd) { bd = d; best = o; }
        }
        if (best) {
          const nx = (best.x - r.x) / (bd || 1), ny = (best.y - r.y) / (bd || 1);
          best.ang += 0.28 * (Math.random() > 0.5 ? 1 : -1);
          best.lat = clamp((best.lat || 0) + (-ny * Math.cos(best.ang) + nx * Math.sin(best.ang)) * 70, -140, 140);
          dmgRacer(best, dmg, r, 'proj');
        } else if (r.isP && !R.demo) fl(r.x, r.y, 'ПУСТО', '#d45a1a');
      }
    } else {
      kitPushShot(r, a + noise, 900, 0.9, dmg);
    }
    if (vfxLive() && t !== 'saw' && t !== 'spikes' && t !== 'mine' && t !== 'hook' && t !== 'crowbar' && t !== 'door' && t !== 'lamp') {
      RnRVfx.muzzle(r.x + Math.cos(a) * 26, r.y + Math.sin(a) * 26, a, t);
    }
    if (t !== 'hook' && t !== 'crowbar' && t !== 'door' && t !== 'lamp') kitGunSound(r, 'wep');
  }

  /**
   * Толчок кругом или конусом.
   * @param {object} r
   * @param {number} rad
   * @param {boolean} cone
   */
  function kitShoveEngine(r, rad, cone) {
    R.shocks.push({ x: r.x, y: r.y, r: 12, maxR: rad + 24, t: 0.42 });
    spark(r.x, r.y, '#b478ff', 22, 280);
    const fx = Math.cos(r.ang), fy = Math.sin(r.ang);
    for (const o of R.racers) {
      if (o === r || o.dead || o.air) continue;
      if (o.cloak > 0 && o.car.idx === 5) continue;
      const dx = o.x - r.x, dy = o.y - r.y, d = Math.hypot(dx, dy);
      if (d >= rad) continue;
      if (cone && (dx * fx + dy * fy) < d * 0.25) continue;
      const nx = d < 1 ? fx : (dx / d), ny = d < 1 ? fy : (dy / d);
      o.x = clamp(o.x + nx * 48, 20, R.T.w - 20); o.y = clamp(o.y + ny * 48, 20, R.T.h - 20);
      o.spd = cone ? o.spd * 0.35 : 0; o.nitro = 0;
      spark(o.x, o.y, '#e8d0ff', 10, 160);
    }
  }

  /**
   * Ульта C: рывок, клетка, купол и делегат в киты контента.
   * @param {object} r
   */
  function useUltEngine(r) {
    if (r.dead || r.cdU > 0) return;
    const ab = carAbil(r.car.idx).ult; r.cdU = kitUltCd(r, ab); const t = ab.type;
    const u = kitLvU(r);
    if (t === 'dash') {
      const dur = kitUltDur(r, 1.5);
      r.dash = dur; r.buffDmg = 2; r.buffDmgT = dur; r.spd = Math.max(r.spd, r.st.top * 1.08);
    } else if (t === 'slowmo') {
      const sl = kitUltDur(r, 2);
      for (const o of R.racers) if (o !== r && !o.dead) o.slow = Math.max(o.slow, sl);
    } else if (t === 'cage') {
      const back = r.ang + Math.PI;
      const pow = 30 * (1 + u * 0.1) * (r.dmgMul || 1);
      for (const off of [-0.5, 0, 0.5]) {
        const ang = back + off;
        R.mines.push({
          x: r.x + Math.cos(ang) * 28, y: r.y + Math.sin(ang) * 28, dead: false, pow: pow,
          rad: kitUltRad(r, 86), i: kitMineId(), crawl: true, owner: r, life: 7.5 + u * 0.4, arm: 0.35
        });
      }
    } else if (t === 'recharge') {
      r.shield = Math.min(3, r.shield + 2 + (u >= 4 ? 1 : 0)); r.cdW = 0; resetWepMag(r);
    } else if (t === 'berserk') {
      r.berserk = kitUltDur(r, 3); r.buffArmor = 0.5;
    } else if (t === 'cloak') {
      r.cloak = kitUltDur(r, 3);
    } else if (t === 'plow') kitShove(r, kitUltRad(r, 96), true);
    else if (t === 'ghost') {
      const d = kitUltDur(r, 2.5); r.ghost = d; r.paper = d; r.nitro = Math.max(r.nitro, 1.5);
    } else if (t === 'haze') {
      r.haze = kitUltDur(r, 3.2); r.hazeRad = kitUltRad(r, 118);
    } else if (t === 'bubble') {
      r.bubble = kitUltDur(r, ab.dur || 4.5);
      R.shocks.push({ x: r.x, y: r.y, r: 10, maxR: 70, t: 0.38 });
      spark(r.x, r.y, '#35e0ff', 16, 200);
    } else if (t === 'shove') kitShove(r, kitUltRad(r, ab.rad || 92), false);
    else if (typeof useMidUlt === 'function' && useMidUlt(r, ab, t, u)) { /* средний класс */ }
    else if (typeof useStarterUlt === 'function') useStarterUlt(r, ab, t, u);
    if (typeof playCarWeapon === 'function' && playCarWeapon(r, 'ult')) { /* семпл ульты */ }
    else swp('sine', 1200, 400, 0.2, 0.2);
    if (r.isP && !R.demo) fl(r.x, r.y, ab.name + '!', '#b478ff');
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.replace('kitGunSound', kitGunSoundEngine);
  engine.replace('fireWeapon', fireWeaponEngine);
  engine.replace('kitShove', kitShoveEngine);
  engine.replace('useUlt', useUltEngine);
})(typeof window !== 'undefined' ? window : globalThis);
