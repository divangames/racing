// Боевой слой киберпанк-HUD: игрок, ближайшие угрозы и подтверждённый урон.
(function (global) {
  'use strict';
  const C = { bg: 'rgba(7,15,22,.86)', line: '#35505c', text: '#e7eff0', mute: '#9badb7', cyan: '#21ddff', gold: '#ffd23f', red: '#ff3158' };
  const FEEDBACK_SECONDS = .85, THREAT_SECONDS = 1.2, THREAT_RADIUS = 52;
  let feedbackRace = null, incoming = null, outgoing = null;

  /** Возвращает действующие координаты вооружения и карты для внешних проверок. */
  function layout(width, height) {
    const box = DiVANEngine.cyberHud.layout(width, height);
    return { ...box.arsenal, map: box.map };
  }
  /** На маленьком окне интерфейс не уменьшается вместе с миром до нечитаемого текста. */
  function viewport() {
    return DiVANEngine.cyberHud.viewport();
  }
  /** Возвращает состояние оружия из реального магазина, перегрева и задержки выстрела. */
  function weaponState(r, weapon, magazine, heatMax) {
    if (r.dead) return { text: 'НЕДОСТУПНО', ratio: 0, ready: false };
    if (r.wepOver > 0) return { text: (magazine > 0 ? 'ПЕРЕЗАРЯДКА ' : 'ОХЛАЖДЕНИЕ ') + r.wepOver.toFixed(1) + 'с', ratio: clamp(1 - r.wepOver / Math.max(.001, heatMax), 0, 1), ready: false };
    if (magazine > 0) return { text: (r.wepAmmo | 0) + ' / ' + magazine, ratio: clamp(r.wepAmmo / magazine, 0, 1), ready: r.wepAmmo > 0 && r.cdW <= 0 };
    if (weapon.type === 'gatling') return { text: 'НАГРЕВ ' + Math.round((r.wepHeat || 0) * 100) + '%', ratio: clamp(1 - (r.wepHeat || 0), 0, 1), ready: r.cdW <= 0 };
    if (weapon.type === 'nails' && r.cdW <= 0 && !kitSliding(r)) return { text: 'НУЖЕН ЗАНОС', ratio: 0, ready: false };
    return { text: r.cdW > 0 ? 'ГОТОВНОСТЬ ' + r.cdW.toFixed(1) + 'с' : 'ГОТОВО', ratio: r.cdW > 0 ? 0 : 1, ready: r.cdW <= 0 };
  }
  /** Предсказывает ближайший пролёт вражеского снаряда, не выдавая все объекты карты. */
  function threats(race, player) {
    if (player.dead || player.finished) return [];
    const found = [], fx = Math.cos(player.ang), fy = Math.sin(player.ang), lat = player.lat || 0;
    for (const rival of race.racers || []) {
      if (rival === player || rival.dead || rival.finished || rival.cloak > 0) continue;
      if (typeof racerDeck === 'function' && racerDeck(rival) !== racerDeck(player)) continue;
      const intent = DiVANEngine.ai && DiVANEngine.ai.intent(rival);
      if (intent && intent.target === player) found.push({ x: rival.x, y: rival.y, time: intent.remaining,
        progress: intent.progress, kind: intent.kind === 'ult' ? 'УЛЬТА' : 'ПРИЦЕЛ' });
    }
    for (const shot of race.shots || []) {
      if (shot.r === player || shot.life <= 0) continue;
      const dx = shot.x - player.x, dy = shot.y - player.y;
      if (shot.rocket && shot.target === player && Math.hypot(dx, dy) < 650) {
        found.push({ x: shot.x, y: shot.y, time: Math.hypot(dx, dy) / Math.max(100, Math.hypot(shot.vx, shot.vy)), kind: 'РАКЕТА' });
        continue;
      }
      const vx = shot.vx - fx * player.spd + fy * lat, vy = shot.vy - fy * player.spd - fx * lat;
      const vv = vx * vx + vy * vy;
      if (!Number.isFinite(vv) || vv < 1) continue;
      const t = -(dx * vx + dy * vy) / vv;
      if (t < 0 || t > Math.min(THREAT_SECONDS, shot.life == null ? THREAT_SECONDS : shot.life)) continue;
      if (Math.hypot(dx + vx * t, dy + vy * t) > THREAT_RADIUS) continue;
      found.push({ x: shot.x, y: shot.y, time: t, kind: 'СНАРЯД' });
    }
    for (const mine of race.mines || []) {
      if (mine.dead || mine.arm > 0 || (mine.owner === player && mine.life > 9) || player.air) continue;
      const distance = Math.hypot(mine.x - player.x, mine.y - player.y);
      if (distance < 170) found.push({ x: mine.x, y: mine.y, time: distance / Math.max(100, Math.abs(player.spd)), kind: 'МИНА' });
    }
    return found.sort((a, b) => a.time - b.time).slice(0, 3);
  }
  /** Печатает ограниченную по ширине подпись в стиле исходной телеметрии. */
  function label(text, x, y, size = 12, color = C.text, align = 'left', maxWidth = 600) {
    g.font = `600 ${size}px ${F_B}`; g.fillStyle = color; g.textAlign = align; g.textBaseline = 'middle';
    g.fillText(String(text), x, y, maxWidth);
  }
  /** Преобразует мировую точку точно так же, как игровой рендер. */
  function screen(x, y) { const z = raceZoom(); return { x: (x - R.cam.x + R.sx) * z, y: (y - R.cam.y + R.sy) * z }; }
  /** Место берётся из той же очереди, что и табло; подпись движется вместе с машиной. */
  function raceTag(r,x,y) {
    if (typeof labTest !== 'undefined' && labTest) return;
    const index=(R.order||[]).indexOf(r);
    if(index<0) return;
    const color=r===P?C.cyan:C.red;
    g.fillStyle=C.bg;g.strokeStyle=color;g.lineWidth=1;
    g.beginPath();g.moveTo(x-36,y-11);g.lineTo(x+32,y-11);g.lineTo(x+36,y-7);
    g.lineTo(x+36,y+11);g.lineTo(x-32,y+11);g.lineTo(x-36,y+7);g.closePath();g.fill();g.stroke();
    label((index+1)+(r===P?' · ВЫ':' МЕСТО'),x,y,12,color,'center',64);
  }
  /** Скобки обозначают игрока, а красные ромбы — не более трёх близких угроз. */
  function markers() {
    if (feedbackRace !== R) { incoming = outgoing = null; feedbackRace = R; }
    const p = screen(P.x, P.y - (P.z || 0)), half = carHitHalf(P), z = raceZoom();
    const radius = Math.max(24, Math.hypot(half.hw, half.hh) * z + 7);
    if (!P.dead) {
      g.strokeStyle = C.cyan; g.lineWidth = 2; g.beginPath();
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        g.moveTo(p.x + sx * radius, p.y + sy * (radius - 9)); g.lineTo(p.x + sx * radius, p.y + sy * radius); g.lineTo(p.x + sx * (radius - 9), p.y + sy * radius);
      }
      g.stroke();
      raceTag(P,p.x,p.y-radius-18);
    }
    // Красные шкалы принадлежат только видимым соперникам; маскировка не раскрывается.
    for (const r of R.racers) {
      if (r === P || r.dead || r.cloak > 0) continue;
      const s = screen(r.x, r.y - (r.z || 0));
      if (s.x < 0 || s.x > viewW || s.y < 0 || s.y > viewH) continue;
      const offset = Math.hypot(carHitHalf(r).hw, carHitHalf(r).hh) * z + 14;
      raceTag(r,s.x,s.y-offset-21);
      g.fillStyle = 'rgba(3,12,20,.9)'; g.fillRect(s.x - 20, s.y - offset - 5, 40, 5);
      g.fillStyle = C.red; g.fillRect(s.x - 20, s.y - offset - 5, 40 * clamp(r.hp / Math.max(1,r.maxhp),0,1), 3);
      g.beginPath(); g.moveTo(s.x-4,s.y-offset+3); g.lineTo(s.x+4,s.y-offset+3); g.lineTo(s.x,s.y-offset+9); g.closePath(); g.fill();
      if (r.aiStyle && DiVANEngine.aiPersonality) label(DiVANEngine.aiPersonality.profile(r).name, s.x, s.y - offset + 19, 9, C.mute, 'center', 96);
    }
    drawThreats();
    if (incoming && R.time - incoming.at < FEEDBACK_SECONDS) {
      if (incoming.angle != null) {
        g.strokeStyle = C.red; g.lineWidth = 4; g.beginPath(); g.arc(p.x, p.y, radius + 12, incoming.angle - .45, incoming.angle + .45); g.stroke();
      }
      label(incoming.text, p.x, p.y + radius + 19, 12, C.red, 'center');
    }
    if (outgoing && R.time - outgoing.at < FEEDBACK_SECONDS) label('ПОПАДАНИЕ −' + Math.round(outgoing.damage), p.x, p.y - radius - 60, 12, C.gold, 'center');
  }
  /** Предупреждения об атаке остаются видимыми и при полном табло позиций. */
  function drawThreats() {
    for (const threat of threats(R, P)) {
      const s = screen(threat.x, threat.y), x = clamp(s.x, 20, viewW - 20), y = clamp(s.y, 110, viewH - 105);
      const preparing = threat.progress != null, color = preparing ? C.gold : C.red;
      g.strokeStyle = color; g.lineWidth = 2; g.beginPath();
      g.moveTo(x, y - 9); g.lineTo(x + 9, y); g.lineTo(x, y + 9); g.lineTo(x - 9, y); g.closePath(); g.stroke();
      if (preparing) {
        g.beginPath(); g.arc(x, y, 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * threat.progress); g.stroke();
      }
      label(threat.kind + (preparing ? ' ' + Math.max(0, threat.time).toFixed(1) + 'с' : ''), x, y - 23, 10, color, 'center');
    }
  }
  /** Боевой вид использует общий новый HUD и короткий список позиций. */
  function draw() {
    if (feedbackRace !== R) { incoming = outgoing = null; feedbackRace = R; }
    g.save(); g.setTransform(viewS, 0, 0, viewS, 0, 0); tickHudFx();
    markers();
    DiVANEngine.cyberHud.draw(false);
    g.restore();
  }
  /** Учитывает лишь фактически потерянное здоровье: щит и неуязвимость не дают ложных попаданий. */
  DiVANEngine.wrap('dmgRacer', original => function(r, damage, attacker, source) {
    const before = r.hp;
    const result = original(r, damage, attacker, source);
    const lost = Math.max(0, before - Math.max(0, r.hp));
    if (!R || R.demo || !lost) return result;
    if (feedbackRace !== R) { incoming = outgoing = null; feedbackRace = R; }
    if (r.isP) {
      const cause = { ram: 'ТАРАН', crush: 'УДАР', mine: 'МИНА', proj: 'ОБСТРЕЛ', arena: 'АРЕНА' }[source || 'proj'] || 'УРОН';
      incoming = { at: R.time, angle: attacker && attacker !== r ? Math.atan2(attacker.y - r.y, attacker.x - r.x) : null, text: cause + ' −' + Math.round(lost) };
    } else if (attacker && attacker.isP) outgoing = { at: R.time, damage: lost };
    return result;
  });
  DiVANEngine.wrap('drawHUD', previous => function() {
    if (!R || !P || paused || R.phase !== 'go' || P.finished) return previous();
    if (settings.graphics.combatHud === false) {
      const result = previous();
      g.save(); g.setTransform(viewS, 0, 0, viewS, 0, 0); drawThreats(); g.restore();
      return result;
    }
    draw();
  });
  /** F6 не перехватывается, если игрок назначил эту клавишу одному из своих действий. */
  global.addEventListener('keydown', event => {
    if (event.code !== 'F6' || event.repeat || state !== 'race' || event.ctrlKey || event.altKey || event.metaKey) return;
    if (Object.values(settings.controls || {}).some(keys => Array.isArray(keys) && keys.includes('F6'))) return;
    settings.graphics.combatHud = settings.graphics.combatHud === false;
    saveSettings(); event.preventDefault();
  });
  DiVANEngine.combatHud = { layout, viewport, weaponState, threats, drawThreats, drawMarkers: markers, feedback: () => ({ incoming, outgoing }) };
})(typeof window !== 'undefined' ? window : globalThis);
