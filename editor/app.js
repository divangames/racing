////////////////////////////////////////////////////////
// Панель лаборатории: слоты, поля, сохранение и связь с игрой
////////////////////////////////////////////////////////
'use strict';

const EditorApp = (() => {
  const $ = (id) => document.getElementById(id);
  let pack = EditorData.load();
  let carIndex = 0;
  let wheelIndex = 0;
  let nitroIndex = 0;
  let dirty = false;
  let fillLock = false;
  let history = [];
  let histAt = -1;
  let restoring = false;
  let inputTimer = null;

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
    $('undoBtn').disabled = histAt <= 0;
    $('redoBtn').disabled = histAt < 0 || histAt >= history.length - 1;
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
    mark();
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

  /** Сохраняет пакет в браузер. */
  function persist() {
    try {
      EditorData.save(pack);
      dirty = false;
      setText('saveState', 'Сохранено в браузере');
      setText('status', 'Игра на этом адресе подхватит колёса, нитро, броню и характеристики.');
    } catch (err) {
      console.error(err);
      setText('status', 'Не удалось сохранить в браузер.');
    }
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
      const name = inp.getAttribute('data-layer');
      if (!name) return;
      const c = car();
      c.visible = c.visible || {};
      c.visible[name] = inp.checked;
      mark();
      persist();
      EditorView.draw();
      const ru = EditorData.LAYER_RU[name] || name;
      setText('status', inp.checked ? 'Слой «' + ru + '» включён.' : 'Слой «' + ru + '» скрыт.');
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
      const name = row.getAttribute('data-layer-row');
      EditorView.pickLayer(name, e.ctrlKey || e.metaKey);
      const ru = EditorData.LAYER_RU[name] || name;
      setText('status', 'Слой «' + ru + '». Тащите на холсте. ↑ — наверх, ↓ — вниз.');
      renderLayers();
      EditorView.draw();
    });
  }

  /** Слои: сверху вниз, верхний рисуется поверх. */
  function renderLayers() {
    const c = car();
    if (!Array.isArray(c.layers) || !c.layers.length) c.layers = EditorData.LAYERS.slice();
    c.visible = c.visible || {};
    EditorData.LAYERS.forEach((n) => { if (c.visible[n] == null) c.visible[n] = true; });
    const box = $('layers');
    if (!box) return;
    const covers = ['body', 'armor'];
    box.innerHTML = c.layers.slice().reverse().map((name) => {
      const i = c.layers.indexOf(name);
      const buried = (name === 'wheels' || name === 'nitro') &&
        c.layers.slice(i + 1).some((n) => covers.indexOf(n) >= 0);
      const ru = EditorData.LAYER_RU[name] || name;
      const hint = buried && c.visible[name] !== false ? ' <i class="hint">под кузовом</i>' : '';
      const checked = c.visible[name] === false ? '' : ' checked';
      const on = EditorView.hasLayer(name) ? ' is-on' : '';
      return '<div class="layer-row' + on + '" data-layer-row="' + name + '">' +
        '<input class="check" type="checkbox" data-layer="' + name + '" aria-label="' + ru + '"' + checked + '>' +
        '<span>' + ru + hint + '</span>' +
        '<button type="button" data-i="' + i + '" data-dir="-1" title="Ниже">↓</button>' +
        '<button type="button" data-i="' + i + '" data-dir="1" title="Выше">↑</button></div>';
    }).join('');
  }

  /** Переставляет слой. */
  function moveLayer(i, d) {
    const c = car();
    const n = i + d;
    if (n < 0 || n >= c.layers.length) return;
    const t = c.layers[i];
    c.layers[i] = c.layers[n];
    c.layers[n] = t;
    mark();
    renderLayers();
    commit();
    persist();
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
      const w = c.w[wheelIndex] || [0, 0, 12, 8, 0, 1, 0];
      $('wheelX').value = w[0].toFixed(2);
      $('wheelY').value = w[1].toFixed(2);
      $('wheelW').value = w[2].toFixed(2);
      $('wheelH').value = w[3].toFixed(2);
      $('wheelAngle').value = w[4].toFixed(2);
      $('wheelScale').value = w[5].toFixed(2);
      $('wheelSteer').checked = !!w[6];
      const n = (c.nitro || [])[nitroIndex] || [-26, 0, 9, 1.5];
      $('nitroX').value = n[0].toFixed(2);
      $('nitroY').value = n[1].toFixed(2);
      $('nitroLen').value = n[2].toFixed(2);
      $('nitroHalf').value = n[3].toFixed(2);
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

  /** Число из поля. */
  function num(id) { return Number($(id).value) || 0; }

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
      $(id).addEventListener('input', () => {
        if (fillLock || !car().w[wheelIndex]) return;
        car().w[wheelIndex][k] = num(id); commitSoon();
      });
    });
    $('wheelSteer').addEventListener('change', () => {
      if (!car().w[wheelIndex]) return;
      car().w[wheelIndex][6] = $('wheelSteer').checked ? 1 : 0;
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

  /** Клонирует выбранные или текущее колесо. */
  function cloneWheels() {
    const c = car();
    const ids = EditorView.hasLayer('wheels')
      ? (c.w || []).map((_, i) => i)
      : (EditorView.selectedWheels().length ? EditorView.selectedWheels() : [wheelIndex]);
    ids.forEach((i) => {
      const w = c.w[i];
      if (!w) return;
      const copy = w.slice();
      copy[0] += 2;
      copy[1] += 2;
      c.w.push(EditorData.normWheel(copy));
    });
    wheelIndex = c.w.length - 1;
    EditorView.pickWheel(wheelIndex, false);
    fillFields();
    commitNow();
  }

  /** Клонирует выбранные или текущую трубу нитро. */
  function cloneNitro() {
    const c = car();
    if (!c.nitro) c.nitro = [];
    const ids = EditorView.hasLayer('nitro')
      ? c.nitro.map((_, i) => i)
      : (EditorView.selectedNitro().length ? EditorView.selectedNitro() : [nitroIndex]);
    ids.forEach((i) => {
      const n = c.nitro[i];
      if (!n) return;
      const copy = n.slice();
      copy[0] += 2;
      copy[1] += 2;
      c.nitro.push(EditorData.normJet(copy));
    });
    nitroIndex = c.nitro.length - 1;
    EditorView.pickNitro(nitroIndex, false);
    fillFields();
    commitNow();
  }

  /** Клонирует выбранный слой: колёса и/или нитро. */
  function cloneSelected() {
    const kind = EditorView.focusKind();
    const wheels = EditorView.hasLayer('wheels') || kind === 'wheel';
    const nitro = EditorView.hasLayer('nitro') || kind === 'nitro';
    if (!wheels && !nitro) {
      $('status').textContent = 'Кузов и броню нельзя клонировать — выберите колёса или нитро.';
      return;
    }
    if (wheels) cloneWheels();
    if (nitro) cloneNitro();
  }

  /** Кнопки панели и файлы. */
  function bindActions() {
    $('saveBtn').onclick = () => { flushCommit(); persist(); };
    $('loadBtn').onclick = () => { pack = EditorData.load(); selectCar(carIndex); commitNow(); $('status').textContent = 'Загружено из браузера.'; };
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
    $('gameBtn').onclick = () => { location.href = 'rnr.html'; };
    $('addWheel').onclick = () => {
      car().w.push(EditorData.normWheel([18, 12, 12, 6, 0, 1, 1]));
      wheelIndex = car().w.length - 1; fillFields(); commitNow();
    };
    $('cloneWheel').onclick = () => cloneWheels();
    $('delWheel').onclick = () => {
      if (!car().w.length) return;
      car().w.splice(wheelIndex, 1);
      wheelIndex = Math.max(0, car().w.length - 1); fillFields(); commitNow();
    };
    $('mirrorWheel').onclick = () => {
      const w = car().w[wheelIndex]; if (!w) return;
      const copy = w.slice(); copy[1] = -copy[1];
      car().w.push(copy); wheelIndex = car().w.length - 1; fillFields(); commitNow();
    };
    $('addNitro').onclick = () => {
      const c = car();
      if (!c.nitro) c.nitro = [];
      c.nitro.push(EditorData.normJet([-26, 0, 9, 1.5]));
      nitroIndex = c.nitro.length - 1;
      EditorView.pickNitro(nitroIndex, false);
      fillFields(); commitNow();
    };
    $('cloneNitro').onclick = () => cloneNitro();
    $('mirrorNitro').onclick = () => {
      const c = car();
      const n = c.nitro && c.nitro[nitroIndex]; if (!n) return;
      const copy = n.slice(); copy[1] = -copy[1];
      c.nitro.push(copy); nitroIndex = c.nitro.length - 1;
      EditorView.pickNitro(nitroIndex, false);
      fillFields(); commitNow();
    };
    $('delNitro').onclick = () => {
      const c = car();
      if (!c.nitro || !c.nitro.length) return;
      c.nitro.splice(nitroIndex, 1);
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
    $('playToggle').onchange = () => EditorView.setPlay($('playToggle').checked);
    $('testToggle').onchange = () => EditorView.setTest($('testToggle').checked);
    $('testDriveBtn').onclick = () => {
      EditorData.save(pack);
      location.href = 'rnr.html?lab=1&car=' + carIndex;
    };
    $('yawRange').oninput = () => EditorView.setYaw(Number($('yawRange').value) * Math.PI / 180);
    $('zoomOutBtn').onclick = () => EditorView.zoomBy(0.85);
    $('zoomInBtn').onclick = () => EditorView.zoomBy(1.18);
    $('zoomReadout').onclick = () => EditorView.fit();
    $('fitBtn').onclick = () => EditorView.fit();
    $('undoBtn').onclick = undo;
    $('redoBtn').onclick = redo;
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      if (!(e.ctrlKey || e.metaKey)) return;
      if (key === 'z' && e.shiftKey) { e.preventDefault(); redo(); return; }
      if (key === 'z') { e.preventDefault(); undo(); return; }
      if (key === 'y') { e.preventDefault(); redo(); }
    });
  }

  /** Старт редактора. */
  function start() {
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
      onSelect: () => { try { fillFields(); } catch (err) { console.error(err); renderLayers(); } },
      onHover: (p) => { $('coordReadout').textContent = 'X ' + p.x.toFixed(1) + ' · Y ' + p.y.toFixed(1); },
      onZoom: (label) => { $('zoomReadout').textContent = label; },
      onDragEnd: () => commitNow()
    });
    fillFields();
    commit();
    syncHistoryBtns();
    try {
      const n = parseInt(new URLSearchParams(location.search).get('car') || '', 10);
      if (!isNaN(n) && EditorData.indices(pack).indexOf(n) >= 0) selectCar(n);
    } catch (e) {}
  }

  return {start};
})();

window.addEventListener('load', () => EditorApp.start());
