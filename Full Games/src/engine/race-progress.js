////////////////////////////////////////////////////////
//
// DiVANEngine: ближайшая точка сплайна, круг, финиш по кругам.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Двери жестяных кузовов после круга.
   * @param {object} r
   */
  function resetLapDoors(r) {
    if (r.car.idx === 11) r.tinDoor = 1;
    if (r.car.idx === 19) r.vanDoor = 1;
  }

  /**
   * Сброс КД после круга или финиша.
   * @param {object} r
   */
  function resetLapKits(r) {
    r.cdN = 0; r.cdW = 0; r.cdU = 0; resetWepMag(r);
  }

  /**
   * Пересёк линию: полигон, финиш или ресурсы круга.
   * @param {object} r
   * @param {number} lt
   */
  function onLapComplete(r, lt) {
    if (labTest) {
      if (r.isP && r.lap >= 1) {
        announce('КРУГ ' + r.lap + '  ·  ' + fmtLap(lt) + (r.bestLap === lt ? '  ·  ЛУЧШИЙ' : ''), true);
        sBeep(880);
      }
      return;
    }
    if (r.lap >= raceLaps) {
      r.hp = r.maxhp;
      if (R.demo) {
        r.lap = 0;
        resetLapKits(r);
      } else {
        if (r.isP) {
          resetLapKits(r);
          fl(r.x, r.y, 'ПОЛНОЕ ВОССТАНОВЛЕНИЕ!', '#58ff6b');
          sReload();
        } else resetLapKits(r);
        finishRacer(r);
      }
      return;
    }
    if (r.isP) {
      if (r.hp < r.maxhp * 0.7 || r.cdN > 0 || r.cdW > 0 || r.cdU > 0) {
        r.hp = Math.min(r.maxhp, r.hp + 40);
        r.cdN = Math.max(0, r.cdN - 5);
        r.cdW = Math.max(0, r.cdW - 2);
        r.cdU = Math.max(0, r.cdU - 5);
        fl(r.x, r.y, 'КРУГ! +РЕСУРСЫ', '#35e0ff');
        sReload();
      }
      if (r.lap === raceLaps - 1) announce('ФИНАЛЬНЫЙ КРУГ — ЖГИ!', true);
      else if (r.lap > 0) announce('КРУГ ' + (r.lap + 1) + ' ИЗ ' + raceLaps);
      sBeep(660);
    } else {
      r.hp = Math.min(r.maxhp, r.hp + 30);
      resetLapKits(r);
    }
    if (r.lap === raceLaps - 1 && typeof voiceSay === 'function') {
      voiceSay(r, 'last_lap', { chance: r.isP ? 1 : 0.4, gap: 20 });
    }
  }

  /**
   * Ближайшая точка сплайна, круг и финиш по числу кругов.
   * @param {object} r
   */
  function advanceIdxEngine(r) {
    const S = R.S, N = R.N;
    let best = r.trackIdx, bd = 1e18;
    for (let k = -4; k <= 26; k++) {
      const i = (r.trackIdx + k + N) % N, dx = r.x - S[i].x, dy = r.y - S[i].y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = i; }
    }
    if (r.trackIdx > N * 0.75 && best < N * 0.25) {
      if (r.finished) {
        r.trackIdx = best;
        r.prog = r.lap * N + best;
        return;
      }
      r.lap++;
      resetLapDoors(r);
      const lt = R.time - r.lapStart;
      r.lastLap = lt;
      r.lapStart = R.time;
      if (r.isP && r.lap >= 1 && (!r.bestLap || lt < r.bestLap)) r.bestLap = lt;
      onLapComplete(r, lt);
    } else if (r.trackIdx < N * 0.25 && best > N * 0.75) r.lap--;
    r.trackIdx = best;
    r.prog = r.lap * N + best;
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.progress = { advanceIdx: advanceIdxEngine };
  engine.replace('advanceIdx', advanceIdxEngine);
})(typeof window !== 'undefined' ? window : globalThis);
