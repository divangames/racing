// Данные редактора глав: загрузка, нормализация и запись документов миссий.
(function (global) {
  'use strict';

  const FALLBACK_DOCUMENT = 'chapters/mission-01.json';
  const LIST_ENDPOINT = '/__chapters';
  const SAVE_ENDPOINT = '/__save-chapter';
  const FRAME_ENDPOINT = '/__save-chapter-frame';
  const DEFAULT_COMICS = [
    { id: 'chapter-intro', chapter: 'Глава 1', label: 'Вступительный комикс', runtimeKey: 'chapterIntroScenes' },
    { id: 'chase-intro', chapter: 'Глава 1', label: 'Погоня — вступление', runtimeKey: 'introScenes' },
    { id: 'chase-outro', chapter: 'Глава 1', label: 'Погоня — финал', runtimeKey: 'postScenes' }
  ];

  /** Создаёт независимую копию сериализуемых данных. */
  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  /** Приводит один кадр к стабильной форме редактора. */
  function normalizeScene(scene, index, prefix) {
    const source = scene && typeof scene === 'object' ? scene : {};
    return {
      id: String(source.id || prefix + '-' + (index + 1)),
      speaker: String(source.speaker || ''),
      text: String(source.text || ''),
      sub: String(source.sub || ''),
      image: String(source.image || '')
    };
  }

  /** Заполняет безопасные значения документа главы. */
  function normalize(document) {
    const source = clone(document || {});
    source.version = Number(source.version) || 1;
    source.id = String(source.id || 'mission-01');
    source.title = String(source.title || 'Новая миссия');
    source.chapter = String(source.chapter || 'Глава');
    source.objective = String(source.objective || 'Цель миссии');
    source.config = source.config && typeof source.config === 'object' ? source.config : {};
    const track = source.track && typeof source.track === 'object' ? source.track : {};
    const theme = track.theme && typeof track.theme === 'object' ? track.theme : {};
    source.track = {
      roadHalfWidth: Number(track.roadHalfWidth) || 95,
      curveAmount: Number(track.curveAmount) || 34,
      theme: {
        ground: String(theme.ground || '#8b4a2d'), dark: String(theme.dark || '#532719'),
        road: String(theme.road || '#43404b'), line: String(theme.line || '#d9b85f'),
        map: String(theme.map || 'sand'), weather: String(theme.weather || ''),
        groundSrc: String(theme.groundSrc || ''), roadSrc: String(theme.roadSrc || ''),
        railSrc: String(theme.railSrc || ''), groundScale: Number(theme.groundScale) || 1,
        crowdSound: false
      }
    };
    source.points = Array.isArray(source.points) ? source.points.map((point, index) => ({
      id: String(point && point.id || 'POINT_' + (index + 1)),
      label: String(point && point.label || 'Точка ' + (index + 1))
    })) : [];
    const legacy = { introScenes: source.introScenes, postScenes: source.postScenes };
    const sections = Array.isArray(source.comicSections) && source.comicSections.length
      ? source.comicSections : DEFAULT_COMICS.map((section) => Object.assign({}, section, { scenes: legacy[section.runtimeKey] || [] }));
    source.comicSections = sections.map((section, sectionIndex) => {
      const fallback = DEFAULT_COMICS[sectionIndex] || {};
      const id = String(section && section.id || fallback.id || 'comic-' + (sectionIndex + 1));
      const list = section && Array.isArray(section.scenes) ? section.scenes : [];
      return {
        id: id,
        chapter: String(section && section.chapter || source.chapter),
        label: String(section && section.label || fallback.label || 'Комикс'),
        runtimeKey: String(section && section.runtimeKey || fallback.runtimeKey || id),
        scenes: list.map((scene, index) => normalizeScene(scene, index, id))
      };
    });
    delete source.introScenes;
    delete source.postScenes;
    return source;
  }

  /** Загружает все доступные главы; при старом сервере читает первую напрямую. */
  async function load() {
    try {
      const response = await fetch(LIST_ENDPOINT, { cache: 'no-store' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const payload = await response.json();
      if (!payload || !Array.isArray(payload.chapters)) throw new Error('Повреждён каталог глав');
      return payload.chapters.filter((item) => !item.error).map(normalize);
    } catch (catalogError) {
      const fallback = await fetch(FALLBACK_DOCUMENT, { cache: 'no-store' });
      if (!fallback.ok) throw catalogError;
      return [normalize(await fallback.json())];
    }
  }

  /** Сохраняет полный документ главы через локальный сервер редактора. */
  async function save(document) {
    const response = await fetch(SAVE_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(normalize(document))
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) throw new Error(payload.error || 'Не удалось сохранить главу');
    return payload;
  }

  /** Загружает новый кадр и возвращает игровой путь к нему. */
  async function uploadFrame(chapterId, sceneId, file) {
    if (!file) throw new Error('Файл кадра не выбран');
    const extension = String(file.name || '').split('.').pop().toLowerCase();
    const query = new URLSearchParams({ chapter: chapterId, slot: sceneId, ext: extension });
    const response = await fetch(FRAME_ENDPOINT + '?' + query.toString(), {
      method: 'POST',
      headers: { 'content-type': file.type || 'application/octet-stream' },
      body: file
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) throw new Error(payload.error || 'Не удалось записать кадр');
    return payload.src;
  }

  global.ChapterData = { clone, normalize, normalizeScene, load, save, uploadFrame };
})(window);
