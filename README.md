# Raptor Bullet Hell: Allies vs Axis

A juicy vertical bullet-hell shooter inspired by *Raptor: Call of the Shadows*.
Pilot the Allied jet up an endless scrolling sky, shred waves of Axis fighters,
dive bombers, flak barges and aces, strafe ground tanks and flak sites scrolling
beneath you, and survive boss bullet patterns on every fifth wave. The
soundtrack is synthesized 80s hair metal that layers up as intensity rises.

## Play

- Move: Arrow keys or WASD (touch drag also steers)
- Fire: Hold Space (weapons upgrade from drops: spread, missiles, rail)
- Bomb: Shift (clears enemy bullets and damages everything on screen)
- Pause: P or Esc, Mute: M, Start or restart: Enter or the on-screen buttons

Score builds a combo multiplier. Power-ups drop from wreckage: weapon upgrades,
shield, and extra bombs. Three lives, brief invulnerability after each hit.

## Develop

```bash
npm install
npm run dev     # http://127.0.0.1:5174
npm test        # Vitest unit tests for patterns, particles, collision, waves
npm run build   # type-check + production build into dist/
npm run preview # serve the built payload on http://127.0.0.1:4174
```

## Deploy

`npm run build` emits a fully static payload in `dist/` (relative asset paths).
Copy that folder to any static host (GitHub Pages, Netlify, nginx, itch.io)
with no server code required.

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
- `src/render/` Canvas 2D renderer: code-drawn sprites, no image assets
- `src/main.ts` boot, HUD, overlays, and responsive scaling

All art is drawn in code and all sound is synthesized with Web Audio, so the
payload ships zero binary assets.
