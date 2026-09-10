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
      const tag = `<script src="/__engine/${insert}"></script>\n`;
      if (result.includes(needle) && !result.includes(`/__engine/${insert}`)) {
        result = result.replace(needle, tag + needle);
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
  const tags = runtimeTags(host);
  if (host === 'game' && options && options.storeDump && result.includes('</head>')) {
    const json = JSON.stringify(options.storeDump).replace(/</g, '\\u003c');
    const boot = `<script>window.__DIVAN_ENGINE_STORE__=${json};</script>`;
    if (!result.includes('__DIVAN_ENGINE_STORE__')) {
      result = result.replace('</head>', `${boot}</head>`);
    }
  }
  if (!tags) return result;
  if (result.includes('</body>')) {
    return result.replace('</body>', `${tags}\n</body>`);
  }
  return result + tags;
}

module.exports = {
  fileName,
  metaHost,
  resolveHost,
  runtimeTags,
  injectRuntime,
  engineConfig: engine
};
