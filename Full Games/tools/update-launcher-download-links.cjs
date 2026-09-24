////////////////////////////////////////////////////////
//
// Ссылки скачивания MSI на сайте и в README под текущий лаунчер.
//
////////////////////////////////////////////////////////

'use strict';

const fs = require('fs');
const path = require('path');

const client = path.resolve(__dirname, '..');
const root = path.resolve(client, '..');

/**
 * Меняет URL и подписи MSI лаунчера на новый номер.
 * @param {string} text
 * @param {string} ver
 * @returns {string}
 */
function rewriteLinks(text, ver) {
  return String(text || '')
    .replace(
      /https:\/\/github\.com\/divangames\/racing\/releases\/download\/launcher-[\d.]+\/KolesnicaVoyny-[\d.]+\.msi/g,
      'https://github.com/divangames/racing/releases/download/launcher-' + ver + '/KolesnicaVoyny-' + ver + '.msi'
    )
    .replace(/KolesnicaVoyny-[\d.]+\.msi/g, 'KolesnicaVoyny-' + ver + '.msi')
    .replace(/\[MSI [\d.]+\]/g, '[MSI ' + ver + ']')
    .replace(/Клиент Windows · MSI [\d.]+ с GitHub/g, 'Клиент Windows · MSI ' + ver + ' с GitHub')
    .replace(/Лаунчер на сайте — MSI [`']?[\d.]+[`']?/g, 'Лаунчер на сайте — MSI ' + ver)
    .replace(/Лаунчер — MSI [\d.]+/g, 'Лаунчер — MSI ' + ver)
    .replace(/MSI-лаунчер [\d.]+/g, 'MSI-лаунчер ' + ver)
    .replace(/MSI [\d.]+ и zip/g, 'MSI ' + ver + ' и zip')
    .replace(/Пейдж, MSI [\d.]+ и zip/g, 'Пейдж, MSI ' + ver + ' и zip')
    .replace(/`KolesnicaVoyny-[\d.]+\.msi`/g, '`KolesnicaVoyny-' + ver + '.msi`')
    .replace(/Лаунчер на сайте — MSI `[\d.]+`/g, 'Лаунчер на сайте — MSI `' + ver + '`');
}

/**
 * Меняет только текущие версии в статусном блоке Pages, не трогая историю.
 * @param {string} text
 * @param {string} gameVer
 * @returns {string}
 */
function rewritePageGameVersion(text, gameVer) {
  return String(text || '')
    .replace(/(<div class="plan__drop-art"[^>]*>[\s\S]*?<strong>)[\d.]+(<\/strong>)/, '$1' + gameVer + '$2')
    .replace(/(В игре )[\d.]+/, '$1' + gameVer)
    .replace(/(MSI-лаунчер [\d.]+, игра )[\d.]+/, '$1' + gameVer)
    .replace(/(Пейдж, MSI [\d.]+ и игра )[\d.]+/, '$1' + gameVer);
}

/**
 * Меняет в диздоке только карточку последнего релиза.
 * @param {string} text
 * @param {string} gameVer
 * @returns {string}
 */
function rewriteDizdocGameVersion(text, gameVer) {
  return String(text || '').replace(
    /(<article><span>ПОСЛЕДНИЙ РЕЛИЗ<\/span><strong>)[\d.]+(<\/strong>[\s\S]*?<p>[\s\S]*?Zip `game-)[\d.]+(`)/,
    '$1' + gameVer + '$2' + gameVer + '$3'
  );
}

/**
 * Обновляет пейдж, диздок и README.
 * @param {string} [explicit]
 * @param {'all'|'page'|'dizdoc'} [scope]
 * @returns {{version: string, changed: string[]}}
 */
function updateLauncherDownloadLinks(explicit, scope = 'all') {
  const launcher = JSON.parse(fs.readFileSync(path.join(client, 'config', 'launcher.json'), 'utf8'));
  const game = JSON.parse(fs.readFileSync(path.join(client, 'config', 'game.json'), 'utf8'));
  const ver = String(explicit || launcher.version || '').trim();
  const gameVer = String(game.version || '').trim();
  if (!ver) throw new Error('Нет версии лаунчера.');
  if (!gameVer) throw new Error('Нет версии игры.');
  if (!['all', 'page', 'dizdoc'].includes(scope)) {
    throw new Error('Неизвестный режим: ' + scope);
  }
  const targets = scope === 'dizdoc' ? [] : [path.join(root, 'index.html')];
  if (scope === 'all') {
    targets.push(path.join(root, 'README.md'), path.join(client, 'README.md'));
  }
  const changed = [];
  for (const file of targets) {
    if (!fs.existsSync(file)) continue;
    const before = fs.readFileSync(file, 'utf8');
    let after = rewriteLinks(before, ver);
    if (file === path.join(root, 'index.html')) after = rewritePageGameVersion(after, gameVer);
    if (after !== before) {
      fs.writeFileSync(file, after, 'utf8');
      changed.push(path.relative(root, file));
    }
  }
  const dizdoc = path.join(root, 'dizdoc', 'index.html');
  if (scope !== 'page' && fs.existsSync(dizdoc)) {
    const before = fs.readFileSync(dizdoc, 'utf8');
    let html = rewriteLinks(before, ver);
    html = rewriteDizdocGameVersion(html, gameVer);
    html = html.replace(
      /(<article><span>ПУБЛИЧНЫЙ КЛИЕНТ<\/span><strong>)[\d.]+(<\/strong><h3>Лаунчер MSI<\/h3>)/,
      '$1' + ver + '$2'
    );
    if (html !== before) {
      fs.writeFileSync(dizdoc, html, 'utf8');
      const rel = path.relative(root, dizdoc);
      if (!changed.includes(rel)) changed.push(rel);
    }
  }
  return { version: ver, changed };
}

if (require.main === module) {
  try {
    const result = updateLauncherDownloadLinks(process.argv[2], process.argv[3] || 'all');
    console.log('Версия ссылок:', result.version);
    if (result.changed.length) console.log('Обновлены:', result.changed.join(', '));
    else console.log('Ссылки уже совпадали.');
  } catch (err) {
    console.error(err.message || String(err));
    process.exit(1);
  }
}

module.exports = {
  updateLauncherDownloadLinks,
  rewriteLinks,
  rewritePageGameVersion,
  rewriteDizdocGameVersion
};
