// Физика автомобиля: адаптация исходного stepVehicle для десктоп-движка.
function stepVehicle(r,th,steer,dt,hb){
 if(!Number.isFinite(dt)||dt<=0)return;
 const S=R.S,p=S[r.trackIdx];
 const off=!r.air&&Math.hypot(r.x-p.x,r.y-p.y)>ROADW;
 let mult=1;if(r.bolt>0)mult*=1.3;
 if(r.nitro>0)mult*=(r.car.idx===1?1.6:1.45);
 mult=Math.min(mult,1.6);
 let top=r.st.top*(off?r.st.off:1)*mult;
 if(typeof kitAsphaltMul==='function')top*=kitAsphaltMul(r,off);
 else if(!off&&r.car.idx===13)top*=1.08;
 if((r.bodyDump||0)>0)top*=1.12;
 if((r.overtake||0)>0)top*=1.18;
 if(r.slow>0)top*=0.55;
 if(r.dash>0)top*=1.22;
 if(r.ghost>0)top*=1.28;
 if(!r.isP){
  top*=1+.03*Math.min(2,(R.div||1)-1);
  const deficit=(P&&R.N)?(P.prog-r.prog)/R.N:0;top*=1+clamp(deficit*.28,-.05,.06);}
 const acc=r.st.acc;
 const hov=!!r.car.hov;
 if((r.flipSteer||0)>0)steer=-steer;
 const grip=clamp((r.st.grip||.7)*(off?.72:1),.42,1.2);
 const hand=!!hb&&!hov&&!r.air;
 r.handbrake=hand;
 if(r.lat==null)r.lat=0;
 if(r.susp==null)r.susp=0;
 if(r.bob==null)r.bob=0;
 if(r.bobVel==null)r.bobVel=0;
 if(r.rockAmp==null)r.rockAmp=0;
 if(r.rockT==null)r.rockT=0;
 if(r.landStun==null)r.landStun=0;
 let long=r.spd,lat=r.lat;
 const shk=(r.lvl&&r.lvl.shk)||0;
 if(r.susp>0)r.susp=Math.max(0,r.susp-dt*(1.15+shk*.35));
 if(r.landStun>0)r.landStun=Math.max(0,r.landStun-dt);
 if(r.rockAmp>0){
  r.rockT+=dt*(18-shk);
  r.rockAmp=Math.max(0,r.rockAmp-dt*(0.9+shk*.25));
 }
 r.bobVel+=-r.bob*36*dt-r.bobVel*3.4*dt;
 r.bob+=r.bobVel*dt;
 if(Math.abs(r.bob)<0.35&&Math.abs(r.bobVel)<1.2&&r.susp<=0){r.bob=0;r.bobVel=0;}
 ////////////////////////////////////////////////////////
 //
 // Продольная: инерция, тормоз, ручник (не мгновенный стоп)
 //
 ////////////////////////////////////////////////////////
 const roll=r.air?0.1:(hand?2.15:(th===0?0.22:0.12));
 long*=Math.exp(-roll*dt);
 const gas=r.landStun>0?0.14:1;
 if(!r.air){
  if(th>0){
   const want=top*th;
   if(long<want)long=Math.min(want,long+acc*dt*gas);
   else long+=clamp(want-long,-acc*.35*dt,acc*.35*dt);
  }else if(th<0){
   if(long>18)long+=th*(520+grip*50)*dt;
   else long=Math.max(-top*.35,long+acc*.42*th*dt);
  }
 }
 if(r.finished)long*=Math.exp(-0.48*dt);
 ////////////////////////////////////////////////////////
 //
 // Вираж: руль догоняет вход, кузов кренится; «Поворот» острит
 //
 ////////////////////////////////////////////////////////
 const sharp=clamp(r.st.sharp!=null?r.st.sharp:(r.st.crn-2.15)/3.05,0,1);
 if(r.steerFlt==null)r.steerFlt=0;
 const catchUp=(hov?16:6.5)+sharp*(hov?6:10);
 r.steerFlt+=(steer-r.steerFlt)*(1-Math.exp(-catchUp*dt));
 const sf=clamp(Math.abs(long)/140,0,1)*(long<0?-1:1);
 const oldAng=r.ang;
 // На прямой руль спокойнее; ручник сохраняет возможность резко довернуть кузов.
 const speedRatio=clamp(Math.abs(long)/Math.max(1,r.st.top),0,1);
 const stability=1-speedRatio*speedRatio*.25;
 const yawMul=r.air?0.35:(hand?1.12:stability);
 r.ang+=r.steerFlt*r.st.crn*.95*sf*yawMul*dt;
 const ad=r.ang-oldAng;
 if(!hov){
  const ice=R.T&&R.T.theme&&R.T.theme.deco==='ice'?0.62:1;
  let oil=false;for(const o of R.oils||[])if(Math.hypot(r.x-o.x,r.y-o.y)<34){oil=true;break;}
  if(!oil&&typeof kitOnSlick==='function'&&kitOnSlick(r))oil=true;
  const wet=settings.graphics.weather&&R.weather&&R.weather.id==='rain';
  const surf=ice*(oil?0.45:1)*(wet?(0.75+R.weather.mod*.25):1);
  const hold=grip*surf;
  if(!r.air)lat+=-r.steerFlt*Math.abs(long)*(hand?5.2:0.4/hold)*dt;
  const damp=r.air?1.1:(hand?1.7:8.2*hold);
  lat*=Math.exp(-damp*dt);
  long-=Math.abs(lat)*0.06*dt;
  lat=clamp(lat,-140,140);
  if(oil&&!r.air)r.ang+=Math.sin(gt*14+r.slot*3)*2.4*dt;
  if((r.blind||0)>0&&!r.air)r.ang+=Math.sin(gt*22+r.slot*5)*3.2*dt;
  if(ice<1&&!r.air)r.ang+=Math.sin(gt*8+r.slot*2)*1.8*dt*(Math.abs(long)/r.st.top);
  if(wet){
   r.ang+=Math.sin(gt*12+r.slot*3)*(1-R.weather.mod)*2*dt*(Math.abs(long)/r.st.top);
  }
 }else{
  lat=0;
  let oil=false;for(const o of R.oils||[])if(Math.hypot(r.x-o.x,r.y-o.y)<34){oil=true;break;}
  if(!oil&&typeof kitOnSlick==='function'&&kitOnSlick(r))oil=true;
  if(oil&&!r.air)r.ang+=Math.sin(gt*14+r.slot*3)*.4*dt;
 }
 r.spd=long;r.lat=lat;
 r.wheelAngle=lerp(r.wheelAngle,r.steerFlt*.42+ad/Math.max(dt,.001)*.2,1-Math.exp(-10*dt));
 r.wheelRot+=r.spd*dt*0.18;
 const drift=Math.abs(ad)/Math.max(dt,.001)/60*Math.abs(r.spd);
 const sliding=Math.abs(lat)>22||hand&&Math.abs(r.spd)>50;
 r._skidElapsed=(r._skidElapsed||0)+dt;
 if(r._skidElapsed>=1/60&&!hov&&!r.air&&(sliding&&Math.abs(r.spd)>55||drift>3&&Math.abs(r.spd)>100||(r.finished&&Math.abs(steer)>0.2&&Math.abs(r.spd)>40))&&settings.graphics.skids){
  r._skidElapsed=0;
  const wx1=r.x-Math.cos(r.ang)*14-Math.sin(r.ang)*14;
  const wy1=r.y-Math.sin(r.ang)*14+Math.cos(r.ang)*14;
  const wx2=r.x-Math.cos(r.ang)*14+Math.sin(r.ang)*14;
  const wy2=r.y-Math.sin(r.ang)*14-Math.cos(r.ang)*14;
  // След продолжается только от своей машины, без перемычек после респауна и среза.
  const trail=r._engineTrail;
  const prev=trail&&gt-trail.at<.12&&Math.hypot(wx1-trail.lx,wy1-trail.ly)<45?trail:null;
  R.skids.push({
   lx:wx1,ly:wy1,rx:wx2,ry:wy2,
   plx:prev?prev.lx:wx1,ply:prev?prev.ly:wy1,
   prx:prev?prev.rx:wx2,pry:prev?prev.ry:wy2,
   ang:r.ang,t:6
  });
  if(R.skids.length>800)R.skids.shift();
  r._engineTrail={lx:wx1,ly:wy1,rx:wx2,ry:wy2,at:gt};
 }
 if(hand&&!r.air&&Math.abs(r.spd)>70&&Math.random()<dt*18)landDust(r,.28);
 if(!hov&&!r.air&&sliding&&Math.abs(r.spd)>55&&Math.random()<dt*10){
  const sk=wheelSprayKind(r,true);
  if(sk==='snow'||sk==='water')landDust(r,.2);
 }
 if(!hov&&!r.air&&R.weather&&R.weather.id==='rain'&&inPuddle(r.x,r.y)&&Math.abs(r.spd)>50&&Math.random()<dt*16)landDust(r,.24);
 if(r.car.idx===2)r.hp=Math.min(r.maxhp,r.hp+2*dt);
 if(r.chIdx===0){const ht=skillVal(0,r.skillLvl);r.hp=Math.min(r.maxhp,r.hp+(r.maxhp/ht)*dt);}
 const fx=Math.cos(r.ang),fy=Math.sin(r.ang);
 r.x+=(fx*long-fy*lat)*dt;r.y+=(fy*long+fx*lat)*dt;
 r.x=clamp(r.x,20,R.T.w-20);r.y=clamp(r.y,20,R.T.h-20);
 if(window.RnRObjects&&R.labObjects)RnRObjects.pushCar(r,R.labObjects);
 // ТРАМПЛИН: прыжок. Высота/дальность зависят от скорости (баланс).
 if(!r.air&&!r.finished){
  for(const rp of R.ramps){
   if(Math.hypot(r.x-rp.x,r.y-rp.y)<46&&Math.abs(r.spd)>140){
    r.air=true;
    r.vz=Math.abs(r.spd)*0.9;
    r.jumpSpd=Math.abs(r.spd);
    r.jumps++;
    if(r.isP){fl(r.x,r.y,'ПРЫЖОК!','#7df9ff');swp('sine',300,700,.2,.2);}
    break;
   }
  }
 }
 // Баллистика полёта и приземление
 if(r.air){
  r.vz-=900*dt;
  r.z+=r.vz*dt;
  if(r.z<=0&&r.vz<0){
   r.z=0;r.vz=0;r.air=false;
   const impact=clamp(Math.abs(r.jumpSpd||r.spd)/240,.35,1.2);
   const soft=1-shk*.12;
   r.susp=Math.min(1,.82+impact*.22);
   r.bob=12+impact*10;
   r.bobVel=-70*impact;
   r.rockAmp=(introReduceMotion?0:.18+impact*.12)*soft;
   r.rockT=0;
   r.landStun=(.34+impact*.16)*soft;
   for(const o of R.racers){if(o===r||o.dead||o.air)continue;
    if(obbOverlap(carObb(r),carObb(o))){
     const fdmg=(18+r.jumpSpd*0.06)*(1-(o.lvl&&o.lvl.shk||0)*0.05)*(r.dmgMul||1);
     dmgRacer(o,fdmg,r,'crush');
     if(r.isP||o.isP)fl(o.x,o.y,'УДАР СВЕРХУ!','#ff6b4a');
    }
   }
   // Потеря скорости на ударе; амортизаторы съедают штраф
   r.spd*=(1-Math.max(0.02,(0.2-shk*0.028)*impact));
   r.lat=(r.lat||0)*(0.62+grip*0.2);
   const selfDmg=Math.max(0,10-shk*1.5);
   if(selfDmg>0)dmgRacer(r,selfDmg,null,'crush');
   landDust(r,impact);
   landSparks(r,impact);
   if(r.isP){doShake(5+impact*5);swp('triangle',90,35,.2,.3);}
  }
 }
 if(off&&Math.abs(r.spd)>70&&Math.random()<dt*30){
  const sk=wheelSprayKind(r,true);
  if(vfxLive())RnRVfx.dust(r.x-Math.cos(r.ang)*18,r.y-Math.sin(r.ang)*18,r.ang,.35,sk);
  else spawnCanvasSpray(r,.35,sk);
 }
 if(r.nitro>0&&Math.random()<dt*40){
  const nx=r.x-Math.cos(r.ang)*26,ny=r.y-Math.sin(r.ang)*26;
  if(vfxLive())RnRVfx.nitro(nx,ny,r.ang);
  else R.parts.push({x:nx,y:ny,vx:-Math.cos(r.ang)*240+rnd(-40,40),vy:-Math.sin(r.ang)*240+rnd(-40,40),t:.22,col:'rgba(210,230,255,.4)',sz:rnd(2,5)});
 }
 if(r.hp<r.maxhp*.35){r.smokeT-=dt;if(r.smokeT<=0){r.smokeT=.12;
  if(vfxLive())RnRVfx.smoke(r.x,r.y);
  else R.parts.push({x:r.x,y:r.y,vx:rnd(-20,20),vy:rnd(-40,-10),t:.8,col:'rgba(40,40,40,.6)',sz:rnd(5,10)});}}
 // Проверка секретных срезов
 if(r.isP&&R.shortcuts){
  for(const sc of R.shortcuts){
   if(sc.used)continue;
   const dx=r.x-sc.entry[0],dy=r.y-sc.entry[1];
   const dist=Math.sqrt(dx*dx+dy*dy);
   if(dist<sc.radius){
    sc.glow=1;
    const vx=Math.cos(r.ang)*r.spd,vy=Math.sin(r.ang)*r.spd;
    const toExitX=sc.exit[0]-r.x,toExitY=sc.exit[1]-r.y;
    const dot=vx*toExitX+vy*toExitY;
    if(dot>0&&r.spd>100){
     r.x=sc.exit[0];r.y=sc.exit[1];
     r.prog+=sc.bonus;
     sc.used=true;
     fl(r.x,r.y,'СРЕЗКА: '+sc.name+'!','#ff9d2e');
     swp('sine',300,900,.3,.3);
     doShake(8);
    }
   }
  }
 }
 r.invuln-=dt;r.bolt-=dt;r.nitro-=dt;
 if(r.bubble>0)r.bubble=Math.max(0,r.bubble-dt);
 r.cdN-=dt;r.cdW-=dt;r.cdU-=dt;r.slow-=dt;r.drone-=dt;r.buffDmgT-=dt;
 if(r.wepOver>0){
  r.wepOver-=dt;
  if(r.wepOver<=0){r.wepOver=0;resetWepMag(r);}
 }
 if(r.buffDmgT<=0)r.buffDmg=1;
 if(r.berserk>0)r.berserk-=dt;
 if(r.cloak>0)r.cloak=Math.max(0,r.cloak-dt);
 if(typeof tickCarKits==='function')tickCarKits(r,dt);
}

