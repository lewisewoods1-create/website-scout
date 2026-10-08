import { hasGold, hasMastery, WEAPONS, type WeaponId } from './loadout';
import type { Profile } from './progression';

/**
 * 100 challenges. Each tracks one stat counter on the profile and, when
 * completed, pays XP and unlocks its own banner (calling card).
 *
 * Banner artwork: drop the files in public/game/banners/ as ch-001.webp … ch-100.webp
 * (any of webp/png/jpg via BANNER_ART_EXT) and set BANNER_ART_READY to true.
 * Until then each banner gets a generated placeholder in its category colours.
 */
export const BANNER_ART_READY = false;
export const BANNER_ART_EXT = 'webp';

export type ChallengeCat = 'combat' | 'weapons' | 'tactics' | 'streaks' | 'matches' | 'career';

export const CATEGORIES: Record<ChallengeCat, { name: string; hue: number; icon: string }> = {
  combat: { name: 'COMBAT', hue: 4, icon: 'M20 4l4 10h10l-8 6 3 11-9-6-9 6 3-11-8-6h10z' },
  weapons: { name: 'WEAPONS', hue: 32, icon: 'M4 18h22l4-3h6v6h-4l-2 3H16l-2 8H9l2-8H4z' },
  tactics: { name: 'TACTICS', hue: 190, icon: 'M20 4a16 16 0 100 32 16 16 0 000-32zm0 6a10 10 0 110 20 10 10 0 010-20zm0 6a4 4 0 100 8 4 4 0 000-8z' },
  streaks: { name: 'STREAKS', hue: 282, icon: 'M22 2L8 22h10l-4 16 18-24H22z' },
  matches: { name: 'MATCHES', hue: 140, icon: 'M10 4h20v6a10 10 0 01-20 0zm-6 2h6v4H8a4 4 0 010-4zm26 0h6a4 4 0 010 4h-2zM17 20h6v8h5v6H12v-6h5z' },
  career: { name: 'CAREER', hue: 48, icon: 'M20 2l5 6 8-1-1 8 6 5-6 5 1 8-8-1-5 6-5-6-8 1 1-8-6-5 6-5-1-8 8 1z' },
};

export interface Challenge {
  /** 1..100, also the banner artwork number */
  n: number;
  id: string;
  name: string;
  desc: string;
  cat: ChallengeCat;
  stat: string;
  target: number;
  tier: number;
  xp: number;
}

type Spec = [cat: ChallengeCat, stat: string, name: string, desc: (n: number) => string, targets: number[]];

const W = (id: WeaponId) => WEAPONS[id].name;
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

const SPECS: Spec[] = [
  // combat (23)
  ['combat', 'kills', 'KILLER', (n) => `Get ${n} kills.`, [25, 100, 500, 1500, 5000]],
  ['combat', 'headshots', 'MARKSMAN', (n) => `Get ${n} headshot kills.`, [10, 50, 150, 400, 1000]],
  ['combat', 'longshots', 'LONGSHOT', (n) => `Get ${n} kills from over 35m.`, [10, 50, 150]],
  ['combat', 'paybacks', 'PAYBACK', (n) => `Kill ${n} players who killed you last.`, [5, 25, 100]],
  ['combat', 'first_bloods', 'FIRST BLOOD', (n) => `Get the first kill of a match ${n} times.`, [5, 25]],
  ['combat', 'double', 'DOUBLE TAP', (n) => `Get ${n} double kills (two kills within 3s).`, [10, 50, 150]],
  ['combat', 'triple', 'TRIPLE THREAT', (n) => `Get ${n} triple kills.`, [5, 25]],
  // weapons (22)
  ['weapons', 'kills_kr4', W('kr4'), (n) => `Get ${n} kills with the ${W('kr4')}.`, [50, 250, 750, 1500]],
  ['weapons', 'kills_vk47', W('vk47'), (n) => `Get ${n} kills with the ${W('vk47')}.`, [50, 250, 750, 1500]],
  ['weapons', 'kills_p9', W('p9'), (n) => `Get ${n} kills with the ${W('p9')}.`, [25, 100, 300]],
  ['weapons', 'kills_r357', W('r357'), (n) => `Get ${n} kills with the ${W('r357')}.`, [25, 100, 300]],
  ['weapons', 'suppressed_kills', 'SILENT', (n) => `Get ${n} kills with a suppressed weapon.`, [25, 150, 500]],
  ['weapons', 'gold_weapons', 'GOLDSMITH', (n) => `Unlock gold camo on ${n} weapon${n > 1 ? 's' : ''}.`, [1, 2, 4]],
  ['weapons', 'mastery', 'MASTERY', (n) => `Unlock ${n} mastery camo${n > 1 ? 's' : ''}.`, [1, 2]],
  // tactics (19)
  ['tactics', 'frag_kills', 'GRENADIER', (n) => `Get ${n} frag grenade kills.`, [5, 25, 100, 250]],
  ['tactics', 'hip_kills', 'HIP FIRE', (n) => `Get ${n} kills without aiming down sights.`, [50, 250]],
  ['tactics', 'ads_kills', 'DEAD EYE', (n) => `Get ${n} kills while aiming down sights.`, [100, 500]],
  ['tactics', 'crouch_kills', 'LOW PROFILE', (n) => `Get ${n} kills while crouched.`, [25, 100]],
  ['tactics', 'slide_kills', 'SLIDER', (n) => `Get ${n} kills while sliding.`, [5, 25, 100]],
  ['tactics', 'air_kills', 'AIRBORNE', (n) => `Get ${n} kills while in the air.`, [5, 25]],
  ['tactics', 'stunned_enemies', 'FLASHBANG', (n) => `Stun ${n} enemies with stun grenades.`, [10, 50]],
  ['tactics', 'stunned_kills', 'SEEING STARS', (n) => `Kill ${n} stunned enemies.`, [10, 50]],
  // streaks (11)
  ['streaks', 'streak3', 'ON A ROLL', (n) => `Get a 3-kill streak ${n} times.`, [5, 25, 100]],
  ['streaks', 'streak5', 'UNSTOPPABLE', (n) => `Get a 5-kill streak ${n} times.`, [5, 25, 75]],
  ['streaks', 'streak10', 'NUCLEAR', (n) => `Get a 10-kill streak ${n} time${n > 1 ? 's' : ''}.`, [1, 10, 25]],
  ['streaks', 'sweeps', 'EYE IN THE SKY', (n) => `Launch ${n} radar sweeps.`, [5, 25]],
  // matches (19)
  ['matches', 'matches', 'REGULAR', (n) => `Finish ${n} matches.`, [10, 50]],
  ['matches', 'wins', 'WINNER', (n) => `Win ${n} matches (TDM win or FFA 1st).`, [5, 25, 100]],
  ['matches', 'tdm_wins', 'SQUAD UP', (n) => `Win ${n} Team Deathmatch games.`, [10, 50]],
  ['matches', 'ffa_wins', 'LONE WOLF', (n) => `Place 1st in ${n} Free-for-All games.`, [5, 25]],
  ['matches', 'win_depot', 'DEPOT', (n) => `Win ${n} matches on Depot.`, [10]],
  ['matches', 'win_outpost', 'OUTPOST', (n) => `Win ${n} matches on Outpost.`, [10]],
  ['matches', 'win_whiteout', 'WHITEOUT', (n) => `Win ${n} matches on Whiteout.`, [10]],
  ['matches', 'win_hardened', 'HARDENED', (n) => `Win ${n} matches against Hardened bots.`, [5]],
  ['matches', 'win_veteran', 'VETERAN', (n) => `Win ${n} matches against Veteran bots.`, [1, 10]],
  ['matches', 'best_match_kills', 'RAMPAGE', (n) => `Get ${n} kills in a single match.`, [20, 30]],
  ['matches', 'flawless', 'FLAWLESS', (n) => `Win ${n} match${n > 1 ? 'es' : ''} without dying.`, [1, 5]],
  // career (6)
  ['career', 'level', 'RANKED UP', (n) => `Reach level ${n}.`, [10, 25, 50]],
  ['career', 'prestige', 'PRESTIGE', (n) => `Enter prestige ${n}.`, [1, 5, 10]],
];

export const CHALLENGES: Challenge[] = SPECS.flatMap(([cat, stat, name, desc, targets]) =>
  targets.map((target, i) => ({
    n: 0,
    id: `${stat}_${target}`,
    name: targets.length > 1 ? `${name} ${ROMAN[i]}` : name,
    desc: desc(target),
    cat,
    stat,
    target,
    tier: i + 1,
    xp: 250 * (i + 1) + (cat === 'career' ? 500 : 0),
  })),
).map((c, i) => ({ ...c, n: i + 1 }));

if (CHALLENGES.length !== 100) console.warn(`[challenges] expected 100, have ${CHALLENGES.length}`);

/** Stats derived from the profile rather than counted. */
function derived(p: Profile, stat: string, level: number): number | null {
  switch (stat) {
    case 'level':
      return Math.max(level, p.stats.level ?? 0, p.prestige > 0 ? 75 : 0);
    case 'prestige':
      return p.prestige;
    case 'gold_weapons':
      return (Object.keys(WEAPONS) as WeaponId[]).filter((w) => hasGold(p.weaponHeads, w)).length;
    case 'mastery':
      return (['ar', 'handgun'] as const).filter((c) => hasMastery(p.weaponHeads, c)).length;
    default:
      return null;
  }
}

export function statValue(p: Profile, stat: string, level: number) {
  return derived(p, stat, level) ?? p.stats[stat] ?? 0;
}

export function isDone(p: Profile, c: Challenge) {
  return p.challenges.includes(c.id);
}

/** Mark newly completed challenges; returns them (the caller pays XP and announces). */
export function checkChallenges(p: Profile, level: number): Challenge[] {
  const fresh: Challenge[] = [];
  for (const c of CHALLENGES) {
    if (isDone(p, c)) continue;
    if (statValue(p, c.stat, level) >= c.target) {
      p.challenges.push(c.id);
      fresh.push(c);
    }
  }
  return fresh;
}

export function bump(p: Profile, stat: string, by = 1) {
  p.stats[stat] = (p.stats[stat] ?? 0) + by;
}

export function bumpMax(p: Profile, stat: string, value: number) {
  p.stats[stat] = Math.max(p.stats[stat] ?? 0, value);
}

export const challengeById = (id: string) => CHALLENGES.find((c) => c.id === id);
