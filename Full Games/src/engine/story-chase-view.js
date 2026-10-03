// Отрисовка дороги, PitterMAX, игрока, бочек и комикса миссии 01.
(function (global) {
  'use strict';

  const CFG = global.MISSION_01;
  const Model = global.RnRStoryChaseModel;
  const Bridge = global.RnRStoryChaseBridge;
  if (!CFG || !Model || !Bridge) return;
  const BARREL_SPRITE = 'assets/data/Missions/01/barrel.png';
  const EXPLOSION_SPRITE = 'assets/data/Missions/01/barrel_EXP.png';
  const truckImage = makeImage(global.PITTER_MAX && global.PITTER_MAX.sprites.cargo);
  const barrelImage = makeImage(BARREL_SPRITE);
  const explosionImage = makeImage(EXPLOSION_SPRITE);
  const comicImages = Object.create(null);
  let visibleBounds = {left: -1280, right: 2560, top: -720, bottom: 1440};

  const COMIC = [
    {who: 'БЕСТИЯ', text: 'Он не ушёл. Он показал, куда нам пока нельзя.', sub: 'За разрывом исчезает не цель, а приглашение продолжить.'},
    {who: 'МЕДВЕДЬ / БЕСТИЯ', text: 'МЕДВЕДЬ: «В памяти Camaro остался оригинал приказа». БЕСТИЯ: «Значит, они забрали не машину. Они забрали свидетеля».', sub: 'Медведь впервые называет настоящую цену погони.'},
    {who: 'МЕДВЕДЬ / БЕСТИЯ', text: 'МЕДВЕДЬ: «Крепление сломано снаружи. Они спешили только до моста». БЕСТИЯ: «После моста дорога одна».', sub: 'Погоня проиграна; расследование получило направление.'},
    {who: 'БЕСТИЯ / МЕДВЕДЬ', text: 'БЕСТИЯ: «Возвращаемся в гараж». МЕДВЕДЬ: «Мьёльнир не потянет грузовик?» БЕСТИЯ: «Он довёз нас. За PitterMAX пойдём на другой машине».', sub: 'Бестия предлагает собрать тяжёлую Колесницу для новой попытки.'},
    {who: 'БЕСТИЯ / МЕДВЕДЬ', text: 'БЕСТИЯ: «На боевую машину денег нет. На три кузова хватит». МЕДВЕДЬ: «Из этого?» БЕСТИЯ: «Колесницу строят с рамы».', sub: 'Три дешёвых кузова становятся первым выбором новой команды.'},
    {who: 'ГЛАВА 1', text: 'СОБЕРИ КОЛЕСНИЦУ', sub: 'Первую колесницу собирают не ради победы. Ради права продолжить погоню.  ENTER'}
  ];

  /** Создаёт изображение без ошибки в тестовом Node-окружении. */
  function makeImage(src) {
    if (!src || typeof Image === 'undefined') return null;
    const image = new Image(); image.src = src; return image;
  }

  /** Строит открытый сплайн дороги. */
  function roadSpline(model) {
    const points = [];
    const first = Math.floor(visibleBounds.top / 36) * 36;
    for (let y = first; y <= visibleBounds.bottom + 36; y += 36) points.push({x: Model.roadCenter(model, y), y: y});
    points.forEach(function (point, index) {
      const a = points[Math.max(0, index - 1)], b = points[Math.min(points.length - 1, index + 1)];
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
      point.nx = -dy / len; point.ny = dx / len;
    });
    return points;
  }

  /** Рисует повторяемый фон биома. */
  function drawGround(model, theme) {
    const b = visibleBounds;
    g.fillStyle = theme.ground; g.fillRect(b.left, b.top, b.right-b.left, b.bottom-b.top);
    let image = theme.groundSrc && global.RnRTracks ? RnRTracks.texOf(theme.groundSrc) : null;
    if ((!image || !image.complete) && typeof pickMapTile === 'function') image = pickMapTile(theme.map || 'sand');
    if (!image || !image.complete || !image.naturalWidth) return;
    const tile = 96 * (Number(theme.groundScale) || 1), shift = (model.scroll * .45) % tile;
    g.globalAlpha = .92;
    for (let y = Math.floor((b.top-shift)/tile)*tile+shift; y < b.bottom; y += tile) {
      for (let x = Math.floor(b.left/tile)*tile; x < b.right; x += tile) g.drawImage(image, x, y, tile, tile);
    }
    g.globalAlpha = 1;
  }

  /** Общая геометрия моста и каскад разрушения. */
  function drawBridgeDeck(model, theme) {
    if (global.RnRStoryChaseScenery) RnRStoryChaseScenery.draw(g, model, theme, drawGround, visibleBounds);
  }

  /** Рисует полотно и борта штатным ribbon-рендером. */
  function drawRoad(model) {
    const settings = Model.trackSettings(), theme = settings.theme, half = settings.roadHalfWidth;
    const points = roadSpline(model), ribbon = global.DiVANEngine && DiVANEngine.trackRibbon;
    drawGround(model, theme);
    const path = new Path2D();
    points.forEach(function (point, index) { index ? path.lineTo(point.x, point.y) : path.moveTo(point.x, point.y); });
    if (ribbon) ribbon.paintShoulder(g, path, half);
    g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = theme.road; g.lineWidth = half * 2; g.stroke(path);
    const custom = theme.roadSrc && global.RnRTracks ? RnRTracks.texOf(theme.roadSrc) : null;
    const roadTex = ribbon && ((custom && custom.complete && custom.naturalWidth && custom) ||
      (DiVANEngine.trackStrip && DiVANEngine.trackStrip.bakeRoadStrip('asphalt', theme.road)));
    let distance = points[0].y - model.scroll;
    for (let i = 0; roadTex && i < points.length - 1; i++) {
      ribbon.blitSeg(g, points[i], points[i + 1], roadTex, half, distance);
      distance += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    }
    g.save(); g.setLineDash([22, 16]); g.lineDashOffset = (points[0].y - model.scroll) % 38;
    g.strokeStyle = theme.line; g.lineWidth = 2.4; g.stroke(path); g.restore();
    const railTex = ribbon && ribbon.customRail(theme);
    [-1, 1].forEach(function (side) {
      const edge = points.map(function (point) { return {x: point.x + point.nx * side * (half + 5),
        y: point.y + point.ny * side * (half + 5), nx: point.nx, ny: point.ny}; });
      let railDistance = points[0].y - model.scroll;
      if (railTex) for (let i = 0; i < edge.length - 1; i++) {
        ribbon.blitSeg(g, edge[i], edge[i + 1], railTex, 6, railDistance, side > 0);
        railDistance += Math.hypot(edge[i + 1].x - edge[i].x, edge[i + 1].y - edge[i].y);
      } else {
        g.strokeStyle = '#8b3f25'; g.lineWidth = 6; g.beginPath();
        edge.forEach(function (point, index) { index ? g.lineTo(point.x, point.y) : g.moveTo(point.x, point.y); });
        g.stroke();
      }
    });
    drawBridgeDeck(model, theme);
  }

  /** Рисует PitterMAX с отдельной тенью и поворотом по касательной. */
  function drawTruck(model) {
    const x = Model.truckX(model), y = Model.truckY(model);
    g.save(); g.translate(x, y); g.rotate(Model.roadHeading(model, y));
    if (truckImage && truckImage.complete && truckImage.naturalWidth) {
      g.save(); g.translate(6, 7); g.globalAlpha = .34; g.filter = 'brightness(0)';
      g.drawImage(truckImage, -85, -34, 170, 68); g.restore();
      g.drawImage(truckImage, -85, -34, 170, 68);
    } else {
      g.fillStyle = 'rgba(0,0,0,.38)'; g.fillRect(-78, -26, 164, 62);
      g.fillStyle = '#302b2a'; g.fillRect(-82, -31, 164, 62);
      g.fillStyle = '#a42c20'; g.fillRect(-72, -20, 58, 40);
    }
    g.restore();
  }

  /** Рисует две шинные дорожки по реальной дуге заноса. */
  function drawSkidTrail(model) {
    const trail = model.bridgeSkidTrail || [];
    if (trail.length < 2) return;
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 2.5;
    [-1, 1].forEach(function (side) {
      let previous = null;
      trail.forEach(function (node, index) {
        const yOffset = Number.isFinite(node.yOffset) ? node.yOffset : Number(node.y) || 0;
        const roadTravel = Number.isFinite(node.scroll) ? Math.max(0, model.scroll - node.scroll) : 0;
        const y = (model.bridgeStartPlayerY || Model.playerAnchorY()) + yOffset + roadTravel;
        const angle = Model.roadHeading(model, y) + node.angle;
        const x = Model.roadCenter(model, y) + node.x;
        const wheelX = x - Math.cos(angle)*18 + Math.cos(angle + Math.PI / 2) * side * 11;
        const wheelY = y - Math.sin(angle)*18 + Math.sin(angle + Math.PI / 2) * side * 11;
        if(previous) {
          g.strokeStyle='rgba(10,9,11,' + ((.18+(node.strength||0)*.35)*Math.max(0,1-(node.age||0)/16)) + ')';
          g.beginPath(); g.moveTo(previous.x,previous.y); g.lineTo(wheelX,wheelY); g.stroke();
        }
        previous={x:wheelX,y:wheelY};
      });
    });
    g.restore();
  }

  /** Подчёркивает удар по тормозам: стоп-сигналы, дым и искры у колёс. */
  function drawBrakeEffects(model, x, y, angle) {
    const brake = model.bridgeBrake || 0, smoke = model.bridgeSlip || model.bridgeSmoke || 0;
    if (brake <= .01 && smoke <= .01) return;
    g.save(); g.translate(x, y); g.rotate(angle); g.globalCompositeOperation = 'lighter';
    [-13, 13].forEach(function (side) {
      const glow = g.createRadialGradient(-27, side, 1, -27, side, 8 + brake * 6);
      glow.addColorStop(0, 'rgba(255,52,27,' + (.9 * brake) + ')'); glow.addColorStop(1, 'rgba(255,20,8,0)');
      g.fillStyle = glow; g.beginPath(); g.arc(-27, side, 8 + brake * 6, 0, Math.PI * 2); g.fill();
    });
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = smoke * .42;
    for (let index = 0; index < 5; index++) {
      const puff = 7 + index * 2 + smoke * 7;
      if(global.RnRStoryChaseScenery) RnRStoryChaseScenery.puff(g,-22-index*5,(index-2)*8,puff*1.6,.55,'151,143,130');
    }
    if (smoke > .45) {
      g.globalAlpha = (smoke - .45) * 1.3; g.strokeStyle = '#ffb63d'; g.lineWidth = 1.8;
      for (let index = 0; index < 6; index++) {
        const side = index % 2 ? 14 : -14; g.beginPath(); g.moveTo(-17, side);
        g.lineTo(-35 - index * 4, side + (index - 2.5) * 5); g.stroke();
      }
    }
    g.restore();
  }

  /** Рисует «Мьёльнир» Бестии, включая остановку боком у разлома. */
  function drawPlayer(model) {
    const x = Model.playerScreenX(model), y = Model.playerScreenY(model);
    const angle = Model.roadHeading(model, y) + model.steerVisual * .1 + (model.bridgeDrift || 0);
    drawBrakeEffects(model, x, y, angle);
    try {
      const car = typeof CARS !== 'undefined' && (CARS[CFG.chaseCarIndex] || CARS[save.car]);
      const character = typeof CHARS !== 'undefined' && (CHARS[CFG.chaseDriverIndex] || CHARS[save.char]);
      if (car && typeof drawCar === 'function') {
        drawCar(g, {x: x, y: y, ang: angle,
          car: car, ch: character, nitro: model.nitroTime > 0 ? 1 : 0,
          wheelRot: model.scroll * .08, wheelAngle: model.steerVisual * .32,
          bob: model.shake * Math.sin(model.elapsed * 45) * 2}, 1);
        return;
      }
    } catch (error) {}
    g.save(); g.translate(x, y); g.fillStyle = '#c63825'; g.fillRect(-22, -42, 44, 84); g.restore();
  }

  /** Рисует пули, быстрое вращение бочек и взрывы. */
  function drawBarrels(model) {
    model.bullets.forEach(function (bullet) {
      g.fillStyle = '#fff4ad'; g.fillRect(bullet.x - 2, bullet.y - 13, 4, 20);
      g.fillStyle = 'rgba(255,112,28,.35)'; g.fillRect(bullet.x - 5, bullet.y - 2, 10, 18);
    });
    model.barrels.forEach(function (barrel) {
      if (barrel.state === 'EXPLOSION') {
        const frame = Math.min(7, Math.floor(barrel.explosionTime * CFG.explosionFrameRate));
        const fw = 384, fh = 512, size = 82;
        if (explosionImage && explosionImage.complete && explosionImage.naturalWidth) {
          g.drawImage(explosionImage, (frame % 4) * fw, Math.floor(frame / 4) * fh, fw, fh,
            barrel.x - size / 2, barrel.y - size / 2, size, size);
        } else {
          g.fillStyle = '#ff7422'; g.beginPath(); g.arc(barrel.x, barrel.y, 22 + frame * 4, 0, Math.PI * 2); g.fill();
        }
        return;
      }
      const bounce = Model.barrelBounce(barrel), scale = 1 + bounce.height / 280;
      const frame = Math.floor(barrel.age * CFG.barrelFrameRate) % 8;
      const fw = 1774 / 4, fh = 887 / 2, size = 30 * scale;
      g.save(); g.fillStyle = 'rgba(0,0,0,' + Model.mix(.42, .18, bounce.height / 34) + ')';
      g.beginPath(); g.ellipse(barrel.x, barrel.y + 10, 14 * (1 - bounce.height / 100), 6, 0, 0, Math.PI * 2); g.fill();
      if (barrelImage && barrelImage.complete && barrelImage.naturalWidth) {
        g.drawImage(barrelImage, (frame % 4) * fw, Math.floor(frame / 4) * fh, fw, fh,
          barrel.x - size / 2, barrel.y - bounce.height - size / 2, size, size);
      } else {
        g.fillStyle = '#b92f20'; g.fillRect(barrel.x - 10, barrel.y - bounce.height - 14, 20, 28);
      }
      g.restore();
    });
  }

  /** Тёплая подсветка платформы и компактная метка будущей полосы до реального сброса. */
  function drawAttackWarning(model) {
    if(model.phase!=='CHASE') return;
    (model.pendingDrops||[]).forEach(drop=>{
      if(drop.delay>drop.warning || drop.delay<=0) return;
      const spawn=Model.barrelSpawnPoint(model,drop.lane), y=Model.playerScreenY(model)-94;
      const x=Model.roadCenter(model,y)+drop.targetOffset;
      const progress=1-drop.delay/drop.warning;
      g.save(); g.strokeStyle='rgba(255,172,65,'+(.35+progress*.55)+')'; g.lineWidth=1.5;
      g.setLineDash([5,7]); g.beginPath(); g.moveTo(spawn.x,spawn.y+4); g.lineTo(x,y-22); g.stroke(); g.setLineDash([]);
      g.beginPath(); g.moveTo(x-12,y-6); g.lineTo(x,y+3); g.lineTo(x+12,y-6); g.stroke();
      g.lineWidth=2.5; g.beginPath(); g.arc(spawn.x,spawn.y,10,-Math.PI/2,-Math.PI/2+progress*Math.PI*2); g.stroke();
      g.restore();
    });
  }

  /** Рисует мир с динамическим отдалением и монтажной камерой моста. */
  function drawWorld(model) {
    const view = Model.camera(model);
    const w=Model.screenWidth(), h=Model.screenHeight(), pad=64;
    const cos=Math.cos(view.rotation||0), sin=Math.sin(view.rotation||0);
    const corners=[[0,0],[w,0],[0,h],[w,h]].map(([x,y])=>{
      const dx=(x-view.anchorX)/view.zoom, dy=(y-view.anchorY)/view.zoom;
      return {x:view.targetX+dx*cos+dy*sin,y:view.targetY-dx*sin+dy*cos};
    });
    visibleBounds={left:Math.min(...corners.map(p=>p.x))-pad,right:Math.max(...corners.map(p=>p.x))+pad,
      top:Math.min(...corners.map(p=>p.y))-pad,bottom:Math.max(...corners.map(p=>p.y))+pad};
    const sx = model.shake ? (Math.random() - .5) * 13 * model.shake : 0;
    const sy = model.shake ? (Math.random() - .5) * 9 * model.shake : 0;
    g.save(); g.beginPath(); g.rect(0,0,w,h); g.clip();
    g.translate(sx, sy); g.translate(view.anchorX, view.anchorY); g.rotate(view.rotation || 0);
    g.scale(view.zoom, view.zoom); g.translate(-view.targetX, -view.targetY);
    drawRoad(model); drawAttackWarning(model); drawTruck(model); drawBarrels(model); drawSkidTrail(model); drawPlayer(model); g.restore();
    if (Bridge.active(model)) {
      // Полосы входят один раз на всю сцену и не «дышат» при каждом сбросе phaseTime.
      const bars = Math.min(26, (model.bridgeCinematicTime || 0) * 90);
      g.fillStyle = 'rgba(3,2,5,.9)'; g.fillRect(0, 0, Model.screenWidth(), bars);
      g.fillRect(0, Model.screenHeight() - bars, Model.screenWidth(), bars);
      const vignette=g.createRadialGradient(w/2,h*.48,h*.24,w/2,h*.48,Math.max(w,h)*.68);
      vignette.addColorStop(0,'rgba(4,6,11,0)'); vignette.addColorStop(1,'rgba(4,6,11,.42)');
      g.fillStyle=vignette; g.fillRect(0,0,w,h);
    }
  }

  /** Рисует экран поражения с причиной. */
  function drawFailure(model) {
    const w = Model.screenWidth(), h = Model.screenHeight();
    g.fillStyle = 'rgba(3,2,5,.8)'; g.fillRect(0, 0, w, h);
    if (typeof txt !== 'function') return;
    const title = model.failedReason === 'WRECKED' ? 'МАШИНА УНИЧТОЖЕНА' : 'ГРУЗОВИК УШЁЛ';
    txt(g, title, w / 2, h / 2 - 100, 44, '#ff4938', 'center', typeof F_B !== 'undefined' ? F_B : undefined);
    const labels = ['НАЧАТЬ ЗАНОВО', 'ГЛАВНОЕ МЕНЮ']; model.failRects = [];
    labels.forEach(function (label, index) {
      const box = {x: w / 2 - 150, y: h / 2 - 18 + index * 62, w: 300, h: 46}; model.failRects.push(box);
      if (typeof panel === 'function') panel(g, box.x, box.y, box.w, box.h,
        model.failedChoice === index ? 'rgba(255,73,56,.2)' : 'rgba(20,17,28,.94)',
        model.failedChoice === index ? '#ff4938' : '#4b4357', 8);
      txt(g, label, w / 2, box.y + 24, 17, model.failedChoice === index ? '#fff' : '#aaa1b6',
        'center', typeof F_B !== 'undefined' ? F_B : undefined);
    });
  }

  /** Возвращает отредактированные кадры финального комикса. */
  function comicPages() {
    return global.RnRChapterContent ? RnRChapterContent.scenes('postScenes', COMIC) : COMIC;
  }

  /** Лениво кэширует заменённый кадр комикса. */
  function comicImage(src) {
    if (!src || typeof Image === 'undefined') return null;
    if (!comicImages[src]) comicImages[src] = makeImage(src);
    return comicImages[src];
  }

  /** Загружает финальные кадры во время погони, до перехода к комиксу. */
  function preloadComics() {
    comicPages().forEach(function (page) { comicImage(page.image); });
  }

  /** Рисует текущий кадр комикса. */
  function drawComic(model) {
    const w = Model.screenWidth(), h = Model.screenHeight(), pages = comicPages();
    const page = pages[model.comicIndex] || pages[pages.length - 1] || COMIC[0];
    g.fillStyle = 'rgba(4,3,6,.86)'; g.fillRect(0, 0, w, h);
    const art = comicImage(page.image);
    if (art && art.complete && art.naturalWidth) {
      const scale = Math.max(w / art.naturalWidth, h / art.naturalHeight);
      const dw = art.naturalWidth * scale, dh = art.naturalHeight * scale;
      g.globalAlpha = .48; g.drawImage(art, (w - dw) / 2, (h - dh) / 2, dw, dh); g.globalAlpha = 1;
    }
    if (typeof panel === 'function') panel(g, w / 2 - 410, h / 2 - 135, 820, 270, 'rgba(18,14,17,.97)', '#ff8a2d', 14);
    if (typeof txt !== 'function') return;
    txt(g, page.speaker || page.who, w / 2, h / 2 - 78, 18, '#ff9d2e', 'center', typeof F_B !== 'undefined' ? F_B : undefined);
    txt(g, page.text, w / 2, h / 2 - 12, model.comicIndex === pages.length - 1 ? 36 : 25,
      '#fff', 'center', typeof F_B !== 'undefined' ? F_B : undefined);
    txt(g, page.sub, w / 2, h / 2 + 62, 15, '#c8c0d4', 'center', typeof F_B !== 'undefined' ? F_B : undefined);
    if (model.comicIndex < pages.length - 1) txt(g, 'ENTER', w / 2, h / 2 + 108, 12,
      '#70687e', 'center', typeof F_B !== 'undefined' ? F_B : undefined);
  }

  global.RnRStoryChaseView = {drawWorld, drawFailure, drawComic, comicPages, preloadComics};
})(typeof window !== 'undefined' ? window : globalThis);
