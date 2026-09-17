////////////////////////////////////////////////////////
//
// Живая проверка HTML Audio через протокол rnr://.
//
////////////////////////////////////////////////////////

'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');

const output = path.resolve(__dirname, '../build/audio-check-profile');
app.setPath('userData', output);
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const protocol = require('../src/main/protocol');
protocol.registerPrivilegedScheme();

/** Ждёт истинного выражения в окне. */
async function until(window, expression, timeout = 90000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await window.webContents.executeJavaScript(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Истекло ожидание: ' + expression);
}

/** Проверяет сетевой ответ и настоящее состояние Audio. */
async function check(window) {
  return window.webContents.executeJavaScript(`(async () => {
    audioInit();
    settings.sound.biome = 80;
    settings.sound.crowd = 80;
    settings.graphics.weather = true;

    const probe = async (src) => {
      const response = await fetch(src);
      const bytes = await response.arrayBuffer();
      const audio = new Audio();
      audio.preload = 'auto';
      audio.src = new URL(src, location.href).href;
      document.body.appendChild(audio);
      let playError = '';
      try { await audio.play(); } catch (error) { playError = error.name + ': ' + error.message; }
      await new Promise((resolve) => setTimeout(resolve, 700));
      const result = {
        src: audio.currentSrc,
        status: response.status,
        bytes: bytes.byteLength,
        paused: audio.paused,
        readyState: audio.readyState,
        networkState: audio.networkState,
        error: audio.error ? audio.error.code : 0,
        playError
      };
      audio.pause();
      audio.remove();
      return result;
    };

    const probeResults = {
      rain: await probe('assets/sounds/embirnt/rain.mp3'),
      arena: await probe('assets/sounds/embirnt/arena/atmos_00.mp3')
    };

    state = 'title';
    RnRWeatherAudio.sync(null, settings);
    await new Promise((resolve) => setTimeout(resolve, 900));
    const menu = Array.from(document.querySelectorAll('audio'))
      .filter((audio) => /embirnt/i.test(audio.currentSrc || audio.src))
      .map((audio) => ({
        src: audio.currentSrc || audio.src,
        paused: audio.paused,
        volume: audio.volume,
        readyState: audio.readyState,
        error: audio.error ? audio.error.code : 0
      }));

    state = 'garage';
    RnRWeatherAudio.sync(null, settings);
    await new Promise((resolve) => setTimeout(resolve, 200));
    const garage = Array.from(document.querySelectorAll('audio'))
      .filter((audio) => /rain\.mp3/i.test(audio.currentSrc || audio.src))
      .map((audio) => ({ paused: audio.paused, volume: audio.volume }));

    state = 'race';
    paused = false;
    R.demo = false;
    R.T.theme.crowdSound = true;
    R.weather = Object.assign({}, RnRWeather.catalog.rain);
    RnRWeatherAudio.sync(R, settings);
    RnRArenaCrowd.tickBed(0.05);
    await new Promise((resolve) => setTimeout(resolve, 900));
    const race = Array.from(document.querySelectorAll('audio'))
      .filter((audio) => /embirnt/i.test(audio.currentSrc || audio.src))
      .map((audio) => ({
        src: audio.currentSrc || audio.src,
        paused: audio.paused,
        volume: audio.volume,
        readyState: audio.readyState,
        error: audio.error ? audio.error.code : 0
      }));

    return {
      probeResults,
      menu,
      garage,
      race,
      levels: {
        engine: carEngineVol(),
        biome: settings.sound.biome / 100 * 0.52,
        arena: settings.sound.crowd / 100 * 0.52
      },
      hidden: document.hidden,
      state,
      sound: settings.sound
    };
  })()`);
}

app.whenReady().then(async () => {
  protocol.attachProtocol();
  const window = new BrowserWindow({
    show: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });
  await window.loadURL('rnr://game/rnr.html?lab=1&car=0');
  await until(window, "typeof audioInit === 'function' && window.DiVANEngine && BOOT.ready && !!R && !!P");
  const result = await check(window);
  console.log(JSON.stringify(result, null, 2));
  const failed = Object.values(result.probeResults).some((item) =>
    item.status !== 200 || item.bytes < 1024 || item.paused || item.readyState < 2 || item.error || item.playError
  ) ||
    !result.menu.some((item) => /rain\.mp3/i.test(item.src) && !item.paused && item.volume > 0) ||
    !result.garage.some((item) => item.paused) ||
    !result.race.some((item) => /rain\.mp3/i.test(item.src) && !item.paused && item.volume > 0) ||
    !result.race.some((item) => /arena\/atmos_/i.test(item.src) && !item.paused && item.volume > 0) ||
    result.levels.engine <= result.levels.biome ||
    result.levels.engine <= result.levels.arena;
  window.destroy();
  app.exit(failed ? 1 : 0);
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
