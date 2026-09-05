////////////////////////////////////////////////////////
//
// Свои трассы: каталог деколей, загрузка JSON, выбор в игре
//
////////////////////////////////////////////////////////
'use strict';

window.RnRTracks = (() => {
  const DECALS = [
    {id: 'wreckage', name: 'Обломки', src: 'assets/image/textures/desert/desert_wreckage_v2.png'},
    {id: 'barrels', name: 'Бочки', src: 'assets/image/textures/desert/desert_barrels_v2.png'},
    {id: 'bones', name: 'Кости', src: 'assets/image/textures/desert/desert_bones_v2.png'},
    {id: 'rocks', name: 'Скалы', src: 'assets/image/textures/desert/desert_rocks_cacti.png'},
    {id: 'grass', name: 'Трава', src: 'assets/image/textures/desert/desert_dry_grass.png'},
    {id: 'tracks', name: 'Следы', src: 'assets/image/textures/desert/desert_car_tracks_v2.png'},
    {id: 'tires', name: 'Протекторы', src: 'assets/image/textures/desert/desert_tire_tracks.png'}
  ];
  const THEMES = [
    {id: 'sand', name: 'Пустыня', ground: '#b98a4e', dark: '#9a6f3a', road: '#43404b', line: '#d9c49a', deco: 'rock', map: 'sand'},
    {id: 'garden', name: 'Сад', ground: '#5c6b4a', dark: '#4a5739', road: '#3c3a42', line: '#c8d6a8', deco: 'skull', map: 'garden'},
    {id: 'desert', name: 'Каньон', ground: '#a05a3c', dark: '#83472e', road: '#4a4048', line: '#f0d9c0', deco: 'cactus', map: 'desert'},
    {id: 'snow', name: 'Лёд', ground: '#a8d5e8', dark: '#7fb3d4', road: '#2c4a5a', line: '#e8f4f8', deco: 'ice', map: 'snow'},
    {id: 'lava', name: 'Вулкан', ground: '#3a1810', dark: '#2a0f08', road: '#1a1210', line: '#ff6b3a', deco: 'lava', map: ''}
  ];
  const MATERIALS = [
    {id: 'asphalt', name: 'Асфальт'},
    {id: 'sand', name: 'Песок'},
    {id: 'dirt', name: 'Грязь'},
    {id: 'grass', name: 'Трава'},
    {id: 'ice', name: 'Лёд'},
    {id: 'snow', name: 'Снег'},
    {id: 'lava', name: 'Лава'}
  ];
  const ITEMS = [
    {id: 'money', name: 'Деньги'},
    {id: 'wrench', name: 'Ремкомплект'},
    {id: 'wep', name: 'Оружие'},
    {id: 'ult', name: 'Ульта'},
    {id: 'nit', name: 'Нитро'},
    {id: 'shield', name: 'Щит'},
    {id: 'bolt', name: 'Молния'}
  ];
  const WEATHER = [
    {id: 'clear', name: 'Ясно'},
    {id: 'rain', name: 'Дождь'},
    {id: 'snow', name: 'Снег'},
    {id: 'sand', name: 'Буря'},
    {id: 'ash', name: 'Извержение'}
  ];
  const tex = Object.create(null);
  let custom = [];

  /** Стоковые петли — те же, что в игре, чтобы клонировать в редакторе. */
  function figureEight() {
    const a = [];
    for (let i = 0; i < 28; i++) {
      const t = i / 28 * Math.PI * 2;
      a.push([1800 + 1350 * Math.sin(t), 1200 + 820 * Math.sin(2 * t)]);
    }
    return a;
  }
  const STOCK = [
    {name: 'ПЫЛЬНЫЙ ОВАЛ', theme: THEMES[0], zones: [{from: 0, to: .20, material: 'asphalt'}, {from: .20, to: .54, material: 'sand'}, {from: .54, to: .78, material: 'dirt'}, {from: .78, to: 1, material: 'asphalt'}],
      cps: [[420, 610], [1150, 420], [1980, 560], [2560, 380], [3180, 640], [3280, 1320], [2860, 1930], [2050, 2080], [1300, 1940], [760, 2060], [380, 1600], [300, 1000]]},
    {name: 'ПЕРЕКРЁСТОК СМЕРТИ', theme: THEMES[1], zones: [{from: 0, to: .28, material: 'asphalt'}, {from: .28, to: .48, material: 'grass'}, {from: .48, to: .72, material: 'asphalt'}, {from: .72, to: 1, material: 'dirt'}], cps: figureEight()},
    {name: 'КАНЬОН «КРУШЕНИЕ»', theme: THEMES[2], zones: [{from: 0, to: .25, material: 'dirt'}, {from: .25, to: .46, material: 'sand'}, {from: .46, to: .68, material: 'asphalt'}, {from: .68, to: 1, material: 'dirt'}],
      cps: [[520, 1980], [360, 1300], [620, 640], [1320, 520], [1780, 860], [2160, 1180], [2600, 860], [3120, 700], [3380, 1200], [3100, 1750], [2520, 1620], [2140, 1980], [1560, 1860], [1060, 2060]]},
    {name: 'ЛЕДЯНОЙ ПЕРЕВАЛ', theme: THEMES[3], zones: [{from: 0, to: .18, material: 'asphalt'}, {from: .18, to: .76, material: 'ice'}, {from: .76, to: 1, material: 'snow'}],
      cps: [[380, 520], [1080, 380], [1860, 620], [2540, 440], [3220, 680], [3360, 1380], [2940, 1980], [2180, 2120], [1420, 1960], [840, 2080], [460, 1640], [320, 1060]]},
    {name: 'ВУЛКАН ГИБЕЛИ', theme: THEMES[4], zones: [{from: 0, to: .22, material: 'asphalt'}, {from: .22, to: .44, material: 'lava'}, {from: .44, to: .70, material: 'asphalt'}, {from: .70, to: 1, material: 'lava'}],
      cps: [[480, 580], [1220, 420], [2040, 640], [2680, 480], [3340, 720], [3420, 1420], [3020, 2020], [2240, 2180], [1480, 2020], [880, 2140], [500, 1680], [360, 1080]]}
  ];

  const imgs = Object.create(null);

  /** Картинка по URL (земля, дорога, объект). */
  function texOf(url) {
    if (!url) return null;
    if (tex[url] && tex[url].complete && tex[url].naturalWidth) return tex[url];
    if (tex[url]) return tex[url];
    const im = new Image();
    im.src = url;
    tex[url] = im;
    return im;
  }

  /** Тема по id каталога. */
  function themeById(id) {
    return THEMES.find((t) => t.id === id) || THEMES[0];
  }

  /** Клетка старта из первых точек петли. */
  function startFromCps(cps) {
    if (!cps || cps.length < 2) return null;
    const a = cps[0], b = cps[1];
    return {x: a[0], y: a[1], ang: Math.atan2(b[1] - a[1], b[0] - a[0])};
  }

  /** Нормализует документ трассы для игры и редактора. */
  function normalize(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const themeIn = src.theme && typeof src.theme === 'object' ? src.theme : {};
    const theme = {
      ground: themeIn.ground || '#b98a4e',
      dark: themeIn.dark || '#9a6f3a',
      road: themeIn.road || '#43404b',
      line: themeIn.line || '#d9c49a',
      deco: themeIn.deco == null ? 'rock' : themeIn.deco,
      map: themeIn.map || 'sand',
      weather: String(themeIn.weather || ''),
      groundSrc: themeIn.groundSrc ? String(themeIn.groundSrc) : '',
      roadSrc: themeIn.roadSrc ? String(themeIn.roadSrc) : ''
    };
    const cps = Array.isArray(src.cps)
      ? src.cps.map((p) => [+p[0] || 0, +p[1] || 0]).filter((p) => isFinite(p[0]) && isFinite(p[1]))
      : [];
    const zones = Array.isArray(src.zones) && src.zones.length
      ? src.zones.map((z) => ({
        from: Math.max(0, Math.min(1, +z.from || 0)),
        to: Math.max(0, Math.min(1, +z.to || 1)),
        material: String(z.material || 'asphalt')
      }))
      : [{from: 0, to: 1, material: 'asphalt'}];
    const decals = Array.isArray(src.decals)
      ? src.decals.map((d) => ({
        id: String(d.id || 'wreckage'),
        x: +d.x || 0,
        y: +d.y || 0,
        ang: +d.ang || 0,
        scale: isFinite(+d.scale) ? Math.max(0.15, Math.min(6, +d.scale)) : 1,
        src: d.src ? String(d.src) : ''
      }))
      : [];
    const items = Array.isArray(src.items)
      ? src.items.map((p) => ({type: String(p.type || 'money'), x: +p.x || 0, y: +p.y || 0}))
      : [];
    const objects = Array.isArray(src.objects)
      ? src.objects.map((o) => ({
        pack: String(o.pack || 'world'),
        id: String(o.id || ''),
        x: +o.x || 0,
        y: +o.y || 0,
        w: Math.max(8, +o.w || 128),
        h: Math.max(8, +o.h || 128),
        ang: +o.ang || 0,
        layer: o.layer === 'over' ? 'over' : 'under',
        lockRatio: o.lockRatio !== false
      })).filter((o) => o.id)
      : [];
    let start = null;
    if (Object.prototype.hasOwnProperty.call(src, 'start')) {
      start = src.start && isFinite(+src.start.x) && isFinite(+src.start.y)
        ? {x: +src.start.x, y: +src.start.y, ang: +src.start.ang || 0}
        : null;
    } else {
      start = startFromCps(cps);
    }
    const hz = src.hazards && typeof src.hazards === 'object' ? src.hazards : {};
    const pt = (a) => Array.isArray(a)
      ? a.map((p) => ({
        x: +p.x || 0,
        y: +p.y || 0,
        lat: isFinite(+p.lat) ? +p.lat : 0,
        ang: p.ang == null ? undefined : +p.ang,
        rot: p.rot == null ? undefined : +p.rot,
        tx: p.tx == null ? undefined : +p.tx,
        ty: p.ty == null ? undefined : +p.ty
      }))
      : [];
    return {
      id: String(src.id || 'custom').replace(/[^a-z0-9_]/gi, '_').toLowerCase() || 'custom',
      name: String(src.name || 'СВОЯ ТРАССА').slice(0, 42),
      published: src.published !== false,
      custom: true,
      theme,
      zones,
      cps,
      decals,
      items,
      objects,
      start,
      hazards: {ramps: pt(hz.ramps), mines: pt(hz.mines), oils: pt(hz.oils), pads: pt(hz.pads)},
      autoHazards: src.autoHazards !== false,
      shortcuts: Array.isArray(src.shortcuts)
        ? src.shortcuts.map((s) => ({
          name: String(s.name || 'СРЕЗ'),
          bonus: +s.bonus || 180,
          radius: +s.radius || 80,
          entry: Array.isArray(s.entry) ? [+s.entry[0] || 0, +s.entry[1] || 0] : [0, 0],
          exit: Array.isArray(s.exit) ? [+s.exit[0] || 0, +s.exit[1] || 0] : [0, 0]
        }))
        : []
    };
  }

  /** Подгружает спрайты деколей. */
  function preloadDecals() {
    return Promise.all(DECALS.map((d) => new Promise((res) => {
      if (imgs[d.id] && imgs[d.id].complete) { res(); return; }
      const im = imgs[d.id] || new Image();
      im.onload = () => res();
      im.onerror = () => res();
      im.src = d.src;
      imgs[d.id] = im;
      if (im.complete && im.naturalWidth) res();
    })));
  }

  /** Список JSON из индекса или ответа сервера. */
  async function fetchIndex() {
    try {
      const r = await fetch('/__tracks', {cache: 'no-store'});
      if (r.ok) {
        const data = await r.json();
        if (data && Array.isArray(data.files)) return data.files;
      }
    } catch (err) { /* file:// или нет сервера */ }
    try {
      const r = await fetch('assets/data/tracks/index.json', {cache: 'no-store'});
      if (!r.ok) return [];
      const data = await r.json();
      return (data && data.files) || [];
    } catch (err) {
      return [];
    }
  }

  /** Читает опубликованные трассы с диска. */
  async function load() {
    await preloadDecals();
    const files = await fetchIndex();
    const out = [];
    for (let i = 0; i < files.length; i++) {
      const name = String(files[i] || '');
      if (!name) continue;
      const url = name.indexOf('/') >= 0 ? name : ('assets/data/tracks/' + name);
      try {
        const r = await fetch(url, {cache: 'no-store'});
        if (!r.ok) continue;
        const def = normalize(await r.json());
        if (def.cps.length >= 4) {
          out.push(def);
          if (def.theme.groundSrc) texOf(def.theme.groundSrc);
          if (def.theme.roadSrc) texOf(def.theme.roadSrc);
        }
      } catch (err) { console.error(err); }
    }
    custom = out;
    return custom;
  }

  /** Трассы для сетки выбора: сток плюс опубликованные свои. */
  function pickable(stock) {
    const base = Array.isArray(stock) ? stock : [];
    return base.concat(custom.filter((t) => t.published !== false && t.cps && t.cps.length >= 4));
  }

  /** Ищет свою трассу по id. */
  function find(id) {
    return custom.find((t) => t.id === id) || null;
  }

  /** Рисует деколи в мировых координатах холста трассы. */
  function paintDecals(ctx, decals) {
    if (!ctx || !decals || !decals.length) return;
    for (let i = 0; i < decals.length; i++) {
      const d = decals[i];
      const im = (d.src && texOf(d.src)) || imgs[d.id];
      if (!im || !im.complete || !im.naturalWidth) continue;
      const w = im.naturalWidth * (d.scale || 1);
      const h = im.naturalHeight * (d.scale || 1);
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.ang || 0);
      ctx.globalAlpha = 0.92;
      ctx.drawImage(im, -w / 2, -h / 2, w, h);
      ctx.restore();
    }
  }

  /** Ближайшая точка сплайна. */
  function nearest(T, x, y) {
    const S = T && T.S;
    if (!S || !S.length) return null;
    let best = 0, bd = 1e18;
    for (let i = 0; i < S.length; i++) {
      const dx = S[i].x - x, dy = S[i].y - y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = i; }
    }
    const p = S[best];
    return {i: best, x: p.x, y: p.y, ang: p.ang, nx: p.nx, ny: p.ny};
  }

  /** Ставит ручные опасности на сплайн. */
  function fromPlan(T, plan) {
    const empty = {pads: [], ramps: [], mines: [], oils: [], picks: []};
    if (!T || !plan) return empty;
    const place = (list, offRoad, keep) => (list || []).map((p) => {
      const n = nearest(T, p.x, p.y);
      if (!n) return null;
      const lat = offRoad ? (isFinite(+p.lat) ? +p.lat : 0) : 0;
      const ang = isFinite(+p.ang) ? +p.ang : n.ang;
      const rot = isFinite(+p.rot) ? +p.rot : ang;
      const x = keep ? p.x : n.x + (offRoad ? n.nx * lat : 0);
      const y = keep ? p.y : n.y + (offRoad ? n.ny * lat : 0);
      return {i: n.i, x, y, ang, rot, lat, cool: 0};
    }).filter(Boolean);
    return {
      pads: place(plan.pads, false, true),
      ramps: place(plan.ramps, false, true),
      mines: place(plan.mines, true, true),
      oils: place(plan.oils, true, true),
      picks: (plan.picks || []).map((p) => {
        const n = nearest(T, p.x, p.y);
        if (!n) return {type: p.type || 'money', x: p.x, y: p.y, i: 0, alive: true, rt: 0, val: 20};
        return {type: p.type || 'money', x: p.x, y: p.y, i: n.i, alive: true, rt: 0, val: 20};
      })
    };
  }

  return {
    DECALS, THEMES, MATERIALS, ITEMS, WEATHER, STOCK, normalize, startFromCps, preloadDecals, load, pickable, find,
    paintDecals, nearest, fromPlan, themeById, texOf,
    get custom() { return custom; }
  };
})();
