////////////////////////////////////////////////////////
// Панель лаборатории: слоты, поля, сохранение и связь с игрой
////////////////////////////////////////////////////////
'use strict';

const EditorApp = (() => {
  const $ = (id) => document.getElementById(id);
  let pack = {version: 3, cars: {}};
  let carIndex = 0;
  let wheelIndex = 0;
  let nitroIndex = 0;
  let dirty = false;
  let fillLock = false;
  let sizeEdit = false;
  let carHist = Object.create(null);
  let restoring = false;
  let inputTimer = null;
  let persistTimer = null;

  /** Текущая машина, при необходимости создаётся из завода. */
  function car() {
    if (!pack.cars[carIndex]) pack.cars[carIndex] = EditorData.factory(carIndex);
    return pack.cars[carIndex];
  }

  /** Стек отмены текущего слота. */
  function histState(i) {
    const k = String(i == null ? carIndex : i);
    if (!carHist[k]) carHist[k] = {list: [], at: -1};
    return carHist[k];
  }

  /** Стирает историю всех слотов (после загрузки пакета). */
  function resetAllHist() {
    carHist = Object.create(null);
  }

  /** Снимок слота без rev и dataURL: они ломают сравнение. */
  function carForHistory(c) {
    const raw = EditorData.clone(c || {});
    delete raw.rev;
    delete raw.bodyData;
    return raw;
  }

  /** Снимок выбранной машины и её колёс/нитро. */
  function snapshot() {
    return {car: carForHistory(car()), wheelIndex: wheelIndex, nitroIndex: nitroIndex};
  }

  /** Пишет шаг в историю выбранного авто, если слот изменился. */
  function commit(force, opts) {
    if (restoring) return false;
    let snap;
    try { snap = snapshot(); } catch (err) {
      console.error(err);
      return false;
    }
    const h = histState(carIndex);
    const last = h.list[h.at];
    if (!force && last) {
      try {
        if (JSON.stringify(last.car) === JSON.stringify(snap.car)) return false;
      } catch (err) { /* считаем шаг новым */ }
    }
    h.list = h.list.slice(0, h.at + 1);
    h.list.push(snap);
    h.at = h.list.length - 1;
    const cap = 250;
    if (h.list.length > cap) {
      const drop = h.list.length - cap;
      h.list.splice(0, drop);
      h.at -= drop;
    }
    syncHistoryBtns();
    if (!(opts && opts.seed)) persistSoon();
    return true;
  }

  /** Откладывает шаг, чтобы набор цифр или стрелок стал одним действием. */
  function commitSoon() {
    mark();
    clearTimeout(inputTimer);
    inputTimer = setTimeout(() => { inputTimer = null; commit(); }, 380);
  }

  /** Сразу фиксирует шаг, если пакет изменился. */
  function commitNow() {
    mark();
    clearTimeout(inputTimer);
    inputTimer = null;
    commit();
  }

  /** Дописывает незакрытый ввод в историю. */
  function flushCommit() {
    if (!inputTimer) return;
    clearTimeout(inputTimer);
    inputTimer = null;
    commit();
  }

  /** Включает кнопки отмены и повтора для выбранного авто. */
  function syncHistoryBtns() {
    const u = $('undoBtn');
    const r = $('redoBtn');
    const h = histState(carIndex);
    const canUndo = h.at > 0;
    const canRedo = h.at >= 0 && h.at < h.list.length - 1;
    if (u) {
      u.disabled = !canUndo;
      u.title = canUndo ? 'Шаг назад по этому авто · Ctrl+Z' : 'Нет шага назад у этого авто';
    }
    if (r) {
      r.disabled = !canRedo;
      r.title = canRedo ? 'Шаг вперёд по этому авто · Ctrl+Y' : 'Нет шага вперёд у этого авто';
    }
  }

  const MARKS_KEY = 'rnr.carEditor.marks';
  const UI_KEY = 'rnr.carEditor.ui';

  /** Читает галочки холста и последний слот. */
  function loadUiPref() {
    try {
      const raw = localStorage.getItem(UI_KEY);
      if (!raw) return {};
      const o = JSON.parse(raw);
      return o && typeof o === 'object' ? o : {};
    } catch (err) { return {}; }
  }

  /** Пишет галочки холста и слот. */
  function saveUiPref(part) {
    const next = Object.assign(loadUiPref(), part || {});
    try { localStorage.setItem(UI_KEY, JSON.stringify(next)); } catch (err) {}
  }

  /** Ставит сетку, зеркало и связь брони из прошлого сеанса. */
  function applyUiPref() {
    const ui = loadUiPref();
    const snapOn = ui.snap !== false;
    if ($('snapToggle')) {
      $('snapToggle').checked = snapOn;
      EditorView.setSnap(snapOn);
    }
    const mirrorOn = ui.mirror !== false;
    if ($('wheelMirror')) {
      $('wheelMirror').checked = mirrorOn;
      EditorView.setMirrorWheels(mirrorOn);
    }
    const armorOn = ui.armorLink !== false;
    if ($('armorLink')) {
      $('armorLink').checked = armorOn;
      EditorView.setLinkArmor(armorOn);
    }
  }

  /** Показать или спрятать точки, номера, рамки и оси. */
  function applyMarks(on, silent) {
    EditorView.setMarks(on);
    const t = $('marksToggle');
    if (t) t.checked = !!on;
    try { localStorage.setItem(MARKS_KEY, on ? '1' : '0'); } catch (err) {}
    if (!silent) setText('status', on ? 'Отметки на холсте.' : 'Отметки скрыты.');
  }

  /** Читает прошлый выбор отметок. */
  function loadMarksPref() {
    try { return localStorage.getItem(MARKS_KEY) !== '0'; } catch (err) { return true; }
  }

  /** Откатывает только выбранный слот. Остальные авто не трогает. */
  function restore(snap) {
    if (!snap || !snap.car) return;
    restoring = true;
    const live = pack.cars[carIndex] || {};
    const next = EditorData.clone(snap.car);
    if (live.rev) next.rev = live.rev;
    if (live.bodyData && !next.bodyData) next.bodyData = live.bodyData;
    pack.cars[carIndex] = next;
    wheelIndex = snap.wheelIndex || 0;
    nitroIndex = snap.nitroIndex || 0;
    EditorView.clearCache();
    fillFields();
    EditorView.draw();
    restoring = false;
    persist(true, false);
    syncHistoryBtns();
  }

  /** Шаг назад по выбранному авто. Сначала дописывает незакрытый жест. */
  function undo() {
    if (inputTimer) { clearTimeout(inputTimer); inputTimer = null; }
    commit();
    const h = histState(carIndex);
    if (h.at <= 0) {
      if (dirty && h.list[0]) restore(h.list[0]);
      return;
    }
    h.at -= 1;
    restore(h.list[h.at]);
  }

  /** Шаг вперёд по выбранному авто. */
  function redo() {
    if (inputTimer) { clearTimeout(inputTimer); inputTimer = null; }
    const h = histState(carIndex);
    if (h.at >= h.list.length - 1) return;
    h.at += 1;
    restore(h.list[h.at]);
  }

  /** Пишет текст в элемент, если он есть. */
  function setText(id, t) {
    const el = $(id);
    if (el) el.textContent = t;
  }

  let fileNoteTimer = 0;

  /** Окно результата файла: успех или сбой. */
  function hideFileNote() {
    const box = $('fileNote');
    if (box) box.hidden = true;
    if (fileNoteTimer) {
      clearTimeout(fileNoteTimer);
      fileNoteTimer = 0;
    }
  }

  /** Показывает результат сохранения или загрузки. */
  function showFileNote(ok, kicker, title, text) {
    const box = $('fileNote');
    const card = $('fileNoteCard');
    if (!box || !card) {
      setText('status', text || title);
      return;
    }
    card.classList.toggle('is-ok', !!ok);
    card.classList.toggle('is-bad', !ok);
    setText('fileNoteKicker', kicker || (ok ? 'Готово' : 'Ошибка'));
    setText('fileNoteTitle', title || (ok ? 'Успешно' : 'Не вышло'));
    setText('fileNoteText', text || '');
    box.hidden = false;
    const btn = $('fileNoteOk');
    if (btn) btn.focus();
    if (fileNoteTimer) clearTimeout(fileNoteTimer);
    fileNoteTimer = setTimeout(hideFileNote, ok ? 3200 : 5200);
  }

  /** Пишет текущий слот как базу и рабочие файлы. */
  function saveSettings() {
    flushCommit();
    const c = car();
    return EditorData.saveAsBase(carIndex, c).then((ok) => {
      persist(true);
      if (ok) {
        setText('saveState', 'База и рабочие файлы записаны');
        showFileNote(true, 'Сохранение', 'Настройки записаны',
          'Слот сохранён как база. Сброс вернёт именно его. Прежний вариант лежит в бэкапе.');
      } else {
        setText('saveState', 'Сохранено в браузере');
        showFileNote(false, 'Сохранение', 'Файлы не записались',
          'База есть в браузере. Чтобы писать car.json, запустите editor.bat (сервер с записью).');
      }
    }).catch((err) => {
      console.error(err);
      showFileNote(false, 'Сохранение', 'Не удалось сохранить',
        'Проверьте браузер и editor.bat. Можно скачать JSON вручную.');
    });
  }

  /** Помечает несохранённые правки. */
  function mark() {
    dirty = true;
    setText('saveState', 'Есть несохранённые изменения');
    syncHistoryBtns();
  }

  /** Сохраняет пакет в браузер и в папку машины. */
  function persist(silent, keepRev) {
    clearTimeout(persistTimer);
    persistTimer = null;
    try {
      const now = Date.now();
      Object.keys(pack.cars || {}).forEach((k) => {
        const slot = pack.cars[k];
        if (!slot) return;
        EditorData.ensureStack(slot);
        EditorData.syncVisibleFromStack(slot);
        const timed = EditorData.revTime && EditorData.revTime(slot.rev);
        if (keepRev && timed) return;
        if (!keepRev && Number(k) === carIndex) slot.rev = now;
        else if (!timed) slot.rev = now;
      });
      EditorData.save(pack);
      dirty = false;
      syncHistoryBtns();
      setText('saveState', 'Сохранено в браузере');
      const c = pack.cars[carIndex];
      if (c && carIndex < EditorData.STOCK) {
        EditorData.pushDisk(carIndex, c).then((ok) => {
          if (ok) setText('saveState', 'Сохранено в файл и браузер');
          if (!silent) {
            setText('status', ok
              ? 'Игра читает assets/data/cars/' + EditorData.folderId(carIndex) + '/car.json и этот же пакет в браузере.'
              : 'В браузере есть. Чтобы писать файлы, запустите editor.bat заново (сервер с записью).');
          }
        });
      } else if (!silent) {
        setText('status', 'Игра на этом адресе подхватит колёса, нитро, броню и характеристики.');
      }
      return true;
    } catch (err) {
      console.error(err);
      try {
        const slim = EditorData.clone(pack);
        Object.keys(slim.cars || {}).forEach((k) => {
          if (+k !== carIndex) delete slim.cars[k].bodyData;
        });
        EditorData.save(slim);
        dirty = false;
        syncHistoryBtns();
        setText('saveState', 'Сохранено (без чужих корпусов)');
        if (!silent) setText('status', 'Места в браузере мало: свой корпус оставлен только у текущей машины.');
        return true;
      } catch (err2) {
        console.error(err2);
        setText('status', 'Не удалось сохранить в браузер. Скачайте JSON.');
        return false;
      }
    }
  }

  /** Пишет пакет и сразу уходит в игру или на полигон. */
  function goToGame(query) {
    flushCommit();
    persist(true);
    location.href = 'rnr.html' + (query || '');
  }

  /** Пишет в браузер после паузы ввода, чтобы игра видела те же колёса, что холст. */
  function persistSoon() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => { persistTimer = null; persist(true); }, 280);
  }

  /** Заполняет список слотов. */
  function renderCars() {
    const box = $('carList');
    if (!box || !pack) return;
    if (!pack.cars) pack.cars = {};
    box.innerHTML = '';
    EditorData.indices(pack).forEach((i) => {
      const [code, name] = EditorData.label(pack, i);
      const b = document.createElement('button');
      b.textContent = code;
      b.title = name;
      if (i === carIndex) b.className = 'active';
      b.onclick = () => selectCar(i);
      box.appendChild(b);
    });
    const lab = EditorData.label(pack, carIndex);
    $('machineName').textContent = lab[0] + ' · ' + lab[1];
    const n = EditorData.indices(pack).length;
    $('carCounter').textContent = String(carIndex + 1).padStart(2, '0') + ' / ' + String(n).padStart(2, '0');
    $('delCarBtn').disabled = carIndex < EditorData.STOCK;
  }

  /** Список выходов нитро. */
  function renderNitro() {
    const c = car();
    if (!Array.isArray(c.nitro)) c.nitro = EditorData.defaultNitro(carIndex);
    const box = $('nitroList');
    box.innerHTML = '';
    c.nitro.forEach((n, i) => {
      const b = document.createElement('button');
      b.textContent = (i + 1) + '. ' + n[0].toFixed(1) + ' / ' + n[1].toFixed(1);
      if (EditorView.hasNitro(i) || (EditorView.focusKind() === 'nitro' && i === nitroIndex)) b.classList.add('active');
      b.onclick = (e) => {
        EditorView.pickNitro(i, e.ctrlKey || e.metaKey, e.shiftKey);
        nitroIndex = i;
        fillFields();
        EditorView.draw();
      };
      box.appendChild(b);
    });
  }

  /** Список колёс. */
  function renderWheels() {
    const c = car();
    const box = $('wheelList');
    box.innerHTML = '';
    (c.w || []).forEach((w, i) => {
      const b = document.createElement('button');
      const side = i % 2 ? 'прав.' : 'лев.';
      b.textContent = (i + 1) + '. ' + side + (w[6] ? ' • руль' : '');
      if (EditorView.hasWheel(i) || (EditorView.focusKind() === 'wheel' && i === wheelIndex)) b.classList.add('active');
      b.onclick = (e) => {
        EditorView.pickWheel(i, e.ctrlKey || e.metaKey, e.shiftKey);
        wheelIndex = i;
        fillFields();
        EditorView.draw();
      };
      box.appendChild(b);
    });
  }

  /** Один раз: клики, видимость и перетаскивание слоёв как в Figma. */
  function bindLayerPanel() {
    const box = $('layers');
    if (!box || box.dataset.bound === '1') return;
    box.dataset.bound = '1';
    let drag = null;
    let skipClick = false;
    box.addEventListener('change', (e) => {
      const inp = e.target;
      if (!inp || inp.type !== 'checkbox') return;
      const id = inp.getAttribute('data-stack-id');
      if (!id) return;
      const c = car();
      EditorData.ensureStack(c);
      const L = (c.stack || []).find((x) => x.id === id);
      if (!L) return;
      L.on = inp.checked;
      EditorData.syncVisibleFromStack(c);
      mark();
      commitNow();
      persist(true);
      EditorView.draw();
      setText('status', inp.checked ? 'Слой «' + EditorData.layerTitle(L, c) + '» включён.' : 'Слой «' + EditorData.layerTitle(L, c) + '» скрыт.');
    });
    box.addEventListener('click', (e) => {
      if (skipClick) { skipClick = false; return; }
      const mv = e.target.closest('[data-dir]');
      if (mv) {
        e.preventDefault();
        e.stopPropagation();
        moveLayer(+mv.getAttribute('data-i'), +mv.getAttribute('data-dir'));
        return;
      }
      const rst = e.target.closest('[data-reset-layer]');
      if (rst) {
        e.preventDefault();
        e.stopPropagation();
        resetLayerById(rst.getAttribute('data-reset-layer'));
        return;
      }
      if (e.target.closest('input')) return;
      const row = e.target.closest('[data-layer-row]');
      if (!row) return;
      const id = row.getAttribute('data-layer-row');
      if (e.shiftKey) e.preventDefault();
      EditorView.pickLayer(id, e.ctrlKey || e.metaKey, e.shiftKey);
      const c = car();
      const L = (c.stack || []).find((x) => x.id === id);
      const n = (EditorView.selectedLayers && EditorView.selectedLayers() || []).length;
      setText('status', n > 1
        ? 'Выбрано слоёв: ' + n + '. Тащите группу на холсте или стрелками.'
        : 'Слой «' + EditorData.layerTitle(L, c) + '». Перетащите за грип, чтобы сменить порядок.');
      refreshSel();
      EditorView.draw();
    });
    box.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('input') || e.target.closest('[data-dir]') || e.target.closest('[data-reset-layer]')) return;
      const row = e.target.closest('[data-layer-row]');
      if (!row) return;
      const grip = e.target.closest('.layer-grip');
      drag = {
        row: row,
        fromVis: -1,
        x: e.clientX,
        y: e.clientY,
        moved: false,
        pointer: e.pointerId,
        grip: !!grip
      };
      try { row.setPointerCapture(e.pointerId); } catch (err) {}
    });
    box.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 5) return;
      if (!drag.moved) {
        drag.moved = true;
        const rows = layerRows(box);
        drag.fromVis = rows.indexOf(drag.row);
        drag.row.classList.add('is-dragging');
        box.classList.add('is-sorting');
      }
      const over = document.elementFromPoint(e.clientX, e.clientY);
      const hit = over && over.closest ? over.closest('[data-layer-row]') : null;
      clearDropMarks(box);
      if (!hit || hit === drag.row) return;
      const mid = hit.getBoundingClientRect().top + hit.getBoundingClientRect().height / 2;
      hit.classList.add(e.clientY > mid ? 'drop-after' : 'drop-before');
    });
    const endDrag = (e) => {
      if (!drag) return;
      const state = drag;
      drag = null;
      box.classList.remove('is-sorting');
      state.row.classList.remove('is-dragging');
      const drop = box.querySelector('.drop-before, .drop-after');
      const after = drop && drop.classList.contains('drop-after');
      clearDropMarks(box);
      try { state.row.releasePointerCapture(state.pointer); } catch (err) {}
      if (!state.moved || state.fromVis < 0) return;
      skipClick = true;
      const rows = layerRows(box);
      if (!drop) return;
      const toVis = rows.indexOf(drop);
      if (toVis < 0) return;
      reorderLayersVisual(state.fromVis, toVis, after);
      e.preventDefault();
    };
    box.addEventListener('pointerup', endDrag);
    box.addEventListener('pointercancel', endDrag);
  }

  /** Строки слоёв сверху вниз. */
  function layerRows(box) {
    return Array.prototype.slice.call(box.querySelectorAll('[data-layer-row]'));
  }

  /** Снимает метки вставки. */
  function clearDropMarks(box) {
    layerRows(box).forEach((row) => {
      row.classList.remove('drop-before');
      row.classList.remove('drop-after');
    });
  }

  /** Слои: сначала фрагмент, потом замена — пустой список только если стек пуст. */
  function renderLayers() {
    const box = $('layers');
    if (!box) {
      setText('status', 'Нет блока слоёв в разметке.');
      return;
    }
    const c = car();
    if (!c) return;
    try {
      EditorData.ensureStack(c);
      if (!c.stack || !c.stack.length) {
        delete c.stack;
        EditorData.ensureStack(c);
      }
    } catch (err) {
      console.error(err);
    }
    const stack = Array.isArray(c.stack) ? c.stack : [];
    const frag = document.createDocumentFragment();
    const bodyAt = stack.findIndex((L) => L && L.type === 'body');
    stack.slice().reverse().forEach((L) => {
      if (!L || !L.type) return;
      const i = stack.indexOf(L);
      const under = bodyAt >= 0 && i < bodyAt && (L.type === 'wheel' || L.type === 'nitro');
      const over = bodyAt >= 0 && i > bodyAt && (L.type === 'wheel' || L.type === 'nitro');
      const ru = EditorData.layerTitle(L, c) || L.type;
      const row = document.createElement('div');
      row.className = 'layer-row' +
        (EditorView.hasLayer(L.id) ? ' is-on' : '') +
        (L.on === false ? ' is-off' : '');
      row.setAttribute('data-layer-row', L.id);
      const grip = document.createElement('span');
      grip.className = 'layer-grip';
      grip.title = 'Перетащить';
      const chk = document.createElement('input');
      chk.className = 'check';
      chk.type = 'checkbox';
      chk.checked = L.on !== false;
      chk.setAttribute('data-stack-id', L.id);
      chk.setAttribute('aria-label', ru);
      const name = document.createElement('span');
      name.className = 'layer-name';
      name.textContent = ru;
      if (under || over) {
        const hint = document.createElement('i');
        hint.className = 'hint';
        hint.textContent = under ? ' под кузовом' : ' над кузовом';
        name.appendChild(hint);
      }
      const down = document.createElement('button');
      down.type = 'button';
      down.textContent = '↓';
      down.title = 'Ниже';
      down.setAttribute('data-i', String(i));
      down.setAttribute('data-dir', '-1');
      const up = document.createElement('button');
      up.type = 'button';
      up.textContent = '↑';
      up.title = 'Выше';
      up.setAttribute('data-i', String(i));
      up.setAttribute('data-dir', '1');
      const rst = document.createElement('button');
      rst.type = 'button';
      rst.className = 'layer-reset';
      rst.textContent = '↺';
      rst.title = 'Сбросить слой к базе';
      rst.setAttribute('data-reset-layer', L.id);
      row.appendChild(grip);
      row.appendChild(chk);
      row.appendChild(name);
      row.appendChild(rst);
      row.appendChild(down);
      row.appendChild(up);
      frag.appendChild(row);
    });
    if (!frag.childElementCount) {
      const empty = document.createElement('div');
      empty.className = 'layer-row';
      empty.textContent = 'Слои не собрались — сбросьте слот к базовым.';
      frag.appendChild(empty);
    }
    if (typeof box.replaceChildren === 'function') box.replaceChildren(frag);
    else {
      box.innerHTML = '';
      box.appendChild(frag);
    }
  }

  /** Переставляет слой в визуальном списке (0 — верх / поверх). */
  function reorderLayersVisual(fromVis, toVis, after) {
    const c = car();
    EditorData.ensureStack(c);
    const visual = c.stack.slice().reverse();
    if (fromVis < 0 || fromVis >= visual.length) return;
    const item = visual.splice(fromVis, 1)[0];
    let dest = toVis;
    if (fromVis < toVis) dest -= 1;
    if (after) dest += 1;
    dest = Math.max(0, Math.min(visual.length, dest));
    visual.splice(dest, 0, item);
    c.stack = visual.reverse();
    EditorData.syncVisibleFromStack(c);
    mark();
    renderLayers();
    commit();
    persist(true);
    EditorView.draw();
    setText('status', 'Порядок слоёв: «' + EditorData.layerTitle(item, c) + '».');
  }

  /** Переставляет слой стека на одну позицию. */
  function moveLayer(i, d) {
    const c = car();
    EditorData.ensureStack(c);
    const n = i + d;
    if (n < 0 || n >= c.stack.length) return;
    const t = c.stack[i];
    c.stack[i] = c.stack[n];
    c.stack[n] = t;
    EditorData.syncVisibleFromStack(c);
    mark();
    renderLayers();
    commit();
    persist(true);
    EditorView.draw();
  }

  /** Пишет значения в поля без повторного input. */
  function fillFields() {
    fillLock = true;
    try {
      const c = car();
      const b = c.body;
      const s = c.stats;
      $('bodyX').value = b.x.toFixed(2);
      $('bodyY').value = b.y.toFixed(2);
      $('bodyScale').value = b.scale.toFixed(2);
      if ($('armorX')) $('armorX').value = (+b.ax || 0).toFixed(2);
      if ($('armorY')) $('armorY').value = (+b.ay || 0).toFixed(2);
      paintArmorPicker();
      $('statName').value = s.name || '';
      $('statPrice').value = s.price;
      $('statTop').value = s.top;
      $('statAcc').value = s.acc;
      $('statCrn').value = s.crn;
      $('statHp').value = s.hp;
      $('statCol').value = s.col || '#cccccc';
      $('statCol2').value = s.col2 || '#888888';
      $('statHov').checked = !!s.hov;
      $('trait0').value = (s.traits && s.traits[0]) || '';
      $('trait1').value = (s.traits && s.traits[1]) || '';
      $('trait2').value = (s.traits && s.traits[2]) || '';
      paintBars(s);
      paintOwner();
      paintWheelFields();
      paintNitroFields();
    } catch (err) {
      console.error(err);
    }
    fillLock = false;
    try { renderCars(); } catch (err) { console.error(err); }
    try { renderWheels(); } catch (err) { console.error(err); }
    try { renderNitro(); } catch (err) { console.error(err); }
    try { renderLayers(); } catch (err) { console.error(err); }
    try { syncInspector(); } catch (err) { console.error(err); }
  }

  /** Полоски характеристик. */
  function paintBars(s) {
    $('barTop').style.width = Math.round((s.top - 0.7) / 0.8 * 100) + '%';
    $('barAcc').style.width = Math.round((s.acc - 0.7) / 0.8 * 100) + '%';
    $('barCrn').style.width = Math.round((s.crn - 0.7) / 0.8 * 100) + '%';
    $('barHp').style.width = Math.round((s.hp - 60) / 160 * 100) + '%';
  }

  /** Текущий хозяин слота. */
  function currentOwner() {
    return EditorData.ownerOf(car(), carIndex);
  }

  /** Портреты всех гонщиков игры и найденных аватаров. */
  function paintOwner() {
    const box = $('ownerRow');
    if (!box) return;
    const cur = currentOwner();
    const pilots = EditorData.PILOTS || [];
    const stamp = pilots.map((p) => p.id).join(',');
    if (box.dataset.ready !== stamp) {
      box.innerHTML = '';
      const shop = document.createElement('button');
      shop.type = 'button';
      shop.className = 'owner-card is-shop';
      shop.setAttribute('data-owner', 'shop');
      shop.innerHTML = '<div class="owner-art">SHOP</div><span>МАГАЗИН</span>';
      box.appendChild(shop);
      pilots.forEach((p) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'owner-card' + (p.npc ? ' is-npc' : '') + (p.extra ? ' is-extra' : '');
        b.setAttribute('data-owner', String(p.id));
        b.title = p.npc ? (p.name + ' · ИИ') : p.name;
        const art = document.createElement('div');
        art.className = 'owner-art';
        const img = document.createElement('img');
        img.alt = p.name;
        img.src = (typeof playerDir === 'function' ? playerDir(p.id) : ('assets/data/players/' + String(p.id + 1).padStart(2, '0') + '/')) + p.file + '.webp';
        img.onerror = function () {
          this.onerror = null;
          this.src = (typeof playerDir === 'function' ? playerDir(p.id) : ('assets/data/players/' + String(p.id + 1).padStart(2, '0') + '/')) + p.file + '.png';
        };
        art.appendChild(img);
        b.appendChild(art);
        const cap = document.createElement('span');
        cap.textContent = p.name;
        b.appendChild(cap);
        box.appendChild(b);
      });
      box.dataset.ready = stamp;
    }
    Array.prototype.forEach.call(box.querySelectorAll('[data-owner]'), (el) => {
      const v = el.getAttribute('data-owner');
      const on = (v === 'shop' && cur == null) || (v !== 'shop' && Number(v) === cur);
      el.classList.toggle('is-on', on);
    });
    const hint = $('ownerHint');
    if (!hint) return;
    if (cur == null) {
      hint.textContent = 'Стоит в магазине. Личным станет у любого гонщика из игры — список растёт с папками в assets/data/players.';
      return;
    }
    const p = pilots.find((x) => x.id === cur);
    hint.textContent = 'Личный кузов: ' + (p ? p.name : 'гонщик') + '. В карьере чужим не купить. Портрет на карточке автопарка.';
  }

  /** Выбор хозяина: один личный кузов на гонщика в пакете. */
  function setOwner(next) {
    const c = car();
    c.stats = c.stats || {};
    let took = false;
    if (next != null) {
      Object.keys(pack.cars || {}).forEach((k) => {
        if (Number(k) === carIndex) return;
        const other = pack.cars[k];
        if (!other || !other.stats) return;
        if (EditorData.ownerOf(other, Number(k)) !== next) return;
        other.stats.owner = null;
        other.owner = null;
        took = true;
      });
    }
    c.stats.owner = next;
    c.owner = next;
    paintOwner();
    commitNow();
    if (next == null) {
      setText('status', 'Кузов в магазине.');
      return;
    }
    const p = (EditorData.PILOTS || []).find((x) => x.id === next);
    setText('status', took
      ? 'Хозяин: ' + (p && p.name) + '. Прежний личный кузов этого гонщика ушёл в магазин.'
      : 'Хозяин: ' + (p && p.name) + '.');
  }

  /** Клики по карточкам личности. */
  function bindOwnerRow() {
    const box = $('ownerRow');
    if (!box || box.dataset.bound === '1') return;
    box.dataset.bound = '1';
    box.addEventListener('click', (e) => {
      const card = e.target.closest('[data-owner]');
      if (!card || fillLock) return;
      const v = card.getAttribute('data-owner');
      setOwner(v === 'shop' ? null : Number(v));
    });
  }

  const ARMOR_LABELS = ['База', 'I', 'II', 'III', 'IV', 'V', 'VI'];

  /** Кузов webp, затем png. */
  function setCarImg(img, webp, png, onFail) {
    img.src = webp;
    img.onerror = function () {
      this.onerror = function () {
        if (typeof onFail === 'function') onFail(this);
        else this.style.visibility = 'hidden';
      };
      this.src = png;
    };
  }

  /** Сетка уровней: кузов + слой брони поверх, иначе пластины не читаются на тёмном. */
  function paintArmorPicker() {
    const box = $('armorRow');
    if (!box) return;
    const lvl = (car().body && car().body.armor) | 0;
    const nn = EditorData.folderId(carIndex);
    const bodyWebp = 'assets/machines/cars/' + nn + '.webp';
    const bodyPng = 'assets/machines/cars/' + nn + '.png';
    if (box.dataset.nn !== nn) {
      box.innerHTML = '';
      ARMOR_LABELS.forEach((lab, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'armor-card' + (i === 0 ? ' is-base' : '');
        b.setAttribute('data-armor', String(i));
        b.title = i ? 'Броня ' + lab : 'Кузов без слоя брони';
        const art = document.createElement('div');
        art.className = 'armor-art';
        const body = document.createElement('img');
        body.className = 'armor-body';
        body.alt = '';
        setCarImg(body, bodyWebp, bodyPng);
        art.appendChild(body);
        if (i > 0) {
          const plate = document.createElement('img');
          plate.className = 'armor-plate';
          plate.alt = lab;
          const base = 'assets/machines/cars/' + nn + '_armor_' + i;
          setCarImg(plate, base + '.webp', base + '.png', () => {
            plate.style.display = 'none';
            b.classList.add('is-missing-plate');
          });
          art.appendChild(plate);
        }
        b.appendChild(art);
        const cap = document.createElement('span');
        cap.textContent = lab;
        b.appendChild(cap);
        box.appendChild(b);
      });
      box.dataset.nn = nn;
    }
    Array.prototype.forEach.call(box.querySelectorAll('[data-armor]'), (el) => {
      el.classList.toggle('is-on', Number(el.getAttribute('data-armor')) === lvl);
    });
  }

  /** Ставит уровень брони и перерисовывает холст. */
  function setArmorLevel(n) {
    const c = car();
    c.body = c.body || {};
    c.body.armor = n | 0;
    c.visible = c.visible || {};
    c.visible.armor = true;
    EditorView.clearCache();
    paintArmorPicker();
    renderLayers();
    commitNow();
    EditorView.draw();
    setText('status', n ? 'Броня ' + ARMOR_LABELS[n] + ' на холсте.' : 'Кузов без брони.');
  }

  /** Клики по превью брони. */
  function bindArmorRow() {
    const box = $('armorRow');
    if (!box || box.dataset.bound === '1') return;
    box.dataset.bound = '1';
    box.addEventListener('click', (e) => {
      const card = e.target.closest('[data-armor]');
      if (!card || fillLock) return;
      setArmorLevel(Number(card.getAttribute('data-armor')) || 0);
    });
  }

  /** Курсор в поле ввода — наведение на холсте не должно сбивать набор. */
  function fieldTyping() {
    if (sizeEdit) return true;
    const el = document.activeElement;
    return !!(el && /INPUT|TEXTAREA|SELECT/.test(el.tagName));
  }

  /** Пишет в поля текущее колесо. */
  function paintWheelFields() {
    const w = (car().w || [])[wheelIndex] || [0, 0, 12, 8, 0, 1, 0];
    const lock = fillLock;
    fillLock = true;
    $('wheelX').value = w[0].toFixed(2);
    $('wheelY').value = w[1].toFixed(2);
    $('wheelW').value = w[2].toFixed(2);
    $('wheelH').value = w[3].toFixed(2);
    $('wheelAngle').value = w[4].toFixed(2);
    $('wheelScale').value = w[5].toFixed(2);
    $('wheelSteer').checked = !!w[6];
    fillLock = lock;
  }

  /** Пишет в поля текущую трубу нитро. */
  function paintNitroFields() {
    const n = (car().nitro || [])[nitroIndex] || [-26, 0, 9, 1.5];
    const lock = fillLock;
    fillLock = true;
    $('nitroX').value = n[0].toFixed(2);
    $('nitroY').value = n[1].toFixed(2);
    $('nitroLen').value = n[2].toFixed(2);
    $('nitroHalf').value = n[3].toFixed(2);
    fillLock = lock;
  }

  /** Показывает поля только выбранного типа. */
  function syncInspector() {
    const kind = EditorView.inspectorKind ? EditorView.inspectorKind() : '';
    const body = $('inspBody');
    const armor = $('inspArmor');
    const wheels = $('inspWheels');
    const nitro = $('inspNitro');
    const empty = $('inspEmpty');
    if (body) body.hidden = kind !== 'body';
    if (armor) armor.hidden = kind !== 'armor';
    if (wheels) wheels.hidden = kind !== 'wheel';
    if (nitro) nitro.hidden = kind !== 'nitro';
    if (empty) empty.hidden = !!kind;
    syncSizeClipBtns();
  }

  const SIZE_CLIP_KEY = 'rnr.carEditor.sizeClip';

  /** Читает буфер ширины/высоты. */
  function readSizeClip() {
    try {
      const o = JSON.parse(localStorage.getItem(SIZE_CLIP_KEY) || 'null');
      if (o && (o.type === 'wheel' || o.type === 'nitro') && isFinite(+o.w) && isFinite(+o.h)) return o;
    } catch (err) {}
    return null;
  }

  /** Пишет буфер ширины/высоты. */
  function writeSizeClip(clip) {
    try { localStorage.setItem(SIZE_CLIP_KEY, JSON.stringify(clip)); } catch (err) {}
    syncSizeClipBtns();
  }

  /** Вставить можно только в слой того же типа. */
  function syncSizeClipBtns() {
    const clip = readSizeClip();
    if ($('pasteWheelSize')) $('pasteWheelSize').disabled = !(clip && clip.type === 'wheel');
    if ($('pasteNitroSize')) $('pasteNitroSize').disabled = !(clip && clip.type === 'nitro');
  }

  /** Копирует ширину и высоту текущего колеса. */
  function copyWheelSize() {
    const w = (car().w || [])[wheelIndex];
    if (!w) {
      setText('status', 'Выберите колесо.');
      return;
    }
    writeSizeClip({type: 'wheel', w: +w[2] || 12, h: +w[3] || 8});
    setText('status', 'Размер колеса скопирован: ' + (+w[2]).toFixed(1) + ' × ' + (+w[3]).toFixed(1) + '. Выберите другое колесо и вставьте.');
  }

  /** Ставит скопированную ширину и высоту на выбранные колёса. */
  function pasteWheelSize() {
    const clip = readSizeClip();
    if (!clip || clip.type !== 'wheel') {
      setText('status', 'Сначала скопируйте размер колеса. В нитро его не вставить.');
      return;
    }
    let ids = EditorView.selectedWheels ? EditorView.selectedWheels() : [];
    if (!ids.length) ids = [wheelIndex];
    const c = car();
    let n = 0;
    const done = {};
    ids.forEach((i) => {
      if (done[i] || !c.w || !c.w[i]) return;
      c.w[i][2] = clip.w;
      c.w[i][3] = clip.h;
      done[i] = true;
      n += 1;
      mirrorWheelValue(i, 2, clip.w);
    });
    if (!n) {
      setText('status', 'Нет выбранного колеса.');
      return;
    }
    fillFields();
    EditorView.draw();
    commitNow();
    setText('status', n === 1 ? 'Размер вставлен в колесо.' : 'Размер вставлен в выбранные колёса (' + n + ').');
  }

  /** Копирует длину и ширину текущей трубы. */
  function copyNitroSize() {
    const jet = (car().nitro || [])[nitroIndex];
    if (!jet) {
      setText('status', 'Выберите трубу нитро.');
      return;
    }
    writeSizeClip({type: 'nitro', w: +jet[2] || 9, h: +jet[3] || 1.5});
    setText('status', 'Размер нитро скопирован: ' + (+jet[2]).toFixed(1) + ' × ' + (+jet[3]).toFixed(1) + '. Выберите другую трубу и вставьте.');
  }

  /** Ставит скопированную длину и ширину на выбранные трубы. */
  function pasteNitroSize() {
    const clip = readSizeClip();
    if (!clip || clip.type !== 'nitro') {
      setText('status', 'Сначала скопируйте размер нитро. В колесо его не вставить.');
      return;
    }
    let ids = EditorView.selectedNitro ? EditorView.selectedNitro() : [];
    if (!ids.length) ids = [nitroIndex];
    const c = car();
    let n = 0;
    ids.forEach((i) => {
      if (!c.nitro || !c.nitro[i]) return;
      c.nitro[i][2] = clip.w;
      c.nitro[i][3] = clip.h;
      n += 1;
    });
    if (!n) {
      setText('status', 'Нет выбранной трубы.');
      return;
    }
    fillFields();
    EditorView.draw();
    commitNow();
    setText('status', n === 1 ? 'Размер вставлен в трубу.' : 'Размер вставлен в выбранные трубы (' + n + ').');
  }

  /** База слота для точечного сброса. */
  function baseline() {
    return EditorData.peekBase(carIndex);
  }

  /** Одно колесо из базы. */
  function resetWheelIndex(i) {
    const c = car();
    const base = baseline();
    if (!c.w || i < 0) return;
    if (base.w && base.w[i]) c.w[i] = EditorData.normWheel(base.w[i]);
  }

  /** Одна труба из базы. */
  function resetNitroIndex(i) {
    const c = car();
    const base = baseline();
    if (!c.nitro || i < 0) return;
    if (base.nitro && base.nitro[i]) c.nitro[i] = EditorData.normJet(base.nitro[i]);
  }

  /** Сбрасывает один слой стека к базе. */
  function resetLayerById(id) {
    const c = car();
    EditorData.ensureStack(c);
    const L = (c.stack || []).find((x) => x.id === id);
    if (!L) return;
    const base = baseline();
    EditorData.ensureStack(base);
    if (L.type === 'body') {
      const b = base.body || {};
      c.body.x = b.x || 0;
      c.body.y = b.y || 0;
      c.body.scale = b.scale || 1;
      c.body.sx = b.sx || 1;
      c.body.sy = b.sy || 1;
      delete c.bodyData;
      EditorView.clearCache();
    } else if (L.type === 'armor') {
      const b = base.body || {};
      c.body.ax = +b.ax || 0;
      c.body.ay = +b.ay || 0;
      c.body.armor = b.armor || 0;
      EditorView.clearCache();
    } else if (L.type === 'wheel') {
      resetWheelIndex(L.ref);
      if ($('wheelMirror') && $('wheelMirror').checked) {
        const j = EditorView.pairWheel(c, L.ref);
        if (j >= 0) resetWheelIndex(j);
      }
    } else if (L.type === 'nitro') {
      resetNitroIndex(L.ref);
    } else if (L.type === 'shadow' || L.type === 'guides') {
      const bL = (base.stack || []).find((x) => x.type === L.type);
      L.on = !bL || bL.on !== false;
      EditorData.syncVisibleFromStack(c);
    }
    fillFields();
    EditorView.draw();
    commitNow();
    setText('status', 'Слой «' + EditorData.layerTitle(L, c) + '» сброшен к базе.');
  }

  /** Сброс из панели свойств. */
  function resetInspector() {
    const kind = EditorView.inspectorKind();
    const c = car();
    if (kind === 'body') {
      const L = (c.stack || []).find((x) => x.type === 'body');
      if (L) resetLayerById(L.id);
      return;
    }
    if (kind === 'armor') {
      const L = (c.stack || []).find((x) => x.type === 'armor');
      if (L) resetLayerById(L.id);
      return;
    }
    if (kind === 'wheel') {
      let ids = EditorView.selectedWheels();
      if (!ids.length) ids = [wheelIndex];
      ids.forEach(resetWheelIndex);
      fillFields();
      EditorView.draw();
      commitNow();
      setText('status', 'Выбранные колёса сброшены к базе.');
      return;
    }
    if (kind === 'nitro') {
      let ids = EditorView.selectedNitro();
      if (!ids.length) ids = [nitroIndex];
      ids.forEach(resetNitroIndex);
      fillFields();
      EditorView.draw();
      commitNow();
      setText('status', 'Выбранные трубы сброшены к базе.');
    }
  }

  /** Подсветка списков без перезаписи всей панели. */
  function refreshSel() {
    renderWheels();
    renderNitro();
    renderLayers();
    paintWheelFields();
    paintNitroFields();
    paintArmorPicker();
    syncInspector();
  }

  /** Выбор слота. */
  /** Выбор слота. Незакрытый жест остаётся в истории прежнего авто. */
  function selectCar(i) {
    if (i !== carIndex) flushCommit();
    carIndex = i;
    wheelIndex = 0;
    nitroIndex = 0;
    EditorView.clearSel();
    car();
    if (!histState(carIndex).list.length) commit(true, {seed: true});
    fillFields();
    EditorView.fit();
    saveUiPref({car: i});
    syncHistoryBtns();
  }

  /** Копирует правку на парное колесо: размер целиком, Y и угол зеркалятся. */
  function mirrorWheelValue(i, k, v) {
    if (!$('wheelMirror') || !$('wheelMirror').checked) return;
    const src = car().w[i];
    const j = EditorView.pairWheel(car(), i);
    if (j < 0 || !src) return;
    const p = car().w[j];
    if (!p) return;
    if (k === 2 || k === 3 || k === 5) {
      p[2] = src[2];
      p[3] = src[3];
      p[5] = src[5];
      return;
    }
    p[k] = (k === 1 || k === 4) ? -v : v;
  }

  /** Число из поля: и точка, и запятая, valueAsNumber у type=number. */
  function num(id) {
    const el = $(id);
    if (!el) return 0;
    if (el.type === 'number' && isFinite(el.valueAsNumber)) return el.valueAsNumber;
    const n = Number(String(el.value || '').trim().replace(',', '.'));
    return isFinite(n) ? n : 0;
  }

  /** Навешивает поля кузова, статов и колёс. */
  function bindFields() {
    [['bodyX', (v) => { car().body.x = v; }], ['bodyY', (v) => { car().body.y = v; }],
     ['bodyScale', (v) => { car().body.scale = v || 1; }]].forEach(([id, fn]) => {
      $(id).addEventListener('input', () => {
        if (fillLock) return;
        const c = car();
        if ((id === 'bodyX' || id === 'bodyY') && EditorView.armorLinked && !EditorView.armorLinked()) {
          const next = num(id);
          const prev = id === 'bodyX' ? c.body.x : c.body.y;
          const d = next - prev;
          if (id === 'bodyX') c.body.ax = (+c.body.ax || 0) - d;
          else c.body.ay = (+c.body.ay || 0) - d;
          if ($('armorX')) $('armorX').value = (+c.body.ax || 0).toFixed(2);
          if ($('armorY')) $('armorY').value = (+c.body.ay || 0).toFixed(2);
        }
        fn(num(id));
        commitSoon();
        if (id === 'bodyScale') $('zoomReadout').textContent = EditorView.zoomLabel();
      });
    });
    [['armorX', 'ax'], ['armorY', 'ay']].forEach(([id, key]) => {
      if (!$(id)) return;
      $(id).addEventListener('input', () => {
        if (fillLock) return;
        car().body[key] = num(id);
        commitSoon();
        EditorView.draw();
      });
    });
    bindArmorRow();
    $('statName').addEventListener('input', () => { car().stats.name = $('statName').value; commitSoon(); renderCars(); });
    ['statPrice', 'statTop', 'statAcc', 'statCrn', 'statHp'].forEach((id) => {
      $(id).addEventListener('input', () => {
        if (fillLock) return;
        const s = car().stats;
        s.price = num('statPrice'); s.top = num('statTop'); s.acc = num('statAcc');
        s.crn = num('statCrn'); s.hp = num('statHp');
        paintBars(s); commitSoon();
      });
    });
    $('statCol').addEventListener('input', () => { car().stats.col = $('statCol').value; commitSoon(); });
    $('statCol2').addEventListener('input', () => { car().stats.col2 = $('statCol2').value; commitSoon(); });
    $('statHov').addEventListener('change', () => { car().stats.hov = $('statHov').checked; commitNow(); });
    bindOwnerRow();
    ['trait0', 'trait1', 'trait2'].forEach((id, i) => {
      $(id).addEventListener('input', () => {
        const t = car().stats.traits || (car().stats.traits = ['', '', '']);
        t[i] = $(id).value; commitSoon();
      });
    });
    [['wheelX', 0], ['wheelY', 1], ['wheelW', 2], ['wheelH', 3], ['wheelAngle', 4], ['wheelScale', 5]].forEach(([id, k]) => {
      const el = $(id);
      el.addEventListener('focus', () => { sizeEdit = true; });
      el.addEventListener('blur', () => { sizeEdit = false; });
      const apply = () => {
        if (fillLock || !car().w[wheelIndex]) return;
        const v = num(id);
        if (!isFinite(v)) return;
        car().w[wheelIndex][k] = v;
        mirrorWheelValue(wheelIndex, k, v);
        commitSoon();
        EditorView.draw();
      };
      el.addEventListener('input', apply);
      el.addEventListener('change', apply);
    });
    $('wheelSteer').addEventListener('change', () => {
      if (!car().w[wheelIndex]) return;
      const on = $('wheelSteer').checked ? 1 : 0;
      car().w[wheelIndex][6] = on;
      mirrorWheelValue(wheelIndex, 6, on);
      mark(); renderWheels();
      commit();
    });
    [['nitroX', 0], ['nitroY', 1], ['nitroLen', 2], ['nitroHalf', 3]].forEach(([id, k]) => {
      $(id).addEventListener('input', () => {
        if (fillLock) return;
        const c = car();
        if (!c.nitro || !c.nitro[nitroIndex]) return;
        c.nitro[nitroIndex][k] = num(id);
        commitSoon();
        EditorView.draw();
      });
    });
  }

  /** Клонирует выбранные колёса; копия — новый слой рядом с исходным. */
  function cloneWheels() {
    const c = car();
    if (!c.w) c.w = [];
    let ids = EditorView.selectedWheels();
    if (!ids.length && c.w[wheelIndex]) ids = [wheelIndex];
    const created = [];
    ids.forEach((i) => {
      const ni = EditorData.cloneWheelLayer(c, i);
      if (ni >= 0) created.push(ni);
    });
    if (!created.length) {
      setText('status', 'Сначала выберите колесо на холсте или в списке.');
      return;
    }
    wheelIndex = created[created.length - 1];
    EditorView.pickWheel(wheelIndex, false);
    created.slice(0, -1).forEach((i) => EditorView.pickWheel(i, true));
    fillFields();
    commitNow();
    setText('status', created.length > 1
      ? 'Новые слои колёс. Каждое двигается отдельно; порядок — стрелками в списке.'
      : 'Новый слой колеса рядом с исходным. Поднимите или опустите относительно кузова.');
  }

  /** Клонирует трубы нитро: каждая — свой слой (над или под кузовом как исходная). */
  function cloneNitro() {
    const c = car();
    if (!c.nitro) c.nitro = [];
    let ids = EditorView.selectedNitro();
    if (!ids.length && c.nitro[nitroIndex]) ids = [nitroIndex];
    const created = [];
    ids.forEach((i) => {
      const ni = EditorData.cloneNitroLayer(c, i);
      if (ni >= 0) created.push(ni);
    });
    if (!created.length) {
      setText('status', 'Сначала выберите трубу нитро на холсте или в списке.');
      return;
    }
    nitroIndex = created[created.length - 1];
    EditorView.pickNitro(nitroIndex, false);
    created.slice(0, -1).forEach((i) => EditorView.pickNitro(i, true));
    fillFields();
    commitNow();
    setText('status', created.length > 1
      ? 'Новые слои нитро. Поднимите трубу над кузовом или опустите под него.'
      : 'Новый слой нитро рядом с исходным — тот же уровень относительно кузова.');
  }

  /** Клонирует то, что в фокусе: трубу нитро или колесо. */
  function cloneSelected() {
    const kind = EditorView.focusKind();
    if (kind === 'nitro') { cloneNitro(); return; }
    if (kind === 'wheel') { cloneWheels(); return; }
    if (EditorView.selectedNitro().length) { cloneNitro(); return; }
    if (EditorView.selectedWheels().length) { cloneWheels(); return; }
    setText('status', 'Выберите колесо или трубу нитро — кузов клонировать не нужно.');
  }

  /** Кнопки панели и файлы. */
  function bindActions() {
    $('saveBtn').onclick = () => saveSettings();
    if ($('fileNoteOk')) $('fileNoteOk').onclick = () => hideFileNote();
    if ($('fileNote')) $('fileNote').addEventListener('click', (e) => {
      if (e.target === $('fileNote')) hideFileNote();
    });
    const loadBackupBtn = $('loadBackupBtn');
    if (loadBackupBtn) {
      loadBackupBtn.onclick = () => {
        EditorData.loadBackupCar(carIndex).then((c) => {
          if (!c) {
            showFileNote(false, 'Бэкап', 'Бэкапа нет',
              'Сначала сохраните настройки — прежняя база уйдёт в car.backup.json.');
            return;
          }
          pack.cars[carIndex] = c;
          wheelIndex = 0;
          nitroIndex = 0;
          EditorView.clearSel();
          EditorView.clearCache();
          fillFields();
          EditorView.fit();
          commitNow();
          showFileNote(true, 'Бэкап', 'Бэкап загружен', 'Слот вернулся к предыдущей базе.');
        }).catch((err) => {
          console.error(err);
          showFileNote(false, 'Бэкап', 'Не удалось загрузить', 'Файл бэкапа не прочитался.');
        });
      };
    }
    $('loadBtn').onclick = () => {
      EditorData.hydrateFromDisk().then(() => {
          pack = EditorData.load();
          resetAllHist();
          selectCar(carIndex);
          showFileNote(true, 'Загрузка', 'Настройки загружены', 'Слот взят с диска и из браузера.');
      }).catch((err) => {
        console.error(err);
        showFileNote(false, 'Загрузка', 'Не удалось загрузить', 'Проверьте editor.bat и файлы в assets/data/cars.');
      });
    };
    $('exportBtn').onclick = () => {
      try {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([JSON.stringify(pack, null, 2)], {type: 'application/json'}));
        a.download = 'rnr-car-editor.json'; a.click(); URL.revokeObjectURL(a.href);
        showFileNote(true, 'Экспорт', 'JSON скачан', 'Файл rnr-car-editor.json ушёл в загрузки.');
      } catch (err) {
        console.error(err);
        showFileNote(false, 'Экспорт', 'Не удалось скачать', 'Браузер не отдал файл.');
      }
    };
    $('jsonFile').onchange = (e) => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const parsed = JSON.parse(r.result);
          if (parsed && (parsed.w || parsed.body) && !parsed.cars) {
            pack.cars[carIndex] = EditorData.mergeCar(carIndex, parsed);
            mark(); selectCar(carIndex); commit();
            showFileNote(true, 'Импорт', 'Машина импортирована', 'Файл записан в текущий слот. Сохраните настройки.');
            return;
          }
          pack = {version: 2, cars: {}};
          Object.keys(parsed.cars || {}).forEach((k) => { pack.cars[k] = EditorData.mergeCar(Number(k), parsed.cars[k]); });
          resetAllHist();
          mark(); selectCar(0);
          showFileNote(true, 'Импорт', 'JSON импортирован', 'Пакет машин загружен. Сохраните настройки.');
        } catch (err) {
          showFileNote(false, 'Импорт', 'Ошибка JSON', 'Файл повреждён или это не пакет лаборатории.');
        }
      };
      r.onerror = () => showFileNote(false, 'Импорт', 'Не удалось прочитать файл', 'Выберите JSON ещё раз.');
      r.readAsText(f);
      e.target.value = '';
    };
    $('bodyFile').onchange = (e) => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => { car().bodyData = r.result; EditorView.clearCache(); commitNow(); };
      r.readAsDataURL(f);
    };
    $('clearBody').onclick = () => { delete car().bodyData; EditorView.clearCache(); commitNow(); };
    if ($('resetBodyBtn')) $('resetBodyBtn').onclick = () => resetInspector();
    if ($('resetWheelsBtn')) $('resetWheelsBtn').onclick = () => resetInspector();
    if ($('resetNitroBtn')) $('resetNitroBtn').onclick = () => resetInspector();
    if ($('resetArmorBtn')) $('resetArmorBtn').onclick = () => resetInspector();
    $('resetBtn').onclick = () => {
      const cur = car();
      EditorData.saveBackup(carIndex, cur);
      EditorData.loadBaseCar(carIndex).then((base) => {
        pack.cars[carIndex] = base || EditorData.factory(carIndex);
        wheelIndex = 0; nitroIndex = 0;
        EditorView.clearSel();
        fillFields();
        EditorView.clearCache();
        EditorView.fit();
        commitNow();
        if (base) {
          showFileNote(true, 'Сброс', 'Вернули базу', 'Текущие правки лежат в бэкапе.');
        } else {
          showFileNote(true, 'Сброс', 'Заводские настройки', 'Сохранённой базы не было. Текущие правки в бэкапе.');
        }
      }).catch((err) => {
        console.error(err);
        showFileNote(false, 'Сброс', 'Не удалось сбросить', 'База не прочиталась.');
      });
    };
    $('gameBtn').onclick = () => goToGame('');
    $('addWheel').onclick = () => {
      wheelIndex = EditorData.appendWheel(car(), [18, 12, 12, 6, 0, 1, 1], wheelIndex);
      fillFields(); commitNow();
    };
    $('cloneWheel').onclick = () => cloneWheels();
    $('delWheel').onclick = () => {
      if (!car().w.length) return;
      car().w.splice(wheelIndex, 1);
      EditorData.reindexStack(car(), 'wheel', wheelIndex);
      wheelIndex = Math.max(0, car().w.length - 1); fillFields(); commitNow();
    };
    $('mirrorWheel').onclick = () => {
      const w = car().w[wheelIndex]; if (!w) return;
      const copy = w.slice(); copy[1] = -copy[1];
      wheelIndex = EditorData.appendWheel(car(), copy, wheelIndex);
      fillFields(); commitNow();
    };
    if ($('copyWheelSize')) $('copyWheelSize').onclick = () => copyWheelSize();
    if ($('pasteWheelSize')) $('pasteWheelSize').onclick = () => pasteWheelSize();
    $('addNitro').onclick = () => {
      nitroIndex = EditorData.appendNitro(car(), [-26, 0, 9, 1.5], nitroIndex);
      EditorView.pickNitro(nitroIndex, false);
      fillFields(); commitNow();
    };
    $('cloneNitro').onclick = () => cloneNitro();
    if ($('copyNitroSize')) $('copyNitroSize').onclick = () => copyNitroSize();
    if ($('pasteNitroSize')) $('pasteNitroSize').onclick = () => pasteNitroSize();
    $('mirrorNitro').onclick = () => {
      const c = car();
      const n = c.nitro && c.nitro[nitroIndex]; if (!n) return;
      const copy = n.slice(); copy[1] = -copy[1];
      nitroIndex = EditorData.appendNitro(c, copy, nitroIndex);
      EditorView.pickNitro(nitroIndex, false);
      fillFields(); commitNow();
    };
    $('delNitro').onclick = () => {
      const c = car();
      if (!c.nitro || !c.nitro.length) return;
      c.nitro.splice(nitroIndex, 1);
      EditorData.reindexStack(c, 'nitro', nitroIndex);
      nitroIndex = Math.max(0, c.nitro.length - 1);
      fillFields(); commitNow();
    };
    const cloneLayerBtn = document.getElementById('cloneLayer') || document.getElementById('cloneLayer');
    if (cloneLayerBtn) cloneLayerBtn.onclick = () => cloneSelected();
    $('addCarBtn').onclick = () => {
      const ids = EditorData.indices(pack);
      const next = Math.max(EditorData.STOCK - 1, ...ids) + 1;
      pack.cars[next] = EditorData.factory(next);
      selectCar(next);
      persist(true);
    };
    $('delCarBtn').onclick = () => {
      if (carIndex < EditorData.STOCK) return;
      const gone = carIndex;
      delete pack.cars[gone];
      delete carHist[String(gone)];
      selectCar(0);
      persist(true);
    };
    $('dupCarBtn').onclick = () => {
      const ids = EditorData.indices(pack);
      const next = Math.max(EditorData.STOCK - 1, ...ids) + 1;
      pack.cars[next] = EditorData.clone(car());
      pack.cars[next].custom = true;
      pack.cars[next].stats.name = (pack.cars[next].stats.name || 'МАШИНА') + ' КОПИЯ';
      pack.cars[next].stats.owner = null;
      pack.cars[next].owner = null;
      selectCar(next);
      persist(true);
    };
    $('snapToggle').onchange = () => {
      const on = $('snapToggle').checked;
      EditorView.setSnap(on);
      saveUiPref({snap: on});
    };
    $('marksToggle').onchange = () => applyMarks($('marksToggle').checked);
    $('wheelMirror').onchange = () => {
      const on = $('wheelMirror').checked;
      EditorView.setMirrorWheels(on);
      saveUiPref({mirror: on});
      if (on) EditorView.syncWheelPair();
      else EditorView.dropWheelPair();
      refreshSel();
      EditorView.draw();
    };
    if ($('armorLink')) $('armorLink').onchange = () => {
      const on = $('armorLink').checked;
      EditorView.setLinkArmor(on);
      saveUiPref({armorLink: on});
    };
    $('playToggle').onchange = () => EditorView.setPlay($('playToggle').checked);
    $('testToggle').onchange = () => EditorView.setTest($('testToggle').checked);
    $('testDriveBtn').onclick = () => goToGame('?lab=1&car=' + carIndex);
    $('yawRange').oninput = () => EditorView.setYaw(Number($('yawRange').value) * Math.PI / 180);
    $('zoomOutBtn').onclick = () => EditorView.zoomBy(0.85);
    $('zoomInBtn').onclick = () => EditorView.zoomBy(1.18);
    $('zoomReadout').onclick = () => EditorView.fit();
    $('fitBtn').onclick = () => EditorView.fit();
    $('undoBtn').onclick = undo;
    $('redoBtn').onclick = redo;
    window.addEventListener('keydown', (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const code = e.code || '';
      const key = (e.key || '').toLowerCase();
      const isZ = code === 'KeyZ' || key === 'z' || key === 'я';
      const isY = code === 'KeyY' || key === 'y' || key === 'н';
      const isD = code === 'KeyD' || key === 'd' || key === 'в';
      const isS = code === 'KeyS' || key === 's' || key === 'ы';
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && isD) return;
      if (isS) { e.preventDefault(); saveSettings(); return; }
      if (isZ && e.shiftKey) { e.preventDefault(); redo(); return; }
      if (isZ) { e.preventDefault(); undo(); return; }
      if (isY) { e.preventDefault(); redo(); return; }
      if (isD) { e.preventDefault(); cloneSelected(); }
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const note = $('fileNote');
        if (note && !note.hidden) { e.preventDefault(); hideFileNote(); return; }
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      const k = e.key;
      if (k === 'h' || k === 'H' || k === 'р' || k === 'Р') {
        e.preventDefault();
        applyMarks(!EditorView.marksOn());
      }
    });
  }

  /** Старт редактора. */
  async function start() {
    try { pack = EditorData.load(); } catch (err) {
      console.error(err);
      pack = {version: 3, cars: {}};
    }
    try {
      for (let i = 0; i < EditorData.STOCK; i++) {
        if (!pack.cars[i] && !pack.cars[String(i)]) pack.cars[i] = EditorData.factory(i);
      }
    } catch (err) { console.error(err); }
    try { bindFields(); } catch (err) { console.error(err); }
    try { bindActions(); } catch (err) { console.error(err); }
    try { bindLayerPanel(); } catch (err) { console.error(err); }
    try {
    EditorView.init({
      canvas: $('stage'),
      getCar: car,
      getIndex: () => carIndex,
      getWheel: () => wheelIndex,
      setWheel: (i) => { wheelIndex = i; },
      getNitro: () => nitroIndex,
      setNitro: (i) => { nitroIndex = i; },
      onChange: (refresh) => {
        mark();
        if (refresh) { fillFields(); commitSoon(); return; }
        fillLock = true;
        const w = car().w[wheelIndex];
        if (w) { $('wheelX').value = w[0].toFixed(2); $('wheelY').value = w[1].toFixed(2); }
        const n = (car().nitro || [])[nitroIndex];
        if (n) { $('nitroX').value = n[0].toFixed(2); $('nitroY').value = n[1].toFixed(2); }
        $('bodyX').value = car().body.x.toFixed(2);
        $('bodyY').value = car().body.y.toFixed(2);
        if ($('armorX')) $('armorX').value = (+car().body.ax || 0).toFixed(2);
        if ($('armorY')) $('armorY').value = (+car().body.ay || 0).toFixed(2);
        fillLock = false;
      },
      onSelect: () => { try { refreshSel(); } catch (err) { console.error(err); } },
      onHover: (p) => {
        $('coordReadout').textContent = 'X ' + p.x.toFixed(1) + ' · Y ' + p.y.toFixed(1);
      },
      onZoom: (label) => { $('zoomReadout').textContent = label; },
      onDragEnd: () => commitNow()
    });
    } catch (err) { console.error(err); }
    try { fillFields(); } catch (err) { console.error(err); try { renderCars(); } catch (e2) { console.error(e2); } }
    try { renderLayers(); } catch (err) { console.error(err); }
    applyUiPref();
    applyMarks(loadMarksPref(), true);
    try {
      await EditorData.hydrateFromDisk();
      pack = EditorData.load();
      if (EditorData.refreshPilots) await EditorData.refreshPilots();
      fillFields();
    } catch (err) { console.error(err); }
    commit(true, {seed: true});
    syncHistoryBtns();
    const warn = $('originWarn');
    if (warn && location.protocol === 'file:') {
      warn.hidden = false;
      warn.textContent = 'Лаборатория открыта как файл. Игра не увидит настройки. Запустите editor.bat — тот же адрес, что у start.bat (порт 8765).';
    }
    const flushSave = () => { flushCommit(); persist(true); };
    window.addEventListener('pagehide', flushSave);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushSave();
    });
    try {
      const q = parseInt(new URLSearchParams(location.search).get('car') || '', 10);
      const saved = loadUiPref().car;
      const pick = !isNaN(q) ? q : saved;
      if (pick != null && EditorData.indices(pack).indexOf(+pick) >= 0) selectCar(+pick);
    } catch (e) {}
  }

  return {start};
})();

(function bootEditor() {
  let once = false;
  const run = () => { if (once) return; once = true; EditorApp.start(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
