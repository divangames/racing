////////////////////////////////////////////////////////
//
// DiVANEngine: полуоси хитбокса кузова. Спрайты CAR_SVG остаются в HTML.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Масштаб слота: Урал по умолчанию 1.65, иначе из лаборатории.
   * @param {number} idx
   * @returns {number}
   */
  function carBodyScaleEngine(idx) {
    const cfg = editorCarConfig(idx);
    if (cfg && cfg.body && cfg.body.scale != null) return cfg.body.scale;
    return idx === 6 ? 1.65 : 1;
  }

  /**
   * Уровень брони для спрайта рамки.
   * @param {object} r
   * @returns {number}
   */
  function racerArmLvlEngine(r) {
    const idx = r.car.idx;
    const cfg = editorCarConfig(idx);
    if (cfg && cfg.body && cfg.body.armor != null) return cfg.body.armor | 0;
    if (r.lvl && r.lvl.arm != null) return r.lvl.arm | 0;
    if (save && save.tuning && save.tuning[idx]) return save.tuning[idx].arm | 0;
    return 0;
  }

  /**
   * Слой мятости 0…6 по остатку корпуса.
   * @param {object} r
   * @returns {number}
   */
  function racerWoundLvlEngine(r) {
    if (!r || r.maxhp == null || r.hp == null) return 0;
    const t = 1 - clamp(r.hp / Math.max(1, r.maxhp), 0, 1);
    if (t < 0.1) return 0;
    return clamp(Math.ceil(t * 6), 1, 6);
  }

  /**
   * Полуоси рамки в игровых единицах (кэш по слоту и броне).
   * @param {object} r
   * @returns {{hw:number,hh:number}}
   */
  function carHitHalfEngine(r) {
    const idx = r.car.idx, arm = racerArmLvl(r), sc = carBodyScale(idx);
    const cfg = editorCarConfig(idx);
    const sx = (cfg && cfg.body && isFinite(+cfg.body.sx) && +cfg.body.sx > 0) ? +cfg.body.sx : 1;
    const sy = (cfg && cfg.body && isFinite(+cfg.body.sy) && +cfg.body.sy > 0) ? +cfg.body.sy : 1;
    const key = idx + '_' + arm + '_' + sc + '_' + sx + '_' + sy;
    const hit = CAR_HIT_CACHE[key];
    let hw, hh;
    if (hit) { hw = hit.hw; hh = hit.hh; }
    else {
      const im = carSprite(idx, arm);
      hw = 27 * sc * sx; hh = 16 * sc * sy;
      if (im && im.complete && im.naturalWidth > 0) {
        const s = 60 / Math.max(im.naturalWidth, im.naturalHeight) * sc;
        hw = im.naturalWidth * s * 0.5 * sx;
        hh = im.naturalHeight * s * 0.5 * sy;
        CAR_HIT_CACHE[key] = { hw, hh };
      }
    }
    if (typeof kitHitScale === 'function') {
      const ks = kitHitScale(r);
      hw *= ks; hh *= ks;
    }
    return { hw, hh };
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.replace('carBodyScale', carBodyScaleEngine);
  engine.replace('racerArmLvl', racerArmLvlEngine);
  engine.replace('racerWoundLvl', racerWoundLvlEngine);
  engine.replace('carHitHalf', carHitHalfEngine);
})(typeof window !== 'undefined' ? window : globalThis);
