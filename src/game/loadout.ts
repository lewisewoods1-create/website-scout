import { camoSwatch, type CamoId } from './camos';

export type PrimaryId = 'kr4' | 'vk47' | 'vx9' | 'sp45' | 'lm5' | 'pk7' | 'kestrel' | 'warden' | 'talon' | 'vulture' | 'mk20' | 'sk10';
export type SecondaryId = 'p9' | 'r357';
export type WeaponId = PrimaryId | SecondaryId;
export type OpticId = 'iron' | 'reflex' | 'holo' | 'acog' | 'sniper';
export type MuzzleId = 'none' | 'comp' | 'suppressor';
export type UnderId = 'none' | 'grip' | 'angled' | 'laser';
export type MagId = 'std' | 'ext' | 'fast';
export type SecAttachId = 'none' | 'suppressor' | 'extmag';
export type TacticalId = 'smoke' | 'stun';
export type Perk1 = 'fleet' | 'pockets';
export type Perk2 = 'hardhitter' | 'tough';
export type Perk3 = 'steady' | 'quickhands';

export interface Loadout {
  name: string;
  weapon: PrimaryId;
  optic: OpticId;
  muzzle: MuzzleId;
  under: UnderId;
  mag: MagId;
  camo: CamoId;
  secondary: SecondaryId;
  secCamo: CamoId;
  secAttach: SecAttachId;
  tactical: TacticalId;
  perk1: Perk1;
  perk2: Perk2;
  perk3: Perk3;
}

export type WeaponClassId = 'ar' | 'smg' | 'heavy' | 'sniper' | 'marksman' | 'handgun';
export type HitZone = 'head' | 'upper' | 'lower' | 'limb';

export interface WeaponBase {
  id: WeaponId;
  slot: 'primary' | 'secondary';
  cls: WeaponClassId;
  name: string;
  /** player level to unlock (default 1) */
  level?: number;
  /** bolt-action: the bolt is cycled after every shot */
  bolt?: boolean;
  /** head multiplier on top of the base damage (sniper-class guns use `lethal` instead) */
  headMult: number;
  /** sniper rule: these damage values per zone ignore range falloff */
  lethal?: Record<HitZone, number>;
  /** movement speed multiplier while holding it */
  move: number;
  blurb: string;
  auto: boolean;
  rpm: number;
  dmgNear: number;
  dmgFar: number;
  rangeNear: number;
  rangeFar: number;
  mag: number;
  extMag: number;
  reserveMags: number;
  reload: number;
  reloadEmpty: number;
  recoil: number;
  hipSpread: number;
  /** menu bars, 0..10 */
  bars: { damage: number; rate: number; range: number; control: number; mobility: number };
}

const STD_HEAD = 1.35;
/** Sniper rule: head and torso are a one-shot kill, arms and legs take two. */
const SNIPER_LETHAL: Record<HitZone, number> = { head: 250, upper: 150, lower: 120, limb: 55 };

export const WEAPONS: Record<WeaponId, WeaponBase> = {
  // ---- assault rifles
  kr4: {
    id: 'kr4', slot: 'primary', cls: 'ar', name: 'KR-4 CARBINE', blurb: '5.56 carbine. Fast, flat-shooting and easy to control.',
    auto: true, rpm: 780, dmgNear: 34, dmgFar: 22, rangeNear: 25, rangeFar: 50, mag: 30, extMag: 45, reserveMags: 4,
    reload: 2.1, reloadEmpty: 2.6, recoil: 1, hipSpread: 1, headMult: STD_HEAD, move: 1,
    bars: { damage: 5, rate: 8, range: 6, control: 8, mobility: 7 },
  },
  vk47: {
    id: 'vk47', slot: 'primary', cls: 'ar', name: 'VK-47 RIFLE', blurb: '7.62 rifle. Hits hard at any range, kicks like a mule.',
    auto: true, rpm: 600, dmgNear: 42, dmgFar: 30, rangeNear: 30, rangeFar: 60, mag: 30, extMag: 45, reserveMags: 4,
    reload: 2.4, reloadEmpty: 2.9, recoil: 1.5, hipSpread: 1.15, headMult: STD_HEAD, move: 0.98,
    bars: { damage: 8, rate: 6, range: 7, control: 4, mobility: 6 },
  },
  // ---- SMGs: very fast fire, heavy recoil, lower damage, quick on their feet
  vx9: {
    id: 'vx9', slot: 'primary', cls: 'smg', name: 'VX-9 STINGER', blurb: '4.6mm PDW. Shreds up close, climbs hard on full auto.',
    auto: true, rpm: 1000, dmgNear: 25, dmgFar: 15, rangeNear: 9, rangeFar: 24, mag: 40, extMag: 60, reserveMags: 4,
    reload: 1.9, reloadEmpty: 2.3, recoil: 1.55, hipSpread: 0.7, headMult: 1.25, move: 1.07,
    bars: { damage: 3, rate: 10, range: 2, control: 4, mobility: 10 },
  },
  sp45: {
    id: 'sp45', slot: 'primary', cls: 'smg', name: 'SP-45 RATTLER', blurb: '.45 SMG. Slower than the Stinger but every round lands heavy.',
    auto: true, rpm: 720, dmgNear: 33, dmgFar: 19, rangeNear: 11, rangeFar: 28, mag: 25, extMag: 40, reserveMags: 4,
    reload: 2.0, reloadEmpty: 2.4, recoil: 1.4, hipSpread: 0.75, headMult: 1.25, move: 1.05, level: 6,
    bars: { damage: 5, rate: 7, range: 3, control: 5, mobility: 9 },
  },
  // ---- heavy (LMGs): big damage and big mags, hard to control, slow
  lm5: {
    id: 'lm5', slot: 'primary', cls: 'heavy', name: 'LM-5 BRUTE', blurb: '5.56 belt-fed LMG. A 100-round wall of lead.',
    auto: true, rpm: 760, dmgNear: 40, dmgFar: 30, rangeNear: 30, rangeFar: 65, mag: 100, extMag: 150, reserveMags: 2,
    reload: 5.6, reloadEmpty: 6.2, recoil: 1.8, hipSpread: 1.5, headMult: 1.3, move: 0.88, level: 10,
    bars: { damage: 7, rate: 8, range: 8, control: 2, mobility: 3 },
  },
  pk7: {
    id: 'pk7', slot: 'primary', cls: 'heavy', name: 'PK-7 ANVIL', blurb: '7.62 machine gun. Two hits from anywhere, if you can hold it on target.',
    auto: true, rpm: 650, dmgNear: 50, dmgFar: 40, rangeNear: 35, rangeFar: 70, mag: 100, extMag: 150, reserveMags: 2,
    reload: 6.0, reloadEmpty: 6.6, recoil: 2.25, hipSpread: 1.7, headMult: 1.3, move: 0.85, level: 26,
    bars: { damage: 10, rate: 6, range: 9, control: 1, mobility: 2 },
  },
  // ---- snipers: bolt-actions and 5-round semi-autos
  kestrel: {
    id: 'kestrel', slot: 'primary', cls: 'sniper', name: 'KESTREL', blurb: 'Light .308 bolt-action. Quick to aim and quick to cycle.',
    auto: false, rpm: 58, dmgNear: 150, dmgFar: 150, rangeNear: 999, rangeFar: 1000, mag: 5, extMag: 7, reserveMags: 5,
    reload: 2.8, reloadEmpty: 3.3, recoil: 2.6, hipSpread: 3.2, headMult: 1, move: 0.93, level: 4, bolt: true, lethal: SNIPER_LETHAL,
    bars: { damage: 10, rate: 2, range: 10, control: 4, mobility: 5 },
  },
  warden: {
    id: 'warden', slot: 'primary', cls: 'sniper', name: 'WARDEN .338', blurb: 'Heavy .338 bolt-action. Slowest to handle, punches through two targets.',
    auto: false, rpm: 44, dmgNear: 150, dmgFar: 150, rangeNear: 999, rangeFar: 1000, mag: 5, extMag: 7, reserveMags: 5,
    reload: 3.4, reloadEmpty: 3.9, recoil: 3.2, hipSpread: 3.6, headMult: 1, move: 0.9, level: 20, bolt: true, lethal: SNIPER_LETHAL,
    bars: { damage: 10, rate: 1, range: 10, control: 3, mobility: 4 },
  },
  talon: {
    id: 'talon', slot: 'primary', cls: 'sniper', name: 'TALON SR', blurb: 'Semi-auto 7.62 sniper. Five rounds, no bolt to work.',
    auto: false, rpm: 170, dmgNear: 150, dmgFar: 150, rangeNear: 999, rangeFar: 1000, mag: 5, extMag: 8, reserveMags: 5,
    reload: 2.7, reloadEmpty: 3.2, recoil: 2.8, hipSpread: 3.3, headMult: 1, move: 0.92, level: 14, lethal: SNIPER_LETHAL,
    bars: { damage: 10, rate: 3, range: 9, control: 3, mobility: 5 },
  },
  vulture: {
    id: 'vulture', slot: 'primary', cls: 'sniper', name: 'VULTURE', blurb: 'Bullpup semi-auto sniper. Five rounds, fastest follow-up shot.',
    auto: false, rpm: 200, dmgNear: 150, dmgFar: 150, rangeNear: 999, rangeFar: 1000, mag: 5, extMag: 8, reserveMags: 5,
    reload: 2.5, reloadEmpty: 3.0, recoil: 3.0, hipSpread: 3.1, headMult: 1, move: 0.94, level: 34, lethal: SNIPER_LETHAL,
    bars: { damage: 10, rate: 4, range: 9, control: 2, mobility: 6 },
  },
  // ---- marksman rifles: semi-auto, two to three hits
  sk10: {
    id: 'sk10', slot: 'primary', cls: 'marksman', name: 'SK-10 RANGER', blurb: '7.62 semi-auto carbine with a wooden stock. Two to the head, three to the body.',
    auto: false, rpm: 360, dmgNear: 46, dmgFar: 40, rangeNear: 35, rangeFar: 75, mag: 10, extMag: 20, reserveMags: 5,
    reload: 2.2, reloadEmpty: 2.7, recoil: 1.6, hipSpread: 1.4, headMult: 1.6, move: 0.98, level: 2,
    bars: { damage: 7, rate: 5, range: 8, control: 6, mobility: 7 },
  },
  mk20: {
    id: 'mk20', slot: 'primary', cls: 'marksman', name: 'MK-20 SENTINEL', blurb: 'Battle rifle in a chassis. Two body shots close, three far.',
    auto: false, rpm: 300, dmgNear: 55, dmgFar: 42, rangeNear: 30, rangeFar: 70, mag: 20, extMag: 30, reserveMags: 4,
    reload: 2.5, reloadEmpty: 3.0, recoil: 1.9, hipSpread: 1.5, headMult: 1.6, move: 0.96, level: 8,
    bars: { damage: 8, rate: 4, range: 9, control: 5, mobility: 6 },
  },
  // ---- handguns
  p9: {
    id: 'p9', slot: 'secondary', cls: 'handgun', name: 'P-9 SERVICE', blurb: '9mm striker pistol. Quick to draw, 15 rounds.',
    auto: false, rpm: 420, dmgNear: 38, dmgFar: 24, rangeNear: 12, rangeFar: 30, mag: 15, extMag: 21, reserveMags: 4,
    reload: 1.5, reloadEmpty: 1.9, recoil: 0.9, hipSpread: 0.8, headMult: 1.4, move: 1.05,
    bars: { damage: 4, rate: 7, range: 3, control: 8, mobility: 10 },
  },
  r357: {
    id: 'r357', slot: 'secondary', cls: 'handgun', name: 'R-357 MAGNUM', blurb: '.357 revolver. Two to the body.',
    auto: false, rpm: 170, dmgNear: 72, dmgFar: 50, rangeNear: 15, rangeFar: 40, mag: 6, extMag: 6, reserveMags: 5,
    reload: 2.6, reloadEmpty: 2.6, recoil: 2.4, hipSpread: 1, headMult: 1.35, move: 1.05,
    bars: { damage: 10, rate: 2, range: 5, control: 3, mobility: 9 },
  },
};

export const PRIMARY_IDS = (Object.keys(WEAPONS) as WeaponId[]).filter((w) => WEAPONS[w].slot === 'primary') as PrimaryId[];

export interface Choice<T extends string = string> {
  id: T;
  name: string;
  desc: string;
  /** player level required */
  level?: number;
  /** kills with this weapon required */
  kills?: number;
  /** headshot kills with this weapon required (camos) */
  heads?: number;
  /** mastery camo: needs gold on every weapon in this class */
  mastery?: WeaponClassId;
  /** Dead Signal: needs Prism in every class */
  ultimate?: boolean;
  /** attachment only fits these weapon classes (default: all) */
  classes?: WeaponClassId[];
  swatch?: string;
}

export const OPTICS: Choice<OpticId>[] = [
  { id: 'iron', name: 'IRON SIGHTS', desc: 'Factory sights. Widest view.', classes: ['ar', 'smg', 'heavy', 'marksman'] },
  { id: 'sniper', name: 'SNIPER SCOPE', desc: '10x variable scope. Full-screen sight picture.', classes: ['sniper', 'marksman'] },
  { id: 'reflex', name: 'REFLEX', desc: 'Red dot. Clear sight picture.', kills: 5, classes: ['ar', 'smg', 'heavy', 'marksman'] },
  { id: 'holo', name: 'HOLOGRAPHIC', desc: 'Ring-and-dot. Slight extra zoom.', kills: 20, classes: ['ar', 'smg', 'heavy', 'marksman'] },
  { id: 'acog', name: '4X SCOPE', desc: 'Prism scope. Long-range zoom.', kills: 45, classes: ['ar', 'heavy', 'marksman', 'sniper'] },
];
export const MUZZLES: Choice<MuzzleId>[] = [
  { id: 'none', name: 'FLASH HIDER', desc: 'Standard muzzle device.' },
  { id: 'comp', name: 'COMPENSATOR', desc: '18% less vertical recoil.', kills: 15 },
  { id: 'suppressor', name: 'SUPPRESSOR', desc: 'Off the radar when firing. Less damage at range.', kills: 35 },
];
export const UNDERS: Choice<UnderId>[] = [
  { id: 'none', name: 'NONE', desc: 'Lightest setup.' },
  { id: 'grip', name: 'VERTICAL GRIP', desc: '25% less recoil.', kills: 10, classes: ['ar', 'smg', 'heavy'] },
  { id: 'angled', name: 'ANGLED GRIP', desc: '12% less recoil, steadier aim.', kills: 25, classes: ['ar', 'smg', 'heavy', 'marksman'] },
  { id: 'laser', name: 'LASER SIGHT', desc: '30% tighter hip-fire.', kills: 55 },
];
export const MAGS: Choice<MagId>[] = [
  { id: 'std', name: 'STANDARD MAG', desc: 'Factory magazine.' },
  { id: 'ext', name: 'EXTENDED MAG', desc: '+50% ammo, slower reload.', kills: 30 },
  { id: 'fast', name: 'DUAL MAG', desc: 'Taped mags. 25% faster reload.', kills: 70 },
];
export const SECONDARIES: Choice<SecondaryId>[] = [
  { id: 'p9', name: 'P-9 SERVICE', desc: '9mm pistol, 15 rounds.' },
  { id: 'r357', name: 'R-357 MAGNUM', desc: '.357 revolver, 6 rounds.', level: 4 },
];
export const SEC_ATTACH: Choice<SecAttachId>[] = [
  { id: 'none', name: 'NONE', desc: '' },
  { id: 'suppressor', name: 'SUPPRESSOR', desc: 'Pistol only. Off the radar.', kills: 10 },
  { id: 'extmag', name: 'EXTENDED MAG', desc: 'Pistol only. 21 rounds.', kills: 20 },
];
export const TACTICALS: Choice<TacticalId>[] = [
  { id: 'smoke', name: 'SMOKE', desc: 'Blocks vision for 14 seconds.' },
  { id: 'stun', name: 'STUN', desc: 'Dazes enemies within 10m for 3.5s.', level: 6 },
];
export const PERKS1: Choice<Perk1>[] = [
  { id: 'fleet', name: 'FLEET FOOT', desc: 'Move 10% faster.' },
  { id: 'pockets', name: 'DEEP POCKETS', desc: '2 extra mags and an extra frag.' },
];
export const PERKS2: Choice<Perk2>[] = [
  { id: 'hardhitter', name: 'HARD HITTER', desc: '+20% bullet damage.' },
  { id: 'tough', name: 'THICK SKIN', desc: '+30 max health.', level: 8 },
];
export const PERKS3: Choice<Perk3>[] = [
  { id: 'steady', name: 'STEADY HANDS', desc: '35% tighter hip-fire.' },
  { id: 'quickhands', name: 'QUICK HANDS', desc: '30% faster reloads.', level: 3 },
];
// ---------------------------------------------------------------- camos

/**
 * Camos from the overlay pack, per weapon: five from headshot kills, Gold once all five
 * are done, Prism for gold on every weapon in the class, Dead Signal for Prism in every class.
 */
const cm = (id: CamoId, name: string, extra: Partial<Choice<CamoId>> = {}): Choice<CamoId> => ({ id, name, desc: '', swatch: camoSwatch(id), ...extra });
export const CAMOS: Choice<CamoId>[] = [
  cm('none', 'FACTORY', { desc: 'Stock finish.' }),
  cm('grunt_grid', 'GRUNT GRID', { heads: 20 }),
  cm('rubble', 'RUBBLE', { heads: 50 }),
  cm('sand_tiger', 'SAND TIGER', { heads: 100 }),
  cm('frostbite', 'FROSTBITE', { heads: 200 }),
  cm('red_static', 'RED STATIC', { heads: 500 }),
  cm('gold', 'GOLD', { desc: 'All five camos earned on this weapon.', heads: 500 }),
];
export const GOLD_HEADS = 500;

const inClass = (c: WeaponClassId) => (Object.keys(WEAPONS) as WeaponId[]).filter((w) => WEAPONS[w].cls === c);

export const WEAPON_CLASSES: Record<WeaponClassId, { name: string; short: string; weapons: WeaponId[]; camo: Choice<CamoId> }> = {
  ar: { name: 'ASSAULT RIFLES', short: 'ASSAULT', weapons: inClass('ar'), camo: cm('prism', 'PRISM', { desc: 'Gold on every assault rifle.', mastery: 'ar' }) },
  smg: { name: 'SMGS', short: 'SMG', weapons: inClass('smg'), camo: cm('prism', 'PRISM', { desc: 'Gold on every SMG.', mastery: 'smg' }) },
  heavy: { name: 'HEAVY', short: 'HEAVY', weapons: inClass('heavy'), camo: cm('prism', 'PRISM', { desc: 'Gold on every heavy weapon.', mastery: 'heavy' }) },
  sniper: { name: 'SNIPERS', short: 'SNIPER', weapons: inClass('sniper'), camo: cm('prism', 'PRISM', { desc: 'Gold on every sniper.', mastery: 'sniper' }) },
  marksman: { name: 'MARKSMAN RIFLES', short: 'MARKSMAN', weapons: inClass('marksman'), camo: cm('prism', 'PRISM', { desc: 'Gold on every marksman rifle.', mastery: 'marksman' }) },
  handgun: { name: 'HANDGUNS', short: 'HANDGUN', weapons: inClass('handgun'), camo: cm('prism', 'PRISM', { desc: 'Gold on every handgun.', mastery: 'handgun' }) },
};

/** The top camo: Prism earned in every weapon class. */
export const DEAD_SIGNAL: Choice<CamoId> = cm('dead_signal', 'DEAD SIGNAL', { desc: 'Prism in every weapon class.', ultimate: true });

export function classOf(w: WeaponId): WeaponClassId {
  return WEAPONS[w].cls;
}

export function camosFor(w: WeaponId): Choice<CamoId>[] {
  return [...CAMOS, WEAPON_CLASSES[classOf(w)].camo, DEAD_SIGNAL];
}

export const hasGold = (heads: Record<string, number>, w: WeaponId) => (heads[w] ?? 0) >= GOLD_HEADS;
export const hasMastery = (heads: Record<string, number>, c: WeaponClassId) => WEAPON_CLASSES[c].weapons.every((w) => hasGold(heads, w));
export const hasDeadSignal = (heads: Record<string, number>) => (Object.keys(WEAPON_CLASSES) as WeaponClassId[]).every((c) => hasMastery(heads, c));

export interface UnlockCtx {
  level: number;
  /** kills with the weapon the choice belongs to */
  kills: number;
  /** headshot kills with that weapon */
  heads?: number;
  /** all headshot counts, for mastery camos */
  allHeads?: Record<string, number>;
  all: boolean;
}

export function isUnlocked(c: Choice, ctx: UnlockCtx) {
  if (ctx.all) return true;
  if (c.ultimate) return hasDeadSignal(ctx.allHeads ?? {});
  if (c.mastery) return hasMastery(ctx.allHeads ?? {}, c.mastery);
  return (c.level ?? 1) <= ctx.level && (c.kills ?? 0) <= ctx.kills && (c.heads ?? 0) <= (ctx.heads ?? 0);
}

export function lockText(c: Choice, weaponName: string) {
  if (c.ultimate) return 'PRISM IN EVERY CLASS';
  if (c.mastery) return `GOLD ON ALL ${WEAPON_CLASSES[c.mastery].name}`;
  if (c.heads) return `${c.heads} HEADSHOT KILLS WITH ${weaponName}`;
  if (c.kills) return `${c.kills} KILLS WITH ${weaponName}`;
  return `LVL ${c.level}`;
}

export const DEFAULT_CLASSES: Loadout[] = [
  { name: 'ASSAULT', weapon: 'kr4', optic: 'holo', muzzle: 'none', under: 'grip', mag: 'std', camo: 'none', secondary: 'p9', secCamo: 'none', secAttach: 'none', tactical: 'smoke', perk1: 'fleet', perk2: 'hardhitter', perk3: 'steady' },
  { name: 'RIFLEMAN', weapon: 'vk47', optic: 'iron', muzzle: 'none', under: 'none', mag: 'std', camo: 'none', secondary: 'p9', secCamo: 'none', secAttach: 'none', tactical: 'smoke', perk1: 'pockets', perk2: 'hardhitter', perk3: 'quickhands' },
  { name: 'SPEC OPS', weapon: 'kr4', optic: 'reflex', muzzle: 'suppressor', under: 'none', mag: 'std', camo: 'none', secondary: 'p9', secCamo: 'none', secAttach: 'suppressor', tactical: 'smoke', perk1: 'fleet', perk2: 'hardhitter', perk3: 'steady' },
  { name: 'CLASS 4', weapon: 'kr4', optic: 'holo', muzzle: 'none', under: 'none', mag: 'std', camo: 'none', secondary: 'p9', secCamo: 'none', secAttach: 'none', tactical: 'smoke', perk1: 'fleet', perk2: 'hardhitter', perk3: 'steady' },
  { name: 'CLASS 5', weapon: 'vk47', optic: 'iron', muzzle: 'none', under: 'none', mag: 'std', camo: 'none', secondary: 'p9', secCamo: 'none', secAttach: 'none', tactical: 'smoke', perk1: 'fleet', perk2: 'hardhitter', perk3: 'steady' },
];

/** Create a Class opens at this level; until then you play the three premade classes. */
export const CAC_LEVEL = 4;
/** Custom class slots 4 and 5 open here. */
export const EXTRA_CLASS_LEVEL = 10;
export const MAX_CLASSES = 5;

export function classSlots(level: number, all = false) {
  if (all) return MAX_CLASSES;
  return level >= EXTRA_CLASS_LEVEL ? 5 : 3;
}

export const cacUnlocked = (level: number, all = false) => all || level >= CAC_LEVEL;

/** Premade classes used before Create a Class unlocks (fresh copies, never edited). */
export const premadeClasses = () => DEFAULT_CLASSES.slice(0, 3).map((c) => ({ ...c }));

const KEY = 'deadpixel.classes.v1';

export function loadClasses(): Loadout[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const arr = JSON.parse(raw) as Loadout[];
      // older saves had three classes: pad up to five
      if (Array.isArray(arr) && arr.length >= 3) return DEFAULT_CLASSES.map((d, i) => ({ ...d, ...(arr[i] ?? {}) }));
    }
  } catch {
    // fall through to defaults
  }
  return DEFAULT_CLASSES.map((c) => ({ ...c }));
}

export function saveClasses(c: Loadout[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    // ignore
  }
}

/** Final numbers the game uses once attachments and perks are applied. */
export interface GunStats {
  name: string;
  weapon: WeaponId;
  auto: boolean;
  rpm: number;
  mag: number;
  reserve: number;
  reload: number;
  reloadEmpty: number;
  recoil: number;
  hipSpread: number;
  adsFov: number;
  eyeDist: number;
  suppressed: boolean;
  cls: WeaponClassId;
  /** bolt-action: re-chamber after each shot */
  bolt: boolean;
  /** full-screen scope when aiming */
  scoped: boolean;
  /** movement multiplier from the weapon's weight */
  move: number;
  /** body-shot damage at a distance (what the menus show) */
  damageAt(dist: number): number;
  /** damage for a hit on a given zone */
  zoneDamage(zone: HitZone, dist: number): number;
}

/** Head multiplier for bots' own hits (players use the weapon's headMult). */
export const HEADSHOT_MULT = 1.35;
/** Body-part multipliers for normal weapons (sniper-class guns use their lethal table). */
const ZONE_MULT: Record<Exclude<HitZone, 'head'>, number> = { upper: 1, lower: 0.95, limb: 0.8 };

/** Attachment options that fit a weapon. */
export function fitsWeapon<T extends string>(list: Choice<T>[], w: WeaponId): Choice<T>[] {
  return list.filter((c) => !c.classes || c.classes.includes(WEAPONS[w].cls));
}

/** Snap a class's attachments onto ones its (possibly new) primary accepts. */
export function fixAttachments(l: Loadout) {
  const ok = <T extends string>(list: Choice<T>[], v: T) => fitsWeapon(list, l.weapon).some((c) => c.id === v);
  if (!ok(OPTICS, l.optic)) l.optic = fitsWeapon(OPTICS, l.weapon)[0].id;
  if (!ok(UNDERS, l.under)) l.under = 'none';
}

export function computeStats(l: Loadout, slot: 'primary' | 'secondary' = 'primary'): GunStats {
  const secondary = slot === 'secondary';
  const w = WEAPONS[secondary ? l.secondary : l.weapon];
  const pistol = w.id === 'p9';
  const muzzle: MuzzleId = secondary ? (pistol && l.secAttach === 'suppressor' ? 'suppressor' : 'none') : l.muzzle;
  const mag: MagId = secondary ? (pistol && l.secAttach === 'extmag' ? 'ext' : 'std') : l.mag;
  const optic: OpticId = secondary ? 'iron' : l.optic;
  const under: UnderId = secondary ? 'none' : l.under;

  const dmgMul = l.perk2 === 'hardhitter' ? 1.2 : 1;
  const farMul = muzzle === 'suppressor' ? 0.82 : 1;
  let reloadMul = l.perk3 === 'quickhands' ? 0.7 : 1;
  if (mag === 'ext') reloadMul *= 1.12;
  if (mag === 'fast') reloadMul *= 0.75;
  let recoil = w.recoil;
  if (under === 'grip') recoil *= 0.75;
  if (under === 'angled') recoil *= 0.88;
  if (muzzle === 'comp') recoil *= 0.82;
  let hip = w.hipSpread * (l.perk3 === 'steady' ? 0.65 : 1);
  if (under === 'laser') hip *= 0.7;
  const magSize = mag === 'ext' ? w.extMag : w.mag;
  return {
    name: w.name,
    weapon: w.id,
    auto: w.auto,
    rpm: w.rpm,
    mag: magSize,
    reserve: magSize * (w.reserveMags + (l.perk1 === 'pockets' ? 2 : 0)),
    reload: w.reload * reloadMul,
    reloadEmpty: w.reloadEmpty * reloadMul,
    recoil,
    hipSpread: hip,
    adsFov: secondary ? 0.85 : { acog: 0.42, holo: 0.66, reflex: 0.72, iron: 0.78, sniper: 0.2 }[optic],
    eyeDist: secondary ? 0.46 : { acog: 0.1, iron: 0.2, reflex: 0.22, holo: 0.24, sniper: 0.12 }[optic],
    suppressed: muzzle === 'suppressor',
    cls: w.cls,
    bolt: !!w.bolt,
    scoped: optic === 'sniper',
    move: w.move,
    damageAt,
    zoneDamage(zone: HitZone, dist: number) {
      if (w.lethal) return w.lethal[zone] * (muzzle === 'suppressor' && zone === 'limb' ? 0.9 : 1);
      return damageAt(dist) * (zone === 'head' ? w.headMult : ZONE_MULT[zone]);
    },
  };
  function damageAt(dist: number) {
    const t = Math.min(1, Math.max(0, (dist - w.rangeNear) / (w.rangeFar - w.rangeNear)));
    return (w.dmgNear + (w.dmgFar * farMul - w.dmgNear) * t) * dmgMul;
  }
}
