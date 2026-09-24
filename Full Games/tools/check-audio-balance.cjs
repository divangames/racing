// Реальный Web Audio: тишина демо, слышимый UI и энергия левого/правого каналов.
'use strict';
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const output=path.resolve(__dirname,'../build/audio-balance-check');fs.mkdirSync(output,{recursive:true});
app.setPath('userData',fs.mkdtempSync(path.join(output,'profile-')));
app.disableHardwareAcceleration();app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');
let writes=0;
for(const [name,method] of [['save-car','handleSaveCar'],['save-track','handleSaveTrack']])require('../src/main/'+name)[method]=async()=>{writes++;return new Response('{"ok":true}');};
const protocol=require('../src/main/protocol');protocol.registerPrivilegedScheme();
const report={errors:[]};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
app.whenReady().then(async()=>{
  protocol.attachProtocol();const win=new BrowserWindow({show:false,width:1280,height:720,webPreferences:{offscreen:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
  win.webContents.setAudioMuted(true);win.webContents.on('console-message',event=>{if(event.level==='error')report.errors.push(event.message);});
  await win.loadURL('rnr://game/rnr.html?lab=1&car=0');
  for(let i=0;i<300;i++){
    if(await win.webContents.executeJavaScript("typeof R!=='undefined'&&!!R&&BOOT.ready&&!!DiVANEngine.audioMix"))break;
    if(i===299)throw Error('Загрузка аудиодвижка не завершилась');await delay(200);
  }
  await win.webContents.executeJavaScript('requestAnimationFrame=()=>0;void 0;');await delay(100);
  report.audio=await win.webContents.executeJavaScript(`(async()=>{
    const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    audioInit();await AU.ctx.resume();labTest=false;state='race';paused=false;
    settings.sound={...settings.sound,musicOn:false,music:50,sfxOn:true,sfx:80,biome:0,crowd:0};
    applyAudioSettings();MUSIC.stop();CHIP.stop();carEngineHalt();RnRWeatherAudio.haltLoop();RnRArenaCrowd.halt();
    if(typeof stopCharVoice==='function')stopCharVoice();AU.engG.gain.value=0;
    const mix=DiVANEngine.audioMix,menu=DiVANEngine.menuAudio,c=AU.ctx;
    const split=c.createChannelSplitter(2),left=c.createAnalyser(),right=c.createAnalyser();
    left.fftSize=right.fftSize=2048;AU.master.connect(split);split.connect(left,0);split.connect(right,1);
    const rms=node=>{const values=new Float32Array(node.fftSize);node.getFloatTimeDomainData(values);return Math.sqrt(values.reduce((sum,v)=>sum+v*v,0)/values.length);};
    const read=()=>({left:rms(left),right:rms(right)});
    const buffer=c.createBuffer(1,c.sampleRate,c.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=Math.sin(2*Math.PI*440*i/c.sampleRate)*.35;
    const slot=carEngineMakeSlot();slot.live=true;slot.pan=-.7;mix.sync(true);
    carEnginePlayWeb(slot,'balance-tone',buffer,true,.6,1,-.7,true);await wait(180);const panLeft=read();
    slot.pan=.7;carEngineTouchSlot(slot,.6,1);await wait(360);const panRight=read();
    paused=true;mix.sync(true);await wait(100);const silence=read();carEngineKillSlot(slot);
    await wait(150);
    // Настоящее наведение на пункт паузы должно попадать в отдельную шину UI.
    updateView();g.setTransform(viewS,0,0,viewS,viewOX,viewOY);DiVANEngine.screens.paint('race');
    const b=DiVANEngine.menu.regions().find(b=>b.id==='pause-2'),rect=cv.getBoundingClientRect();
    cv.dispatchEvent(new MouseEvent('mousemove',{clientX:rect.left+(b.x+b.w/2)*rect.width/cv.width,clientY:rect.top+(b.y+b.h/2)*rect.height/cv.height,bubbles:true}));
    await wait(28);const hover=read(),hoverKind=menu.status().lastKind;
    const demos=[];
    for(const screen of ['settings','cameraSetup','car','autopark','detail','garage']){
      state=screen;paused=false;mix.sync(true);updEngine(P,false,screen);
      if(screen==='settings'||screen==='cameraSetup'){ensureTitlePreview();updateTitleRace(.03);}
      demos.push({screen,engines:carEngineLive(),world:AU.sfx.gain.value,ui:AU.ui.gain.value});
    }
    const before=menu.status().played;withTitleSim(()=>{sHit();sCash();sClick();});const demoClicks=menu.status().played-before;
    state='settings';const settingsCategory=musicCat();CHIP.start('main');const oldTrack=CHIP.on;
    settings.sound.sfx=0;applyAudioSettings();const muted={ui:AU.ui.gain.value,world:AU.sfx.gain.value,play:menu.play('confirm')};
    settings.sound.sfx=80;applyAudioSettings();
    // HTML-клип проходит через ту же стереошину, а не напрямую в динамики.
    state='race';paused=false;mix.sync(true);
    const wav=new ArrayBuffer(44+data.length*2),v=new DataView(wav);
    const word=(at,s)=>{for(let i=0;i<s.length;i++)v.setUint8(at+i,s.charCodeAt(i));};
    word(0,'RIFF');v.setUint32(4,36+data.length*2,true);word(8,'WAVE');word(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,c.sampleRate,true);v.setUint32(28,c.sampleRate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);word(36,'data');v.setUint32(40,data.length*2,true);
    for(let i=0;i<data.length;i++)v.setInt16(44+i*2,data[i]*32767,true);
    const url=URL.createObjectURL(new Blob([wav],{type:'audio/wav'})),el=new Audio(url);el.loop=true;el.volume=.6;
    mix.routeMedia(el,-.7);await el.play();await wait(180);const htmlLeft=read();
    mix.routeMedia(el,.7);await wait(360);const htmlRight=read();
    state='settings';mix.sync(true);await wait(100);const htmlSilent=read();el.pause();mix.releaseMedia(el);URL.revokeObjectURL(url);
    return {panLeft,panRight,silence,hover,hoverKind,demos,demoClicks,settingsCategory,oldTrack,muted,htmlLeft,htmlRight,htmlSilent};
  })()`);
  const a=report.audio;
  for(const [l,r] of [[a.panLeft,a.panRight],[a.htmlLeft,a.htmlRight]]){assert(l.left>l.right*2&&l.left>.01);assert(r.right>r.left*2&&r.right>.01);}
  for(const quiet of [a.silence,a.htmlSilent])assert(quiet.left<.0001&&quiet.right<.0001,'Мир продолжает звучать в меню');
  assert(a.hover.left>.004&&a.hover.right>.004,'Наведение не слышно в паузе');assert.equal(a.hoverKind,'move');
  for(const d of a.demos){assert.equal(d.engines,false);assert.equal(d.world,0);assert(d.ui>0);}
  assert.equal(a.demoClicks,0);assert.equal(a.settingsCategory,'cast');assert.equal(a.oldTrack,false);
  assert.deepEqual(a.muted,{ui:0,world:0,play:false});assert.equal(writes,0);assert.deepEqual(report.errors,[]);
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(report,null,2));fs.rmSync(path.join(output,'failure.json'),{force:true});console.log(JSON.stringify(report,null,2));win.destroy();app.exit(0);
}).catch(error=>{console.error(error);fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({...report,error:error.stack},null,2));app.exit(1);});
