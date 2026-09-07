////////////////////////////////////////////////////////
//
// Лаборатория: пак двигателя и звуки ствола / ульты
//
////////////////////////////////////////////////////////
'use strict';

const LabAudio = (() => {
  const ENGINE_DIR = 'assets/sounds/cars/engine/';
  const WEAPON_DIR = 'assets/sounds/weapon/';
  const CLIP_RU = {
    'sound_001.wav': 'Набор',
    'sound_002.wav': 'Полная скорость',
    'sound_003.wav': 'Сброс газа',
    'sound_004.wav': 'Езда',
    'sound_005.wav': 'Стоянка'
  };
  let catalog = {engines: [], weapons: []};
  let player = null;
  let packTimer = 0;
  let painted = '';

  /** Текущая машина из панели. */
  function car() {
    return (typeof EditorApp !== 'undefined' && EditorApp.car) ? EditorApp.car() : null;
  }

  /** Отмечает правку для Ctrl+S. */
  function dirty() {
    if (typeof EditorApp !== 'undefined' && EditorApp.dirty) EditorApp.dirty();
  }

  /** Чистит имя пака, не создавая новый объект. */
  function sanitizePack(raw) {
    if (typeof EditorData !== 'undefined' && EditorData.fileAudio) {
      return EditorData.fileAudio({audio: {engine: raw}}).engine;
    }
    const s = String(raw || '').trim();
    if (!s || s.length > 80 || s.indexOf('..') >= 0 || /[\\/]/.test(s)) return '';
    return s;
  }

  /** Держит те же объекты wep/ult, иначе слушатели пишут в копию и Ctrl+S теряет ствол. */
  function ensureGun(raw) {
    const g = raw && typeof raw === 'object' ? raw : {};
    g.pack = sanitizePack(g.pack);
    g.near = sanitizePack(g.near);
    g.far = sanitizePack(g.far);
    return g;
  }

  /** Нормализует audio на машине, не подменяя ссылки. */
  function ensure() {
    const c = car();
    if (!c) return null;
    if (!c.audio || typeof c.audio !== 'object') c.audio = {};
    c.audio.engine = sanitizePack(c.audio.engine);
    c.audio.wep = ensureGun(c.audio.wep);
    c.audio.ult = ensureGun(c.audio.ult);
    return c.audio;
  }

  /** Живой слот ствола или ульты. */
  function gunSlot(kind) {
    const audio = ensure();
    return audio ? audio[kind] : null;
  }

  /** Глушит превью. */
  function stop() {
    clearTimeout(packTimer);
    packTimer = 0;
    if (player) {
      try { player.pause(); player.removeAttribute('src'); player.load(); } catch (err) {}
      player = null;
    }
  }

  /** Играет один URL. onEnd — следующий клип пака. */
  function playUrl(url, onEnd) {
    stop();
    if (!url) return;
    const a = new Audio();
    player = a;
    a.preload = 'auto';
    a.src = url;
    a.onended = () => { if (player === a && onEnd) onEnd(); };
    a.onerror = () => { if (player === a && onEnd) onEnd(); };
    a.play().catch(() => { if (onEnd) onEnd(); });
  }

  /** Клип двигателя выбранного пака. */
  function engineUrl(packId, file) {
    return ENGINE_DIR + encodeURIComponent(packId).replace(/%20/g, '%20') + '/sound/' + encodeURIComponent(file);
  }

  /** Клип оружия. */
  function weaponUrl(packId, file) {
    return WEAPON_DIR + encodeURIComponent(packId) + '/' + encodeURIComponent(file);
  }

  /** Ближний клип по умолчанию. */
  function defaultNear(files) {
    const prefer = ['shoot.wav', 'cannon_fire.wav', 'swing.wav', 'hit.wav', 'projfire.wav'];
    for (let i = 0; i < prefer.length; i++) {
      if (files.indexOf(prefer[i]) >= 0) return prefer[i];
    }
    return files[0] || '';
  }

  /** Дальний клип по умолчанию. */
  function defaultFar(files) {
    const prefer = ['distant0.wav', 'distant.wav', 'shoot.wav', 'hit.wav'];
    for (let i = 0; i < prefer.length; i++) {
      if (files.indexOf(prefer[i]) >= 0) return prefer[i];
    }
    return files[0] || '';
  }

  /** Папка оружия в каталоге. */
  function weaponPack(id) {
    return catalog.weapons.find((p) => p.id === id) || null;
  }

  /** Слушает пак двигателя клипами по очереди. */
  function listenEnginePack(packId) {
    const pack = catalog.engines.find((p) => p.id === packId);
    if (!pack || !pack.clips.length) return;
    let i = 0;
    const step = () => {
      if (i >= pack.clips.length) return;
      const file = pack.clips[i++];
      playUrl(engineUrl(packId, file), () => {
        packTimer = setTimeout(step, 80);
      });
    };
    step();
  }

  /** Карточки паков двигателя. */
  function renderEngines() {
    const box = document.getElementById('enginePackList');
    const clips = document.getElementById('engineClipRow');
    if (!box) return;
    const audio = ensure();
    const selected = (audio && audio.engine) || '';
    box.innerHTML = '';
    catalog.engines.forEach((pack) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sound-pack' + (pack.id === selected ? ' is-on' : '');
      b.textContent = pack.id.replace(/^\d+\s+/, '');
      b.title = pack.id;
      b.addEventListener('click', () => {
        const a = ensure();
        if (!a) return;
        a.engine = pack.id;
        dirty();
        renderEngines();
      });
      b.addEventListener('dblclick', (e) => {
        e.preventDefault();
        listenEnginePack(pack.id);
      });
      box.appendChild(b);
    });
    if (!catalog.engines.length) {
      const p = document.createElement('p');
      p.className = 'hint';
      p.textContent = 'Паки двигателя не найдены. Нужны папки в assets/sounds/cars/engine.';
      box.appendChild(p);
    }
    if (!clips) return;
    clips.innerHTML = '';
    const pack = catalog.engines.find((p) => p.id === selected);
    (pack ? pack.clips : []).forEach((file) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = CLIP_RU[file.toLowerCase()] || file.replace(/\.wav$/i, '');
      b.addEventListener('click', () => playUrl(engineUrl(selected, file)));
      clips.appendChild(b);
    });
  }

  /** Список файлов в select. */
  function fillFiles(sel, files, value) {
    sel.innerHTML = '';
    files.forEach((f) => {
      const o = document.createElement('option');
      o.value = f;
      o.textContent = f.replace(/\.wav$/i, '');
      sel.appendChild(o);
    });
    if (value && files.indexOf(value) >= 0) sel.value = value;
    else if (files.length) sel.value = files[0];
  }

  /** Имя ствола / ульты из кита. */
  function gunTitle(kind) {
    const idx = (typeof EditorApp !== 'undefined' && EditorApp.index) ? EditorApp.index() : 0;
    const ab = (typeof carAbil === 'function') ? carAbil(idx) : null;
    if (kind === 'wep') return (ab && ab.weapon && ab.weapon.name) || 'СТВОЛ';
    return (ab && ab.ult && ab.ult.name) || 'УЛЬТА';
  }

  /** Один слот оружия: пак, ближний, дальний. */
  function renderGun(host, kind, label) {
    const wrap = document.createElement('div');
    wrap.className = 'sound-gun';
    const head = document.createElement('div');
    head.className = 'sound-gun-head';
    head.innerHTML = '<strong></strong><span></span>';
    head.querySelector('strong').textContent = gunTitle(kind);
    head.querySelector('span').textContent = label;
    wrap.appendChild(head);

    const packSel = document.createElement('select');
    packSel.setAttribute('aria-label', 'Набор ' + label);
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = '— синтез —';
    packSel.appendChild(empty);
    catalog.weapons.forEach((p) => {
      const o = document.createElement('option');
      o.value = p.id;
      o.textContent = p.id;
      packSel.appendChild(o);
    });
    const start = gunSlot(kind);
    packSel.value = (start && start.pack) || '';
    wrap.appendChild(packSel);

    const grid = document.createElement('div');
    grid.className = 'sound-gun-files';
    const nearSel = document.createElement('select');
    const farSel = document.createElement('select');
    nearSel.setAttribute('aria-label', 'От лица игрока');
    farSel.setAttribute('aria-label', 'Дистанционный');

    const nearBtn = document.createElement('button');
    nearBtn.type = 'button';
    nearBtn.textContent = 'Слушать близко';
    const farBtn = document.createElement('button');
    farBtn.type = 'button';
    farBtn.textContent = 'Слушать далеко';

    const filesOf = () => {
      const p = weaponPack(packSel.value);
      return p ? p.files : [];
    };
    const writeFiles = (keep) => {
      const slot = gunSlot(kind);
      if (!slot) return;
      const files = filesOf();
      fillFiles(nearSel, files, keep ? slot.near : defaultNear(files));
      fillFiles(farSel, files, keep ? slot.far : defaultFar(files));
      slot.near = nearSel.value;
      slot.far = farSel.value;
    };
    writeFiles(true);

    packSel.addEventListener('change', () => {
      const slot = gunSlot(kind);
      if (!slot) return;
      slot.pack = packSel.value;
      writeFiles(false);
      dirty();
    });
    nearSel.addEventListener('change', () => {
      const slot = gunSlot(kind);
      if (!slot) return;
      slot.near = nearSel.value;
      dirty();
    });
    farSel.addEventListener('change', () => {
      const slot = gunSlot(kind);
      if (!slot) return;
      slot.far = farSel.value;
      dirty();
    });
    nearBtn.addEventListener('click', () => {
      const slot = gunSlot(kind);
      if (slot && slot.pack && slot.near) playUrl(weaponUrl(slot.pack, slot.near));
    });
    farBtn.addEventListener('click', () => {
      const slot = gunSlot(kind);
      if (slot && slot.pack && slot.far) playUrl(weaponUrl(slot.pack, slot.far));
    });

    const nearBox = document.createElement('div');
    nearBox.className = 'sound-file';
    nearBox.innerHTML = '<span>От лица игрока</span>';
    nearBox.append(nearSel, nearBtn);
    const farBox = document.createElement('div');
    farBox.className = 'sound-file';
    farBox.innerHTML = '<span>Дистанционный</span>';
    farBox.append(farSel, farBtn);
    grid.append(nearBox, farBox);
    wrap.appendChild(grid);
    host.appendChild(wrap);
  }

  /** Ствол и ульта текущей машины. */
  function renderWeapons() {
    const host = document.getElementById('weaponSoundSlots');
    if (!host) return;
    host.innerHTML = '';
    renderGun(host, 'wep', 'ствол');
    renderGun(host, 'ult', 'ульта');
  }

  /** Перерисовка при смене машины. */
  function sync() {
    const c = car();
    if (!c) return;
    ensure();
    const key = String((typeof EditorApp !== 'undefined' && EditorApp.index) ? EditorApp.index() : 0)
      + ':' + JSON.stringify(c.audio);
    if (key === painted) return;
    painted = key;
    renderEngines();
    renderWeapons();
  }

  /** Каталог: протокол лаборатории или JSON из zip, если exe старый. */
  async function loadCatalog() {
    catalog = {engines: [], weapons: []};
    const urls = ['/__lab-sounds', 'assets/sounds/lab-catalog.json'];
    for (let i = 0; i < urls.length; i++) {
      try {
        const res = await fetch(urls[i], {cache: 'no-store'});
        if (!res.ok) continue;
        const data = await res.json();
        if (data && Array.isArray(data.engines) && data.engines.length) {
          catalog = data;
          break;
        }
      } catch (err) {}
    }
    if (!Array.isArray(catalog.engines)) catalog.engines = [];
    if (!Array.isArray(catalog.weapons)) catalog.weapons = [];
    painted = '';
    sync();
  }

  /** Кнопки пака двигателя. */
  function bind() {
    const listen = document.getElementById('enginePackListen');
    const stopBtn = document.getElementById('enginePackStop');
    const clear = document.getElementById('enginePackClear');
    if (listen) listen.addEventListener('click', () => {
      const a = ensure();
      if (a && a.engine) listenEnginePack(a.engine);
    });
    if (stopBtn) stopBtn.addEventListener('click', stop);
    if (clear) clear.addEventListener('click', () => {
      const a = ensure();
      if (!a) return;
      a.engine = '';
      stop();
      dirty();
      painted = '';
      sync();
    });
  }

  /** Старт после панели машин. */
  function start() {
    bind();
    loadCatalog();
  }

  return {start, sync, stop};
})();

(function bootLabAudio() {
  const run = () => LabAudio.start();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
