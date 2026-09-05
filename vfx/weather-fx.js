////////////////////////////////////////////////////////
//
// Погода трассы: биом, молния, дымка; осадки — quarks или холст
//
////////////////////////////////////////////////////////

(function (root) {
 'use strict';
 const TAU = Math.PI * 2;
 const CATALOG = {
  clear: { id: 'clear', name: 'ЯСНО', mod: 1, parts: 0, col: '#fff', vis: 1 },
  rain: { id: 'rain', name: 'ДОЖДЬ', mod: 0.85, parts: 260, col: '#8ec8ff', vis: 0.93 },
  snow: { id: 'snow', name: 'СНЕГ', mod: 0.9, parts: 240, col: '#eef6ff', vis: 0.95 },
  sand: { id: 'sand', name: 'ПЕСЧАНАЯ БУРЯ', mod: 0.75, parts: 260, col: '#d4a574', vis: 0.9 },
  ash: { id: 'ash', name: 'ИЗВЕРЖЕНИЕ', mod: 0.82, parts: 120, col: '#ff6b3a', vis: 0.9 }
 };

 /** Биом трассы → погода. Полигон без эффектов. */
 function pick(T, lab) {
  const forced = T && T.theme && T.theme.weather && CATALOG[T.theme.weather];
  if (forced) return forced;
  if (lab || !T || !T.theme) return CATALOG.clear;
  const map = T.theme.map, deco = T.theme.deco;
  if (deco === 'lava') return CATALOG.ash;
  if (map === 'snow' || deco === 'ice') return CATALOG.snow;
  if (map === 'sand' || map === 'desert' || deco === 'cactus' || deco === 'rock') return CATALOG.sand;
  if (map === 'garden' || deco === 'skull') return CATALOG.rain;
  return CATALOG.clear;
 }

 function reduced() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
 }

 function quality(settings) {
  const p = settings && settings.graphics && settings.graphics.particles;
  if (p === 'low') return 0.38;
  if (p === 'medium') return 0.68;
  return 1;
 }

 function weatherEnabled(settings) {
  return !!(settings && settings.graphics && settings.graphics.weather);
 }

 /** Осадки в three.quarks, не круги на холсте. */
 function quarksPrecip(settings) {
  if (!weatherEnabled(settings)) return false;
  if (!root.RnRVfx || !RnRVfx.ok || typeof RnRVfx.weather !== 'function') return false;
  if (!settings.graphics || settings.graphics.particles === 'low') return false;
  if (reduced()) return false;
  return true;
 }

 function rnd(a, b) { return a + Math.random() * (b - a); }

 /** Состояние слоя на объекте заезда. */
 function fx(R) {
  if (!R.wxFx) {
   R.wxFx = {
    parts: [],
    bolts: [],
    flash: 0,
    nextStrike: rnd(2.2, 6.5)
   };
  }
  return R.wxFx;
 }

 function spawnOne(id, cam) {
  const x = cam.x + rnd(-80, cam.w + 80);
  const y = cam.y + rnd(-40, cam.h + 20);
  if (id === 'rain') {
   const z = rnd(0.65, 1.35);
   return { k: 'rain', x, y: cam.y + rnd(-90, -10), vx: rnd(70, 140) * z, vy: rnd(520, 880) * z, len: rnd(14, 28) * z, thick: z > 1 ? 1.35 : 0.85, z };
  }
  if (id === 'snow') {
   const sz = rnd(2.4, 6.2);
   return { k: 'snow', x, y: cam.y + rnd(-60, cam.h * 0.2), vx: rnd(-28, 18), vy: rnd(28, 78) / Math.max(1.2, sz * 0.55), sz, rot: rnd(0, TAU), spin: rnd(-1.6, 1.6), wob: rnd(0.6, 1.8) };
  }
  if (id === 'ash') {
   const ember = Math.random() < 0.38;
   return {
    k: ember ? 'ember' : 'ash',
    x, y: cam.y + rnd(-80, cam.h * 0.4),
    vx: rnd(-50, 40), vy: ember ? rnd(70, 160) : rnd(40, 110),
    sz: ember ? rnd(2.2, 4.5) : rnd(3.5, 7.5),
    a: ember ? rnd(0.55, 0.9) : rnd(0.35, 0.65)
   };
  }
  const rise = Math.random() < 0.58;
  return {
   k: 'sand', x, y: rise ? cam.y + cam.h + rnd(4, 50) : cam.y + rnd(0, cam.h),
   vx: rnd(90, 220), vy: rise ? rnd(-140, -40) : rnd(-30, 50),
   sz: rnd(2.2, 6.5), a: rnd(0.28, 0.55)
  };
 }

 function refill(R, cam, q, calm) {
  const w = R.weather;
  if (!w || !w.id || w.id === 'clear' || w.parts <= 0) { fx(R).parts.length = 0; return; }
  const want = Math.max(8, Math.round(w.parts * q * (calm ? 0.22 : 1)));
  const st = fx(R);
  while (st.parts.length < want) st.parts.push(spawnOne(w.id, cam));
  if (st.parts.length > want) st.parts.length = want;
 }

 function outOfView(p, cam) {
  return p.y > cam.y + cam.h + 50 || p.y < cam.y - 120 || p.x > cam.x + cam.w + 120 || p.x < cam.x - 120;
 }

 /** Ломаная молния в экранных координатах. */
 function makeBolt(sw, sh) {
  const x0 = rnd(sw * 0.12, sw * 0.88);
  const pts = [{ x: x0, y: -8 }];
  let x = x0, y = -8;
  const end = rnd(sh * 0.35, sh * 0.78);
  while (y < end) {
   y += rnd(18, 42);
   x += rnd(-38, 38);
   pts.push({ x, y });
  }
  const forks = [];
  if (Math.random() < 0.65 && pts.length > 4) {
   const i = 2 + ((Math.random() * (pts.length - 3)) | 0);
   const b = pts[i];
   const f = [{ x: b.x, y: b.y }];
   let fx = b.x, fy = b.y;
   for (let k = 0; k < 4; k++) {
    fy += rnd(12, 28);
    fx += rnd(18, 54) * (Math.random() < 0.5 ? -1 : 1);
    f.push({ x: fx, y: fy });
   }
   forks.push(f);
  }
  return { pts, forks, t: 0.16 };
 }

 function tickLightning(R, dt, cam, sw, sh, calm) {
  const st = fx(R);
  if (R.weather.id !== 'rain' || calm) {
   st.flash = Math.max(0, st.flash - dt * 4);
   st.bolts.length = 0;
   return;
  }
  st.nextStrike -= dt;
  st.flash = Math.max(0, st.flash - dt * 3.2);
  for (let i = st.bolts.length - 1; i >= 0; i--) {
   st.bolts[i].t -= dt;
   if (st.bolts[i].t <= 0) st.bolts.splice(i, 1);
  }
  if (st.nextStrike <= 0) {
   st.nextStrike = rnd(3.4, 9.2);
   st.flash = 1;
   st.bolts.push(makeBolt(sw, sh));
   if (Math.random() < 0.35) st.bolts.push(makeBolt(sw, sh));
   if (R.shake != null) R.shake = Math.max(R.shake, 3.2);
  }
 }

 /** Снять quarks-осадки, если погода выключена. */
 function quarksOff() {
  if (root.RnRVfx && typeof RnRVfx.weather === 'function') RnRVfx.weather('off', 0);
 }

 /**
 * Шаг погоды.
 * @param {object} R заезд
 * @param {number} dt сек
 * @param {{x:number,y:number,w:number,h:number}} cam видимый мир
 * @param {number} sw ширина экрана слоя
 * @param {number} sh высота экрана слоя
 * @param {object} settings настройки
 */
 function tick(R, dt, cam, sw, sh, settings) {
  if (!R || !cam) return;
  const st = fx(R);
  if (!weatherEnabled(settings) || !R.weather || R.weather.id === 'clear' || R.weather.parts <= 0) {
   st.parts.length = 0;
   st.bolts.length = 0;
   st.flash = 0;
   quarksOff();
   return;
  }
  const calm = reduced();
  const q = quality(settings);
  const useQ = quarksPrecip(settings);
  if (useQ) {
   st.parts.length = 0;
   RnRVfx.weather(R.weather.id, q);
  } else {
   quarksOff();
   refill(R, cam, q, calm);
   const id = R.weather.id;
   for (let i = st.parts.length - 1; i >= 0; i--) {
    const p = st.parts[i];
    if (p.k === 'snow') {
     p.x += (p.vx + Math.sin((R.time || 0) * p.wob + p.rot) * 18) * dt;
     p.y += p.vy * dt;
     p.rot += p.spin * dt;
    } else if (p.k === 'sand') {
     p.x += p.vx * dt;
     p.y += p.vy * dt;
     p.vy += (p.vy < -10 ? 28 : -12) * dt;
    } else if (p.k === 'ash' || p.k === 'ember') {
     p.x += (p.vx + Math.sin((R.time || 0) * 2.2 + p.x * 0.01) * 18) * dt;
     p.y += p.vy * dt;
    } else {
     p.x += p.vx * dt;
     p.y += p.vy * dt;
    }
    if (outOfView(p, cam)) st.parts[i] = spawnOne(id, cam);
   }
  }
  tickLightning(R, dt, cam, sw, sh, calm);
 }

 /** Запасные осадки на холсте, если quarks выключен. */
 function drawWorld(g, R) {
  if (root.RnRVfx && RnRVfx.weatherOn) return;
  if (!R || !R.wxFx || !R.weather || R.weather.parts <= 0) return;
  const parts = R.wxFx.parts;
  if (R.weather.id === 'rain') {
   for (const p of parts) {
    if (p.k !== 'rain') continue;
    const a = Math.atan2(p.vy, p.vx);
    g.save();
    g.translate(p.x, p.y);
    g.rotate(a);
    const fade = 0.22 + p.z * 0.28;
    g.fillStyle = 'rgba(186,214,255,' + fade + ')';
    g.fillRect(0, -p.thick * 0.5, p.len, p.thick);
    g.fillStyle = 'rgba(255,255,255,' + fade * 0.45 + ')';
    g.fillRect(p.len * 0.55, -p.thick * 0.25, p.len * 0.45, p.thick * 0.5);
    g.restore();
   }
   return;
  }
  if (R.weather.id === 'snow') {
   for (const p of parts) {
    if (p.k !== 'snow') continue;
    g.save();
    g.translate(p.x, p.y);
    g.rotate(p.rot);
    g.fillStyle = 'rgba(255,255,255,.88)';
    g.beginPath();
    g.ellipse(0, 0, p.sz, p.sz * 0.72, 0, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(210,230,255,.35)';
    g.beginPath();
    g.arc(-p.sz * 0.2, -p.sz * 0.15, p.sz * 0.35, 0, TAU);
    g.fill();
    g.restore();
   }
   return;
  }
  if (R.weather.id === 'ash') {
   for (const p of parts) {
    if (p.k === 'ember') {
     g.fillStyle = 'rgba(255,120,40,' + p.a + ')';
     g.beginPath();
     g.ellipse(p.x, p.y, p.sz * 0.55, p.sz * 1.4, 0.2, 0, TAU);
     g.fill();
    } else if (p.k === 'ash') {
     g.fillStyle = 'rgba(48,32,26,' + p.a + ')';
     g.beginPath();
     g.ellipse(p.x, p.y, p.sz, p.sz * 0.7, 0.3, 0, TAU);
     g.fill();
    }
   }
   return;
  }
  for (const p of parts) {
   if (p.k !== 'sand') continue;
   g.fillStyle = 'rgba(196,148,82,' + p.a + ')';
   g.beginPath();
   g.ellipse(p.x, p.y, p.sz * 1.6, p.sz * 0.7, 0.4, 0, TAU);
   g.fill();
  }
 }

 /** Дымка и молния. Вызывать в экранных координатах. */
 function drawScreen(g, R, sw, sh) {
  if (!R || !R.weather || R.weather.parts <= 0) return;
  const st = R.wxFx;
  const vis = R.weather.vis;
  if (R.weather.id === 'rain') {
   g.fillStyle = 'rgba(12,22,38,' + (1 - vis) * 0.28 + ')';
   g.fillRect(0, 0, sw, sh);
  } else if (R.weather.id === 'snow') {
   g.fillStyle = 'rgba(180,205,230,' + (1 - vis) * 0.22 + ')';
   g.fillRect(0, 0, sw, sh);
  } else if (R.weather.id === 'sand') {
   const hg = g.createLinearGradient(0, sh, 0, sh * 0.12);
   hg.addColorStop(0, 'rgba(168,112,48,.1)');
   hg.addColorStop(0.55, 'rgba(140,92,40,' + (1 - vis) * 0.18 + ')');
   hg.addColorStop(1, 'rgba(90,55,22,.03)');
   g.fillStyle = hg;
   g.fillRect(0, 0, sw, sh);
  } else if (R.weather.id === 'ash') {
   const hg = g.createLinearGradient(0, sh, 0, 0);
   hg.addColorStop(0, 'rgba(90,18,6,.14)');
   hg.addColorStop(0.45, 'rgba(40,8,4,' + (1 - vis) * 0.22 + ')');
   hg.addColorStop(1, 'rgba(20,4,2,.04)');
   g.fillStyle = hg;
   g.fillRect(0, 0, sw, sh);
  }
  if (st && st.flash > 0.02 && R.weather.id === 'rain') {
   g.fillStyle = 'rgba(230,238,255,' + (st.flash * 0.42) + ')';
   g.fillRect(0, 0, sw, sh);
   g.strokeStyle = 'rgba(255,255,255,' + (0.35 + st.flash * 0.55) + ')';
   g.lineWidth = 2.2;
   g.lineJoin = 'round';
   for (const b of st.bolts) {
    g.globalAlpha = clamp01(b.t / 0.16) * st.flash;
    g.beginPath();
    g.moveTo(b.pts[0].x, b.pts[0].y);
    for (let i = 1; i < b.pts.length; i++) g.lineTo(b.pts[i].x, b.pts[i].y);
    g.stroke();
    for (const f of b.forks) {
     g.lineWidth = 1.2;
     g.beginPath();
     g.moveTo(f[0].x, f[0].y);
     for (let i = 1; i < f.length; i++) g.lineTo(f[i].x, f[i].y);
     g.stroke();
     g.lineWidth = 2.2;
    }
   }
   g.globalAlpha = 1;
  }
 }

 function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

 root.RnRWeather = {
  catalog: CATALOG,
  pick,
  tick,
  drawWorld,
  drawScreen
 };
})(typeof window !== 'undefined' ? window : globalThis);
