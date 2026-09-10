////////////////////////////////////////////////////////
//
// DiVANEngine: урон, смерть, респаун, нитро, мина.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Игрок в радиусе d от точки.
   * @param {number} x
   * @param {number} y
   * @param {number} d
   * @returns {boolean}
   */
  function nearPEngine(x, y, d) {
    return P && Math.hypot(x - P.x, y - P.y) < d;
  }

  /**
   * Снимает HP с учётом щита, брони и grit.
   * @param {object} r
   * @param {number} d
   * @param {object|null} killer
   * @param {string} [src]
   */
  function dmgRacerEngine(r, d, killer, src) {
    if (r.dead || r.invuln > 0 || r.finished) return;
    src = src || 'proj';
    if (r.bubble > 0 && kitBubbleBlocks(src)) { spark(r.x, r.y, '#35e0ff', 6, 140); return; }
    if (r.shield > 0) {
      if (killer && R.shots && R.shots.some(function (s) { return s.laser && s.r === killer; })) {
        spark(r.x, r.y, '#ff00ff', 15, 200);
      } else {
        r.shield--; spark(r.x, r.y, '#35e0ff', 10, 180); sHit(); return;
      }
    }
    if (killer && killer.isP) killer.dmgDealt += d;
    d *= (r.buffArmor != null ? r.buffArmor : 1);
    if (r.paper > 0 && src === 'proj') d *= 1.35;
    if ((r.bodyDump || 0) > 0) d *= 1.3;
    if (typeof kitTinAbsorb === 'function') d *= kitTinAbsorb(r, src);
    if (typeof kitMidAbsorb === 'function') d *= kitMidAbsorb(r, src);
    d *= (1 - r.ch.grt * .05); r.hp -= d;
    if (r.isP && !R.demo) doShake(4);
    if (r.hp <= 0) killRacer(r, killer);
    else {
      if (!R.demo) sHit();
      if (killer && typeof voiceSay === 'function') voiceSay(r, 'hit', { chance: .38, gap: 6 });
    }
  }

  /**
   * Смерть: взрыв, счётчик киллов, эфир.
   * @param {object} r
   * @param {object|null} killer
   */
  function killRacerEngine(r, killer) {
    r.dead = true; r.respawnT = 2.6; r.spd = 0; r.lat = 0; r.susp = 0; r.steerFlt = 0; r.bob = 0; r.bobVel = 0; r.rockAmp = 0; r.landStun = 0; boom(r.x, r.y, true);
    if (killer && killer.isP) killer.kills++;
    if (R.demo) { titleFollowKiller(killer); return; }
    if (r.isP) doShake(18); sBoom();
    const kn = killer && killer !== r ? racerTag(killer) : '';
    announce(racerTag(r) + ' ' + LINES_DIE[(Math.random() * LINES_DIE.length) | 0] + (kn ? ' ВИНОВНИК: ' + kn : ''));
    if (killer && killer !== r && typeof voiceSay === 'function') voiceSay(killer, 'kill', { chance: .72, gap: 5 });
  }

  /**
   * Возврат на сплайн за 10 точек до смерти, щит «Дьявола».
   * @param {object} r
   */
  function respawnEngine(r) {
    const S = R.S, N = R.N, i = (r.trackIdx - 10 + N) % N, p = S[i];
    r.x = p.x + p.nx * r.aiLane * .5; r.y = p.y + p.ny * r.aiLane * .5; r.ang = p.ang; r.spd = 0; r.lat = 0; r.susp = 0; r.steerFlt = 0;
    r.bob = 0; r.bobVel = 0; r.rockAmp = 0; r.rockT = 0; r.landStun = 0;
    r.hp = r.maxhp; r.dead = false; r.invuln = 2.2; r.bolt = 0; r.nitro = 0; r.bubble = 0; r.z = 0; r.vz = 0; r.air = false; r.jumpCd = 0; r.jumpSpd = 0;
    r.dash = 0; r.ghost = 0; r.paper = 0; r.haze = 0; r.blind = 0; r.cloak = 0; r.berserk = 0; r.slow = 0;
    r.tinDoor = r.car.idx === 11 ? 1 : 0; r.vanDoor = r.car.idx === 19 ? 1 : 0; r.bodyDump = 0; r.soot = 0; r.flipSteer = 0; r.overtake = 0;
    resetWepMag(r);
    if (r.car.idx === 3) r.shield = 1;
  }

  /**
   * Нитро или прыжок по киту кузова.
   * @param {object} r
   */
  function useNitroEngine(r) {
    if (r.dead || r.cdN > 0) return;
    const nb = carAbil(r.car.idx).nitro;
    const red = r.chIdx === 1 ? skillVal(1, r.skillLvl) : 0;
    r.cdN = Math.max(1, (nb.cd * (1 - red)) - (r.nitLvl || 0) * 0.6);
    if (nb.type === 'jump') {
      if (r.air) { r.cdN = 0; return; }
      const sp = Math.max(Math.abs(r.spd), 160);
      r.air = true; r.vz = sp * 0.9; r.jumpSpd = sp; r.jumps++;
      spark(r.x, r.y, 'rgba(200,180,140,.8)', 16, 220);
      if (r.isP && !R.demo) { fl(r.x, r.y, 'ПРЫЖОК!', '#7df9ff'); swp('sine', 280, 720, .22, .2); }
      return;
    }
    r.nitro = 1.6 + (r.nitLvl || 0) * 0.12; if (!R.demo && typeof tickCarNos !== 'function') swp('sawtooth', 150, 500, .4, .2);
    if (typeof voiceSay === 'function') voiceSay(r, 'nitro', { chance: r.isP ? 1 : .45, gap: 8 });
  }

  /**
   * Взрыв мины: урон в радиусе, плащ 05 и броня 04.
   * @param {object} m
   * @param {object|null} owner
   */
  function mineExplodeEngine(m, owner) {
    const pow = m.pow || 36, rad = m.rad || 100;
    boom(m.x, m.y, 'mine'); if (!R.demo) { sBoom(); if (nearP(m.x, m.y, 700)) doShake(8); }
    for (const r of R.racers) {
      if (r.dead) continue;
      if (r.cloak && r.cloak > 0 && r.car.idx === 5) continue;
      const d = Math.hypot(r.x - m.x, r.y - m.y);
      let dmg = (pow - d * .22) * (1 - d / 260);
      if (r.car.idx === 4) dmg *= 0.5;
      if (d < rad) dmgRacer(r, dmg, owner, 'mine');
    }
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.replace('nearP', nearPEngine);
  engine.replace('dmgRacer', dmgRacerEngine);
  engine.replace('killRacer', killRacerEngine);
  engine.replace('respawn', respawnEngine);
  engine.replace('useNitro', useNitroEngine);
  engine.replace('mineExplode', mineExplodeEngine);
})(typeof window !== 'undefined' ? window : globalThis);
