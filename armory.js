////////////////////////////////////////////////////////
//
// Оружейка: прокачка ствола и ульты текущего кузова
//
////////////////////////////////////////////////////////
'use strict';

const ARM_MAX=6;
const ARM_COSTS={
 wep:[950,1700,3000,5200,8600,14000],
 ult:[1200,2100,3600,6200,10000,16500]
};
let armorySel=0;

/** Дописывает wep/ult в старый тюнинг. */
function ensureTuneGuns(tun){
 if(!tun)return tun;
 if(tun.wep==null)tun.wep=0;
 if(tun.ult==null)tun.ult=0;
 return tun;
}

/** Текст бонуса ствола для этого кузова. */
function armWepBlurb(idx,lvl){
 const w=carAbil(idx).weapon;
 const t=w.type;
 if(!lvl)return 'сток · каждый уровень: +8% урона, −6% КД';
 const dmg='урон +'+Math.round(lvl*8)+'%';
 const cd=' · КД −'+Math.round(lvl*6)+'%';
 if(t==='minigun')return dmg+cd+' · магазин '+(50+lvl*8)+' · холоднее ствол';
 if(t==='gatling')return dmg+cd+' · лента греется медленнее';
 if(t==='fang')return dmg+cd+' · клык плотнее в упор';
 if(t==='saw')return dmg+cd+' · пилы достают дальше';
 if(t==='homing')return dmg+cd+' · импульс бьёт жёстче';
 if(t==='mortar')return dmg+cd+' · разрыв шире';
 if(t==='plasma')return dmg+cd+' · шар тяжелее';
 if(t==='spikes')return dmg+cd+' · шипы живут дольше'+(lvl>=4?' · лента шире':'');
 if(t==='mine')return dmg+cd+' · посылка жирнее';
 if(t==='nails')return dmg+cd+' · гвоздей больнее';
 if(t==='hook')return dmg+cd+' · скоба тянет дальше';
 return dmg+cd;
}

/** Текст бонуса ульты для этого кузова. */
function armUltBlurb(idx,lvl){
 const u=carAbil(idx).ult;
 const t=u.type;
 if(!lvl)return 'сток · каждый уровень: −7% КД, +12% длительность / радиус';
 const cd='КД −'+Math.round(lvl*7)+'%';
 const dur=' · длительность +'+Math.round(lvl*12)+'%';
 if(t==='dash')return cd+dur+' · рывок дольше держит таран';
 if(t==='slowmo')return cd+dur+' · прицел держит сетку дольше';
 if(t==='cage')return cd+' · пауки злее и живучее';
 if(t==='recharge')return cd+(lvl>=4?' · третий щит на IV+':' · щиты и перезарядка');
 if(t==='berserk')return cd+dur+' · монолит стоит дольше';
 if(t==='cloak')return cd+dur+' · дольше в тени';
 if(t==='plow')return cd+' · отвал шире';
 if(t==='ghost')return cd+dur+' · дольше сквозь машины';
 if(t==='haze')return cd+dur+' · облако больше';
 if(t==='bubble')return cd+dur+' · купол дольше';
 if(t==='shove')return cd+' · табун шире';
 return cd+dur;
}

/** Вход в оружейку текущей машины. */
function enterArmory(){
 armorySel=0;
 state='armory';
}

/** Покупка уровня ствола или ульты. */
function buyArmory(key){
 const tun=ensureTuneGuns(save.tuning[save.car]||blankTune());
 save.tuning[save.car]=tun;
 const lvl=tun[key]|0;
 if(lvl>=ARM_MAX){garMsg='МАКСИМАЛЬНЫЙ УРОВЕНЬ';garMsgT=2.2;sHit();return;}
 const cost=ARM_COSTS[key][lvl];
 if(save.cash<cost){garMsg='НЕ ХВАТАЕТ '+fm(cost-save.cash);garMsgT=2.2;sHit();return;}
 save.cash-=cost;tun[key]=lvl+1;persist();SFX.play('tune');
 const ab=carAbil(save.car);
 garMsg='УСТАНОВЛЕНО: '+(key==='wep'?ab.weapon.name:ab.ult.name)+' '+(lvl+1);
 garMsgT=2.2;
}

/** Клавиши оружейки. */
function armoryPress(c){
 if(isBack(c)){state='garage';sClick();return;}
 if(c==='ArrowUp'||c==='ArrowLeft'){armorySel=(armorySel+1)%2;sClick();return;}
 if(c==='ArrowDown'||c==='ArrowRight'){armorySel=(armorySel+1)%2;sClick();return;}
 if(isConfirm(c)){buyArmory(armorySel===0?'wep':'ult');return;}
}

/** Клик по карточкам. */
function armoryClick(x,y){
 const hits=g._armHits||[];
 for(const b of hits){
  if(x<b.x||x>b.x+b.w||y<b.y||y>b.y+b.h)continue;
  armorySel=b.i;
  if(b.buy)buyArmory(b.key);
  else sClick();
  return;
 }
}

/** Карточка ствола или ульты. */
function drawArmCard(x,y,w,h,sel,key,title,name,blurb,col){
 const tun=ensureTuneGuns(save.tuning[save.car]||blankTune());
 const lvl=tun[key]|0,maxed=lvl>=ARM_MAX;
 const cost=maxed?null:ARM_COSTS[key][lvl];
 const dis=maxed||save.cash<cost;
 const accent=sel?(dis?'#ff3d2e':col):'rgba(255,255,255,.08)';
 drawHubCard(x,y,w,h,sel?accent:null);
 txt(g,title,x+24,y+26,13,col,'left',F_B);
 txt(g,name,x+24,y+56,26,'#e8e2d0','left');
 txt(g,blurb,x+24,y+86,13,'#9a93a8','left',F_B);
 drawLevelPips(g,x+24,y+118,lvl,ARM_MAX,dis?'#6f6880':col);
 txt(g,lvl+'/'+ARM_MAX,x+24+ARM_MAX*16+12,y+123,13,'#8f88a0','left',F_B,false);
 if(maxed)txt(g,'МАКС',x+w-28,y+h/2+8,18,'#58ff6b','right');
 else{
  const can=!dis;
  const bx=x+w-132,by=y+h-56,bw=108,bh=40;
  drawHubPlus(bx,by,bw,bh,can,sel,fm(cost));
  g._armHits.push({i:key==='wep'?0:1,key,x:bx,y:by,w:bw,h:bh,buy:true});
 }
 g._armHits.push({i:key==='wep'?0:1,key,x,y,w,h,buy:false});
}

/** Экран оружейки: крупный кузов, две карточки. */
function drawArmory(){
 const ch=CHARS[save.char],car=CARS[save.car];
 const ab=carAbil(car.idx);
 const tun=ensureTuneGuns(save.tuning[car.idx]||blankTune());
 save.tuning[car.idx]=tun;
 const STAGE=HUB_STAGE_W,GAP=HUB_STAGE_GAP;
 const RIGHT_X=HUB_PAD+STAGE+GAP,RIGHT_W=W-HUB_PAD-RIGHT_X;
 drawHubBackdrop('rgba(255,107,74,.05)');
 drawHubHeader('ОРУЖЕЙКА','ствол и ульта этой машины','#ff6b4a');
 drawPilotStage(HUB_PAD,HUB_TOP,STAGE,HUB_FOOT-HUB_TOP,ch,{
  title:car.name,sub:ab.weapon.name+'  ·  '+ab.ult.name,subCol:'#ff9d7a'
 });
 drawHubCard(RIGHT_X,HUB_TOP,RIGHT_W,HUB_FOOT-HUB_TOP);
 txt(g,'ВЕРСТАК',RIGHT_X+24,HUB_TOP+28,18,'#ff6b4a','left');
 txt(g,'качается только выбранный кузов',RIGHT_X+RIGHT_W-24,HUB_TOP+28,12,'#6f6880','right',F_B);
 g._armHits=[];
 const rx=RIGHT_X+20,rw=RIGHT_W-40,gap=16;
 const cardH=(HUB_FOOT-HUB_TOP-88-gap)/2;
 const y0=HUB_TOP+48;
 drawArmCard(rx,y0,rw,cardH,armorySel===0,'wep','ОРУЖИЕ',ab.weapon.name,armWepBlurb(car.idx,tun.wep|0),'#ff6b4a');
 drawArmCard(rx,y0+cardH+gap,rw,cardH,armorySel===1,'ult','УЛЬТА',ab.ult.name,armUltBlurb(car.idx,tun.ult|0),'#b478ff');
 txt(g,'↑ ↓  ствол / ульта   ·   ENTER / «+»  качать   ·   ESC  в гараж',W/2,H-28,13,'#6f6880','center',F_B);
 drawHubToast();
}
