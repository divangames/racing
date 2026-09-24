////////////////////////////////////////////////////////
//
// Горящий корпус: чёрный дым и огонь three.quarks
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
  RenderMode,
  SizeOverLife,
  Vector4
} from 'three.quarks';

const CONE_AXIS = new THREE.Vector3(0, 0, 1);
const SCREEN_UP = new THREE.Vector3(0, 1, 0);

/** Дым раздувается, огонь сжимается в язык. */
function smokeSize() {
  return new SizeOverLife(new PiecewiseBezier([[new Bezier(0.45, 0.85, 1.15, 1.6), 0]]));
}

/** Пламя короче и ярче у основания. */
function fireSize() {
  return new SizeOverLife(new PiecewiseBezier([[new Bezier(1, 0.75, 0.35, 0.08), 0]]));
}

/** Материал биллборда без записи глубины. */
function spriteMat(map, additive) {
  return new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
  });
}

/**
 * Короткий поток из конуса вверх по экрану (ось quarks +Y).
 * @param {object} p карта, цвета, скорость
 */
function coneBurst(p) {
  return new ParticleSystem({
    duration: p.duration || 0.9,
    looping: false,
    prewarm: false,
    worldSpace: true,
    startLife: p.life,
    startSpeed: p.speed,
    startSize: p.size,
    startColor: p.color,
    emissionOverTime: new ConstantValue(0),
    emissionBursts: [{
      time: 0,
      count: new ConstantValue(p.count === undefined ? 8 : p.count),
      cycle: 1,
      interval: 0.01,
      probability: 1
    }],
    shape: new ConeEmitter({
      radius: p.radius || 3,
      angle: p.angle || 0.32,
      thickness: 1,
      arc: Math.PI * 2
    }),
    material: p.mat,
    renderMode: RenderMode.BillBoard,
    behaviors: p.behaviors
  });
}

/** Пул: эмиттер в точку корпуса, конус вверх. */
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
    fire(x, y) {
      const ps = items[i++ % items.length];
      ps.emitter.position.set(x, -y, 0);
      ps.emitter.quaternion.setFromUnitVectors(CONE_AXIS, SCREEN_UP);
      ps.emitter.updateMatrixWorld(true);
      ps.restart();
    }
  };
}

/**
 * Дым и огонь «на исходе».
 * @param {THREE.Scene} scene сцена
 * @param {*} batch BatchedRenderer
 * @param {THREE.Texture} map мягкий спрайт
 */
export function buildWreckPools(scene, batch, map) {
  const smokeMat = spriteMat(map, false);
  const fireMat = spriteMat(map, true);
  const smokeCol = new ColorRange(
    new Vector4(0.07, 0.06, 0.05, 0.82),
    new Vector4(0.02, 0.02, 0.02, 0)
  );
  const fireCol = new ColorRange(
    new Vector4(1, 0.92, 0.45, 1),
    new Vector4(1, 0.18, 0.04, 0)
  );

  const wreckSmoke = makePool(() => coneBurst({
    count: 7,
    radius: 5,
    angle: 0.42,
    duration: 1.4,
    life: new IntervalValue(0.7, 1.45),
    speed: new IntervalValue(22, 70),
    size: new IntervalValue(16, 34),
    color: new ConstantColor(new Vector4(0.05, 0.045, 0.04, 0.8)),
    mat: smokeMat,
    behaviors: [smokeSize(), new ColorOverLife(smokeCol)]
  }), 10, scene, batch);

  const wreckFire = makePool(() => coneBurst({
    count: 9,
    radius: 3,
    angle: 0.28,
    duration: 0.7,
    life: new IntervalValue(0.18, 0.42),
    speed: new IntervalValue(28, 90),
    size: new IntervalValue(8, 18),
    color: new ConstantColor(new Vector4(1, 0.7, 0.18, 1)),
    mat: fireMat,
    behaviors: [fireSize(), new ColorOverLife(fireCol)]
  }), 10, scene, batch);

  return { wreckSmoke, wreckFire };
}
