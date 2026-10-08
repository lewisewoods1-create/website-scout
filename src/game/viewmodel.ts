import * as THREE from 'three';
import type { Materials } from './materials';
import { buildWeapon, type WeaponCfg } from './weapons';
import { attachHands } from './hands';
import { flashTex } from './textures';
import type { GunStats } from './loadout';
import { clamp, damp, lerp, mesh, orientLimb, smooth } from './util';

export interface ViewmodelInput {
  ads: boolean;
  sprinting: boolean;
  speed: number;
  grounded: boolean;
  lookDX: number;
  lookDY: number;
  crouch: number;
}

const POSES = {
  rifle: { hip: new THREE.Vector3(0.15, -0.155, -0.4), sprint: new THREE.Vector3(0.08, -0.19, -0.34) },
  pistol: { hip: new THREE.Vector3(0.1, -0.09, -0.34), sprint: new THREE.Vector3(0.1, -0.2, -0.3) },
};

type Kind = 'rifle' | 'pistol' | 'revolver';

interface Built {
  rifle: THREE.Group;
  kind: Kind;
  elbowL: THREE.Vector3;
  handL: THREE.Object3D;
  handLHome: THREE.Vector3;
  sleeveL: THREE.Mesh;
  mag: THREE.Object3D;
  magHome: THREE.Vector3;
  charging: THREE.Object3D | null;
  chargingHome: THREE.Vector3;
  muzzle: THREE.Object3D;
  port: THREE.Object3D;
  sight: THREE.Vector3;
  cylinder: THREE.Object3D | null;
  crane: THREE.Object3D | null;
  hammer: THREE.Object3D | null;
}

/** First-person gun + gloved hands, rendered at full res in its own scene. */
export class Viewmodel {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(52, 1, 0.01, 10);
  private root = new THREE.Group();
  private mats: Materials;
  private w!: Built;
  private cache = new Map<string, Built>();
  private adsPos = new THREE.Vector3();
  private recoilMul = 1;
  private switchT = -1;
  private pending: (() => void) | null = null;
  private throwT = -1;
  private slideKick = 0;
  private cylAngle = 0;
  private cylTarget = 0;
  /** pistol slide locks back on an empty mag */
  slideLocked = false;
  private flash = new THREE.Group();
  private flashLight = new THREE.PointLight(0xffa040, 0, 2.5, 2);
  private flashTime = 0;
  private shells: { m: THREE.Mesh; v: THREE.Vector3; spin: THREE.Vector3; life: number }[] = [];
  private shellIdx = 0;

  // animation state
  ads = 0;
  private sprint = 0;
  private bob = 0;
  private bobAmt = 0;
  private sway = new THREE.Vector2();
  private kick = 0;
  private kickPitch = 0;
  private kickYaw = 0;
  private kickRoll = 0;
  private breath = 0;
  private land = 0;
  /** -1 when idle, else 0..1 reload progress */
  reload = -1;
  reloadEmpty = false;

  constructor(m: Materials, env: THREE.Texture) {
    this.scene.environment = env;
    this.scene.environmentIntensity = 0.3;
    this.scene.add(this.camera);
    this.camera.add(this.root);

    // lighting matched to the dusk world: warm key from the sun, cool fill, rim
    const key = new THREE.DirectionalLight(0xffc28a, 2.4);
    key.position.set(-1, 1.2, 0.6);
    const fill = new THREE.DirectionalLight(0x6c7cff, 0.5);
    fill.position.set(1, -0.3, 0.5);
    const rim = new THREE.DirectionalLight(0xffe0c0, 1.6);
    rim.position.set(0.5, 0.6, -1.5);
    this.scene.add(key, fill, rim, new THREE.AmbientLight(0x403040, 0.6));

    // muzzle flash: three crossed additive cards
    const fm = new THREE.MeshBasicMaterial({
      map: flashTex(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const front = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.12), fm);
    const side = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.22), fm);
    side.rotation.set(Math.PI / 2, 0, 0);
    side.position.z = -0.08;
    const side2 = side.clone();
    side2.rotation.set(Math.PI / 2, Math.PI / 2, 0);
    this.flash.add(front, side, side2);
    this.flash.visible = false;
    this.flashLight.position.z = -0.05;
    this.mats = m;
    this.equip({ weapon: 'kr4', optic: 'holo', muzzle: 'none', under: 'none', mag: 'std', camo: 'none' }, 0.24, 1);

    const shellGeo = new THREE.CylinderGeometry(0.0048, 0.0048, 0.045, 10);
    for (let i = 0; i < 14; i++) {
      const s = new THREE.Mesh(shellGeo, m.brass);
      s.visible = false;
      this.camera.add(s);
      this.shells.push({ m: s, v: new THREE.Vector3(), spin: new THREE.Vector3(), life: 0 });
    }
  }

  private build(cfg: WeaponCfg): Built {
    const key = JSON.stringify(cfg);
    const hit = this.cache.get(key);
    if (hit) return hit;
    const m = this.mats;
    const rifle = buildWeapon(m, cfg, true);
    const kind = rifle.userData.kind as Kind;
    const hands = attachHands(rifle, m);
    // sleeves running back out of frame
    const sleeveGeo = new THREE.CylinderGeometry(0.04, 0.046, 1, 24, 1, true);
    rifle.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(rifle.matrixWorld).invert();
    const wristR = hands.right.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
    const pistolish = kind !== 'rifle';
    const elbowR = pistolish ? new THREE.Vector3(0.2, -0.44, 0.26) : new THREE.Vector3(0.1, -0.3, 0.42);
    const sleeveStart = wristR.clone().add(new THREE.Vector3(0, 0, 0.035));
    orientLimb(mesh(sleeveGeo, m.camoClose, rifle), sleeveStart, elbowR);
    const cuffR = mesh(new THREE.TorusGeometry(0.046, 0.012, 12, 28), m.camoClose, rifle, { pos: sleeveStart.toArray() as [number, number, number] });
    cuffR.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), elbowR.clone().sub(sleeveStart).normalize());
    const sleeveL = mesh(sleeveGeo, m.camoClose, rifle);
    const handL = hands.left;
    const mag = rifle.getObjectByName('mag')!;
    const charging = rifle.getObjectByName('chargingHandle') ?? null;
    const sightNode = rifle.getObjectByName('sight')!;
    const b: Built = {
      rifle,
      kind,
      elbowL: pistolish ? new THREE.Vector3(-0.22, -0.44, 0.26) : new THREE.Vector3(-0.26, -0.32, 0.12),
      handL,
      handLHome: handL.position.clone(),
      sleeveL,
      mag,
      magHome: mag.position.clone(),
      charging,
      chargingHome: charging ? charging.position.clone() : new THREE.Vector3(),
      muzzle: rifle.getObjectByName('muzzle')!,
      port: rifle.getObjectByName('ejectionPort')!,
      sight: sightNode.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv),
      cylinder: rifle.getObjectByName('cylinder') ?? null,
      crane: rifle.getObjectByName('cylinderSwing') ?? null,
      hammer: rifle.getObjectByName('hammer') ?? null,
    };
    this.cache.set(key, b);
    return b;
  }

  /** Swap the held weapon immediately. */
  equip(cfg: WeaponCfg, eyeDist: number, recoil: number) {
    if (this.w) this.root.remove(this.w.rifle);
    this.w = this.build(cfg);
    this.root.add(this.w.rifle);
    this.recoilMul = recoil;
    const sp = this.w.sight;
    this.adsPos.set(-sp.x, -sp.y, -eyeDist - sp.z);
    this.w.muzzle.add(this.flash);
    this.w.muzzle.add(this.flashLight);
    this.reload = -1;
    this.slideLocked = false;
  }

  /** Lower the current weapon, swap, raise the new one. */
  switchTo(cfg: WeaponCfg, eyeDist: number, recoil: number) {
    this.pending = () => this.equip(cfg, eyeDist, recoil);
    this.switchT = 0;
  }

  throwAnim() {
    this.throwT = 0;
  }

  /** True while switching or throwing: can't fire or aim. */
  get busy() {
    return this.switchT >= 0 || this.throwT >= 0;
  }

  get kind() {
    return this.w.kind;
  }

  setAspect(a: number) {
    this.camera.aspect = a;
    this.camera.updateProjectionMatrix();
  }

  fire() {
    const adsK = lerp(1, 0.35, this.ads) * this.recoilMul;
    this.kick += 0.028 * adsK;
    this.kickPitch += (0.045 + Math.random() * 0.02) * adsK;
    this.kickYaw += (Math.random() - 0.5) * 0.03 * adsK;
    this.kickRoll += (Math.random() - 0.5) * 0.05 * adsK;
    this.flashTime = 0.045;
    this.flash.rotation.z = Math.random() * Math.PI;
    this.flash.scale.setScalar(0.75 + Math.random() * 0.5);

    if (this.w.kind === 'pistol') this.slideKick = 1;
    if (this.w.kind === 'revolver') {
      this.cylTarget += Math.PI / 3;
      return; // revolvers keep their brass
    }
    // eject brass from the port in camera space
    const s = this.shells[this.shellIdx++ % this.shells.length];
    this.w.port.getWorldPosition(s.m.position);
    this.camera.worldToLocal(s.m.position);
    s.v.set(0.9 + Math.random() * 0.5, 0.8 + Math.random() * 0.5, 0.25 + Math.random() * 0.2);
    s.spin.set(Math.random() * 20, Math.random() * 20, 15 + Math.random() * 10);
    s.m.rotation.set(0, 0, Math.PI / 2);
    s.life = 0.7;
    s.m.visible = true;
  }

  /** Normalised landing impact, 0..1 */
  landed(k: number) {
    this.land = Math.max(this.land, clamp(k, 0, 1));
  }

  update(dt: number, inp: ViewmodelInput) {
    this.ads = damp(this.ads, inp.ads && this.reload < 0 && !inp.sprinting && !this.busy ? 1 : 0, 14, dt);
    this.sprint = damp(this.sprint, inp.sprinting && this.reload < 0 ? 1 : 0, 9, dt);
    const moveK = clamp(inp.speed / 5, 0, 1.5) * (inp.grounded ? 1 : 0.2);
    this.bobAmt = damp(this.bobAmt, moveK, 8, dt);
    this.bob += dt * (6.5 + inp.speed * 0.9);
    this.breath += dt;

    // weapon sway lags behind mouse look
    const swayScale = lerp(1, 0.25, this.ads);
    this.sway.x = damp(this.sway.x, clamp(-inp.lookDX * 0.0009, -0.06, 0.06) * swayScale, 9, dt);
    this.sway.y = damp(this.sway.y, clamp(inp.lookDY * 0.0009, -0.06, 0.06) * swayScale, 9, dt);

    // recoil springs
    this.kick = damp(this.kick, 0, 16, dt);
    this.kickPitch = damp(this.kickPitch, 0, 11, dt);
    this.kickYaw = damp(this.kickYaw, 0, 11, dt);
    this.kickRoll = damp(this.kickRoll, 0, 9, dt);
    this.land = damp(this.land, 0, 7, dt);

    // switch / throw timers
    let lower = 0;
    if (this.switchT >= 0) {
      this.switchT += dt / 0.5;
      if (this.switchT >= 0.5 && this.pending) {
        this.pending();
        this.pending = null;
      }
      lower = Math.max(lower, 1 - Math.abs(this.switchT - 0.5) * 2);
      if (this.switchT >= 1) this.switchT = -1;
    }
    if (this.throwT >= 0) {
      this.throwT += dt / 0.55;
      lower = Math.max(lower, Math.sin(Math.min(1, this.throwT) * Math.PI));
      if (this.throwT >= 1) this.throwT = -1;
    }
    this.slideKick = damp(this.slideKick, 0, 28, dt);
    this.cylAngle = damp(this.cylAngle, this.cylTarget, 18, dt);

    const pose = this.w.kind === 'rifle' ? POSES.rifle : POSES.pistol;
    const p = this.root.position;
    p.copy(pose.hip).lerp(this.adsPos, this.ads);
    p.lerp(pose.sprint, this.sprint * (1 - this.ads));
    p.y -= lower * 0.28;
    p.y -= inp.crouch * 0.01 * (1 - this.ads);

    const bobK = this.bobAmt * lerp(1, 0.12, this.ads) * (1 + this.sprint * 0.8);
    p.x += Math.sin(this.bob) * 0.011 * bobK;
    p.y += -Math.abs(Math.cos(this.bob)) * 0.012 * bobK + Math.sin(this.breath * 1.6) * 0.0016 * (1 - this.ads * 0.8);
    p.y -= this.land * 0.03;
    p.x += this.sway.x * 0.4;
    p.y += this.sway.y * 0.4;
    p.z += this.kick;

    const r = this.root.rotation;
    r.x = -lower * 0.6 + this.kickPitch + this.sway.y + Math.sin(this.bob * 2) * 0.008 * bobK - this.land * 0.05;
    r.y = this.kickYaw + this.sway.x + this.sprint * 0.75 * (1 - this.ads);
    r.z = this.kickRoll + Math.sin(this.bob) * 0.02 * bobK + this.sprint * 0.35 * (1 - this.ads);

    this.animateReload();

    // flash
    this.flashTime -= dt;
    this.flash.visible = this.flashTime > 0;
    this.flashLight.intensity = this.flashTime > 0 ? 6 : 0;

    for (const s of this.shells) {
      if (s.life <= 0) continue;
      s.life -= dt;
      s.v.y -= 6 * dt;
      s.m.position.addScaledVector(s.v, dt);
      s.m.rotation.x += s.spin.x * dt;
      s.m.rotation.y += s.spin.y * dt;
      s.m.rotation.z += s.spin.z * dt;
      if (s.life <= 0) s.m.visible = false;
    }
  }

  private animateReload() {
    const w = this.w;
    const t = this.reload;
    w.mag.position.copy(w.magHome);
    w.mag.visible = true;
    if (w.charging) w.charging.position.copy(w.chargingHome);
    w.handL.position.copy(w.handLHome);
    w.rifle.rotation.set(0, 0, 0);
    w.rifle.position.set(0, 0, 0);
    if (w.crane) w.crane.rotation.z = 0;
    if (w.cylinder) w.cylinder.rotation.z = this.cylAngle;
    if (w.hammer) w.hammer.rotation.x = -Math.min(0.6, Math.abs(this.cylTarget - this.cylAngle) * 2);
    if (w.kind === 'pistol' && w.charging) w.charging.position.z += this.slideKick * 0.024 + (this.slideLocked ? 0.024 : 0);

    if (t >= 0) {
      const env = smooth(clamp(t / 0.14, 0, 1)) * smooth(clamp((1 - t) / 0.16, 0, 1));
      const tilt = w.kind === 'rifle' ? 1 : 0.7;
      w.rifle.rotation.z = 0.5 * env * tilt;
      w.rifle.rotation.x = 0.18 * env;
      w.rifle.rotation.y = -0.12 * env;
      w.rifle.position.y = -0.02 * env;

      if (w.kind === 'revolver' && w.crane) {
        // swing the cylinder out, dump brass, load, close
        const open = smooth(clamp((t - 0.1) / 0.12, 0, 1)) * smooth(clamp((0.88 - t) / 0.1, 0, 1));
        w.crane.rotation.z = 1.15 * open;
        w.rifle.rotation.x += 0.35 * open;
        const handK = smooth(clamp((t - 0.3) / 0.12, 0, 1)) * smooth(clamp((0.8 - t) / 0.1, 0, 1));
        w.handL.position.lerp(new THREE.Vector3(-0.07, 0.0, -0.03), handK);
      } else {
        // mag out (0.16..0.32), new mag in (0.48..0.66)
        let drop = 0;
        if (t < 0.16) drop = 0;
        else if (t < 0.32) drop = smooth((t - 0.16) / 0.16);
        else if (t < 0.48) drop = 1;
        else if (t < 0.66) drop = 1 - smooth((t - 0.48) / 0.18);
        w.mag.position.y -= drop * (w.kind === 'pistol' ? 0.2 : 0.28);
        w.mag.position.z += drop * 0.05;
        w.mag.visible = !(t > 0.33 && t < 0.4);
        const handK = smooth(clamp((t - 0.08) / 0.16, 0, 1)) * smooth(clamp((0.8 - t) / 0.12, 0, 1));
        const magTarget = new THREE.Vector3(-0.05, -0.12, -0.02).add(w.mag.position).sub(w.magHome);
        if (w.kind === 'rifle') w.handL.position.lerp(magTarget, handK);
        if (this.reloadEmpty && w.charging && t > 0.76 && t < 0.92) {
          const k = (t - 0.76) / 0.16;
          w.charging.position.z = w.chargingHome.z + (k < 0.5 ? smooth(k * 2) : 1 - smooth((k - 0.5) * 2)) * (w.kind === 'pistol' ? 0.03 : 0.07);
        }
      }
    }
    const wrist = w.rifle.worldToLocal(w.handL.getWorldPosition(new THREE.Vector3()));
    orientLimb(w.sleeveL, wrist.add(new THREE.Vector3(-0.03, 0, 0)), w.elbowL);
  }

  muzzleWorld(out: THREE.Vector3) {
    return this.w.muzzle.getWorldPosition(out);
  }
}

/** Fire control for the equipped loadout. */
export class Gun {
  stats: GunStats;
  ammo: number;
  reserve: number;
  private cool = 0;
  reloading = -1;
  private reloadDur = 0;
  emptyReload = false;
  private lastTrigger = false;

  constructor(stats: GunStats) {
    this.stats = stats;
    this.ammo = stats.mag;
    this.reserve = stats.reserve;
  }

  get name() {
    return this.stats.name;
  }

  get magSize() {
    return this.stats.mag;
  }

  /** Re-arm with new stats (spawn / class change). */
  reset(stats: GunStats) {
    this.stats = stats;
    this.ammo = stats.mag;
    this.reserve = stats.reserve;
    this.reloading = -1;
    this.cool = 0;
  }

  damageAt(dist: number) {
    return this.stats.damageAt(dist);
  }

  startReload(): boolean {
    if (this.reloading >= 0 || this.ammo >= this.magSize || this.reserve <= 0) return false;
    this.emptyReload = this.ammo === 0;
    this.reloadDur = this.emptyReload ? this.stats.reloadEmpty : this.stats.reload;
    this.reloading = 0;
    return true;
  }

  /** Advance timers; returns how many rounds leave the barrel this frame. */
  update(dt: number, trigger: boolean, canFire: boolean): number {
    this.cool -= dt;
    if (this.reloading >= 0) {
      this.reloading += dt / this.reloadDur;
      if (this.reloading >= 1) {
        const take = Math.min(this.magSize - this.ammo, this.reserve);
        this.ammo += take;
        this.reserve -= take;
        this.reloading = -1;
      }
      return 0;
    }
    let shots = 0;
    const pull = trigger && !this.lastTrigger;
    this.lastTrigger = trigger;
    if (!this.stats.auto) {
      if (pull && canFire && this.cool <= 0 && this.ammo > 0) {
        this.cool = 60 / this.stats.rpm;
        this.ammo--;
        shots = 1;
      }
    } else if (trigger && canFire) {
      while (this.cool <= 0 && this.ammo > 0) {
        this.cool += 60 / this.stats.rpm;
        this.ammo--;
        shots++;
      }
    }
    if (this.cool < 0) this.cool = 0;
    return shots;
  }
}
