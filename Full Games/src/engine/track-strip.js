////////////////////////////////////////////////////////
//
// DiVANEngine: высокодетальные полосы покрытия и ржавого рельса.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  const STRIP_W = 512;
  const STRIP_H = 192;
  const RAIL_W = 256;
  const RAIL_H = 36;
  const DENSITY = 3;
  const TAU = Math.PI * 2;
  const cache = Object.create(null);

  /**
   * RGB из #rrggbb.
   * @param {string} hex
   * @returns {{r:number,g:number,b:number}}
   */
  function parseRgb(hex) {
    const h = String(hex || '#43404b').replace('#', '');
    const full = h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h.slice(0, 6);
    const n = parseInt(full, 16) || 0x43404b;
    return { r: n >> 16 & 255, g: n >> 8 & 255, b: n & 255 };
  }

  /**
   * Смесь двух цветов.
   * @param {string} a
   * @param {string} b
   * @param {number} t
   * @returns {string}
   */
  function lerpHex(a, b, t) {
    const A = parseRgb(a), B = parseRgb(b);
    const u = t < 0 ? 0 : t > 1 ? 1 : t;
    return 'rgb(' +
      ((A.r + (B.r - A.r) * u) | 0) + ',' +
      ((A.g + (B.g - A.g) * u) | 0) + ',' +
      ((A.b + (B.b - A.b) * u) | 0) + ')';
  }

  /**
   * Генератор зерна.
   * @param {string} key
   * @returns {function():number}
   */
  function rngOf(key) {
    if (typeof mulberry === 'function') return mulberry(91 + key.length * 19 + (key.charCodeAt(0) || 0) * 7);
    return function () { return 0.5; };
  }

  /**
   * Виньетка поперёк: края в тени, центр чуть светлее.
   * @param {CanvasRenderingContext2D} q
   * @param {object} rgb
   */
  function crossVignette(q, rgb) {
    for (let y = 0; y < STRIP_H; y++) {
      const v = y / (STRIP_H - 1);
      const edge = Math.abs(v - 0.5) * 2;
      const e2 = edge * edge;
      q.fillStyle = 'rgba(0,0,0,' + (0.08 + e2 * 0.42) + ')';
      q.fillRect(0, y, STRIP_W, 1);
      if (edge < 0.35) {
        q.fillStyle = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + ((0.35 - edge) * 0.18) + ')';
        q.fillRect(0, y, STRIP_W, 1);
      }
    }
  }

  /**
   * Мелкий шум и редкие пятна.
   * @param {CanvasRenderingContext2D} q
   * @param {function():number} rng
   * @param {number} n
   */
  function grit(q, rng, n) {
    for (let i = 0; i < n; i++) {
      q.fillStyle = rng() < 0.55 ? 'rgba(0,0,0,.16)' : 'rgba(255,255,255,.07)';
      q.fillRect(rng() * STRIP_W, rng() * STRIP_H, 1 + rng() * 2.4, 1 + rng() * 1.8);
    }
  }

  /**
   * Рисунок материала поверх базы.
   * @param {CanvasRenderingContext2D} q
   * @param {string} mat
   * @param {function():number} rng
   */
  function paintKind(q, mat, rng) {
    switch (mat) {
      case 'sand':
        for (let i = 0; i < 90; i++) {
          q.fillStyle = 'rgba(255,220,150,' + (0.04 + rng() * 0.08) + ')';
          q.fillRect(rng() * STRIP_W, rng() * STRIP_H, 8 + rng() * 28, 1 + rng() * 2);
        }
        grit(q, rng, 1400);
        break;
      case 'dirt':
        for (let i = 0; i < 50; i++) {
          q.fillStyle = 'rgba(40,22,14,' + (0.1 + rng() * 0.18) + ')';
          q.beginPath();
          q.ellipse(rng() * STRIP_W, rng() * STRIP_H, 6 + rng() * 16, 3 + rng() * 8, rng() * 3, 0, TAU);
          q.fill();
        }
        grit(q, rng, 1100);
        break;
      case 'grass':
        for (let i = 0; i < 220; i++) {
          q.strokeStyle = 'rgba(160,190,90,' + (0.12 + rng() * 0.2) + ')';
          q.lineWidth = 1;
          const x = rng() * STRIP_W, y = rng() * STRIP_H;
          q.beginPath(); q.moveTo(x, y); q.lineTo(x + rng() * 4 - 2, y - 3 - rng() * 6); q.stroke();
        }
        grit(q, rng, 700);
        break;
      case 'ice':
        q.fillStyle = 'rgba(220,245,255,.12)';
        q.fillRect(0, 0, STRIP_W, STRIP_H);
        for (let i = 0; i < 28; i++) {
          q.strokeStyle = 'rgba(255,255,255,.28)';
          q.lineWidth = 1;
          q.beginPath();
          q.moveTo(rng() * STRIP_W, rng() * STRIP_H);
          q.lineTo(rng() * STRIP_W, rng() * STRIP_H);
          q.stroke();
        }
        grit(q, rng, 400);
        break;
      case 'snow':
        q.fillStyle = 'rgba(255,255,255,.22)';
        q.fillRect(0, 0, STRIP_W, STRIP_H);
        grit(q, rng, 500);
        break;
      case 'lava':
        for (let i = 0; i < 40; i++) {
          q.fillStyle = rng() < 0.5 ? 'rgba(255,80,30,.35)' : 'rgba(255,180,40,.2)';
          q.beginPath();
          q.arc(rng() * STRIP_W, rng() * STRIP_H, 2 + rng() * 5, 0, TAU);
          q.fill();
        }
        grit(q, rng, 600);
        break;
      case 'asphalt':
        // Broken patches and branching fissures, followed by subpixel aggregate.
        for (let i = 0; i < 900; i++) {
          const x=rng()*STRIP_W, y=rng()*STRIP_H, radius=2+rng()*10;
          q.fillStyle=rng()<.65?'rgba(10,10,9,.13)':'rgba(145,139,120,.08)';
          q.beginPath();
          for(let k=0;k<9;k++){
            const a=k/9*TAU, r=radius*(.45+rng()*.55);
            const px=x+Math.cos(a)*r, py=y+Math.sin(a)*r;
            if(k===0)q.moveTo(px,py);else q.lineTo(px,py);
          }
          q.closePath();q.fill();
        }
        for(let i=0;i<120;i++){
          let x=rng()*STRIP_W,y=rng()*STRIP_H;
          const angle=rng()*TAU;
          q.lineWidth=.18+rng()*.35;q.strokeStyle='rgba(9,9,8,.55)';
          q.beginPath();q.moveTo(x,y);
          for(let k=0;k<7;k++){
            x+=Math.cos(angle)*4+(rng()-.5)*7;y+=Math.sin(angle)*4+(rng()-.5)*7;
            q.lineTo(x,y);
            if(k===3){q.lineTo(x+Math.cos(angle+1)*9,y+Math.sin(angle+1)*9);q.moveTo(x,y);}
          }
          q.stroke();
        }
        for(let i=0;i<80000;i++){
          q.fillStyle=rng()<.58?'rgba(0,0,0,.18)':'rgba(216,206,183,.12)';
          const s=.15+rng()*.55;
          q.fillRect(rng()*STRIP_W,rng()*STRIP_H,s,s*.8);
        }
        break;
      default:
        grit(q, rng, 900);
        break;
    }
  }

  /**
   * Полоса покрытия: высокое зерно, виньетка, характер материала.
   * @param {string} mat
   * @param {string} hex
   * @returns {HTMLCanvasElement}
   */
  function bakeRoadStrip(mat, hex) {
    const key = (mat || 'asphalt') + ':' + hex;
    if (cache[key]) return cache[key];
    const c = document.createElement('canvas');
    c.width = STRIP_W * DENSITY;
    c.height = STRIP_H * DENSITY;
    c.worldWidth = STRIP_W;
    const q = c.getContext('2d');
    q.scale(DENSITY, DENSITY);
    q.imageSmoothingEnabled = true;
    if (q.imageSmoothingQuality) q.imageSmoothingQuality = 'medium';
    const rgb = parseRgb(hex);
    q.fillStyle = hex || '#3a3842';
    q.fillRect(0, 0, STRIP_W, STRIP_H);
    const rng = rngOf(key);
    paintKind(q, mat || 'asphalt', rng);
    crossVignette(q, rgb);
    cache[key] = c;
    return c;
  }

  /**
   * Узкий швеллер: тёмная ржавчина и светлая кромка сверху.
   * @returns {HTMLCanvasElement}
   */
  function bakeRailStrip() {
    if (cache.rail) return cache.rail;
    const c = document.createElement('canvas');
    c.width = RAIL_W * DENSITY;
    c.height = RAIL_H * DENSITY;
    c.worldWidth = RAIL_W;
    const q = c.getContext('2d');
    q.scale(DENSITY, DENSITY);
    q.fillStyle = '#2a160e';
    q.fillRect(0, 0, RAIL_W, RAIL_H);
    q.fillStyle = '#6a351c';
    q.fillRect(0, 0, RAIL_W, RAIL_H * 0.55);
    q.fillStyle = '#a65328';
    q.fillRect(0, 0, RAIL_W, 8);
    q.fillStyle = '#b88650';
    q.fillRect(0, 0, RAIL_W, 3);
    const rng = rngOf('rail');
    q.fillStyle='#8f451f';q.fillRect(0,9,RAIL_W,17);
    q.fillStyle='#271f18';q.fillRect(0,27,RAIL_W,5);
    q.fillStyle='#927b57';q.fillRect(0,32,RAIL_W,1);
    for (let i = 0; i < 2400; i++) {
      q.fillStyle = rng() < 0.72 ? 'rgba(12,15,13,.55)' : 'rgba(237,167,80,.28)';
      const x=rng()*RAIL_W, y=rng()*RAIL_H, s=.2+rng()*1.6;
      q.beginPath();q.moveTo(x,y);q.lineTo(x+s*1.6,y-.4);q.lineTo(x+s,y+s*.7);q.lineTo(x-.4,y+s);q.closePath();q.fill();
    }
    for(let x=0;x<RAIL_W;x+=32){
      q.fillStyle='#1b1c19';q.fillRect(x,0,2,RAIL_H);
      q.fillStyle='#716b5c';q.fillRect(x+2,2,2,RAIL_H-4);
      for(const y of [5,30]){
        q.fillStyle='#131512';q.beginPath();q.arc(x+3,y,1.5,0,TAU);q.fill();
        q.fillStyle='#b6a580';q.fillRect(x+2.5,y-.8,.8,.8);
      }
    }
    cache.rail = c;
    return c;
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.trackStrip = {
    STRIP_W: STRIP_W,
    STRIP_H: STRIP_H,
    parseRgb: parseRgb,
    lerpHex: lerpHex,
    bakeRoadStrip: bakeRoadStrip,
    bakeRailStrip: bakeRailStrip
  };
})(typeof window !== 'undefined' ? window : globalThis);
