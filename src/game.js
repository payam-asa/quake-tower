import { Shake, starsFor, messageFor, towerPeriod, envelope, DT, DEFAULT_ZETA, COLLAPSE_R } from './physics.js';
import { makeCollapse, stepCollapse, drawCollapse } from './collapse.js';
import {
  LEVELS, makeGround, groundFor, hintDirection, hintText, goalMet, DAMPER_ZETA,
} from './levels.js';
import { loadProgress, recordResult, recordTallest } from './progress.js';
import { W, INK, STAR_ON, FONT, FONT_BOLD, makeButton, makeMuteButton, drawStars, starPoints } from './ui.js';
import { drawBackdrop, driftClouds, drawGround, drawTower } from './art.js';
import { unlockAudio, startRumble, setRumble, stopRumble, playResult, playCrash } from './sound.js';
import { showScienceCard } from './sciencecard.js';

const GROUND_Y = 600;          // top of the ground layer
const TOWER_TOP_LIMIT = 290;   // tallest tower reaches this y
const SWAY_PX = 7;             // pixels of top sway per unit of sway ratio
const SWAY_MAX = 95;           // clamp so a resonant tower stays on screen
const GROUND_PX = 7;           // pixels of ground motion at full shake
const PROBE_SECONDS = 4;

// Sway meter (single-tower levels)
const METER_X = 438;
const METER_W = 26;
const METER_TOP = 300;
const METER_BOT = 590;
const METER_MAX_R = 8;

// Probe trace panel (mystery ground)
const TRACE = { x: 40, y: 146, w: 400, h: 70 };

const ZONES = [ // [from R, to R, colour, stars]
  [0, 2, 0x52b788, 3],
  [2, 4, 0xf4d35e, 2],
  [4, 6, 0xf4a261, 1],
  [6, METER_MAX_R, 0xe63946, 0],
];

export class GameScene extends Phaser.Scene {
  constructor() {
    super('game');
  }

  init(data) {
    this.levelIndex = data.level ?? 0;
    this.level = LEVELS[this.levelIndex];
  }

  create() {
    const L = this.level;
    this.ground = makeGround(L);
    const starts = Array.isArray(L.startFloors) ? L.startFloors : [L.startFloors];
    this.towers = starts.map((floors, i) => ({
      floors,
      cx: L.towers === 1 ? W / 2 - 20 : 85 + i * 155,
      width: L.towers === 1 ? 110 : 92,
      shake: null,
      collapse: null,
    }));
    this.floorH = Math.min(28, Math.floor((GROUND_Y - TOWER_TOP_LIMIT) / L.maxFloors));
    this.damperOn = false;
    this.probed = false;
    this.tries = 0;
    this.peakR = 0;
    this.trace = [];

    this.backdrop = drawBackdrop(this, GROUND_Y);
    this.groundG = this.add.graphics();
    this.towerG = this.add.graphics();
    this.meterG = this.add.graphics();
    this.traceG = this.add.graphics();
    this.starG = this.add.graphics().setDepth(5);

    // Header
    makeButton(this, 44, 36, 64, 44, '☰', 0x8d99ae, () => { stopRumble(); this.scene.start('menu'); }, 24);
    makeMuteButton(this, W - 44, 36);
    this.add.text(W / 2, 22, `Level ${L.number}: ${L.title}`, {
      fontFamily: FONT_BOLD, fontSize: '24px', color: '#1d3557',
    }).setOrigin(0.5, 0);
    this.add.text(W / 2, 64, `Goal: ${L.goal}`, {
      fontFamily: FONT, fontSize: '18px', color: '#1d3557',
    }).setOrigin(0.5, 0);
    this.floorText = this.add.text(W / 2, 94, '', {
      fontFamily: FONT, fontSize: '18px', color: '#1d3557', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5, 0);

    // Messages
    this.messageText = this.add.text(W / 2, 212, '', {
      fontFamily: FONT_BOLD, fontSize: '26px', color: '#1d3557', align: 'center',
    }).setOrigin(0.5, 0).setDepth(5);
    this.subText = this.add.text(W / 2, 250, '', {
      fontFamily: FONT, fontSize: '17px', color: '#1d3557', align: 'center',
      wordWrap: { width: 410 }, lineSpacing: 2,
    }).setOrigin(0.5, 0).setDepth(5);
    this.traceLabel = this.add.text(TRACE.x + 8, TRACE.y + 4, '', {
      fontFamily: FONT, fontSize: '13px', color: '#1d3557',
    }).setDepth(4);

    this.makeBuildControls();
    // Result controls
    this.retryBtn = makeButton(this, 92, 690, 150, 64, 'Retry', 0x457b9d, () => this.retry());
    this.whyBtn = makeButton(this, 240, 690, 120, 64, 'Why?', 0xf4a261, () => this.openScience(), 26);
    this.nextBtn = makeButton(this, 388, 690, 150, 64, 'Next', 0x2a9d8f, () => this.next());
    this.events.once('shutdown', () => stopRumble());

    this.add.text(W / 2, 770, 'A tower sways most when its rhythm matches the ground', {
      fontFamily: FONT, fontSize: '14px', color: '#e8d7c3',
    }).setOrigin(0.5);

    this.setState('build');
    this.subText.setText(L.intro);
    this.redraw();
  }

  /** Each level type gets its own row of build controls. */
  makeBuildControls() {
    const L = this.level;
    // The scene object is reused between levels: clear controls from the last one.
    this.buildBtns = [];
    this.groundBtn = null;
    this.damperBtn = null;
    this.extraBtn = null;
    this.card = null;
    this.probe = null;
    const add = (b) => { this.buildBtns.push(b); return b; };
    const fixed = L.minFloors === L.maxFloors;

    if (L.towers > 1) {
      // Small − / + under each tower, Shake! below.
      this.towers.forEach((tw, i) => {
        tw.minus = add(makeButton(this, tw.cx - 28, 640, 50, 42, '−', 0x457b9d, () => this.changeFloors(-1, i), 24));
        tw.plus = add(makeButton(this, tw.cx + 28, 640, 50, 42, '+', 0x457b9d, () => this.changeFloors(1, i), 24));
      });
      this.shakeBtn = add(makeButton(this, W / 2, 712, 220, 56, 'Shake!', 0xe63946, () => this.startShake()));
      return;
    }
    if (fixed && L.groundChoice) {
      this.groundBtn = add(makeButton(this, 125, 690, 220, 64, '', 0x6d597a, () => this.switchGround(), 19));
    } else if (fixed && L.damper) {
      this.damperBtn = add(makeButton(this, 125, 690, 220, 64, '', 0x6d597a, () => this.toggleDamper(), 20));
    } else if (L.mystery || L.randomGround) {
      this.towers[0].minus = add(makeButton(this, 50, 690, 70, 64, '−', 0x457b9d, () => this.changeFloors(-1)));
      this.towers[0].plus = add(makeButton(this, 128, 690, 70, 64, '+', 0x457b9d, () => this.changeFloors(1)));
      const label = L.mystery ? 'Probe' : 'New\nground';
      const action = L.mystery ? () => this.startProbe() : () => this.newGround();
      this.extraBtn = add(makeButton(this, 237, 690, 120, 64, label, 0x6d597a, action, L.mystery ? 24 : 18));
    } else {
      this.towers[0].minus = add(makeButton(this, 70, 690, 80, 64, '−', 0x457b9d, () => this.changeFloors(-1)));
      this.towers[0].plus = add(makeButton(this, 160, 690, 80, 64, '+', 0x457b9d, () => this.changeFloors(1)));
    }
    const wide = !(L.mystery || L.randomGround);
    this.shakeBtn = add(makeButton(this, wide ? 345 : 383, 690, wide ? 190 : 160, 64, 'Shake!', 0xe63946, () => this.startShake()));
  }

  // ---------- state ----------

  get zeta() {
    return this.damperOn ? DAMPER_ZETA : DEFAULT_ZETA;
  }

  setState(state) {
    this.state = state;
    const build = state === 'build';
    const result = state === 'result';
    for (const b of this.buildBtns) b.setVisible(build || state === 'probing');
    for (const b of [this.retryBtn, this.whyBtn, this.nextBtn]) b.setVisible(result);
    if (build || state === 'probing') {
      const L = this.level;
      for (const tw of this.towers) {
        if (tw.minus) tw.minus.setEnabled(build && tw.floors > L.minFloors);
        if (tw.plus) tw.plus.setEnabled(build && tw.floors < L.maxFloors);
      }
      this.shakeBtn.setEnabled(build);
      if (this.extraBtn) this.extraBtn.setEnabled(build);
      if (this.groundBtn) this.groundBtn.label.setText(`Ground: ${this.ground.name}\n(tap to switch)`);
      if (this.damperBtn) this.damperBtn.label.setText(`Damper: ${this.damperOn ? 'ON' : 'OFF'}\n(tap to switch)`);
    }
    if (build || state === 'shaking') {
      this.messageText.setText('');
      this.subText.setText('');
      this.starG.clear();
    }
    if (state === 'shaking') {
      this.traceG.clear();
      this.traceLabel.setText('');
    }
    this.updateFloorText();
  }

  updateFloorText() {
    const L = this.level;
    const floors = this.towers.map((t) => t.floors);
    let t = L.minFloors === L.maxFloors
      ? `Floors: ${floors[0]} (fixed)`
      : `Floors: ${floors.join(' · ')}   (allowed ${L.minFloors}–${L.maxFloors})`;
    if (L.mystery) {
      t += this.probed ? `\nGround rhythm: about ${this.ground.period.toFixed(1)} s` : '\nGround rhythm: ?';
    } else if (L.randomGround) {
      const best = loadProgress().tallest || 0;
      t += `\nGround rhythm: ${this.ground.period.toFixed(1)} s · best so far: ${best ? `${best} floors` : '—'}`;
    } else if (this.state === 'result') {
      const tb = floors.map((f) => towerPeriod(f).toFixed(1)).join(' · ');
      t += `\nTower rhythm ${tb} s · ground rhythm ${this.ground.period.toFixed(1)} s`;
    }
    this.floorText.setText(t);
  }

  changeFloors(delta, i = 0) {
    if (this.state !== 'build') return;
    const L = this.level;
    const tw = this.towers[i];
    tw.floors = Phaser.Math.Clamp(tw.floors + delta, L.minFloors, L.maxFloors);
    this.setState('build');
    this.redraw();
  }

  switchGround() {
    if (this.state !== 'build') return;
    const keys = this.level.groundChoice;
    const next = keys[(keys.indexOf(this.ground.key) + 1) % keys.length];
    this.ground = groundFor(next);
    this.setState('build');
    this.redraw();
  }

  toggleDamper() {
    if (this.state !== 'build') return;
    this.damperOn = !this.damperOn;
    this.setState('build');
    this.redraw();
  }

  newGround() {
    if (this.state !== 'build') return;
    const old = this.ground.period;
    do { this.ground = makeGround(this.level); } while (this.ground.period === old);
    this.tries = 0;
    this.setState('build');
    this.subText.setText('New ground! Its rhythm is shown above.');
    this.redraw();
  }

  // ---------- probe (mystery ground) ----------

  startProbe() {
    if (this.state !== 'build') return;
    unlockAudio();
    this.probe = new Shake({
      floors: 10, groundPeriod: this.ground.period, amplitude: 1,
      duration: PROBE_SECONDS, ramp: 0.5, noise: 0.15, seed: Math.floor(Math.random() * 1e9),
    });
    this.accum = 0;
    this.trace = [];
    this.setState('probing');
    this.messageText.setText('');
    this.subText.setText('Feel the ground… count the swings each second.');
  }

  finishProbe() {
    this.probe = null;
    this.probed = true;
    this.setState('build');
    const n = Math.round(1 / this.ground.period * 10) / 10;
    this.subText.setText(`The ground swings about ${n} times per second, so one swing takes about ${this.ground.period.toFixed(1)} s. Now pick a height that doesn't match it.`);
    this.redraw();
  }

  drawTrace() {
    const g = this.traceG;
    g.clear();
    const { x, y, w, h } = TRACE;
    g.fillStyle(0xfdf6e3, 0.95).fillRoundedRect(x, y, w, h, 10);
    g.lineStyle(2, INK, 1).strokeRoundedRect(x, y, w, h, 10);
    const mid = y + h / 2 + 6;
    g.lineStyle(1, INK, 0.2).lineBetween(x + 8, mid, x + w - 8, mid);
    const pxPerS = (w - 16) / PROBE_SECONDS;
    for (let s = 1; s < PROBE_SECONDS; s++) {
      g.lineStyle(1, INK, 0.35).lineBetween(x + 8 + s * pxPerS, y + 20, x + 8 + s * pxPerS, y + h - 4);
    }
    g.lineStyle(2, 0xe63946, 1);
    g.beginPath();
    this.trace.forEach(([t, a], i) => {
      const px = x + 8 + t * pxPerS;
      const py = mid - a * 20;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    });
    g.strokePath();
    this.traceLabel.setText('Ground probe (gridlines every 1 s)');
  }

  // ---------- shake ----------

  startShake() {
    if (this.state !== 'build') return;
    this.tries += 1;
    const seed = Math.floor(Math.random() * 1e9);
    // Same seed for every tower, so they all feel the same earthquake.
    for (const tw of this.towers) {
      tw.shake = new Shake({ floors: tw.floors, groundPeriod: this.ground.period, zeta: this.zeta, seed });
      tw.collapse = null;
    }
    this.endTimer = null;
    this.accum = 0;
    this.peakR = 0;
    this.setState('shaking');
    unlockAudio();
    startRumble();
    if (navigator.vibrate) navigator.vibrate(Array(12).fill([250, 250]).flat());
  }

  finishShake() {
    stopRumble();
    const L = this.level;
    const perTower = this.towers.map((tw) => starsFor(tw.shake.swayRatio));
    const stars = Math.min(...perTower);
    this.worst = this.towers[perTower.indexOf(stars)];
    this.lastR = this.worst.shake.swayRatio;
    const anyCollapsed = this.towers.some((tw) => tw.collapse);
    if (!anyCollapsed) playResult(stars);
    const canNext = stars >= 1 || this.tries >= 3;
    const progress = recordResult(loadProgress(), L.number, stars, canNext);
    const newBest = L.tallest && stars === 3 && recordTallest(progress, this.towers[0].floors);

    this.setState('result');
    drawStars(this.starG, W / 2, 180, stars, 24);
    if (L.towers > 1) {
      this.towers.forEach((tw, i) => drawStars(this.starG, tw.cx, 640, perTower[i], 11, 3, 26));
    }
    const collapsedMsg = L.towers > 1 ? 'A tower collapsed!' : 'Collapsed!';
    this.messageText.setText(newBest ? `New best: ${this.towers[0].floors} floors!` : (anyCollapsed ? collapsedMsg : messageFor(stars)));

    const lines = [];
    if (L.minStars) lines.push(goalMet(L, stars) ? '✓ Goal reached!' : 'Goal not reached yet.');
    if (stars <= 1 && this.tries >= 2) lines.push(this.hint());
    else if (stars === 3 || (L.minStars && goalMet(L, stars))) lines.push(L.lesson);
    this.subText.setText(lines.join(' '));
    this.nextBtn.setEnabled(canNext);
    this.nextBtn.label.setText(this.levelIndex === LEVELS.length - 1 ? 'Done' : 'Next');
  }

  hint() {
    const L = this.level;
    if (L.groundChoice) return 'Hint: try building on the other ground.';
    if (L.damper && !this.damperOn) return 'Hint: switch the damper on.';
    if (L.towers > 1) return 'Hint: change the tower with the fewest stars.';
    if (L.mystery && !this.probed) return 'Hint: tap Probe to feel the ground\'s rhythm first.';
    return hintText(hintDirection(L, this.towers[0].floors, this.ground.period, this.zeta));
  }

  openScience() {
    if (this.card) return;
    this.card = showScienceCard(this, {
      ground: this.ground, floors: this.worst.floors, R: this.lastR, zeta: this.zeta, collapsed: !!this.worst.collapse,
      onClose: () => { this.card = null; },
    });
  }

  retry() {
    for (const tw of this.towers) { tw.shake = null; tw.collapse = null; }
    this.peakR = 0;
    this.setState('build');
    this.redraw();
  }

  next() {
    if (!this.nextBtn.enabled) return;
    if (this.levelIndex < LEVELS.length - 1) {
      this.scene.start('game', { level: this.levelIndex + 1 });
    } else {
      this.scene.start('menu', { message: 'All 10 levels done! Try to beat your Free build record.' });
    }
  }

  // ---------- loop ----------

  update(_time, deltaMs) {
    driftClouds(this.backdrop.clouds, deltaMs / 1000);
    const dt = Math.min(deltaMs / 1000, 0.1); // cap so a hidden tab doesn't jump
    const debris = this.towers.filter((tw) => tw.collapse);
    for (const tw of debris) stepCollapse(tw.collapse, dt);
    if (debris.length && this.state !== 'shaking') this.redraw();

    if (this.state === 'probing' && this.probe) {
      this.accum += dt;
      while (this.accum >= DT && !this.probe.done) {
        this.probe.step();
        this.accum -= DT;
        if (Math.round(this.probe.t / DT) % 4 === 0) this.trace.push([this.probe.t, this.probe.ag / this.probe.A]);
      }
      this.drawTrace();
      this.redraw();
      if (this.probe.done) this.finishProbe();
      return;
    }

    if (this.state !== 'shaking') return;
    const lead = this.towers[0].shake;
    this.accum += dt;
    while (this.accum >= DT && !lead.done) {
      for (const tw of this.towers) tw.shake.step();
      this.accum -= DT;
    }
    for (const tw of this.towers) {
      const s = tw.shake;
      if (!tw.collapse && (Math.abs(s.u) * s.omega ** 2) / s.A >= COLLAPSE_R) this.collapseTower(tw);
    }
    // Once every tower is down, end the shake shortly after instead of waiting it out.
    if (this.endTimer === null && this.towers.every((tw) => tw.collapse)) this.endTimer = 1.8;
    if (this.endTimer !== null) {
      this.endTimer -= dt;
      if (this.endTimer <= 0) {
        this.finishShake();
        this.redraw();
        return;
      }
    }
    this.peakR = lead.swayRatio;
    const swayNow = Math.max(...this.towers.map((tw) => Math.abs(tw.shake.u) * tw.shake.omega ** 2 / tw.shake.A));
    setRumble(envelope(lead.t), Math.min(1, swayNow / 8));
    this.redraw();
    if (lead.done) {
      this.finishShake();
      this.redraw();
    }
  }

  // ---------- drawing ----------

  redraw() {
    const shaking = this.state === 'shaking';
    const probing = this.state === 'probing' && this.probe;
    const src = probing ? this.probe : (shaking ? this.towers[0].shake : null);
    // Drawn by normalised acceleration / sway ratio rather than metres,
    // so the motion is visible on every ground type.
    const agNorm = src ? src.ag / src.A : 0;
    const gx = -agNorm * GROUND_PX * (probing ? 0.6 : 1);
    const t = src ? src.t : 0;

    this.drawGround(gx, shaking ? Math.abs(agNorm) : 0, t);
    this.towerG.clear();
    let liveR = 0;
    for (const tw of this.towers) {
      if (tw.collapse) {
        drawCollapse(this.towerG, tw.collapse);
        continue;
      }
      const s = shaking ? tw.shake : null;
      const signedR = s ? (s.u * s.omega * s.omega) / s.A : 0;
      liveR = Math.abs(signedR);
      const topSway = Phaser.Math.Clamp(signedR * SWAY_PX, -SWAY_MAX, SWAY_MAX);
      const cx = tw.cx + gx;
      drawTower(this.towerG, {
        N: tw.floors, floorH: this.floorH, width: tw.width, groundY: GROUND_Y,
        offset: (i) => cx + topSway * (i / tw.floors), t, rattle: liveR > 3, damper: this.damperOn,
      });
    }
    if (this.level.towers === 1) this.drawMeter(liveR, this.peakR);
  }

  /** The tower fails: freeze its shape, break it into falling floors. */
  collapseTower(tw) {
    const s = tw.shake;
    const src = this.towers[0].shake;
    const gx = -(src.ag / src.A) * GROUND_PX;
    const signedR = (s.u * s.omega * s.omega) / s.A;
    const topSway = Phaser.Math.Clamp(signedR * SWAY_PX, -SWAY_MAX, SWAY_MAX);
    const cx = tw.cx + gx;
    tw.collapse = makeCollapse({
      N: tw.floors, floorH: this.floorH, width: tw.width, groundY: GROUND_Y,
      offset: (i) => cx + topSway * (i / tw.floors),
    });
    playCrash();
    this.cameras.main.shake(450, 0.012);
    if (navigator.vibrate) navigator.vibrate([0, 30, 400]);
  }

  drawGround(gx, intensity, t) {
    const gg = this.groundG;
    gg.clear();
    drawGround(gg, this.ground.key, this.ground.color, GROUND_Y, gx);
    if (this.ground.hidden) {
      // Question marks hint that this ground is unknown.
      for (const [x, y] of [[60, 60], [210, 130], [380, 80], [300, 170]]) {
        gg.fillStyle(0xffffff, 0.18).fillCircle(x + gx, GROUND_Y + y, 14);
      }
    }
    if (intensity > 0.3) {
      gg.fillStyle(0xe9d8b4, 0.45 * intensity);
      for (const tw of this.towers) {
        for (let i = 0; i < 4; i++) {
          gg.fillCircle(tw.cx - 48 + i * 32 + gx + Math.sin(t * 20 + i) * 6, GROUND_Y - 4, 5 + intensity * 5);
        }
      }
    }
  }

  drawMeter(R, peakR) {
    const g = this.meterG;
    g.clear();
    const h = METER_BOT - METER_TOP;
    const yOf = (r) => METER_BOT - (Math.min(r, METER_MAX_R) / METER_MAX_R) * h;
    const x0 = METER_X - METER_W / 2;

    // Pale zone bands, each labelled with its star count (shape, not only colour).
    for (const [a, b, col, stars] of ZONES) {
      g.fillStyle(col, 0.25).fillRect(x0, yOf(b), METER_W, yOf(a) - yOf(b));
      const ym = (yOf(a) + yOf(b)) / 2;
      for (let k = 0; k < 3; k++) {
        const pts = starPoints(x0 - 50 + k * 16, ym, 7.5);
        g.fillStyle(k < stars ? STAR_ON : 0xffffff, k < stars ? 1 : 0.6).fillPoints(pts, true);
        g.lineStyle(1, INK, 0.8).strokePoints(pts, true);
      }
    }

    // Live fill, coloured by the zone it reaches.
    if (R > 0) {
      const zone = ZONES.find(([a, b]) => R >= a && R < b) || ZONES[ZONES.length - 1];
      g.fillStyle(zone[2], 1).fillRect(x0 + 4, yOf(R), METER_W - 8, METER_BOT - yOf(R));
    }

    // Peak marker: a line plus a triangle pointing at the meter.
    if (peakR > 0) {
      const y = yOf(peakR);
      g.fillStyle(INK, 1).fillTriangle(x0 + METER_W + 2, y, x0 + METER_W + 12, y - 6, x0 + METER_W + 12, y + 6);
      g.lineStyle(2, INK, 1).lineBetween(x0, y, x0 + METER_W, y);
    }

    g.lineStyle(3, INK, 1).strokeRect(x0, METER_TOP, METER_W, h);
    g.lineStyle(1, INK, 0.6);
    for (const r of [2, 4, 6]) g.lineBetween(x0, yOf(r), x0 + METER_W, yOf(r));
  }
}
