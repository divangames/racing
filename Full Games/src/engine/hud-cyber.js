// Компактная композиция киберпанк-HUD и живые реплики гонщиков.
(function () {
  'use strict';
  const K=DiVANEngine.cyberKit, C=K.colors, panels=DiVANEngine.cyberPanels;
  /** До Full HD сохраняет привычный размер; на 4K увеличивает HUD вместе с экраном. */
  function viewport() {
    const scale=Math.max(.8,Math.min(3,Math.max(viewS,Math.min(1.5,viewS*1.3))));
    return {scale,width:viewW*viewS/scale,height:viewH*viewS/scale};
  }
  /** Небольшие периферийные приборы оставляют центр и большую часть нижнего края свободными. */
  function layout(width,height) {
    const margin=12, small=width<850, side=small?112:148, bottom=height-margin;
    const speedW=small?118:160, speedH=speedW*132/160;
    const weaponW=Math.min(small?360:390,width-side-speedW-margin*2-32), clockW=Math.min(260,width*.34);
    const vehicleW=Math.min(small?200:230,width*.28), taskW=small?140:166;
    return {small,width,height,
      vehicle:{x:margin,y:margin,w:vehicleW,h:60},
      clock:{x:Math.max(vehicleW+margin+10,(width-clockW)/2),y:margin,w:clockW,h:44},
      task:{x:width-margin-taskW,y:margin,w:taskW,h:44},
      speed:{x:margin,y:bottom-speedH,w:speedW,h:speedH},
      arsenal:{x:(width-weaponW)/2,y:bottom-64,w:weaponW,h:64},
      map:{x:width-margin-side,y:bottom-side,w:side,h:side},
      dialogue:{x:margin,y:margin+60+K.spacing.gap,w:vehicleW,h:Math.min(192,height-180)}
    };
  }
  /** Верхнее табло показывает общее положение, время и круг. */
  function clock(c,box) {
    const {x,y,w,h}=box; K.frame(c,x,y,w,h);
    K.text(c,labTest?'ТЕСТ':Math.max(1,R.order.indexOf(P)+1)+'/'+R.racers.length,x+12,y+22,17,C.cyan,'left',w*.23,true);
    K.text(c,fmtT(R.time),x+w*.52,y+22,22,C.text,'center',w*.4,true);
    K.text(c,labTest?'КРУГ '+Math.max(1,P.lap+1):clamp(P.lap+1,1,raceLaps)+'/'+raceLaps,x+w-12,y+29,13,C.ice,'right',w*.23);
    if(!labTest) K.text(c,'КРУГ',x+w-12,y+13,9,C.muted,'right');
  }
  /** Справа остаются счёт уничтожений и деньги, на полигоне — рекорды круга. */
  function objective(c,box) {
    const {x,y,w,h}=box; K.frame(c,x,y,w,h);
    if(labTest) {
      K.text(c,'ЛУЧШИЙ',x+12,y+13,9,C.muted); K.text(c,P.bestLap?fmtLap(P.bestLap):'—',x+w-12,y+13,12,C.ice,'right');
      K.text(c,'ПРОШЛЫЙ',x+12,y+31,9,C.muted); K.text(c,P.lastLap?fmtLap(P.lastLap):'—',x+w-12,y+31,12,C.ice,'right');
    } else {
      K.icon(c,'skull',x+21,y+22,15,C.red); K.text(c,P.kills||0,x+35,y+22,16,C.red);
      K.text(c,'$ '+(P.moneyGot||0),x+w-12,y+22,16,C.gold,'right',w-66);
    }
  }
  /** Таблица появляется по F6; реплики от её видимости не зависят. */
  function standings(c,box,detailed) {
    if(!detailed||labTest) return;
    const w=Math.min(202,box.width*.25), x=box.width-w-12, y=box.task.y+box.task.h+14;
    const count=Math.max(0,Math.min(R.order.length,Math.floor((box.map.y-y-12)/24)));
    R.order.slice(0,count).forEach((r,i)=> {
      const sy=y+i*24; c.fillStyle=r===P?'rgba(8,55,74,.85)':'rgba(3,14,22,.85)';c.fillRect(x,sy,w,22);
      K.text(c,i+1,x+10,sy+11,11,r===P?C.cyan:C.muted);
      K.text(c,r.ch.short||r.ch.name,x+30,sy+11,11,r===P?C.ice:C.text,'left',w-89);
      if(r.dead||r.finished) K.text(c,r.dead?'РЕМОНТ':'ФИНИШ',x+w-8,sy+11,9,C.muted,'right',53);
    });
  }
  /** Переносит текст, ограничивая высоту; слишком длинная реплика завершается многоточием. */
  function lines(c,value,width,size,maxLines=3) {
    const rows=layoutLines(c,String(value),width,size,F_B);
    const shown=rows.slice(0,maxLines);
    if(rows.length>maxLines) {
      c.font=size+'px '+F_B;
      let tail=shown[maxLines-1];
      while(tail.length&&c.measureText(tail+'…').width>width) tail=tail.slice(0,-1);
      shown[maxLines-1]=tail+'…';
    }
    return shown;
  }
  /** Возвращает живые реплики из штатной очереди, включая игрока и соперников вне экрана. */
  function activeVoices() {
    if(typeof voiceTick==='function') voiceTick();
    if(typeof VOICE==='undefined'||!R||labTest) return [];
    const seen=new Set();
    return VOICE.shown.filter(s=>s.r&&R.racers.includes(s.r)&&R.time>=s.t0&&R.time-s.t0<s.life)
      .slice().reverse().filter(s=>{if(seen.has(s.r))return false;seen.add(s.r);return true;}).slice(0,2).reverse();
  }
  /** Две компактные выноски с именем и портретом говорящего в отдельной левой колонке. */
  function dialogues(c,box) {
    let y=box.dialogue.y;
    const {x,w,h}=box.dialogue, bottom=y+h;
    for(const s of activeVoices()) {
      const available=Math.floor((bottom-y-42)/16);
      if(available<1) break;
      const pad=K.spacing.inset, textX=x+pad+30, textWidth=w-pad*2-30;
      const rows=lines(c,s.text,textWidth,12,Math.min(3,available)), height=42+rows.length*16;
      const color=s.r.isP?C.cyan:C.gold;
      const alpha=typeof voiceAlpha==='function'?voiceAlpha(s):1;
      c.save();c.globalAlpha=alpha;K.frame(c,x,y,w,height,color);
      const portrait=typeof avatarImage==='function'&&avatarImage(s.r.ch);
      if(portrait&&typeof drawLeaderAvatar==='function') drawLeaderAvatar(c,s.r.ch,x+pad+10,y+19,20);
      K.text(c,(s.r.ch.short||s.r.ch.name)+(s.r.isP?' · ВЫ':''),textX,y+19,10,color,'left',textWidth);
      rows.forEach((row,i)=>K.text(c,row,textX,y+40+i*16,12,C.text,'left',textWidth));
      K.path(c,[[x+pad+6,y+height],[x+pad+14,y+height],[x+pad+6,y+height+4]]);c.fillStyle=color;c.fill();c.restore();
      y+=height+K.spacing.gap;
    }
  }
  /** Объявление ведущего временно занимает узкую строку под таймером. */
  function broadcast(c,msg,box) {
    if(!msg||!msg.txt) return;
    const w=Math.min(330,box.width*.4), rows=lines(c,msg.txt,w-24,12,2), x=(box.width-w)/2,y=70;
    c.save();c.globalAlpha=clamp((3.4-msg.t)/.5,0,1);K.frame(c,x,y,w,14+rows.length*15,msg.big?C.red:C.cyan);
    rows.forEach((row,i)=>K.text(c,row,x+12,y+14+i*15,12,C.text,'left',w-24));c.restore();
  }
  /** Собирает компактный HUD, сохраняя штатные данные оружия и голосовую очередь. */
  function paint(detailed,c) {
    const ui=viewport(),box=layout(ui.width,ui.height);
    c.save();c.setTransform(ui.scale,0,0,ui.scale,0,0);
    panels.vehicle(c,box.vehicle);clock(c,box.clock);objective(c,box.task);
    panels.speed(c,box.speed);panels.arsenal(c,box.arsenal);panels.radar(c,box.map,true);
    standings(c,box,detailed);dialogues(c,box);
    if(R.endTimer>0) K.text(c,(R.endTimerType==='player'?'ДО СХОДА: ':'ДО ФИНИША: ')+Math.ceil(R.endTimer)+' С',ui.width/2,57,11,C.red,'center');
    if(R.msg) broadcast(c,R.msg,box);
    if(saveFlash>0) K.text(c,'СОХРАНЕНО',box.task.x+box.task.w,box.task.y+box.task.h+10,10,C.cyan,'right');
    if(R.hintT>0) {
      const free=!Object.values(settings.controls||{}).some(keys=>Array.isArray(keys)&&keys.includes('F6'));
      K.text(c,labTest?'ESC — В ЛАБОРАТОРИЮ':free?'F6 — ПОЗИЦИИ   ESC — ПАУЗА':'ESC — ПАУЗА',ui.width/2,box.arsenal.y-12,10,C.muted,'center');
    }
    c.restore();return box;
  }
  /** Общий композитор сохраняет ровную середину и изгибает только периферию HUD. */
  function draw(detailed=false) {
    DiVANEngine.hudCurvature.render(g,c=>paint(detailed,c));
  }
  /** Места всех машин рисует общий слой combatHud; прежний медальон отключён. */
  DiVANEngine.replace('drawPlayerRaceTag',function() {});
  DiVANEngine.cyberHud={draw,layout,viewport,activeVoices};
})();
