import * as THREE from 'three';
import type { Materials } from './materials';
import { buildRifle } from './rifle';
import { attachHands } from './hands';
import { flashTex } from './textures';
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

const HIP = new THREE.Vector3(0.15, -0.155, -0.4);
const SPRINT = new THREE.Vector3(0.08, -0.19, -0.34);

/** First-person gun + gloved hands, rendered at full res in its own scene. */
export class Viewmodel {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(52, 1, 0.01, 10);
  private root = new THREE.Group();
  private rifle: THREE.Group;
  private mag: THREE.Object3D;
  private magHome: THREE.Vector3;
  private charging: THREE.Object3D;
  private muzzle: THREE.Object3D;
  private port: THREE.Object3D;
  private adsPos: THREE.Vector3;
  private handL: THREE.Object3D;
  private handLHome: THREE.Vector3;
  private sleeveL: THREE.Mesh;
  private elbowL = new THREE.Vector3(-0.26, -0.32, 0.12);
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

    this.rifle = buildRifle(m);
    this.root.add(this.rifle);
    const hands = attachHands(this.rifle, m);
    this.handL = hands.left;
    this.handLHome = hands.left.position.clone();

    // sleeves running back out of frame
    const sleeveGeo = new THREE.CylinderGeometry(0.04, 0.046, 1, 20, 1, true);
    this.rifle.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(this.rifle.matrixWorld).invert();
    const wristR = hands.right.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
    const elbowR = new THREE.Vector3(0.1, -0.3, 0.42);
    const sleeveStart = wristR.clone().add(new THREE.Vector3(0, 0, 0.035));
    orientLimb(mesh(sleeveGeo, m.camoClose, this.rifle), sleeveStart, elbowR);
    const cuffR = mesh(new THREE.TorusGeometry(0.046, 0.012, 10, 24), m.camoClose, this.rifle, { pos: sleeveStart.toArray() as [number, number, number] });
    cuffR.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), elbowR.clone().sub(sleeveStart).normalize());
    this.sleeveL = mesh(sleeveGeo, m.camoClose, this.rifle);

    this.mag = this.rifle.getObjectByName('mag')!;
    this.magHome = this.mag.position.clone();
    this.charging = this.rifle.getObjectByName('chargingHandle')!;
    this.muzzle = this.rifle.getObjectByName('muzzle')!;
    this.port = this.rifle.getObjectByName('ejectionPort')!;
    const sight = this.rifle.getObjectByName('sight')!;
    const sp = sight.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
    this.adsPos = new THREE.Vector3(-sp.x, -sp.y, -0.24 - sp.z);

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
    this.muzzle.add(this.flash);
    this.muzzle.add(this.flashLight);
    this.flashLight.position.z = -0.05;

    const shellGeo = new THREE.CylinderGeometry(0.0048, 0.0048, 0.045, 10);
    for (let i = 0; i < 14; i++) {
      const s = new THREE.Mesh(shellGeo, m.brass);
      s.visible = false;
      this.camera.add(s);
      this.shells.push({ m: s, v: new THREE.Vector3(), spin: new THREE.Vector3(), life: 0 });
    }
  }

  setAspect(a: number) {
    this.camera.aspect = a;
    this.camera.updateProjectionMatrix();
  }

  fire() {
    const adsK = lerp(1, 0.35, this.ads);
    this.kick += 0.028 * adsK;
    this.kickPitch += (0.045 + Math.random() * 0.02) * adsK;
    this.kickYaw += (Math.random() - 0.5) * 0.03 * adsK;
    this.kickRoll += (Math.random() - 0.5) * 0.05 * adsK;
    this.flashTime = 0.045;
    this.flash.rotation.z = Math.random() * Math.PI;
    this.flash.scale.setScalar(0.75 + Math.random() * 0.5);

    // eject brass from the port in camera space
    const s = this.shells[this.shellIdx++ % this.shells.length];
    this.port.getWorldPosition(s.m.position);
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
    this.ads = damp(this.ads, inp.ads && this.reload < 0 && !inp.sprinting ? 1 : 0, 14, dt);
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

    const p = this.root.position;
    p.copy(HIP).lerp(this.adsPos, this.ads);
    p.lerp(SPRINT, this.sprint * (1 - this.ads));
    p.y -= inp.crouch * 0.01 * (1 - this.ads);

    const bobK = this.bobAmt * lerp(1, 0.12, this.ads) * (1 + this.sprint * 0.8);
    p.x += Math.sin(this.bob) * 0.011 * bobK;
    p.y += -Math.abs(Math.cos(this.bob)) * 0.012 * bobK + Math.sin(this.breath * 1.6) * 0.0016 * (1 - this.ads * 0.8);
    p.y -= this.land * 0.03;
    p.x += this.sway.x * 0.4;
    p.y += this.sway.y * 0.4;
    p.z += this.kick;

    const r = this.root.rotation;
    r.x = this.kickPitch + this.sway.y + Math.sin(this.bob * 2) * 0.008 * bobK - this.land * 0.05;
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
    const t = this.reload;
    this.mag.position.copy(this.magHome);
    this.mag.visible = true;
    this.charging.position.z = 0;
    this.handL.position.copy(this.handLHome);
    this.rifle.rotation.set(0, 0, 0);
    this.rifle.position.set(0, 0, 0);
    if (t >= 0) {
      const env = smooth(clamp(t / 0.14, 0, 1)) * smooth(clamp((1 - t) / 0.16, 0, 1));
      this.rifle.rotation.z = 0.5 * env;
      this.rifle.rotation.x = 0.18 * env;
      this.rifle.rotation.y = -0.12 * env;
      this.rifle.position.y = -0.02 * env;

      // mag out (0.16..0.32), new mag in (0.48..0.66)
      let drop = 0;
      if (t < 0.16) drop = 0;
      else if (t < 0.32) drop = smooth((t - 0.16) / 0.16);
      else if (t < 0.48) drop = 1;
      else if (t < 0.66) drop = 1 - smooth((t - 0.48) / 0.18);
      this.mag.position.y -= drop * 0.28;
      this.mag.position.z += drop * 0.05;
      this.mag.visible = !(t > 0.33 && t < 0.4);

      // support hand travels to the mag well and back
      const handK = smooth(clamp((t - 0.08) / 0.16, 0, 1)) * smooth(clamp((0.8 - t) / 0.12, 0, 1));
      const magTarget = new THREE.Vector3(-0.05, -0.12, -0.02).add(this.mag.position).sub(this.magHome);
      this.handL.position.lerp(magTarget, handK);

      if (this.reloadEmpty && t > 0.76 && t < 0.92) {
        const k = (t - 0.76) / 0.16;
        this.charging.position.z = (k < 0.5 ? smooth(k * 2) : 1 - smooth((k - 0.5) * 2)) * 0.07;
      }
    }
    orientLimb(this.sleeveL, this.handL.position.clone().add(new THREE.Vector3(-0.03, 0, 0)), this.elbowL);
  }

  muzzleWorld(out: THREE.Vector3) {
    return this.muzzle.getWorldPosition(out);
  }
}

/** Weapon stats + fire control. */
export class Gun {
  readonly name = 'KR-4 CARBINE';
  readonly magSize = 30;
  ammo = 30;
  reserve = 150;
  readonly rpm = 780;
  readonly reloadTime = 2.1;
  readonly reloadEmptyTime = 2.6;
  private cool = 0;
  reloading = -1;
  private reloadDur = 0;
  emptyReload = false;

  damageAt(dist: number) {
    return dist < 25 ? 34 : dist > 50 ? 22 : lerp(34, 22, (dist - 25) / 25);
  }

  startReload(): boolean {
    if (this.reloading >= 0 || this.ammo >= this.magSize || this.reserve <= 0) return false;
    this.emptyReload = this.ammo === 0;
    this.reloadDur = this.emptyReload ? this.reloadEmptyTime : this.reloadTime;
    this.reloading = 0;
    return true;
  }

  /** Advance timers; returns how many rounds leave the barrel this frame. */
  update(dt: number, trigger: boolean, canFire: boolean): number {
    this.cool -= dt;
    if (this.reloading >= 0) {
      this.reloading += dt / this.reloadDur;
      if (this.reloading >= 1) {
        const need = this.magSize - this.ammo;
        const take = Math.min(need, this.reserve);
        this.ammo += take;
        this.reserve -= take;
        this.reloading = -1;
      }
      return 0;
    }
    let shots = 0;
    if (trigger && canFire) {
      while (this.cool <= 0 && this.ammo > 0) {
        this.cool += 60 / this.rpm;
        this.ammo--;
        shots++;
      }
    }
    if (this.cool < 0) this.cool = 0;
    return shots;
  }
}
