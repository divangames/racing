// Кадровый цикл: время не замедляется при падении частоты до 15–30 FPS.
function frame(now){
 const dt=Math.min(.1,Math.max(0,(now-last)/1000));last=now;gt+=dt;
 if(window.RnRVfx&&RnRVfx.ok)RnRVfx.tick(state==='race'&&paused?0:dt);
 fpsSmooth=lerp(fpsSmooth,1/dt,.1);
 if(saveFlash>0)saveFlash-=dt;
 if(garMsgT>0)garMsgT-=dt;
 if(cheatMsgT>0)cheatMsgT-=dt;
 updateView();
 g.setTransform(1,0,0,1,0,0);
 g.fillStyle='#050409';g.fillRect(0,0,cv.width,cv.height);
 if(viewOX>0||viewOY>0){
  const gr=g.createLinearGradient(0,0,0,cv.height);
  gr.addColorStop(0,'#0a0815');gr.addColorStop(1,'#1a1028');
  g.fillStyle=gr;g.fillRect(0,0,cv.width,cv.height);
 }
 g.setTransform(viewS,0,0,viewS,viewOX,viewOY);
 if(state==='results'&&R){
  if(R.msg){R.msg.t+=dt;if(R.msg.t>3.4)R.msg=null;}
  const n=(R.order&&R.order.length)||0;
  if(n){
   const reduce=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
   if(reduce)R.announcerT=99;
   else R.announcerT=(R.announcerT||0)+dt;
  }
 }
 if(state==='race'&&!paused)updRace(dt);
 if(state==='press'||state==='title'||state==='settings'||state==='cameraSetup')updateTitleRace(dt);
 updEngine(P,paused,state);
 if(CHIP.on)CHIP.pump();
 if(state==='intro'&&!introDone){
  const sc=introScenes()[introFrame];
  if(sc&&introCur<sc.text.length){
   introPrintT+=dt;
   const step=0.028;
   while(introPrintT>=step&&introCur<sc.text.length){
    introPrintT-=step;introCur++;
   }
  }
  if(keys.Space){
   introSkipT+=dt;
   if(introSkipT>=INTRO_SKIP_HOLD){endIntro(true);sClick();}
  }else introSkipT=0;
 }
 if(typeof worldIntroTick==='function')worldIntroTick(dt);
 if(AU.ctx&&state!=='intro'&&state!=='worldIntro'){const mc=musicCat();if(mc!==lastMusicCat){lastMusicCat=mc;MUSIC.play(mc);}}
 if(state==='press'||state==='title'||state==='settings'||state==='cameraSetup'){
  if(state==='press'){pollPressStartPad();drawPressStart();}
  else if(state==='title')drawTitle();
  else if(state==='cameraSetup')drawCameraSetup();
  else drawSettings();
 }
 else if(state==='help')drawHelp();
 else if(state==='achievements')drawAchievements();
 else if(state==='cheats')drawCheats();
 else if(state==='tracks')drawTrackPick();
 else if(state==='slotSelect')drawSlotSelect();
 else if(state==='char'){drawCharSel();if(bioOpen>=0)drawBio();}
 else if(state==='intro')drawIntro();
 else if(state==='worldIntro'){
  try{if(typeof drawWorldIntro==='function')drawWorldIntro();}catch(e){console.error(e);}
 }
 else if(state==='car')drawCarSel();
 else if(state==='junkTune'){
  if(typeof drawJunkTune==='function')drawJunkTune();
  else {state='garage';drawGarage();}
 }
 else if(state==='garage')drawGarage();
 else if(state==='gym')drawGym();
 else if(state==='armory')drawArmory();
 else if(state==='autopark')drawAutopark();
 else if(state==='detail')drawCarDetail();
 else if(state==='prerace')drawPreRace();
 else if(state==='career')drawCareer();
 else if(state==='careerTracks')drawCareerTracks();
 else if(state==='results')drawResults();
 else if(state==='race'){drawRaceWorld();drawHUD();}
 g.setTransform(1,0,0,1,0,0);
 if(settings.graphics.showFps){
  g.fillStyle='#58ff6b';g.font='12px monospace';
  g.fillText(Math.round(fpsSmooth)+' FPS',10,20);
 }
 requestAnimationFrame(frame);}

