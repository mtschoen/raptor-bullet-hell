# Raptor Bullet Hell: Allies vs Axis

A juicy vertical bullet-hell shooter inspired by _Raptor: Call of the Shadows_.
Pilot the Allied jet up an endless scrolling sky, shred waves of Axis fighters,
dive bombers, flak barges and aces, strafe ground tanks and flak sites scrolling
beneath you, and survive boss bullet patterns on every fifth wave. The
soundtrack is synthesized 80s hair metal that layers up as intensity rises.

**[Play Raptor Bullet Hell](https://mtschoen.github.io/raptor-bullet-hell/)**
in your browser. No installation or account required.

## Play

- Move: Arrow keys or WASD; on a phone, push the on-screen stick (tilt
  farther to fly faster)
- Fire: Hold Space, or hold A (weapons upgrade from drops: spread, missiles,
  rail)
- Bomb: Shift, or tap B (clears enemy bullets and damages everything on
  screen)
- Pause: P or Esc, Mute: M, Start or restart: Enter or the on-screen buttons

On touch devices a control deck appears at the bottom of the screen while a
mission is playing and hides again on the title, pause, and game-over
screens. The stick sits on the left: the knob jumps straight to your thumb
when it lands, so steering starts the instant you touch down. Round A (fire)
and B (bomb) buttons sit on the right in Game Boy diagonal placement.

Score builds a combo multiplier. Power-ups drop from wreckage: weapon upgrades,
shield, and extra bombs. Three lives, brief invulnerability after each hit.

## Develop

```bash
npm install
npm run dev          # http://127.0.0.1:5174
npm run lint         # ESLint, no findings expected
npm run format:check # Prettier check (npm run format to fix)
npm test             # Vitest unit tests for patterns, particles, collision, waves, weapons
npm run build        # type-check + production build into dist/
npm run build:pages  # production build with the /raptor-bullet-hell/ prefix
npm run preview      # serve the built payload on http://127.0.0.1:4174
```

## Deploy

Source lives at
[mtschoen/raptor-bullet-hell](https://github.com/mtschoen/raptor-bullet-hell).
Pushes to `main` run lint, formatting, unit coverage and the production build
before GitHub Actions deploys to GitHub Pages. `npm run build:pages` sets the
`/raptor-bullet-hell/` asset prefix; `npm run preview -- --base=/raptor-bullet-hell/`
previews that build locally. Keep Pages set to **GitHub Actions**.

`npm run build` emits a fully static payload in `dist/`. Copy that folder to
any static host (GitHub Pages, Netlify, nginx, itch.io) with no server code
required.

## Architecture

Reusable systems, each independently testable:

- `src/engine/` game loop with clamped delta, keyboard/touch input, seeded
  random, circle collision
- `src/game/` shared types, pure bullet-pattern math, wave director, weapon
  definitions, and the `Game` state machine
- `src/effects/` pooled particles, trauma-based screen shake, floating score
  text, parallax field
- `src/audio/` synthesized chiptune music engine (escalating intensity),
  synthesized sound effects, and a lazy `AudioContext` facade
- `src/render/` Canvas 2D renderer: generated sprite and terrain images with
  code-drawn fallbacks, bullets, and effects
- `src/main.ts` boot, HUD, overlays, and responsive scaling

Aircraft, tank, and flak sprites in `public/sprites/` were generated with
Google Imagen (via Antigravity) in a gritty pre-rendered style, then keyed and
downscaled by `tools/process-sprites.py` (run with the project `.venv` Python);
the renderer falls back to code-drawn sprites while images load. Terrain uses
Imagen-generated jungle, farmland, and water tiles in `public/backgrounds/`
(processed by `tools/process-backgrounds.py`) in a pale palette chosen so dark
aircraft stand out, with code-drawn coasts and roads on top. All sound is
synthesized with Web Audio.

## Credits

Inspired by _Raptor: Call of the Shadows_ (1994) by Cygnus Studios, published
by Apogee Software. This is an unofficial fan tribute: no code, artwork, or
music from the original game is reused. All code, generated artwork, and
synthesized sound in this repository are original to this project. MIT license
for this project (see `LICENSE`).

## How it was made

The first playable version was built with AI coding assistance in a single
evening session on 12 October 2026, then refined the same night through human
playtesting and direction on game feel, difficulty, and readability. The
initial commit landed 34 files and about 4,000 lines of code, tests, and docs
covering the game loop,
wave director, bullet patterns, synthesized music and sound effects, and the
Canvas renderer; three follow-up commits that night added the generated art
and ground-unit readability fixes, for four commits in total.

Aircraft, tank, and flak sprites (8 images) and the jungle, farmland, and
water terrain tiles (3 images) were generated with Google Imagen through
Antigravity image-generator subagents in a gritty pre-rendered 1994 arcade
style, then keyed, downscaled, and tiled by the Python tools in `tools/`. The
soundtrack and sound effects are synthesized live with Web Audio: no audio
files are shipped. At first release the game is 19 TypeScript modules under
`src/` with 13 Vitest tests across 5 files covering bullet patterns,
particles, collision, waves, and weapons.
