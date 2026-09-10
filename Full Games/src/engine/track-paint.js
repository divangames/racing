////////////////////////////////////////////////////////
//
// DiVANEngine: запекание полотна трассы и тайлов земли.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Живые картинки биома: только complete и с шириной.
   * @param {string} biome
   * @returns {HTMLImageElement[]}
   */
  function mapTileListEngine(biome) {
    return (MAP_TILES[biome] || []).filter(function (im) { return im.complete && im.naturalWidth > 0; });
  }

  /**
   * Один случайный кадр из папки на весь заезд.
   * @param {string} biome
   * @returns {HTMLImageElement|null}
   */
  function pickMapTileEngine(biome) {
    const tiles = mapTileList(biome);
    if (!tiles.length) return null;
    return tiles[(Math.random() * tiles.length) | 0];
  }

  /**
   * Сжимаем исходник один раз в 512 px.
   * @param {CanvasImageSource} img
   * @returns {HTMLCanvasElement}
   */
  function bakeMapTileEngine(img) {
    const c = document.createElement('canvas');
    c.width = c.height = MAP_TILE_CACHE;
    const q = c.getContext('2d');
    q.imageSmoothingEnabled = true;
    if (q.imageSmoothingQuality) q.imageSmoothingQuality = 'medium';
    q.drawImage(img, 0, 0, MAP_TILE_CACHE, MAP_TILE_CACHE);
    return c;
  }

  /**
   * Повтор запечённого кадра: шаг 64 в мире.
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {object} T
   */
  function fillMapTileWorldEngine(x, y, w, h, T) {
    if (!T.pat) {
      g.fillStyle = (T.theme && T.theme.ground) || '#3a2a20';
      g.fillRect(x, y, w, h);
      return;
    }
    const src = T.mapBake || T.mapTile;
    const nw = (src && (src.width || src.naturalWidth)) || MAP_TILE_CELL;
    const s = MAP_TILE_CELL / nw;
    g.save();
    g.imageSmoothingEnabled = true;
    if (g.imageSmoothingQuality) g.imageSmoothingQuality = 'medium';
    g.scale(s, s);
    g.fillStyle = T.pat;
    g.fillRect(x / s, y / s, w / s, h / s);
    g.restore();
  }

  /**
   * Простой стадион полигона: прямые и дуги.
   * @returns {number[][]}
   */
  function labPolygonCpsEngine() {
    const x0 = 420, x1 = 2780, y0 = 340, y1 = 1460, rad = 360, pts = [];
    const arc = function (cx, cy, a0, a1, n) {
      for (let i = 0; i <= n; i++) {
        const t = a0 + (a1 - a0) * i / n;
        pts.push([cx + rad * Math.cos(t), cy + rad * Math.sin(t)]);
      }
    };
    const line = function (ax, ay, bx, by, n) {
      for (let i = 1; i < n; i++) {
        const u = i / n;
        pts.push([ax + (bx - ax) * u, ay + (by - ay) * u]);
      }
    };
    line(x0 + rad, y1, x1 - rad, y1, 7);
    arc(x1 - rad, y1 - rad, Math.PI / 2, 0, 8);
    line(x1, y1 - rad, x1, y0 + rad, 7);
    arc(x1 - rad, y0 + rad, 0, -Math.PI / 2, 8);
    line(x1 - rad, y0, x0 + rad, y0, 7);
    arc(x0 + rad, y0 + rad, -Math.PI / 2, -Math.PI, 8);
    line(x0, y0 + rad, x0, y1 - rad, 7);
    arc(x0 + rad, y1 - rad, Math.PI, Math.PI / 2, 8);
    return pts;
  }

  /**
   * Декор за бровкой: камень, кактус, лёд, лава, череп.
   * @param {CanvasRenderingContext2D} q
   * @param {object} th
   */
  function paintOffroadDeco(q, th) {
    q.save();
    if (th.deco === 'rock') {
      q.fillStyle = 'rgba(0,0,0,.3)'; q.beginPath(); q.ellipse(3, 4, 16, 9, 0, 0, TAU); q.fill();
      q.fillStyle = '#6f665c'; q.beginPath(); q.moveTo(-14, 6); q.lineTo(-8, -10); q.lineTo(4, -14); q.lineTo(14, 2); q.lineTo(8, 8); q.closePath(); q.fill();
      q.fillStyle = '#8d8377'; q.beginPath(); q.moveTo(-8, -10); q.lineTo(4, -14); q.lineTo(6, -2); q.closePath(); q.fill();
    } else if (th.deco === 'cactus') {
      q.fillStyle = 'rgba(0,0,0,.3)'; q.beginPath(); q.ellipse(2, 16, 10, 5, 0, 0, TAU); q.fill();
      q.fillStyle = '#3f7d3a'; q.fillRect(-3, -16, 6, 32); q.fillRect(-12, -6, 9, 5); q.fillRect(-12, -6, 5, -8); q.fillRect(3, -2, 10, 5); q.fillRect(8, -2, 5, -10);
    } else if (th.deco === 'ice') {
      q.fillStyle = 'rgba(0,0,0,.3)'; q.beginPath(); q.ellipse(2, 14, 11, 6, 0, 0, TAU); q.fill();
      q.fillStyle = '#e8f4f8'; q.beginPath(); q.moveTo(-8, -12); q.lineTo(0, -18); q.lineTo(8, -12); q.lineTo(10, 8); q.lineTo(-10, 8); q.closePath(); q.fill();
      q.fillStyle = '#a8d5e8'; q.beginPath(); q.moveTo(-6, -8); q.lineTo(0, -14); q.lineTo(6, -8); q.lineTo(4, 4); q.lineTo(-4, 4); q.closePath(); q.fill();
    } else if (th.deco === 'lava') {
      q.fillStyle = 'rgba(0,0,0,.4)'; q.beginPath(); q.ellipse(3, 18, 14, 7, 0, 0, TAU); q.fill();
      q.fillStyle = '#4a2820'; q.beginPath(); q.moveTo(-12, 8); q.lineTo(-8, -12); q.lineTo(6, -16); q.lineTo(14, 4); q.lineTo(10, 12); q.closePath(); q.fill();
      q.fillStyle = '#ff6b3a'; q.beginPath(); q.arc(-2, -4, 4, 0, TAU); q.fill();
      q.fillStyle = '#ff3d2e'; q.beginPath(); q.arc(4, 2, 3, 0, TAU); q.fill();
    } else {
      q.fillStyle = 'rgba(0,0,0,.3)'; q.beginPath(); q.ellipse(2, 6, 13, 6, 0, 0, TAU); q.fill();
      q.fillStyle = '#d8d2c2'; q.beginPath(); q.arc(0, 0, 10, 0, TAU); q.fill(); q.fillRect(-6, 6, 12, 5);
      q.fillStyle = '#221d18'; q.beginPath(); q.arc(-4, -1, 2.6, 0, TAU); q.arc(4, -1, 2.6, 0, TAU); q.fill();
    }
    q.restore();
  }

  /**
   * Полотно полигона: серая прототип-дорога, клетка рисуется в кадре.
   * @param {object} T
   * @returns {HTMLCanvasElement}
   */
  function prerenderLabTrackEngine(T) {
    const c = document.createElement('canvas'); c.width = Math.ceil(T.w); c.height = Math.ceil(T.h); const q = c.getContext('2d');
    const S = T.S, N = S.length, path = new Path2D();
    path.moveTo(S[0].x, S[0].y); for (let i = 1; i < N; i++) path.lineTo(S[i].x, S[i].y); path.closePath();
    q.lineJoin = 'round'; q.lineCap = 'round';
    q.strokeStyle = '#1a1a1a'; q.lineWidth = ROADW * 2 + 32; q.stroke(path);
    q.strokeStyle = '#2a2a2c'; q.lineWidth = ROADW * 2 + 12; q.stroke(path);
    q.strokeStyle = '#3d3d42'; q.lineWidth = ROADW * 2; q.stroke(path);
    q.strokeStyle = '#4a4a52'; q.lineWidth = ROADW * 2 - 14; q.stroke(path);
    const edge = function (side) {
      const p = new Path2D();
      for (let i = 0; i <= N; i++) {
        const s = S[i % N], x = s.x + s.nx * side * (ROADW - 5), y = s.y + s.ny * side * (ROADW - 5);
        if (i === 0) p.moveTo(x, y); else p.lineTo(x, y);
      }
      q.strokeStyle = 'rgba(61,158,255,.38)'; q.lineWidth = 2.2; q.setLineDash([14, 12]); q.stroke(p); q.setLineDash([]);
    };
    edge(1); edge(-1);
    q.strokeStyle = 'rgba(232,197,71,.5)'; q.lineWidth = 3.5; q.setLineDash([24, 20]); q.stroke(path); q.setLineDash([]);
    for (let i = 0; i < N; i += 12) {
      const p = S[i]; q.save(); q.translate(p.x, p.y); q.rotate(p.ang);
      q.strokeStyle = 'rgba(180,180,180,.2)'; q.lineWidth = 1.2;
      q.beginPath(); q.moveTo(0, -ROADW + 10); q.lineTo(0, ROADW - 10); q.stroke(); q.restore();
    }
    const p0 = S[0]; q.save(); q.translate(p0.x, p0.y); q.rotate(p0.ang);
    for (let cxI = -18; cxI < 18; cxI += 12) for (let cyI = -ROADW + 6; cyI < ROADW - 6; cyI += 12) {
      q.fillStyle = ((cxI / 12 + cyI / 12) & 1) ? '#f2f0ea' : '#141318'; q.fillRect(cxI, cyI, 12, 12);
    }
    q.restore();
    T.mapTile = null;
    return c;
  }

  /**
   * Запекает землю, декор и полотно. Земля из тайла рисуется в кадре.
   * @param {object} T
   * @returns {HTMLCanvasElement}
   */
  function prerenderEngine(T) {
    if (T.lab) return prerenderLabTrack(T);
    const c = document.createElement('canvas'); c.width = Math.ceil(T.w); c.height = Math.ceil(T.h); const q = c.getContext('2d');
    const th = T.theme, rng = mulberry(7 + T.idx * 31);
    T.mapTile = th.map ? pickMapTile(th.map) : null;
    if (th.groundSrc && global.RnRTracks) {
      const gnd = RnRTracks.texOf(th.groundSrc);
      if (gnd && gnd.complete && gnd.naturalWidth) T.mapTile = gnd;
    }
    if (T.mapTile) {
      // Земля рисуется в кадре из исходника; здесь только декор и полотно
    } else {
      q.fillStyle = th.ground; q.fillRect(0, 0, c.width, c.height);
      for (let i = 0; i < 2600; i++) { q.fillStyle = rng() < .5 ? th.dark : '#00000022'; const s = 2 + rng() * 4; q.fillRect(rng() * c.width, rng() * c.height, s, s); }
      for (let i = 0; i < 60; i++) { q.fillStyle = '#00000014'; q.beginPath(); q.arc(rng() * c.width, rng() * c.height, 30 + rng() * 90, 0, TAU); q.fill(); }
    }
    for (let i = 0; i < 46; i++) {
      let x = rng() * c.width, y = rng() * c.height, tr = 0;
      while (distToTrack(T, x, y) < ROADW + 70 && tr++ < 12) { x = rng() * c.width; y = rng() * c.height; }
      if (tr >= 13) continue;
      q.save(); q.translate(x, y);
      paintOffroadDeco(q, th);
      q.restore();
    }
    const S = T.S, N = S.length, path = new Path2D();
    path.moveTo(S[0].x, S[0].y); for (let i = 1; i < N; i++) path.lineTo(S[i].x, S[i].y); path.closePath();
    q.lineJoin = 'round'; q.lineCap = 'round';
    q.strokeStyle = th.line; q.lineWidth = ROADW * 2 + 22; q.stroke(path);
    for (let i = 0; i < N; i++) {
      const a = S[i], b = S[(i + 1) % N], mat = roadMaterial(T, i / N), m = ROAD_MATERIALS[mat] || ROAD_MATERIALS.asphalt;
      q.strokeStyle = mat === 'asphalt' ? (th.road || m.road) : m.road; q.lineWidth = ROADW * 2;
      q.beginPath(); q.moveTo(a.x, a.y); q.lineTo(b.x, b.y); q.stroke();
    }
    if (th.roadSrc && global.RnRTracks) {
      const road = RnRTracks.texOf(th.roadSrc);
      if (road && road.complete && road.naturalWidth) {
        const pat = q.createPattern(road, 'repeat');
        if (pat) { q.save(); q.globalAlpha = .62; q.strokeStyle = pat; q.lineWidth = ROADW * 2; q.stroke(path); q.restore(); }
      }
    }
    for (let i = 0; i < N; i += 11) {
      const p = S[i], mat = roadMaterial(T, i / N); q.save(); q.translate(p.x, p.y); q.rotate(p.ang);
      q.lineWidth = 2;
      if (mat === 'ice') {
        q.strokeStyle = 'rgba(235,255,255,.62)'; q.beginPath(); q.moveTo(-32, -28); q.lineTo(-8, -8); q.lineTo(15, -18); q.lineTo(34, 20); q.stroke();
      } else if (mat === 'snow') {
        q.fillStyle = 'rgba(255,255,255,.55)'; q.fillRect(-ROADW, -ROADW * .72, ROADW * 2, 7);
      } else if (mat === 'lava') {
        q.strokeStyle = '#ff5b32'; q.lineWidth = 3; q.beginPath(); q.moveTo(-28, -22); q.lineTo(-4, -5); q.lineTo(9, -20); q.moveTo(-18, 26); q.lineTo(4, 7); q.lineTo(30, 17); q.stroke();
      } else if (mat === 'sand') {
        q.strokeStyle = 'rgba(255,228,156,.35)'; q.beginPath(); q.moveTo(-42, -24); q.quadraticCurveTo(0, -8, 42, -22); q.moveTo(-42, 20); q.quadraticCurveTo(0, 7, 42, 22); q.stroke();
      } else if (mat === 'grass') {
        q.strokeStyle = 'rgba(179,201,105,.42)'; q.beginPath(); q.moveTo(-34, -26); q.lineTo(-22, -15); q.moveTo(0, 25); q.lineTo(12, 14); q.moveTo(26, -20); q.lineTo(38, -10); q.stroke();
      } else if (mat === 'dirt') {
        q.strokeStyle = 'rgba(45,27,19,.30)'; q.lineWidth = 3; q.beginPath(); q.moveTo(-40, -18); q.lineTo(38, -10); q.moveTo(-35, 17); q.lineTo(30, 25); q.stroke();
      } else {
        q.strokeStyle = 'rgba(255,255,255,.08)'; q.beginPath(); q.moveTo(-35, -18); q.lineTo(28, 14); q.stroke();
      }
      q.restore();
    }
    for (let i = 0; i < N; i += 2) {
      const p = S[i];
      if (p.k > .01) {
        q.fillStyle = (i >> 1) % 2 ? '#e33b2e' : '#f2ede0';
        for (const s of [1, -1]) {
          q.save(); q.translate(p.x + p.nx * s * (ROADW + 8), p.y + p.ny * s * (ROADW + 8)); q.rotate(p.ang); q.fillRect(-10, -6, 20, 12); q.restore();
        }
      }
    }
    const off = new Path2D(), off2 = new Path2D();
    for (let i = 0; i <= N; i++) {
      const p = S[i % N], x1 = p.x + p.nx * (ROADW - 7), y1 = p.y + p.ny * (ROADW - 7), x2 = p.x - p.nx * (ROADW - 7), y2 = p.y - p.ny * (ROADW - 7);
      if (i === 0) { off.moveTo(x1, y1); off2.moveTo(x2, y2); } else { off.lineTo(x1, y1); off2.lineTo(x2, y2); }
    }
    q.strokeStyle = 'rgba(255,255,255,.55)'; q.lineWidth = 4; q.stroke(off); q.stroke(off2);
    q.strokeStyle = 'rgba(255,210,63,.4)'; q.lineWidth = 5; q.setLineDash([26, 34]); q.stroke(path); q.setLineDash([]);
    const p0 = S[0]; q.save(); q.translate(p0.x, p0.y); q.rotate(p0.ang);
    for (let cxI = -24; cxI < 24; cxI += 12) for (let cyI = -96; cyI < 96; cyI += 12) {
      q.fillStyle = ((cxI / 12 + cyI / 12) % 2 === 0) ? '#eee' : '#15141a'; q.fillRect(cxI, cyI, 12, 12);
    }
    q.restore();
    if (global.RnRTracks && T.decals) RnRTracks.paintDecals(q, T.decals);
    return c;
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.trackPaint = { paintOffroadDeco: paintOffroadDeco };
  engine.replace('mapTileList', mapTileListEngine);
  engine.replace('pickMapTile', pickMapTileEngine);
  engine.replace('bakeMapTile', bakeMapTileEngine);
  engine.replace('fillMapTileWorld', fillMapTileWorldEngine);
  engine.replace('labPolygonCps', labPolygonCpsEngine);
  engine.replace('prerenderLabTrack', prerenderLabTrackEngine);
  engine.replace('prerender', prerenderEngine);
})(typeof window !== 'undefined' ? window : globalThis);
