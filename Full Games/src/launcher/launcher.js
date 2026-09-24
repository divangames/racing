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
  quit: document.getElementById('btn-quit'),
  close: document.getElementById('btn-close'),
  sync: document.getElementById('btn-sync'),
  self: document.getElementById('btn-self'),
  changes: document.getElementById('btn-changes'),
  changesDialog: document.getElementById('changes-dialog'),
  changesContent: document.getElementById('changes-content'),
  changesClose: document.getElementById('changes-close'),
  stage: document.querySelector('.stage')
};


function changelogText(line) {
  return line.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*|`/g, '').trim();
}

function renderChangelog(markdown) {
  const content = el.changesContent;
  content.replaceChildren();
  let section = null;
  let list = null;
  for (const raw of String(markdown || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || /^#\s/.test(line)) continue;
    if (/^##\s+/.test(line)) {
      section = document.createElement('section');
      section.className = 'changes-entry';
      const heading = document.createElement('h3');
      heading.textContent = changelogText(line.replace(/^##\s+/, ''));
      section.append(heading);
      content.append(section);
      list = null;
      continue;
    }
    if (!section) continue;
    if (/^-\s+/.test(line)) {
      if (!list) {
        list = document.createElement('ul');
        section.append(list);
      }
      const item = document.createElement('li');
      item.textContent = changelogText(line.replace(/^-\s+/, ''));
      list.append(item);
    } else {
      list = null;
      const paragraph = document.createElement('p');
      paragraph.textContent = changelogText(line);
      section.append(paragraph);
    }
  }
  if (!content.childElementCount) content.textContent = 'Записей пока нет.';
  content.scrollTop = 0;
}

async function openChangelog() {
  if (!el.changesDialog || !window.rnrLauncher) return;
  el.changesDialog.showModal();
  el.changesContent.textContent = 'Загружаю изменения…';
  try {
    renderChangelog(await window.rnrLauncher.changelog());
  } catch (err) {
    el.changesContent.textContent = 'Не удалось открыть журнал изменений: ' + (err.message || String(err));
  }
  el.changesContent.focus();
}

/**
 * Во время интро dock виден только при установке/обновлении.
 * @param {object} [install]
 * @param {object} [self]
 */
function paintBusy(install, self) {
  if (!el.stage) return;
  const gameBusy = Boolean(
    install && (install.busy || install.needInstall || install.needUpdate)
  );
  const launcherBusy = Boolean(self && (self.busy || self.needUpdate));
  el.stage.classList.toggle('is-busy', gameBusy || launcherBusy);
}

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
    paintBusy(result.install, null);
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
  paintBusy(result && result.install, null);
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
    setStatus('Установщик запущен. Лаунчер закроется и откроется снова.');
    paintBusy(null, { busy: true, needUpdate: true });
    return;
  }
  if (result && result.ok) {
    paintSelf(result.selfUpdate);
    paintBusy(null, result.selfUpdate);
    setStatus('Лаунчер уже свежий.');
    if (el.sync) el.sync.disabled = false;
    return;
  }
  const issues = (result && result.issues) || ['Не удалось обновить лаунчер.'];
  setStatus(issues[0]);
  paintSelf(result && result.selfUpdate);
  paintBusy(null, result && result.selfUpdate);
  el.self.disabled = false;
  if (el.sync) el.sync.disabled = false;
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
  const inst = data.install || {};
  const self = data.selfUpdate || {};
  paintMeta(data);
  applyCheck(data.check);
  paintInstall(inst);
  paintSelf(self);
  paintBusy(inst, self);
  if (self.packaged && self.needUpdate && !self.remoteError) {
    setStatus('Нашёл новый лаунчер. Качаю и ставлю сам.');
    paintBusy(inst, Object.assign({}, self, { busy: true }));
    runSelfUpdate();
    return;
  }
  if (inst.packaged && (inst.needInstall || inst.needUpdate) && !inst.remoteError) {
    paintBusy(Object.assign({}, inst, { busy: true }), self);
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

/**
 * Закрывает клиент.
 */
function quitLauncher() {
  if (window.rnrLauncher) window.rnrLauncher.quit();
}

el.quit.addEventListener('click', quitLauncher);
el.close.addEventListener('click', quitLauncher);
el.changes.addEventListener('click', openChangelog);
el.changesClose.addEventListener('click', () => el.changesDialog.close());

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
