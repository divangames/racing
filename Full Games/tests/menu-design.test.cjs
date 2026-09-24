'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function menuBoot(){
  const listeners={},labels=[];
  const g=new Proxy({globalAlpha:1,_exitHits:[],_labHits:[],_titleConfirmHits:[],getTransform:()=>({a:2,d:2,e:40,f:20}),createLinearGradient:()=>({addColorStop(){}}),fillText:(...args)=>labels.push(args)}, {get:(o,k)=>k in o?o[k]:()=>{}});
  const c={g,gt:0,W:1280,H:720,viewW:1280,viewH:720,state:'race',paused:true,garagePaused:false,pauseMenuIndex:0,garagePauseIndex:0,exitWarn:false,exitWarnSel:0,labWarnSel:0,settingsState:'main',
    panel(){},panelPath(){},txt(){},layoutLines(){return [];},wrapText(){},matchMedia:()=>({matches:c.reduced}),reduced:false,
    cv:{width:1440,height:900,style:{},getBoundingClientRect:()=>({left:0,top:0,width:1440,height:900}),addEventListener:(name,fn)=>{listeners[name]=fn;}},
    press:()=>{c.confirmed=(c.confirmed||0)+1;},DiVANEngine:{replace(name,fn){c[name]=fn;},wrap(name,factory){c[name]=factory(c[name]);},screens:{paint(mode){
      if(mode==='race')c.DiVANEngine.menu.pause(g,640,360,['ПРОДОЛЖИТЬ','НАСТРОЙКИ','ВЫЙТИ'],c.pauseMenuIndex,false);
    }}}};
  c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/engine/menu-theme.js'),'utf8'),c);return {c,M:c.DiVANEngine.menu,listeners,labels};
}
test('Подсветка меню одинакова на 30/60/120 Гц и отключает движение по системной настройке',()=>{
  const values=[];
  for(const fps of [30,60,120]){const {c,M}=menuBoot();M.mix('selection',0);for(let i=1;i<=fps;i++){c.gt=i/fps;M.mix('selection',1);}values.push(M.mix('selection',1));c.reduced=true;assert.equal(M.mix('selection',0),0);assert.equal(M.mix('selection',1),1);}
  assert(Math.max(...values)-Math.min(...values)<1e-10);
});
test('Пауза использует реальные координаты Canvas: наведение выбирает, клик срабатывает один раз',()=>{
  const {c,M,listeners}=menuBoot();c.DiVANEngine.screens.paint('race');const b=M.regions()[1];
  assert.equal(M.hit(b.x+b.w/2,b.y+b.h/2).id,'pause-1');
  const e={clientX:b.x+b.w/2,clientY:b.y+b.h/2,button:0,preventDefault(){},stopImmediatePropagation(){this.stopped=true;}};
  listeners.mousemove(e);assert.equal(c.pauseMenuIndex,1);listeners.mousedown(e);assert.equal(c.confirmed,1);assert(e.stopped);
});
test('Устаревшие области клика не действуют после смены экрана или открытия модального окна',()=>{
  const {c,M,listeners}=menuBoot();c.DiVANEngine.screens.paint('race');const b=M.regions()[0],x=b.x+10,y=b.y+10;
  c.state='settings';assert.equal(M.hit(x,y),null);c.state='race';c.exitWarn=true;assert.equal(M.hit(x,y),null);
  c.DiVANEngine.screens.paint('race');assert.equal(M.regions().length,0);
  listeners.mousedown({clientX:x,clientY:y,button:0});assert.equal(c.confirmed,undefined);
  c.g._exitHits=[{x:10,y:10,w:40,h:20},{x:60,y:10,w:40,h:20}];
  c.DiVANEngine.screens.paint('race');assert.equal(M.regions().length,2);assert.equal(M.hit(x,y),null);
  const yes=M.regions()[1];listeners.mousemove({clientX:yes.x+2,clientY:yes.y+2});assert.equal(c.exitWarnSel,1);
});
test('Все пункты общей паузы помещаются в компактный и широкий интерфейс',()=>{
  for(const [width,height,n] of [[640,360,7],[800,450,6],[1280,720,7]]){
    const {c,M}=menuBoot();M.pause(c.g,width,height,Array.from({length:n},(_,i)=>'ПУНКТ '+i),0,false);
    for(const b of M.regions()){assert(b.x>=40&&b.y>=20);assert(b.x+b.w<=40+width*2&&b.y+b.h<=20+height*2);}
  }
});

function audioBoot(){
  const destination={},sources=[];
  const context={currentTime:0,sampleRate:48000,state:'running',createBuffer:(_channels,length)=>({length,copyToChannel(){}}),createBufferSource(){const s={connect:dest=>{s.dest=dest;},disconnect(){},start(){s.started=true;},stop(){if(s.onended)s.onended();}};sources.push(s);return s;}};
  const c={Float32Array,settings:{sound:{sfx:80,sfxOn:true}},AU:{ctx:context,sfx:destination},state:'settings',paused:false,press(){c.DiVANEngine.menuAudio.play();},hubClick(){},clickSettings(){},clickCameraSetup(){},SFX:{play:id=>{c.original=id;}},DiVANEngine:{wrap(name,fn){c[name]=fn(c[name]);}}};
  c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/engine/menu-audio.js'),'utf8'),c);return {c,a:c.DiVANEngine.menuAudio,context,sources,destination};
}
test('Новые звуки ограничены по пику, имеют плавные края и различимые сигналы',()=>{
  const {a}=audioBoot(),signatures=new Set();
  for(const kind of Object.keys(a.presets)){const data=a.render(kind,48000);let peak=0,sum=0;for(const v of data){assert(Number.isFinite(v));peak=Math.max(peak,Math.abs(v));sum+=v*v;}
    assert(peak<.8&&Math.sqrt(sum/data.length)>.01);assert.equal(data[0],0);assert.equal(data.at(-1),0);signatures.add(data.length+':'+peak);}
  assert.equal(signatures.size,5);
});
test('Звуки соблюдают mute/нулевую громкость, ограничивают повторы и число одновременных голосов',()=>{
  const {c,a,context,sources,destination}=audioBoot();assert(a.play('move'));assert.equal(a.play('move'),false);
  c.settings.sound.sfx=0;assert.equal(a.play('confirm'),false);c.settings.sound.sfx=80;c.settings.sound.sfxOn=false;assert.equal(a.play('confirm'),false);
  c.settings.sound.sfxOn=true;for(let i=0;i<10;i++)a.play('confirm');assert(a.status().voices<=4);assert(sources.every(s=>s.dest===destination));
  context.state='suspended';assert.equal(a.play('back'),false);
});
test('Навигация, подтверждение, возврат и покупки используют разные отклики; эффекты гонки сохраняются',()=>{
  const {c,a,context}=audioBoot();c.press('Enter');assert.equal(a.status().lastKind,'confirm');c.press('ArrowDown');assert.equal(a.status().lastKind,'move');
  c.press('Escape');assert.equal(a.status().lastKind,'back');c.SFX.play('tune');assert.equal(a.status().lastKind,'purchase');
  c.state='race';c.SFX.play('tune');assert.equal(c.original,'tune');assert.equal(a.isMenu(),false);c.paused=true;assert.equal(a.isMenu(),true);
});
