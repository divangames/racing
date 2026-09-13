////////////////////////////////////////////////////////
//
// DiVANEngine: разрывы полотна, развязки, трамплин на обрыве.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Прогресс круга в [0, 1).
   * @param {number} t
   * @returns {number}
   */
  function wrapLap(t) {
    t = (+t || 0) % 1;
    if (t < 0) t += 1;
    return t;
  }

  /**
   * Точка внутри дуги [from, to) на кольце.
   * @param {number} t
   * @param {number} from
   * @param {number} to
   * @returns {boolean}
   */
  function inLapSpan(t, from, to) {
    t = wrapLap(t);
    from = wrapLap(from);
    to = wrapLap(to);
    if (Math.abs(to - from) < 1e-6) return false;
    if (from < to) return t >= from && t < to;
    return t >= from || t < to;
  }

  /**
   * Длина дуги на круге.
   * @param {number} from
   * @param {number} to
   * @returns {number}
   */
  function spanLen(from, to) {
    from = wrapLap(from);
    to = wrapLap(to);
    let d = to - from;
    if (d <= 0) d += 1;
    return d;
  }

  /**
   * Разломы из JSON трассы.
   * @param {object[]} raw
   * @returns {{from:number,to:number}[]}
   */
  function normalizeGaps(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (let i = 0; i < raw.length; i++) {
      const g = raw[i] || {};
      const from = wrapLap(+g.from || 0);
      const to = wrapLap(+g.to || 0);
      const d = spanLen(from, to);
      if (d < 0.008 || d > 0.42) continue;
      out.push({ from: from, to: to });
    }
    return out;
  }

  /**
   * Склеивает соседние куски одного этажа.
   * @param {{from:number,to:number,z:number}[]} list
   * @returns {{from:number,to:number,z:number}[]}
   */
  function mergeDecks(list) {
    const out = [];
    for (const z of new Set((list || []).map(d => d.z))) {
      const raw = [];
      for (const d of list) {
        if (d.z !== z) continue;
        const from = wrapLap(d.from), to = wrapLap(d.to);
        if (from < to) raw.push({ from, to, z });
        else if (from > to) raw.push({ from, to: 1, z }, { from: 0, to, z });
      }
      raw.sort((a, b) => a.from - b.from);
      const merged = [];
      for (const d of raw) {
        const last = merged[merged.length - 1];
        if (last && d.from <= last.to) last.to = Math.max(last.to, d.to);
        else merged.push(d);
      }
      if (merged.length > 1 && merged[0].from === 0 && merged[merged.length - 1].to === 1) {
        const tail = merged.pop();
        merged[0].from = tail.from;
      }
      out.push(...merged);
    }
    return out;
  }

  /**
   * Развязка: где две нитки сплайна сходятся в XY, верхняя — эстакада.
   * @param {object[]} S
   * @param {number} N
   * @param {number} [roadW]
   * @returns {{from:number,to:number,z:number}[]}
   */
  function detectCrossingDecks(S, N, roadW) {
    if (!S || N < 24) return [];
    const halfW = roadW || 95;
    const minSep = 16;
    const mark = [];
    const cross = (ax, ay, bx, by) => ax * by - ay * bx;
    for (let i = 0; i < N; i++) {
      const a = S[i], b = S[(i + 1) % N];
      const ax = b.x - a.x, ay = b.y - a.y;
      // Each unordered pair is visited once. The old modulo loop visited it
      // in both directions and raised BOTH crossing roads to the same deck.
      for (let j = i + minSep; j < N && N - (j - i) >= minSep; j++) {
        const c = S[j], d = S[(j + 1) % N];
        const bx = d.x - c.x, by = d.y - c.y;
        const det = cross(ax, ay, bx, by);
        if (Math.abs(det) < 1e-6) continue;
        const dx = c.x - a.x, dy = c.y - a.y;
        const u = cross(dx, dy, bx, by) / det;
        const v = cross(dx, dy, ax, ay) / det;
        if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
        const sine = Math.abs(det) / (Math.hypot(ax, ay) * Math.hypot(bx, by));
        // Carry the bridge past the entire crossing footprint and its rails.
        const reach = (halfW * 2 + 32) / Math.max(.15, sine) + 40;
        for (const direction of [-1, 1]) {
          let distance = 0, index = j;
          for (let k = 0; k < N / 2 && distance <= reach; k++) {
            mark[index] = 1;
            const next = (index + direction + N) % N;
            distance += Math.hypot(S[next].x - S[index].x, S[next].y - S[index].y);
            index = next;
          }
        }
      }
    }
    const out = [];
    let k = 0;
    while (k < N) {
      if (!mark[k]) { k++; continue; }
      const a = k;
      while (k < N && mark[k]) k++;
      out.push({ from: a / N, to: k / N, z: 1 });
    }
    if (mark[0] && mark[N - 1] && out.length >= 2) {
      const first = out[0], last = out[out.length - 1];
      out[0] = { from: last.from, to: first.to, z: 1 };
      out.pop();
    }
    return mergeDecks(out);
  }

  /**
   * Эстакады: z >= 1 рисуется поверх земли.
   * @param {object[]} raw
   * @returns {{from:number,to:number,z:number}[]}
   */
  function normalizeDecks(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (let i = 0; i < raw.length; i++) {
      const d = raw[i] || {};
      const from = wrapLap(+d.from || 0);
      const to = wrapLap(+d.to || 0);
      const len = spanLen(from, to);
      if (len < 0.02 || len > 0.5) continue;
      const z = Math.max(1, Math.min(3, (d.z | 0) || 1));
      out.push({ from: from, to: to, z: z });
    }
    return out;
  }

  /**
   * Разрыв полотна по прогрессу круга.
   * @param {object} T
   * @param {number} t
   * @returns {boolean}
   */
  function inTrackGapEngine(T, t) {
    if (!T || !T.gaps || !T.gaps.length) return false;
    t = wrapLap(t);
    for (let i = 0; i < T.gaps.length; i++) {
      if (inLapSpan(t, T.gaps[i].from, T.gaps[i].to)) return true;
    }
    return false;
  }

  /**
   * Этаж полотна: 0 земля, иначе мост.
   * @param {object} T
   * @param {number} t
   * @returns {number}
   */
  function trackDeckEngine(T, t) {
    if (!T || !T.decks || !T.decks.length) return 0;
    t = wrapLap(t);
    let z = 0;
    for (let i = 0; i < T.decks.length; i++) {
      const d = T.decks[i];
      if (inLapSpan(t, d.from, d.to) && d.z > z) z = d.z;
    }
    return z;
  }

  /**
   * Сегмент i→i+1 есть на этом этаже и не в разрыве.
   * @param {object} T
   * @param {number} i
   * @param {number} deck
   * @returns {boolean}
   */
  function segSolid(T, i, deck) {
    const N = T && T.N ? T.N : (T && T.S ? T.S.length : 0);
    if (!N) return true;
    const t = ((i % N) + N) % N / N;
    if (inTrackGapEngine(T, t)) return false;
    return trackDeckEngine(T, t) === (deck || 0);
  }

  /**
   * Непрерывные куски полотна одного этажа.
   * @param {object} T
   * @param {number} deck
   * @param {function(number,number)} cb start, длина
   */
  function eachSolidRun(T, deck, cb) {
    const S = T && T.S;
    const N = S ? S.length : 0;
    if (!N || typeof cb !== 'function') return;
    const mask = [];
    let any = false, all = true;
    for (let i = 0; i < N; i++) {
      const ok = segSolid(T, i, deck);
      mask[i] = ok;
      if (ok) any = true;
      else all = false;
    }
    if (!any) return;
    if (all) { cb(0, N); return; }
    let hole = 0;
    for (let i = 0; i < N; i++) {
      if (!mask[i]) { hole = i; break; }
    }
    let walked = 0;
    while (walked < N) {
      const i = (hole + walked) % N;
      if (!mask[i]) { walked++; continue; }
      const a = i;
      let len = 0;
      while (len < N && mask[(a + len) % N]) len++;
      cb(a, len);
      walked += len;
    }
  }

  /**
   * Есть ли этаж z.
   * @param {object} T
   * @param {number} z
   * @returns {boolean}
   */
  function hasDeck(T, z) {
    const want = z || 0;
    if (want === 0) return true;
    const decks = T && T.decks;
    if (!decks) return false;
    for (let i = 0; i < decks.length; i++) {
      if (decks[i].z === want) return true;
    }
    return false;
  }

  /**
   * Трамплины на кромке каждого разрыва.
   * @param {object} T
   * @returns {object[]}
   */
  function gapRampsFromTrack(T) {
    const S = T && T.S, N = T && T.N;
    if (!S || !N || !T.gaps || !T.gaps.length) return [];
    const ramps = [];
    for (let i = 0; i < T.gaps.length; i++) {
      const g = T.gaps[i];
      const idx = (Math.floor(g.from * N) - 2 + N) % N;
      const p = S[idx];
      const frac = spanLen(g.from, g.to);
      ramps.push({
        i: idx, x: p.x, y: p.y, ang: p.ang,
        gap: true, boost: 1.25 + frac * 10
      });
    }
    return ramps;
  }

  /**
   * Есть ли эстакада в окне индексов вокруг точки круга.
   * @param {object} T
   * @param {number} i
   * @param {number} N
   * @param {number} back
   * @param {number} fwd
   * @returns {boolean}
   */
  function deckHighNear(T, i, N, back, fwd) {
    for (let k = -back; k <= fwd; k++) {
      if (trackDeckEngine(T, ((i + k + N) % N) / N) > 0) return true;
    }
    return false;
  }

  /**
   * Этаж машины: на шов эстакады заходим заранее и сходим с задержкой — без моргания.
   * @param {object} r
   * @returns {number}
   */
  function racerDeckEngine(r) {
    if (!r || !R || !R.T || !R.N) return 0;
    const N = R.N;
    const i = ((r.trackIdx | 0) % N + N) % N;
    const here = trackDeckEngine(R.T, i / N) > 0;
    if (r._deckDraw === 1) {
      r._deckDraw = deckHighNear(R.T, i, N, 12, 12) ? 1 : 0;
      return r._deckDraw;
    }
    r._deckDraw = (here || deckHighNear(R.T, i, N, 2, 16)) ? 1 : 0;
    return r._deckDraw;
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  global.inTrackGap = inTrackGapEngine;
  global.trackDeck = trackDeckEngine;
  global.racerDeck = racerDeckEngine;
  global.gapRampsFromTrack = gapRampsFromTrack;
  engine.trackSpan = {
    wrapLap: wrapLap,
    inLapSpan: inLapSpan,
    spanLen: spanLen,
    normalizeGaps: normalizeGaps,
    normalizeDecks: normalizeDecks,
    inTrackGap: inTrackGapEngine,
    trackDeck: trackDeckEngine,
    segSolid: segSolid,
    eachSolidRun: eachSolidRun,
    hasDeck: hasDeck,
    detectCrossingDecks: detectCrossingDecks,
    mergeDecks: mergeDecks,
    gapRampsFromTrack: gapRampsFromTrack,
    racerDeck: racerDeckEngine
  };
})(typeof window !== 'undefined' ? window : globalThis);
