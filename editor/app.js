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
  let history = [];
  let histAt = -1;
  let restoring = false;
  let inputTimer = null;
  let persistTimer = null;

  /** Текущая машина, при необходимости создаётся из завода. */
  function car() {
    if (!pack.cars[carIndex]) pack.cars[carIndex] = EditorData.factory(carIndex);
    return pack.cars[carIndex];
  }

  /** Снимок пакета и выбранных слотов. */
  function snapshot() {
    return {pack: EditorData.clone(pack), carIndex: carIndex, wheelIndex: wheelIndex, nitroIndex: nitroIndex};
  }

  /** Пишет шаг в историю, если пакет реально изменился. */
  function commit() {
    if (restoring) return;
    const snap = snapshot();
    const last = history[histAt];
    if (last && JSON.stringify(last.pack) === JSON.stringify(snap.pack)) return;
    history = history.slice(0, histAt + 1);
    history.push(snap);
    if (history.length > 80) {
      history.shift();
      histAt = history.length - 1;
    } else {
      histAt = history.length - 1;
    }
    syncHistoryBtns();
    persistSoon();
  }

  /** Откладывает шаг, чтобы набор цифр или стрелок стал одним действием. */
  function commitSoon() {
    mark();
    clearTimeout(inputTimer);
    inputTimer = setTimeout(() => { inputTimer = null; commit(); }, 380);
  }

  /** Сразу фиксирует шаг. */
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

  /** Включает кнопки отмены и повтора. */
  function syncHistoryBtns() {
    const u = $('undoBtn');
    const r = $('redoBtn');
    if (u) u.disabled = histAt <= 0;
    if (r) r.disabled = histAt < 0 || histAt >= history.length - 1;
  }

  const MARKS_KEY = 'rnr.carEditor.marks';

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

  /** Откатывает пакет к снимку. */
  function restore(snap) {
    restoring = true;
    pack = EditorData.clone(snap.pack);
    carIndex = snap.carIndex;
    wheelIndex = snap.wheelIndex;
    nitroIndex = snap.nitroIndex || 0;
    if (!pack.cars[carIndex]) carIndex = EditorData.indices(pack)[0] || 0;
    EditorView.clearCache();
    fillFields();
    EditorView.draw();
    restoring = false;
    persist(true);
    syncHistoryBtns();
  }

  /** Шаг назад. */
  function undo() {
    flushCommit();
    if (histAt <= 0) return;
    histAt -= 1;
    restore(history[histAt]);
  }

  /** Шаг вперёд. */
  function redo() {
    flushCommit();
    if (histAt >= history.length - 1) return;
    histAt += 1;
    restore(history[histAt]);
  }

  /** Пишет текст в элемент, если он есть. */
  function setText(id, t) {
    const el = $(id);
    if (el) el.textContent = t;
  }

  /** Помечает несохранённые правки. */
  function mark() {
    dirty = true;
    setText('saveState', 'Есть несохранённые изменения');
  }

  /** Сохраняет пакет в браузер и в папку машины. */
  function persist(silent) {
    clearTimeout(persistTimer);
    persistTimer = null;
    try {
      const c = pack.cars[carIndex];
      if (c) {
        EditorData.ensureStack(c);
        EditorData.syncVisibleFromStack(c);
        c.rev = Date.now();
      }
      EditorData.save(pack);
      dirty = false;
      setText('saveState', 'Сохранено в браузере');
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
      if (i === nitroIndex || EditorView.hasNitro(i)) b.classList.add('active');
      b.onclick = (e) => {
        EditorView.pickNitro(i, e.ctrlKey || e.metaKey);
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
      if (i === wheelIndex || EditorView.hasWheel(i)) b.classList.add('active');
      b.onclick = (e) => {
        EditorView.pickWheel(i, e.ctrlKey || e.metaKey);
        wheelIndex = i;
        fillFields();
        EditorView.draw();
      };
      box.appendChild(b);
    });
  }

  /** Один раз вешает клики списка слоёв: список пересобирается, обработчики нет. */
  function bindLayerPanel() {
    const box = $('layers');
    if (!box || box.dataset.bound === '1') return;
    box.dataset.bound = '1';
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
      const mv = e.target.closest('[data-dir]');
      if (mv) {
        e.preventDefault();
        e.stopPropagation();
        moveLayer(+mv.getAttribute('data-i'), +mv.getAttribute('data-dir'));
        return;
      }
      if (e.target.closest('input')) return;
      const row = e.target.closest('[data-layer-row]');
      if (!row) return;
      const id = row.getAttribute('data-layer-row');
      EditorView.pickLayer(id, e.ctrlKey || e.metaKey);
      const c = car();
      const L = (c.stack || []).find((x) => x.id === id);
      setText('status', 'Слой «' + EditorData.layerTitle(L, c) + '». Тащите на холсте. ↑ — наверх, ↓ — вниз. Клон — новый слой рядом.');
      renderLayers();
      EditorView.draw();
    });
  }

  /** Слои как в Figma: сверху списка — поверх на холсте. Клон = отдельная строка. */
  function renderLayers() {
    const c = car();
    EditorData.ensureStack(c);
    const box = $('layers');
    if (!box) return;
    const bodyAt = c.stack.findIndex((L) => L.type === 'body');
    box.innerHTML = c.stack.slice().reverse().map((L) => {
      const i = c.stack.indexOf(L);
      const under = bodyAt >= 0 && i < bodyAt && (L.type === 'wheel' || L.type === 'nitro');
      const over = bodyAt >= 0 && i > bodyAt && (L.type === 'wheel' || L.type === 'nitro');
      const hint = under ? ' <i class="hint">под кузовом</i>' : (over ? ' <i class="hint">над кузовом</i>' : '');
      const hidden = L.on === false;
      const checked = hidden ? '' : ' checked';
      const on = EditorView.hasLayer(L.id) ? ' is-on' : '';
      const off = hidden ? ' is-off' : '';
      const ru = EditorData.layerTitle(L, c);
      return '<div class="layer-row' + on + off + '" data-layer-row="' + L.id + '">' +
        '<input class="check" type="checkbox" data-stack-id="' + L.id + '" aria-label="' + ru + '"' + checked + '>' +
        '<span>' + ru + hint + '</span>' +
        '<button type="button" data-i="' + i + '" data-dir="-1" title="Ниже">↓</button>' +
        '<button type="button" data-i="' + i + '" data-dir="1" title="Выше">↑</button></div>';
    }).join('');
  }

  /** Переставляет слой стека. */
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
      $('armor').value = String(b.armor || 0);
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
      paintWheelFields();
      paintNitroFields();
    } catch (err) {
      console.error(err);
    }
    fillLock = false;
    renderCars();
    renderWheels();
    renderNitro();
    renderLayers();
  }

  /** Полоски характеристик. */
  function paintBars(s) {
    $('barTop').style.width = Math.round((s.top - 0.7) / 0.8 * 100) + '%';
    $('barAcc').style.width = Math.round((s.acc - 0.7) / 0.8 * 100) + '%';
    $('barCrn').style.width = Math.round((s.crn - 0.7) / 0.8 * 100) + '%';
    $('barHp').style.width = Math.round((s.hp - 60) / 160 * 100) + '%';
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

  /** Колесо или нитро под курсором становятся текущими, поля сразу их показывают. */
  function followHover(hoverW, hoverN) {
    if (fieldTyping()) return;
    const c = car();
    if (hoverW >= 0 && c.w && c.w[hoverW]) {
      if (wheelIndex === hoverW) return;
      wheelIndex = hoverW;
      renderWheels();
      paintWheelFields();
      return;
    }
    if (hoverN >= 0 && c.nitro && c.nitro[hoverN]) {
      if (nitroIndex === hoverN) return;
      nitroIndex = hoverN;
      renderNitro();
      paintNitroFields();
    }
  }

  /** Подсветка списков без перезаписи всей панели. */
  function refreshSel() {
    renderWheels();
    renderNitro();
    renderLayers();
    paintWheelFields();
    paintNitroFields();
  }

  /** Выбор слота. */
  function selectCar(i) {
    carIndex = i;
    wheelIndex = 0;
    nitroIndex = 0;
    EditorView.clearSel();
    car();
    fillFields();
    EditorView.fit();
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
        fn(num(id));
        commitSoon();
        if (id === 'bodyScale') $('zoomReadout').textContent = EditorView.zoomLabel();
      });
    });
    $('armor').addEventListener('change', () => {
      const c = car();
      c.body.armor = Number($('armor').value) || 0;
      c.visible = c.visible || {};
      c.visible.armor = true;
      EditorView.clearCache();
      renderLayers();
      commitNow();
      EditorView.draw();
    });
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
    $('saveBtn').onclick = () => { flushCommit(); persist(); };
    $('loadBtn').onclick = () => {
      EditorData.hydrateFromDisk().then(() => {
        pack = EditorData.load();
        selectCar(carIndex);
        commitNow();
        $('status').textContent = 'Загружено с диска и из браузера.';
      });
    };
    $('exportBtn').onclick = () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(pack, null, 2)], {type: 'application/json'}));
      a.download = 'rnr-car-editor.json'; a.click(); URL.revokeObjectURL(a.href);
    };
    $('jsonFile').onchange = (e) => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const parsed = JSON.parse(r.result);
          pack = {version: 2, cars: {}};
          Object.keys(parsed.cars || {}).forEach((k) => { pack.cars[k] = EditorData.mergeCar(Number(k), parsed.cars[k]); });
          mark(); selectCar(0); commit(); $('status').textContent = 'JSON импортирован. Сохраните настройки.';
        } catch (err) { $('status').textContent = 'Ошибка JSON.'; }
      };
      r.readAsText(f);
    };
    $('bodyFile').onchange = (e) => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => { car().bodyData = r.result; EditorView.clearCache(); commitNow(); };
      r.readAsDataURL(f);
    };
    $('clearBody').onclick = () => { delete car().bodyData; EditorView.clearCache(); commitNow(); };
    $('resetBtn').onclick = () => {
      pack.cars[carIndex] = EditorData.factory(carIndex);
      wheelIndex = 0; nitroIndex = 0; fillFields(); EditorView.clearCache(); commitNow();
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
    $('addNitro').onclick = () => {
      nitroIndex = EditorData.appendNitro(car(), [-26, 0, 9, 1.5], nitroIndex);
      EditorView.pickNitro(nitroIndex, false);
      fillFields(); commitNow();
    };
    $('cloneNitro').onclick = () => cloneNitro();
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
      selectCar(next); commitNow();
    };
    $('delCarBtn').onclick = () => {
      if (carIndex < EditorData.STOCK) return;
      delete pack.cars[carIndex];
      selectCar(0); commitNow();
    };
    $('dupCarBtn').onclick = () => {
      const ids = EditorData.indices(pack);
      const next = Math.max(EditorData.STOCK - 1, ...ids) + 1;
      pack.cars[next] = EditorData.clone(car());
      pack.cars[next].custom = true;
      pack.cars[next].stats.name = (pack.cars[next].stats.name || 'МАШИНА') + ' КОПИЯ';
      selectCar(next); commitNow();
    };
    $('snapToggle').onchange = () => EditorView.setSnap($('snapToggle').checked);
    $('marksToggle').onchange = () => applyMarks($('marksToggle').checked);
    $('wheelMirror').onchange = () => EditorView.setMirrorWheels($('wheelMirror').checked);
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
      const key = (e.key || '').toLowerCase();
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && key === 'd') return;
      if (key === 'z' && e.shiftKey) { e.preventDefault(); redo(); return; }
      if (key === 'z') { e.preventDefault(); undo(); return; }
      if (key === 'y') { e.preventDefault(); redo(); return; }
      if (key === 'd') { e.preventDefault(); cloneSelected(); }
    });
    window.addEventListener('keydown', (e) => {
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
    try { await EditorData.hydrateFromDisk(); } catch (err) { console.error(err); }
    pack = EditorData.load();
    try { bindFields(); } catch (err) { console.error(err); }
    try { bindActions(); } catch (err) { console.error(err); }
    try { bindLayerPanel(); } catch (err) { console.error(err); }
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
        fillLock = false;
      },
      onSelect: () => { try { refreshSel(); } catch (err) { console.error(err); } },
      onHover: (p, hoverW, hoverN) => {
        $('coordReadout').textContent = 'X ' + p.x.toFixed(1) + ' · Y ' + p.y.toFixed(1);
        followHover(hoverW, hoverN);
      },
      onZoom: (label) => { $('zoomReadout').textContent = label; },
      onDragEnd: () => commitNow()
    });
    fillFields();
    applyMarks(loadMarksPref(), true);
    commit();
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
      const n = parseInt(new URLSearchParams(location.search).get('car') || '', 10);
      if (!isNaN(n) && EditorData.indices(pack).indexOf(n) >= 0) selectCar(n);
    } catch (e) {}
  }

  return {start};
})();

window.addEventListener('load', () => EditorApp.start());
