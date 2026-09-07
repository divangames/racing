////////////////////////////////////////////////////////
//
// Протокол rnr:// — игра как обычный origin, не file://.
// HTML при отдаче правится только в памяти, диск браузерной игры цел.
//
////////////////////////////////////////////////////////

'use strict';

const fs = require('fs');
const path = require('path');
const { protocol } = require('electron');
const { game, contentRoot, vendorLocalRoot } = require('./paths');
const { handleSaveCar } = require('./save-car');
const { handleSaveTrack, handleListTracks } = require('./save-track');
const { handleListTextures, handleSaveTexture } = require('./save-texture');
const { handleListPacks, handleSavePack, handleSaveOblab } = require('./save-object');
const { MIME, serveLocalFile } = require('./serve-file');
const { engineFile, enhanceHtml } = require('./enhancements');
const { enhanceEditorScript } = require('./editor-enhancements');
const { listLabSounds } = require('./lab-sounds');

/**
 * Регистрировать до app ready.
 */
function registerPrivilegedScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: game.scheme,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
        bypassCSP: true
      }
    }
  ]);
}

/**
 * Файл внутри корня, без выхода наверх.
 * @param {string} root
 * @param {string} rel
 * @returns {string|null}
 */
function safeJoin(root, rel) {
  const resolved = path.resolve(root, rel);
  const relative = path.relative(root, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }
  return resolved;
}

/**
 * Подмена CDN Three на локальные модули, скрытие браузерного донесения.
 * @param {string} html
 * @returns {string}
 */
function rewriteGameHtml(html) {
  const vendor = vendorLocalRoot();
  const hasThree = fs.existsSync(path.join(vendor, 'three.module.js'));
  const hasQuarks = fs.existsSync(path.join(vendor, 'three.quarks.esm.js'));
  const hasCore = fs.existsSync(path.join(vendor, 'quarks.core.esm.js'));
  let out = html;
  // Офлайн: Google Fonts не должны блокировать первый кадр чёрным окном.
  out = out.replace(/<link[^>]*fonts\.googleapis\.com[^>]*>/gi, '');
  out = out.replace(/<link[^>]*fonts\.gstatic\.com[^>]*>/gi, '');
  if (hasThree && hasQuarks && hasCore) {
    out = out.replace(
      /"three":\s*"[^"]+"/,
      '"three": "/vendor-local/three.module.js"'
    );
    out = out.replace(
      /"three.quarks":\s*"[^"]+"/,
      '"three.quarks": "/vendor-local/three.quarks.esm.js"'
    );
    out = out.replace(
      /"quarks.core":\s*"[^"]+"/,
      '"quarks.core": "/vendor-local/quarks.core.esm.js"'
    );
  }
  const localFonts = '<style>@font-face{font-family:"Russo One";src:url("/assets/fonts/bender/Bender-Bold.otf") format("opentype");font-display:swap}@font-face{font-family:"Chakra Petch";src:url("/assets/fonts/montserrat/cyrillic-600-normal.woff2") format("woff2");font-display:swap}</style>';
  const inject = `${localFonts}<script>try{localStorage.setItem('rnr_client_notice_v1','1');}catch(e){}window.__RNR_DESKTOP__=true;</script>`;
  if (out.includes('</head>')) {
    out = out.replace('</head>', `${inject}</head>`);
  }
  out = out.replace(
    'РОК-Н-РОЛЛ ГОНКИ — браузерный оммаж',
    'Колесница войны'
  );
  return enhanceHtml(out);
}

/**
 * Абсолютный путь к запрошенному ресурсу.
 * @param {string} pathname
 * @returns {string|null}
 */
function resolveContentPath(pathname) {
  let rel = decodeURIComponent(pathname || '/');
  if (rel.startsWith('/')) rel = rel.slice(1);
  if (!rel || rel === '/') rel = game.entry;
  if (rel.startsWith('vendor-local/')) {
    return safeJoin(vendorLocalRoot(), rel.slice('vendor-local/'.length));
  }
  return engineFile(rel) || safeJoin(contentRoot(), rel);
}

const MUSIC_CATS = ['main', 'change', 'garage', 'intro', 'racing', 'Load'];
const MUSIC_EXTS = new Set(['.mp3', '.ogg', '.wav', '.m4a']);

/**
 * Имена треков в assets/music/{категория}/ без подпапок.
 * @returns {Record<string, string[]>}
 */
function listMusicIndex() {
  const out = {};
  const root = path.join(contentRoot(), 'assets', 'music');
  for (const cat of MUSIC_CATS) {
    const folder = path.join(root, cat);
    const names = [];
    if (fs.existsSync(folder) && fs.statSync(folder).isDirectory()) {
      for (const name of fs.readdirSync(folder)) {
        const full = path.join(folder, name);
        if (!fs.statSync(full).isFile()) continue;
        if (!MUSIC_EXTS.has(path.extname(name).toLowerCase())) continue;
        names.push(name);
      }
      names.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    }
    out[cat] = names;
  }
  return out;
}

/**
 * Включает rnr:// после готовности приложения.
 */
function attachProtocol() {
  protocol.handle(game.scheme, async (request) => {
    try {
      return await handleRnrRequest(request);
    } catch (err) {
      console.error('rnr://', request.url, err);
      return new Response('Protocol error', { status: 500, headers: { 'content-type': 'text/plain' } });
    }
  });
}

/**
 * Один запрос rnr://.
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function handleRnrRequest(request) {
    const url = new URL(request.url);
    if (url.pathname === '/__save-car' && request.method === 'POST') {
      return handleSaveCar(request);
    }
    if (url.pathname === '/__save-track' && request.method === 'POST') {
      return handleSaveTrack(request);
    }
    if (url.pathname === '/__save-texture' && request.method === 'POST') {
      return handleSaveTexture(request);
    }
    if (url.pathname === '/__save-pack' && request.method === 'POST') {
      return handleSavePack(request);
    }
    if (url.pathname === '/__save-oblab' && request.method === 'POST') {
      return handleSaveOblab(request);
    }
    if (url.pathname === '/__object-packs') {
      return handleListPacks();
    }
    if (url.pathname === '/__track-textures' || url.pathname === '/__textures') {
      return handleListTextures();
    }
    if (url.pathname === '/__tracks') {
      return handleListTracks();
    }
    if (url.pathname === '/__music-index') {
      const body = JSON.stringify(listMusicIndex());
      return new Response(body, {
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store'
        }
      });
    }
    if (url.pathname === '/__lab-sounds') {
      const body = JSON.stringify(listLabSounds(contentRoot()));
      return new Response(body, {
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store'
        }
      });
    }
    const filePath = resolveContentPath(url.pathname);
    if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain' } });
    }
    const ext = path.extname(filePath).toLowerCase();
    if (url.pathname === '/editor/map-app.js') {
      const original = fs.readFileSync(filePath, 'utf8');
      let body;
      try { body = enhanceEditorScript(original); }
      catch (error) {
        console.warn('Расширения редактора несовместимы с этой версией контента:', error.message);
        body = original;
      }
      return serveLocalFile(filePath, request, {body, type:MIME['.js']});
    }
    if (ext === '.html') {
      const html = rewriteGameHtml(fs.readFileSync(filePath, 'utf8'));
      return serveLocalFile(filePath, request, { body: html, type: MIME['.html'] });
    }
    return serveLocalFile(filePath, request);
}

/**
 * Стартовый адрес игры.
 * @returns {string}
 */
function gameStartUrl() {
  return `${game.scheme}://${game.host}/${game.entry}`;
}

/**
 * Адрес лаборатории.
 * @returns {string}
 */
function labStartUrl() {
  return `${game.scheme}://${game.host}/Editor.html`;
}

module.exports = {
  registerPrivilegedScheme,
  attachProtocol,
  gameStartUrl,
  labStartUrl,
  resolveContentPath
};
