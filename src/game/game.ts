import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { HybridRenderer, LAYER_CHAR } from './renderer';
import { buildMap, raycastBoxes, type GameMap } from './map';
import { mapById } from './maps';
import { createMaterials, soldierMaterials } from './materials';
import { buildSoldier } from './soldier';
import { Bot, BOT_NAMES, panFor, raySphere, type BotWorld, type Combatant, type Difficulty } from './bot';
import { Throwables, type ThrowKind } from './throwables';
import { Viewmodel, Gun } from './viewmodel';
import { Player } from './player';
import { Input } from './input';
import { Hud, type MapMarker } from './hud';
import { Sfx } from './audio';
import { Effects } from './effects';
import { cfgFromLoadout, type WeaponCfg } from './weapons';
import { CAMOS, classOf, computeStats, hasGold, hasMastery, isUnlocked, type HitZone, loadClasses, WEAPON_CLASSES, camosFor, MAGS, MUZZLES, OPTICS, SEC_ATTACH, UNDERS, WEAPONS, type Loadout, type PrimaryId, type WeaponId } from './loadout';
import { canPrestige, enterPrestige, grantXp, loadProfile, saveProfile, levelForXp, xpForLevel, XP, MAX_LEVEL, type Profile, type SoldierLook } from './progression';
import { nextUnlock, unlockTrack } from './unlocks';
import { badgeImg, badgeThumb, rankInfo, thumbVersion } from './badges';
import { playerCard } from './cosmetics';
import { bump, bumpMax, checkChallenges } from './challenges';
import { STREAKS, StreakRuntime, streakIcon, type StreakId } from './killstreaks';
import { clamp, damp, lerp } from './util';

export interface Settings {
  sensitivity: number;
  fov: number;
  dither: boolean;
  lowHeight: number;
  volume: number;
  /** music bus, 0..1 */
  music: number;
  unlockAll: boolean;
}

export type Mode = 'tdm' | 'ffa';
export type DifficultyId = 'recruit' | 'regular' | 'hardened' | 'veteran';

export interface MatchConfig {
  mode: Mode;
  difficulty: DifficultyId;
  classIndex: number;
  mapId: string;
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
  level = 1;
  prestige = 0;
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
  private map!: GameMap;
  private hemi = new THREE.HemisphereLight();
  private sun = new THREE.DirectionalLight();
  private amb = new THREE.AmbientLight();
  private vm: Viewmodel;
  private guns: Gun[] = [];
  private active = 0;
  private frags = 1;
  private tacs = 2;
  private throwables!: Throwables<Combatant>;
  private sunDir = new THREE.Vector3(-1, 1, 0).normalize();
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
  private cfg: MatchConfig = { mode: 'tdm', difficulty: 'regular', classIndex: 0, mapId: 'depot' };
  private classes: Loadout[] = loadClasses();
  private classIdx = 0;
  private pendingClass = -1;
  private teamScore = [0, 0];
  private timeLeft = 0;
  private matchXp = 0;
  private streak = 0;
  /** sniper hold-breath meter (1 = full) and sway clock */
  private breath = 1;
  private swayT = 0;
  /** per-match / per-life state behind the challenge counters */
  private ms = Game.freshMatchStats();
  private lifeKills = new Map<number, number>();
  private static freshMatchStats() {
    return {
      headRun: 0,
      lifeWeapons: new Set<string>(),
      stillT: 0,
      lastSprintT: -99,
      crouchTaps: [] as number[],
      spawnT: 0,
      lastKillPos: null as THREE.Vector3 | null,
      killTimes: [] as number[],
      deathTimes: [] as number[],
      deathRun: 0,
      deathsBy: new Map<number, number>(),
      reloaded: false,
      noReloadDone: false,
      sprinted: false,
      trailingAtHalf: false,
      halfChecked: false,
      lowHp: false,
      lastKiller: null as Combatant | null,
      statT: 0,
    };
  }
  /** details of the hit that's about to be registered (for challenge tracking) */
  private killCtx: { preHealth: number; zone: HitZone } | null = null;
  /** multi-kill tracking: time of the last kill and how many in the chain */
  private lastKillT = -99;
  private multi = 0;
  /** earned, unused killstreaks (newest last) */
  private earned: StreakId[] = [];
  private streakRt!: StreakRuntime;
  private crashT = -1;
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
  /** true while the class picker is up at match start */
  choosingClass = false;
  /** pre-match sequence: class pick -> camera zoom -> 6s countdown -> live */
  private pregame: 'off' | 'choose' | 'zoom' | 'countdown' = 'off';
  private pregameT = 0;
  private lastCount = 0;
  private zoomFrom = new THREE.Vector3();
  private zoomQuat = new THREE.Quaternion();
  private zoomFov = 60;
  /** TDM start sides: axis and which end team 0 starts at */
  private sideAxis: 'x' | 'z' = 'x';
  private sideSign = 1;
  /** main.ts locks the pointer once a class is picked */
  onClassChosen: () => void = () => {};
  paused = false;
  settings: Settings;
  /** shared with the create-a-class preview */
  materials!: ReturnType<typeof createMaterials>;
  envMap!: THREE.Texture;
  private get gun() {
    return this.guns[this.active];
  }

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
    for (const l of [this.hemi, this.sun, this.amb]) {
      l.layers.enableAll();
      this.scene.add(l);
    }
    // sun shadows follow the action; soldiers, grenades and world geometry cast
    const sh = this.sun.shadow;
    this.sun.castShadow = true;
    sh.mapSize.set(2048, 2048);
    sh.camera.left = -24;
    sh.camera.right = 24;
    sh.camera.top = 24;
    sh.camera.bottom = -24;
    sh.camera.near = 1;
    sh.camera.far = 110;
    sh.camera.layers.enable(LAYER_CHAR);
    sh.bias = -0.0004;
    sh.normalBias = 0.03;
    this.scene.add(this.sun.target);
    // a camera-mounted light that only touches characters, so soldiers read clearly
    this.charLight.layers.set(LAYER_CHAR);
    this.scene.add(this.charLight, this.charLight.target);

    this.loadMap('depot');
    this.effects = new Effects(this.scene);
    const mats = createMaterials();
    this.materials = mats;
    this.envMap = env;
    this.vm = new Viewmodel(mats, env);
    this.guns = [new Gun(computeStats(this.classes[0])), new Gun(computeStats(this.classes[0], 'secondary'))];
    this.throwables = new Throwables<Combatant>(this.scene, mats);
    this.streakRt = new StreakRuntime({
      scene: this.scene,
      mats,
      effects: this.effects,
      sfx: this.sfx,
      now: () => this.now,
      playerFeet: () => this.player.pos.clone(),
      playerYaw: () => this.player.yaw,
      playerAlive: () => this.player.alive,
      enemies: () => this.bots.filter((b) => b.active && b.alive && this.hostile(this.agent, b)),
      clear: (a, b) => {
        const d = b.clone().sub(a);
        const len = d.length();
        return !raycastBoxes(this.map.boxes, a, d.divideScalar(len), len);
      },
      explode: (pos, label, radius, damage) => this.explode(pos, this.agent, radius, damage, label),
      shoot: (from, bot, damage, label) => {
        this.effects.tracer(from, bot.spheres[1].c);
        this.effects.blood(bot.spheres[1].c, bot.spheres[1].c.clone().sub(from).normalize(), false);
        if (bot.damage(damage, this.agent, this.now)) this.registerKill(this.agent, bot, false, STREAKS[label].name, `streak_${label}`);
      },
      pan: (pos) => ({ dist: pos.distanceTo(this.camera.position), pan: panFor(pos, this.camera.position, this.camera.rotation.y) }),
      resupply: () => this.resupply(),
    });

    const sm = soldierMaterials(mats);
    this.soldierMats = sm;
    const opt = ['iron', 'reflex', 'holo'] as const;
    const looks: SoldierLook[] = [
      { uniform: 'desert', gear: 'coyote', head: 'nvg' },
      { uniform: 'woodland', gear: 'ranger', head: 'helmet' },
    ];
    // bots carry assault rifles mostly, plus SMGs, LMGs and marksman rifles for variety
    const botGuns: PrimaryId[] = ['kr4', 'vk47', 'vx9', 'lm5', 'sk10'];
    for (const variant of [0, 1] as const) {
      for (const weapon of botGuns) {
        const cfg: WeaponCfg = { weapon, optic: opt[(variant + botGuns.indexOf(weapon)) % 3], muzzle: 'none', under: weapon === 'kr4' ? 'grip' : 'none', mag: 'std', camo: 'none' };
        const t = buildSoldier(sm, looks[variant], cfg);
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
      smokeBlocks: (a, b) => this.throwables.smokeBlocks(a, b),
      throwFrag: (bot, at) => {
        const from = bot.eye(new THREE.Vector3());
        this.throwables.throw('frag', from, Throwables.lob(from, at), bot);
      },
    };

    this.applySettings();
    this.startAttract();
  }

  applySettings() {
    const s = this.settings;
    this.renderer.lowHeight = s.lowHeight;
    this.renderer.setDither(s.dither);
    this.sfx.setVolume(s.volume);
    this.sfx.setMusicVolume(s.music);
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

  /** Live profile for the menu (callsign, banner, look); call saveProfileNow after edits. */
  get profileData() {
    return this.profile;
  }

  saveProfileNow() {
    saveProfile(this.profile);
  }

  /** Mark challenges finished by derived stats (level, camos) without in-match banners; for the menu. */
  syncChallenges() {
    if (this.phase === 'match') return;
    this.runChallenges();
    this.hud.clearBanners();
    saveProfile(this.profile);
  }

  get prestigeReady() {
    return canPrestige(this.profile);
  }

  prestige() {
    const ok = enterPrestige(this.profile);
    if (ok) {
      this.runChallenges();
      this.hud.clearBanners(); // in the menu: the Challenges page shows what completed
      saveProfile(this.profile);
      this.sfx.levelUp();
    }
    return ok;
  }

  /** Soldier-only PBR materials (rim lit), shared with the menu preview. */
  soldierMats!: ReturnType<typeof createMaterials>;

  /** Swap the arena: rebuild geometry, nav grid, sky, fog and lighting. */
  loadMap(id: string) {
    if (this.map?.id === id) return;
    this.map?.dispose();
    const def = mapById(id);
    this.map = buildMap(this.scene, def);
    if (this.world) this.world.map = this.map;
    const t = def.theme;
    const fog = this.scene.fog as THREE.Fog;
    fog.color.setHex(t.fog[0]);
    fog.near = t.fog[1];
    fog.far = t.fog[2];
    this.hemi.color.setHex(t.hemi[0]);
    this.hemi.groundColor.setHex(t.hemi[1]);
    this.hemi.intensity = t.hemi[2];
    this.sun.color.setHex(t.sun[0]);
    this.sun.intensity = t.sun[1];
    this.sun.position.set(t.sun[2], t.sun[3], t.sun[4]);
    this.sunDir.set(t.sun[2], t.sun[3], t.sun[4]).normalize();
    this.amb.color.setHex(t.ambient[0]);
    this.amb.intensity = t.ambient[1];
    this.effects?.clear();
    this.throwables?.clear();
  }

  get mapId() {
    return this.map.id;
  }

  // ------------------------------------------------------------------ phases

  /** Menu background: bots fight each other while the camera orbits. */
  startAttract() {
    this.throwables.clear();
    this.streakRt.clear();
    this.hud.clearOverlays();
    this.sfx.music('menu');
    this.phase = 'attract';
    this.choosingClass = false;
    this.pregame = 'off';
    this.hud.countdown(null);
    this.hud.classPicker(null);
    this.player.alive = false;
    this.hud.setVisible(false);
    this.hud.endScreen(null);
    this.hud.clearBanners();
    this.vm.cancelThrow();
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
    this.throwables.clear();
    this.loadMap(cfg.mapId);
    this.cfg = cfg;
    this.classes = classes;
    this.classIdx = cfg.classIndex;
    this.pendingClass = -1;
    this.phase = 'match';
    this.teamScore = [0, 0];
    this.timeLeft = MODES[cfg.mode].minutes * 60;
    this.matchXp = 0;
    this.sfx.music('match');
    this.hud.clearOverlays();
    this.ms = Game.freshMatchStats();
    this.lifeKills.clear();
    bump(this.profile, `played_${cfg.mapId}`);
    this.streak = 0;
    this.multi = 0;
    this.lastKillT = -99;
    this.earned = [];
    this.crashT = -1;
    this.streakRt.clear();
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
      const pool = this.templates.filter((t) => t.userData.variant === variant);
      // weight the rifles: half the bots get one, the rest spread over the others
      const rifles = pool.filter((t) => WEAPONS[t.userData.weapon as WeaponId].cls === 'ar');
      b.dress(Math.random() < 0.5 ? rifles[Math.floor(Math.random() * rifles.length)] : pool[Math.floor(Math.random() * pool.length)]);
      // flavour ranks for the scoreboard
      b.prestige = Math.random() < 0.25 ? 1 + Math.floor(Math.random() * 4) : 0;
      b.level = 1 + Math.floor(Math.random() * MAX_LEVEL);
      this.world.combatants.push(b);
    });
    // rasterise scoreboard badges now so the first Tab press doesn't stall
    for (const c of this.world.combatants) badgeThumb(c.level, c.prestige, 30);
    // each match picks fresh start sides so the opening fight moves around the map
    this.sideAxis = Math.random() < 0.5 ? 'x' : 'z';
    this.sideSign = Math.random() < 0.5 ? 1 : -1;
    for (const b of this.bots) {
      const p = this.startSpawn(b);
      b.spawn(p, Math.atan2(-p.x, -p.z));
    }
    this.player.alive = false;
    this.choosingClass = true;
    this.pregame = 'choose';
    this.hud.countdown(null);
    this.refreshHud();
    this.hud.setVisible(true);
    this.hud.classPicker(this.classCards(), (i) => this.chooseClass(i), 'CHOOSE CLASS', `${MODES[cfg.mode].label} · ${mapById(cfg.mapId).name} · ${DIFFICULTIES[cfg.difficulty].label} BOTS`);
  }

  private classCards(): [string, string][] {
    return this.classes.map((c) => {
      const s = computeStats(c);
      const opt = { iron: 'Iron sights', reflex: 'Reflex', holo: 'Holographic', acog: '4x scope', sniper: 'Sniper scope' }[c.optic];
      const extras = [opt, c.muzzle === 'suppressor' ? 'Suppressor' : '', c.under === 'grip' ? 'Foregrip' : ''].filter(Boolean).join(' · ');
      return [c.name, `${s.name} · ${WEAPONS[c.secondary].name}<br>${extras}`];
    });
  }

  /** Pick from the start-of-match picker and drop in. */
  chooseClass(i: number) {
    if (!this.choosingClass || !this.classes[i]) return;
    this.choosingClass = false;
    this.classIdx = i;
    this.pendingClass = -1;
    this.hud.classPicker(null);
    this.applyClass(i);
    const p = this.startSpawn(this.agent);
    this.player.spawn(p, Math.atan2(p.x, p.z));
    this.vm.reload = -1;
    this.vm.cancelThrow();
    // fly the overview camera down into the player's eyes
    this.pregame = 'zoom';
    this.pregameT = 0;
    this.zoomFrom.copy(this.camera.position);
    this.zoomQuat.copy(this.camera.quaternion);
    this.zoomFov = this.camera.fov;
    this.sfx.uiSelect();
    this.onClassChosen();
  }

  /** Opening positions: TDM teams start at opposite ends, FFA spreads everyone out. */
  private startSpawn(c: Combatant): THREE.Vector3 {
    const half = this.map.half;
    const others = this.world.combatants.filter((o) => o !== c && o.alive);
    let best = this.map.nav.randomWalkable();
    let bestGap = -1;
    for (let tries = 0; tries < 40; tries++) {
      let x: number;
      let z: number;
      if (this.cfg.mode === 'tdm') {
        const side = (c.team === this.agent.team ? 1 : -1) * this.sideSign;
        const along = side * half * (0.55 + Math.random() * 0.33);
        const across = (Math.random() * 2 - 1) * half * 0.75;
        [x, z] = this.sideAxis === 'x' ? [along, across] : [across, along];
      } else {
        x = (Math.random() * 2 - 1) * half * 0.85;
        z = (Math.random() * 2 - 1) * half * 0.85;
      }
      const cell = this.map.nav.nearestWalkable(x, z);
      if (!cell) continue;
      const p = this.map.nav.center(cell[0], cell[1]);
      let gap = 99;
      for (const o of others) gap = Math.min(gap, Math.hypot(o.pos.x - p.x, o.pos.z - p.z));
      const want = this.cfg.mode === 'tdm' ? 2.5 : 10;
      if (gap >= want) return p;
      if (gap > bestGap) {
        bestGap = gap;
        best = p;
      }
    }
    return best;
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

  /** Perk and weapon weight both scale move speed. */
  private updateMove() {
    const l = this.classes[this.classIdx];
    this.player.speedMult = (l.perk1 === 'fleet' ? 1.1 : 1) * this.gun.stats.move;
  }

  private applyClass(idx: number) {
    this.classIdx = idx;
    const l = this.classes[idx];
    // a camo that isn't earned (old saves had level-based camos) falls back to factory
    const camoOk = (w: WeaponId, id: string) => {
      const c = camosFor(w).find((o) => o.id === id);
      const heads = this.profile.weaponHeads;
      return !!c && isUnlocked(c, { level: 1, kills: 0, heads: heads[w] ?? 0, allHeads: heads, all: this.settings.unlockAll });
    };
    if (!camoOk(l.weapon, l.camo)) l.camo = 'none';
    if (!camoOk(l.secondary, l.secCamo)) l.secCamo = 'none';
    const stats = computeStats(l);
    this.guns[0].reset(stats);
    this.guns[1].reset(computeStats(l, 'secondary'));
    this.active = 0;
    this.vm.equip(cfgFromLoadout(l), stats.eyeDist, stats.recoil);
    this.frags = l.perk1 === 'pockets' ? 2 : 1;
    this.tacs = 2;
    this.player.maxHealth = l.perk2 === 'tough' ? 130 : 100;
    this.updateMove();
  }

  private endMatch() {
    this.phase = 'ended';
    this.sfx.music('menu');
    this.player.alive = false;
    this.vm.cancelThrow();
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
    const won = this.cfg.mode === 'tdm' ? this.teamScore[0] > this.teamScore[1] : rows[0] === this.agent;
    const pr = this.profile;
    const m = this.ms;
    bump(pr, 'matches');
    bumpMax(pr, 'best_match_kills', this.agent.kills);
    bumpMax(pr, 'best_match_score', this.agent.kills * 100);
    if (rows[0] === this.agent) bump(pr, 'top_finishes');
    if (this.agent.deaths === 0) bump(pr, 'deathless');
    if (m.lastKiller === this.agent) bump(pr, 'final_kills');
    if (won) {
      bump(pr, 'wins');
      bump(pr, `${this.cfg.mode}_wins`);
      bump(pr, `win_${this.cfg.mapId}`);
      bump(pr, `win_${this.cfg.difficulty}`);
      if (this.agent.deaths === 0) bump(pr, 'flawless');
      if (rows[0] === this.agent) bump(pr, 'mvp');
      if (m.trailingAtHalf) bump(pr, 'comebacks');
      if (this.agent.deaths >= 9) bump(pr, 'nine_lives');
      if (!m.sprinted) bump(pr, 'nosprint_wins');
      if (new Date().getHours() < 5) bump(pr, 'night_wins');
      if (m.lastKiller === this.agent) bump(pr, 'final_kill_wins');
      const margin = this.cfg.mode === 'tdm' ? this.teamScore[0] - this.teamScore[1] : this.agent.kills - (rows[1]?.kills ?? 0);
      if (margin >= 10) bump(pr, 'blowouts');
      pr.stats.loss_now = 0;
    } else {
      bump(pr, 'loss_now');
      bumpMax(pr, 'loss_run', pr.stats.loss_now);
    }
    this.addXp(bonus, before);
    const kd = this.agent.deaths ? (this.agent.kills / this.agent.deaths).toFixed(2) : String(this.agent.kills);
    this.hud.endScreen(
      `${playerCard(this.profile)}<div class="t ${cls}">${title}</div>
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

  /**
   * Mid-match respawn: score candidate points by distance from enemies,
   * sight lines, crowding and (TDM) closeness to teammates, then pick at
   * random from the best few so spawns don't become predictable.
   */
  private pickSpawn(c: Combatant): THREE.Vector3 {
    const cands = [...this.map.spawns];
    for (let i = 0; i < 24; i++) cands.push(this.map.nav.randomWalkable());
    const eyeTmp = new THREE.Vector3();
    const scored: [THREE.Vector3, number][] = [];
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
      let score = Math.min(minHostile, 35) - (seen ? 30 : 0) - (blocked ? 100 : 0) - (minHostile < 12 ? 25 : 0) + Math.random() * 6;
      if (this.cfg.mode === 'tdm' && this.phase === 'match') score -= Math.max(0, minFriend - 6) * 0.35;
      scored.push([p, score]);
    }
    scored.sort((a, b) => b[1] - a[1]);
    const top = scored.slice(0, 4);
    return top[Math.floor(Math.random() * top.length)][0].clone();
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
    this.ms.spawnT = this.now;
    this.ms.lifeWeapons.clear();
    this.ms.stillT = 0;
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
      this.damagePlayer(dmg, shooter, shooter.pos);
      return;
    }
    const tb = target as Bot;
    this.effects.blood(tb.spheres[head ? 0 : 1].c, dir, head);
    if (tb.damage(dmg, shooter, this.now)) this.registerKill(shooter, tb, head);
  }

  /** Start the throw animation; the grenade leaves the hand partway through. */
  private throwItem(kind: ThrowKind) {
    this.gun.cancelReload();
    this.vm.throwAnim(
      kind,
      () => this.sfx.pin(),
      () => {
        if (this.phase === 'match' && this.player.alive) this.releaseThrow(kind);
      },
    );
  }

  private releaseThrow(kind: ThrowKind) {
    const cam = this.camera;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    const from = cam.position.clone().addScaledVector(fwd, 0.4).addScaledVector(right, 0.15).add(new THREE.Vector3(0, -0.1, 0));
    const vel = fwd.multiplyScalar(kind === 'frag' ? 17 : 15).add(new THREE.Vector3(0, 3, 0)).addScaledVector(this.player.vel, 0.5);
    this.throwables.throw(kind, from, vel, this.agent);
  }

  /**
   * An explosion owned by `owner`. Frags hurt their owner too; killstreak ordnance
   * (label other than 'frag') only hurts the owner's enemies.
   */
  private explode(pos: THREE.Vector3, owner: Combatant, radius: number, damage: number, label: string) {
    const cam = this.camera.position;
    const dist = pos.distanceTo(cam);
    this.effects.explosion(pos);
    this.sfx.explosion(dist, panFor(pos, cam, this.camera.rotation.y));
    if (this.player.alive) this.punch += Math.max(0, 0.12 * (1 - dist / 18));
    const frag = label === 'frag';
    const tmp = new THREE.Vector3();
    const from = pos.clone().setY(pos.y + 0.3);
    let kills = 0;
    for (const c of [...this.world.combatants]) {
      if (!c.alive) continue;
      if (c === owner ? !frag : !this.hostile(owner, c)) continue;
      const center = tmp.copy(c.pos).setY(c.pos.y + 0.9);
      const d = center.distanceTo(pos);
      if (d > radius) continue;
      const dir = center.clone().sub(from);
      const len = dir.length();
      if (raycastBoxes(this.map.boxes, from, dir.divideScalar(len), len)) continue;
      const dmg = damage * Math.pow(1 - d / radius, 1.1);
      const name = frag ? 'FRAG' : STREAKS[label as StreakId].name;
      if (c.isPlayer) this.damagePlayer(dmg, owner, pos, name);
      else if ((c as Bot).damage(dmg, owner, this.now)) {
        kills++;
        this.registerKill(owner, c, false, name, frag ? 'frag' : `streak_${label}`);
      }
    }
    if (owner === this.agent && kills) {
      bump(this.profile, 'explosive_kills', kills);
      if (kills >= 2) bump(this.profile, 'explosive_multi');
      bumpMax(this.profile, 'explosive_best', kills);
      if (frag && kills >= 3) bump(this.profile, 'frag_triple');
    }
  }

  /** Supply drop pickup: full ammo on both guns, an extra frag and tactical, maybe a bonus streak. */
  private resupply() {
    for (const g of this.guns) {
      g.ammo = g.magSize;
      g.reserve = g.stats.reserve;
    }
    this.frags = Math.min(this.frags + 1, 3);
    this.tacs = Math.min(this.tacs + 1, 3);
    bump(this.profile, 'packages');
    this.sfx.streak();
    const bonus = Math.random() < 0.25 ? (['sweep', 'mortar', 'sentry'] as StreakId[])[Math.floor(Math.random() * 3)] : null;
    if (bonus) {
      this.earned.push(bonus);
      this.hud.streakEarned(STREAKS[bonus].name, streakIcon(bonus, 72), 'BONUS FROM SUPPLY DROP');
      this.sfx.streakReady();
    } else this.hud.showBanner('RESUPPLIED', 'FULL AMMO · +1 FRAG · +1 TACTICAL', 2.5);
  }

  /** System Crash: glitch the screen, then every enemy drops and the match ends. */
  private systemCrash() {
    this.crashT = 0;
    this.sfx.systemCrash();
    this.hud.glitch(true);
    bump(this.profile, 'crash_used');
  }

  private updateCrash(dt: number) {
    const before = this.crashT;
    this.crashT += dt;
    if (before < 1.8 && this.crashT >= 1.8 && this.phase === 'match') {
      for (const b of this.bots) {
        if (!b.active || !b.alive || !this.hostile(this.agent, b)) continue;
        b.damage(9999, this.agent, this.now);
        if (this.phase === 'match') this.registerKill(this.agent, b, false, 'SYSTEM CRASH', 'streak_crash');
      }
      if (this.phase === 'match') {
        if (this.cfg.mode === 'tdm') this.teamScore[0] = Math.max(this.teamScore[0], this.teamScore[1] + 1);
        else this.agent.kills = Math.max(this.agent.kills, ...this.world.combatants.map((c) => c.kills + (c.isPlayer ? 0 : 1)));
        this.endMatch();
      }
    }
    if (this.crashT > 3.2) {
      this.crashT = -1;
      this.hud.glitch(false);
    }
  }

  /** Grenade went off: damage, stun or smoke. */
  private detonate(kind: ThrowKind, pos: THREE.Vector3, owner: Combatant) {
    const cam = this.camera.position;
    const dist = pos.distanceTo(cam);
    const pan = panFor(pos, cam, this.camera.rotation.y);
    const lineClear = (to: THREE.Vector3) => {
      const from = pos.clone().setY(pos.y + 0.3);
      const dir = to.clone().sub(from);
      const len = dir.length();
      return !raycastBoxes(this.map.boxes, from, dir.divideScalar(len), len);
    };
    const tmp = new THREE.Vector3();
    if (kind === 'smoke') {
      this.sfx.smokePop(dist, pan);
      return;
    }
    if (kind === 'frag') {
      this.explode(pos, owner, 7, 170, 'frag');
      return;
    }
    // stun
    this.effects.stunFlash(pos);
    this.sfx.stunBang(dist, pan);
    for (const b of this.bots) {
      if (!b.active || !b.alive || (b !== owner && !this.hostile(owner, b))) continue;
      const d = b.eye(tmp).distanceTo(pos);
      if (d < 10 && lineClear(b.eye(tmp))) {
        b.stunnedUntil = this.now + 1 + 3 * (1 - d / 10);
        if (owner === this.agent && b !== owner) bump(this.profile, 'stunned_enemies');
      }
    }
    if (this.player.alive) {
      const d = cam.distanceTo(pos);
      if (d < 10 && lineClear(cam.clone())) {
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        const facing = Math.max(0, fwd.dot(pos.clone().sub(cam).normalize()));
        this.hud.flash((1 - d / 10) * (0.35 + 0.65 * facing));
      }
    }
  }

  private nameHtml(c: Combatant) {
    if (c.isPlayer) return `<span class="you">YOU</span>`;
    return this.isFriendly(c) ? `<span style="color:${ALLY}">${c.name}</span>` : `<span class="enemy">${c.name}</span>`;
  }

  /**
   * `weapon` is the kill-feed label; `src` the stat key for player kills
   * (a weapon id, 'frag', 'melee' or 'streak_<id>'; defaults to the held gun).
   */
  private registerKill(killer: Combatant, victim: Combatant, head: boolean, weapon?: string, src?: string) {
    killer.kills++;
    victim.deaths++;
    if (this.phase !== 'match') return;
    if (this.cfg.mode === 'tdm') this.teamScore[killer.team === this.agent.team ? 0 : 1]++;
    const wpn = weapon ?? (killer.isPlayer ? this.gun.stats.name.split(' ')[0] : WEAPONS[(killer as Bot).weapon].name.split(' ')[0]);
    this.hud.killfeed(`${this.nameHtml(killer)} [${wpn}]${head ? ' ⌖' : ''} ${this.nameHtml(victim)}`);
    this.onAnyKill(killer, victim);
    if (killer.isPlayer) this.onPlayerKill(victim, head, src ?? (weapon === 'FRAG' ? 'frag' : this.gun.stats.weapon));
    const lim = MODES[this.cfg.mode].scoreLimit;
    const top = this.cfg.mode === 'tdm' ? Math.max(...this.teamScore) : Math.max(...this.world.combatants.map((c) => c.kills));
    if (top >= lim) this.endMatch();
  }

  private damagePlayer(dmg: number, from: Combatant, at: THREE.Vector3, weapon?: string) {
    const p = this.player;
    if (!p.alive || this.phase !== 'match') return;
    p.health -= dmg;
    p.lastHit = this.now;
    const blast = weapon === 'FRAG' || Object.values(STREAKS).some((s) => s.name === weapon);
    if (blast && p.health > 0 && p.health / p.maxHealth < 0.2) bump(this.profile, 'explosion_survivals');
    this.punch += 0.02;
    this.hud.damageFrom(Math.atan2(at.x - p.pos.x, at.z - p.pos.z));
    this.sfx.hurt();
    if (p.health <= 0) {
      p.health = 0;
      p.alive = false;
      // killed mid-throw with the pin out: the grenade drops where you stood
      const cooked = this.vm.cancelThrow();
      if (cooked) this.throwables.throw(cooked, this.camera.position.clone().setY(p.pos.y + 1), new THREE.Vector3(0, 1, 0), this.agent);
      this.profile.deaths++;
      const m = this.ms;
      m.deathRun++;
      bumpMax(this.profile, 'death_run', m.deathRun);
      m.deathTimes.push(this.now);
      bumpMax(this.profile, 'deaths_30s', m.deathTimes.filter((t) => this.now - t <= 30).length);
      m.headRun = 0;
      this.streak = 0;
      this.respawnT = 3.5;
      this.deathCam = 0;
      saveProfile(this.profile);
      if (from === this.agent) {
        // own grenade: a death, but nobody scores
        this.killedBy = 'YOUR OWN FRAG';
        this.agent.deaths++;
        this.hud.killfeed(`<span class="you">YOU</span> [FRAG] ✸`);
      } else {
        this.killedBy = from.name;
        this.registerKill(from, this.agent, false, weapon);
      }
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
    const wall = wHit ? wHit.t : 200;
    // every body on the line of fire, nearest first (sniper rounds carry on through one)
    const hits: { bot: Bot; t: number; zone: HitZone }[] = [];
    for (const b of this.bots) {
      if (!b.active || !b.alive) continue;
      let bt = wall;
      let zone: HitZone | null = null;
      for (const s of b.spheres) {
        const t = raySphere(eye, dir, s.c, s.r);
        if (t > 0 && t < bt) {
          bt = t;
          zone = s.zone;
        }
      }
      if (zone) hits.push({ bot: b, t: bt, zone });
    }
    hits.sort((x, y) => x.t - y.t);
    const pierce = this.gun.stats.cls === 'sniper' ? 2 : 1;
    const struck = hits.slice(0, pierce);
    const best = struck.length ? struck[struck.length - 1].t : wall;
    const end = eye.clone().addScaledVector(dir, best);
    bump(this.profile, 'shots_fired');
    const muzzle = eye.clone().addScaledVector(fwd, 0.6).addScaledVector(right, 0.12 * (1 - this.vm.ads)).addScaledVector(up, -0.1 * (1 - this.vm.ads * 0.6));
    const st = this.gun.stats;
    if (!st.suppressed && Math.random() < 0.5) this.effects.tracer(muzzle, end);
    if (!st.suppressed) this.effects.muzzle(muzzle);

    let shotKills = 0;
    struck.forEach((h, i) => {
      if (this.isFriendly(h.bot)) return;
      const head = h.zone === 'head';
      const dmg = this.gun.stats.zoneDamage(h.zone, h.t) * (i > 0 ? 0.8 : 1);
      this.killCtx = { preHealth: h.bot.health, zone: h.zone };
      const killed = h.bot.damage(dmg, this.agent, this.now);
      this.effects.blood(eye.clone().addScaledVector(dir, h.t), dir, head);
      this.hud.hitmarker(killed, head);
      if (head) this.sfx.headshot(killed);
      else this.sfx.hitmarker(killed);
      if (killed) {
        shotKills++;
        this.registerKill(this.agent, h.bot, head);
      }
    });
    if (shotKills >= 2) bump(this.profile, 'collaterals');
    if (!struck.length && wHit) this.effects.impact(wHit.point, wHit.normal, wHit.surface);

    const adsK = lerp(1, 0.65, this.vm.ads) * st.recoil;
    this.player.pitch += (0.006 + Math.random() * 0.003) * adsK;
    this.player.yaw += (Math.random() - 0.45) * 0.005 * adsK;
    this.punch += 0.01 * adsK;
    this.bloom = Math.min(this.bloom + 0.007 * st.recoil, 0.06);
    this.vm.fire();
    if (st.bolt) {
      const secs = (60 / st.rpm) * 0.85;
      this.vm.cycleBolt(secs);
      this.sfx.boltCycle(secs);
    }
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

  /** Camo progression: headshot kills per weapon, gold, then class mastery. */
  private onWeaponHeadshot(id: WeaponId) {
    const heads = this.profile.weaponHeads;
    const cls = classOf(id);
    const masteredBefore = hasMastery(heads, cls);
    const n = (heads[id] ?? 0) + 1;
    heads[id] = n;
    const camo = CAMOS.find((c) => c.heads === n);
    if (camo) this.hud.showBanner(camo.id === 'gold' ? 'GOLD CAMO' : 'CAMO UNLOCKED', `${camo.name} FOR ${WEAPONS[id].name}`, 4);
    if (!masteredBefore && hasMastery(heads, cls)) {
      const wc = WEAPON_CLASSES[cls];
      this.hud.showBanner('MASTERY CAMO', `${wc.camo.name} · ${wc.name}`, 5);
      this.sfx.levelUp();
    }
  }

  /** Challenge counters for one player kill, read from the player's state at the moment of the kill. */
  private trackKill(victim: Combatant, head: boolean, src: string) {
    const pr = this.profile;
    const p = this.player;
    const m = this.ms;
    const now = this.now;
    const gunId = WEAPONS[src as WeaponId] ? (src as WeaponId) : null;
    const st = this.gun.stats;
    const vb = victim.isPlayer ? null : (victim as Bot);
    const ctx = this.killCtx;
    this.killCtx = null;
    bump(pr, 'kills');
    if (head) {
      bump(pr, 'headshots');
      m.headRun++;
      bumpMax(pr, 'head_run', m.headRun);
    } else m.headRun = 0;
    if (gunId) {
      const cls = WEAPONS[gunId].cls;
      bump(pr, `kills_${gunId}`);
      bump(pr, `kills_cls_${cls}`);
      bump(pr, this.vm.ads > 0.5 ? 'ads_kills' : 'hip_kills');
      if (st.suppressed) bump(pr, 'suppressed_kills');
      if (this.classes[this.classIdx].under === 'laser' && this.active === 0) bump(pr, 'laser_kills');
      if (hasGold(pr.weaponHeads, gunId)) bump(pr, 'gold_kills');
      if (cls === 'sniper' && this.vm.ads < 0.3) bump(pr, 'noscope_kills');
      if (cls === 'sniper' && p.speed > 1) bump(pr, 'sniper_move_kills');
      if (cls === 'smg' && victim.pos.distanceTo(p.pos) < 10) bump(pr, 'smg_close_kills');
      if (victim.pos.distanceTo(p.pos) > 35) bump(pr, 'longshots');
      if (this.throwables.smokeBlocks(this.camera.position, victim.pos.clone().setY(victim.pos.y + 1.3))) bump(pr, 'smoke_kills');
    }
    if (src === 'frag') bump(pr, 'frag_kills');
    if (src.startsWith('streak_')) {
      bump(pr, 'streak_kills');
      bump(pr, `kills_${src}`);
      const id = src.slice(7) as StreakId;
      if (STREAKS[id]?.air) bump(pr, 'air_streak_kills');
    }
    if (src === 'melee') bump(pr, 'melee_kills');
    m.lifeWeapons.add(gunId ? (this.active === 0 ? 'primary' : 'secondary') : src.startsWith('streak_') ? 'streak' : src);
    if (m.lifeWeapons.size >= 3) bump(pr, 'meal_deal');
    // body state at the moment of the kill
    if (p.slide > 0) bump(pr, 'slide_kills');
    else if (p.crouchT > 0.5) bump(pr, 'crouch_kills');
    if (!p.onGround) bump(pr, 'air_kills');
    if (p.speed < 0.3) bump(pr, 'still_kills');
    if (m.stillT >= 10) bump(pr, 'afk_kills');
    if (now - m.lastSprintT < 1) bump(pr, 'sprint_kills');
    if (m.crouchTaps.filter((t) => now - t < 2).length >= 3) bump(pr, 'crouchspam_kills');
    if (now - p.lastHit < 2) bump(pr, 'reflex_kills');
    if (now - m.spawnT < 3) bump(pr, 'spawn3_kills');
    if (now - m.spawnT < 5) bump(pr, 'spawn5_kills');
    const hp = (p.health / p.maxHealth) * 100;
    if (hp < 10) bump(pr, 'low_hp_kills');
    if (hp < 5) bump(pr, 'clutch_kills');
    if (this.sweepT > 0) bump(pr, 'sweep_kills');
    if (m.lastKillPos && m.lastKillPos.distanceTo(p.pos) < 4) bump(pr, 'camp_kills');
    m.lastKillPos = p.pos.clone();
    // the victim's side of it
    if (victim.name === this.killedBy) bump(pr, 'paybacks');
    if (vb) {
      if (vb.stunnedUntil > now) bump(pr, 'stunned_kills');
      if (vb.currentTarget !== this.agent) bump(pr, 'ambush_kills');
      // facing away: the victim's forward points away from us
      const fwd = new THREE.Vector3(Math.sin(vb.yaw), 0, Math.cos(vb.yaw));
      const toUs = p.pos.clone().sub(vb.pos).setY(0).normalize();
      if (fwd.dot(toUs) < 0.2) {
        bump(pr, 'flank_kills');
        if (src === 'melee') bump(pr, 'melee_back');
      }
      if (src === 'melee' && now - p.lastHit < 3) bump(pr, 'melee_trades');
      if (ctx && ctx.preHealth < 50) bump(pr, 'finisher_kills');
      // someone else on our team softened them up
      if (this.cfg.mode === 'tdm' && [...vb.hurtBy.entries()].some(([id, t]) => id !== this.agent.id && now - t < 5)) bump(pr, 'steals');
      if ((this.lifeKills.get(vb.id) ?? 0) >= 3) bump(pr, 'buzzkills');
    }
    if (this.world.combatants.reduce((s, c) => s + c.kills, 0) === 1) bump(pr, 'first_bloods');
    // bursts
    this.multi = now - this.lastKillT < 3 ? this.multi + 1 : 1;
    if (now - this.lastKillT < 2) bump(pr, 'quick_doubles');
    this.lastKillT = now;
    if (this.multi === 2) bump(pr, 'double');
    if (this.multi === 3) bump(pr, 'triple');
    m.killTimes.push(now);
    bumpMax(pr, 'kills_30s', m.killTimes.filter((t) => now - t <= 30).length);
    bumpMax(pr, 'kills_10s', m.killTimes.filter((t) => now - t <= 10).length);
    const s = this.streak + 1;
    if (s === 3) bump(pr, 'streak3');
    if (s === 5) bump(pr, 'streak5');
    if (s === 10) bump(pr, 'streak10');
    m.deathRun = 0;
    if (!m.reloaded && this.agent.kills >= 15 && !m.noReloadDone) {
      m.noReloadDone = true;
      bump(pr, 'no_reload_15');
    }
  }

  /** Time-based challenge counters. */
  private trackFrame(dt: number) {
    const pr = this.profile;
    const p = this.player;
    const m = this.ms;
    bump(pr, 'time_played', dt);
    if (!p.alive) return;
    if (p.crouchT > 0.5) bump(pr, 'crouch_time', dt);
    if (p.sprinting) {
      bump(pr, 'sprint_m', p.speed * dt);
      m.lastSprintT = this.now;
      m.sprinted = true;
    }
    m.stillT = p.speed < 0.3 ? m.stillT + dt : 0;
    if (this.input.pressed.has('KeyC')) m.crouchTaps = [...m.crouchTaps.filter((t) => this.now - t < 2), this.now];
    const hp = p.health / p.maxHealth;
    if (hp < 0.1) m.lowHp = true;
    else if (m.lowHp && hp >= 0.99) {
      m.lowHp = false;
      bump(pr, 'clutch_survivals');
    }
    if (!m.halfChecked && this.timeLeft <= (MODES[this.cfg.mode].minutes * 60) / 2) {
      m.halfChecked = true;
      m.trailingAtHalf = this.cfg.mode === 'tdm' ? this.teamScore[0] < this.teamScore[1] : this.sortedBoard()[0] !== this.agent;
    }
  }

  /** Gun-butt melee: kills anything in reach in front of you. */
  private melee() {
    this.vm.melee();
    const eye = this.camera.position;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).setY(0).normalize();
    let hit: Bot | null = null;
    let best = 2.3;
    for (const b of this.bots) {
      if (!b.active || !b.alive || !this.hostile(this.agent, b)) continue;
      const to = b.pos.clone().sub(eye).setY(0);
      const d = to.length();
      if (d < best && to.normalize().dot(fwd) > 0.6) {
        best = d;
        hit = b;
      }
    }
    this.sfx.melee(!!hit);
    if (!hit) return;
    this.effects.blood(hit.spheres[1].c, fwd, false);
    this.hud.hitmarker(true);
    if (hit.damage(200, this.agent, this.now)) this.registerKill(this.agent, hit, false, 'MELEE', 'melee');
  }

  /** Bookkeeping for every kill in the match (anyone on anyone). */
  private onAnyKill(killer: Combatant, victim: Combatant) {
    this.lifeKills.set(killer.id, (this.lifeKills.get(killer.id) ?? 0) + 1);
    this.lifeKills.set(victim.id, 0);
    // bots killed by another bot: was the player in on it?
    if (!killer.isPlayer && !victim.isPlayer && this.hostile(this.agent, victim)) {
      const t = (victim as Bot).hurtBy.get(this.agent.id);
      if (t !== undefined && this.now - t < 5) bump(this.profile, 'assists');
    }
    if (victim.isPlayer && !killer.isPlayer) {
      const n = (this.ms.deathsBy.get(killer.id) ?? 0) + 1;
      this.ms.deathsBy.set(killer.id, n);
      if (n === 5) bump(this.profile, 'nemesis');
    }
    this.ms.lastKiller = killer;
  }

  /** Pay out any challenges that just completed (loops, since their XP can level you into another). */
  private runChallenges() {
    for (let guard = 0; guard < 5; guard++) {
      const level = levelForXp(this.profile.xp);
      bumpMax(this.profile, 'level', level);
      const fresh = checkChallenges(this.profile, level);
      if (!fresh.length) return;
      for (const c of fresh) {
        grantXp(this.profile, c.xp);
        this.matchXp += c.xp;
        this.hud.showBanner('CHALLENGE COMPLETE', `${c.name} · +${c.xp} XP · BANNER UNLOCKED`, 4);
      }
      this.sfx.levelUp();
    }
  }

  private onPlayerKill(victim: Combatant, head: boolean, weaponId: string) {
    const before = levelForXp(this.profile.xp);
    this.trackKill(victim, head, weaponId);
    let xp = XP.kill;
    this.hud.popup(`+${XP.kill}`);
    if (weaponId === 'frag') {
      xp += XP.grenade;
      this.hud.popup(`GRENADE KILL +${XP.grenade}`, 'hs');
    }
    // weapon progression: attachments unlock at kill counts
    const n = (this.profile.weaponKills[weaponId] ?? 0) + 1;
    this.profile.weaponKills[weaponId] = n;
    const w = WEAPONS[weaponId as WeaponId];
    if (w) {
      const pool = w.slot === 'primary' ? [...OPTICS, ...MUZZLES, ...UNDERS, ...MAGS] : w.id === 'p9' ? SEC_ATTACH : [];
      const got = pool.filter((c) => c.kills === n);
      if (got.length) this.hud.showBanner('WEAPON UNLOCK', `${got.map((c) => c.name).join(' · ')} FOR ${w.name}`, 4);
    }
    if (head) {
      xp += XP.headshot;
      this.hud.popup(`HEADSHOT +${XP.headshot}`, 'hs');
      this.profile.headshots++;
      if (w) this.onWeaponHeadshot(w.id);
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
    if (this.streak === 3) xp += XP.streak3;
    if (this.streak === 5) xp += XP.streak5;
    if (this.streak >= 2) this.hud.streakCount(this.streak);
    // earn any picked killstreak whose kill count we just hit
    for (const id of this.profile.streaks) {
      if (STREAKS[id].kills === this.streak) {
        this.earned.push(id);
        this.sfx.streakReady();
        this.hud.streakEarned(STREAKS[id].name, streakIcon(id, 72));
      }
    }
    this.addXp(xp, before);
  }

  private addXp(xp: number, levelBefore: number) {
    grantXp(this.profile, xp);
    this.matchXp += xp;
    this.runChallenges();
    const after = levelForXp(this.profile.xp);
    if (after > levelBefore) {
      const unlock = unlockTrack().get(after)?.join(' · ');
      const rank = rankInfo(after).name.toUpperCase();
      const extra = after >= MAX_LEVEL && canPrestige(this.profile) ? 'PRESTIGE IS AVAILABLE IN BARRACKS' : unlock ?? '';
      this.hud.rankUp(badgeImg(after, 0, 128, false), `LEVEL ${after}`, rank, extra);
      this.sfx.rankUp();
    }
    saveProfile(this.profile);
    this.refreshHud();
  }

  private refreshHud() {
    const lvl = levelForXp(this.profile.xp);
    this.agent.level = lvl;
    this.agent.prestige = this.profile.prestige;
    const base = xpForLevel(lvl);
    const need = lvl >= MAX_LEVEL ? 1 : xpForLevel(lvl + 1) - base;
    const nu = nextUnlock(lvl);
    this.hud.rank(lvl, this.profile.xp - base, need, nu ? `LVL ${nu[0]} ${nu[1]}` : '');
  }

  /** Killstreak rail: the three picks with kill counts, lit when earned, plus the [4] prompt. */
  private streakKey() {
    return `${this.profile.streaks}|${this.earned}|${this.streak}|${Math.ceil(this.sweepT)}`;
  }

  private streakHtml() {
    const top = this.earned[this.earned.length - 1];
    const slots = this.profile.streaks
      .map((id) => {
        const s = STREAKS[id];
        const have = this.earned.filter((e) => e === id).length;
        const prog = Math.min(1, this.streak / s.kills);
        return `<div class="sk ${have ? 'got' : ''} ${top === id ? 'top' : ''}"><i style="height:${have ? 100 : prog * 100}%"></i>${streakIcon(id, 26)}<b>${s.kills}</b>${have > 1 ? `<em>×${have}</em>` : ''}</div>`;
      })
      .join('');
    const prompt = top ? `<div class="sk-use">[4] ${STREAKS[top].name}</div>` : this.sweepT > 0 ? `<div class="sk-use dim">SWEEP ${Math.ceil(this.sweepT)}s</div>` : '';
    return `${prompt}<div class="sk-row">${slots}</div>`;
  }

  /** Call in the newest earned killstreak. */
  private useStreak() {
    const id = this.earned.pop();
    if (!id) return;
    this.sfx.streakCall();
    bump(this.profile, 'streaks_used');
    const picks = [...this.profile.streaks].sort((a, b) => STREAKS[b].kills - STREAKS[a].kills);
    if (id === picks[0]) bump(this.profile, 'top_streak_used');
    if (id === 'sweep') {
      this.sweepT = SWEEP_TIME;
      bump(this.profile, 'sweeps');
      this.hud.showBanner('RADAR SWEEP', 'ENEMY POSITIONS REVEALED', 2.5);
    } else if (id === 'crash') {
      this.systemCrash();
    } else {
      this.streakRt.activate(id);
      this.hud.showBanner(STREAKS[id].name, id === 'supply' ? 'CRATE INBOUND' : id === 'sentry' ? 'SENTRY DEPLOYED' : 'INBOUND', 2.5);
    }
  }

  private sortedBoard() {
    return [...this.world.combatants].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
  }

  /** Cheap key for the scoreboard: the HUD only rebuilds the table when this changes. */
  private boardKey() {
    let k = `${this.teamScore}|${thumbVersion()}|${this.agent.level}|${this.agent.prestige}`;
    for (const c of this.world.combatants) k += `,${c.id}:${c.kills}:${c.deaths}`;
    return k;
  }

  private boardHtml() {
    // emblem (prestige badge or rank insignia) then the level number only
    const row = (c: Combatant) =>
      `<tr class="${c.isPlayer ? 'me' : ''}"><td class="bd">${badgeThumb(c.level, c.prestige, 30)}</td><td class="lv">${c.level}</td><td>${c.isPlayer ? this.profile.callsign : c.name}</td><td>${c.kills}</td><td>${c.deaths}</td><td>${c.kills * 100}</td></tr>`;
    const head = '<tr><th></th><th>LVL</th><th>PLAYER</th><th>K</th><th>D</th><th>SCORE</th></tr>';
    return this.boardBody(row, head);
  }

  private boardBody(row: (c: Combatant) => string, head: string) {
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
    const frozen = this.phase === 'match' && this.pregame !== 'off';
    if (!frozen) for (const b of this.bots) b.update(dt, this.world);
    this.throwables.update(dt, this.map.boxes, (k, pos, owner) => this.detonate(k, pos, owner));
    if (this.phase === 'match') this.streakRt.update(dt);
    if (this.crashT >= 0) this.updateCrash(dt);
    this.effects.update(dt);

    // keep the shadow frustum centred on what the camera is looking at
    const focus = this.phase === 'attract' || this.choosingClass ? new THREE.Vector3(0, 0, 0) : this.player.pos.clone();
    this.sun.target.position.copy(focus);
    this.sun.position.copy(focus).addScaledVector(this.sunDir, 50);
    this.sun.target.updateMatrixWorld();
    this.input.endFrame();
  }

  /** Camera swoops from the overview into the player's eyes, then the countdown starts. */
  private updateZoom(dt: number) {
    this.pregameT = Math.min(1, this.pregameT + dt / 1.6);
    const e = this.pregameT < 0.5 ? 4 * this.pregameT ** 3 : 1 - (-2 * this.pregameT + 2) ** 3 / 2;
    const p = this.player;
    const cam = this.camera;
    const eye = p.eye(new THREE.Vector3());
    cam.position.lerpVectors(this.zoomFrom, eye, e);
    cam.position.y += Math.sin(e * Math.PI) * 3;
    const target = new THREE.Quaternion().setFromEuler(new THREE.Euler(p.pitch, p.yaw, 0, 'YXZ'));
    cam.quaternion.slerpQuaternions(this.zoomQuat, target, e);
    cam.rotation.setFromQuaternion(cam.quaternion, 'YXZ');
    cam.fov = this.zoomFov + (this.settings.fov - this.zoomFov) * e;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    this.vm.scene.visible = false;
    if (this.pregameT >= 1) {
      this.pregame = 'countdown';
      this.pregameT = 6;
      this.lastCount = 0;
      this.vm.scene.visible = true;
    }
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
    if (this.choosingClass) {
      // overview while the player picks a class; everyone waits at their start side
      this.updateAttract(dt);
      return;
    }
    if (this.pregame === 'zoom') {
      this.updateZoom(dt);
      return;
    }
    const p = this.player;
    const inp = this.input;
    const s = this.settings;
    const counting = this.pregame === 'countdown';
    if (counting) {
      this.pregameT -= dt;
      const n = Math.ceil(this.pregameT);
      if (n !== this.lastCount && n > 0) {
        this.lastCount = n;
        this.hud.countdown(String(n));
        this.sfx.countdownBeep(n);
      }
      if (this.pregameT <= 0) {
        this.pregame = 'off';
        this.ms.spawnT = this.now;
        this.hud.countdown('GO');
        this.sfx.countdownBeep(0);
        setTimeout(() => this.hud.countdown(null), 900);
      }
    }
    const live = this.phase === 'match' && !counting;

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
    if (p.alive && !counting) p.update(dt, inp, this.map.boxes, aiming, this.now);
    if (p.landedSpeed > 0) {
      this.landDip = clamp(p.landedSpeed / 10, 0, 1);
      this.vm.landed(this.landDip);
      this.sfx.footstep(0.3);
    }
    if (p.stepDist > (p.sprinting ? 2.4 : 1.9)) {
      p.stepDist = 0;
      if (p.crouchT < 0.5) this.sfx.footstep(p.sprinting ? 0.2 : 0.12);
    }

    if (live) this.trackFrame(dt);
    if (p.alive && live) {
      if (inp.pressed.has('KeyV') && !this.vm.busy && this.gun.reloading < 0) this.melee();
      if (inp.pressed.has('KeyR') && !this.vm.busy && this.gun.startReload()) {
        this.lastReload = 0;
        this.ms.reloaded = true;
      }
      if (this.gun.ammo === 0 && this.gun.reserve > 0 && this.gun.reloading < 0 && !this.vm.busy) {
        this.autoReloadT += dt;
        if (this.autoReloadT > 0.25 && this.gun.startReload()) {
          this.lastReload = 0;
          this.ms.reloaded = true;
        }
      } else this.autoReloadT = 0;
      if (inp.pressed.has('Digit4') && this.earned.length) {
        this.useStreak();
      }
      // weapon swap: 1 / 2 / mouse wheel
      const want = inp.pressed.has('Digit1') ? 0 : inp.pressed.has('Digit2') ? 1 : inp.wheel !== 0 ? 1 - this.active : this.active;
      if (want !== this.active && !this.vm.busy) {
        this.gun.cancelReload();
        this.autoReloadT = 0;
        this.active = want;
        const st = this.gun.stats;
        this.vm.switchTo(cfgFromLoadout(this.classes[this.classIdx], want ? 'secondary' : 'primary'), st.eyeDist, st.recoil);
        this.updateMove();
        this.sfx.click(900, 0.2);
      }
      // equipment
      if (inp.pressed.has('KeyG') && this.frags > 0 && !this.vm.busy) {
        this.frags--;
        this.throwItem('frag');
      }
      if (inp.pressed.has('KeyQ') && this.tacs > 0 && !this.vm.busy) {
        this.tacs--;
        this.throwItem(this.classes[this.classIdx].tactical);
      }
      const canFire = !p.sprinting && this.vm.reload < 0 && !this.vm.busy;
      const shots = this.gun.update(dt, inp.fire, canFire, this.vm.busy);
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
    this.vm.slideLocked = this.gun.stats.weapon === 'p9' && this.gun.ammo === 0 && (this.gun.reloading < 0 || this.gun.reloading < 0.8);
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
    // sniper scope: full-screen sight picture, breathing sway, SHIFT to hold breath
    const scoped = p.alive && this.gun.stats.scoped && this.vm.ads > 0.82;
    if (scoped) {
      const holding = inp.down('ShiftLeft') && this.breath > 0;
      this.breath = holding ? Math.max(0, this.breath - dt / 4) : Math.min(1, this.breath + dt / 6);
      const k = holding ? 0.12 : this.breath <= 0 ? 1.8 : 1;
      this.swayT += dt;
      cam.rotation.x += Math.sin(this.swayT * 1.3) * 0.0045 * k;
      cam.rotation.y += Math.sin(this.swayT * 0.9 + 1) * 0.006 * k;
    } else this.breath = Math.min(1, this.breath + dt / 6);
    this.hud.scope(scoped, this.breath);
    this.vm.hidden = scoped;
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

    if (counting) {
      this.hud.ammo(this.gun.name, this.gun.ammo, this.gun.reserve, this.gun.magSize, false);
      this.hud.matchBar(this.matchHtml());
    }
    if (!live) return;

    if (!p.alive) {
      this.respawnT -= dt;
      for (let i = 0; i < 3; i++) if (inp.pressed.has(`Digit${i + 1}`)) this.pendingClass = i;
      const next = this.pendingClass >= 0 ? this.pendingClass : this.classIdx;
      const cls = this.classes.map((c, i) => (i === next ? `<b>[${i + 1}] ${c.name}</b>` : `[${i + 1}] ${c.name}`)).join(' &nbsp; ');
      this.hud.deadScreen(true, `Killed by ${this.killedBy} · respawning in ${Math.max(0, Math.ceil(this.respawnT))}`, `NEXT CLASS: ${cls}`);
      if (this.respawnT <= 0) this.respawnPlayer();
    }
    if (this.sweepT > 0) this.sweepT -= dt;

    // HUD
    const g = this.gun;
    this.hud.ammo(g.name, g.ammo, g.reserve, g.magSize, g.reloading >= 0);
    this.hud.equipment(this.frags, this.tacs, this.classes[this.classIdx].tactical === 'stun' ? 'STUN' : 'SMOKE');
    const nades: number[] = [];
    for (const f of this.throwables.frags()) {
      if (!p.alive || f.distanceTo(p.pos) > 9) continue;
      let d = Math.PI - Math.atan2(f.x - p.pos.x, f.z - p.pos.z) + p.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      nades.push(d);
    }
    this.hud.grenades(nades);
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
    this.hud.streakInfo(this.streakKey(), () => this.streakHtml());
    this.hud.matchBar(this.matchHtml());
    const tab = inp.down('Tab');
    this.hud.scoreboardTable(tab, tab ? this.boardKey() : '', () => this.boardHtml());
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
    this.renderer.render(this.scene, this.camera, this.map.sky, this.vm.scene, this.vm.camera);
  }
}
