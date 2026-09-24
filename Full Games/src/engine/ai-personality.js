// Характер соперника меняет траекторию и решения, а не скрытую мощность машины.
(function (global) {
  'use strict';
  const PROFILES = Object.freeze({
    aggressive: Object.freeze({ id: 'aggressive', name: 'АГРЕССОР', look: .43, corner: 1.08, spacing: 74, laneRate: 4.4, attack: 1.22, windup: .32, burst: .65 }),
    cautious: Object.freeze({ id: 'cautious', name: 'ОСТОРОЖНЫЙ', look: .70, corner: .86, spacing: 135, laneRate: 2.8, attack: .68, windup: .50, burst: .38 }),
    technical: Object.freeze({ id: 'technical', name: 'ТЕХНИЧНЫЙ', look: .58, corner: 1, spacing: 100, laneRate: 5.2, attack: .94, windup: .40, burst: .52 })
  });
  const PILOTS = ['aggressive', 'technical', 'aggressive', 'cautious', 'technical', 'aggressive'];
  const IDS = ['aggressive', 'cautious', 'technical'];
  const limit = (n, a, b) => Math.max(a, Math.min(b, n));
  function profile(r) {
    if (r && Object.prototype.hasOwnProperty.call(PROFILES, r.aiStyle)) return PROFILES[r.aiStyle];
    const id = r && PILOTS[r.chIdx];
    return PROFILES[id || IDS[Math.abs(((r && r.car && r.car.idx) | 0) + ((r && r.slot) | 0)) % 3]];
  }
  function sameDeck(a, b) {
    return typeof racerDeck !== 'function' || racerDeck(a) === racerDeck(b);
  }
  function validTarget(r, o) {
    return !!o && o !== r && !o.dead && !o.finished && !(o.cloak > 0) && sameDeck(r, o) &&
      !(typeof storyAllyHoldsFire === 'function' && storyAllyHoldsFire(r, o));
  }
  /** Неподходящий сосед не заслоняет подходящую цель; сюжетные запреты сохраняются. */
  function chooseTarget(r, race, weaponOnly) {
    let target = null, distance = Infinity;
    for (const o of race.racers || []) {
      if (!validTarget(r, o)) continue;
      const d = Math.hypot(o.x - r.x, o.y - r.y);
      if (d >= distance || d > 450) continue;
      if (weaponOnly && !kitAiWantsFire(r, o, d)) continue;
      target = o; distance = d;
    }
    return { target, distance };
  }
  /** Плавная полоса, обзор нескольких точек поворота и торможение по реальной скорости. */
  function drivePlan(r, race, dt) {
    const style = profile(r), S = race.S, N = S.length;
    const speed = Math.abs(r.spd || 0), index = ((r.trackIdx | 0) % N + N) % N;
    let look = Math.min(N - 1, Math.max(6, Math.round(8 + speed * style.look / 14)));
    const scan = Math.min(N - 1, Math.max(26, look + 12));
    let curvature = 0, bend = 0;
    for (let ahead = 2; ahead <= scan; ahead += 2) {
      const sample = S[(index + ahead) % N], k = Math.abs(sample.k || 0);
      if (k > curvature) { curvature = k; bend = angDiff(sample.ang || 0, S[index].ang || 0); }
    }
    // Дальний обзор нужен для торможения, но цель руля не должна срезать
    // хорду шпильки через внутренний рельс.
    if (curvature > .0015) look = Math.min(look, Math.max(5, Math.floor(.45 / (curvature * 14))));
    const road = typeof ROADW === 'number' ? ROADW : 95;
    const edge = Math.max(12, Math.min(55, road - 36));
    let lane = style.id === 'technical' ? Math.sign(bend) * Math.min(28, curvature * 1400) :
      style.id === 'aggressive' ? (((r.slot | 0) % 3) - 1) * 15 : 0;
    const p = S[index], fx = Math.cos(r.ang), fy = Math.sin(r.ang);
    let front = null, frontDistance = Infinity;
    for (const o of race.racers || []) {
      if (o === r || o.dead || o.finished || o.air || !sameDeck(r, o)) continue;
      const dx = o.x - r.x, dy = o.y - r.y, ahead = dx * fx + dy * fy, across = -dx * fy + dy * fx;
      const gap = style.spacing + Math.max(0, speed - Math.abs(o.spd || 0)) * .35;
      if (ahead > 0 && ahead < gap && Math.abs(across) < 46 && ahead < frontDistance) { front = o; frontDistance = ahead; }
    }
    let blocked = false;
    if (front) {
      const otherLane = (front.x - p.x) * p.nx + (front.y - p.y) * p.ny;
      const side = Math.abs(otherLane) < 8 ? ((r.slot | 0) % 2 ? 1 : -1) : -Math.sign(otherLane);
      const options = [side * edge, -side * edge];
      const free = options.find(candidate => !(race.racers || []).some(o => {
        if (o === r || o === front || o.dead || o.air || !sameDeck(r, o)) return false;
        const ahead = (o.x - r.x) * fx + (o.y - r.y) * fy;
        const across = (o.x - p.x) * p.nx + (o.y - p.y) * p.ny;
        return ahead > -55 && ahead < style.spacing && Math.abs(across - candidate) < 35;
      }));
      if (free != null) lane = free;
      else blocked = true;
    }
    const skill = limit(Number(r.skill) || .75, .5, 1.2);
    const top = r.st && r.st.top || 360, grip = r.st && r.st.grip || .7;
    let targetSpeed = Math.min(top, Math.sqrt(Math.max(.42, grip) * 450 / Math.max(.001, curvature)) * style.corner * (.91 + skill * .09));
    if (front && (blocked || frontDistance < style.spacing * .55)) {
      // Свободный объезд требует небольшого хода: руль стоящей машины не
      // способен вывести её на соседнюю полосу. В закрытом коридоре ждём.
      targetSpeed = Math.min(targetSpeed, Math.max(blocked ? 0 : 48, Math.abs(front.spd || 0) - (blocked ? 12 : 0)));
    }
    r.aiLane = (Number(r.aiLane) || 0) + (limit(lane, -edge, edge) - (Number(r.aiLane) || 0)) * (1 - Math.exp(-style.laneRate * dt));
    const q = S[(index + look) % N];
    const angle = angDiff(Math.atan2(q.y + q.ny * r.aiLane - r.y, q.x + q.nx * r.aiLane - r.x), r.ang);
    const steer = limit(angle * (style.id === 'technical' ? 2.65 : 2.4), -1, 1);
    const throttle = speed > targetSpeed + 6 ? -limit((speed - targetSpeed) / 110, .12, .8) : targetSpeed < 35 && speed > targetSpeed ? 0 : 1;
    return { throttle, steer, targetSpeed, targetLane: lane, curvature, blocked, style: style.id };
  }
  global.DiVANEngine.aiPersonality = { profiles: PROFILES, profile, sameDeck, validTarget, chooseTarget, drivePlan };
})(typeof window !== 'undefined' ? window : globalThis);
