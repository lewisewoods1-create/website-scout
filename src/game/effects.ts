import * as THREE from 'three';
import { LAYER_CHAR, LAYER_FX } from './renderer';
import type { Surface } from './map';
import { puffTex } from './textures';

interface Tracer {
  m: THREE.Mesh;
  from: THREE.Vector3;
  dir: THREE.Vector3;
  dist: number;
  t: number;
}
interface Puff {
  s: THREE.Sprite;
  v: THREE.Vector3;
  life: number;
  max: number;
  grow: number;
}

const SURFACE_COLOR: Record<Surface | 'blood', number> = {
  concrete: 0xb0aba0,
  metal: 0x8a8a90,
  wood: 0x9a7a50,
  dirt: 0x7a6a50,
  blood: 0x7a0a08,
};

/** Low-res world FX: tracers, impact puffs, sparks, bullet holes, blood. */
export class Effects {
  private tracers: Tracer[] = [];
  private puffs: Puff[] = [];
  private decals: THREE.Mesh[] = [];
  private decalIdx = 0;
  private puffIdx = 0;
  private tracerIdx = 0;
  readonly worldFlash = new THREE.PointLight(0xffa040, 0, 9, 1.8);
  private flashT = 0;
  private flashPower = 25;
  private enemyTracer: THREE.MeshBasicMaterial;
  private playerTracer: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene) {
    const tGeo = new THREE.BoxGeometry(0.03, 0.03, 1);
    tGeo.translate(0, 0, -0.5);
    const tMat = new THREE.MeshBasicMaterial({ color: 0xffd080, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.enemyTracer = tMat.clone();
    this.enemyTracer.color.set(0xff8a50);
    this.playerTracer = tMat;
    for (let i = 0; i < 32; i++) {
      const m = new THREE.Mesh(tGeo, tMat);
      m.visible = false;
      m.layers.set(LAYER_FX);
      scene.add(m);
      this.tracers.push({ m, from: new THREE.Vector3(), dir: new THREE.Vector3(), dist: 0, t: 0 });
    }
    const pt = puffTex();
    for (let i = 0; i < 90; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: pt, transparent: true, depthWrite: false }));
      s.visible = false;
      s.layers.set(LAYER_FX);
      scene.add(s);
      this.puffs.push({ s, v: new THREE.Vector3(), life: 0, max: 1, grow: 1 });
    }
    const dGeo = new THREE.PlaneGeometry(0.09, 0.09);
    const dMat = new THREE.MeshBasicMaterial({ color: 0x0a0806, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    for (let i = 0; i < 80; i++) {
      const d = new THREE.Mesh(dGeo, dMat);
      d.visible = false;
      d.layers.set(LAYER_FX);
      scene.add(d);
      this.decals.push(d);
    }
    this.worldFlash.layers.enableAll();
    scene.add(this.worldFlash);
  }

  /** Hide every live effect (map change). */
  clear() {
    for (const t of this.tracers) t.m.visible = false;
    for (const p of this.puffs) p.s.visible = false;
    for (const d of this.decals) d.visible = false;
  }

  tracer(from: THREE.Vector3, to: THREE.Vector3, enemy = false) {
    const t = this.tracers[this.tracerIdx++ % this.tracers.length];
    t.from.copy(from);
    t.dir.subVectors(to, from);
    t.dist = t.dir.length();
    t.dir.divideScalar(t.dist || 1);
    t.t = 0;
    t.m.visible = true;
    t.m.material = enemy ? this.enemyTracer : this.playerTracer;
    t.m.lookAt(to);
    t.m.position.copy(from);
  }

  private puff(at: THREE.Vector3, v: THREE.Vector3, color: number, size: number, life: number, grow: number, layer = LAYER_FX) {
    const p = this.puffs[this.puffIdx++ % this.puffs.length];
    p.s.position.copy(at);
    p.s.scale.setScalar(size);
    p.v.copy(v);
    p.life = p.max = life;
    p.grow = grow;
    p.s.visible = true;
    p.s.layers.set(layer);
    const mat = p.s.material as THREE.SpriteMaterial;
    mat.color.set(color);
    mat.blending = color === 0xffc060 ? THREE.AdditiveBlending : THREE.NormalBlending;
    mat.opacity = 1;
  }

  impact(point: THREE.Vector3, normal: THREE.Vector3, surface: Surface) {
    const c = SURFACE_COLOR[surface];
    for (let i = 0; i < 3; i++) {
      const v = normal.clone().multiplyScalar(0.6 + Math.random()).add(new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).multiplyScalar(0.6));
      this.puff(point.clone().addScaledVector(normal, 0.05), v, c, 0.12 + Math.random() * 0.1, 0.5 + Math.random() * 0.3, 1.6);
    }
    if (surface === 'metal' || Math.random() < 0.3) {
      for (let i = 0; i < 4; i++) {
        const v = normal.clone().multiplyScalar(2 + Math.random() * 3).add(new THREE.Vector3(Math.random() - 0.5, Math.random(), Math.random() - 0.5).multiplyScalar(3));
        this.puff(point.clone().addScaledVector(normal, 0.03), v, 0xffc060, 0.04, 0.15 + Math.random() * 0.1, 0);
      }
    }
    // bullet hole
    const d = this.decals[this.decalIdx++ % this.decals.length];
    d.position.copy(point).addScaledVector(normal, 0.012);
    d.lookAt(point.clone().add(normal));
    d.rotateZ(Math.random() * Math.PI);
    d.scale.setScalar(0.7 + Math.random() * 0.6);
    d.visible = true;
  }

  blood(point: THREE.Vector3, dir: THREE.Vector3, heavy = false) {
    const n = heavy ? 7 : 4;
    for (let i = 0; i < n; i++) {
      const v = dir.clone().multiplyScalar(1 + Math.random() * 2).add(new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.5, Math.random() - 0.5));
      this.puff(point, v, 0x8a0c08, 0.12 + Math.random() * 0.12, 0.35 + Math.random() * 0.3, 1.4, LAYER_CHAR);
    }
  }

  /** Frag detonation: fireball, smoke column, sparks, scorch mark, light pulse. */
  explosion(at: THREE.Vector3) {
    for (let i = 0; i < 12; i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8 + 0.2, Math.random() - 0.5).multiplyScalar(5);
      this.puff(at.clone().add(new THREE.Vector3(0, 0.3, 0)), v, 0xffc060, 0.5 + Math.random() * 0.5, 0.25 + Math.random() * 0.2, 2.5);
    }
    for (let i = 0; i < 14; i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() + 0.4, Math.random() - 0.5).multiplyScalar(2.2);
      this.puff(at.clone().add(new THREE.Vector3(0, 0.4, 0)), v, 0x3a3430, 0.7 + Math.random() * 0.6, 1.4 + Math.random() * 1.2, 1.2);
    }
    for (let i = 0; i < 16; i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 1.2, Math.random() - 0.5).multiplyScalar(14);
      this.puff(at.clone().add(new THREE.Vector3(0, 0.2, 0)), v, 0xffc060, 0.06, 0.3 + Math.random() * 0.3, 0);
    }
    const d = this.decals[this.decalIdx++ % this.decals.length];
    d.position.copy(at).setY(0.015);
    d.rotation.set(-Math.PI / 2, 0, Math.random() * Math.PI);
    d.scale.setScalar(18 + Math.random() * 6);
    d.visible = true;
    this.worldFlash.position.copy(at).setY(at.y + 0.8);
    this.flashT = 0.12;
    this.flashPower = 160;
  }

  /** Stun grenade: white flash + light pulse, no fire. */
  stunFlash(at: THREE.Vector3) {
    for (let i = 0; i < 10; i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.6, Math.random() - 0.5).multiplyScalar(3);
      this.puff(at.clone().add(new THREE.Vector3(0, 0.2, 0)), v, 0xffffff, 0.4, 0.5 + Math.random() * 0.4, 1.8);
    }
    this.worldFlash.position.copy(at).setY(at.y + 0.6);
    this.flashT = 0.15;
    this.flashPower = 220;
  }

  muzzle(at: THREE.Vector3) {
    this.worldFlash.position.copy(at);
    this.flashT = 0.05;
    this.flashPower = 25;
  }

  update(dt: number) {
    for (const t of this.tracers) {
      if (!t.m.visible) continue;
      t.t += dt * 320;
      const head = Math.min(t.t, t.dist);
      const tail = Math.max(0, head - 5);
      t.m.position.copy(t.from).addScaledVector(t.dir, head);
      t.m.scale.set(1, 1, Math.max(0.01, head - tail));
      t.m.lookAt(t.m.position.clone().add(t.dir));
      if (t.t >= t.dist) t.m.visible = false;
    }
    for (const p of this.puffs) {
      if (!p.s.visible) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.s.visible = false;
        continue;
      }
      p.v.multiplyScalar(Math.exp(-3 * dt));
      p.v.y -= p.grow ? 0.4 * dt : 9 * dt;
      p.s.position.addScaledVector(p.v, dt);
      p.s.scale.multiplyScalar(1 + p.grow * dt);
      (p.s.material as THREE.SpriteMaterial).opacity = p.life / p.max;
    }
    this.flashT -= dt;
    this.worldFlash.intensity = this.flashT > 0 ? this.flashPower : 0;
  }
}
