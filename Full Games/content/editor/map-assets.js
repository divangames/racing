////////////////////////////////////////////////////////
//
// Браузер контента: паки, итемы, сетка превью
//
////////////////////////////////////////////////////////
'use strict';

window.MapAssets = (() => {
  let $, getDoc, setToolUi, packId = '', stampId = '', itemId = 'money', layerFilter = 'all', query = '';
  const ITEM_COL = {money: '#ffd23f', wrench: '#58ff6b', wep: '#ff6b4a', ult: '#b478ff', nit: '#ff9d2e', shield: '#35e0ff', bolt: '#7df9ff'};
  const ITEM_MARK = {money: '$', wrench: '+', wep: 'Z', ult: '*', nit: 'N', shield: 'O', bolt: '!'};

  ////////////////////////////////////////////////////////
  //
  // Каталог
  //
  ////////////////////////////////////////////////////////

  /** Рабочий пак для записи. */
  function writePack() {
    if (packId && packId !== 'stock' && packId !== 'items') return packId;
    const hit = (RnRObjects.packs || []).find((p) => p.id !== 'stock');
    return (hit && hit.id) || 'world';
  }

  /** Объекты выбранной папки. */
  function listed() {
    const packs = RnRObjects.packs || [];
    const src = packId ? packs.filter((p) => p.id === packId) : packs;
    const q = query.trim().toLowerCase();
    const out = [];
    src.forEach((p) => {
      (p.objects || []).forEach((o) => {
        if (layerFilter !== 'all' && o.layer !== layerFilter) return;
        if (q && (o.name + ' ' + o.id).toLowerCase().indexOf(q) < 0) return;
        out.push(o);
      });
    });
    return out;
  }

  /** Пикапы. */
  function listedItems() {
    const q = query.trim().toLowerCase();
    return (RnRTracks.ITEMS || []).filter((it) => !q || (it.name + ' ' + it.id).toLowerCase().indexOf(q) >= 0);
  }

  /** Штамп объекта. */
  function current() {
    const packs = RnRObjects.packs || [];
    for (let i = 0; i < packs.length; i++) {
      const def = (packs[i].objects || []).find((o) => o.id === stampId);
      if (def) return def;
    }
    return listed()[0] || null;
  }

  ////////////////////////////////////////////////////////
  //
  // Дерево и сетка
  //
  ////////////////////////////////////////////////////////

  /** Папки слева. */
  function fillTree() {
    const box = $('assetTree');
    if (!box) return;
    box.innerHTML = '';
    const items = document.createElement('button');
    items.type = 'button';
    items.className = 'cb-folder' + (packId === 'items' ? ' is-on' : '');
    items.textContent = 'Итемы';
    items.onclick = () => { packId = 'items'; paint(); };
    box.appendChild(items);
    (RnRObjects.packs || []).forEach((p) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cb-folder' + (p.id === packId ? ' is-on' : '');
      b.textContent = p.name;
      b.onclick = () => { packId = p.id; paint(); };
      box.appendChild(b);
    });
    const all = $('assetTreeAll');
    if (all) all.classList.toggle('is-on', !packId);
  }

  /** Хлебные крошки. */
  function fillCrumbs() {
    const box = $('assetCrumbs');
    if (!box) return;
    box.innerHTML = '';
    const pack = (RnRObjects.packs || []).find((p) => p.id === packId);
    const bits = [{id: '', name: 'Все'}];
    if (packId === 'items') bits.push({id: 'items', name: 'Итемы'});
    else if (pack) bits.push({id: pack.id, name: pack.name});
    bits.forEach((bit, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cb-crumb' + (i === bits.length - 1 ? ' is-on' : '');
      b.textContent = bit.name;
      b.onclick = () => { packId = bit.id; paint(); };
      box.appendChild(b);
      if (i < bits.length - 1) {
        const s = document.createElement('span');
        s.textContent = '›';
        box.appendChild(s);
      }
    });
  }

  /** Карточка объекта. */
  function tile(o) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cb-tile' + (o.id === stampId ? ' is-on' : '');
    b.title = o.name + ' · двойной клик — редактор';
    b.innerHTML = '<div class="cb-thumb"><img alt="" src="' + o.src + '"></div><span>' + o.name + '</span>';
    b.onclick = () => {
      stampId = o.id;
      MapView.setTool('asset');
      setToolUi('asset');
      fillGrid();
    };
    b.ondblclick = (e) => {
      e.preventDefault();
      stampId = o.id;
      fillGrid();
      MapAssetEdit.open(o, {save: saveDef, remove: removeDef, reload: paint});
    };
    return b;
  }

  /** Карточка пикапа. */
  function itemTile(it) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cb-tile' + (it.id === itemId ? ' is-on' : '');
    b.title = it.name;
    const col = ITEM_COL[it.id] || '#9a9a9a';
    const mark = ITEM_MARK[it.id] || '?';
    b.innerHTML = '<div class="cb-thumb cb-thumb-item" style="--item:' + col + '"><span class="cb-item-mark">' + mark + '</span></div><span>' + it.name + '</span>';
    b.onclick = () => {
      itemId = it.id;
      MapView.setItem(it.id);
      MapView.setTool('item');
      setToolUi('item');
      fillGrid();
    };
    return b;
  }

  /** Сетка. */
  function fillGrid() {
    const box = $('assetDockRow');
    if (!box) return;
    box.innerHTML = '';
    const chips = document.querySelector('.cb-chips');
    const imp = $('assetImportBtn');
    if (packId === 'items') {
      if (chips) chips.hidden = true;
      if (imp) imp.hidden = true;
      const rows = listedItems();
      rows.forEach((it) => box.appendChild(itemTile(it)));
      if ($('assetCount')) $('assetCount').textContent = rows.length + ' шт.';
      return;
    }
    if (chips) chips.hidden = false;
    if (imp) imp.hidden = false;
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'cb-tile cb-tile-add';
    add.title = 'Загрузить PNG / WebP / GIF';
    add.innerHTML = '<div class="cb-thumb"><span class="cb-plus">+</span></div><span>Импорт</span>';
    add.onclick = () => { if ($('assetFile')) $('assetFile').click(); };
    box.appendChild(add);
    const rows = listed();
    rows.forEach((o) => box.appendChild(tile(o)));
    if ($('assetCount')) $('assetCount').textContent = rows.length + ' шт.';
  }

  /** Перерисовать. */
  function paint() {
    fillTree();
    fillCrumbs();
    fillGrid();
  }

  ////////////////////////////////////////////////////////
  //
  // Запись
  //
  ////////////////////////////////////////////////////////

  /** Импорт картинки. */
  async function importFile(file) {
    const ext = (file.name.split('.').pop() || 'webp').toLowerCase().replace('jpeg', 'jpg');
    const id = (file.name.replace(/\.[^.]+$/, '') || 'obj').toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 40);
    const data = await new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });
    const im = await new Promise((res) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => res(img);
      img.src = data;
    });
    const w = im.naturalWidth || 128, h = im.naturalHeight || 128;
    const dest = writePack();
    const r = await fetch('/__save-oblab', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        pack: dest, id, name: file.name.replace(/\.[^.]+$/, ''), ext, data, w, h, lockRatio: true, layer: 'under',
        collision: {solid: false, poly: [], bodies: []}
      })
    });
    if (!r.ok) return {ok: false};
    packId = dest;
    stampId = id;
    await RnRObjects.list();
    paint();
    return {ok: true};
  }

  /** Запись .oblab. */
  async function saveDef(def) {
    const dest = def.pack === 'stock' ? writePack() : def.pack;
    if (def.layer === 'under') def.collision.solid = false;
    const r = await fetch('/__save-oblab', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        pack: dest, id: def.id, name: def.name, src: def.src.indexOf('assets/') === 0 ? def.src : def.file,
        w: def.w, h: def.h, lockRatio: def.lockRatio, layer: def.layer, collision: def.collision
      })
    });
    if (!r.ok) throw new Error('save');
    packId = dest;
    await RnRObjects.list();
    paint();
  }

  /** Удаление .oblab. */
  async function removeDef(def) {
    if (!def || def.pack === 'stock') return;
    const r = await fetch('/__save-oblab', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({pack: def.pack, id: def.id, kind: 'delete'})
    });
    if (!r.ok) throw new Error('del');
    stampId = '';
    await RnRObjects.list();
    paint();
  }

  /** Новый пак. */
  async function createPack() {
    const raw = prompt('Id пака (латиница, цифры, _)', 'props');
    if (!raw) return;
    const id = raw.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const r = await fetch('/__save-pack', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({id, name: id.toUpperCase()})
    });
    if (!r.ok) return;
    packId = id;
    await RnRObjects.list();
    paint();
  }

  ////////////////////////////////////////////////////////
  //
  // Показ
  //
  ////////////////////////////////////////////////////////

  /** Браузер на вкладке карты. */
  function setOpen(on) {
    const dock = $('assetDock');
    if (dock) dock.hidden = !on;
    document.body.classList.toggle('has-cb', !!on);
    if (on) paint();
  }

  /** Картинки из дропа. */
  function takeFiles(list) {
    if (packId === 'items') return;
    const files = [...list].filter((f) => /^image\/(png|webp|gif|jpeg)/.test(f.type) || /\.(png|webp|gif|jpe?g)$/i.test(f.name));
    files.reduce((p, f) => p.then(() => importFile(f)), Promise.resolve()).catch(() => {
      if ($('mapSaveState')) $('mapSaveState').textContent = 'Нужен editor.bat';
    });
  }

  /** Кнопки. */
  function init(opts) {
    $ = opts.$;
    getDoc = opts.getDoc;
    setToolUi = opts.setToolUi;
    if ($('assetPackNew')) $('assetPackNew').onclick = () => createPack();
    if ($('assetImportBtn')) $('assetImportBtn').onclick = () => { if ($('assetFile')) $('assetFile').click(); };
    if ($('assetTreeAll')) $('assetTreeAll').onclick = () => { packId = ''; paint(); };
    if ($('assetSearch')) $('assetSearch').oninput = () => { query = $('assetSearch').value; fillGrid(); };
    document.querySelectorAll('[data-asset-filter]').forEach((b) => {
      b.onclick = () => {
        layerFilter = b.getAttribute('data-asset-filter') || 'all';
        document.querySelectorAll('[data-asset-filter]').forEach((x) => {
          x.classList.toggle('is-on', x === b);
        });
        fillGrid();
      };
    });
    if ($('assetFile')) $('assetFile').onchange = async () => {
      const files = $('assetFile').files;
      $('assetFile').value = '';
      if (!files || !files.length) return;
      takeFiles(files);
    };
    const dock = $('assetDock');
    if (dock) {
      dock.addEventListener('dragover', (e) => { e.preventDefault(); dock.classList.add('is-drop'); });
      dock.addEventListener('dragleave', () => dock.classList.remove('is-drop'));
      dock.addEventListener('drop', (e) => {
        e.preventDefault();
        dock.classList.remove('is-drop');
        if (e.dataTransfer && e.dataTransfer.files) takeFiles(e.dataTransfer.files);
      });
      dock.addEventListener('wheel', (e) => {
        const grid = $('assetDockRow');
        const tree = e.target.closest('.cb-nav');
        const box = tree || grid;
        if (!box) return;
        e.preventDefault();
        e.stopPropagation();
        box.scrollTop += e.deltaY;
      }, {passive: false});
    }
  }

  return {init, paint, inspect: () => {}, current, setOpen, packId: () => packId, writePack};
})();
