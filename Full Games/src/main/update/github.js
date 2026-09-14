////////////////////////////////////////////////////////
//
// Релизы на GitHub: zip игры и MSI лаунчера — разные теги.
//
////////////////////////////////////////////////////////

'use strict';

const updateCfg = require('../../../config/update.json');
const { isNewer } = require('./version');

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
  const all = [];
  const base = 'https://api.github.com/repos/' + updateCfg.owner + '/' + updateCfg.repo + '/releases?per_page=100';
  for (let page = 1; page <= 10; page++) {
    const list = await getJson(base + '&page=' + page);
    if (!Array.isArray(list) || list.length === 0) break;
    all.push.apply(all, list);
    if (list.length < 100) break;
  }
  listCache = all;
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
 * Карточка релиза канала или null.
 * @param {object} release
 * @param {'game'|'launcher'} kind
 * @returns {{tag: string, name: string, url: string, size: number}|null}
 */
function remoteFromRelease(release, kind) {
  if (!release || release.draft || release.prerelease) return null;
  switch (kind) {
    case 'launcher': {
      if (!isLauncherRelease(release)) return null;
      const asset = pickLauncherAsset(release);
      return asset && asset.browser_download_url ? toRemote(release, asset) : null;
    }
    case 'game': {
      if (isLauncherRelease(release)) return null;
      const asset = pickContentAsset(release);
      return asset && asset.browser_download_url ? toRemote(release, asset) : null;
    }
    default: {
      return null;
    }
  }
}

/**
 * Самый новый по номеру тега, не первый в ленте GitHub.
 * @param {Array<{tag: string}|null|undefined>} items
 * @returns {object|null}
 */
function pickNewestRemote(items) {
  let best = null;
  const list = Array.isArray(items) ? items : [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (!item || !item.tag) continue;
    if (!best || isNewer(item.tag, best.tag)) best = item;
  }
  return best;
}

/**
 * Свежий ассет канала из уже загруженного списка релизов.
 * @param {object[]} list
 * @param {'game'|'launcher'} kind
 * @returns {{tag: string, name: string, url: string, size: number}|null}
 */
function pickLatestFromReleases(list, kind) {
  const found = [];
  const rows = Array.isArray(list) ? list : [];
  for (let i = 0; i < rows.length; i++) {
    const remote = remoteFromRelease(rows[i], kind);
    if (remote) found.push(remote);
  }
  return pickNewestRemote(found);
}

/**
 * Последний публичный релиз с zip игры.
 * @returns {Promise<{tag: string, name: string, url: string, size: number}|null>}
 */
async function fetchLatestGame() {
  return pickLatestFromReleases(await fetchReleaseList(), 'game');
}

/**
 * Последний публичный релиз MSI лаунчера.
 * @returns {Promise<{tag: string, name: string, url: string, size: number}|null>}
 */
async function fetchLatestLauncher() {
  return pickLatestFromReleases(await fetchReleaseList(), 'launcher');
}

module.exports = {
  fetchLatestGame,
  fetchLatestLauncher,
  pickContentAsset,
  pickLauncherAsset,
  pickLatestFromReleases,
  pickNewestRemote,
  isLauncherRelease,
  headers
};
