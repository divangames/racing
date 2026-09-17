////////////////////////////////////////////////////////
//
// Окно ассета: слой и несколько боксов коллизии
//
////////////////////////////////////////////////////////
'use strict';

window.MapAssetEdit = (() => {
  let def, api, canvas, ctx;

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
    const im = RnRObjects.imgOf(def.src, paint);
    const iw = (im && im.naturalWidth) || def.w || 128;
    const ih = (im && im.naturalHeight) || def.h || 128;
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
    const iw = (im && im.naturalWidth) || def.w, ih = (im && im.naturalHeight) || def.h;
    if (im && im.complete && im.naturalWidth) ctx.drawImage(im, -iw / 2, -ih / 2, iw, ih);
    else {
      ctx.strokeStyle = 'rgba(160,160,170,.35)';
      ctx.strokeRect(-iw / 2, -ih / 2, iw, ih);
    }
    MapAssetColl.paint(ctx, def, scale);
    ctx.restore();
    const pt = $id('assetEditPoint');
    if (pt) pt.classList.toggle('active', MapAssetColl.pointOn());
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
    const im = RnRObjects.imgOf(def.src);
    return {w: (im && im.naturalWidth) || def.w, h: (im && im.naturalHeight) || def.h};
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
    if ($id('assetEditSolid')) $id('assetEditSolid').onchange = applyLayer;
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
    const coll = $id('assetEditColl');
    const hint = coll && coll.querySelector('p.hint');
    if (hint) hint.textContent = 'Дважды щёлкните по ребру, чтобы добавить вершину. Выберите вершину и нажмите Delete, чтобы удалить.';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();

  return {open, close};
})();
