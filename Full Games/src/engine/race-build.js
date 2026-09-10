////////////////////////////////////////////////////////
//
// DiVANEngine: сборка заезда — индекс трассы, сетка, R, погода.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Индекс трассы: лаборатория, карьера, оверрайд или этап сейва.
   * @returns {number}
   */
  function raceTrackIndex() {
    if (labTest) return 0;
    if (typeof careerTrackIdx === 'function') return careerTrackIdx();
    if (raceTrackOverride != null) return raceTrackOverride;
    return save.race % TRACKDEFS.length;
  }

  /**
   * Дивизион по кругам карьеры.
   * @returns {number}
   */
  function raceDivision() {
    if (labTest) return 1;
    return 1 + ((save.race / TRACKDEFS.length) | 0);
  }

  /**
   * Точка сплайна для слота клетки.
   * @param {number} N
   * @param {number} slot
   * @returns {number}
   */
  function gridIndex(N, slot) {
    return (N - 6 - Math.floor(slot / 2) * 12 + N) % N;
  }

  /**
   * Смещение влево/вправо на клетке.
   * @param {number} slot
   * @returns {number}
   */
  function gridLat(slot) {
    return slot % 2 ? 38 : -38;
  }

  /**
   * Ставит машины на клетку и даёт щит «Дьяволу».
   * @param {object[]} racers
   * @param {object[]} S
   * @param {number} N
   * @param {function(): number} rng
   */
  function placeRacersOnGrid(racers, S, N, rng) {
    for (const r of racers) {
      const gi = gridIndex(N, r.slot), p = S[gi], lat = gridLat(r.slot);
      r.x = p.x + p.nx * lat; r.y = p.y + p.ny * lat; r.ang = p.ang; r.trackIdx = gi;
      r.aiLane = (rng() * 2 - 1) * 45;
      if (r.car.idx === 3) r.shield = 1;
    }
  }

  /**
   * Погода по биому трассы, не случайный ролл.
   * @param {object} T
   * @param {boolean} lab
   * @returns {object}
   */
  function weatherOfEngine(T, lab) {
    if (global.RnRWeather && typeof RnRWeather.pick === 'function') return RnRWeather.pick(T, !!lab);
    return WEATHER_CLEAR;
  }

  /**
   * Гонщик: статы, магазины, слот.
   * @param {object} ch
   * @param {object} car
   * @param {boolean} isP
   * @param {object} lvl
   * @param {number} slot
   * @param {object} [opts]
   * @returns {object}
   */
  function makeRacerEngine(ch, car, isP, lvl, slot, opts) {
    const damp = (!isP && !(opts && opts.noAiScale)) ? raceDiv : 0;
    const st = stats(ch, car, lvl, isP ? undefined : { spd: 0, crn: 0, grt: 0 }, damp);
    const chIdx = CHARS.indexOf(ch);
    const skillLvl = isP ? ((save.skills && save.skills[chIdx]) || 1) : aiSkillLvl(raceDiv);
    const dmgMul = 1 + (chIdx === 2 ? skillVal(2, skillLvl) : 0);
    const racer = {
      ch: ch, car: car, isP: isP, st: st, chIdx: chIdx, skillLvl: skillLvl, dmgMul: dmgMul, x: 0, y: 0, ang: 0, spd: 0, hp: st.maxhp, maxhp: st.maxhp, shield: 0, wheelAngle: 0, wheelRot: 0,
      bolt: 0, nitro: 0, invuln: 0, bubble: 0, cloak: 0, cdN: 0, cdW: 0, cdU: 0, buffDmg: 1, buffArmor: 1, buffDmgT: 0, berserk: 0, slow: 0, drone: 0, dead: false, respawnT: 0,
      dash: 0, ghost: 0, paper: 0, haze: 0, blind: 0, wepHeat: 0,
      z: 0, vz: 0, air: false, jumpCd: 0, jumpSpd: 0, lat: 0, susp: 0, steerFlt: 0, handbrake: false,
      bob: 0, bobVel: 0, rockAmp: 0, rockT: 0, landStun: 0, lvl: lvl,
      dmgDealt: 0, kills: 0, jumps: 0, pickups: 0, moneyGot: 0, lapStart: 0, bestLap: 0, lastLap: 0,
      nitLvl: isP ? ((save && save.tuning && save.tuning[car.idx] && save.tuning[car.idx].nit) || 0) : ((lvl && lvl.nit) || 0),
      wepLvl: isP ? ((save && save.tuning && save.tuning[car.idx] && save.tuning[car.idx].wep) || 0) : ((lvl && lvl.wep) || 0),
      ultLvl: isP ? ((save && save.tuning && save.tuning[car.idx] && save.tuning[car.idx].ult) || 0) : ((lvl && lvl.ult) || 0),
      wepAmmo: 0, wepOver: 0,
      trackIdx: 0, lap: -1, prog: 0, finished: false, finishTime: 0,
      aiLane: 0, laneT: 0, stuckT: 0, revT: 0, smokeT: 0, slot: slot,
      tinDoor: car.idx === 11 ? 1 : 0, vanDoor: car.idx === 19 ? 1 : 0, bodyDump: 0, soot: 0, flipSteer: 0, overtake: 0
    };
    resetWepMag(racer);
    return racer;
  }

  /**
   * Паттерн земли: тайл, bake, иначе шум 128.
   * @param {object} T
   * @param {number} tIdx
   */
  function makeTrackPatternEngine(T, tIdx) {
    let img = T.mapTile;
    if (!img && T.theme && T.theme.groundSrc && global.RnRTracks) {
      const im = RnRTracks.texOf(T.theme.groundSrc);
      if (im && im.complete && im.naturalWidth) img = im;
    }
    if (!img) img = T.theme && T.theme.map && pickMapTile(T.theme.map);
    if (img) {
      T.mapTile = img;
      T.mapBake = bakeMapTile(img);
      T.pat = g.createPattern(T.mapBake, 'repeat');
      return;
    }
    const tile = document.createElement('canvas'); tile.width = tile.height = 128;
    const tq = tile.getContext('2d');
    tq.fillStyle = T.theme.ground; tq.fillRect(0, 0, 128, 128);
    const trnd = mulberry(42 + tIdx * 7);
    for (let i = 0; i < 140; i++) { tq.fillStyle = trnd() < .5 ? T.theme.dark : '#00000022'; const s = 2 + trnd() * 4; tq.fillRect(trnd() * 128, trnd() * 128, s, s); }
    T.pat = g.createPattern(tile, 'repeat');
  }

  /**
   * Собирает R: полотно, сетка, погода, ставка, миникарта.
   */
  function buildRaceEngine() {
    const tIdx = raceTrackIndex();
    const div = raceDivision();
    raceDiv = div;
    const def = labTest ? resolveLabTrack() : (raceTrackCustom || TRACKDEFS[tIdx]);
    const T = buildTrack(def, tIdx); T.img = prerender(T);
    makeTrackPattern(T, tIdx);
    const hz = placeTrackHazards(T, 100 + tIdx * 13 + (save.race || 0) * 7);
    const pads = hz.pads, ramps = hz.ramps, mines = hz.mines, oils = hz.oils, picks = hz.picks;
    const S = T.S, N = T.N, Rz = mulberry(100 + tIdx * 13 + (save.race || 0) * 7);
    const racers = [];
    const pCh = CHARS[save.char];
    const pCar = CARS[save.car];
    const pLvl = save.tuning[save.car] || { arm: 0, eng: 0, tir: 0, shk: 0, nit: 0 };
    const pl = makeRacer(pCh, pCar, true, pLvl, 5);
    if (!labTest && raceBoard && raceBoard.specs && raceBoard.specs.length) {
      racers.length = 0;
      for (const sp of raceBoard.specs) {
        const r = makeRacer(
          sp.isP ? pCh : sp.ch,
          sp.isP ? pCar : sp.car,
          !!sp.isP,
          sp.isP ? pLvl : sp.lvl,
          sp.slot
        );
        r.aiCol = sp.ch.col;
        if (!sp.isP) r.skill = sp.skill;
        r.isBoss = !!sp.isBoss;
        r.isAlly = !!sp.isAlly;
        if (sp.chIdx != null) r.chIdx = sp.chIdx;
        r.fieldId = sp.id;
        racers.push(r);
      }
    } else {
      racers.push(pl);
      if (!labTest) {
        const specs = planRaceField(div);
        racers.length = 0;
        for (const sp of specs) {
          const r = makeRacer(sp.ch, sp.car, !!sp.isP, sp.lvl, sp.slot);
          r.aiCol = sp.ch.col;
          if (!sp.isP) r.skill = sp.skill;
          r.isBoss = !!sp.isBoss;
          r.isAlly = !!sp.isAlly;
          if (sp.chIdx != null) r.chIdx = sp.chIdx;
          r.fieldId = sp.id;
          racers.push(r);
        }
      }
    }
    const racePl = racers.find(function (r) { return r.isP; }) || pl;
    placeRacersOnGrid(racers, S, N, Rz);
    let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9;
    for (const p of S) { mnx = Math.min(mnx, p.x); mny = Math.min(mny, p.y); mxx = Math.max(mxx, p.x); mxy = Math.max(mxy, p.y); }
    const ms = Math.min(128 / (mxx - mnx), 134 / (mxy - mny));
    const weather = weatherOf(T, labTest && !!def.lab);
    const puddles = (!labTest && weather.id === 'rain') ? makePuddles(T) : [];
    const cuts = (T.shortcuts && T.shortcuts.length) ? T.shortcuts : (labTest ? [] : (SHORTCUTS[tIdx] || []));
    R = {
      T: T, S: S, N: N, div: div, tIdx: tIdx, racers: racers, pl: racePl, pads: pads, ramps: ramps, mines: mines, oils: oils, slicks: [], picks: picks, shots: [], parts: [], floats: [], scorch: [], skids: [], shocks: [], spikes: [],
      time: 0, phase: 'count', countT: 4.6, msg: null, shake: 0, sx: 0, sy: 0, cam: { x: 0, y: 0 }, order: racers.slice(),
      over: false, overT: 0, firstDone: null, endTimer: null, hintT: labTest ? 0 : (save.race === 0 ? 9 : 0), prize: null, quip: '',
      map: { pts: S.filter(function (p, i) { return i % 3 === 0; }).map(function (p) { return [(p.x - mnx) * ms, (p.y - mny) * ms]; }), ms: ms, mnx: mnx, mny: mny, mw: (mxx - mnx) * ms, mh: (mxy - mny) * ms },
      bet: save.bet,
      betStake: labTest ? 0 : (BET_TABLE[save.bet | 0].cost || 0),
      betPick: (raceBoard && raceBoard.pick) | 0,
      betOdds: (!labTest && raceBoard && raceBoard.odds) ? raceBoard.odds[raceBoard.pick] : null,
      betName: (!labTest && raceBoard && raceBoard.specs[raceBoard.pick]) ? (raceBoard.specs[raceBoard.pick].ch.short || raceBoard.specs[raceBoard.pick].ch.name) : '',
      weather: weather, weatherParts: [], puddles: puddles,
      shortcuts: cuts.map(function (s) { return Object.assign({}, s, { used: false, glow: 0 }); }),
      labObjects: T.labObjects || [],
      countsForCareer: !labTest && raceTrackOverride == null && !raceTrackCustom
    };
    P = racePl; state = 'race'; paused = false; resetHudFx(); clearKeys();
    if (typeof voiceReset === 'function') voiceReset();
    if (labTest) announce((def.lab ? 'ПОЛИГОН' : 'ТЕСТ · ' + (def.name || 'ТРАССА')) + ' · ESC — В ЛАБОРАТОРИЮ', true);
  }

  /** Перезапуск текущего заезда. */
  function restartRaceEngine() {
    if (!R || R.over) return;
    persist();
    buildRace();
  }

  /**
   * Тост комментатора на заезде.
   * @param {string} txt
   * @param {boolean} [big]
   */
  function announceEngine(txt, big) {
    if (!R || R.demo) return;
    R.msg = { txt: txt, t: 0, big: !!big };
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.race = { trackIndex: raceTrackIndex, division: raceDivision, gridIndex: gridIndex, gridLat: gridLat, placeRacersOnGrid: placeRacersOnGrid };
  engine.replace('weatherOf', weatherOfEngine);
  engine.replace('makeRacer', makeRacerEngine);
  engine.replace('makeTrackPattern', makeTrackPatternEngine);
  engine.replace('buildRace', buildRaceEngine);
  engine.replace('restartRace', restartRaceEngine);
  engine.replace('announce', announceEngine);
})(typeof window !== 'undefined' ? window : globalThis);
