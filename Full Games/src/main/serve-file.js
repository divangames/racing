////////////////////////////////////////////////////////
//
// Отдача файла в rnr:// без net.fetch(file://) —
// тот вызов в protocol.handle на Windows часто зависает.
//
////////////////////////////////////////////////////////

'use strict';

const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');

/** Клипы мотора/шин: поток в rnr:// Chromium часто не декодирует. */
const AUDIO_BUFFER_EXTS = new Set(['.wav', '.mp3', '.ogg', '.m4a']);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.labr': 'application/json; charset=utf-8',
  '.oblab': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.otf': 'font/otf',
  '.ttf': 'font/ttf',
  '.webm': 'video/webm'
};

/**
 * MIME по расширению.
 * @param {string} filePath
 * @returns {string}
 */
function mimeOf(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME[ext] || 'application/octet-stream';
}

/**
 * Заголовки для картинок и fetch в rnr://.
 * @param {string} type
 * @param {object} [extra]
 * @returns {object}
 */
function corsHeaders(type, extra) {
  return Object.assign({
    'content-type': type,
    'access-control-allow-origin': '*',
    'cross-origin-resource-policy': 'cross-origin'
  }, extra || {});
}

/**
 * Разбор Range: bytes=start-end.
 * @param {string|null} header
 * @param {number} size
 * @returns {{start: number, end: number}|null}
 */
function parseRange(header, size) {
  if (!header || size <= 0) return null;
  const m = /^bytes=(\d*)-(\d*)$/i.exec(String(header).trim());
  if (!m) return null;
  let start = m[1] === '' ? NaN : Number(m[1]);
  let end = m[2] === '' ? NaN : Number(m[2]);
  if (Number.isNaN(start) && Number.isNaN(end)) return null;
  if (Number.isNaN(start)) {
    start = Math.max(0, size - end);
    end = size - 1;
  } else if (Number.isNaN(end)) {
    end = size - 1;
  }
  start = Math.min(Math.max(0, start), size - 1);
  end = Math.min(Math.max(start, end), size - 1);
  return { start, end };
}

/**
 * Звук отдаём куском в память, картинки — потоком.
 * @param {string} filePath
 * @returns {boolean}
 */
function shouldBufferAudio(filePath) {
  return AUDIO_BUFFER_EXTS.has(path.extname(filePath).toLowerCase());
}

/**
 * Байты файла или диапазона.
 * @param {string} filePath
 * @param {number} [start]
 * @param {number} [end]
 * @returns {Buffer}
 */
function fileBytes(filePath, start, end) {
  if (start == null || end == null) return fs.readFileSync(filePath);
  const len = end - start + 1;
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, start);
    return buf;
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Тело ответа: поток с диска.
 * @param {string} filePath
 * @param {number} [start]
 * @param {number} [end]
 * @returns {ReadableStream}
 */
function fileBody(filePath, start, end) {
  const opts = {};
  if (start != null && end != null) {
    opts.start = start;
    opts.end = end;
  }
  return Readable.toWeb(fs.createReadStream(filePath, opts));
}

/**
 * Отдаёт файл: HEAD, Range, полный GET.
 * @param {string} filePath
 * @param {Request} request
 * @param {{body?: string, type?: string}} [override]
 * @returns {Response}
 */
function serveLocalFile(filePath, request, override) {
  const type = (override && override.type) || mimeOf(filePath);
  const method = String(request.method || 'GET').toUpperCase();
  if (override && override.body != null) {
    return new Response(method === 'HEAD' ? null : override.body, {
      status: 200,
      headers: corsHeaders(type, { 'cache-control': 'no-cache' })
    });
  }
  const size = fs.statSync(filePath).size;
  const range = parseRange(request.headers.get('range'), size);
  if (method === 'HEAD') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders(type, {
        'content-length': String(size),
        'accept-ranges': 'bytes'
      })
    });
  }
  if (range) {
    const len = range.end - range.start + 1;
    const body = shouldBufferAudio(filePath)
      ? fileBytes(filePath, range.start, range.end)
      : fileBody(filePath, range.start, range.end);
    return new Response(body, {
      status: 206,
      headers: corsHeaders(type, {
        'content-length': String(len),
        'content-range': `bytes ${range.start}-${range.end}/${size}`,
        'accept-ranges': 'bytes'
      })
    });
  }
  const body = shouldBufferAudio(filePath) ? fileBytes(filePath) : fileBody(filePath);
  return new Response(body, {
    status: 200,
    headers: corsHeaders(type, {
      'content-length': String(size),
      'accept-ranges': 'bytes'
    })
  });
}

module.exports = { MIME, mimeOf, serveLocalFile, shouldBufferAudio };
