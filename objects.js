////////////////////////////////////////////////////////
//
// Ассеты лаборатории: пак .labr, объект .oblab, рисунок и коллизия
//
////////////////////////////////////////////////////////
'use strict';

window.RnRObjects = (() => {
  const cache = Object.create(null);
  let packs = [];

  /** Нормализация .oblab. */
  function normalize(raw, pack, folder) {
    const s = raw && typeof raw === 'object' ? raw : {};
    const id = String(s.id || 'obj').replace(/[^a-z0-9_]/gi, '_').toLowerCase();
    const rawSrc = String(s.src || (id + '.webp')).replace(/\\/g, '/');
    const folderRel = folder || ('assets/object/' + pack + '.labr');
    const src = rawSrc.indexOf('/') >= 0 ? rawSrc : (folderRel + '/' + rawSrc);
    const layer = s.layer === 'over' ? 'over' : 'under';
    return {
      pack: String(pack || s.pack || 'world'),
      id,
      name: String(s.name || id).slice(0, 42),
      src,
      file: rawSrc.replace(/^.*\//, ''),
      w: Math.max(8, +s.w || 128),
      h: Math.max(8, +s.h || 128),
      lockRatio: s.lockRatio !== false,
      layer,
      collision: collOf(s.collision, layer)
    };
  }

  /** Коллизия: несколько тел или старый poly. */
  function collOf(raw, layer) {
    const s = raw && typeof raw === 'object' ? raw : {};
    const verts = (poly) => (Array.isArray(poly) ? poly.map((p) => [+p[0] || 0, +p[1] || 0]) : []);
    let bodies = [];
    if (Array.isArray(s.bodies)) {
      s.bodies.forEach((b) => {
        const poly = verts(b && b.poly);
        if (poly.length >= 3) bodies.push({poly});
      });
    }
    if (!bodies.length) {
      const poly = verts(s.poly);
      if (poly.length >= 3) bodies.push({poly});
    }
    return {
      solid: layer === 'under' ? false : s.solid !== false,
      bodies,
      poly: bodies[0] ? bodies[0].poly : []
    };
  }

  /** Картинка по URL. */
  function imgOf(url, onload) {
    if (!url) return null;
    if (cache[url]) return cache[url];
    const im = new Image();
    im.onload = () => { if (onload) onload(); };
    im.onerror = () => { if (onload) onload(); };
    im.src = url;
    cache[url] = im;
    return im;
  }

  /** Каталог паков с диска. */
  async function list() {
    try {
      const r = await fetch('/__object-packs', {cache: 'no-store'});
      if (r.ok) {
        const data = await r.json();
        packs = ((data && data.packs) || []).map((p) => ({
          id: p.id,
          name: p.name,
          folder: p.folder,
          objects: (p.objects || []).map((o) => normalize(o, p.id, p.folder))
        }));
      }
    } catch (err) { packs = packs || []; }
    const stock = stockPack();
    if (stock) packs = [stock].concat(packs.filter((p) => p.id !== 'stock'));
    return packs;
  }

  /** Сток из палитры деколей, чтобы полка не была пустой. */
  function stockPack() {
    if (!window.RnRTracks || !RnRTracks.DECALS) return null;
    return {
      id: 'stock',
      name: 'СТОК',
      folder: '',
      objects: RnRTracks.DECALS.map((d) => normalize({
        id: d.id, name: d.name, src: d.src, w: 160, h: 160, layer: 'under', lockRatio: true,
        collision: {solid: false, poly: []}
      }, 'stock', ''))
    };
  }

  /** Найти определение. */
  function defOf(inst) {
    if (!inst) return null;
    if (inst._def) return inst._def;
    const pack = packs.find((p) => p.id === inst.pack);
    const hit = pack && (pack.objects || []).find((o) => o.id === inst.id);
    return hit || null;
  }

  /** Точка в полигоне. */
  function inPoly(x, y, poly) {
    let ok = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-6) + xi)) ok = !ok;
    }
    return ok;
  }

  /** Мир → локаль спрайта в пикселях .oblab. */
  function toLocal(inst, def, wx, wy) {
    const dx = wx - inst.x, dy = wy - inst.y;
    const c = Math.cos(-(inst.ang || 0)), s = Math.sin(-(inst.ang || 0));
    const lx = dx * c - dy * s, ly = dx * s + dy * c;
    const sx = (inst.w || def.w) / (def.w || 1), sy = (inst.h || def.h) / (def.h || 1);
    return {x: lx / (sx || 1), y: ly / (sy || 1)};
  }

  /** Рисует экземпляр. */
  function drawOne(ctx, inst, onload) {
    const def = defOf(inst);
    if (!def) return;
    const im = imgOf(def.src, onload);
    const w = inst.w || def.w, h = inst.h || def.h;
    ctx.save();
    ctx.translate(inst.x, inst.y);
    ctx.rotate(inst.ang || 0);
    if (im && im.complete && im.naturalWidth) ctx.drawImage(im, -w / 2, -h / 2, w, h);
    else {
      ctx.fillStyle = 'rgba(80,80,90,.5)';
      ctx.fillRect(-w / 2, -h / 2, w, h);
    }
    ctx.restore();
  }

  /** Слой under / over. */
  function drawLayer(ctx, list, layer, onload) {
    (list || []).forEach((o) => {
      const def = defOf(o);
      const lay = o.layer || (def && def.layer) || 'under';
      if (lay === layer) drawOne(ctx, o, onload);
    });
  }

  /** Контур коллизии. */
  function drawCollision(ctx, inst) {
    const def = defOf(inst);
    if (!def) return;
    const w = inst.w || def.w, h = inst.h || def.h;
    const sx = w / (def.w || 1), sy = h / (def.h || 1);
    ctx.save();
    ctx.translate(inst.x, inst.y);
    ctx.rotate(inst.ang || 0);
    ctx.strokeStyle = def.collision.solid ? 'rgba(255,61,46,.9)' : 'rgba(88,255,107,.9)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    const bodies = (def.collision.bodies && def.collision.bodies.length)
      ? def.collision.bodies
      : (def.collision.poly && def.collision.poly.length >= 3 ? [{poly: def.collision.poly}] : []);
    if (bodies.length) {
      bodies.forEach((b) => {
        ctx.beginPath();
        b.poly.forEach((p, i) => {
          const x = p[0] * sx, y = p[1] * sy;
          if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        });
        ctx.closePath();
        ctx.stroke();
      });
    } else {
      ctx.strokeRect(-w / 2, -h / 2, w, h);
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  /** Круг машины vs твёрдое. */
  function pushCar(r, list) {
    if (!r || r.air || r.dead) return;
    const rad = 26;
    (list || []).forEach((inst) => {
      const def = defOf(inst);
      if (!def || !def.collision.solid) return;
      const L = toLocal(inst, def, r.x, r.y);
      const bodies = (def.collision.bodies && def.collision.bodies.length)
        ? def.collision.bodies
        : (def.collision.poly && def.collision.poly.length >= 3 ? [{poly: def.collision.poly}] : []);
      let inside = false;
      if (bodies.length) {
        inside = bodies.some((b) => inPoly(L.x, L.y, b.poly));
      } else {
        const hw = (def.w || 128) / 2, hh = (def.h || 128) / 2;
        inside = Math.abs(L.x) < hw && Math.abs(L.y) < hh;
      }
      if (!inside) return;
      const dx = r.x - inst.x, dy = r.y - inst.y, d = Math.hypot(dx, dy) || 1;
      const push = rad * 0.45;
      r.x += dx / d * push;
      r.y += dy / d * push;
      r.spd *= 0.72;
      r.lat = (r.lat || 0) * 0.5;
    });
  }

  /** Тело .oblab для записи. */
  function fileOf(def) {
    return {
      id: def.id,
      name: def.name,
      src: def.file || (def.id + '.webp'),
      w: def.w,
      h: def.h,
      lockRatio: !!def.lockRatio,
      layer: def.layer,
      collision: def.collision
    };
  }

  return {
    normalize, imgOf, list, defOf, drawOne, drawLayer, drawCollision, pushCar, fileOf, toLocal,
    get packs() { return packs; },
    set packs(v) { packs = v || []; }
  };
})();
