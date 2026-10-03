'use strict';
// Prepare the native cursor once; no moving DOM overlay or per-frame work.
const {app,BrowserWindow} = require('electron');
const fs=require('node:fs'),path=require('node:path');
const output=path.resolve(__dirname,'../build/cursor-check');
fs.mkdirSync(output,{recursive:true});
app.setPath('userData',fs.mkdtempSync(path.join(output,'bake-profile-')));
app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
  const win=new BrowserWindow({show:false,webPreferences:{offscreen:true}});
  await win.loadURL('data:text/html,<html><body></body></html>');
  const source=fs.readFileSync(path.resolve(__dirname,'../content/assets/HUD/cursor/cursor_games.png')).toString('base64');
  const result=await win.webContents.executeJavaScript(`(async()=>{
    const image=new Image();image.src='data:image/png;base64,${source}';await image.decode();
    const scan=document.createElement('canvas');scan.width=image.width;scan.height=image.height;
    const q=scan.getContext('2d');q.drawImage(image,0,0);
    const pixels=q.getImageData(0,0,image.width,image.height).data;
    let x0=image.width,y0=image.height,x1=0,y1=0;
    for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++)if(pixels[(y*image.width+x)*4+3]>16){
      x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);
    }
    const h=56,w=Math.round((x1-x0+1)/(y1-y0+1)*h),padding=10;
    const canvas=document.createElement('canvas');canvas.width=w+padding*2;canvas.height=h+padding*2;
    const g=canvas.getContext('2d');g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
    g.shadowColor='rgba(255,145,20,1)';g.shadowBlur=10;
    g.drawImage(image,x0,y0,x1-x0+1,y1-y0+1,padding,padding,w,h);
    g.shadowColor='rgba(255,211,65,1)';g.shadowBlur=4;
    g.drawImage(image,x0,y0,x1-x0+1,y1-y0+1,padding,padding,w,h);
    return {png:canvas.toDataURL('image/png').split(',')[1],source:[image.width,image.height],crop:[x0,y0,x1,y1],size:[canvas.width,canvas.height],visible:[w,h],hotspot:[padding,padding]};
  })()`);
  fs.writeFileSync(path.resolve(__dirname,'../src/engine/cursor-game.png'),Buffer.from(result.png,'base64'));
  delete result.png;fs.writeFileSync(path.join(output,'asset.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));win.destroy();app.exit(0);
}).catch(error=>{console.error(error);app.exit(1);});
