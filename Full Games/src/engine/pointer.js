////////////////////////////////////////////////////////
//
// DiVANEngine: клик по хабу — хитбоксы экранов, не симуляция.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Точка внутри прямоугольника (края не входят).
   * @param {number} x
   * @param {number} y
   * @param {{x:number,y:number,w:number,h:number}|null|undefined} b
   * @returns {boolean}
   */
  function hitRect(x, y, b) {
    return !!(b && x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h);
  }

  /**
   * Попадание в пункт титульного меню.
   * @param {number} x
   * @param {number} y
   * @param {number} index
   * @param {{y0:number,step:number,pad:number,mid:number,halfW:number}} lay
   * @returns {boolean}
   */
  function hitTitleItem(x, y, index, lay) {
    const yy = lay.y0 + index * lay.step;
    if (!(y > yy - lay.pad && y < yy + lay.pad)) return false;
    if (lay.left != null && lay.width != null) {
      return x > lay.left && x < lay.left + lay.width;
    }
    return Math.abs(x - lay.mid) < lay.halfW;
  }

  /**
   * Разбор клика после предупреждений лаборатории и выхода.
   * @param {number} x
   * @param {number} y
   */
  function hubClickEngine(x, y) {
    if (state === 'intro') { press('Enter'); return; }
    if (state === 'worldIntro') { if (typeof worldIntroPress === 'function') worldIntroPress(); return; }
    if (state === 'press') { dismissPressStart(); return; }
    if (state === 'settings') { clickSettings(x, y); return; }
    if (state === 'cameraSetup') { clickCameraSetup(x, y); return; }
    if (state === 'title') {
      const items = g._titleItems || [];
      const lay = {
        y0: g._titleY0 || 320,
        step: g._titleStep || 32,
        pad: g._titleHit || 14,
        left: g._titleColX,
        width: g._titleItemW || 340,
        mid: W / 2,
        halfW: 200
      };
      items.forEach(function (t, i) {
        if (hitTitleItem(x, y, i, lay)) { selTitle = i; press('Enter'); }
      });
      return;
    }
    if (state === 'tracks' && g._trackTiles) {
      for (let i = 0; i < g._trackTiles.length; i++) {
        if (!hitRect(x, y, g._trackTiles[i])) continue;
        if (trackPickSel === i) startDevTrack(i);
        else { trackPickSel = i; sClick(); }
        return;
      }
      return;
    }
    if (state === 'career' || state === 'careerTracks') { if (typeof careerClick === 'function') careerClick(x, y); return; }
    if (state === 'results') { press('Enter'); return; }
    if (state === 'garage' && !garagePaused && g._gar) {
      for (const b of g._gar) {
        if (hitRect(x, y, b)) { tuningSel = b.row; garageAction(0, b.row); break; }
      }
      return;
    }
    if (state === 'char') {
      if (bioOpen >= 0) {
        if (g._statBtns) for (const b of g._statBtns) { if (hitRect(x, y, b)) { upgradeCharStat(bioOpen, b.key); sClick(); return; } }
        if (g._bioActs) for (const b of g._bioActs) {
          if (hitRect(x, y, b)) {
            if (b.act === 'pick') confirmCharPick(bioOpen);
            else bioOpen = -1;
            sClick(); return;
          }
        }
        bioOpen = -1; sClick(); return;
      }
      if (hitRect(x, y, g._charBack)) { leaveCharSel(); sClick(); return; }
      if (g._bioBtns) for (const b of g._bioBtns) { if (hitRect(x, y, b)) { pickChar(b.idx); bioOpen = b.idx; sClick(); return; } }
      if (g._charCards) for (const b of g._charCards) { if (hitRect(x, y, b)) { if (b.idx !== selChar) { pickChar(b.idx); sClick(); } return; } }
      return;
    }
    if (state === 'junkTune') {
      if (typeof handleJunkTuneClick === 'function') handleJunkTuneClick(x, y);
      return;
    }
    if (state === 'car' && g._carSel) {
      for (let k = g._carSel.length - 1; k >= 0; k--) {
        const b = g._carSel[k];
        if (!hitRect(x, y, b)) continue;
        if (b.act === 'prev') { nudgeCarSel(-1); return; }
        if (b.act === 'next') { nudgeCarSel(1); return; }
        if (b.i != null) { pickCarSel(b.i); return; }
      }
      return;
    }
    if (state === 'gym' && g._gymBtns) {
      for (const b of g._gymBtns) { if (hitRect(x, y, b)) { gymSel = b.idx; buyGym(b.idx); sClick(); return; } }
      return;
    }
    if (state === 'armory' && typeof armoryClick === 'function') { armoryClick(x, y); return; }
    if (state === 'autopark' && g._park) {
      for (let k = g._park.length - 1; k >= 0; k--) {
        const b = g._park[k];
        if (!hitRect(x, y, b)) continue;
        if (b.act === 'prev') { nudgeParkSel(-1); return; }
        if (b.act === 'next') { nudgeParkSel(1); return; }
        if (b.i != null) {
          if (b.i === autoparkSel) {
            if (carUnlocked(b.i)) { autodetailOpen = true; state = 'detail'; sClick(); }
            else sHit();
          } else pickParkSel(b.i);
          return;
        }
      }
      return;
    }
    if (state === 'prerace' && g._preHits) {
      for (const b of g._preHits) {
        if (!hitRect(x, y, b)) continue;
        if (b.act === 'pick') { raceBoard.pick = b.id; sClick(); }
        else if (b.act === 'stake') {
          if (b.locked) { sHit(); garMsg = 'НЕ ХВАТАЕТ НА СТАВКУ'; garMsgT = 2.2; }
          else { save.bet = b.i; persist(); sClick(); }
        } else if (b.act === 'go') confirmPreRace();
        return;
      }
      return;
    }
    if (state === 'help') enterTitle();
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.pointer = { hitRect, hitTitleItem };
  engine.replace('hubClick', hubClickEngine);
})(typeof window !== 'undefined' ? window : globalThis);
