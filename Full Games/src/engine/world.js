////////////////////////////////////////////////////////
//
// DiVANEngine: контакт заезда — машины, выстрелы, мины, пикапы.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Шаг мира после движения: разведение корпусов и попадания.
   * @param {number} dt
   */
  function resolveRaceContactEngine(dt) {
    const Rc = R.racers;
    for (let i = 0; i < Rc.length; i++) for (let j = i + 1; j < Rc.length; j++) {
      const a = Rc[i], b = Rc[j]; if (a.dead || b.dead || a.air || b.air) continue;
      if (kitGhost(a) || kitGhost(b)) continue;
      const hit = obbOverlap(carObb(a), carObb(b));
      if (!hit) continue;
      const push = Math.max(hit.pen / 2, 1.15);
      a.x -= hit.nx * push; a.y -= hit.ny * push; b.x += hit.nx * push; b.y += hit.ny * push;
      const rel = Math.abs(a.spd - b.spd);
      const atLine = !!(a.finished || b.finished);
      if (!atLine && rel > 60) {
        let dA = (rel * .015 + 1) * kitRamOut(b) * kitRamIn(a);
        let dB = (rel * .015 + 1) * kitRamOut(a) * kitRamIn(b);
        dA *= (b.dmgMul || 1); dB *= (a.dmgMul || 1);
        if (a.car.idx === 4 || b.car.idx === 4 || a.berserk > 0 || b.berserk > 0) {
          a.x -= hit.nx * 18; a.y -= hit.ny * 18; b.x += hit.nx * 18; b.y += hit.ny * 18;
        }
        dmgRacer(a, dA, b, 'ram'); dmgRacer(b, dB, a, 'ram');
        spark((a.x + b.x) / 2, (a.y + b.y) / 2, '#ffd23f', 6, 160);
        if (typeof voiceSay === 'function') voiceSay(a.spd >= b.spd ? a : b, 'ram', { chance: .42, gap: 6 });
      } else if (atLine) {
        const ra = -Math.sin(a.ang), rb = Math.cos(a.ang);
        const sa = -Math.sin(b.ang), sb = Math.cos(b.ang);
        a.lat = clamp((a.lat || 0) + (hit.nx * ra + hit.ny * rb) * 28, -140, 140);
        b.lat = clamp((b.lat || 0) - (hit.nx * sa + hit.ny * sb) * 28, -140, 140);
        a.spd *= .985; b.spd *= .985;
        if (rel > 50) spark((a.x + b.x) / 2, (a.y + b.y) / 2, 'rgba(200,190,170,.45)', 4, 80);
      }
      if (!atLine) { a.spd *= .97; b.spd *= .97; }
    }
    for (let i = R.shots.length - 1; i >= 0; i--) {
      const s = R.shots[i];
      if (s.rocket) {
        let bestTarget = null, bestDist = 1e9;
        for (const r of R.racers) {
          if (r.dead || r === s.r || r.finished) continue;
          const dx = r.x - s.x, dy = r.y - s.y, dist = Math.hypot(dx, dy);
          if (dist < bestDist && dist < 500) { bestDist = dist; bestTarget = r; }
        }
        if (bestTarget) {
          const dx = bestTarget.x - s.x, dy = bestTarget.y - s.y;
          const targetAng = Math.atan2(dy, dx);
          const curAng = Math.atan2(s.vy, s.vx);
          const diff = angDiff(targetAng, curAng);
          const turn = clamp(diff, -4 * dt, 4 * dt);
          const spd = Math.hypot(s.vx, s.vy);
          const newAng = curAng + turn;
          s.vx = Math.cos(newAng) * spd; s.vy = Math.sin(newAng) * spd;
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
          if (p.type === 'money') { const v = p.val; r.moneyGot += v; if (r.isP) { save.cash += v; fl(p.x, p.y, '+$' + v, '#ffd23f'); SFX.play('money'); } }
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
  engine.world = { resolveContact: resolveRaceContactEngine };
  engine.replace('resolveRaceContact', resolveRaceContactEngine);
})(typeof window !== 'undefined' ? window : globalThis);
