import type { Choice } from './loadout';
import { MAX_LEVEL, rankName, rankTier, xpForLevel, levelForXp, type Profile } from './progression';

/**
 * Banners, rank insignia, prestige emblems and soldier looks.
 * Everything is procedural (CSS / SVG) so it ships inline; uploaded artwork
 * can replace any emblem by adding an image URL to EMBLEM_IMAGES.
 */

/** Drop-in artwork: key `prestige-1`..`prestige-10` or `rank-0`..`rank-16` -> image URL / data URI. */
export const EMBLEM_IMAGES: Record<string, string> = {};

export interface Banner {
  id: string;
  name: string;
  level?: number;
  prestige?: number;
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
  { id: 'commander', name: 'COMMANDER', level: 85, bg: 'linear-gradient(90deg,#0b0809,#2a1f10)', motif: star },
  ...Array.from({ length: 10 }, (_, i) => ({
    id: `prestige${i + 1}`,
    name: `PRESTIGE ${i + 1}`,
    prestige: i + 1,
    bg: `linear-gradient(115deg, hsl(${(i * 36 + 200) % 360} 50% 12%), hsl(${(i * 36 + 200) % 360} 60% 32%) 60%, hsl(${(i * 36 + 220) % 360} 70% 50%))`,
    motif: star,
  })),
];

export function bannerUnlocked(b: Banner, level: number, prestige: number, all = false) {
  if (all) return true;
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

// ---------------------------------------------------------------- insignia / emblems

const PRESTIGE_COLORS = ['#c58a4a', '#c0c4c8', '#e2b84a', '#5fb0d8', '#4ac08a', '#b05ad8', '#d84a5a', '#e8e8e8', '#4a4a4a', '#f2d36b'];

/** Rank insignia (prestige 0) or prestige emblem, as an inline SVG/IMG string. */
export function badge(level: number, prestige: number, size = 56): string {
  const key = prestige > 0 ? `prestige-${prestige}` : `rank-${rankTier(level)}`;
  if (EMBLEM_IMAGES[key]) return `<img src="${EMBLEM_IMAGES[key]}" width="${size}" height="${size}" alt="">`;
  if (prestige > 0) {
    const c = PRESTIGE_COLORS[prestige - 1];
    const stars = Array.from({ length: Math.min(prestige, 5) }, (_, i) => {
      const x = 32 + (i - (Math.min(prestige, 5) - 1) / 2) * 9;
      return `<path transform="translate(${x - 4} 47) scale(.2)" fill="${c}" d="M20 3l5 11 12 1-9 8 3 12-11-6-11 6 3-12-9-8 12-1z"/>`;
    }).join('');
    return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" aria-label="Prestige ${prestige}">
      <path d="M32 3l25 10v18c0 15-11 26-25 30C18 57 7 46 7 31V13z" fill="#0d0b0c" stroke="${c}" stroke-width="3"/>
      <path d="M32 10l18 7v13c0 11-8 19-18 22-10-3-18-11-18-22V17z" fill="${c}" opacity=".18"/>
      <text x="32" y="38" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="800" font-size="22" fill="${c}">${prestige}</text>
      ${stars}</svg>`;
  }
  const tier = rankTier(level);
  const gold = '#f2d36b';
  let shapes = '';
  if (tier < 10) {
    // enlisted: chevrons, then chevrons + rockers
    const chev = Math.min(3, tier + 1);
    for (let i = 0; i < chev; i++) shapes += `<path d="M14 ${20 + i * 8}l18-9 18 9v5l-18-9-18 9z" fill="${gold}"/>`;
    const rock = Math.max(0, tier - 2);
    for (let i = 0; i < Math.min(rock, 3); i++) shapes += `<path d="M14 ${44 + i * 6}q18 8 36 0v4q-18 8-36 0z" fill="${gold}" opacity=".85"/>`;
  } else if (tier < 12) {
    for (let i = 0; i < tier - 9; i++) shapes += `<rect x="${26 + i * 8 - (tier - 10) * 4}" y="16" width="6" height="32" rx="1" fill="${gold}"/>`;
  } else if (tier < 16) {
    const n = tier - 11;
    for (let i = 0; i < n; i++) shapes += `<path transform="translate(${32 + (i - (n - 1) / 2) * 14 - 8} 22) scale(.4)" fill="${gold}" d="M20 2c6 8 14 10 18 18-4 8-12 10-18 18-6-8-14-10-18-18 4-8 12-10 18-18z"/>`;
  } else {
    shapes = `<path transform="translate(14 14) scale(.9)" fill="${gold}" d="M20 3l5 11 12 1-9 8 3 12-11-6-11 6 3-12-9-8 12-1z"/>`;
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" aria-label="Level ${level}">
    <rect x="3" y="3" width="58" height="58" rx="6" fill="#0d0b0c" stroke="rgba(242,211,107,.5)" stroke-width="2"/>${shapes}</svg>`;
}

/** The calling-card style player banner. */
export function playerCard(p: Profile, opts: { compact?: boolean } = {}) {
  const level = levelForXp(p.xp);
  const b = bannerById(p.banner);
  const base = xpForLevel(level);
  const need = level >= MAX_LEVEL ? 1 : xpForLevel(level + 1) - base;
  const pct = level >= MAX_LEVEL ? 100 : Math.min(100, ((p.xp - base) / need) * 100);
  const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
  return `<div class="pcard ${opts.compact ? 'compact' : ''}" style="background:${b.bg}">
    ${b.motif ? `<div class="pc-motif">${b.motif}</div>` : ''}
    <div class="pc-badge">${badge(level, p.prestige, opts.compact ? 46 : 58)}</div>
    <div class="pc-text"><div class="pc-name">${esc(p.callsign)}</div>
      <div class="pc-rank">${p.prestige ? `PRESTIGE ${p.prestige} · ` : ''}LVL ${level} · ${rankName(level)}</div></div>
    <div class="pc-bar"><i style="width:${pct}%"></i></div>
  </div>`;
}
