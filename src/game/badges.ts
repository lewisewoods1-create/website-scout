import './vendor/badges.js';

/**
 * Rank and prestige badges from the Dead Pixels badge pack. The pack's own
 * generator (vendor/badges.js) renders every badge as vector SVG, so badges
 * stay sharp at any size and prestige 4-10 can animate live.
 */
interface BadgeApi {
  levelBadge(level: number): string;
  prestigeBadge(n: number, phase?: number, idSuffix?: string): string;
  rankOf(level: number): { level: number; rankIndex: number; tier: number; name: string; abbr: string };
  PRESTIGE: { name: string; material: string; animated: boolean }[];
  LOOP: number;
  FRAMES: number;
}

const B = (globalThis as unknown as { DeadPixelsBadges: BadgeApi }).DeadPixelsBadges;

/** The pack draws 75 levels (25 ranks x 3 tiers), matching MAX_LEVEL. */
export const ART_MAX_LEVEL = 75;

const uriCache = new Map<string, string>();
const toUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

function staticUri(level: number, prestige: number) {
  const key = prestige > 0 ? `p${prestige}` : `l${Math.min(level, ART_MAX_LEVEL)}`;
  let u = uriCache.get(key);
  if (!u) {
    u = toUri(prestige > 0 ? B.prestigeBadge(prestige) : B.levelBadge(Math.min(level, ART_MAX_LEVEL)));
    uriCache.set(key, u);
  }
  return u;
}

function frameUri(prestige: number, frame: number) {
  const key = `p${prestige}f${frame}`;
  let u = uriCache.get(key);
  if (!u) {
    u = toUri(B.prestigeBadge(prestige, frame / B.FRAMES, `f${frame}`));
    uriCache.set(key, u);
  }
  return u;
}

export function isAnimated(prestige: number) {
  return prestige > 0 && !!B.PRESTIGE[prestige - 1]?.animated;
}

/** <img> markup for a player's badge: prestige emblem if prestiged, otherwise rank insignia. */
export function badgeImg(level: number, prestige: number, size = 56, animate = true) {
  const anim = animate && isAnimated(prestige) ? ` data-anim="${prestige}"` : '';
  const label = prestige > 0 ? `Prestige ${prestige}: ${prestigeName(prestige)}` : `Level ${level}: ${rankInfo(level).name}`;
  return `<img class="badge" src="${staticUri(level, prestige)}" width="${size}" height="${size}" alt="${label}" title="${label}"${anim} draggable="false">`;
}

// Small raster copies for busy, fast-changing UI (the in-match scoreboard): the
// browser decodes a tiny PNG far faster than re-rasterising a detailed SVG.
const thumbs = new Map<string, string>();
// holds each loading Image so it can't be garbage-collected before it fires
const thumbPending = new Map<string, HTMLImageElement>();
let thumbVer = 0;
/** Bumps whenever a new thumbnail finishes, so cached markup can refresh. */
export const thumbVersion = () => thumbVer;

/** Static (non-animated) badge for small sizes; falls back to the SVG until the raster is ready. */
export function badgeThumb(level: number, prestige: number, size: number) {
  const key = `${prestige > 0 ? `p${prestige}` : `l${Math.min(level, ART_MAX_LEVEL)}`}@${size}`;
  const url = thumbs.get(key);
  if (!url) {
    if (!thumbPending.has(key)) {
      const px = Math.ceil(size * Math.min(2, window.devicePixelRatio || 1));
      const img = new Image();
      thumbPending.set(key, img);
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = c.height = px;
        c.getContext('2d')!.drawImage(img, 0, 0, px, px);
        // a tiny PNG (a few KB) instead of the full vector source
        thumbs.set(key, c.toDataURL('image/png'));
        thumbPending.delete(key);
        thumbVer++;
      };
      img.src = staticUri(level, prestige);
    }
    return badgeImg(level, prestige, size, false);
  }
  return `<img class="badge" src="${url}" width="${size}" height="${size}" alt="" draggable="false">`;
}

export function rankInfo(level: number) {
  const r = B.rankOf(Math.min(level, ART_MAX_LEVEL));
  return { name: r.name, abbr: r.abbr, tier: r.tier };
}

export function prestigeName(n: number) {
  return B.PRESTIGE[n - 1]?.name ?? '';
}

/** Drive animated prestige badges (12 fps loop) anywhere in the document. */
export function startBadgeAnimation() {
  const fps = B.FRAMES / B.LOOP;
  let last = 0;
  const tick = (t: number) => {
    if (t - last >= 1000 / fps) {
      last = t;
      const frame = Math.floor((t / 1000) * fps) % B.FRAMES;
      document.querySelectorAll<HTMLImageElement>('img.badge[data-anim]').forEach((img) => {
        if (!img.offsetParent) return; // hidden
        img.src = frameUri(Number(img.dataset.anim), frame);
      });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

