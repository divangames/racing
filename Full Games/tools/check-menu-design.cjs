// Настоящие экраны, мышь/клавиатура, настройки и звуки в изолированном Electron.
'use strict';
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const output=path.resolve(__dirname,'../build/menu-design-check');fs.mkdirSync(output,{recursive:true});
app.setPath('userData',fs.mkdtempSync(path.join(output,'profile-')));
app.disableHardwareAcceleration();app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');
let writes=0;
for(const [name,method] of [['save-car','handleSaveCar'],['save-track','handleSaveTrack']])require('../src/main/'+name)[method]=async()=>{writes++;return new Response('{"ok":true}');};
const protocol=require('../src/main/protocol');protocol.registerPrivilegedScheme();
const report={errors:[],screens:[]};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(win,expression){for(let i=0;i<300;i++){if(await win.webContents.executeJavaScript(expression))return;await delay(200);}throw Error('Не дождались '+expression);}
app.whenReady().then(async()=>{
  protocol.attachProtocol();const win=new BrowserWindow({show:false,width:1440,height:900,webPreferences:{offscreen:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
  win.webContents.setAudioMuted(true);win.webContents.on('console-message',event=>{if(event.level==='error')report.errors.push(event.message);});
  await win.loadURL('rnr://game/rnr.html?lab=1&car=0');
  await until(win,"typeof R!=='undefined'&&!!R&&BOOT.ready&&!!DiVANEngine.menuAudio");
  await win.webContents.executeJavaScript("requestAnimationFrame=()=>0;paused=true;labTest=false;audioInit();");await delay(300);
  await win.webContents.executeJavaScript(`window.menuPaint=()=>{
    updateView();g.setTransform(1,0,0,1,0,0);g.fillStyle='#0b1015';g.fillRect(0,0,cv.width,cv.height);
    g.setTransform(viewS,0,0,viewS,viewOX,viewOY);DiVANEngine.screens.paint(state);
  };void 0;`);
  async function capture(name,setup){
    const result=await win.webContents.executeJavaScript(`(()=>{${setup};menuPaint();gt+=.8;menuPaint();
      return {state,regions:DiVANEngine.menu.regions().map(({id,x,y,w,h})=>({id,x,y,w,h})),image:cv.toDataURL('image/png')};})()`);
    fs.writeFileSync(path.join(output,name+'.png'),Buffer.from(result.image.split(',')[1],'base64'));delete result.image;
    report.screens.push({name,...result});return result;
  }
  await capture('title',"enterTitle();selTitle=0");
  const pointer=await win.webContents.executeJavaScript(`(()=>{
    const b=DiVANEngine.menu.regions().find(b=>b.id==='title-'+g._titleItems.findIndex(i=>i.id==='settings'));
    const rect=cv.getBoundingClientRect(),x=rect.left+(b.x+b.w/2)*rect.width/cv.width,y=rect.top+(b.y+b.h/2)*rect.height/cv.height;
    cv.dispatchEvent(new MouseEvent('mousemove',{clientX:x,clientY:y,bubbles:true}));
    const selected=g._titleItems[selTitle].id;
    cv.dispatchEvent(new MouseEvent('mousedown',{clientX:x,clientY:y,button:0,bubbles:true}));
    return {selected,state};})()`);
  assert.equal(pointer.selected,'settings');assert.equal(pointer.state,'settings');report.pointer=pointer;
  await capture('settings',"settingsState='main';settingsTab=0");
  for(const pane of ['graphics','sound','game','controls'])await capture('settings-'+pane,`state='settings';settingsState='${pane}';settingsTab=0`);
  report.slider=await win.webContents.executeJavaScript(`(()=>{
    state='settings';settingsState='sound';menuPaint();const h=g._setHits.find(b=>b.act==='sndRange'&&b.key==='music');
    clickSettings(h.start+h.width*.3,h.y+10);const music=settings.sound.music;
    const r=cv.getBoundingClientRect();const x=r.left+(viewOX+(h.start+h.width*.7)*viewS)*r.width/cv.width;
    cv.dispatchEvent(new MouseEvent('mousemove',{clientX:x,clientY:r.top+300,buttons:1,bubbles:true}));
    const dragged=settings.sound.music;window.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
    return {music,dragged};})()`);
  assert.deepEqual(report.slider,{music:30,dragged:70});
  const screens=[['camera',"state='cameraSetup';cameraSetupHint=false"],['garage',"state='garage';garagePaused=false"],
    ['garage-pause',"state='garage';garagePaused=true;garagePauseIndex=2"],['slots',"state='slotSelect';slotSelectMode='save';slotSelectIndex=0"],
    ['help',"state='help'"],['achievements',"state='achievements'"],['tracks',"state='tracks';trackPickSel=0"],
    ['characters',"state='char';bioOpen=-1;selChar=PLAYABLE_IDS[0]"],['cars',"state='car';selCar=save.car"],
    ['autopark',"state='autopark';autoparkSel=save.car"],['detail',"state='detail';autoparkSel=save.car"],
    ['gym',"state='gym';gymSel=0"],['armory',"enterArmory()"],['prerace',"state='prerace';save.cash=2500;save.bet=2;raceBoard=makeRaceBoard()"]];
  for(const [name,setup] of screens)await capture(name,setup);
  await capture('pause',"buildRace();R.phase='go';R.time=10;paused=true;pauseMenuIndex=1;R.msg=null;R.hintT=0");
  report.pause=await win.webContents.executeJavaScript(`(()=>{
    const b=DiVANEngine.menu.regions().find(b=>b.id==='pause-0'),r=cv.getBoundingClientRect();
    cv.dispatchEvent(new MouseEvent('mousedown',{clientX:r.left+(b.x+b.w/2)*r.width/cv.width,clientY:r.top+(b.y+b.h/2)*r.height/cv.height,button:0,bubbles:true}));
    return {resumed:!paused};})()`);assert(report.pause.resumed);
  await capture('results',"paused=false;R.racers.forEach((r,i)=>{r.finished=true;r.finishTime=60+i});showResults();R.announcerT=99");
  await capture('career',"careerOpenFromResults();gt+=3");
  await capture('career-tracks',"careerEnterTrackPick()");
  await capture('confirm',"enterTitle();openExitWarn();");
  await win.webContents.executeJavaScript('closeExitWarn()');
  for(const [w,h] of [[800,600],[640,360],[2560,1080]]){
    win.setSize(w,h);await delay(100);
    const result=await capture('pause-'+w,"state='race';paused=true;applyResolution();R.phase='go';R.time=10");
    for(const b of result.regions){assert(b.x>=0&&b.y>=0&&b.x+b.w<=w+1&&b.y+b.h<=h+1,'Пауза вне экрана');}
    await capture('title-'+w,"enterTitle();selTitle=0");
  }
  report.audio=await win.webContents.executeJavaScript(`(async()=>{
    const a=DiVANEngine.menuAudio;await AU.ctx.resume();state='settings';settingsState='main';settings.sound.sfxOn=true;settings.sound.sfx=80;applyAudioSettings();
    const signals=Object.keys(a.presets).map(kind=>{const data=a.render(kind,48000);let peak=0,energy=0;for(const v of data){peak=Math.max(peak,Math.abs(v));energy+=v*v;}return {kind,seconds:data.length/48000,peak,rms:Math.sqrt(energy/data.length),first:data[0],last:data[data.length-1]};});
    a.play('confirm');const before=a.status().played;settings.sound.sfx=0;const muted=a.play('confirm');settings.sound.sfx=80;settings.sound.sfxOn=false;const disabled=a.play('confirm');settings.sound.sfxOn=true;applyAudioSettings();
    press('ArrowDown');const navigation=a.status().lastKind;await new Promise(r=>setTimeout(r,70));press('Escape');
    return {signals,muted,disabled,navigation,last:a.status().lastKind,voices:a.status().voices,before};
  })()`);
  for(const s of report.audio.signals){assert(s.peak<.8&&s.rms>.01);assert.equal(s.first,0);assert.equal(s.last,0);}
  assert.equal(report.audio.muted,false);assert.equal(report.audio.disabled,false);assert.equal(report.audio.navigation,'move');assert.equal(report.audio.last,'back');assert(report.audio.voices<=4);
  assert.equal(writes,0);assert.deepEqual(report.errors,[]);report.writes=writes;
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(report,null,2));fs.rmSync(path.join(output,'failure.json'),{force:true});
  console.log(JSON.stringify({screens:report.screens.length,pointer,slider:report.slider,pause:report.pause,audio:report.audio,errors:report.errors,writes},null,2));win.destroy();app.exit(0);
}).catch(error=>{fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({...report,error:error.stack},null,2));console.error(error);app.exit(1);});
