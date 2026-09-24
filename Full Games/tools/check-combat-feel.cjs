// Проверяет весь автопарк на реальных статах и снимает боевой HUD в изолированном Electron.
'use strict';
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const output = path.resolve(__dirname, '../build/combat-feel-check');
fs.mkdirSync(output, { recursive: true });
app.setPath('userData', path.join(output, 'profile'));
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
require('../src/main/save-car').handleSaveCar = async () => new Response('{"ok":true}');
require('../src/main/save-track').handleSaveTrack = async () => new Response('{"ok":true}');
const protocol = require('../src/main/protocol');
protocol.registerPrivilegedScheme();

/** Ждёт загрузку игры, не заменяя её загрузчик. */
async function until(win, expression) {
  const started = Date.now();
  while (Date.now() - started < 60000) {
    if (await win.webContents.executeJavaScript(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Не дождались: ' + expression);
}
/** Берёт именно нарисованный Canvas: скрытый композитор Electron может отдавать предыдущий кадр. */
async function captureCanvas(win, name) {
  const data = await win.webContents.executeJavaScript("cv.toDataURL('image/png')");
  fs.writeFileSync(path.join(output,name),Buffer.from(data.split(',')[1],'base64'));
}
app.whenReady().then(async () => {
  protocol.attachProtocol();
  const win = new BrowserWindow({ show: false, width: 1440, height: 900,
    webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
  win.webContents.setAudioMuted(true);
  const errors = [];
  win.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
  await win.loadURL('rnr://game/rnr.html?lab=1&car=0');
  await until(win, "typeof R !== 'undefined' && !!R && !!P && BOOT.ready && !!DiVANEngine.combatHud");
  const metrics = await win.webContents.executeJavaScript(`(() => {
    paused = true;
    const originalRace = R, originalPlayer = P;
    const results = [];
    try {
      for (const car of CARS) {
        const idx = car.idx;
        const create = () => {
          const r = makeRacer(CHARS[1], CARS[idx], true, blankTune(), 0, { noAiScale: true });
          Object.assign(r, { x: 5000, y: 5000, ang: 0, spd: 240, invuln: 100, chIdx: -1 });
          R = { S: [{ x: 5000, y: 5000 }], N: 1, T: { w: 20000, h: 20000, theme: {} },
            oils: [], ramps: [], racers: [r], parts: [], skids: [], shortcuts: [] };
          P = r; return r;
        };
        const step = (r, gas, steer, hand = false) => {
          R.S[0].x = r.x; R.S[0].y = r.y;
          stepVehicle(r, gas, steer, 1 / 120, hand);
        };
        let r = create(), ticks = 0;
        while (r.spd > .5 && ticks++ < 240) step(r, -1, 0);
        const brakeDistance = r.x - 5000, brakeSeconds = ticks / 120;
        r = create(); for (let i = 0; i < 48; i++) step(r, 1, 1);
        const turnRadians = r.ang;
        r = create(); for (let i = 0; i < 48; i++) step(r, 1, 1, true);
        const slide = Math.abs(r.lat), drifting = kitSliding(r);
        for (let i = 0; i < 72; i++) step(r, 1, 0);
        const recoveredSlide = Math.abs(r.lat);
        r = create();
        R.weather = { id: 'rain', mod: .4 }; R.T.theme.deco = 'ice';
        for (let i = 0; i < 120; i++) step(r, 1, 0);
        const wetStraightAngle = r.ang;
        const weapon = carAbil(idx).weapon;
        const weaponState = DiVANEngine.combatHud.weaponState(r, weapon, wepMagMax(r), kitOverheat(r, weapon));
        results.push({ idx, name: car.name, profile: DiVANEngine.handling.profile(car).name, hover: !!car.hov,
          brakeDistance, brakeSeconds, turnRadians, slide, recoveredSlide, drifting, wetStraightAngle, weapon: weapon.type, weaponState });
      }
    } finally { R = originalRace; P = originalPlayer; }
    return results;
  })()`);
  assert(metrics.every(m => [m.brakeDistance, m.turnRadians, m.slide].every(Number.isFinite)));
  assert(metrics.length >= 21);
  const light = metrics.find(m => m.idx === 7), balanced = metrics.find(m => m.idx === 0), heavy = metrics.find(m => m.idx === 4);
  assert(light.brakeDistance < balanced.brakeDistance && balanced.brakeDistance < heavy.brakeDistance);
  assert(light.turnRadians > balanced.turnRadians && balanced.turnRadians > heavy.turnRadians);
  assert(metrics.every(m => m.hover ? m.slide === 0 && m.recoveredSlide === 0 : m.recoveredSlide < m.slide * .3));
  assert(metrics.every(m => m.wetStraightAngle === 0));
  const drifter = metrics.find(m => m.idx === 8);
  assert(drifter.drifting); assert.equal(drifter.weaponState.text, 'НУЖЕН ЗАНОС');
  await win.webContents.executeJavaScript(`(() => {
    labTest = false; buildRace(); R.phase = 'go'; R.countT = 0; R.hintT = 0; R.msg = null;
    P.invuln = 0; P.shield = 0; P.bubble = 0; P.spd = 170; P.ang = 0;
    const enemy = R.racers.find(r => r !== P); enemy.x = P.x + 110; enemy.y = P.y + 55; enemy.invuln = 0; enemy.shield = 0;
    R.mines = [{ x: P.x + 80, y: P.y - 35, arm: 0, dead: false }];
    R.shots = [{ x: P.x - 100, y: P.y, vx: 450, vy: 0, life: 1, r: enemy, dmg: 10 }];
    dmgRacer(P, 20, enemy, 'ram'); dmgRacer(enemy, 15, P, 'proj');
    P.wepAmmo = 2; P.wepOver = 0; P.cdW = 0;
    R.cam.x = P.x - visW() / 2; R.cam.y = P.y - visH() / 2;
    R.sx = R.sy = 0;
    // Останавливаем только проверочный цикл, чтобы снимки содержали один и тот же момент боя.
    state = 'combat-capture'; paused = false;
    const paint = DiVANEngine.screens.paint;
    DiVANEngine.screens.paint = scene => {
      if (scene === 'combat-capture') { drawRaceWorld(); drawHUD(); }
      else paint(scene);
    };
  })()`);
  const shots = [];
  for (const [width, height] of [[1920, 1080], [1440, 900], [1280, 720], [800, 600], [640, 360], [2560, 1080], [3840, 2160]]) {
    win.setSize(width, height);
    await new Promise(resolve => setTimeout(resolve, 150));
    const info = await win.webContents.executeJavaScript(`(() => {
      settings.graphics.combatHud = true; applyResolution(); updateView();
      R.cam.x = P.x - visW() / 2; R.cam.y = P.y - visH() / 2;
      drawRaceWorld(); drawHUD();
      const ui = DiVANEngine.combatHud.viewport();
      return { width: ui.width, height: ui.height, scale: ui.scale, box: DiVANEngine.combatHud.layout(ui.width, ui.height), panels: DiVANEngine.cyberHud.layout(ui.width, ui.height), curvature: DiVANEngine.hudCurvature.status(), threats: DiVANEngine.combatHud.threats(R, P).length };
    })()`);
    assert(info.threats > 0);
    assert(info.curvature.active,'Искривление HUD не активировалось');
    if(width===3840) assert.equal(info.scale,3,'На 4K HUD остался слишком мелким');
    const regions = ['vehicle','clock','task','speed','arsenal','map'].map(k=>info.panels[k]);
    for(const [i, a] of regions.entries()) {
      assert(a.x>=0 && a.y>=0 && a.x+a.w<=info.width+.01 && a.y+a.h<=info.height+.01);
      for(const b of regions.slice(i+1)) assert(a.x+a.w<=b.x || b.x+b.w<=a.x || a.y+a.h<=b.y || b.y+b.h<=a.y);
    }
    const coverage=regions.reduce((sum,b)=>sum+b.w*b.h,0)/(info.width*info.height);
    assert(coverage<(info.panels.small?.22:.2),'Постоянный HUD превысил лимит площади экрана');
    info.coverage=coverage;
    await captureCanvas(win,'combat-'+width+'.png');
    shots.push(info);
  }
  // Проверяем живые состояния, которые не видны на обычном стартовом кадре.
  win.setSize(1920,1080);
  await new Promise(resolve=>setTimeout(resolve,150));
  const states = [];
  for(const scenario of ['low-health','reload','dead','feed','full','countdown','pause','lab','dialogue','dialogue-full','dialogue-small','dialogue-expired']) {
    if(scenario==='dialogue-small'||scenario==='dialogue-expired') {
      win.setSize(scenario==='dialogue-small'?640:1920,scenario==='dialogue-small'?360:1080);
      await new Promise(resolve=>setTimeout(resolve,150));
    }
    const result = await win.webContents.executeJavaScript(`(() => {
      const scenario = ${JSON.stringify(scenario)};
      applyResolution(); updateView(); paused=false; R.phase='go'; R.time=24; R.msg=null; labTest=false;
      settings.graphics.combatHud=true; P.dead=false; P.hp=P.maxhp; P.wepOver=0; P.cdW=0; P.cdU=0; P.cdN=0; P.bubble=0; P.shield=0;
      voiceReset();
      if(scenario==='low-health') { P.hp=P.maxhp*.17; P.shield=2; P.bubble=2.8; }
      if(scenario==='reload') { P.car=CARS[9]; P.wepAmmo=0; P.wepOver=2.3; P.cdN=6.4; P.cdU=8.2; }
      if(scenario==='dead') { P.dead=true; P.hp=0; P.respawnT=1.7; }
      if(scenario==='feed') {
        const r=R.racers.find(r=>r!==P); r.dead=false; killRacer(r,P); P.moneyGot+=120;
        R.msg={txt:'ФИНАЛЬНЫЙ КРУГ — ЖГИ!',t:1,big:true};
      }
      if(scenario==='full') settings.graphics.combatHud=false;
      if(scenario==='countdown') { R.phase='count'; R.countT=4; }
      if(scenario==='pause') paused=true;
      if(scenario==='lab') { labTest=true; P.bestLap=54.25; P.lastLap=57.13; }
      if(scenario.startsWith('dialogue')) {
        const rival=R.racers.find(r=>r!==P); rival.dead=false;
        // Тестовые дубли проходят штатный voiceSay, как реплики из банка персонажа.
        for(const [r,text] of [[P,'Держу курс.'],[rival,'Не уйдёшь!']]) {
          const bank=VOICE.banks[r.chIdx];
          VOICE.banks[r.chIdx]={cues:[{id:'hud-test',takes:[{text}]}]};
          voiceSay(r,'hud-test',{force:true}); VOICE.banks[r.chIdx]=bank;
        }
        R.time+=scenario==='dialogue-expired'?4:.2;
        if(scenario==='dialogue-full') settings.graphics.combatHud=false;
      }
      R.cam.x=P.x-visW()/2; R.cam.y=P.y-visH()/2;
      const labels=[], proto=CanvasRenderingContext2D.prototype, originalText=proto.fillText;
      proto.fillText=function(value,...args) { labels.push(String(value)); return originalText.call(this,value,...args); };
      try { drawRaceWorld(); drawHUD(); } finally { proto.fillText=originalText; }
      const ab=carAbil(P.car.idx);
      return {scenario,labels,weapon:DiVANEngine.combatHud.weaponState(P,ab.weapon,wepMagMax(P),kitOverheat(P,ab.weapon))};
    })()`);
    if(scenario==='dead') assert.equal(result.weapon.ready,false);
    if(scenario==='reload') assert.match(result.weapon.text,/ПЕРЕЗАРЯДКА/);
    const expected={ 'low-health':'КРИТИЧЕСКОЕ ПОВРЕЖДЕНИЕ', reload:'ПЕРЕЗАРЯДКА', dead:'НЕДОСТУПНО', feed:'ФИНАЛЬНЫЙ КРУГ', pause:'ПАУЗА', countdown:'ПРИГОТОВЬТЕСЬ...',lab:'ЛУЧШИЙ' }[scenario];
    if(expected) assert(result.labels.some(t=>t.includes(expected)),scenario+': текст состояния не попал в кадр');
    if(scenario.startsWith('dialogue')) for(const phrase of ['Держу курс.','Не уйдёшь!']) {
      assert.equal(result.labels.includes(phrase),scenario!=='dialogue-expired',scenario+': неверная видимость реплики '+phrase);
    }
    if(!['pause','countdown'].includes(scenario)) {
      assert.equal(result.labels.filter(t=>t==='МИНИГАН').length,scenario==='low-health'?0:1,'Оружие продублировано');
      assert.equal(result.labels.filter(t=>t==='ПРЫЖОК').length,scenario==='low-health'?0:1,'Ускоритель продублирован');
    }
    await captureCanvas(win,'hud-'+scenario+'.png');
    states.push(result);
  }
  const modes = await win.webContents.executeJavaScript(`(() => {
    state = 'race'; paused = true; drawRaceWorld(); drawHUD();
    dispatchEvent(new KeyboardEvent('keydown', { code: 'F6' }));
    const full = settings.graphics.combatHud === false;
    dispatchEvent(new KeyboardEvent('keydown', { code: 'F6' }));
    return { full, compact: settings.graphics.combatHud === true };
  })()`);
  assert(modes.full && modes.compact); assert.deepEqual(errors, []);
  const result = { metrics, shots, states, modes, errors };
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  win.destroy(); app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
