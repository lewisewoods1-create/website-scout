# Dead Pixels — rank & prestige badges

75 level badges (25 ranks × 3 tiers) and 10 prestige emblems, faceted low-poly style.

## Folders
- `svg/` — vector masters (128×128 viewBox). Animated prestige badges are exported at a still frame.
- `png/32`, `png/64`, `png/128`, `png/256` — transparent PNGs. For a 480p HUD use 32 or 64 and scale with nearest-neighbour filtering.
- `sprites/` — animated prestige 4–10 as 6×6 grid sheets (36 frames, 12 fps, 3s seamless loop), at 64px and 128px per frame. Frames run left-to-right, top-to-bottom.
- `ranks.json` — level → rank/tier/icon map and prestige metadata, ready to load into the game.

## Tiers
Each rank spans three levels. The pips under the insignia show the tier (I, II, III).

| Levels | Rank | Abbr | Family |
|---|---|---|---|
| 1–3 | Private | PVT | Enlisted |
| 4–6 | Private First Class | PFC | Enlisted |
| 7–9 | Specialist | SPC | Enlisted |
| 10–12 | Corporal | CPL | Enlisted |
| 13–15 | Sergeant | SGT | Enlisted |
| 16–18 | Staff Sergeant | SSG | NCO |
| 19–21 | Sergeant First Class | SFC | NCO |
| 22–24 | Master Sergeant | MSG | NCO |
| 25–27 | First Sergeant | 1SG | NCO |
| 28–30 | Sergeant Major | SGM | NCO |
| 31–33 | Command Sergeant Major | CSM | Senior NCO / Warrant |
| 34–36 | Warrant Officer | WO | Senior NCO / Warrant |
| 37–39 | Chief Warrant Officer | CWO | Senior NCO / Warrant |
| 40–42 | Second Lieutenant | 2LT | Officer |
| 43–45 | First Lieutenant | 1LT | Officer |
| 46–48 | Captain | CPT | Officer |
| 49–51 | Major | MAJ | Officer |
| 52–54 | Lieutenant Colonel | LTC | Officer |
| 55–57 | Colonel | COL | Officer |
| 58–60 | Brigadier General | BG | General |
| 61–63 | Major General | MG | General |
| 64–66 | Lieutenant General | LTG | General |
| 67–69 | General | GEN | General |
| 70–72 | General of the Army | GA | General |
| 73–75 | Commander | CMDR | Commander |

## Prestige
| # | Name | Material | Animated |
|---|---|---|---|
| 1 | Iron Sight | Steel | no |
| 2 | Bronze Wing | Bronze | no |
| 3 | Silver Blade | Silver | no |
| 4 | Gold Laurel | Gold | yes |
| 5 | Crimson Reaper | Ruby | yes |
| 6 | Emerald Venom | Emerald | yes |
| 7 | Sapphire Cryo | Sapphire | yes |
| 8 | Amethyst Void | Amethyst | yes |
| 9 | Obsidian Sovereign | Obsidian & Gold | yes |
| 10 | Inferno | Molten | yes |

## Source
`source/badges.js` is the generator (no dependencies, runs in Node or the browser). `levelBadge(n)` and `prestigeBadge(n, phase)` return SVG strings, so you can render at any resolution or re-tune colours, plate shapes and animation in one place. `source/export.js` rebuilds this whole pack (`npm i @resvg/resvg-js`, then `node export.js`).
