////////////////////////////////////////////////////////
//
// Сплайн как в заезде: равномерные точки, борта, авто-итемы
//
////////////////////////////////////////////////////////
'use strict';

window.MapLayout = (() => {
  const TAU = Math.PI * 2;
  const ROADW = 95;
  const splineMemo = { sig: '', S: [] };
  const visMemo = { sig: '', out: null };

  /** Короткий угол между направлениями. */
  function angDiff(a, b) {
    let d = a - b;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    return d;
  }

  /** Catmull–Rom, как buildTrack. */
  function catmull(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t;
    return [
      0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
      0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
    ];
  }

  /** mulberry32: тот же класс зерна, что у заезда. */
  function mulberry(seed) {
    let a = seed | 0;
    return function () {
      a |= 0;
      a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /** Нормали и кривизна на петле. */
  function bindTan(S) {
    const N = S.length;
    for (let i = 0; i < N; i++) {
      const p = S[(i + N - 1) % N], q = S[(i + 1) % N];
      let dx = q.x - p.x, dy = q.y - p.y;
      const l = Math.hypot(dx, dy) || 1;
      dx /= l; dy /= l;
      S[i].tx = dx; S[i].ty = dy; S[i].nx = -dy; S[i].ny = dx; S[i].ang = Math.atan2(dy, dx);
    }
    for (let i = 0; i < N; i++) S[i].k = Math.abs(angDiff(S[(i + 1) % N].ang, S[(i + N - 1) % N].ang)) / 28;
  }

  /** Ключ контрольных точек без JSON.parse. */
  function cpsSig(cps) {
    if (!cps || !cps.length) return '';
    let s = String(cps.length);
    for (let i = 0; i < cps.length; i++) s += ':' + cps[i][0] + ',' + cps[i][1];
    return s;
  }

  /** Ключ ручных маркеров, чтобы кэш не врал при перетаскивании. */
  function marksSig(list) {
    const a = list || [];
    let s = String(a.length);
    for (let i = 0; i < a.length; i++) s += ':' + (a[i].x || 0) + ',' + (a[i].y || 0) + ',' + (a[i].ang || 0);
    return s;
  }

  /**
   * Равномерный сплайн в мировых координатах редактора (без сдвига холста заезда).
   * @param {number[][]} cps
   * @returns {object[]}
   */
  function spline(cps) {
    const sig = cpsSig(cps);
    if (sig && splineMemo.sig === sig) return splineMemo.S;
    const n = cps && cps.length;
    if (!n || n < 4) {
      splineMemo.sig = sig;
      splineMemo.S = [];
      return splineMemo.S;
    }
    const raw = [];
    const SUB = Math.max(20, Math.ceil(700 / n));
    for (let i = 0; i < n; i++) {
      const p0 = cps[(i + n - 1) % n], p1 = cps[i], p2 = cps[(i + 1) % n], p3 = cps[(i + 2) % n];
      for (let j = 0; j < SUB; j++) raw.push(catmull(p0, p1, p2, p3, j / SUB));
    }
    let L = 0;
    const cum = [0];
    for (let i = 1; i <= raw.length; i++) {
      const a = raw[i - 1], b = raw[i % raw.length];
      L += Math.hypot(b[0] - a[0], b[1] - a[1]);
      cum.push(L);
    }
    const target = Math.max(32, Math.round(L / 14));
    const S = [];
    let seg = 0;
    for (let i = 0; i < target; i++) {
      const d = i / target * L;
      while (cum[seg + 1] < d && seg < raw.length - 1) seg++;
      const a = raw[seg], b = raw[(seg + 1) % raw.length];
      const f = (d - cum[seg]) / ((cum[seg + 1] - cum[seg]) || 1);
      S.push({ x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f });
    }
    bindTan(S);
    splineMemo.sig = sig;
    splineMemo.S = S;
    return S;
  }

  /** Зерно как у первого круга карьеры на этом стоке. */
  function seedOf(t) {
    const stock = (window.RnRTracks && RnRTracks.STOCK) || [];
    let idx = stock.findIndex((s) => s === t || (s.cps && t.cps && s.cps.length === t.cps.length && s.cps[0] && t.cps[0] && s.cps[0][0] === t.cps[0][0] && s.cps[0][1] === t.cps[0][1]));
    if (idx < 0 && t.stockIdx != null) idx = t.stockIdx | 0;
    if (idx < 0) {
      const id = String(t.id || '');
      let h = 0;
      for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
      idx = Math.abs(h) % 97;
    }
    return 100 + idx * 13;
  }

  /**
   * Авто-расстановка заезда: трамплины, пады, мины, масло, бонусы.
   * @param {object} t
   * @param {object[]} S
   * @returns {{pads:object[],ramps:object[],mines:object[],oils:object[],picks:object[]}}
   */
  function autoHazards(t, S) {
    const N = S.length;
    const empty = { pads: [], ramps: [], mines: [], oils: [], picks: [] };
    if (!N) return empty;
    const Rz = mulberry(seedOf(t));
    const valid = (i) => i > 80 && i < N - 80;
    const pads = [], mines = [], oils = [];
    const byK = S.map((p, i) => ({ i: i, k: p.k }));
    const straight = byK.filter((o) => o.k < 0.0045 && valid(o.i)).sort((a, b) => a.k - b.k);
    for (const o of straight) {
      if (pads.length >= 6) break;
      if (pads.every((p) => Math.abs(p.i - o.i) > 34 && Math.abs(p.i - o.i) < N - 34)) pads.push({ i: o.i });
    }
    const ramps = [];
    const crossOK = (idx) => {
      const p = S[idx];
      for (let j = 0; j < N; j += 6) {
        if (Math.abs(((j - idx + N + N / 2) % N) - N / 2) < 50) continue;
        if (Math.hypot(S[j].x - p.x, S[j].y - p.y) < 180) return false;
      }
      return true;
    };
    for (const o of straight) {
      if (ramps.length >= 3) break;
      if (!crossOK(o.i)) continue;
      if (ramps.every((q) => Math.abs(q.i - o.i) > 60 && Math.abs(q.i - o.i) < N - 60))
        ramps.push({ i: o.i, x: S[o.i].x, y: S[o.i].y, ang: S[o.i].ang });
    }
    const mid = byK.filter((o) => o.k > 0.004 && o.k < 0.012 && valid(o.i));
    for (let j = 0; j < 8 && mid.length; j++) {
      const o = mid[(Rz() * mid.length) | 0];
      if (mines.every((m) => Math.abs(m.i - o.i) > 26)) mines.push({ i: o.i, lat: (Rz() * 2 - 1) * (ROADW - 40) });
    }
    for (let j = 0; j < 6; j++) {
      const i = 80 + ((Rz() * (N - 160)) | 0);
      if (oils.every((o) => Math.abs(o.i - i) > 30)) oils.push({ i: i, lat: (Rz() * 2 - 1) * (ROADW - 36), rot: Rz() * TAU });
    }
    mines.forEach((m) => { const p = S[m.i]; m.x = p.x + p.nx * m.lat; m.y = p.y + p.ny * m.lat; });
    oils.forEach((o) => { const p = S[o.i]; o.x = p.x + p.nx * o.lat; o.y = p.y + p.ny * o.lat; o.rot = o.rot; });
    pads.forEach((pd) => { const p = S[pd.i]; pd.x = p.x; pd.y = p.y; pd.ang = p.ang; });
    const types = ['money', 'money', 'money', 'wrench', 'wrench', 'wrench', 'wrench', 'wep', 'wep', 'wep', 'wep', 'ult', 'ult', 'ult', 'nit', 'nit', 'nit', 'shield', 'shield', 'bolt', 'bolt', 'ult', 'ult', 'ult', 'ult', 'ult'];
    const picks = [];
    for (let j = 0; j < types.length; j++) {
      let i = 60 + ((Rz() * (N - 120)) | 0), tr = 0;
      while (picks.some((p) => Math.abs(p.i - i) < 16) && tr++ < 20) i = 60 + ((Rz() * (N - 120)) | 0);
      const lat = (Rz() * 2 - 1) * (ROADW - 32), p = S[i];
      picks.push({ i: i, type: types[j], x: p.x + p.nx * lat, y: p.y + p.ny * lat });
    }
    return { pads: pads, ramps: ramps, mines: mines, oils: oils, picks: picks };
  }

  /**
   * Что видно на холсте: ручная расстановка или авто заезда.
   * @param {object} t
   * @param {object[]} S
   * @returns {object}
   */
  function visible(t, S) {
    const hz = (t && t.hazards) || {};
    const sig = cpsSig(t && t.cps) + '|' + (t && t.id) + '|' + (t && t.autoHazards) + '|' +
      marksSig(t && t.items) + '|' + marksSig(hz.ramps) + '|' + marksSig(hz.mines) + '|' +
      marksSig(hz.oils) + '|' + marksSig(hz.pads) + '|' + ((S && S.length) || 0);
    if (visMemo.sig === sig) return visMemo.out;
    const authored = {
      ramps: (t.hazards && t.hazards.ramps) || [],
      mines: (t.hazards && t.hazards.mines) || [],
      oils: (t.hazards && t.hazards.oils) || [],
      pads: (t.hazards && t.hazards.pads) || [],
      picks: t.items || []
    };
    const hasHand = authored.ramps.length + authored.mines.length + authored.oils.length + authored.pads.length + authored.picks.length;
    let out;
    if (t.autoHazards === false && hasHand) out = authored;
    else if (t.autoHazards === false) out = authored;
    else {
      const auto = autoHazards(t, S);
      if (authored.picks.length) auto.picks = authored.picks;
      if (authored.ramps.length) auto.ramps = authored.ramps;
      if (authored.mines.length) auto.mines = authored.mines;
      if (authored.oils.length) auto.oils = authored.oils;
      if (authored.pads.length) auto.pads = authored.pads;
      out = auto;
    }
    visMemo.sig = sig;
    visMemo.out = out;
    return out;
  }

  return { ROADW, spline, visible, autoHazards, seedOf, cpsSig };
})();
