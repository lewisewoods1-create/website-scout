import type { CamoId } from './textures';

export type WeaponId = 'kr4' | 'vk47';
export type OpticId = 'iron' | 'reflex' | 'holo';
export type MuzzleId = 'none' | 'suppressor';
export type UnderId = 'none' | 'grip';
export type Perk1 = 'fleet' | 'pockets';
export type Perk2 = 'hardhitter' | 'tough';
export type Perk3 = 'steady' | 'quickhands';

export interface Loadout {
  name: string;
  weapon: WeaponId;
  optic: OpticId;
  muzzle: MuzzleId;
  under: UnderId;
  camo: CamoId;
  perk1: Perk1;
  perk2: Perk2;
  perk3: Perk3;
}

export interface WeaponBase {
  id: WeaponId;
  name: string;
  blurb: string;
  rpm: number;
  dmgNear: number;
  dmgFar: number;
  rangeNear: number;
  rangeFar: number;
  mag: number;
  reload: number;
  reloadEmpty: number;
  recoil: number;
  hipSpread: number;
  /** HUD bars, 0..10 */
  bars: { damage: number; rate: number; range: number; control: number; mobility: number };
}

export const WEAPONS: Record<WeaponId, WeaponBase> = {
  kr4: {
    id: 'kr4',
    name: 'KR-4 CARBINE',
    blurb: '5.56 carbine. Fast, flat-shooting and easy to control.',
    rpm: 780, dmgNear: 34, dmgFar: 22, rangeNear: 25, rangeFar: 50,
    mag: 30, reload: 2.1, reloadEmpty: 2.6, recoil: 1, hipSpread: 1,
    bars: { damage: 5, rate: 8, range: 6, control: 8, mobility: 7 },
  },
  vk47: {
    id: 'vk47',
    name: 'VK-47 RIFLE',
    blurb: '7.62 rifle. Hits hard at any range, kicks like a mule.',
    rpm: 600, dmgNear: 42, dmgFar: 30, rangeNear: 30, rangeFar: 60,
    mag: 30, reload: 2.4, reloadEmpty: 2.9, recoil: 1.5, hipSpread: 1.15,
    bars: { damage: 8, rate: 6, range: 7, control: 4, mobility: 6 },
  },
};

interface Choice<T extends string> {
  id: T;
  name: string;
  desc: string;
  level: number;
}

export const OPTICS: Choice<OpticId>[] = [
  { id: 'iron', name: 'IRON SIGHTS', desc: 'Factory sights. Fastest aim.', level: 1 },
  { id: 'reflex', name: 'REFLEX', desc: 'Red dot. Clear sight picture.', level: 1 },
  { id: 'holo', name: 'HOLOGRAPHIC', desc: 'Ring-and-dot. Slight extra zoom.', level: 2 },
];
export const MUZZLES: Choice<MuzzleId>[] = [
  { id: 'none', name: 'FLASH HIDER', desc: 'Standard muzzle device.', level: 1 },
  { id: 'suppressor', name: 'SUPPRESSOR', desc: 'Off the radar when firing. Less damage at range.', level: 4 },
];
export const UNDERS: Choice<UnderId>[] = [
  { id: 'none', name: 'NONE', desc: '', level: 1 },
  { id: 'grip', name: 'FOREGRIP', desc: '25% less recoil.', level: 3 },
];
export const PERKS1: Choice<Perk1>[] = [
  { id: 'fleet', name: 'FLEET FOOT', desc: 'Move 10% faster.', level: 1 },
  { id: 'pockets', name: 'DEEP POCKETS', desc: 'Spawn with 2 extra magazines.', level: 1 },
];
export const PERKS2: Choice<Perk2>[] = [
  { id: 'hardhitter', name: 'HARD HITTER', desc: '+20% bullet damage.', level: 1 },
  { id: 'tough', name: 'THICK SKIN', desc: '+30 max health.', level: 5 },
];
export const PERKS3: Choice<Perk3>[] = [
  { id: 'steady', name: 'STEADY HANDS', desc: '35% tighter hip-fire.', level: 1 },
  { id: 'quickhands', name: 'QUICK HANDS', desc: '30% faster reloads.', level: 3 },
];
export const CAMOS: (Choice<CamoId> & { swatch: string })[] = [
  { id: 'none', name: 'FACTORY', desc: '', level: 1, swatch: '#1d1f21' },
  { id: 'desert', name: 'DESERT DIGITAL', desc: '', level: 2, swatch: '#b49a6b' },
  { id: 'woodland', name: 'WOODLAND', desc: '', level: 4, swatch: '#5d6b3a' },
  { id: 'urban', name: 'URBAN', desc: '', level: 6, swatch: '#8c9094' },
  { id: 'crimson', name: 'CRIMSON TIGER', desc: '', level: 9, swatch: '#7a1a14' },
  { id: 'gold', name: 'GOLD', desc: '', level: 15, swatch: '#c9a24a' },
];

export const DEFAULT_CLASSES: Loadout[] = [
  { name: 'ASSAULT', weapon: 'kr4', optic: 'holo', muzzle: 'none', under: 'grip', camo: 'none', perk1: 'fleet', perk2: 'hardhitter', perk3: 'steady' },
  { name: 'RIFLEMAN', weapon: 'vk47', optic: 'iron', muzzle: 'none', under: 'none', camo: 'none', perk1: 'pockets', perk2: 'hardhitter', perk3: 'quickhands' },
  { name: 'SPEC OPS', weapon: 'kr4', optic: 'reflex', muzzle: 'suppressor', under: 'none', camo: 'none', perk1: 'fleet', perk2: 'tough', perk3: 'steady' },
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

export function computeStats(l: Loadout): GunStats {
  const w = WEAPONS[l.weapon];
  const dmgMul = l.perk2 === 'hardhitter' ? 1.2 : 1;
  const farMul = l.muzzle === 'suppressor' ? 0.82 : 1;
  const reloadMul = l.perk3 === 'quickhands' ? 0.7 : 1;
  return {
    name: w.name,
    weapon: w.id,
    rpm: w.rpm,
    mag: w.mag,
    reserve: w.mag * (l.perk1 === 'pockets' ? 6 : 4),
    reload: w.reload * reloadMul,
    reloadEmpty: w.reloadEmpty * reloadMul,
    recoil: w.recoil * (l.under === 'grip' ? 0.75 : 1),
    hipSpread: w.hipSpread * (l.perk3 === 'steady' ? 0.65 : 1),
    adsFov: l.optic === 'holo' ? 0.66 : l.optic === 'reflex' ? 0.72 : 0.78,
    eyeDist: l.optic === 'iron' ? 0.2 : l.optic === 'reflex' ? 0.22 : 0.24,
    suppressed: l.muzzle === 'suppressor',
    damageAt(dist: number) {
      const t = Math.min(1, Math.max(0, (dist - w.rangeNear) / (w.rangeFar - w.rangeNear)));
      const base = w.dmgNear + (w.dmgFar * farMul - w.dmgNear) * t;
      return base * dmgMul;
    },
  };
}
