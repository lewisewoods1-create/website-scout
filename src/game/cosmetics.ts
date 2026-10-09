import type { Choice } from './loadout';
import { MAX_LEVEL, xpForLevel, levelForXp, type Profile } from './progression';
import { badgeImg, rankInfo } from './badges';
import { CHALLENGES, cardArt } from './challenges';
import { asset } from './assets';

/**
 * Banners (calling cards), soldier looks and the player card.
 * Rank and prestige badges come from the Dead Pixels badge pack (badges.ts).
 */

export interface Banner {
  id: string;
  name: string;
  level?: number;
  prestige?: number;
  /** unlocked by completing this challenge id */
  challenge?: string;
  /** calling-card artwork (title is drawn into the art) */
  art?: string;
  /** animated banner: 6x6 sprite sheet, 36 frames on the prestige badge clock */
  sheet?: string;
  bg: string;
  motif?: string;
}

const skyline = `<svg viewBox="0 0 200 40" preserveAspectRatio="none"><path fill="#140d10" d="M0 40V26h12v-8h10v12h8V14h14v16h6V20h12v-6h6v26h10V22h18v18h8V12h16v28h10V24h12v16h14V18h10v22z"/></svg>`;
const skull = `<svg viewBox="0 0 40 40"><path fill="rgba(255,255,255,.85)" d="M20 4C11 4 5 10 5 18c0 5 2 8 5 10v5h5v-3h3v3h4v-3h3v3h5v-5c3-2 5-5 5-10 0-8-6-14-15-14zm-6 18a4 4 0 110-8 4 4 0 010 8zm12 0a4 4 0 110-8 4 4 0 010 8zm-6 3l-2-4h4z"/></svg>`;
const star = `<svg viewBox="0 0 40 40"><path fill="#f2d36b" d="M20 3l5 11 12 1-9 8 3 12-11-6-11 6 3-12-9-8 12-1z"/></svg>`;
const pixel = `<svg viewBox="0 0 8 8" shape-rendering="crispEdges"><path fill="#f2d36b" d="M1 1h2v2H1zM5 1h2v2H5zM3 3h2v2H3zM1 5h6v1H1zM2 6h4v1H2z"/></svg>`;

export const BANNERS: Banner[] = [
  { id: 'recruit', name: 'RECRUIT', bg: 'repeating-linear-gradient(135deg,#2c3324 0 14px,#262c1f 14px 28px)' },
  { id: 'dusk', name: 'DEPOT DUSK', level: 2, bg: 'linear-gradient(180deg,#2a1638,#a2483a 62%,#e08a3c)', motif: skyline },
  { id: 'firstblood', name: 'FIRST BLOOD', level: 5, bg: 'radial-gradient(circle at 75% 40%,#b0141a,#4a0608 45%,#160304)' },
  { id: 'dither', name: 'DITHERED', level: 9, bg: 'repeating-conic-gradient(#f2d36b 0 25%,#1a1210 0 50%) 0 0/8px 8px', motif: pixel },
  { id: 'sandstorm', name: 'SANDSTORM', level: 15, bg: 'linear-gradient(170deg,#4f86c4,#efe0bf 55%,#a68c66)' },
  { id: 'whiteout', name: 'WHITEOUT', level: 25, bg: 'linear-gradient(170deg,#5f7083,#e6ebef 60%,#a3adb6)' },
  { id: 'tiger', name: 'TIGER', level: 35, bg: 'repeating-linear-gradient(115deg,#d0562a 0 10px,#1a0d0c 10px 18px,#a8301f 18px 26px)' },
  { id: 'nightops', name: 'NIGHT OPS', level: 45, bg: 'repeating-linear-gradient(0deg,#0b2a12 0 2px,#124a1e 2px 4px)', motif: skull },
  { id: 'reaper', name: 'REAPER', level: 55, bg: 'linear-gradient(90deg,#050505,#2a2a2a)', motif: skull },
  { id: 'gold', name: 'GOLD STANDARD', level: 70, bg: 'linear-gradient(115deg,#7a5a1a,#f2dc8a 45%,#c9a24a 55%,#7a5a1a)' },
  { id: 'commander', name: 'COMMANDER', level: 75, bg: 'linear-gradient(90deg,#0b0809,#2a1f10)', motif: star },
  // prestige banners from the Dead Pixels pack; 4-10 animate
  ...Array.from({ length: 10 }, (_, i): Banner => {
    const n = String(i + 1).padStart(2, '0');
    const art = asset(`prestige/prestige_${n}.png`);
    const sheet = i >= 3 ? asset(`prestige/prestige_${n}_sheet.png`) : undefined;
    return {
      id: `prestige${i + 1}`,
      name: `PRESTIGE ${i + 1}`,
      prestige: i + 1,
      art,
      sheet,
      bg: sheet ? `url(${sheet}) 0 0 / 600% 600% no-repeat, #111` : `url(${art}) center / 100% 100% no-repeat, #111`,
    };
  }),
  ...CHALLENGES.map((c): Banner => ({
    id: c.id,
    name: c.name,
    challenge: c.id,
    art: cardArt(c.id),
    bg: `url(${cardArt(c.id)}) center / 100% 100% no-repeat, #111`,
  })),
];

export function bannerUnlocked(b: Banner, level: number, prestige: number, all = false, done: string[] = []) {
  if (all) return true;
  if (b.challenge) return done.includes(b.challenge);
  if (b.prestige) return prestige >= b.prestige;
  return prestige > 0 || level >= (b.level ?? 1);
}

export function bannerById(id: string) {
  return BANNERS.find((b) => b.id === id) ?? BANNERS[0];
}

// ---------------------------------------------------------------- soldier looks

export const UNIFORMS: Choice[] = [
  { id: 'desert', name: 'DESERT MULTI', desc: 'Tan multi-terrain pattern.', swatch: '#8a7a58' },
  { id: 'woodland', name: 'WOODLAND', desc: 'Green-brown forest pattern.', level: 10, swatch: '#55594a' },
  { id: 'urban', name: 'URBAN GREY', desc: 'Concrete greys.', level: 18, swatch: '#7c8086' },
  { id: 'night', name: 'NIGHT', desc: 'Black and charcoal.', level: 30, swatch: '#26282b' },
];
export const GEAR: Choice[] = [
  { id: 'coyote', name: 'COYOTE', desc: 'Tan plate carrier and pouches.', swatch: '#7b6a4f' },
  { id: 'ranger', name: 'RANGER GREEN', desc: '', swatch: '#4a4d3c' },
  { id: 'black', name: 'BLACK', desc: '', level: 14, swatch: '#222' },
];
export const HEADGEAR: Choice[] = [
  { id: 'nvg', name: 'HELMET + NVG', desc: 'Night vision flipped up.' },
  { id: 'helmet', name: 'HELMET', desc: 'Clean high-cut helmet.' },
  { id: 'boonie', name: 'BOONIE HAT', desc: 'Soft hat and headset.', level: 22 },
];

// ---------------------------------------------------------------- badges

/** Rank insignia or prestige emblem from the Dead Pixels badge pack. */
export function badge(level: number, prestige: number, size = 56): string {
  return badgeImg(level, prestige, size);
}

/** The calling-card style player banner. */
export function playerCard(p: Profile, opts: { compact?: boolean } = {}) {
  const level = levelForXp(p.xp);
  const b = bannerById(p.banner);
  const base = xpForLevel(level);
  const need = level >= MAX_LEVEL ? 1 : xpForLevel(level + 1) - base;
  const pct = level >= MAX_LEVEL ? 100 : Math.min(100, ((p.xp - base) / need) * 100);
  const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
  if (b.art) {
    // calling card: keep the artwork (and its title) clear, name strip underneath
    return `<div class="pcard art ${opts.compact ? 'compact' : ''}">
      <div class="pc-art" style="background:${b.bg}"${b.sheet ? ' data-psheet' : ''}></div>
      <div class="pc-strip"><div class="pc-badge">${badge(level, p.prestige, opts.compact ? 34 : 40)}</div>
        <div class="pc-text"><div class="pc-name">${esc(p.callsign)}</div>
        <div class="pc-rank">${p.prestige ? `PRESTIGE ${p.prestige} · ` : ''}LVL ${level} · ${rankInfo(level).name.toUpperCase()}</div></div></div>
      <div class="pc-bar"><i style="width:${pct}%"></i></div>
    </div>`;
  }
  return `<div class="pcard ${opts.compact ? 'compact' : ''}" style="background:${b.bg}">
    ${b.motif ? `<div class="pc-motif">${b.motif}</div>` : ''}
    <div class="pc-badge">${badge(level, p.prestige, opts.compact ? 52 : 68)}</div>
    <div class="pc-text"><div class="pc-name">${esc(p.callsign)}</div>
      <div class="pc-rank">${p.prestige ? `PRESTIGE ${p.prestige} · ` : ''}LVL ${level} · ${rankInfo(level).name.toUpperCase()}</div></div>
    <div class="pc-bar"><i style="width:${pct}%"></i></div>
  </div>`;
}
