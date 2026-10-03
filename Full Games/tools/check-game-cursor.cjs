'use strict';
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const output=path.resolve(__dirname,'../build/cursor-check');
fs.mkdirSync(output,{recursive:true});
app.setPath('userData',fs.mkdtempSync(path.join(output,'qa-profile-')));
app.disableHardwareAcceleration();
for(const file of ['save-car','save-track','save-chapter','save-texture','save-object']){
  const api=require('../src/main/'+file);
  for(const name of Object.keys(api))if(name.startsWith('handleSave'))api[name]=async()=>new Response('{"ok":true}',{headers:{'content-type':'application/json'}});
}
const protocol=require('../src/main/protocol');protocol.registerPrivilegedScheme();
const report={errors:[],screens:[]},wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(win,expression){
  for(let i=0;i<600;i++){if(await win.webContents.executeJavaScript(expression))return;await wait(100);}
  throw Error('Timed out: '+expression);
}
app.whenReady().then(async()=>{
  protocol.attachProtocol();
  const win=new BrowserWindow({show:false,width:1440,height:900,webPreferences:{offscreen:true,backgroundThrottling:false}});
  win.webContents.on('console-message',e=>{if(e.level==='error')report.errors.push(e.message);});
  for(const page of ['game','editor','launcher']){
    if(page==='launcher')await win.loadFile(path.resolve(__dirname,'../src/launcher/index.html'));
    else await win.loadURL(page==='game'?'rnr://game/rnr.html?lab=1&car=0':'rnr://game/Editor.html?tab=map');
    if(page==='game')await until(win,"typeof R!=='undefined'&&!!R&&BOOT.ready");
    if(page==='editor')await until(win,"typeof MapApp!=='undefined'&&MapApp.mapOn()&&!document.getElementById('lab-splash')");
    for(const [width,height] of [[1440,900],[800,600]]){
      win.setContentSize(width,height);await wait(200);
      const metrics=await win.webContents.executeJavaScript(`(async()=>{
        const controls=['body','canvas','a','button','input','textarea','select','summary'];
        const cursors=Object.fromEntries(controls.map(selector=>{
          const element=document.querySelector(selector)||document.body.appendChild(document.createElement(selector==='body'?'div':selector));
          return [selector,getComputedStyle(element).cursor];
        }));
        const button=document.querySelector('button');const wasDisabled=button.disabled;button.disabled=true;
        cursors.disabled=getComputedStyle(button).cursor;button.disabled=wasDisabled;
        const image=new Image();image.src=${JSON.stringify(page==='launcher'?'../engine/cursor-game.png':'/__engine/cursor-game.png')};await image.decode();
        const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
        const g=canvas.getContext('2d');g.drawImage(image,0,0);
        const pixels=g.getImageData(0,0,canvas.width,canvas.height).data;
        let transparent=0,glow=0;
        for(let i=0;i<pixels.length;i+=4){if(pixels[i+3]===0)transparent++;else if(pixels[i]>pixels[i+2]*2&&pixels[i+3]<180)glow++;}
        return {width:innerWidth,height:innerHeight,cursors,size:[image.width,image.height],transparent,glow};
      })()`);
      for(const cursor of Object.values(metrics.cursors))assert.match(cursor,/cursor-game\.png.*10 10, default$/);
      assert.deepEqual(metrics.size,[60,76]);assert(metrics.transparent>0&&metrics.glow>0);
      // Native cursors are omitted by offscreen capturePage; preview the identical PNG for visual QA.
      await win.webContents.executeJavaScript(`(()=>{
        document.getElementById('qa-cursor-preview')?.remove();
        const panel=document.createElement('div');panel.id='qa-cursor-preview';panel.style.cssText='position:fixed;right:24px;top:24px;z-index:2147483647;display:flex;gap:12px;padding:12px;background:#151a20;border:1px solid #888;pointer-events:none';
        for(const color of ['#101318','#e9e9df','#915c32']){
          const swatch=document.createElement('div');swatch.style.cssText='width:88px;height:88px;display:grid;place-items:center;background:'+color;
          const image=new Image();image.src=${JSON.stringify(page==='launcher'?'../engine/cursor-game.png':'/__engine/cursor-game.png')};swatch.append(image);panel.append(swatch);
        }document.body.append(panel);
      })()`);
      await wait(100);
      fs.writeFileSync(path.join(output,page+'-'+width+'.png'),(await win.webContents.capturePage()).toPNG());
      win.webContents.sendInputEvent({type:'mouseMove',x:100,y:100});
      if(page==='editor'){
        const interaction=await win.webContents.executeJavaScript(`(()=>{
          document.querySelector('[data-tab=car]').click();const car=!!document.getElementById('statName');
          document.querySelector('[data-tab=map]').click();return car&&MapApp.mapOn();
        })()`);assert(interaction,'Editor tabs stopped responding');
      }
      if(page==='game'){
        const states=await win.webContents.executeJavaScript(`(()=>{
          const result=[];for(const pause of [false,true]){state='race';paused=pause;DiVANEngine.screens.paint('race');result.push(getComputedStyle(cv).cursor);}
          return result;
        })()`);
        for(const cursor of states)assert.match(cursor,/cursor-game\.png/);
      }
      report.screens.push({page,...metrics});
    }
  }
  assert.deepEqual(report.errors,[]);
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));win.destroy();app.exit(0);
}).catch(error=>{console.error(error);console.error(JSON.stringify(report));app.exit(1);});
