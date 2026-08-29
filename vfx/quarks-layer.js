////////////////////////////////////////////////////////
//
// Слой three.quarks: ортокамера = мир гонки, блют в 2D
//
////////////////////////////////////////////////////////

import * as THREE from 'three';
import { BatchedRenderer } from 'three.quarks';
import { buildPools, makeSoftMap, makeStreakMap } from './quarks-presets.js';

const api = {
  ok: false,
  tick() {},
  blit() {},
  boom() { return false; },
  dust() { return false; },
  spark() { return false; },
  muzzle() { return false; },
  nitro() { return false; },
  smoke() { return false; },
  trail() { return false; },
  scrape() { return false; }
};

window.RnRVfx = api;

let renderer, scene, camera, batch, pools, lastDt = 0;

/** Ортокамера смотрит на плоскость XY (Y канваса инвертирован). */
function applyWorldRect(left, top, right, bottom) {
  const cx = (left + right) / 2;
  const cy = -(top + bottom) / 2;
  const hw = Math.max(8, (right - left) / 2);
  const hh = Math.max(8, (bottom - top) / 2);
  camera.left = -hw;
  camera.right = hw;
  camera.top = hh;
  camera.bottom = -hh;
  camera.position.set(cx, cy, 400);
  camera.lookAt(cx, cy, 0);
  camera.up.set(0, 1, 0);
  camera.updateProjectionMatrix();
}

/** Гонка: мир с верхнего левого угла камеры, масштаб viewS * zoom. */
function syncRace(s) {
  const k = s.viewS * s.z;
  if (k < 0.0001) return;
  const left = s.camX - s.sx;
  const top = s.camY - s.sy;
  applyWorldRect(left, top, left + s.cvW / k, top + s.cvH / k);
}

/** Меню: клип 1280×720, центр titleCam, затем letterbox viewS. */
function syncTitle(s) {
  const z = s.z || 1;
  const left = s.titleX + ((-s.viewOX) / s.viewS - s.W / 2) / z;
  const right = s.titleX + ((s.cvW - s.viewOX) / s.viewS - s.W / 2) / z;
  const top = s.titleY + ((-s.viewOY) / s.viewS - s.H / 2) / z;
  const bottom = s.titleY + ((s.cvH - s.viewOY) / s.viewS - s.H / 2) / z;
  applyWorldRect(left, top, right, bottom);
}

/** Подгоняем буфер WebGL под игровой холст. */
function fitBuffer(s) {
  if (!renderer || !s) return;
  const w = s.cvW | 0, h = s.cvH | 0;
  if (w < 2 || h < 2) return;
  const sz = renderer.getSize(new THREE.Vector2());
  if (sz.x !== w || sz.y !== h) renderer.setSize(w, h, false);
}

try {
  renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance'
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(1);
  renderer.autoClear = true;
  renderer.domElement.style.display = 'none';

  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2000);
  batch = new BatchedRenderer();
  scene.add(batch);
  pools = buildPools(scene, batch, makeSoftMap(), makeStreakMap());

  api.ok = true;

  api.tick = function (dt) {
    lastDt = Math.min(0.033, Math.max(0, dt || 0));
  };

  api.blitCount = 0;
  api.blit = function (mode, ctx) {
    if (!api.ok || !ctx || typeof window.RnRVfxSnap !== 'function') return;
    const s = window.RnRVfxSnap(mode);
    if (!s) return;
    fitBuffer(s);
    if (mode === 'title') syncTitle(s);
    else syncRace(s);
    batch.update(lastDt);
    lastDt = 0;
    renderer.render(scene, camera);
    api.blitCount = (api.blitCount || 0) + 1;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(renderer.domElement, 0, 0);
    ctx.restore();
  };

  api.boom = function (x, y, kind) {
    if (!api.ok) return false;
    const k = kind === true || kind === 'car' ? 'car' : kind === 'rocket' ? 'rocket' : 'mine';
    if (k === 'car') {
      pools.carFire.fire(x, y);
      pools.carSmoke.fire(x, y);
      pools.carDebris.fire(x, y);
    } else if (k === 'rocket') {
      pools.rocketFire.fire(x, y);
      pools.rocketSmoke.fire(x, y);
      pools.spark.fire(x, y);
    } else {
      pools.mineFlash.fire(x, y);
      pools.mineDirt.fire(x, y);
      pools.mineSmoke.fire(x, y);
    }
    return true;
  };

  api.dust = function (x, y) {
    if (!api.ok) return false;
    pools.dust.fire(x, y);
    return true;
  };

  api.spark = function (x, y) {
    if (!api.ok) return false;
    pools.spark.fire(x, y);
    return true;
  };

  api.muzzle = function (x, y) {
    if (!api.ok) return false;
    pools.muzzle.fire(x, y);
    return true;
  };

  api.nitro = function (x, y, ang) {
    if (!api.ok) return false;
    pools.nitro.fire(x, y, ang);
    if (ang != null && isFinite(ang)) {
      const lx = -Math.sin(ang), ly = Math.cos(ang);
      pools.nitro.fire(x + lx * 9, y + ly * 9, ang);
      pools.nitro.fire(x - lx * 9, y - ly * 9, ang);
    }
    return true;
  };

  api.scrape = function (x, y, impact, ang) {
    if (!api.ok) return false;
    pools.scrape.fire(x, y, ang);
    if (ang != null && isFinite(ang)) {
      const lx = -Math.sin(ang), ly = Math.cos(ang);
      pools.scrape.fire(x + lx * 11, y + ly * 11, ang);
      pools.scrape.fire(x - lx * 11, y - ly * 11, ang);
    }
    if ((impact || 0) > 0.75) pools.scrape.fire(x, y, ang);
    return true;
  };

  api.smoke = function (x, y) {
    if (!api.ok) return false;
    pools.engineSmoke.fire(x, y);
    return true;
  };

  api.trail = function (x, y) {
    if (!api.ok) return false;
    pools.trail.fire(x, y);
    return true;
  };
} catch (err) {
  console.warn('VFX quarks не поднялся, остаются частицы canvas', err);
  api.ok = false;
}
