// Общий документ главы для игры и прямого теста из лаборатории.
(function (global) {
  'use strict';

  const DRAFT_KEY = 'rnr.chapterDraft.v1';
  const DOCUMENT_URL = 'chapters/mission-01.json';
  const query = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
  const testMode = query.get('chapterTest') === '1';
  let current = null;
  let loading = null;

  global.storyChapterTestMode = testMode;

  /** Ограничивает документ безопасными полями, не меняя текст автора. */
  function normalize(document) {
    if (!document || typeof document !== 'object') return null;
    return {
      version: Number(document.version) || 1,
      id: String(document.id || 'mission-01'),
      title: String(document.title || 'Погоня'),
      chapter: String(document.chapter || 'Глава 1'),
      objective: String(document.objective || 'Не упусти грузовик'),
      config: document.config && typeof document.config === 'object' ? Object.assign({}, document.config) : {},
      track: normalizeTrack(document.track),
      points: Array.isArray(document.points) ? document.points.map(point => ({
        id: String(point.id || ''), label: String(point.label || point.id || '')
      })) : [],
      comicSections: normalizeComics(document)
    };
  }

  /** Приводит оформление бесконечной трассы к безопасной теме. */
  function normalizeTrack(source) {
    const track = source && typeof source === 'object' ? source : {};
    const theme = track.theme && typeof track.theme === 'object' ? track.theme : {};
    return {
      roadHalfWidth: Math.max(70, Math.min(150, Number(track.roadHalfWidth) || 95)),
      curveAmount: Math.max(0, Math.min(90, Number.isFinite(Number(track.curveAmount)) ? Number(track.curveAmount) : 34)),
      theme: {
        ground: String(theme.ground || '#8b4a2d'), dark: String(theme.dark || '#532719'),
        road: String(theme.road || '#43404b'), line: String(theme.line || '#d9b85f'),
        map: String(theme.map || 'sand'), weather: String(theme.weather || ''),
        groundSrc: String(theme.groundSrc || ''), roadSrc: String(theme.roadSrc || ''),
        railSrc: String(theme.railSrc || ''), groundScale: Math.max(.25, Math.min(4, Number(theme.groundScale) || 1)),
        crowdSound: false
      }
    };
  }

  /** Собирает разделы комиксов и поддерживает старые документы главы. */
  function normalizeComics(document) {
    const source = Array.isArray(document.comicSections) && document.comicSections.length
      ? document.comicSections
      : [
        { id: 'chase-intro', label: 'Погоня — вступление', runtimeKey: 'introScenes', scenes: document.introScenes },
        { id: 'chase-outro', label: 'Погоня — финал', runtimeKey: 'postScenes', scenes: document.postScenes }
      ];
    return source.slice(0, 32).map((section, index) => ({
      id: String(section && section.id || 'comic-' + (index + 1)),
      chapter: String(section && section.chapter || document.chapter || 'Глава 1'),
      label: String(section && section.label || 'Комикс'),
      runtimeKey: String(section && section.runtimeKey || section && section.id || ''),
      scenes: normalizeScenes(section && section.scenes, String(section && section.id || 'comic'))
    }));
  }

  /** Приводит кадры к стабильной схеме. */
  function normalizeScenes(source, prefix) {
    if (!Array.isArray(source)) return [];
    return source.slice(0, 64).map((scene, index) => ({
      id: String(scene && scene.id || prefix + '-' + (index + 1)),
      speaker: String(scene && scene.speaker || ''),
      text: String(scene && scene.text || ''),
      sub: String(scene && scene.sub || ''),
      image: String(scene && scene.image || '')
    }));
  }

  /** Ограничивает даже вручную изменённый JSON безопасными диапазонами. */
  function clampConfig(key, value) {
    let range = [0, 600];
    if (['barrelRollSpeed', 'bridgeTruckTravelSpeed', 'playerSteerSpeed'].includes(key)) range = [40, 800];
    else if (key === 'nitroSpeedMultiplier') range = [1, 2];
    else if (/Zoom$/.test(key)) range = [.4, 3];
    else if (/Tilt$/.test(key)) range = [0, .35];
    else if (/Angle$/.test(key)) range = [0, Math.PI];
    else if (/Offset$|Advance$/.test(key)) range = [0, 200];
    else if (/GapLength$/.test(key)) range = [20, 500];
    else if (/Distance$/.test(key)) range = [1, 500];
    else if (/Multiplier$/.test(key)) range = [.05, 1];
    else if (/Speed$|Acceleration$|CoolRate$|HeatPerShot$/.test(key)) range = [.01, 5];
    else if (/Health$/.test(key)) range = [1, 20];
    else if (/Time$/.test(key)) range = [.02, 120];
    else if (/Min$|Max$/.test(key)) range = [.02, 600];
    return Math.max(range[0], Math.min(range[1], value));
  }

  /** Применяет только известные числовые параметры миссии. */
  function applyConfig(document) {
    if (!global.MISSION_01 || !document) return;
    Object.keys(document.config || {}).forEach(key => {
      if (!(key in global.MISSION_01)) return;
      const raw = document.config[key];
      if (raw === '' || raw == null) return;
      const value = Number(raw);
      if (Number.isFinite(value)) global.MISSION_01[key] = clampConfig(key, value);
    });
  }

  /** Берёт несохранённый черновик только в режиме теста. */
  function draft() {
    if (!testMode || typeof sessionStorage === 'undefined') return null;
    try { return normalize(JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null')); }
    catch (error) { return null; }
  }

  /** Загружает главу один раз и применяет её баланс. */
  function load() {
    if (loading) return loading;
    const local = draft();
    if (local) {
      current = local;
      applyConfig(current);
      loading = Promise.resolve(current);
      return loading;
    }
    loading = fetch(DOCUMENT_URL, { cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(document => {
        current = normalize(document);
        applyConfig(current);
        return current;
      })
      .catch(() => null);
    return loading;
  }

  /** Возвращает кадры нужного комикса или fallback. */
  function scenes(key, fallback) {
    const section = current && current.comicSections && current.comicSections.find(item => item.runtimeKey === key || item.id === key);
    const list = section && section.scenes;
    return Array.isArray(list) && list.length ? list : (fallback || []);
  }

  /** Готовит независимый сейв, чтобы тест не менял карьеру. */
  function prepareTestSave() {
    if (typeof save === 'undefined') return;
    if (typeof newSave === 'function') save = newSave();
    else if (save) {
      try { save = JSON.parse(JSON.stringify(save)); } catch (error) {}
    }
    if (!save) return;
    save.playMode = 'campaign';
    save.char = 0;
    save.car = 0;
    save.storySlice = 'bear_chapter_1';
    save.storyMission = 'race_b';
    save.storyFlags = save.storyFlags || {};
    save.storyFlags.robberyPending = true;
    save.storyFlags.garageRobbed = false;
  }

  /** Запускает выбранную точку после загрузки игры. */
  function startTest() {
    if (!testMode) return false;
    const point = query.get('point') || 'CHASE_START';
    const sceneIndex = Math.max(0, Number(query.get('scene')) || 0);
    state = 'title';
    load().then(() => {
      prepareTestSave();
      if ((point === 'CHAPTER_INTRO' || point === 'INTRO') && typeof storyOpenBearComic === 'function') {
        storyOpenBearComic(point === 'INTRO', sceneIndex);
        return;
      }
      if (point === 'GARAGE') {
        if (typeof storyRobBearGarage === 'function') storyRobBearGarage();
        if (typeof enterCarSel === 'function') enterCarSel(typeof STARTER_LO === 'number' ? STARTER_LO : 11);
        return;
      }
      if (typeof startStoryBearChase === 'function') startStoryBearChase();
      if (typeof storyBearChaseApplyPoint === 'function') storyBearChaseApplyPoint(point, sceneIndex);
    });
    return true;
  }

  /** Возвращается в редактор с той же миссией и точкой. */
  function exitTest() {
    if (!testMode || typeof location === 'undefined') return false;
    const back = new URLSearchParams({
      tab: 'chapter', chapter: query.get('chapter') || 'mission-01',
      point: query.get('point') || 'CHASE_START', scene: query.get('scene') || '0'
    });
    location.href = 'Editor.html?' + back.toString();
    return true;
  }

  global.RnRChapterContent = { load, get: () => current, scenes, normalize, applyConfig, testMode, exitTest };
  global.storyStartChapterTest = startTest;
  load();

  const engine = global.DiVANEngine;
  // Даже финал и точка GARAGE работают с песочницей и не пишут её в карьерный слот.
  if (testMode && engine && engine.get('persist')) engine.wrap('persist', () => function () {});
  if (engine && engine.get('press')) engine.wrap('press', previous => function (code, key) {
    if (testMode && code === 'Escape' && state !== 'bearChase') { exitTest(); return; }
    return previous(code, key);
  });
})(typeof window !== 'undefined' ? window : globalThis);
