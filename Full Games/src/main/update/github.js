////////////////////////////////////////////////////////
//
// Релизы на GitHub: zip игры и MSI лаунчера — разные теги.
//
////////////////////////////////////////////////////////

'use strict';

const updateCfg = require('../../../config/update.json');

let listCache = null;
let listCachedAt = 0;

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
 * Публичные релизы, свежие сверху. Кэш 2 минуты на процесс.
 * @returns {Promise<object[]>}
 */
async function fetchReleaseList() {
  if (listCache && Date.now() - listCachedAt < 120000) return listCache;
  const url = 'https://api.github.com/repos/' + updateCfg.owner + '/' + updateCfg.repo + '/releases?per_page=100';
  const list = await getJson(url);
  listCache = Array.isArray(list) ? list : [];
  listCachedAt = Date.now();
  return listCache;
}

/**
 * Выбирает zip контента в релизе.
 * @param {object} release
 * @returns {object|null}
 */
function pickContentAsset(release) {
  const prefix = String(updateCfg.assetPrefix || 'kolesnica-content').toLowerCase();
  const assets = (release && release.assets) || [];
  return assets.find((item) => {
    const name = String(item.name || '').toLowerCase();
    return name.startsWith(prefix) && name.endsWith('.zip');
  }) || null;
}

/**
 * Выбирает MSI лаунчера в релизе.
 * @param {object} release
 * @returns {object|null}
 */
function pickLauncherAsset(release) {
  const prefix = String(updateCfg.launcherAssetPrefix || 'KolesnicaVoyny').toLowerCase();
  const assets = (release && release.assets) || [];
  return assets.find((item) => {
    const name = String(item.name || '').toLowerCase();
    return name.startsWith(prefix) && name.endsWith('.msi');
  }) || null;
}

/**
 * Тег канала лаунчера, не zip игры.
 * @param {object} release
 * @returns {boolean}
 */
function isLauncherRelease(release) {
  return /^(launcher)[-_]/i.test(String((release && release.tag_name) || ''));
}

/**
 * Собирает карточку ассета.
 * @param {object} release
 * @param {object} asset
 * @returns {{tag: string, name: string, url: string, size: number}}
 */
function toRemote(release, asset) {
  return {
    tag: release.tag_name,
    name: asset.name,
    url: asset.browser_download_url,
    size: Number(asset.size) || 0
  };
}

/**
 * Последний публичный релиз с zip игры.
 * @returns {Promise<{tag: string, name: string, url: string, size: number}|null>}
 */
async function fetchLatestGame() {
  const list = await fetchReleaseList();
  for (const release of list) {
    if (!release || release.draft || release.prerelease) continue;
    if (isLauncherRelease(release)) continue;
    const asset = pickContentAsset(release);
    if (!asset || !asset.browser_download_url) continue;
    return toRemote(release, asset);
  }
  return null;
}

/**
 * Последний публичный релиз MSI лаунчера.
 * @returns {Promise<{tag: string, name: string, url: string, size: number}|null>}
 */
async function fetchLatestLauncher() {
  const list = await fetchReleaseList();
  for (const release of list) {
    if (!release || release.draft || release.prerelease) continue;
    if (!isLauncherRelease(release)) continue;
    const asset = pickLauncherAsset(release);
    if (!asset || !asset.browser_download_url) continue;
    return toRemote(release, asset);
  }
  return null;
}

module.exports = {
  fetchLatestGame,
  fetchLatestLauncher,
  pickContentAsset,
  pickLauncherAsset,
  isLauncherRelease,
  headers
};
