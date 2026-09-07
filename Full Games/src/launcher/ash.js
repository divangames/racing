////////////////////////////////////////////////////////
//
// Пепел лаунчера: те же угли, что на заставке игры.
//
////////////////////////////////////////////////////////

'use strict';

/**
 * Запускает падающий пепел на весь фон.
 */
function startLauncherAsh() {
  const root = document.querySelector('.stage');
  const cnv = document.getElementById('ash');
  if (!root || !cnv) return;
  const reduce = typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    cnv.style.display = 'none';
    return;
  }
  const ctx = cnv.getContext('2d');
  if (!ctx) return;
  let w = 0;
  let h = 0;
  let dpr = 1;
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

  /**
   * Одна частица пепла или угля.
   * @param {boolean} fromTop
   */
  function makeFlake(fromTop) {
    const ember = Math.random() < 0.4;
    return {
      x: Math.random() * w,
      y: fromTop ? -12 - Math.random() * h * 0.2 : Math.random() * h,
      vx: (Math.random() - 0.5) * 0.35,
      vy: 0.28 + Math.random() * 0.55,
      s: ember ? 1.2 + Math.random() * 2.2 : 0.7 + Math.random() * 1.8,
      a: 0.18 + Math.random() * 0.45,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.04,
      ph: Math.random() * Math.PI * 2,
      ember: ember
    };
  }

  fitAsh();
  const n = Math.max(72, Math.min(140, Math.round(w * h / 12000)));
  for (let i = 0; i < n; i++) flakes.push(makeFlake(false));
  addEventListener('resize', fitAsh);
  let last = performance.now();

  /** Кадр пепла. */
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctx.clearRect(0, 0, w, h);
    for (const p of flakes) {
      p.ph += dt * 1.4;
      p.x += p.vx + Math.sin(p.ph) * 0.35;
      p.y += p.vy * (1 + Math.sin(p.ph * 0.5) * 0.12);
      p.rot += p.vr;
      if (p.y > h + 16 || p.x < -20 || p.x > w + 20) {
        const n2 = makeFlake(true);
        p.x = n2.x;
        p.y = n2.y;
        p.vx = n2.vx;
        p.vy = n2.vy;
        p.s = n2.s;
        p.a = n2.a;
        p.ember = n2.ember;
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.ember) {
        ctx.globalAlpha = p.a * 0.35;
        ctx.fillStyle = '#ff9d2e';
        ctx.fillRect(-p.s * 1.4, -p.s * 2.2, p.s * 2.8, p.s * 4.4);
        ctx.globalAlpha = p.a;
        ctx.fillStyle = '#e8a23a';
      } else {
        ctx.globalAlpha = p.a;
        ctx.fillStyle = '#8a7a6a';
      }
      ctx.fillRect(-p.s * 0.5, -p.s * 1.4, p.s, p.s * 2.6);
      ctx.restore();
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

startLauncherAsh();
