////////////////////////////////////////////////////////
//
// DiVANEngine: лента полотна с UV вдоль сплайна и ржавые борта.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  const TAU = Math.PI * 2;

  /**
   * Размер картинки или запечённого холста.
   * @param {CanvasImageSource} tex
   * @returns {{w:number,h:number}}
   */
  function texSize(tex) {
    return {
      w: (tex && (tex.width || tex.naturalWidth)) || 0,
      h: (tex && (tex.height || tex.naturalHeight)) || 0
    };
  }

  /**
   * Модуль запечённых полос.
   * @returns {object|null}
   */
  function stripApi() {
    return global.DiVANEngine && global.DiVANEngine.trackStrip;
  }

  /**
   * Смесь покрытий, если есть хук.
   * @param {object} T
   * @param {number} t
   * @returns {{matA:string,matB:string,mix:number}}
   */
  function blendAt(T, t) {
    if (typeof roadMaterialBlend === 'function') return roadMaterialBlend(T, t);
    const m = roadMaterial(T, t);
    return { matA: m, matB: m, mix: 0 };
  }

  /**
   * API разломов, если модуль загружен.
   * @returns {object|null}
   */
  function spanApi() {
    return global.DiVANEngine && global.DiVANEngine.trackSpan;
  }

  /**
   * Путь по куску сплайна (длина может оборачивать кольцо).
   * @param {object[]} S
   * @param {number} a
   * @param {number} len
   * @returns {Path2D}
   */
  function runPath(S, a, len) {
    const p = new Path2D();
    const N = S.length;
    for (let k = 0; k <= len; k++) {
      const s = S[(a + k) % N];
      if (k === 0) p.moveTo(s.x, s.y);
      else p.lineTo(s.x, s.y);
    }
    return p;
  }

  /**
   * Путь, сдвинутый по нормали на куске или на всём кольце.
   * @param {object[]} S
   * @param {number} a
   * @param {number} len
   * @param {number} side
   * @param {number} offset
   * @returns {Path2D}
   */
  function offsetRun(S, a, len, side, offset) {
    const p = new Path2D();
    const N = S.length;
    const n = Math.min(N, len) + 1;
    for (let k = 0; k < n; k++) {
      const s = S[(a + k) % N];
      const x = s.x + s.nx * side * offset;
      const y = s.y + s.ny * side * offset;
      if (k === 0) p.moveTo(x, y);
      else p.lineTo(x, y);
    }
    return p;
  }

  /**
   * Рвать ли сегмент на этом этаже.
   * @param {object} T
   * @param {number} i
   * @param {number} deck
   * @returns {boolean}
   */
  function skipSeg(T, i, deck) {
    const api = spanApi();
    if (!api || !api.segSolid) return deck > 0;
    return !api.segSolid(T, i, deck || 0);
  }

  /**
   * UV ribbon between shared spline normals, with resolution-independent repeats.
   * @param {CanvasRenderingContext2D} q
   * @param {object} a
   * @param {object} b
   * @param {CanvasImageSource} tex
   * @param {number} halfW
   * @param {number} dist
   */
  function blitSeg(q, a, b, tex, halfW, dist) {
    const sz = texSize(tex);
    const tw = sz.w, th = sz.h;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (tw < 2 || th < 2 || len < 0.4) return;
    const nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
    const anx = a.nx == null ? nx : a.nx, any = a.ny == null ? ny : a.ny;
    const bnx = b.nx == null ? nx : b.nx, bny = b.ny == null ? ny : b.ny;
    const repeat = tex.worldWidth || (tw / th * halfW * 2);
    let remaining = len;
    let along = 0;
    let uv = dist;
    q.imageSmoothingEnabled = true;
    q.imageSmoothingQuality = 'high';
    function edge(t, side) {
      return { x:a.x+(b.x-a.x)*t+(anx+(bnx-anx)*t)*halfW*side,
        y:a.y+(b.y-a.y)*t+(any+(bny-any)*t)*halfW*side };
    }
    while (remaining > 0.0001) {
      const sx = ((uv % repeat) + repeat) % repeat;
      const take = Math.min(remaining, repeat - sx);
      const p0=edge(along/len,-1), p1=edge((along+take)/len,-1);
      const p2=edge((along+take)/len,1), p3=edge(along/len,1);
      function triangle(points, xx, xy, yx, yy) {
        q.save();
        // Small overlap covers Canvas2D antialiasing cracks along shared edges.
        const winding=Math.sign((points[1].x-points[0].x)*(points[2].y-points[0].y)-
          (points[1].y-points[0].y)*(points[2].x-points[0].x))||1;
        const normals=points.map(function(p,i){
          const next=points[(i+1)%3],dx=next.x-p.x,dy=next.y-p.y,d=Math.hypot(dx,dy)||1;
          return {x:dy/d*winding,y:-dx/d*winding};
        });
        q.beginPath();
        points.forEach(function(p,i){
          const prev=normals[(i+2)%3],next=normals[i];
          const d=Math.max(.01,1+prev.x*next.x+prev.y*next.y);
          const x=p.x+(prev.x+next.x)/d*.2, y=p.y+(prev.y+next.y)/d*.2;
          if(i===0)q.moveTo(x,y);else q.lineTo(x,y);
        });
        q.closePath();q.clip();
        q.transform(xx,xy,yx,yy,p0.x,p0.y);
        // Draw beyond the clip so adjacent segments share opaque edge pixels.
        q.drawImage(tex,0,0,tw,th,-sx,-.1,repeat,th+.2);
        if(sx<.5)q.drawImage(tex,0,0,tw,th,-sx-repeat,-.1,repeat,th+.2);
        if(sx+take>repeat-.5)q.drawImage(tex,0,0,tw,th,-sx+repeat,-.1,repeat,th+.2);
        q.restore();
      }
      triangle([p0,p1,p2],(p1.x-p0.x)/take,(p1.y-p0.y)/take,(p2.x-p1.x)/th,(p2.y-p1.y)/th);
      triangle([p0,p2,p3],(p2.x-p3.x)/take,(p2.y-p3.y)/take,(p3.x-p0.x)/th,(p3.y-p0.y)/th);
      uv += take;
      along += take;
      remaining -= take;
    }
  }

  /**
   * Цвет материала с учётом темы.
   * @param {object} th
   * @param {string} mat
   * @returns {string}
   */
  function matHex(th, mat) {
    const mats = (global.ROAD_MATERIALS || (global.DiVANEngine && global.DiVANEngine.track && global.DiVANEngine.track.ROAD_MATERIALS) || {});
    const m = mats[mat] || mats.asphalt || { road: '#43404b' };
    return mat === 'asphalt' ? ((th && th.road) || m.road) : m.road;
  }

  /**
   * Живая картинка по URL темы: редактор или каталог заезда.
   * @param {string} src
   * @returns {CanvasImageSource|null}
   */
  function liveTex(src) {
    if (!src) return null;
    if (global.MapTex && typeof MapTex.img === 'function') {
      const im = MapTex.img(src, function () {
        if (global.MapView && MapView.draw) MapView.draw();
      });
      if (im && im.complete && texSize(im).w > 2) return im;
    }
    if (global.RnRTracks && typeof RnRTracks.texOf === 'function') {
      const im = RnRTracks.texOf(src);
      if (im && im.complete && texSize(im).w > 2) return im;
    }
    return null;
  }

  /**
   * Полоса: процедурная или пользовательская.
   * @param {object} th
   * @param {string} mat
   * @param {string} hex
   * @param {CanvasImageSource|null} custom
   * @returns {CanvasImageSource|null}
   */
  function stripFor(th, mat, hex, custom) {
    if (custom) return custom;
    const api = stripApi();
    if (api) return api.bakeRoadStrip(mat, hex);
    return null;
  }

  /**
   * Картинка дороги из темы.
   * @param {object} th
   * @returns {CanvasImageSource|null}
   */
  function customRoad(th) {
    return liveTex(th && th.roadSrc);
  }

  /**
   * Картинка рельса из темы.
   * @param {object} th
   * @returns {CanvasImageSource|null}
   */
  function customRail(th) {
    return liveTex(th && th.railSrc);
  }

  /**
   * Ржавая подушка под полотном.
   * @param {CanvasRenderingContext2D} q
   * @param {Path2D} path
   * @param {number} halfW
   */
  function paintShoulder(q, path, halfW) {
    q.lineJoin = 'round';
    q.lineCap = 'butt';
    q.strokeStyle = '#2a1810';
    q.lineWidth = halfW * 2 + 28;
    q.stroke(path);
    q.strokeStyle = '#5a3220';
    q.lineWidth = halfW * 2 + 18;
    q.stroke(path);
  }

  /**
   * Цвет + UV вдоль кривой, стыки зон сглажены.
   * @param {CanvasRenderingContext2D} q
   * @param {object} T
   * @param {number} halfW
   * @param {number} [deck]
   */
  function paintRoadBody(q, T, halfW, deck) {
    const S = T.S, N = S.length, th = T.theme || {};
    const custom = customRoad(th);
    const api = stripApi();
    const inner = halfW;
    deck = deck || 0;
    q.lineJoin = 'round';
    q.lineCap = 'round';
    q.imageSmoothingEnabled = true;
    if (q.imageSmoothingQuality) q.imageSmoothingQuality = 'medium';
    // Complete the opaque base first: round stroke caps otherwise erase the
    // texture of earlier segments for almost an entire road half-width.
    for (let i = 0; i < N; i++) {
      const a = S[i], b = S[(i + 1) % N];
      if (skipSeg(T, i, deck)) continue;
      const bl = blendAt(T, i / N);
      const hexA = matHex(th, bl.matA);
      const hexB = matHex(th, bl.matB);
      const col = (api && bl.mix > 0.02) ? api.lerpHex(hexA, hexB, bl.mix) : hexA;
      q.fillStyle = col;
      q.beginPath();
      q.moveTo(a.x-a.nx*halfW,a.y-a.ny*halfW);
      q.lineTo(b.x-b.nx*halfW,b.y-b.ny*halfW);
      q.lineTo(b.x+b.nx*halfW,b.y+b.ny*halfW);
      q.lineTo(a.x+a.nx*halfW,a.y+a.ny*halfW);
      q.closePath();q.fill();
    }
    let dist = 0;
    for (let i = 0; i < N; i++) {
      const a=S[i], b=S[(i+1)%N], len=Math.hypot(b.x-a.x,b.y-a.y);
      if (skipSeg(T,i,deck)) { dist+=len; continue; }
      const bl=blendAt(T,i/N), hexA=matHex(th,bl.matA), hexB=matHex(th,bl.matB);
      const texA = stripFor(th, bl.matA, hexA, custom);
      const texB = stripFor(th, bl.matB, hexB, custom);
      if (texA) {
        q.save();
        q.globalAlpha = 1;
        blitSeg(q, a, b, texA, inner, dist);
        q.restore();
      }
      if (texB && bl.mix > 0.03 && bl.matB !== bl.matA) {
        q.save();
        q.globalAlpha = bl.mix;
        blitSeg(q, a, b, texB, inner, dist);
        q.restore();
      }
      dist += len;
    }
  }

  /**
   * Жёлтый пунктир: сила по доле асфальта в смеси.
   * @param {CanvasRenderingContext2D} q
   * @param {object} T
   * @param {number} [deck]
   */
  function paintCenterDash(q, T, deck) {
    const S = T.S, N = S.length;
    deck = deck || 0;
    q.save();
    q.strokeStyle = 'rgba(232,176,48,.88)';
    q.lineWidth = 3.4;
    q.lineCap = 'butt';
    q.lineJoin = 'round';
    q.setLineDash([22, 16]);
    q.beginPath();
    let drawing = false;
    for (let i = 0; i <= N; i++) {
      const idx = i % N;
      if (skipSeg(T, idx, deck)) { drawing = false; continue; }
      const bl = blendAt(T, idx / N);
      let w = 0;
      if (bl.matA === 'asphalt') w += 1 - bl.mix;
      if (bl.matB === 'asphalt') w += bl.mix;
      if (w > 0.28) {
        const p = S[idx];
        if (!drawing) { q.moveTo(p.x, p.y); drawing = true; }
        else q.lineTo(p.x, p.y);
      } else drawing = false;
    }
    q.stroke();
    q.setLineDash([]);
    q.restore();
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.trackRibbon = {
    paintShoulder: paintShoulder,
    paintRoadBody: paintRoadBody,
    paintCenterDash: paintCenterDash,
    offsetRun: offsetRun,
    runPath: runPath,
    blitSeg: blitSeg,
    customRail: customRail,
    texSize: texSize
  };
})(typeof window !== 'undefined' ? window : globalThis);
