'use strict';
// Real Electron rendering and editor interactions; all save handlers are isolated.
const {app, BrowserWindow} = require('electron');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const output = path.resolve(__dirname, '../build/rail-junction-check');
fs.mkdirSync(output, {recursive:true});
app.setPath('userData', fs.mkdtempSync(path.join(output, 'profile-')));
app.disableHardwareAcceleration();
for (const file of ['save-car','save-track','save-chapter','save-texture','save-object']) {
  const api = require('../src/main/'+file);
  for (const name of Object.keys(api)) if (name.startsWith('handleSave')) {
    api[name] = async () => new Response('{"ok":true}', {headers:{'content-type':'application/json'}});
  }
}
const protocol = require('../src/main/protocol');
protocol.registerPrivilegedScheme();
const wait = ms => new Promise(resolve=>setTimeout(resolve,ms));
const report = {errors:[], game:[], editor:[]};
async function until(win, expression) {
  for(let i=0;i<600;i++) {
    if(await win.webContents.executeJavaScript(expression))return;
    await wait(100);
  }
  throw new Error('Timed out: '+expression);
}
app.whenReady().then(async()=>{
  protocol.attachProtocol();
  const win = new BrowserWindow({show:false,width:1440,height:900,
    webPreferences:{offscreen:true,backgroundThrottling:false}});
  win.webContents.on('console-message',e=>{if(e.level==='error')report.errors.push(e.message);});
  await win.loadURL('rnr://game/rnr.html?lab=1&car=0');
  await until(win,"typeof R!=='undefined' && !!R && !!P && BOOT.ready");
  for(const mode of ['junction','overpass']) {
    const geometry=await win.webContents.executeJavaScript(`(()=>{
      paused=true;settings.graphics.weather=false;
      const cps=[];for(let i=0;i<32;i++){const t=i/32*Math.PI*2;cps.push([900+720*Math.sin(t),700+430*Math.sin(2*t)]);}
      const start=performance.now(),T=buildTrack({name:'Rail QA',cps,crossingMode:${JSON.stringify(mode)},theme:{ground:'#292520',dark:'#171614',road:'#383732',deco:'rock'}},0);
      T.img=prerender(T);R.T=T;R.S=T.S;R.N=T.N;R.phase='go';R.racers=[];
      for(const key of ['puddles','skids','shocks','scorch','pads','ramps','oils','mines','spikes','picks','shots','parts','floats','shortcuts','labObjects'])R[key]=[];
      const api=DiVANEngine.trackSpan, left=api.railJunctionMask(T,ROADW,1,9), right=api.railJunctionMask(T,ROADW,-1,9);
      let center;
      for(let i=0;i<T.N&&!center;i++)for(let j=i+16;j<T.N&&T.N-(j-i)>=16;j++){
        const a=T.S[i],b=T.S[(i+1)%T.N],c=T.S[j],d=T.S[(j+1)%T.N];
        const ax=b.x-a.x,ay=b.y-a.y,bx=d.x-c.x,by=d.y-c.y,det=ax*by-ay*bx;
        if(Math.abs(det)<1e-6)continue;
        const dx=c.x-a.x,dy=c.y-a.y,u=(dx*by-dy*bx)/det,v=(dx*ay-dy*ax)/det;
        if(u>=0&&u<1&&v>=0&&v<1){center={x:a.x+u*ax,y:a.y+u*ay,ang:a.ang};break;}
      }
      if(!center)throw new Error('QA track needs a true intersection');
      window.__railCenter={x:center.x,y:center.y};
      Object.assign(P,{x:center.x,y:center.y,ang:center.ang,trackIdx:0,air:false,z:0,dead:false,_deckDraw:undefined});
      R.racers=[P];R.pl=P;R.sx=R.sy=0;R.countT=0;R.hintT=0;R.msg=null;
      return {mode:${JSON.stringify(mode)},bakeMs:performance.now()-start,N:T.N,decks:T.decks,
        left:left?.filter(Boolean).length||0,right:right?.filter(Boolean).length||0,
        independent:!!left&&!!right&&left.some((v,i)=>v!==right[i])};
    })()`);
    if(mode==='junction')assert(geometry.left>0&&geometry.right>0&&geometry.independent);
    else assert.equal(geometry.left+geometry.right,0,'Bridge rails must stay continuous');
    report.game.push(geometry);
    for(const [width,height] of [[1440,900],[800,600]]) {
      win.setContentSize(width,height);await wait(200);
      const pixels=await win.webContents.executeJavaScript(`(()=>{
        R.cam={x:__railCenter.x-visW()/2,y:__railCenter.y-visH()/2};
        g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,cv.width,cv.height);drawRaceWorld();
        return cv.toDataURL('image/png').split(',')[1];
      })()`);
      fs.writeFileSync(path.join(output,mode+'-'+width+'.png'),Buffer.from(pixels,'base64'));
    }
  }
  await win.loadURL('rnr://game/Editor.html?tab=map');
  await until(win,"typeof MapApp!=='undefined'&&MapApp.mapOn()&&!!document.getElementById('mapRoadEditor')&&!document.getElementById('lab-splash')");
  await win.webContents.executeJavaScript('document.fonts.ready');
  for(const [width,height] of [[1440,900],[800,600]]) {
    win.setContentSize(width,height);await wait(250);
    const metrics=await win.webContents.executeJavaScript(`(()=>{
      document.getElementById('mapRoadNewCrossroads').click();
      const mode=document.getElementById('mapCrossingMode');
      mode.value='overpass';mode.dispatchEvent(new Event('change',{bubbles:true}));
      const bridge=MapData.fileTrack(MapApp.getDocument()).crossingMode;
      mode.value='junction';mode.dispatchEvent(new Event('change',{bubbles:true}));
      MapView.fit();MapView.draw();
      return {width:innerWidth,height:innerHeight,bridge,junction:MapData.fileTrack(MapApp.getDocument()).crossingMode,
        points:MapApp.getDocument().cps.length,overflow:document.body.scrollWidth>innerWidth+2};
    })()`);
    assert.equal(metrics.bridge,'overpass');assert.equal(metrics.junction,'junction');assert.equal(metrics.points,20);
    assert.equal(metrics.overflow,false);
    report.editor.push(metrics);await wait(400);
    fs.writeFileSync(path.join(output,'editor-'+width+'.png'),(await win.webContents.capturePage()).toPNG());
  }
  assert.deepEqual(report.errors,[]);
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));win.destroy();app.exit(0);
}).catch(error=>{console.error(error);console.error(JSON.stringify(report));app.exit(1);});
