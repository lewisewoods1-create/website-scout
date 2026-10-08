# DEAD PIXEL: plan for the next phases

Status: Phase 0–1 playable (bot TDM/FFA, create-a-class, 3 maps, local progression).
Everything below is a proposal to agree before building.

---

## 1. Launching on the web (own site, multiplayer optional)

### Goal
A public URL (e.g. `deadpixel.gg`) where anyone can play bot matches instantly with no install and no account. Signing in unlocks saved progression and, later, online play. Multiplayer is a switch we can turn on per environment.

### Steps
| Step | What | Notes |
|---|---|---|
| 1. Split the game out | Move `game/` + `src/game/` into its own repo/app (it already builds as a separate Vite entry) | Keeps the scout app clean. One `vite build` gives static files only. |
| 2. Static hosting | Netlify or Vercel, custom domain, CDN | Bot mode needs no server, so hosting is near-free. |
| 3. Accounts + cloud saves | Supabase Auth (email, Google, Discord) | Profile, classes and unlocks move from `localStorage` to tables. Local play still works when signed out; progress syncs on sign-in. |
| 4. Feature flags | `VITE_MULTIPLAYER=on/off` plus a `flags` table | The Multiplayer tab shows "Offline" until the flag and servers are live. |
| 5. Analytics + crash reports | Plausible/PostHog + Sentry | Session length, mode/map picks, FPS buckets by GPU. |
| 6. Performance budget | 60fps on a 2019 integrated GPU at 480p | Settings already expose resolution. Add auto-detect on first run. |

### Data model (Supabase)
- `profiles`: user_id, callsign, xp, level, prestige, kills, deaths, headshots, best_streak
- `classes`: user_id, slot (1–3), loadout JSON
- `unlocks`: user_id, item_id, unlocked_at (derived from level, plus crate/store items later)
- `matches` (multiplayer only): id, mode, map, started_at, result JSON
- XP from online matches is written **by the game server only**. Clients never write XP directly.

---

## 2. Multiplayer architecture (when enabled)

```
Browser client ──WebSocket──▶ Game server (Colyseus, Node) ──▶ Supabase (results, XP)
     ▲                              │
     └──── matchmaker (HTTP) ◀──────┘   regions: EU-West, US-East first
```

- **Authoritative server.** The server runs movement collision (same AABB code), hit-scan against server-side hit spheres, damage, scoring and spawns. Clients only send inputs.
- **Netcode.** 30Hz server tick. Client-side prediction for your own movement. Entity interpolation (~100ms) for other players. Lag compensation via server-side rewind of hit spheres for shots.
- **Shared code.** `map.ts` (colliders, nav), `loadout.ts` (stats) and hit logic move into a `shared/` package used by client and server, so the rules can't drift.
- **Bots fill empty slots.** The existing bot AI runs server-side, so a lobby is always 6v6 and real players replace bots as they join.
- **Matchmaking.** Quick-play by playlist (TDM, FFA first), with rough skill buckets from K/D once there's data.
- **Anti-cheat basics.** Server authority, rate limits on input, sanity checks on view angles and fire rate, and no XP writes from the client.
- **Hosting.** Fly.io or Hathora for regional game servers, autoscaled by lobby count.
- **Cost guide.** One small VM handles roughly 20–40 lobbies of 12 players at 30Hz. Start with one region.

### Rollout
1. Private test: friends-only lobby code, TDM on Depot.
2. Open beta: TDM + FFA, all 3 maps, EU only.
3. Add US region, parties, and a post-match lobby with "play again".

---

## 3. Map pool

Built: **Depot** (dusk container yard), **Outpost** (desert village), **Whiteout** (arctic station).
All maps share the 64×64m arena size and the `MapDef` format in `maps.ts`: a theme (sky, fog, light) plus a layout. Adding a map is one object.

Theme ideas to pick from (TBC):
| Theme | Hook | Size |
|---|---|---|
| Rooftops at night | Neon signs, rain, AC units as cover, one zipline | Medium |
| Abandoned mall | Two floors, escalators, glass storefronts | Medium |
| Shipwreck beach | Grounded freighter as a central multi-level structure | Large |
| Train yard in fog | Moving train that splits the map every 60s | Large |
| Server farm | Tight corridors, blinking racks, a PS1 nod in a "data core" | Small (FFA) |

Needs before more maps: stairs/ramps and a second floor in the collision and nav code (both are flat today), and per-map spawn tuning.

---

## 4. Pets (later)

A small companion that **floats just under the gun** in first person and reacts to what you do.

- **Look.** Full-res and detailed like the guns: a drone, a robot cat, a pixel ghost, a tiny dragon. Each has idle bob, blinking and a slight lag behind weapon sway.
- **Reactions** (all events already exist in code):
  - Kill: celebration spin and sound.
  - Headshot: special emote.
  - Low health: worried animation, glows red.
  - Reload: watches the magazine.
  - Killstreak ready: points at the HUD prompt.
  - Idle 10s: falls asleep.
  - Sprint: trails behind.
- **Rules.** Cosmetic only, never blocks the sight picture (it hides during ADS), and small on screen (under 6% of the view).
- **Third person.** Other players see your pet floating at your shoulder, so it's a status item in multiplayer.
- **Economy fit.** Earned from crates and challenges or bought directly. Pets also level up with you (new emotes at pet levels 5/10/20).
- **Build.** A `pet.ts` module in the viewmodel scene, driven by an event bus (`kill`, `hit`, `reload`, `lowHealth`, `streak`). Around 2–3 days for the system plus one pet.

---

## 5. Ranks, emblems and banners

- Levels 1–85, then Prestige 1–10 (manual, from Barracks; resets to level 1, keeps stats and weapon kills).
- XP per level grows linearly: 800 XP for level 2, +140 per level after (about 555k XP to reach 85).
- Badges come from the Dead Pixels badge pack. Its generator (`vendor/badges.js`) renders every badge as
  vector SVG at runtime (output is byte-identical to the pack's SVG files), and animates prestige 4-10 live.
  The pack defines 75 levels (25 ranks x 3 tiers); levels 76-85 currently reuse the Commander III badge.
  Either add 10 more badges to the generator or set `MAX_LEVEL` to 75 in `progression.ts`.
- Banners (calling cards) unlock by level and prestige; the Soldier tab picks the active one.

## 6. Suggested order
1. Stairs/second floors + 1 new map
2. Supabase accounts and cloud saves, then public launch of bot mode
3. Pets v1 (one pet, earned at level 5)
4. Shared rules package + Colyseus server + private multiplayer test
5. Earned crates (cosmetics only), then the store
