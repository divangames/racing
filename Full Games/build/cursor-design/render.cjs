'use strict';
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const root=__dirname;
app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
  const win=new BrowserWindow({show:false,webPreferences:{offscreen:true}});
  await win.loadURL('data:text/html,<html><body></body></html>');
  for(const name of ['default','action']){
    const svg=fs.readFileSync(path.join(root,name+'.svg'));
    const source='data:image/svg+xml;base64,'+svg.toString('base64');
    const png=await win.webContents.executeJavaScript(`new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=32;canvas.getContext('2d').drawImage(image,0,0);resolve(canvas.toDataURL('image/png').split(',')[1]);};image.onerror=()=>reject(new Error('SVG не открылся'));image.src=${JSON.stringify(source)};})`);
    fs.writeFileSync(path.join(root,name+'.png'),Buffer.from(png,'base64'));
  }
  win.destroy();app.exit(0);
}).catch(error=>{console.error(error);app.exit(1);});
