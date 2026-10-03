// Контракт вкладки «Редактор глав» и общего документа миссии 01.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('редактор содержит отдельную вкладку, три рабочие области и модули главы', () => {
  const html = read('content/Editor.html');
  assert.match(html, /data-tab="chapter"[^>]*>Редактор глав</);
  assert.match(html, /id="workChapter"/);
  assert.match(html, /id="chapterPoints"/);
  assert.match(html, /id="chapterSceneList"/);
  assert.match(html, /editor\/chapter-data\.js/);
  assert.match(html, /editor\/chapter-track-editor\.js/);
  assert.match(html, /editor\/chapter-editor\.js/);
  assert.match(html, /id="chapterGroundSrc"/);
  assert.match(html, /id="chapterRoadSrc"/);
  assert.match(html, /id="chapterRailSrc"/);
});

test('документ миссии хранит точки запуска, секции комиксов, трассу и баланс', () => {
  const chapter = JSON.parse(read('content/chapters/mission-01.json'));
  const points = chapter.points.map((point) => point.id);
  assert.equal(chapter.id, 'mission-01');
  assert.ok(points.includes('INTRO'));
  assert.ok(points.includes('CHAPTER_INTRO'));
  assert.ok(points.includes('GREEN_HOLD'));
  assert.ok(points.includes('BRIDGE_APPROACH'));
  assert.ok(points.includes('BRIDGE_COLLAPSE'));
  assert.ok(points.includes('BRAKE_HIT'));
  assert.ok(points.includes('DRIFT_STOP'));
  assert.ok(points.includes('DRIFT_SETTLE'));
  assert.ok(points.includes('PLAYER_CLOSEUP'));
  assert.ok(points.includes('SEPARATION_SHOT'));
  assert.ok(points.includes('GAP_TRAVERSE'));
  assert.ok(points.includes('TRUCK_FOCUS'));
  assert.ok(points.includes('TRUCK_ESCAPE'));
  assert.ok(points.includes('AFTERMATH_RETURN'));
  assert.ok(points.includes('POST_COMIC'));
  assert.ok(points.includes('GARAGE'));
  const comics = Object.fromEntries(chapter.comicSections.map((section) => [section.runtimeKey, section.scenes]));
  assert.ok(comics.chapterIntroScenes.length >= 7);
  assert.ok(comics.introScenes.length >= 3);
  assert.ok(comics.postScenes.length >= 6);
  assert.equal(chapter.track.roadHalfWidth, 95);
  assert.equal(chapter.track.theme.crowdSound, false);
  assert.equal(chapter.config.redZoneTime, 5);
  assert.equal(chapter.config.greenZoneTime, 5);
  assert.equal(chapter.config.truckBaseSpeed, .82);
  assert.equal(chapter.config.pressureLearnEnd, 15);
  assert.equal(chapter.config.pressureGreenMin, 1.8);
  assert.equal(chapter.config.pressureRedMax, 5.2);
  assert.equal(chapter.config.weaponOverheatTime, 1.8);
  assert.equal(chapter.config.introTruckHoldTime, 15);
  assert.equal(chapter.config.bridgeCollapseTime, .38);
  assert.equal(chapter.config.bridgeBrakeSnapTime, .24);
  assert.equal(chapter.config.bridgeDriftTime, .86);
  assert.equal(chapter.config.bridgePlayerCloseTime, 1.05);
  assert.equal(chapter.config.bridgeTraverseTime, 1.4);
  assert.equal(chapter.config.bridgeEscapeTime, 5);
  assert.equal(chapter.config.bridgeReturnTime, 1.8);
  assert.ok(comics.cinematicScenes.every(scene => points.includes(scene.id)));
  assert.equal(chapter.config.attackWarningTime, .8);
  assert.equal(chapter.config.chaseFarCameraZoom, 1.12);
  assert.equal(comics.postScenes[0].speaker, 'БЕСТИЯ');
  assert.match(comics.postScenes[0].image, /chapters\/assets\/mission-01\/chase-outro-bridge\.png$/);
});

test('все кадры погони показывают Бестию и ссылаются на доступные изображения', () => {
  const chapter = JSON.parse(read('content/chapters/mission-01.json'));
  const sections = Object.fromEntries(chapter.comicSections.map(section => [section.runtimeKey, section.scenes]));
  const chaseScenes = [...sections.cinematicScenes, ...sections.introScenes, ...sections.postScenes];
  assert.doesNotMatch(JSON.stringify(chaseScenes), /Янот|ЯНОТ|Бричк|БРИЧК/);
  assert.match(sections.chapterIntroScenes.at(-1).image, /chapter-intro-bestia\.png$/);
  for (const scene of [...sections.chapterIntroScenes, ...chaseScenes]) {
    if (!scene.image || scene.image.startsWith('assets/')) continue;
    assert.ok(fs.existsSync(path.join(root, 'content', scene.image)), `Нет кадра ${scene.id}: ${scene.image}`);
  }
});

test('черновик запускается из любой точки и возвращается в редактор', () => {
  const editor = read('content/editor/chapter-editor.js');
  const runtime = read('src/engine/story-chapter-content.js');
  const boot = read('src/engine/boot-gate.js');
  assert.match(editor, /rnr\.chapterDraft\.v1/);
  assert.match(editor, /chapterTest:\s*'1'/);
  assert.match(editor, /point:\s*selectedPoint/);
  assert.match(runtime, /storyBearChaseApplyPoint\(point, sceneIndex\)/);
  assert.match(runtime, /save = newSave\(\)/);
  assert.match(runtime, /testMode[^\n]*engine\.wrap\('persist'/);
  assert.match(runtime, /tab:\s*'chapter'/);
  assert.match(boot, /labTest[^\n]*\|\| global\.storyChapterTestMode/);
  assert.match(boot, /chapterTest \? 'ТЕСТ ГЛАВЫ'/);
});

test('пустое и опасное значение баланса не ломает погоню', () => {
  const source = read('src/engine/story-chapter-content.js');
  const context = {console, URLSearchParams, location: {search: ''},
    fetch: () => Promise.resolve({ok: false}),
    MISSION_01: {truckBaseSpeed: .82, bridgeCollapseTime: .38, pressureGreenMin: 1.8,
      barrelRollSpeed:228, bridgeTruckTravelSpeed:330, nitroSpeedMultiplier:1.13}};
  context.window = context; context.globalThis = context;
  vm.runInNewContext(source, context);
  context.RnRChapterContent.applyConfig({config: {
    truckBaseSpeed: '', bridgeCollapseTime: 0, pressureGreenMin: -4,
    barrelRollSpeed:250, bridgeTruckTravelSpeed:340, nitroSpeedMultiplier:1.2
  }});
  assert.equal(context.MISSION_01.truckBaseSpeed, .82);
  assert.equal(context.MISSION_01.bridgeCollapseTime, .02);
  assert.equal(context.MISSION_01.pressureGreenMin, .02);
  assert.equal(context.MISSION_01.barrelRollSpeed,250);
  assert.equal(context.MISSION_01.bridgeTruckTravelSpeed,340);
  assert.equal(context.MISSION_01.nitroSpeedMultiplier,1.2);
  assert.equal(context.RnRChapterContent.normalize({track:{curveAmount:0}}).track.curveAmount,0);
  const editor = read('content/editor/chapter-balance-editor.js');
  assert.match(editor, /input\.value\.trim\(\) === ''/);
  assert.match(editor, /input\.min = String\(range\[0\]\)/);
});

test('локальный протокол умеет читать и сохранять главы и кадры', () => {
  const protocol = read('src/main/protocol.js');
  const storage = read('src/main/save-chapter.js');
  assert.match(protocol, /\/__chapters/);
  assert.match(protocol, /\/__save-chapter/);
  assert.match(protocol, /\/__save-chapter-frame/);
  assert.match(storage, /writeDocument\(target, document\)/);
  assert.match(storage, /MAX_IMAGE_BYTES/);
  assert.match(storage, /\[a-z0-9_\-\]\{1,63\}/);
});

test('игровой модуль главы загружается до погони и главного цикла', () => {
  const engine = JSON.parse(read('config/engine.json'));
  const scripts = engine.hosts.game.scripts;
  const chapter = scripts.indexOf('story-chapter-content.js');
  assert.ok(chapter > scripts.indexOf('story-chase.js'));
  assert.ok(chapter < scripts.indexOf('loop.js'));
});
