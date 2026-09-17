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
 * Пишет файл, если текст изменился.
 * @param {string} filePath
 * @param {string} ver
 * @returns {boolean}
 */
function patchFile(filePath, ver) {
  if (!fs.existsSync(filePath)) return false;
  const before = fs.readFileSync(filePath, 'utf8');
  const after = rewriteLinks(before, ver);
  if (after === before) return false;
  fs.writeFileSync(filePath, after, 'utf8');
  return true;
}

/**
 * Обновляет пейдж, диздок и README.
 * @param {string} [explicit]
 * @returns {{version: string, changed: string[]}}
 */
function updateLauncherDownloadLinks(explicit) {
  const launcher = JSON.parse(fs.readFileSync(path.join(client, 'config', 'launcher.json'), 'utf8'));
  const ver = String(explicit || launcher.version || '').trim();
  if (!ver) throw new Error('Нет версии лаунчера.');
  const targets = [
    path.join(root, 'index.html'),
    path.join(root, 'README.md'),
    path.join(client, 'README.md')
  ];
  const changed = [];
  for (const file of targets) {
    if (patchFile(file, ver)) changed.push(path.relative(root, file));
  }
  const dizdoc = path.join(root, 'dizdoc', 'index.html');
  if (fs.existsSync(dizdoc)) {
    const before = fs.readFileSync(dizdoc, 'utf8');
    let html = rewriteLinks(before, ver);
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
    const result = updateLauncherDownloadLinks(process.argv[2]);
    console.log('Версия ссылок:', result.version);
    if (result.changed.length) console.log('Обновлены:', result.changed.join(', '));
    else console.log('Ссылки уже совпадали.');
  } catch (err) {
    console.error(err.message || String(err));
    process.exit(1);
  }
}

module.exports = { updateLauncherDownloadLinks, rewriteLinks };
