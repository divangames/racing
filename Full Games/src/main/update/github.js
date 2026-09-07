////////////////////////////////////////////////////////
//
// Релизы игры на GitHub: последний zip контента.
//
////////////////////////////////////////////////////////

'use strict';

const updateCfg = require('../../../config/update.json');

/**
 * Заголовки для api.github.com.
 * @returns {object}
 */
function headers() {
  return {
    Accept: 'application/vnd.github+json',
    'User-Agent': updateCfg.userAgent || 'KolesnicaVoyny-Launcher',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

/**
 * JSON с GitHub.
 * @param {string} url
 * @returns {Promise<object>}
 */
async function getJson(url) {
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    throw new Error('GitHub ' + res.status + ': не удалось прочитать релизы.');
  }
  return res.json();
}

/**
 * Выбирает zip контента в релизе.
 * @param {object} release
 * @returns {object|null}
 */
function pickContentAsset(release) {
  const prefix = updateCfg.assetPrefix || 'kolesnica-content';
  const assets = (release && release.assets) || [];
  return assets.find((item) => {
    const name = String(item.name || '').toLowerCase();
    return name.startsWith(prefix.toLowerCase()) && name.endsWith('.zip');
  }) || null;
}

let cached = null;
let cachedAt = 0;

/**
 * Последний публичный релиз с zip игры.
 * @returns {Promise<{tag: string, name: string, url: string, size: number}|null>}
 */
async function fetchLatestGame() {
  if (cached && Date.now() - cachedAt < 120000) return cached;
  const url = 'https://api.github.com/repos/' + updateCfg.owner + '/' + updateCfg.repo + '/releases?per_page=20';
  const list = await getJson(url);
  if (!Array.isArray(list)) return null;
  let found = null;
  for (const release of list) {
    if (!release || release.draft || release.prerelease) continue;
    const asset = pickContentAsset(release);
    if (!asset || !asset.browser_download_url) continue;
    found = {
      tag: release.tag_name,
      name: asset.name,
      url: asset.browser_download_url,
      size: Number(asset.size) || 0
    };
    break;
  }
  cached = found;
  cachedAt = Date.now();
  return found;
}

module.exports = { fetchLatestGame, pickContentAsset, headers };
