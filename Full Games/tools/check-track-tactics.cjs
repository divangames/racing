// Проверяет сценарий редактор → черновой заезд → возврат и снимает фазы тактического поворота.
'use strict';
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const output = path.resolve(__dirname, '../build/track-tactics-check');
fs.mkdirSync(output, { recursive: true }); app.setPath('userData', path.join(output, 'profile'));
app.disableHardwareAcceleration(); app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
let writes = 0;
require('../src/main/save-track').handleSaveTrack = async () => { writes++; return new Response('{"ok":true}'); };
require('../src/main/save-car').handleSaveCar = async () => new Response('{"ok":true}');
const protocol = require('../src/main/protocol'); protocol.registerPrivilegedScheme();
/** Ждёт состояние страницы, включая смену документа после теста. */
async function until(win, expression) {
  const start = Date.now();
  while (Date.now() - start < 60000) {
    try { if (await win.webContents.executeJavaScript(expression)) return; } catch (error) {}
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error('Не дождались: ' + expression);
}
app.whenReady().then(async () => {
  protocol.attachProtocol();
  const win = new BrowserWindow({ show: false, width: 1440, height: 900,
    webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
  win.webContents.setAudioMuted(true);
  const errors = []; win.webContents.on('console-message', e => { if (e.level === 'error') { errors.push(e.message); console.error(e.message); } });
  await win.loadURL('rnr://game/Editor.html?tab=map');
  await until(win, "typeof MapApp !== 'undefined' && !!MapApp.getDocument && !document.getElementById('lab-splash') && !!document.getElementById('mapTacticsMode')");
  const editor = await win.webContents.executeJavaScript(`(() => {
    MapApp.importDocument(RnRTracks.STOCK[0]);
    const select = document.getElementById('mapTacticsMode');
    select.value = 'heat'; select.dispatchEvent(new Event('change', {bubbles:true}));
    const snapshot = MapData.fileTrack(MapApp.getDocument());
    document.getElementById('mapUndoBtn').click(); const undone = MapApp.getDocument().tactics;
    document.getElementById('mapRedoBtn').click();
    document.querySelector('.studio-tactics').scrollIntoView();
    return { id: snapshot.id, mode: snapshot.tactics.mode, undo: undone, redo: MapApp.getDocument().tactics.mode };
  })()`);
  assert.equal(editor.mode, 'heat'); assert.equal(editor.redo, 'heat'); assert.notEqual(editor.undo && editor.undo.mode, 'heat');
  await new Promise(resolve => setTimeout(resolve, 700));
  fs.writeFileSync(path.join(output, 'editor.png'), (await win.webContents.capturePage()).toPNG());
  await win.webContents.executeJavaScript("document.getElementById('mapTestBtn').click()");
  await until(win, "location.pathname.endsWith('/rnr.html') && typeof R !== 'undefined' && !!R && R.phase === 'go' && !!R.T.tactics");
  const measurements = await win.webContents.executeJavaScript(`(() => {
    paused = true; const p = R.T.tactics, i = Math.floor((p.a + p.b) / 2), s = R.S[i];
    R._tacticStart = 0; R.time = p.period - p.active + .1;
    const damage = (side, isP) => {
      const r = {...P, isP, hp: P.maxhp, invuln:0, bubble:0, shield:0, air:false, trackIdx:i,
        x:s.x+s.nx*p.side*48*side, y:s.y+s.ny*p.side*48*side, _tacticDamage:0};
      paused = false;
      for(let n=0;n<120;n++) DiVANEngine.tactics.affect(r,1/120);
      return r.maxhp-r.hp;
    };
    const result = { mode:p.mode, short:p.shortLength, long:p.longLength, risky:damage(1,true), safe:damage(-1,true), ai:damage(1,false), shortcuts:R.shortcuts.length };
    const feedback = DiVANEngine.combatHud.feedback();
    if(feedback.incoming) feedback.incoming.at = -1000;
    P.x=s.x;P.y=s.y;P.trackIdx=i;P.spd=0;P.invuln=100;
    R.cam.x=P.x-visW()/2;R.cam.y=P.y-visH()/2;R.msg=null;R.hintT=0;R.sx=R.sy=0;
    state='tactic-capture';paused=false;
    const paint=DiVANEngine.screens.paint;
    DiVANEngine.screens.paint = value => { if(value==='tactic-capture'){drawRaceWorld();drawHUD();}else paint(value); };
    return result;
  })()`);
  assert(measurements.short < measurements.long); assert(measurements.risky > 0); assert.equal(measurements.safe, 0);
  assert.equal(measurements.ai, measurements.risky); assert.equal(measurements.shortcuts, 0);
  for (const phase of ['warning', 'active']) {
    const screenshot = await win.webContents.executeJavaScript(`(() => {
      R.time=R.T.tactics.period-R.T.tactics.active-(${phase === 'warning' ? '2' : '-1'});
      drawRaceWorld();drawHUD();return g.canvas.toDataURL('image/png');
    })()`);
    fs.writeFileSync(path.join(output, phase + '.png'), Buffer.from(screenshot.split(',')[1], 'base64'));
  }
  await win.webContents.executeJavaScript('exitLabTest()');
  await until(win, "location.pathname.endsWith('/Editor.html') && typeof MapApp !== 'undefined' && !!MapApp.getDocument && MapApp.getDocument().tactics?.mode === 'heat' && !document.getElementById('lab-splash')");
  assert.equal(writes, 0); assert.deepEqual(errors, []);
  const result = { editor, measurements, writes, errors };
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2));
  win.destroy(); app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
