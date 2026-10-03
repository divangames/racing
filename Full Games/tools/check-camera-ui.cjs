'use strict';
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const output=path.resolve(__dirname,'../build/camera-ui-check');fs.mkdirSync(output,{recursive:true});
app.setPath('userData',fs.mkdtempSync(path.join(output,'profile-')));app.disableHardwareAcceleration();
let writes=0;for(const name of ['save-car','save-track','save-chapter','save-texture','save-object']){
 const api=require('../src/main/'+name);for(const key of Object.keys(api))if(key.startsWith('handleSave'))api[key]=async()=>{writes++;return new Response('{"ok":true}');};
}
const protocol=require('../src/main/protocol');protocol.registerPrivilegedScheme();
const report={errors:[],sizes:[]};const delay=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{
 protocol.attachProtocol();const win=new BrowserWindow({show:false,width:1920,height:1080,webPreferences:{offscreen:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
 win.webContents.setAudioMuted(true);win.webContents.on('console-message',e=>{if(e.level==='error')report.errors.push(e.message);});
 await win.loadURL('rnr://game/rnr.html?lab=1&car=0');
 for(let i=0;i<300;i++){if(await win.webContents.executeJavaScript("typeof R!=='undefined'&&!!R&&BOOT.ready&&DiVANEngine.options.cameraAssetsReady()&&DiVANEngine.titleUI.assetsReady()"))break;if(i===299)throw Error('BOOT timeout');await delay(200);}
 await win.webContents.executeJavaScript(`requestAnimationFrame=()=>0;paused=true;labTest=false;
 window.paintCamera=()=>{updateView();g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,cv.width,cv.height);g.setTransform(viewS,0,0,viewS,viewOX,viewOY);DiVANEngine.screens.paint(state);};
 window.cameraMouse=(type,x,y,buttons=0)=>{const r=cv.getBoundingClientRect();cv.dispatchEvent(new MouseEvent(type,{clientX:r.left+(viewOX+x*viewS)*r.width/cv.width,clientY:r.top+(viewOY+y*viewS)*r.height/cv.height,button:0,buttons,bubbles:true}));};
 void 0;`);
 for(const [width,height] of [[1366,768],[1920,1080],[2560,1440],[3440,1440]]){
  win.setContentSize(width,height);await delay(150);
  await win.webContents.executeJavaScript('settings.graphics.resolution=0;applyResolution();void 0');
  const data=await win.webContents.executeJavaScript(`(()=>{
   enterCameraSetup('char');mx=0;my=0;setCameraZoom(1.35);paintCamera();
   const bar={...g._setHits.find(h=>h.act==='zoombar')},go={...g._setHits.find(h=>h.act==='camGo')};
   const shot=cv.toDataURL();cameraMouse('mousemove',bar.x+bar.w/2,bar.y+20);paintCamera();
   cameraMouse('mousedown',bar.x+1,bar.y+20,1);const min=raceZoom();cameraMouse('mousemove',bar.x+bar.w+20,bar.y+20,1);const max=raceZoom();cameraMouse('mouseup',bar.x+bar.w+20,bar.y+20);
   setCameraZoom(1.35);press('ArrowRight');const right=raceZoom();press('ArrowLeft');const left=raceZoom();
   cv.dispatchEvent(new WheelEvent('wheel',{deltaY:100,bubbles:true,cancelable:true}));const wheel=raceZoom();
   paintCamera();cameraMouse('mousemove',go.x+go.w/2,go.y+go.h/2);paintCamera();const hover=cv.toDataURL();
   cameraMouse('mousedown',go.x+go.w/2,go.y+go.h/2,1);const clicked=cameraSetupHint;cameraMouse('mouseup',go.x+go.w/2,go.y+go.h/2);paintCamera();const modalHits=g._setHits.map(h=>h.act);press('Enter');const next=state;
   enterCameraSetup('car');press('Enter');press('Enter');const car=state;
   enterCameraSetup('char');press('Escape');const escaped=state;
   return {width:cv.width,height:cv.height,bar,go,min,max,right,left,wheel,clicked,modalHits,next,car,escaped,shot,hover};
  })()`);
  assert.equal(data.width,width);assert.equal(data.height,height);
  assert.equal(data.min,1.25);assert.equal(data.max,2.2);assert.equal(data.right,1.4);assert.equal(data.left,1.35);assert.equal(data.wheel,1.3);assert(data.clicked);assert.deepEqual(data.modalHits,['camHint']);assert.equal(data.next,'char');assert.equal(data.car,'car');assert.equal(data.escaped,'title');
  for(const b of [data.bar,data.go])assert(b.x>=24&&b.x+b.w<=1280-24&&b.y>=0&&b.y+b.h<=720-24);
  for(const key of ['shot','hover']){fs.writeFileSync(path.join(output,`camera-${width}-${key}.png`),Buffer.from(data[key].split(',')[1],'base64'));delete data[key];}report.sizes.push(data);
 }
 assert.deepEqual(report.errors,[]);assert.equal(writes,0);report.assetWrites=writes;fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));app.exit(0);
}).catch(e=>{console.error(e.stack);app.exit(1);});
