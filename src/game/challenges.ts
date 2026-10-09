import { hasGold, hasMastery, WEAPONS, type WeaponId, type WeaponClassId } from './loadout';
import { MAPS } from './maps';
import { asset } from './assets';
import type { Profile } from './progression';

/**
 * 100 challenges, one per calling card in the Dead Pixels card pack (20 themes x 5 tiers).
 * Each tracks a stat counter on the profile; completing it pays XP and unlocks that card.
 * Where the pack's suggested unlock needs something the game doesn't have (water, prone,
 * shotguns, dog tags...), the challenge is swapped for a measurable one that fits the title.
 *
 * Artwork lives in public/game/cards/<theme>_<tier>.png (512x128); see assets.ts.
 */

export interface Theme {
  key: string;
  name: string;
  titles: string[];
}

export const THEMES: Theme[] = [
  { key: 'glitch', name: 'DEAD PIXEL', titles: ['Stuck Pixel', 'Blue Screen', '404 Not Found', 'Corrupted', 'Dead Pixel'] },
  { key: 'lag', name: 'NETCODE', titles: ['Buffering...', 'Packet Loss', 'Rubber Banding', '999 Ping', 'Teleporter'] },
  { key: 'arcade', name: 'ARCADE', titles: ['Insert Coin', 'Button Masher', 'Extra Life', 'Continue?', 'High Score'] },
  { key: 'salt', name: 'SALT MINE', titles: ['Salty', 'Tilted', 'Mad Lad', 'Rage Quit', 'Salt Baron'] },
  { key: 'tea', name: 'TEA TIME', titles: ["Kettle's On", 'Biscuit Dunker', 'Milk 2 Sugars', "Builder's Tea", 'Tea Leaf'] },
  { key: 'snack', name: 'SNACK OPS', titles: ['Snack Break', 'Extra Cheese', 'Double Dipper', 'Crumb Commando', 'Cold Pizza Club'] },
  { key: 'toast', name: 'TOASTER', titles: ['Toasted', 'Pop Up Ambush', 'Well Done', 'Burnt Out', "You're Toast"] },
  { key: 'duck', name: 'BATH TIME', titles: ['Bath Time', 'Lucky Duck', 'Duck & Cover', 'Fowl Play', 'Quack Shot'] },
  { key: 'cats', name: 'CAT CLUB', titles: ['Cat Nap', 'Hiss Fit', 'Laser Pointer', 'Nine Lives', 'Purrfect Aim'] },
  { key: 'dino', name: 'JURASSIC', titles: ['Rawr', 'Tiny Arms', 'Fossil Fuel', 'Meteor Shower', 'Extinction Event'] },
  { key: 'gnome', name: 'GNOME GARDEN', titles: ['Lawn Ranger', 'Hedge Hunter', 'Gnomad', 'Gnome Alone', 'Gnome Sweet Gnome'] },
  { key: 'sloth', name: 'SLOTH SQUAD', titles: ['AFK', 'Nap Time', 'Hang Time', 'Slow & Steady', 'Camper'] },
  { key: 'bees', name: 'HIVE', titles: ['Bee Line', 'Buzz Kill', 'Hive Mind', 'Sting Operation', 'Queen Bee'] },
  { key: 'pirate', name: 'HIGH SEAS', titles: ['Scallywag', 'Plunderer', 'Walk the Plank', 'X Marks the Spot', 'Shiver Me Timbers'] },
  { key: 'ufo', name: 'CLOSE ENCOUNTERS', titles: ['Space Cadet', 'Crop Circles', 'Abducted', 'Little Green Man', 'Out of This World'] },
  { key: 'disco', name: 'BOOGIE NIGHTS', titles: ['Dance Off', 'Glitter Bomb', 'Funky Flanker', 'Mirrorball', 'Groove Sniper'] },
  { key: 'volcano', name: 'HOT ZONE', titles: ['Hot Head', 'Meltdown', 'Magma Mode', 'Eruption', 'The Floor is Lava'] },
  { key: 'fireworks', name: 'BONFIRE NIGHT', titles: ['Sparkler', 'Bottle Rocket', 'Oooh Aaah', 'Big Bang', 'Grand Finale'] },
  { key: 'bowling', name: 'LANE 7', titles: ['Gutter Ball', 'Spare Me', 'Split Happens', 'Strike!', 'Perfect 300'] },
  { key: 'shop', name: 'AISLE 5', titles: ['Meal Deal', 'Bag for Life', 'Reduced to Clear', 'Clean Up Aisle 5', 'Unexpected Item'] },
];

export const TIER_NAMES = ['GUNMETAL', 'BRONZE', 'SILVER', 'GOLD', 'GOLD MASTERY'];

export interface Challenge {
  /** 1..100 in pack order */
  n: number;
  /** card id, also the artwork file name: <theme>_<tier> */
  id: string;
  name: string;
  desc: string;
  theme: string;
  tier: number;
  stat: string;
  target: number;
  xp: number;
}

/** [stat, target, description] per card, in pack order (theme by theme, tiers 1-5). */
const SPECS: Record<string, [string, number, string][]> = {
  glitch: [
    ['still_kills', 10, 'Get 10 kills without moving.'],
    ['streaks_used', 25, 'Call in 25 killstreaks.'],
    ['suppressed_kills', 25, 'Get 25 kills with a suppressor (off the radar).'],
    ['streak_kills', 25, 'Get 25 kills with killstreaks.'],
    ['kills', 1000, 'Get 1,000 kills.'],
  ],
  lag: [
    ['matches', 10, 'Play 10 matches.'],
    ['loss_run', 5, 'Lose 5 matches in a row.'],
    ['reflex_kills', 25, 'Get 25 kills within 2 seconds of being shot.'],
    ['comebacks', 1, 'Win a match you were losing at half time.'],
    ['spawn3_kills', 50, 'Get 50 kills within 3 seconds of respawning.'],
  ],
  arcade: [
    ['matches', 1, 'Finish your first match.'],
    ['melee_kills', 50, 'Get 50 melee kills.'],
    ['clutch_survivals', 25, 'Survive 25 times on under 10% health.'],
    ['spawn5_kills', 50, 'Get a kill within 5 seconds of respawning 50 times.'],
    ['top_finishes', 25, 'Finish top of the scoreboard 25 times.'],
  ],
  salt: [
    ['nemesis', 1, 'Get killed by the same enemy 5 times in one match.'],
    ['death_run', 10, 'Die 10 times in a row in one match.'],
    ['no_reload_15', 1, 'Get 15 kills in one match without reloading.'],
    ['blowouts', 10, 'Win 10 matches by 10 or more kills.'],
    ['paybacks', 100, 'Get 100 revenge kills.'],
  ],
  tea: [
    ['time_played', 3600, 'Play for 60 minutes.'],
    ['crouch_kills', 25, 'Get 25 kills while crouched.'],
    ['quick_doubles', 25, 'Get 2 kills within 2 seconds, 25 times.'],
    ['equipment_used', 50, 'Throw 50 pieces of equipment.'],
    ['steals', 50, 'Finish off 50 enemies a teammate damaged.'],
  ],
  snack: [
    ['packages', 25, 'Collect 25 supply drops.'],
    ['headshots', 50, 'Get 50 headshot kills.'],
    ['double', 50, 'Get 50 double kills.'],
    ['kills_cls_marksman', 25, 'Get 25 kills with marksman rifles.'],
    ['night_wins', 1, 'Win a match between midnight and 5am.'],
  ],
  toast: [
    ['frag_kills', 10, 'Get 10 frag grenade kills.'],
    ['ambush_kills', 25, 'Get 25 kills on enemies who never saw you.'],
    ['wins', 50, 'Win 50 matches.'],
    ['deaths', 500, 'Die 500 times.'],
    ['explosive_kills', 100, 'Get 100 explosive kills.'],
  ],
  duck: [
    ['kills_streak_sentry', 10, 'Get 10 kills with the Sentry Gun.'],
    ['final_kill_wins', 5, 'Win 5 matches with the final kill.'],
    ['explosion_survivals', 25, 'Survive 25 explosions on under 20% health.'],
    ['crouchspam_kills', 25, 'Get 25 kills while crouch-spamming.'],
    ['noscope_kills', 50, 'Get 50 no-scope sniper kills.'],
  ],
  cats: [
    ['crouch_time', 600, 'Spend 10 minutes crouched.'],
    ['low_hp_kills', 10, 'Get 10 kills on under 10% health.'],
    ['laser_kills', 100, 'Get 100 kills with a laser sight.'],
    ['nine_lives', 1, 'Win a match with 9 or more deaths.'],
    ['head_run', 10, 'Get 10 headshot kills in a row.'],
  ],
  dino: [
    ['melee_kills', 25, 'Get 25 melee kills.'],
    ['kills_cls_handgun', 50, 'Get 50 pistol kills.'],
    ['gold_kills', 50, 'Get 50 kills with a gold-camo weapon.'],
    ['kills_streak_airstrike', 25, 'Get 25 Airstrike kills.'],
    ['top_streak_used', 5, 'Call in your top killstreak 5 times.'],
  ],
  gnome: [
    ['sprint_m', 10000, 'Sprint 10 km.'],
    ['smoke_kills', 25, 'Get 25 kills through smoke.'],
    ['maps_played', MAPS.length, 'Play every map.'],
    ['ffa_wins', 10, 'Win 10 Free-for-All matches.'],
    ['tdm_wins', 25, 'Win 25 Team Deathmatch matches.'],
  ],
  sloth: [
    ['afk_kills', 10, 'Get 10 kills after standing still for 10 seconds.'],
    ['crouch_kills', 100, 'Get 100 kills while crouched.'],
    ['air_kills', 25, 'Get 25 kills while airborne.'],
    ['nosprint_wins', 10, 'Win 10 matches without sprinting.'],
    ['camp_kills', 100, 'Get 100 kills from the same spot as your last kill.'],
  ],
  bees: [
    ['sprint_kills', 50, 'Get 50 kills within a second of sprinting.'],
    ['buzzkills', 25, 'End 25 enemy kill streaks of 3 or more.'],
    ['assists', 50, 'Get 50 assists.'],
    ['melee_back', 25, 'Get 25 melee kills from behind.'],
    ['mvp', 10, 'Win a match as its top player 10 times.'],
  ],
  pirate: [
    ['kills_r357', 25, 'Get 25 kills with the R-357 Magnum.'],
    ['kills_cls_ar', 250, 'Get 250 assault rifle kills.'],
    ['stunned_kills', 10, 'Get 10 kills on stunned enemies.'],
    ['streak_kills', 50, 'Get 50 kills with killstreaks.'],
    ['kills_cls_heavy', 100, 'Get 100 kills with heavy weapons.'],
  ],
  ufo: [
    ['level', 10, 'Reach level 10.'],
    ['slide_kills', 25, 'Get 25 kills while sliding.'],
    ['air_streak_kills', 10, 'Get 10 kills with an air killstreak.'],
    ['sweep_kills', 50, 'Get 50 kills while your Radar Sweep is active.'],
    ['longshots', 10, 'Get 10 longshot kills.'],
  ],
  disco: [
    ['melee_trades', 25, 'Get 25 melee kills within 3 seconds of being shot.'],
    ['stunned_kills', 50, 'Get 50 kills on stunned enemies.'],
    ['flank_kills', 50, 'Get 50 kills from the side or behind.'],
    ['stunned_enemies', 25, 'Stun 25 enemies.'],
    ['sniper_move_kills', 25, 'Get 25 sniper kills while moving.'],
  ],
  volcano: [
    ['kills_30s', 10, 'Get 10 kills in 30 seconds.'],
    ['deaths_30s', 3, 'Die 3 times in 30 seconds.'],
    ['streak5', 50, 'Get 5 kills in one life 50 times.'],
    ['kills_10s', 5, 'Get 5 kills in 10 seconds.'],
    ['air_kills', 50, 'Get 50 kills while airborne.'],
  ],
  fireworks: [
    ['hip_kills', 25, 'Get 25 hip-fire kills.'],
    ['kills_streak_mortar', 25, 'Get 25 Mortar Strike kills.'],
    ['explosive_multi', 10, 'Get 10 explosive double kills.'],
    ['explosive_best', 5, 'Get 5 kills with one explosive.'],
    ['final_kills', 50, 'Get the final kill of the match 50 times.'],
  ],
  bowling: [
    ['shots_fired', 10000, 'Fire 10,000 rounds.'],
    ['clutch_kills', 10, 'Win 10 gunfights on under 5% health.'],
    ['collaterals', 10, 'Get 10 collateral kills (one sniper round, two kills).'],
    ['frag_triple', 1, 'Kill 3 enemies with one grenade.'],
    ['best_match_score', 3000, 'Score 3,000 points in one match.'],
  ],
  shop: [
    ['meal_deal', 1, 'Get 3 kills with 3 different weapons in one life.'],
    ['deathless', 5, 'Finish 5 matches without dying.'],
    ['finisher_kills', 50, 'Get 50 kills on enemies under 50% health.'],
    ['smg_close_kills', 100, 'Get 100 SMG kills within 10 metres.'],
    ['crash_used', 1, 'Call in a System Crash.'],
  ],
};

export const CHALLENGES: Challenge[] = THEMES.flatMap((t) =>
  SPECS[t.key].map(([stat, target, desc], i) => ({
    n: 0,
    id: `${t.key}_${i + 1}`,
    name: t.titles[i].toUpperCase(),
    desc,
    theme: t.key,
    tier: i + 1,
    stat,
    target,
    xp: [250, 500, 1000, 2000, 4000][i],
  })),
).map((c, i) => ({ ...c, n: i + 1 }));

/** Card artwork URL: inlined data in the single-file build, else the served PNG. */
export function cardArt(id: string) {
  return asset(`cards/${id}.png`);
}

/** Stats derived from the profile rather than counted. */
function derived(p: Profile, stat: string, level: number): number | null {
  switch (stat) {
    case 'level':
      return Math.max(level, p.stats.level ?? 0, p.prestige > 0 ? 75 : 0);
    case 'prestige':
      return p.prestige;
    case 'deaths':
      return p.deaths;
    case 'gold_weapons':
      return (Object.keys(WEAPONS) as WeaponId[]).filter((w) => hasGold(p.weaponHeads, w)).length;
    case 'mastery':
      return (['ar', 'smg', 'heavy', 'sniper', 'marksman', 'handgun'] as WeaponClassId[]).filter((c) => hasMastery(p.weaponHeads, c)).length;
    case 'maps_played':
      return MAPS.filter((m) => (p.stats[`played_${m.id}`] ?? 0) > 0).length;
    case 'time_played':
    case 'crouch_time':
    case 'sprint_m':
      return Math.floor(p.stats[stat] ?? 0);
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
