// Title-menu presentation only. Existing title actions, backgrounds and hotkeys remain authoritative.
(function (global) {
  'use strict';
  const E = global.DiVANEngine;
  if (!E) return;
  const defaults = {bg:'#0d1418',panel:'#172025',panelInset:'#11181d',panelActive:'#30383c',panelActiveMid:'#242c30',panelActiveEnd:'#1d2529',line:'#45545b',cyan:'#91adb8',amber:'#efb342',
    danger:'#e87565',text:'#edf2ef',muted:'#a6b2b8',space1:4,space2:8,space3:12,space4:20,glow:8};
  let tokens = {...defaults}, modality = 'default', hoverIndex = -1, pressedIndex = -1, pressedUntil = 0;
  let accessibleMenu = null, signature = '', lastLayout = null, mousePress = -1, pageKey = '';
  const hints = {'campaign-new':'НОВАЯ ИСТОРИЯ В ПЫЛЬНОМ ОВАЛЕ', 'campaign-continue':'ВЕРНУТЬСЯ В ПОСЛЕДНИЙ ЗАЕЗД',
    'load-game':'ВЫБОР СОХРАНЕНИЯ', 'free-menu':'ВЫБОР ТРАССЫ И УСЛОВИЙ ГОНКИ',
    settings:'ПАРАМЕТРЫ ИГРЫ И УПРАВЛЕНИЕ', developers:'КОМАНДА DIVAN GAMES', exit:'ЗАВЕРШИТЬ ИГРУ',
    'free-new':'НОВЫЙ ГОНЩИК И НОВЫЙ ЗАЕЗД', 'free-continue':'ВЕРНУТЬСЯ В ГАРАЖ',
    'free-location':'ВЫБРАТЬ ТРАССУ ДЛЯ СВОБОДНОГО ЗАЕЗДА', 'free-back':'ВЕРНУТЬСЯ В ГЛАВНОЕ МЕНЮ'};
  const clock = () => typeof performance !== 'undefined' ? performance.now() : 0;
  const active = () => typeof state !== 'undefined' && state === 'title';
  const modal = () => global.titleConfirm || (typeof exitWarn !== 'undefined' && exitWarn) ||
    (typeof labWarn !== 'undefined' && labWarn) || (typeof CLIENT_NOTICE !== 'undefined' && CLIENT_NOTICE.open);
  const assets = {};
  if(typeof Image!=='undefined')for(const [key,file] of Object.entries({plates:'race-control-atlas.png',icons:'race-control-icons.png',status:'race-control-status.png'})){
    const image=new Image();image.src='/__engine/title-ui-assets/'+file;assets[key]=image;
  }
  const assetsReady=()=>['plates','icons','status'].every(key=>assets[key]?.complete&&assets[key].naturalWidth>0);
  // Source bands are reusable blank surfaces. All typography stays live and localized.
  function plate(c,box,band){
    const image=assets.plates;if(!image?.complete||!image.naturalWidth)return;
    const h=image.naturalHeight/3;
    // Use only blank metal: reference geometry is assembled independently, without
    // stretching the atlas's large bevels, dividers or baked arrow bays.
    c.save();c.globalAlpha*=band===1?.42:.24;
    c.drawImage(image,image.naturalWidth*.28,band*h+h*.12,image.naturalWidth*.56,h*.74,box.x,box.y,box.w,box.h);c.restore();
  }
  const tintedIcons=new Map();
  function sprite(c,image,index,columns,rows,box,color){
    if(!image?.complete||!image.naturalWidth)return;
    const sw=image.naturalWidth/columns,sh=image.naturalHeight/rows;
    if(color&&typeof document!=='undefined'){
      const key=image.src+'|'+index+'|'+color;
      let stamp=tintedIcons.get(key);
      if(!stamp){stamp=document.createElement('canvas');stamp.width=128;stamp.height=128;
        const ctx=stamp.getContext('2d');ctx.drawImage(image,(index%columns)*sw,Math.floor(index/columns)*sh,sw,sh,0,0,128,128);
        ctx.globalCompositeOperation='source-in';ctx.fillStyle=color;ctx.fillRect(0,0,128,128);tintedIcons.set(key,stamp);}
      c.drawImage(stamp,box.x,box.y,box.w,box.h);
    }else c.drawImage(image,(index%columns)*sw,Math.floor(index/columns)*sh,sw,sh,box.x,box.y,box.w,box.h);
  }
  function icon(c,box,id,lit){
    const index={'campaign-new':0,'campaign-continue':0,'load-game':1,'free-menu':2,settings:3,developers:4,exit:5,
      'free-new':2,'free-continue':0,'free-location':2,'free-back':5}[id]??0;
    const image=assets.icons;if(!image?.complete||!image.naturalWidth)return;
    const size=lit?45:37,cx=lit?box.x+90:box.x+72;
    c.save();c.globalAlpha*=lit?1:.9;
    const flag=lit&&index===2;
    if(flag){c.translate(cx,box.y+box.h/2);c.rotate(.22);}
    sprite(c,image,index,3,2,{x:flag?-size/2:cx-size/2,y:flag?-size/2:box.y+(box.h-size)/2,w:size,h:size},id==='exit'?tokens.danger:lit?tokens.amber:tokens.muted);c.restore();
  }
  function refreshTokens() {
    if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return;
    const css = getComputedStyle(document.documentElement);
    for (const key of ['bg','panel','line','cyan','amber','danger','text','muted']) tokens[key]=css.getPropertyValue('--ui-'+key).trim()||defaults[key];
    for (const [key,name] of Object.entries({panelInset:'panel-inset',panelActive:'panel-active',panelActiveMid:'panel-active-mid',panelActiveEnd:'panel-active-end'})) {
      tokens[key]=css.getPropertyValue('--ui-'+name).trim()||defaults[key];
    }
    for (const [key,name] of Object.entries({space1:'space-1',space2:'space-2',space3:'space-3',space4:'space-4',glow:'glow'})) {
      tokens[key]=parseFloat(css.getPropertyValue('--ui-'+name))||defaults[key];
    }
  }
  function text(c,value,x,y,size,color,width,heavy=false,align='left') {
    c.save();c.shadowBlur=0;c.font=(heavy?'700 ':'400 ')+size+'px "Bender", sans-serif';
    c.textAlign=align;c.textBaseline='middle';c.fillStyle=color;
    if(width>0)c.fillText(String(value),x,y,width);else c.fillText(String(value),x,y);c.restore();
  }
  function shape(c,x,y,w,h,cut=6) {
    c.beginPath();c.moveTo(x+cut,y);c.lineTo(x+w,y);c.lineTo(x+w,y+h-cut);
    c.lineTo(x+w-cut,y+h);c.lineTo(x,y+h);c.lineTo(x,y+cut);c.closePath();
  }
  function alpha(color,opacity) {
    // Keep translucent shell/glow colors connected to the same CSS tokens.
    return 'color-mix(in srgb, '+color+' '+(opacity*100)+'%, transparent)';
  }
  function MenuShell(c,box,caption='ГЛАВНОЕ МЕНЮ',count=6) {
    c.save();c.fillStyle=alpha(tokens.bg,.65);c.fillRect(box.x,box.y,box.w,box.h);
    c.strokeStyle=alpha(tokens.line,.65);c.lineWidth=.7;c.strokeRect(box.x,box.y,box.w,box.h);
    c.fillStyle=alpha(tokens.bg,.8);c.fillRect(box.x,box.y,box.w,25);
    c.fillStyle=tokens.line;c.fillRect(box.x+8,box.y+25,box.w-16,.7);
    c.fillStyle=tokens.amber;c.fillRect(box.x,box.y,1.5,19);c.fillRect(box.x,box.y,6,1.5);
    text(c,caption,box.x+15,box.y+13,11,tokens.muted,160);
    const stripes=caption==='ГЛАВНОЕ МЕНЮ'?box.x+121:box.x+153;
    for(let i=0;i<5;i++){const x=stripes+i*8;c.beginPath();c.moveTo(x+6,box.y+7);c.lineTo(x+11,box.y+7);c.lineTo(x+5,box.y+19);c.lineTo(x,box.y+19);c.closePath();c.fillStyle=alpha(tokens.muted,.22-i*.025);c.fill();}
    const version=String(global.__DIVAN_ENGINE_META__?.version||E.version||'').replace(/^v/i,'');
    text(c,'СИСТЕМА  //  '+(version?'v'+version:''),box.x+box.w-15,box.y+13,8,tokens.amber,120,false,'right');c.restore();
  }
  function MenuIndex(c,box,index,selected,disabled) {
    text(c,String(index+1).padStart(2,'0'),box.x+(selected?31:25),box.y+box.h/2,selected?21:15,
      disabled?tokens.muted:selected?tokens.amber:tokens.muted,28,true,'center');
  }
  function stateFor(index,selected,disabled) {
    if(disabled)return 'disabled';
    if(index===pressedIndex&&clock()<pressedUntil)return 'pressed';
    if(selected&&modality==='keyboard')return 'keyboard-focus';
    if(selected&&hoverIndex===index&&modality==='mouse')return 'hover';
    return 'default';
  }
  function MenuItem(c,box,item,index,selected) {
    const disabled=!!item.disabled, status=stateFor(index,selected,disabled), lit=selected&&!disabled;
    c.save();c.globalAlpha*=disabled?.42:1;
    if(status==='pressed'){c.translate(box.x+box.w/2,box.y+box.h/2);c.scale(.985,.985);c.translate(-box.x-box.w/2,-box.y-box.h/2);}
    shape(c,box.x,box.y,box.w,box.h,lit?8:9);
    const metal=c.createLinearGradient(box.x,box.y,box.x+box.w*.2,box.y+box.h);
    metal.addColorStop(0,lit?tokens.panelActive:tokens.panel);metal.addColorStop(.48,lit?tokens.panelActiveMid:tokens.panelInset);
    metal.addColorStop(1,lit?tokens.panelActiveEnd:tokens.bg);c.fillStyle=metal;c.fill();
    c.save();c.clip();
    plate(c,box,lit?1:0);
    // Cold edge light is restrained; the brand's amber guide carries the selection.
    c.strokeStyle=lit?tokens.amber:alpha(tokens.line,.8);c.lineWidth=lit?1.2:.8;
    if(lit){c.shadowColor=tokens.amber;c.shadowBlur=tokens.glow;}c.stroke();
    c.shadowBlur=0;c.fillStyle=alpha(tokens.text,lit?.16:.06);
    c.fillRect(box.x+8,box.y+1,box.w-10,1);
    if(lit){c.shadowColor=tokens.amber;c.shadowBlur=tokens.glow;c.fillStyle=tokens.amber;c.fillRect(box.x+1,box.y+3,6,box.h-6);c.shadowBlur=0;
      c.strokeStyle=alpha(tokens.bg,.75);c.lineWidth=1;for(let n=0;n<4;n++){c.beginPath();c.moveTo(box.x+1,box.y+box.h-12-n*5);c.lineTo(box.x+7,box.y+box.h-18-n*5);c.stroke();}}
    const divider=lit?58:46;
    c.fillStyle=alpha(tokens.bg,.45);c.fillRect(box.x+divider,box.y+1,51,box.h-2);
    c.strokeStyle=alpha(tokens.line,.45);c.lineWidth=.7;
    c.beginPath();c.moveTo(box.x+divider,box.y+2);c.lineTo(box.x+divider,box.y+box.h-2);c.stroke();
    shape(c,box.x+8,box.y+1,divider-8,box.h-2,lit?0:8);c.fillStyle=alpha(tokens.bg,.58);c.fill();c.stroke();
    if(status==='keyboard-focus'){
      c.strokeStyle=tokens.cyan;c.lineWidth=1;
      c.strokeRect(box.x+5,box.y+4,box.w-10,box.h-8);
    }
    c.restore();MenuIndex(c,box,index,lit,disabled);
    icon(c,box,item.id,lit);
    const tx=box.x+(lit?124:112),tw=box.w-(lit?151:141);
    c.letterSpacing=lit?'.8px':'.6px';
    text(c,item.label,tx,box.y+box.h/2-7,lit?19:15,
      item.id==='exit'?tokens.danger:lit?tokens.text:tokens.muted,tw,lit);
    c.letterSpacing='1.1px';
    text(c,[hints[item.id],item.hint].filter(Boolean).join(' · '),tx,box.y+box.h/2+11,10,
      ['load-game','developers'].includes(item.id)?tokens.cyan:tokens.muted,tw);
    c.letterSpacing='0px';c.save();c.strokeStyle=lit?tokens.amber:tokens.muted;c.lineWidth=lit?4:1.5;
    if(lit){c.shadowColor=tokens.amber;c.shadowBlur=7;}
    c.beginPath();c.moveTo(box.x+box.w-32,box.y+box.h/2-6);c.lineTo(box.x+box.w-25,box.y+box.h/2);c.lineTo(box.x+box.w-32,box.y+box.h/2+6);c.stroke();c.restore();
    if(disabled)text(c,'—',box.x+box.w-17,box.y+box.h/2,12,tokens.muted,15,false,'center');
    c.restore();return status;
  }
  function MenuHint(c,box,item,backLabel='ВЫХОД') {
    for(const [offset,key,label] of [[0,'ENTER','ВЫБОР'],[109,'ESC',backLabel]]){
      const x=box.x+offset,w=key==='ENTER'?40:30;
      c.strokeStyle=tokens.muted;c.lineWidth=.8;c.strokeRect(x,box.y,w,16);
      text(c,key,x+w/2,box.y+8,10,tokens.text,w-3,false,'center');
      text(c,label,x+w+8,box.y+8,9,tokens.cyan,70);
    }
  }
  function statusInfo(free){
    let current=null;
    if(typeof persistPeekSave==='function'){
      const key=free?(typeof SKEY==='string'?SKEY:'rnr_ru_v1'):(typeof STORY_SKEY==='string'?STORY_SKEY:'rnr_ru_story_v1');
      current=persistPeekSave(key);
    }
    const car=current&&typeof CARS!=='undefined'?CARS[current.car]:null;
    const driver=current&&typeof CHARS!=='undefined'?CHARS[current.char]:null;
    return {profile:current?(free?'СВОБОДНЫЙ ЗАЕЗД':'КАМПАНИЯ'):'НЕТ СОХРАНЕНИЯ',
      car:car?.name||'НЕ ВЫБРАНА',driver:driver?.short||driver?.name||'НЕ ВЫБРАН'};
  }
  function FooterStatus(c,box,version,info=statusInfo(E.titleMenu.isFreeMenu())) {
    c.save();c.fillStyle=tokens.line;c.fillRect(box.x,box.y,box.w,1);
    c.fillStyle=tokens.amber;c.fillRect(box.x,box.y,36,1);
    c.fillStyle=alpha(tokens.bg,.85);c.fillRect(box.x,box.y+2,box.w,box.h-2);
    const widths=[.335,.335,.33],labels=['ПРОФИЛЬ','МАШИНА','ПИЛОТ'],values=[info.profile,info.car,info.driver];
    let x=box.x;
    widths.forEach((fraction,i)=>{
      const w=box.w*fraction;
      if(i){c.fillStyle=alpha(tokens.line,.7);c.fillRect(x,box.y+6,.8,31);}
      sprite(c,assets.status,i,3,1,{x:x+12,y:box.y+7,w:32,h:32},tokens.muted);
      const pad=i===1?59:54;
      text(c,labels[i],x+pad,box.y+14,8,alpha(tokens.muted,.65),w-pad-5);
      text(c,values[i],x+pad,box.y+30,10,tokens.muted,w-pad-5);x+=w;
    });
    c.fillStyle=alpha(tokens.line,.55);c.fillRect(box.x,box.y+45,box.w,.7);
    text(c,'DIVAN GAMES  //  '+version,box.x+14,box.y+62,9,tokens.cyan,170);
    MenuHint(c,{x:box.x+232,y:box.y+53,w:205},null,E.titleMenu.isFreeMenu()?'НАЗАД':'ВЫХОД');c.restore();
  }
  function syncAccessibility(items,selected,caption) {
    if(typeof document==='undefined')return;
    if(!accessibleMenu){
      accessibleMenu=document.createElement('nav');accessibleMenu.className='title-menu-accessibility';
      accessibleMenu.setAttribute('aria-label','Главное меню');accessibleMenu.setAttribute('role','menu');
      document.body.append(accessibleMenu);
    }
    accessibleMenu.setAttribute('aria-label',caption);
    const next=items.map(item=>item.id+'/'+item.label+'/'+!!item.disabled).join('|');
    if(next!==signature){
      signature=next;accessibleMenu.replaceChildren();
      items.forEach((item,index)=>{
        const button=document.createElement('button');button.type='button';button.textContent=item.label;
        button.setAttribute('role','menuitem');button.disabled=!!item.disabled;
        button.addEventListener('focus',()=>{if(active()&&!modal()){selTitle=index;modality='keyboard';}});
        button.addEventListener('click',()=>{if(active()&&!modal()&&!item.disabled){selTitle=index;press('Enter');}});
        button.addEventListener('keydown',event=>{
          if(['ArrowUp','ArrowDown','Enter','Escape'].includes(event.key)){
            // The game's existing window capture listener has already dispatched this key.
            event.preventDefault();event.stopPropagation();
            if(active()&&!modal())accessibleMenu.children[selTitle]?.focus();
          }
        });
        accessibleMenu.append(button);
      });
    }
    accessibleMenu.hidden=!active()||!!modal();
    Array.from(accessibleMenu.children).forEach((button,i)=>{
      button.tabIndex=i===selected?0:-1;button.setAttribute('aria-current',i===selected?'true':'false');
    });
  }
  function draw(c,lay,items,selected,version,right) {
    const x=lay.colX-10,top=249,w=428;
    const idleH=44,activeH=59,gap=6;
    const bottom=top+items.length*idleH+(items[selected]?.disabled?0:activeH-idleH)+(items.length-1)*gap;
    const shell={x:x-9,y:217,w:w+18,h:432};
    const footer={x:x-9,y:bottom+13,w:w+18,h:77};
    const free=E.titleMenu.isFreeMenu(),caption=free?'СВОБОДНЫЙ ЗАЕЗД':'ГЛАВНОЕ МЕНЮ';
    shell.h=footer.y+footer.h-shell.y;
    c.save();c.fillStyle=tokens.line;c.fillRect(x,203,59,.7);c.fillRect(x+w-77,203,77,.7);
    c.fillStyle=tokens.amber;c.fillRect(x,203,21,.7);
    c.letterSpacing='3.8px';text(c,'БОЛЬШЕ ЧЕМ ГОНКИ — ВЫЖИВАНИЕ',x+68,203,7,tokens.muted,w-156);c.restore();
    MenuShell(c,shell,caption,items.length);
    const states=[],boxes=[];let y=top;
    items.forEach((item,index)=>{
      const lit=index===selected&&!item.disabled;
      const box={x:x-(lit?8:0),y,w:w+(lit?18:0),h:lit?activeH:idleH};boxes.push(box);y+=box.h+gap;
      states.push(MenuItem(c,box,item,index,index===selected));
      if(E.menu)E.menu.register(c,box,'title-'+index,
        item.disabled?()=>{}:()=>{selTitle=index;},item.disabled?()=>{}:undefined);
    });
    const info=statusInfo(free);
    FooterStatus(c,footer,version,info);
    c.save();c.fillStyle=tokens.line;c.fillRect(x+87,H-49,420,.7);c.fillRect(x+102,H-36,.7,22);
    c.fillStyle=tokens.amber;c.fillRect(x+3,H-45,68,.7);
    c.letterSpacing='2.5px';text(c,'DRIVE · FIGHT · SURVIVE',x+120,H-27,8,tokens.muted,310);c.restore();
    g._titleBoxes=boxes;
    lastLayout={shell,footer,states,boxes,caption,count:items.length,status:info,assetsReady:assetsReady()};syncAccessibility(items,selected,caption);
    return lastLayout;
  }
  if(typeof cv!=='undefined'&&cv.addEventListener){
    cv.addEventListener('mousemove',event=>{
      if(!active()||modal())return;
      const rect=cv.getBoundingClientRect(),box=E.menu?.hit((event.clientX-rect.left)*cv.width/rect.width,(event.clientY-rect.top)*cv.height/rect.height);
      modality='mouse';hoverIndex=box&&/^title-\d+$/.test(box.id)?Number(box.id.slice(6)):-1;
    });
    cv.addEventListener('mouseleave',()=>{hoverIndex=-1;});
    cv.addEventListener('mousedown',event=>{
      if(event.button!==0||!active()||modal())return;
      const rect=cv.getBoundingClientRect(),box=E.menu?.hit((event.clientX-rect.left)*cv.width/rect.width,(event.clientY-rect.top)*cv.height/rect.height);
      if(box&&/^title-\d+$/.test(box.id)){
        const index=Number(box.id.slice(6));if(g._titleItems[index]?.disabled)return;
        selTitle=index;pressedIndex=index;mousePress=index;pressedUntil=Infinity;modality='mouse';
        cv.focus();event.preventDefault();event.stopImmediatePropagation();
      }
    },true);
    global.addEventListener('mouseup',event=>{
      if(event.button!==0||mousePress<0)return;
      const index=mousePress;mousePress=-1;pressedUntil=0;
      if(!active()||modal())return;
      const rect=cv.getBoundingClientRect(),box=E.menu?.hit((event.clientX-rect.left)*cv.width/rect.width,(event.clientY-rect.top)*cv.height/rect.height);
      if(box?.id==='title-'+index){selTitle=index;press('Enter');}
    },true);
    global.addEventListener('blur',()=>{mousePress=-1;pressedUntil=0;});
  }
  if(typeof global.press==='function')E.wrap('press',previous=>function(key){
    if(active()&&!modal()){
      const items=g._titleItems||[],confirm=typeof isConfirm==='function'?isConfirm(key):key==='Enter';
      if(confirm&&items[selTitle]?.disabled)return;
      if(['ArrowUp','ArrowDown'].includes(key)){
        modality='keyboard';hoverIndex=-1;pressedIndex=-1;
        // Let the existing navigation own wrapping, skipping disabled UI entries only.
        for(let k=0;k<items.length;k++){previous.apply(this,arguments);if(!items[selTitle]?.disabled)break;}return;
      }
      if(confirm){pressedIndex=selTitle;pressedUntil=clock()+120;}
    }
    return previous.apply(this,arguments);
  });
  if(typeof global.enterTitle==='function')E.wrap('enterTitle',previous=>function(){
    modality='default';hoverIndex=-1;pressedIndex=-1;mousePress=-1;pressedUntil=0;
    return previous.apply(this,arguments);
  });
  if(E.screens){const paint=E.screens.paint;E.screens.paint=function(mode){
    const key=mode==='title'?(E.titleMenu.isFreeMenu()?'free':'main'):mode;
    if(key!==pageKey){pageKey=key;modality='default';hoverIndex=-1;pressedIndex=-1;mousePress=-1;pressedUntil=0;}
    if(accessibleMenu)accessibleMenu.hidden=mode!=='title'||!!modal();
    return paint.apply(this,arguments);
  };}
  refreshTokens();
  E.titleUI={MenuShell,MenuItem,MenuIndex,MenuHint,FooterStatus,draw,refreshTokens,stateFor,
    tokens:()=>({...tokens}),layout:()=>lastLayout,assetsReady,statusInfo,metalSurface:plate};
})(typeof window!=='undefined'?window:globalThis);
