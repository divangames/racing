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

  /** Клон стоковой трассы игры: петля как в карьере, авто-бонусы на холсте. */
  function fromStock(def, id, stockIdx) {
    const theme = def && def.theme ? def.theme : RnRTracks.themeById('sand');
    const doc = RnRTracks.normalize({
      id,
      name: ((def && def.name) || 'КЛОН') + ' · ЧЕРНОВИК',
      published: true,
      autoHazards: def && def.autoHazards === false ? false : true,
      theme,
      zones: def && def.zones,
      cps: def && def.cps,
      decals: (def && def.decals) || [],
      items: (def && def.items) || [],
      objects: (def && def.objects) || [],
      hazards: (def && def.hazards) || {ramps: [], mines: [], oils: [], pads: []},
      shortcuts: (def && def.shortcuts) || []
    });
    if (stockIdx != null && Number.isFinite(+stockIdx)) doc.stockIdx = +stockIdx;
    return doc;
  }

  /** Сюжетная петля главы, не своя. */
  function isChapter(doc) {
    if (!doc) return false;
    if ((doc.chapter | 0) > 0) return true;
    return /^ch\d+_/.test(String(doc.id || ''));
  }

  /** Снимок без лишнего. */
  function fileTrack(doc) {
    const t = RnRTracks.normalize(doc);
    const out = {
      id: t.id,
      name: t.name,
      published: t.published !== false,
      autoHazards: !!t.autoHazards,
      theme: t.theme,
      zones: t.zones,
      gaps: t.gaps,
      decks: t.decks,
      cps: t.cps,
      decals: t.decals,
      items: t.items,
      objects: t.objects,
      start: t.start || null,
      hazards: t.hazards,
      shortcuts: t.shortcuts
    };
    if (isChapter(t)) {
      out.chapter = t.chapter;
      out.chapterId = t.chapterId;
      out.chapterTitle = t.chapterTitle;
    }
    return out;
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
  async function catalog() {
    try {
      const r = await fetch('/__tracks', {cache: 'no-store'});
      if (r.ok) {
        const data = await r.json();
        if (data && Array.isArray(data.files)) {
          return {files: data.files, chapters: Array.isArray(data.chapters) ? data.chapters : []};
        }
      }
    } catch (err) { /* нет сервера */ }
    try {
      const r = await fetch('assets/data/tracks/index.json', {cache: 'no-store'});
      const data = r.ok ? await r.json() : {};
      let chapters = Array.isArray(data.chapters) ? data.chapters : [];
      if (!chapters.length) {
        const c = await fetch('assets/data/tracks/chapters/index.json', {cache: 'no-store'});
        if (c.ok) {
          const cj = await c.json();
          chapters = (cj.files || []).map((n) => String(n).indexOf('/') >= 0 ? n : ('chapters/' + n));
        }
      }
      return {files: (data && data.files) || [], chapters};
    } catch (err2) { /* пусто */ }
    return {files: [], chapters: []};
  }

  /** Список своих файлов. */
  async function list() {
    return (await catalog()).files;
  }

  /** Читает один JSON. */
  async function readFile(name) {
    const url = name.indexOf('/') >= 0 ? ('assets/data/tracks/' + name.replace(/^assets\/data\/tracks\//, '')) : ('assets/data/tracks/' + name);
    const r = await fetch(url, {cache: 'no-store'});
    if (!r.ok) return null;
    return RnRTracks.normalize(await r.json());
  }

  /** Грузит свои и сюжетные документы. */
  async function loadAll() {
    const cat = await catalog();
    const docs = [];
    const names = cat.files.concat(cat.chapters);
    for (let i = 0; i < names.length; i++) {
      const name = String(names[i] || '');
      try {
        if (typeof LabSplash !== 'undefined' && LabSplash.file) {
          LabSplash.file('Карты · ' + name.replace(/^assets\/data\/tracks\//, '') + ' · ' + (i + 1) + ' / ' + names.length);
        }
        const doc = await readFile(name);
        if (doc && doc.cps.length >= 4) docs.push(doc);
      } catch (err) { console.error(err); }
    }
    const have = {};
    docs.forEach((d) => { have[d.id] = 1; });
    const generated = (RnRTracks.chapterTracks && RnRTracks.chapterTracks()) || [];
    generated.forEach((st) => {
      if (have[st.id]) return;
      docs.push(RnRTracks.normalize(st));
    });
    return docs;
  }

  return {ovalCps, freshId, factory, fromStock, fileTrack, save, list, loadAll, ID_RE, isChapter};
})();
