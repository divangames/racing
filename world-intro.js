////////////////////////////////////////////////////////
//
// Пролог после «любая кнопка»: 7 кадров, музыка Load
//
////////////////////////////////////////////////////////
'use strict';

const WORLD_INTRO_DIR = 'assets/data/cats/00/';
const WORLD_INTRO_MUSIC = 'assets/music/Load/';
const WORLD_INTRO_COUNT = 7;

const WORLD_INTRO = {
  title: 'ЧЁРНЫЙ ПОЯС',
  accent: '#ffd23f',
  scenes: [],
  imgs: [],
  frame: 0,
  cur: 0,
  printT: 0,
  skipT: 0,
  audio: null,
  ready: false
};

/**
 * Запасной текст, если lines.json ещё не подхватился.
 * @returns {object[]}
 */
function worldIntroFallbackScenes() {
  return [
    {img: 0, text: 'Чёрный Пояс не спит. Он притворяется мёртвым. Под асфальтом кто-то всё ещё гоняет.'},
    {img: 1, text: 'В тоннелях есть круг, куда не пускают просто так. «Колесница Войны». Имя как шутка — пока не увидишь ворота.'},
    {img: 2, text: 'Это не чемпионат. Финиш — когда ты ещё дышишь, а кто-то уже нет.'},
    {img: 3, text: 'Наверху ставят деньги на твой огонь. Вопрос не зачем туда едут. Почему тебя уже ждут.'},
    {img: 4, text: 'Арена читает страх, не скорость. Соперник слишком знакомый. Случайностей здесь не бывает.'},
    {img: 5, text: 'Пропуск без отправителя. Ворота за спиной. Ведущий улыбается так, будто знает концовку.'},
    {img: 6, text: 'Свет на решётке. Не тормози на первом круге. Садись. И посмотрим, зачем тебя сюда пустили.'}
  ];
}

/**
 * Абсолютный URL: в клиенте rnr://, в браузере страница.
 * @param {string} rel
 * @returns {string}
 */
function worldIntroAbs(rel) {
  try {
    return new URL(rel, location.href).href;
  } catch (e) {
    return rel;
  }
}

/**
 * URL кадра: webp и png, с нулём и без.
 * @param {number} n 1…7
 * @returns {string[]}
 */
function worldIntroImgUrls(n) {
  const pad = String(n).padStart(2, '0');
  const base = WORLD_INTRO_DIR;
  return [base + pad + '.webp', base + n + '.webp', base + pad + '.png', base + n + '.png'].map(worldIntroAbs);
}

/**
 * Картинка через fetch→blob: img.src по rnr:// в продакшене часто пустой кадр.
 * @param {HTMLImageElement} img
 * @param {string[]} urls
 */
function worldIntroFetchImg(img, urls) {
  if (!img || img._wiLoad || (img.naturalWidth || 0) > 0) return;
  img._wiLoad = true;
  const list = urls || [];
  function step(i) {
    if (i >= list.length || (img.naturalWidth || 0) > 0) return;
    fetch(list[i], {cache: 'no-store'}).then(function (res) {
      if (!res.ok) { step(i + 1); return; }
      return res.blob().then(function (blob) {
        if (!blob || !blob.size) { step(i + 1); return; }
        if (typeof bootBind === 'function') return bootBind(img, blob);
        img.src = URL.createObjectURL(blob);
      });
    }).catch(function () { step(i + 1); });
  }
  step(0);
}

/**
 * Семь кадров: в очередь загрузки или сразу fetch.
 */
function worldIntroEnqueueImgs() {
  WORLD_INTRO.imgs = [];
  for (let i = 1; i <= WORLD_INTRO_COUNT; i++) {
    const img = new Image();
    const urls = worldIntroImgUrls(i);
    if (typeof bootEnqueue === 'function') bootEnqueue(img, urls);
    else worldIntroFetchImg(img, urls);
    WORLD_INTRO.imgs.push(img);
  }
}

/**
 * Если загрузчик не привязал blob — качаем сами.
 */
function worldIntroEnsureImgs() {
  for (let i = 0; i < WORLD_INTRO.imgs.length; i++) {
    const img = WORLD_INTRO.imgs[i];
    if (!img || (img.naturalWidth || 0) > 0) continue;
    img._wiLoad = false;
    worldIntroFetchImg(img, worldIntroImgUrls(i + 1));
  }
}

/**
 * Сцены из JSON: img 1…7 → индекс массива.
 * @param {object} data
 */
function worldIntroApplyJson(data) {
  if (!data) return;
  if (data.title) WORLD_INTRO.title = String(data.title);
  if (data.accent) WORLD_INTRO.accent = String(data.accent);
  const raw = data.scenes;
  if (!Array.isArray(raw) || !raw.length) return;
  WORLD_INTRO.scenes = raw.slice(0, WORLD_INTRO_COUNT).map(function (sc, i) {
    const imgN = sc && sc.img != null ? (sc.img | 0) : (i + 1);
    const idx = Math.max(0, Math.min(WORLD_INTRO_COUNT - 1, imgN - 1));
    return {img: idx, text: String((sc && sc.text) || '')};
  });
}

/**
 * Качает lines.json, не блокируя старт.
 */
function worldIntroLoadText() {
  WORLD_INTRO.scenes = worldIntroFallbackScenes();
  fetch(WORLD_INTRO_DIR + 'lines.json', {cache: 'no-store'})
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (data) { worldIntroApplyJson(data); })
    .catch(function () {});
}

/**
 * Текущая сцена пролога.
 * @returns {object|null}
 */
function worldIntroScene() {
  return WORLD_INTRO.scenes[WORLD_INTRO.frame] || null;
}

/**
 * Сброс печатной машинки.
 */
function worldIntroResetType() {
  const sc = worldIntroScene();
  const reduce = typeof introReduceMotion === 'boolean' && introReduceMotion;
  WORLD_INTRO.cur = reduce ? ((sc && sc.text.length) || 0) : 0;
  WORLD_INTRO.printT = 0;
}

/**
 * Первый трек папки Load.
 * @returns {string}
 */
function worldIntroMusicUrl() {
  const list = (window.MUSIC_TRACKS && MUSIC_TRACKS.Load) || [];
  for (let i = 0; i < list.length; i++) {
    if (list[i]) return list[i];
  }
  return WORLD_INTRO_MUSIC + '01.mp3';
}

/**
 * Тема Load вместо меню.
 */
function worldIntroPlayMusic() {
  try {
    if (typeof MUSIC !== 'undefined' && MUSIC.stop) MUSIC.stop();
    if (typeof CHIP !== 'undefined' && CHIP.stop) CHIP.stop();
    const url = worldIntroMusicUrl();
    const src = typeof bootMediaSrc === 'function' ? bootMediaSrc(url) : url;
    if (WORLD_INTRO.audio) WORLD_INTRO.audio.pause();
    WORLD_INTRO.audio = new Audio(src);
    WORLD_INTRO.audio.loop = true;
    const vol = (settings && settings.sound && settings.sound.music) || 50;
    WORLD_INTRO.audio.volume = Math.max(0, Math.min(1, vol / 100));
    if (!settings || !settings.sound || settings.sound.musicOn !== false) {
      WORLD_INTRO.audio.play().catch(function () {});
    }
  } catch (e) {
    console.error(e);
  }
}

window.WORLD_INTRO = WORLD_INTRO;

/**
 * Глушит пролог перед меню.
 */
function worldIntroStopMusic() {
  if (!WORLD_INTRO.audio) return;
  try {
    WORLD_INTRO.audio.pause();
    WORLD_INTRO.audio.currentTime = 0;
  } catch (e) {}
  WORLD_INTRO.audio = null;
}

/**
 * Семь кадров после «любая кнопка». labTest не зовёт.
 */
function startWorldIntro() {
  if (typeof clearKeys === 'function') clearKeys();
  WORLD_INTRO.frame = 0;
  WORLD_INTRO.skipT = 0;
  WORLD_INTRO.ready = true;
  if (!WORLD_INTRO.scenes.length) WORLD_INTRO.scenes = worldIntroFallbackScenes();
  worldIntroEnsureImgs();
  worldIntroResetType();
  state = 'worldIntro';
  worldIntroPlayMusic();
  if (cv && cv.focus) cv.focus();
}

/**
 * В главное меню.
 */
function endWorldIntro() {
  worldIntroStopMusic();
  WORLD_INTRO.skipT = 0;
  if (typeof lastMusicCat !== 'undefined') lastMusicCat = null;
  if (typeof enterTitle === 'function') enterTitle();
}

/**
 * Печать текста и удержание пробела.
 * @param {number} dt
 */
function worldIntroTick(dt) {
  if (state !== 'worldIntro') return;
  const sc = worldIntroScene();
  if (sc && WORLD_INTRO.cur < sc.text.length) {
    WORLD_INTRO.printT += dt;
    const step = 0.028;
    while (WORLD_INTRO.printT >= step && WORLD_INTRO.cur < sc.text.length) {
      WORLD_INTRO.printT -= step;
      WORLD_INTRO.cur++;
    }
  }
  if (keys && keys.Space) {
    WORLD_INTRO.skipT += dt;
    const hold = typeof INTRO_SKIP_HOLD === 'number' ? INTRO_SKIP_HOLD : 3;
    if (WORLD_INTRO.skipT >= hold) {
      endWorldIntro();
      if (typeof sClick === 'function') sClick();
    }
  } else WORLD_INTRO.skipT = 0;
  if (WORLD_INTRO.audio && settings && settings.sound) {
    WORLD_INTRO.audio.volume = Math.max(0, Math.min(1, ((settings.sound.music || 50) / 100)));
  }
}

/**
 * Enter / клик: допечатать или следующий кадр.
 */
function worldIntroPress() {
  if (state !== 'worldIntro') return false;
  const sc = worldIntroScene();
  if (!sc) {
    endWorldIntro();
    return true;
  }
  if (WORLD_INTRO.cur < sc.text.length) WORLD_INTRO.cur = sc.text.length;
  else {
    WORLD_INTRO.frame++;
    if (WORLD_INTRO.frame >= WORLD_INTRO.scenes.length) endWorldIntro();
    else worldIntroResetType();
  }
  if (typeof sClick === 'function') sClick();
  return true;
}

/**
 * Комикс на весь кадр, текст снизу.
 */
function drawWorldIntro() {
  try {
    drawWorldIntroFrame();
  } catch (e) {
    console.error(e);
  }
}

/**
 * Кадр пролога: картинка сверху, текст снизу.
 */
function drawWorldIntroFrame() {
  const scenes = WORLD_INTRO.scenes;
  const sc = worldIntroScene();
  if (!sc) return;
  g.setTransform(1, 0, 0, 1, 0, 0);
  const IW = cv.width, IH = cv.height;
  if (!IW || !IH) return;
  const s = Math.min(IW / 1280, IH / 720);
  const pad = Math.max(16, Math.round(22 * s));
  const accent = WORLD_INTRO.accent;
  const img = WORLD_INTRO.imgs[sc.img];
  g.fillStyle = '#050409';
  g.fillRect(0, 0, IW, IH);
  const panelH = Math.round(IH * 0.64);
  const ready = img && (img.naturalWidth || 0) > 0;
  if (ready) {
    const sw = img.naturalWidth, sh = img.naturalHeight;
    g.save();
    g.beginPath();
    g.rect(0, 0, IW, panelH);
    g.clip();
    const cover = Math.max(IW / sw, panelH / sh);
    g.drawImage(img, 0, 0, sw, sh, (IW - sw * cover) / 2, (panelH - sh * cover) / 2, sw * cover, sh * cover);
    g.fillStyle = 'rgba(5,4,9,.32)';
    g.fillRect(0, 0, IW, panelH);
    const fit = Math.min(IW / sw, panelH / sh);
    g.drawImage(img, 0, 0, sw, sh, (IW - sw * fit) / 2, (panelH - sh * fit) / 2, sw * fit, sh * fit);
    g.restore();
  } else {
    g.fillStyle = '#2a2436';
    g.fillRect(0, 0, IW, panelH);
    txt(g, 'КАДР ' + (WORLD_INTRO.frame + 1), IW / 2, panelH / 2, Math.round(28 * s), '#ffd23f', 'center');
  }
  g.fillStyle = accent;
  g.fillRect(0, panelH, IW, Math.max(2, Math.round(2 * s)));
  const boxY = panelH;
  g.fillStyle = '#0c0a14';
  g.fillRect(0, boxY, IW, IH - panelH);
  g.strokeStyle = accent;
  g.globalAlpha = 0.22;
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(pad, boxY + 1);
  g.lineTo(IW - pad, boxY + 1);
  g.stroke();
  g.globalAlpha = 1;
  const headY = boxY + Math.round(28 * s);
  txt(g, 'ПРОЛОГ ' + (WORLD_INTRO.frame + 1) + ' / ' + scenes.length, pad, headY, Math.round(12 * s), '#6f6880', 'left', F_B);
  txt(g, WORLD_INTRO.title, IW - pad, headY, Math.round(14 * s), accent, 'right', F_B);
  const shown = sc.text.substring(0, WORLD_INTRO.cur);
  const cursor = WORLD_INTRO.cur < sc.text.length && Math.floor(gt * 4) % 2 === 0 ? '▌' : '';
  const fs = Math.round(18 * s);
  const wrapW = Math.min(Math.round(IW * 0.78), Math.round(980 * s));
  const lines = layoutLines(g, shown + cursor, wrapW, fs, F_B);
  const lineH = Math.round(26 * s);
  const textTop = boxY + Math.round(58 * s);
  lines.forEach(function (ln, i) {
    txt(g, ln, IW / 2, textTop + i * lineH, fs, '#f2eef8', 'center', F_B);
  });
  const hintY = IH - Math.round(22 * s);
  const allPrinted = WORLD_INTRO.cur >= sc.text.length;
  txt(
    g,
    allPrinted ? 'ENTER — ДАЛЬШЕ  ·  ПРОБЕЛ — ПРОПУСТИТЬ ПРОЛОГ' : 'ENTER — УСКОРИТЬ  ·  ПРОБЕЛ — ПРОПУСТИТЬ ПРОЛОГ',
    IW / 2,
    hintY,
    Math.round(13 * s),
    '#6f6880',
    'center',
    F_B
  );
  if (WORLD_INTRO.skipT > 0) {
    const hold = typeof INTRO_SKIP_HOLD === 'number' ? INTRO_SKIP_HOLD : 3;
    const skipT = clamp(WORLD_INTRO.skipT / hold, 0, 1);
    const left = Math.max(0, hold - WORLD_INTRO.skipT);
    const skipR = Math.max(13, Math.round(15 * s));
    const skipCx = pad + skipR;
    const skipCy = IH - Math.round(48 * s);
    g.fillStyle = 'rgba(5,4,9,.72)';
    g.beginPath();
    g.arc(skipCx, skipCy, skipR + 5, 0, TAU);
    g.fill();
    g.lineWidth = Math.max(3, Math.round(3.2 * s));
    g.strokeStyle = 'rgba(255,255,255,.16)';
    g.beginPath();
    g.arc(skipCx, skipCy, skipR, 0, TAU);
    g.stroke();
    g.strokeStyle = accent;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(skipCx, skipCy, skipR, -Math.PI / 2, -Math.PI / 2 + skipT * TAU);
    g.stroke();
    g.lineCap = 'butt';
    txt(g, left.toFixed(1), skipCx, skipCy + Math.round(1 * s), Math.round(11 * s), accent, 'center', F_D);
    txt(g, 'ПРОПУСК', skipCx + skipR + Math.round(10 * s), skipCy + Math.round(1 * s), Math.round(10 * s), '#c8c2d4', 'left', F_B);
  }
  const n = scenes.length, gap = Math.round(16 * s), r = Math.max(3, Math.round(3.5 * s));
  const dotsX = IW / 2 - (n * gap) / 2;
  const dotsY = boxY + Math.round(28 * s);
  for (let i = 0; i < n; i++) {
    g.fillStyle = i < WORLD_INTRO.frame ? accent : (i === WORLD_INTRO.frame ? '#ff9d2e' : '#3a3548');
    g.beginPath();
    g.arc(dotsX + i * gap + gap / 2, dotsY, r, 0, TAU);
    g.fill();
  }
  if (typeof drawVhsOverlay === 'function') {
    try { drawVhsOverlay({x: 0, y: 0, w: IW, h: panelH}); } catch (e) {}
  }
}

worldIntroEnqueueImgs();
worldIntroLoadText();
