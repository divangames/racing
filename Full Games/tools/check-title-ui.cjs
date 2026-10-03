'use strict';
// Main and free menus: real Electron input and isolated saves at all requested resolutions.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const output=path.resolve(__dirname,'../build/title-ui-check');fs.mkdirSync(output,{recursive:true});
app.setPath('userData',fs.mkdtempSync(path.join(output,'profile-')));app.disableHardwareAcceleration();
app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');
let assetWrites=0;
for(const file of ['save-car','save-track','save-chapter','save-texture','save-object']){
  const api=require('../src/main/'+file);
  for(const name of Object.keys(api))if(name.startsWith('handleSave'))api[name]=async()=>{
    assetWrites++;return new Response('{"ok":true}',{headers:{'content-type':'application/json'}});
  };
}
const protocol=require('../src/main/protocol');protocol.registerPrivilegedScheme();
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),report={errors:[],screens:[],actions:[]};
const ids=['campaign-new','load-game','free-menu','settings','developers','exit'];
const savedOnly=process.argv.includes('--saved-only');
async function until(win,expr){for(let i=0;i<600;i++){if(await win.webContents.executeJavaScript(expr))return;await wait(100);}throw Error('Timeout: '+expr);}
app.whenReady().then(async()=>{
  protocol.attachProtocol();const win=new BrowserWindow({show:false,width:1366,height:768,webPreferences:{offscreen:true,backgroundThrottling:false}});
  win.webContents.setAudioMuted(true);
  win.webContents.on('console-message',event=>{if(event.level==='error')report.errors.push(event.message);});
  await win.loadURL('rnr://game/rnr.html?lab=1&car=0');
  await until(win,"typeof R!=='undefined'&&!!R&&BOOT.ready&&!!DiVANEngine.titleUI");
  await until(win,'DiVANEngine.titleUI.assetsReady()');
  await win.webContents.executeJavaScript(`requestAnimationFrame=()=>0;paused=true;labTest=false;
    settings.graphics.resolution=0;audioInit();
    window.__titleActions=[];const action=DiVANEngine.titleMenu.applyTitleAction;
    DiVANEngine.titleMenu.applyTitleAction=function(id,peek){__titleActions.push(id);return action(id,peek);};
    window.__menuPaint=()=>{updateView();g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,cv.width,cv.height);
      g.setTransform(viewS,0,0,viewS,viewOX,viewOY);DiVANEngine.screens.paint(state);};
    window.__titleReset=()=>{persistDrop(SKEY);persistDrop(STORY_SKEY);save=null;closeExitWarn();
      enterTitle();selTitle=0;__titleActions.length=0;__menuPaint();gt+=1;__menuPaint();};
    window.__titlePoint=index=>{const b=DiVANEngine.menu.regions().find(b=>b.id==='title-'+index),r=cv.getBoundingClientRect();
      return {x:Math.round(r.left+(b.x+b.w/2)*r.width/cv.width),y:Math.round(r.top+(b.y+b.h/2)*r.height/cv.height)};};void 0;`);
  await until(win,"titleLogo&&titleLogo.complete&&titleLogo.naturalWidth>0");
  await win.webContents.executeJavaScript("document.fonts.load('16px Bender','Главное меню')");
  async function paint(){await win.webContents.executeJavaScript('__menuPaint();void 0');}
  async function key(name){win.webContents.sendInputEvent({type:'keyDown',keyCode:name});win.webContents.sendInputEvent({type:'keyUp',keyCode:name});await wait(30);await paint();}
  async function pointer(index,type='mouseMove'){
    const p=await win.webContents.executeJavaScript('__titlePoint('+index+')');
    win.webContents.sendInputEvent({type,...p,...(type==='mouseMove'?{}:{button:'left',clickCount:1})});await wait(30);await paint();return p;
  }
  async function capture(name){
    const image=await win.webContents.executeJavaScript("cv.toDataURL('image/png').split(',')[1]");
    fs.writeFileSync(path.join(output,name+'.png'),Buffer.from(image,'base64'));
  }
  for(const [width,height] of [[1366,768],[1920,1080],[2560,1440],[3440,1440]]){
    if(savedOnly)continue;
    win.setContentSize(width,height);await wait(150);
    await win.webContents.executeJavaScript('applyResolution();__titleReset();void 0');
    const layout=await win.webContents.executeJavaScript(`(()=>{
      const ui=DiVANEngine.titleUI.layout(),matrix=g.getTransform();
      const physical=b=>({x:b.x*viewS+viewOX,y:b.y*viewS+viewOY,w:b.w*viewS,h:b.h*viewS});
      return {width:cv.width,height:cv.height,ids:g._titleItems.map(i=>i.id),labels:g._titleItems.map(i=>i.label),
        states:ui.states,assetsReady:ui.assetsReady,status:ui.status,
        boxes:[physical(ui.shell),physical(ui.footer),...DiVANEngine.menu.regions().map(({x,y,w,h})=>({x,y,w,h}))],
        components:['MenuShell','MenuItem','MenuIndex','MenuHint','FooterStatus'].every(name=>typeof DiVANEngine.titleUI[name]==='function'),
        tokens:DiVANEngine.titleUI.tokens(),accessible:document.querySelectorAll('.title-menu-accessibility [role=menuitem]').length};
    })()`);
    assert.equal(layout.width,width);assert.equal(layout.height,height);assert.deepEqual(layout.ids,ids);
    assert(layout.components&&layout.accessible===6);
    assert(layout.assetsReady);assert.equal(layout.status.profile,'НЕТ СОХРАНЕНИЯ');
    assert.equal(layout.status.car,'НЕ ВЫБРАНА');assert.equal(layout.status.driver,'НЕ ВЫБРАН');
    assert(layout.boxes[2].h>layout.boxes[3].h,'Selected row must be taller');
    assert(layout.boxes[0].w<=width*.38,'UI must stay within reference left column');
    for(const box of layout.boxes)assert(box.x>=12&&box.y>=12&&box.x+box.w<=width-12&&box.y+box.h<=height-12,'Menu outside safe area');
    assert(layout.states.every(state=>state==='default'));report.screens.push(layout);
    await capture('default-'+width);
    for(let i=0;i<6;i++){
      await pointer(i);
      const hover=await win.webContents.executeJavaScript('({index:selTitle,state:DiVANEngine.titleUI.layout().states[selTitle]})');
      assert.equal(hover.index,i);assert.equal(hover.state,'hover');
    }
    await capture('hover-'+width);
    await win.webContents.executeJavaScript('__titleReset();void 0');
    for(let i=1;i<=6;i++){
      await key('Down');const focus=await win.webContents.executeJavaScript('({index:selTitle,state:DiVANEngine.titleUI.layout().states[selTitle]})');
      assert.equal(focus.index,i%6);assert.equal(focus.state,'keyboard-focus');
    }
    await key('Up');assert.equal(await win.webContents.executeJavaScript('selTitle'),5);
    await capture('keyboard-focus-'+width);
    await key('Escape');assert(await win.webContents.executeJavaScript('exitWarn'));await key('Escape');
    assert(!await win.webContents.executeJavaScript('exitWarn'));
    // Both input methods reach the same existing action exactly once for every item.
    for(const method of ['keyboard','mouse'])for(let index=0;index<6;index++){
      await win.webContents.executeJavaScript('__titleReset();void 0');
      if(method==='keyboard'){for(let n=0;n<index;n++)await key('Down');await key('Return');}
      else{
        await pointer(index);await pointer(index,'mouseDown');
        assert.equal(await win.webContents.executeJavaScript('DiVANEngine.titleUI.layout().states[selTitle]'),'pressed');
        if(index===2)await capture('pressed-'+width);
        await pointer(index,'mouseUp');
      }
      const result=await win.webContents.executeJavaScript('({calls:__titleActions.slice(),state,free:DiVANEngine.titleMenu.isFreeMenu(),exit:exitWarn})');
      assert.deepEqual(result.calls,[ids[index]]);
      if(index===0)assert.notEqual(result.state,'title');
      if(index===1)assert.equal(result.state,'slotSelect');
      if(index===2)assert(result.free);
      if(index===3)assert.equal(result.state,'settings');
      if(index===4)assert.equal(result.state,'developers');
      if(index===5)assert(result.exit);
      report.actions.push({width,method,index,...result});
    }
    await win.webContents.executeJavaScript(`__titleReset();window.__originalTitleItems=DiVANEngine.titleMenu.titleItems;
      DiVANEngine.titleMenu.titleItems=(...args)=>__originalTitleItems(...args).map((item,i)=>({...item,disabled:i===1}));__menuPaint();void 0;`);
    await pointer(1);await pointer(1,'mouseDown');await pointer(1,'mouseUp');
    assert.deepEqual(await win.webContents.executeJavaScript('__titleActions.slice()'),[]);
    assert.equal(await win.webContents.executeJavaScript('DiVANEngine.titleUI.layout().states[1]'),'disabled');
    await capture('disabled-'+width);await key('Down');
    assert.equal(await win.webContents.executeJavaScript('selTitle'),2);
    await win.webContents.executeJavaScript('DiVANEngine.titleMenu.titleItems=__originalTitleItems;__titleReset();void 0');
    await pointer(3);await pointer(3,'mouseDown');
    win.webContents.sendInputEvent({type:'mouseUp',x:width-10,y:height-10,button:'left',clickCount:1});await wait(30);await paint();
    assert.deepEqual(await win.webContents.executeJavaScript('__titleActions.slice()'),[],'Release outside must cancel the click');
    await win.webContents.executeJavaScript('__titleReset();void 0');
    // The screen-reader menu shares the game's capture listener; one key must move one row.
    await win.webContents.executeJavaScript("document.querySelector('.title-menu-accessibility button').focus();void 0");
    await key('Down');assert.equal(await win.webContents.executeJavaScript('selTitle'),1);
    await win.webContents.executeJavaScript('cv.focus();void 0');
    // Gaps use the component geometry, never the legacy uniform row positions.
    await win.webContents.executeJavaScript(`(()=>{__titleReset();const boxes=DiVANEngine.titleUI.layout().boxes;
      hubClick(boxes[0].x+100,boxes[0].y+boxes[0].h+2);})()`);
    assert.deepEqual(await win.webContents.executeJavaScript('__titleActions.slice()'),[]);
    // Existing campaign state supplies the continue label and truthful driver/car status.
    await win.webContents.executeJavaScript(`(()=>{__titleReset();const fixture=newSave();fixture.storyCampaign='medved_v1';
      fixture.playMode='campaign';fixture.char=0;persistWrite(STORY_SKEY,JSON.stringify(fixture));selTitle=2;__menuPaint();})()`);
    const savedMain=await win.webContents.executeJavaScript(`({label:g._titleItems[0].label,status:DiVANEngine.titleUI.layout().status,
      car:CARS[persistPeekSave(STORY_SKEY).car].name,driver:CHARS[0].short})`);
    assert.equal(savedMain.label,'ПРОДОЛЖИТЬ ИГРУ');assert.equal(savedMain.status.profile,'КАМПАНИЯ');
    assert.equal(savedMain.status.car,savedMain.car);assert.equal(savedMain.status.driver,savedMain.driver);
    await capture('concept-'+width);
  }
  await win.webContents.executeJavaScript(`window.__freeReset=saved=>{
    __titleReset();if(saved){save=newSave();save.race=2;save.playMode='free';persist();}
    DiVANEngine.titleMenu.openFreeMenu();__menuPaint();gt+=1;__menuPaint();
  };void 0;`);
  for(const [width,height] of [[1366,768],[1920,1080],[2560,1440],[3440,1440]])for(const saved of [false,true]){
    if(savedOnly)continue;
    const freeIds=saved?['free-new','free-continue','free-location','free-back']:['free-new','free-location','free-back'];
    const suffix=(saved?'saved-':'fresh-')+width;
    win.setContentSize(width,height);await wait(150);
    async function resetFree(){await win.webContents.executeJavaScript('applyResolution();__freeReset('+saved+');void 0');}
    await resetFree();await wait(400);
    await win.webContents.executeJavaScript('gt+=1;__menuPaint();void 0');
    const layout=await win.webContents.executeJavaScript(`(()=>{
      const ui=DiVANEngine.titleUI.layout(),physical=b=>({x:b.x*viewS+viewOX,y:b.y*viewS+viewOY,w:b.w*viewS,h:b.h*viewS});
      return {page:'free',saved:${saved},width:cv.width,height:cv.height,ids:g._titleItems.map(i=>i.id),caption:ui.caption,count:ui.count,
        accessible:document.querySelector('.title-menu-accessibility').getAttribute('aria-label'),
        plate:DiVANEngine.titleBg.pickTitleBgSrc(cv.width/cv.height),
        boxes:[physical(ui.shell),physical(ui.footer),...DiVANEngine.menu.regions().map(({x,y,w,h})=>({x,y,w,h}))]};
    })()`);
    assert.deepEqual(layout.ids,freeIds);assert.equal(layout.caption,'СВОБОДНЫЙ ЗАЕЗД');assert.equal(layout.count,freeIds.length);
    assert.equal(layout.accessible,layout.caption);assert.match(layout.plate,/bestya/);
    for(const box of layout.boxes)assert(box.x>=12&&box.y>=12&&box.x+box.w<=width-12&&box.y+box.h<=height-12);
    report.screens.push(layout);await capture('free-default-'+suffix);
    for(let index=0;index<freeIds.length;index++){
      await pointer(index);assert.equal(await win.webContents.executeJavaScript('selTitle'),index);
      assert.equal(await win.webContents.executeJavaScript('DiVANEngine.titleUI.layout().states[selTitle]'),'hover');
    }
    await resetFree();for(let index=1;index<=freeIds.length;index++){
      await key('Down');assert.equal(await win.webContents.executeJavaScript('selTitle'),index%freeIds.length);
      assert.equal(await win.webContents.executeJavaScript('DiVANEngine.titleUI.layout().states[selTitle]'),'keyboard-focus');
    }
    await key('Up');assert.equal(await win.webContents.executeJavaScript('selTitle'),freeIds.length-1);
    await capture('free-focus-'+suffix);await key('Escape');
    assert(await win.webContents.executeJavaScript("state==='title'&&!DiVANEngine.titleMenu.isFreeMenu()&&!exitWarn"));
    for(const method of ['keyboard','mouse'])for(let index=0;index<freeIds.length;index++){
      await resetFree();
      if(method==='keyboard'){for(let n=0;n<index;n++)await key('Down');await key('Return');}
      else{await pointer(index);await pointer(index,'mouseDown');
        assert.equal(await win.webContents.executeJavaScript('DiVANEngine.titleUI.layout().states[selTitle]'),'pressed');
        await pointer(index,'mouseUp');}
      const result=await win.webContents.executeJavaScript('({calls:__titleActions.slice(),state,free:DiVANEngine.titleMenu.isFreeMenu(),confirm:!!window.titleConfirm,returnTo:trackPickReturn})');
      assert.deepEqual(result.calls,[freeIds[index]]);
      if(freeIds[index]==='free-new'){if(saved)assert(result.confirm);else assert.equal(result.state,'cameraSetup');}
      if(freeIds[index]==='free-continue')assert.equal(result.state,'garage');
      if(freeIds[index]==='free-location'){assert.equal(result.state,'tracks');assert.equal(result.returnTo,'free');
        await key('Escape');assert(await win.webContents.executeJavaScript("state==='title'&&DiVANEngine.titleMenu.isFreeMenu()"));}
      if(freeIds[index]==='free-back')assert(result.state==='title'&&!result.free);
      report.actions.push({page:'free',width,saved,method,index,...result});
    }
    if(saved){
      await resetFree();await key('Down');
      const description=await win.webContents.executeJavaScript(`(()=>{
        const lines=[],original=g.fillText;g.fillText=function(value,...args){lines.push(String(value));return original.call(this,value,...args);};
        try{__menuPaint();}finally{g.fillText=original;}return lines;
      })()`);
      assert(description.some(line=>line.includes('этап 3')),'Saved race stage hint disappeared');
      await capture('free-continue-'+suffix);
    }
  }
  // The saved campaign has a distinct first action; test it through both input routes.
  for(const [width,height] of [[1366,768],[1920,1080],[2560,1440],[3440,1440]]){
    win.setContentSize(width,height);await wait(150);
    for(const method of ['keyboard','mouse']){
      await win.webContents.executeJavaScript(`(()=>{applyResolution();__titleReset();const fixture=newSave();
        fixture.storyCampaign='medved_v1';fixture.playMode='campaign';fixture.char=0;
        persistWrite(STORY_SKEY,JSON.stringify(fixture));selTitle=0;__menuPaint();})()`);
      assert.equal(await win.webContents.executeJavaScript('g._titleItems[0].label'),'ПРОДОЛЖИТЬ ИГРУ');
      if(method==='keyboard')await key('Return');
      else{await pointer(0);await pointer(0,'mouseDown');await pointer(0,'mouseUp');}
      const result=await win.webContents.executeJavaScript('({calls:__titleActions.slice(),state,mode:save.playMode})');
      assert.deepEqual(result.calls,['campaign-continue']);assert.notEqual(result.state,'title');
      assert.equal(result.mode,'campaign');report.actions.push({page:'saved-campaign',width,method,...result});
    }
  }
  assert.equal(assetWrites,0);assert.deepEqual(report.errors,[]);
  fs.writeFileSync(path.join(output,savedOnly?'saved-result.json':'result.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({screens:report.screens.length,actions:report.actions.length,assetWrites,errors:report.errors}));
  win.destroy();app.exit(0);
}).catch(error=>{console.error(error);console.error(JSON.stringify({errors:report.errors,last:report.actions.at(-1)}));app.exit(1);});
