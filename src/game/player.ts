import * as THREE from 'three';
import type { Box } from './map';
import type { Input } from './input';
import { clamp, damp } from './util';

const RADIUS = 0.33;
const STAND = 1.78;
const CROUCH = 1.15;
const STEP = 0.5;

export class Player {
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  onGround = false;
  crouchT = 0;
  slide = 0;
  private slideDir = new THREE.Vector3();
  sprinting = false;
  health = 100;
  maxHealth = 100;
  speedMult = 1;
  lastHit = -99;
  alive = true;
  /** set by update() when landing hard (fall speed, m/s) */
  landedSpeed = 0;
  stepDist = 0;

  get height() {
    return STAND + (CROUCH - STAND) * this.crouchT;
  }

  eye(out: THREE.Vector3) {
    return out.set(this.pos.x, this.pos.y + this.height - 0.1, this.pos.z);
  }

  get speed() {
    return Math.hypot(this.vel.x, this.vel.z);
  }

  spawn(p: THREE.Vector3, yaw: number) {
    this.pos.copy(p);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
    this.health = this.maxHealth;
    this.alive = true;
    this.crouchT = 0;
    this.slide = 0;
  }

  update(dt: number, input: Input, boxes: Box[], aiming: boolean, now: number) {
    this.landedSpeed = 0;
    const fwd = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
    const strafe = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0);
    const wantCrouch = input.down('KeyC') || input.down('ControlLeft');
    this.sprinting = input.down('ShiftLeft') && fwd > 0 && !aiming && this.crouchT < 0.5 && this.slide <= 0;

    // slide: crouch while sprinting
    if (input.pressed.has('KeyC') && this.speed > 5.5 && this.onGround) {
      this.slide = 0.75;
      this.slideDir.set(this.vel.x, 0, this.vel.z).normalize();
      this.vel.x = this.slideDir.x * 9.5;
      this.vel.z = this.slideDir.z * 9.5;
    }

    const targetCrouch = wantCrouch || this.slide > 0 ? 1 : 0;
    if (targetCrouch < this.crouchT && !this.canStand(boxes)) {
      // blocked overhead, stay down
    } else {
      this.crouchT = damp(this.crouchT, targetCrouch, 12, dt);
    }

    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const wish = new THREE.Vector3(-sin * fwd + cos * strafe, 0, -cos * fwd - sin * strafe);
    if (wish.lengthSq() > 1) wish.normalize();

    let maxSpeed = 4.6;
    if (this.sprinting) maxSpeed = 7.0;
    if (this.crouchT > 0.5) maxSpeed = 2.4;
    if (aiming) maxSpeed = Math.min(maxSpeed, 2.9);
    maxSpeed *= this.speedMult;

    if (this.slide > 0) {
      this.slide -= dt;
      const k = 1 - Math.exp(-2.2 * dt);
      this.vel.x -= this.vel.x * k;
      this.vel.z -= this.vel.z * k;
    } else {
      const accel = this.onGround ? 14 : 2.5;
      const k = 1 - Math.exp(-accel * dt);
      this.vel.x += (wish.x * maxSpeed - this.vel.x) * k;
      this.vel.z += (wish.z * maxSpeed - this.vel.z) * k;
    }

    if (input.pressed.has('Space') && this.onGround && this.crouchT < 0.5) {
      this.vel.y = 5.6;
      this.onGround = false;
    }
    this.vel.y -= 17 * dt;
    if (this.vel.y < -40) this.vel.y = -40;

    const wasGround = this.onGround;
    const fallV = this.vel.y;
    this.onGround = false;
    this.moveAxis(0, this.vel.x * dt, boxes, wasGround);
    this.moveAxis(2, this.vel.z * dt, boxes, wasGround);
    this.moveAxis(1, this.vel.y * dt, boxes, wasGround);
    if (this.onGround && !wasGround && fallV < -4) this.landedSpeed = -fallV;
    if (this.onGround) this.stepDist += this.speed * dt;

    // passive health regen after 4.5s out of combat
    if (this.alive && now - this.lastHit > 4.5 && this.health < this.maxHealth) {
      this.health = clamp(this.health + 40 * dt, 0, this.maxHealth);
    }
  }

  private overlaps(b: Box, x: number, y: number, z: number, h: number) {
    return (
      x + RADIUS > b.min.x && x - RADIUS < b.max.x &&
      z + RADIUS > b.min.z && z - RADIUS < b.max.z &&
      y + h > b.min.y && y < b.max.y
    );
  }

  private canStand(boxes: Box[]) {
    for (const b of boxes) if (this.overlaps(b, this.pos.x, this.pos.y + 0.05, this.pos.z, STAND - 0.05)) return false;
    return true;
  }

  private moveAxis(axis: 0 | 1 | 2, delta: number, boxes: Box[], grounded: boolean) {
    if (delta === 0) return;
    const p = this.pos;
    p.setComponent(axis, p.getComponent(axis) + delta);
    const h = this.height;
    for (const b of boxes) {
      if (!this.overlaps(b, p.x, p.y, p.z, h)) continue;
      if (axis === 1) {
        if (delta < 0) {
          p.y = b.max.y;
          this.onGround = true;
        } else {
          p.y = b.min.y - h;
        }
        this.vel.y = 0;
        continue;
      }
      // try stepping up onto low obstacles
      const rise = b.max.y - p.y;
      if (grounded && rise > 0 && rise <= STEP && this.free(boxes, p.x, b.max.y + 0.001, p.z, h)) {
        p.y = b.max.y + 0.001;
        continue;
      }
      const v = axis === 0 ? (delta > 0 ? b.min.x - RADIUS - 1e-4 : b.max.x + RADIUS + 1e-4) : delta > 0 ? b.min.z - RADIUS - 1e-4 : b.max.z + RADIUS + 1e-4;
      p.setComponent(axis, v);
      this.vel.setComponent(axis, 0);
    }
  }

  private free(boxes: Box[], x: number, y: number, z: number, h: number) {
    for (const b of boxes) if (this.overlaps(b, x, y, z, h)) return false;
    return true;
  }
}
