// Приборная панель, свет машин и ограниченная по бюджету кинетика заезда.
(() => {
  const C = {ink:'#0b141e', line:'#354451', text:'#edf4f5', mute:'#9aabb9', gold:'#f2c66d', cyan:'#73e8ef', red:'#ff715e'};
  const particles = [];
  let race = null;
  let vehicles = new WeakMap(), speedFeel = 0, impactFeel = 0;
  let simulationRace = null, accumulator = 0;
  const FIXED_STEP = 1 / 120;
  const reducedMotion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const bounded = (value, lo, hi) => Math.max(lo, Math.min(hi, value));

  function motionOk() {
    return !(reducedMotion && reducedMotion.matches) && (typeof hudMotionOk !== 'function' || hudMotionOk());
  }
  function quality() {
    const value = settings.graphics.particles;
    return value === 'off' ? 0 : value === 'low' ? 1 : value === 'medium' ? 2 : 3;
  }
  /** Бюджет применяется также при переключении настроек посреди заезда. */
  function budget() {
    return motionOk() ? [0, 32, 84, 140][quality()] : 0;
  }
  function syncRace() {
    if (race === R) return;
    race = R; particles.length = 0; vehicles = new WeakMap(); speedFeel = impactFeel = 0;
  }
  function vehicleFx(r) {
    let fx = vehicles.get(r);
    if (!fx) { fx = { trail: [], sample: 0, dust: 0, serial: 0, brake: false }; vehicles.set(r, fx); }
    return fx;
  }
  /** Вектор реального перемещения: эффект сохраняет направление во время заноса и реверса. */
  function velocity(r) {
    const fx = Math.cos(r.ang), fy = Math.sin(r.ang), side = r.lat || 0;
    return { x: fx * r.spd - fy * side, y: fy * r.spd + fx * side };
  }
  function speedIntensity(r) {
    if (!r || r.dead || r.finished || Math.abs(r.spd) < 80) return 0;
    const top = Math.max(100, r.st && r.st.top || 400);
    const fast = bounded((Math.abs(r.spd) / top - .68) / .6, 0, 1);
    return bounded(fast * .65 + (r.nitro > 0 || r.bolt > 0 ? .55 : 0), 0, 1);
  }
  /** Маленький след исчезает за четверть секунды и никогда не соединяет телепорты. */
  function sampleTrail(r, fx, dt) {
    const active = motionOk() && quality() > 1 && !r.dead && !(r.cloak > 0) &&
      (r.nitro > 0 || r.bolt > 0) && Math.abs(r.spd) > 80;
    if (!active) { fx.sample = 0; return; }
    fx.sample += dt;
    if (fx.sample < 1 / 30) return;
    fx.sample %= 1 / 30;
    const scale = typeof carBodyScale === 'function' ? carBodyScale(r.car.idx) : 1;
    const x = r.x - Math.cos(r.ang) * 27 * scale;
    const y = r.y - (r.z || 0) - Math.sin(r.ang) * 27 * scale;
    const last = fx.trail[fx.trail.length - 1];
    if (last && Math.hypot(last.x - x, last.y - y) > 80) fx.trail.length = 0;
    fx.trail.push({ x, y, t: .24 });
    if (fx.trail.length > 9) fx.trail.shift();
  }
  /** Частота эмиссии привязана к симуляции, а не к частоте монитора. */
  DiVANEngine.wrap('stepVehicle', function (originalStep) {
    return function(r, throttle, steer, dt, handbrake) {
      originalStep(r, throttle, steer, dt, handbrake);
      syncRace();
      const fx = vehicleFx(r);
      fx.brake = !!handbrake || (throttle < -.1 && r.spd > 12) || (throttle > .1 && r.spd < -12);
      sampleTrail(r, fx, dt);
      const max = budget();
      const sliding = Math.abs(r.lat || 0) > 20 || r.handbrake;
      if (!max || !sliding || r.air || r.dead || r.cloak > 0 || r.car.hov || Math.abs(r.spd) < 70) { fx.dust = 0; return; }
      fx.dust += dt;
      const period = quality() === 1 ? .2 : .075;
      if (fx.dust < period || particles.length >= max) return;
      fx.dust %= period;
      const forward = Math.cos(r.ang), across = Math.sin(r.ang), side = ++fx.serial % 2 ? -1 : 1;
      const snow = R.weather && R.weather.id === 'snow';
      const rain = R.weather && R.weather.id === 'rain';
      const life = rain ? .26 : .4;
      particles.push({ x:r.x-forward*20-across*side*12, y:r.y-across*20+forward*side*12,
        vx:-forward*26-across*(r.lat||0)*.3, vy:-across*26+forward*(r.lat||0)*.3,
        life, t:life, size:rain?2:3+(fx.serial%3), col:snow?'#dcecf2':rain?'#8bb9d1':'#bfb6a2' });
    };
  });
  function tickVisuals(dt) {
    syncRace();
    const max = budget(), animated = motionOk();
    if (particles.length > max) particles.length = max;
    if (!animated) { R.sx = R.sy = 0; impactFeel = 0; }
    const target = animated && quality() > 1 && typeof P !== 'undefined' ? speedIntensity(P) : 0;
    speedFeel = animated ? speedFeel + (target - speedFeel) * (1 - Math.exp(-7 * dt)) : 0;
    impactFeel = Math.max(0, impactFeel - dt * 2.6);
    for (const r of R.racers || []) {
      const fx = vehicles.get(r);
      if (!fx) continue;
      if (!animated || quality() < 2 || r.dead || r.cloak > 0) fx.trail.length = 0;
      for (let i = fx.trail.length - 1; i >= 0; i--) {
        fx.trail[i].t -= dt;
        if (fx.trail[i].t <= 0) fx.trail.splice(i, 1);
      }
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.size += dt * 9;
      if (p.t <= 0) particles.splice(i, 1);
    }
  }
  /** Частицы замораживаются на паузе вместе с симуляцией. */
  DiVANEngine.wrap('updRace', function (originalUpdate) {
    return function(dt) {
    if (simulationRace !== R) { accumulator = 0; simulationRace = R; }
    accumulator += Math.min(.25,Math.max(0,dt));
    // До 30 шагов покрывают кадр в 250 мс; более длинная пауза отбрасывается кадровым циклом.
    let steps = 0;
    while(accumulator + 1e-9 >= FIXED_STEP && steps < 30) {
      originalUpdate(FIXED_STEP);
      tickVisuals(FIXED_STEP);
      accumulator -= FIXED_STEP; steps++;
      if(state !== 'race' || paused) { accumulator=0; break; }
    }
    };
  });
  /** Свечение и след принадлежат слою машины; верхняя эстакада перекрывает их. */
  if (typeof drawCar === 'function') DiVANEngine.wrap('drawCar', function (originalCar) {
    return function(c, r, scale) {
      if (typeof state !== 'undefined' && state === 'race' && R && !r.dead && !(r.cloak > 0)) {
        syncRace();
        const fx = vehicles.get(r), q = quality();
        if (q > 1 && motionOk() && fx && fx.trail.length > 1) {
          c.save(); c.globalCompositeOperation = 'screen'; c.lineCap = 'round';
          const opacity = c.globalAlpha;
          for (let i = 1; i < fx.trail.length; i++) {
            const a = fx.trail[i - 1], b = fx.trail[i];
            const fade = bounded(a.t / .24, 0, 1);
            c.globalAlpha = opacity * fade * .28; c.strokeStyle = '#25b6ea'; c.lineWidth = 8 * fade + 2;
            c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
            c.globalAlpha = opacity * fade * .5; c.strokeStyle = '#c2faff'; c.lineWidth = 1.5;
            c.stroke();
          }
          c.restore();
        }
        if (DiVANEngine.carFx && DiVANEngine.carFx.drawDrivingLights && (q > 1 || r.isP)) {
          DiVANEngine.carFx.drawDrivingLights(c, r, { quality: q, brake: fx && fx.brake });
        }
      }
      return originalCar(c, r, scale);
    };
  });
  /** Слой дыма использует мировую матрицу существующего рендера. */
  DiVANEngine.wrap('drawRaceArena', function (originalArena) {
    return function() {
    originalArena();
    if (!budget()) return;
    g.save();
    for (const p of particles) {
      g.globalAlpha=(p.t/p.life)*.16;
      g.fillStyle=p.col;
      g.beginPath();g.arc(p.x,p.y,p.size,0,TAU);g.fill();
    }
    g.restore();
    };
  });
  // Подтверждённый урон даёт короткое мягкое свечение только у края экрана.
  if (typeof dmgRacer === 'function') DiVANEngine.wrap('dmgRacer', function (originalDamage) {
    return function(r, damage, attacker, source) {
      const before = r.hp, result = originalDamage(r, damage, attacker, source);
      if (R && r.isP && motionOk() && r.hp < before) {
        syncRace(); impactFeel = Math.min(1, impactFeel + (before - r.hp) / Math.max(1, r.maxhp) * 3 + .15);
      }
      return result;
    };
  });
  /** Периферийные линии следуют движению; центр дороги остаётся чистым. */
  DiVANEngine.wrap('drawRaceWorld', function (originalWorld) {
    return function() {
    originalWorld();
    if(!P)return;
    g.save();
    const q = quality(), animated = motionOk();
    if (q > 0) {
      const shade=g.createRadialGradient(viewW/2,viewH/2,viewH*.35,viewW/2,viewH/2,Math.max(viewW,viewH)*.68);
      shade.addColorStop(0,'rgba(5,12,21,0)');shade.addColorStop(1,'rgba(5,12,21,.23)');
      g.fillStyle=shade;g.fillRect(0,0,viewW,viewH);
    }
    if (q > 1 && animated && speedFeel > .015 && !P.dead) {
      const v = velocity(P), magnitude = Math.max(1, Math.hypot(v.x,v.y));
      const dx = v.x / magnitude, dy = v.y / magnitude, count = q === 2 ? 12 : 20;
      const time = R.time || 0;
      g.save(); g.beginPath(); g.rect(0,0,viewW,viewH); g.rect(76,66,Math.max(0,viewW-152),Math.max(0,viewH-132)); g.clip('evenodd');
      g.strokeStyle = P.nitro > 0 || P.bolt > 0 ? '#91eaff' : '#d4e5ef';
      g.lineWidth = 1;
      for (let i=0;i<count;i++) {
        const phase = (i*.61803398875 + time*.85)%1;
        const edge = i%4, along = ((i*137.5)%997)/997;
        let x = edge<2 ? (edge===0?32:viewW-32) : along*viewW;
        let y = edge>=2 ? (edge===2?26:viewH-26) : along*viewH;
        x -= dx*(phase-.5)*120; y -= dy*(phase-.5)*120;
        const length = 14 + speedFeel*46;
        g.globalAlpha = speedFeel*Math.sin(phase*Math.PI)*.3;
        g.beginPath();g.moveTo(x,y);g.lineTo(x-dx*length,y-dy*length);g.stroke();
      }
      g.restore();
    }
    if (q && animated && impactFeel > 0) {
      const edge = g.createRadialGradient(viewW/2,viewH/2,viewH*.45,viewW/2,viewH/2,Math.max(viewW,viewH)*.65);
      edge.addColorStop(0,'rgba(255,73,48,0)'); edge.addColorStop(1,'rgba(255,73,48,'+(impactFeel*.2)+')');
      g.fillStyle = edge; g.fillRect(0,0,viewW,viewH);
    }
    g.restore();
    };
  });
  /** Подпись в приборном блоке с единым шрифтом и базовой линией. */
  function label(c,text,x,y,size,color=C.text,align='left') {
    c.fillStyle=color;c.font=`600 ${size}px ${F_B}`;c.textAlign=align;c.textBaseline='middle';c.fillText(text,x,y);
  }
  /** Новый HUD оставляет исходные кулдауны, магазины и назначенные пользователем клавиши. */
  DiVANEngine.replace('drawHudCockpit', function(c, width, height) {
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
  });
  DiVANEngine.particleCount = function () { return particles.length; };
  DiVANEngine.presentation = {
    velocity, speedIntensity, budget,
    stats: () => ({ particles: particles.length, trails: (R && R.racers || []).reduce((n,r) => n + (vehicles.get(r)?.trail.length || 0),0), speed: speedFeel, impact: impactFeel })
  };
})();
