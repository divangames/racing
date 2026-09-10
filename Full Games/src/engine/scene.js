////////////////////////////////////////////////////////
//
// DiVANEngine: шаг сцены заезда — камера, фазы, ввод игрока.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Линейная смесь без глобала игры.
   * @param {number} a
   * @param {number} b
   * @param {number} t
   * @returns {number}
   */
  function mix(a, b, t) {
    return a + (b - a) * t;
  }

  /**
   * Ограничение числа.
   * @param {number} n
   * @param {number} lo
   * @param {number} hi
   * @returns {number}
   */
  function clampNum(n, lo, hi) {
    return n < lo ? lo : n > hi ? hi : n;
  }

  /**
   * Камера догоняет игрока и не выезжает за край карты.
   * @param {object} race
   * @param {object} player
   * @param {number} dt
   * @param {{w:number,h:number}} view
   */
  function followCam(race, player, dt, view) {
    const cam = race.cam, vw = view.w, vh = view.h;
    const tgtX = player.x + Math.cos(player.ang) * player.spd * .22 - vw / 2;
    const tgtY = player.y + Math.sin(player.ang) * player.spd * .22 - vh / 2;
    if (race.T.w <= vw) cam.x = (race.T.w - vw) / 2;
    else cam.x = clampNum(mix(cam.x, tgtX, 1 - Math.pow(.001, dt)), 0, race.T.w - vw);
    if (race.T.h <= vh) cam.y = (race.T.h - vh) / 2;
    else cam.y = clampNum(mix(cam.y, tgtY, 1 - Math.pow(.001, dt)), 0, race.T.h - vh);
  }

  /**
   * Шаг заезда: мир, руль, контакт.
   * @param {number} dt
   */
  function updRaceEngine(dt) {
    R.time += dt;
    if (typeof tickStarterWorld === 'function') tickStarterWorld(dt);
    if (typeof tickMidWorld === 'function') tickMidWorld(dt);
    R.shake *= Math.pow(.02, dt);
    if (settings.graphics.shake) { R.sx = rnd(-R.shake, R.shake); R.sy = rnd(-R.shake, R.shake); }
    else { R.sx = 0; R.sy = 0; }
    followCam(R, P, dt, { w: visW(), h: visH() });
    for (let i = R.parts.length - 1; i >= 0; i--) {
      const p = R.parts[i]; p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .94; p.vy *= .94; if (p.t <= 0) R.parts.splice(i, 1);
    }
    for (let i = R.skids.length - 1; i >= 0; i--) { R.skids[i].t -= dt; if (R.skids[i].t <= 0) R.skids.splice(i, 1); }
    for (let i = R.shocks.length - 1; i >= 0; i--) { const s = R.shocks[i]; s.t -= dt; s.r += (s.maxR - s.r) * dt * 8; if (s.t <= 0) R.shocks.splice(i, 1); }
    for (let i = R.scorch.length - 1; i >= 0; i--) { R.scorch[i].t -= dt * 0.06; if (R.scorch[i].t <= 0) R.scorch.splice(i, 1); }
    for (let i = R.floats.length - 1; i >= 0; i--) { const f = R.floats[i]; f.t += dt; if (f.t > 1.4) R.floats.splice(i, 1); }
    if (R.shortcuts) {
      for (const sc of R.shortcuts) {
        if (sc.glow > 0) sc.glow = Math.max(0, sc.glow - dt * 2);
      }
    }
    if (window.RnRWeather) {
      RnRWeather.tick(R, dt, { x: R.cam.x, y: R.cam.y, w: visW(), h: visH() }, viewW, viewH, settings);
    }
    if (R.msg) { R.msg.t += dt; if (R.msg.t > 3.4) R.msg = null; }
    if (R.hintT > 0) R.hintT -= dt;
    if (R.phase === 'count') {
      const prev = R.countT; R.countT -= dt;
      for (const b of [4, 3, 2, 1]) if (prev > b && R.countT <= b) sBeep(b === 1 ? 880 : 440);
      if (R.countT <= 0) {
        R.phase = 'go';
        for (const rr2 of R.racers) rr2.lapStart = R.time;
        announce(labTest ? 'ПОЛИГОН · ЗАМЕР КРУГА. ESC — В ЛАБОРАТОРИЮ' : LINES_START[(Math.random() * LINES_START.length) | 0], true);
        sGo();
        if (typeof voiceOnStart === 'function') voiceOnStart();
      }
      return;
    }
    if (R.phase === 'done') {
      R.doneT -= dt;
      for (const r of R.racers) {
        if (r.dead) continue;
        const d = finishDrive(r);
        stepVehicle(r, d.th, d.st, dt);
        advanceIdx(r);
      }
      resolveRaceContact(dt);
      if (R.doneT <= 0) showResults();
      return;
    }
    const drive = global.DiVANEngine.input.axis();
    const kHb = drive.handbrake;
    for (const r of R.racers) {
      if (r.dead) { r.respawnT -= dt; if (r.respawnT <= 0) respawn(r); continue; }
      if (r.finished) {
        const d = finishDrive(r);
        let th = d.th, st = d.st;
        if (r.isP) {
          st = clamp(st + drive.steer, -1, 1);
          if (drive.throttle < 0) th = -1;
          else if (drive.throttle > 0) th = Math.max(th, 0);
        }
        stepVehicle(r, th, st, dt, r.isP && kHb);
        advanceIdx(r);
        continue;
      }
      if (r.isP) {
        if (global.DiVANEngine.input.held('fire') && r.cdW <= 0) fireWeapon(r);
        if (global.DiVANEngine.input.held('nitro') && r.cdN <= 0) useNitro(r);
        if (global.DiVANEngine.input.held('ult') && r.cdU <= 0) useUlt(r);
        stepVehicle(r, drive.throttle, drive.steer, dt, kHb);
      } else { aiThink(r, dt); stepVehicle(r, r.ith, r.ist, dt); }
      advanceIdx(r);
    }
    const unf = R.racers.filter(function (x) { return !x.finished; });
    if (unf.length === 0) { R.phase = 'done'; R.doneT = 1.2; }
    else if (unf.length === 1 && !unf[0].isP) {
      if (R.endTimer == null) { R.endTimer = 30; announce(unf[0].ch.short + ': 30 СЕКУНД ДО ФИНИША!'); }
      R.endTimer -= dt;
      if (R.endTimer <= 0) { R.phase = 'done'; R.doneT = 1.2; }
    }
    resolveRaceContact(dt);
    R.order = R.racers.slice().sort(function (a, b) {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1; if (b.finished) return 1; return b.prog - a.prog;
    });
    const leader = R.order[0];
    if (!R.leadChk) R.leadChk = leader;
    if (leader !== R.leadChk && !leader.finished) {
      R.leadChk = leader;
      if (!labTest && Math.random() < .7) announce(racerTag(leader) + ' ' + LINES_LEAD[(Math.random() * LINES_LEAD.length) | 0]);
      if (typeof voiceSay === 'function') voiceSay(leader, 'lead', { chance: .85, gap: 8 });
    }
    if (typeof voiceOnChase === 'function') voiceOnChase();
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.scene = { followCam, step: updRaceEngine };
  engine.replace('updRace', updRaceEngine);
})(typeof window !== 'undefined' ? window : globalThis);
