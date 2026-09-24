// Тест черновика с переносом открытых документов и истории через игровой заезд.
(function (global) {
  'use strict';

  /** Создаёт контроллер сеанса через явный адаптер документов редактора. */
  function create(editor) {
    let leaving = false;

    /** Добавляет параметры тестового заезда рядом с кнопкой запуска. */
    function ensureTestOptions() {
      const button = document.getElementById('mapTestBtn');
      if (!button || document.getElementById('mapTestOptions')) return;
      const panel = document.createElement('div');
      panel.id = 'mapTestOptions';
      panel.className = 'map-test-options';
      panel.innerHTML = '<label><input id="mapTestOpponents" type="checkbox"> Добавить соперников</label>'
        + '<label>Количество <select id="mapTestOpponentCount"><option>1</option><option>2</option><option selected>3</option><option>4</option></select></label>'
        + '<label>Сложность <select id="mapTestDifficulty"><option value="easy">Легко</option><option value="normal" selected>Нормально</option><option value="hard">Сложно</option></select></label>'
        + '<label>Круги <input id="mapTestLaps" type="number" min="1" max="9" value="3"></label>';
      button.insertAdjacentElement('beforebegin', panel);
      const toggle = document.getElementById('mapTestOpponents');
      const sync = () => panel.classList.toggle('has-opponents', !!toggle.checked);
      toggle.onchange = sync;
      sync();
    }

    /** Читает безопасные параметры теста из панели. */
    function testOptions() {
      const enabled = !!document.getElementById('mapTestOpponents')?.checked;
      const count = Math.max(1, Math.min(4, +(document.getElementById('mapTestOpponentCount')?.value || 3)));
      const difficulty = document.getElementById('mapTestDifficulty')?.value || 'normal';
      const laps = Math.max(1, Math.min(9, +(document.getElementById('mapTestLaps')?.value || 3)));
      return {opponents: enabled ? count : 0, difficulty, laps};
    }

    /** Показывает результат операции рядом с состоянием сохранения. */
    function status(message) {
      const field = document.getElementById('mapSaveState');
      if (field) field.textContent = message;
    }

    /** Проверяет исходный документ до нормализации, которая могла бы скрыть ошибку. */
    function validate(track) {
      if (!MapData.ID_RE.test(track.id)) throw new Error('ID трассы: латиница, цифры и знак подчёркивания.');
      const report = global.StudioCheck.track(track);
      if (report.errors.length) throw new Error(report.errors.join(' · '));
    }

    /** Передаёт черновик игре без MapData.save и сохраняет историю всех затронутых документов. */
    function start() {
      if (leaving) return false;
      try {
        const current = editor.current();
        validate(current);
        const docs = editor.documents();
        if (new Set(docs.map(doc => doc.id)).size !== docs.length) throw new Error('ID трасс должны быть различными.');
        editor.commit();
        const documents = docs.filter(doc => {
          const history = editor.history(doc);
          return doc === current || (history && history.list.length)
            || JSON.stringify(MapData.fileTrack(doc)) !== editor.baseline(doc);
        }).map(doc => {
          const history = editor.history(doc);
          return { track: MapData.fileTrack(doc), history: history ? { list: history.list, at: history.at } : null };
        });
        const session = global.DiVANLabSession.write({
          activeId: current.id, documents, selection: MapView.selection(), tool: MapView.tool(),
          testOptions: testOptions()
        });
        const query = new URLSearchParams({
          lab: '1', from: 'map', car: new URLSearchParams(global.location.search).get('car') || '0',
          track: current.id, preview: session.token
        });
        leaving = true;
        global.location.href = 'rnr.html?' + query.toString();
        return true;
      } catch (error) {
        leaving = false;
        status('Тест не запущен: ' + (error.name === 'QuotaExceededError'
          ? 'не хватает места для черновика и истории. Экспортируйте документы или сохраните их перед повтором.' : error.message));
        return false;
      }
    }

    /** Восстанавливает историю документа, сохраняя ветку повтора после Ctrl+Z. */
    function restoreHistory(entry) {
      const history = new StudioHistory();
      const source = entry.history;
      if (source && Array.isArray(source.list) && source.list.length && Number.isInteger(source.at)
        && source.at >= 0 && source.at < source.list.length && source.list.length <= history.limit) {
        source.list.forEach(snapshot => {
          if (typeof snapshot !== 'string') throw new Error('Повреждена история черновика.');
          const parsed = JSON.parse(snapshot);
          if (!parsed || !Array.isArray(parsed.cps)) throw new Error('Повреждена история черновика.');
        });
        history.list = source.list.slice();
        history.at = source.at;
      } else history.record(JSON.stringify(MapData.fileTrack(entry.track)));
      return history;
    }

    /** Возвращает снимки в редактор; базой сравнения остаётся текущая версия с диска. */
    function restore() {
      const query = new URLSearchParams(global.location.search);
      const token = query.get('preview');
      if (!token) return false;
      try {
        const session = global.DiVANLabSession.read(token, query.get('track'));
        if (!session) throw new Error('Сеанс теста недоступен; открыта сохранённая трасса.');
        const loaded = editor.documents().slice();
        // Сначала готовим все записи: повреждённый снимок не должен оставить полувосстановленный сеанс.
        const restored = session.documents.map(entry => ({
          track: RnRTracks.normalize(entry.track), history: restoreHistory(entry)
        }));
        for (const entry of restored) {
          const at = loaded.findIndex(doc => doc.id === entry.track.id);
          const baseline = at < 0 ? undefined : editor.baseline(loaded[at]);
          editor.restoreBaseline(entry.track, baseline);
          editor.restoreHistory(entry.track, entry.history);
          if (at < 0) loaded.push(entry.track); else loaded[at] = entry.track;
        }
        editor.replaceDocuments(loaded);
        editor.select(session.activeId);
        if (typeof session.tool === 'string') { MapView.setTool(session.tool); editor.setToolUi(session.tool); }
        MapView.setSelection(session.selection || null);
        if (global.MapAssets) global.MapAssets.inspect();
        MapView.draw();
        // Токен одноразовый: обычная перезагрузка после возврата не поднимает устаревший сеанс.
        global.DiVANLabSession.clear(token);
        const url = new URL(global.location.href);
        url.searchParams.delete('preview');
        global.history.replaceState(null, '', url.href);
        return true;
      } catch (error) {
        global.setTimeout(() => status('Возврат из теста: ' + error.message), 0);
        return false;
      }
    }

    ensureTestOptions();
    return { start, restore, get leaving() { return leaving; } };
  }

  global.StudioTestSession = { create };
})(typeof window !== 'undefined' ? window : globalThis);
