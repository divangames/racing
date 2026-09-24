////////////////////////////////////////////////////////
//
// Редактор трассы: те же мировые спрайты и финиш, что в заезде.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  if (typeof MapMarks === 'undefined' || typeof MapPreview === 'undefined' || !global.MapAssets) return;

  const ART = {
    pad: ['arena-pad.png', 66, 48],
    ramp: ['arena-ramp.png', 76, 84],
    mine: ['arena-mine.png', 26, 26],
    oil: ['arena-oil.png', 66, 48],
    money: ['arena-money.png', 31, 31],
    wrench: ['arena-wrench.png', 31, 31],
    wep: ['arena-wep.png', 31, 31],
    ult: ['arena-ult.png', 31, 31],
    nit: ['arena-nit.png', 31, 31],
    shield: ['arena-shield.png', 31, 31],
    bolt: ['arena-bolt.png', 31, 31]
  };
  const pictures = {};
  const pickupCards = new Map();
  const url = (type) => ART[type] ? '/__engine/sprites/' + ART[type][0] : '';
  for (const type of Object.keys(ART)) {
    const image = new Image();
    image.onload = () => { if (typeof MapView !== 'undefined') MapView.draw(); };
    image.src = url(type);
    pictures[type] = image;
  }

  function drawSprite(ctx, type, x, y, angle, size) {
    const image = pictures[type];
    if (!image || !image.complete || !image.naturalWidth) return false;
    const spec = ART[type], w = size || spec[1], h = size || spec[2];
    ctx.save(); ctx.translate(x, y);
    if (angle) ctx.rotate(angle);
    ctx.drawImage(image, -w / 2, -h / 2, w, h);
    ctx.restore();
    return true;
  }

  function selected(ctx, p, on, radius) {
    if (!on) return;
    ctx.save(); ctx.strokeStyle = '#70d9eb'; ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]); ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]); ctx.restore();
  }

  const oldDrawAll = MapMarks.drawAll;
  const oldDrawRamp = MapMarks.drawRamp;
  const oldDrawStart = MapMarks.drawStart;
  const oldDrawItem = MapPreview.drawItem;

  function drawGate(ctx, gate, on, now) {
    if (!gate) return;
    if (!global.FinishGateArt) { oldDrawStart(ctx, gate, on); return; }
    const width = MapPreview.ROADW || 95;
    FinishGateArt.drawLine(ctx, gate, width);
    FinishGateArt.drawLabels(ctx, gate, width);
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    FinishGateArt.drawOverhead(ctx, gate, width, reduce ? 0 : (now || performance.now()) / 1000);
    selected(ctx, gate, on, 27);
  }

  function drawRamp(ctx, p, on) {
    const angle = Number.isFinite(+p.ang) ? +p.ang : 0;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(angle);
    for (let k = 1; k <= 3; k++) {
      ctx.fillStyle = 'rgba(204,174,112,.43)';
      ctx.beginPath(); ctx.moveTo(-28 * k + 20, 0);
      ctx.lineTo(-28 * k + 8, -8); ctx.lineTo(-28 * k + 8, -3);
      ctx.lineTo(-28 * k - 12, -3); ctx.lineTo(-28 * k - 12, 3);
      ctx.lineTo(-28 * k + 8, 3); ctx.lineTo(-28 * k + 8, 8);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    if (!drawSprite(ctx, 'ramp', p.x, p.y, angle - Math.PI / 2)) oldDrawRamp(ctx, p, on);
    selected(ctx, p, on, 42);
    if (Number.isFinite(+p.tx) && Number.isFinite(+p.ty)) {
      ctx.save(); ctx.strokeStyle = 'rgba(209,170,95,.65)'; ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.tx, p.ty); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    }
  }

  function drawHazard(ctx, type, p, on, time) {
    const angle = type === 'oil' ? (+p.rot || +p.ang || 0) : (+p.ang || 0);
    drawSprite(ctx, type, p.x, p.y, angle);
    if (global.RnRArenaEffects) {
      if (type === 'pad') RnRArenaEffects.drawPadLights(ctx, p.x, p.y, angle, time, p.cool == null || p.cool <= 0);
      if (type === 'mine') RnRArenaEffects.drawMineLight(ctx, p.x, p.y, time, p.x * .01);
    }
    selected(ctx, p, on, type === 'mine' ? 16 : 34);
  }

  MapMarks.drawStart = drawGate;
  MapMarks.drawRamp = drawRamp;
  MapMarks.drawAll = function (ctx, t, sel, now, cutStep) {
    // Keep the existing shortcut and in-progress cut rendering.
    oldDrawAll(ctx, { start: null, hazards: { ramps: [], mines: [], oils: [], pads: [] },
      shortcuts: t.shortcuts || [] }, sel, now, cutStep);
    drawGate(ctx, t.start, sel && sel.kind === 'start', now);
    for (const [list, type] of [['ramps', 'ramp'], ['mines', 'mine'], ['oils', 'oil'], ['pads', 'pad']]) {
      (t.hazards[list] || []).forEach((p, i) => {
        const on = sel && sel.kind === type && sel.i === i;
        if (type === 'ramp') drawRamp(ctx, p, on);
        else drawHazard(ctx, type, p, on, (now == null ? performance.now() : now) / 1000);
      });
    }
  };
  MapPreview.drawItem = function (ctx, item, zoom) {
    // Keep markers readable at overview zoom without changing their artwork.
    const size = 31 * Math.max(1, .6 / Math.max(.08, zoom || 1));
    if (global.RnRArenaEffects) RnRArenaEffects.drawPickupGlow(ctx, item.type, item.x, item.y, performance.now() / 1000, item.x * .01);
    if (!drawSprite(ctx, item.type, item.x, item.y, 0, size)) oldDrawItem(ctx, item, zoom);
  };

  if (typeof MapLayout !== 'undefined' && MapLayout.visible) {
    const oldVisible = MapLayout.visible;
    MapLayout.visible = function (track, spline) {
      const layout = oldVisible(track, spline);
      const preview = { ...layout, pads: (layout.pads || []).map((pad) => ({ ...pad })) };
      return global.RnRArenaEffects ? RnRArenaEffects.separateRampPads(preview) : preview;
    };
  }

  const extra = [
    ['ramp', 'Трамплин'], ['pad', 'Ускорение'], ['mine', 'Мина'], ['oil', 'Масло'],
    ['finish', 'Старт/финиш']
  ];
  let cleanPreview = false, previousSelection = null, previousTool = 'select';
  function installPreviewToggle() {
    if (typeof document.querySelector !== 'function' || document.getElementById('mapVisualPreview')) return;
    const tools = document.querySelector('.stage-tools');
    if (!tools) return;
    const button = document.createElement('button');
    button.type = 'button'; button.id = 'mapVisualPreview';
    button.className = 'game-preview-toggle';
    button.textContent = 'Чистый просмотр';
    button.title = 'Показать трассу без выделения и ручек редактирования';
    button.setAttribute('aria-pressed', 'false');
    button.onclick = () => {
      cleanPreview = !cleanPreview;
      if (cleanPreview) {
        previousSelection = MapView.selection(); previousTool = MapView.tool();
        MapView.setSelection(null); MapView.setTool('pan');
      } else {
        if (!MapView.selection()) MapView.setSelection(previousSelection);
        if (MapView.tool() === 'pan') MapView.setTool(previousTool);
      }
      button.textContent = cleanPreview ? 'Вернуться к правке' : 'Чистый просмотр';
      button.setAttribute('aria-pressed', String(cleanPreview));
      button.classList.toggle('active', cleanPreview);
      MapView.draw();
    };
    tools.appendChild(button);
  }
  function updateCards() {
    if (MapAssets.packId() !== 'items') return;
    const grid = document.getElementById('assetDockRow');
    if (!grid) return;
    const items = (global.RnRTracks && RnRTracks.ITEMS) || [];
    grid.querySelectorAll('.cb-tile:not(.game-preview-extra)').forEach((tile) => {
      const item = items.find((entry) => entry.name === tile.title);
      const thumb = tile.querySelector('.cb-thumb-item');
      if (!item || !thumb || thumb.querySelector('canvas') || thumb.querySelector('img')) return;
      thumb.textContent = '';
      const canvas = document.createElement('canvas');
      canvas.className = 'game-preview-item'; canvas.width = 112; canvas.height = 112;
      thumb.appendChild(canvas);
      pickupCards.set(canvas, item.id);
    });
    const query = (document.getElementById('assetSearch')?.value || '').toLowerCase();
    for (const [type, name] of extra) {
      if (query && !name.toLowerCase().includes(query) && !type.includes(query)) continue;
      if (grid.querySelector('[data-game-preview="' + type + '"]')) continue;
      const tile = document.createElement('button');
      tile.type = 'button'; tile.className = 'cb-tile game-preview-extra';
      tile.dataset.gamePreview = type; tile.title = name;
      const thumb = document.createElement('div'); thumb.className = 'cb-thumb cb-thumb-item';
      if (type === 'finish' || type === 'pad' || type === 'mine') {
        const canvas = document.createElement('canvas');
        canvas.className = 'game-preview-finish'; canvas.width = 112; canvas.height = 112;
        thumb.appendChild(canvas);
      } else {
        const image = document.createElement('img'); image.className = 'game-preview-img';
        image.src = url(type); image.alt = ''; thumb.appendChild(image);
      }
      const caption = document.createElement('span'); caption.textContent = name;
      tile.append(thumb, caption);
      tile.onclick = () => {
        if (type === 'finish') {
          const add = document.getElementById('mapAddStart');
          if (add && !add.hidden) add.click();
          else { MapView.setTool('select'); MapView.setSelection({ kind: 'start', i: 0 }); }
        } else {
          const tool = document.querySelector('[data-map-tool="' + type + '"]');
          if (tool) tool.click();
        }
      };
      grid.appendChild(tile);
    }
    const count = document.getElementById('assetCount');
    if (count) count.textContent = grid.querySelectorAll('.cb-tile').length + ' шт.';
  }
  const oldPaint = MapAssets.paint;
  MapAssets.paint = function () { const result = oldPaint.apply(this, arguments); updateCards(); return result; };
  updateCards();
  installPreviewToggle();
  const grid = document.getElementById('assetDockRow');
  if (grid && typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => updateCards());
    observer.observe(grid, { childList: true });
  }
  function drawFinishCard(now) {
    const tile = document.querySelector('[data-game-preview="finish"] canvas');
    if (!tile || !global.FinishGateArt || !tile.getContext) return;
    const ctx = tile.getContext('2d');
    ctx.clearRect(0, 0, tile.width, tile.height);
    ctx.save(); ctx.translate(tile.width / 2, tile.height / 2); ctx.scale(.24, .24);
    const gate = { x: 0, y: 0, ang: 0 };
    FinishGateArt.drawLine(ctx, gate, 95);
    FinishGateArt.drawLabels(ctx, gate, 95);
    FinishGateArt.drawOverhead(ctx, gate, 95, now / 1000);
    ctx.restore();
  }
  function drawHazardCards(now) {
    for (const type of ['pad', 'mine']) {
      const tile = document.querySelector('[data-game-preview="' + type + '"] canvas');
      if (!tile || !tile.getContext) continue;
      const ctx = tile.getContext('2d');
      ctx.clearRect(0, 0, tile.width, tile.height);
      ctx.save(); ctx.translate(tile.width / 2, tile.height / 2);
      ctx.scale(type === 'pad' ? 1.25 : 2, type === 'pad' ? 1.25 : 2);
      drawSprite(ctx, type, 0, 0, 0);
      if (global.RnRArenaEffects) {
        if (type === 'pad') RnRArenaEffects.drawPadLights(ctx, 0, 0, 0, now / 1000, true);
        else RnRArenaEffects.drawMineLight(ctx, 0, 0, now / 1000, 0);
      }
      ctx.restore();
    }
  }
  function drawPickupCards(now) {
    for (const [tile, type] of pickupCards) {
      if (tile.isConnected === false) { pickupCards.delete(tile); continue; }
      if (!tile.getContext) continue;
      const ctx = tile.getContext('2d');
      ctx.clearRect(0, 0, tile.width, tile.height);
      ctx.save(); ctx.translate(tile.width / 2, tile.height / 2); ctx.scale(1.25, 1.25);
      if (global.RnRArenaEffects) RnRArenaEffects.drawPickupGlow(ctx, type, 0, 0, now / 1000, 0);
      drawSprite(ctx, type, 0, 0, 0);
      ctx.restore();
    }
  }
  // Flag cloth uses race time in game; keep its editor preview moving while the map is open.
  setInterval(() => {
    if (document.visibilityState === 'hidden') return;
    if (typeof MapApp !== 'undefined' && MapApp.mapOn()) MapView.draw();
    if (MapAssets.packId() === 'items') {
      const now = performance.now();
      drawFinishCard(now);
      drawHazardCards(now);
      drawPickupCards(now);
    }
  }, 80);
  global.MapGamePreview = { ART, drawSprite, drawGate, updateCards, installPreviewToggle };
})(typeof window !== 'undefined' ? window : globalThis);
