////////////////////////////////////////////////////////
//
// Лаунчер качает свой MSI, поднимает UAC и ставит себя.
//
////////////////////////////////////////////////////////

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { app } = require('electron');
const launcherCfg = require('../../../config/launcher.json');
const { fetchLatestLauncher } = require('./github');
const { downloadFile } = require('./download');
const { isNewer, normalizeTag } = require('./version');
const { formatBytes } = require('./format');
const { msiexecArguments, powershellFileArguments } = require('./installer-args');

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
 * Пишет helper: ждёт выхода лаунчера → msiexec → снова exe.
 * @param {string} msiPath
 * @param {string} exePath
 * @param {number} pid
 * @returns {string} путь к .ps1
 */
function writeApplyHelper(msiPath, exePath, pid) {
  const file = path.join(os.tmpdir(), 'kolesnica-apply-' + pid + '.ps1');
  const log = path.join(os.tmpdir(), 'kolesnica-install-' + pid + '.log');
  const body = [
    '$ErrorActionPreference = "Stop"',
    '$targetPid = ' + Number(pid),
    '$msi = ' + psSingle(msiPath),
    '$exe = ' + psSingle(exePath),
    '$log = ' + psSingle(log),
    'for ($i = 0; $i -lt 120; $i++) {',
    '  if (-not (Get-Process -Id $targetPid -ErrorAction SilentlyContinue)) { break }',
    '  Start-Sleep -Seconds 1',
    '}',
    'Start-Sleep -Seconds 1',
    '$msiArgs = ' + psSingle(msiexecArguments(msiPath, log)),
    'try {',
    '  $proc = Start-Process -FilePath "msiexec.exe" -ArgumentList $msiArgs -Wait -PassThru',
    '} catch {',
    '  Add-Type -AssemblyName PresentationFramework',
    '  [System.Windows.MessageBox]::Show("Не удалось запустить установщик: $($_.Exception.Message)`nЖурнал: $log", "Обновление лаунчера") | Out-Null',
    '  exit 1',
    '}',
    'if ($proc.ExitCode -ne 0 -and $proc.ExitCode -ne 3010) {',
    '  Add-Type -AssemblyName PresentationFramework',
    '  [System.Windows.MessageBox]::Show("Установка не удалась (код $($proc.ExitCode)).`nЖурнал: $log", "Обновление лаунчера") | Out-Null',
    '  exit $proc.ExitCode',
    '}',
    'if (Test-Path -LiteralPath $exe) { Start-Process -FilePath $exe }',
    'Remove-Item -LiteralPath $MyInvocation.MyCommand.Path -Force -ErrorAction SilentlyContinue',
    ''
  ].join('\r\n');
  fs.writeFileSync(file, '\uFEFF' + body, 'utf8');
  return file;
}

/**
 * Поднимает UAC и запускает helper. Лаунчер ещё на экране.
 * @param {string} helperPath
 * @returns {Promise<void>}
 */
function elevateHelper(helperPath) {
  return new Promise((resolve, reject) => {
    const ps =
      'try {' +
      ' Start-Process -FilePath "powershell.exe" -ArgumentList ' +
      psSingle(powershellFileArguments(helperPath)) +
      ' -Verb RunAs;' +
      ' exit 0' +
      '} catch {' +
      ' exit 2' +
      '}';
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps],
      {
        windowsHide: false,
        stdio: 'ignore'
      }
    );
    let settled = false;
    const done = (err) => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve();
    };
    child.on('error', (err) => done(err));
    child.on('close', (code) => {
      if (code === 0) done();
      else done(new Error('Установка отменена или нет прав администратора.'));
    });
  });
}

/**
 * UAC → helper ждёт наш выход → msiexec → снова exe.
 * @param {string} msiPath
 * @returns {Promise<void>}
 */
async function scheduleApply(msiPath) {
  const exe = process.execPath;
  const helper = writeApplyHelper(msiPath, exe, process.pid);
  await elevateHelper(helper);
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
    fs.mkdirSync(cache, { recursive: true });
    const msiPath = path.join(cache, remote.name || 'KolesnicaVoyny.msi');
    emit({
      phase: 'download',
      pct: 4,
      label: 'Скачиваю ' + remote.name + ' (' + formatBytes(remote.size) + ')'
    });
    await downloadFile(remote.url, msiPath, emit);
    if (!fs.existsSync(msiPath) || fs.statSync(msiPath).size < 1024) {
      throw new Error('MSI не скачался или файл пустой.');
    }
    emit({
      phase: 'apply',
      pct: 96,
      label: 'Нужны права администратора — подтверди UAC…'
    });
    await scheduleApply(msiPath);
    lastProgress = {
      phase: 'apply',
      pct: 99,
      label: 'Установщик запущен. Лаунчер закроется и откроется снова.'
    };
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

module.exports = { snapshot, applyLatest, localVersion, psSingle };
