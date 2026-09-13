// Проверка телеметрии в скрытом Electron с отдельным профилем и снимками реального рендера.
'use strict';
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const output = path.resolve(__dirname, '../build/engine-check/telemetry');
fs.mkdirSync(output, { recursive: true });
app.setPath('userData', path.join(output, 'profile'));
app.disableHardwareAcceleration();
const protocol = require('../src/main/protocol');
protocol.registerPrivilegedScheme();

/** Дожидается игры и рамки, проверяет состояния приборов и сохраняет кадры. */
app.whenReady().then(async () => {
  protocol.attachProtocol();
  const errors = [];
  const win = new BrowserWindow({ show: false, width: 1600, height: 900, webPreferences: { offscreen: true, backgroundThrottling: false } });
  win.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
  await win.loadURL('rnr://game/rnr.html?lab=1&car=0');
  const start = Date.now();
  while (!await win.webContents.executeJavaScript("typeof R !== 'undefined' && !!R && !!P && BOOT.ready && DiVANEngine.telemetry && DiVANEngine.telemetry.ready()")) {
    assert(Date.now() - start < 90000, 'Игра или рамка не загрузились');
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  const result = await win.webContents.executeJavaScript(`(async () => {
    paused = true; requestAnimationFrame = () => 0;
    await document.fonts.ready;
    const records = [];
    const base = { hp: P.maxhp, spd: 0, lat: 0, air: false, dead: false, nitro: 0, bolt: 0, handbrake: false, bubble: 0, shield: 0, finished: false, cdW: 0, cdN: 0, cdU: 0, wepOver: 0, wepHeat: 0, wepAmmo: wepMagMax(P) };
    const cases = [
      { name: 'ready', values: {}, width: 1280, height: 720 },
      { name: 'damage-reload', values: { hp: P.maxhp * .18, spd: 270, lat: 65, wepOver: 2, cdW: 2, cdN: 5, cdU: 12 }, width: 1280, height: 720 },
      { name: 'boost-1920', values: { spd: 400, nitro: 2, wepAmmo: 1 }, width: 1920, height: 1080 },
      { name: 'reverse-1024', values: { spd: -50 }, width: 1024, height: 768 },
      { name: 'air-640', values: { spd: 120, air: true }, width: 640, height: 360 },
      { name: 'finished', values: { finished: true }, width: 1280, height: 720 }
    ];
    for (const item of cases) {
      Object.assign(P, base, item.values);
      resetHudFx(); hudFx.hp = P.hp / P.maxhp; hudFx.spd = Math.abs(P.spd) * .45;
      const remap = item.name === 'reverse-1024';
      settings.controls.fire = [remap ? 'KeyQ' : 'KeyZ']; settings.controls.nitro = [remap ? 'ShiftLeft' : 'KeyX']; settings.controls.ult = [remap ? 'Space' : 'KeyC'];
      const canvas = document.createElement('canvas'); canvas.width = item.width; canvas.height = item.height;
      const c = canvas.getContext('2d'), texts = [];
      const fill = c.fillText.bind(c);
      c.fillText = (...args) => { texts.push(String(args[0])); fill(...args); };
      c.fillStyle = '#292b29'; c.fillRect(0, 0, item.width, item.height);
      drawHudCockpit(c, item.width, item.height);
      const box = DiVANEngine.telemetry.layout(item.width, item.height);
      // Компактный снимок сохраняет исходные пиксели нижней части игрового холста.
      const cropped = document.createElement('canvas'); cropped.width = item.width; cropped.height = Math.ceil(box.h + 30);
      cropped.getContext('2d').drawImage(canvas, 0, item.height - cropped.height, item.width, cropped.height, 0, 0, item.width, cropped.height);
      records.push({ name: item.name, width: item.width, height: item.height, box, texts, png: cropped.toDataURL().split(',')[1] });
    }
    Object.assign(P, base); resetHudFx();
    settings.controls.fire = ['KeyZ']; settings.controls.nitro = ['KeyX']; settings.controls.ult = ['KeyC'];
    R.phase = 'go'; R.time = 4; R.countT = 0; R.hintT = 1; R.msg = null;
    paused = false; g.setTransform(1,0,0,1,0,0); drawRaceWorld(); drawHUD(); paused = true;
    return { records, race: cv.toDataURL().split(',')[1] };
  })()`);
  for (const item of result.records) {
    assert(item.box.x >= 0 && item.box.y >= 0 && item.box.x + item.box.w <= item.width && item.box.y + item.box.h <= item.height);
    assert(item.texts.includes('ЦЕЛОСТНОСТЬ КОРПУСА') && item.texts.includes('ОРУЖИЕ'));
    fs.writeFileSync(path.join(output, item.name + '.png'), Buffer.from(item.png, 'base64'));
    delete item.png;
  }
  assert(result.records[0].texts.includes('Z'));
  assert(result.records[3].texts.includes('Q'));
  assert(result.records[1].texts.includes('18%') && result.records[1].texts.includes('12'));
  assert(result.records[2].texts.includes('НИТРО АКТИВНО'));
  assert(result.records[3].texts.includes('R'));
  assert(result.records[4].texts.includes('В ПОЛЁТЕ'));
  assert(result.records[5].texts.includes('БОЕВОЙ КОНТУР  /  ФИНИШ'));
  fs.writeFileSync(path.join(output, 'race.png'), Buffer.from(result.race, 'base64'));
  delete result.race;
  result.errors = errors;
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2));
  assert.deepEqual(errors, [], 'Ошибки консоли игрового окна');
  console.log('Проверены шесть состояний HUD, четыре разрешения, переназначение клавиш и отсутствие ошибок.');
  win.destroy(); app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
