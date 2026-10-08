import type { CamoId } from './textures';

export type PrimaryId = 'kr4' | 'vk47';
export type SecondaryId = 'p9' | 'r357';
export type WeaponId = PrimaryId | SecondaryId;
export type OpticId = 'iron' | 'reflex' | 'holo' | 'acog';
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
  secAttach: SecAttachId;
  tactical: TacticalId;
  perk1: Perk1;
  perk2: Perk2;
  perk3: Perk3;
}

export interface WeaponBase {
  id: WeaponId;
  slot: 'primary' | 'secondary';
  name: string;
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

export const WEAPONS: Record<WeaponId, WeaponBase> = {
  kr4: {
    id: 'kr4', slot: 'primary', name: 'KR-4 CARBINE', blurb: '5.56 carbine. Fast, flat-shooting and easy to control.',
    auto: true, rpm: 780, dmgNear: 34, dmgFar: 22, rangeNear: 25, rangeFar: 50, mag: 30, extMag: 45, reserveMags: 4,
    reload: 2.1, reloadEmpty: 2.6, recoil: 1, hipSpread: 1,
    bars: { damage: 5, rate: 8, range: 6, control: 8, mobility: 7 },
  },
  vk47: {
    id: 'vk47', slot: 'primary', name: 'VK-47 RIFLE', blurb: '7.62 rifle. Hits hard at any range, kicks like a mule.',
    auto: true, rpm: 600, dmgNear: 42, dmgFar: 30, rangeNear: 30, rangeFar: 60, mag: 30, extMag: 45, reserveMags: 4,
    reload: 2.4, reloadEmpty: 2.9, recoil: 1.5, hipSpread: 1.15,
    bars: { damage: 8, rate: 6, range: 7, control: 4, mobility: 6 },
  },
  p9: {
    id: 'p9', slot: 'secondary', name: 'P-9 SERVICE', blurb: '9mm striker pistol. Quick to draw, 15 rounds.',
    auto: false, rpm: 420, dmgNear: 38, dmgFar: 24, rangeNear: 12, rangeFar: 30, mag: 15, extMag: 21, reserveMags: 4,
    reload: 1.5, reloadEmpty: 1.9, recoil: 0.9, hipSpread: 0.8,
    bars: { damage: 4, rate: 7, range: 3, control: 8, mobility: 10 },
  },
  r357: {
    id: 'r357', slot: 'secondary', name: 'R-357 MAGNUM', blurb: '.357 revolver. Two to the body, one to the head.',
    auto: false, rpm: 170, dmgNear: 72, dmgFar: 50, rangeNear: 15, rangeFar: 40, mag: 6, extMag: 6, reserveMags: 5,
    reload: 2.6, reloadEmpty: 2.6, recoil: 2.4, hipSpread: 1,
    bars: { damage: 10, rate: 2, range: 5, control: 3, mobility: 9 },
  },
};

export interface Choice<T extends string = string> {
  id: T;
  name: string;
  desc: string;
  /** player level required */
  level?: number;
  /** kills with this weapon required */
  kills?: number;
  swatch?: string;
}

export const OPTICS: Choice<OpticId>[] = [
  { id: 'iron', name: 'IRON SIGHTS', desc: 'Factory sights. Widest view.' },
  { id: 'reflex', name: 'REFLEX', desc: 'Red dot. Clear sight picture.', kills: 5 },
  { id: 'holo', name: 'HOLOGRAPHIC', desc: 'Ring-and-dot. Slight extra zoom.', kills: 20 },
  { id: 'acog', name: '4X SCOPE', desc: 'Prism scope. Long-range zoom.', kills: 45 },
];
export const MUZZLES: Choice<MuzzleId>[] = [
  { id: 'none', name: 'FLASH HIDER', desc: 'Standard muzzle device.' },
  { id: 'comp', name: 'COMPENSATOR', desc: '18% less vertical recoil.', kills: 15 },
  { id: 'suppressor', name: 'SUPPRESSOR', desc: 'Off the radar when firing. Less damage at range.', kills: 35 },
];
export const UNDERS: Choice<UnderId>[] = [
  { id: 'none', name: 'NONE', desc: 'Lightest setup.' },
  { id: 'grip', name: 'VERTICAL GRIP', desc: '25% less recoil.', kills: 10 },
  { id: 'angled', name: 'ANGLED GRIP', desc: '12% less recoil, steadier aim.', kills: 25 },
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
export const CAMOS: Choice<CamoId>[] = [
  { id: 'none', name: 'FACTORY', desc: '', swatch: '#1d1f21' },
  { id: 'desert', name: 'DESERT DIGITAL', desc: '', level: 5, swatch: '#b49a6b' },
  { id: 'woodland', name: 'WOODLAND', desc: '', level: 12, swatch: '#5d6b3a' },
  { id: 'urban', name: 'URBAN', desc: '', level: 20, swatch: '#8c9094' },
  { id: 'crimson', name: 'CRIMSON TIGER', desc: '', level: 35, swatch: '#7a1a14' },
  { id: 'gold', name: 'GOLD', desc: '', level: 70, swatch: '#c9a24a' },
];

export interface UnlockCtx {
  level: number;
  /** kills with the weapon the choice belongs to */
  kills: number;
  all: boolean;
}

export function isUnlocked(c: Choice, ctx: UnlockCtx) {
  if (ctx.all) return true;
  return (c.level ?? 1) <= ctx.level && (c.kills ?? 0) <= ctx.kills;
}

export function lockText(c: Choice, weaponName: string) {
  if (c.kills) return `${c.kills} KILLS WITH ${weaponName}`;
  return `LVL ${c.level}`;
}

export const DEFAULT_CLASSES: Loadout[] = [
  { name: 'ASSAULT', weapon: 'kr4', optic: 'holo', muzzle: 'none', under: 'grip', mag: 'std', camo: 'none', secondary: 'p9', secAttach: 'none', tactical: 'smoke', perk1: 'fleet', perk2: 'hardhitter', perk3: 'steady' },
  { name: 'RIFLEMAN', weapon: 'vk47', optic: 'iron', muzzle: 'none', under: 'none', mag: 'std', camo: 'none', secondary: 'p9', secAttach: 'none', tactical: 'smoke', perk1: 'pockets', perk2: 'hardhitter', perk3: 'quickhands' },
  { name: 'SPEC OPS', weapon: 'kr4', optic: 'reflex', muzzle: 'suppressor', under: 'none', mag: 'std', camo: 'none', secondary: 'p9', secAttach: 'suppressor', tactical: 'smoke', perk1: 'fleet', perk2: 'hardhitter', perk3: 'steady' },
];

const KEY = 'deadpixel.classes.v1';

export function loadClasses(): Loadout[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const arr = JSON.parse(raw) as Loadout[];
      if (Array.isArray(arr) && arr.length === 3) return arr.map((c, i) => ({ ...DEFAULT_CLASSES[i], ...c }));
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
  damageAt(dist: number): number;
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
    adsFov: secondary ? 0.85 : { acog: 0.42, holo: 0.66, reflex: 0.72, iron: 0.78 }[optic],
    eyeDist: secondary ? 0.46 : { acog: 0.1, iron: 0.2, reflex: 0.22, holo: 0.24 }[optic],
    suppressed: muzzle === 'suppressor',
    damageAt(dist: number) {
      const t = Math.min(1, Math.max(0, (dist - w.rangeNear) / (w.rangeFar - w.rangeNear)));
      return (w.dmgNear + (w.dmgFar * farMul - w.dmgNear) * t) * dmgMul;
    },
  };
}
