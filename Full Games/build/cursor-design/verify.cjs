'use strict';
const {app,BrowserWindow}=require('electron');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const protocol=require('../../src/main/protocol');
protocol.registerPrivilegedScheme();
app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
  protocol.attachProtocol();
  const win=new BrowserWindow({show:false,webPreferences:{offscreen:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
  const cases=[
    ['game','rnr://game/rnr.html','#cv','#boot-screen'],
    ['site',pathToFileURL(path.resolve(__dirname,'../../../index.html')).href,'body','#age-yes']
  ];
  for(const [name,url,base,action] of cases){
    await win.loadURL(url);
    const result=await win.webContents.executeJavaScript(`new Promise(async(resolve,reject)=>{
      const source='assets/HUD/cursor/';
      const check=file=>new Promise((done,fail)=>{const img=new Image();img.onload=()=>done([img.naturalWidth,img.naturalHeight]);img.onerror=()=>fail(new Error(file+' не загрузился'));img.src=source+file;});
      try {const sizes=await Promise.all([check('cursor.png')]);
        const active=document.querySelector(${JSON.stringify(action)});
        if(active.id==='boot-screen')active.classList.add('is-gate');
        resolve({base:getComputedStyle(document.querySelector(${JSON.stringify(base)})).cursor,action:getComputedStyle(active).cursor,sizes});
      }catch(error){reject(error)}
    })`);
    if(!result.base.includes('cursor.png')||!result.action.includes('cursor.png')||result.sizes.some(([w,h])=>w!==42||h!==42)){
      throw new Error(name+': неверный курсор '+JSON.stringify(result));
    }
    console.log(name,JSON.stringify(result));
  }
  win.destroy();app.exit(0);
}).catch(error=>{console.error(error);app.exit(1);});
