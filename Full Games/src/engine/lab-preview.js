// Тестовый заезд использует снимок редактора и возвращает его сеанс при выходе.
(function (global) {
  'use strict';
  const engine = global.DiVANEngine;
  if (!engine || !global.DiVANLabSession) return;

  /** Возвращает параметры только явного теста черновика карты. */
  function previewQuery() {
    const query = new URLSearchParams(global.location.search);
    return query.get('lab') === '1' && query.get('from') === 'map' && query.get('preview') ? query : null;
  }

  /** Возвращает параметры соперников и кругов только для действующего черновика. */
  function testOptions() {
    const query = previewQuery();
    if (!query) return {opponents: 0, difficulty: 'normal', laps: 3};
    const session = global.DiVANLabSession.read(query.get('preview'), query.get('track'));
    const source = session && session.testOptions || {};
    const difficulty = ['easy', 'normal', 'hard'].includes(source.difficulty) ? source.difficulty : 'normal';
    return {
      opponents: Math.max(0, Math.min(4, +source.opponents || 0)),
      difficulty,
      laps: Math.max(1, Math.min(9, +source.laps || 3))
    };
  }

  engine.wrap('resolveLabTrack', original => function () {
    const query = previewQuery();
    if (!query) return original();
    const session = global.DiVANLabSession.read(query.get('preview'), query.get('track'));
    if (!session) throw new Error('Черновик теста недоступен. Вернитесь в редактор и запустите тест снова.');
    const entry = session.documents.find(item => item.track.id === session.activeId);
    return RnRTracks.normalize(entry.track);
  });

  engine.wrap('exitLabTest', original => function () {
    const query = previewQuery();
    if (!query) return original();
    const params = new URLSearchParams({
      tab: 'map', car: query.get('car') || '0', track: query.get('track') || '', preview: query.get('preview')
    });
    global.location.href = 'Editor.html?' + params.toString();
  });
  global.DiVANLabPreview = {testOptions};
})(typeof window !== 'undefined' ? window : globalThis);
