# DEAD PIXEL (working title) — Phase 0: bot training

Browser FPS that follows MW2's progression shape (levels, unlocks, killstreaks), with its own art style:
**a PS1-era world with modern, high-detail guns and soldiers.**

Play: run `npm run dev` and open `http://localhost:3000/game/` (the production build serves it at `/game/`).
Append `?debug` to skip pointer lock and expose `window.game` for automation.

## The look: hybrid renderer (`renderer.ts`)

1. The world and FX render into a ~240p target. Materials are patched by `ps1ify()` for vertex snapping (the "wobble") and affine texture warping. Textures are 64px and point-sampled.
2. That target is upscaled with nearest-neighbour filtering, quantised to 15-bit colour and Bayer-dithered.
3. The world is re-drawn at full resolution, depth only.
4. Characters (layer 1) render at full resolution with PBR, procedural normal maps and an environment map, occluded correctly by the low-res world.
5. Depth is cleared, then the viewmodel (gun and gloved hands) renders in its own scene at full resolution.

## Files

| File | What |
|---|---|
| `game.ts` | Orchestrates player, gun, bots, XP and HUD; handles shooting and damage |
| `map.ts` / `maps.ts` | Map builder (merged, textured box geometry), AABB colliders, 1m nav grid + A*, ray vs box; map pool with themes |
| `weapons.ts` | Procedural KR-4 (AR) and VK-47 (AK), 150–250 parts each, with optics, suppressor, foregrip and camos |
| `loadout.ts`, `menu.ts` | Create-a-class data and stats; menus, class editor and 3D preview |
| `hands.ts` | Gloved hands with articulated fingers, attached to the rifle |
| `soldier.ts` | Fully kitted operator: plate carrier, MOLLE, pouches, helmet + NVG, IK arms |
| `viewmodel.ts` | First-person animation: sway, bob, ADS, recoil, reloads, grenade throws (pin pull, wind-up, release), muzzle flash, brass. `Gun` holds the fire control |
| `bot.ts` | AI states patrol → engage → hunt; reaction time, strafing, burst fire, accuracy model |
| `player.ts` | Movement: sprint, crouch, slide, jump, step-up, health regen |
| `progression.ts`, `unlocks.ts` | Levels 1–75 + Prestige 1–10, XP curve, rank names, local profile, unlock track |
| `challenges.ts` | 100 challenges over profile stat counters; each pays XP and unlocks its own banner |
| `cosmetics.ts`, `badges.ts` | Banners, soldier looks, player card; rank/prestige badges from the badge pack generator in `vendor/` |
| `throwables.ts` | Frag, smoke and stun grenades: bounce physics, fuses, smoke that blocks vision |
| `hud.ts`, `audio.ts`, `effects.ts`, `textures.ts`, `materials.ts` | HUD, synthesised SFX, low-res FX, procedural textures, PBR materials |

## Roadmap

See [PLAN.md](./PLAN.md) for the web launch, multiplayer, map pool and pets plans.
