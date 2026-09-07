'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const carsRoot = path.join(root, 'assets', 'data', 'cars');
const soundsRoot = path.join(root, 'assets', 'sounds');

if (!fs.existsSync(carsRoot) || !fs.existsSync(soundsRoot)) {
  throw new Error('Нет папок настроек машин или звуков: ' + root);
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
