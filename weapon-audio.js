////////////////////////////////////////////////////////
//
// Выстрел: свой — ближний; чужой — дальний с дистанцией и стороной
//
////////////////////////////////////////////////////////
'use strict';

const CAR_WEAPON_DIR = 'assets/sounds/weapon/';
const CAR_WEAPON_MAX = 1100;
const CAR_WEAPON_NEAR_DIST = 70;
const CAR_WEAPON_PAN = 340;
const CAR_WEAPON_FAR_VOL = 0.82;

/** Имя файла или папки без пути. */
function carWeaponSafe(name) {
  const s = String(name || '').trim();
  if (!s || s.length > 80 || s.indexOf('..') >= 0 || /[\\/]/.test(s)) return '';
  return s;
}

/** Слот wep / ult из car.json лаборатории. */
function carWeaponSlot(idx, kind) {
  const cfg = (typeof editorCarConfig === 'function') ? editorCarConfig(idx) : null;
  const gun = cfg && cfg.audio && cfg.audio[kind];
  if (!gun || typeof gun !== 'object') return null;
  const pack = carWeaponSafe(gun.pack);
  if (!pack) return null;
  return {
    pack: pack,
    near: carWeaponSafe(gun.near) || 'shoot.wav',
    far: carWeaponSafe(gun.far) || 'distant0.wav'
  };
}

/** Громкость эффектов. */
function carWeaponVol() {
  if (typeof settings === 'undefined' || !settings || !settings.sound) return 0;
  if (settings.sound.sfxOn === false) return 0;
  return Math.max(0, Math.min(1, (settings.sound.sfx || 80) / 100));
}

/** Свой выстрел: игрок, не чужая машина в поле. */
function carWeaponIsSelf(racer) {
  if (!racer) return false;
  if (racer.isP) return true;
  return typeof P !== 'undefined' && P && racer === P;
}

/** URL клипа оружия. */
function carWeaponUrl(slot, file) {
  return CAR_WEAPON_DIR + slot.pack + '/' + file;
}

/**
 * Дальний выстрел на плоскости трассы: громкость, лево/право, верх/низ экрана.
 * pan −1 слева, +1 справа; along −1 сверху, +1 снизу.
 */
function carWeaponField(listener, racer) {
  if (!listener || !racer) {
    return { dist: 0, spat: 0, pan: 0, along: 0, gain: 0 };
  }
  const dx = (racer.x || 0) - (listener.x || 0);
  const dy = (racer.y || 0) - (listener.y || 0);
  const dist = Math.hypot(dx, dy);
  let spat = 0;
  if (dist <= CAR_WEAPON_NEAR_DIST) spat = 1;
  else if (dist < CAR_WEAPON_MAX) {
    const t = (dist - CAR_WEAPON_NEAR_DIST) / (CAR_WEAPON_MAX - CAR_WEAPON_NEAR_DIST);
    spat = Math.pow(1 - t, 1.45);
  }
  const pan = Math.max(-1, Math.min(1, dx / CAR_WEAPON_PAN));
  const along = Math.max(-1, Math.min(1, dy / CAR_WEAPON_PAN));
  const vert = 1 - Math.max(0, along) * 0.28;
  const gain = spat * vert;
  return { dist: dist, spat: spat, pan: pan, along: along, gain: gain };
}

/** Элемент Audio: клип «от себя», без шины панорамы. */
function carWeaponPlayHtml(url, gain) {
  const a = new Audio();
  const src = (typeof bootMediaSrc === 'function') ? bootMediaSrc(url) : url;
  a.src = (!src || /^blob:|^data:/i.test(src)) ? src : encodeURI(src);
  a.volume = Math.max(0.04, Math.min(1, gain));
  a.play().catch(function () {});
}

/**
 * Чужой выстрел: дальний клип, громкость по дистанции, стерео по стороне и высоте.
 * Стереофайл не гоняем через HRTF — иначе схлопнется в моно.
 */
function carWeaponPlayFar(url, field, vol) {
  if (typeof AU === 'undefined' || !AU.ctx || !AU.sfx) return false;
  if (typeof carEngineLoad === 'function') carEngineLoad(url);
  const buf = carEngineShare && carEngineShare.buf[url];
  if (buf && buf !== 'bad') {
    const src = AU.ctx.createBufferSource();
    src.buffer = buf;
    const g = AU.ctx.createGain();
    g.gain.value = Math.max(0.03, vol * CAR_WEAPON_FAR_VOL * field.gain);
    const tone = AU.ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.Q.value = 0.7;
    tone.frequency.value = 2800 + (0.5 - field.along * 0.5) * 10000;
    src.connect(g);
    g.connect(tone);
    const stereo = buf.numberOfChannels > 1;
    if (stereo && AU.ctx.createStereoPanner) {
      const p = AU.ctx.createStereoPanner();
      p.pan.value = field.pan;
      tone.connect(p);
      p.connect(AU.sfx);
    } else if (AU.ctx.createPanner) {
      const p = AU.ctx.createPanner();
      p.panningModel = 'equalpower';
      p.distanceModel = 'inverse';
      p.refDistance = 1;
      p.rolloffFactor = 0;
      if (p.positionX) {
        p.positionX.value = field.pan * 2.2;
        p.positionY.value = -field.along * 2.2;
        p.positionZ.value = 0.35;
      } else {
        p.setPosition(field.pan * 2.2, -field.along * 2.2, 0.35);
      }
      tone.connect(p);
      p.connect(AU.sfx);
    } else {
      tone.connect(AU.sfx);
    }
    src.start();
    return true;
  }
  if (buf === 'bad' || (carEngineShare && carEngineShare.miss[url])) return false;
  carWeaponPlayHtml(url, vol * CAR_WEAPON_FAR_VOL * field.gain);
  return true;
}

/**
 * Играет выстрел слота. true — семпл пошёл, синтез не нужен.
 * kind: wep | ult
 */
function playCarWeapon(racer, kind) {
  if (!racer) return false;
  const vol = carWeaponVol();
  if (vol <= 0) return true;
  const slot = carWeaponSlot(racer.car ? racer.car.idx : 0, kind || 'wep');
  if (!slot) return false;
  if (carWeaponIsSelf(racer)) {
    carWeaponPlayHtml(carWeaponUrl(slot, slot.near), vol);
    return true;
  }
  if (typeof P === 'undefined' || !P) return true;
  const field = carWeaponField(P, racer);
  if (field.spat < 0.02) return true;
  const url = carWeaponUrl(slot, slot.far);
  if (typeof AU !== 'undefined' && AU.ctx && AU.sfx && typeof carEngineLoad === 'function') {
    return carWeaponPlayFar(url, field, vol);
  }
  carWeaponPlayHtml(url, vol * CAR_WEAPON_FAR_VOL * field.gain);
  return true;
}
