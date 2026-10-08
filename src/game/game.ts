import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { HybridRenderer } from './renderer';
import { buildMap, raycastBoxes, type GameMap } from './map';
import { createMaterials } from './materials';
import { buildSoldier } from './soldier';
import { Bot, BOT_NAMES, raySphere, type BotWorld } from './bot';
import { Viewmodel, Gun } from './viewmodel';
import { Player } from './player';
import { Input } from './input';
import { Hud } from './hud';
import { Sfx } from './audio';
import { Effects } from './effects';
import { skyTex } from './textures';
import { loadProfile, saveProfile, levelForXp, xpForLevel, nextUnlock, UNLOCKS, XP, MAX_LEVEL, type Profile } from './progression';
import { clamp, damp, lerp } from './util';

export interface Settings {
  sensitivity: number;
  fov: number;
  dither: boolean;
  lowHeight: number;
  volume: number;
}

const BOT_COUNT = 6;
const SWEEP_STREAK = 3;
const SWEEP_TIME = 30;

export class Game {
  readonly renderer: HybridRenderer;
  readonly input: Input;
  readonly sfx = new Sfx();
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(80, 1, 0.05, 220);
  private sky = skyTex();
  private map: GameMap;
  private vm: Viewmodel;
  private gun = new Gun();
  private player = new Player();
  private hud = new Hud();
  private effects: Effects;
  private bots: Bot[] = [];
  private world: BotWorld;

  private profile: Profile = loadProfile();
  private matchKills = 0;
  private matchDeaths = 0;
  private matchXp = 0;
  private streak = 0;
  private sweepReady = false;
  private sweepT = 0;
  private now = 0;
  private respawnT = 0;
  private killedBy = '';
  private punch = 0;
  private bloom = 0;
  private landDip = 0;
  private lastReload = -1;
  private autoReloadT = 0;
  private wasFiring = false;
  private deathCam = 0;
  paused = true;
  settings: Settings;

  constructor(canvas: HTMLCanvasElement, settings: Settings) {
    this.settings = settings;
    this.renderer = new HybridRenderer(canvas);
    this.input = new Input(canvas);
    this.camera.rotation.order = 'YXZ';

    const pmrem = new THREE.PMREMGenerator(this.renderer.gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = env;
    this.scene.environmentIntensity = 0.45;
    this.scene.fog = new THREE.Fog(0x3b2a30, 14, 80);

    const hemi = new THREE.HemisphereLight(0x9a86b8, 0x3a2e22, 1.3);
    const sun = new THREE.DirectionalLight(0xffa860, 2.4);
    sun.position.set(-40, 22, -12);
    const amb = new THREE.AmbientLight(0x2c2434, 0.5);
    for (const l of [hemi, sun, amb]) {
      l.layers.enableAll();
      this.scene.add(l);
    }

    this.map = buildMap(this.scene);
    this.effects = new Effects(this.scene);
    const mats = createMaterials();
    this.vm = new Viewmodel(mats, env);

    const templates = [buildSoldier(mats, 0), buildSoldier(mats, 1)];
    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    for (let i = 0; i < BOT_COUNT; i++) {
      this.bots.push(new Bot(templates[i % 2], names[i % names.length], this.scene));
    }

    this.world = {
      map: this.map,
      player: this.player,
      playerEye: new THREE.Vector3(),
      effects: this.effects,
      sfx: this.sfx,
      bots: this.bots,
      now: 0,
      listenerYaw: 0,
      damagePlayer: (d, from, bot) => this.damagePlayer(d, from, bot),
      pickBotSpawn: () => this.pickBotSpawn(),
    };

    this.respawnPlayer();
    for (const b of this.bots) b.spawn(this.pickBotSpawn());
    this.applySettings();
    this.refreshHud();
    this.hud.streakInfo(this.streakHtml());
  }

  applySettings() {
    const s = this.settings;
    this.renderer.lowHeight = s.lowHeight;
    this.renderer.setDither(s.dither);
    this.sfx.setVolume(s.volume);
    this.resize();
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.vm.setAspect(w / h);
  }

  setPaused(p: boolean) {
    this.paused = p;
    this.hud.setVisible(!p);
  }

  // ------------------------------------------------------------------ spawning

  private respawnPlayer() {
    let best = this.map.spawns[0];
    let bestScore = -Infinity;
    for (const s of this.map.spawns) {
      let minD = Infinity;
      for (const b of this.bots) if (b.alive) minD = Math.min(minD, b.pos.distanceTo(s));
      const score = minD + Math.random() * 6;
      if (score > bestScore) {
        bestScore = score;
        best = s;
      }
    }
    this.player.spawn(best, Math.atan2(best.x, best.z));
    this.gun.ammo = this.gun.magSize;
    this.gun.reserve = 150;
    this.gun.reloading = -1;
    this.vm.reload = -1;
  }

  private pickBotSpawn(): THREE.Vector3 {
    const eye = this.player.eye(new THREE.Vector3());
    let fallback = this.map.nav.randomWalkable();
    for (let i = 0; i < 40; i++) {
      const p = this.map.nav.randomWalkable();
      const d = p.distanceTo(this.player.pos);
      if (d < 20) continue;
      fallback = p;
      const head = p.clone().setY(1.6);
      const dir = head.clone().sub(eye);
      const len = dir.length();
      if (raycastBoxes(this.map.boxes, eye, dir.divideScalar(len), len)) return p; // hidden from player
    }
    return fallback;
  }

  // ------------------------------------------------------------------ combat

  private damagePlayer(dmg: number, from: THREE.Vector3, bot: Bot) {
    const p = this.player;
    if (!p.alive) return;
    p.health -= dmg;
    p.lastHit = this.now;
    this.punch += 0.02;
    this.hud.damageFrom(Math.atan2(from.x - p.pos.x, from.z - p.pos.z));
    this.sfx.hurt();
    if (p.health <= 0) {
      p.health = 0;
      p.alive = false;
      this.killedBy = bot.name;
      this.matchDeaths++;
      this.profile.deaths++;
      this.streak = 0;
      this.respawnT = 3.5;
      this.deathCam = 0;
      saveProfile(this.profile);
      this.hud.killfeed(`<span class="enemy">${bot.name}</span> [KR-4] <span class="you">YOU</span>`);
      this.hud.deadScreen(true, `Killed by ${bot.name}`);
      this.hud.streakInfo(this.streakHtml());
    }
  }

  private shoot() {
    const cam = this.camera;
    const eye = this.player.eye(new THREE.Vector3());
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    const spread = this.spread();
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * spread;
    const dir = fwd.clone().addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();

    const wHit = raycastBoxes(this.map.boxes, eye, dir, 200);
    let best = wHit ? wHit.t : 200;
    let hitBot: Bot | null = null;
    let head = false;
    for (const b of this.bots) {
      if (!b.alive) continue;
      for (const s of b.spheres) {
        const t = raySphere(eye, dir, s.c, s.r);
        if (t > 0 && t < best) {
          best = t;
          hitBot = b;
          head = s.head;
        }
      }
    }
    const end = eye.clone().addScaledVector(dir, best);
    const muzzle = eye.clone().addScaledVector(fwd, 0.6).addScaledVector(right, 0.12 * (1 - this.vm.ads)).addScaledVector(up, -0.1 * (1 - this.vm.ads * 0.6));
    if (Math.random() < 0.5) this.effects.tracer(muzzle, end);
    this.effects.muzzle(muzzle);

    if (hitBot) {
      const dmg = this.gun.damageAt(best) * (head ? 1.5 : 1);
      const killed = hitBot.damage(dmg, this.player.pos, this.now);
      this.effects.blood(end, dir, head);
      this.hud.hitmarker(killed);
      this.sfx.hitmarker(killed);
      if (killed) this.onKill(hitBot, head, best);
    } else if (wHit) {
      this.effects.impact(wHit.point, wHit.normal, wHit.surface);
    }

    // recoil: permanent climb + decaying view punch
    const adsK = lerp(1, 0.65, this.vm.ads);
    this.player.pitch += (0.006 + Math.random() * 0.003) * adsK;
    this.player.yaw += (Math.random() - 0.45) * 0.005 * adsK;
    this.punch += 0.01 * adsK;
    this.bloom = Math.min(this.bloom + 0.007, 0.05);
    this.vm.fire();
    this.sfx.gunshot(0, 0);
  }

  private spread() {
    const p = this.player;
    const ads = this.vm.ads;
    let s = lerp(0.038, 0.0015, ads);
    s += clamp(p.speed / 5, 0, 1.4) * lerp(0.03, 0.006, ads);
    if (!p.onGround) s += 0.05;
    if (p.crouchT > 0.5) s *= 0.75;
    return s + this.bloom * lerp(1, 0.25, ads);
  }

  private onKill(bot: Bot, head: boolean, dist: number) {
    const before = levelForXp(this.profile.xp);
    let xp = XP.kill;
    this.hud.popup(`+${XP.kill}`);
    if (head) {
      xp += XP.headshot;
      this.hud.popup(`HEADSHOT +${XP.headshot}`, 'hs');
      this.profile.headshots++;
    }
    if (dist > 35) {
      xp += XP.longshot;
      this.hud.popup(`LONGSHOT +${XP.longshot}`, 'hs');
    }
    if (bot.name === this.killedBy) {
      xp += XP.revenge;
      this.hud.popup(`PAYBACK +${XP.revenge}`, 'hs');
      this.killedBy = '';
    }
    this.streak++;
    this.matchKills++;
    this.profile.kills++;
    this.profile.bestStreak = Math.max(this.profile.bestStreak, this.streak);
    if (this.streak === SWEEP_STREAK) {
      xp += XP.streak3;
      this.sweepReady = true;
      this.sfx.streak();
      this.hud.showBanner('SWEEP READY', 'PRESS [4] TO LAUNCH RADAR SWEEP');
    } else if (this.streak === 5) {
      xp += XP.streak5;
      this.sfx.streak();
      this.hud.showBanner('5 KILL STREAK', `+${XP.streak5} XP`);
    }
    this.hud.killfeed(`<span class="you">YOU</span> [KR-4]${head ? ' ⌖' : ''} <span class="enemy">${bot.name}</span>`);
    this.addXp(xp, before);
  }

  private addXp(xp: number, levelBefore: number) {
    this.profile.xp += xp;
    this.matchXp += xp;
    const after = levelForXp(this.profile.xp);
    if (after > levelBefore) {
      const unlock = UNLOCKS[after];
      this.hud.showBanner('PROMOTED', `LEVEL ${after}${unlock ? ` · UNLOCKED: ${unlock}` : ''}`, 4);
      this.sfx.levelUp();
    }
    saveProfile(this.profile);
    this.refreshHud();
  }

  private refreshHud() {
    const lvl = levelForXp(this.profile.xp);
    const base = xpForLevel(lvl);
    const need = lvl >= MAX_LEVEL ? 1 : xpForLevel(lvl + 1) - base;
    const nu = nextUnlock(lvl);
    this.hud.rank(lvl, this.profile.xp - base, need, nu ? `LVL ${nu[0]} ${nu[1]}` : '');
    this.hud.scoreboard(this.matchKills, this.matchDeaths, this.streak, this.matchXp);
  }

  private streakHtml() {
    if (this.sweepT > 0) return `SWEEP ACTIVE ${Math.ceil(this.sweepT)}s`;
    if (this.sweepReady) return `<span class="ready">[4] SWEEP READY</span>`;
    return `SWEEP: ${Math.min(this.streak, SWEEP_STREAK)}/${SWEEP_STREAK} KILLS`;
  }

  // ------------------------------------------------------------------ frame

  update(dt: number) {
    this.now += dt;
    const p = this.player;
    const inp = this.input;
    const s = this.settings;

    // look
    const adsSens = lerp(1, 0.6, this.vm.ads);
    const k = 0.0022 * s.sensitivity * adsSens;
    if (p.alive) {
      p.yaw -= inp.mouseDX * k;
      p.pitch = clamp(p.pitch - inp.mouseDY * k, -1.45, 1.45);
    }

    const aiming = inp.aim && p.alive;
    if (p.alive) p.update(dt, inp, this.map.boxes, aiming, this.now);
    if (p.landedSpeed > 0) {
      this.landDip = clamp(p.landedSpeed / 10, 0, 1);
      this.vm.landed(this.landDip);
      this.sfx.footstep(0.3);
    }
    if (p.stepDist > (p.sprinting ? 2.4 : 1.9)) {
      p.stepDist = 0;
      if (p.crouchT < 0.5) this.sfx.footstep(p.sprinting ? 0.2 : 0.12);
    }

    // weapon
    if (p.alive) {
      if (inp.pressed.has('KeyR') && this.gun.startReload()) this.lastReload = 0;
      if (this.gun.ammo === 0 && this.gun.reserve > 0 && this.gun.reloading < 0) {
        this.autoReloadT += dt;
        if (this.autoReloadT > 0.25 && this.gun.startReload()) this.lastReload = 0;
      } else this.autoReloadT = 0;
      if (inp.pressed.has('Digit4') && this.sweepReady) {
        this.sweepReady = false;
        this.sweepT = SWEEP_TIME;
        this.sfx.streak();
        this.hud.showBanner('SWEEP ONLINE', 'ENEMY POSITIONS REVEALED');
      }
      const canFire = !p.sprinting && this.vm.reload < 0;
      const shots = this.gun.update(dt, inp.fire, canFire);
      for (let i = 0; i < shots; i++) this.shoot();
      if (inp.fire && !this.wasFiring && this.gun.ammo === 0 && this.gun.reserve === 0) this.sfx.dryFire();
      this.wasFiring = inp.fire;
      // reload foley at key frames
      if (this.gun.reloading >= 0) {
        const t = this.gun.reloading;
        for (const [at, f] of [[0.2, 1500], [0.62, 2200], [0.84, 1200]] as const) {
          if (this.lastReload < at && t >= at && (at !== 0.84 || this.gun.emptyReload)) this.sfx.click(f, 0.3);
        }
        this.lastReload = t;
      }
    }
    this.vm.reload = this.gun.reloading;
    this.vm.reloadEmpty = this.gun.emptyReload;
    this.bloom = damp(this.bloom, 0, 4, dt);
    this.punch = damp(this.punch, 0, 10, dt);
    this.landDip = damp(this.landDip, 0, 8, dt);

    // camera
    const cam = this.camera;
    p.eye(cam.position);
    cam.position.y -= this.landDip * 0.12;
    if (!p.alive) {
      this.deathCam = Math.min(1, this.deathCam + dt * 1.6);
      cam.position.y = lerp(cam.position.y, p.pos.y + 0.35, this.deathCam);
      cam.rotation.set(p.pitch * (1 - this.deathCam) - 0.2 * this.deathCam, p.yaw, 0.6 * this.deathCam);
    } else {
      cam.rotation.set(p.pitch + this.punch, p.yaw, 0);
    }
    const targetFov = lerp(s.fov, s.fov * 0.7, this.vm.ads) + (p.sprinting ? 4 : 0);
    if (Math.abs(cam.fov - targetFov) > 0.01) {
      cam.fov = damp(cam.fov, targetFov, 14, dt);
      cam.updateProjectionMatrix();
    }
    cam.updateMatrixWorld();

    this.vm.update(dt, {
      ads: aiming,
      sprinting: p.sprinting,
      speed: p.speed,
      grounded: p.onGround,
      lookDX: inp.mouseDX,
      lookDY: inp.mouseDY,
      crouch: p.crouchT,
    });
    this.vm.scene.visible = p.alive;

    // bots
    this.world.now = this.now;
    p.eye(this.world.playerEye);
    this.world.listenerYaw = p.yaw;
    for (const b of this.bots) b.update(dt, this.world);

    this.effects.update(dt);

    // respawn
    if (!p.alive) {
      this.respawnT -= dt;
      this.hud.deadScreen(true, `Killed by ${this.killedBy} · respawning in ${Math.max(0, Math.ceil(this.respawnT))}`);
      if (this.respawnT <= 0) {
        this.respawnPlayer();
        this.hud.deadScreen(false);
      }
    }

    if (this.sweepT > 0) this.sweepT -= dt;

    // HUD
    const g = this.gun;
    this.hud.ammo(g.name, g.ammo, g.reserve, g.magSize, g.reloading >= 0);
    const spreadPx = (this.spread() / Math.tan(((cam.fov / 2) * Math.PI) / 180)) * (window.innerHeight / 2);
    this.hud.crosshair(spreadPx, this.vm.ads, !p.alive || p.sprinting);
    this.hud.update(dt, p.health, (a) => {
      // attacker world angle -> screen rotation (0 = ahead, +cw)
      let d = Math.PI - a + p.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      return d;
    });
    const enemies = this.bots
      .filter((b) => b.alive && (this.sweepT > 0 || this.now - b.lastShotT < 1.3))
      .map((b) => ({ x: b.pos.x, z: b.pos.z }));
    this.hud.minimap(this.map.boxes, this.map.half, p.pos.x, p.pos.z, p.yaw, enemies, this.sweepT > 0 ? 1 : 0);
    this.hud.scoreboard(this.matchKills, this.matchDeaths, this.streak, this.matchXp);
    this.hud.streakInfo(this.streakHtml());

    inp.endFrame();
  }

  render() {
    this.renderer.render(this.scene, this.camera, this.sky, this.vm.scene, this.vm.camera);
  }

  profileSummary() {
    const lvl = levelForXp(this.profile.xp);
    return { level: lvl, ...this.profile };
  }
}
