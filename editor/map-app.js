////////////////////////////////////////////////////////
//
// Панель редактора трассы: слоты, тема, сохранение, тест
//
////////////////////////////////////////////////////////
'use strict';

const MapApp = (() => {
  const $ = (id) => document.getElementById(id);
  let docs = [];
  let idx = 0;
  let dirty = false;
  let hist = {list: [], at: -1};
  let fillLock = false;
  let stamp = 'wreckage';

  /** Текущий документ. */
  function cur() {
    if (!docs[idx]) docs[idx] = MapData.factory(MapData.freshId(docs.map((d) => d.id)));
    return docs[idx];
  }

  /** Вкладка карты активна. */
  function mapOn() {
    const el = $('workMap');
    return el && !el.hidden;
  }

  /** Шаг истории. */
  function commit() {
    const snap = JSON.stringify(MapData.fileTrack(cur()));
    const last = hist.list[hist.at];
    if (last === snap) return;
    hist.list = hist.list.slice(0, hist.at + 1);
    hist.list.push(snap);
    hist.at = hist.list.length - 1;
    if (hist.list.length > 80) {
      hist.list.shift();
      hist.at--;
    }
  }

  /** Откат. */
  function undo() {
    if (hist.at <= 0) return;
    hist.at--;
    docs[idx] = RnRTracks.normalize(JSON.parse(hist.list[hist.at]));
    fill();
    MapView.draw();
  }

  /** Повтор. */
  function redo() {
    if (hist.at >= hist.list.length - 1) return;
    hist.at++;
    docs[idx] = RnRTracks.normalize(JSON.parse(hist.list[hist.at]));
    fill();
    MapView.draw();
  }

  /** Список слотов. */
  function renderList() {
    const box = $('mapList');
    if (!box) return;
    box.innerHTML = '';
    docs.forEach((d, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = d.name || d.id;
      if (i === idx) b.className = 'active';
      b.onclick = () => select(i);
      box.appendChild(b);
    });
  }

  /** Выбор слота. */
  function select(i) {
    idx = i;
    hist = {list: [], at: -1};
    commit();
    fill();
    MapView.fit();
    renderList();
  }

  /** Поля инспектора. */
  function fill() {
    fillLock = true;
    const t = cur();
    if ($('mapName')) $('mapName').value = t.name;
    if ($('mapId')) $('mapId').value = t.id;
    if ($('mapPublished')) $('mapPublished').checked = t.published !== false;
    if ($('mapAutoHz')) $('mapAutoHz').checked = !!t.autoHazards;
    MapPanel.paint();
    if (window.MapAssets) MapAssets.inspect();
    if ($('mapTheme')) $('mapTheme').value = t.theme.map || 'sand';
    if ($('mapSaveState')) $('mapSaveState').textContent = dirty ? 'Есть несохранённые правки' : 'Сохранено';
    if ($('mapNameRead')) $('mapNameRead').textContent = t.name;
    syncStartBtn();
    fillLock = false;
    renderList();
  }

  /** Кнопка старта, если клетки нет. */
  function syncStartBtn() {
    const b = $('mapAddStart');
    if (b) b.hidden = !!cur().start;
  }

  /** Ставит клетку старт/финиш. */
  function addStart() {
    const t = cur();
    if (t.start) return;
    t.start = RnRTracks.startFromCps(t.cps);
    if (!t.start) {
      const c = MapView.center();
      t.start = {x: c.x, y: c.y, ang: 0};
    }
    MapView.setTool('select');
    setToolUi('select');
    MapView.setSelection({kind: 'start', i: 0});
    dirty = true;
    commit();
    fill();
    MapView.draw();
  }

  /** Подсветка инструмента. */
  function setToolUi(id) {
    document.querySelectorAll('[data-map-tool]').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-map-tool') === id);
    });
  }

  /** Сохранить на диск. */
  async function saveNow() {
    const t = cur();
    t.id = ($('mapId') && $('mapId').value || t.id).toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!MapData.ID_RE.test(t.id)) {
      if ($('mapSaveState')) $('mapSaveState').textContent = 'Id: латиница, цифры, _';
      return false;
    }
    try {
      const res = await MapData.save(t, 'work');
      if (!res.ok) {
        if ($('mapSaveState')) $('mapSaveState').textContent = res.error || 'Сбой записи';
        return false;
      }
      dirty = false;
      if ($('mapSaveState')) $('mapSaveState').textContent = 'Записано в assets/data/tracks/' + t.id + '.json';
      return true;
    } catch (err) {
      if ($('mapSaveState')) $('mapSaveState').textContent = 'Нужен editor.bat (порт 8765)';
      return false;
    }
  }

  /** Тест в игре: черновик в sessionStorage. */
  async function testDrive() {
    await saveNow();
    try { sessionStorage.setItem('rnr.trackDraft', JSON.stringify(MapData.fileTrack(cur()))); } catch (err) {}
    const car = new URLSearchParams(location.search).get('car') || '0';
    location.href = 'rnr.html?lab=1&from=map&car=' + encodeURIComponent(car) + '&track=' + encodeURIComponent(cur().id);
  }

  /** Вкладки лаборатории. */
  function setTab(name) {
    window.__labTab = name;
    const car = $('workCar'), map = $('workMap');
    if (car) car.hidden = name !== 'car';
    if (map) map.hidden = name !== 'map';
    document.querySelectorAll('.app-tabs .tab').forEach((b) => {
      const on = b.getAttribute('data-tab') === name;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    const reset = $('resetBtn');
    if (reset) reset.hidden = name === 'map';
    if (name === 'map') {
      MapView.sync();
      MapView.fit();
    }
    if (window.MapAssets) MapAssets.setOpen(name === 'map');
  }

  /** Привязка кнопок. */
  function bind() {
    document.querySelectorAll('.app-tabs .tab').forEach((b) => {
      b.disabled = false;
      b.removeAttribute('title');
      b.onclick = () => setTab(b.getAttribute('data-tab') || 'car');
    });
    document.querySelectorAll('[data-map-tool]').forEach((b) => {
      b.onclick = () => {
        const id = b.getAttribute('data-map-tool');
        MapView.setTool(id);
        setToolUi(id);
      };
    });
    if ($('mapSnap')) $('mapSnap').onchange = () => MapView.setSnap($('mapSnap').checked);
    if ($('mapSnapObj')) $('mapSnapObj').onchange = () => MapView.setSnapObj($('mapSnapObj').checked);
    if ($('mapFitBtn')) $('mapFitBtn').onclick = () => MapView.fit();
    if ($('mapAddStart')) $('mapAddStart').onclick = () => addStart();
    if ($('mapZoomIn')) $('mapZoomIn').onclick = () => MapView.zoomBy(1.18);
    if ($('mapZoomOut')) $('mapZoomOut').onclick = () => MapView.zoomBy(0.85);
    if ($('mapName')) $('mapName').oninput = () => { if (fillLock) return; cur().name = $('mapName').value; dirty = true; fill(); };
    if ($('mapId')) $('mapId').onchange = () => { if (fillLock) return; cur().id = $('mapId').value; dirty = true; };
    if ($('mapPublished')) $('mapPublished').onchange = () => { cur().published = $('mapPublished').checked; dirty = true; };
    if ($('mapAutoHz')) $('mapAutoHz').onchange = () => { cur().autoHazards = $('mapAutoHz').checked; dirty = true; };
    if ($('mapTheme')) $('mapTheme').onchange = () => {
      const id = $('mapTheme').value;
      const stock = RnRTracks.THEMES.find((x) => x.id === id);
      const wx = cur().theme.weather;
      const road = cur().theme.roadSrc;
      if (stock) {
        cur().theme = {ground: stock.ground, dark: stock.dark, road: stock.road, line: stock.line, deco: stock.deco, map: stock.map, weather: wx, groundSrc: '', roadSrc: road};
      } else {
        const b = (MapTex.catalog.biomes || []).find((x) => x.id === id);
        cur().theme.map = id;
        cur().theme.groundSrc = b ? b.src : cur().theme.groundSrc;
        cur().theme.weather = wx;
        cur().theme.roadSrc = road;
      }
      dirty = true;
    };
    if ($('mapWeather')) $('mapWeather').onchange = () => {
      cur().theme.weather = $('mapWeather').value;
      dirty = true;
    };
    if ($('mapRoadPick')) $('mapRoadPick').onchange = () => {
      cur().theme.roadSrc = $('mapRoadPick').value;
      dirty = true;
    };
    if ($('mapGroundFile')) $('mapGroundFile').onchange = async () => {
      const file = $('mapGroundFile').files && $('mapGroundFile').files[0];
      $('mapGroundFile').value = '';
      if (!file) return;
      const neu = $('mapTexDestNew') && $('mapTexDestNew').checked;
      const biomeId = neu ? ($('mapNewBiomeId').value || file.name) : (cur().theme.map || 'sand');
      try {
        const out = await MapTex.upload(file, 'ground', neu ? 'new' : 'current', biomeId);
        if (!out.ok) { if ($('mapSaveState')) $('mapSaveState').textContent = out.error || 'Сбой земли'; return; }
        cur().theme.map = out.id;
        cur().theme.groundSrc = out.src;
        dirty = true;
        fill();
      } catch (err) {
        if ($('mapSaveState')) $('mapSaveState').textContent = 'Нужен editor.bat';
      }
    };
    if ($('mapRoadFile')) $('mapRoadFile').onchange = async () => {
      const file = $('mapRoadFile').files && $('mapRoadFile').files[0];
      $('mapRoadFile').value = '';
      if (!file) return;
      try {
        const out = await MapTex.upload(file, 'road', 'library', file.name);
        if (!out.ok) { if ($('mapSaveState')) $('mapSaveState').textContent = out.error || 'Сбой дороги'; return; }
        cur().theme.roadSrc = out.src;
        dirty = true;
        fill();
      } catch (err) {
        if ($('mapSaveState')) $('mapSaveState').textContent = 'Нужен editor.bat';
      }
    };
    if ($('mapAddZone')) $('mapAddZone').onclick = () => {
      cur().zones.push({from: 0.5, to: 1, material: 'dirt'});
      dirty = true;
      MapPanel.fillZones();
    };
    if ($('mapNewBtn')) $('mapNewBtn').onclick = () => {
      docs.push(MapData.factory(MapData.freshId(docs.map((d) => d.id))));
      select(docs.length - 1);
      dirty = true;
    };
    if ($('mapDupBtn')) $('mapDupBtn').onclick = () => {
      const c = RnRTracks.normalize(MapData.fileTrack(cur()));
      c.id = MapData.freshId(docs.map((d) => d.id));
      c.name = (c.name || 'ТРАССА') + ' КОПИЯ';
      docs.push(c);
      select(docs.length - 1);
      dirty = true;
    };
    if ($('mapDelBtn')) $('mapDelBtn').onclick = async () => {
      if (docs.length < 1) return;
      if (!confirm('Удалить файл трассы с диска?')) return;
      try { await MapData.save(cur(), 'delete'); } catch (err) {}
      docs.splice(idx, 1);
      if (!docs.length) docs.push(MapData.factory('custom_01'));
      select(Math.max(0, idx - 1));
    };
    if ($('mapStock')) {
      RnRTracks.STOCK.forEach((st, i) => {
        const o = document.createElement('option');
        o.value = String(i);
        o.textContent = 'Клон: ' + st.name;
        $('mapStock').appendChild(o);
      });
      $('mapStock').onchange = () => {
        const v = $('mapStock').value;
        if (v === '') return;
        const stock = RnRTracks.STOCK[+v];
        if (!stock) return;
        const c = MapData.fromStock(stock, MapData.freshId(docs.map((d) => d.id)));
        docs.push(c);
        select(docs.length - 1);
        dirty = true;
        $('mapStock').value = '';
      };
    }
    if ($('mapSaveBtn')) $('mapSaveBtn').onclick = () => saveNow();
    if ($('mapTestBtn')) $('mapTestBtn').onclick = () => testDrive();
    if ($('mapUndoBtn')) $('mapUndoBtn').onclick = undo;
    if ($('mapRedoBtn')) $('mapRedoBtn').onclick = redo;
    window.addEventListener('keydown', (e) => {
      if (!mapOn()) return;
      const code = e.code || '';
      if ((e.ctrlKey || e.metaKey) && (code === 'KeyS' || (e.key || '').toLowerCase() === 's' || e.key === 'ы')) {
        e.preventDefault();
        saveNow();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (code === 'KeyZ' || e.key === 'z' || e.key === 'я')) {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.key === 'Escape' && $('assetEdit') && !$('assetEdit').hidden) {
        e.preventDefault();
        MapAssetEdit.close();
        return;
      }
      if (e.key === 'Enter') { e.preventDefault(); MapView.confirmSel(); return; }
      if (e.key === 'Escape' && MapView.selection()) { e.preventDefault(); MapView.confirmSel(); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); MapView.removeSel(); dirty = true; }
    });
  }

  /** Старт вкладки. */
  async function start() {
    bind();
    MapPanel.init({
      $,
      getDoc: cur,
      getStamp: () => stamp,
      setStamp: (id) => { stamp = id; },
      setDirty: (full) => { dirty = true; if (full) commit(); },
      setToolUi
    });
    MapAssets.init({
      $,
      getDoc: cur,
      getSel: () => MapView.selection(),
      setDirty: (full) => { dirty = true; if (full) commit(); },
      setToolUi
    });
    MapView.init({
      canvas: $('mapStage'),
      getDoc: cur,
      onChange: (full) => {
        dirty = true;
        if (full) commit();
        if ($('mapSaveState')) $('mapSaveState').textContent = 'Есть несохранённые правки';
        if ($('mapAutoHz')) $('mapAutoHz').checked = !!cur().autoHazards;
        syncStartBtn();
      },
      onSelect: () => { MapAssets.inspect(); },
      onHover: (p) => {
        if ($('mapCoord')) $('mapCoord').textContent = 'X ' + p.x.toFixed(0) + ' · Y ' + p.y.toFixed(0);
      },
      onZoom: (label) => { if ($('mapZoomRead')) $('mapZoomRead').textContent = label; },
      onDragEnd: () => commit()
    });
    MapView.setDecal(stamp);
    MapView.setItem('money');
    try { await MapTex.list(); } catch (err) {}
    try { if (window.RnRObjects) await RnRObjects.list(); } catch (err) {}
    MapAssets.paint();
    try {
      const loaded = await MapData.loadAll();
      docs = loaded.length ? loaded : [MapData.factory('custom_01')];
    } catch (err) {
      docs = [MapData.factory('custom_01')];
    }
    select(0);
    try {
      const q = new URLSearchParams(location.search);
      if (q.get('tab') === 'map') setTab('map');
    } catch (err) {}
  }

  return {start, mapOn, saveNow, setTab};
})();

(function bootMap() {
  const run = () => { if (window.__mapBoot) return; window.__mapBoot = true; MapApp.start(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
