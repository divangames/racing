////////////////////////////////////////////////////////
//
// Живой кадр карты: тайлы земли, дорога, погода, итемы
//
////////////////////////////////////////////////////////
'use strict';

const MapPreview = (() => {
  const CELL = 64, ROADW = 95, TAU = Math.PI * 2;
  const MAT = {
    asphalt: '#43404b', sand: '#b88a4e', dirt: '#76503a',
    grass: '#687447', ice: '#72b8d1', snow: '#d8eaf0', lava: '#47221a'
  };
  const WX = {
    rain: {col: 'rgba(160,200,255,.55)', n: 70},
    snow: {col: 'rgba(240,248,255,.8)', n: 55},
    sand: {col: 'rgba(210,160,100,.35)', n: 50},
    ash: {col: 'rgba(255,90,40,.45)', n: 45},
    clear: {col: '#fff', n: 0}
  };
  let parts = [];
  let last = 0;

  /** Материал зоны по доле круга. */
  function matAt(t, u) {
    const z = (t && t.zones) || [];
    for (let i = 0; i < z.length; i++) {
      if (u >= z[i].from && u < z[i].to) return z[i].material;
    }
    return 'asphalt';
  }

  /** Погода документа. */
  function weatherId(t) {
    if (t && t.theme && t.theme.weather) return t.theme.weather;
    const map = t && t.theme && t.theme.map;
    const deco = t && t.theme && t.theme.deco;
    if (deco === 'lava') return 'ash';
    if (map === 'snow' || deco === 'ice') return 'snow';
    if (map === 'garden' || deco === 'skull') return 'rain';
    if (map === 'sand' || map === 'desert' || deco === 'rock' || deco === 'cactus') return 'sand';
    return 'clear';
  }

  /** Земля тайлами 64. */
  function fillGround(ctx, t, x0, y0, x1, y1) {
    const im = MapTex.groundOf(t.theme);
    if (im && im.complete && im.naturalWidth) {
      const pat = ctx.createPattern(im, 'repeat');
      if (pat) {
        ctx.save();
        const s = CELL / im.naturalWidth;
        ctx.scale(s, s);
        ctx.fillStyle = pat;
        ctx.fillRect(x0 / s, y0 / s, (x1 - x0) / s, (y1 - y0) / s);
        ctx.restore();
        return;
      }
    }
    ctx.fillStyle = (t.theme && t.theme.ground) || '#1a1a1a';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  }

  /** Дорога по зонам и опциональной текстуре. */
  function strokeRoad(ctx, raw, t) {
    if (!raw || raw.length < 2) return;
    const n = raw.length;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = (t.theme && t.theme.line) || '#d9c49a';
    ctx.lineWidth = ROADW * 2 + 18;
    ctx.beginPath();
    raw.forEach((p, i) => { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
    ctx.closePath();
    ctx.stroke();
    for (let i = 0; i < n; i++) {
      const a = raw[i], b = raw[(i + 1) % n];
      ctx.strokeStyle = MAT[matAt(t, i / n)] || MAT.asphalt;
      ctx.lineWidth = ROADW * 2;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
    const road = MapTex.roadOf(t.theme);
    if (road && road.complete && road.naturalWidth) {
      const pat = ctx.createPattern(road, 'repeat');
      if (pat) {
        ctx.save();
        ctx.globalAlpha = 0.62;
        ctx.strokeStyle = pat;
        ctx.lineWidth = ROADW * 2;
        ctx.beginPath();
        raw.forEach((p, i) => { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.strokeStyle = (t.theme && t.theme.line) || '#d9c49a';
    ctx.lineWidth = 5;
    ctx.setLineDash([28, 22]);
    ctx.beginPath();
    raw.forEach((p, i) => { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /** Иконка итема как в гонке. */
  function drawItem(ctx, p, z) {
    const cols = {money: '#ffd23f', wrench: '#58ff6b', wep: '#ff6b4a', ult: '#b478ff', nit: '#ff9d2e', shield: '#35e0ff', bolt: '#7df9ff'};
    const col = cols[p.type] || '#ffd23f';
    const s = 1 / Math.max(0.2, z);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(s, s);
    ctx.fillStyle = 'rgba(10,10,16,.85)';
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.font = '700 14px Montserrat,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const mark = {money: '$', wrench: '+', wep: 'Z', ult: '*', nit: 'N', shield: 'O', bolt: '!'};
    ctx.fillText(mark[p.type] || '•', 0, 1);
    ctx.restore();
  }

  /** Капля/зерно погоды. */
  function tickWeather(t, x0, y0, x1, y1, now) {
    const id = weatherId(t);
    const spec = WX[id] || WX.clear;
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || spec.n <= 0) { parts = []; return id; }
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    if (parts.length < spec.n) {
      for (let i = parts.length; i < spec.n; i++) {
        parts.push({x: x0 + Math.random() * (x1 - x0), y: y0 + Math.random() * (y1 - y0), v: 80 + Math.random() * 220});
      }
    }
    parts.forEach((p) => {
      p.y += p.v * dt * (id === 'snow' ? 0.35 : 1);
      p.x += (id === 'sand' ? 90 : id === 'rain' ? 40 : 8) * dt;
      if (p.y > y1) { p.y = y0; p.x = x0 + Math.random() * (x1 - x0); }
      if (p.x > x1) p.x = x0;
    });
    return id;
  }

  /** Рисует осадки поверх мира. */
  function drawWeather(ctx, t, x0, y0, x1, y1, now) {
    const id = tickWeather(t, x0, y0, x1, y1, now);
    const spec = WX[id] || WX.clear;
    if (!parts.length) return id;
    ctx.strokeStyle = spec.col;
    ctx.fillStyle = spec.col;
    ctx.lineWidth = id === 'rain' ? 1.4 : 2;
    parts.forEach((p) => {
      if (id === 'rain') {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + 6, p.y + 16);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, id === 'ash' ? 1.8 : 2.4, 0, TAU);
        ctx.fill();
      }
    });
    return id;
  }

  /** Привязка к клетке 64 и к уже стоящим маркерам. */
  function snapWorld(x, y, t, gridOn, objOn, skip) {
    let px = x, py = y;
    if (gridOn) {
      px = Math.round(x / CELL) * CELL;
      py = Math.round(y / CELL) * CELL;
    }
    if (!objOn || !t) return [px, py];
    const skipKind = skip && skip.kind, skipI = skip && skip.i;
    const pts = [];
    (t.cps || []).forEach((p, i) => {
      if (!(skipKind === 'cp' && skipI === i)) pts.push(p);
    });
    const pushXY = (list, kind) => (list || []).forEach((p, i) => {
      if (!(skipKind === kind && skipI === i)) pts.push([p.x, p.y]);
    });
    pushXY(t.decals, 'decal');
    pushXY(t.items, 'item');
    pushXY(t.objects, 'asset');
    if (t.start && !(skipKind === 'start')) pts.push([t.start.x, t.start.y]);
    pushXY(t.hazards && t.hazards.ramps, 'ramp');
    pushXY(t.hazards && t.hazards.mines, 'mine');
    pushXY(t.hazards && t.hazards.oils, 'oil');
    pushXY(t.hazards && t.hazards.pads, 'pad');
    let best = null, bd = 28;
    pts.forEach((p) => {
      const d = Math.hypot(p[0] - px, p[1] - py);
      if (d < bd) { bd = d; best = p; }
    });
    return best ? [best[0], best[1]] : [px, py];
  }

  return {CELL, ROADW, fillGround, strokeRoad, drawItem, drawWeather, weatherId, matAt, snapWorld};
})();
