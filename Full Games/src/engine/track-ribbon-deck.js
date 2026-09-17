////////////////////////////////////////////////////////
//
// DiVANEngine: рельс по кускам, обрывы разлома, этаж моста.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  const TAU = Math.PI * 2;
  const MAX_SMOOTH_SAMPLES = 960;
  const CUSTOM_RAIL_HEIGHT_SCALE = 0.5;
  const CUSTOM_RAIL_TEXTURE_SUPERSAMPLE = 4;

  /** Subdivide only the rendered ribbon; physics/progress retain their indices. */
  function smoothTrack(T) {
    // Сплайн заезда уже плотный: повторное умножение его точек в четыре раза
    // делает пользовательские текстуры бортов слишком дорогими для Canvas2D.
    if (T.S.length * 4 > MAX_SMOOTH_SAMPLES) return T;
    if (T._ribbonSmooth && T._ribbonSmooth.source === T.S) {
      const samples=T._ribbonSmooth.samples;
      return Object.assign({},T,{S:samples,N:samples.length});
    }
    const S=T.S, N=S.length, out=[];
    for(let i=0;i<N;i++){
      const a=S[(i+N-1)%N],b=S[i],c=S[(i+1)%N],d=S[(i+2)%N];
      for(let j=0;j<4;j++){
        const t=j/4,t2=t*t,t3=t2*t;
        function coord(key){return .5*(2*b[key]+(-a[key]+c[key])*t+
          (2*a[key]-5*b[key]+4*c[key]-d[key])*t2+(-a[key]+3*b[key]-3*c[key]+d[key])*t3);}
        function tangent(key){return .5*((-a[key]+c[key])+2*(2*a[key]-5*b[key]+4*c[key]-d[key])*t+
          3*(-a[key]+3*b[key]-3*c[key]+d[key])*t2);}
        const dx=tangent('x'),dy=tangent('y'),length=Math.hypot(dx,dy)||1;
        out.push({x:coord('x'),y:coord('y'),tx:dx/length,ty:dy/length,nx:-dy/length,ny:dx/length,ang:Math.atan2(dy,dx)});
      }
    }
    T._ribbonSmooth={source:S,samples:out};
    return Object.assign({},T,{S:out,N:out.length});
  }

  /**
   * API ленты.
   * @returns {object|null}
   */
  function ribbon() {
    return global.DiVANEngine && global.DiVANEngine.trackRibbon;
  }

  /**
   * API разломов.
   * @returns {object|null}
   */
  function spanApi() {
    return global.DiVANEngine && global.DiVANEngine.trackSpan;
  }

  /**
   * Обрыв: зигзаг кромки разлома.
   * @param {CanvasRenderingContext2D} q
   * @param {object} p
   * @param {number} inward
   * @param {number} halfW
   */
  function paintBreakCap(q, p, inward, halfW) {
    if (!p || p.nx == null) return;
    const tx = p.tx || -p.ny, ty = p.ty || p.nx;
    q.save();
    q.lineJoin = 'miter';
    q.lineCap = 'butt';
    q.strokeStyle = '#1a0e08';
    q.lineWidth = 6;
    q.beginPath();
    const hw = halfW + 12;
    q.moveTo(p.x + p.nx * hw, p.y + p.ny * hw);
    for (let k = 1; k <= 8; k++) {
      const u = k / 8 * 2 - 1;
      const jag = (k % 2 ? 14 : -8) * inward;
      q.lineTo(p.x + tx * jag + p.nx * hw * u, p.y + ty * jag + p.ny * hw * u);
    }
    q.stroke();
    q.strokeStyle = '#6a3820';
    q.lineWidth = 2.4;
    q.stroke();
    q.restore();
  }

  /**
   * Векторный рельс по одному куску.
   * @param {CanvasRenderingContext2D} q
   * @param {object[]} S
   * @param {number} a
   * @param {number} len
   * @param {number} halfW
   */
  function strokeRailRun(q, S, a, len, halfW) {
    const rb = ribbon();
    if (!rb) return;
    for (const side of [1, -1]) {
      q.strokeStyle = 'rgba(0,0,0,.4)';
      q.lineWidth = 7;
      q.stroke(rb.offsetRun(S, a, len, side, halfW - 1));
      q.strokeStyle = '#3a2014';
      q.lineWidth = 11;
      q.stroke(rb.offsetRun(S, a, len, side, halfW + 8));
      q.strokeStyle = '#9a4824';
      q.lineWidth = 6;
      q.stroke(rb.offsetRun(S, a, len, side, halfW + 8));
      q.strokeStyle = '#e07030';
      q.lineWidth = 2.2;
      q.stroke(rb.offsetRun(S, a, len, side, halfW + 5));
      q.strokeStyle = '#1a100c';
      q.lineWidth = 2;
      q.stroke(rb.offsetRun(S, a, len, side, halfW));
    }
  }

  /**
   * Рельс: своя полоса или векторная ржавчина.
   * @param {CanvasRenderingContext2D} q
   * @param {object} T
   * @param {number} halfW
   * @param {number} [deck]
   */
  function paintRails(q, T, halfW, deck) {
    const rb = ribbon();
    if (!rb) return;
    const S = T.S, N = S.length, th = T.theme || {};
    deck = deck || 0;
    const customSource = rb.customRail(th);
    const strips = global.DiVANEngine.trackStrip;
    const sourceSize = customSource ? rb.texSize(customSource) : {w:0, h:0};
    const originalRailHalf = customSource
      ? Math.max(5, Math.min(16, ((sourceSize.h || 36) / 5) || 7))
      : 9;
    const railHalf = customSource ? originalRailHalf * CUSTOM_RAIL_HEIGHT_SCALE : originalRailHalf;
    // Геометрия остаётся тонкой, а текстура готовится в четырёхкратном
    // разрешении: финальное уменьшение Canvas2D сохраняет ржавчину и крепёж.
    const custom = customSource && rb.compactStrip
      ? rb.compactStrip(customSource, railHalf * 2 * CUSTOM_RAIL_TEXTURE_SUPERSAMPLE)
      : customSource;
    const tex = custom || (strips && strips.bakeRailStrip());
    q.lineJoin = 'round';
    q.lineCap = 'butt';
    q.imageSmoothingEnabled = true;
    if (q.imageSmoothingQuality) q.imageSmoothingQuality = 'medium';
    const api = spanApi();
    const runs = [];
    if (api && api.eachSolidRun) {
      api.eachSolidRun(T, deck, function (a, len) { runs.push({ a: a, len: len }); });
    } else if (deck === 0) {
      runs.push({ a: 0, len: N });
    }
    if (tex) {
      for (let r = 0; r < runs.length; r++) {
        const run = runs[r];
        for (const side of [1, -1]) {
          q.strokeStyle = 'rgba(0,0,0,.45)';
          q.lineWidth = railHalf * 2 + 3;
          q.stroke(rb.offsetRun(S, run.a, run.len, side, halfW + 8));
          let dist = 0;
          const nSeg = Math.min(N, run.len);
          for (let k = 0; k < nSeg; k++) {
            const a = S[(run.a + k) % N], b = S[(run.a + k + 1) % N];
            const off = halfW + 8;
            const pa = { x: a.x + a.nx * side * off, y: a.y + a.ny * side * off, nx:a.nx, ny:a.ny };
            const pb = { x: b.x + b.nx * side * off, y: b.y + b.ny * side * off, nx:b.nx, ny:b.ny };
            rb.blitSeg(q, pa, pb, tex, railHalf, dist, !!customSource && side > 0);
            dist += Math.hypot(pb.x - pa.x, pb.y - pa.y);
          }
        }
      }
      return;
    }
    for (let r = 0; r < runs.length; r++) strokeRailRun(q, S, runs[r].a, runs[r].len, halfW);
    for (let r = 0; r < runs.length; r++) {
      const run = runs[r];
      for (let k = 0; k < run.len; k += 5) {
        const p = S[(run.a + k) % N];
        for (const side of [1, -1]) {
          q.fillStyle = '#24140e';
          q.beginPath();
          q.arc(p.x + p.nx * side * (halfW + 8), p.y + p.ny * side * (halfW + 8), 1.6, 0, TAU);
          q.fill();
        }
      }
    }
  }

  /**
   * Один этаж: подушка, полотно, рельс, пунктир, обрывы.
   * @param {CanvasRenderingContext2D} q
   * @param {object} T
   * @param {number} halfW
   * @param {number} deck
   */
  function paintDeck(q, T, halfW, deck) {
    const rb = ribbon();
    if (!rb) return;
    T = smoothTrack(T);
    const S = T.S, N = S.length;
    deck = deck || 0;
    const api = spanApi();
    if (api && api.eachSolidRun) {
      api.eachSolidRun(T, deck, function (a, len) {
        q.save();
        q.lineCap = 'butt';
        rb.paintShoulder(q, rb.runPath(S, a, len), halfW);
        q.restore();
      });
    } else if (deck === 0) {
      const path = new Path2D();
      path.moveTo(S[0].x, S[0].y);
      for (let i = 1; i < N; i++) path.lineTo(S[i].x, S[i].y);
      path.closePath();
      rb.paintShoulder(q, path, halfW);
    }
    rb.paintRoadBody(q, T, halfW, deck);
    paintRails(q, T, halfW, deck);
    rb.paintCenterDash(q, T, deck);
    if (api && api.eachSolidRun) {
      api.eachSolidRun(T, deck, function (a, len) {
        if (len >= N) return;
        // A deck transition is a continuous ramp, not a broken road edge.
        if (api.inTrackGap(T, ((a-1+N)%N)/N)) paintBreakCap(q, S[a % N], 1, halfW);
        if (api.inTrackGap(T, ((a+len)%N)/N)) paintBreakCap(q, S[(a+len)%N], -1, halfW);
      });
    }
  }

  const engine = global.DiVANEngine;
  const rb = ribbon();
  if (!engine || !rb) return;
  rb.paintRails = paintRails;
  rb.paintDeck = paintDeck;
})(typeof window !== 'undefined' ? window : globalThis);
