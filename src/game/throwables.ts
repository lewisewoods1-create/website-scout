import * as THREE from 'three';
import type { Materials } from './materials';
import { raycastBoxes, type Box } from './map';
import { LAYER_CHAR, LAYER_SMOKE } from './renderer';
import { smokeTex } from './textures';
import { mesh, rbox, setLayerDeep } from './util';

export type ThrowKind = 'frag' | 'smoke' | 'stun';

interface Projectile<O> {
  kind: ThrowKind;
  obj: THREE.Object3D;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  fuse: number;
  owner: O;
  resting: boolean;
}

interface Smoke {
  pos: THREE.Vector3;
  t: number;
  sprites: { s: THREE.Sprite; off: THREE.Vector3; drift: THREE.Vector3 }[];
}

const FUSE: Record<ThrowKind, number> = { frag: 2.4, smoke: 1.2, stun: 1.4 };
const SMOKE_LIFE = 14;
const SMOKE_R = 4.5;
const G = 14;

/** Detailed full-res grenade models, built once and cloned per throw (also held in first person). */
export function buildGrenadeModels(m: Materials, layer = LAYER_CHAR): Record<ThrowKind, THREE.Group> {
  const cyl = (r: number, h: number, seg = 28) => new THREE.CylinderGeometry(r, r, h, seg);
  const frag = new THREE.Group();
  mesh(new THREE.SphereGeometry(0.031, 32, 24), m.helmet, frag, { scale: [1, 1.08, 1] });
  mesh(new THREE.TorusGeometry(0.031, 0.0025, 8, 32), m.helmet, frag, { rot: [Math.PI / 2, 0, 0] });
  mesh(cyl(0.011, 0.022), m.steel, frag, { pos: [0, 0.04, 0] });
  mesh(rbox(0.012, 0.004, 0.06, 0.0015), m.steel, frag, { pos: [0, 0.035, 0.022], rot: [-0.9, 0, 0] }); // spoon
  const pinRing = (g: THREE.Group, y: number) => {
    const pin = mesh(new THREE.TorusGeometry(0.01, 0.0015, 8, 20), m.steel, g, { pos: [0.016, y, 0], rot: [0, Math.PI / 2, 0] });
    pin.name = 'pin';
  };
  pinRing(frag, 0.046);

  const smoke = new THREE.Group();
  mesh(cyl(0.03, 0.12), m.parkerized, smoke);
  mesh(cyl(0.0305, 0.02), m.fde, smoke, { pos: [0, 0.03, 0] });
  for (let i = 0; i < 4; i++) mesh(cyl(0.004, 0.002, 8), m.hole, smoke, { pos: [Math.cos(i * 1.57) * 0.02, 0.061, Math.sin(i * 1.57) * 0.02] });
  mesh(cyl(0.012, 0.018), m.steel, smoke, { pos: [0, 0.068, 0] });
  mesh(rbox(0.012, 0.004, 0.07, 0.0015), m.steel, smoke, { pos: [0, 0.055, 0.03], rot: [-1.2, 0, 0] });
  pinRing(smoke, 0.072);

  const stun = new THREE.Group();
  mesh(cyl(0.027, 0.11), m.polymer, stun);
  for (let r = 0; r < 3; r++) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      mesh(cyl(0.0035, 0.002, 8), m.hole, stun, { pos: [Math.cos(a) * 0.027, -0.035 + r * 0.035, Math.sin(a) * 0.027], rot: [0, -a, Math.PI / 2] });
    }
  }
  mesh(cyl(0.012, 0.018), m.steel, stun, { pos: [0, 0.064, 0] });
  mesh(rbox(0.012, 0.004, 0.065, 0.0015), m.steel, stun, { pos: [0, 0.05, 0.028], rot: [-1.2, 0, 0] });
  pinRing(stun, 0.068);

  for (const g of [frag, smoke, stun]) {
    setLayerDeep(g, layer);
    g.traverse((o) => {
      o.castShadow = true;
    });
  }
  return { frag, smoke, stun };
}

/**
 * Thrown equipment: bouncing physics against the map colliders, fuses,
 * and smoke clouds that block sight lines.
 */
export class Throwables<O> {
  private scene: THREE.Scene;
  private models: Record<ThrowKind, THREE.Group>;
  private live: Projectile<O>[] = [];
  private smokes: Smoke[] = [];
  private smokeMat: THREE.SpriteMaterial;

  constructor(scene: THREE.Scene, m: Materials) {
    this.scene = scene;
    this.models = buildGrenadeModels(m);
    // thrown grenades have already lost their pin
    for (const g of Object.values(this.models)) g.getObjectByName('pin')!.visible = false;
    this.smokeMat = new THREE.SpriteMaterial({ map: smokeTex(), color: 0xb8b8b0, transparent: true, depthWrite: false, opacity: 0 });
  }

  throw(kind: ThrowKind, from: THREE.Vector3, vel: THREE.Vector3, owner: O) {
    const obj = this.models[kind].clone();
    obj.position.copy(from);
    this.scene.add(obj);
    this.live.push({
      kind, obj, owner, pos: from.clone(), vel: vel.clone(),
      spin: new THREE.Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10),
      fuse: FUSE[kind], resting: false,
    });
  }

  /** Lob velocity to land on `to` from `from`. */
  static lob(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3 {
    const d = new THREE.Vector3(to.x - from.x, 0, to.z - from.z);
    const dist = d.length();
    const t = Math.min(1.6, Math.max(0.6, dist / 13));
    return new THREE.Vector3(d.x / t, (to.y - from.y + 0.5 * G * t * t) / t, d.z / t);
  }

  /** Live frags (for the HUD danger indicator). */
  frags() {
    return this.live.filter((p) => p.kind === 'frag').map((p) => p.pos);
  }

  /** Is the line a→b obscured by a thick part of any smoke cloud? */
  smokeBlocks(a: THREE.Vector3, b: THREE.Vector3) {
    for (const s of this.smokes) {
      if (s.t < 1 || s.t > SMOKE_LIFE - 1.5) continue;
      const r = Math.min(1, s.t / 2.5) * SMOKE_R * 0.85;
      // closest point on segment to cloud centre (lifted to head height)
      const c = s.pos.clone().setY(s.pos.y + 1.4);
      const ab = b.clone().sub(a);
      const t = Math.max(0, Math.min(1, c.clone().sub(a).dot(ab) / ab.lengthSq()));
      if (a.clone().addScaledVector(ab, t).distanceTo(c) < r) return true;
    }
    return false;
  }

  clear() {
    for (const p of this.live) this.scene.remove(p.obj);
    for (const s of this.smokes) for (const sp of s.sprites) this.scene.remove(sp.s);
    this.live = [];
    this.smokes = [];
  }

  /** Step physics; calls `detonate` for each projectile whose fuse ends. */
  update(dt: number, boxes: Box[], detonate: (kind: ThrowKind, pos: THREE.Vector3, owner: O) => void) {
    const dir = new THREE.Vector3();
    for (const p of this.live) {
      p.fuse -= dt;
      if (!p.resting) {
        p.vel.y -= G * dt;
        const step = p.vel.length() * dt;
        if (step > 1e-5) {
          dir.copy(p.vel).normalize();
          const hit = raycastBoxes(boxes, p.pos, dir, step + 0.03);
          if (hit) {
            p.pos.copy(hit.point).addScaledVector(hit.normal, 0.035);
            const vn = hit.normal.clone().multiplyScalar(p.vel.dot(hit.normal));
            const vt = p.vel.clone().sub(vn);
            p.vel.copy(vt.multiplyScalar(0.6)).addScaledVector(vn, -0.32);
            p.spin.multiplyScalar(0.6);
            if (hit.normal.y > 0.6 && p.vel.length() < 0.8) {
              p.resting = true;
              p.vel.set(0, 0, 0);
            }
          } else {
            p.pos.addScaledVector(p.vel, dt);
          }
        }
        p.obj.rotation.x += p.spin.x * dt;
        p.obj.rotation.y += p.spin.y * dt;
        p.obj.rotation.z += p.spin.z * dt;
      }
      p.obj.position.copy(p.pos);
      if (p.fuse <= 0) {
        this.scene.remove(p.obj);
        if (p.kind === 'smoke') this.spawnSmoke(p.pos);
        detonate(p.kind, p.pos.clone(), p.owner);
      }
    }
    this.live = this.live.filter((p) => p.fuse > 0);

    for (const s of this.smokes) {
      s.t += dt;
      const grow = Math.min(1, s.t / 2.5);
      const fade = s.t < 0.6 ? s.t / 0.6 : s.t > SMOKE_LIFE - 2 ? Math.max(0, (SMOKE_LIFE - s.t) / 2) : 1;
      for (const sp of s.sprites) {
        sp.off.addScaledVector(sp.drift, dt);
        sp.s.position.copy(s.pos).addScaledVector(sp.off, 0.3 + grow * 0.7);
        sp.s.scale.setScalar(1.5 + grow * 3.2);
        sp.s.material.opacity = 0.85 * fade;
      }
    }
    for (const s of this.smokes.filter((x) => x.t >= SMOKE_LIFE)) for (const sp of s.sprites) this.scene.remove(sp.s);
    this.smokes = this.smokes.filter((s) => s.t < SMOKE_LIFE);
  }

  private spawnSmoke(at: THREE.Vector3) {
    const sprites: Smoke['sprites'] = [];
    for (let i = 0; i < 36; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * SMOKE_R * 0.8;
      const s = new THREE.Sprite(this.smokeMat.clone());
      s.material.rotation = Math.random() * Math.PI * 2;
      s.layers.set(LAYER_SMOKE);
      this.scene.add(s);
      sprites.push({
        s,
        off: new THREE.Vector3(Math.cos(a) * r, 0.6 + Math.random() * 2.6, Math.sin(a) * r),
        drift: new THREE.Vector3((Math.random() - 0.5) * 0.15, 0.03, (Math.random() - 0.5) * 0.15),
      });
    }
    this.smokes.push({ pos: at.clone(), t: 0, sprites });
  }
}

