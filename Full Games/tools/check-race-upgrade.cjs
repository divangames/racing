// Проверка всей цепочки улучшений в настоящем клиенте, с изолированным профилем.
'use strict';
const {app, BrowserWindow} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const output = path.resolve(__dirname, '../build/race-upgrade-check');
fs.mkdirSync(output, {recursive: true});
app.setPath('userData', fs.mkdtempSync(path.join(output, 'profile-')));
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
let writes = 0;
for (const [file, method] of [['save-car','handleSaveCar'],['save-track','handleSaveTrack']]) {
  require('../src/main/' + file)[method] = async () => { writes++; return new Response('{"ok":true}'); };
}
const protocol = require('../src/main/protocol'); protocol.registerPrivilegedScheme();
const report = {errors: []};
async function until(win, expression) {
  const deadline = Date.now() + 75000;
  while (Date.now() < deadline) {
    if (await win.webContents.executeJavaScript(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Не дождались: ' + expression);
}
async function capture(win, name, draw) {
  const data = await win.webContents.executeJavaScript(`(()=>{
    updateView();g.setTransform(1,0,0,1,0,0);g.fillStyle='#050409';g.fillRect(0,0,cv.width,cv.height);
    g.setTransform(viewS,0,0,viewS,viewOX,viewOY);
    ${draw};return cv.toDataURL('image/png');})()`);
  fs.writeFileSync(path.join(output, name + '.png'), Buffer.from(data.split(',')[1], 'base64'));
}
app.whenReady().then(async () => {
  protocol.attachProtocol();
  const win = new BrowserWindow({show: false, width: 1440, height: 900,
    webPreferences: {offscreen: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false}});
  win.webContents.setAudioMuted(true);
  win.webContents.on('console-message', event => { if (event.level === 'error') report.errors.push(event.message); });
  await win.loadURL('rnr://game/rnr.html?lab=1&car=0');
  await until(win, "typeof R!=='undefined' && !!R && !!P && BOOT.ready && !!DiVANEngine.recovery && !!DiVANEngine.weaponCharge");
  report.race = await win.webContents.executeJavaScript(`(()=>{
    const random=Math.random;Math.random=mulberry(7187);
    try{
    paused=true;labTest=false;raceTrackOverride=0;raceTrackCustom=null;buildRace();
    R.phase='go';R.countT=0;R.msg=null;R.hintT=0;P.invuln=100;
    // Игрок остаётся на клетке: соперники должны объехать стоящую машину.
    const initial=R.racers.map(r=>r.prog); paused=false;
    for(let i=0;i<1200;i++){gt+=1/120;updRace(1/120);}
    paused=true;
    return {racers:R.racers.length,styles:[...new Set(R.racers.filter(r=>!r.isP).map(r=>r.aiStyle))],
      finite:R.racers.every(r=>[r.x,r.y,r.spd,r.lat].every(Number.isFinite)),
      progress:R.racers.filter(r=>!r.isP).map(r=>r.prog-initial[R.racers.indexOf(r)]),
      tactics:!!R.T.tactics,gate:!!R.tacticGate};
    }finally{Math.random=random;}
  })()`);
  assert(report.race.finite); assert(report.race.styles.length >= 2);
  assert(report.race.progress.every(value => value > 0), 'Соперники не продвигаются по трассе');
  report.charge = await win.webContents.executeJavaScript(`(()=>{
    paused=false;R.phase='go';R.shots=[];
    const car=CARS.find(c=>DiVANEngine.weaponCharge.HEAVY[carAbil(c.idx).weapon.type]);
    const r=makeRacer(CHARS[1],car,false,blankTune(),7);r.x=P.x+140;r.y=P.y;r.ang=.3;r.cdW=0;
    R.racers.push(r);fireWeapon(r);
    const pending=DiVANEngine.weaponCharge.state(r),before=R.shots.length;
    tickCarKits(r,.1);const early=R.shots.length;r.ang=1.6;
    tickCarKits(r,pending.total);const shot=R.shots.find(s=>s.r===r);
    const out={before,early,released:!!shot,angle:shot?Math.atan2(shot.vy,shot.vx):null,
      restored:r.ang,fired:DiVANEngine.insights.snapshot(r).shotsFired};
    r.cdW=0;fireWeapon(r);r.dead=true;tickCarKits(r,.1);out.cancelled=!DiVANEngine.weaponCharge.state(r);
    paused=true;return out;
  })()`);
  assert.equal(report.charge.before, 0); assert.equal(report.charge.early, 0); assert(report.charge.released);
  assert(Math.abs(report.charge.angle - .3) < .01); assert.equal(report.charge.restored, 1.6);
  assert(report.charge.fired > 0 && report.charge.cancelled);
  report.recovery = await win.webContents.executeJavaScript(`(()=>{
    buildRace();R.phase='go';R.countT=0;paused=false;
    P.trackIdx=Math.floor(R.N*.2);P.lap=0;P.prog=P.trackIdx;P._lapCheckpoint=0;
    const p=R.S[P.trackIdx];P.x=p.x+500;P.y=p.y+500;P.hp=37;P.wepAmmo=2;P.cdN=7;P.cdU=11;
    const progress=P.prog,answer=DiVANEngine.recovery.recover(P),again=DiVANEngine.recovery.recover(P);
    paused=true;return {answer,again,hp:P.hp,ammo:P.wepAmmo,nitro:P.cdN,ult:P.cdU,
      forward:P.prog>progress,stats:DiVANEngine.insights.snapshot(P)};
  })()`);
  assert(report.recovery.answer.ok); assert.equal(report.recovery.again.ok, false);
  assert.deepEqual([report.recovery.hp,report.recovery.ammo,report.recovery.nitro,report.recovery.ult],[37,2,7,11]);
  assert.equal(report.recovery.forward, false); assert.equal(report.recovery.stats.lapValid, false);
  report.ghost = await win.webContents.executeJavaScript(`(()=>{
    DiVANEngine.race.replayLastRace();R.phase='go';R.countT=0;paused=false;
    P.lap=-1;P.trackIdx=R.N-1;P.spd=0;P.lat=0;P.invuln=100;R.time=.1;
    P.x=R.S[0].x;P.y=R.S[0].y;P.ang=R.S[0].ang;advanceIdx(P);
    const count=R.racers.length;
    for(let i=1;i<=R.N;i++){
      const p=R.S[i%R.N];R.time=.1+i*.05;P.x=p.x;P.y=p.y;P.ang=p.ang;P.spd=0;P.lat=0;
      stepVehicle(P,0,0,1/120,false);advanceIdx(P);
    }
    const status=DiVANEngine.trainingGhost.status(),stats=DiVANEngine.insights.snapshot(P);
    R.time+=.1;const pose=DiVANEngine.trainingGhost.pose();
    paused=true;return {status,stats,pose,fieldUnchanged:R.racers.length===count};
  })()`);
  assert(report.ghost.status.available); assert(report.ghost.stats.bestLap > 0);
  assert(report.ghost.pose && report.ghost.fieldUnchanged);
  await capture(win,'training',`R.hintT=0;R.msg=null;R.sx=R.sy=0;
    R.cam.x=P.x-visW()/2;R.cam.y=P.y-visH()/2;const wasPaused=paused;paused=false;
    try{DiVANEngine.screens.paint(state);}finally{paused=wasPaused;}`);
  report.results = await win.webContents.executeJavaScript(`(()=>{
    const cash=save.cash,career=save.race;
    R.racers.forEach((r,i)=>{r.finished=true;r.finishTime=64+i;});P.finishTime=66;
    showResults();R.announcerT=20;R.msg=null;drawResults();
    return {state,cashSame:cash===save.cash,careerSame:career===save.race,actions:g._resultHits.map(h=>h.action),
      stats:DiVANEngine.insights.snapshot(P),track:R.tIdx,seed:R.startSpec.seed};
  })()`);
  assert.equal(report.results.state,'results'); assert(report.results.cashSame && report.results.careerSame);
  assert.deepEqual(report.results.actions,[0,1]);
  await capture(win,'results','DiVANEngine.screens.paint(state)');
  report.replay = await win.webContents.executeJavaScript(`(()=>{
    const old=R,cash=save.cash,career=save.race;press('KeyR');paused=true;
    return {changed:R!==old,track:R.tIdx,seed:R.startSpec.seed,replay:R.replay,laps:raceLaps,
      cashSame:cash===save.cash,careerSame:career===save.race,ghost:DiVANEngine.trainingGhost.status().available};
  })()`);
  assert(report.replay.changed && report.replay.replay && report.replay.ghost);
  assert(report.replay.cashSame && report.replay.careerSame);
  assert.equal(report.replay.track,report.results.track); assert.equal(report.replay.seed,report.results.seed);
  report.pause = await win.webContents.executeJavaScript(`(()=>{
    R.phase='go';R.countT=0;R.time=10;paused=true;
    const items=pauseRaceItems();pauseMenuIndex=items.indexOf('ВЕРНУТЬСЯ НА ТРАССУ');
    const before=DiVANEngine.insights.snapshot(P).recoveries;press('Enter');
    return {items,resumed:!paused,used:DiVANEngine.insights.snapshot(P).recoveries===before+1};
  })()`);
  assert(report.pause.items.includes('ВЕРНУТЬСЯ НА ТРАССУ'));assert(report.pause.resumed && report.pause.used);
  report.settings = await win.webContents.executeJavaScript(`(()=>{
    openSettings('race');settingsState='graphics';settingsTab=gfxOpts().findIndex(o=>o.key==='shakeStrength');
    drawSettings();const hit=g._setHits.find(h=>h.act==='gfxRange');
    clickSettings(hit.start+hit.width*.3,hit.y+10);const pointer=settings.graphics.shakeStrength;
    nudgeGraphics(1);const keyboard=settings.graphics.shakeStrength;drawSettings();
    return {pointer,keyboard,recovery:settings.controls.recover,rows:gfxOpts().length};
  })()`);
  assert.equal(report.settings.pointer,30); assert.equal(report.settings.keyboard,40);
  assert(report.settings.recovery.includes('KeyT'));
  await capture(win,'settings','DiVANEngine.screens.paint(state)');
  report.writes=writes;assert.equal(writes,0);assert.deepEqual(report.errors,[]);
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(report,null,2));
  fs.rmSync(path.join(output,'failure.json'),{force:true});
  console.log(JSON.stringify(report,null,2));win.destroy();app.exit(0);
}).catch(error=>{
  fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({...report,error:error.stack},null,2));
  console.error(error);app.exit(1);
});
