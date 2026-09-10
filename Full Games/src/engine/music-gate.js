////////////////////////////////////////////////////////
//
// DiVANEngine: выключатель и папка музыки. CHIP_BASS / CHIP_LEAD остаются в HTML.
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  /**
   * Музыка включена в настройках.
   * @returns {boolean}
   */
  function musicOnEngine() {
    return !!(settings && settings.sound && settings.sound.musicOn);
  }

  /**
   * Папка плейлиста по экрану.
   * @returns {string}
   */
  function musicCatEngine() {
    if (state === 'intro' || state === 'worldIntro') return 'main';
    if (state === 'title' || state === 'press') return 'cast';
    if (state === 'car') return 'change';
    if (state === 'race' || state === 'results') return 'racing';
    if (state === 'garage' || state === 'autopark' || state === 'detail' || state === 'prerace' || state === 'gym' || state === 'armory' || state === 'career' || state === 'careerTracks' || state === 'junkTune') return 'garage';
    return 'main';
  }

  /**
   * В десктопе отрезает http(s): только диск, без ikrinka.
   * @param {string[]} list
   * @returns {string[]}
   */
  function onlyDiskOnDesktop(list) {
    const root = typeof window !== 'undefined' ? window : globalThis;
    if (!root.__RNR_DESKTOP__) return list;
    return (list || []).filter(function (u) {
      return !/^https?:\/\//i.test(String(u || ''));
    });
  }

  const engine = global.DiVANEngine;
  if (!engine) return;
  engine.replace('musicOn', musicOnEngine);
  engine.replace('musicCat', musicCatEngine);
  if (typeof musicSources === 'function') {
    engine.wrap('musicSources', function (orig) {
      return function (url) { return onlyDiskOnDesktop(orig(url) || []); };
    });
  }
  if (typeof sfxSources === 'function') {
    engine.wrap('sfxSources', function (orig) {
      return function (url) { return onlyDiskOnDesktop(orig(url) || []); };
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
