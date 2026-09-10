////////////////////////////////////////////////////////
//
// DiVANEngine: дождь на титуле — капли и эмбиент, без VHS.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  const TITLE_RAIN_SRC = 'assets/sounds/embirnt/rain.mp3';
  const RAIN_MIX = 0.48;

  let rainEl = null;
  let rainLoad = false;
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

  /** Новая капля сверху кадра. */
  function spawnDrop() {
    const z = 0.55 + Math.random() * 0.9;
    return {
      x: Math.random() * (W + 120) - 40,
      y: -30 - Math.random() * 160,
      vx: (80 + Math.random() * 90) * z,
      vy: (500 + Math.random() * 420) * z,
      len: (11 + Math.random() * 16) * z,
      thick: z > 1 ? 1.25 : 0.75,
      z: z
    };
  }

  /**
   * Громкость эмбиента от ползунка эффектов.
   * @returns {number}
   */
  function rainVol() {
    const snd = settings && settings.sound;
    if (!snd || snd.sfxOn === false) return 0;
    return clamp((snd.sfx == null ? 80 : snd.sfx) / 100, 0, 1) * RAIN_MIX;
  }

  /** Вешает blob или прямой URL на луп. */
  function bindRainSrc() {
    if (!rainEl || rainLoad) return;
    rainLoad = true;
    const cached = (typeof BOOT !== 'undefined' && BOOT.media) ? BOOT.media[TITLE_RAIN_SRC] : '';
    if (cached) { rainEl.src = cached; return; }
    if (typeof bootMediaSrc === 'function') {
      const href = bootMediaSrc(TITLE_RAIN_SRC);
      if (href && href !== TITLE_RAIN_SRC) { rainEl.src = href; return; }
    }
    if (typeof fetch !== 'function') { rainEl.src = TITLE_RAIN_SRC; return; }
    fetch(TITLE_RAIN_SRC, { cache: 'no-store' }).then(function (res) {
      if (!res.ok) { rainEl.src = TITLE_RAIN_SRC; return; }
      return res.blob().then(function (blob) {
        if (!blob || !blob.size) { rainEl.src = TITLE_RAIN_SRC; return; }
        rainEl.src = URL.createObjectURL(blob);
      });
    }).catch(function () { rainEl.src = TITLE_RAIN_SRC; });
  }

  /** Останавливает луп дождя. */
  function haltTitleRain() {
    if (!rainEl) return;
    try { rainEl.pause(); } catch (e) {}
  }

  /** Луп rain.mp3, пока открыт титул и эффекты включены. */
  function tickTitleRainAudio() {
    const on = titleRainScreen() && rainVol() > 0 && !(typeof document !== 'undefined' && document.hidden);
    if (!on) {
      haltTitleRain();
      return;
    }
    if (typeof Audio === 'undefined') return;
    if (!rainEl) {
      rainEl = new Audio();
      rainEl.loop = true;
      rainEl.preload = 'auto';
      rainEl.referrerPolicy = 'no-referrer';
      bindRainSrc();
    }
    rainEl.volume = rainVol();
    if (rainEl.paused) rainEl.play().catch(function () {});
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
      if (p.x > W + 40) drops[i] = spawnDrop();
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
      const fade = 0.18 + p.z * 0.28;
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
        if (rainEl) rainEl.volume = rainVol();
        if (!titleRainScreen() || rainVol() <= 0) haltTitleRain();
      };
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
