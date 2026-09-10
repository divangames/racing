////////////////////////////////////////////////////////
//
// DiVANEngine: мины, масло, бусты и трамплины на сплайне.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Два трамплина на прямых полигона, не у старта.
   * @param {object} T
   * @returns {object[]}
   */
  function placeLabRampsEngine(T) {
    const S = T.S, N = T.N;
    if (!S || !N) return [];
    const want = [0.26, 0.74];
    const ramps = [];
    want.forEach(function (u) {
      const aim = Math.floor(u * N) % N;
      let best = aim, bk = 1e9;
      const span = Math.max(12, Math.floor(N * 0.06));
      for (let d = -span; d <= span; d++) {
        const i = (aim + d + N) % N;
        if (i < 24 || i > N - 24) continue;
        const k = S[i].k;
        if (k < bk) { bk = k; best = i; }
      }
      if (ramps.some(function (q) { return Math.min(Math.abs(q.i - best), N - Math.abs(q.i - best)) < 36; })) return;
      ramps.push({ i: best, x: S[best].x, y: S[best].y, ang: S[best].ang });
    });
    return ramps;
  }

  /**
   * Раскладывает опасности: план карты, полигон или процедура.
   * @param {object} T
   * @param {number} seed
   * @returns {{pads:object[],ramps:object[],mines:object[],oils:object[],picks:object[]}}
   */
  function placeTrackHazardsEngine(T, seed) {
    if (T && T.lab) return { pads: [], ramps: placeLabRamps(T), mines: [], oils: [], picks: [] };
    if (T && T.hazardPlan && global.RnRTracks && T.autoHazards === false) {
      const hz = RnRTracks.fromPlan(T, T.hazardPlan);
      hz.picks = hz.picks || [];
      return hz;
    }
    const S = T.S, N = T.N, Rz = mulberry(seed);
    const valid = function (i) { return i > 80 && i < N - 80; };
    const pads = [], mines = [], oils = [];
    const byK = S.map(function (p, i) { return { i: i, k: p.k }; });
    const straight = byK.filter(function (o) { return o.k < .0045 && valid(o.i); }).sort(function (a, b) { return a.k - b.k; });
    for (const o of straight) {
      if (pads.length >= 6) break;
      if (pads.every(function (p) { return Math.abs(p.i - o.i) > 34 && Math.abs(p.i - o.i) < N - 34; })) pads.push({ i: o.i });
    }
    const ramps = [];
    const crossOK = function (idx) {
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
      if (ramps.every(function (q) { return Math.abs(q.i - o.i) > 60 && Math.abs(q.i - o.i) < N - 60; }))
        ramps.push({ i: o.i, x: S[o.i].x, y: S[o.i].y, ang: S[o.i].ang });
    }
    const mid = byK.filter(function (o) { return o.k > .004 && o.k < .012 && valid(o.i); });
    for (let j = 0; j < 8 && mid.length; j++) {
      const o = mid[(Rz() * mid.length) | 0];
      if (mines.every(function (m) { return Math.abs(m.i - o.i) > 26; })) mines.push({ i: o.i, lat: (Rz() * 2 - 1) * (ROADW - 40) });
    }
    for (let j = 0; j < 6; j++) {
      const i = 80 + ((Rz() * (N - 160)) | 0);
      if (oils.every(function (o) { return Math.abs(o.i - i) > 30; })) oils.push({ i: i, lat: (Rz() * 2 - 1) * (ROADW - 36), rot: Rz() * TAU });
    }
    for (const m of mines) { const p = S[m.i]; m.x = p.x + p.nx * m.lat; m.y = p.y + p.ny * m.lat; }
    for (const o of oils) { const p = S[o.i]; o.x = p.x + p.nx * o.lat; o.y = p.y + p.ny * o.lat; }
    for (const pd of pads) { const p = S[pd.i]; pd.x = p.x; pd.y = p.y; pd.ang = p.ang; pd.cool = 0; }
    const types = ['money', 'money', 'money', 'wrench', 'wrench', 'wrench', 'wrench', 'wep', 'wep', 'wep', 'wep', 'ult', 'ult', 'ult', 'nit', 'nit', 'nit', 'shield', 'shield', 'bolt', 'bolt', 'ult', 'ult', 'ult', 'ult', 'ult'];
    const picks = [];
    for (let j = 0; j < types.length; j++) {
      let i = 60 + ((Rz() * (N - 120)) | 0), tr = 0;
      while (picks.some(function (p) { return Math.abs(p.i - i) < 16; }) && tr++ < 20) i = 60 + ((Rz() * (N - 120)) | 0);
      const lat = (Rz() * 2 - 1) * (ROADW - 32), p = S[i];
      picks.push({ i: i, type: types[j], x: p.x + p.nx * lat, y: p.y + p.ny * lat, alive: true, rt: 0, val: 20 + ((Rz() * 4) | 0) * 10 });
    }
    if (T && T.hazardPlan && (T.hazardPlan.picks || []).length && global.RnRTracks) {
      const planned = RnRTracks.fromPlan(T, T.hazardPlan);
      if (planned.picks && planned.picks.length) return { pads: pads, ramps: ramps, mines: mines, oils: oils, picks: planned.picks };
    }
    return { pads: pads, ramps: ramps, mines: mines, oils: oils, picks: picks };
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.replace('placeLabRamps', placeLabRampsEngine);
  engine.replace('placeTrackHazards', placeTrackHazardsEngine);
})(typeof window !== 'undefined' ? window : globalThis);
