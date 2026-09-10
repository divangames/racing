////////////////////////////////////////////////////////
//
// DiVANEngine: таймеры кита, ползучие мины, попадание, ИИ ствола.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Таймеры кита на машине.
   * @param {object} r
   * @param {number} dt
   */
  function tickCarKitsEngine(r, dt) {
    if (r.dash > 0) r.dash = Math.max(0, r.dash - dt);
    if (r.ghost > 0) r.ghost = Math.max(0, r.ghost - dt);
    if (r.paper > 0) r.paper = Math.max(0, r.paper - dt);
    if (r.haze > 0) r.haze = Math.max(0, r.haze - dt);
    if (r.blind > 0) r.blind = Math.max(0, r.blind - dt);
    if ((r.wepHeat || 0) > 0 && r.cdW <= 0) r.wepHeat = Math.max(0, r.wepHeat - dt * 0.22);
    if (r.haze > 0) {
      for (const o of R.racers) {
        if (o === r || o.dead) continue;
        if (Math.hypot(o.x - r.x, o.y - r.y) < (r.hazeRad || 118)) o.blind = Math.max(o.blind || 0, 0.25);
      }
    }
    if (typeof tickStarterRacer === 'function') tickStarterRacer(r, dt);
    if (typeof tickMidRacer === 'function') tickMidRacer(r, dt);
  }

  /**
   * Ползучие мины «Клетки».
   * @param {number} dt
   */
  function tickCrawlMinesEngine(dt) {
    for (const m of R.mines) {
      if (m.dead) continue;
      if (m.arm > 0) m.arm -= dt;
      if (m.life != null) { m.life -= dt; if (m.life <= 0) m.dead = true; }
      if (!m.crawl || m.dead) continue;
      let best = null, bd = 220;
      for (const o of R.racers) {
        if (o.dead || o === m.owner || o.finished) continue;
        const d = Math.hypot(o.x - m.x, o.y - m.y);
        if (d < bd) { bd = d; best = o; }
      }
      if (!best) continue;
      const d = Math.hypot(best.x - m.x, best.y - m.y) || 1;
      m.x += (best.x - m.x) / d * 70 * dt; m.y += (best.y - m.y) / d * 70 * dt;
    }
  }

  /**
   * Попадание снаряда: плазма замедляет, гаубица рвётся.
   * @param {object} s
   * @param {object} victim
   */
  function kitOnShotHitEngine(s, victim) {
    if (s.plasma) victim.slow = Math.max(victim.slow || 0, 1.35);
    if (s.mortar) kitMortarBoom(s.x, s.y, s.dmg, s.r, s.mrad);
    if (typeof kitStarterShotHit === 'function') kitStarterShotHit(s, victim);
    if (typeof kitMidShotHit === 'function') kitMidShotHit(s, victim);
  }

  /**
   * Снаряд истёк.
   * @param {object} s
   */
  function kitOnShotExpireEngine(s) {
    if (s.mortar) kitMortarBoom(s.x, s.y, s.dmg, s.r, s.mrad);
    if (typeof kitStarterShotExpire === 'function') kitStarterShotExpire(s);
    if (typeof kitMidShotExpire === 'function') kitMidShotExpire(s);
  }

  /**
   * ИИ: когда жать оружие.
   * @param {object} r
   * @param {object|null} bestT
   * @param {number} bd
   * @returns {boolean}
   */
  function kitAiWantsFireEngine(r, bestT, bd) {
    const t = carAbil(r.car.idx).weapon.type;
    if (t === 'saw' || t === 'crowbar' || t === 'door') return bestT && bd < 70;
    if (t === 'mine' || t === 'spikes') {
      if (!bestT) return false;
      const ahead = Math.cos(r.ang) * (bestT.x - r.x) + Math.sin(r.ang) * (bestT.y - r.y);
      return ahead < 8 && bd < 160;
    }
    if (t === 'nails') return kitSliding(r) && bestT && bd < 150;
    if (t === 'hook') return true;
    if (bestT && bd < 400 && Math.abs(angDiff(Math.atan2(bestT.y - r.y, bestT.x - r.x), r.ang)) < 0.4) return true;
    return false;
  }

  /**
   * Рисунок снаряда.
   * @param {object} s
   * @returns {{fill:string,core:string,w:number,h:number}}
   */
  function kitShotStyleEngine(s) {
    if (s.rocket) return { fill: '#ff3d2e', core: '#ff9d2e', w: 20, h: 6 };
    if (s.plasma) return { fill: '#b478ff', core: '#e8d0ff', w: 18, h: 5 };
    if (s.mortar) return { fill: '#ff6b2e', core: '#ffd23f', w: 14, h: 8 };
    if (s.nails) return { fill: '#ff5db1', core: '#fff', w: 10, h: 2 };
    if (s.fang) return { fill: '#d24a22', core: '#ffd23f', w: 14, h: 3 };
    if (s.can) return { fill: '#c45c28', core: '#ff9d2e', w: 12, h: 8 };
    if (s.baton) return { fill: '#c8a428', core: '#fff', w: 18, h: 3 };
    if (s.bolts) return { fill: '#d8c45a', core: '#fff', w: 6, h: 6 };
    if (s.meter) return { fill: '#e8c428', core: '#fff', w: 12, h: 4 };
    if (s.oilcan) return { fill: '#3a3020', core: '#6a5a38', w: 12, h: 8 };
    if (s.dart) return { fill: '#c42838', core: '#fff', w: 10, h: 3 };
    return { fill: '#ffd23f', core: '#fff', w: 16, h: 4 };
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.replace('tickCarKits', tickCarKitsEngine);
  engine.replace('tickCrawlMines', tickCrawlMinesEngine);
  engine.replace('kitOnShotHit', kitOnShotHitEngine);
  engine.replace('kitOnShotExpire', kitOnShotExpireEngine);
  engine.replace('kitAiWantsFire', kitAiWantsFireEngine);
  engine.replace('kitShotStyle', kitShotStyleEngine);
})(typeof window !== 'undefined' ? window : globalThis);
