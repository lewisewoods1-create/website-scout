import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { HybridRenderer, LAYER_CHAR } from './renderer';
import { buildMap, raycastBoxes, type GameMap } from './map';
import { createMaterials, soldierMaterials } from './materials';
import { buildSoldier } from './soldier';
import { Bot, BOT_NAMES, raySphere, type BotWorld, type Combatant, type Difficulty } from './bot';
import { Viewmodel, Gun } from './viewmodel';
import { Player } from './player';
import { Input } from './input';
import { Hud, type MapMarker } from './hud';
import { Sfx } from './audio';
import { Effects } from './effects';
import { skyTex } from './textures';
import { cfgFromLoadout, type WeaponCfg } from './weapons';
import { computeStats, loadClasses, type Loadout } from './loadout';
import { loadProfile, saveProfile, levelForXp, xpForLevel, nextUnlock, UNLOCKS, XP, MAX_LEVEL, type Profile } from './progression';
import { clamp, damp, lerp } from './util';

export interface Settings {
  sensitivity: number;
  fov: number;
  dither: boolean;
  lowHeight: number;
  volume: number;
  unlockAll: boolean;
}

export type Mode = 'tdm' | 'ffa';
export type DifficultyId = 'recruit' | 'regular' | 'hardened' | 'veteran';

export interface MatchConfig {
  mode: Mode;
  difficulty: DifficultyId;
  classIndex: number;
}

export const DIFFICULTIES: Record<DifficultyId, Difficulty & { label: string }> = {
  recruit: { label: 'RECRUIT', react: 1.7, accuracy: 0.55, damage: 0.75 },
  regular: { label: 'REGULAR', react: 1.0, accuracy: 0.85, damage: 1.0 },
  hardened: { label: 'HARDENED', react: 0.8, accuracy: 1.0, damage: 1.1 },
  veteran: { label: 'VETERAN', react: 0.6, accuracy: 1.2, damage: 1.25 },
};

export const MODES: Record<Mode, { label: string; desc: string; scoreLimit: number; minutes: number }> = {
  tdm: { label: 'TEAM DEATHMATCH', desc: '6 v 6. First team to 50 kills wins.', scoreLimit: 50, minutes: 10 },
  ffa: { label: 'FREE-FOR-ALL', desc: '12 players, every one for themselves. First to 25.', scoreLimit: 25, minutes: 10 },
};

const MAX_BOTS = 11;
const ATTRACT_BOTS = 8;
const SWEEP_STREAK = 3;
const SWEEP_TIME = 30;
const ALLY = '#7ec8ff';
const ENEMY = '#ff5a3a';

/** Wraps the Player so bots can treat it like any other combatant. */
class PlayerAgent implements Combatant {
  readonly id = 0;
  name = 'YOU';
  team = 0;
  readonly isPlayer = true;
  kills = 0;
  deaths = 0;
  private p: Player;
  constructor(p: Player) {
    this.p = p;
  }
  get alive() {
    return this.p.alive;
  }
  set alive(v: boolean) {
    this.p.alive = v;
  }
  get pos() {
    return this.p.pos;
  }
  eye(out: THREE.Vector3) {
    return this.p.eye(out);
  }
  speed() {
    return this.p.speed;
  }
  crouch() {
    return this.p.crouchT;
  }
}

export class Game {
  readonly renderer: HybridRenderer;
  readonly input: Input;
  readonly sfx = new Sfx();
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(80, 1, 0.05, 220);
  private sky = skyTex();
  private map: GameMap;
  private vm: Viewmodel;
  private gun: Gun;
  private player = new Player();
  private agent: PlayerAgent;
  private hud = new Hud();
  private effects: Effects;
  private bots: Bot[] = [];
  private world: BotWorld;
  private templates: THREE.Group[] = [];
  private charLight = new THREE.DirectionalLight(0xdfe8ff, 1.3);

  private profile: Profile = loadProfile();
  phase: 'attract' | 'match' | 'ended' = 'attract';
  private cfg: MatchConfig = { mode: 'tdm', difficulty: 'regular', classIndex: 0 };
  private classes: Loadout[] = loadClasses();
  private classIdx = 0;
  private pendingClass = -1;
  private teamScore = [0, 0];
  private timeLeft = 0;
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
  private orbit = 0;
  paused = false;
  settings: Settings;
  /** shared with the create-a-class preview */
  materials!: ReturnType<typeof createMaterials>;
  envMap!: THREE.Texture;
  /** called when the player clicks CONTINUE on the results screen */
  onExit: () => void = () => {};

  constructor(canvas: HTMLCanvasElement, settings: Settings) {
    this.settings = settings;
    this.renderer = new HybridRenderer(canvas);
    this.input = new Input(canvas);
    this.camera.rotation.order = 'YXZ';
    this.agent = new PlayerAgent(this.player);

    const pmrem = new THREE.PMREMGenerator(this.renderer.gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = env;
    this.scene.environmentIntensity = 0.45;
    this.scene.fog = new THREE.Fog(0x3b2a30, 24, 110);

    const hemi = new THREE.HemisphereLight(0xa592c4, 0x3a2e22, 1.5);
    const sun = new THREE.DirectionalLight(0xffa860, 2.4);
    sun.position.set(-40, 22, -12);
    const amb = new THREE.AmbientLight(0x2c2434, 0.6);
    for (const l of [hemi, sun, amb]) {
      l.layers.enableAll();
      this.scene.add(l);
    }
    // a camera-mounted light that only touches characters, so soldiers read clearly
    this.charLight.layers.set(LAYER_CHAR);
    this.scene.add(this.charLight, this.charLight.target);

    this.map = buildMap(this.scene);
    this.effects = new Effects(this.scene);
    const mats = createMaterials();
    this.materials = mats;
    this.envMap = env;
    this.vm = new Viewmodel(mats, env);
    this.gun = new Gun(computeStats(this.classes[0]));

    const sm = soldierMaterials(mats);
    const opt = ['iron', 'reflex', 'holo'] as const;
    for (const variant of [0, 1] as const) {
      for (const weapon of ['kr4', 'vk47'] as const) {
        const cfg: WeaponCfg = { weapon, optic: opt[(variant + (weapon === 'kr4' ? 2 : 0)) % 3], muzzle: 'none', under: weapon === 'kr4' ? 'grip' : 'none', camo: 'none' };
        const t = buildSoldier(sm, variant, cfg);
        t.userData.weapon = weapon;
        t.userData.variant = variant;
        this.templates.push(t);
      }
    }
    for (let i = 0; i < MAX_BOTS; i++) this.bots.push(new Bot(i + 1, BOT_NAMES[i], this.scene));

    this.world = {
      map: this.map,
      effects: this.effects,
      sfx: this.sfx,
      now: 0,
      combatants: [],
      bots: this.bots,
      listener: new THREE.Vector3(),
      listenerYaw: 0,
      difficulty: DIFFICULTIES.regular,
      hostile: (a, b) => this.hostile(a, b),
      hit: (t, d, s, h, dir) => this.hit(t, d, s, h, dir),
      respawnPoint: (b) => this.pickSpawn(b),
      shotFired: (s, sup) => this.shotFired(s, sup),
    };

    this.applySettings();
    this.startAttract();
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
    this.hud.setVisible(!p && this.phase !== 'attract');
  }

  get inMatch() {
    return this.phase === 'match';
  }

  get currentMode() {
    return this.cfg.mode;
  }

  profileSummary() {
    return { level: levelForXp(this.profile.xp), ...this.profile };
  }

  // ------------------------------------------------------------------ phases

  /** Menu background: bots fight each other while the camera orbits. */
  startAttract() {
    this.phase = 'attract';
    this.player.alive = false;
    this.hud.setVisible(false);
    this.hud.endScreen(null);
    this.hud.deadScreen(false);
    this.world.difficulty = DIFFICULTIES.regular;
    this.world.combatants = [];
    this.bots.forEach((b, i) => {
      b.setActive(i < ATTRACT_BOTS);
      if (i >= ATTRACT_BOTS) return;
      b.team = 10 + i;
      b.dress(this.templates[i % this.templates.length]);
      this.world.combatants.push(b);
    });
    for (const b of this.bots) if (b.active) b.spawn(this.map.nav.randomWalkable());
  }

  startMatch(cfg: MatchConfig, classes: Loadout[]) {
    this.cfg = cfg;
    this.classes = classes;
    this.classIdx = cfg.classIndex;
    this.pendingClass = -1;
    this.phase = 'match';
    this.teamScore = [0, 0];
    this.timeLeft = MODES[cfg.mode].minutes * 60;
    this.matchXp = 0;
    this.streak = 0;
    this.sweepReady = false;
    this.sweepT = 0;
    this.killedBy = '';
    this.world.difficulty = DIFFICULTIES[cfg.difficulty];
    this.hud.endScreen(null);
    this.hud.deadScreen(false);

    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    this.agent.kills = this.agent.deaths = 0;
    this.agent.team = 0;
    this.world.combatants = [this.agent];
    this.bots.forEach((b, i) => {
      b.setActive(true);
      b.name = names[i];
      b.kills = b.deaths = 0;
      const ally = cfg.mode === 'tdm' && i < 5;
      b.team = cfg.mode === 'tdm' ? (ally ? 0 : 1) : 100 + i;
      const variant = cfg.mode === 'tdm' ? (ally ? 0 : 1) : i % 2;
      b.dress(this.templates[variant * 2 + (Math.random() < 0.5 ? 0 : 1)]);
      this.world.combatants.push(b);
    });
    for (const b of this.bots) b.spawn(this.pickSpawn(b));
    this.applyClass(this.classIdx);
    this.respawnPlayer();
    this.refreshHud();
    this.hud.setVisible(true);
    this.hud.showBanner(MODES[cfg.mode].label, `${DIFFICULTIES[cfg.difficulty].label} BOTS · ${this.classes[this.classIdx].name}`, 3);
  }

  /** Swap class: applied immediately if dead/at spawn, otherwise next life. */
  setClass(idx: number, classes: Loadout[]) {
    this.classes = classes;
    if (!this.player.alive) this.classIdx = idx;
    else this.pendingClass = idx;
  }

  quitToMenu() {
    this.startAttract();
  }

  private applyClass(idx: number) {
    this.classIdx = idx;
    const l = this.classes[idx];
    const stats = computeStats(l);
    this.gun.reset(stats);
    this.vm.equip(cfgFromLoadout(l), stats.eyeDist, stats.recoil);
    this.player.maxHealth = l.perk2 === 'tough' ? 130 : 100;
    this.player.speedMult = l.perk1 === 'fleet' ? 1.1 : 1;
  }

  private endMatch() {
    this.phase = 'ended';
    this.player.alive = false;
    const before = levelForXp(this.profile.xp);
    let title: string;
    let cls: string;
    let bonus = 100;
    const rows = this.sortedBoard();
    if (this.cfg.mode === 'tdm') {
      const [a, e] = this.teamScore;
      title = a > e ? 'VICTORY' : a < e ? 'DEFEAT' : 'DRAW';
      cls = a >= e ? 'win' : 'lose';
      if (a > e) bonus += 500;
    } else {
      const place = rows.findIndex((r) => r === this.agent) + 1;
      title = `${place}${['ST', 'ND', 'RD'][place - 1] ?? 'TH'} PLACE`;
      cls = place <= 3 ? 'win' : 'lose';
      bonus += [600, 400, 200][place - 1] ?? 0;
    }
    this.addXp(bonus, before);
    const kd = this.agent.deaths ? (this.agent.kills / this.agent.deaths).toFixed(2) : String(this.agent.kills);
    this.hud.endScreen(
      `<div class="t ${cls}">${title}</div>
       <div style="font-size:26px">${MODES[this.cfg.mode].label}${this.cfg.mode === 'tdm' ? ` · ${this.teamScore[0]} – ${this.teamScore[1]}` : ''}</div>
       <div style="font-size:24px">KILLS ${this.agent.kills} · DEATHS ${this.agent.deaths} · K/D ${kd}</div>
       <div style="font-size:30px;color:#f2d36b">+${this.matchXp} XP <span style="font-size:20px;opacity:.75">(MATCH BONUS +${bonus})</span></div>`,
      () => this.onExit(),
    );
    this.hud.deadScreen(false);
    this.hud.scoreboardTable(false);
  }

  // ------------------------------------------------------------------ rules

  private hostile(a: Combatant, b: Combatant) {
    if (a === b) return false;
    return this.phase !== 'match' || this.cfg.mode === 'ffa' ? true : a.team !== b.team;
  }

  private isFriendly(b: Combatant) {
    return this.phase === 'match' && this.cfg.mode === 'tdm' && b.team === this.agent.team;
  }

  private pickSpawn(c: Combatant): THREE.Vector3 {
    const cands = [...this.map.spawns];
    for (let i = 0; i < 14; i++) cands.push(this.map.nav.randomWalkable());
    const eyeTmp = new THREE.Vector3();
    let best = cands[0];
    let bestScore = -Infinity;
    for (const p of cands) {
      let minHostile = 80;
      let minFriend = 80;
      let seen = false;
      let blocked = false;
      for (const o of this.world.combatants) {
        if (o === c || !o.alive) continue;
        const d = Math.hypot(o.pos.x - p.x, o.pos.z - p.z);
        if (d < 2.5) blocked = true;
        if (this.hostile(c, o)) {
          minHostile = Math.min(minHostile, d);
          if (!seen && d < 45) {
            const e = o.eye(eyeTmp);
            const dir = new THREE.Vector3(p.x - e.x, 1.6 - e.y, p.z - e.z);
            const len = dir.length();
            if (!raycastBoxes(this.map.boxes, e, dir.divideScalar(len), len)) seen = true;
          }
        } else {
          minFriend = Math.min(minFriend, d);
        }
      }
      let score = Math.min(minHostile, 40) - (seen ? 30 : 0) - (blocked ? 100 : 0) + Math.random() * 5;
      if (this.cfg.mode === 'tdm' && this.phase === 'match') score -= minFriend * 0.25;
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    return best.clone();
  }

  private respawnPlayer() {
    if (this.pendingClass >= 0) {
      this.classIdx = this.pendingClass;
      this.pendingClass = -1;
    }
    this.applyClass(this.classIdx);
    const p = this.pickSpawn(this.agent);
    this.player.spawn(p, Math.atan2(p.x, p.z));
    this.vm.reload = -1;
    this.hud.deadScreen(false);
  }

  private shotFired(shooter: Combatant, suppressed: boolean) {
    const r = suppressed ? 6 : 32;
    for (const b of this.bots) {
      if (!b.active || !b.alive || !this.hostile(b, shooter)) continue;
      if (b.pos.distanceToSquared(shooter.pos) < r * r && Math.random() < 0.5) b.hear(shooter.pos, this.now);
    }
  }

  /** Bot bullet landed on a target. */
  private hit(target: Combatant, dmg: number, shooter: Bot, head: boolean, dir: THREE.Vector3) {
    if (target.isPlayer) {
      this.damagePlayer(dmg, shooter);
      return;
    }
    const tb = target as Bot;
    this.effects.blood(tb.spheres[head ? 0 : 1].c, dir, head);
    if (tb.damage(dmg, shooter, this.now)) this.registerKill(shooter, tb, head);
  }

  private nameHtml(c: Combatant) {
    if (c.isPlayer) return `<span class="you">YOU</span>`;
    return this.isFriendly(c) ? `<span style="color:${ALLY}">${c.name}</span>` : `<span class="enemy">${c.name}</span>`;
  }

  private registerKill(killer: Combatant, victim: Combatant, head: boolean) {
    killer.kills++;
    victim.deaths++;
    if (this.phase !== 'match') return;
    if (this.cfg.mode === 'tdm') this.teamScore[killer.team === this.agent.team ? 0 : 1]++;
    const wpn = killer.isPlayer ? this.gun.stats.name.split(' ')[0] : (killer as Bot).weapon === 'vk47' ? 'VK-47' : 'KR-4';
    this.hud.killfeed(`${this.nameHtml(killer)} [${wpn}]${head ? ' ⌖' : ''} ${this.nameHtml(victim)}`);
    if (killer.isPlayer) this.onPlayerKill(victim, head);
    const lim = MODES[this.cfg.mode].scoreLimit;
    const top = this.cfg.mode === 'tdm' ? Math.max(...this.teamScore) : Math.max(...this.world.combatants.map((c) => c.kills));
    if (top >= lim) this.endMatch();
  }

  private damagePlayer(dmg: number, from: Bot) {
    const p = this.player;
    if (!p.alive || this.phase !== 'match') return;
    p.health -= dmg;
    p.lastHit = this.now;
    this.punch += 0.02;
    this.hud.damageFrom(Math.atan2(from.pos.x - p.pos.x, from.pos.z - p.pos.z));
    this.sfx.hurt();
    if (p.health <= 0) {
      p.health = 0;
      p.alive = false;
      this.killedBy = from.name;
      this.profile.deaths++;
      this.streak = 0;
      this.respawnT = 3.5;
      this.deathCam = 0;
      saveProfile(this.profile);
      this.registerKill(from, this.agent, false);
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
      if (!b.active || !b.alive) continue;
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
    const st = this.gun.stats;
    if (!st.suppressed && Math.random() < 0.5) this.effects.tracer(muzzle, end);
    if (!st.suppressed) this.effects.muzzle(muzzle);

    if (hitBot && !this.isFriendly(hitBot)) {
      const dmg = this.gun.damageAt(best) * (head ? 1.5 : 1);
      const killed = hitBot.damage(dmg, this.agent, this.now);
      this.effects.blood(end, dir, head);
      this.hud.hitmarker(killed);
      this.sfx.hitmarker(killed);
      if (killed) this.registerKill(this.agent, hitBot, head);
    } else if (!hitBot && wHit) {
      this.effects.impact(wHit.point, wHit.normal, wHit.surface);
    }

    const adsK = lerp(1, 0.65, this.vm.ads) * st.recoil;
    this.player.pitch += (0.006 + Math.random() * 0.003) * adsK;
    this.player.yaw += (Math.random() - 0.45) * 0.005 * adsK;
    this.punch += 0.01 * adsK;
    this.bloom = Math.min(this.bloom + 0.007 * st.recoil, 0.06);
    this.vm.fire();
    this.sfx.gunshot(0, 0, st.weapon, st.suppressed);
    this.shotFired(this.agent, st.suppressed);
  }

  private spread() {
    const p = this.player;
    const ads = this.vm.ads;
    let s = lerp(0.038 * this.gun.stats.hipSpread, 0.0015, ads);
    s += clamp(p.speed / 5, 0, 1.4) * lerp(0.03, 0.006, ads);
    if (!p.onGround) s += 0.05;
    if (p.crouchT > 0.5) s *= 0.75;
    return s + this.bloom * lerp(1, 0.25, ads);
  }

  private onPlayerKill(victim: Combatant, head: boolean) {
    const before = levelForXp(this.profile.xp);
    let xp = XP.kill;
    this.hud.popup(`+${XP.kill}`);
    if (head) {
      xp += XP.headshot;
      this.hud.popup(`HEADSHOT +${XP.headshot}`, 'hs');
      this.profile.headshots++;
    }
    if (victim.pos.distanceTo(this.player.pos) > 35) {
      xp += XP.longshot;
      this.hud.popup(`LONGSHOT +${XP.longshot}`, 'hs');
    }
    if (victim.name === this.killedBy) {
      xp += XP.revenge;
      this.hud.popup(`PAYBACK +${XP.revenge}`, 'hs');
      this.killedBy = '';
    }
    this.streak++;
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
  }

  private streakHtml() {
    if (this.sweepT > 0) return `SWEEP ACTIVE ${Math.ceil(this.sweepT)}s`;
    if (this.sweepReady) return `<span class="ready">[4] SWEEP READY</span>`;
    return `SWEEP: ${Math.min(this.streak, SWEEP_STREAK)}/${SWEEP_STREAK} KILLS`;
  }

  private sortedBoard() {
    return [...this.world.combatants].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
  }

  private boardHtml() {
    const row = (c: Combatant) =>
      `<tr class="${c.isPlayer ? 'me' : ''}"><td>${c.name}</td><td>${c.kills}</td><td>${c.deaths}</td><td>${c.kills * 100}</td></tr>`;
    const head = '<tr><th>PLAYER</th><th>K</th><th>D</th><th>SCORE</th></tr>';
    const all = this.sortedBoard();
    if (this.cfg.mode === 'tdm') {
      const a = all.filter((c) => c.team === this.agent.team);
      const e = all.filter((c) => c.team !== this.agent.team);
      return `<div><h3 style="color:${ALLY}">ALLIES ${this.teamScore[0]}</h3><table>${head}${a.map(row).join('')}</table></div>
              <div><h3 style="color:${ENEMY}">ENEMY ${this.teamScore[1]}</h3><table>${head}${e.map(row).join('')}</table></div>`;
    }
    return `<div><h3>FREE-FOR-ALL · FIRST TO ${MODES.ffa.scoreLimit}</h3><table>${head}${all.map(row).join('')}</table></div>`;
  }

  private matchHtml() {
    const t = Math.max(0, Math.ceil(this.timeLeft));
    const clock = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    const lim = MODES[this.cfg.mode].scoreLimit;
    if (this.cfg.mode === 'tdm') {
      const [a, e] = this.teamScore;
      return `<span class="a">ALLIES ${a}</span><div class="bar"><i style="width:${(a / lim) * 100}%;background:${ALLY}"></i></div>
        <span class="clock">${clock}</span><div class="bar"><i style="width:${(e / lim) * 100}%;background:${ENEMY}"></i></div><span class="e">${e} ENEMY</span>`;
    }
    const lead = this.sortedBoard()[0];
    return `<span class="a">YOU ${this.agent.kills}</span><span class="clock">${clock}</span><span class="e">1ST: ${lead.isPlayer ? 'YOU' : lead.name} ${lead.kills}/${lim}</span>`;
  }

  // ------------------------------------------------------------------ frame

  update(dt: number) {
    this.now += dt;
    this.world.now = this.now;
    if (this.phase === 'attract') this.updateAttract(dt);
    else this.updateMatch(dt);

    // character light rides on the camera
    const cam = this.camera;
    this.charLight.position.copy(cam.position);
    this.charLight.target.position.copy(cam.position).add(new THREE.Vector3(0, -0.2, -1).applyQuaternion(cam.quaternion));
    this.charLight.target.updateMatrixWorld();

    this.world.listener.copy(cam.position);
    this.world.listenerYaw = cam.rotation.y;
    for (const b of this.bots) b.update(dt, this.world);
    this.effects.update(dt);
    this.input.endFrame();
  }

  private updateAttract(dt: number) {
    this.orbit += dt * 0.05;
    const cam = this.camera;
    const r = 24 + Math.sin(this.orbit * 0.7) * 4;
    cam.position.set(Math.sin(this.orbit) * r, 8 + Math.sin(this.orbit * 1.3) * 2, Math.cos(this.orbit) * r);
    cam.lookAt(0, 1.5, 0);
    if (Math.abs(cam.fov - 60) > 0.01) {
      cam.fov = 60;
      cam.updateProjectionMatrix();
    }
    cam.updateMatrixWorld();
    this.vm.scene.visible = false;
  }

  private updateMatch(dt: number) {
    const p = this.player;
    const inp = this.input;
    const s = this.settings;
    const live = this.phase === 'match';

    if (live) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.endMatch();
        return;
      }
    }

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

    if (p.alive && live) {
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
      for (let i = 0; i < shots && this.phase === 'match'; i++) this.shoot();
      if (inp.fire && !this.wasFiring && this.gun.ammo === 0 && this.gun.reserve === 0) this.sfx.dryFire();
      this.wasFiring = inp.fire;
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
    const targetFov = lerp(s.fov, s.fov * this.gun.stats.adsFov, this.vm.ads) + (p.sprinting ? 4 : 0);
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

    if (!live) return;

    if (!p.alive) {
      this.respawnT -= dt;
      this.hud.deadScreen(true, `Killed by ${this.killedBy} · respawning in ${Math.max(0, Math.ceil(this.respawnT))}`);
      if (this.respawnT <= 0) this.respawnPlayer();
    }
    if (this.sweepT > 0) this.sweepT -= dt;

    // HUD
    const g = this.gun;
    this.hud.ammo(g.name, g.ammo, g.reserve, g.magSize, g.reloading >= 0);
    const spreadPx = (this.spread() / Math.tan(((cam.fov / 2) * Math.PI) / 180)) * (window.innerHeight / 2);
    this.hud.crosshair(spreadPx, this.vm.ads, !p.alive || p.sprinting);
    this.hud.update(dt, (p.health / p.maxHealth) * 100, (a) => {
      let d = Math.PI - a + p.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      return d;
    });
    const markers: MapMarker[] = [];
    for (const b of this.bots) {
      if (!b.active || !b.alive) continue;
      if (this.isFriendly(b)) markers.push({ x: b.pos.x, z: b.pos.z, color: ALLY });
      else if (this.sweepT > 0 || this.now - b.lastShotT < 1.3) markers.push({ x: b.pos.x, z: b.pos.z, color: ENEMY });
    }
    this.hud.minimap(this.map.boxes, this.map.half, p.pos.x, p.pos.z, p.yaw, markers, this.sweepT > 0 ? 1 : 0);
    this.hud.scoreboard(this.agent.kills, this.agent.deaths, this.streak, this.matchXp);
    this.hud.streakInfo(this.streakHtml());
    this.hud.matchBar(this.matchHtml());
    this.hud.scoreboardTable(inp.down('Tab'), this.boardHtml());
    this.updateTags();
  }

  /** Friendly names always; enemy name only when under the crosshair. */
  private updateTags() {
    const cam = this.camera;
    const tags: { x: number; y: number; text: string; friendly: boolean }[] = [];
    const W = window.innerWidth;
    const H = window.innerHeight;
    const eye = cam.position;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    let aimed: Bot | null = null;
    if (this.player.alive) {
      let best = raycastBoxes(this.map.boxes, eye, fwd, 120)?.t ?? 120;
      for (const b of this.bots) {
        if (!b.active || !b.alive) continue;
        for (const s of b.spheres) {
          const t = raySphere(eye, fwd, s.c, s.r + 0.08);
          if (t > 0 && t < best) {
            best = t;
            aimed = b;
          }
        }
      }
    }
    const v = new THREE.Vector3();
    for (const b of this.bots) {
      if (!b.active || !b.alive) continue;
      const friendly = this.isFriendly(b);
      if (!friendly && b !== aimed) continue;
      v.copy(b.spheres[0].c);
      v.y += 0.32;
      const d = v.distanceTo(eye);
      if (d > 70) continue;
      v.project(cam);
      if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) continue;
      tags.push({ x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H, text: b.name, friendly });
    }
    this.hud.tags(tags);
  }

  render() {
    this.renderer.render(this.scene, this.camera, this.sky, this.vm.scene, this.vm.camera);
  }
}
