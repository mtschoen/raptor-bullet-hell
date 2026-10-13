# Smoke Test

How to verify a change works in this project before declaring it done.

## Floor: does it build and run?

```bash
npm run build
npm run preview
```

Then open http://127.0.0.1:4174/ and confirm the title screen renders.

## Bar: does it do what was asked?

```bash
npm run lint
npm run format:check
npm test
```

Verify: ESLint and Prettier report no findings, and all Vitest files pass
(patterns, particles, collision, waves, weapons).

In the browser: press Enter to start, steer with arrows, hold Space to fire,
confirm enemies fall and drop power-ups, take a hit and confirm respawn
invulnerability, press Shift to bomb, reach wave 5 for the boss, die three
times for game over, then Enter to restart.

On a touch device (or with coarse-pointer emulation at a phone size): start
a mission and confirm the stick and A/B deck appears at the bottom; touch
the stick zone and confirm the knob jumps to your thumb and the jet steers
immediately, push farther and confirm it flies faster, hold A and confirm
the jet fires, tap B and confirm the bomb fires once, then pause and confirm
the deck hides.

## Setup

None. Node 20+ and `npm install` only.

## Cleanup

Stop the preview server (Ctrl+C, or kill the detached process).

## Needs manual testing

Audio starts only after the first user gesture by design. Confirm music
intensity rises with waves and M mutes.
