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
    const previous = r.trackIdx;
    let delta = best - previous;
    if (delta > N / 2) delta -= N;
    if (delta < -N / 2) delta += N;
    const forwardWrap = previous > N * 0.75 && best < N * 0.25 && delta > 0;
    const reverseWrap = previous < N * 0.25 && best > N * 0.75 && delta < 0;
    if (delta > 0 && !forwardWrap && r.lap >= 0) {
      r._lapCheckpoint = Math.max(r._lapCheckpoint || 0, Math.min(3, Math.floor(best * 4 / N)));
    } else if (delta < 0 && !reverseWrap) {
      r._lapCheckpoint = Math.min(r._lapCheckpoint || 0, Math.min(3, Math.floor(best * 4 / N)));
    }
    if (forwardWrap) {
      if (r.finished) {
        r.trackIdx = best;
        r.prog = r.lap * N + best;
        return;
      }
      if (r.lap < 0 || (r._lapCheckpoint || 0) >= 3) {
        const restoring = !!r._lapRestore;
        r.lap++;
        r._lapCheckpoint = 0;
        r._lapRestore = false;
        resetLapDoors(r);
        if (r.lap === 0) {
          r.lapStart = R.time;
        } else if (!restoring) {
          const lt = R.time - r.lapStart;
          r.lastLap = lt;
          r.lapStart = R.time;
          if (r.isP && (!r.bestLap || lt < r.bestLap)) r.bestLap = lt;
          onLapComplete(r, lt);
        }
      } else {
        r._lapCheckpoint = 0;
      }
    } else if (reverseWrap && r.lap >= 0) {
      r.lap--;
      r._lapCheckpoint = 3;
      r._lapRestore = true;
    }
    r.trackIdx = best;
    r.prog = r.lap * N + best;
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.progress = { advanceIdx: advanceIdxEngine };
  engine.replace('advanceIdx', advanceIdxEngine);
})(typeof window !== 'undefined' ? window : globalThis);
