import * as THREE from 'three';
import type { GameMap } from './map';
import { raycastBoxes } from './map';
import type { Player } from './player';
import type { Effects } from './effects';
import type { Sfx } from './audio';
import { LAYER_CHAR, LAYER_FX } from './renderer';
import { blobShadowTex, flashTex } from './textures';
import { clamp, damp, setLayerDeep } from './util';

export interface BotWorld {
  map: GameMap;
  player: Player;
  playerEye: THREE.Vector3;
  effects: Effects;
  sfx: Sfx;
  bots: Bot[];
  now: number;
  /** listener yaw for stereo panning */
  listenerYaw: number;
  damagePlayer(dmg: number, from: THREE.Vector3, bot: Bot): void;
  pickBotSpawn(): THREE.Vector3;
}

export interface HitSphere {
  c: THREE.Vector3;
  r: number;
  head: boolean;
}

type State = 'patrol' | 'hunt' | 'engage';

const EYE = 1.68;
const TMP = new THREE.Vector3();
const TMP2 = new THREE.Vector3();

let flashMat: THREE.SpriteMaterial | null = null;
let shadowMat: THREE.MeshBasicMaterial | null = null;

function angleDiff(a: number, b: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export class Bot {
  readonly model: THREE.Group;
  private hips: THREE.Object3D;
  private torso: THREE.Object3D;
  private headNode: THREE.Object3D;
  private thighL: THREE.Object3D;
  private thighR: THREE.Object3D;
  private kneeL: THREE.Object3D;
  private kneeR: THREE.Object3D;
  private muzzle: THREE.Object3D;
  private flash: THREE.Sprite;
  private flashT = 0;
  private shadow: THREE.Mesh;

  pos = new THREE.Vector3();
  yaw = 0;
  health = 100;
  alive = true;
  state: State = 'patrol';
  deadT = 0;
  lastShotT = -99;
  lastDamagedT = -99;
  readonly spheres: HitSphere[] = [
    { c: new THREE.Vector3(), r: 0.15, head: true },
    { c: new THREE.Vector3(), r: 0.25, head: false },
    { c: new THREE.Vector3(), r: 0.23, head: false },
    { c: new THREE.Vector3(), r: 0.15, head: false },
    { c: new THREE.Vector3(), r: 0.15, head: false },
    { c: new THREE.Vector3(), r: 0.13, head: false },
    { c: new THREE.Vector3(), r: 0.13, head: false },
  ];

  private path: THREE.Vector3[] = [];
  private lastSeen = new THREE.Vector3();
  private lastSeenT = -99;
  private seeing = false;
  private trackT = 0;
  private reactT = 0;
  private fireCool = 0;
  private burst = 0;
  private strafe = 0;
  private strafeT = 0;
  private walkPhase = 0;
  private moveSpeed = 0;
  private aimPitch = 0;
  private idleT = 0;
  private fallDir = 1;

  readonly name: string;

  constructor(template: THREE.Group, name: string, scene: THREE.Scene) {
    this.name = name;
    this.model = template.clone(true);
    this.model.rotation.order = 'YXZ';
    setLayerDeep(this.model, LAYER_CHAR);
    const get = (n: string) => this.model.getObjectByName(n)!;
    this.hips = get('hips');
    this.torso = get('torso');
    this.headNode = get('head');
    this.thighL = get('thighL');
    this.thighR = get('thighR');
    this.kneeL = get('kneeL');
    this.kneeR = get('kneeR');
    this.muzzle = get('muzzle');

    flashMat ??= new THREE.SpriteMaterial({ map: flashTex(), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.flash = new THREE.Sprite(flashMat);
    this.flash.scale.setScalar(0.45);
    this.flash.layers.set(LAYER_CHAR);
    this.flash.visible = false;
    this.muzzle.add(this.flash);

    shadowMat ??= new THREE.MeshBasicMaterial({ map: blobShadowTex(), transparent: true, depthWrite: false });
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), shadowMat);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.layers.set(LAYER_FX);
    scene.add(this.model, this.shadow);
  }

  spawn(p: THREE.Vector3) {
    this.pos.copy(p);
    this.yaw = Math.random() * Math.PI * 2;
    this.health = 100;
    this.alive = true;
    this.state = 'patrol';
    this.path = [];
    this.deadT = 0;
    this.seeing = false;
    this.trackT = 0;
    this.model.rotation.x = 0;
    this.model.position.y = 0;
    this.model.visible = true;
  }

  eye(out: THREE.Vector3) {
    return out.set(this.pos.x, this.pos.y + EYE, this.pos.z);
  }

  /** Returns true if this hit killed the bot. */
  damage(amount: number, from: THREE.Vector3, now: number): boolean {
    if (!this.alive) return false;
    this.health -= amount;
    this.lastDamagedT = now;
    // react to being shot: turn and hunt the shooter
    this.lastSeen.copy(from);
    this.lastSeenT = now;
    if (this.state !== 'engage') {
      this.state = 'hunt';
      this.path = [];
    }
    if (this.health <= 0) {
      this.alive = false;
      this.deadT = 0;
      this.flash.visible = false;
      // fall away from the shooter
      TMP.subVectors(this.pos, from);
      const facing = Math.sin(this.yaw) * TMP.x + Math.cos(this.yaw) * TMP.z;
      this.fallDir = facing > 0 ? 1 : -1;
      return true;
    }
    return false;
  }

  update(dt: number, w: BotWorld) {
    if (!this.alive) {
      this.updateDead(dt, w);
      return;
    }
    const now = w.now;
    const eye = this.eye(TMP);
    const toP = TMP2.subVectors(w.playerEye, eye);
    const dist = toP.length();
    const yawTo = Math.atan2(toP.x, toP.z);
    const inFov = Math.abs(angleDiff(this.yaw, yawTo)) < 1.3 || now - this.lastDamagedT < 1.5 || dist < 3.5;
    let canSee = false;
    if (w.player.alive && dist < 60 && inFov) {
      const dir = toP.clone().divideScalar(dist);
      canSee = !raycastBoxes(w.map.boxes, eye, dir, dist);
    }

    if (canSee) {
      if (!this.seeing) this.reactT = 0.3 + Math.random() * 0.35 + dist * 0.008;
      this.seeing = true;
      this.trackT += dt;
      this.lastSeen.copy(w.player.pos);
      this.lastSeenT = now;
      this.state = 'engage';
    } else {
      this.seeing = false;
      this.trackT = 0;
      if (this.state === 'engage') {
        this.state = 'hunt';
        this.path = [];
      }
    }

    let desiredYaw = this.yaw;
    const move = new THREE.Vector3();
    let speed = 0;

    if (this.state === 'engage') {
      desiredYaw = yawTo;
      this.strafeT -= dt;
      if (this.strafeT <= 0) {
        this.strafe = [-1, 0, 1, 1, -1][Math.floor(Math.random() * 5)];
        this.strafeT = 0.5 + Math.random() * 1.2;
      }
      const rx = Math.cos(this.yaw);
      const rz = -Math.sin(this.yaw);
      move.set(rx * this.strafe, 0, rz * this.strafe);
      if (dist > 22) move.add(new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)).multiplyScalar(0.8));
      speed = 2.6;
      this.aimPitch = damp(this.aimPitch, Math.atan2(toP.y, Math.hypot(toP.x, toP.z)), 10, dt);
      this.updateFire(dt, w, dist, Math.abs(angleDiff(this.yaw, yawTo)));
    } else {
      this.aimPitch = damp(this.aimPitch, 0, 4, dt);
      if (this.state === 'hunt') {
        if (!this.path.length) this.path = w.map.nav.findPath(this.pos, this.lastSeen);
        if (!this.path.length || now - this.lastSeenT > 12) this.state = 'patrol';
        speed = 4.3;
      } else {
        if (!this.path.length) {
          this.idleT -= dt;
          if (this.idleT <= 0) {
            this.path = w.map.nav.findPath(this.pos, w.map.nav.randomWalkable());
            this.idleT = 0.5 + Math.random() * 2.5;
          }
        }
        speed = 2.7;
      }
      const target = this.path[0];
      if (target) {
        move.set(target.x - this.pos.x, 0, target.z - this.pos.z);
        if (move.length() < 0.35) {
          this.path.shift();
          if (!this.path.length && this.state === 'hunt') {
            // reached last known position: look around, then patrol
            this.state = 'patrol';
            this.idleT = 1.5;
            this.yaw += (Math.random() - 0.5) * 2;
          }
        }
        if (move.lengthSq() > 1e-4) desiredYaw = Math.atan2(move.x, move.z);
      }
    }

    // separation
    for (const o of w.bots) {
      if (o === this || !o.alive) continue;
      const dx = this.pos.x - o.pos.x;
      const dz = this.pos.z - o.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 1 && d2 > 1e-6) move.add(new THREE.Vector3(dx, 0, dz).multiplyScalar(0.6 / d2));
    }

    if (move.lengthSq() > 1) move.normalize();
    const step = move.multiplyScalar(speed * dt);
    const nav = w.map.nav;
    const before = this.pos.clone();
    if (nav.walkableAt(this.pos.x + step.x, this.pos.z + step.z)) {
      this.pos.x += step.x;
      this.pos.z += step.z;
    } else if (nav.walkableAt(this.pos.x + step.x, this.pos.z)) {
      this.pos.x += step.x;
    } else if (nav.walkableAt(this.pos.x, this.pos.z + step.z)) {
      this.pos.z += step.z;
    } else if (this.state === 'engage') {
      this.strafe = -this.strafe;
    } else {
      this.path = [];
    }
    this.moveSpeed = damp(this.moveSpeed, before.distanceTo(this.pos) / Math.max(dt, 1e-4), 10, dt);

    const turn = angleDiff(this.yaw, desiredYaw);
    this.yaw += clamp(turn, -7 * dt, 7 * dt);

    this.animate(dt, now);
  }

  private updateFire(dt: number, w: BotWorld, dist: number, yawErr: number) {
    this.reactT -= dt;
    this.fireCool -= dt;
    if (this.reactT > 0 || yawErr > 0.25 || this.fireCool > 0) return;
    if (this.burst <= 0) {
      this.burst = 3 + Math.floor(Math.random() * 4);
    }
    this.burst--;
    this.fireCool = this.burst > 0 ? 0.095 : 0.45 + Math.random() * 0.6;
    this.shoot(w, dist);
  }

  private shoot(w: BotWorld, dist: number) {
    const now = w.now;
    this.lastShotT = now;
    this.flashT = 0.05;
    this.flash.material.rotation = Math.random() * Math.PI;

    const p = w.player;
    let acc = clamp(0.62 - dist * 0.011, 0.12, 0.6);
    if (p.speed > 5) acc *= 0.65;
    else if (p.speed > 1) acc *= 0.85;
    if (p.crouchT > 0.5) acc *= 0.85;
    if (p.slide > 0) acc *= 0.5;
    acc *= clamp(0.45 + this.trackT * 0.35, 0.45, 1.15);
    const hit = Math.random() < acc;

    this.muzzle.updateWorldMatrix(true, false);
    const from = this.muzzle.getWorldPosition(new THREE.Vector3());
    const target = w.playerEye.clone();
    target.y -= 0.35;
    if (!hit) {
      const side = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize();
      target.addScaledVector(side, 0.6 + Math.random() * 1.2);
      // extend past the player so misses streak by
      target.sub(from).multiplyScalar(1.6).add(from);
    }
    w.effects.tracer(from, target, true);
    const pan = panFor(this.pos, p.pos, w.listenerYaw);
    w.sfx.gunshot(dist, pan);
    if (hit) {
      w.damagePlayer(Math.round(11 + Math.random() * 6), this.pos, this);
    } else if (Math.random() < 0.4) {
      w.sfx.whizz(pan);
    }
  }

  private animate(dt: number, now: number) {
    const m = this.model;
    m.position.set(this.pos.x, this.pos.y, this.pos.z);
    m.rotation.y = this.yaw;
    m.rotation.x = 0;

    const k = clamp(this.moveSpeed / 3, 0, 1.3);
    this.walkPhase += dt * (2.2 + this.moveSpeed * 2.1);
    const s = Math.sin(this.walkPhase);
    this.thighL.rotation.x = s * 0.55 * k;
    this.thighR.rotation.x = -s * 0.55 * k;
    this.kneeL.rotation.x = Math.max(0, -s) * 1.0 * k + 0.05;
    this.kneeR.rotation.x = Math.max(0, s) * 1.0 * k + 0.05;
    this.hips.position.y = 0.99 - Math.abs(Math.cos(this.walkPhase)) * 0.035 * k;
    this.hips.rotation.y = s * 0.08 * k;
    this.torso.rotation.y = -s * 0.08 * k;
    this.torso.rotation.x = -this.aimPitch * 0.85 + Math.sin(now * 1.7) * 0.012;
    this.headNode.rotation.x = -this.aimPitch * 0.15;

    this.flashT -= dt;
    this.flash.visible = this.flashT > 0;

    this.shadow.position.set(this.pos.x, 0.02, this.pos.z);

    m.updateMatrixWorld(true);
    this.updateSpheres();
  }

  private updateSpheres() {
    const sp = this.spheres;
    this.headNode.getWorldPosition(sp[0].c);
    sp[0].c.y += 0.08;
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const rx = fz;
    const rz = -fx;
    const p = this.pos;
    sp[1].c.set(p.x + fx * 0.03, p.y + 1.38, p.z + fz * 0.03);
    sp[2].c.set(p.x, p.y + 1.05, p.z);
    sp[3].c.set(p.x + rx * 0.1, p.y + 0.72, p.z + rz * 0.1);
    sp[4].c.set(p.x - rx * 0.1, p.y + 0.72, p.z - rz * 0.1);
    sp[5].c.set(p.x + rx * 0.1, p.y + 0.32, p.z + rz * 0.1);
    sp[6].c.set(p.x - rx * 0.1, p.y + 0.32, p.z - rz * 0.1);
  }

  private updateDead(dt: number, w: BotWorld) {
    this.deadT += dt;
    const e = clamp(this.deadT / 0.55, 0, 1);
    const ease = e * e;
    this.model.rotation.x = -this.fallDir * (Math.PI / 2) * ease;
    this.model.position.y = 0.12 * ease;
    this.torso.rotation.x = damp(this.torso.rotation.x, 0.4, 4, dt);
    this.kneeL.rotation.x = damp(this.kneeL.rotation.x, 0.6, 4, dt);
    this.thighR.rotation.x = damp(this.thighR.rotation.x, -0.5, 4, dt);
    this.flash.visible = false;
    if (this.deadT > 4.5) {
      this.model.visible = false;
      this.shadow.visible = false;
    }
    if (this.deadT > 6) {
      this.spawn(w.pickBotSpawn());
      this.shadow.visible = true;
    }
  }
}

/** Stereo pan of a world source for a listener looking along camera yaw. */
export function panFor(src: THREE.Vector3, listener: THREE.Vector3, yaw: number) {
  const dx = src.x - listener.x;
  const dz = src.z - listener.z;
  const len = Math.hypot(dx, dz) || 1;
  return ((dx * Math.cos(yaw) - dz * Math.sin(yaw)) / len) * 0.85;
}

/** Ray vs sphere: distance along normalised ray, or -1. */
export function raySphere(o: THREE.Vector3, d: THREE.Vector3, c: THREE.Vector3, r: number) {
  const ox = o.x - c.x;
  const oy = o.y - c.y;
  const oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - cc;
  if (disc < 0) return -1;
  const t = -b - Math.sqrt(disc);
  return t > 0 ? t : -1;
}

export const BOT_NAMES = ['VERTEX', 'Wobble', 'AffineTex', 'DitherKing', 'Polycount', 'ZBuffer', 'Lowres_Larry', 'MemCard'];
