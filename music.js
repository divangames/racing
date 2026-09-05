////////////////////////////////////////////////////////
//
// Музыка: папки assets/music/{main,change,garage,intro,racing}.
// Список берётся с диска. Сколько файлов — столько треков.
// Меню / гараж / гонка / выбор машины — случайно без повтора подряд.
// Интро гонщика — файл с номером (01.mp3 → первый, 06.mp3 → шестой).
//
////////////////////////////////////////////////////////

/** Корень локальной музыки. */
var MUSIC_DIR = 'assets/music/';

/** Папки плейлистов. */
var MUSIC_CATS = ['main', 'change', 'garage', 'intro', 'racing'];

/** Расширения, которые берём из папки. */
var MUSIC_EXTS = ['.mp3', '.ogg', '.wav', '.m4a'];

/** Сброс кэша браузера для запасного URL на хосте. */
var MUSIC_CDN_VER = '20260829-0355';

/** Найденные треки: заполняет musicDiscoverAll. */
var MUSIC_TRACKS = { main: [], change: [], garage: [], intro: [], racing: [] };

/** Состояние сканирования папок. */
var MUSIC_SCAN = { done: false, promise: null };

/** Локальный путь трека: main/0.mp3 → assets/music/main/0.mp3. */
function musicFile(path) {
 return MUSIC_DIR + path;
}

/** Запасной URL на CDN с тем же относительным путём. */
function musicCdn(path) {
 return 'https://ikrinka24.com/ROCK/music/' + path + '?v=' + MUSIC_CDN_VER;
}

/** Локальный URL и запасной CDN — в десктопе только диск, без зависания на хосте. */
function musicSources(url) {
 const u = String(url || '');
 if (!u) return [];
 if (u.indexOf(MUSIC_DIR) !== 0) return [u];
 const path = u.slice(MUSIC_DIR.length);
 if (typeof window !== 'undefined' && window.__RNR_DESKTOP__) return [u];
 return [u, musicCdn(path)];
}

/** Имя файла без пути. */
function musicBaseName(href) {
 const s = String(href || '').split('?')[0].replace(/\\/g, '/');
 const i = s.lastIndexOf('/');
 return i >= 0 ? s.slice(i + 1) : s;
}

/** Аудиофайл, не из подпапки old. */
function musicIsTrackName(name) {
 const n = musicBaseName(name);
 if (!n || n.indexOf('.') === 0) return false;
 const low = n.toLowerCase();
 const dot = low.lastIndexOf('.');
 if (dot < 0) return false;
 if (MUSIC_EXTS.indexOf(low.slice(dot)) < 0) return false;
 if (/\/old\//i.test(String(name).replace(/\\/g, '/'))) return false;
 return true;
}

/** 0.mp3, 10.mp3, 01.mp3 — как в проводнике. */
function musicNameSort(a, b) {
 return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

/** Интро: 01.mp3 садится на слот 0, 06.mp3 — на слот 5. */
function musicIntroList(names) {
 const list = [];
 for (let i = 0; i < names.length; i++) {
  const name = musicBaseName(names[i]);
  if (!musicIsTrackName(name)) continue;
  const m = name.match(/(\d+)/);
  if (!m) continue;
  const idx = parseInt(m[1], 10) - 1;
  if (idx < 0 || idx > 31) continue;
  list[idx] = musicFile('intro/' + name);
 }
 return list;
}

/** Кладёт найденные имена в MUSIC_TRACKS. */
function musicApplyNames(cat, names) {
 const uniq = [];
 const seen = Object.create(null);
 for (let i = 0; i < names.length; i++) {
  const name = musicBaseName(names[i]);
  if (!musicIsTrackName(name) || seen[name]) continue;
  seen[name] = 1;
  uniq.push(name);
 }
 uniq.sort(musicNameSort);
 if (cat === 'intro') MUSIC_TRACKS.intro = musicIntroList(uniq);
 else MUSIC_TRACKS[cat] = uniq.map(function (n) { return musicFile(cat + '/' + n); });
}

/** Разбор HTML-листинга папки (локальный Python). */
function musicParseListing(html) {
 const names = [];
 const re = /href\s*=\s*["']([^"']+)["']/gi;
 let m;
 while ((m = re.exec(html))) {
  const href = m[1];
  if (/\/old\/?/i.test(href) || href.indexOf('..') >= 0) continue;
  const name = musicBaseName(decodeURIComponent(href));
  if (musicIsTrackName(name)) names.push(name);
 }
 return names;
}

/** JSON индекса: { main: ["0.mp3"], ... }. */
function musicApplyIndex(index) {
 if (!index || typeof index !== 'object') return false;
 let any = false;
 for (let i = 0; i < MUSIC_CATS.length; i++) {
  const cat = MUSIC_CATS[i];
  const raw = index[cat];
  if (!Array.isArray(raw) || !raw.length) continue;
  musicApplyNames(cat, raw);
  any = true;
 }
 return any;
}

/** GET JSON или HTML. */
function musicFetchText(url) {
 return fetch(url, { cache: 'no-store' }).then(function (res) {
  if (!res.ok) return null;
  return res.text().then(function (text) {
   return { type: (res.headers.get('content-type') || ''), text: text };
  });
 }).catch(function () { return null; });
}

/** Файл на месте: HEAD, иначе короткий GET. */
function musicExists(url) {
 return fetch(url, { method: 'HEAD', cache: 'no-store' }).then(function (res) {
  if (res.ok) return true;
  if (res.status === 405 || res.status === 501) {
   return fetch(url, { method: 'GET', headers: { Range: 'bytes=0-1' }, cache: 'no-store' })
    .then(function (r) { return r.ok; });
  }
  return false;
 }).catch(function () {
  return fetch(url, { method: 'GET', headers: { Range: 'bytes=0-1' }, cache: 'no-store' })
   .then(function (r) { return r.ok; })
   .catch(function () { return false; });
 });
}

/** Номера 0.mp3 / 01.mp3, пока нет двух дырок подряд. */
function musicProbeCat(cat) {
 const names = [];
 const seen = Object.create(null);
 let miss = 0;
 const start = cat === 'intro' ? 1 : 0;
 const end = cat === 'intro' ? 16 : 24;
 function tryAdd(name) {
  if (!name || seen[name]) return Promise.resolve(false);
  return musicExists(musicFile(cat + '/' + name)).then(function (ok) {
   if (!ok) return false;
   seen[name] = 1;
   names.push(name);
   return true;
  });
 }
 let i = start;
 function step() {
  if (i > end) return Promise.resolve(names);
  const n = String(i);
  const pad = n.length < 2 ? ('0' + n) : n;
  const candidates = cat === 'intro' ? [pad + '.mp3', n + '.mp3'] : [n + '.mp3', pad + '.mp3'];
  return tryAdd(candidates[0]).then(function (a) {
   if (a) return true;
   return tryAdd(candidates[1]);
  }).then(function (ok) {
   if (ok) miss = 0;
   else {
    miss++;
    if (miss >= 2 && names.length) return names;
   }
   i++;
   return step();
  });
 }
 return step();
}

/** Одна категория: индекс сервера уже мог заполнить. */
function musicDiscoverCat(cat) {
 if ((MUSIC_TRACKS[cat] || []).some(Boolean)) return Promise.resolve();
 return musicFetchText(MUSIC_DIR + cat + '/').then(function (got) {
  if (got && /json/i.test(got.type)) {
   try {
    const data = JSON.parse(got.text);
    const list = Array.isArray(data) ? data : (data && data.files) || [];
    if (list.length) {
     musicApplyNames(cat, list);
     return;
    }
   } catch (e) {}
  }
  if (got && /html/i.test(got.type)) {
   const names = musicParseListing(got.text);
   if (names.length) {
    musicApplyNames(cat, names);
    return;
   }
  }
  return musicProbeCat(cat).then(function (names) {
   if (names && names.length) musicApplyNames(cat, names);
  });
 });
}

/** Собирает плейлисты со всех папок. */
function musicDiscoverAll() {
 if (MUSIC_SCAN.promise) return MUSIC_SCAN.promise;
 MUSIC_SCAN.promise = musicFetchText('__music-index').then(function (got) {
  if (got && got.text) {
   try {
    if (musicApplyIndex(JSON.parse(got.text))) return;
   } catch (e) {}
  }
   return musicFetchText(MUSIC_DIR + 'index.json').then(function (idx) {
   if (idx && idx.text) {
    try {
     if (musicApplyIndex(JSON.parse(idx.text))) return;
    } catch (e) {}
   }
   return Promise.all(MUSIC_CATS.map(musicDiscoverCat));
  });
 }).then(function () {
  MUSIC_SCAN.done = true;
 }).catch(function (e) {
  console.error(e);
  MUSIC_SCAN.done = true;
 });
 return MUSIC_SCAN.promise;
}

musicDiscoverAll();
