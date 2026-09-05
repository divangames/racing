////////////////////////////////////////////////////////
//
// Погода three.quarks: дождь, снег, буря, пепел вулкана
//
////////////////////////////////////////////////////////

import * as THREE from 'three';
import {
  ColorOverLife,
  ColorRange,
  ConstantColor,
  ConstantValue,
  IntervalValue,
  ParticleSystem,
  PiecewiseBezier,
  Bezier,
  RenderMode,
  SizeOverLife,
  SphereEmitter,
  TurbulenceField,
  Vector3,
  Vector4
} from 'three.quarks';

const GROUPS = {
  rain: ['rain'],
  snow: ['snow'],
  sand: ['sand'],
  ash: ['ash', 'ember']
};

const RATE = { rain: 180, snow: 220, sand: 240, ash: 70, ember: 48 };

/** Скорость в мире quarks (Y вверх). */
const FALL = {
  rain: { ax: 90, ay: -720, bx: 150, by: -980 },
  snow: { ax: -36, ay: -92, bx: 28, by: -42 },
  sand: { ax: 160, ay: -28, bx: 280, by: 36 },
  ash: { ax: -40, ay: -120, bx: 30, by: -55 },
  ember: { ax: -50, ay: -180, bx: 40, by: -80 }
};

/** Множитель альфы 1→0, не давит стартовый цвет. */
function fadeColor() {
  return new ColorOverLife(new ColorRange(
    new Vector4(1, 1, 1, 1),
    new Vector4(1, 1, 1, 0)
  ));
}

/** Скорость после сферы — в мировых XY, без scale эмиттера. */
function fallInit(kind) {
  const f = FALL[kind];
  return {
    type: 'FallInit',
    initialize(p) {
      const t = Math.random();
      p.velocity.set(
        f.ax + (f.bx - f.ax) * t,
        f.ay + (f.by - f.ay) * t,
        0
      );
      p.startSpeed = p.velocity.length();
    },
    update() {},
    frameUpdate() {},
    reset() {}
  };
}

function fadeSize() {
  return new SizeOverLife(new PiecewiseBezier([[new Bezier(0.75, 1, 0.9, 0.12), 0]]));
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'));
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

/** Капля: яркая узкая лента. */
function makeRainMap() {
  return canvasTex(16, 64, (x) => {
    const g = x.createLinearGradient(8, 0, 8, 64);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.2, 'rgba(190,220,255,.55)');
    g.addColorStop(0.5, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(170,205,255,0)');
    x.fillStyle = g;
    x.fillRect(5, 0, 6, 64);
  });
}

/** Зерно бури — вытянуто по ветру. */
function makeGritMap() {
  return canvasTex(32, 16, (x) => {
    const g = x.createRadialGradient(16, 8, 1, 16, 8, 14);
    g.addColorStop(0, 'rgba(255,230,190,1)');
    g.addColorStop(0.45, 'rgba(210,160,90,.7)');
    g.addColorStop(1, 'rgba(120,80,40,0)');
    x.fillStyle = g;
    x.beginPath();
    x.ellipse(16, 8, 14, 6, 0, 0, Math.PI * 2);
    x.fill();
  });
}

/** Уголь / пепел. */
function makeAshMap() {
  return canvasTex(32, 32, (x) => {
    const g = x.createRadialGradient(16, 16, 1, 16, 16, 15);
    g.addColorStop(0, 'rgba(70,48,40,1)');
    g.addColorStop(0.4, 'rgba(40,28,24,.75)');
    g.addColorStop(1, 'rgba(20,12,10,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 32, 32);
  });
}

/** Искра извержения. */
function makeEmberMap() {
  return canvasTex(16, 32, (x) => {
    const g = x.createLinearGradient(8, 0, 8, 32);
    g.addColorStop(0, 'rgba(255,240,160,0)');
    g.addColorStop(0.25, 'rgba(255,180,40,.9)');
    g.addColorStop(0.55, 'rgba(255,70,20,1)');
    g.addColorStop(1, 'rgba(80,10,0,0)');
    x.fillStyle = g;
    x.fillRect(4, 0, 8, 32);
  });
}

function spriteMat(map, add) {
  return new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: add ? THREE.AdditiveBlending : THREE.NormalBlending
  });
}

/**
 * Петля на весь кадр. Размер в мировых единицах, без scale эмиттера.
 * @param {object} p параметры
 */
function loopSystem(p) {
  const rate = new ConstantValue(0);
  const ps = new ParticleSystem({
    duration: p.duration || 1.2,
    looping: true,
    prewarm: true,
    worldSpace: true,
    startLife: p.life,
    startSpeed: new ConstantValue(0),
    startSize: p.size,
    startColor: p.color,
    emissionOverTime: rate,
    emissionBursts: [],
    shape: new SphereEmitter({ radius: 200, thickness: 1, arc: Math.PI * 2 }),
    material: p.mat,
    renderMode: p.renderMode || RenderMode.BillBoard,
    speedFactor: p.speedFactor,
    lengthFactor: p.lengthFactor,
    renderOrder: p.renderOrder || 2,
    behaviors: p.behaviors
  });
  ps._rate = rate;
  return ps;
}

function place(ps, camera) {
  const hw = Math.max(8, Math.abs(camera.right - camera.left) / 2);
  const hh = Math.max(8, Math.abs(camera.top - camera.bottom) / 2);
  ps.emitter.position.set(camera.position.x, camera.position.y, 0);
  ps.emitter.scale.set(1, 1, 1);
  ps.emitter.quaternion.identity();
  const shape = ps.emitterShape;
  if (shape && shape.radius != null) shape.radius = Math.hypot(hw, hh) * 0.72;
  ps.emitter.updateMatrixWorld(true);
}

function wind(ax, ay, bx, by) {
  return new TurbulenceField(
    new Vector3(ax, ay, 40),
    1,
    new Vector3(bx, by, 0),
    new Vector3(0.8, 0.8, 0.3)
  );
}

/**
 * Пресеты погоды.
 * @param {THREE.Scene} scene сцена
 * @param {object} batch batched renderer
 * @param {THREE.Texture} soft мягкий спрайт
 */
export function buildWeather(scene, batch, soft) {
  const rain = loopSystem({
    duration: 0.85,
    life: new IntervalValue(0.45, 0.8),
    size: new IntervalValue(14, 26),
    color: new ConstantColor(new Vector4(0.75, 0.86, 1, 0.42)),
    mat: spriteMat(makeRainMap(), true),
    renderMode: RenderMode.StretchedBillBoard,
    speedFactor: 0.14,
    lengthFactor: 0.55,
    behaviors: [fallInit('rain'), fadeSize(), fadeColor()]
  });

  const snow = loopSystem({
    duration: 1.8,
    life: new IntervalValue(1.6, 2.6),
    size: new IntervalValue(8, 15),
    color: new ConstantColor(new Vector4(0.96, 0.98, 1, 0.88)),
    mat: spriteMat(soft, false),
    behaviors: [fallInit('snow'), fadeSize(), fadeColor(), wind(110, 110, 42, 16)]
  });

  const sand = loopSystem({
    duration: 1.1,
    life: new IntervalValue(0.7, 1.25),
    size: new IntervalValue(7, 14),
    color: new ConstantColor(new Vector4(0.9, 0.72, 0.42, 0.48)),
    mat: spriteMat(makeGritMap(), false),
    renderMode: RenderMode.StretchedBillBoard,
    speedFactor: 0.08,
    lengthFactor: 0.7,
    behaviors: [fallInit('sand'), fadeSize(), fadeColor(), wind(80, 50, 36, 18)]
  });

  const ash = loopSystem({
    duration: 1.5,
    life: new IntervalValue(1.2, 2.1),
    size: new IntervalValue(6, 13),
    color: new ConstantColor(new Vector4(0.22, 0.14, 0.1, 0.55)),
    mat: spriteMat(makeAshMap(), false),
    behaviors: [fallInit('ash'), fadeSize(), fadeColor(), wind(90, 80, 28, 20)]
  });

  const ember = loopSystem({
    duration: 1.0,
    life: new IntervalValue(0.5, 1.05),
    size: new IntervalValue(5, 11),
    color: new ConstantColor(new Vector4(1, 0.45, 0.12, 0.7)),
    mat: spriteMat(makeEmberMap(), true),
    renderMode: RenderMode.StretchedBillBoard,
    speedFactor: 0.1,
    lengthFactor: 0.5,
    behaviors: [fallInit('ember'), fadeSize(), fadeColor()]
  });

  const systems = { rain, snow, sand, ash, ember };
  for (const id of Object.keys(systems)) {
    scene.add(systems[id].emitter);
    batch.addSystem(systems[id]);
    systems[id].pause();
  }

  let active = '';

  function stopGroup(key) {
    const names = GROUPS[key];
    if (!names) return;
    for (const n of names) systems[n].stop();
  }

  function playGroup(key) {
    const names = GROUPS[key];
    for (const n of names) {
      systems[n].restart();
      systems[n].play();
    }
  }

  return {
    /**
     * Следовать за ортокамерой.
     * @param {string} id rain | snow | sand | ash | off
     * @param {number} q качество
     * @param {THREE.Camera} camera ортокамера
     * @returns {boolean}
     */
    sync(id, q, camera) {
      const kind = GROUPS[id] ? id : '';
      if (!kind || !camera) {
        if (active) {
          stopGroup(active);
          active = '';
        }
        return false;
      }
      const mul = Math.max(0.35, q || 1);
      for (const n of GROUPS[kind]) {
        place(systems[n], camera);
        systems[n]._rate.value = RATE[n] * mul;
      }
      if (active !== kind) {
        if (active) stopGroup(active);
        playGroup(kind);
        active = kind;
      }
      return true;
    }
  };
}
