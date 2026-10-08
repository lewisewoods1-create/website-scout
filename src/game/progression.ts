/**
 * MW2-shaped progression: 70 levels, unlocks on level-up, XP per action.
 * Phase 0 stores the profile locally; Phase 1 moves it server-side.
 */
export const MAX_LEVEL = 70;

export const XP = {
  kill: 100,
  headshot: 50,
  streak3: 150,
  streak5: 250,
  revenge: 50,
  longshot: 50,
} as const;

/** Total XP required to reach `level` (level 1 = 0). */
export function xpForLevel(level: number) {
  const n = level - 1;
  return 100 * n * n + 700 * n;
}

export function levelForXp(xp: number) {
  let l = 1;
  while (l < MAX_LEVEL && xp >= xpForLevel(l + 1)) l++;
  return l;
}

/** Placeholder unlock track — just enough to show the loop working. */
export const UNLOCKS: Record<number, string> = {
  2: 'HOLOGRAPHIC SIGHT · DESERT DIGITAL CAMO',
  3: 'FOREGRIP · PERK: QUICK HANDS',
  4: 'SUPPRESSOR · WOODLAND CAMO',
  5: 'PERK: THICK SKIN',
  6: 'URBAN CAMO',
  9: 'CRIMSON TIGER CAMO',
  15: 'GOLD CAMO',
};

export interface Profile {
  xp: number;
  kills: number;
  deaths: number;
  headshots: number;
  bestStreak: number;
}

const KEY = 'deadpixel.profile.v1';

export function loadProfile(): Profile {
  const blank: Profile = { xp: 0, kills: 0, deaths: 0, headshots: 0, bestStreak: 0 };
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...blank, ...(JSON.parse(raw) as Partial<Profile>) } : blank;
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

export function nextUnlock(level: number): [number, string] | null {
  for (let l = level + 1; l <= MAX_LEVEL; l++) if (UNLOCKS[l]) return [l, UNLOCKS[l]];
  return null;
}
