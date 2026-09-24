'use strict';
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const output = path.resolve(__dirname, 'ai-native-diagnostics');
fs.mkdirSync(output, { recursive: true });
app.setPath('userData', fs.mkdtempSync(path.join(output, 'profile-')));
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
let writes = 0;
for (const [file, method] of [['save-car', 'handleSaveCar'], ['save-track', 'handleSaveTrack']]) {
  require('../src/main/' + file)[method] = async () => { writes++; return new Response('{"ok":true}'); };
}
const protocol = require('../src/main/protocol');
protocol.registerPrivilegedScheme();
const report = { errors: [] };
async function until(win, expression) {
  const deadline = Date.now() + 75000;
  while (Date.now() < deadline) {
    if (await win.webContents.executeJavaScript(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('boot timeout');
}
app.whenReady().then(async () => {
  protocol.attachProtocol();
  const win = new BrowserWindow({ show: false, width: 1440, height: 900,
    webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
  win.webContents.setAudioMuted(true);
  win.webContents.on('console-message', e => { if (e.level === 'error') report.errors.push(e.message); });
  await win.loadURL('rnr://game/rnr.html?lab=1&car=0');
  await until(win, "typeof R!=='undefined' && !!R && !!P && BOOT.ready && !!DiVANEngine.recovery");
  report.simulation = await win.webContents.executeJavaScript(`(()=>{
    const random=Math.random; Math.random=mulberry(7187);
    try {
      paused=true;labTest=false;raceTrackOverride=0;raceTrackCustom=null;buildRace();
      R.phase='go';R.countT=0;R.msg=null;R.hintT=0;P.invuln=100;
      const history=[],events=[],round=n=>Math.round(n*100)/100;
      const sample=r=>({slot:r.slot,isP:r.isP,car:r.car.idx,style:r.aiStyle,trackIdx:r.trackIdx,lap:r.lap,prog:r.prog,
        x:round(r.x),y:round(r.y),ang:round(r.ang),spd:round(r.spd),lat:round(r.lat),hp:round(r.hp),dead:r.dead,
        revT:round(r.revT||0),stuckT:round(r.stuckT||0),ith:round(r.ith||0),ist:round(r.ist||0),lane:round(r.aiLane||0),
        plan:r._aiPlan,pDistance:round(Math.hypot(r.x-P.x,r.y-P.y)),
        roadDist:round(Math.hypot(r.x-R.S[r.trackIdx].x,r.y-R.S[r.trackIdx].y)),rail:r._railHitN,contact:r._contactGrace});
      DiVANEngine.wrap('killRacer',original=>function(r,killer){events.push({event:'kill',time:round(R.time),r:sample(r),killer:killer&&killer.slot});return original.apply(this,arguments);});
      DiVANEngine.wrap('respawn',original=>function(r){events.push({event:'respawn',time:round(R.time),r:sample(r)});return original.apply(this,arguments);});
      const initial=R.racers.map(sample); paused=false;
      for(let i=0;i<4800;i++){
        ${process.argv.includes('--clock') ? 'gt+=1/120;' : ''}
        updRace(1/120);
        if(i%60===59)history.push({time:round(R.time),racers:R.racers.map(sample)});
      }
      paused=true;
      return {initial,history,events,N:R.N,roadWidth:ROADW,track:R.T.name};
    } finally {Math.random=random;}
  })()`);
  report.writes = writes;
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ errors: report.errors, writes, initial: report.simulation.initial,
    events: report.simulation.events, history: report.simulation.history.filter((_r,i)=>i%10===9).map(row=>({time:row.time,racers:row.racers.map(r=>({car:r.car,prog:r.prog,hp:r.hp,spd:r.spd,roadDist:r.roadDist,revT:r.revT,plan:r.plan}))})) }, null, 2));
  win.destroy(); app.exit(0);
}).catch(error => { fs.writeFileSync(path.join(output, 'failure.json'), JSON.stringify({errors:report.errors,error:error.stack}));console.error(error);app.exit(1); });
