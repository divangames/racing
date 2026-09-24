// Редактор геометрии карты: безопасное добавление точек, направляющая и понятная панель дороги.
(function (global) {
  'use strict';

  const POINT_HIT_PX = 15;
  const ROAD_HIT_PX = 20;
  const MIN_POINT_GAP = 12;
  const $ = (id) => document.getElementById(id);
  let state = null;
  let hover = null;
  let insertArmed = false;
  let showCenter = true;
  let statusMessage = '';

  /** Переводит событие холста в мировые координаты. */
  function worldOf(event) { return MapInput.worldOf(event); }

  /** Обновляет подсказку и сохраняет активный режим редактирования. */
  function setMessage(message) {
    statusMessage = message;
    const hint = $('mapRoadHint');
    if (hint) hint.textContent = message;
  }

  /** Завершает вставку, обновляя документ и историю. */
  function insertAt(point) {
    const track = state.getDoc();
    const index = RoadGeometry.insertOnCurve(track.cps, point.x, point.y, state.cam.z, ROAD_HIT_PX);
    if (index == null) {
      setMessage('Точка не добавлена: наведите курсор на линию дороги, подальше от соседних точек.');
      return false;
    }
    state.sel = {kind: 'cp', i: index};
    state.onChange(true);
    state.onSelect(state.sel);
    insertArmed = false;
    hover = null;
    setMessage('Точка добавлена на участок дороги. Перетащите её для изменения формы.');
    refreshPointPanel();
    state.redraw();
    return true;
  }

  /** Перехватывает только левый клик инструмента дороги. */
  function onPointDown(event) {
    if (!state || state.tool !== 'point' || event.button !== 0 || !MapApp.mapOn()) return;
    const point = worldOf(event), track = state.getDoc();
    if (!track || !Array.isArray(track.cps)) return;
    if (state.spacePan) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const handle = RoadGeometry.nearestPoint(track.cps, point.x, point.y, state.cam.z, POINT_HIT_PX);
    if (insertArmed && (!handle || handle.distance * state.cam.z > 3)) {
      insertAt(point);
      return;
    }
    if (handle) {
      state.sel = {kind: 'cp', i: handle.i};
      state.drag = {mode: 'road-point', i: handle.i};
      state.onSelect(state.sel);
      setMessage('Точка ' + (handle.i + 1) + ' выбрана. Перетащите её или измените координаты справа.');
    } else {
      const road = RoadGeometry.nearestCurve(track.cps, point.x, point.y);
      hover = road && road.distance * state.cam.z <= ROAD_HIT_PX ? road : null;
      if (insertArmed) insertAt(point);
      else if (hover) {
        state.sel = null;
        state.onSelect(null);
        setMessage('Участок дороги выбран. Нажмите «Вставить точку» или дважды щёлкните по линии.');
      } else setMessage('Клик вне дороги ничего не создаёт. Наведите курсор на линию трассы.');
    }
    refreshPointPanel();
    state.redraw();
  }

  /** Двойной щелчок по линии вставляет точку без отдельного режима. */
  function onDoubleClick(event) {
    if (!state || state.tool !== 'point' || event.button !== 0 || !MapApp.mapOn()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const point = worldOf(event), track = state.getDoc();
    const handle = RoadGeometry.nearestPoint(track.cps, point.x, point.y, state.cam.z, 3);
    if (handle) return;
    insertAt(point);
  }

  /** Двигает точку без привязки к чужим объектам; сетка включается отдельным флажком. */
  function onPointMove(event) {
    if (!state || state.tool !== 'point' || !MapApp.mapOn()) return;
    const point = worldOf(event), track = state.getDoc();
    if (state.drag && state.drag.mode === 'road-point') {
      event.stopImmediatePropagation();
      const index = state.drag.i, cell = MapPreview.CELL;
      const x = state.roadPointSnap ? Math.round(point.x / cell) * cell : Math.round(point.x);
      const y = state.roadPointSnap ? Math.round(point.y / cell) * cell : Math.round(point.y);
      const before = track.cps[(index + track.cps.length - 1) % track.cps.length];
      const after = track.cps[(index + 1) % track.cps.length];
      if (Math.hypot(x - before[0], y - before[1]) >= MIN_POINT_GAP
        && Math.hypot(x - after[0], y - after[1]) >= MIN_POINT_GAP) {
        track.cps[index] = [x, y];
        state.onChange(false);
        refreshPointPanel();
      }
      state.redraw();
      return;
    }
    const next = RoadGeometry.nearestCurve(track.cps, point.x, point.y);
    hover = next && next.distance * state.cam.z <= ROAD_HIT_PX ? next : null;
    state.redraw();
  }

  /** Регистрирует ввод после штатного модуля; обработчики в фазе capture идут первыми. */
  function installPointInput() {
    const original = MapInput.bind;
    MapInput.bind = function (nextState) {
      state = nextState;
      state.roadPointSnap = false;
      original(nextState);
      nextState.canvas.addEventListener('pointerdown', onPointDown, true);
      nextState.canvas.addEventListener('dblclick', onDoubleClick, true);
      global.addEventListener('pointermove', onPointMove, true);
    };
  }

  /** Рисует контрастную ось маршрута и место будущей точки поверх полотна. */
  function installCenterline() {
    const original = MapPreview.strokeRoad;
    MapPreview.strokeRoad = function (ctx, raw, track, options) {
      const spline = original(ctx, raw, track, options);
      if (!state || !showCenter || !MapApp.mapOn() || $('mapVisualPreview')?.classList.contains('active')
        || !spline || spline.length < 2) return spline;
      const zoom = Math.max(.08, state.cam.z);
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      spline.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
      ctx.closePath();
      ctx.strokeStyle = 'rgba(3, 18, 26, .9)';
      ctx.lineWidth = 6 / zoom;
      ctx.stroke();
      ctx.strokeStyle = '#7fe5ed';
      ctx.lineWidth = 2.5 / zoom;
      ctx.setLineDash([12 / zoom, 8 / zoom]);
      ctx.stroke();
      ctx.setLineDash([]);
      if (state.tool === 'point' && hover) {
        ctx.beginPath();
        ctx.arc(hover.x, hover.y, 9 / zoom, 0, Math.PI * 2);
        ctx.fillStyle = insertArmed ? '#ffd166' : '#7fe5ed';
        ctx.fill();
        ctx.lineWidth = 2 / zoom;
        ctx.strokeStyle = '#09202b';
        ctx.stroke();
      }
      ctx.restore();
      return spline;
    };
  }

  /** Создаёт кнопку без смены текущего документа. */
  function button(label, action, id) {
    const element = document.createElement('button');
    element.type = 'button';
    element.textContent = label;
    if (id) element.id = id;
    element.addEventListener('click', action);
    return element;
  }

  /** Переносит существующие команды в компактные группы вокруг холста. */
  function arrangeToolbar() {
    const card = document.querySelector('#workMap .stage-card');
    const toolbar = card?.querySelector('.stage-tools');
    const canvasWrap = card?.querySelector('.map-stage-wrap');
    if (!toolbar || !canvasWrap || toolbar.classList.contains('map-editor-toolbar')) return;
    toolbar.classList.add('map-editor-toolbar');
    const modes = document.createElement('div'); modes.className = 'map-toolbar-group map-toolbar-modes';
    modes.setAttribute('role', 'group'); modes.setAttribute('aria-label', 'Режим работы');
    for (const id of ['select', 'point', 'pan']) {
      const control = toolbar.querySelector('[data-map-tool="' + id + '"]');
      if (control) modes.appendChild(control);
    }
    const select = modes.querySelector('[data-map-tool="select"]');
    const point = modes.querySelector('[data-map-tool="point"]');
    const pan = modes.querySelector('[data-map-tool="pan"]');
    if (select) select.textContent = 'Выбрать';
    if (point) point.textContent = 'Править дорогу';
    if (pan) pan.textContent = 'Рука';

    const view = document.createElement('div'); view.className = 'map-toolbar-group map-toolbar-view';
    for (const selector of ['.history-tools', '.zoom-tools', '#mapFitBtn', '#mapVisualPreview']) {
      const control = toolbar.querySelector(selector);
      if (control) view.appendChild(control);
    }
    const extras = document.createElement('details'); extras.className = 'map-toolbar-extra';
    const summary = document.createElement('summary'); summary.textContent = 'Добавить на трассу';
    const extraBody = document.createElement('div'); extraBody.className = 'map-toolbar-extra-body';
    for (const selector of ['#mapAddStart', '[data-map-tool="ramp"]', '[data-map-tool="mine"]',
      '[data-map-tool="oil"]', '[data-map-tool="pad"]', '[data-map-tool="cut"]', '#mapSnap', '#mapSnapObj']) {
      const control = toolbar.querySelector(selector);
      if (control) extraBody.appendChild(control.closest('label') || control);
    }
    extras.append(summary, extraBody);
    const status = document.createElement('div'); status.className = 'map-editor-status';
    for (const selector of ['#mapCoord', '#mapSaveState', '#mapTestOptions', '#mapTestBtn']) {
      const control = toolbar.querySelector(selector);
      if (control) status.appendChild(control);
    }
    toolbar.append(modes, view, extras);
    canvasWrap.before(toolbar);
    canvasWrap.after(status);
    toolbar.querySelectorAll('[data-map-tool]').forEach((control) => {
      control.addEventListener('click', () => {
        insertArmed = false;
        hover = null;
        refreshPointPanel();
      });
    });
  }

  /** Отображает выбранную точку и синхронизирует доступность действий. */
  function refreshPointPanel() {
    if (!state) return;
    const track = state.getDoc();
    const selected = MapView.selection();
    const index = selected?.kind === 'cp' ? selected.i : -1;
    const point = track?.cps?.[index];
    const readout = $('mapRoadPointRead');
    if (readout) readout.textContent = point
      ? 'Точка ' + (index + 1) + ' из ' + track.cps.length
      : track.cps.length + ' точек · выберите ручку на карте';
    for (const axis of ['X', 'Y']) {
      const input = $('mapRoadPoint' + axis);
      if (!input || document.activeElement === input) continue;
      input.disabled = !point;
      input.value = point ? Math.round(point[axis === 'X' ? 0 : 1]) : '';
    }
    const del = $('mapRoadDeletePoint');
    if (del) del.disabled = !point || track.cps.length <= 4;
    const insert = $('mapRoadInsertPoint');
    if (insert) {
      insert.classList.toggle('active', insertArmed);
      insert.setAttribute('aria-pressed', String(insertArmed));
    }
    const crossing = $('mapCrossingMode');
    if (crossing && document.activeElement !== crossing) crossing.value = track.crossingMode === 'junction' ? 'junction' : 'overpass';
    const center = $('mapRoadShowCenter');
    if (center) center.checked = showCenter;
    document.querySelectorAll('#workMap [data-map-tool]').forEach((control) => {
      control.setAttribute('aria-pressed', String(control.classList.contains('active')));
    });
  }

  /** Применяет координату выбранной ручки и фиксирует один шаг истории. */
  function changeCoordinate(axis, value) {
    const selected = MapView.selection(), track = MapApp.getDocument();
    if (!selected || selected.kind !== 'cp' || !track.cps[selected.i]) return;
    const number = Number(value);
    if (!Number.isFinite(number) || Math.abs(number) > 100000) return;
    const point = track.cps[selected.i].slice();
    point[axis] = Math.round(number);
    const before = track.cps[(selected.i + track.cps.length - 1) % track.cps.length];
    const after = track.cps[(selected.i + 1) % track.cps.length];
    if (Math.hypot(point[0] - before[0], point[1] - before[1]) < MIN_POINT_GAP
      || Math.hypot(point[0] - after[0], point[1] - after[1]) < MIN_POINT_GAP) return;
    track.cps[selected.i] = point;
    MapApp.commit();
    MapView.draw();
    refreshPointPanel();
  }

  /** Создаёт отдельную трассу из заготовки и переводит её в режим правки дороги. */
  function newTemplate(type) {
    const create = $('mapNewBtn');
    if (!create) return;
    document.querySelector('.map-source-tabs button')?.click();
    create.click();
    const track = MapApp.getDocument();
    MapView.setSelection(null);
    track.cps = type === 'crossroads'
      ? RoadGeometry.crossroads()
      : RoadGeometry.highway();
    track.crossingMode = type === 'crossroads' ? 'junction' : 'overpass';
    track.name = type === 'crossroads' ? 'НОВЫЙ ПЕРЕКРЁСТОК' : 'НОВАЯ МАГИСТРАЛЬ';
    const name = $('mapName');
    if (name) { name.value = track.name; name.dispatchEvent(new Event('input', {bubbles: true})); }
    MapApp.commit();
    $('workMap')?.querySelector('[data-map-tool="point"]')?.click();
    MapView.fit();
    setMessage('Новая трасса создана. Двигайте голубые точки, чтобы изменить форму дороги.');
    refreshPointPanel();
  }

  /** Строит одну секцию инспектора с действиями, влияющими на дорогу. */
  function buildRoadPanel() {
    const panel = document.querySelector('#workMap .panel');
    if (!panel || $('mapRoadEditor')) return;
    const section = document.createElement('section');
    section.id = 'mapRoadEditor';
    section.className = 'section map-panel-card map-road-editor';
    section.innerHTML = '<div class="section-title">ДОРОГА <span>геометрия круга</span></div>'
      + '<p class="map-road-intro">Пунктир показывает магистраль — маршрут центра машины. Голубые ручки меняют форму полотна.</p>'
      + '<label class="map-road-switch"><input id="mapRoadShowCenter" type="checkbox" checked> Показывать магистраль</label>'
      + '<div class="map-road-subtitle">Контрольные точки</div>'
      + '<p id="mapRoadPointRead" class="map-road-readout"></p>'
      + '<div class="map-road-coordinates"><label>X <input id="mapRoadPointX" type="number" step="1" disabled></label>'
      + '<label>Y <input id="mapRoadPointY" type="number" step="1" disabled></label></div>'
      + '<div class="map-road-actions" id="mapRoadPointActions"></div>'
      + '<label class="map-road-switch"><input id="mapRoadPointSnap" type="checkbox"> Привязывать точки к сетке</label>'
      + '<div class="map-road-subtitle">Пересечение дорог</div>'
      + '<label class="map-road-crossing">Тип пересечения <select id="mapCrossingMode">'
      + '<option value="junction">Перекрёсток · один уровень</option>'
      + '<option value="overpass">Эстакада · разные уровни</option></select></label>'
      + '<p class="map-road-caption">Две части одной петли можно провести через одно место. Тип определяет, будет ли одна дорога мостом.</p>'
      + '<div class="map-road-subtitle">Создать новую трассу</div>'
      + '<div class="map-road-actions" id="mapRoadTemplates"></div>'
      + '<p id="mapRoadHint" class="map-road-hint" role="status"></p>';
    const nav = panel.querySelector('.map-inspector-nav');
    if (nav) {
      nav.after(section);
      nav.prepend(button('Дорога', () => section.scrollIntoView({behavior: 'smooth', block: 'start'})));
    }
    else panel.prepend(section);

    $('mapRoadPointActions').append(
      button('Вставить точку', () => {
        MapView.setTool('point');
        document.querySelector('[data-map-tool="point"]')?.click();
        insertArmed = !insertArmed;
        setMessage(insertArmed ? 'Щёлкните по голубой линии дороги: точка появится точно на ней.' : 'Вставка точки отменена.');
        refreshPointPanel();
      }, 'mapRoadInsertPoint'),
      button('Удалить точку', () => {
        if (MapView.selection()?.kind === 'cp') MapView.removeSel();
        refreshPointPanel();
      }, 'mapRoadDeletePoint')
    );
    $('mapRoadTemplates').append(
      button('Новая магистраль', () => newTemplate('highway'), 'mapRoadNewHighway'),
      button('Новый перекрёсток', () => newTemplate('crossroads'), 'mapRoadNewCrossroads')
    );
    $('mapRoadShowCenter').onchange = (event) => { showCenter = event.target.checked; MapView.draw(); };
    $('mapRoadPointSnap').onchange = (event) => { if (state) state.roadPointSnap = event.target.checked; };
    $('mapCrossingMode').onchange = (event) => {
      MapApp.getDocument().crossingMode = event.target.value;
      MapPreview.invalidateRoad();
      MapApp.commit();
      MapView.draw();
      setMessage(event.target.value === 'junction'
        ? 'Перекрёсток: обе дороги на одном уровне.' : 'Эстакада: на пересечении одна дорога поднимается над другой.');
    };
    $('mapRoadPointX').onchange = (event) => changeCoordinate(0, event.target.value);
    $('mapRoadPointY').onchange = (event) => changeCoordinate(1, event.target.value);
    setMessage('Выберите «Править дорогу»: клик по точке — выбор, перетаскивание — перемещение, двойной клик по линии — вставка.');
  }

  /** Включает панель после инициализации исходного редактора. */
  function start() {
    if (!state || typeof MapApp === 'undefined' || typeof MapApp.getDocument !== 'function') return;
    const note = document.querySelector('#workMap .stage-note');
    if (note) note.textContent = 'Выберите режим работы над картой. Для формы трассы откройте «Править дорогу»; точка появится только на линии магистрали.';
    arrangeToolbar();
    buildRoadPanel();
    const files = document.querySelector('#workMap .studio-actions');
    const saveSection = $('mapSaveBtn')?.closest('.section');
    if (files && saveSection) {
      const label = document.createElement('div');
      label.className = 'map-road-subtitle';
      label.textContent = 'Файлы и черновики';
      saveSection.append(label, files);
    }
    refreshPointPanel();
    document.addEventListener('click', () => queueMicrotask(refreshPointPanel));
    document.addEventListener('keydown', () => queueMicrotask(refreshPointPanel));
  }

  if (typeof MapInput !== 'undefined' && typeof MapPreview !== 'undefined') {
    installPointInput();
    installCenterline();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
  }
})(typeof window !== 'undefined' ? window : globalThis);
