////////////////////////////////////////////////////////
//
// DiVANEngine: жест «любая кнопка», финиш заставки, пепел, bootGo.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /** Снимает заставку и открывает интро или меню. */
  function bootFinishEngine() {
    if (BOOT.ready) return;
    BOOT.ready = true;
    BOOT.giveUp = true;
    const el = bootEls();
    if (el.fill) el.fill.style.width = '100%';
    if (el.pct) el.pct.textContent = '100%';
    if (el.status) el.status.textContent = 'Готово';
    const hide = function () {
      if (!el.root) return;
      el.root.classList.add('is-out');
      const drop = function () {
        BOOT.fxLive = false;
        if (el.root && el.root.parentNode) el.root.parentNode.removeChild(el.root);
      };
      const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) drop();
      else setTimeout(drop, 380);
    };
    hide();
    setTimeout(function () {
      try {
        if (labTest) startLabTest();
        else if (typeof startWorldIntro === 'function') startWorldIntro();
        else enterTitle();
        if (cv && cv.focus) cv.focus();
      } catch (e) {
        console.error(e);
        if (labTest) { try { location.href = 'Editor.html'; } catch (err) {} }
        titleSim = null;
      }
      requestAnimationFrame(frame);
    }, 40);
  }

  /** Жест игрока: музыка меню и очередь файлов. */
  function bootAcceptGateEngine() {
    if (BOOT.started || BOOT.ready) return;
    if (BOOT.gateRaf) { cancelAnimationFrame(BOOT.gateRaf); BOOT.gateRaf = 0; }
    try { if (!AU.ctx) audioInit(); } catch (e) { console.error(e); }
    const el = bootEls();
    if (el.root) { el.root.classList.remove('is-gate'); el.root.classList.add('is-load'); }
    if (el.heading) el.heading.textContent = 'ЗАГРУЗКА';
    try { bootGo(); } catch (e) { console.error(e); bootFinish(); }
  }

  /** Геймпад на экране «любая кнопка». */
  function bootPollGateEngine() {
    if (BOOT.started || BOOT.ready) return;
    if (typeof navigator !== 'undefined' && navigator.getGamepads) {
      const pads = navigator.getGamepads();
      for (const p of pads) {
        if (!p || !p.buttons) continue;
        for (const b of p.buttons) {
          if (b && b.pressed && (b.value || 0) > 0.55) { bootAcceptGate(); return; }
        }
      }
    }
    BOOT.gateRaf = requestAnimationFrame(bootPollGate);
  }

  /** Пепел на заставке: лёгкие угли, без blur. */
  function bootFxStartEngine() {
    const root = document.getElementById('boot-screen');
    const cnv = document.getElementById('boot-ash');
    if (!root || !cnv) return;
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { cnv.style.display = 'none'; return; }
    const ctx = cnv.getContext('2d');
    if (!ctx) return;
    BOOT.fxLive = true;
    let w = 0, h = 0, dpr = 1;
    const flakes = [];
    /** Подгоняет холст пепла под окно. */
    function fitAsh() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = root.clientWidth || innerWidth;
      h = root.clientHeight || innerHeight;
      cnv.width = (w * dpr) | 0;
      cnv.height = (h * dpr) | 0;
      cnv.style.width = w + 'px';
      cnv.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    /** Одна частица пепла или угля. */
    function makeFlake(fromTop) {
      const ember = Math.random() < .28;
      return {
        x: Math.random() * w,
        y: fromTop ? -12 - Math.random() * h * 0.2 : Math.random() * h,
        vx: (Math.random() - .5) * .35,
        vy: .28 + Math.random() * .55,
        s: ember ? 1.2 + Math.random() * 2.2 : .7 + Math.random() * 1.8,
        a: .18 + Math.random() * .45,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - .5) * .04,
        ph: Math.random() * Math.PI * 2,
        ember: ember
      };
    }
    fitAsh();
    const n = Math.max(48, Math.min(90, Math.round(w * h / 18000)));
    for (let i = 0; i < n; i++) flakes.push(makeFlake(false));
    addEventListener('resize', fitAsh);
    let last = performance.now();
    /** Кадр пепла, пока жива заставка. */
    function tick(now) {
      if (!BOOT.fxLive || !root.parentNode) return;
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      ctx.clearRect(0, 0, w, h);
      for (const p of flakes) {
        p.ph += dt * 1.4;
        p.x += p.vx + Math.sin(p.ph) * 0.35;
        p.y += p.vy * (1 + Math.sin(p.ph * 0.5) * 0.12);
        p.rot += p.vr;
        if (p.y > h + 16 || p.x < -20 || p.x > w + 20) {
          const n2 = makeFlake(true);
          p.x = n2.x; p.y = n2.y; p.vx = n2.vx; p.vy = n2.vy; p.s = n2.s; p.a = n2.a; p.ember = n2.ember;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = p.a;
        ctx.fillStyle = p.ember ? '#e8a23a' : '#8a7a6a';
        ctx.fillRect(-p.s * .5, -p.s * 1.4, p.s, p.s * 2.6);
        ctx.restore();
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /** Полная очередь: диски, музыка, шрифты, тайлы, затем финиш. */
  async function bootGoEngine() {
    if (BOOT.started) return;
    BOOT.started = true;
    BOOT.t0 = performance.now();
    bootEls();
    bootPaint();
    const tick = setInterval(bootPaint, 250);
    try {
      if (typeof EditorData !== 'undefined' && EditorData.hydrateFromDisk) {
        await EditorData.hydrateFromDisk();
        reloadEditorCars();
      }
      if (typeof musicDiscoverAll === 'function') await musicDiscoverAll();
      bootEnqueueAudioCatalog();
      bootEnqueueSfx();
      const fonts = bootFontsJob();
      const voice = (typeof voicePreload === 'function') ? Promise.resolve(voicePreload()) : Promise.resolve();
      const maps = (labTest && !LAB_TRACK_KEY) ? Promise.resolve() : bootDiscoverAllMapTiles();
      const custom = (global.RnRTracks && RnRTracks.load) ? RnRTracks.load() : Promise.resolve();
      const packs = (global.RnRObjects && RnRObjects.list) ? RnRObjects.list() : Promise.resolve();
      await bootWaitAll(8, [fonts, voice, maps, custom, packs]);
    } catch (e) { console.error(e); }
    finally { clearInterval(tick); }
    bootFinish();
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.replace('bootFinish', bootFinishEngine);
  engine.replace('bootAcceptGate', bootAcceptGateEngine);
  engine.replace('bootPollGate', bootPollGateEngine);
  engine.replace('bootFxStart', bootFxStartEngine);
  engine.replace('bootGo', bootGoEngine);
})(typeof window !== 'undefined' ? window : globalThis);
