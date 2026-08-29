////////////////////////////////////////////////////////
//
// Каталог машин, схемы колёс и хранилище редактора
//
////////////////////////////////////////////////////////
'use strict';

const EditorData = (() => {
  const KEY = 'rnr.carEditor.v1';
  const KEY_BASE = KEY + '.base';
  const KEY_BACKUP = KEY + '.backup';
  const LEGACY_KEYS = ['rnr.carEditor.v1', 'rnr.carEditor.v1'];
  const STOCK = 11;
  const NAMES = [
    ['01', 'ГРЯЗЕВОЙ ДЬЯВОЛ'],
    ['02', 'V8 ПЕРЕХВАТЧИК'],
    ['03', 'ШРЕДЕР'],
    ['04', 'АЭРО-КЛИНОК'],
    ['05', 'ЧЁРНЫЙ МОЛОТ'],
    ['06', 'ФАНТОМ'],
    ['07', 'УРАЛ'],
    ['08', 'КУРЬЕР'],
    ['09', 'ШПИЛЬКА'],
    ['10', 'ЖЕРЕБЕЦ'],
    ['11', 'БРИЧКА']
  ];
  const STATS = [
    {name:'«ГРЯЗЕВОЙ ДЬЯВОЛ»',owner:0,price:0,top:0.98,acc:1.04,crn:1.08,hp:100,col:'#d24a22',col2:'#7e2a12',hov:false,traits:['ТАРАН: двойной урон при столкновениях','ВСЕДОХОД: меньше штраф бездорожья','РАМА: +20 корпуса']},
    {name:'«V8 ПЕРЕХВАТЧИК»',owner:null,price:3000,top:1.1,acc:1.07,crn:1.02,hp:125,col:'#2f7de0',col2:'#164a8c',hov:false,traits:['ПРОБОЙ: пушки наносят 18 урона','ФОРСАЖ: нитро 1.6x вместо 1.45x','НАДДУВ: +15% разгон']},
    {name:'«ШРЕДЕР»',owner:null,price:7500,top:1.16,acc:1.12,crn:1.12,hp:105,col:'#37c94f',col2:'#1c7a2e',hov:false,traits:['ХВАТКА: +12% поворот','РЕГЕН: +2 корпуса в секунду','МИНЁР: мины мощнее и шире']},
    {name:'«АЭРО-КЛИНОК»',owner:null,price:15000,top:1.24,acc:1.18,crn:1.28,hp:92,col:'#c9cdd6',col2:'#8a93a6',hov:true,traits:['ХОВЕР: не тормозит вне трассы, не скользит по маслу','ФАЗА: старт гонки с 1 щитом','ИМПУЛЬС: ракеты быстрее и чаще']},
    {name:'«ЧЁРНЫЙ МОЛОТ»',owner:null,price:20000,top:0.9,acc:0.85,crn:0.9,hp:180,col:'#1a1a1a',col2:'#8b0000',hov:false,traits:['ТАРАН: тройной урон + отбрасывание','БРОНЯ: -50% урона от мин/ракет','МОНОЛИТ: +70 корпуса']},
    {name:'«ФАНТОМ»',owner:null,price:18000,top:1.3,acc:1.22,crn:1.25,hp:85,col:'#3a2a5c',col2:'#1a1028',hov:false,traits:['МАСКИРОВКА: невидимость 3 сек (G)','ФАЗА: проходит сквозь мины','ХИЩНИК: ракеты быстрее']},
    {name:'«УРАЛ»',owner:3,price:0,top:0.98,acc:0.97,crn:1.08,hp:120,col:'#7fb2ff',col2:'#2a4a7a',hov:false,traits:['ТАРАН: двойной урон при столкновениях','ВСЕДОХОД: меньше штраф бездорожья','РАМА: +20 корпуса']},
    {name:'«КУРЬЕР»',owner:1,price:0,top:1.06,acc:1.04,crn:0.99,hp:80,col:'#9dff4a',col2:'#3a7a18',hov:false,traits:['ТАРАН: двойной урон при столкновениях','ВСЕДОХОД: меньше штраф бездорожья','РАМА: +20 корпуса']},
    {name:'«ШПИЛЬКА»',owner:2,price:0,top:1.06,acc:0.97,crn:1.08,hp:100,col:'#ff5db1',col2:'#8a2458',hov:false,traits:['ТАРАН: двойной урон при столкновениях','ВСЕДОХОД: меньше штраф бездорожья','РАМА: +20 корпуса']},
    {name:'«ЖЕРЕБЕЦ»',owner:null,price:25000,top:1.26,acc:1.20,crn:1.14,hp:118,col:'#c41e2a',col2:'#5a1018',hov:false,traits:['МИНИГАН: 50 патронов, шкала — магазин, перегрев после опустошения','СКАЧОК: прыжок как с трамплина вместо нитро','ТАБУН: ульта отталкивает и сбрасывает скорость рядом']},
    {name:'«БРИЧКА»',owner:5,price:0,top:0.98,acc:1.04,crn:1.08,hp:100,col:'#d45a1a',col2:'#2c2c30',hov:false,traits:['ПУЛЯ: стреляет прямо','ПЫЛЕСОС: тянет деньги, ремонт и ускорение рядом','КУПОЛ: ульта — щит 10 сек от всего урона']}
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
    [[-16.5,-10,9.4,4.17,0,1,0],[-16.5,10,9.4,4.17,0,1,0],[16.5,-10,9.4,4.17,0,1,1],[16.5,10,9.4,4.17,0,1,1]],
    [[-16.2,-12.2,11,5,0,1,0],[-16.2,12.2,11,5,0,1,0],[16.4,-12.2,11,5,0,1,1],[16.4,12.2,11,5,0,1,1]],
    [[-18.2,-11.6,11,5,0,1,0],[-18.2,11.6,11,5,0,1,0],[16.2,-11.6,11,5,0,1,1],[16.2,11.6,11,5,0,1,1]]
  ];
  // Урал 07: колёса в арках спрайта (нос +X), не на кузове.
  const URAL_WHEELS = [
    [-41.4, -13.5, 10.4, 5.1, 0, 1, 0], [-41.4, 13.5, 10.4, 5.1, 0, 1, 0],
    [-30.2, -13.5, 10.4, 5.1, 0, 1, 0], [-30.2, 13.5, 10.4, 5.1, 0, 1, 0],
    [37.6, -13.4, 10.4, 5.1, 0, 1, 1], [37.6, 13.4, 10.4, 5.1, 0, 1, 1]
  ];
  const PILOTS = [];

  /** Стем аватара: 0 → 01_Player. */
  function avatarStem(i) {
    if (typeof charAvatarStem === 'function') return charAvatarStem(i);
    return String((i | 0) + 1).padStart(2, '0') + '_Player';
  }

  /** Путь к портрету в папке гонщика. */
  function avatarUrl(i, ext, suffix) {
    const nn = String((i | 0) + 1).padStart(2, '0');
    const stem = (typeof charAvatarStem === 'function' ? charAvatarStem(i) : avatarStem(i)) + (suffix || '');
    const dir = (typeof playerDir === 'function') ? playerDir(i) : ('assets/data/players/' + nn + '/');
    return dir + stem + '.' + ext;
  }

  /** Карточки хозяев из CHARS (все, включая NPC). */
  function pilotsFromChars() {
    const list = (typeof CHARS !== 'undefined' && Array.isArray(CHARS)) ? CHARS : [];
    return list.map((c, id) => ({
      id: id,
      name: String((c && (c.short || c.name)) || ('ГОНЩИК ' + avatarStem(id).slice(0, 2))).toUpperCase(),
      file: avatarStem(id),
      npc: !!(c && c.npc)
    }));
  }

  /** Пишет список на месте: игра и панель читают тот же массив. */
  function setPilots(list) {
    PILOTS.length = 0;
    (list || []).forEach((p) => PILOTS.push(p));
  }

  setPilots(pilotsFromChars());

  /** Номера NN из листинга папок гонщиков. */
  function idsFromPlayersListing(html) {
    const ids = {};
    const reDir = /href=["'](\d{2})\/["']/gi;
    const reFile = /(\d{2})_Player(?!_fullbody)/gi;
    let m;
    while ((m = reDir.exec(html || ''))) ids[Number(m[1]) - 1] = true;
    while ((m = reFile.exec(html || ''))) ids[Number(m[1]) - 1] = true;
    return Object.keys(ids).map(Number).filter((n) => n >= 0 && n <= 99).sort((a, b) => a - b);
  }

  /** Есть ли портрет webp/png. */
  function avatarFileExists(i) {
    return new Promise((resolve) => {
      let done = false;
      const finish = (ok) => { if (done) return; done = true; resolve(!!ok); };
      const im = new Image();
      im.onload = () => finish(true);
      im.onerror = () => {
        const im2 = new Image();
        im2.onload = () => finish(true);
        im2.onerror = () => finish(false);
        im2.src = avatarUrl(i, 'png');
      };
      im.src = avatarUrl(i, 'webp');
      setTimeout(() => finish(false), 2500);
    });
  }

  /** Добирает гонщиков из аватаров, которых ещё нет в CHARS. */
  async function refreshPilots() {
    const byId = {};
    pilotsFromChars().forEach((p) => { byId[p.id] = p; });
    let listed = [];
    try {
      const res = await fetch('assets/data/players/?rnr=pilots');
      if (res.ok) listed = idsFromPlayersListing(await res.text());
    } catch (err) {}
    listed.forEach((id) => {
      if (byId[id]) return;
      byId[id] = {
        id: id,
        name: 'ГОНЩИК ' + String(id + 1).padStart(2, '0'),
        file: avatarStem(id),
        extra: true
      };
    });
    const start = Math.max(Object.keys(byId).length ? Math.max.apply(null, Object.keys(byId).map(Number)) + 1 : 0, (typeof CHARS !== 'undefined' && CHARS.length) || 0);
    let miss = 0;
    for (let i = start; i < 40 && miss < 3; i++) {
      if (byId[i]) { miss = 0; continue; }
      const ok = await avatarFileExists(i);
      if (ok) {
        byId[i] = {id: i, name: 'ГОНЩИК ' + String(i + 1).padStart(2, '0'), file: avatarStem(i), extra: true};
        miss = 0;
      } else miss += 1;
    }
    setPilots(Object.keys(byId).map(Number).sort((a, b) => a - b).map((id) => byId[id]));
    return PILOTS;
  }

  /** Заводской хозяин слота: null — магазин. */
  function defaultOwner(i) {
    if (i == null || i < 0 || i >= STATS.length) return null;
    const o = STATS[i].owner;
    return (typeof parseOwnerId === 'function' ? parseOwnerId(o) : ((o === 0 || o > 0) ? o : null));
  }

  /** Хозяин из слота: индекс гонщика или null. */
  function ownerOf(car, slot) {
    const parse = (typeof parseOwnerId === 'function')
      ? parseOwnerId
      : (raw) => {
        if (raw === null || raw === '') return null;
        const n = Number(raw);
        return (n === 0 || n > 0) ? (n | 0) : null;
      };
    const s = car && car.stats;
    if (s && 'owner' in s) return parse(s.owner);
    if (car && 'owner' in car) return parse(car.owner);
    return defaultOwner(slot);
  }
  const LAYERS = ['shadow', 'wheels', 'nitro', 'body', 'armor', 'guides'];
  const URAL_LAYERS = ['shadow', 'wheels', 'nitro', 'body', 'armor', 'guides'];
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
    [[-25.8, -6.63, 9, 1.35], [-25.9, -4.37, 9, 1.35], [-25.8, 5.13, 9, 1.35], [-25.7, 6.92, 9, 1.35]],
    [[-26.2, -6.8, 10, 1.6], [-26.2, 6.8, 10, 1.6]],
    [[-27.2, -6.4, 10, 1.55], [-27.2, 6.4, 10, 1.55]]
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

  const DISK_REV = 2;
  let diskCars = {};

  /** Код папки слота: 01 … */
  function folderId(i) { return String(i + 1).padStart(2, '0'); }

  /** Уникальный id слоя. */
  function newLayerId(prefix) {
    return prefix + Date.now().toString(36) + Math.floor(Math.random() * 4096).toString(36);
  }

  /** Подпись слоя для списка как в Figma. */
  function layerTitle(L, car) {
    if (!L) return '';
    if (L.type === 'wheel') {
      const w = car && car.w && car.w[L.ref];
      return 'Колесо ' + ((L.ref | 0) + 1) + (w && w[6] ? ' · руль' : '');
    }
    if (L.type === 'nitro') return 'Нитро ' + ((L.ref | 0) + 1);
    return LAYER_RU[L.type] || L.type;
  }

  /** Стек слоёв: каждый клон — отдельная строка, порядок снизу вверх. */
  function ensureStack(car) {
    if (!car) return car;
    if (Array.isArray(car.stack) && car.stack.length &&
        car.stack.every((L) => L && typeof L === 'object' && L.type)) {
      car.stack.forEach((L) => {
        if (!L.id) L.id = newLayerId('l');
        if (L.on == null) L.on = true;
      });
      return car;
    }
    delete car.stack;
    const vis = car.visible || {};
    const order = (car.layers && car.layers.length) ? car.layers : LAYERS.slice();
    const stack = [];
    order.forEach((name) => {
      const on = vis[name] !== false;
      if (name === 'wheels') {
        (car.w || []).forEach((_, i) => stack.push({id: 'w' + i, type: 'wheel', on: on, ref: i}));
      } else if (name === 'nitro') {
        (car.nitro || []).forEach((_, i) => stack.push({id: 'n' + i, type: 'nitro', on: on, ref: i}));
      } else if (name === 'shadow' || name === 'body' || name === 'armor' || name === 'guides') {
        stack.push({id: name, type: name, on: on});
      }
    });
    const addMissing = (type, list, prefix) => {
      (list || []).forEach((_, i) => {
        if (stack.some((L) => L.type === type && L.ref === i)) return;
        const layer = {id: prefix + i, type: type, on: true, ref: i};
        const bodyAt = stack.findIndex((L) => L.type === 'body');
        if (bodyAt >= 0) stack.splice(bodyAt, 0, layer);
        else stack.push(layer);
      });
    };
    addMissing('wheel', car.w, 'w');
    addMissing('nitro', car.nitro, 'n');
    car.stack = stack;
    return car;
  }

  /** Слой этого колеса / трубы включён. */
  function stackItemOn(car, type, ref) {
    ensureStack(car);
    const hit = (car.stack || []).find((L) => L.type === type && L.ref === ref);
    if (hit) return hit.on !== false;
    if (type === 'wheel') return !(car.visible && car.visible.wheels === false);
    if (type === 'nitro') return !(car.visible && car.visible.nitro === false);
    return true;
  }

  /** Клон колеса: новая запись и новый слой сразу над исходным. */
  function cloneWheelLayer(car, i) {
    ensureStack(car);
    if (!car.w || !car.w[i]) return -1;
    const copy = normWheel(car.w[i].slice());
    copy[0] += 3;
    copy[1] += 3;
    car.w.push(copy);
    const ni = car.w.length - 1;
    const layer = {id: newLayerId('w'), type: 'wheel', on: true, ref: ni};
    const at = car.stack.findIndex((L) => L.type === 'wheel' && L.ref === i);
    if (at >= 0) car.stack.splice(at + 1, 0, layer);
    else car.stack.push(layer);
    return ni;
  }

  /** Клон нитро: новая труба и отдельный слой (над или под кузовом — как у исходной). */
  function cloneNitroLayer(car, i) {
    ensureStack(car);
    if (!car.nitro || !car.nitro[i]) return -1;
    const copy = normJet(car.nitro[i].slice());
    copy[0] += 3;
    copy[1] += 3;
    car.nitro.push(copy);
    const ni = car.nitro.length - 1;
    const layer = {id: newLayerId('n'), type: 'nitro', on: true, ref: ni};
    const at = car.stack.findIndex((L) => L.type === 'nitro' && L.ref === i);
    if (at >= 0) car.stack.splice(at + 1, 0, layer);
    else car.stack.push(layer);
    return ni;
  }

  /** Сдвигает ref после удаления. */
  function reindexStack(car, type, removed) {
    car.stack = (car.stack || []).filter((L) => !(L.type === type && L.ref === removed));
    car.stack.forEach((L) => {
      if (L.type === type && L.ref > removed) L.ref -= 1;
    });
    syncVisibleFromStack(car);
  }

  /** Вставляет слой рядом с исходным или под кузов. */
  function insertNear(car, layer, type, nearRef) {
    const at = nearRef != null ? car.stack.findIndex((L) => L.type === type && L.ref === nearRef) : -1;
    if (at >= 0) {
      car.stack.splice(at + 1, 0, layer);
      return;
    }
    const bodyAt = car.stack.findIndex((L) => L.type === 'body');
    if (bodyAt >= 0) car.stack.splice(bodyAt, 0, layer);
    else car.stack.push(layer);
  }

  /** Новое колесо = новый слой. */
  function appendWheel(car, raw, nearRef) {
    ensureStack(car);
    if (!car.w) car.w = [];
    car.w.push(normWheel(raw));
    const ni = car.w.length - 1;
    insertNear(car, {id: newLayerId('w'), type: 'wheel', on: true, ref: ni}, 'wheel', nearRef);
    return ni;
  }

  /** Новая труба нитро = новый слой (над или под кузовом — как у соседа). */
  function appendNitro(car, raw, nearRef) {
    ensureStack(car);
    if (!car.nitro) car.nitro = [];
    car.nitro.push(normJet(raw));
    const ni = car.nitro.length - 1;
    insertNear(car, {id: newLayerId('n'), type: 'nitro', on: true, ref: ni}, 'nitro', nearRef);
    return ni;
  }

  /** Видимость групп для старого кода игры. */
  function syncVisibleFromStack(car) {
    if (!car || !Array.isArray(car.stack)) return car;
    car.visible = car.visible || {};
    ['shadow', 'body', 'armor', 'guides'].forEach((t) => {
      const L = car.stack.find((x) => x.type === t);
      if (L) car.visible[t] = L.on !== false;
    });
    car.visible.wheels = car.stack.some((L) => L.type === 'wheel' && L.on !== false);
    car.visible.nitro = car.stack.some((L) => L.type === 'nitro' && L.on !== false);
    return car;
  }

  /** JSON для папки assets/data/cars/NN (без dataURL корпуса). */
  function fileCar(car) {
    ensureStack(car);
    return {
      rev: car.rev || DISK_REV,
      body: clone(car.body),
      w: clone(car.w || []),
      nitro: clone(car.nitro || []),
      stack: clone(car.stack),
      stats: clone(car.stats),
      owner: ownerOf(car, null),
      visible: clone(car.visible || {}),
      layers: clone(car.layers || LAYERS)
    };
  }

  /** Нормализует массив колеса до семи чисел. */
  function normWheel(raw) {
    const w = Array.isArray(raw) ? raw : [0, 0, 12, 8, 0, 1, 0];
    const hasSteer = Array.isArray(raw) && raw.length > 6;
    return [
      +w[0] || 0, +w[1] || 0,
      w[2] == null || w[2] === '' ? 12 : +w[2],
      w[3] == null || w[3] === '' ? 8 : +w[3],
      +w[4] || 0, w[5] == null ? 1 : +w[5], hasSteer ? (w[6] ? 1 : 0) : 0
    ];
  }

  /** Ставит руль на нос машины, если флаг потерян или остался только на задней оси. */
  function restoreSteer(wheels, factoryW) {
    if (!wheels || !wheels.length) return wheels;
    const xs = wheels.map((w) => (w && w[0]) || 0);
    const mid = (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2;
    if (wheels.some((w) => w && w[6] && w[0] >= mid)) return wheels;
    return wheels.map((w, i) => {
      const out = (Array.isArray(w) ? w : normWheel(w)).slice();
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
      col: '#c8b48a', col2: '#5a4630', hov: false, owner: null,
      traits: ['СВОЯ МАШИНА', 'НАСТРОЙ ПОД СЕБЯ', '']
    });
    const wheels = stock
      ? (i === 6 ? URAL_WHEELS : LAYOUTS[i]).map(normWheel)
      : [
      [-16, -11, 12, 6, 0, 1, 0], [-16, 11, 12, 6, 0, 1, 0],
      [16, -11, 12, 6, 0, 1, 1], [16, 11, 12, 6, 0, 1, 1]
    ];
    const car = {
      custom: !stock,
      body: {x: 0, y: 0, ax: 0, ay: 0, sx: 1, sy: 1, scale: stock && i === 6 ? 1.65 : 1, armor: 0},
      w: wheels,
      nitro: defaultNitro(stock ? i : 3),
      layers: (stock && i === 6 ? URAL_LAYERS : LAYERS).slice(),
      visible: {shadow: true, wheels: true, nitro: true, body: true, armor: true, guides: true},
      stats: st,
      rev: DISK_REV
    };
    return ensureStack(car);
  }

  /** Старый стек Урала: колёса поверх кузова. */
  function isOldUralStack(layers) {
    const s = (layers || []).filter((n) => n !== 'guides').join(',');
    return s === 'shadow,body,armor,wheels,nitro' || s === 'shadow,body,wheels,nitro,armor';
  }

  /** Старая раскладка: средняя ось у стыка кабины, слишком широкий вынос. */
  function isOldUralLayout(w) {
    if (!w || w.length !== 6 || !Array.isArray(w[0]) || !Array.isArray(w[2])) return false;
    return Math.abs(+w[0][0] + 38.12) < 2.8 && Math.abs(+w[2][0] + 19.31) < 3.5;
  }

  /** Склеивает сохранённые данные с заводскими. */
  function mergeCar(i, saved) {
    const base = factory(i);
    if (!saved) return base;
    const body = Object.assign(base.body, saved.body || {});
    if (body.armor == null && saved.body && saved.body.armor != null) body.armor = saved.body.armor;
    body.armor = body.armor || 0;
    body.ax = +body.ax || 0;
    body.ay = +body.ay || 0;
    body.sx = isFinite(+body.sx) && +body.sx > 0 ? +body.sx : 1;
    body.sy = isFinite(+body.sy) && +body.sy > 0 ? +body.sy : 1;
    const vis = Object.assign(base.visible, saved.visible || {});
    const stats = Object.assign(base.stats, saved.stats || {});
    if (typeof saved.name === 'string' && !saved.stats) stats.name = saved.name;
    if (saved && 'owner' in saved && !('owner' in (saved.stats || {}))) stats.owner = saved.owner;
    if (!('owner' in stats) || stats.owner == null) stats.owner = defaultOwner(i);
    let wheels = restoreSteer(Array.isArray(saved.w) ? saved.w.map(normWheel) : base.w, base.w);
    const nitro = saved.nitro != null ? (Array.isArray(saved.nitro) ? saved.nitro.map(normJet) : []) : base.nitro;
    let layers = Array.isArray(saved.layers) && saved.layers.length ? saved.layers.slice() : base.layers.slice();
    if (i === 6 && revTime(saved.rev) === 0) {
      if (isOldUralStack(layers)) layers = URAL_LAYERS.slice();
      if (isOldUralLayout(wheels)) wheels = URAL_WHEELS.map(normWheel);
    }
    LAYERS.forEach((n) => { if (!layers.includes(n)) layers.push(n); if (vis[n] == null) vis[n] = true; });
    const out = Object.assign(base, saved, {
      body, visible: vis, stats, w: wheels, nitro, layers,
      rev: saved.rev != null ? saved.rev : (base.rev || DISK_REV)
    });
    if (!(Array.isArray(saved.stack) && saved.stack.length)) delete out.stack;
    return ensureStack(out);
  }

  /** Метка времени сохранения; 1, 2, 3 — номер схемы, не дата. */
  function revTime(v) {
    const n = Number(v);
    return (isFinite(n) && n > 1e11) ? n : 0;
  }

  /** Читает localStorage с запасными ключами. */
  function readRaw() {
    for (const k of [KEY, ...LEGACY_KEYS]) {
      const raw = localStorage.getItem(k);
      if (raw) return raw;
    }
    return null;
  }

  /** fetch с отсечкой, чтобы file:// не держал лабораторию пустой. */
  function fetchJson(url) {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => { if (ctrl) ctrl.abort(); }, 1800);
    const opts = {cache: 'no-store'};
    if (ctrl) opts.signal = ctrl.signal;
    return fetch(url, opts).then((r) => r.ok ? r.json() : null).finally(() => clearTimeout(timer));
  }

  /** Подгружает заводские JSON из assets/data/cars. */
  async function hydrateFromDisk() {
    if (typeof location !== 'undefined' && location.protocol === 'file:') return;
    diskCars = {};
    const jobs = [];
    for (let i = 0; i < STOCK; i++) {
      const url = 'assets/data/cars/' + folderId(i) + '/car.json';
      jobs.push(fetchJson(url).then((j) => { if (j) diskCars[i] = j; }).catch(() => {}));
    }
    await Promise.all(jobs);
  }

  /** Диск + браузер: слот из браузера не уступает файлу с той же или старой меткой. */
  function load() {
    let ls = {};
    try {
      const raw = readRaw();
      if (raw) ls = JSON.parse(raw).cars || {};
    } catch (e) {}
    const cars = {};
    const ids = {};
    for (let i = 0; i < STOCK; i++) ids[i] = true;
    Object.keys(diskCars).forEach((k) => { ids[Number(k)] = true; });
    Object.keys(ls).forEach((k) => { ids[Number(k)] = true; });
    Object.keys(ids).map(Number).filter((n) => !isNaN(n)).sort((a, b) => a - b).forEach((i) => {
      try {
        const d = diskCars[i] || diskCars[String(i)];
        const s = ls[i] || ls[String(i)];
        let c = factory(i);
        const dRev = revTime(d && d.rev);
        const sRev = revTime(s && s.rev);
        if (s && (!d || sRev >= dRev)) c = mergeCar(i, s);
        else if (d) c = mergeCar(i, d);
        cars[i] = c;
      } catch (err) {
        console.error('слот ' + i, err);
        cars[i] = factory(i);
      }
    });
    if (!Object.keys(cars).length) {
      for (let i = 0; i < STOCK; i++) cars[i] = factory(i);
    }
    return {version: 3, cars};
  }

  /** Пишет пакет в браузер, не трогая живой объект редактора. */
  function save(data) {
    const out = clone(data);
    Object.keys(out.cars || {}).forEach((k) => {
      const car = out.cars[k];
      if (!car || !Array.isArray(car.w)) return;
      car.w = restoreSteer(car.w.map(normWheel), factory(Number(k)).w);
      ensureStack(car);
      syncVisibleFromStack(car);
    });
    const json = JSON.stringify(out);
    localStorage.setItem(KEY, json);
    try { localStorage.setItem(KEY + '.ts', String(Date.now())); } catch (err) {}
    return json.length;
  }

  /** Пишет одну машину в localStorage-мешок. */
  function bagSet(key, slot, car) {
    let bag = {cars: {}};
    try { bag = JSON.parse(localStorage.getItem(key) || '{}') || {cars: {}}; } catch (err) {}
    if (!bag.cars) bag.cars = {};
    bag.cars[slot] = fileCar(car);
    localStorage.setItem(key, JSON.stringify(bag));
  }

  /** Читает одну машину из мешка. */
  function bagGet(key, slot) {
    try {
      const bag = JSON.parse(localStorage.getItem(key) || '{}');
      return (bag && bag.cars && (bag.cars[slot] || bag.cars[String(slot)])) || null;
    } catch (err) { return null; }
  }

  /** Пишет car.json / car.base.json / car.backup.json. */
  function pushDisk(slot, car, kind) {
    if (!revTime(car.rev)) car.rev = Date.now();
    const payload = fileCar(car);
    payload.rev = car.rev;
    return fetch('/__save-car', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({slot: slot, car: payload, kind: kind || 'work'})
    }).then((r) => r.ok).catch(() => false);
  }

  /** Текущее состояние — новая база; прежняя база уходит в бэкап. */
  function saveAsBase(slot, car) {
    const prev = bagGet(KEY_BASE, slot);
    if (prev) bagSet(KEY_BACKUP, slot, prev);
    else bagSet(KEY_BACKUP, slot, factory(slot));
    bagSet(KEY_BASE, slot, car);
    return pushDisk(slot, car, 'base');
  }

  /** Кладёт текущую машину в бэкап (перед сбросом). */
  function saveBackup(slot, car) {
    bagSet(KEY_BACKUP, slot, car);
    return pushDisk(slot, car, 'backup');
  }

  /** Файл слота с диска. */
  function fetchSlotFile(slot, name) {
    if (typeof location !== 'undefined' && location.protocol === 'file:') {
      return Promise.resolve(null);
    }
    return fetchJson('assets/data/cars/' + folderId(slot) + '/' + name);
  }

  /** Базовые настройки слота: диск, затем браузер. */
  function loadBaseCar(slot) {
    return fetchSlotFile(slot, 'car.base.json').then((j) => {
      if (j) return mergeCar(slot, j);
      const b = bagGet(KEY_BASE, slot);
      return b ? mergeCar(slot, b) : null;
    });
  }

  /** Бэкап слота: диск, затем браузер. */
  function loadBackupCar(slot) {
    return fetchSlotFile(slot, 'car.backup.json').then((j) => {
      if (j) return mergeCar(slot, j);
      const b = bagGet(KEY_BACKUP, slot);
      return b ? mergeCar(slot, b) : null;
    });
  }

    /** Список индексов: сток 0–10 плюс кастомы. */
  function indices(data) {
    const extra = Object.keys((data && data.cars) || {}).map(Number).filter((n) => n >= STOCK);
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

  /** База слота из браузера или завод, без сети. */
  function peekBase(slot) {
    const b = bagGet(KEY_BASE, slot);
    return b ? mergeCar(slot, b) : factory(slot);
  }

  return {KEY, STOCK, NAMES, STATS, LAYERS, URAL_LAYERS, LAYER_RU, PILOTS, DISK_REV, clone, factory, mergeCar, load, save, indices, label, normWheel, restoreSteer, normJet, defaultNitro, defaultOwner, ownerOf, ensureStack, stackItemOn, cloneWheelLayer, cloneNitroLayer, reindexStack, appendWheel, appendNitro, syncVisibleFromStack, layerTitle, fileCar, hydrateFromDisk, pushDisk, saveAsBase, saveBackup, loadBaseCar, loadBackupCar, peekBase, folderId, revTime, refreshPilots};
})();
