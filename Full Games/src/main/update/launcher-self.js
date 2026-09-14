////////////////////////////////////////////////////////
//
// Лаунчер качает свой MSI с GitHub и запускает установщик.
//
////////////////////////////////////////////////////////

'use strict';

const path = require('path');
const { spawn } = require('child_process');
const { app } = require('electron');
const launcherCfg = require('../../../config/launcher.json');
const { fetchLatestLauncher } = require('./github');
const { downloadFile } = require('./download');
const { isNewer, normalizeTag } = require('./version');
const { formatBytes } = require('./format');

let busy = false;
let lastProgress = null;

/**
 * Номер, с которым собрали этот exe.
 * @returns {string}
 */
function localVersion() {
  return String((launcherCfg && launcherCfg.version) || app.getVersion() || '');
}

/**
 * Одинарные кавычки PowerShell, без инъекции.
 * @param {string} value
 * @returns {string}
 */
function psSingle(value) {
  return "'" + String(value || '').replace(/'/g, "''") + "'";
}

/**
 * Снимок канала лаунчера для UI.
 * @returns {Promise<object>}
 */
async function snapshot() {
  let remote = null;
  let remoteError = '';
  if (app.isPackaged) {
    try {
      remote = await fetchLatestLauncher();
    } catch (err) {
      remoteError = err.message || String(err);
    }
  }
  const local = localVersion();
  const needUpdate = Boolean(app.isPackaged && remote && isNewer(remote.tag, local));
  return {
    packaged: app.isPackaged,
    busy,
    needUpdate,
    localVersion: local,
    remoteTag: remote ? remote.tag : '',
    remoteName: remote ? remote.name : '',
    remoteSize: remote ? remote.size : 0,
    remoteError,
    progress: lastProgress
  };
}

/**
 * После выхода: UAC → msiexec (замена per-machine) → снова exe.
 * Если установку отменили, старый клиент всё равно откроется.
 * @param {string} msiPath
 */
function scheduleApply(msiPath) {
  const exe = process.execPath;
  const args = ['/i', msiPath, '/qb!', '/norestart', 'ALLUSERS=1', 'REBOOT=ReallySuppress']
    .map(psSingle)
    .join(',');
  const ps =
    'Start-Sleep -Seconds 4; ' +
    'try { Start-Process -FilePath msiexec -ArgumentList @(' +
    args +
    ') -Verb RunAs -Wait } catch {}; ' +
    'if (Test-Path -LiteralPath ' +
    psSingle(exe) +
    ') { Start-Process -FilePath ' +
    psSingle(exe) +
    ' }';
  spawn('powershell.exe', [
    '-NoProfile',
    '-WindowStyle',
    'Hidden',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    ps
  ], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  }).unref();
  setTimeout(() => app.quit(), 400);
}

/**
 * Качает MSI и передаёт его Windows Installer.
 * @param {(info: object) => void} onProgress
 * @returns {Promise<object>}
 */
async function applyLatest(onProgress) {
  if (busy) return { ok: false, issues: ['Уже идёт обновление лаунчера.'] };
  if (!app.isPackaged) {
    return { ok: false, issues: ['В разработке лаунчер не качает сам себя.'] };
  }
  busy = true;
  const cache = path.join(app.getPath('userData'), 'Cache');
  const emit = (info) => {
    lastProgress = info;
    if (onProgress) onProgress(info);
  };
  try {
    emit({ phase: 'check', pct: 2, label: 'Спрашиваю GitHub про лаунчер…' });
    const remote = await fetchLatestLauncher();
    if (!remote) {
      throw new Error('В релизах нет MSI лаунчера (тег launcher-*).');
    }
    if (!isNewer(remote.tag, localVersion())) {
      lastProgress = { phase: 'done', pct: 100, label: 'Лаунчер уже свежий.' };
      busy = false;
      return { ok: true, applying: false };
    }
    const msiPath = path.join(cache, remote.name || 'KolesnicaVoyny.msi');
    emit({
      phase: 'download',
      pct: 4,
      label: 'Скачиваю ' + remote.name + ' (' + formatBytes(remote.size) + ')'
    });
    await downloadFile(remote.url, msiPath, emit);
    emit({ phase: 'apply', pct: 98, label: 'Ставлю лаунчер. Окно закроется.' });
    lastProgress = { phase: 'apply', pct: 99, label: 'Запускаю установщик…' };
    scheduleApply(msiPath);
    return {
      ok: true,
      applying: true,
      version: normalizeTag(remote.tag),
      asset: remote.name
    };
  } catch (err) {
    lastProgress = { phase: 'error', pct: 0, label: err.message || String(err) };
    busy = false;
    return { ok: false, issues: [err.message || String(err)] };
  }
}

module.exports = { snapshot, applyLatest, localVersion };
