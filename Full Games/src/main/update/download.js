////////////////////////////////////////////////////////
//
// Потоковая закачка zip с прогрессом и скоростью.
//
////////////////////////////////////////////////////////

'use strict';

const fs = require('fs');
const path = require('path');
const { headers } = require('./github');
const { formatBytes, formatSpeed } = require('./format');

/**
 * Качает url в файл.
 * @param {string} url
 * @param {string} dest
 * @param {(info: object) => void} onProgress
 * @returns {Promise<{bytes: number}>}
 */
async function downloadFile(url, dest, onProgress) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const res = await fetch(url, {
    headers: Object.assign({ Accept: 'application/octet-stream' }, headers()),
    redirect: 'follow'
  });
  if (!res.ok || !res.body) {
    throw new Error('Не удалось скачать игру (HTTP ' + (res && res.status) + ').');
  }
  const total = Number(res.headers.get('content-length')) || 0;
  const stream = fs.createWriteStream(dest);
  const reader = res.body.getReader();
  let received = 0;
  let lastT = Date.now();
  let lastB = 0;
  let speed = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    const buf = Buffer.from(chunk.value);
    received += buf.length;
    if (!stream.write(buf)) {
      await new Promise((resolve) => stream.once('drain', resolve));
    }
    const now = Date.now();
    if (now - lastT >= 400) {
      speed = (received - lastB) / ((now - lastT) / 1000);
      lastT = now;
      lastB = received;
    }
    if (onProgress) {
      const pct = total ? (received / total) * 100 : 0;
      onProgress({
        phase: 'download',
        pct,
        received,
        total,
        speed,
        label: 'Качаю ' + formatBytes(received) + (total ? ' из ' + formatBytes(total) : '') +
          ' · ' + formatSpeed(speed)
      });
    }
  }
  await new Promise((resolve, reject) => {
    stream.end((err) => (err ? reject(err) : resolve()));
  });
  return { bytes: received };
}

module.exports = { downloadFile };
