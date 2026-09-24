// Общие меню: сдержанный металл, читаемый текст и независимая от FPS подсветка.
(function (global) {
  'use strict';
  const E=global.DiVANEngine;
  if(!E||typeof global.panel!=='function')return;
  const C=Object.freeze({bg:'#0b1015',surface:'#141c23',raised:'#202e38',line:'#364550',text:'#e5ebef',muted:'#a6b3bd',dim:'#84939f',accent:'#93bac7',danger:'#db8178',success:'#9fbaa6'});
  const animations=new Map();
  let regions=[],scope='',screen='',entered=0,pointer=null,hovered='';
  const now=()=>typeof gt==='number'?gt:0;
  const reduce=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  const active=()=>!!global.__rnrMenuTheme;
  function mix(key,target,duration=.14){
    const t=now(),full=scope+':'+key;let a=animations.get(full);
    if(!a||t<a.time)a={value:target ? .15 : 0,time:t};
    a.value=reduce()?target:target+(a.value-target)*Math.exp(-Math.max(0,t-a.time)/duration);
    a.time=t;animations.set(full,a);
    if(animations.size>768)animations.delete(animations.keys().next().value);
    return a.value;
  }
  function outline(c,x,y,w,h){
    const cut=Math.min(7,h/5);c.beginPath();c.moveTo(x,y);c.lineTo(x+w-cut,y);c.lineTo(x+w,y+cut);
    c.lineTo(x+w,y+h);c.lineTo(x+cut,y+h);c.lineTo(x,y+h-cut);c.closePath();
  }
  function frame(c,x,y,w,h,selected=false,danger=false,key){
    const f=mix(key||[x,y,w,h].join('/'),selected?1:0),ink=danger?C.danger:C.accent;
    c.save();c.shadowBlur=0;outline(c,x,y,w,h);
    const fill=c.createLinearGradient(x,y,x+w*.3,y+h);fill.addColorStop(0,C.surface);fill.addColorStop(1,C.bg);
    c.fillStyle=fill;c.fill();c.strokeStyle=C.line;c.lineWidth=1;c.stroke();
    if(f>.001){
      c.save();c.clip();c.globalAlpha*=f*.17;c.fillStyle=ink;c.fillRect(x,y,w,h);c.restore();
      c.globalAlpha*=f;c.strokeStyle=ink;c.stroke();c.fillStyle=ink;c.fillRect(x,y+7,3,Math.max(4,h-14));
      if(!reduce()&&f<.98){c.globalAlpha*=(1-f)*.65;c.fillRect(x+4,y,w*f,1);}
    }
    c.restore();return f;
  }
  function text(c,value,x,y,size=16,color=C.text,align='left',width,heavy=false){
    c.save();c.shadowBlur=0;c.font=(heavy?'600 ':'400 ')+size+'px '+(size>=24?'"Bender", ':'')+'"Segoe UI", sans-serif';
    c.textAlign=align;c.textBaseline='middle';c.fillStyle=color;
    if(width>0)c.fillText(String(value),x,y,width);else c.fillText(String(value),x,y);c.restore();
  }
  function background(c,width=W,height=H){
    const x=typeof stageX0==='function'?stageX0():0,y=typeof stageY0==='function'?stageY0():0;
    const ww=typeof viewW==='number'?Math.max(width,viewW):width,hh=typeof viewH==='number'?Math.max(height,viewH):height;
    c.save();const bg=c.createLinearGradient(0,0,width,height);bg.addColorStop(0,'#1a2730');bg.addColorStop(.52,C.bg);bg.addColorStop(1,'#11191f');
    c.fillStyle=bg;c.fillRect(x,y,ww,hh);c.strokeStyle='rgba(147,186,199,.035)';c.lineWidth=1;
    for(let xx=x;xx<x+ww;xx+=80){c.beginPath();c.moveTo(xx,y);c.lineTo(xx-160,y+hh);c.stroke();}
    c.fillStyle=C.line;c.fillRect(36,20,width-72,1);c.fillRect(36,height-18,width-72,1);c.restore();
  }
  function register(c,box,id,focus,activate){
    const m=typeof c.getTransform==='function'?c.getTransform():{a:1,d:1,e:0,f:0};
    regions.push({id,focus,activate,x:box.x*m.a+m.e,y:box.y*m.d+m.f,w:box.w*m.a,h:box.h*m.d});
  }
  function row(c,x,y,w,h,label,selected,opts={}){
    const f=frame(c,x,y,w,h,selected,opts.danger,opts.id),left=opts.number?52:20;
    if(opts.number)text(c,opts.number,x+18,y+h/2,11,selected?C.accent:C.dim);
    text(c,label,x+left,y+h/2-(opts.hint?6:0),opts.size||17,selected?C.text:C.muted,'left',w-left-34,selected);
    if(opts.hint)text(c,opts.hint,x+left,y+h/2+12,11,C.dim,'left',w-left-34);
    text(c,'›',x+w-18,y+h/2,20,selected?C.accent:C.dim,'center');
    if(opts.focus||opts.activate)register(c,{x,y,w,h},opts.id||label,opts.focus,opts.activate);return f;
  }
  function pause(c,width,height,items,selected,garage){
    const oldScope=scope;scope=garage?'garage-pause':'race-pause';
    const top=Math.max(18,(height-Math.min(height-36,items.length*48+122))/2);
    const step=Math.min(48,(height-120)/items.length),w=Math.min(480,width-40),x=(width-w)/2;
    c.save();c.globalAlpha*=mix('pause-open',1,.08);c.fillStyle='rgba(5,9,13,.9)';c.fillRect(0,0,width,height);
    text(c,'ПАУЗА',x,top+18,30,C.text,'left',w,true);
    text(c,garage?'ГАРАЖ':'ЗАЕЗД ПРИОСТАНОВЛЕН',x+w,top+20,11,C.dim,'right',w/2);
    items.forEach((label,i)=>row(c,x,top+54+i*step,w,step-6,label,i===selected,{id:'pause-'+i,size:width<650?14:16,
      number:String(i+1).padStart(2,'0'),danger:/ВЫЙТИ|ВЫХОД/.test(label),
      focus:()=>{if(garage)garagePauseIndex=i;else pauseMenuIndex=i;},activate:()=>press('Enter')}));
    text(c,'↑↓  ВЫБОР     ENTER  ПОДТВЕРДИТЬ     ESC  ПРОДОЛЖИТЬ',x,top+60+items.length*step,11,C.dim,'left',w);
    c.restore();scope=oldScope;
  }
  const muted=new Set(['#9a93a8','#8f88a0','#6f6880','#567d8f','#78a5b8','#5a5468','#7a7388','#c8c2d4','#c8c0d4','#9baebd']);
  const accents=new Set(['#ffd23f','#ff9d2e','#21ddff','#35e0ff','#b9efff','#79dce6','#b478ff']);
  function color(value){
    const v=String(value).toLowerCase();if(muted.has(v))return C.muted;if(accents.has(v))return C.accent;
    if(['#ff3d2e','#ff3158','#ff6b4a'].includes(v))return C.danger;if(['#58ff6b','#8be5b0'].includes(v))return C.success;
    if(['#e8e2d0','#e0f6ff','#edf4f5','#d4e5ef','#fff','#ffffff'].includes(v))return C.text;return value;
  }
  const basePanel=global.panel,baseText=global.txt,baseLines=global.layoutLines,baseWrap=global.wrapText,basePath=global.panelPath;
  global.panel=function(c,x,y,w,h,fill,stroke,cut){
    if(!active())return basePanel.apply(this,arguments);
    if(!fill){c.save();outline(c,x,y,w,h);c.lineWidth=1;c.strokeStyle=color(stroke)||C.line;c.stroke();c.restore();return;}
    const ink=String(stroke).toLowerCase(),danger=['#ff3158','#ff3d2e','#ff6b4a',C.danger].includes(ink);
    return frame(c,x,y,w,h,(w<700||h<120)&&(accents.has(ink)||ink===C.accent||ink==='#58ff6b'||danger),danger);
  };
  global.panelPath=function(c,x,y,w,h,cut){if(active())return outline(c,x,y,w,h);return basePath.apply(this,arguments);};
  global.txt=function(c,value,x,y,size,ink,align,font,stroke){
    if(!active())return baseText.apply(this,arguments);return text(c,value,x,y,size,color(ink),align||'left',undefined,size>=22);
  };
  global.layoutLines=function(c,value,width,size,font){return baseLines(c,value,width,size,active()?'"Segoe UI", sans-serif':font);};
  global.wrapText=function(c,value,x,y,width,lineH,size,ink,font){return baseWrap(c,value,x,y,width,lineH,size,active()?color(ink):ink,active()?'"Segoe UI", sans-serif':font);};
  for(const name of ['drawTheatreBack','drawAchievementsBack','drawHubBackdrop'])if(typeof global[name]==='function')E.replace(name,()=>background(g));
  if(typeof global.drawHubCard==='function')E.replace('drawHubCard',(x,y,w,h,stroke)=>frame(g,x,y,w,h,w<700&&accents.has(stroke)));
  for(const name of ['statPips','statPipsN'])if(typeof global[name]==='function')E.wrap(name,previous=>function(c,x,y,v,max,ink){
    if(!active())return previous.apply(this,arguments);
    const count=name==='statPips'?5:max,step=name==='statPips'?18:16;
    const tint=color(name==='statPips'?max:ink);
    for(let i=0;i<count;i++){c.fillStyle=i<v?tint:C.line;c.fillRect(x+i*step,y,step-4,7);}
  });
  if(typeof global.drawLevelPips==='function')E.wrap('drawLevelPips',previous=>function(c,x,y,lvl,max,ink){
    if(!active())return previous.apply(this,arguments);
    for(let i=0;i<max;i++){c.fillStyle=i<lvl?color(ink):C.line;c.fillRect(x+i*13,y,10,7);}
  });
  if(typeof global.drawVhsView==='function')E.wrap('drawVhsView',previous=>function(){if(!active())return previous.apply(this,arguments);});
  if(typeof global.drawGarageRow==='function')E.replace('drawGarageRow',function(x,y,w,h,sel,accent,fill,title,desc,right){
    frame(g,x,y,w,h,sel);
    text(g,title,x+20,y+(desc?18:h/2),16,sel?C.text:C.muted,'left',w-(right?160:40),sel);
    if(desc)text(g,desc,x+20,y+38,11,C.dim,'left',w-40);
    if(right)text(g,right,x+w-20,y+h/2,15,C.accent,'right',140);
  });
  if(typeof global.drawHazardStripes==='function')E.replace('drawHazardStripes',()=>{});
  function modalOpen(){return global.titleConfirm||(typeof labWarn!=='undefined'&&labWarn)||(typeof exitWarn!=='undefined'&&exitWarn)||(typeof CLIENT_NOTICE!=='undefined'&&CLIENT_NOTICE&&CLIENT_NOTICE.open);}
  function keyFor(mode){return mode+(mode==='settings'?'/'+settingsState:'')+(mode==='garage'&&garagePaused?'/pause':'')+(mode==='race'&&paused?'/pause':'')+(modalOpen()?'/modal':'');}
  const paint=E.screens.paint;
  E.screens.paint=function(mode){
    const menu=mode!=='race'&&mode!=='intro'&&mode!=='worldIntro';
    const key=keyFor(mode);
    if(key!==screen){screen=key;entered=now();animations.clear();hovered='';}
    scope=key;regions=[];paint(mode);
    if(modalOpen()){regions=[];collectModal();}else if(menu)collect(mode);
    if(menu&&!reduce()){
      const elapsed=Math.max(0,now()-entered),alpha=.24*Math.pow(Math.max(0,1-elapsed/.22),2);
      if(alpha>.001){g.save();g.setTransform(1,0,0,1,0,0);g.fillStyle='rgba(5,9,13,'+alpha+')';g.fillRect(0,0,cv.width,cv.height);g.restore();}
    }
  };
  function collectModal(){
    if(typeof CLIENT_NOTICE!=='undefined'&&CLIENT_NOTICE&&CLIENT_NOTICE.open)return;
    const title=!!global.titleConfirm,exit=typeof exitWarn!=='undefined'&&exitWarn;
    const hits=title?g._titleConfirmHits:exit?g._exitHits:g._labHits;
    for(const [i,b] of (hits||[]).entries())register(g,b,'dialog-'+i,()=>{
      if(title)global.titleConfirmSel=i;else if(exit)exitWarnSel=i;else labWarnSel=i;
    });
  }
  function collect(mode){
    let entries=[];
    if(mode==='settings'||mode==='cameraSetup')entries=(g._setHits||[]).map(b=>({b,focus:()=>{
      if(typeof controlCaptureKey!=='undefined'&&controlCaptureKey)return;
      if(b.i!=null)settingsTab=b.i;
      else if(b.act==='reset'||b.act==='apply')settingsTab=(settingsState==='main'?4:settingsState==='graphics'?gfxOpts().length:settingsState==='sound'?sndOpts().length:settingsState==='controls'?controlOpts().length:gameOpts().length)+(b.act==='apply'?1:0);
    }}));
    else if(mode==='garage'&&!garagePaused)entries=(g._gar||[]).map(b=>({b,focus:()=>{tuningSel=b.row;}}));
    else if(mode==='results')entries=(g._resultHits||[]).map(b=>({b,focus:()=>{R.resultAction=b.action;}}));
    else if(mode==='gym')entries=(g._gymBtns||[]).map(b=>({b,focus:()=>{gymSel=b.idx;}}));
    else if(mode==='armory')entries=(g._armHits||[]).map(b=>({b,focus:()=>{armorySel=b.i;}}));
    else if(mode==='career')entries=(g._careerBtns||[]).map(b=>({b,focus:()=>{if(R.career)R.career.sel=b.i;}}));
    else if(mode==='careerTracks')entries=(g._careerTiles||[]).map((b,i)=>({b,focus:()=>{careerPickSel=i;}}));
    else if(mode==='tracks')entries=(g._trackTiles||[]).map((b,i)=>({b,focus:()=>{trackPickSel=i;}}));
    else if(mode==='char'&&bioOpen<0)entries=(g._charCards||[]).map(b=>({b,focus:()=>{selChar=b.idx;}}));
    else if(mode==='slotSelect'&&E.slots)entries=Array.from({length:10},(_,i)=>({b:E.slots.slotRectAt(i,W),focus:()=>{slotSelectIndex=i;},activate:()=>press('Enter')}));
    for(const [i,item] of entries.entries())if(item.b)register(g,item.b,mode+'-'+i,item.focus,item.activate);
  }
  function hit(x,y){
    if(typeof state!=='undefined'){
      const key=keyFor(state);
      if(key!==screen)return null;
    }
    for(let i=regions.length-1;i>=0;i--){const b=regions[i];if(x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h)return b;}return null;
  }
  function point(e){const r=cv.getBoundingClientRect();return{x:(e.clientX-r.left)*cv.width/r.width,y:(e.clientY-r.top)*cv.height/r.height};}
  if(typeof cv!=='undefined'&&cv.addEventListener){
    cv.addEventListener('mousemove',e=>{
      const p=point(e);if(pointer&&Math.abs(p.x-pointer.x)+Math.abs(p.y-pointer.y)<2)return;pointer=p;
      const b=hit(p.x,p.y);cv.style.cursor=b?'pointer':'';
      if(b&&b.id!==hovered){if(b.focus)b.focus();if(E.menuAudio)E.menuAudio.play('move');}hovered=b?b.id:'';
    });
    cv.addEventListener('mouseleave',()=>{hovered='';pointer=null;cv.style.cursor='';});
    cv.addEventListener('mousedown',e=>{
      if(e.button!==0)return;const p=point(e),b=hit(p.x,p.y);
      if(b&&b.activate){if(b.focus)b.focus();b.activate();e.preventDefault();e.stopImmediatePropagation();}
    },true);
  }
  E.menu={colors:C,frame,text,row,pause,background,mix,reduce,color,register,hit,active,regions:()=>regions.slice(),scope:()=>scope};
})(typeof window!=='undefined'?window:globalThis);
