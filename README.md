# Quake Tower

A tap-and-shake browser game about resonance: a tower sways most when its period matches the ground's period.

**Milestone 1:** physics module and one level.
**Milestone 2:** levels 1–5, level menu with saved stars, retry, hints, sway meter.

## Run locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Tests

```bash
npm test
```

- `src/physics.js`: SDOF oscillator (T_b = 0.1·N, ζ = 0.05, semi-implicit Euler at dt = 1/240 s), sway ratio and stars. No Phaser imports.
- `src/levels.js`: level data (from the design doc) and hint logic. No Phaser imports.
- `src/progress.js`: best stars and unlocked levels, in this browser's localStorage only.
- `src/menu.js`, `src/game.js`, `src/ui.js`: Phaser 3 scenes (menu → build → Shake! → stars → Retry/Next).

Rules: Next unlocks with at least 1 star or after 3 tries. After 2 tries with 0–1 stars, a hint points
to the nearest 3-star height. Towers never collapse. The sway meter shows live sway ratio against the
star zones, with a marker for the peak.
