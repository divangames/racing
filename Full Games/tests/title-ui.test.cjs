'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function boot(){
  const fonts=[],lines=[],regions=[],c={state:'title',selTitle:0,H:720,time:0,exitWarn:false,
    performance:{now:()=>c.time},isConfirm:key=>key==='Enter',
    g:{_titleItems:Array.from({length:6},(_,i)=>({id:String(i),label:'ПУНКТ '+i}))}};
  c.window=c;
  c.press=key=>{if(key==='ArrowDown')c.selTitle=(c.selTitle+1)%6;
    if(key==='ArrowUp')c.selTitle=(c.selTitle+5)%6;if(key==='Enter')c.action=c.selTitle;};
  c.DiVANEngine={titleMenu:{isFreeMenu:()=>!!c.free},menu:{register:(_g,b,id)=>regions.push({id,...b})},
    wrap:(name,wrap)=>{c[name]=wrap(c[name]);}};
  const ctx={font:'',globalAlpha:1,fillText(value){fonts.push(this.font);lines.push(value);},createLinearGradient:()=>({addColorStop(){}})};
  for(const name of ['save','restore','beginPath','moveTo','lineTo','closePath','fill','stroke','fillRect',
    'clip','setLineDash','strokeRect','translate','scale'])ctx[name]=()=>{};
  vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/engine/title-ui.js'),'utf8'),c);
  const lay={colX:52,titleY0:258,titleStep:48,panelH:43,itemW:414};
  return {c,ui:c.DiVANEngine.titleUI,ctx,fonts,lines,regions,lay};
}
test('Disabled не активируется; навигация пропускает его и сохраняет циклический обход',()=>{
  const {c}=boot();c.g._titleItems[1].disabled=true;c.press('ArrowDown');assert.equal(c.selTitle,2);
  c.press('ArrowUp');assert.equal(c.selTitle,0);c.press('ArrowUp');assert.equal(c.selTitle,5);
  c.selTitle=1;c.press('Enter');assert.equal(c.action,undefined);
  c.selTitle=3;c.press('Enter');assert.equal(c.action,3);
});

test('Свободный заезд показывает свой заголовок, число строк, возврат и этап сохранения',()=>{
  for(const saved of [false,true]){
    const {c,ui,ctx,lay,lines}=boot();c.free=true;
    const items=[{id:'free-new',label:'НОВЫЙ ЗАЕЗД'}];
    if(saved)items.push({id:'free-continue',label:'ПРОДОЛЖИТЬ ЗАЕЗД',hint:'этап 3'});
    items.push({id:'free-location',label:'ВЫБРАТЬ ЛОКАЦИЮ'},{id:'free-back',label:'ВЫЙТИ В ГЛАВНОЕ МЕНЮ'});
    const layout=ui.draw(ctx,lay,items,saved?1:0,'v1',1280);
    assert.equal(layout.caption,'СВОБОДНЫЙ ЗАЕЗД');assert.equal(layout.count,saved?4:3);
    assert(lines.includes('ESC'));assert(lines.includes('НАЗАД'));
    if(saved)assert(lines.some(line=>line.includes('этап 3')));
  }
});
test('Фокус мгновенный, pressed сбрасывается, весь текст компонентов использует Bender',()=>{
  const {c,ui,ctx,fonts,lay}=boot();c.press('ArrowDown');
  assert.equal(ui.stateFor(1,true,false),'keyboard-focus');c.press('Enter');
  assert.equal(ui.stateFor(1,true,false),'pressed');c.time=121;
  assert.equal(ui.stateFor(1,true,false),'keyboard-focus');
  ui.draw(ctx,lay,c.g._titleItems,c.selTitle,'v1',1280);
  assert(fonts.length>10&&fonts.every(font=>font.includes('Bender')));
});
test('Shell, footer и строки сохраняют safe area в координатах обычной и широкой сцены',()=>{
  for(const [width,origin] of [[1280,0],[1720,-220]]){
    const {c,ui,ctx,lay,regions}=boot();lay.colX+=origin;
    const layout=ui.draw(ctx,lay,c.g._titleItems,0,'v1',origin+width);
    for(const box of [layout.shell,layout.footer,...regions]){
      assert(box.x>=origin+12&&box.x+box.w<=origin+width-12);
      assert(box.y>=12&&box.y+box.h<=708);
    }
    assert.equal(regions.length,6);
  }
});

test('Выбранная строка крупнее, области клика совпадают с рисунком, статус не выдумывает сохранение',()=>{
  const {c,ui,ctx,lay,regions}=boot();const layout=ui.draw(ctx,lay,c.g._titleItems,2,'v1',1280);
  assert(layout.boxes[2].h>layout.boxes[1].h);
  assert.equal(layout.boxes.length,6);assert.equal(c.g._titleBoxes,layout.boxes);
  for(let i=0;i<6;i++){
    assert.equal(regions[i].y,layout.boxes[i].y);
    if(i)assert(layout.boxes[i].y>layout.boxes[i-1].y+layout.boxes[i-1].h);
  }
  assert.equal(layout.status.profile,'НЕТ СОХРАНЕНИЯ');assert.equal(layout.status.car,'НЕ ВЫБРАНА');
  assert(layout.footer.x+layout.footer.w<=lay.colX+450);
});

test('Статус читает кампанию и свободный заезд из собственных сохранений',()=>{
  const {c,ui}=boot();c.SKEY='free';c.STORY_SKEY='story';
  c.CARS=[{name:'ГРЯЗЕВОЙ ДЬЯВОЛ'},{name:'ПЕРЕХВАТЧИК'}];c.CHARS=[{short:'МЕДВЕДЬ'},{short:'ЕРШ'}];
  c.persistPeekSave=key=>key==='story'?{car:0,char:0}:{car:1,char:1};
  assert.equal(ui.statusInfo(false).driver,'МЕДВЕДЬ');assert.equal(ui.statusInfo(false).car,'ГРЯЗЕВОЙ ДЬЯВОЛ');
  assert.equal(ui.statusInfo(true).driver,'ЕРШ');assert.equal(ui.statusInfo(true).car,'ПЕРЕХВАТЧИК');
});

test('Композиция совпадает с измеренными опорными координатами референса',()=>{
  const {c,ui,ctx,lay,lines}=boot();c.g._titleItems[2].id='free-menu';
  const layout=ui.draw(ctx,lay,c.g._titleItems,2,'v1',1280);
  assert.equal(layout.shell.x,33);assert.equal(layout.shell.y,217);assert.equal(layout.shell.w,446);
  assert.equal(layout.boxes[0].x,42);assert.equal(layout.boxes[0].y,249);assert.equal(layout.boxes[0].h,44);
  assert.equal(layout.boxes[2].x,34);assert.equal(layout.boxes[2].y,349);assert.equal(layout.boxes[2].h,59);
  assert.equal(layout.footer.y,571);assert.equal(layout.footer.h,77);
  assert(lines.includes('БОЛЬШЕ ЧЕМ ГОНКИ — ВЫЖИВАНИЕ'));assert(lines.includes('ENTER'));assert(lines.includes('ESC'));
});
