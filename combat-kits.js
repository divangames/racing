////////////////////////////////////////////////////////
//
// Уникальные оружие и ульты стоковых кузовов
//
////////////////////////////////////////////////////////
'use strict';

const CAR_ABIL = [
  {nitro:{cd:10},weapon:{cd:1.05,dmg:20,name:'КЛЫК',type:'fang'},ult:{cd:8,name:'ПЕРЕГОВОРЫ',type:'dash'}},
  {nitro:{cd:9},weapon:{cd:0.09,dmg:8,name:'ГАТЛИНГ',type:'gatling',heat:0.07,overheat:1.6},ult:{cd:12,name:'ПРИЦЕЛ',type:'slowmo'}},
  {nitro:{cd:10},weapon:{cd:1.15,dmg:18,name:'ЗУБ',type:'saw'},ult:{cd:15,name:'КЛЕТКА',type:'cage'}},
  {nitro:{cd:9},weapon:{cd:1.7,dmg:22,name:'ИМПУЛЬС',type:'homing'},ult:{cd:18,name:'СБРОС ФАЗЫ',type:'recharge'}},
  {nitro:{cd:12},weapon:{cd:2.1,dmg:40,name:'ГАУБИЦА',type:'mortar'},ult:{cd:22,name:'МОНОЛИТ',type:'berserk'}},
  {nitro:{cd:8},weapon:{cd:1.05,dmg:16,name:'ПЛАЗМА',type:'plasma'},ult:{cd:10,name:'МАСКИРОВКА',type:'cloak'}},
  {nitro:{cd:11},weapon:{cd:1.35,dmg:8,name:'БОРТ',type:'spikes'},ult:{cd:14,name:'ОТВАЛ',type:'plow'}},
  {nitro:{cd:8},weapon:{cd:1.45,dmg:28,name:'ПОСЫЛКА',type:'mine'},ult:{cd:16,name:'НЕТ ДВЕРЕЙ',type:'ghost'}},
  {nitro:{cd:9},weapon:{cd:0.85,dmg:9,name:'ШПИЛЬКА',type:'nails'},ult:{cd:15,name:'СМЕХ ХОЗЯЙКИ',type:'haze'}},
  {nitro:{cd:10,type:'jump'},weapon:{cd:0.07,dmg:7,name:'МИНИГАН',type:'minigun',ammo:50,overheat:3.2},ult:{cd:14,name:'ТАБУН',type:'shove',rad:92}},
  {nitro:{cd:10},weapon:{cd:1.05,dmg:8,name:'СКОБА',type:'hook'},ult:{cd:18,name:'КУПОЛ',type:'bubble',dur:4.5},
   passive:{magnet:true,rad:86,pull:260,types:['money','wrench','bolt']}}
];

/** Набор слота; чужой индекс — кит Дьявола. */
function carAbil(idx){return CAR_ABIL[idx]||CAR_ABIL[0];}

/** Уровень ствола 0…6. */
function kitLvW(r){return Math.max(0,Math.min(6,(r&&r.wepLvl)|0));}
/** Уровень ульты 0…6. */
function kitLvU(r){return Math.max(0,Math.min(6,(r&&r.ultLvl)|0));}
/** КД оружия после оружейки. */
function kitWepCd(r,ab){return Math.max(0.045,(ab.cd||1)*(1-kitLvW(r)*0.06));}
/** КД ульты после оружейки. */
function kitUltCd(r,ab){return Math.max(3,(ab.cd||10)*(1-kitLvU(r)*0.07));}
/** Перегрев минигана / гатлинга. */
function kitOverheat(r,ab){return Math.max(0.7,(ab.overheat||3.2)*(1-kitLvW(r)*0.07));}
/** Шаг нагрева гатлинга. */
function kitHeatStep(r,ab){return Math.max(0.035,(ab.heat||0.07)*(1-kitLvW(r)*0.08));}
/** Длительность ульты. */
function kitUltDur(r,base){return (base||1)*(1+kitLvU(r)*0.12);}
/** Радиус ульты. */
function kitUltRad(r,base){return (base||1)*(1+kitLvU(r)*0.08);}

/** Строка HUD: оружие · нитро/прыжок · ульта. */
function abilHudLine(ab){
 const n=(ab.nitro&&ab.nitro.type)==='jump'?'прыжок '+ab.nitro.cd+'с':'нитро '+ab.nitro.cd+'с';
 return ab.weapon.name+' · '+n+' · '+ab.ult.name;
}

/** Магазин минигана (0 — обычный кулдаун). */
function wepMagMax(r){
 const w=carAbil(r.car.idx).weapon;
 if(!(w&&w.type==='minigun'))return 0;
 return (w.ammo||50)+kitLvW(r)*8;
}

/** Полный магазин и сброс перегрева. */
function resetWepMag(r){
 r.wepAmmo=wepMagMax(r);
 r.wepOver=0;
 r.wepHeat=0;
}

/** Урон выстрела: оружейка, рывок, берсерк, скил Бегемотика. */
function kitWepDmg(r,ab){
 const tune=1+kitLvW(r)*0.08;
 return ab.dmg*tune*r.buffDmg*(r.berserk>0?1.5:1)*(r.dmgMul||1);
}

/** Занос: ручник или сильный lat. */
function kitSliding(r){
 return Math.abs(r.lat||0)>38||(!!r.handbrake&&Math.abs(r.spd)>48);
}

/** Метка следующей мины. */
function kitMineId(){
 window._kitMineSeq=(window._kitMineSeq||9000)+1;
 return window._kitMineSeq;
}

/** Выстрел из носа. */
function kitPushShot(r,ang,spd,life,dmg,extra){
 const s=Object.assign({
  x:r.x+Math.cos(ang)*26,y:r.y+Math.sin(ang)*26,
  vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd,r:r,life:life,dmg:dmg
 },extra||{});
 R.shots.push(s);
 return s;
}

/** Гаубица рвётся по площади. */
function kitMortarBoom(x,y,dmg,owner,rad){
 const Rmax=rad||108;
 boom(x,y,'rocket');
 if(!R.demo){sBoom();if(nearP(x,y,700))doShake(8);}
 for(const o of R.racers){
  if(o.dead||o===owner)continue;
  const d=Math.hypot(o.x-x,o.y-y);
  if(d>Rmax)continue;
  dmgRacer(o,dmg*(1-d/Rmax),owner,'proj');
 }
}

////////////////////////////////////////////////////////
//
// Оружие
//
////////////////////////////////////////////////////////

/** Стрельба Z. */
function fireWeapon(r){
 if(r.dead||r.cdW>0)return;
 const ab=carAbil(r.car.idx).weapon;
 const t=ab.type;
 if(t==='minigun'){
  if((r.wepOver||0)>0||(r.wepAmmo|0)<=0)return;
  r.cdW=kitWepCd(r,ab);r.wepAmmo--;
  const a=r.ang,off=(Math.random()-.5)*0.14,dmg=kitWepDmg(r,ab);
  kitPushShot(r,a+off,980,.42,dmg);
  if(vfxLive())RnRVfx.muzzle(r.x+Math.cos(a)*28,r.y+Math.sin(a)*28,a,'minigun');
  if(r.wepAmmo<=0){r.wepOver=kitOverheat(r,ab);if(r.isP&&!R.demo)fl(r.x,r.y,'ПЕРЕГРЕВ','#ff9d2e');}
  if(!R.demo&&(r.isP||nearP(r.x,r.y,600)))sShoot();
  return;
 }
 if(t==='gatling'){
  if((r.wepOver||0)>0)return;
  r.cdW=kitWepCd(r,ab);
  r.wepHeat=Math.min(1,(r.wepHeat||0)+kitHeatStep(r,ab));
  const a=r.ang,off=(Math.random()-.5)*0.18,dmg=kitWepDmg(r,ab);
  kitPushShot(r,a+off,1020,.4,dmg);
  if(r.wepHeat>=1){r.wepOver=kitOverheat(r,ab);r.wepHeat=0;if(r.isP&&!R.demo)fl(r.x,r.y,'СТВОЛ КИПИТ','#ff9d2e');}
  if(vfxLive())RnRVfx.muzzle(r.x+Math.cos(a)*28,r.y+Math.sin(a)*28,a,'gatling');
  if(!R.demo&&(r.isP||nearP(r.x,r.y,600)))sShoot();
  return;
 }
 if(t==='nails'&&!kitSliding(r)){
  if(r.isP&&!R.demo)fl(r.x,r.y,'НУЖЕН ЗАНОС','#ff5db1');
  return;
 }
 if(r.cloak>0)r.cloak=0;
 r.cdW=kitWepCd(r,ab);
 const a=r.ang,dmg=kitWepDmg(r,ab);
 const noise=r.blind>0?0.28:0;
 const lv=kitLvW(r);
 if(t==='fang'){
  let close=1;
  for(const o of R.racers){
   if(o===r||o.dead)continue;
   const dx=o.x-r.x,dy=o.y-r.y,dist=Math.hypot(dx,dy);
   const ahead=Math.cos(a)*dx+Math.sin(a)*dy;
   if(ahead>8&&ahead<86&&dist<96)close=1.55;
  }
  if(r.dash>0)close*=1.22;
  for(const off of[-0.18,0,0.18])kitPushShot(r,a+off+noise,920,.55,(dmg*close)/3,{fang:true});
 }else if(t==='saw'){
  let hit=0;
  for(const o of R.racers){
   if(o===r||o.dead||o.air||o.finished)continue;
   const dx=o.x-r.x,dy=o.y-r.y,dist=Math.hypot(dx,dy);
   if(dist>62+lv*4)continue;
   const ahead=Math.cos(a)*dx+Math.sin(a)*dy;
   const side=Math.abs(-Math.sin(a)*dx+Math.cos(a)*dy);
   if(ahead>-18&&ahead<42&&side>10){
    dmgRacer(o,dmg,r,'ram');hit++;spark(o.x,o.y,'#37c94f',10,180);
   }
  }
  if(r.isP&&!R.demo)fl(r.x,r.y,hit?'ЗУБ!':'МИМО','#37c94f');
 }else if(t==='homing'){
  kitPushShot(r,a,640,2.3,dmg,{rocket:true});
 }else if(t==='mortar'){
  kitPushShot(r,a,430,1.35,dmg,{mortar:true,mrad:108+lv*6});
 }else if(t==='plasma'){
  kitPushShot(r,a+noise,760,1.05,dmg,{plasma:true});
 }else if(t==='spikes'){
  if(!R.spikes)R.spikes=[];
  const bx=r.x-Math.cos(a)*32,by=r.y-Math.sin(a)*32;
  const px=-Math.sin(a),py=Math.cos(a);
  const span=lv>=4?3:2;
  for(let k=-span;k<=span;k++)R.spikes.push({x:bx+px*k*16,y:by+py*k*16,rot:a,life:7.5+lv*0.5,owner:r});
 }else if(t==='mine'){
  const bx=r.x-Math.cos(a)*36,by=r.y-Math.sin(a)*36;
  R.mines.push({x:bx,y:by,dead:false,pow:dmg,rad:92+lv*4,i:kitMineId(),arm:0.45,owner:r,life:11});
 }else if(t==='nails'){
  const back=a+Math.PI;
  for(const off of[-0.42,-0.21,0,0.21,0.42])kitPushShot(r,back+off,820,.48,dmg,{nails:true});
 }else if(t==='hook'){
  let bestP=null,pd=140+lv*14;
  for(const p of R.picks||[]){
   if(!p.alive)continue;
   const d=Math.hypot(p.x-r.x,p.y-r.y);
   if(d<pd){pd=d;bestP=p;}
  }
  if(bestP){
   bestP.x=r.x;bestP.y=r.y;
   if(r.isP&&!R.demo)fl(r.x,r.y,'СКОБА','#d45a1a');
  }else{
   let best=null,bd=118+lv*10;
   for(const o of R.racers){
    if(o===r||o.dead||o.air)continue;
    const d=Math.hypot(o.x-r.x,o.y-r.y);
    if(d<bd){bd=d;best=o;}
   }
   if(best){
    const nx=(best.x-r.x)/(bd||1),ny=(best.y-r.y)/(bd||1);
    best.ang+=0.28*(Math.random()>.5?1:-1);
    best.lat=clamp((best.lat||0)+(-ny*Math.cos(best.ang)+nx*Math.sin(best.ang))*70,-140,140);
    dmgRacer(best,dmg,r,'proj');
   }else if(r.isP&&!R.demo)fl(r.x,r.y,'ПУСТО','#d45a1a');
  }
 }else{
  kitPushShot(r,a+noise,900,.9,dmg);
 }
 if(vfxLive()&&t!=='saw'&&t!=='spikes'&&t!=='mine'&&t!=='hook')RnRVfx.muzzle(r.x+Math.cos(a)*26,r.y+Math.sin(a)*26,a,t);
 if(!R.demo&&(r.isP||nearP(r.x,r.y,600))&&t!=='hook')sShoot();
}

////////////////////////////////////////////////////////
//
// Ульты
//
////////////////////////////////////////////////////////

/** Толчок кругом или конусом. */
function kitShove(r,rad,cone){
 R.shocks.push({x:r.x,y:r.y,r:12,maxR:rad+24,t:.42});
 spark(r.x,r.y,'#b478ff',22,280);
 const fx=Math.cos(r.ang),fy=Math.sin(r.ang);
 for(const o of R.racers){
  if(o===r||o.dead||o.air)continue;
  if(o.cloak>0&&o.car.idx===5)continue;
  const dx=o.x-r.x,dy=o.y-r.y,d=Math.hypot(dx,dy);
  if(d>=rad)continue;
  if(cone&&(dx*fx+dy*fy)<d*0.25)continue;
  const nx=d<1?fx:(dx/d),ny=d<1?fy:(dy/d);
  o.x=clamp(o.x+nx*48,20,R.T.w-20);o.y=clamp(o.y+ny*48,20,R.T.h-20);
  o.spd=cone?o.spd*0.35:0;o.nitro=0;
  spark(o.x,o.y,'#e8d0ff',10,160);
 }
}

/** Ульта C. */
function useUlt(r){
 if(r.dead||r.cdU>0)return;
 const ab=carAbil(r.car.idx).ult;r.cdU=kitUltCd(r,ab);const t=ab.type;
 const u=kitLvU(r);
 if(t==='dash'){
  const dur=kitUltDur(r,1.5);
  r.dash=dur;r.buffDmg=2;r.buffDmgT=dur;r.spd=Math.max(r.spd,r.st.top*1.08);
 }
 else if(t==='slowmo'){const sl=kitUltDur(r,2);for(const o of R.racers)if(o!==r&&!o.dead)o.slow=Math.max(o.slow,sl);}
 else if(t==='cage'){
  const back=r.ang+Math.PI;
  const pow=30*(1+u*0.1)*(r.dmgMul||1);
  for(const off of[-0.5,0,0.5]){
   const ang=back+off;
   R.mines.push({x:r.x+Math.cos(ang)*28,y:r.y+Math.sin(ang)*28,dead:false,pow:pow,rad:kitUltRad(r,86),i:kitMineId(),
    crawl:true,owner:r,life:7.5+u*0.4,arm:0.35});
  }
 }
 else if(t==='recharge'){r.shield=Math.min(3,r.shield+2+(u>=4?1:0));r.cdW=0;resetWepMag(r);}
 else if(t==='berserk'){r.berserk=kitUltDur(r,3);r.buffArmor=.5;}
 else if(t==='cloak'){r.cloak=kitUltDur(r,3);}
 else if(t==='plow')kitShove(r,kitUltRad(r,96),true);
 else if(t==='ghost'){const d=kitUltDur(r,2.5);r.ghost=d;r.paper=d;r.nitro=Math.max(r.nitro,1.5);}
 else if(t==='haze'){r.haze=kitUltDur(r,3.2);r.hazeRad=kitUltRad(r,118);}
 else if(t==='bubble'){r.bubble=kitUltDur(r,ab.dur||4.5);R.shocks.push({x:r.x,y:r.y,r:10,maxR:70,t:.38});spark(r.x,r.y,'#35e0ff',16,200);}
 else if(t==='shove')kitShove(r,kitUltRad(r,ab.rad||92),false);
 swp('sine',1200,400,.2,.2);if(r.isP&&!R.demo)fl(r.x,r.y,ab.name+'!','#b478ff');
}

////////////////////////////////////////////////////////
//
// Тик, столкновения, снаряды
//
////////////////////////////////////////////////////////

/** Таймеры кита на машине. */
function tickCarKits(r,dt){
 if(r.dash>0)r.dash=Math.max(0,r.dash-dt);
 if(r.ghost>0)r.ghost=Math.max(0,r.ghost-dt);
 if(r.paper>0)r.paper=Math.max(0,r.paper-dt);
 if(r.haze>0)r.haze=Math.max(0,r.haze-dt);
 if(r.blind>0)r.blind=Math.max(0,r.blind-dt);
 if((r.wepHeat||0)>0&&r.cdW<=0)r.wepHeat=Math.max(0,r.wepHeat-dt*0.22);
 if(r.haze>0){
  for(const o of R.racers){
   if(o===r||o.dead)continue;
   if(Math.hypot(o.x-r.x,o.y-r.y)<(r.hazeRad||118))o.blind=Math.max(o.blind||0,0.25);
  }
 }
}

/** Ползучие мины «Клетки». */
function tickCrawlMines(dt){
 for(const m of R.mines){
  if(m.dead)continue;
  if(m.arm>0)m.arm-=dt;
  if(m.life!=null){m.life-=dt;if(m.life<=0)m.dead=true;}
  if(!m.crawl||m.dead)continue;
  let best=null,bd=220;
  for(const o of R.racers){
   if(o.dead||o===m.owner||o.finished)continue;
   const d=Math.hypot(o.x-m.x,o.y-m.y);
   if(d<bd){bd=d;best=o;}
  }
  if(!best)continue;
  const d=Math.hypot(best.x-m.x,best.y-m.y)||1;
  m.x+=(best.x-m.x)/d*70*dt;m.y+=(best.y-m.y)/d*70*dt;
 }
}

/** Множитель исходящего тарана. */
function kitRamOut(r){
 let m=1;
 if(r.car.idx===0)m=2;
 if(r.car.idx===4)m=3;
 if(r.dash>0)m*=1.15;
 if(r.berserk>0)m*=1.45;
 return m;
}

/** Множитель входящего тарана. */
function kitRamIn(r){
 if(r.car.idx===0||r.car.idx===4)return .5;
 return 1;
}

/** Купол режет снаряды и мины, таран проходит. */
function kitBubbleBlocks(src){return src!=='ram'&&src!=='crush';}

/** Призрак не сталкивается. */
function kitGhost(r){return (r.ghost||0)>0;}

/** Попадание снаряда: плазма замедляет, гаубица рвётся. */
function kitOnShotHit(s,victim){
 if(s.plasma)victim.slow=Math.max(victim.slow||0,1.35);
 if(s.mortar)kitMortarBoom(s.x,s.y,s.dmg,s.r,s.mrad);
}

/** Снаряд истёк. */
function kitOnShotExpire(s){
 if(s.mortar)kitMortarBoom(s.x,s.y,s.dmg,s.r,s.mrad);
}

/** ИИ: когда жать оружие. */
function kitAiWantsFire(r,bestT,bd){
 const t=carAbil(r.car.idx).weapon.type;
 if(t==='saw')return bestT&&bd<70;
 if(t==='mine'||t==='spikes'){
  if(!bestT)return false;
  const ahead=Math.cos(r.ang)*(bestT.x-r.x)+Math.sin(r.ang)*(bestT.y-r.y);
  return ahead<8&&bd<160;
 }
 if(t==='nails')return kitSliding(r)&&bestT&&bd<150;
 if(t==='hook')return true;
 if(bestT&&bd<400&&Math.abs(angDiff(Math.atan2(bestT.y-r.y,bestT.x-r.x),r.ang))<.4)return true;
 return false;
}

/** Рисунок снаряда. */
function kitShotStyle(s){
 if(s.rocket)return{fill:'#ff3d2e',core:'#ff9d2e',w:20,h:6};
 if(s.plasma)return{fill:'#b478ff',core:'#e8d0ff',w:18,h:5};
 if(s.mortar)return{fill:'#ff6b2e',core:'#ffd23f',w:14,h:8};
 if(s.nails)return{fill:'#ff5db1',core:'#fff',w:10,h:2};
 if(s.fang)return{fill:'#d24a22',core:'#ffd23f',w:14,h:3};
 return{fill:'#ffd23f',core:'#fff',w:16,h:4};
}
