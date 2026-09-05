////////////////////////////////////////////////////////
//
// Документ трассы: овал, клон стока, запись на диск
//
////////////////////////////////////////////////////////
'use strict';

const MapData = (() => {
  const ID_RE = /^[a-z0-9_]{2,40}$/;

  /** Простой стадион как стартовая петля. */
  function ovalCps() {
    const x0 = 420, x1 = 2780, y0 = 340, y1 = 1460, rad = 360, pts = [];
    const arc = (cx, cy, a0, a1, n) => {
      for (let i = 0; i <= n; i++) {
        const t = a0 + (a1 - a0) * i / n;
        pts.push([cx + rad * Math.cos(t), cy + rad * Math.sin(t)]);
      }
    };
    const line = (ax, ay, bx, by, n) => {
      for (let i = 1; i < n; i++) {
        const u = i / n;
        pts.push([ax + (bx - ax) * u, ay + (by - ay) * u]);
      }
    };
    line(x0 + rad, y1, x1 - rad, y1, 7);
    arc(x1 - rad, y1 - rad, Math.PI / 2, 0, 8);
    line(x1, y1 - rad, x1, y0 + rad, 7);
    arc(x1 - rad, y0 + rad, 0, -Math.PI / 2, 8);
    line(x1 - rad, y0, x0 + rad, y0, 7);
    arc(x0 + rad, y0 + rad, -Math.PI / 2, -Math.PI, 8);
    line(x0, y0 + rad, x0, y1 - rad, 7);
    arc(x0 + rad, y1 - rad, Math.PI, Math.PI / 2, 8);
    return pts;
  }

  /** Новый id без столкновения со списком. */
  function freshId(used) {
    const set = {};
    (used || []).forEach((id) => { set[id] = 1; });
    for (let n = 1; n < 100; n++) {
      const id = 'custom_' + String(n).padStart(2, '0');
      if (!set[id]) return id;
    }
    return 'custom_' + Date.now().toString(36);
  }

  /** Пустая трасса-овал. */
  function factory(id, name) {
    const theme = RnRTracks.themeById('sand');
    return RnRTracks.normalize({
      id: id || 'custom_01',
      name: name || 'СВОЯ ПЕТЛЯ',
      published: true,
      autoHazards: true,
      theme,
      zones: [{from: 0, to: 1, material: 'asphalt'}],
      cps: ovalCps(),
      decals: [],
      items: [],
      objects: [],
      hazards: {ramps: [], mines: [], oils: [], pads: []},
      shortcuts: []
    });
  }

  /** Клон стоковой трассы игры. */
  function fromStock(def, id) {
    const theme = def && def.theme ? def.theme : RnRTracks.themeById('sand');
    return RnRTracks.normalize({
      id,
      name: ((def && def.name) || 'КЛОН') + ' · ЧЕРНОВИК',
      published: true,
      autoHazards: true,
      theme,
      zones: def && def.zones,
      cps: def && def.cps,
      decals: [],
      items: [],
      objects: [],
      hazards: {ramps: [], mines: [], oils: [], pads: []},
      shortcuts: []
    });
  }

  /** Снимок без лишнего. */
  function fileTrack(doc) {
    const t = RnRTracks.normalize(doc);
    return {
      id: t.id,
      name: t.name,
      published: t.published !== false,
      autoHazards: !!t.autoHazards,
      theme: t.theme,
      zones: t.zones,
      cps: t.cps,
      decals: t.decals,
      items: t.items,
      objects: t.objects,
      start: t.start || null,
      hazards: t.hazards,
      shortcuts: t.shortcuts
    };
  }

  /** POST на локальный сервер / клиент. */
  async function save(doc, kind) {
    const track = fileTrack(doc);
    if (!ID_RE.test(track.id)) return {ok: false, error: 'Странный id трассы'};
    const body = JSON.stringify({id: track.id, track, kind: kind || 'work'});
    const r = await fetch('/__save-track', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      return {ok: false, error: 'Сервер ' + r.status + (txt ? ': ' + txt : '')};
    }
    return {ok: true, track};
  }

  /** Список файлов с сервера. */
  async function list() {
    const files = [];
    try {
      const r = await fetch('/__tracks', {cache: 'no-store'});
      if (r.ok) {
        const data = await r.json();
        if (data && Array.isArray(data.files)) return data.files;
      }
    } catch (err) { /* нет сервера */ }
    try {
      const r = await fetch('assets/data/tracks/index.json', {cache: 'no-store'});
      if (r.ok) {
        const data = await r.json();
        if (data && Array.isArray(data.files)) return data.files;
      }
    } catch (err2) { /* пусто */ }
    return files;
  }

  /** Грузит все документы. */
  async function loadAll() {
    const files = await list();
    const docs = [];
    for (let i = 0; i < files.length; i++) {
      const name = String(files[i] || '');
      const url = name.indexOf('/') >= 0 ? name : ('assets/data/tracks/' + name);
      try {
        const r = await fetch(url, {cache: 'no-store'});
        if (!r.ok) continue;
        docs.push(RnRTracks.normalize(await r.json()));
      } catch (err) { console.error(err); }
    }
    return docs;
  }

  return {ovalCps, freshId, factory, fromStock, fileTrack, save, list, loadAll, ID_RE};
})();
