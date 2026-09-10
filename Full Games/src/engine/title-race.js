////////////////////////////////////////////////////////
//
// DiVANEngine: демо-заезд на титуле — та же физика, свой R.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Подменяет R/P на демо титула.
   */
  function bindTitleSimEngine() {
    titleHoldR = R; titleHoldP = P;
    R = titleSim; P = titleFocus || (titleSim && titleSim.racers[0]) || null;
  }

  /**
   * Возвращает боевой R/P.
   */
  function unbindTitleSimEngine() {
    R = titleHoldR; P = titleHoldP;
  }

  /**
   * Демо на фоне не должно оставлять R/P на ИИ, если отрисовка упала.
   * @param {function()} fn
   */
  function withTitleSimEngine(fn) {
    if (!titleSim || typeof fn !== 'function') return;
    bindTitleSim();
    try { fn(); } finally { unbindTitleSim(); }
  }

  /**
   * Живой лидер пака — запасной объект камеры.
   * @returns {object|null}
   */
  function titleAliveLeadEngine() {
    if (!titleSim) return null;
    let best = null;
    for (const r of titleSim.racers) {
      if (r.dead) continue;
      if (!best || (r.prog || 0) > (best.prog || 0)) best = r;
    }
    return best || titleSim.racers[0];
  }

  /**
   * После взрыва камера едет за убийцей.
   * @param {object|null} killer
   */
  function titleFollowKillerEngine(killer) {
    if (killer && !killer.dead) { titleFocus = killer; titleFocusHold = 2.8; }
    else { titleFocus = titleAliveLead(); titleFocusHold = 1.4; }
  }

  /**
   * Тик искр, следов, ударов и гари.
   * @param {number} dt
   */
  function updRaceFxEngine(dt) {
    for (let i = R.parts.length - 1; i >= 0; i--) {
      const p = R.parts[i]; p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .94; p.vy *= .94;
      if (p.t <= 0) R.parts.splice(i, 1);
    }
    if (R.skids) for (let i = R.skids.length - 1; i >= 0; i--) { R.skids[i].t -= dt; if (R.skids[i].t <= 0) R.skids.splice(i, 1); }
    for (let i = R.shocks.length - 1; i >= 0; i--) {
      const s = R.shocks[i]; s.t -= dt; s.r += (s.maxR - s.r) * dt * 8; if (s.t <= 0) R.shocks.splice(i, 1);
    }
    if (R.scorch) for (let i = R.scorch.length - 1; i >= 0; i--) {
      if (R.scorch[i].t == null) continue;
      R.scorch[i].t -= dt * 0.06; if (R.scorch[i].t <= 0) R.scorch.splice(i, 1);
    }
    if (R.floats) for (let i = R.floats.length - 1; i >= 0; i--) {
      const f = R.floats[i]; f.t += dt; if (f.t > 1.4) R.floats.splice(i, 1);
    }
  }

  /**
   * Сборка демо: шесть машин, случайный трек из каталога.
   */
  function initTitleRaceEngine() {
    const tIdx = (Math.random() * TRACKDEFS.length) | 0;
    const T = buildTrack(TRACKDEFS[tIdx], tIdx);
    T.img = prerender(T);
    makeTrackPattern(T, tIdx);
    const hz = placeTrackHazards(T, 310 + tIdx * 17);
    const S = T.S, N = T.N;
    const racers = [];
    const ci = [0, 1, 2, 3, 6, 7, 8];
    for (let i = ci.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const tmp = ci[i]; ci[i] = ci[j]; ci[j] = tmp; }
    raceDiv = 2;
    for (let i = 0; i < 6; i++) {
      const car = CARS[ci[i] % CARS.length];
      const ch = CHARS[i % CHARS.length];
      const lv = { arm: 2, eng: 3, tir: 2, shk: 1, nit: 2 };
      const r = makeRacer(ch, car, false, lv, i, { noAiScale: true });
      r.aiCol = ch.col;
      r.skill = 1.05 + Math.random() * 0.35;
      const gi = (N - 6 - Math.floor(i / 2) * 12 + N) % N, p = S[gi], lat = (i % 2 ? 38 : -38);
      r.x = p.x + p.nx * lat; r.y = p.y + p.ny * lat; r.ang = p.ang; r.trackIdx = gi;
      r.aiLane = (Math.random() * 2 - 1) * 40;
      r.spd = 160 + Math.random() * 50;
      racers.push(r);
    }
    const weather = weatherOf(T, false);
    const puddles = weather.id === 'rain' ? makePuddles(T) : [];
    titleSim = {
      T: T, S: S, N: N, div: 2, tIdx: tIdx, racers: racers, pl: racers[0], demo: true,
      pads: hz.pads, ramps: hz.ramps, mines: hz.mines, oils: hz.oils, picks: hz.picks,
      shots: [], parts: [], floats: [], scorch: [], skids: [], shocks: [], spikes: [],
      time: 0, phase: 'go', countT: 0, msg: null, shake: 0, sx: 0, sy: 0,
      cam: { x: 0, y: 0 }, order: racers.slice(), weather: weather, weatherParts: [], puddles: puddles, shortcuts: [],
      labObjects: T.labObjects || [],
      over: false
    };
    titleFocus = racers[0];
    titleFocusHold = 0;
    titleCam = { x: racers[0].x, y: racers[0].y };
  }

  /**
   * Шаг демо: ИИ, контакт, камера за лидером.
   * @param {number} dt
   */
  function updateTitleRaceEngine(dt) {
    withTitleSim(function () {
      R.time += dt;
      updRaceFx(dt);
      for (const r of R.racers) {
        if (r.dead) { r.respawnT -= dt; if (r.respawnT <= 0) respawn(r); continue; }
        aiThink(r, dt); stepVehicle(r, r.ith, r.ist, dt); advanceIdx(r);
      }
      resolveRaceContact(dt);
      for (const m of R.mines) {
        if (!m.dead) continue;
        m.deadT = (m.deadT || 0) + dt;
        if (m.deadT > 7) { m.dead = false; m.deadT = 0; }
      }
      titleFocusHold -= dt;
      if (!titleFocus || titleFocus.dead) titleFocus = titleAliveLead();
      const f = titleFocus || titleAliveLead();
      const z = raceZoom(), vw = W / z, vh = H / z;
      if (f) {
        const snap = titleFocusHold > 0 ? (1 - Math.pow(.00008, dt)) : (1 - Math.pow(.001, dt));
        const look = .22;
        titleCam.x = lerp(titleCam.x, f.x + Math.cos(f.ang) * f.spd * look, snap);
        titleCam.y = lerp(titleCam.y, f.y + Math.sin(f.ang) * f.spd * look, snap);
      }
      R.cam.x = titleCam.x - vw / 2; R.cam.y = titleCam.y - vh / 2;
      if (global.RnRWeather) global.RnRWeather.tick(R, dt, { x: R.cam.x, y: R.cam.y, w: vw, h: vh }, W, H, settings);
    });
  }

  /**
   * Кадр демо в клипе меню.
   */
  function drawTitleRaceEngine() {
    withTitleSim(function () {
      const z = raceZoom();
      const vw = W / z, vh = H / z;
      R.cam.x = titleCam.x - vw / 2; R.cam.y = titleCam.y - vh / 2; R.sx = 0; R.sy = 0;
      g.save();
      g.beginPath(); g.rect(0, 0, W, H); g.clip();
      g.translate(W / 2, H / 2); g.scale(z, z); g.translate(-titleCam.x, -titleCam.y);
      drawRaceArena();
      if (global.RnRVfx && global.RnRVfx.ok) global.RnRVfx.blit('title', g);
      g.restore();
      if (settings.graphics.weather && global.RnRWeather) global.RnRWeather.drawScreen(g, R, W, H);
    });
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.replace('bindTitleSim', bindTitleSimEngine);
  engine.replace('unbindTitleSim', unbindTitleSimEngine);
  engine.replace('withTitleSim', withTitleSimEngine);
  engine.replace('titleAliveLead', titleAliveLeadEngine);
  engine.replace('titleFollowKiller', titleFollowKillerEngine);
  engine.replace('updRaceFx', updRaceFxEngine);
  engine.replace('initTitleRace', initTitleRaceEngine);
  engine.replace('updateTitleRace', updateTitleRaceEngine);
  engine.replace('drawTitleRace', drawTitleRaceEngine);
})(typeof window !== 'undefined' ? window : globalThis);
