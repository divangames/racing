////////////////////////////////////////////////////////
//
// Логика лаунчера в окне: статус, проверка, старт.
//
////////////////////////////////////////////////////////

'use strict';

const el = {
  lead: document.getElementById('lead'),
  fill: document.getElementById('fill'),
  track: document.getElementById('track'),
  status: document.getElementById('status'),
  meta: document.getElementById('meta'),
  play: document.getElementById('btn-play'),
  verify: document.getElementById('btn-verify'),
  screen: document.getElementById('btn-screen'),
  quit: document.getElementById('btn-quit'),
  close: document.getElementById('btn-close'),
  sync: document.getElementById('btn-sync'),
  self: document.getElementById('btn-self')
};

let fullscreen = true;

/**
 * Полоска прогресса 0–100.
 * @param {number} pct
 */
function setBar(pct) {
  const n = Math.max(0, Math.min(100, pct));
  el.fill.style.width = n + '%';
  el.track.setAttribute('aria-valuenow', String(Math.round(n)));
}

/**
 * Текст проверки.
 * @param {string} text
 */
function setStatus(text) {
  el.status.textContent = text;
}

/**
 * Рисует итог проверки.
 * @param {object} check
 */
function applyCheck(check) {
  const issues = (check && check.issues) || [];
  if (el.lead) el.lead.hidden = true;
  if (check && check.ok) {
    setBar(100);
    setStatus('Файлы на месте. Можно в заезд.');
    el.play.disabled = false;
    return;
  }
  setBar(35);
  setStatus(issues[0] || 'Не удалось прочитать состав.');
  el.play.disabled = true;
}

/**
 * Кнопки установки и «Играть» по состоянию клиента.
 * @param {object} install
 */
function paintInstall(install) {
  if (!el.sync) return;
  if (!install || !install.packaged) {
    el.sync.hidden = true;
    return;
  }
  el.sync.hidden = false;
  if (install.needInstall) el.sync.textContent = 'Установить игру';
  else if (install.needUpdate) el.sync.textContent = 'Обновить игру';
  else el.sync.textContent = 'Повторить загрузку';
  el.sync.disabled = Boolean(install.busy);
  if (!install.playable) {
    el.play.disabled = true;
  }
  if (install.remoteError) setStatus(install.remoteError);
}

/**
 * Кнопка самообновления оболочки.
 * @param {object} self
 */
function paintSelf(self) {
  if (!el.self) return;
  if (!self || !self.packaged) {
    el.self.hidden = true;
    return;
  }
  const show = Boolean(self.needUpdate || self.busy || self.remoteError);
  el.self.hidden = !show;
  el.self.textContent = self.needUpdate ? 'Обновить лаунчер' : 'Повторить лаунчер';
  el.self.disabled = Boolean(self.busy);
}

/**
 * Подпись версий оболочки и zip.
 * @param {object} data
 */
function paintMeta(data) {
  const inst = (data && data.install) || {};
  const self = (data && data.selfUpdate) || {};
  const launcherVer = self.localVersion || data.launcherVersion || data.version || '';
  const gameVer = inst.localVersion || '';
  el.meta.textContent = gameVer
    ? 'Лаунчер v' + launcherVer + ' · игра ' + gameVer
    : 'Лаунчер v' + launcherVer;
}

/**
 * Качает и ставит игру с GitHub.
 */
async function runSync() {
  if (!window.rnrLauncher || !el.sync) return;
  el.play.disabled = true;
  el.sync.disabled = true;
  setStatus('Связываюсь с GitHub…');
  setBar(2);
  const result = await window.rnrLauncher.sync();
  if (result && result.ok) {
    paintInstall(result.install);
    if (result.check && result.check.ok) applyCheck(result.check);
    else {
      setBar(100);
      setStatus('Игра установлена. Можно в заезд.');
      el.play.disabled = false;
    }
    el.sync.disabled = false;
    if (!el.play.disabled && window.rnrLauncherAudio) window.rnrLauncherAudio.playReady();
    return;
  }
  const issues = (result && result.issues) || ['Не удалось скачать игру.'];
  setStatus(issues[0]);
  paintInstall(result && result.install);
  el.sync.disabled = false;
}

/**
 * Качает MSI лаунчера и отдаёт его установщику.
 */
async function runSelfUpdate() {
  if (!window.rnrLauncher || !el.self) return;
  el.self.disabled = true;
  if (el.sync) el.sync.disabled = true;
  setStatus('Спрашиваю GitHub про лаунчер…');
  setBar(2);
  const result = await window.rnrLauncher.selfUpdate();
  if (result && result.applying) {
    setBar(100);
    setStatus('Ставлю новый лаунчер. Окно закроется.');
    return;
  }
  if (result && result.ok) {
    paintSelf(result.selfUpdate);
    setStatus('Лаунчер уже свежий.');
    if (el.sync) el.sync.disabled = false;
    return;
  }
  const issues = (result && result.issues) || ['Не удалось обновить лаунчер.'];
  setStatus(issues[0]);
  paintSelf(result && result.selfUpdate);
  if (el.sync) el.sync.disabled = false;
}
/**
 * Подпись режима экрана.
 */
function paintScreen() {
  el.screen.textContent = fullscreen ? 'Полный экран' : 'В окне';
}

/**
 * Картинки нельзя утащить на рабочий стол и сохранить из меню.
 */
function lockMedia() {
  document.addEventListener('dragstart', (event) => {
    event.preventDefault();
  });
  document.addEventListener('contextmenu', (event) => {
    event.preventDefault();
  });
}

async function boot() {
  lockMedia();
  if (!window.rnrLauncher) {
    setStatus('Нет моста клиента.');
    return;
  }
  window.rnrLauncher.onVerifyProgress((info) => {
    if (!info || !info.total) return;
    setBar((info.done / info.total) * 100);
    setStatus('Проверка: ' + info.path);
  });
  window.rnrLauncher.onSyncProgress((info) => {
    if (!info) return;
    if (typeof info.pct === 'number') setBar(info.pct);
    if (info.label) setStatus(info.label);
  });
  window.rnrLauncher.onSelfProgress((info) => {
    if (!info) return;
    if (typeof info.pct === 'number') setBar(info.pct);
    if (info.label) setStatus(info.label);
  });
  const data = await window.rnrLauncher.status();
  fullscreen = data.fullscreen !== false;
  paintScreen();
  const inst = data.install || {};
  const self = data.selfUpdate || {};
  paintMeta(data);
  applyCheck(data.check);
  paintInstall(inst);
  paintSelf(self);
  if (self.packaged && self.needUpdate && !self.remoteError) {
    runSelfUpdate();
    return;
  }
  if (inst.packaged && (inst.needInstall || inst.needUpdate) && !inst.remoteError) {
    runSync();
  }
}

el.play.addEventListener('click', async () => {
  el.play.disabled = true;
  if (window.rnrLauncherAudio) window.rnrLauncherAudio.hush();
  const result = await window.rnrLauncher.play();
  if (!result.ok) {
    applyCheck(result);
    if (window.rnrLauncherAudio) window.rnrLauncherAudio.wake();
  } else el.play.disabled = false;
});

el.verify.addEventListener('click', async () => {
  el.verify.disabled = true;
  setStatus('Полная проверка...');
  setBar(4);
  const result = await window.rnrLauncher.verify(true);
  applyCheck(result);
  el.verify.disabled = false;
});

el.screen.addEventListener('click', async () => {
  fullscreen = !fullscreen;
  await window.rnrLauncher.setFullscreen(fullscreen);
  paintScreen();
});

/**
 * Закрывает клиент.
 */
function quitLauncher() {
  if (window.rnrLauncher) window.rnrLauncher.quit();
}

el.quit.addEventListener('click', quitLauncher);
el.close.addEventListener('click', quitLauncher);

if (el.sync) {
  el.sync.addEventListener('click', () => {
    runSync();
  });
}

if (el.self) {
  el.self.addEventListener('click', () => {
    runSelfUpdate();
  });
}

boot();
