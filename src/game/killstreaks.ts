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
  supply: { id: 'supply', name: 'SUPPLY DROP', kills: 4, desc: 'A crate drops at your feet: full ammo, grenades, and a chance of a bonus killstreak.',
    icon: 'M3 8l9-5 9 5v8l-9 5-9-5zm9-2.7L6.2 8.5 12 11.7l5.8-3.2zM5 10.2v4.6l6 3.3v-4.6zm14 0l-6 3.3v4.6l6-3.3z' },
  mortar: { id: 'mortar', name: 'MORTAR STRIKE', kills: 5, desc: 'Three shells land on the enemy, one after another.',
    icon: 'M11 2h2v4l3 3v9l-4 4-4-4V9l3-3z' },
  sentry: { id: 'sentry', name: 'SENTRY GUN', kills: 6, level: 5, desc: 'An automated turret guards the spot you place it for 45 seconds.',
    icon: 'M4 9h11V6h3v3h3v4H8v3H4zm3 7l-3 6h2l2.5-5zm4 0l2.5 6h2l-3-6z' },
  airstrike: { id: 'airstrike', name: 'AIRSTRIKE', kills: 7, level: 12, air: true, desc: 'A jet carpets a line of bombs through the enemy.',
    icon: 'M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z' },
  drone: { id: 'drone', name: 'ATTACK DRONE', kills: 9, level: 18, air: true, desc: 'Hovers over you and fires on any enemy it can see for 30 seconds.',
    icon: 'M2 5h6v2H6v2h12V7h-2V5h6v2h-2v2h-1v2h-3l-2 4h-4l-2-4H5V9H4V7H2zm8 11h4v2h-4z' },
  crash: { id: 'crash', name: 'SYSTEM CRASH', kills: 25, level: 30, desc: 'Corrupts the server: every enemy dies and the match ends.',
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
  /** soundscape helpers */
  pan(pos: THREE.Vector3): { dist: number; pan: number };
  /** supply crate pickup */
  resupply(): void;
}

interface Crate { obj: THREE.Group; vy: number; landed: boolean; life: number }
interface Gunner { obj: THREE.Group; head: THREE.Object3D; life: number; cool: number; range: number; rate: number; dmg: number; acc: number; label: StreakId }
interface Timed { at: number; fn: () => void }

export class StreakRuntime {
  private host: StreakHost;
  private crates: Crate[] = [];
  private gunners: Gunner[] = [];
  private timers: Timed[] = [];
  private jet: { obj: THREE.Group; from: THREE.Vector3; to: THREE.Vector3; t: number } | null = null;
  private tmp = new THREE.Vector3();

  constructor(host: StreakHost) {
    this.host = host;
  }

  private later(secs: number, fn: () => void) {
    this.timers.push({ at: this.host.now() + secs, fn });
  }

  /** Call in a streak. Sweep and System Crash are handled by the game itself. */
  activate(id: StreakId) {
    const h = this.host;
    const feet = h.playerFeet();
    const yaw = h.playerYaw();
    const ahead = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    if (id === 'supply') {
      const obj = buildCrate(h.mats);
      obj.position.copy(feet).addScaledVector(ahead, 2.2).setY(feet.y + 26);
      h.scene.add(obj);
      this.crates.push({ obj, vy: -9, landed: false, life: 60 });
    } else if (id === 'mortar') {
      for (let i = 0; i < 3; i++) {
        this.later(1.4 + i * 0.8, () => {
          const target = this.pickTarget(5);
          if (!target) return;
          const { dist, pan } = h.pan(target);
          h.sfx.whistle(dist, pan);
          this.later(0.55, () => h.explode(target, 'mortar', 7.5, 190));
        });
      }
    } else if (id === 'sentry') {
      const obj = buildSentry(h.mats);
      // ahead and off to the right so it doesn't block your view
      const right = new THREE.Vector3(-ahead.z, 0, ahead.x);
      obj.position.copy(feet).addScaledVector(ahead, 2.4).addScaledVector(right, 1.4);
      obj.rotation.y = yaw;
      h.scene.add(obj);
      this.gunners.push({ obj, head: obj.getObjectByName('turret')!, life: 45, cool: 1, range: 34, rate: 0.12, dmg: 16, acc: 0.6, label: 'sentry' });
    } else if (id === 'drone') {
      const obj = buildDrone(h.mats);
      obj.position.copy(feet).setY(feet.y + 7);
      h.scene.add(obj);
      this.gunners.push({ obj, head: obj.getObjectByName('turret')!, life: 30, cool: 1.2, range: 42, rate: 0.32, dmg: 26, acc: 0.55, label: 'drone' });
    } else if (id === 'airstrike') {
      const c = this.pickTarget(0) ?? feet.clone();
      const ang = Math.random() * Math.PI;
      const dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
      const obj = buildJet(h.mats);
      const from = c.clone().addScaledVector(dir, -120).setY(38);
      const to = c.clone().addScaledVector(dir, 120).setY(38);
      obj.position.copy(from);
      obj.lookAt(to);
      h.scene.add(obj);
      this.jet = { obj, from, to, t: 0 };
      h.sfx.jet();
      for (let i = 0; i < 7; i++) {
        const p = c.clone().addScaledVector(dir, (i - 3) * 5).setY(0);
        this.later(2.1 + i * 0.16, () => h.explode(p, 'airstrike', 6.5, 200));
      }
    }
  }

  /** An enemy position (plus scatter) to drop ordnance on, favouring groups. */
  private pickTarget(scatter: number): THREE.Vector3 | null {
    const es = this.host.enemies();
    if (!es.length) return null;
    let best = es[0];
    let bestN = -1;
    for (const e of es) {
      const n = es.filter((o) => o.pos.distanceTo(e.pos) < 8).length;
      if (n > bestN || (n === bestN && Math.random() < 0.5)) {
        best = e;
        bestN = n;
      }
    }
    return best.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * scatter, 0, (Math.random() - 0.5) * scatter)).setY(0);
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
      } else if (h.playerAlive() && c.obj.position.distanceTo(h.playerFeet()) < 1.8) {
        c.life = 0;
        h.resupply();
      }
    }
    for (const c of this.crates.filter((x) => x.life <= 0)) h.scene.remove(c.obj);
    this.crates = this.crates.filter((x) => x.life > 0);

    const feet = h.playerFeet();
    for (const g of this.gunners) {
      g.life -= dt;
      g.cool -= dt;
      if (g.label === 'drone') {
        // drift above the player, bobbing
        const want = this.tmp.copy(feet).setY(feet.y + 7 + Math.sin(now * 1.7) * 0.4);
        g.obj.position.lerp(want, 1 - Math.exp(-dt * 1.5));
        g.obj.rotation.y += dt * 0.4;
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
        // turn the turret head toward the target (in its parent's frame)
        const local = g.head.parent!.worldToLocal(aim.clone());
        g.head.rotation.y = Math.atan2(-local.x, -local.z);
        if (g.cool <= 0) {
          g.cool = g.rate;
          h.effects.muzzle(muzzle);
          const { dist, pan } = h.pan(muzzle);
          h.sfx.gunshot(dist, pan, g.label === 'drone' ? 'pk7' : 'lm5');
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
    if (this.jet) this.host.scene.remove(this.jet.obj);
    this.crates = [];
    this.gunners = [];
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
