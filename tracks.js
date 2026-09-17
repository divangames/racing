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
    {id: 'lava', name: 'Вулкан', ground: '#3a1810', dark: '#2a0f08', road: '#1a1210', line: '#ff6b3a', deco: 'lava', map: ''},
    {id: 'arena', name: 'Арена', ground: '#16110e', dark: '#0a0807', road: '#2c2622', line: '#e08a3a', deco: 'wreck', map: 'arena'}
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

  /** Клевер: две магистрали крест-накрест и съезды. */
  function cloverInterchange() {
    return [
      [380, 1480], [820, 1460], [1280, 1490], [1760, 1510], [2280, 1480], [2780, 1440], [3220, 1380],
      [3480, 1180], [3420, 900], [3180, 700], [2780, 620], [2280, 640], [1760, 610], [1240, 640], [780, 700],
      [480, 880], [360, 1120], [420, 1380], [680, 1620], [1080, 1820], [1580, 1900], [2140, 1880], [2680, 1820],
      [3120, 1680], [3360, 1460], [3180, 1180], [2780, 1040], [2280, 1080], [1760, 1020], [1260, 1080], [820, 1020],
      [560, 1160], [440, 1340]
    ];
  }

  /** Эстакада: восьмёрка, нитки пересекаются в центре. */
  function stackInterchange() {
    const a = [];
    for (let i = 0; i < 28; i++) {
      const t = i / 28 * Math.PI * 2;
      a.push([1800 + 1350 * Math.sin(t), 1200 + 820 * Math.sin(2 * t)]);
    }
    return a;
  }

  /** Турбина: три петли и три пересечения. */
  function turbineInterchange() {
    const a = [];
    for (let i = 0; i < 36; i++) {
      const t = i / 36 * Math.PI * 2;
      a.push([
        1800 + 420 * (Math.sin(t) + 2 * Math.sin(2 * t)),
        1200 + 380 * (Math.cos(t) - 2 * Math.cos(2 * t))
      ]);
    }
    return a;
  }

  /**
   * Сжимает и поворачивает петлю, чтобы биомы не копировали силуэт.
   * @param {number[][]} cps
   * @param {number} sx
   * @param {number} sy
   * @param {number} rot
   * @returns {number[][]}
   */
  function warpCps(cps, sx, sy, rot) {
    const cx = 1800, cy = 1200, c = Math.cos(rot), s = Math.sin(rot);
    return cps.map(function (p) {
      const dx = (p[0] - cx) * sx, dy = (p[1] - cy) * sy;
      return [cx + dx * c - dy * s, cy + dx * s + dy * c];
    });
  }

  const LAYOUTS = [cloverInterchange, stackInterchange, turbineInterchange];
  const BIOME_WARP = [
    [1, 1, 0],
    [1.06, 0.92, 0.28],
    [0.94, 1.1, -0.22],
    [1.08, 1.02, 0.45],
    [0.9, 1.12, -0.38]
  ];
  const BIOME_PACKS = [
    {
      theme: 0,
      tracks: [
        {name: 'ПЫЛЬНЫЙ ОВАЛ', gaps: [{from: .20, to: .245}], cut: {entry: [800, 500], exit: [2400, 450], radius: 80, bonus: 180, name: 'ПУСТЫННЫЙ ПРОЛОМ'},
          zones: [{from: 0, to: .20, material: 'asphalt'}, {from: .20, to: .54, material: 'sand'}, {from: .54, to: .78, material: 'dirt'}, {from: .78, to: 1, material: 'asphalt'}]},
        {name: 'ЭСТАКАДА КАРАВАНА', gaps: [{from: .22, to: .27}], cut: {entry: [700, 900], exit: [2500, 1400], radius: 85, bonus: 200, name: 'ТЕНЬ КАРАВАНА'},
          zones: [{from: 0, to: .18, material: 'sand'}, {from: .18, to: .52, material: 'asphalt'}, {from: .52, to: .82, material: 'dirt'}, {from: .82, to: 1, material: 'sand'}]},
        {name: 'ТУРБИНА ШАКАЛОВ', gaps: [{from: .15, to: .20}], cut: {entry: [900, 1100], exit: [2600, 1300], radius: 88, bonus: 210, name: 'КЛЫК ШАКАЛА'},
          zones: [{from: 0, to: .30, material: 'dirt'}, {from: .30, to: .62, material: 'sand'}, {from: .62, to: 1, material: 'asphalt'}]}
      ]
    },
    {
      theme: 1,
      tracks: [
        {name: 'ПЕРЕКРЁСТОК СМЕРТИ', gaps: [{from: .20, to: .245}], cut: {entry: [1200, 900], exit: [2400, 1500], radius: 90, bonus: 220, name: 'ЧЕРЕЗ КЛАДБИЩЕ'},
          zones: [{from: 0, to: .28, material: 'asphalt'}, {from: .28, to: .48, material: 'grass'}, {from: .48, to: .72, material: 'asphalt'}, {from: .72, to: 1, material: 'dirt'}]},
        {name: 'КЛЕВЕР МОГИЛЬНИКА', gaps: [{from: .22, to: .27}], cut: {entry: [1000, 800], exit: [2500, 1600], radius: 86, bonus: 205, name: 'МЕЖДУ ПЛИТ'},
          zones: [{from: 0, to: .22, material: 'grass'}, {from: .22, to: .58, material: 'asphalt'}, {from: .58, to: 1, material: 'dirt'}]},
        {name: 'КОЛЬЦО ЖЕРТВ', gaps: [{from: .15, to: .20}], cut: {entry: [1100, 1000], exit: [2550, 1450], radius: 84, bonus: 215, name: 'АЛТАРНЫЙ СРЕЗ'},
          zones: [{from: 0, to: .35, material: 'asphalt'}, {from: .35, to: .70, material: 'grass'}, {from: .70, to: 1, material: 'asphalt'}]}
      ]
    },
    {
      theme: 2,
      tracks: [
        {name: 'КАНЬОН «КРУШЕНИЕ»', gaps: [{from: .20, to: .245}], cut: {entry: [900, 1200], exit: [2600, 1400], radius: 85, bonus: 200, name: 'СКАЛА СМЕРТИ'},
          zones: [{from: 0, to: .25, material: 'dirt'}, {from: .25, to: .46, material: 'sand'}, {from: .46, to: .68, material: 'asphalt'}, {from: .68, to: 1, material: 'dirt'}]},
        {name: 'ТРУБА ОБВАЛА', gaps: [{from: .22, to: .27}], cut: {entry: [800, 1000], exit: [2700, 1500], radius: 90, bonus: 225, name: 'ДЫРА В СКАЛЕ'},
          zones: [{from: 0, to: .20, material: 'sand'}, {from: .20, to: .55, material: 'dirt'}, {from: .55, to: 1, material: 'asphalt'}]},
        {name: 'РАЗВЯЗКА УЩЕЛЬЯ', gaps: [{from: .15, to: .20}], cut: {entry: [950, 900], exit: [2500, 1550], radius: 82, bonus: 190, name: 'УЗКИЙ КАРНИЗ'},
          zones: [{from: 0, to: .32, material: 'asphalt'}, {from: .32, to: .66, material: 'sand'}, {from: .66, to: 1, material: 'dirt'}]}
      ]
    },
    {
      theme: 3,
      tracks: [
        {name: 'ЛЕДЯНОЙ ПЕРЕВАЛ', gaps: [{from: .20, to: .245}], cut: {entry: [700, 800], exit: [2800, 1000], radius: 95, bonus: 240, name: 'ЛЕДЯНОЙ МОСТ'},
          zones: [{from: 0, to: .18, material: 'asphalt'}, {from: .18, to: .76, material: 'ice'}, {from: .76, to: 1, material: 'snow'}]},
        {name: 'ЭСТАКАДА ВЬЮГИ', gaps: [{from: .22, to: .27}], cut: {entry: [750, 900], exit: [2650, 1300], radius: 88, bonus: 230, name: 'НАСТ'},
          zones: [{from: 0, to: .24, material: 'snow'}, {from: .24, to: .70, material: 'ice'}, {from: .70, to: 1, material: 'asphalt'}]},
        {name: 'КЛЕВЕР ПОЛЮСА', gaps: [{from: .15, to: .20}], cut: {entry: [850, 700], exit: [2550, 1400], radius: 92, bonus: 235, name: 'ТРЕЩИНА'},
          zones: [{from: 0, to: .40, material: 'ice'}, {from: .40, to: .72, material: 'snow'}, {from: .72, to: 1, material: 'ice'}]}
      ]
    },
    {
      theme: 4,
      tracks: [
        {name: 'ВУЛКАН ГИБЕЛИ', gaps: [{from: .20, to: .245}], cut: {entry: [1000, 1100], exit: [2900, 1600], radius: 80, bonus: 210, name: 'ЛАВОВЫЙ ТОННЕЛЬ'},
          zones: [{from: 0, to: .22, material: 'asphalt'}, {from: .22, to: .44, material: 'lava'}, {from: .44, to: .70, material: 'asphalt'}, {from: .70, to: 1, material: 'lava'}]},
        {name: 'РАЗВЯЗКА КРАТЕРА', gaps: [{from: .22, to: .27}], cut: {entry: [900, 1000], exit: [2700, 1500], radius: 86, bonus: 220, name: 'ЖЁЛОБ ПЕПЛА'},
          zones: [{from: 0, to: .28, material: 'lava'}, {from: .28, to: .60, material: 'asphalt'}, {from: .60, to: 1, material: 'lava'}]},
        {name: 'ЭСТАКАДА ПЕПЛА', gaps: [{from: .15, to: .20}], cut: {entry: [1100, 900], exit: [2600, 1550], radius: 84, bonus: 205, name: 'МОСТ НАД МАГМОЙ'},
          zones: [{from: 0, to: .18, material: 'asphalt'}, {from: .18, to: .55, material: 'lava'}, {from: .55, to: 1, material: 'asphalt'}]}
      ]
    }
  ];

  /** Сток: три развязки на биом, сетка выбора — ряд на биом. */
  const STOCK = [];
  BIOME_PACKS.forEach(function (pack, bi) {
    const w = BIOME_WARP[bi];
    const theme = Object.assign({}, THEMES[pack.theme]);
    pack.tracks.forEach(function (tr, li) {
      STOCK.push({
        name: tr.name,
        theme: Object.assign({}, theme),
        zones: tr.zones,
        gaps: tr.gaps,
        shortcuts: [tr.cut],
        cps: warpCps(LAYOUTS[li](), w[0], w[1], w[2])
      });
    });
  });

  ////////////////////////////////////////////////////////
  //
  // Глава 1: тёмная арена, широкие петли без развязок.
  //
  ////////////////////////////////////////////////////////

  /**
   * Овал с лёгкой деформацией. Без пересечений ниток.
   * @param {number} rx
   * @param {number} ry
   * @param {number} n
   * @param {number} [rot]
   * @param {number} [pinch]
   * @param {number} [egg]
   * @param {number} [wave]
   * @returns {number[][]}
   */
  function easyLoop(rx, ry, n, rot, pinch, egg, wave) {
    const c = Math.cos(rot || 0), s = Math.sin(rot || 0);
    const a = [];
    const count = n || 24;
    for (let i = 0; i < count; i++) {
      const t = i / count * Math.PI * 2;
      let x = rx * Math.cos(t);
      let y = ry * Math.sin(t);
      if (pinch) x *= 1 + pinch * Math.cos(2 * t);
      if (egg) y *= 1 + egg * Math.sin(t);
      if (wave) {
        const m = 1 + wave * Math.sin(3 * t);
        x *= m;
        y *= m;
      }
      a.push([1800 + x * c - y * s, 1200 + x * s + y * c]);
    }
    return a;
  }

  /**
   * Стадион: две прямые и широкие дуги.
   * @returns {number[][]}
   */
  function easyStadium() {
    const x0 = 620, x1 = 2980, y0 = 480, y1 = 1920, rad = 420, pts = [];
    const arc = function (cx, cy, a0, a1, steps) {
      for (let i = 0; i <= steps; i++) {
        const t = a0 + (a1 - a0) * i / steps;
        pts.push([cx + rad * Math.cos(t), cy + rad * Math.sin(t)]);
      }
    };
    const line = function (ax, ay, bx, by, steps) {
      for (let i = 1; i < steps; i++) {
        const u = i / steps;
        pts.push([ax + (bx - ax) * u, ay + (by - ay) * u]);
      }
    };
    line(x0 + rad, y1, x1 - rad, y1, 6);
    arc(x1 - rad, y1 - rad, Math.PI / 2, 0, 7);
    line(x1, y1 - rad, x1, y0 + rad, 6);
    arc(x1 - rad, y0 + rad, 0, -Math.PI / 2, 7);
    line(x1 - rad, y0, x0 + rad, y0, 6);
    arc(x0 + rad, y0 + rad, -Math.PI / 2, -Math.PI, 7);
    line(x0, y0 + rad, x0, y1 - rad, 6);
    arc(x0 + rad, y1 - rad, Math.PI, Math.PI / 2, 7);
    return pts;
  }

  /**
   * Триовал: нижняя дуга чуть площе.
   * @returns {number[][]}
   */
  function easyTriOval() {
    const a = [];
    for (let i = 0; i < 26; i++) {
      const t = i / 26 * Math.PI * 2;
      const sy = Math.sin(t) < 0 ? 0.72 : 1;
      a.push([1800 + 1180 * Math.cos(t), 1180 + 640 * Math.sin(t) * sy]);
    }
    return a;
  }

  const ARENA_THEME = Object.assign({}, THEMES.find(function (t) { return t.id === 'arena'; }), {weather: 'clear'});
  const CHAPTER_PACKS = [
    {
      chapter: 1,
      id: 'ch1_arena',
      title: 'Глава 1 · Арена',
      tracks: [
        {name: 'НОЧНОЙ ОВАЛ', cps: easyLoop(1120, 640, 24), zones: [{from: 0, to: 1, material: 'asphalt'}]},
        {name: 'ЧАША ПЫЛИ', cps: easyLoop(880, 760, 24, 0.12), zones: [{from: 0, to: .55, material: 'asphalt'}, {from: .55, to: 1, material: 'dirt'}]},
        {name: 'СТАДИОН РЖАВЧИНЫ', cps: easyStadium(), zones: [{from: 0, to: 1, material: 'asphalt'}]},
        {name: 'ПОЧКА ВОРОНА', cps: easyLoop(1040, 620, 26, -0.18, 0.2), zones: [{from: 0, to: .4, material: 'asphalt'}, {from: .4, to: .78, material: 'sand'}, {from: .78, to: 1, material: 'asphalt'}]},
        {name: 'ДЛИННЫЙ ЖЁЛОБ', cps: easyLoop(1380, 460, 24, 0.08), zones: [{from: 0, to: 1, material: 'asphalt'}]},
        {name: 'КОЛЬЦО ФАКЕЛОВ', cps: easyLoop(640, 620, 22), zones: [{from: 0, to: .7, material: 'asphalt'}, {from: .7, to: 1, material: 'dirt'}]},
        {name: 'ЯЙЦО АРЕНЫ', cps: easyLoop(980, 700, 24, 0.35, 0, 0.22), zones: [{from: 0, to: 1, material: 'asphalt'}]},
        {name: 'ДВОЙНАЯ ЧАША', cps: easyLoop(1080, 580, 28, 0, 0.28), zones: [{from: 0, to: .5, material: 'dirt'}, {from: .5, to: 1, material: 'asphalt'}]},
        {name: 'ТРИОВАЛ КЛЕТОК', cps: easyTriOval(), zones: [{from: 0, to: 1, material: 'asphalt'}]},
        {name: 'КОНТУР БОЙНИ', cps: easyLoop(1000, 680, 28, -0.22, 0.08, 0, 0.07), zones: [{from: 0, to: .62, material: 'asphalt'}, {from: .62, to: 1, material: 'sand'}]}
      ]
    }
  ];

  /** Сюжетные петли: глава, имя, биом. */
  const CHAPTER_TRACKS = [];
  CHAPTER_PACKS.forEach(function (pack) {
    pack.tracks.forEach(function (tr, i) {
      CHAPTER_TRACKS.push({
        name: tr.name,
        chapter: pack.chapter,
        chapterId: pack.id,
        chapterTitle: pack.title,
        id: pack.id + '_' + String(i + 1).padStart(2, '0'),
        theme: Object.assign({}, ARENA_THEME),
        zones: tr.zones,
        gaps: [],
        shortcuts: [],
        autoHazards: false,
        cps: tr.cps
      });
    });
  });

  /** JSON из папки глав перекрывает формулы. */
  const chapterOverride = Object.create(null);

  /**
   * Берёт сохранённую петлю главы в живой каталог.
   * @param {object} doc
   */
  function adoptChapter(doc) {
    const t = normalize(doc);
    if (!t.id || t.cps.length < 4) return;
    if (!t.chapter) return;
    chapterOverride[t.id] = t;
  }

  /**
   * Петли сюжета. Без номера — все главы. Сначала файл, иначе формула.
   * @param {number} [chapter]
   * @returns {object[]}
   */
  function chapterTracks(chapter) {
    const byId = Object.create(null);
    CHAPTER_TRACKS.forEach(function (t) { byId[t.id] = t; });
    Object.keys(chapterOverride).forEach(function (id) {
      const t = chapterOverride[id];
      if (t && t.cps && t.cps.length >= 4) byId[id] = t;
    });
    const list = Object.keys(byId).sort().map(function (id) { return byId[id]; });
    if (chapter == null) return list.slice();
    return list.filter(function (t) { return t.chapter === chapter; });
  }

  /**
   * Пачки глав для списка редактора.
   * @returns {object[]}
   */
  function chapterPacks() {
    return CHAPTER_PACKS.map(function (p) {
      return {chapter: p.chapter, id: p.id, title: p.title, count: p.tracks.length};
    });
  }

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

  /**
   * Масштаб клетки фона: 1 = 64 мира. Сначала трасса, иначе биом лаборатории.
   * @param {object} [theme]
   * @returns {number}
   */
  function groundScaleOf(theme) {
    const n = theme && +theme.groundScale;
    if (Number.isFinite(n) && n > 0) return Math.max(0.25, Math.min(4, n));
    const id = theme && theme.map;
    if (id && typeof MapTex !== 'undefined' && MapTex.catalog) {
      const hit = (MapTex.catalog.biomes || []).find((b) => b.id === id);
      if (hit && Number.isFinite(+hit.scale) && +hit.scale > 0) {
        return Math.max(0.25, Math.min(4, +hit.scale));
      }
    }
    if (id && typeof MAP_BIOME_SCALE !== 'undefined' && Number.isFinite(+MAP_BIOME_SCALE[id])) {
      return Math.max(0.25, Math.min(4, +MAP_BIOME_SCALE[id]));
    }
    return 1;
  }

  /**
   * Звук трибуны: по умолчанию включён, выключается только явно.
   * @param {object} [theme]
   * @returns {boolean}
   */
  function crowdSoundOn(theme) {
    return !theme || theme.crowdSound !== false;
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
      roadSrc: themeIn.roadSrc ? String(themeIn.roadSrc) : '',
      railSrc: themeIn.railSrc ? String(themeIn.railSrc) : '',
      groundScale: Math.max(0.25, Math.min(4, Number.isFinite(+themeIn.groundScale) ? +themeIn.groundScale : 1)),
      crowdSound: themeIn.crowdSound !== false
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
    const gaps = Array.isArray(src.gaps)
      ? src.gaps.map((g) => ({
        from: Math.max(0, Math.min(1, +g.from || 0)),
        to: Math.max(0, Math.min(1, +g.to || 0))
      })).filter((g) => g.from !== g.to)
      : [];
    const decks = Array.isArray(src.decks)
      ? src.decks.map((d) => ({
        from: Math.max(0, Math.min(1, +d.from || 0)),
        to: Math.max(0, Math.min(1, +d.to || 0)),
        z: Math.max(1, Math.min(3, (d.z | 0) || 1))
      })).filter((d) => d.from !== d.to)
      : [];
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
        layer: o.carLayer === 'over' || o.layer === 'over' ? 'over' : 'under',
        carLayer: o.carLayer === 'over' || o.layer === 'over' ? 'over' : 'under',
        roadLayer: o.roadLayer === 'under' ? 'under' : 'over',
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
    const id = String(src.id || 'custom').replace(/[^a-z0-9_]/gi, '_').toLowerCase() || 'custom';
    const chMatch = id.match(/^ch(\d+)_/);
    const chapter = Math.max(0, src.chapter | 0) || (chMatch ? +chMatch[1] : 0);
    const isChapter = chapter > 0;
    return {
      id,
      name: String(src.name || 'СВОЯ ТРАССА').slice(0, 42),
      published: src.published !== false,
      custom: !isChapter,
      chapter,
      chapterId: src.chapterId ? String(src.chapterId) : (isChapter ? id.replace(/_\d+$/, '') : ''),
      chapterTitle: src.chapterTitle ? String(src.chapterTitle) : '',
      theme,
      zones,
      gaps,
      decks,
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

  /**
   * Каталог своих и сюжетных JSON.
   * @returns {Promise<{files:string[],chapters:string[]}>}
   */
  async function fetchCatalog() {
    const empty = {files: [], chapters: []};
    try {
      const r = await fetch('/__tracks', {cache: 'no-store'});
      if (r.ok) {
        const data = await r.json();
        if (data && Array.isArray(data.files)) {
          return {
            files: data.files,
            chapters: Array.isArray(data.chapters) ? data.chapters : []
          };
        }
      }
    } catch (err) { /* file:// или нет сервера */ }
    try {
      const r = await fetch('assets/data/tracks/index.json', {cache: 'no-store'});
      const data = r.ok ? await r.json() : {};
      let chapters = Array.isArray(data.chapters) ? data.chapters : [];
      if (!chapters.length) {
        try {
          const c = await fetch('assets/data/tracks/chapters/index.json', {cache: 'no-store'});
          if (c.ok) {
            const cj = await c.json();
            chapters = (cj.files || []).map(function (n) {
              return String(n).indexOf('/') >= 0 ? n : ('chapters/' + n);
            });
          }
        } catch (err2) { /* нет папки глав */ }
      }
      return {files: (data && data.files) || [], chapters: chapters};
    } catch (err) {
      return empty;
    }
  }

  /** Читает JSON трассы по относительному имени. */
  async function readTrackFile(name) {
    if (!name) return null;
    const url = name.indexOf('/') >= 0 ? ('assets/data/tracks/' + name.replace(/^assets\/data\/tracks\//, '')) : ('assets/data/tracks/' + name);
    const r = await fetch(url, {cache: 'no-store'});
    if (!r.ok) return null;
    const def = normalize(await r.json());
    if (def.cps.length < 4) return null;
    if (def.theme.groundSrc) texOf(def.theme.groundSrc);
    if (def.theme.roadSrc) texOf(def.theme.roadSrc);
    if (def.theme.railSrc) texOf(def.theme.railSrc);
    return def;
  }

  /** Читает опубликованные трассы с диска и перекрывает петли глав. */
  async function load() {
    await preloadDecals();
    const cat = await fetchCatalog();
    const out = [];
    for (let i = 0; i < cat.files.length; i++) {
      try {
        const def = await readTrackFile(cat.files[i]);
        if (def && !def.chapter) out.push(def);
      } catch (err) { console.error(err); }
    }
    custom = out;
    Object.keys(chapterOverride).forEach(function (id) { delete chapterOverride[id]; });
    for (let i = 0; i < cat.chapters.length; i++) {
      try {
        const def = await readTrackFile(cat.chapters[i]);
        if (def) adoptChapter(def);
      } catch (err) { console.error(err); }
    }
    if (typeof storySyncChapterTracks === 'function') storySyncChapterTracks();
    return custom;
  }

  /** Трассы для сетки выбора: сток плюс опубликованные свои. */
  function pickable(stock) {
    const base = Array.isArray(stock) ? stock : [];
    return base.concat(custom.filter((t) => t.published !== false && t.cps && t.cps.length >= 4));
  }

  /** Ищет свою или сюжетную трассу по id. */
  function find(id) {
    return custom.find((t) => t.id === id) || chapterTracks().find((t) => t.id === id) || null;
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
    DECALS, THEMES, MATERIALS, ITEMS, WEATHER, STOCK, CHAPTER_TRACKS, normalize, startFromCps, preloadDecals, load, pickable, find,
    paintDecals, nearest, fromPlan, themeById, texOf, groundScaleOf, crowdSoundOn, chapterTracks, chapterPacks, adoptChapter, adoptChapter,
    get custom() { return custom; }
  };
})();
