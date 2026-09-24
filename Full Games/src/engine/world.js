////////////////////////////////////////////////////////
//
// DiVANEngine: контакт заезда — машины, выстрелы, мины, пикапы.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';
  let contactRace = null, contactTime = 0, contactPairs = new WeakMap();

  function contactMass(r) {
    const h = global.DiVANEngine.handling;
    return Math.max(.35, Math.min(4, h && h.mass ? h.mass(r) : 1));
  }
  function velocity(r) {
    const angle = Number.isFinite(r.ang) ? r.ang : 0, fx = Math.cos(angle), fy = Math.sin(angle);
    return { x: fx * (r.spd || 0) - fy * (r.lat || 0), y: fy * (r.spd || 0) + fx * (r.lat || 0), fx, fy };
  }
  /** Импульс действует вдоль нормали контакта; масса не зависит от оставшегося HP. */
  function resolvePair(a, b, hit) {
    const length = Math.hypot(hit.nx, hit.ny);
    if (!length || !Number.isFinite(length)) return null;
    const nx = hit.nx / length, ny = hit.ny / length;
    const ma = contactMass(a), mb = contactMass(b), ia = 1 / ma, ib = 1 / mb, sum = ia + ib;
    const va = velocity(a), vb = velocity(b), closing = Math.max(0, (va.x - vb.x) * nx + (va.y - vb.y) * ny);
    const penetration = Math.max(0, Number(hit.pen) || 0) + .05;
    a.x -= nx * penetration * ia / sum; a.y -= ny * penetration * ia / sum;
    b.x += nx * penetration * ib / sum; b.y += ny * penetration * ib / sum;
    const result = { closing, ma, mb, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2,
      attacker: va.x * nx + va.y * ny >= -vb.x * nx - vb.y * ny ? a : b };
    if (closing <= .5) return result;
    const impulse = closing * 1.08 / sum;
    for (const [r, v, inv, sign] of [[a, va, ia, -1], [b, vb, ib, 1]]) {
      const vx = v.x + sign * nx * impulse * inv, vy = v.y + sign * ny * impulse * inv;
      r.spd = vx * v.fx + vy * v.fy;
      // Сильный боковой таран не раскручивает кузов и не отнимает руль.
      const lateralLimit = Math.max(100, Math.abs(r.lat || 0));
      r.lat = clamp(-vx * v.fy + vy * v.fx, -lateralLimit, lateralLimit);
    }
    return result;
  }

  function impactReady(a, b) {
    let pair = contactPairs.get(a);
    if (!pair) { pair = new WeakMap(); contactPairs.set(a, pair); }
    const previous = pair.get(b);
    if (previous != null && contactTime - previous < .22) return false;
    pair.set(b, contactTime);
    let reverse = contactPairs.get(b);
    if (!reverse) { reverse = new WeakMap(); contactPairs.set(b, reverse); }
    reverse.set(a, contactTime);
    return true;
  }

  /** Одна вспышка/звук на удар, без повторного наказания уже расходящихся машин. */
  function contactFeedback(a, b, impact, atLine) {
    if (impact.closing < 28 || !impactReady(a, b)) return;
    const force = clamp(impact.closing / 320, .15, 1);
    for (const r of [a, b]) r._contactGrace = Math.max(r._contactGrace || 0, .28);
    let lost = 0;
    if (!atLine && impact.closing > 60) {
      const base = Math.min(12, 1 + (impact.closing - 50) * .018);
      const hp = (a.hp || 0) + (b.hp || 0);
      dmgRacer(a, base * clamp(2 * impact.mb / (impact.ma + impact.mb), .6, 1.4) * kitRamOut(b) * kitRamIn(a) * (b.dmgMul || 1), b, 'ram');
      dmgRacer(b, base * clamp(2 * impact.ma / (impact.ma + impact.mb), .6, 1.4) * kitRamOut(a) * kitRamIn(b) * (a.dmgMul || 1), a, 'ram');
      lost = hp - ((a.hp || 0) + (b.hp || 0));
      for (const r of [a, b]) {
        r.bobVel = Math.max(-28, (r.bobVel || 0) - 10 * force);
      }
      if (typeof voiceSay === 'function') voiceSay(impact.attacker, 'ram', { chance: .42, gap: 6 });
    }
    const reduced = typeof introReduceMotion !== 'undefined' && introReduceMotion;
    if (!reduced && typeof spark === 'function') spark(impact.x, impact.y, atLine ? '#9badb7' : '#ffd23f', 4 + Math.round(force * 6), 80 + force * 100);
    const near = a.isP || b.isP || typeof nearP === 'function' && nearP(impact.x, impact.y, 500);
    if (!R.demo && near) {
      // Урон уже звучит через dmgRacer; касание и щит получают один короткий удар.
      if (lost <= 0 && typeof sHit === 'function') sHit();
      if (!reduced && (a.isP || b.isP) && typeof doShake === 'function') doShake(1.5 + force * 4);
    }
  }

  /**
   * Шаг мира после движения: разведение корпусов и попадания.
   * @param {number} dt
   */
  function resolveRaceContactEngine(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    if (contactRace !== R) { contactRace = R; contactTime = 0; contactPairs = new WeakMap(); }
    contactTime += dt;
    const Rc = R.racers;
    for (const r of Rc) {
      if (r._contactGrace > 0 && !r.handbrake && !r.air && !r.dead) r.lat = (r.lat || 0) * Math.exp(-3.8 * dt);
    }
    for (let i = 0; i < Rc.length; i++) for (let j = i + 1; j < Rc.length; j++) {
      const a = Rc[i], b = Rc[j]; if (a.dead || b.dead || a.air || b.air) continue;
      if (typeof racerDeck === 'function' && racerDeck(a) !== racerDeck(b)) continue;
      if (kitGhost(a) || kitGhost(b)) continue;
      const hit = obbOverlap(carObb(a), carObb(b));
      if (!hit) continue;
      const impact = resolvePair(a, b, hit);
      if (impact) contactFeedback(a, b, impact, !!(a.finished || b.finished));
    }
    for (let i = R.shots.length - 1; i >= 0; i--) {
      const s = R.shots[i];
      if (s.rocket) {
        const curAng = Math.atan2(s.vy, s.vx);
        // Один захват в узком конусе при запуске. Промах не выбирает новую жертву за спиной.
        if (!s.targetLocked) {
          s.targetLocked = true; s.target = null;
          let bestDist = 500;
          for (const r of R.racers) {
            if (r.dead || r === s.r || r.finished || r.cloak > 0 || (typeof kitGhost === 'function' && kitGhost(r))) continue;
            const dx = r.x - s.x, dy = r.y - s.y, dist = Math.hypot(dx, dy);
            if (dist < bestDist && Math.abs(angDiff(Math.atan2(dy, dx), curAng)) < .65) { bestDist = dist; s.target = r; }
          }
        }
        if (s.target) {
          const target = s.target, dx = target.x - s.x, dy = target.y - s.y;
          const targetAng = Math.atan2(dy, dx);
          const diff = angDiff(targetAng, curAng);
          if (target.dead || target.finished || target.cloak > 0 || (typeof kitGhost === 'function' && kitGhost(target)) || Math.hypot(dx, dy) > 700 || Math.abs(diff) > 1.2) s.target = null;
          else {
            // Доворот ограничен: резкая смена полосы, разъезд и маскировка срывают наведение.
            const turn = clamp(diff, -.4 * dt, .4 * dt), spd = Math.hypot(s.vx, s.vy), newAng = curAng + turn;
            s.vx = Math.cos(newAng) * spd; s.vy = Math.sin(newAng) * spd;
          }
        }
        if (Math.random() < dt * 60) {
          if (vfxLive()) RnRVfx.trail(s.x, s.y);
          else R.parts.push({ x: s.x, y: s.y, vx: rnd(-30, 30), vy: rnd(-30, 30), t: .4, col: '#ff9d2e', sz: rnd(3, 6) });
        }
      }
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      let hit = false;
      for (const r of R.racers) {
        if (r.dead || r === s.r || r.finished) continue;
        if (pointInObb(s.x, s.y, carObb(r))) {
          let dmg = s.dmg || 14;
          if (r.car.idx === 4) dmg *= 0.5;
          if (!s.mortar) dmgRacer(r, dmg, s.r, 'proj');
          if (typeof kitOnShotHit === 'function') kitOnShotHit(s, r);
          if (s.rocket) { boom(s.x, s.y, 'rocket'); if (!R.demo) { sBoom(); doShake(10); } }
          else if (!s.mortar) spark(s.x, s.y, '#ff9d2e', 8, 200);
          hit = true; break;
        }
      }
      if (!hit && s.life <= 0) { if (typeof kitOnShotExpire === 'function') kitOnShotExpire(s); hit = true; }
      if (hit) R.shots.splice(i, 1);
    }
    if (typeof tickCrawlMines === 'function') tickCrawlMines(dt);
    for (const m of R.mines) {
      if (m.dead) continue;
      if (m.arm > 0) continue;
      for (const r of R.racers) {
        if (r.dead || r.air || r.finished || (r.car.idx === 5 && r.cloak > 0)) continue;
        if (m.owner === r && m.life != null && m.life > 9) continue;
        if (!pointInObb(m.x, m.y, carObb(r))) continue;
        if (r.chIdx === 3) {
          if (!r.mineSeen) r.mineSeen = new Set();
          if (r.mineSeen.has(m.i)) continue;
          r.mineSeen.add(m.i);
          if (Math.random() < skillVal(3, r.skillLvl)) {
            if (r.isP) fl(r.x, r.y, 'УКЛОН!', '#7fb2ff');
            continue;
          }
        }
        m.dead = true; mineExplode(m, m.owner || null); break;
      }
    }
    if (R.spikes) {
      for (let i = R.spikes.length - 1; i >= 0; i--) {
        const sp = R.spikes[i];
        sp.life -= dt;
        if (sp.life <= 0) { R.spikes.splice(i, 1); continue; }
        for (const r of R.racers) {
          if (r.dead || r.air || r.finished || (r.car.idx === 5 && r.cloak > 0)) continue;
          if (sp.owner === r) continue;
          if (pointInObb(sp.x, sp.y, carObb(r))) {
            r.spd *= .6;
            spark(r.x, r.y, '#8b4513', 8, 120);
            if (r.isP) fl(r.x, r.y, 'ШИПЫ! -40% СКОРОСТИ', '#ff6b4a');
            R.spikes.splice(i, 1);
            break;
          }
        }
      }
    }
    for (const p of R.pads) {
      p.cool -= dt;
      if (p.cool <= 0) for (const r of R.racers) {
        if (r.dead || r.air) continue;
        if (Math.hypot(r.x - p.x, r.y - p.y) < 48) {
          r.spd = Math.min(r.spd + 180, r.st.top * 1.6); r.bolt = Math.max(r.bolt, .7); p.cool = 3;
          spark(p.x, p.y, '#35e0ff', 8, 160); if (!R.demo && nearP(p.x, p.y, 600)) swp('sine', 300, 900, .2, .2); break;
        }
      }
    }
    for (const p of R.picks) {
      if (!p.alive) { p.rt -= dt; if (p.rt <= 0) p.alive = true; continue; }
      for (const r of R.racers) {
        if (r.dead || r.finished || r.air) continue;
        const mag = carAbil(r.car.idx).passive;
        let dist = Math.hypot(r.x - p.x, r.y - p.y);
        if (mag && mag.magnet && dist < mag.rad && (!mag.types || mag.types.indexOf(p.type) >= 0)) {
          const pull = Math.min(dist, (mag.pull || 240) * dt);
          if (dist > 1) { p.x += (r.x - p.x) / dist * pull; p.y += (r.y - p.y) / dist * pull; }
          dist = Math.hypot(r.x - p.x, r.y - p.y);
        }
        if (dist < 34) {
          p.alive = false; p.rt = 9;
          r.pickups++;
          if (p.type === 'money') {
            const base = p.val;
            const v = r.isP && typeof incomePayout === 'function' ? incomePayout(base) : base;
            r.moneyGot += v;
            if (r.isP && !R.replay) { save.cash += v; fl(p.x, p.y, '+$' + v, '#ffd23f'); SFX.play('money'); }
          }
          else if (p.type === 'wrench') {
            if (typeof kitStarterWrench === 'function' && kitStarterWrench(r)) { if (r.isP) sPick(); }
            else if (typeof kitMidWrench === 'function' && kitMidWrench(r)) { if (r.isP) sPick(); }
            else { r.hp = Math.min(r.maxhp, r.hp + 30); if (r.isP) { fl(p.x, p.y, '+РЕМОНТ', '#58ff6b'); sPick(); } }
          }
          else if (p.type === 'shield') { r.shield = 3; if (r.isP) { fl(p.x, p.y, 'ЩИТ!', '#35e0ff'); sPick(); } }
          else if (p.type === 'bolt') { r.bolt = 3; if (r.isP) { fl(p.x, p.y, 'ТУРБО!', '#35e0ff'); sPick(); } }
          else if (p.type === 'nit') {
            r.cdN = Math.max(0, r.cdN - 4);
            if (r.isP) { fl(p.x, p.y, (carAbil(r.car.idx).nitro.type === 'jump' ? 'ПРЫЖОК ГОТОВ' : 'НИТРО ГОТОВО'), '#ff9d2e'); sPick(); }
          }
          else if (p.type === 'wep') {
            const wab = carAbil(r.car.idx).weapon;
            if (wab.type === 'minigun') {
              if (r.wepOver > 0) {
                r.wepOver = Math.max(0, r.wepOver - 1.4);
                if (r.wepOver <= 0) resetWepMag(r);
                if (r.isP) { fl(p.x, p.y, r.wepOver > 0 ? 'ОХЛАЖДЕНИЕ' : 'МАГАЗИН', '#ff6b4a'); sPick(); }
              } else if (r.isP) { fl(p.x, p.y, 'ОЧЕРЕДЬ НЕ КОПИТСЯ', '#ff6b4a'); sPick(); }
            } else {
              r.cdW = Math.max(0, r.cdW - 1); if (r.isP) { fl(p.x, p.y, 'ОРУЖИЕ ГОТОВО', '#ff6b4a'); sPick(); }
            }
          }
          else if (p.type === 'ult') { r.cdU = Math.max(0, r.cdU - 4); if (r.isP) { fl(p.x, p.y, 'УЛЬТА ГОТОВА', '#b478ff'); sPick(); } }
          break;
        }
      }
    }
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.world = { resolveContact: resolveRaceContactEngine, resolvePair, contactMass };
  engine.replace('resolveRaceContact', resolveRaceContactEngine);
})(typeof window !== 'undefined' ? window : globalThis);
