////////////////////////////////////////////////////////
//
// Браузер контента: паки, итемы, сетка превью
//
////////////////////////////////////////////////////////
'use strict';

window.MapAssets = (() => {
  let $, getDoc, setDirty, setToolUi, packId = '', stampId = '', itemId = 'money', layerFilter = 'all', placeRoad = 'over', placeCar = 'under', query = '';
  let contextMenu = null;
  let objectClipboard = null;
  const PASTE_OFFSET = 24;
  const MIN_OBJECT_SIZE = 8;
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
      if (def) return Object.assign({}, def, {layer: placeCar, carLayer: placeCar, roadLayer: placeRoad});
    }
    const first = listed()[0];
    return first ? Object.assign({}, first, {layer: placeCar, carLayer: placeCar, roadLayer: placeRoad}) : null;
  }

  ////////////////////////////////////////////////////////
  //
  // Дерево и сетка
  //
  ////////////////////////////////////////////////////////

  /** Закрывает контекстное меню. */
  function closeMenu() {
    if (contextMenu) contextMenu.remove();
    contextMenu = null;
  }

  /** Показывает доступное с клавиатуры меню рядом с указателем. */
  function showMenu(e, actions) {
    e.preventDefault();
    e.stopPropagation();
    closeMenu();
    const menu = document.createElement('div');
    menu.className = 'asset-context-menu';
    menu.setAttribute('role', 'menu');
    actions.forEach((action) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = action.label;
      button.disabled = !!action.disabled;
      if (action.danger) button.className = 'is-danger';
      button.onclick = () => { closeMenu(); action.run(); };
      menu.appendChild(button);
    });
    document.body.appendChild(menu);
    const left = Math.min(e.clientX, innerWidth - menu.offsetWidth - 8);
    const top = Math.min(e.clientY, innerHeight - menu.offsetHeight - 8);
    menu.style.left = Math.max(8, left) + 'px';
    menu.style.top = Math.max(8, top) + 'px';
    contextMenu = menu;
    const first = menu.querySelector('button:not(:disabled)');
    if (first) first.focus();
  }

  /** Имя файла из URL, чтобы webp не сохранялся как png. */
  function fileNameFromSrc(src, fallback) {
    const base = String(src || '').split('?')[0].split('#')[0].split('/').pop() || '';
    try {
      const name = decodeURIComponent(base);
      if (/\.[a-z0-9]+$/i.test(name)) return name;
    } catch (err) {}
    return fallback || 'texture.png';
  }

  /** Скачивает Blob или URL тем же содержимым, что отдаёт сервер. */
  async function download(source, name) {
    let blob = source instanceof Blob ? source : null;
    if (!blob && source) {
      try {
        const response = await fetch(String(source).split('?')[0], {cache: 'no-store'});
        if (response.ok) blob = await response.blob();
      } catch (err) {}
    }
    const a = document.createElement('a');
    const objectUrl = blob ? URL.createObjectURL(blob) : '';
    a.href = objectUrl || source;
    a.download = name || fileNameFromSrc(source, 'texture.png');
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  /** Скачивает описание .oblab. */
  function exportAsset(def) {
    const body = JSON.stringify(RnRObjects.fileOf(def), null, 2) + '\n';
    download(new Blob([body], {type: 'application/json;charset=utf-8'}), def.id + '.oblab');
  }

  /** Имя пака в безопасный технический id. */
  function packSlug(name) {
    const slug = String(name || '').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24);
    return (slug.length >= 2 ? slug : 'pack') + '_' + Date.now().toString(36).slice(-6);
  }

  /** Диалог имени и цвета пака. */
  function askPack(title, initial) {
    return new Promise((resolve) => {
      const shade = document.createElement('div');
      shade.className = 'asset-pack-dialog';
      shade.innerHTML = '<form class="asset-pack-card"><h2></h2><label>Название<input name="name" maxlength="42" required></label><label>Цвет<input name="color" type="color"></label><div class="actions"><button class="primary" type="submit">Сохранить</button><button name="cancel" type="button">Отмена</button></div></form>';
      const form = shade.querySelector('form');
      shade.querySelector('h2').textContent = title;
      form.elements.name.value = initial.name || '';
      form.elements.color.value = initial.color || '#79dce6';
      const finish = (value) => { shade.remove(); resolve(value); };
      form.onsubmit = (event) => {
        event.preventDefault();
        const name = form.elements.name.value.trim();
        if (name) finish({name, color: form.elements.color.value});
      };
      form.elements.cancel.onclick = () => finish(null);
      shade.onclick = (event) => { if (event.target === shade) finish(null); };
      document.body.appendChild(shade);
      form.elements.name.focus();
    });
  }

  /** Записывает операцию с паком. */
  async function savePack(payload) {
    const response = await fetch('/__save-pack', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)
    });
    let result = null;
    try { result = await response.json(); } catch (err) {}
    if (!response.ok || !result || result.ok === false) throw new Error((result && result.error) || 'Пак не изменён');
    await RnRObjects.list();
    paint();
    return result;
  }

  /** Переименовывает и перекрашивает пользовательский пак. */
  async function editPack(pack) {
    if (!pack || pack.system) return;
    const values = await askPack('Настройка пака', pack);
    if (!values) return;
    try { await savePack({action: 'update', id: pack.id, parent: pack.parent || '', ...values}); }
    catch (err) { alert(err.message); }
  }

  /** Удаляет пак после явного подтверждения. */
  async function deletePack(pack) {
    if (!pack || pack.system) return;
    if (!confirm('Удалить пак «' + pack.name + '» и все его ассеты?')) return;
    try {
      await savePack({action: 'delete', id: pack.id});
      if (packId === pack.id) packId = '';
      paint();
    } catch (err) { alert(err.message); }
  }

  /** Удаляет ассет из контекстного меню только после подтверждения. */
  async function deleteAssetFromMenu(def) {
    if (!def || def.pack === 'stock') return;
    if (!confirm('Удалить ассет «' + def.name + '» и его текстуру?')) return;
    try { await removeDef(def); }
    catch (err) { alert('Ассет не удалён'); }
  }

  /** Переносит пак в другой пак или в корень. */
  async function movePack(id, parent) {
    const pack = (RnRObjects.packs || []).find((item) => item.id === id);
    if (!pack || pack.system || id === parent) return;
    try { await savePack({action: 'update', id, parent: parent || '', name: pack.name, color: pack.color}); }
    catch (err) { alert(err.message); }
  }

  /** Одна ветка дерева паков. */
  function appendPackTree(box, parent, depth) {
    (RnRObjects.packs || []).filter((pack) => (pack.parent || '') === parent).forEach((p) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cb-folder' + (p.id === packId ? ' is-on' : '') + (p.system ? ' is-system' : '');
      b.textContent = p.name;
      b.style.setProperty('--pack-color', p.color || '#79dce6');
      b.style.setProperty('--pack-depth', depth);
      b.title = p.system ? 'Системный пак: нельзя удалить или перенести' : 'ПКМ: переименовать, цвет или удалить';
      b.onclick = () => { packId = p.id; paint(); };
      b.draggable = !p.system;
      b.ondragstart = (event) => {
        if (p.system) { event.preventDefault(); return; }
        event.dataTransfer.setData('text/x-rnr-pack', p.id);
        event.dataTransfer.effectAllowed = 'move';
      };
      b.ondragover = (event) => {
        if (event.dataTransfer.types.includes('text/x-rnr-pack')) { event.preventDefault(); b.classList.add('is-drop-target'); }
      };
      b.ondragleave = () => b.classList.remove('is-drop-target');
      b.ondrop = (event) => {
        event.preventDefault(); b.classList.remove('is-drop-target');
        movePack(event.dataTransfer.getData('text/x-rnr-pack'), p.id);
      };
      b.oncontextmenu = (event) => showMenu(event, [
        {label: 'Переименовать и цвет', disabled: p.system, run: () => editPack(p)},
        {label: 'Удалить пак', disabled: p.system, danger: true, run: () => deletePack(p)}
      ]);
      box.appendChild(b);
      appendPackTree(box, p.id, depth + 1);
    });
  }

  /** Папки слева. */
  function fillTree() {
    const box = $('assetTree');
    if (!box) return;
    box.innerHTML = '';
    const items = document.createElement('button');
    items.type = 'button';
    items.className = 'cb-folder is-system' + (packId === 'items' ? ' is-on' : '');
    items.style.setProperty('--pack-color', '#d4a84a');
    items.textContent = 'Итемы';
    items.onclick = () => { packId = 'items'; paint(); };
    box.appendChild(items);
    appendPackTree(box, '', 0);
    const all = $('assetTreeAll');
    if (all) {
      all.classList.toggle('is-on', !packId);
      all.ondragover = (event) => { if (event.dataTransfer.types.includes('text/x-rnr-pack')) event.preventDefault(); };
      all.ondrop = (event) => { event.preventDefault(); movePack(event.dataTransfer.getData('text/x-rnr-pack'), ''); };
    }
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
    b.oncontextmenu = (event) => showMenu(event, [
      {label: 'Редактор', run: () => MapAssetEdit.open(o, {save: saveDef, remove: removeDef, reload: paint})},
      {label: 'Скачать ассет (.oblab)', run: () => exportAsset(o)},
      {label: 'Скачать текстуру', run: () => download(o.src, o.file || fileNameFromSrc(o.src, o.id + '.png'))},
      {label: 'Удалить', disabled: o.pack === 'stock', danger: true, run: () => deleteAssetFromMenu(o)}
    ]);
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

  ////////////////////////////////////////////////////////
  //
  // Опции экземпляра на карте
  //
  ////////////////////////////////////////////////////////

  /** Возвращает выделенный экземпляр ассета на карте. */
  function selectedObject() {
    const selection = MapView.selection && MapView.selection();
    const doc = getDoc && getDoc();
    if (!selection || selection.kind !== 'asset' || !doc || !doc.objects) return null;
    return doc.objects[selection.i] || null;
  }

  /** Сообщает карте о законченном изменении экземпляра. */
  function commitObject(message) {
    if (setDirty) setDirty(true);
    if (MapView.draw) MapView.draw();
    if ($('mapSaveState') && message) $('mapSaveState').textContent = message;
    inspect();
  }

  /** Клонирует только сериализуемые поля экземпляра. */
  function cloneObject(object) {
    return object ? JSON.parse(JSON.stringify(object)) : null;
  }

  /** Копирует выделенный объект во внутренний буфер карты. */
  function copySelected() {
    const object = selectedObject();
    if (!object) return false;
    objectClipboard = cloneObject(object);
    if ($('mapSaveState')) $('mapSaveState').textContent = 'Объект скопирован · Ctrl+V — вставить';
    return true;
  }

  /** Вставляет копию с небольшим смещением и выделяет её. */
  function pasteObject(source) {
    const doc = getDoc && getDoc();
    const copy = cloneObject(source || objectClipboard);
    if (!doc || !copy) return false;
    doc.objects = doc.objects || [];
    copy.x = (+copy.x || 0) + PASTE_OFFSET;
    copy.y = (+copy.y || 0) + PASTE_OFFSET;
    doc.objects.push(copy);
    objectClipboard = cloneObject(copy);
    MapView.setSelection({kind: 'asset', i: doc.objects.length - 1});
    commitObject('Копия объекта добавлена');
    return true;
  }

  /** Отражает изображение и его коллизию в выбранном экземпляре. */
  function flipSelected(axis) {
    const object = selectedObject();
    if (!object) return;
    if (axis === 'x') object.flipX = !object.flipX;
    else object.flipY = !object.flipY;
    commitObject(axis === 'x' ? 'Объект отражён по горизонтали' : 'Объект отражён по вертикали');
  }

  /** Меняет размеры экземпляра с необязательной фиксацией пропорций. */
  function resizeSelected(axis, value) {
    const object = selectedObject();
    if (!object) return;
    const width = Math.max(MIN_OBJECT_SIZE, +object.w || MIN_OBJECT_SIZE);
    const height = Math.max(MIN_OBJECT_SIZE, +object.h || MIN_OBJECT_SIZE);
    const next = Math.max(MIN_OBJECT_SIZE, +value || MIN_OBJECT_SIZE);
    const locked = !$('assetInstanceRatio') || $('assetInstanceRatio').checked;
    if (axis === 'w') {
      object.w = next;
      if (locked) object.h = Math.max(MIN_OBJECT_SIZE, height * next / width);
    } else {
      object.h = next;
      if (locked) object.w = Math.max(MIN_OBJECT_SIZE, width * next / height);
    }
    object.lockRatio = locked;
    commitObject('Размер объекта изменён вместе с коллизией');
  }

  /** Создаёт компактную панель операций над выбранным объектом. */
  function bindObjectInspector() {
    const workspace = document.querySelector('.workspace-map .map-stage-wrap');
    if (!workspace || $('assetInstanceTools')) return;
    const panel = document.createElement('div');
    panel.id = 'assetInstanceTools';
    panel.className = 'asset-instance-tools';
    panel.hidden = true;
    panel.innerHTML = '<div class="asset-instance-head"><strong>Выбранный объект</strong><span>изменения видны сразу</span></div>'
      + '<div class="asset-instance-size"><label>Ширина <input id="assetInstanceW" type="number" min="8" step="1"></label>'
      + '<label>Высота <input id="assetInstanceH" type="number" min="8" step="1"></label>'
      + '<label class="asset-instance-ratio"><input id="assetInstanceRatio" type="checkbox" checked> Пропорционально</label>'
      + '</div><div class="asset-instance-actions">'
      + '<button type="button" id="assetInstanceDuplicate" title="Создать копию рядом">⧉ Дублировать</button>'
      + '<button type="button" id="assetInstanceFlipX" title="Зеркально отразить слева направо">↔ Отразить горизонтально</button>'
      + '<button type="button" id="assetInstanceFlipY" title="Зеркально отразить сверху вниз">↕ Отразить вертикально</button>'
      + '</div>';
    workspace.appendChild(panel);
    $('assetInstanceW').onchange = (event) => resizeSelected('w', event.target.value);
    $('assetInstanceH').onchange = (event) => resizeSelected('h', event.target.value);
    $('assetInstanceRatio').onchange = (event) => {
      const object = selectedObject();
      if (!object) return;
      object.lockRatio = event.target.checked;
      commitObject(event.target.checked ? 'Пропорции размера закреплены' : 'Размеры меняются независимо');
    };
    $('assetInstanceDuplicate').onclick = () => pasteObject(selectedObject());
    $('assetInstanceFlipX').onclick = () => flipSelected('x');
    $('assetInstanceFlipY').onclick = () => flipSelected('y');
    const stage = $('mapStage');
    if (stage) stage.addEventListener('pointerup', () => setTimeout(inspect, 0));
  }

  /** Синхронизирует панель с текущим выделением карты. */
  function inspect() {
    const panel = $('assetInstanceTools');
    if (!panel) return;
    const object = selectedObject();
    panel.hidden = !object;
    if (!object) return;
    $('assetInstanceW').value = Math.round(+object.w || MIN_OBJECT_SIZE);
    $('assetInstanceH').value = Math.round(+object.h || MIN_OBJECT_SIZE);
    $('assetInstanceRatio').checked = object.lockRatio !== false;
    $('assetInstanceFlipX').classList.toggle('active', !!object.flipX);
    $('assetInstanceFlipY').classList.toggle('active', !!object.flipY);
  }

  /** Ctrl+C / Ctrl+V работают внутри открытой карты и не перехватывают поля ввода. */
  function bindClipboard() {
    window.addEventListener('keydown', (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      if ($('workMap') && $('workMap').hidden) return;
      if (event.target && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
      const code = event.code || '';
      if (code === 'KeyC' || (event.key || '').toLowerCase() === 'c' || event.key === 'с') {
        if (copySelected()) event.preventDefault();
      } else if (code === 'KeyV' || (event.key || '').toLowerCase() === 'v' || event.key === 'м') {
        if (pasteObject()) event.preventDefault();
      }
    });
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
    const work = async () => {
    const ext = (file.name.split('.').pop() || 'webp').toLowerCase().replace('jpeg', 'jpg');
    const base = file.name.replace(/\.[^.]+$/, '') || 'asset';
    const translit = {'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'i','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'c','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'};
    const id = base.toLowerCase().split('').map((char) => translit[char] == null ? char : translit[char])
      .join('').replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || ('asset_' + Date.now().toString(36));
    const objectUrl = URL.createObjectURL(file);
    const im = await new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error('Формат изображения не поддерживается'));
      img.src = objectUrl;
    });
    const w = im.naturalWidth || 128, h = im.naturalHeight || 128;
    URL.revokeObjectURL(objectUrl);
    const dest = writePack();
    const query = new URLSearchParams({pack: dest, id, name: base, ext, w: String(w), h: String(h)});
    const r = await fetch('/__save-oblab-file?' + query.toString(), {
      method: 'POST',
      headers: {'Content-Type': file.type || 'application/octet-stream'},
      body: file
    });
    if (!r.ok) throw new Error('Не удалось импортировать ассет (' + r.status + ')');
    packId = dest;
    stampId = id;
    await RnRObjects.list();
    paint();
    if ($('mapSaveState')) $('mapSaveState').textContent = 'Ассет импортирован · ' + file.name;
    return {ok: true};
    };
    if (window.LabBusy && LabBusy.run) return LabBusy.run('Импортирую ассет', work);
    return work();
  }

  /** Запись .oblab. */
  async function saveDef(def) {
    const dest = def.pack === 'stock' ? writePack() : def.pack;
    if ((def.carLayer || def.layer) === 'under') def.collision.solid = false;
    const r = await fetch('/__save-oblab', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        pack: dest, id: def.id, name: def.name, src: def.src.indexOf('assets/') === 0 ? def.src.split('?')[0] : def.file,
        w: def.w, h: def.h, lockRatio: def.lockRatio,
        layer: def.carLayer || def.layer, carLayer: def.carLayer || def.layer,
        roadLayer: def.roadLayer || 'over', collision: def.collision
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
    const values = await askPack('Новый пак', {name: 'Мой пак', color: '#79dce6'});
    if (!values) return;
    const id = packSlug(values.name);
    try { await savePack({action: 'create', id, ...values}); packId = id; paint(); }
    catch (err) { alert(err.message); }
  }

  /** Скачивает холст как PNG. */
  function downloadCanvas(canvas, name) {
    if (!canvas || !canvas.toBlob) return;
    canvas.toBlob((blob) => { if (blob) download(blob, name); }, 'image/png');
  }

  /** Ширина полотна как в заезде. */
  const ROAD_HALF = 95;

  /** Хуки материала для ленты на прямом куске. */
  function bindExportRoadApi(theme, material) {
    const mats = {
      asphalt: {road: '#43404b'}, sand: {road: '#b88a4e'}, dirt: {road: '#76503a'},
      grass: {road: '#687447'}, ice: {road: '#72b8d1'}, snow: {road: '#d8eaf0'}, lava: {road: '#47221a'}
    };
    if (theme && theme.road) mats.asphalt = {road: theme.road};
    window.ROAD_MATERIALS = mats;
    window.roadMaterial = function () { return material || 'asphalt'; };
    window.roadMaterialBlend = function () {
      const m = material || 'asphalt';
      return {matA: m, matB: m, mix: 0};
    };
  }

  /** Прямой кусок трассы: тот же blit, что в заезде, вид сверху. */
  function bakeTrackSlice(kind, material) {
    const ribbon = window.DiVANEngine && DiVANEngine.trackRibbon;
    const strips = window.DiVANEngine && DiVANEngine.trackStrip;
    if (!ribbon || !ribbon.paintDeck || !strips) return null;
    const theme = Object.assign({}, getDoc().theme || {});
    if (kind === 'road') {
      const custom = MapTex.roadOf(theme);
      if (!(custom && custom.complete && custom.naturalWidth > 2)) theme.roadSrc = '';
    }
    if (kind === 'rail') {
      const custom = MapTex.railOf(theme);
      if (!(custom && custom.complete && custom.naturalWidth > 2)) theme.railSrc = '';
    }
    bindExportRoadApi(theme, material || 'asphalt');
    const along = 640;
    const pad = 36;
    const scale = 2;
    const worldH = ROAD_HALF * 2 + pad * 2;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(along * scale);
    canvas.height = Math.round(worldH * scale);
    const q = canvas.getContext('2d');
    q.scale(scale, scale);
    q.fillStyle = (theme.ground) || '#b98a4e';
    q.fillRect(0, 0, along, worldH);
    const mid = pad + ROAD_HALF;
    const S = [];
    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      S.push({x: i / steps * along, y: mid, nx: 0, ny: -1, tx: 1, ty: 0, ang: 0});
    }
    const T = {S: S, N: S.length, theme: theme, zones: [{from: 0, to: 1, material: material || 'asphalt'}]};
    ribbon.paintDeck(q, T, ROAD_HALF, 0);
    return canvas;
  }

  /** Системные полосы дороги: кусок как на трассе, не пустая UV-заготовка. */
  function exportRoadTexture(event) {
    const used = new Set(['asphalt']);
    (getDoc().zones || []).forEach((zone) => { if (zone.material) used.add(zone.material); });
    const mats = [...used];
    const run = (material) => {
      const slice = bakeTrackSlice('road', material);
      if (slice) downloadCanvas(slice, 'road-' + material + '-track.png');
    };
    if (mats.length === 1) { run(mats[0]); return; }
    showMenu(event, mats.map((material) => ({
      label: 'Скачать: ' + material + ' · как на трассе',
      run: () => run(material)
    })));
  }

  /** Борта тем же blit, что в заезде. */
  function exportRailTexture() {
    const slice = bakeTrackSlice('rail', 'asphalt');
    if (slice) downloadCanvas(slice, 'rails-track.png');
  }

  /** Земля: файл трассы или все кадры биома, которые грузит заезд. */
  function exportGroundTexture(event) {
    const files = (window.MapTex && MapTex.groundFiles)
      ? MapTex.groundFiles(getDoc().theme)
      : [];
    const unique = files.filter((src, i) => files.indexOf(src) === i);
    if (!unique.length) return;
    if (unique.length === 1) {
      download(unique[0], fileNameFromSrc(unique[0], 'ground.webp'));
      return;
    }
    showMenu(event, unique.map((src, i) => ({
      label: 'Скачать: ' + fileNameFromSrc(src, 'кадр-' + (i + 1)),
      run: () => download(src, fileNameFromSrc(src, 'ground-' + (i + 1) + '.webp'))
    })));
  }

  /** Кнопки экспорта текущих текстур, включая системные. */
  function bindTextureExports() {
    const specs = [
      ['mapGroundFile', 'Скачать фактическую землю', exportGroundTexture],
      ['mapRoadFile', 'Скачать фактическую дорогу', exportRoadTexture],
      ['mapRailFile', 'Скачать фактические борта', exportRailTexture]
    ];
    specs.forEach(([anchorId, label, run], index) => {
      const anchor = $(anchorId);
      if (!anchor || $('assetTextureExport' + index)) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.id = 'assetTextureExport' + index;
      button.className = 'texture-export';
      button.textContent = label;
      button.onclick = run;
      anchor.closest('label').insertAdjacentElement('afterend', button);
    });
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
    setDirty = opts.setDirty;
    setToolUi = opts.setToolUi;
    bindTextureExports();
    bindObjectInspector();
    bindClipboard();
    document.addEventListener('pointerdown', (event) => { if (contextMenu && !contextMenu.contains(event.target)) closeMenu(); });
    window.addEventListener('blur', closeMenu);
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
    function applyPlacement() {
      const changed = MapView.setSelectedAssetLayers && MapView.setSelectedAssetLayers({roadLayer: placeRoad, carLayer: placeCar});
      if ($('mapSaveState')) $('mapSaveState').textContent = changed
        ? 'Слои выделенного ассета изменены'
        : 'Слои выбраны для новых ассетов';
    }
    document.querySelectorAll('[data-asset-road]').forEach((b) => {
      b.onclick = () => {
        placeRoad = b.getAttribute('data-asset-road') === 'under' ? 'under' : 'over';
        document.querySelectorAll('[data-asset-road]').forEach((x) => x.classList.toggle('is-on', x === b));
        applyPlacement();
      };
    });
    document.querySelectorAll('[data-asset-car]').forEach((b) => {
      b.onclick = () => {
        placeCar = b.getAttribute('data-asset-car') === 'over' ? 'over' : 'under';
        document.querySelectorAll('[data-asset-car]').forEach((x) => x.classList.toggle('is-on', x === b));
        applyPlacement();
      };
    });
    if ($('assetFile')) $('assetFile').onchange = async () => {
      // FileList живой: после очистки input он становится пустым.
      const files = [...($('assetFile').files || [])];
      $('assetFile').value = '';
      if (!files.length) return;
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

  return {init, paint, inspect, current, setOpen, packId: () => packId, writePack};
})();
