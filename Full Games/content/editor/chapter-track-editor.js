// Редактор внешнего вида трассы конкретной главы.
(function (global) {
  'use strict';

  const FIELD_MAP = [
    ['chapterRoadWidth', 'roadHalfWidth', 'number'],
    ['chapterCurveAmount', 'curveAmount', 'number'],
    ['chapterGroundSrc', 'groundSrc', 'theme'],
    ['chapterRoadSrc', 'roadSrc', 'theme'],
    ['chapterRailSrc', 'railSrc', 'theme'],
    ['chapterGroundColor', 'ground', 'theme'],
    ['chapterRoadColor', 'road', 'theme'],
    ['chapterLineColor', 'line', 'theme']
  ];
  let api = null;
  const $ = (id) => document.getElementById(id);

  /** Возвращает и при необходимости создаёт настройки трассы документа. */
  function track() {
    const doc = api && api.current();
    if (!doc) return null;
    doc.track = doc.track || {};
    doc.track.theme = doc.track.theme || {};
    doc.track.theme.crowdSound = false;
    return doc.track;
  }

  /** Обновляет поля после смены главы. */
  function fill() {
    const value = track();
    if (!value) return;
    FIELD_MAP.forEach(([id, key, scope]) => {
      const input = $(id);
      if (input) input.value = scope === 'theme' ? (value.theme[key] || '') : Number(value[key] || 0);
    });
  }

  /** Загружает новый материал и сразу назначает его трассе. */
  async function upload(kind, file) {
    if (!file || !track()) return;
    api.setStatus('Записываю материал трассы…');
    try {
      const suffix = kind === 'ground' ? 'ground' : kind === 'road' ? 'road' : 'rail';
      const result = await MapTex.upload(file, kind, kind === 'ground' ? 'new' : 'library', api.current().id + '_chase_' + suffix);
      if (!result || !result.src) throw new Error(result && result.error || 'Материал не записан');
      track().theme[kind + 'Src'] = result.src;
      $('chapter' + kind[0].toUpperCase() + kind.slice(1) + 'Src').value = result.src;
      api.markDirty();
      api.setStatus('Материал назначен. Сохраните главу.', 'dirty');
    } catch (error) {
      api.setStatus(error.message, 'error');
    }
  }

  /** Один раз подключает числовые, цветовые и файловые поля. */
  function bind(controller) {
    api = controller;
    FIELD_MAP.forEach(([id, key, scope]) => {
      const input = $(id);
      input.oninput = () => {
        const value = track();
        if (!value) return;
        if (scope === 'theme') value.theme[key] = input.value;
        else value[key] = Number(input.value);
        api.markDirty();
      };
    });
    [['chapterGroundFile', 'ground'], ['chapterRoadFile', 'road'], ['chapterRailFile', 'rail']].forEach(([id, kind]) => {
      $(id).onchange = (event) => upload(kind, event.target.files && event.target.files[0]);
    });
  }

  global.ChapterTrackEditor = {bind, fill};
})(window);
