////////////////////////////////////////////////////////
//
// Заливка zip на GitHub: VPN ломает HTTP/2 и системный прокси.
//
////////////////////////////////////////////////////////

'use strict';

const dns = require('dns');
const fs = require('fs');
const https = require('https');
const path = require('path');
const { spawnSync } = require('child_process');

try {
  dns.setDefaultResultOrder('ipv4first');
} catch (err) {
  /* Node без ipv4first */
}

const client = path.resolve(__dirname, '..');

/**
 * Окружение для gh: HTTP/1.1, без прокси Clash/Hiddify (трафик всё ещё через TUN).
 * @param {NodeJS.ProcessEnv} [base]
 * @returns {NodeJS.ProcessEnv}
 */
function buildGhEnv(base) {
  const env = { ...base };
  const debug = String(env.GODEBUG || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => s !== 'http2client=0');
  debug.push('http2client=0');
  env.GODEBUG = debug.join(',');
  delete env.HTTP_PROXY;
  delete env.HTTPS_PROXY;
  delete env.ALL_PROXY;
  delete env.http_proxy;
  delete env.https_proxy;
  delete env.all_proxy;
  env.NO_PROXY = '*';
  env.no_proxy = '*';
  return env;
}

let ghPath = '';

/**
 * Настоящий gh.exe, не заглушка WindowsApps.
 * @returns {string}
 */
function resolveGh() {
  if (ghPath) return ghPath;
  const probe = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['gh'], {
    encoding: 'utf8',
    shell: true,
    windowsHide: true
  });
  const lines = String(probe.stdout || '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  ghPath = lines.find((p) => /\.exe$/i.test(p) && !/WindowsApps/i.test(p)) || lines[0] || 'gh';
  return ghPath;
}

/**
 * Запуск gh с VPN-обходом.
 * @param {string[]} args
 * @param {{inherit?: boolean}} [opts]
 * @returns {ReturnType<typeof spawnSync>}
 */
function runGh(args, opts) {
  return spawnSync(resolveGh(), args, {
    cwd: client,
    env: buildGhEnv(process.env),
    encoding: 'utf8',
    windowsHide: true,
    stdio: opts && opts.inherit ? 'inherit' : 'pipe'
  });
}

/**
 * Токен gh с диска, без сети.
 * @returns {string}
 */
function githubToken() {
  if (process.env.GH_TOKEN) return String(process.env.GH_TOKEN).trim();
  if (process.env.GITHUB_TOKEN) return String(process.env.GITHUB_TOKEN).trim();
  const got = runGh(['auth', 'token']);
  const token = String((got.stdout || '') + (got.stderr || '')).trim().split(/\s+/)[0];
  if (got.status !== 0 || !token || token.length < 8) {
    throw new Error('Нет входа в GitHub. В обычном cmd: gh auth login');
  }
  return token;
}

/**
 * HTTPS JSON. Только IPv4 и HTTP/1.1.
 * @param {string} url
 * @param {{method?: string, token: string, body?: string}} opts
 * @returns {Promise<{status: number, json: object|null, text: string}>}
 */
function apiRequest(url, opts) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const body = opts.body || null;
    const req = https.request(
      {
        protocol: 'https:',
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: opts.method || 'GET',
        family: 4,
        timeout: 120000,
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: 'Bearer ' + opts.token,
          'User-Agent': 'KolesnicaVoyny-Publish',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(body
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
            : {})
        }
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch (err) {
            json = null;
          }
          resolve({ status: res.statusCode || 0, json, text });
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Таймаут GitHub API'));
    });
    if (body) req.write(body);
    req.end();
  });
}

/**
 * Сырой файл на uploads.github.com.
 * @param {string} uploadUrl
 * @param {string} filePath
 * @param {string} token
 * @param {string} contentType
 * @returns {Promise<{status: number, json: object|null, text: string}>}
 */
function uploadAsset(uploadUrl, filePath, token, contentType) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(uploadUrl);
    const size = fs.statSync(filePath).size;
    const req = https.request(
      {
        protocol: 'https:',
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        family: 4,
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: 'Bearer ' + token,
          'Content-Type': contentType || 'application/octet-stream',
          'Content-Length': String(size),
          'User-Agent': 'KolesnicaVoyny-Publish',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch (err) {
            json = null;
          }
          resolve({ status: res.statusCode || 0, json, text });
        });
      }
    );
    req.setTimeout(0);
    req.on('error', reject);
    fs.createReadStream(filePath).on('error', reject).pipe(req);
  });
}

/**
 * Пауза между попытками.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Сначала gh (без прокси, HTTP/1.1), если VPN режет — API IPv4.
 * @param {{repo: string, tag: string, zipPath?: string, filePath?: string, title: string, notes: string, contentType?: string}} job
 */
async function publishRelease(job) {
  const filePath = job.filePath || job.zipPath;
  const fileName = path.basename(filePath);
  const ghArgsCreate = [
    'release',
    'create',
    job.tag,
    filePath,
    '--repo',
    job.repo,
    '--title',
    job.title,
    '--notes',
    job.notes
  ];
  const ghArgsUpload = [
    'release',
    'upload',
    job.tag,
    filePath,
    '--repo',
    job.repo,
    '--clobber'
  ];

  for (let attempt = 1; attempt <= 3; attempt++) {
    const view = runGh(['release', 'view', job.tag, '--repo', job.repo]);
    const args = view.status === 0 ? ghArgsUpload : ghArgsCreate;
    if (view.status === 0) {
      console.log('Тег уже есть: заменяю файл. Попытка ' + attempt + '/3');
    } else {
      console.log('Новый релиз ' + job.tag + '. Попытка ' + attempt + '/3');
    }
    const put = runGh(args, { inherit: true });
    if (put.status === 0) return { ok: true, via: 'gh' };
    console.warn('gh не прошёл (VPN/HTTP2/прокси). Жду и пробую снова.');
    await sleep(1500 * attempt);
  }

  console.log('Обход: заливка по API, IPv4, HTTP/1.1, без прокси.');
  const token = githubToken();
  const api = 'https://api.github.com/repos/' + job.repo;
  let rel = await apiRequest(api + '/releases/tags/' + encodeURIComponent(job.tag), { token });
  if (rel.status === 404) {
    rel = await apiRequest(api + '/releases', {
      token,
      method: 'POST',
      body: JSON.stringify({
        tag_name: job.tag,
        name: job.title,
        body: job.notes
      })
    });
  }
  if (rel.status >= 400 || !rel.json || !rel.json.id) {
    throw new Error('GitHub API не отдал релиз: ' + rel.status + ' ' + (rel.text || '').slice(0, 240));
  }
  const assets = rel.json.assets || [];
  for (const asset of assets) {
    if (String(asset.name) !== fileName) continue;
    const del = await apiRequest(api + '/releases/assets/' + asset.id, { token, method: 'DELETE' });
    if (del.status >= 400 && del.status !== 204) {
      throw new Error('Не удалось снять старый файл: ' + del.status);
    }
  }
  const uploadUrl =
    'https://uploads.github.com/repos/' +
    job.repo +
    '/releases/' +
    rel.json.id +
    '/assets?name=' +
    encodeURIComponent(fileName);
  const up = await uploadAsset(uploadUrl, filePath, token, job.contentType);
  if (up.status >= 400) {
    throw new Error('Заливка сорвалась: ' + up.status + ' ' + (up.text || '').slice(0, 240));
  }
  return { ok: true, via: 'api' };
}

/**
 * Точка входа батника.
 */
async function main() {
  const cfg = JSON.parse(fs.readFileSync(path.join(client, 'config', 'update.json'), 'utf8'));
  const game = JSON.parse(fs.readFileSync(path.join(client, 'config', 'game.json'), 'utf8'));
  const ver = String(game.version);
  const tag = 'game-' + ver;
  const zipPath = path.join(client, 'dist', 'kolesnica-content-' + ver + '.zip');
  if (!fs.existsSync(zipPath)) throw new Error('Нет архива: ' + zipPath);
  const repo = cfg.owner + '/' + cfg.repo;
  console.log('Архив:', zipPath);
  console.log('Тег:', tag);
  console.log('VPN: HTTP/1.1, IPv4, системный прокси отключён для этой заливки.');
  const result = await publishRelease({
    repo,
    tag,
    zipPath,
    title: 'Игра ' + ver,
    notes: 'Пакет контента для лаунчера. Сам лаунчер — отдельный тег launcher-* и MSI.',
    contentType: 'application/zip'
  });
  console.log('Релиз ' + tag + ' готов (' + result.via + ').');
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message || String(err));
    process.exit(1);
  });
}

module.exports = { buildGhEnv, publishRelease };
