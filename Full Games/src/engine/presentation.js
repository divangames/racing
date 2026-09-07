// Приборная панель, свет нитро и ограниченный по бюджету слой частиц движения.
(() => {
  const C = {ink:'#0b141e', line:'#354451', text:'#edf4f5', mute:'#9aabb9', gold:'#f2c66d', cyan:'#73e8ef', red:'#ff715e'};
  const particles = [];
  let race = null;
  let simulationRace = null, accumulator = 0;
  const FIXED_STEP = 1 / 120;
  const originalStep = stepVehicle;
  const originalUpdate = updRace;
  const originalArena = drawRaceArena;
  const originalWorld = drawRaceWorld;
  const glow = document.createElement('canvas');
  glow.width = glow.height = 64;
  const gc = glow.getContext('2d');
  const gradient = gc.createRadialGradient(32,32,0,32,32,32);
  gradient.addColorStop(0,'rgba(123,237,255,.5)');
  gradient.addColorStop(.3,'rgba(50,162,240,.2)');
  gradient.addColorStop(1,'rgba(40,150,230,0)');
  gc.fillStyle = gradient; gc.fillRect(0,0,64,64);

  /** Бюджет частиц следует существующей настройке качества. */
  function budget() {
    return settings.graphics.particles === 'off' ? 0 : settings.graphics.particles === 'low' ? 48 : 140;
  }
  /** Дополняет физику редкими частицами пыли и торможения без новых таймеров. */
  stepVehicle = function(r, throttle, steer, dt, handbrake) {
    originalStep(r, throttle, steer, dt, handbrake);
    if (race !== R) { particles.length = 0; race = R; }
    if (!budget() || r.air || r.dead || r.car.hov || Math.abs(r.spd) < 70) return;
    const sliding = Math.abs(r.lat || 0) > 20 || r.handbrake;
    if (!sliding || Math.random() > dt * 24 || particles.length >= budget()) return;
    const fx = Math.cos(r.ang), fy = Math.sin(r.ang), side = Math.random() < .5 ? -1 : 1;
    particles.push({x:r.x-fx*20-fy*side*12,y:r.y-fy*20+fx*side*12,
      vx:-fx*35-fy*(r.lat||0)*.3,vy:-fy*35+fx*(r.lat||0)*.3,life:.65,t:.65,size:3+Math.random()*4});
  };
  /** Частицы замораживаются на паузе вместе с симуляцией. */
  updRace = function(dt) {
    if (simulationRace !== R) { accumulator = 0; simulationRace = R; }
    accumulator += Math.min(.1,Math.max(0,dt));
    // Не более 12 шагов за кадр: стабильная физика без бесконечного догоняющего цикла.
    let steps = 0;
    while(accumulator + 1e-9 >= FIXED_STEP && steps < 12) {
      originalUpdate(FIXED_STEP);
      accumulator -= FIXED_STEP; steps++;
      if(state !== 'race' || paused) { accumulator=0; break; }
    }
    for (let i=particles.length-1;i>=0;i--) {
      const p=particles[i]; p.t-=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.size+=dt*9;
      if(p.t<=0)particles.splice(i,1);
    }
  };
  /** Слой света и дыма использует мировую матрицу существующего рендера. */
  drawRaceArena = function() {
    originalArena();
    if (!budget()) return;
    g.save();
    for (const p of particles) {
      g.globalAlpha=(p.t/p.life)*.16;
      g.fillStyle='#c2c5bf';
      g.beginPath();g.arc(p.x,p.y,p.size,0,TAU);g.fill();
    }
    g.globalAlpha=1;
    g.globalCompositeOperation='screen';
    for(const r of R.racers) {
      if(r.dead || r.nitro<=0)continue;
      const x=r.x-Math.cos(r.ang)*28, y=r.y-Math.sin(r.ang)*28;
      g.drawImage(glow,x-45,y-45,90,90);
    }
    g.restore();
  };
  /** Мягкая виньетка и периферийные линии ускорения не закрывают дорогу. */
  drawRaceWorld = function() {
    originalWorld();
    if(!P)return;
    g.save();
    const shade=g.createRadialGradient(viewW/2,viewH/2,viewH*.3,viewW/2,viewH/2,viewW*.72);
    shade.addColorStop(0,'rgba(5,12,21,0)');shade.addColorStop(1,'rgba(5,12,21,.25)');
    g.fillStyle=shade;g.fillRect(0,0,viewW,viewH);
    if(P.nitro>0 && hudMotionOk() && budget()) {
      g.strokeStyle='rgba(115,232,239,.23)';g.lineWidth=1;
      for(let i=0;i<12;i++) {
        const y=(i*71+gt*180)%viewH, len=18+(i%4)*12;
        g.beginPath();g.moveTo(0,y);g.lineTo(len,y-6);g.moveTo(viewW,y);g.lineTo(viewW-len,y-6);g.stroke();
      }
    }
    g.restore();
  };
  /** Подпись в приборном блоке с единым шрифтом и базовой линией. */
  function label(c,text,x,y,size,color=C.text,align='left') {
    c.fillStyle=color;c.font=`600 ${size}px ${F_B}`;c.textAlign=align;c.textBaseline='middle';c.fillText(text,x,y);
  }
  /** Новый HUD оставляет исходные кулдауны, магазины и назначенные пользователем клавиши. */
  drawHudCockpit = function(c, width, height) {
    const w=Math.min(650,width-32),h=100,x=(width-w)/2,y=height-h-12;
    const fx=hudFx||{hp:clamp(P.hp/P.maxhp,0,1),spd:Math.abs(P.spd)*.45,ready:[0,0,0]};
    const speed=Math.round(fx.spd), boosted=P.nitro>0||P.bolt>0;
    const color=boosted?C.cyan:C.gold;
    c.save();
    c.shadowColor='rgba(0,0,0,.4)';c.shadowBlur=18;
    panel(c,x,y,w,h,'rgba(9,18,27,.94)',C.line,8);
    c.shadowBlur=0;
    c.fillStyle=color;c.fillRect(x+16,y,58,2);
    label(c,'ТЕЛЕМЕТРИЯ',x+16,y+17,9,C.mute);
    label(c,String(speed).padStart(3,'0'),x+16,y+52,40,color);
    label(c,'КМ/Ч',x+109,y+66,9,C.mute);
    const gear=P.spd < -5?'R':Math.abs(P.spd)<4?'N':String(Math.min(6,Math.floor(Math.abs(P.spd)/Math.max(P.st.top,1)*5)+1));
    label(c,gear,x+126,y+36,19,C.text);
    const ratio=clamp(Math.abs(P.spd)/Math.max(P.st.top,1),0,1);
    for(let i=0;i<20;i++) {c.fillStyle=i/20<ratio?color:'#25313b';c.fillRect(x+16+i*6.5,y+84,4,4);}
    const mid=x+168,barW=w-365;
    label(c,'ЦЕЛОСТНОСТЬ КОРПУСА',mid,y+19,9,C.mute);
    label(c,Math.round(clamp(P.hp/P.maxhp,0,1)*100)+'%',mid+barW,y+19,11,C.text,'right');
    c.fillStyle='#24303b';c.fillRect(mid,y+33,barW,5);
    c.fillStyle=fx.hp>.3?C.cyan:C.red;c.fillRect(mid,y+33,barW*fx.hp,5);
    const status=P.dead?'ВОССТАНОВЛЕНИЕ':P.air?'В ПОЛЁТЕ':P.nitro>0?'НИТРО АКТИВНО':P.handbrake?'РУЧНОЙ ТОРМОЗ':Math.abs(P.lat||0)>25?'ЗАНОС':P.bubble>0?'КУПОЛ · '+Math.ceil(P.bubble)+' С':P.shield>0?'ЩИТ · '+P.shield:'СЦЕПЛЕНИЕ С ТРАССОЙ';
    label(c,status,mid,y+59,10,P.dead?C.red:boosted?C.cyan:C.gold);
    label(c,'БОЕВОЙ КОНТУР  /  '+(P.finished?'ФИНИШ':'АКТИВЕН'),mid,y+81,8,C.mute);
    const ab=carAbil(P.car.idx),mag=wepMagMax(P),heatMax=kitOverheat(P,ab.weapon),gat=ab.weapon.type==='gatling';
    const fill=mag>0?(P.wepOver>0?clamp(1-P.wepOver/heatMax,0,1):P.wepAmmo/mag):gat?(P.wepOver>0?clamp(1-P.wepOver/heatMax,0,1):1-(P.wepHeat||0)):null;
    const key=action=>prettyKey((settings.controls[action]||[{fire:'KeyZ',nitro:'KeyX',ult:'KeyC'}[action]])[0]);
    const hot=mag>0?(P.wepOver>0?String(Math.ceil(P.wepOver)):String(P.wepAmmo|0)):gat&&P.wepOver>0?String(Math.ceil(P.wepOver)):key('fire');
    drawHudSkillOrb(c,x+w-146,y+48,22,'ОРУЖИЕ',hot,mag>0||gat?P.wepOver||0:P.cdW,mag>0||gat?heatMax:kitWepCd(P,ab.weapon),C.red,fx.ready[0],fill);
    drawHudSkillOrb(c,x+w-88,y+48,22,ab.nitro.type==='jump'?'ПРЫЖОК':'НИТРО',key('nitro'),P.cdN,ab.nitro.cd,C.cyan,fx.ready[1]);
    drawHudSkillOrb(c,x+w-30,y+48,22,'УЛЬТА',key('ult'),P.cdU,kitUltCd(P,ab.ult),C.gold,fx.ready[2]);
    c.restore();
  };
  window.RnREngine={version:'0.2.2.3',particleCount:()=>particles.length};
})();
