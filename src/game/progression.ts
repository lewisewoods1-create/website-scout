/**
 * Ranks 1-75, then Prestige 1-10 (each prestige resets you to level 1).
 * XP needed per level grows linearly; the profile is stored locally for now.
 */
export const MAX_LEVEL = 75;
export const MAX_PRESTIGE = 10;

export const XP = {
  kill: 100,
  headshot: 50,
  streak3: 150,
  streak5: 250,
  revenge: 50,
  longshot: 50,
  grenade: 50,
} as const;

/** XP to go from `level` to `level + 1`. */
export function xpToNext(level: number) {
  return 800 + 140 * (level - 1);
}

/** Total XP (within the current prestige) required to reach `level`. */
export function xpForLevel(level: number) {
  const n = level - 1;
  return 800 * n + (140 * n * (n - 1)) / 2;
}

export function levelForXp(xp: number) {
  let l = 1;
  while (l < MAX_LEVEL && xp >= xpForLevel(l + 1)) l++;
  return l;
}

export interface SoldierLook {
  uniform: string;
  gear: string;
  head: string;
}

export interface Profile {
  xp: number;
  prestige: number;
  kills: number;
  deaths: number;
  headshots: number;
  bestStreak: number;
  /** kills per weapon id, drives attachment unlocks */
  weaponKills: Record<string, number>;
  /** headshot kills per weapon id, drives camo unlocks */
  weaponHeads: Record<string, number>;
  /** challenge counters (see challenges.ts) */
  stats: Record<string, number>;
  /** ids of completed challenges */
  challenges: string[];
  callsign: string;
  banner: string;
  look: SoldierLook;
}

const KEY = 'deadpixel.profile.v1';

export function blankProfile(): Profile {
  return {
    xp: 0, prestige: 0, kills: 0, deaths: 0, headshots: 0, bestStreak: 0, weaponKills: {}, weaponHeads: {}, stats: {}, challenges: [],
    callsign: 'OPERATOR', banner: 'recruit', look: { uniform: 'desert', gear: 'coyote', head: 'nvg' },
  };
}

export function loadProfile(): Profile {
  const blank = blankProfile();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank;
    const p = { ...blank, ...(JSON.parse(raw) as Partial<Profile>) };
    p.look = { ...blank.look, ...p.look };
    p.weaponKills = { ...p.weaponKills };
    p.weaponHeads = { ...p.weaponHeads };
    p.stats = { ...p.stats };
    p.challenges = Array.isArray(p.challenges) ? [...p.challenges] : [];
    p.xp = Math.min(p.xp, xpForLevel(MAX_LEVEL));
    return p;
  } catch {
    return blank;
  }
}

export function saveProfile(p: Profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // storage unavailable (private mode) — progress just won't persist
  }
}

/** Add XP, holding at the max level until the player chooses to prestige. */
export function grantXp(p: Profile, xp: number) {
  p.xp = Math.min(p.xp + xp, xpForLevel(MAX_LEVEL));
}

export function canPrestige(p: Profile) {
  return levelForXp(p.xp) >= MAX_LEVEL && p.prestige < MAX_PRESTIGE;
}

export function enterPrestige(p: Profile) {
  if (!canPrestige(p)) return false;
  p.prestige++;
  p.xp = 0;
  return true;
}
