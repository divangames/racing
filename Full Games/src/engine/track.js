////////////////////////////////////////////////////////
//
// DiVANEngine: сплайн трассы, покрытие, лужи.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /** Цвета полотна по материалу. */
  const ROAD_MATERIALS = {
    asphalt: { road: '#43404b' }, sand: { road: '#b88a4e' }, dirt: { road: '#76503a' },
    grass: { road: '#687447' }, ice: { road: '#72b8d1' }, snow: { road: '#d8eaf0' }, lava: { road: '#47221a' }
  };

  /**
   * Catmull–Rom между четырьмя контрольными точками.
   * @param {number[]} p0
   * @param {number[]} p1
   * @param {number[]} p2
   * @param {number[]} p3
   * @param {number} t
   * @returns {number[]}
   */
  function catmull(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t;
    return [
      .5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
      .5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
    ];
  }

  /**
   * Строит равномерный сплайн, старт, деколи и план опасностей.
   * @param {object} def
   * @param {number} idx
   * @returns {object}
   */
  function buildTrackEngine(def, idx) {
    const cps = def.cps, n = cps.length, raw = [];
    const SUB = Math.max(20, Math.ceil(700 / n));
    for (let i = 0; i < n; i++) {
      const p0 = cps[(i + n - 1) % n], p1 = cps[i], p2 = cps[(i + 1) % n], p3 = cps[(i + 2) % n];
      for (let j = 0; j < SUB; j++) raw.push(catmull(p0, p1, p2, p3, j / SUB));
    }
    let L = 0; const cum = [0];
    for (let i = 1; i <= raw.length; i++) {
      const a = raw[i - 1], b = raw[i % raw.length];
      L += Math.hypot(b[0] - a[0], b[1] - a[1]); cum.push(L);
    }
    const target = Math.round(L / 14), S = []; let seg = 0;
    for (let i = 0; i < target; i++) {
      const d = i / target * L;
      while (cum[seg + 1] < d && seg < raw.length - 1) seg++;
      const a = raw[seg], b = raw[(seg + 1) % raw.length], f = (d - cum[seg]) / ((cum[seg + 1] - cum[seg]) || 1);
      S.push({ x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f });
    }
    const N = S.length;
    const bindTan = function () {
      for (let i = 0; i < N; i++) {
        const p = S[(i + N - 1) % N], q = S[(i + 1) % N];
        let dx = q.x - p.x, dy = q.y - p.y;
        const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
        S[i].tx = dx; S[i].ty = dy; S[i].nx = -dy; S[i].ny = dx; S[i].ang = Math.atan2(dy, dx);
      }
      for (let i = 0; i < N; i++) S[i].k = Math.abs(angDiff(S[(i + 1) % N].ang, S[(i + N - 1) % N].ang)) / 28;
    };
    bindTan();
    const upper = []; const segN = 2 + (idx % 2);
    for (let s = 0; s < segN; s++) {
      const a = Math.floor(N * (0.10 + 0.85 * s / segN));
      const b = Math.floor(N * (0.10 + 0.85 * (s + 0.5) / segN));
      upper.push({ a: Math.min(N - 1, a), b: Math.min(N - 1, b) });
    }
    let si = 0;
    if (def.start && isFinite(+def.start.x) && isFinite(+def.start.y)) {
      let bd = 1e18;
      for (let i = 0; i < N; i++) {
        const d = (S[i].x - def.start.x) * (S[i].x - def.start.x) + (S[i].y - def.start.y) * (S[i].y - def.start.y);
        if (d < bd) { bd = d; si = i; }
      }
    } else {
      let bk = 1e9;
      for (let i = 0; i < N; i++) {
        let w = 0; for (let q = -6; q <= 6; q++) w += S[(i + q + N) % N].k; if (w < bk) { bk = w; si = i; }
      }
    }
    if (si > 0) { const rot = S.splice(0, si); for (const q of rot) S.push(q); }
    if (def.start && isFinite(+def.start.ang) && Math.abs(angDiff(def.start.ang, S[0].ang)) > Math.PI / 2) {
      const keep = S[0], rest = S.slice(1).reverse();
      S.length = 0; S.push(keep); for (const q of rest) S.push(q);
      bindTan();
    }
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    for (const p of S) { minx = Math.min(minx, p.x); miny = Math.min(miny, p.y); maxx = Math.max(maxx, p.x); maxy = Math.max(maxy, p.y); }
    const pad = 380; minx -= pad; miny -= pad; maxx += pad; maxy += pad;
    for (const p of S) { p.x -= minx; p.y -= miny; }
    const shiftXY = function (x, y) { return { x: x - minx, y: y - miny }; };
    const decals = (def.decals || []).map(function (d) { return Object.assign({}, d, { x: d.x - minx, y: d.y - miny }); });
    const labObjects = (def.objects || []).map(function (o) { return Object.assign({}, o, shiftXY(o.x, o.y)); });
    const hzPlan = def.hazards ? {
      ramps: (def.hazards.ramps || []).map(function (p) { return Object.assign({}, p, shiftXY(p.x, p.y)); }),
      mines: (def.hazards.mines || []).map(function (p) { return Object.assign({}, p, shiftXY(p.x, p.y)); }),
      oils: (def.hazards.oils || []).map(function (p) { return Object.assign({}, p, shiftXY(p.x, p.y)); }),
      pads: (def.hazards.pads || []).map(function (p) { return Object.assign({}, p, shiftXY(p.x, p.y)); }),
      picks: (def.items || []).map(function (p) { return Object.assign({}, p, shiftXY(p.x, p.y)); })
    } : null;
    const shortcuts = (def.shortcuts || []).map(function (s) {
      return {
        name: s.name, bonus: s.bonus, radius: s.radius,
        entry: [s.entry[0] - minx, s.entry[1] - miny],
        exit: [s.exit[0] - minx, s.exit[1] - miny]
      };
    });
    return {
      S: S, N: N, w: maxx - minx, h: maxy - miny, name: def.name, theme: def.theme, zones: def.zones || [], idx: idx, upper: upper, lab: !!def.lab,
      custom: !!def.custom, id: def.id || null, decals: decals, labObjects: labObjects, hazardPlan: hzPlan, autoHazards: def.autoHazards !== false, shortcuts: shortcuts
    };
  }

  /**
   * Расстояние до сплайна (шаг 6 точек).
   * @param {object} T
   * @param {number} x
   * @param {number} y
   * @returns {number}
   */
  function distToTrackEngine(T, x, y) {
    let bd = 1e18;
    const S = T.S;
    for (let i = 0; i < S.length; i += 6) {
      const dx = S[i].x - x, dy = S[i].y - y, d = dx * dx + dy * dy;
      if (d < bd) bd = d;
    }
    return Math.sqrt(bd);
  }

  /**
   * Материал покрытия по прогрессу круга.
   * @param {object} T
   * @param {number} t
   * @returns {string}
   */
  function roadMaterialEngine(T, t) {
    for (const z of (T.zones || [])) if (t >= z.from && t < z.to) return z.material;
    return 'asphalt';
  }

  /**
   * Лужа на мокром асфальте дождевой трассы.
   * @param {object} T
   * @returns {object[]}
   */
  function makePuddlesEngine(T) {
    const a = [];
    if (!T || !T.S) return a;
    const S = T.S, N = S.length, rng = mulberry(19 + (T.idx || 0) * 41);
    for (let i = 6; i < N; i += 12) {
      if (roadMaterial(T, i / N) !== 'asphalt') continue;
      if (rng() > .48) continue;
      const p = S[i], side = (rng() - .5) * 86;
      a.push({ x: p.x + p.nx * side, y: p.y + p.ny * side, rx: 20 + rng() * 52, ry: 9 + rng() * 16, ang: p.ang });
    }
    return a;
  }

  /**
   * Точка внутри эллипса лужи.
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  function inPuddleEngine(x, y) {
    if (!R || !R.puddles) return false;
    for (const p of R.puddles) {
      const dx = x - p.x, dy = y - p.y, c = Math.cos(-p.ang), s = Math.sin(-p.ang);
      const lx = dx * c - dy * s, ly = dx * s + dy * c;
      if ((lx * lx) / (p.rx * p.rx + 0.01) + (ly * ly) / (p.ry * p.ry + 0.01) < 1.12) return true;
    }
    return false;
  }

  /**
   * Покрытие под машиной по прогрессу круга.
   * @param {object} r
   * @returns {string}
   */
  function racerRoadMatEngine(r) {
    if (!R || !R.T || !R.N) return 'asphalt';
    return roadMaterial(R.T, (r.trackIdx || 0) / R.N);
  }

  /**
   * Чем летит из-под колёс: снег на льду, вода по лужам, иначе пыль.
   * @param {object} r
   * @param {boolean} sliding
   * @returns {string}
   */
  function wheelSprayKindEngine(r, sliding) {
    const mat = racerRoadMat(r);
    if (mat === 'snow' || mat === 'ice') return 'snow';
    if (R.weather && R.weather.id === 'rain' && (inPuddle(r.x, r.y) || (sliding && mat === 'asphalt'))) return 'water';
    return 'dust';
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.track = { ROAD_MATERIALS: ROAD_MATERIALS, catmull: catmull };
  engine.replace('buildTrack', buildTrackEngine);
  engine.replace('distToTrack', distToTrackEngine);
  engine.replace('roadMaterial', roadMaterialEngine);
  engine.replace('makePuddles', makePuddlesEngine);
  engine.replace('inPuddle', inPuddleEngine);
  engine.replace('racerRoadMat', racerRoadMatEngine);
  engine.replace('wheelSprayKind', wheelSprayKindEngine);
})(typeof window !== 'undefined' ? window : globalThis);
