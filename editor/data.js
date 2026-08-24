////////////////////////////////////////////////////////
//
// Каталог машин, схемы колёс и хранилище редактора
//
////////////////////////////////////////////////////////
'use strict';

const EditorData = (() => {
  const KEY = 'rnr.carEditor.v1';
  const LEGACY_KEYS = ['rnr.carEditor.v1', 'rnr.carEditor.v1'];
  const STOCK = 9;
  const NAMES = [
    ['01', 'ГРЯЗЕВОЙ ДЬЯВОЛ'],
    ['02', 'V8 ПЕРЕХВАТЧИК'],
    ['03', 'ШРЕДЕР'],
    ['04', 'АЭРО-КЛИНОК'],
    ['05', 'ЧЁРНЫЙ МОЛОТ'],
    ['06', 'ФАНТОМ'],
    ['07', 'УРАЛ'],
    ['08', 'КУРЬЕР'],
    ['09', 'ШПИЛЬКА']
  ];
  const STATS = [
    {name:'«ГРЯЗЕВОЙ ДЬЯВОЛ»',price:0,top:0.98,acc:1.04,crn:1.08,hp:100,col:'#d24a22',col2:'#7e2a12',hov:false,traits:['ТАРАН: двойной урон при столкновениях','ВСЕДОХОД: меньше штраф бездорожья','РАМА: +20 корпуса']},
    {name:'«V8 ПЕРЕХВАТЧИК»',price:3000,top:1.1,acc:1.07,crn:1.02,hp:125,col:'#2f7de0',col2:'#164a8c',hov:false,traits:['ПРОБОЙ: пушки наносят 18 урона','ФОРСАЖ: нитро 1.6x вместо 1.45x','НАДДУВ: +15% разгон']},
    {name:'«ШРЕДЕР»',price:7500,top:1.16,acc:1.12,crn:1.12,hp:105,col:'#37c94f',col2:'#1c7a2e',hov:false,traits:['ХВАТКА: +12% поворот','РЕГЕН: +2 корпуса в секунду','МИНЁР: мины мощнее и шире']},
    {name:'«АЭРО-КЛИНОК»',price:15000,top:1.24,acc:1.18,crn:1.28,hp:92,col:'#c9cdd6',col2:'#8a93a6',hov:true,traits:['ХОВЕР: не тормозит вне трассы, не скользит по маслу','ФАЗА: старт гонки с 1 щитом','ИМПУЛЬС: ракеты быстрее и чаще']},
    {name:'«ЧЁРНЫЙ МОЛОТ»',price:20000,top:0.9,acc:0.85,crn:0.9,hp:180,col:'#1a1a1a',col2:'#8b0000',hov:false,traits:['ТАРАН: тройной урон + отбрасывание','БРОНЯ: -50% урона от мин/ракет','МОНОЛИТ: +70 корпуса']},
    {name:'«ФАНТОМ»',price:18000,top:1.3,acc:1.22,crn:1.25,hp:85,col:'#3a2a5c',col2:'#1a1028',hov:false,traits:['МАСКИРОВКА: невидимость 3 сек (G)','ФАЗА: проходит сквозь мины','ХИЩНИК: ракеты быстрее']},
    {name:'«УРАЛ»',price:0,top:0.98,acc:0.97,crn:1.08,hp:120,col:'#7fb2ff',col2:'#2a4a7a',hov:false,traits:['ТАРАН: двойной урон при столкновениях','ВСЕДОХОД: меньше штраф бездорожья','РАМА: +20 корпуса']},
    {name:'«КУРЬЕР»',price:0,top:1.06,acc:1.04,crn:0.99,hp:80,col:'#9dff4a',col2:'#3a7a18',hov:false,traits:['ТАРАН: двойной урон при столкновениях','ВСЕДОХОД: меньше штраф бездорожья','РАМА: +20 корпуса']},
    {name:'«ШПИЛЬКА»',price:0,top:1.06,acc:0.97,crn:1.08,hp:100,col:'#ff5db1',col2:'#8a2458',hov:false,traits:['ТАРАН: двойной урон при столкновениях','ВСЕДОХОД: меньше штраф бездорожья','РАМА: +20 корпуса']}
  ];
  const LAYOUTS = [
    [[-15.5,-11.4,12,4,0,1,0],[-15.5,11.4,12,4,0,1,0],[14.2,-11.4,12,4,0,1,1],[14.2,11.4,12,4,0,1,1]],
    [[-15.5,-12,12,4,0,1,0],[-15.5,12,12,4,0,1,0],[14.2,-12,12,4,0,1,1],[14.2,12,12,4,0,1,1]],
    [[-16.5,-10.5,13,9,0,.5,0],[-16.5,10.5,13,9,0,.5,0],[13.5,-10,13,9,0,.5,1],[13.5,10,13,9,0,.5,1]],
    [],
    [[-14,-9.6,12,8,0,1,0],[-14,9.6,12,8,0,1,0],[17,-9.6,12,8,0,1,1],[17,9.6,12,8,0,1,1]],
    [[-15.8,-12.5,12,8,0,1,0],[-15.8,12.5,12,8,0,1,0],[14.6,-11.6,12,8,0,1,1],[14.6,11.6,12,8,0,1,1]],
    [[-38.12,-16.88,11,5.4,0,1,0],[-38.12,16.88,11,5.4,0,1,0],[-19.31,-16.7,11,5.4,0,1,0],[-19.31,16.7,11,5.4,0,1,0],[32.67,-16.52,11,5.4,0,1,1],[32.67,16.52,11,5.4,0,1,1]],
    [[-17.8,-9.82,10,4.15,0,1,0],[-17.8,9.82,10,4.15,0,1,0],[14.5,-9.87,10,4.15,0,1,1],[14.5,9.87,10,4.15,0,1,1]],
    [[-16.5,-10,9.4,4.17,0,1,0],[-16.5,10,9.4,4.17,0,1,0],[16.5,-10,9.4,4.17,0,1,1],[16.5,10,9.4,4.17,0,1,1]]
  ];
  const LAYERS = ['shadow', 'wheels', 'nitro', 'body', 'armor', 'guides'];
  const URAL_LAYERS = ['shadow', 'body', 'armor', 'wheels', 'nitro', 'guides'];
  const LAYER_RU = {shadow:'Тень',wheels:'Колёса',nitro:'Нитро',body:'Кузов',armor:'Броня',guides:'Метки'};
  const NITRO = [
    [[-26, -6.4, 8, 1.35], [-26, -3.2, 8, 1.35], [-26, 3.2, 8, 1.35], [-26, 6.4, 8, 1.35]],
    [[-25, -7.8, 9, 1.55], [-25, 7.8, 9, 1.55]],
    [[-26.4, -8, 10, 1.9], [-26.4, 8, 10, 1.9]],
    [[-26, -5.2, 9, 1.5], [-26, 5.2, 9, 1.5]],
    [[-24, -6.6, 9, 1.55], [-24, 6.6, 9, 1.55]],
    [[-27, -7.2, 14, 3.3], [-27, 7.2, 14, 3.3]],
    [[-15.2 * 1.65, -6.5 * 1.65, 11, 1.8], [-15.2 * 1.65, 6.8 * 1.65, 11, 1.8]],
    [[-25.8, -6.1, 10, 1.7], [-26, 5.8, 10, 1.7]],
    [[-25.8, -6.63, 9, 1.35], [-25.9, -4.37, 9, 1.35], [-25.8, 5.13, 9, 1.35], [-25.7, 6.92, 9, 1.35]]
  ];

  /** Глубокая копия JSON-значения. */
  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  /** Нормализует трубу нитро: x, y, длина, полуширина. */
  function normJet(raw) {
    const j = Array.isArray(raw) ? raw : [-26, 0, 9, 1.5];
    return [+j[0] || 0, +j[1] || 0, +j[2] || 9, +j[3] || 1.5];
  }

  /** Заводские выходы нитро слота. */
  function defaultNitro(i) {
    const src = (i >= 0 && i < NITRO.length) ? NITRO[i] : NITRO[3];
    return src.map(normJet);
  }

  /** Вставляет слой, если его ещё нет. */
  function ensureLayer(layers, name, before) {
    if (layers.indexOf(name) >= 0) return layers;
    const i = layers.indexOf(before);
    if (i >= 0) layers.splice(i, 0, name);
    else layers.push(name);
    return layers;
  }

  /** Нормализует массив колеса до семи чисел. */
  function normWheel(raw) {
    const w = Array.isArray(raw) ? raw : [0, 0, 12, 8, 0, 1, 0];
    const hasSteer = Array.isArray(raw) && raw.length > 6;
    return [
      +w[0] || 0, +w[1] || 0, +w[2] || 12, +w[3] || 8,
      +w[4] || 0, w[5] == null ? 1 : +w[5], hasSteer ? (w[6] ? 1 : 0) : 0
    ];
  }

  /** Ставит руль на нос машины, если флаг потерян или остался только на задней оси. */
  function restoreSteer(wheels, factoryW) {
    if (!wheels || !wheels.length) return wheels;
    const xs = wheels.map((w) => w[0]);
    const mid = (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2;
    if (wheels.some((w) => w && w[6] && w[0] >= mid)) return wheels;
    return wheels.map((w, i) => {
      const out = w.slice();
      if (factoryW && factoryW[i] && factoryW[i][6]) out[6] = 1;
      else out[6] = w[0] >= mid ? 1 : 0;
      return out;
    });
  }

  /** Заводская конфигурация слота (сток или пустой кастом). */
  function factory(i) {
    const stock = i < STOCK;
    const st = clone(stock ? STATS[i] : {
      name: '«СВОЯ ' + String(i + 1).padStart(2, '0') + '»',
      price: 0, top: 1, acc: 1, crn: 1, hp: 100,
      col: '#c8b48a', col2: '#5a4630', hov: false,
      traits: ['СВОЯ МАШИНА', 'НАСТРОЙ ПОД СЕБЯ', '']
    });
    const wheels = stock ? LAYOUTS[i].map(normWheel) : [
      [-16, -11, 12, 6, 0, 1, 0], [-16, 11, 12, 6, 0, 1, 0],
      [16, -11, 12, 6, 0, 1, 1], [16, 11, 12, 6, 0, 1, 1]
    ];
    return {
      custom: !stock,
      body: {x: 0, y: 0, scale: stock && i === 6 ? 1.65 : 1, armor: 0},
      w: wheels,
      nitro: defaultNitro(stock ? i : 3),
      layers: (stock && i === 6 ? URAL_LAYERS : LAYERS).slice(),
      visible: {shadow: true, wheels: true, nitro: true, body: true, armor: true, guides: true},
      stats: st
    };
  }

  /** Склеивает сохранённые данные с заводскими. */
  function mergeCar(i, saved) {
    const base = factory(i);
    if (!saved) return base;
    const body = Object.assign(base.body, saved.body || {});
    if (body.armor == null && saved.body && saved.body.armor != null) body.armor = saved.body.armor;
    body.armor = body.armor || 0;
    const vis = Object.assign(base.visible, saved.visible || {});
    const stats = Object.assign(base.stats, saved.stats || {});
    if (typeof saved.name === 'string' && !saved.stats) stats.name = saved.name;
    const wheels = restoreSteer(Array.isArray(saved.w) ? saved.w.map(normWheel) : base.w, base.w);
    const nitro = saved.nitro != null ? (Array.isArray(saved.nitro) ? saved.nitro.map(normJet) : []) : base.nitro;
    let layers = Array.isArray(saved.layers) && saved.layers.length ? saved.layers.slice() : base.layers.slice();
    ensureLayer(layers, 'nitro', 'body');
    LAYERS.forEach((n) => { if (!layers.includes(n)) layers.push(n); if (vis[n] == null) vis[n] = true; });
    return Object.assign(base, saved, {body, visible: vis, stats, w: wheels, nitro, layers});
  }

  /** Читает localStorage с запасными ключами. */
  function readRaw() {
    for (const k of [KEY, ...LEGACY_KEYS]) {
      const raw = localStorage.getItem(k);
      if (raw) return raw;
    }
    return null;
  }

  /** Загружает пакет настроек. */
  function load() {
    const empty = {version: 2, cars: {}};
    try {
      const raw = readRaw();
      if (!raw) return empty;
      const parsed = JSON.parse(raw);
      const cars = {};
      Object.keys(parsed.cars || {}).forEach((k) => {
        cars[k] = mergeCar(Number(k), parsed.cars[k]);
      });
      return {version: 2, cars};
    } catch (e) {
      return empty;
    }
  }

  /** Сохраняет пакет настроек. */
  function save(data) {
    Object.keys(data.cars || {}).forEach((k) => {
      const car = data.cars[k];
      if (!car || !Array.isArray(car.w)) return;
      car.w = restoreSteer(car.w.map(normWheel), factory(Number(k)).w);
    });
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  /** Список индексов: сток 0–8 плюс кастомы. */
  function indices(data) {
    const extra = Object.keys(data.cars).map(Number).filter((n) => n >= STOCK);
    extra.sort((a, b) => a - b);
    const out = [];
    for (let i = 0; i < STOCK; i++) out.push(i);
    extra.forEach((n) => out.push(n));
    return out;
  }

  /** Код и имя слота для кнопки. */
  function label(data, i) {
    if (i < STOCK) return NAMES[i];
    const st = (data.cars[i] && data.cars[i].stats) || {};
    const n = (st.name || 'СВОЯ').replace(/[«»]/g, '');
    return [String(i + 1).padStart(2, '0'), n];
  }

  return {KEY, STOCK, NAMES, STATS, LAYERS, URAL_LAYERS, LAYER_RU, clone, factory, mergeCar, load, save, indices, label, normWheel, restoreSteer, normJet, defaultNitro};
})();
