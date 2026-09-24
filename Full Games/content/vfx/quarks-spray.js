////////////////////////////////////////////////////////
//
// Пыль / снег / вода из-под колёс (пулы three.quarks)
//
////////////////////////////////////////////////////////

import {
  ColorOverLife,
  ColorRange,
  ConeEmitter,
  ConstantColor,
  ConstantValue,
  IntervalValue,
  ParticleSystem,
  PiecewiseBezier,
  Bezier,
  SizeOverLife,
  SphereEmitter,
  Vector4
} from 'three.quarks';
import * as THREE from 'three';

const AIM_UP = new THREE.Vector3(0, 1, 0);
const AIM_DIR = new THREE.Vector3();

/** Затухание размера. */
function fadeSize() {
  return new SizeOverLife(new PiecewiseBezier([[new Bezier(1, 0.7, 0.35, 0.05), 0]]));
}

/** Биллборд без глубины. */
function spriteMat(map) {
  return new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.NormalBlending
  });
}

/**
 * Одноразовый всплеск.
 * @param {object} p параметры системы
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
    renderMode: p.renderMode,
    behaviors: p.behaviors || [fadeSize()]
  });
}

/** Пул restart по кругу. */
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
    }
  };
}

/**
 * Снег, вода, песок из-под шин.
 * @param {THREE.Scene} scene сцена
 * @param {object} batch batched renderer
 * @param {THREE.Texture} map мягкий спрайт
 */
export function buildSprayPools(scene, batch, map) {
  const mat = spriteMat(map);
  const snowCol = new ColorRange(
    new Vector4(0.95, 0.97, 1, 0.85),
    new Vector4(0.72, 0.82, 0.92, 0)
  );
  const waterCol = new ColorRange(
    new Vector4(0.55, 0.78, 0.95, 0.8),
    new Vector4(0.2, 0.38, 0.55, 0)
  );
  const sandCol = new ColorRange(
    new Vector4(0.72, 0.58, 0.38, 0.65),
    new Vector4(0.4, 0.32, 0.22, 0)
  );
  const cone = () => new ConeEmitter({ radius: 5, angle: 0.55, thickness: 1, arc: Math.PI * 2 });

  const snow = makePool(() => burstSystem({
    count: 26,
    duration: 1.15,
    life: new IntervalValue(0.45, 1.05),
    speed: new IntervalValue(40, 150),
    size: new IntervalValue(6, 16),
    color: new ConstantColor(new Vector4(0.96, 0.98, 1, 0.8)),
    shape: cone(),
    mat,
    behaviors: [fadeSize(), new ColorOverLife(snowCol)]
  }), 8, scene, batch);

  const water = makePool(() => burstSystem({
    count: 20,
    duration: 0.7,
    life: new IntervalValue(0.18, 0.48),
    speed: new IntervalValue(90, 260),
    size: new IntervalValue(4, 11),
    color: new ConstantColor(new Vector4(0.7, 0.88, 1, 0.75)),
    shape: cone(),
    mat,
    behaviors: [fadeSize(), new ColorOverLife(waterCol)]
  }), 8, scene, batch);

  const sand = makePool(() => burstSystem({
    count: 22,
    duration: 1.2,
    life: new IntervalValue(0.4, 1),
    speed: new IntervalValue(30, 160),
    size: new IntervalValue(8, 22),
    color: new ConstantColor(new Vector4(0.66, 0.54, 0.36, 0.6)),
    mat,
    behaviors: [fadeSize(), new ColorOverLife(sandCol)]
  }), 8, scene, batch);

  return { snow, water, sand };
}
