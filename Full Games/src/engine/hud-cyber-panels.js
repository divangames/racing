// Живые приборы киберпанк-HUD: машина, спидометр, вооружение и круглая тактическая карта.
(function () {
  'use strict';
  const K = DiVANEngine.cyberKit, C = K.colors;
  /** Состояние корпуса: одна шкала, защита появляется только когда активна. */
  function vehicle(c, box) {
    const {x,y,w,h}=box, pad=K.spacing.inset; K.frame(c,x,y,w,h);
    const hp=clamp(P.hp/Math.max(1,P.maxhp),0,1);
    K.text(c,'КОРПУС',x+pad,y+16,11,C.muted);
    K.text(c,Math.max(0,Math.ceil(P.hp))+' / '+Math.round(P.maxhp),x+w-pad,y+16,13,hp<.25?C.red:C.ice,'right');
    K.meter(c,x+pad,y+29,w-pad*2,5,hp,hp<.25?C.red:C.cyan,20);
    const protection=P.dead?'ВОССТАНОВЛЕНИЕ '+Math.max(0,P.respawnT).toFixed(1)+' С':P.bubble>0?'КУПОЛ '+P.bubble.toFixed(1)+' С':P.shield>0?'ЩИТ · '+P.shield+' ЗАР.':P.invuln>0?'НЕУЯЗВИМОСТЬ':'';
    const critical=!P.dead&&hp<.25;
    K.text(c,critical?'КРИТИЧЕСКОЕ ПОВРЕЖДЕНИЕ':protection||P.car.name,x+pad,y+44,11,critical||P.dead?C.red:protection?C.cyan:C.muted,'left',w-pad*2);
  }
  /** Круговой спидометр: светящаяся дуга, насечки и крупные цифры в компактной рамке. */
  function speed(c, box) {
    const width=160, height=132, cx=80, cy=80, radius=62, ticks=36;
    const start=Math.PI*.88, sweep=Math.PI*1.24;
    const velocity=Math.abs(P.spd), ratio=clamp(velocity/Math.max(1,P.st.top),0,1);
    begin(c,box,width,height); K.frame(c,0,0,width,height);
    c.strokeStyle=C.line; c.lineWidth=1;
    for(const r of [radius+5,radius-12]) {
      c.beginPath(); c.arc(cx,cy,r,start,start+sweep); c.stroke();
    }
    for(let i=0;i<ticks;i++) {
      const fraction=i/(ticks-1), angle=start+sweep*fraction;
      const inner=radius-(i%5===0?10:6);
      c.strokeStyle=fraction<=ratio?(fraction>.8?C.red:C.cyan):fraction>.8?'#66273b':'#1a4050';
      c.lineWidth=i%5===0?2.5:1.5;
      c.beginPath();c.moveTo(cx+Math.cos(angle)*inner,cy+Math.sin(angle)*inner);
      c.lineTo(cx+Math.cos(angle)*radius,cy+Math.sin(angle)*radius);c.stroke();
    }
    if(ratio>0) {
      c.save();c.strokeStyle=ratio>.8?C.red:C.cyan;c.shadowColor=c.strokeStyle;c.shadowBlur=6;c.lineWidth=2;
      c.beginPath();c.arc(cx,cy,radius-3,start,start+sweep*ratio);c.stroke();c.restore();
    }
    c.save();c.transform(1,0,-.12,1,9,0);c.shadowColor=C.cyan;c.shadowBlur=7;
    K.text(c,String(Math.round(velocity*.45)).padStart(3,'0'),cx,77,38,C.ice,'center',110,true);c.restore();
    K.text(c,'КМ/Ч',cx,103,11,C.muted,'center');
    if(P.air||P.handbrake) K.text(c,P.air?'В ПОЛЁТЕ':'РУЧНИК',cx,122,9,C.ice,'center');
    c.restore();
  }
  /** Единственное место для оружия, ульты и нитро: клавиша, название и одно состояние. */
  function arsenal(c, box) {
    const {x,y,w,h}=box, ab=carAbil(P.car.idx), mag=wepMagMax(P);
    const state=DiVANEngine.combatHud.weaponState(P,ab.weapon,mag,kitOverheat(P,ab.weapon));
    const nitroMax=Math.max(1,ab.nitro.cd*(1-(P.chIdx===1?skillVal(1,P.skillLvl):0))-(P.nitLvl||0)*.6);
    const slots=[
      {action:'fire',name:ab.weapon.name,text:state.text,ratio:state.ratio,ready:state.ready},
      {action:'ult',name:ab.ult.name,text:P.cdU>0?P.cdU.toFixed(1)+' С':'ГОТОВО',ratio:1-P.cdU/kitUltCd(P,ab.ult),ready:P.cdU<=0},
      {action:'nitro',name:ab.nitro.type==='jump'?'ПРЫЖОК':'НИТРО',text:P.cdN>0?P.cdN.toFixed(1)+' С':'ГОТОВО',ratio:1-P.cdN/nitroMax,ready:P.cdN<=0}
    ];
    const widths=[w*.44,w*.3,w*.26]; let left=x;
    K.frame(c,x,y,w,h);
    slots.forEach((slot,i)=> {
      const width=widths[i], color=!P.dead&&slot.ready?C.cyan:C.muted;
      const pad=K.spacing.inset;
      if(i) {c.fillStyle=C.line;c.fillRect(left,y+12,1,h-24);}
      K.keycap(c,K.key(slot.action),left+pad,y+10,24);
      K.text(c,slot.name,left+pad+30,y+19,11,C.ice,'left',width-pad*2-30);
      K.text(c,P.dead?'НЕДОСТУПНО':slot.text,left+pad,y+40,11,P.dead?C.muted:slot.ready?C.text:C.gold,'left',width-pad*2);
      K.meter(c,left+pad,y+h-12,width-pad*2,3,P.dead?0:slot.ratio,color,12);
      left+=width;
    });
  }
  /** Вписывает геометрию радара в компактный квадрат. */
  function begin(c,box,w,h) {c.save();c.translate(box.x,box.y);c.scale(box.w/w,box.h/h);}
  /** Круглая карта трассы с ориентирами, финишем и живыми маркерами участников. */
  function radar(c, box, compact) {
    begin(c, box, 190, 190); K.frame(c, 0, 0, 190, 190);
    const cx = 95, cy = 95, radius = 76;
    c.strokeStyle = C.line; c.lineWidth = 1;
    for (const r of [radius+8,radius+3,radius*.67,radius*.33]) { c.beginPath(); c.arc(cx,cy,r,0,Math.PI*2); c.stroke(); }
    c.save(); c.beginPath(); c.arc(cx,cy,radius,0,Math.PI*2); c.clip();
    c.fillStyle = 'rgba(10,37,51,.6)'; c.fillRect(cx-radius,cy-radius,radius*2,radius*2);
    c.strokeStyle = '#153542'; c.lineWidth = 1;
    for (let i=-3;i<=3;i++) { c.beginPath(); c.moveTo(cx-radius,cy+i*24); c.lineTo(cx+radius,cy+i*24); c.moveTo(cx+i*24,cy-radius); c.lineTo(cx+i*24,cy+radius); c.stroke(); }
    if (R.map && R.map.pts && R.map.pts.length) {
      // Диагональ проекции вписывается в окружность, поэтому край трассы не пропадает под маской.
      const m = R.map, sc = (radius-10)*2 / Math.max(1, Math.hypot(m.mw,m.mh));
      const ox = cx-m.mw*sc/2, oy = cy-m.mh*sc/2;
      const project = (x,y) => DiVANEngine.hud.project(x,y,m,ox,oy,sc);
      c.beginPath(); m.pts.forEach((p,i) => i ? c.lineTo(ox+p[0]*sc,oy+p[1]*sc) : c.moveTo(ox+p[0]*sc,oy+p[1]*sc)); c.closePath();
      c.lineJoin = 'round'; c.lineWidth = 8; c.strokeStyle = '#1d3f50'; c.stroke();
      c.lineWidth = 2; c.strokeStyle = '#6992a5'; c.stroke();
      for (const p of R.picks || []) if(p.alive) { const xy=project(p.x,p.y); c.fillStyle=C.cyan; c.fillRect(xy[0]-1.5,xy[1]-1.5,3,3); }
      if(R.S && R.S[0]) { const xy=project(R.S[0].x,R.S[0].y); K.icon(c,'diamond',xy[0],xy[1],12,C.gold); }
      for(const r of R.racers) if(!r.dead && r!==P) {
        const xy=project(r.x,r.y); K.path(c,[[xy[0]-4,xy[1]-4],[xy[0]+4,xy[1]-4],[xy[0],xy[1]+4]]); c.fillStyle=C.red; c.fill();
      }
      if(!P.dead) {
        const xy=project(P.x,P.y); c.save(); c.translate(xy[0],xy[1]); c.rotate(P.ang);
        c.shadowColor=C.cyan; c.shadowBlur=10; K.path(c,[[9,0],[-6,-5],[-3,0],[-6,5]]); c.fillStyle=C.cyan; c.fill(); c.restore();
      }
    }
    c.restore();
    K.text(c,'С',cx,cy-radius-10,10,C.ice,'center'); K.text(c,'Ю',cx,cy+radius+10,10,C.ice,'center');
    K.text(c,'З',cx-radius-10,cy,10,C.ice,'center'); K.text(c,'В',cx+radius+10,cy,10,C.ice,'center');
    c.restore();

  }
  DiVANEngine.cyberPanels = { vehicle, speed, arsenal, radar };
})();
