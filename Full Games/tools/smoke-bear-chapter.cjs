// Полный маршрут главы в скрытом Electron, с отдельным профилем сохранений.
'use strict';
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const output = path.resolve(__dirname, '../build/bear-chapter-check');
fs.mkdirSync(output, { recursive: true });
app.setPath('userData', path.join(output, 'profile-' + process.pid));
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
const protocol = require('../src/main/protocol');
protocol.registerPrivilegedScheme();
const errors = [];
app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  protocol.attachProtocol();
  const win = new BrowserWindow({ show: false, width: 1440, height: 900,
    webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
  win.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
  const run = code => win.webContents.executeJavaScript(code);
  async function until(code) {
    const start = Date.now();
    while (Date.now() - start < 90000) {
      if (await run(code)) return;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    throw new Error('Timeout: ' + code);
  }
  async function shot(name) {
    await run("updateView(); g.setTransform(viewS, 0, 0, viewS, viewOX, viewOY); DiVANEngine.screens.paint(state)");
    await new Promise(resolve => setTimeout(resolve, 300));
    fs.writeFileSync(path.join(output, name + '.png'), (await win.webContents.capturePage()).toPNG());
  }
  await win.loadURL('rnr://game/rnr.html');
  await until("typeof BOOT !== 'undefined' && BOOT.ready && typeof storyBearChapterActive === 'function'");
  const intro = await run(`(() => {
    labTest = false; storyStartNewCampaign();
    return {state, mission:save.storyMission, car:save.car, stolen:save.personalCarState, scenes:WORLD_INTRO.scenes.length};
  })()`);
  assert.equal(intro.state, 'worldIntro');
  assert.equal(intro.stolen, 'owned');
  await until('WORLD_INTRO.imgs[0].naturalWidth > 0');
  await run('WORLD_INTRO.cur = 10000');
  await shot('01-intro');
  const a = await run(`(() => {
    endWorldIntro(); finishCameraSetup(); press('Enter'); press('Enter');
    save.cash = 10500; garageAction(0, 1);
    const tuning = save.tuning[save.car].eng;
    const paidEarly = storyPayBearEntry();
    enterPreRace(); confirmPreRace();
    R.place = 3; R.countsForCareer = true; careerAfterResults(save.race, []);
    save.cash = 10000; state = 'garage';
    return {mission:save.storyMission, tuning, paidEarly, div:R.div};
  })()`);
  assert.equal(a.mission, 'race_a');
  assert.equal(a.paidEarly, false);
  assert.ok(a.tuning > 0);
  assert.equal(a.div, 1);
  await shot('02-races-a');
  const b = await run(`(() => {
    storyPayBearEntry();
    const cash = save.cash;
    enterPreRace(); confirmPreRace();
    return {mission:save.storyMission, cash, div:R.div, state};
  })()`);
  assert.equal(b.mission, 'race_b');
  assert.equal(b.cash, 0);
  assert.equal(b.div, 2);
  const robbery = await run(`(() => {
    save.cash = 20000; R.place = 3; R.countsForCareer = true;
    careerAfterResults(save.race, []); state = 'results';
    careerOpenFromResults();
    const early = {state, pending:save.storyFlags.robberyPending};
    const paid = storyRequestBearEntry();
    return {early, paid, state, title:WORLD_INTRO.title, pending:save.storyFlags.robberyPending, cash:save.cash};
  })()`);
  assert.notEqual(robbery.early.state, 'worldIntro');
  assert.equal(robbery.early.pending, undefined);
  assert.equal(robbery.paid, true);
  assert.equal(robbery.state, 'worldIntro');
  assert.equal(robbery.pending, true);
  assert.equal(robbery.cash, 20000);
  await until('WORLD_INTRO.imgs[5].naturalWidth > 0');
  await run('WORLD_INTRO.frame = 1; WORLD_INTRO.cur = 10000');
  await shot('03-robbery');
  const purchase = await run(`(() => {
    endWorldIntro();
    const cash = save.cash, owned = carIsOwned(STARTER_LO), mission = save.storyMission;
    storyContinueCampaign();
    return {state, cash, owned, mission, catalog:carCatalogOrder(), flags:save.storyFlags, loadedMission:save.storyMission};
  })()`);
  assert.equal(purchase.state, 'car');
  assert.equal(purchase.owned, false);
  assert.equal(purchase.mission, 'buy_junk');
  assert.ok(purchase.catalog.every(i => i >= 11 && i <= 15));
  await shot('04-buy-body');
  const restart = await run(`(() => {
    const price = CARS[selCar].price, cash = save.cash;
    press('Enter');
    const paid = cash - save.cash;
    storyContinueCampaign();
    enterPreRace(); confirmPreRace();
    return {state, paid, price, mission:save.storyMission, car:save.car,
      owned:carIsOwned(save.car), stolen:carIsOwned(charCarIdx(0)), div:R.div,
      hunt:storyHuntActive(), race:save.race};
  })()`);
  assert.equal(restart.paid, restart.price);
  assert.equal(restart.state, 'race');
  assert.equal(restart.mission, 'restart_races');
  assert.equal(restart.owned, true);
  assert.equal(restart.stolen, false);
  assert.equal(restart.hunt, false);
  assert.equal(restart.div, 1);
  assert.equal(restart.race, 0);
  await shot('05-restart');
  const report = { intro, a, b, robbery, purchase, restart, errors };
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  assert.deepEqual(errors, []);
  console.log(JSON.stringify(report, null, 2));
  win.destroy(); app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
