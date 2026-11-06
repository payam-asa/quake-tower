# Quake Tower

A tap-and-shake browser game about resonance: a tower sways most when its period matches the ground's period.

**Milestone 1:** physics module and one level (soft soil, 3–15 floors).

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
- `src/game.js`: Phaser 3 scene (build → Shake! → stars → Retry/Next).
