import * as THREE from 'three';
import type { Materials } from './materials';
import type { Bot } from './bot';
import type { Effects } from './effects';
import type { Sfx } from './audio';
import { LAYER_CHAR } from './renderer';
import { group, mesh, rbox, setLayerDeep } from './util';

/**
 * Killstreaks: the player picks three (Create a Class > Killstreaks). Kills in one
 * life earn them; earned ones stack and [4] calls in the newest.
 */
export type StreakId = 'sweep' | 'supply' | 'mortar' | 'sentry' | 'airstrike' | 'drone' | 'crash';

export interface StreakDef {
  id: StreakId;
  name: string;
  kills: number;
  desc: string;
  level?: number;
  /** comes from the sky (counts for "air killstreak" challenges) */
  air?: boolean;
  /** 24x24 icon path */
  icon: string;
}

export const STREAKS: Record<StreakId, StreakDef> = {
  sweep: { id: 'sweep', name: 'RADAR SWEEP', kills: 3, desc: 'Shows every enemy on the minimap for 30 seconds.',
    icon: 'M12 2a10 10 0 100 20 10 10 0 000-20zm0 3a7 7 0 016.9 6H12V5zm-1 0v7h7a7 7 0 11-7-7z' },
  supply: { id: 'supply', name: 'SUPPLY DROP', kills: 4, desc: 'Throw a marker. A crate parachutes onto the red smoke: walk up and hold [F] to claim a random killstreak.',
    icon: 'M3 8l9-5 9 5v8l-9 5-9-5zm9-2.7L6.2 8.5 12 11.7l5.8-3.2zM5 10.2v4.6l6 3.3v-4.6zm14 0l-6 3.3v4.6l6-3.3z' },
  mortar: { id: 'mortar', name: 'MORTAR STRIKE', kills: 5, desc: 'Throw a flare. Five heavy shells land around it with big splash damage.',
    icon: 'M11 2h2v4l3 3v9l-4 4-4-4V9l3-3z' },
  sentry: { id: 'sentry', name: 'SENTRY GUN', kills: 6, level: 5, desc: 'Carry the sentry in front of you and press [F] to put it down. Once placed it can\'t be moved; it guards the spot for 60 seconds.',
    icon: 'M4 9h11V6h3v3h3v4H8v3H4zm3 7l-3 6h2l2.5-5zm4 0l2.5 6h2l-3-6z' },
  airstrike: { id: 'airstrike', name: 'AIRSTRIKE', kills: 7, level: 12, air: true, desc: 'Opens a map tablet: aim the sweep line, rotate it with the mouse wheel or R, and press [F] to send the jet.',
    icon: 'M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z' },
  drone: { id: 'drone', name: 'ATTACK DRONE', kills: 9, level: 18, air: true, desc: 'Rides behind your head for 30 seconds, firing light rounds that keep enemies suppressed.',
    icon: 'M2 5h6v2H6v2h12V7h-2V5h6v2h-2v2h-1v2h-3l-2 4h-4l-2-4H5V9H4V7H2zm8 11h4v2h-4z' },
  crash: { id: 'crash', name: 'SYSTEM CRASH', kills: 25, level: 30, desc: 'Hacks the server: a 5-second countdown, then an electric wave kills every enemy and ends the match.',
    icon: 'M3 3h18v14H3zm2 2v10h14V5zm2 2h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2zm-6 4h6v2H9zM8 19h8v2H8z' },
};

export const STREAK_ORDER: StreakId[] = ['sweep', 'supply', 'mortar', 'sentry', 'airstrike', 'drone', 'crash'];
export const DEFAULT_STREAKS: StreakId[] = ['sweep', 'supply', 'mortar'];

export const streakIcon = (id: StreakId, size = 24) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor" aria-hidden="true"><path d="${STREAKS[id].icon}"/></svg>`;

/** What the streak runtime needs from the game. */
export interface StreakHost {
  scene: THREE.Scene;
  mats: Materials;
  effects: Effects;
  sfx: Sfx;
  now(): number;
  playerFeet(): THREE.Vector3;
  playerEye(): THREE.Vector3;
  playerYaw(): number;
  playerAlive(): boolean;
  /** live enemies of the player */
  enemies(): Bot[];
  /** no map geometry between a and b */
  clear(a: THREE.Vector3, b: THREE.Vector3): boolean;
  /** player-owned explosion: hurts enemies only */
  explode(pos: THREE.Vector3, label: StreakId, radius: number, damage: number): void;
  /** player-owned bullet from a streak */
  shoot(from: THREE.Vector3, bot: Bot, damage: number, label: StreakId): void;
  /** pin a bot down: worse aim and slower reactions for a moment */
  suppress(bot: Bot): void;
  /** coloured signal smoke */
  plume(pos: THREE.Vector3, color: number, life: number): void;
  /** soundscape helpers */
  pan(pos: THREE.Vector3): { dist: number; pan: number };
}

export interface Crate { obj: THREE.Group; vy: number; landed: boolean; life: number }
interface Gunner {
  obj: THREE.Group;
  head: THREE.Object3D;
  life: number;
  cool: number;
  range: number;
  rate: number;
  dmg: number;
  acc: number;
  label: StreakId;
}
interface Flare { obj: THREE.Group; light: THREE.PointLight; life: number }
interface Timed { at: number; fn: () => void }

export class StreakRuntime {
  private host: StreakHost;
  private crates: Crate[] = [];
  private gunners: Gunner[] = [];
  private flares: Flare[] = [];
  private timers: Timed[] = [];
  private jet: { obj: THREE.Group; from: THREE.Vector3; to: THREE.Vector3; t: number } | null = null;
  private ghost: THREE.Group;
  private ghostMats: THREE.MeshBasicMaterial[] = [];
  private tmp = new THREE.Vector3();

  constructor(host: StreakHost) {
    this.host = host;
    // translucent sentry used while choosing where to put it down
    this.ghost = buildSentry(host.mats);
    this.ghost.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const gm = new THREE.MeshBasicMaterial({ color: 0x6cff8a, transparent: true, opacity: 0.38, depthWrite: false });
      this.ghostMats.push(gm);
      m.material = gm;
      m.castShadow = false;
    });
    this.ghost.visible = false;
    host.scene.add(this.ghost);
  }

  private later(secs: number, fn: () => void) {
    this.timers.push({ at: this.host.now() + secs, fn });
  }

  // ---- supply drop: the thrown marker smokes red, a crate parachutes onto it

  markerLanded(pos: THREE.Vector3) {
    const h = this.host;
    h.plume(pos, 0xd83020, 16);
    const obj = buildCrate(h.mats);
    obj.position.copy(pos).setY(pos.y + 32);
    this.later(2, () => {
      h.scene.add(obj);
      this.crates.push({ obj, vy: -8, landed: false, life: 90 });
      h.sfx.jet(); // the drop plane passing over
    });
  }

  /** A landed crate within reach of `p`. */
  crateNear(p: THREE.Vector3): Crate | null {
    return this.crates.find((c) => c.landed && c.obj.position.distanceTo(p) < 2.2) ?? null;
  }

  claimCrate(c: Crate) {
    c.life = 0;
  }

  // ---- mortar: a thrown flare marks the zone, five heavy shells walk across it

  flareLanded(pos: THREE.Vector3) {
    const h = this.host;
    const obj = new THREE.Group();
    obj.position.copy(pos);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), h.mats.laserRed);
    glow.position.y = 0.05;
    obj.add(glow);
    const light = new THREE.PointLight(0xff3a1a, 5, 9, 2);
    light.position.y = 0.3;
    obj.add(light);
    h.scene.add(obj);
    this.flares.push({ obj, light, life: 9 });
    h.plume(pos, 0xff5a3a, 7);
    for (let i = 0; i < 5; i++) {
      this.later(1.3 + i * 0.85, () => {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * 7;
        const target = pos.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)).setY(0);
        const { dist, pan } = h.pan(target);
        h.sfx.whistle(dist, pan);
        this.later(0.55, () => h.explode(target, 'mortar', 9, 230));
      });
    }
  }

  // ---- sentry: carried as a ghost until placed; once down it stays put

  showGhost(on: boolean) {
    this.ghost.visible = on;
  }

  moveGhost(pos: THREE.Vector3, yaw: number, valid: boolean) {
    this.ghost.position.copy(pos);
    this.ghost.rotation.y = yaw;
    for (const m of this.ghostMats) m.color.set(valid ? 0x6cff8a : 0xff4a3a);
  }

  placeSentry(pos: THREE.Vector3, yaw: number) {
    const h = this.host;
    const obj = buildSentry(h.mats);
    obj.position.copy(pos);
    obj.rotation.y = yaw;
    h.scene.add(obj);
    this.gunners.push({ obj, head: obj.getObjectByName('turret')!, life: 60, cool: 1, range: 34, rate: 0.12, dmg: 16, acc: 0.6, label: 'sentry' });
    const { dist, pan } = h.pan(pos);
    h.sfx.thud(dist, pan);
  }

  // ---- airstrike along a chosen line

  airstrike(center: THREE.Vector3, dir: THREE.Vector3) {
    const h = this.host;
    const d = dir.clone().setY(0).normalize();
    const obj = buildJet(h.mats);
    const from = center.clone().addScaledVector(d, -120).setY(38);
    const to = center.clone().addScaledVector(d, 120).setY(38);
    obj.position.copy(from);
    obj.lookAt(to);
    h.scene.add(obj);
    this.jet = { obj, from, to, t: 0 };
    h.sfx.jet();
    for (let i = 0; i < 9; i++) {
      const p = center.clone().addScaledVector(d, (i - 4) * 4.5).setY(0);
      this.later(2.1 + i * 0.13, () => h.explode(p, 'airstrike', 6.5, 200));
    }
  }

  // ---- attack drone: rides behind your head, peppering enemies to keep their heads down

  drone() {
    const h = this.host;
    const obj = buildDrone(h.mats);
    obj.scale.setScalar(0.6);
    obj.position.copy(h.playerEye());
    h.scene.add(obj);
    this.gunners.push({ obj, head: obj.getObjectByName('turret')!, life: 30, cool: 0.8, range: 38, rate: 0.11, dmg: 6, acc: 0.65, label: 'drone' });
  }

  update(dt: number) {
    const h = this.host;
    const now = h.now();
    for (const t of this.timers.filter((x) => x.at <= now)) t.fn();
    this.timers = this.timers.filter((x) => x.at > now);

    for (const c of this.crates) {
      c.life -= dt;
      if (!c.landed) {
        c.obj.position.y += c.vy * dt;
        c.obj.rotation.y += dt * 0.6;
        const chute = c.obj.getObjectByName('chute');
        if (c.obj.position.y <= 0) {
          c.obj.position.y = 0;
          c.landed = true;
          if (chute) chute.visible = false;
          h.effects.explosion(c.obj.position.clone().setY(0.1));
          const { dist, pan } = h.pan(c.obj.position);
          h.sfx.thud(dist, pan);
        }
      }
    }
    for (const c of this.crates.filter((x) => x.life <= 0)) h.scene.remove(c.obj);
    this.crates = this.crates.filter((x) => x.life > 0);

    for (const f of this.flares) {
      f.life -= dt;
      f.light.intensity = (4 + Math.sin(now * 37) * 1.2 + Math.random() * 1.5) * Math.min(1, f.life);
    }
    for (const f of this.flares.filter((x) => x.life <= 0)) h.scene.remove(f.obj);
    this.flares = this.flares.filter((x) => x.life > 0);

    const eye = h.playerEye();
    const yaw = h.playerYaw();
    for (const g of this.gunners) {
      g.life -= dt;
      g.cool -= dt;
      if (g.label === 'drone') {
        // hover just behind and above your head, off the right shoulder
        const back = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
        const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
        const want = this.tmp.copy(eye).addScaledVector(back, 1.1).addScaledVector(right, 0.45).setY(eye.y + 0.55 + Math.sin(now * 2.3) * 0.06);
        g.obj.position.lerp(want, 1 - Math.exp(-dt * 6));
        g.obj.rotation.y = yaw;
        for (const r of ['rotor0', 'rotor1', 'rotor2', 'rotor3']) {
          const o = g.obj.getObjectByName(r);
          if (o) o.rotation.y += dt * 40;
        }
      }
      const muzzle = g.head.getWorldPosition(new THREE.Vector3());
      let target: Bot | null = null;
      let best = g.range;
      for (const e of h.enemies()) {
        const aim = e.spheres[1].c;
        const d = aim.distanceTo(muzzle);
        if (d < best && h.clear(muzzle, aim)) {
          best = d;
          target = e;
        }
      }
      if (target) {
        const aim = target.spheres[1].c;
        const local = g.head.parent!.worldToLocal(aim.clone());
        g.head.rotation.y = Math.atan2(-local.x, -local.z);
        if (g.cool <= 0) {
          g.cool = g.rate;
          h.effects.muzzle(muzzle);
          const { dist, pan } = h.pan(muzzle);
          h.sfx.gunshot(dist, pan, g.label === 'drone' ? 'vx9' : 'lm5', g.label === 'drone');
          if (g.label === 'drone') h.suppress(target);
          if (Math.random() < g.acc) h.shoot(muzzle, target, g.dmg, g.label);
          else h.effects.tracer(muzzle, aim.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.5, Math.random() - 0.5, (Math.random() - 0.5) * 1.5)));
        }
      } else if (g.label === 'sentry') {
        g.head.rotation.y += dt * 0.8; // sweep while idle
      }
    }
    for (const g of this.gunners.filter((x) => x.life <= 0)) h.scene.remove(g.obj);
    this.gunners = this.gunners.filter((x) => x.life > 0);

    if (this.jet) {
      const j = this.jet;
      j.t += dt / 4.2;
      j.obj.position.lerpVectors(j.from, j.to, j.t);
      if (j.t >= 1) {
        h.scene.remove(j.obj);
        this.jet = null;
      }
    }
  }

  clear() {
    for (const c of this.crates) this.host.scene.remove(c.obj);
    for (const g of this.gunners) this.host.scene.remove(g.obj);
    for (const f of this.flares) this.host.scene.remove(f.obj);
    if (this.jet) this.host.scene.remove(this.jet.obj);
    this.ghost.visible = false;
    this.crates = [];
    this.gunners = [];
    this.flares = [];
    this.timers = [];
    this.jet = null;
  }
}

// ---------------------------------------------------------------- models

function crisp<T extends THREE.Object3D>(root: T): T {
  setLayerDeep(root, LAYER_CHAR);
  root.traverse((o) => {
    o.castShadow = true;
  });
  return root;
}

function buildCrate(m: Materials) {
  const root = new THREE.Group();
  const box = group(root, { pos: [0, 0.45, 0] });
  mesh(rbox(1.1, 0.8, 0.8, 0.03), m.fde, box);
  for (const x of [-0.5, 0.5]) mesh(rbox(0.06, 0.84, 0.84, 0.01), m.parkerized, box, { pos: [x, 0, 0] });
  for (const y of [-0.3, 0.3]) mesh(rbox(1.14, 0.05, 0.84, 0.01), m.webbing, box, { pos: [0, y, 0] });
  mesh(rbox(0.3, 0.12, 0.02, 0.01), m.steel, box, { pos: [0, 0.1, 0.41] });
  mesh(rbox(0.5, 0.18, 0.005, 0.002), m.polymer, box, { pos: [0, -0.1, 0.405] });
  // parachute: canopy + lines, hidden on landing
  const chute = group(root, { name: 'chute', pos: [0, 4.2, 0] });
  const canopy = new THREE.SphereGeometry(1.8, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.4);
  mesh(canopy, m.camoClose, chute);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const line = mesh(new THREE.CylinderGeometry(0.008, 0.008, 3.6, 4), m.webbing, chute, { pos: [Math.cos(a) * 0.65, -1.85, Math.sin(a) * 0.65] });
    line.rotation.z = Math.cos(a) * 0.32;
    line.rotation.x = -Math.sin(a) * 0.32;
  }
  return crisp(root);
}

function buildSentry(m: Materials) {
  const root = new THREE.Group();
  // tripod
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.9, 10), m.parkerized, root, { pos: [Math.cos(a) * 0.28, 0.4, Math.sin(a) * 0.28] });
    leg.rotation.z = Math.cos(a) * 0.55;
    leg.rotation.x = -Math.sin(a) * 0.55;
    mesh(rbox(0.08, 0.03, 0.08, 0.01), m.rubber, root, { pos: [Math.cos(a) * 0.52, 0.02, Math.sin(a) * 0.52] });
  }
  mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.18, 16), m.anodized, root, { pos: [0, 0.84, 0] });
  const turret = group(root, { name: 'turret', pos: [0, 1.0, 0] });
  mesh(rbox(0.3, 0.24, 0.5, 0.03), m.fde, turret);
  mesh(rbox(0.32, 0.06, 0.3, 0.02), m.anodized, turret, { pos: [0, 0.15, 0.05] });
  mesh(rbox(0.12, 0.18, 0.22, 0.02), m.polymer, turret, { pos: [0.21, -0.02, 0.06] }); // ammo box
  mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.6, 16).rotateX(Math.PI / 2), m.parkerized, turret, { pos: [0, 0.02, -0.5] });
  mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.14, 16).rotateX(Math.PI / 2), m.anodized, turret, { pos: [0, 0.02, -0.78] });
  mesh(rbox(0.1, 0.08, 0.06, 0.01), m.glass, turret, { pos: [0, 0.16, -0.24] }); // sensor
  mesh(new THREE.CircleGeometry(0.03, 16), m.laserRed, turret, { pos: [0, 0.16, -0.272], rot: [0, Math.PI, 0] });
  return crisp(root);
}

function buildDrone(m: Materials) {
  const root = new THREE.Group();
  mesh(rbox(0.45, 0.14, 0.45, 0.04), m.polymer, root);
  mesh(rbox(0.3, 0.08, 0.3, 0.03), m.anodized, root, { pos: [0, 0.1, 0] });
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i / 4) * Math.PI * 2;
    const arm = mesh(rbox(0.5, 0.04, 0.05, 0.01), m.anodized, root, { pos: [Math.cos(a) * 0.3, 0.02, Math.sin(a) * 0.3] });
    arm.rotation.y = -a;
    mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 12), m.parkerized, root, { pos: [Math.cos(a) * 0.52, 0.06, Math.sin(a) * 0.52] });
    const rotor = group(root, { name: `rotor${i}`, pos: [Math.cos(a) * 0.52, 0.11, Math.sin(a) * 0.52] });
    mesh(rbox(0.42, 0.006, 0.04, 0.003), m.rubber, rotor);
  }
  const turret = group(root, { name: 'turret', pos: [0, -0.14, 0] });
  mesh(new THREE.SphereGeometry(0.09, 16, 12), m.glass, turret);
  mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 10).rotateX(Math.PI / 2), m.parkerized, turret, { pos: [0, -0.02, -0.16] });
  mesh(new THREE.CircleGeometry(0.02, 12), m.laserRed, turret, { pos: [0.05, 0.02, -0.08], rot: [0, Math.PI, 0] });
  return crisp(root);
}

function buildJet(m: Materials) {
  // world layer on purpose: it's far away, the low-res PS1 pass suits it
  const root = new THREE.Group();
  const body = new THREE.CylinderGeometry(0.6, 0.9, 12, 10).rotateX(Math.PI / 2);
  mesh(body, m.parkerized, root);
  mesh(new THREE.ConeGeometry(0.6, 3, 10).rotateX(-Math.PI / 2), m.parkerized, root, { pos: [0, 0, 7.5] });
  mesh(rbox(11, 0.2, 3.2, 0.1), m.parkerized, root, { pos: [0, -0.2, -1] });
  mesh(rbox(4.5, 0.15, 1.6, 0.05), m.parkerized, root, { pos: [0, 0, -5.5] });
  mesh(rbox(0.15, 2.2, 1.8, 0.05), m.parkerized, root, { pos: [0, 1.2, -5.3] });
  mesh(rbox(0.9, 0.5, 2, 0.2), m.glass, root, { pos: [0, 0.6, 4] });
  return root;
}
