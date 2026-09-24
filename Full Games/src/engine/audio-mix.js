// Отдельный канал интерфейса; мир слышен только в активном заезде.
(function (global) {
  'use strict';
  const E = global.DiVANEngine;
  if (!E) return;
  let context = null;
  const media = new WeakMap();
  const clamp01 = value => Math.max(0, Math.min(1, value));
  function live() {
    return state === 'race' && !paused && !document.hidden && !(typeof R !== 'undefined' && R && R.demo);
  }
  function effectLevel() {
    const s = settings.sound;
    return s.sfxOn === false ? 0 : clamp01((s.sfx ?? 80) / 100);
  }
  function musicLevel() {
    const s = settings.sound;
    if (!s.musicOn || document.hidden) return 0;
    const scale = state === 'race' ? (paused ? .14 : .38)
      : state === 'settings' || state === 'cameraSetup' ? .28 : .48;
    return clamp01((s.music ?? 50) / 100) * scale;
  }
  function smooth(param, value, time = .045) {
    if (!param || !AU.ctx) return;
    param.cancelScheduledValues(AU.ctx.currentTime);
    param.setTargetAtTime(value, AU.ctx.currentTime, time);
  }
  function ensure() {
    if (!AU.ctx || !AU.master) return false;
    if (context !== AU.ctx) {
      context = AU.ctx;
      AU.ui = context.createGain();
      AU.ui.gain.value = 0;
      AU.ui.connect(AU.master);
      // Ограничитель ловит сумму близких моторов и выстрелов, не сжимая отклики меню.
      const limiter = context.createDynamicsCompressor();
      limiter.threshold.value = -8; limiter.knee.value = 9; limiter.ratio.value = 6;
      limiter.attack.value = .004; limiter.release.value = .18;
      AU.sfx.disconnect(); AU.sfx.connect(limiter); limiter.connect(AU.master);
      AU.worldLimiter = limiter;
    }
    return true;
  }
  function sync(immediate = false) {
    if (!ensure()) return;
    const fx = effectLevel(), world = live() ? fx * .85 : 0;
    // Меню закрывает и уже звучащие выстрелы. Отклик не проходит через этот канал.
    if (!world || immediate) { AU.sfx.gain.cancelScheduledValues(AU.ctx.currentTime); AU.sfx.gain.value = world; }
    else smooth(AU.sfx.gain, world);
    const ui = document.hidden ? 0 : fx * 1.85;
    if (!ui || immediate) { AU.ui.gain.cancelScheduledValues(AU.ctx.currentTime); AU.ui.gain.value = ui; }
    else smooth(AU.ui.gain, ui, .015);
    AU.master.gain.value = .65;
    if (MUSIC.el) {
      const target = musicLevel(), elapsed = Math.max(0, AU.ctx.currentTime - (MUSIC.el._mixAt ?? AU.ctx.currentTime));
      MUSIC.el._mixAt = AU.ctx.currentTime;
      MUSIC.el.volume = immediate || !target ? target : target + (MUSIC.el.volume - target) * Math.exp(-elapsed / .16);
    }
  }
  // HTML-клипы используют ту же громкость и панораму, что декодированные WAV.
  function routeMedia(el, pan = 0) {
    if (!ensure() || !AU.ctx.createMediaElementSource) return null;
    let route = media.get(el);
    if (!route) {
      const source = AU.ctx.createMediaElementSource(el), node = AU.ctx.createStereoPanner();
      source.connect(node); node.connect(AU.sfx);
      route = { source, node }; media.set(el, route);
      node.pan.value = pan;
    } else smooth(route.node.pan, pan, .065);
    return route;
  }
  function releaseMedia(el) {
    const route = media.get(el);
    if (route) { route.source.disconnect(); route.node.disconnect(); media.delete(el); }
  }
  E.audioMix = { live, effectLevel, musicLevel, sync, routeMedia, releaseMedia, smooth };
  E.wrap('audioInit', previous => function () { const result = previous.apply(this, arguments); sync(true); return result; });
  E.wrap('applyAudioSettings', previous => function () { const result = previous.apply(this, arguments); sync(true); return result; });
  E.wrap('updEngine', previous => function () { sync(); return previous.apply(this, arguments); });
  E.wrap('press', previous => function () { const result = previous.apply(this, arguments); sync(); return result; });
  document.addEventListener('visibilitychange', () => sync(true));
})(typeof window !== 'undefined' ? window : globalThis);
