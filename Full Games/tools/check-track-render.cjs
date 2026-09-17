'use strict';
// Isolated, invisible rendering check; never writes game content or player saves.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const output = path.resolve(__dirname, '../build/track-render-check');
fs.mkdirSync(output, { recursive: true });
app.setPath('userData', path.join(output, 'profile'));
app.disableHardwareAcceleration();
const protocol = require('../src/main/protocol');
protocol.registerPrivilegedScheme();
app.whenReady().then(async () => {
  protocol.attachProtocol();
  const win = new BrowserWindow({ show: false, width: 1600, height: 900, webPreferences: { offscreen: true, backgroundThrottling: false } });
  win.webContents.on('console-message', event => {
    if (event.level === 'error') console.error('Renderer:', event.message);
  });
  await win.loadURL('rnr://game/rnr.html?lab=1&car=0');
  const start = Date.now();
  while (!await win.webContents.executeJavaScript("typeof R !== 'undefined' && !!R && !!P && BOOT.ready")) {
    assert(Date.now() - start < 90000, 'Game boot timed out');
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  const trackArg=process.argv.find(arg=>arg.startsWith('--track='));
  const trackId=trackArg ? trackArg.slice(8) : null;
  if(trackId){
    assert(/^custom_\d+$/.test(trackId));
    const def=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../assets/data/tracks',trackId+'.json'),'utf8'));
    await win.webContents.executeJavaScript('window.__renderTrackDef='+JSON.stringify(def));
  }
  const result = await win.webContents.executeJavaScript(`(() => {
    paused = true; labTest = false; settings.graphics.weather = false;
    const def = window.__renderTrackDef || { name:'Render check', cps:[[0,0],[650,450],[1300,0],[1300,850],[650,450],[0,850]],
      theme:{ground:'#292520',dark:'#171614',road:'#383732',line:'#dba438',deco:'rock'}, zones:[] };
    const started = performance.now();
    const T = buildTrack(def, 0); T.img = prerender(T);
    const bakeMs = performance.now() - started;
    R.T=T; R.S=T.S; R.N=T.N; R.phase='go'; R.countT=0; R.hintT=0; R.msg=null;
    for(const name of ['puddles','skids','shocks','scorch','pads','ramps','oils','mines','spikes','picks','shots','parts','floats','shortcuts','labObjects']) R[name]=[];
    const hits=[];
    for(let i=0;i<T.N;i++)for(let j=i+16;j<T.N&&T.N-(j-i)>=16;j++){
      const a=T.S[i],b=T.S[(i+1)%T.N],c=T.S[j],d=T.S[(j+1)%T.N];
      const ax=b.x-a.x,ay=b.y-a.y,bx=d.x-c.x,by=d.y-c.y,det=ax*by-ay*bx;
      if(Math.abs(det)<1e-6)continue;
      const dx=c.x-a.x,dy=c.y-a.y,u=(dx*by-dy*bx)/det,v=(dx*ay-dy*ax)/det;
      if(u>=0&&u<1&&v>=0&&v<1)hits.push({i,j,x:a.x+u*ax,y:a.y+u*ay});
    }
    const hit=hits.find(h=>roadMaterial(T,h.j/T.N)==='asphalt')||hits[0];
    if(!hit)throw new Error('No true crossing on test track');
    if(trackDeck(T,hit.i/T.N)===trackDeck(T,hit.j/T.N))throw new Error('Both crossing roads have the same deck');
    const upperIdx=trackDeck(T,hit.i/T.N)>0?hit.i:hit.j,lowIdx=upperIdx===hit.i?hit.j:hit.i;
    const upper={x:hit.x,y:hit.y};
    const traversal=[];
    for(const [branch,index] of [['under',lowIdx],['over',upperIdx]]){
      for(const direction of [1,-1]){
        P.trackIdx=(index-direction*18+T.N)%T.N;P._deckDraw=undefined;
        for(let step=-18;step<=18;step++){
          const i=(index+direction*step+T.N)%T.N,p=T.S[i];
          Object.assign(P,{x:p.x,y:p.y,ang:p.ang,air:false,z:0});advanceIdx(P);keepOnTrack(P,ROADW);
          const deck=racerDeck(P);
          if(Math.abs(step)<=7 && deck!==(branch==='under'?0:1))throw new Error('Wrong deck during '+branch+' traversal');
        }
        traversal.push({branch,direction,ok:true});
      }
    }
    Object.assign(P,{x:upper.x,y:upper.y,ang:T.S[lowIdx].ang,trackIdx:lowIdx,air:false,z:0,dead:false,invuln:0,cloak:0,haze:0,shield:1,_deckDraw:undefined});
    R.racers=[P]; R.pl=P; R.cam={x:P.x-visW()/2,y:P.y-visH()/2}; R.sx=R.sy=0;
    function capture(){g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,cv.width,cv.height);drawRaceWorld();return cv.toDataURL('image/png').split(',')[1];}
    const sample=()=>Array.from(g.getImageData(cv.width/2-50,cv.height/2-25,100,50).data);
    R.racers=[];capture();const emptyPixels=sample();R.racers=[P];
    const under=capture(), underPixels=sample();
    P.air=true;P.z=30;capture();const jumpPixels=sample();P.air=false;P.z=0;
    P.trackIdx=upperIdx;P._deckDraw=undefined;P.ang=T.S[upperIdx].ang;const over=capture(),overPixels=sample();
    const occlusion={underHidden:underPixels.every((v,i)=>v===emptyPixels[i]),jumpHidden:jumpPixels.every((v,i)=>v===emptyPixels[i]),overVisible:overPixels.some((v,i)=>v!==emptyPixels[i])};
    const entrances={};
    for(const [name,distance] of [['entry',-110],['exit',110]]){
      const p=T.S[lowIdx];
      Object.assign(P,{x:upper.x+p.tx*distance,y:upper.y+p.ty*distance,ang:p.ang,trackIdx:lowIdx,_deckDraw:undefined});
      R.cam={x:P.x-visW()/2,y:P.y-visH()/2};
      const pixels=()=>Array.from(g.getImageData(cv.width/2-120,cv.height/2-90,240,180).data);
      R.racers=[];capture();const background=pixels();R.racers=[P];
      entrances[name]=capture();const visible=pixels();
      const hi=T.imgHigh;T.imgHigh=null;R.racers=[];capture();const openBackground=pixels();R.racers=[P];capture();const openCar=pixels();T.imgHigh=hi;
      let exposed=0,full=0;
      for(let i=0;i<visible.length;i+=4){
        if(visible[i]!==background[i]||visible[i+1]!==background[i+1]||visible[i+2]!==background[i+2])exposed++;
        if(openCar[i]!==openBackground[i]||openCar[i+1]!==openBackground[i+1]||openCar[i+2]!==openBackground[i+2])full++;
      }
      occlusion[name+'Partial']=exposed>100&&exposed<full*.95;
    }
    const curve=T.S[Math.floor(T.N*.27)]; R.cam={x:curve.x-visW()/2,y:curve.y-visH()/2};
    const road=capture();
    return {name:T.name,bakeMs,traversal,occlusion,size:[T.img.width,T.img.height],world:[T.w,T.h],decks:T.decks,upperIdx,lowIdx,under,over,road,...entrances};
  })()`);
  const suffix = process.argv.includes('--before') ? 'before' : 'after';
  if(suffix==='after'){
    assert(result.occlusion.underHidden,'Car under bridge leaked through deck');
    assert(result.occlusion.overVisible,'Car on bridge was hidden');
    assert(result.occlusion.jumpHidden,'Jump moved the lower car onto bridge layer');
    assert(result.occlusion.entryPartial && result.occlusion.exitPartial,'Bridge must progressively cover and reveal the car at its edges');
  }
  for (const key of ['under','over','road','entry','exit']) {
    fs.writeFileSync(path.join(output, (trackId?trackId+'-':'') + key + '-' + suffix + '.png'), Buffer.from(result[key], 'base64'));
    delete result[key];
  }
  fs.writeFileSync(path.join(output, 'result-' + suffix + '.json'), JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
  win.destroy(); app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
