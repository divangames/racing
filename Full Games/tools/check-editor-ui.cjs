'use strict';
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const output = path.resolve(__dirname, '../build/editor-ui-check');
fs.mkdirSync(output, { recursive: true });
app.setPath('userData', fs.mkdtempSync(path.join(output, 'profile-')));
app.disableHardwareAcceleration();
for (const [file, method] of [['save-car','handleSaveCar'],['save-track','handleSaveTrack'],['save-chapter','handleSaveChapter']]) {
  require('../src/main/' + file)[method] = async () => new Response('{"ok":true}', { headers: { 'content-type': 'application/json' } });
}
const protocol = require('../src/main/protocol'); protocol.registerPrivilegedScheme();
const report = { errors: [], screens: [] };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async () => {
  protocol.attachProtocol();
  const win = new BrowserWindow({show:false,width:1440,height:900,webPreferences:{offscreen:true,backgroundThrottling:false}});
  win.webContents.on('console-message', event => { if(event.level==='error')report.errors.push(event.message); });
  await win.loadURL('rnr://game/Editor.html');
  for(let i=0;i<300;i++) {
    if(await win.webContents.executeJavaScript("!!document.querySelector('.car-inspector-head')&&typeof MapApp!=='undefined'&&!!MapApp.getDocument()"))break;
    await wait(100);
  }
  await win.webContents.executeJavaScript('document.fonts.ready');
  for(const [width,height] of [[1440,900],[1024,768],[800,600],[640,720]]) {
    win.setContentSize(width,height);await wait(120);
    for(const tab of ['car','map','chapter']) {
      await win.webContents.executeJavaScript(`document.querySelector('[data-tab="${tab}"]').click();void 0`);
      await wait(250);
      for(let i=0;i<150;i++) {if(await win.webContents.executeJavaScript("!document.querySelector('.lab-busy.is-on')"))break;await wait(100);}
      await wait(200);
      await win.webContents.executeJavaScript("document.fonts.load('14px Bender','Разработчики')");
      const metrics=await win.webContents.executeJavaScript(`(()=>{
        const visible=el=>!!el.getClientRects().length;
        const clipped=[...document.querySelectorAll('button,input,select,textarea')].filter(visible).filter(el=>{
          const r=el.getBoundingClientRect();return r.left< -1||r.right>innerWidth+1;
        }).map(el=>({id:el.id,text:el.textContent.slice(0,60)}));
        const unlabeled=[...document.querySelectorAll('input:not([type=hidden]),select,textarea')].filter(visible).filter(el=>
          !el.labels?.length&&!el.getAttribute('aria-label')&&!el.getAttribute('aria-labelledby')&&!el.title).map(el=>el.outerHTML.slice(0,160));
        return {width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth+1,
          font:getComputedStyle(document.body).fontFamily,clipped,unlabeled};
      })()`);
      report.screens.push({tab,...metrics});
      fs.writeFileSync(path.join(output,tab+'-'+width+'.png'),(await win.webContents.capturePage()).toPNG());
    }
  }
  report.keyboard=await win.webContents.executeJavaScript(`(()=>{
    const tabs=[...document.querySelectorAll('.app-tabs [role=tab]')];tabs[0].click();tabs[0].focus();
    tabs[0].dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
    return {selected:tabs.find(t=>t.getAttribute('aria-selected')==='true')?.dataset.tab,focused:document.activeElement.dataset.tab};
  })()`);
  win.setContentSize(1440,900);
  report.typing=await win.webContents.executeJavaScript(`(()=>{
    document.querySelector('[data-tab=car]').click();const input=document.getElementById('statName');input.focus();
    const event=new KeyboardEvent('keydown',{key:'z',code:'KeyZ',ctrlKey:true,bubbles:true,cancelable:true});input.dispatchEvent(event);
    return {nativeUndo:!event.defaultPrevented};
  })()`);
  report.sections=await win.webContents.executeJavaScript(`(()=>{
    const seen=[];
    document.querySelector('[data-tab=car]').click();
    for(const button of document.querySelectorAll('.car-inspector-nav button')) {button.click();seen.push(button.textContent);}
    document.querySelector('[data-tab=map]').click();
    for(const button of document.querySelectorAll('.map-inspector-nav button')) {button.click();seen.push(button.textContent);}
    document.querySelector('[data-tab=chapter]').click();
    const points=[...document.querySelectorAll('#chapterPoints button')].length;
    for(let i=0;i<points;i++){document.querySelectorAll('#chapterPoints button')[i].click();seen.push('Точка главы '+(i+1));}
    for(let i=0;i<document.querySelectorAll('.chapter-scene-tabs button').length;i++){
      document.querySelectorAll('.chapter-scene-tabs button')[i].click();seen.push(document.querySelectorAll('.chapter-scene-tabs button')[i].textContent);
    }
    const first=document.querySelector('.chapter-scene-tabs button');first.click();
    document.querySelector('.chapter-scene-tabs button').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
    const sceneKey=document.activeElement===document.querySelectorAll('.chapter-scene-tabs button')[1];
    return {seen,sceneKey};
  })()`);
  report.dialog=await win.webContents.executeJavaScript(`(async()=>{
    document.querySelector('[data-tab=map]').click();const opener=document.getElementById('assetSearch');opener.focus();
    MapAssetEdit.open({id:'qa-only',name:'Объект QA',pack:'stock',src:'assets/data/cats/Titles/cast/01.png',w:100,h:100},{save:async()=>{},remove:async()=>{}});
    await new Promise(r=>setTimeout(r,0));const box=document.getElementById('assetEdit');
    const focused=box.contains(document.activeElement);
    document.getElementById('assetEditName').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    await new Promise(r=>setTimeout(r,0));return {focused,closed:box.hidden,restored:document.activeElement===opener};
  })()`);
  report.saving=await win.webContents.executeJavaScript(`(async()=>{
    document.querySelector('[data-tab=chapter]').click();
    const previous=ChapterData.save;let release,calls=0;
    ChapterData.save=()=>{calls++;return new Promise(r=>release=r);};
    const first=ChapterEditor.save();await ChapterEditor.save();
    const busy=document.getElementById('chapterSaveBtn').disabled;
    const field=document.getElementById('chapterTitle');field.value='Правки во время записи';field.dispatchEvent(new Event('input',{bubbles:true}));
    release({ok:true});await first;
    const pending=document.getElementById('chapterStatus').textContent.includes('несохран');
    ChapterData.save=async()=>{throw Error('QA: запись недоступна');};await ChapterEditor.save();
    const failed=document.getElementById('chapterStatus').classList.contains('is-error');
    ChapterData.save=previous;
    document.querySelector('[data-tab=map]').click();
    MapAssetEdit.open({id:'qa-only',name:'Объект QA',pack:'stock',src:'assets/data/cats/Titles/cast/01.png',w:100,h:100},{save:async()=>{throw Error('QA');}});
    document.getElementById('assetEditSave').click();await new Promise(r=>setTimeout(r,20));
    const objectFailed=!document.getElementById('assetEdit').hidden&&document.getElementById('assetEditStatus').textContent.includes('Не удалось');
    const retry=!document.getElementById('assetEditSave').disabled;MapAssetEdit.close();
    let finish;
    MapAssetEdit.open({id:'qa-only',name:'Объект QA',pack:'stock',src:'assets/data/cats/Titles/cast/01.png',w:100,h:100},{save:()=>new Promise(r=>finish=r)});
    document.getElementById('assetEditSave').click();document.getElementById('assetEditName').value='Новое имя во время записи';
    finish();await new Promise(r=>setTimeout(r,20));
    const objectPending=!document.getElementById('assetEdit').hidden;
    MapAssetEdit.close();return {calls,busy,pending,failed,objectFailed,retry,objectPending};
  })()`);
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  assert.deepEqual(report.errors,[]);
  if(!process.argv.includes('--audit')) {
    for(const s of report.screens){assert(!s.overflow, s.tab+' '+s.width+' overflow');assert(!s.clipped.length,JSON.stringify(s));assert(!s.unlabeled.length,JSON.stringify(s));assert(s.font.startsWith('Bender'));}
    assert.equal(report.keyboard.selected,'map');assert.equal(report.keyboard.focused,'map');
    assert(report.typing.nativeUndo);assert(report.dialog.focused&&report.dialog.closed&&report.dialog.restored);
    assert(report.sections.sceneKey);assert(report.sections.seen.length>15);
    assert.equal(report.saving.calls,1);assert(report.saving.busy&&report.saving.pending&&report.saving.failed&&report.saving.objectFailed&&report.saving.retry&&report.saving.objectPending);
  }
  win.destroy(); app.exit(0);
}).catch(error=>{fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({...report,error:error.stack},null,2));console.error(error);app.exit(1);});
