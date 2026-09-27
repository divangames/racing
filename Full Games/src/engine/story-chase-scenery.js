// Геометрия мостового полотна и разрушение: тот же биом, глубина, секции, арматура и пыль.
(function (global) {
  'use strict';
  const CFG = global.MISSION_01, Model = global.RnRStoryChaseModel, Bridge = global.RnRStoryChaseBridge;
  if (!CFG || !Model || !Bridge) return;
  const clamp = Model.clamp;
  const fracture = [0, 1, -2, -2, 3, 2, 1, -1, 0, 4, 2, -3, -2, 1, 0, -1,
    -4, -1, 2, 1, -2, 0, 3, 2, -1, -2, 1, 0, -3, -1, 0];

  function point(model, y, offset) {
    return {x: Model.roadCenter(model, y) + offset, y: y};
  }

  function line(ctx, points) {
    ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.stroke();
  }

  function edge(model, y, half, sign) {
    return fracture.map((v, i) => point(model, y + v * sign, -half + i * half * 2 / (fracture.length - 1)));
  }

  function polygon(ctx, points) {
    ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.closePath();
  }

  /** Опоры и тени под бортами показывают высоту моста уже с первого кадра. */
  function structure(ctx, model, bounds, half) {
    const span = 220, origin = Math.floor((bounds.top - model.scroll) / span) * span + model.scroll;
    ctx.save(); ctx.lineCap = 'butt';
    for (let y = origin; y < bounds.bottom; y += span) {
      const center = Model.roadCenter(model, y);
      [-1, 1].forEach(side => {
        const x = center + side * (half + 17);
        ctx.fillStyle = 'rgba(9,6,10,.3)'; ctx.fillRect(x - 6 + 9, y + 12, 14, 58);
        ctx.fillStyle = '#292b2b'; ctx.fillRect(x - 6, y - 25, 12, 50);
        ctx.fillStyle = '#756859'; ctx.fillRect(x - 5, y - 24, 3, 48);
        ctx.strokeStyle = '#8e7760'; ctx.lineWidth = 3;
        line(ctx, [{x:x, y:y-21},{x:x+side*12, y:y},{x:x, y:y+21}]);
        ctx.fillStyle = '#dbab57'; ctx.fillRect(x - 3, y - 22, 6, 4);
      });
      ctx.strokeStyle = 'rgba(14,16,21,.5)'; ctx.lineWidth = 2;
      line(ctx, [point(model, y, -half), point(model, y, half)]);
      ctx.strokeStyle = 'rgba(192,179,148,.2)'; ctx.lineWidth = 1;
      line(ctx, [point(model, y+2, -half), point(model, y+2, half)]);
    }
    const studs = Math.floor((bounds.top - model.scroll) / 54) * 54 + model.scroll;
    for (let y = studs; y < bounds.bottom; y += 54) {
      [-1, 1].forEach(side => {
        const x = Model.roadCenter(model, y) + side * (half + 6);
        ctx.fillStyle = '#e2b768'; ctx.fillRect(x-1.5, y-2.5, 3, 5);
      });
    }
    ctx.restore();
  }

  /** Полупрозрачный край облака, без видимых дисков частиц. */
  function puff(ctx, x, y, radius, alpha, color) {
    if (alpha <= 0 || radius <= 0) return;
    const gradient = ctx.createRadialGradient(x-radius*.15, y-radius*.2, 1, x, y, radius);
    gradient.addColorStop(0, 'rgba(' + color + ',' + alpha + ')');
    gradient.addColorStop(.48, 'rgba(' + color + ',' + alpha*.65 + ')');
    gradient.addColorStop(1, 'rgba(' + color + ',0)');
    ctx.fillStyle = gradient; ctx.fillRect(x-radius, y-radius, radius*2, radius*2);
  }

  /** Секции проваливаются с наклоном и уменьшаются в глубине; пыль остаётся дольше огня. */
  function fallingDeck(ctx, model, centerY, half, theme) {
    const t = model.bridgeBlastTime || 0, length = CFG.bridgeGapLength;
    for (let i=0; i<8; i++) {
      const age = t - .2 - i*.065;
      if (age < 0 || age > 1.65) continue;
      const fall = clamp(age / 1.65, 0, 1), scale = 1 - fall*.82;
      const x = Model.roadCenter(model, centerY) + (i%2 ? 1 : -1) * half*.47;
      const y = centerY + (Math.floor(i/2)-1.5)*length*.23 + fall*fall*72;
      ctx.save(); ctx.translate(x, y); ctx.rotate((i%2 ? 1 : -1)*fall*.75); ctx.scale(scale,scale);
      ctx.globalAlpha = 1 - fall*fall;
      const slab = [{x:-half*.46,y:-length*.115},{x:-half*.13,y:-length*.105},
        {x:half*.06,y:-length*.14},{x:half*.48,y:-length*.10},{x:half*.44,y:length*.04},
        {x:half*.3,y:length*.06},{x:half*.42,y:length*.12},{x:-half*.48,y:length*.09}];
      polygon(ctx, slab); ctx.fillStyle = theme.road; ctx.fill();
      const strip=global.DiVANEngine && DiVANEngine.trackStrip;
      const texture=strip && strip.bakeRoadStrip('asphalt',theme.road);
      if(texture) {ctx.save(); ctx.clip(); ctx.drawImage(texture,-half*.5,-length*.15,half,length*.3); ctx.restore();}
      ctx.lineWidth = 1.5; ctx.strokeStyle = '#746958'; ctx.stroke();
      ctx.strokeStyle = '#24212a'; ctx.lineWidth = 1;
      line(ctx,[{x:-half*.3,y:-12},{x:4,y:5},{x:-5,y:12},{x:half*.4,y:17}]);
      if (i%2) {ctx.fillStyle = theme.line; ctx.fillRect(-half*.39,-10,2,16);}
      ctx.restore();
    }
    for (let i=0; i<26; i++) {
      const age = t - i%5*.07;
      if (age < 0 || age > 2.5) continue;
      const life = 1-age/2.5, angle = i*2.399, speed = 12+i%7*7;
      const x = Model.roadCenter(model,centerY) + Math.cos(angle)*speed*age;
      const y = centerY + Math.sin(angle)*speed*age + age*age*22;
      ctx.save(); ctx.translate(x,y); ctx.rotate(angle+age); ctx.globalAlpha=life;
      ctx.fillStyle = i%3 ? '#574d45' : '#a69071'; ctx.fillRect(-3,-2,(4+i%4)*life,4*life); ctx.restore();
    }
  }

  /** Огонь появляется в момент удара опор, затем уступает место пыли и оголённой арматуре. */
  function explosions(ctx, model, centerY, half) {
    (model.bridgeBlastEvents || []).forEach(event => {
      const age = event.age, x = Model.roadCenter(model,centerY)+event.side*half*.7;
      const y = centerY+event.side*8;
      if (age < .68) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        puff(ctx,x,y,30+age*44,Math.max(0,1-age/.68)*.85,'255,146,42');
        ctx.restore();
        // Заряд в опоре: неровные огненные языки без огромного спрайта самой бочки.
        for(let i=0;i<14;i++) {
          const angle=i*2.399+event.id, distance=(9+i%5*4)*Math.sin(age/.68*Math.PI*.7);
          const px=x+Math.cos(angle)*distance, py=y+Math.sin(angle)*distance-age*18;
          const radius=(8+i%4*2)*(1+age), alpha=Math.max(0,1-age/.68);
          puff(ctx,px,py,radius*1.8,alpha*.75,'120,48,20');
          puff(ctx,px,py,radius,alpha*.95,'245,104,25');
          puff(ctx,px,py,radius*.45,alpha,'255,217,125');
        }
        ctx.save(); ctx.strokeStyle='rgba(255,200,106,'+(1-age/.68)+')'; ctx.lineWidth=1;
        for(let i=0;i<18;i++) {
          const angle=i*2.399, travel=age*(90+i%5*24);
          line(ctx,[{x:x+Math.cos(angle)*travel,y:y+Math.sin(angle)*travel},
            {x:x+Math.cos(angle)*(travel+5),y:y+Math.sin(angle)*(travel+5)}]);
        }
        ctx.restore();
      }
      for(let i=0;i<6;i++) {
        const life=Math.max(0,1-age/CFG.bridgeBlastVisualTime);
        puff(ctx,x+(i-2.5)*12+age*(i-2.5)*7,y-age*(15+i*3),14+age*19,
          Math.min(.6,age*2)*life,'75,65,58');
      }
    });
  }

  /** Рваная бетонная кромка вместо ровной чёрной перекладины. */
  function brokenLip(ctx, model, points, sign, time) {
    ctx.save(); ctx.lineJoin='miter'; ctx.lineCap='butt';
    polygon(ctx, points.concat(points.slice().reverse().map(p=>({x:p.x+2,y:p.y+sign*8}))));
    ctx.fillStyle='#28252a'; ctx.fill();
    ctx.strokeStyle='#655b50'; ctx.lineWidth=2; line(ctx,points);
    ctx.strokeStyle='rgba(185,165,137,.45)'; ctx.lineWidth=.7; line(ctx,points);
    for(let i=1;i<points.length-1;i++) {
      const p=points[i];
      if(i%3===0) {
        ctx.strokeStyle=i%2?'#81705b':'#403b38'; ctx.lineWidth=1;
        line(ctx,[p,{x:p.x+4,y:p.y+sign*(8+i%4*3)},{x:p.x+7,y:p.y+sign*(10+i%4*3)}]);
      }
      if(time<4 && i%2===0) puff(ctx,p.x,p.y-time*6,10+time*7,Math.max(0,.15-time*.03),'113,96,76');
    }
    ctx.restore();
  }

  function draw(ctx, model, theme, ground, bounds) {
    const half=Model.trackSettings().roadHalfWidth;
    structure(ctx,model,bounds,half);
    if(!Bridge.active(model)) return;
    const progress=model.bridgeCollapse||0, centerY=Bridge.gapScreenY(model,Model.screenHeight());
    const length=CFG.bridgeGapLength*progress;
    const top=centerY-length*.48, bottom=centerY+length*.52;
    if(length>1) {
      const upper=edge(model,top,half+13,-1), lower=edge(model,bottom,half+13,1);
      ctx.save(); polygon(ctx,upper.concat(lower.slice().reverse())); ctx.clip();
      ground(model,theme);
      const shade=ctx.createLinearGradient(0,top,0,bottom);
      shade.addColorStop(0,'rgba(10,9,14,.85)'); shade.addColorStop(.35,'rgba(20,17,23,.55)');
      shade.addColorStop(.75,'rgba(20,17,23,.55)'); shade.addColorStop(1,'rgba(10,9,14,.88)');
      ctx.fillStyle=shade; ctx.fillRect(Model.roadCenter(model,centerY)-half-40,top-15,half*2+80,length+30);
      fallingDeck(ctx,model,centerY,half,theme); ctx.restore();
      brokenLip(ctx,model,upper,1,model.bridgeBlastTime);
      brokenLip(ctx,model,lower,-1,model.bridgeBlastTime);
    }
    if(model.phase==='BRIDGE_APPROACH' || length<3) {
      const reveal=model.phase==='BRIDGE_APPROACH' ? clamp((model.phaseTime/CFG.bridgeApproachTime-.35)/.65,0,1) : 1;
      ctx.save(); ctx.globalAlpha=reveal*.8; ctx.strokeStyle='#1b171b'; ctx.lineWidth=2;
      line(ctx,edge(model,centerY,half,1)); ctx.restore();
    }
    explosions(ctx,model,centerY,half);
  }

  global.RnRStoryChaseScenery={draw,puff};
})(typeof window!=='undefined'?window:globalThis);
