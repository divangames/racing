// Проверка и атомарная запись документов с предыдущей версией для восстановления.
'use strict';
const fs = require('fs');
const path = require('path');
const {randomUUID} = require('crypto');

/** Записывает готовый JSON заменой файла; предыдущая версия остаётся рядом. */
function writeDocument(file, value, backup = true) {
  fs.mkdirSync(path.dirname(file), {recursive:true});
  const temp = file + '.' + randomUUID() + '.tmp';
  try {
    fs.writeFileSync(temp, JSON.stringify(value, null, 2) + '\n', {encoding:'utf8', flag:'wx'});
    if (backup && fs.existsSync(file)) fs.copyFileSync(file, file + '.previous');
    fs.renameSync(temp, file);
  } finally {
    if(fs.existsSync(temp))fs.unlinkSync(temp);
  }
}
/** Проверяет координаты без приведения null и строк к числам. */
function validPoint(p) {
  return Array.isArray(p) && p.length >= 2 && p.slice(0,2).every(n => Number.isFinite(n) && Math.abs(n) <= 100000);
}
/** Проверяет минимальный контракт трассы до записи и нормализации. */
function validateTrack(track) {
  if (!track || typeof track !== 'object' || Array.isArray(track)) return 'Нужен объект трассы';
  if (!Array.isArray(track.cps) || track.cps.length < 4 || track.cps.length > 2048) return 'Трасса должна содержать от 4 до 2048 точек';
  if (!track.cps.every(validPoint)) return 'Некорректные координаты трассы';
  if (new Set(track.cps.map(p => p[0]+','+p[1])).size < 4) return 'Нужны хотя бы четыре различные точки';
  if (typeof track.name !== 'string' || !track.name.trim() || track.name.length > 120) return 'Имя трассы: от 1 до 120 символов';
  for (const key of ['decals','items','zones','shortcuts']) {
    if (track[key] != null && (!Array.isArray(track[key]) || track[key].length > 10000 || track[key].some(p=>!p || typeof p!=='object' || Array.isArray(p)))) return 'Некорректный список: '+key;
  }
  if (track.hazards != null) {
    if(typeof track.hazards!=='object'||Array.isArray(track.hazards))return 'Некорректные опасности';
    for(const list of Object.values(track.hazards))if(!Array.isArray(list)||list.length>10000||list.some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)))return 'Некорректные координаты опасности';
  }
  for(const key of ['decals','items'])if((track[key]||[]).some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return 'Некорректные координаты: '+key;
  if((track.shortcuts||[]).some(p=>!validPoint(p.entry)||!validPoint(p.exit)))return 'Некорректные координаты среза';
  return null;
}
/** Проверяет структуру машины, сохраняя дополнительные поля редактора. */
function validateCar(car) {
  if (!car || typeof car !== 'object' || Array.isArray(car) || !car.body || typeof car.body !== 'object') return 'Нет кузова машины';
  if (!Array.isArray(car.w) || car.w.length > 64 || !car.w.every(validPoint)) return 'Некорректные колёса';
  for (const key of ['x','y','sx','sy','scale']) {
    if (car.body[key] != null && !Number.isFinite(car.body[key])) return 'Некорректный параметр кузова: '+key;
  }
  return null;
}
module.exports={writeDocument, validateTrack, validateCar};
