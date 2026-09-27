// Быстрая визуальная проверка миссии 01 в скрытом Electron.
'use strict';
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const output = path.resolve(__dirname, '../build/story-chase-check');
fs.mkdirSync(output, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'rnr-story-chase-'));
app.setPath('userData', profile);
app.on('quit', () => { try { fs.rmSync(profile, {recursive: true, force: true}); } catch (error) {} });
app.disableHardwareAcceleration();
const protocol = require('../src/main/protocol');
protocol.registerPrivilegedScheme();
const errors = [];
app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  protocol.attachProtocol();
  const win = new BrowserWindow({
    show: false,
    width: 1440,
    height: 900,
    webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false }
  });
  win.webContents.on('console-message', event => {
    if (event.level === 'error') {
      errors.push(event.message);
      console.error('renderer:', event.message, event.source || '');
    }
  });
  const run = async code => {
    try { return await win.webContents.executeJavaScript(code); }
    catch (error) { console.error('executeJavaScript:', code.slice(0, 140)); throw error; }
  };
  async function until(code) {
    const started = Date.now();
    while (Date.now() - started < 60000) {
      if (await run(code)) return;
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    throw new Error('Timeout: ' + code);
  }
  async function shot(name, settleMs = 250) {
    await run('updateView(); g.setTransform(viewS,0,0,viewS,viewOX,viewOY); DiVANEngine.screens.paint(state)');
    if (settleMs) await new Promise(resolve => setTimeout(resolve, settleMs));
    fs.writeFileSync(path.join(output, name + '.png'), (await win.webContents.capturePage()).toPNG());
  }
  async function naturalBridgeShot(name, elapsed) {
    await run(`(() => {
      storyBearChaseApplyPoint('BRIDGE_APPROACH');
      storyBearChase.pause=false;
      let remaining=${Number(elapsed)};
      while(remaining>0){const dt=Math.min(.01,remaining);storyBearChaseStep(storyBearChase,{},dt,()=>.5);remaining-=dt;}
      storyBearChase.pause=false;
      storyBearChase.lastGt=typeof gt==='number'?gt:storyBearChase.lastGt;
    })()`);
    await shot(name, 0);
  }
  const bootStartedAt = Date.now();
  await win.loadURL('rnr://game/rnr.html?chapterTest=1&chapter=mission-01&point=TRUCK_INTRO');
  await until("!!(typeof BOOT !== 'undefined' && BOOT.ready && typeof startStoryBearChase === 'function' && window.RnRStoryChaseHud)");
  await until("!document.getElementById('boot-screen')");
  const editorBoot = await run(`({testMode:storyChapterTestMode,
    creatorVideo:!!document.querySelector('.boot-creator-video')})`);
  editorBoot.elapsedMs = Date.now() - bootStartedAt;
  assert.equal(editorBoot.testMode, true);
  assert.equal(editorBoot.creatorVideo, false);
  assert.ok(editorBoot.elapsedMs < 10000);
  const started = await run(`(() => {
    save=newSave(); storyPatchSave(save);
    save.playMode='campaign'; save.char=0; save.car=0; save.storySlice='bear_chapter_1';
    save.storyMission='race_b'; save.storyFlags=save.storyFlags||{}; save.storyFlags.robberyPending=true;
    startStoryBearChase(); storyBearChase.phase='TRUCK_INTRO'; storyBearChase.phaseTime=.9;
    storyBearChase.distance=72; storyBearChase.playerSpeed=.86; storyBearChase.truckSpeed=.78;
    return {state, category:PITTER_MAX.category, cargo:PITTER_MAX.sprites.cargo,
      zone:storyBearChaseZone(72), musicCategory:musicCat(), missionTracks:MUSIC.list('missions/01').length};
  })()`);
  assert.equal(started.state, 'bearChase');
  assert.equal(started.category, 'UNIQUE');
  assert.equal(started.musicCategory, 'missions/01');
  assert.ok(started.missionTracks > 0);
  await shot('00-truck-intro');
  await run("storyBearChase.phase='TRUCK_INTRO'; storyBearChase.phaseTime=MISSION_01.introTruckHoldTime+MISSION_01.introCameraPanTime*.7");
  await shot('00-player-entry');
  const skippedIntro = await run("press('Enter'); ({phase:storyBearChase.phase})");
  assert.equal(skippedIntro.phase,'CHASE_START');
  await run(`(() => {
    storyBearChaseApplyPoint('CHASE'); storyBearChase.spawnTimer=0;
    storyBearChaseStep(storyBearChase,{throttle:1},.01,()=>.5);
    storyBearChase.spawnTimer=999;
  })()`);
  await shot('01-attack-warning');
  const barrelDrop = await run(`(() => {
    storyBearChase.phase='CHASE'; storyBearChase.phaseTime=0;
    storyBearChase.barrels=[]; storyBearChase.pendingDrops=[]; storyBearChase.spawnTimer=0;
    storyBearChaseStep(storyBearChase,{},.001,()=>.5);
    storyBearChase.pendingDrops[0].delay=0;
    const expected=RnRStoryChaseModel.barrelSpawnPoint(storyBearChase,0);
    storyBearChaseStep(storyBearChase,{},.001,()=>.5); storyBearChase.spawnTimer=999;
    const barrel=storyBearChase.barrels[0];
    return {dx:Math.abs(barrel.x-expected.x),dy:Math.abs(barrel.y-expected.y)};
  })()`);
  assert.ok(barrelDrop.dx < 1 && barrelDrop.dy < 1);
  await shot('01-barrel-drop');
  await run(`(() => {
    storyBearChase.barrels.push({id:901,x:W/2-75,y:H*.48,age:.35,health:2,state:'ROLL',explosionTime:0});
    storyBearChase.barrels.push({id:902,x:W/2+82,y:H*.34,age:1.1,health:2,state:'ROLL',explosionTime:0});
  })()`);
  await new Promise(resolve => setTimeout(resolve, 700));
  await shot('01-chase');
  const brakeCamera = await run(`(() => {
    storyBearChase.phase='CHASE'; storyBearChase.distance=101;
    storyBearChase.playerSpeed=MISSION_01.playerBrakeSpeed;
    storyBearChase.truckSpeed=MISSION_01.truckBaseSpeed; storyBearChase.cameraPull=.82;
    const camera=RnRStoryChaseModel.camera(storyBearChase);
    return {zoom:camera.zoom,base:RnRStoryChaseModel.baseZoom(),distance:storyBearChase.distance};
  })()`);
  assert.ok(brakeCamera.zoom < brakeCamera.base);
  await shot('01-brake-camera');
  const damage = await run(`(() => {
    storyBearChase.damageCooldown=0;
    const before=storyBearChase.hp;
    storyBearChaseExplode(storyBearChase,{state:'ROLL',explosionTime:0,x:W/2,y:H*.56},true);
    storyBearChase.distance=MISSION_01.greenZoneDistance-2;
    storyBearChase.greenTimer=3.7;
    return {before,hp:storyBearChase.hp};
  })()`);
  assert.equal(damage.before-damage.hp, 20);
  await shot('02-green-hold');
  const bridge = await run(`(() => {
    storyBearChaseApplyPoint('BRIDGE_COLLAPSE');
    const camera=RnRStoryChaseModel.camera(storyBearChase);
    return {phase:storyBearChase.phase,collapse:storyBearChase.bridgeCollapse,zoom:camera.zoom,
      blasts:storyBearChase.bridgeBlastEvents.length};
  })()`);
  assert.equal(bridge.phase, 'BRIDGE_COLLAPSE');
  assert.ok(bridge.blasts > 0);
  await shot('03-bridge-collapse');
  await run("storyBearChaseApplyPoint('BRAKE_HIT')");
  await shot('04-brake-hit');
  await run("storyBearChaseApplyPoint('DRIFT_STOP')");
  await shot('05-drift-stop');
  await run("storyBearChaseApplyPoint('PLAYER_CLOSEUP')");
  await shot('06-player-closeup');
  await run("storyBearChaseApplyPoint('SEPARATION_SHOT')");
  await shot('07-separation-shot');
  await run("storyBearChaseApplyPoint('GAP_TRAVERSE')");
  await shot('08-gap-traverse');
  await run("storyBearChaseApplyPoint('TRUCK_FOCUS')");
  await shot('09-truck-focus');
  await run("storyBearChaseApplyPoint('TRUCK_ESCAPE')");
  await shot('10-truck-escape');
  await run("storyBearChaseApplyPoint('AFTERMATH_RETURN')");
  await shot('11-aftermath-return');
  const bt = await run(`({approach:MISSION_01.bridgeApproachTime,collapse:MISSION_01.bridgeCollapseTime,
    brake:MISSION_01.bridgeBrakeSnapTime,drift:MISSION_01.bridgeDriftTime,settle:MISSION_01.bridgeSettleTime,
    close:MISSION_01.bridgePlayerCloseTime,separation:MISSION_01.bridgeSeparationTime,
    traverse:MISSION_01.bridgeTraverseTime,truck:MISSION_01.bridgeTruckPanTime,
    escape:MISSION_01.bridgeEscapeTime,return:MISSION_01.bridgeReturnTime})`);
  await naturalBridgeShot('natural-03-collapse', bt.approach + bt.collapse * .55);
  await naturalBridgeShot('natural-05-drift', bt.approach + bt.collapse + bt.brake + bt.drift * .58);
  await naturalBridgeShot('natural-06-closeup', bt.approach + bt.collapse + bt.brake + bt.drift + bt.settle + bt.close * .45);
  await naturalBridgeShot('natural-07-separation', bt.approach + bt.collapse + bt.brake + bt.drift + bt.settle +
    bt.close + bt.separation * .55);
  await naturalBridgeShot('natural-08-traverse', bt.approach + bt.collapse + bt.brake + bt.drift + bt.settle +
    bt.close + bt.separation + bt.traverse * .55);
  await naturalBridgeShot('natural-09-truck', bt.approach + bt.collapse + bt.brake + bt.drift + bt.settle +
    bt.close + bt.separation + bt.traverse + bt.truck * .5);
  await naturalBridgeShot('natural-11-return', bt.approach + bt.collapse + bt.brake + bt.drift + bt.settle +
    bt.close + bt.separation + bt.traverse + bt.truck + bt.escape + bt.return * .55);
  const retry = await run(`(() => {
    storyBearChaseApplyPoint('FAILED'); press('Enter');
    return {phase:storyBearChase.phase,hp:storyBearChase.hp,maxHp:storyBearChase.maxHp};
  })()`);
  assert.equal(retry.phase,'CHASE_START'); assert.equal(retry.hp,retry.maxHp);
  await run('storyBearChase.pause=false');
  const finished = await run(`(() => {
    storyBearChase.phase='COMIC'; storyBearChase.comicIndex=RnRStoryChaseView.comicPages().length-1; press('Enter');
    return {state, mission:save.storyMission, pending:save.storyFlags.robberyPending,
      robbed:save.storyFlags.garageRobbed, personalCarState:save.personalCarState};
  })()`);
  assert.equal(finished.state, 'car');
  assert.equal(finished.mission, 'buy_junk');
  assert.equal(finished.pending, false);
  assert.equal(finished.robbed, true);
  assert.equal(finished.personalCarState, 'stolen');
  const report = { editorBoot, started, skippedIntro, barrelDrop, brakeCamera, damage, bridge, retry, finished, errors };
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  assert.deepEqual(errors, []);
  console.log(JSON.stringify(report, null, 2));
  win.destroy();
  app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
