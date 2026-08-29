////////////////////////////////////////////////////////
//
// Пресеты эмиттеров three.quarks под 2D-мир гонки
//
////////////////////////////////////////////////////////

import * as THREE from 'three';
import {
  Bezier,
  ColorOverLife,
  ColorRange,
  ConeEmitter,
  ConstantColor,
  ConstantValue,
  IntervalValue,
  ParticleSystem,
  PiecewiseBezier,
  PointEmitter,
  RenderMode,
  SizeOverLife,
  SphereEmitter,
  Vector4
} from 'three.quarks';

const AIM_UP = new THREE.Vector3(0, 1, 0);
const CONE_AXIS = new THREE.Vector3(0, 0, 1);
const AIM_DIR = new THREE.Vector3();

/** Мягкий спрайт: ядро белое, край прозрачный. */
export function makeSoftMap() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 1, 32, 32, 31);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

/** Вертикальная лента ветра позади кузова. */
export function makeStreakMap() {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 64;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(8, 0, 8, 64);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.22, 'rgba(255,255,255,.12)');
  g.addColorStop(0.5, 'rgba(255,255,255,.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.beginPath();
  x.moveTo(8, 2);
  x.lineTo(12, 44);
  x.lineTo(8, 62);
  x.lineTo(4, 44);
  x.closePath();
  x.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

/** Материал биллборда без записи глубины — оверлей на ортокамере. */
function spriteMat(map) {
  return new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.NormalBlending
  });
}

/** Затухание размера за жизнь частицы. */
function fadeSize() {
  return new SizeOverLife(new PiecewiseBezier([[new Bezier(1, 0.7, 0.35, 0.05), 0]]));
}

/**
 * Одноразовый всплеск: без потока, только burst на старте.
 * @param {object} p карта, цвета, скорость, размер, число
 */
function burstSystem(p) {
  return new ParticleSystem({
    duration: p.duration || 1.1,
    looping: false,
    prewarm: false,
    worldSpace: true,
    startLife: p.life || new IntervalValue(0.25, 0.7),
    startSpeed: p.speed || new IntervalValue(40, 220),
    startSize: p.size || new IntervalValue(6, 16),
    startColor: p.color || new ConstantColor(new Vector4(1, 1, 1, 1)),
    emissionOverTime: new ConstantValue(0),
    emissionBursts: [{
      time: 0,
      count: new ConstantValue(p.count === undefined ? 24 : p.count),
      cycle: 1,
      interval: 0.01,
      probability: 1
    }],
    shape: p.shape || new SphereEmitter({ radius: p.radius || 6 }),
    material: p.mat,
    renderMode: p.renderMode || RenderMode.BillBoard,
    speedFactor: p.speedFactor,
    lengthFactor: p.lengthFactor,
    behaviors: p.behaviors || [fadeSize()]
  });
}

/** Пул: двигаем эмиттер и restart, без создания системы на каждый взрыв. */
function makePool(factory, n, scene, batch) {
  const items = [];
  let i = 0;
  for (let k = 0; k < n; k++) {
    const ps = factory();
    scene.add(ps.emitter);
    batch.addSystem(ps);
    items.push(ps);
  }
  return {
    fire(x, y, ang) {
      const ps = items[i++ % items.length];
      ps.emitter.position.set(x, -y, 0);
      if (ang != null && isFinite(ang)) {
        AIM_DIR.set(-Math.cos(ang), Math.sin(ang), 0);
        if (AIM_DIR.lengthSq() > 1e-8) {
          AIM_DIR.normalize();
          ps.emitter.quaternion.setFromUnitVectors(AIM_UP, AIM_DIR);
        } else ps.emitter.quaternion.identity();
        ps.startRotation = new ConstantValue(ang + Math.PI / 2);
      } else {
        ps.emitter.quaternion.identity();
        ps.startRotation = new ConstantValue(0);
      }
      ps.emitter.updateMatrixWorld(true);
      ps.restart();
    },
    /** Точки контура кузова: конус вдоль нормали альфы (ось ConeEmitter = +Z). */
    fireRim(pts, per) {
      if (!pts || !pts.length) return false;
      const ps = items[i++ % items.length];
      ps.restart();
      const nEach = Math.max(1, per | 0);
      const cap = Math.min(pts.length, 220);
      const step = pts.length / cap;
      for (let k = 0; k < cap; k++) {
        const p = pts[(k * step) | 0];
        if (!p) continue;
        ps.emitter.position.set(p.x, -p.y, 0);
        AIM_DIR.set(p.nx, -p.ny, 0);
        if (AIM_DIR.lengthSq() < 1e-10) AIM_DIR.set(1, 0, 0);
        else AIM_DIR.normalize();
        ps.emitter.quaternion.setFromUnitVectors(CONE_AXIS, AIM_DIR);
        ps.emitter.updateMatrixWorld(true);
        ps.normalMatrix.getNormalMatrix(ps.emitter.matrixWorld);
        ps.spawn(nEach, ps.emissionState, ps.emitter.matrixWorld);
      }
      return true;
    }
  };
}

/** Собрать все пулы для слоя. */
export function buildPools(scene, batch, map, streakMap) {
  const fireMat = spriteMat(map);
  const smokeMat = spriteMat(map);
  const dustMat = spriteMat(map);
  const sparkMat = spriteMat(map);
  const windMat = spriteMat(streakMap || map);

  const fireCol = new ColorRange(
    new Vector4(1, 0.92, 0.45, 1),
    new Vector4(1, 0.22, 0.05, 0.15)
  );
  const smokeCol = new ColorRange(
    new Vector4(0.28, 0.25, 0.22, 0.7),
    new Vector4(0.08, 0.07, 0.06, 0)
  );
  const dustCol = new ColorRange(
    new Vector4(0.72, 0.58, 0.38, 0.65),
    new Vector4(0.4, 0.32, 0.22, 0)
  );

  const carFire = makePool(() => burstSystem({
    count: 56,
    radius: 16,
    duration: 1.05,
    life: new IntervalValue(0.28, 0.7),
    speed: new IntervalValue(70, 360),
    size: new IntervalValue(12, 28),
    color: new ConstantColor(new Vector4(1, 0.72, 0.18, 1)),
    mat: fireMat,
    behaviors: [fadeSize(), new ColorOverLife(fireCol)]
  }), 6, scene, batch);

  const carSmoke = makePool(() => burstSystem({
    count: 28,
    radius: 18,
    duration: 1.6,
    life: new IntervalValue(0.6, 1.35),
    speed: new IntervalValue(18, 110),
    size: new IntervalValue(18, 42),
    color: new ConstantColor(new Vector4(0.22, 0.2, 0.18, 0.75)),
    mat: smokeMat,
    behaviors: [fadeSize(), new ColorOverLife(smokeCol)]
  }), 6, scene, batch);

  const carDebris = makePool(() => burstSystem({
    count: 16,
    radius: 8,
    duration: 0.9,
    life: new IntervalValue(0.35, 0.8),
    speed: new IntervalValue(80, 280),
    size: new IntervalValue(4, 10),
    color: new ConstantColor(new Vector4(0.45, 0.28, 0.12, 1)),
    mat: sparkMat,
    behaviors: [fadeSize()]
  }), 6, scene, batch);

  const mineFlash = makePool(() => burstSystem({
    count: 28,
    radius: 8,
    duration: 0.55,
    life: new IntervalValue(0.1, 0.32),
    speed: new IntervalValue(60, 240),
    size: new IntervalValue(6, 14),
    color: new ConstantColor(new Vector4(1, 0.95, 0.55, 1)),
    mat: fireMat,
    behaviors: [fadeSize()]
  }), 6, scene, batch);

  const mineDirt = makePool(() => burstSystem({
    count: 20,
    radius: 10,
    duration: 0.85,
    life: new IntervalValue(0.25, 0.7),
    speed: new IntervalValue(40, 180),
    size: new IntervalValue(8, 18),
    color: new ConstantColor(new Vector4(0.55, 0.42, 0.22, 0.8)),
    mat: dustMat,
    behaviors: [fadeSize(), new ColorOverLife(dustCol)]
  }), 6, scene, batch);

  const mineSmoke = makePool(() => burstSystem({
    count: 10,
    radius: 12,
    duration: 1.0,
    life: new IntervalValue(0.4, 0.9),
    speed: new IntervalValue(12, 70),
    size: new IntervalValue(12, 26),
    color: new ConstantColor(new Vector4(0.3, 0.28, 0.24, 0.55)),
    mat: smokeMat,
    behaviors: [fadeSize(), new ColorOverLife(smokeCol)]
  }), 6, scene, batch);

  const rocketFire = makePool(() => burstSystem({
    count: 36,
    radius: 9,
    duration: 0.7,
    life: new IntervalValue(0.15, 0.45),
    speed: new IntervalValue(90, 340),
    size: new IntervalValue(7, 18),
    color: new ConstantColor(new Vector4(1, 0.45, 0.12, 1)),
    mat: fireMat,
    behaviors: [fadeSize(), new ColorOverLife(fireCol)]
  }), 6, scene, batch);

  const rocketSmoke = makePool(() => burstSystem({
    count: 12,
    radius: 11,
    duration: 0.95,
    life: new IntervalValue(0.35, 0.85),
    speed: new IntervalValue(20, 100),
    size: new IntervalValue(10, 24),
    color: new ConstantColor(new Vector4(0.28, 0.22, 0.18, 0.6)),
    mat: smokeMat,
    behaviors: [fadeSize(), new ColorOverLife(smokeCol)]
  }), 6, scene, batch);

  const dust = makePool(() => burstSystem({
    count: 22,
    radius: 8,
    duration: 1.2,
    life: new IntervalValue(0.4, 1),
    speed: new IntervalValue(30, 160),
    size: new IntervalValue(8, 22),
    color: new ConstantColor(new Vector4(0.66, 0.54, 0.36, 0.6)),
    mat: dustMat,
    behaviors: [fadeSize(), new ColorOverLife(dustCol)]
  }), 10, scene, batch);

  const spark = makePool(() => burstSystem({
    count: 16,
    radius: 3,
    duration: 0.6,
    life: new IntervalValue(0.12, 0.4),
    speed: new IntervalValue(80, 280),
    size: new IntervalValue(3, 8),
    shape: new PointEmitter(),
    color: new ConstantColor(new Vector4(1, 0.82, 0.25, 1)),
    mat: sparkMat,
    behaviors: [fadeSize()]
  }), 12, scene, batch);

  const muzzle = makePool(() => burstSystem({
    count: 10,
    radius: 4,
    duration: 0.35,
    life: new IntervalValue(0.05, 0.18),
    speed: new IntervalValue(40, 160),
    size: new IntervalValue(5, 14),
    color: new ConstantColor(new Vector4(1, 0.9, 0.45, 1)),
    mat: fireMat,
    behaviors: [fadeSize()]
  }), 10, scene, batch);

  const nitro = makePool(() => burstSystem({
    count: 3,
    duration: 0.5,
    life: new IntervalValue(0.18, 0.38),
    speed: new IntervalValue(12, 40),
    size: new IntervalValue(14, 26),
    color: new ConstantColor(new Vector4(0.88, 0.94, 1, 0.42)),
    shape: new ConeEmitter({ radius: 4, angle: 0.08, thickness: 1, arc: Math.PI * 2 }),
    mat: windMat,
    renderMode: RenderMode.BillBoard,
    behaviors: [fadeSize()]
  }), 12, scene, batch);

  const scrape = makePool(() => burstSystem({
    count: 0,
    duration: 0.45,
    life: new IntervalValue(0.05, 0.18),
    speed: new IntervalValue(70, 220),
    size: new IntervalValue(0.325, 0.85),
    shape: new ConeEmitter({ radius: 0, angle: 0.28, thickness: 1, arc: Math.PI * 2 }),
    color: new ConstantColor(new Vector4(1, 0.78, 0.28, 1)),
    mat: sparkMat,
    renderMode: RenderMode.StretchedBillBoard,
    speedFactor: 0.2,
    lengthFactor: 0.45,
    behaviors: [fadeSize()]
  }), 8, scene, batch);

  const trail = makePool(() => burstSystem({
    count: 4,
    radius: 2,
    duration: 0.45,
    life: new IntervalValue(0.15, 0.4),
    speed: new IntervalValue(10, 50),
    size: new IntervalValue(4, 10),
    color: new ConstantColor(new Vector4(1, 0.55, 0.15, 0.9)),
    mat: fireMat,
    behaviors: [fadeSize()]
  }), 8, scene, batch);

  const engineSmoke = makePool(() => burstSystem({
    count: 5,
    radius: 4,
    duration: 0.9,
    life: new IntervalValue(0.4, 0.85),
    speed: new IntervalValue(8, 40),
    size: new IntervalValue(8, 18),
    color: new ConstantColor(new Vector4(0.15, 0.15, 0.15, 0.55)),
    mat: smokeMat,
    behaviors: [fadeSize(), new ColorOverLife(smokeCol)]
  }), 8, scene, batch);

  return {
    carFire, carSmoke, carDebris,
    mineFlash, mineDirt, mineSmoke,
    rocketFire, rocketSmoke,
    dust, spark, muzzle, nitro, scrape, trail, engineSmoke
  };
}
