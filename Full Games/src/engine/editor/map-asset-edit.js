////////////////////////////////////////////////////////
//
// Окно ассета: слой и несколько боксов коллизии
//
////////////////////////////////////////////////////////
'use strict';

window.MapAssetEdit = (() => {
  let def, api, canvas, ctx;
  const MIN_SIZE = 8;

  /** Поля окна. */
  function $id(id) { return document.getElementById(id); }

  /** На трассе (под машиной) коллизия выключена. */
  function applyLayer() {
    if (!def) return;
    const under = $id('assetEditUnder') && $id('assetEditUnder').checked;
    const roadUnder = $id('assetEditRoadUnder') && $id('assetEditRoadUnder').checked;
    def.carLayer = under ? 'under' : 'over';
    def.roadLayer = roadUnder ? 'under' : 'over';
    def.layer = def.carLayer;
    if (under) def.collision.solid = false;
    else if ($id('assetEditSolid')) def.collision.solid = $id('assetEditSolid').checked;
    if ($id('assetEditSolid')) $id('assetEditSolid').checked = !!def.collision.solid;
    const coll = $id('assetEditColl');
    if (coll) coll.hidden = under;
    const hint = $id('assetEditUnderHint');
    if (hint) hint.hidden = !under;
    const guide = document.querySelector('#assetCanvasWorkspace .asset-canvas-guide');
    if (guide) guide.hidden = under;
    if (canvas) canvas.style.cursor = under ? 'default' : 'crosshair';
    paint();
  }

  /** Экран → локаль спрайта. */
  function localOf(e) {
    const r = canvas.getBoundingClientRect();
    const mx = (e.clientX - r.left) * (canvas.width / Math.max(1, r.width));
    const my = (e.clientY - r.top) * (canvas.height / Math.max(1, r.height));
    const scale = fit();
    return {x: (mx - canvas.width / 2) / scale, y: (my - canvas.height / 2) / scale};
  }

  /** Масштаб кадра. */
  function fit() {
    RnRObjects.imgOf(def.src, paint);
    const iw = def.w || 128;
    const ih = def.h || 128;
    return Math.min((canvas.width - 48) / iw, (canvas.height - 48) / ih, 4);
  }

  /** Спрайт и боксы. */
  function paint() {
    if (!canvas || !def) return;
    const dpr = devicePixelRatio || 1;
    const css = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(css.width * dpr));
    canvas.height = Math.max(1, Math.round(css.height * dpr));
    ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#12141a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const im = RnRObjects.imgOf(def.src, paint);
    const scale = fit();
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(scale, scale);
    const iw = def.w, ih = def.h;
    if (im && im.complete && im.naturalWidth) ctx.drawImage(im, -iw / 2, -ih / 2, iw, ih);
    else {
      ctx.strokeStyle = 'rgba(160,160,170,.35)';
      ctx.strokeRect(-iw / 2, -ih / 2, iw, ih);
    }
    MapAssetColl.paint(ctx, def, scale);
    ctx.restore();
    const pt = $id('assetEditPoint');
    if (pt) {
      pt.classList.toggle('active', MapAssetColl.pointOn());
      pt.setAttribute('aria-pressed', String(MapAssetColl.pointOn()));
    }
    const select = $id('assetEditSelect');
    if (select) {
      select.classList.toggle('active', !MapAssetColl.pointOn());
      select.setAttribute('aria-pressed', String(!MapAssetColl.pointOn()));
    }
    updateCollisionStatus();
  }

  /** Обновляет короткую инструкцию по текущему режиму и выбору. */
  function updateCollisionStatus() {
    const status = $id('assetCollStatus');
    if (!status || !def) return;
    const state = MapAssetColl.state(def);
    const solid = !!def.collision.solid;
    status.classList.toggle('is-disabled', !solid);
    if (!state.bodyCount) {
      status.textContent = 'Формы ещё нет — нажмите «Создать форму по объекту».';
      return;
    }
    if (state.pointOn) {
      status.textContent = 'Режим добавления: щёлкните по линии контура.';
      return;
    }
    if (state.selectedVertex >= 0) {
      status.textContent = 'Выбрана вершина ' + (state.selectedVertex + 1) + '. Перетащите её или нажмите Delete.';
      return;
    }
    status.textContent = (solid ? 'Столкновение включено. ' : 'Столкновение выключено, но форму можно редактировать. ')
      + 'Жёлтые круги — вершины, голубые квадраты — размер.';
  }

  /** Клик по холсту. */
  function onDown(e) {
    if (!def || def.layer !== 'over') return;
    e.preventDefault();
    canvas.focus();
    MapAssetColl.onDown(e, def, localOf(e), fit());
    paint();
  }

  /** Двойной клик по ребру добавляет новую вершину. */
  function onDoubleClick(e) {
    if (!def || def.layer !== 'over') return;
    e.preventDefault();
    if (MapAssetColl.onDoubleClick(def, localOf(e), fit())) paint();
  }

  /** Delete удаляет выбранную вершину коллизии. */
  function onKeyDown(e) {
    if (!def || (e.key !== 'Delete' && e.key !== 'Backspace')) return;
    if (!MapAssetColl.removeSelectedVertex(def)) return;
    e.preventDefault();
    e.stopPropagation();
    paint();
  }

  /** Тяга. */
  function onMove(e) {
    if (!def) return;
    if (!MapAssetColl.onMove(localOf(e), def)) return;
    paint();
  }

  /** Клон коллизии из .oblab. */
  function cloneColl(src) {
    const raw = src.collision || {};
    let list = [];
    if (Array.isArray(raw.bodies) && raw.bodies.length) {
      list = raw.bodies.map((b) => ({poly: (b.poly || []).map((p) => [+p[0] || 0, +p[1] || 0])}));
    } else if (Array.isArray(raw.poly) && raw.poly.length >= 3) {
      list = [{poly: raw.poly.map((p) => [+p[0] || 0, +p[1] || 0])}];
    }
    return {
      solid: (src.carLayer || src.layer) === 'under' ? false : raw.solid !== false,
      bodies: list,
      poly: list[0] ? list[0].poly : []
    };
  }

  /** Масштабирует все точки коллизии вместе с размером ассета. */
  function scaleCollision(scaleX, scaleY) {
    if (!def || !def.collision || !Array.isArray(def.collision.bodies)) return;
    def.collision.bodies.forEach((body) => {
      (body.poly || []).forEach((point) => {
        point[0] *= scaleX;
        point[1] *= scaleY;
      });
    });
    MapAssetColl.syncPoly(def);
  }

  /** Применяет новые габариты и синхронизирует поля окна. */
  function applySize(width, height) {
    if (!def) return;
    const oldW = Math.max(MIN_SIZE, +def.w || MIN_SIZE);
    const oldH = Math.max(MIN_SIZE, +def.h || MIN_SIZE);
    const nextW = Math.max(MIN_SIZE, +width || MIN_SIZE);
    const nextH = Math.max(MIN_SIZE, +height || MIN_SIZE);
    scaleCollision(nextW / oldW, nextH / oldH);
    def.w = nextW;
    def.h = nextH;
    if ($id('assetEditWidth')) $id('assetEditWidth').value = Math.round(nextW);
    if ($id('assetEditHeight')) $id('assetEditHeight').value = Math.round(nextH);
    paint();
  }

  /** Меняет одну сторону; при включённом флажке сохраняет текущие пропорции. */
  function changeSize(axis, value) {
    if (!def) return;
    const oldW = Math.max(MIN_SIZE, +def.w || MIN_SIZE);
    const oldH = Math.max(MIN_SIZE, +def.h || MIN_SIZE);
    const next = Math.max(MIN_SIZE, +value || MIN_SIZE);
    const locked = !$id('assetEditRatio') || $id('assetEditRatio').checked;
    def.lockRatio = locked;
    if (axis === 'w') applySize(next, locked ? oldH * next / oldW : oldH);
    else applySize(locked ? oldW * next / oldH : oldW, next);
  }

  /** Загружает новую картинку, сохраняя размеры объекта и его коллизию. */
  async function replaceImage(file) {
    if (!def || !file) return;
    const ext = (file.name.split('.').pop() || 'webp').toLowerCase().replace('jpeg', 'jpg');
    const objectUrl = URL.createObjectURL(file);
    let image;
    try {
      image = await new Promise((resolve, reject) => {
        const next = new Image();
        next.onload = () => resolve(next);
        next.onerror = () => reject(new Error('Формат изображения не поддерживается'));
        next.src = objectUrl;
      });
    } finally { URL.revokeObjectURL(objectUrl); }
    const query = new URLSearchParams({
      pack: def.pack, id: def.id, name: def.name, ext,
      w: String(image.naturalWidth || def.w), h: String(image.naturalHeight || def.h), replace: '1'
    });
    const response = await fetch('/__save-oblab-file?' + query.toString(), {
      method: 'POST', headers: {'Content-Type': file.type || 'application/octet-stream'}, body: file
    });
    if (!response.ok) throw new Error('Изображение не заменено');
    const result = await response.json();
    def.file = def.id + '.' + ext;
    def.src = result.src + '?v=' + Date.now().toString(36);
    paint();
    if ($id('mapSaveState')) $id('mapSaveState').textContent = 'Изображение заменено · размер объекта сохранён';
  }

  /** Добавляет в существующую разметку настройки размера и замены картинки. */
  function bindSizeControls() {
    const side = document.querySelector('#assetEdit .asset-edit-side');
    if (!side || $id('assetEditSize')) return;
    const block = document.createElement('div');
    block.id = 'assetEditSize';
    block.className = 'asset-edit-size';
    block.innerHTML = '<label>Ширина<input id="assetEditWidth" type="number" min="8" step="1"></label>'
      + '<label>Высота<input id="assetEditHeight" type="number" min="8" step="1"></label>'
      + '<label class="asset-edit-ratio"><input id="assetEditRatio" class="check" type="checkbox" checked> Пропорционально</label>'
      + '<button type="button" id="assetEditReplace" class="asset-edit-replace">Заменить изображение</button>'
      + '<input id="assetEditReplaceFile" type="file" accept="image/png,image/webp,image/gif,image/jpeg" hidden>';
    const firstLayer = side.querySelector('.asset-edit-layer');
    side.insertBefore(block, firstLayer);
    $id('assetEditWidth').onchange = (event) => changeSize('w', event.target.value);
    $id('assetEditHeight').onchange = (event) => changeSize('h', event.target.value);
    $id('assetEditRatio').onchange = (event) => { if (def) def.lockRatio = event.target.checked; };
    $id('assetEditReplace').onclick = () => $id('assetEditReplaceFile').click();
    $id('assetEditReplaceFile').onchange = async (event) => {
      const file = event.target.files && event.target.files[0];
      event.target.value = '';
      if (!file) return;
      try { await replaceImage(file); }
      catch (error) { if ($id('mapSaveState')) $id('mapSaveState').textContent = error.message; }
    };
  }

  /** Превращает старую разметку окна в единый понятный редактор без изменения Editor.html. */
  function bindEditorLayout() {
    const card = document.querySelector('#assetEdit .asset-edit-card');
    const body = document.querySelector('#assetEdit .asset-edit-body');
    const side = document.querySelector('#assetEdit .asset-edit-side');
    const c = $id('assetEditCanvas');
    const coll = $id('assetEditColl');
    if (!card || !body || !side || !c || !coll || $id('assetCanvasWorkspace')) return;
    const title = card.querySelector('.asset-edit-title');
    if (title) title.textContent = 'Редактор объекта';

    const workspace = document.createElement('div');
    workspace.id = 'assetCanvasWorkspace';
    workspace.className = 'asset-canvas-workspace';
    c.parentNode.insertBefore(workspace, c);
    workspace.appendChild(c);
    const guide = document.createElement('div');
    guide.className = 'asset-canvas-guide';
    guide.setAttribute('aria-hidden', 'true');
    guide.innerHTML = '<strong>Коллизия на изображении</strong><span><i class="vertex"></i> вершины</span><span><i class="scale"></i> размер</span>';
    workspace.appendChild(guide);

    const collisionTitle = document.createElement('div');
    collisionTitle.className = 'asset-section-title';
    collisionTitle.innerHTML = '<strong>Коллизия</strong><span>форма столкновения машины с объектом</span>';
    coll.insertBefore(collisionTitle, coll.firstChild);
    const solidLabel = $id('assetEditSolid') && $id('assetEditSolid').closest('label');
    if (solidLabel) {
      solidLabel.classList.add('asset-solid-toggle');
      solidLabel.lastChild.textContent = ' Включить столкновение в игре';
    }
    const oldHint = coll.querySelector('p.hint');
    if (oldHint) oldHint.remove();
    const status = document.createElement('div');
    status.id = 'assetCollStatus';
    status.className = 'asset-coll-status';
    if (solidLabel) solidLabel.insertAdjacentElement('afterend', status);

    const actions = coll.querySelector('.actions');
    if (actions) {
      actions.classList.add('asset-collision-actions');
      const select = document.createElement('button');
      select.type = 'button';
      select.id = 'assetEditSelect';
      select.className = 'active';
      select.title = 'Перетаскивайте жёлтые вершины, голубые углы или всю форму';
      select.textContent = '↖ Выбор и перемещение';
      select.onclick = () => { MapAssetColl.setPoint(false); paint(); };
      actions.insertBefore(select, actions.firstChild);
    }
    if ($id('assetEditBox')) $id('assetEditBox').textContent = '＋ Создать форму по объекту';
    if ($id('assetEditCopy')) $id('assetEditCopy').textContent = '⧉ Дублировать форму';
    if ($id('assetEditPoint')) $id('assetEditPoint').textContent = '＋ Добавить вершину';
    if ($id('assetEditPoint')) $id('assetEditPoint').title = 'Включите режим и щёлкните по линии контура';
    if ($id('assetEditDelBox')) $id('assetEditDelBox').textContent = 'Удалить форму';
    if ($id('assetEditClear')) $id('assetEditClear').textContent = 'Очистить всё';
    if ($id('assetEditSave')) $id('assetEditSave').textContent = 'Сохранить объект';
    if ($id('assetEditClose')) $id('assetEditClose').textContent = 'Отмена';

    const nameField = $id('assetEditName') && $id('assetEditName').closest('.field');
    const sizeBlock = $id('assetEditSize');
    if (nameField && sizeBlock) {
      const properties = document.createElement('section');
      properties.className = 'asset-editor-section asset-properties-section';
      properties.innerHTML = '<div class="asset-section-title"><strong>Изображение и размер</strong><span>имя, габариты и спрайт объекта</span></div>';
      side.insertBefore(properties, nameField);
      nameField.classList.add('asset-name-field');
      properties.append(nameField, sizeBlock);
    }

    const layerFields = Array.from(side.querySelectorAll('.asset-edit-layer'));
    if (layerFields.length) {
      const layers = document.createElement('section');
      layers.className = 'asset-editor-section asset-layers-section';
      layers.innerHTML = '<div class="asset-section-title"><strong>Расположение</strong><span>порядок отрисовки объекта</span></div>';
      side.insertBefore(layers, layerFields[0]);
      layerFields.forEach((fieldset, index) => {
        fieldset.classList.add('asset-segmented-field');
        const legend = fieldset.querySelector('legend');
        if (legend) legend.textContent = index === 0 ? 'Трасса' : 'Машина';
        layers.appendChild(fieldset);
      });
      const layerHint = $id('assetEditUnderHint');
      if (layerHint) {
        layerHint.classList.add('asset-layer-hint');
        layers.appendChild(layerHint);
      }
    }

    coll.classList.add('asset-editor-section');
    side.tabIndex = 0;
    side.setAttribute('role', 'region');
    side.setAttribute('aria-label', 'Настройки объекта, прокручиваемая панель');

    const footer = side.querySelector('.asset-edit-actions');
    if (footer) {
      footer.classList.add('asset-edit-footer');
      footer.setAttribute('aria-label', 'Действия с объектом');
      card.appendChild(footer);
    }
  }

  /** Открыть окно. */
  function open(src, handlers) {
    MapAssetColl.reset();
    def = {
      pack: src.pack, id: src.id, name: src.name, src: src.src, file: src.file,
      w: src.w, h: src.h, lockRatio: src.lockRatio,
      layer: src.carLayer || src.layer, carLayer: src.carLayer || src.layer,
      roadLayer: src.roadLayer || 'over',
      collision: cloneColl(src)
    };
    api = handlers;
    const box = $id('assetEdit');
    if (!box) return;
    box.hidden = false;
    if ($id('assetEditName')) $id('assetEditName').value = def.name;
    if ($id('assetEditWidth')) $id('assetEditWidth').value = Math.round(def.w);
    if ($id('assetEditHeight')) $id('assetEditHeight').value = Math.round(def.h);
    if ($id('assetEditRatio')) $id('assetEditRatio').checked = def.lockRatio !== false;
    if ($id('assetEditReplace')) {
      $id('assetEditReplace').disabled = def.pack === 'stock';
      $id('assetEditReplace').title = def.pack === 'stock' ? 'Системный ассет сначала импортируйте в свой пак' : '';
    }
    if ($id('assetEditUnder')) $id('assetEditUnder').checked = def.carLayer !== 'over';
    if ($id('assetEditOver')) $id('assetEditOver').checked = def.carLayer === 'over';
    if ($id('assetEditRoadUnder')) $id('assetEditRoadUnder').checked = def.roadLayer === 'under';
    if ($id('assetEditRoadOver')) $id('assetEditRoadOver').checked = def.roadLayer !== 'under';
    const del = $id('assetEditDelete');
    if (del) del.hidden = def.pack === 'stock';
    canvas = $id('assetEditCanvas');
    if (canvas) canvas.focus();
    applyLayer();
  }

  /** Закрыть. */
  function close() {
    const box = $id('assetEdit');
    if (box) box.hidden = true;
    def = null;
    MapAssetColl.endDrag();
  }

  /** Размер спрайта. */
  function spriteSize() {
    return {w: def.w, h: def.h};
  }

  /** Сохранить. */
  async function save() {
    if (!def || !api) return;
    if ($id('assetEditName')) def.name = $id('assetEditName').value.slice(0, 42);
    applyLayer();
    MapAssetColl.syncPoly(def);
    try {
      await api.save(def);
      close();
    } catch (err) {
      if ($id('mapSaveState')) $id('mapSaveState').textContent = 'Сбой .oblab';
    }
  }

  /** Удалить с диска. */
  async function remove() {
    if (!def || def.pack === 'stock' || !api.remove) return;
    if (!confirm('Удалить объект из пака?')) return;
    try {
      await api.remove(def);
      close();
    } catch (err) {
      if ($id('mapSaveState')) $id('mapSaveState').textContent = 'Сбой удаления';
    }
  }

  /** Кнопки окна. */
  function bind() {
    if (window.__assetEditBound) return;
    window.__assetEditBound = true;
    bindSizeControls();
    bindEditorLayout();
    const c = $id('assetEditCanvas');
    if (c) {
      c.tabIndex = 0;
      c.addEventListener('pointerdown', onDown);
      c.addEventListener('dblclick', onDoubleClick);
      c.addEventListener('keydown', onKeyDown);
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', () => MapAssetColl.endDrag());
      c.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    if ($id('assetEditUnder')) $id('assetEditUnder').onchange = applyLayer;
    if ($id('assetEditOver')) $id('assetEditOver').onchange = applyLayer;
    if ($id('assetEditRoadUnder')) $id('assetEditRoadUnder').onchange = applyLayer;
    if ($id('assetEditRoadOver')) $id('assetEditRoadOver').onchange = applyLayer;
    if ($id('assetEditSolid')) $id('assetEditSolid').onchange = () => {
      if (def && $id('assetEditSolid').checked && !MapAssetColl.bodies(def).length) {
        const size = spriteSize();
        MapAssetColl.addBox(def, size.w, size.h);
      }
      applyLayer();
    };
    if ($id('assetEditSave')) $id('assetEditSave').onclick = save;
    if ($id('assetEditClose')) $id('assetEditClose').onclick = close;
    if ($id('assetEditDelete')) $id('assetEditDelete').onclick = remove;
    if ($id('assetEditBox')) $id('assetEditBox').onclick = () => {
      if (!def) return;
      const s = spriteSize();
      MapAssetColl.addBox(def, s.w, s.h);
      paint();
    };
    if ($id('assetEditCopy')) $id('assetEditCopy').onclick = () => { if (def) { MapAssetColl.copy(def); paint(); } };
    if ($id('assetEditDelBox')) $id('assetEditDelBox').onclick = () => { if (def) { MapAssetColl.remove(def); paint(); } };
    if ($id('assetEditPoint')) $id('assetEditPoint').onclick = () => {
      MapAssetColl.setPoint(!MapAssetColl.pointOn());
      paint();
    };
    if ($id('assetEditClear')) $id('assetEditClear').onclick = () => {
      if (!def) return;
      MapAssetColl.clear(def);
      paint();
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();

  return {open, close};
})();
