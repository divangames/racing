////////////////////////////////////////////////////////
//
// DiVANEngine: снимок карьеры — newSave, persist, loadSave.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Скиллы всех пилотов с пола 1.
   * @returns {Object<string, number>}
   */
  function blankSkillsMapEngine() {
    const o = {};
    for (let i = 0; i < CHARS.length; i++) o[i] = 1;
    return o;
  }

  /**
   * Статы тренажёрки на каждого пилота.
   * @returns {Object<string, {spd:number,crn:number,grt:number}>}
   */
  function blankCstatsMapEngine() {
    const o = {};
    for (let i = 0; i < CHARS.length; i++) o[i] = { spd: 0, crn: 0, grt: 0 };
    return o;
  }

  /**
   * Пустая карьера: $1000, личный кузов пилота 0.
   * @returns {object}
   */
  function newSaveEngine() {
    const own = charCarIdx(0);
    const owned = {};
    owned[own] = true;
    const fresh = {
      cash: 1000,
      char: 0,
      car: own,
      tuning: allTunes(),
      carOwned: owned,
      skills: blankSkillsMap(),
      cstats: blankCstatsMap(),
      bet: 0,
      race: 0,
      achievements: {},
      tracksWon: {},
      shortcutsUsed: 0,
      dev: 0,
      records: {},
      winStreak: 0,
      bestStreak: 0,
      careerWins: 0
    };
    if (typeof storyPatchSave === 'function') storyPatchSave(fresh);
    return fresh;
  }

  /**
   * Пишет текущий save; слот обновляет сетку.
   * @param {number} [slotIndex]
   */
  function persistEngine(slotIndex) {
    if (labTest) return;
    const key = slotIndex !== undefined ? SLOTS_KEY + '_' + slotIndex : persistActiveKey();
    try {
      persistWrite(key, JSON.stringify(save));
      saveFlash = 1.6;
      if (slotIndex !== undefined) {
        slots[slotIndex] = {
          save: save,
          timestamp: Date.now(),
          label: 'Этап ' + (save.race + 1) + ', $' + save.cash
        };
        saveSlots();
      }
    } catch (e) {}
  }

  /**
   * Читает JSON и дописывает поля старых сейвов.
   * @param {number} [slotIndex]
   */
  function loadSaveEngine(slotIndex, keyOpt) {
    const key = slotIndex !== undefined ? SLOTS_KEY + '_' + slotIndex : (keyOpt || SKEY);
    try {
      const s = persistRead(key);
      if (s) {
        save = JSON.parse(s);
        if (typeof save.race !== 'number') save = null;
      }
    } catch (e) { save = null; }
    if (!save) return;
    if (typeof save.rockets !== 'number') save.rockets = 2;
    if (typeof save.emp !== 'number') save.emp = 2;
    if (typeof save.laser !== 'number') save.laser = 2;
    if (typeof save.spikes !== 'number') save.spikes = 3;
    if (typeof save.cloak !== 'number') save.cloak = 3;
    if (!save.tuning) save.tuning = allTunes();
    for (let i = 0; i < CARS.length; i++) {
      if (!save.tuning[i]) save.tuning[i] = blankTune();
      if (save.tuning[i].nit == null) save.tuning[i].nit = 0;
      if (typeof ensureTuneGuns === 'function') ensureTuneGuns(save.tuning[i]);
    }
    if (save.char == null || !CHARS[save.char] || CHARS[save.char].npc) save.char = 0;
    if (save.dev == null) save.dev = 0;
    if (!save.carOwned) save.carOwned = {};
    const own = charCarIdx(typeof save.char === 'number' ? save.char : 0);
    save.carOwned[own] = true;
    CARS.forEach(function (c, i) {
      if (c.custom) save.carOwned[i] = true;
      if (!save.dev && c.owner != null && c.owner !== save.char) delete save.carOwned[i];
    });
    if (save.car == null || !CARS[save.car] || isForeignSignature(save.car)) save.car = own;
    if (!save.skills) save.skills = blankSkillsMap();
    for (let i = 0; i < CHARS.length; i++) if (save.skills[i] == null) save.skills[i] = 1;
    if (!save.cstats) save.cstats = blankCstatsMap();
    for (let i = 0; i < CHARS.length; i++) {
      if (!save.cstats[i]) save.cstats[i] = { spd: 0, crn: 0, grt: 0 };
      save.cstats[i].spd = save.cstats[i].spd || 0;
      save.cstats[i].crn = save.cstats[i].crn || 0;
      save.cstats[i].grt = save.cstats[i].grt || 0;
    }
    if (typeof save.bet !== 'number') save.bet = 0;
    if (!save.achievements) save.achievements = {};
    if (!save.tracksWon) save.tracksWon = {};
    if (!save.records) save.records = {};
    for (const k in save.records) {
      const rec = save.records[k];
      if (!rec) continue;
      if (rec.lap && !rec.bestLap) rec.bestLap = rec.lap;
      if (rec.bestPlace == null) rec.bestPlace = 99;
    }
    if (typeof save.shortcutsUsed !== 'number') save.shortcutsUsed = 0;
    if (typeof careerPatchSave === 'function') careerPatchSave(save);
    if (typeof storyPatchSave === 'function') storyPatchSave(save);
  }

  /**
   * Ключ активной сессии: карьера и кампания не делят слот.
   * @returns {string}
   */
  function persistActiveKey() {
    if (save && save.playMode === 'campaign') {
      return typeof STORY_SKEY === 'string' ? STORY_SKEY : 'rnr_ru_story_v1';
    }
    return SKEY;
  }

  /**
   * Читает сейв без подмены текущего.
   * @param {string} key
   * @returns {object|null}
   */
  function persistPeekSaveEngine(key) {
    try {
      const raw = persistRead(key);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || typeof s.race !== 'number') return null;
      return s;
    } catch (e) {
      return null;
    }
  }

  global.persistPeekSave = persistPeekSaveEngine;
  global.persistActiveKey = persistActiveKey;
  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.replace('blankSkillsMap', blankSkillsMapEngine);
  engine.replace('blankCstatsMap', blankCstatsMapEngine);
  engine.replace('newSave', newSaveEngine);
  engine.replace('persist', persistEngine);
  engine.replace('loadSave', loadSaveEngine);
})(typeof window !== 'undefined' ? window : globalThis);
