import { CAC_LEVEL, EXTRA_CLASS_LEVEL, PERKS1, PERKS2, PERKS3, PRIMARY_IDS, SECONDARIES, TACTICALS, WEAPONS, WEAPON_CLASSES, type Choice } from './loadout';
import { STREAKS } from './killstreaks';
import { BANNERS, GEAR, UNIFORMS } from './cosmetics';
import { MAX_LEVEL } from './progression';

/** Everything gated by player level, grouped by the level it unlocks at. */
export function unlockTrack(): Map<number, string[]> {
  const track = new Map<number, string[]>();
  const add = (level: number | undefined, label: string) => {
    if (!level || level <= 1) return;
    track.set(level, [...(track.get(level) ?? []), label]);
  };
  const list = (items: Choice[], kind: string) => items.forEach((c) => add(c.level, `${kind}: ${c.name}`));
  // weapons first: stronger guns sit later in the 1-75 track
  PRIMARY_IDS.forEach((id) => add(WEAPONS[id].level, `${WEAPON_CLASSES[WEAPONS[id].cls].short}: ${WEAPONS[id].name}`));
  list(SECONDARIES, 'SIDEARM');
  Object.values(STREAKS).forEach((k) => add(k.level, `KILLSTREAK: ${k.name}`));
  list(TACTICALS, 'TACTICAL');
  list([...PERKS1, ...PERKS2, ...PERKS3], 'PERK');
  list(UNIFORMS, 'UNIFORM');
  list(GEAR, 'GEAR');
  BANNERS.forEach((b) => add(b.level, `BANNER: ${b.name}`));
  add(CAC_LEVEL, 'CREATE A CLASS');
  add(EXTRA_CLASS_LEVEL, 'CLASS SLOTS 4 & 5');
  return new Map([...track.entries()].sort((a, b) => a[0] - b[0]));
}

export function nextUnlock(level: number): [number, string] | null {
  for (const [l, items] of unlockTrack()) if (l > level && l <= MAX_LEVEL) return [l, items.join(' · ')];
  return null;
}
