// Чтение и безопасная запись данных и кадров редактора глав.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { contentRoot } = require('./paths');
const { writeDocument } = require('./document-store');

const ID_RE = /^mission-\d{2}$/;
const SLOT_RE = /^[a-z0-9][a-z0-9_-]{1,63}$/;
const IMAGE_EXTENSIONS = new Set(['png', 'webp', 'jpg', 'jpeg']);
const MAX_JSON_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 24 * 1024 * 1024;

/** Корень документов глав в игровом контенте. */
function chaptersRoot() {
  return path.join(contentRoot(), 'chapters');
}

/** Проверяет минимальную схему главы перед записью. */
function validateChapter(document) {
  if (!document || typeof document !== 'object' || Array.isArray(document)) throw new Error('Глава должна быть объектом');
  if (!ID_RE.test(String(document.id || ''))) throw new Error('ID главы: mission-NN');
  if (!Array.isArray(document.points) || !document.points.length) throw new Error('Нет точек запуска');
  if (!Array.isArray(document.comicSections) || !document.comicSections.length) throw new Error('Нет разделов комиксов');
  if (document.comicSections.length > 32) throw new Error('Слишком много разделов комиксов');
  for (const section of document.comicSections) {
    if (!section || !Array.isArray(section.scenes)) throw new Error('Повреждён раздел комикса');
    if (section.scenes.length > 64) throw new Error('В комиксе не больше 64 кадров');
  }
  return document;
}

/** Отдаёт каталог глав с полными документами. */
function handleListChapters() {
  const root = chaptersRoot();
  const chapters = [];
  if (fs.existsSync(root)) {
    for (const name of fs.readdirSync(root)) {
      if (!/^mission-\d{2}\.json$/.test(name)) continue;
      try {
        const document = validateChapter(JSON.parse(fs.readFileSync(path.join(root, name), 'utf8')));
        chapters.push(document);
      } catch (error) {
        chapters.push({ id: name.replace(/\.json$/, ''), error: error.message });
      }
    }
  }
  chapters.sort((a, b) => String(a.id).localeCompare(String(b.id), 'ru', { numeric: true }));
  return new Response(JSON.stringify({ ok: true, chapters }), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

/** Атомарно пишет JSON главы и оставляет бэкап. */
async function handleSaveChapter(request) {
  const raw = Buffer.from(await request.arrayBuffer());
  if (raw.length > MAX_JSON_BYTES) return new Response('Слишком большой JSON', { status: 413 });
  try {
    const document = validateChapter(JSON.parse(raw.toString('utf8')));
    const root = chaptersRoot();
    fs.mkdirSync(root, { recursive: true });
    const target = path.join(root, document.id + '.json');
    writeDocument(target, document);
    return Response.json({ ok: true, id: document.id, file: 'chapters/' + document.id + '.json' });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 400 });
  }
}

/** Пишет исходные байты кадра в папку выбранной миссии. */
async function handleSaveChapterFrame(request, url) {
  const id = String(url.searchParams.get('chapter') || '');
  const slot = String(url.searchParams.get('slot') || '');
  const ext = String(url.searchParams.get('ext') || '').toLowerCase().replace('jpeg', 'jpg');
  if (!ID_RE.test(id) || !SLOT_RE.test(slot) || !IMAGE_EXTENSIONS.has(ext)) return new Response('Неверное имя кадра', { status: 400 });
  const bytes = Buffer.from(await request.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) return new Response('Кадр пуст или больше 24 МБ', { status: 413 });
  const dir = path.join(chaptersRoot(), 'assets', id);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, slot + '.' + ext);
  fs.writeFileSync(file, bytes);
  return Response.json({ ok: true, src: 'chapters/assets/' + id + '/' + slot + '.' + ext });
}

module.exports = { chaptersRoot, validateChapter, handleListChapters, handleSaveChapter, handleSaveChapterFrame };
