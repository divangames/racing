////////////////////////////////////////////////////////
//
// DiVANEngine: слои арены заезда (земля → машины → эфир).
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  const FINISH_LABEL_ALONG_SCALE = 1.18;
  const FINISH_LABEL_SIZE = 18;
  const FINISH_LABEL_COLOR = '#b59a46';
  const ARENA_SPRITES = {
    pad: 0, ramp: 1, oil: 2, mine: 3, spikes: 4,
    money: 5, wrench: 6, wep: 7, ult: 8, nit: 9,
    shield: 10, bolt: 11, bullet: 12, rocket: 13, laser: 14,
    plasma: 15, mortar: 16, nails: 17, fang: 18, special: 19
  };
  const arenaAtlas = typeof Image === 'undefined' ? null : new Image();
  if (arenaAtlas) arenaAtlas.src = '/__engine/sprites/arena-atlas.svg';
  const ARENA_TEXTURE_PATHS = {
    pad: '/__engine/sprites/arena-pad.png',
    ramp: '/__engine/sprites/arena-ramp.png',
    oil: '/__engine/sprites/arena-oil.png',
    mine: '/__engine/sprites/arena-mine.png',
    money: '/__engine/sprites/arena-money.png',
    wrench: '/__engine/sprites/arena-wrench.png',
    wep: '/__engine/sprites/arena-wep.png',
    ult: '/__engine/sprites/arena-ult.png',
    nit: '/__engine/sprites/arena-nit.png',
    shield: '/__engine/sprites/arena-shield.png',
    bolt: '/__engine/sprites/arena-bolt.png'
  };
  const arenaTextures = {};
  if (typeof Image !== 'undefined') for (const type of Object.keys(ARENA_TEXTURE_PATHS)) {
    const sprite = new Image();
    sprite.src = ARENA_TEXTURE_PATHS[type];
    arenaTextures[type] = sprite;
  }

  /** Textured world objects use the same footprint and rotation as the old atlas. */
  function drawArenaTexture(context, type, x, y, width, height, angle) {
    const sprite = arenaTextures[type];
    if (!sprite || !sprite.complete || !sprite.naturalWidth) return false;
    context.save();
    context.translate(x, y);
    if (angle) context.rotate(angle);
    context.drawImage(sprite, -width / 2, -height / 2, width, height);
    context.restore();
    return true;
  }

  /** Рисует спрайт из атласа; до загрузки остаётся прежний Canvas-рисунок. */
  function drawArenaSprite(context, type, x, y, width, height, angle, alpha) {
    const index = ARENA_SPRITES[type];
    if (!arenaAtlas || !arenaAtlas.complete || !arenaAtlas.naturalWidth || index == null) return false;
    context.save();
    context.translate(x, y);
    if (angle) context.rotate(angle);
    if (alpha != null) context.globalAlpha *= alpha;
    context.drawImage(arenaAtlas, (index % 5) * 96, Math.floor(index / 5) * 96, 96, 96,
      -width / 2, -height / 2, width, height);
    context.restore();
    return true;
  }

  /**
   * Центры подписей до и после линии без поперечного смещения.
   * @param {{x:number,y:number,ang:number}} point
   * @param {number} roadWidth
   * @returns {Array<{text:string,x:number,y:number,seed:number}>}
   */
  function finishLabelPoints(point, roadWidth) {
    const along = roadWidth * FINISH_LABEL_ALONG_SCALE;
    const tx = Math.cos(point.ang), ty = Math.sin(point.ang);
    return [
      { text:'СТАРТ', x:point.x - tx * along, y:point.y - ty * along, seed:3 },
      { text:'ФИНИШ', x:point.x + tx * along, y:point.y + ty * along, seed:7 }
    ];
  }

  /**
   * Горизонтальная потёртая подпись в мировых координатах.
   * @param {CanvasRenderingContext2D} context
   * @param {{text:string,x:number,y:number,seed:number}} label
   */
  function paintFinishLabel(context, label) {
    const size = FINISH_LABEL_SIZE;
    context.save();
    context.translate(label.x, label.y);
    context.globalAlpha = .6;
    context.font = size + 'px ' + F_D;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.strokeStyle = '#292118';
    context.lineWidth = 3;
    context.lineJoin = 'round';
    context.strokeText(label.text, 0, 0);
    context.globalAlpha = .86;
    context.fillStyle = FINISH_LABEL_COLOR;
    context.fillText(label.text, 0, 0);
    context.globalAlpha = .24;
    context.fillStyle = '#fff0a0';
    context.fillText(label.text, -1, -1);
    context.globalAlpha = .3;
    context.fillStyle = '#24242a';
    for (let i = 0; i < 14; i++) {
      const q = (label.seed * 17 + i * 31) % 97;
      context.fillRect(-size * .45 + (q % 13) * size / 15,
        -size * .48 + ((q * 7) % 11) * size / 13, 2 + (q % 3), 1 + (q % 2));
    }
    context.restore();
  }

  /**
   * Сохраняет декор финишной зоны, но переносит обе подписи на центр дороги
   * и не поворачивает их вместе с трассой.
   * @param {Function} original
   * @returns {Function}
   */
  function horizontalFinishZone(original) {
    return function (context, point) {
      if (!R || !R.T || R.T.lab) return original(context, point);
      const previousFillText = context.fillText;
      const previousFillRect = context.fillRect;
      let insideOldLabel = false;
      context.fillText = function (text) {
        if (text === 'СТАРТ' || text === 'ФИНИШ') {
          insideOldLabel = true;
          return;
        }
        return previousFillText.apply(this, arguments);
      };
      context.fillRect = function (x, y, width, height) {
        if (insideOldLabel && this.fillStyle === '#24242a' && width <= 4 && height <= 2) return;
        return previousFillRect.apply(this, arguments);
      };
      try {
        original(context, point);
      } finally {
        context.fillText = previousFillText;
        context.fillRect = previousFillRect;
      }
      for (const label of finishLabelPoints(point, ROADW)) paintFinishLabel(context, label);
    };
  }

  /**
   * Запас вокруг камеры, чтобы тайлы не вспыхивали на кромке.
   * @param {{x:number,y:number}} cam
   * @param {number} vw
   * @param {number} vh
   * @param {number} [margin]
   * @returns {{x:number,y:number,w:number,h:number}}
   */
  function arenaPad(cam, vw, vh, margin) {
    const m = margin == null ? 64 : margin;
    return { x: cam.x - m, y: cam.y - m, w: vw + m * 2, h: vh + m * 2 };
  }

  /**
   * Машины ближе к низу экрана рисуются поверх.
   * @param {Array<{y:number}>} racers
   * @returns {Array}
   */
  function racerDrawOrder(racers) {
    return racers.slice().sort(function (a, b) { return a.y - b.y; });
  }

  /**
   * Земля, объекты, опасность, машины, погода мира.
   */
  function drawRaceArenaEngine() {
    const T = R.T;
    const vw = visW(), vh = visH();
    const pad = arenaPad(R.cam, vw, vh, 64);
    if (T.lab) drawLabWorldGrid(pad.x, pad.y, pad.w, pad.h);
    else fillMapTileWorld(pad.x, pad.y, pad.w, pad.h, T);
    g.imageSmoothingEnabled = true;
    if (g.imageSmoothingQuality) g.imageSmoothingQuality = 'medium';
    g.drawImage(T.img, 0, 0, T.w, T.h);
    if (global.DiVANEngine.tactics) global.DiVANEngine.tactics.drawWorld();
    if (global.RnRObjects) RnRObjects.drawLayer(g, R.labObjects, 'under');
    if (R.puddles && R.weather && R.weather.id === 'rain') {
      for (const p of R.puddles) {
        g.save(); g.translate(p.x, p.y); g.rotate(p.ang);
        g.fillStyle = 'rgba(22,38,58,.42)';
        g.beginPath(); g.ellipse(0, 0, p.rx, p.ry, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(170,205,230,.16)';
        g.beginPath(); g.ellipse(-p.rx * .22, -p.ry * .28, p.rx * .42, p.ry * .26, 0, 0, TAU); g.fill();
        g.restore();
      }
    }
    drawYanotGuide();
    g.lineCap = 'round';
    if (R.skids) for (const s of R.skids) {
      const a = clamp(s.t / 6, 0, 1);
      g.globalAlpha = a * .75;
      g.strokeStyle = 'rgba(15,12,18,.55)';
      g.lineWidth = 3;
      const dL = Math.hypot(s.lx - s.plx, s.ly - s.ply);
      if (dL < 40) { g.beginPath(); g.moveTo(s.plx, s.ply); g.lineTo(s.lx, s.ly); g.stroke(); }
      const dR = Math.hypot(s.rx - s.prx, s.ry - s.pry);
      if (dR < 40) { g.beginPath(); g.moveTo(s.prx, s.pry); g.lineTo(s.rx, s.ry); g.stroke(); }
      if (s.t > 5) {
        const nx = -Math.sin(s.ang), ny = Math.cos(s.ang);
        g.strokeStyle = 'rgba(8,6,10,' + (a * .5) + ')';
        g.lineWidth = 1;
        if (dL > 1) {
          g.beginPath();
          g.moveTo(s.lx - nx * 3, s.ly - ny * 3);
          g.lineTo(s.lx + nx * 3, s.ly + ny * 3);
          g.stroke();
        }
        if (dR > 1) {
          g.beginPath();
          g.moveTo(s.rx - nx * 3, s.ry - ny * 3);
          g.lineTo(s.rx + nx * 3, s.ry + ny * 3);
          g.stroke();
        }
      }
    }
    g.globalAlpha = 1;
    for (const s of R.shocks) {
      const a = clamp(s.t / .45, 0, 1);
      g.strokeStyle = s.tint === 'water' ? ('rgba(150,200,235,' + (a * .7) + ')') : ('rgba(255,180,80,' + a * .6 + ')');
      g.lineWidth = s.tint === 'water' ? 2.4 : 4;
      g.beginPath(); g.arc(s.x, s.y, s.r, 0, TAU); g.stroke();
    }
    for (const s of R.scorch) {
      g.globalAlpha = Math.max(0, s.t) * 0.5; g.fillStyle = 'rgba(20,15,10,1)';
      g.beginPath(); g.arc(s.x, s.y, s.r, 0, TAU); g.fill();
    }
    g.globalAlpha = 1;
    for (const p of R.pads) {
      g.save();
      g.globalAlpha = p.cool <= 0 ? 1 : .72;
      const painted = drawArenaTexture(g, 'pad', p.x, p.y, 66, 48, p.ang)
        || drawArenaSprite(g, 'pad', p.x, p.y, 58, 42, p.ang);
      g.restore();
      if (painted) {
        if (global.RnRArenaEffects) RnRArenaEffects.drawPadLights(g, p.x, p.y, p.ang, gt, p.cool <= 0);
        continue;
      }
      g.save(); g.translate(p.x, p.y); g.rotate(p.ang);
      const ready = p.cool <= 0;
      const a = 0.15;
      g.fillStyle = 'rgba(53,224,255,' + a + ')';
      for (let k = 0; k < 3; k++) {
        g.beginPath(); g.moveTo(-18 + k * 14, -16); g.lineTo(-4 + k * 14, 0); g.lineTo(-18 + k * 14, 16);
        g.lineTo(-24 + k * 14, 16); g.lineTo(-10 + k * 14, 0); g.lineTo(-24 + k * 14, -16); g.closePath(); g.fill();
      }
      g.restore();
      if (global.RnRArenaEffects) RnRArenaEffects.drawPadLights(g, p.x, p.y, p.ang, gt, ready);
    }
    const S = T.S, N = T.N;
    for (const rp of R.ramps) {
      for (let k = 1; k <= 3; k++) {
        const di = (rp.i - k * 8 + N) % N; const p = S[di];
        const pulse = .5 + .5 * Math.sin(gt * 4 + k * 1.2);
        g.save(); g.translate(p.x, p.y); g.rotate(p.ang);
        g.fillStyle = 'rgba(204,174,112,' + (0.33 + 0.17 * pulse) + ')';
        g.beginPath(); g.moveTo(20, 0); g.lineTo(8, -8); g.lineTo(8, -3); g.lineTo(-12, -3);
        g.lineTo(-12, 3); g.lineTo(8, 3); g.lineTo(8, 8); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(48,34,25,.35)'; g.lineWidth = 1; g.stroke();
        g.restore();
      }
      g.save(); g.translate(rp.x, rp.y); g.rotate(rp.ang);
      // Turn the ramp artwork 180 degrees, keeping its position and collision unchanged.
      if (drawArenaTexture(g, 'ramp', 0, 0, 76, 84, -Math.PI / 2)
        || drawArenaSprite(g, 'ramp', 0, 0, 76, 84, -Math.PI / 2)) { g.restore(); continue; }
      g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(2, 3, 30, 44, 0, 0, TAU); g.fill();
      g.fillStyle = '#8a6a3a'; rr(g, -16, -40, 32, 80, 6); g.fill();
      g.fillStyle = '#c9a05a'; rr(g, -12, -36, 24, 72, 4); g.fill();
      g.fillStyle = '#e8d9a0'; g.fillRect(8, -36, 6, 72);
      const pulse = .6 + .4 * Math.sin(gt * 5);
      g.fillStyle = 'rgba(125,249,255,' + (0.7 + 0.3 * pulse) + ')';
      g.beginPath(); g.moveTo(16, 0); g.lineTo(4, -10); g.lineTo(4, -4); g.lineTo(-14, -4);
      g.lineTo(-14, 4); g.lineTo(4, 4); g.lineTo(4, 10); g.closePath(); g.fill();
      g.strokeStyle = '#7df9ff'; g.lineWidth = 1.5; g.stroke();
      g.restore();
    }
    for (const o of R.oils) {
      if (drawArenaTexture(g, 'oil', o.x, o.y, 66, 48, o.rot) || drawArenaSprite(g, 'oil', o.x, o.y, 66, 48, o.rot)) continue;
      g.save(); g.translate(o.x, o.y); g.rotate(o.rot);
      g.fillStyle = 'rgba(16,14,20,.85)'; g.beginPath(); g.ellipse(0, 0, 28, 18, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(120,90,200,.15)'; g.beginPath(); g.ellipse(-4, -3, 16, 8, 0, 0, TAU); g.fill(); g.restore();
    }
    if (typeof drawStarterWorld === 'function') drawStarterWorld(g);
    if (typeof drawMidWorld === 'function') drawMidWorld(g);
    for (const m of R.mines) {
      if (m.dead) continue;
      if (!(drawArenaTexture(g, 'mine', m.x, m.y, 26, 26)
        || drawArenaSprite(g, 'mine', m.x, m.y, 26, 26))) {
        g.fillStyle = '#1c1a22'; g.beginPath(); g.arc(m.x, m.y, 8, 0, TAU); g.fill();
        g.strokeStyle = '#3a3644'; g.lineWidth = 2;
        for (let k = 0; k < 4; k++) {
          const a = k * TAU / 4 + .4;
          g.beginPath(); g.moveTo(m.x + Math.cos(a) * 7, m.y + Math.sin(a) * 7);
          g.lineTo(m.x + Math.cos(a) * 11, m.y + Math.sin(a) * 11); g.stroke();
        }
      }
      if (global.RnRArenaEffects) RnRArenaEffects.drawMineLight(g, m.x, m.y, gt, m.x * .01);
    }
    if (R.spikes) {
      for (const sp of R.spikes) {
        if (drawArenaSprite(g, 'spikes', sp.x, sp.y, 36, 36, sp.rot)) continue;
        g.save(); g.translate(sp.x, sp.y); g.rotate(sp.rot);
        g.fillStyle = '#8b4513';
        for (let k = 0; k < 4; k++) {
          const a = k * TAU / 4;
          g.beginPath();
          g.moveTo(Math.cos(a) * 12, Math.sin(a) * 12);
          g.lineTo(Math.cos(a) * 18, Math.sin(a) * 18);
          g.lineTo(Math.cos(a + .3) * 14, Math.sin(a + .3) * 14);
          g.closePath(); g.fill();
        }
        g.fillStyle = '#5a3520';
        g.beginPath(); g.arc(0, 0, 8, 0, TAU); g.fill();
        g.restore();
      }
    }
    for (const p of R.picks) {
      if (!p.alive) continue;
      const bob = Math.sin(gt * 4 + p.i) * .8;
      if (global.RnRArenaEffects) RnRArenaEffects.drawPickupGlow(g, p.type, p.x, p.y + bob, gt, p.i);
      g.save(); g.translate(p.x, p.y + bob);
      if (drawArenaTexture(g, p.type, 0, 0, 31, 31) || drawArenaSprite(g, p.type, 0, 0, 31, 31)) { g.restore(); continue; }
      const cols = { money: '#ffd23f', wrench: '#58ff6b', wep: '#ff6b4a', ult: '#b478ff', nit: '#ff9d2e', shield: '#35e0ff', bolt: '#7df9ff' };
      g.shadowColor = cols[p.type]; g.shadowBlur = 14;
      g.fillStyle = 'rgba(10,10,16,.85)'; g.beginPath(); g.arc(0, 0, 14, 0, TAU); g.fill();
      g.strokeStyle = cols[p.type]; g.lineWidth = 2.5; g.stroke(); g.shadowBlur = 0;
      g.fillStyle = cols[p.type];
      if (p.type === 'money') txt(g, '$', 0, 1, 16, cols[p.type], 'center', F_D, false);
      else if (p.type === 'wrench') { g.fillRect(-2, -8, 4, 16); g.fillRect(-8, -2, 16, 4); }
      else if (p.type === 'wep') { g.fillRect(-7, -5, 14, 3); g.fillRect(-7, -1, 14, 3); g.fillRect(-7, 3, 14, 3); }
      else if (p.type === 'ult') { g.beginPath(); g.moveTo(2, -9); g.lineTo(-6, 2); g.lineTo(-1, 2); g.lineTo(-2, 9); g.lineTo(6, -2); g.lineTo(1, -2); g.closePath(); g.fill(); }
      else if (p.type === 'nit') { g.beginPath(); g.moveTo(0, -9); g.quadraticCurveTo(7, 0, 0, 9); g.quadraticCurveTo(-7, 0, 0, -9); g.fill(); }
      else if (p.type === 'shield') { g.beginPath(); g.moveTo(0, -8); g.lineTo(7, -4); g.lineTo(6, 5); g.lineTo(0, 9); g.lineTo(-6, 5); g.lineTo(-7, -4); g.closePath(); g.fill(); }
      else { g.beginPath(); g.moveTo(0, -10); g.lineTo(4, -4); g.lineTo(4, 6); g.lineTo(-4, 6); g.lineTo(-4, -4); g.closePath(); g.fill(); }
      g.restore();
    }
    for (const s of R.shots) {
      g.save(); g.translate(s.x, s.y); g.rotate(Math.atan2(s.vy, s.vx));
      const st = typeof kitShotStyle === 'function' ? kitShotStyle(s) : { fill: '#ffd23f', core: '#fff', w: 16, h: 4 };
      const customShot = s.can || s.baton || s.bolts || s.meter || s.oilcan || s.dart;
      const shotType = customShot ? null : s.rocket ? 'rocket' : s.laser ? 'laser'
        : s.plasma ? 'plasma' : s.mortar ? 'mortar' : s.nails ? 'nails' : s.fang ? 'fang' : 'bullet';
      const shotWidth = s.rocket ? 25 : s.laser ? 27 : s.mortar ? 22 : Math.max(12, st.w || 16);
      const shotHeight = s.rocket || s.mortar ? 12 : Math.max(6, st.h || 4);
      if (drawArenaSprite(g, shotType, 0, 0, shotWidth, shotHeight)) { g.restore(); continue; }
      if (s.rocket) {
        g.fillStyle = '#ff3d2e'; g.fillRect(-10, -3, 20, 6);
        g.fillStyle = '#ff9d2e'; g.fillRect(-6, -2, 12, 4);
        g.fillStyle = '#fff'; g.fillRect(6, -1, 4, 2);
      } else if (s.laser) {
        g.fillStyle = '#ff00ff'; g.fillRect(-12, -2, 24, 4);
        g.fillStyle = '#fff'; g.fillRect(-8, -1, 16, 2);
        g.shadowColor = '#ff00ff'; g.shadowBlur = 10;
      } else {
        g.fillStyle = st.fill; g.fillRect(-st.w / 2, -st.h / 2, st.w, st.h); g.fillStyle = st.core; g.fillRect(st.w / 4, -st.h / 4, st.w / 3, st.h / 2);
      }
      g.shadowBlur = 0;
      g.restore();
    }
    drawFinishZone(g, R.S[0]);
    const order = racerDrawOrder(R.racers);
    /**
     * Один гонщик: корпус, дымка, щит, метка.
     * @param {object} r
     */
    function paintRacer(r) {
      if (r.dead) return;
      let al = 1; if (r.invuln > 0) al = .4 + .3 * Math.sin(gt * 25);
      if (r.cloak && r.cloak > 0) al *= 0.15 + .05 * Math.sin(gt * 20);
      g.globalAlpha = al; drawCar(g, r, 1); g.globalAlpha = 1;
      if (r.haze > 0) {
        g.save(); g.globalAlpha = 0.22 + 0.08 * Math.sin(gt * 6);
        g.fillStyle = '#ff5db1'; g.beginPath(); g.arc(r.x, r.y, 110, 0, TAU); g.fill(); g.restore();
      }
      drawCarShield(g, r);
    }
    /**
     * Этаж отрисовки: эстакада сверху.
     * @param {object} r
     * @returns {number}
     */
    function paintLayer(r) {
      if (typeof racerDeck === 'function') return racerDeck(r) > 0 ? 1 : 0;
      if (r.air && (r.z || 0) > 18) return 1;
      return 0;
    }
    // Occlusion depends on each racer's deck, never on the camera's target.
    const layers = order.map(function (r) { return { racer: r, deck: paintLayer(r) }; });
    for (const item of layers) if (item.deck === 0) paintRacer(item.racer);
    if (engine.render.drawFinishGateOverhead) engine.render.drawFinishGateOverhead(g, R.S[0]);
    for (const item of layers) if (item.deck === 0 && item.racer.isP && !item.racer.dead) drawPlayerRaceTag(g, item.racer);
    if (T.imgHigh) g.drawImage(T.imgHigh, 0, 0, T.w, T.h);
    for (const item of layers) if (item.deck > 0) paintRacer(item.racer);
    for (const item of layers) if (item.deck > 0 && item.racer.isP && !item.racer.dead) drawPlayerRaceTag(g, item.racer);
    if (global.RnRObjects) RnRObjects.drawLayer(g, R.labObjects, 'over');
    for (const p of R.parts) {
      if (vfxLive() && !p.rim) continue;
      g.globalAlpha = clamp(p.t * 2, 0, 1); g.fillStyle = p.col;
      if (p.kind === 'streak') {
        g.save(); g.translate(p.x, p.y); g.rotate(Math.atan2(p.vy, p.vx));
        g.fillRect(0, -p.sz * .35, p.sz * 2.4, p.sz * .7);
        g.restore();
      } else {
        g.beginPath(); g.arc(p.x, p.y, p.sz, 0, TAU); g.fill();
      }
    }
    g.globalAlpha = 1;
    for (const f of R.floats) { g.globalAlpha = clamp(1.4 - f.t, 0, 1); txt(g, f.txt, f.x, f.y - f.t * 40, 20, f.col, 'center', F_D); }
    g.globalAlpha = 1;
    if (settings.graphics.weather && global.RnRWeather) RnRWeather.drawWorld(g, R);
    if (R.shortcuts) {
      for (const sc of R.shortcuts) {
        if (sc.used) continue;
        const pulse = .3 + .2 * Math.sin(gt * 4);
        const alpha = sc.glow > .1 ? (.5 + sc.glow * .5) : pulse * .3;
        g.save(); g.translate(sc.entry[0], sc.entry[1]);
        g.strokeStyle = 'rgba(255,157,46,' + alpha + ')';
        g.lineWidth = 3;
        g.beginPath(); g.arc(0, 0, sc.radius, 0, TAU); g.stroke();
        if (sc.glow > .1) {
          g.fillStyle = 'rgba(255,157,46,' + (sc.glow * .3) + ')';
          g.beginPath(); g.arc(0, 0, sc.radius, 0, TAU); g.fill();
        }
        g.restore();
        g.save(); g.translate(sc.exit[0], sc.exit[1]);
        g.strokeStyle = 'rgba(88,255,107,' + alpha + ')';
        g.lineWidth = 3;
        g.beginPath(); g.arc(0, 0, sc.radius, 0, TAU); g.stroke();
        if (sc.glow > .1) {
          g.fillStyle = 'rgba(88,255,107,' + (sc.glow * .3) + ')';
          g.beginPath(); g.arc(0, 0, sc.radius, 0, TAU); g.fill();
        }
        g.restore();
      }
    }
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  if (!engine.render) engine.render = {};
  engine.render.arenaPad = arenaPad;
  engine.render.drawArenaTexture = drawArenaTexture;
  engine.render.racerDrawOrder = racerDrawOrder;
  engine.render.finishLabelPoints = finishLabelPoints;
  engine.render.paintFinishLabel = paintFinishLabel;
  engine.wrap('drawFinishZone', horizontalFinishZone);
  engine.replace('drawRaceArena', drawRaceArenaEngine);
})(typeof window !== 'undefined' ? window : globalThis);
