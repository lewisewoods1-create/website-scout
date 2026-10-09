/**
 * Art served from public/game/ (cards/, prestige/, camos/). The single-file build
 * inlines everything as data URIs in globalThis.__DP_ASSETS, keyed by the same path.
 */
export function asset(path: string): string {
  const inline = (globalThis as unknown as { __DP_ASSETS?: Record<string, string> }).__DP_ASSETS;
  return inline?.[path] ?? path;
}
