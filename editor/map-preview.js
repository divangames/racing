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
  let groundPat = { key: '', pat: null };
  let roadBake = { key: '', c: null, x: 0, y: 0, w: 0, h: 0 };

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

  /** Земля тайлами: клетка 64 × масштаб фона из трассы / биома. */
  function fillGround(ctx, t, x0, y0, x1, y1) {
    const im = MapTex.groundOf(t.theme);
    if (im && im.complete && im.naturalWidth) {
      const cell = CELL * RnRTracks.groundScaleOf(t.theme);
      const gkey = (im.src || '') + '|' + cell + '|' + im.naturalWidth;
      if (groundPat.key !== gkey) {
        groundPat.key = gkey;
        groundPat.pat = ctx.createPattern(im, 'repeat');
      }
      const pat = groundPat.pat;
      if (pat) {
        ctx.save();
        const s = cell / im.naturalWidth;
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

  /** Цвета полотна для ленты DiVANEngine. */
  function bindRoadApi(t) {
    const mats = {};
    Object.keys(MAT).forEach((id) => { mats[id] = { road: MAT[id] }; });
    if (t && t.theme && t.theme.road) mats.asphalt = { road: t.theme.road };
    window.ROAD_MATERIALS = mats;
    window.roadMaterial = function (T, u) { return matAt(T || t, u); };
    window.roadMaterialBlend = function (T, u) {
      const m = matAt(T || t, u);
      return { matA: m, matB: m, mix: 0 };
    };
  }

  /** Ключ запечённой ленты: петля, зоны и текстуры. */
  function roadKey(t, S) {
    const th = (t && t.theme) || {};
    const imR = MapTex.roadOf(th);
    const imL = MapTex.railOf(th);
    const rw = (imR && imR.complete && imR.naturalWidth) || 0;
    const lw = (imL && imL.complete && imL.naturalWidth) || 0;
    const z = (t && t.zones) || [];
    let zs = String(z.length);
    for (let i = 0; i < z.length; i++) zs += ':' + z[i].from + '-' + z[i].to + z[i].material;
    return MapLayout.cpsSig(t && t.cps) + '|' + (th.road || '') + '|' + (th.roadSrc || '') + '|' +
      (th.railSrc || '') + '|' + rw + '|' + lw + '|' + zs + '|' + S.length;
  }

  /**
   * Лента во внеэкранный холст: на кадре одна картинка, не сотни blit.
   * @param {object} t
   * @param {object[]} S
   * @returns {{c:HTMLCanvasElement,x:number,y:number,w:number,h:number}|null}
   */
  function ensureRoadBake(t, S) {
    const ribbon = window.DiVANEngine && DiVANEngine.trackRibbon;
    if (!ribbon || S.length < 8 || typeof Path2D !== 'function') return null;
    const key = roadKey(t, S);
    if (roadBake.key === key && roadBake.c) return roadBake;
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    for (let i = 0; i < S.length; i++) {
      minx = Math.min(minx, S[i].x);
      miny = Math.min(miny, S[i].y);
      maxx = Math.max(maxx, S[i].x);
      maxy = Math.max(maxy, S[i].y);
    }
    const pad = ROADW + 36;
    const bw = Math.max(32, maxx - minx + pad * 2);
    const bh = Math.max(32, maxy - miny + pad * 2);
    const scale = Math.min(1, 2560 / Math.max(bw, bh));
    const c = roadBake.c || document.createElement('canvas');
    c.width = Math.max(1, Math.round(bw * scale));
    c.height = Math.max(1, Math.round(bh * scale));
    const q = c.getContext('2d', { alpha: true });
    q.setTransform(scale, 0, 0, scale, -minx * scale + pad * scale, -miny * scale + pad * scale);
    q.clearRect(minx - pad, miny - pad, bw, bh);
    bindRoadApi(t);
    const T = { S: S, N: S.length, theme: t.theme || {}, zones: t.zones || [] };
    try {
      if (typeof ribbon.paintDeck === 'function') ribbon.paintDeck(q, T, ROADW, 0);
      else {
        const path = new Path2D();
        path.moveTo(S[0].x, S[0].y);
        for (let i = 1; i < S.length; i++) path.lineTo(S[i].x, S[i].y);
        path.closePath();
        ribbon.paintShoulder(q, path, ROADW);
        ribbon.paintRoadBody(q, T, ROADW, 0);
        ribbon.paintRails(q, T, ROADW, 0);
        ribbon.paintCenterDash(q, T, 0);
      }
    } catch (err) {
      console.error(err);
      return null;
    }
    roadBake = { key: key, c: c, x: minx - pad, y: miny - pad, w: bw, h: bh };
    return roadBake;
  }

  /** Векторная петля без UV — пока тянут точку сплайна. */
  function strokeRoadCheap(ctx, S, raw, t) {
    const line = S.length > 1 ? S : (raw || []).map((p) => ({ x: p[0], y: p[1] }));
    if (line.length < 2) return;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#2a1810';
    ctx.lineWidth = ROADW * 2 + 28;
    ctx.beginPath();
    line.forEach((p, i) => { if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
    ctx.closePath();
    ctx.stroke();
    ctx.strokeStyle = (t.theme && t.theme.road) || MAT.asphalt;
    ctx.lineWidth = ROADW * 2;
    ctx.stroke();
  }

  /** Полотно с рельсами, как в заезде. */
  function strokeRoad(ctx, raw, t, opts) {
    const S = (typeof MapLayout !== 'undefined' && MapLayout.spline) ? MapLayout.spline(t && t.cps) : [];
    if (opts && opts.cheap) {
      strokeRoadCheap(ctx, S, raw, t);
      return S;
    }
    const baked = ensureRoadBake(t, S);
    if (baked) {
      ctx.drawImage(baked.c, baked.x, baked.y, baked.w, baked.h);
      return S;
    }
    strokeRoadCheap(ctx, S, raw, t);
    return S;
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

  /** Сброс запечённой дороги после смены файла текстуры. */
  function invalidateRoad() {
    roadBake.key = '';
  }

  return {CELL, ROADW, fillGround, strokeRoad, drawItem, drawWeather, weatherId, matAt, snapWorld, invalidateRoad};
})();
