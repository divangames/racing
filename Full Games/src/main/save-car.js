////////////////////////////////////////////////////////
//
// Запись car.json из лаборатории (тот же контракт, что POST /__save-car).
//
////////////////////////////////////////////////////////

'use strict';

const fs = require('fs');
const path = require('path');
const { contentRoot } = require('./paths');
const {writeDocument, validateCar} = require('./document-store');

/**
 * Пишет JSON машины.
 * @param {string} filePath
 * @param {object} car
 */
function writeCar(filePath, car) {
  writeDocument(filePath, car);
}

/**
 * POST /__save-car → файлы в assets/data/cars/NN.
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function handleSaveCar(request) {
  let data;
  try {
    const raw = await request.text();
    if (!raw || raw.length > 2_000_000) {
      return new Response('Bad request', { status: 400 });
    }
    data = JSON.parse(raw);
  } catch (err) {
    return new Response('Bad request', { status: 400 });
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return new Response('Bad request', {status:400});
  const slot = data.slot;
  const car = data.car;
  const kind = data.kind || 'work';
  if (!['work','base','backup'].includes(kind)) return new Response('Unknown operation', {status:400});
  const error = validateCar(car);
  if (error) return new Response(error, {status:400});
  if (!Number.isInteger(slot) || slot < 0 || slot > 98 || !car || typeof car !== 'object') {
    return new Response('Bad request', { status: 400 });
  }
  const folder = String(slot + 1).padStart(2, '0');
  const destDir = path.join(contentRoot(), 'assets', 'data', 'cars', folder);
  fs.mkdirSync(destDir, { recursive: true });
  const work = path.join(destDir, 'car.json');
  const base = path.join(destDir, 'car.base.json');
  const backup = path.join(destDir, 'car.backup.json');
  if (kind === 'base') {
    if (fs.existsSync(base)) fs.copyFileSync(base, backup);
    else if (fs.existsSync(work)) fs.copyFileSync(work, backup);
    writeCar(base, car);
    writeCar(work, car);
  } else if (kind === 'backup') {
    writeCar(backup, car);
  } else {
    writeCar(work, car);
  }
  return new Response('{"ok":true}', {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

module.exports = { handleSaveCar };
