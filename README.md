# Emberkeeper — best-game-01

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/alditsanz/best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/alditsanz/best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**Emberkeeper** is an original arena-survival game: you are the keeper of the
last lantern in a dark ember-garden. Gloom-moths drift in from the dark; burst
them with embers, gather their light, and light all seven lanterns before dawn.

## How to play

- **WASD / arrows** — move the keeper
- **Mouse** — aim · **Click / Space** — shoot embers
- **1 / 2 / 3 or click a card** — pick an upgrade between nights
- **P / Esc** — pause · **M** — mute · **R** — restart

Each night has a shard quota: fill the lantern meter and the next lantern
lights — and every night has its own name and character. Night 1 is the First
Dark; night 2 the Wisp Tide, when nearly a third of the garden is wisps, and
golden lantern-moths start appearing — they flee from you, so chase them down
for their 5 shards; night 3 the Matriarch Wakes; night 4 is Spitter's Watch,
when spitters double; night 5 the Swarm Night, the garden spawning faster with
more moths at once; night 6 the Matriarch Returns, calling darters instead of
moths; night 7 the Dawn Rush. Between nights, choose 1 of 3 blessings (faster
embers, tri-flame, piercing embers, swift boots, wide net, heavy embers, warm
heart, Ember Nova, Ember Echo, Lantern Ward, Ember Orbit). From night 2, quick
darting Gloom Wisps weave in among the moths and darters; from night 3, bloated
Gloom Splitters burst into two fast motes when killed — shoot them at range or
deal with both — and dark-violet Gloom Spitters hold at range and spit slow
gloom orbs at you, telegraphing each shot with a flare: step aside, or shoot
the orb down; from night 5, slow old Elders drift in, tough at 3 hp but heavy
with 4 shards. Every 3rd night a Gloom Matriarch boss guards the lantern — and
below half health she enrages, moving faster and calling moths sooner. Three
hearts; a touch costs one, unless a Lantern Ward eats the hit. Light all 7
lanterns and dawn breaks — you win. Lose all hearts and the light goes out.
After a win, Space keeps playing endless nights.

Score comes from bursts (with a combo multiplier for quick successive kills),
shards, and night bonuses; the best score is kept in the browser. Hold the
combo at its max and the lantern surges — embers hit +1 harder for a few
seconds. The last night is the Dawn Rush: the garden spawns faster and the
moth cap rises, so hold the line until dawn.

## The game

- A complete loop: title → 7 named nights with escalating moths, darters,
  wisps, splitters, motes, elders, spitters and fleeing lantern-moths →
  an enraging boss who changes what she summons → 11 upgrade choices →
  victory or game-over screen → restart / endless. Each night has its own
  name and twist: First Dark, Wisp Tide, the Matriarch Wakes, Spitter's
  Watch, Swarm Night, the Matriarch Returns, and the Dawn Rush finale.
- Original art drawn in code (no images) and original sound synthesised with
  WebAudio (no audio files): shoot, burst, pickup, hurt, lantern, upgrade,
  boss, nova, ward, spit, victory and defeat cues over a soft ambient pad.
- No libraries, no network, no build step: plain static files under `game/`,
  playable offline in a desktop browser from `game/index.html`.

## Run it

Node 22 or later, standard library only:

```sh
node serve.ts        # serves game/ on http://localhost:8080
```

Or open `game/index.html` directly in a browser.

## Files

- `main.ts` — hands the entry in: copies `game/` + `screenshots/` to
  `/output` and writes `/output/dossier.json` via `vendor/makefun-game.ts`.
- `game/index.html` — the page; `game/src/` — one job per file:
  `config.js` (tuning + palette + upgrades), `random.js` (seeded RNG),
  `audio.js` (synth SFX + pad), `input.js` (keyboard + mouse),
  `world.js` (entities, nights, boss, upgrades, collisions, scoring),
  `render.js` (garden, keeper, moths, HUD, screens), `shots.js` (staged
  screenshot scenes, played by an autopilot on the real rules),
  `main.js` (boot + fixed-step loop + screens).
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.
- `screenshots/` — 1-start.jpg (title), 2-play.jpg (night play + HUD),
  3-upgrade.jpg (upgrade choice), 4-dawn.jpg (victory).
- `LICENSE` — MIT.

## Notes

- `?seed=N` fixes the garden's pattern; `?shot=start|play|upgrade|win`
  stages a scene for a screenshot (the same seed always gives the same frame).
- The program is deterministic: two runs write identical bytes.

---

<sub>Entered on [make.fun](https://make.fun/?ref=zj6hcknq&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
