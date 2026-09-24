////////////////////////////////////////////////////////
//
// Хост рантайма: какой HTML получает модули движка.
// Определяем по пути и meta, не по тексту функций игры.
//
////////////////////////////////////////////////////////

'use strict';

const path = require('path');
const engine = require('../../config/engine.json');
const game = require('../../config/game.json');

const META_RE = /<meta\s+name=["']divan-engine["']\s+content=["']([^"']+)["']\s*\/?>/i;

/**
 * Имя файла из pathname протокола.
 * @param {string} [pathname]
 * @returns {string}
 */
function fileName(pathname) {
  if (!pathname) return '';
  const clean = String(pathname).split('?')[0].split('#')[0].replace(/\\/g, '/');
  const base = clean.split('/').filter(Boolean).pop() || '';
  return decodeURIComponent(base).toLowerCase();
}

/**
 * Значение meta divan-engine, если оно есть.
 * @param {string} html
 * @returns {string}
 */
function metaHost(html) {
  const match = String(html || '').match(META_RE);
  return match ? match[1].trim().toLowerCase() : '';
}

/**
 * game | lab | пусто. Посторонние страницы не получают движок.
 * @param {string} html
 * @param {{pathname?: string}} [options]
 * @returns {string}
 */
function resolveHost(html, options) {
  const name = fileName(options && options.pathname);
  const entry = String(game.entry || 'rnr.html').toLowerCase();
  const lab = String(engine.labEntry || 'Editor.html').toLowerCase();
  if (name === entry) return 'game';
  if (name === lab) return 'lab';
  const meta = metaHost(html);
  if (meta === 'game' || meta === 'lab') return meta;
  return '';
}

/**
 * Теги script/link для выбранного хоста.
 * @param {string} host
 * @returns {string}
 */
function runtimeTags(host) {
  const spec = engine.hosts[host];
  if (!spec) return '';
  const meta = {
    name: engine.name || 'DiVANEngine',
    abi: engine.abi,
    contentSchema: engine.contentSchema,
    runtime: engine.runtime,
    version: game.version,
    host
  };
  const lines = [
    `<script>window.__DIVAN_ENGINE_META__=${JSON.stringify(meta)};</script>`
  ];
  for (const file of spec.scripts || []) {
    lines.push(`<script src="/__engine/${file}"></script>`);
  }
  return lines.join('\n');
}

/**
 * Разметка сплэша лаборатории: арт и слоты версии / файла.
 * @returns {string}
 */
function labSplashMarkup() {
  const raw = String((game && game.version) || '');
  const ver = raw ? (/^v/i.test(raw) ? raw : 'v' + raw) : '';
  return '<div id="lab-splash" class="lab-splash" role="status" aria-live="polite" aria-label="Загрузка DiVANEngine">'
    + '<div class="lab-splash-stage">'
    + '<img class="lab-splash-art" src="/assets/ui/SplashScreen/splashscreen.svg" alt="" width="900" height="420" decoding="async" fetchpriority="high">'
    + '<p id="lab-splash-version" class="lab-splash-version">' + ver.replace(/</g, '') + '</p>'
    + '<p id="lab-splash-files" class="lab-splash-files">Файлы</p>'
    + '</div></div>';
}

/**
 * Переносит старт игры за теги движка: иначе исходный bootGo успевает запуститься
 * до замены хука, а заставка движка никогда не получает управление.
 * @param {string} html
 * @returns {{html:string,start:string}}
 */
function deferGameBoot(html) {
  const call = 'try{bootGo();}catch(e){console.error(e);bootFinish();}';
  const bootFx = html.lastIndexOf('bootFxStart();');
  const at = html.lastIndexOf(call);
  if (bootFx < 0 || at < bootFx) return { html, start: '' };
  const before = html.slice(0, at);
  const after = html.slice(at + call.length);
  const deferred = (before + '/* bootGo запускается после модулей движка */' + after)
    .replace('id="boot-screen" class="is-load"', 'id="boot-screen" class="is-load creator-intro-pending"');
  const fallback = "if(!window.DiVANEngine||!window.DiVANEngine.original||window.DiVANEngine.original('bootGo')===bootGo){"
    + "const s=document.getElementById('boot-screen');if(s)s.classList.remove('creator-intro-pending');}";
  return { html: deferred, start: '<script>' + fallback + call + '</script>' };
}

/**
 * Вставляет рантайм перед </body> и служебные теги лаборатории.
 * @param {string} html
 * @param {{pathname?: string}} [options]
 * @returns {string}
 */
function injectRuntime(html, options) {
  if (String(html).includes('__DIVAN_ENGINE_META__')) return html;
  const host = resolveHost(html, options);
  if (!host) return html;
  const spec = engine.hosts[host];
  if (!spec) return html;
  let result = html;
  if (spec.before) {
    for (const [target, insert] of Object.entries(spec.before)) {
      const needle = `<script src="${target}`;
      for (const file of Array.isArray(insert) ? insert : [insert]) {
        const tag = `<script src="/__engine/${file}"></script>\n`;
        if (result.includes(needle) && !result.includes(`/__engine/${file}`)) {
          result = result.replace(needle, tag + needle);
        }
      }
    }
  }
  if (Array.isArray(spec.styles)) {
    for (const href of spec.styles) {
      const tag = `<link rel="stylesheet" href="/__engine/${href}">`;
      if (result.includes('</head>') && !result.includes(tag)) {
        result = result.replace('</head>', `${tag}</head>`);
      }
    }
  }
  if (host === 'lab' && !result.includes('id="lab-splash"')) {
    result = result.replace(/<body[^>]*>/i, function (open) {
      return open + labSplashMarkup();
    });
  }
  const tags = runtimeTags(host);
  if (host === 'game' && options && options.storeDump && result.includes('</head>')) {
    const json = JSON.stringify(options.storeDump).replace(/</g, '\\u003c');
    const boot = `<script>window.__DIVAN_ENGINE_STORE__=${json};</script>`;
    if (!result.includes('__DIVAN_ENGINE_STORE__')) {
      result = result.replace('</head>', `${boot}</head>`);
    }
  }
  const boot = host === 'game' ? deferGameBoot(result) : { html: result, start: '' };
  result = boot.html;
  if (!tags) return result;
  if (result.includes('</body>')) {
    return result.replace('</body>', `${tags}\n${boot.start}\n</body>`);
  }
  return result + tags + boot.start;
}

module.exports = {
  fileName,
  metaHost,
  resolveHost,
  runtimeTags,
  deferGameBoot,
  injectRuntime,
  engineConfig: engine
};
