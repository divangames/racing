// Титры из авторского cast.txt, галерея с движением камеры и отдельная музыка.
(function (global) {
  'use strict';
  const E = global.DiVANEngine;
  if (!E) return;
  const DIR = 'assets/data/cats/Titles/cast/';
  const SHOT = 10, FADE = 2;
  let rows = [], load = null, error = false, started = 0, scrollStarted = null;
  const images = new Map();

  function parse(text) {
    return String(text).replace(/^\uFEFF/, '').replace(/\r/g, '').split('\n')
      .map(line => line.trim()).map(line => /^=+$/.test(line) ? '' : line);
  }

  function loadText() {
    if (load) return load;
    error = false;
    load = fetch(DIR + 'cast.txt').then(response => {
      if (!response.ok) throw new Error('cast.txt: ' + response.status);
      return response.text();
    }).then(text => { rows = parse(text); }).catch(() => { error = true; load = null; });
    return load;
  }

  function image(index) {
    index = ((index % 20) + 20) % 20;
    if (!images.has(index)) {
      const img = new Image();
      images.set(index, img);
      const src = DIR + String(index + 1).padStart(2, '0') + '.png';
      // Fetch обходит завершённую очередь стартового загрузчика.
      fetch(src).then(response => {
        if (!response.ok) throw new Error(src);
        return response.blob();
      }).then(blob => {
        const url = URL.createObjectURL(blob);
        img.onload = img.onerror = () => URL.revokeObjectURL(url);
        img.src = url;
      }).catch(() => { img.src = src; });
    }
    return images.get(index);
  }

  function camera(index, phase) {
    const p = Math.max(0, Math.min(1, phase));
    const eased = p * p * (3 - 2 * p);
    const directions = [[-1, 1], [1, -1], [1, 1], [-1, -1]];
    const d = directions[index % directions.length];
    return { zoom: 1.08 + .16 * (index % 2 ? 1 - eased : eased),
      x: d[0] * (2 * eased - 1), y: d[1] * (2 * eased - 1) };
  }

  function open() {
    started = gt; scrollStarted = null;
    E.titleMenu.reset();
    state = 'developers';
    loadText(); image(0); image(1);
    if (typeof clearKeys === 'function') clearKeys();
    if (typeof MUSIC !== 'undefined') { lastMusicCat = 'developers'; MUSIC.play('developers'); }
  }

  function close() {
    if (typeof MUSIC !== 'undefined') MUSIC.stop();
    if (typeof enterTitle === 'function') enterTitle();
    else { state = 'title'; E.titleMenu.reset(); }
    if (typeof selTitle !== 'undefined') selTitle = 4;
    if (typeof clearKeys === 'function') clearKeys();
    if (typeof MUSIC !== 'undefined') { lastMusicCat = 'cast'; MUSIC.play('cast'); }
  }

  function draw() {
    const w = typeof viewW === 'number' && viewW > 0 ? viewW : W;
    const h = typeof viewH === 'number' && viewH > 0 ? viewH : H;
    const x = (W - w) / 2, y = (H - h) / 2;
    const elapsed = Math.max(0, gt - started), shot = Math.floor(elapsed / SHOT);
    const current = image(shot); image(shot + 1);
    // Держим только текущий, предыдущий и следующий кадры.
    for (const key of images.keys()) {
      if (![shot % 20, (shot + 1) % 20, (shot + 19) % 20].includes(key)) images.delete(key);
    }
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    function plate(img, index, phase, alpha) {
      if (!img.complete || !img.naturalWidth) return;
      const cam = reduced ? { zoom: 1.08, x: 0, y: 0 } : camera(index, phase);
      const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight) * cam.zoom;
      const iw = img.naturalWidth * scale, ih = img.naturalHeight * scale;
      g.globalAlpha = alpha;
      g.drawImage(img, x - (iw - w) / 2 + cam.x * (iw - w) * .35,
        y - (ih - h) / 2 + cam.y * (ih - h) * .35, iw, ih);
    }
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.fillStyle = '#090b10'; g.fillRect(x, y, w, h);
    const local = elapsed % SHOT;
    const previous = images.get((shot + 19) % 20);
    if (shot > 0 && previous) plate(previous, shot - 1, (SHOT + local) / (SHOT + FADE), 1);
    plate(current, shot, local / (SHOT + FADE), shot > 0 ? Math.min(1, local / FADE) : 1);
    g.globalAlpha = 1;
    const shade = g.createLinearGradient(x, y, x + w, y);
    shade.addColorStop(0, 'rgba(0,0,0,.28)'); shade.addColorStop(.5, 'rgba(0,0,0,.78)');
    shade.addColorStop(1, 'rgba(0,0,0,.28)'); g.fillStyle = shade; g.fillRect(x, y, w, h);
    const top = y + 74, bottom = y + h - 65;
    g.save(); g.beginPath(); g.rect(x, top, w, Math.max(0, bottom - top)); g.clip();
    const font = Math.max(15, Math.min(23, w / 38)), lineH = font * 1.65;
    if (rows.length && scrollStarted === null) scrollStarted = gt;
    const distance = bottom - top + rows.length * lineH + lineH * 4;
    const scroll = scrollStarted === null ? 0 : ((gt - scrollStarted) * 24) % distance;
    const display = error ? ['Не удалось загрузить cast.txt'] : rows.length ? rows : ['Загрузка титров…'];
    display.forEach((line, i) => {
      const ry = rows.length ? bottom - lineH - scroll + i * lineH : top + 50;
      if (!line || ry < top - lineH || ry > bottom + lineH) return;
      const alpha = Math.max(0, Math.min(1, (ry - top) / 35, (bottom - ry) / 35));
      g.globalAlpha = alpha; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = font + 'px Bender, sans-serif'; g.fillStyle = '#f4f0e6';
      g.shadowColor = '#000'; g.shadowBlur = 8;
      g.fillText(line, W / 2, ry, w - 48);
    });
    g.restore();
    g.fillStyle = 'rgba(5,7,11,.85)'; g.fillRect(x, y, w, 62); g.fillRect(x, bottom + 8, w, h - (bottom + 8 - y));
    if(E.menu){E.menu.frame(g,x,y,w,62);E.menu.frame(g,x,bottom+8,w,h-(bottom+8-y));}
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 22px Bender, sans-serif';
    g.fillStyle = E.menu?E.menu.colors.accent:'#f4f0e6'; g.fillText('РАЗРАБОТЧИКИ', W / 2, y + 32);
    g.font = '15px Bender, sans-serif'; g.fillStyle = '#d8e3ec';
    g.fillText('Esc — выйти в главное меню', W / 2, y + h - 27);
    g.restore();
  }

  if (typeof MUSIC !== 'undefined' && MUSIC.list) {
    const previous = MUSIC.list;
    MUSIC.list = function (cat) { return cat === 'developers' ? [DIR + '01.mp3'] : previous.call(this, cat); };
  }
  E.credits = { open, close, draw, parse, camera };
})(typeof window !== 'undefined' ? window : globalThis);
