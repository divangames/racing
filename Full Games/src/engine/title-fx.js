////////////////////////////////////////////////////////
//
// DiVANEngine: дождь на титуле — капли и эмбиент, без VHS.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  const TITLE_RAIN_SRC = 'assets/sounds/embirnt/rain.mp3';
  const RAIN_MIX = 0.78;

  let rainGain = null;
  let rainSrc = null;
  let rainBuf = null;
  let rainBusy = false;
  let drops = [];
  let splashes = [];

  /**
   * Титул или заставка «любая кнопка».
   * @returns {boolean}
   */
  function titleRainScreen() {
    return state === 'title' || state === 'press';
  }

  /**
   * Капли выключены при reduced-motion.
   * @returns {boolean}
   */
  function rainCalm() {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Сколько стриков в кадре.
   * @returns {number}
   */
  function rainCount() {
    if (rainCalm()) return 0;
    const p = settings && settings.graphics && settings.graphics.particles;
    if (p === 'low') return 70;
    if (p === 'medium') return 120;
    return 170;
  }

  /** Левый край сцены. @returns {number} */
  function rainOx() {
    return (typeof viewW === 'number') ? (W - viewW) / 2 : 0;
  }

  /** Ширина сцены под капли. @returns {number} */
  function rainVw() {
    return (typeof viewW === 'number' && viewW > 0) ? viewW : W;
  }

  /** Новая капля сверху кадра. */
  function spawnDrop() {
    const z = 0.55 + Math.random() * 0.9;
    const ox = rainOx();
    const vw = rainVw();
    return {
      x: ox + Math.random() * (vw + 80) - 40,
      y: -30 - Math.random() * 160,
      vx: (80 + Math.random() * 90) * z,
      vy: (500 + Math.random() * 420) * z,
      len: (11 + Math.random() * 16) * z,
      thick: z > 1 ? 1.25 : 0.75,
      z: z
    };
  }

  /**
   * Справа слабее, чтобы не забивать Медведя.
   * @param {number} x
   * @returns {number}
   */
  function rainSideFade(x) {
    const nx = (x - rainOx()) / rainVw();
    if (nx < 0.42) return 1;
    if (nx > 0.9) return 0.22;
    return 1 - (nx - 0.42) / 0.48 * 0.78;
  }

  /**
   * Громкость лупа. AU.sfx уже умножает ползунок — здесь доля дождя.
   * @returns {number}
   */
  function rainVol() {
    const snd = settings && settings.sound;
    if (!snd || snd.sfxOn === false) return 0;
    return RAIN_MIX;
  }

  /**
   * Blob заставки или путь с диска.
   * @returns {string}
   */
  function rainHref() {
    const cached = (typeof BOOT !== 'undefined' && BOOT.media) ? BOOT.media[TITLE_RAIN_SRC] : '';
    if (cached) return cached;
    if (typeof bootMediaSrc === 'function') return bootMediaSrc(TITLE_RAIN_SRC);
    return TITLE_RAIN_SRC;
  }

  /** Контекст после жеста заставки. */
  function rainCtx() {
    if (typeof AU !== 'undefined' && AU.ctx) return AU.ctx;
    if (typeof audioInit === 'function') {
      try { audioInit(); } catch (e) {}
    }
    return (typeof AU !== 'undefined' && AU.ctx) ? AU.ctx : null;
  }

  /** Снимает источник лупа. */
  function haltTitleRain() {
    if (rainSrc) {
      try { rainSrc.stop(); } catch (e) {}
      rainSrc = null;
    }
    const ctx = rainCtx();
    if (rainGain && ctx) {
      try { rainGain.gain.setTargetAtTime(0, ctx.currentTime, 0.04); } catch (e) {}
    }
  }

  /** Запускает закольцованный буфер в канал эффектов. */
  function startRainNode() {
    const ctx = rainCtx();
    if (!ctx || !rainBuf || rainSrc) return;
    if (ctx.state === 'suspended') ctx.resume().catch(function () {});
    if (!rainGain) {
      rainGain = ctx.createGain();
      const dest = (typeof AU !== 'undefined' && AU.sfx) ? AU.sfx : ctx.destination;
      rainGain.connect(dest);
    }
    rainGain.gain.setValueAtTime(rainVol(), ctx.currentTime);
    rainSrc = ctx.createBufferSource();
    rainSrc.buffer = rainBuf;
    rainSrc.loop = true;
    rainSrc.connect(rainGain);
    try { rainSrc.start(); } catch (e) { rainSrc = null; }
  }

  /** Качает и декодирует rain.mp3 один раз. */
  function ensureRainBuffer() {
    if (rainBuf || rainBusy) return;
    const ctx = rainCtx();
    if (!ctx || typeof fetch !== 'function') return;
    rainBusy = true;
    fetch(rainHref(), { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('rain');
      return res.arrayBuffer();
    }).then(function (raw) {
      return ctx.decodeAudioData(raw.slice(0));
    }).then(function (buf) {
      rainBuf = buf;
      rainBusy = false;
      if (titleRainScreen() && rainVol() > 0) startRainNode();
    }).catch(function () {
      rainBusy = false;
    });
  }

  /** Луп rain.mp3, пока открыт титул и эффекты включены. */
  function tickTitleRainAudio() {
    const on = titleRainScreen() && rainVol() > 0 && !(typeof document !== 'undefined' && document.hidden);
    if (!on) {
      haltTitleRain();
      return;
    }
    ensureRainBuffer();
    if (rainBuf) startRainNode();
    const ctx = rainCtx();
    if (rainGain && ctx) rainGain.gain.setTargetAtTime(rainVol(), ctx.currentTime, 0.05);
  }

  /**
   * Шаг капель.
   * @param {number} dt
   */
  function tickTitleRainDrops(dt) {
    if (!titleRainScreen()) {
      drops.length = 0;
      splashes.length = 0;
      return;
    }
    const want = rainCount();
    const step = Math.min(0.05, Math.max(0, dt || 0.016));
    while (drops.length < want) drops.push(spawnDrop());
    if (drops.length > want) drops.length = want;
    for (let i = drops.length - 1; i >= 0; i--) {
      const p = drops[i];
      p.x += p.vx * step;
      p.y += p.vy * step;
      if (p.y > H - 6) {
        if (!rainCalm() && splashes.length < 28) {
          splashes.push({ x: p.x, y: H - 4, t: 0, s: 3 + p.z * 4 });
        }
        drops[i] = spawnDrop();
        continue;
      }
      if (p.x > rainOx() + rainVw() + 40) drops[i] = spawnDrop();
    }
    for (let i = splashes.length - 1; i >= 0; i--) {
      splashes[i].t += step * 3.2;
      if (splashes[i].t >= 1) splashes.splice(i, 1);
    }
  }

  /**
   * Тик эмбиента и капель.
   * @param {number} dt
   */
  function tickTitleFxEngine(dt) {
    tickTitleRainAudio();
    tickTitleRainDrops(dt);
  }

  /** Стрики и вспышки на лужах кадра. */
  function drawTitleRainEngine() {
    if (!titleRainScreen() || !drops.length) return;
    for (let i = 0; i < drops.length; i++) {
      const p = drops[i];
      const a = Math.atan2(p.vy, p.vx);
      const fade = (0.18 + p.z * 0.28) * rainSideFade(p.x);
      g.save();
      g.translate(p.x, p.y);
      g.rotate(a);
      g.fillStyle = 'rgba(186,214,255,' + fade + ')';
      g.fillRect(0, -p.thick * 0.5, p.len, p.thick);
      g.fillStyle = 'rgba(255,255,255,' + fade * 0.5 + ')';
      g.fillRect(p.len * 0.55, -p.thick * 0.25, p.len * 0.45, p.thick * 0.5);
      g.restore();
    }
    for (let i = 0; i < splashes.length; i++) {
      const s = splashes[i];
      const k = s.t;
      g.strokeStyle = 'rgba(210,230,255,' + (0.28 * (1 - k)) + ')';
      g.lineWidth = 1;
      g.beginPath();
      g.ellipse(s.x, s.y, s.s * (0.6 + k * 1.8), s.s * 0.22 * (1 + k), 0, 0, Math.PI * 2);
      g.stroke();
    }
  }

  if (typeof bootEnqueueFetch === 'function') bootEnqueueFetch([TITLE_RAIN_SRC], true);

  const engine = global.DiVANEngine;
  if (!engine) return;
  global.tickTitleFx = tickTitleFxEngine;
  global.drawTitleRain = drawTitleRainEngine;
  engine.titleFx = { tick: tickTitleFxEngine, draw: drawTitleRainEngine, halt: haltTitleRain };
  if (typeof applyAudioSettings === 'function') {
    engine.wrap('applyAudioSettings', function (orig) {
      return function () {
        orig();
        const ctx = rainCtx();
        if (rainGain && ctx) rainGain.gain.setTargetAtTime(rainVol(), ctx.currentTime, 0.05);
        if (!titleRainScreen() || rainVol() <= 0) haltTitleRain();
      };
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
