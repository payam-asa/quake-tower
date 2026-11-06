# Quake Tower

A tap-and-shake browser game about resonance: a tower sways most when its period matches the ground's period.

**Milestone 1:** physics module and one level.
**Milestone 2:** levels 1–5, level menu with saved stars, retry, hints, sway meter.
**Milestone 3:** synthesised sounds with mute, science card, flat-colour art, GitHub Pages deploy.
**Levels 6–10:** choose-your-ground hospital, damper, three-tower street, mystery ground with a probe, free build with a saved record.

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
- `src/sound.js`: all sounds made with WebAudio (rumble, chime, wobble, clicks). No audio files.
- `src/art.js`: backdrop, ground and tower drawing. No image files.
- `src/science.js`, `src/sciencecard.js`: the optional "Why?" card (rhythm bars, resonance curve, honest limits).
- `src/menu.js`, `src/game.js`, `src/ui.js`: Phaser 3 scenes (menu → build → Shake! → stars → Retry/Next).

Rules: Next unlocks with at least 1 star or after 3 tries. After 2 tries with 0–1 stars, a hint points
to the nearest 3-star height. Towers never collapse. The sway meter shows live sway ratio against the
star zones, with a marker for the peak.

## Deploy to GitHub Pages

1. Create an empty repository on GitHub and push this code to its `main` branch.
2. In the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Every push to `main` runs the tests and publishes the game
   (`.github/workflows/pages.yml`). The address is shown in the workflow run, usually
   `https://<your-username>.github.io/<repo-name>/`.
