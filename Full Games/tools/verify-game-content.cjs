'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', require('../config/game.json').contentDevRelative);
const carsRoot = path.join(root, 'assets', 'data', 'cars');
const soundsRoot = path.join(root, 'assets', 'sounds');
const disclaimer = path.join(root, 'assets', 'ui', 'disclaimer', 'disclaimer-21plus.svg');
const titleJson = path.join(root, 'assets', 'data', 'cats', 'Titles', 'titles.json');
const titleHd = path.join(root, 'assets', 'data', 'cats', 'Titles', 'title-medved_1920x1080.webp');
const titleUw = path.join(root, 'assets', 'data', 'cats', 'Titles', 'title-medved_3440x1440.webp');
const freeTitleHd = path.join(root, 'assets', 'data', 'cats', 'Titles', 'title-bestya_1920x1080.png');
const freeTitleUw = path.join(root, 'assets', 'data', 'cats', 'Titles', 'title-bestya_3440x1440.png');

if (!fs.existsSync(carsRoot) || !fs.existsSync(soundsRoot)) {
  throw new Error('Нет папок настроек машин или звуков: ' + root);
}
if (!fs.existsSync(disclaimer)) {
  throw new Error('Нет дисклеймера 21+: ' + disclaimer);
}
if (!fs.existsSync(titleJson) || !fs.existsSync(titleHd) || !fs.existsSync(titleUw)
    || !fs.existsSync(freeTitleHd) || !fs.existsSync(freeTitleUw)) {
  throw new Error('Нет фонов титула: ' + path.join(root, 'assets', 'data', 'cats', 'Titles'));
}

const cars = fs.readdirSync(carsRoot)
  .filter((name) => /^\d+$/.test(name))
  .filter((name) => fs.existsSync(path.join(carsRoot, name, 'car.json')));

let wav = 0;
function countWav(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) countWav(file);
    else if (entry.name.toLowerCase().endsWith('.wav')) wav += 1;
  }
}
countWav(soundsRoot);

if (!cars.length || !wav) {
  throw new Error('Не найдены car.json или WAV в актуальном дереве игры.');
}
console.log('Проверено: машин ' + cars.length + ', WAV ' + wav);
