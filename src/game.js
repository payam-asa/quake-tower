import { Shake, starsFor, messageFor, towerPeriod, DT } from './physics.js';
import { LEVELS, hintDirection, hintText } from './levels.js';
import { loadProgress, recordResult } from './progress.js';
import { W, INK, STAR_ON, FONT, FONT_BOLD, makeButton, drawStars, starPoints } from './ui.js';

const GROUND_Y = 600;          // top of the ground layer
const TOWER_TOP_LIMIT = 290;   // tallest tower reaches this y
const TOWER_W = 110;
const SWAY_PX = 7;             // pixels of top sway per unit of sway ratio
const SWAY_MAX = 95;           // clamp so a resonant tower stays on screen
const GROUND_PX = 7;           // pixels of ground motion at full shake

// Sway meter
const METER_X = 438;
const METER_W = 26;
const METER_TOP = 300;
const METER_BOT = 590;
const METER_MAX_R = 8;

const FLOOR_COLORS = [0xf26b5b, 0xf7b538, 0x4fb3bf, 0x7bc96f, 0xa58ad9];
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
    this.floors = L.startFloors;
    this.floorH = Math.min(28, Math.floor((GROUND_Y - TOWER_TOP_LIMIT) / L.maxFloors));
    this.shake = null;
    this.tries = 0;
    this.peakR = 0;

    this.sky = this.add.graphics();
    this.groundG = this.add.graphics();
    this.towerG = this.add.graphics();
    this.meterG = this.add.graphics();
    this.starG = this.add.graphics().setDepth(5);
    this.drawSky();

    // Header
    makeButton(this, 44, 36, 64, 44, '☰', 0x8d99ae, () => this.scene.start('menu'), 24);
    this.add.text(W / 2 + 20, 20, `Level ${L.number}: ${L.groundInfo.name}`, {
      fontFamily: FONT_BOLD, fontSize: '26px', color: '#1d3557',
    }).setOrigin(0.5, 0);
    this.add.text(W / 2, 64, `Goal: ${L.goal}`, {
      fontFamily: FONT, fontSize: '18px', color: '#1d3557',
    }).setOrigin(0.5, 0);
    this.floorText = this.add.text(W / 2, 96, '', {
      fontFamily: FONT, fontSize: '19px', color: '#1d3557', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5, 0);

    // Messages
    this.messageText = this.add.text(W / 2, 212, '', {
      fontFamily: FONT_BOLD, fontSize: '26px', color: '#1d3557', align: 'center',
    }).setOrigin(0.5, 0).setDepth(5);
    this.subText = this.add.text(W / 2, 250, '', {
      fontFamily: FONT, fontSize: '17px', color: '#1d3557', align: 'center',
      wordWrap: { width: 400 },
    }).setOrigin(0.5, 0).setDepth(5);

    // Build controls
    this.minusBtn = makeButton(this, 70, 690, 80, 64, '−', 0x457b9d, () => this.changeFloors(-1));
    this.plusBtn = makeButton(this, 160, 690, 80, 64, '+', 0x457b9d, () => this.changeFloors(1));
    this.shakeBtn = makeButton(this, 345, 690, 190, 64, 'Shake!', 0xe63946, () => this.startShake());
    // Result controls
    this.retryBtn = makeButton(this, 130, 690, 180, 64, 'Retry', 0x457b9d, () => this.retry());
    this.nextBtn = makeButton(this, 350, 690, 180, 64, 'Next', 0x2a9d8f, () => this.next());

    this.add.text(W / 2, 770, 'A tower sways most when its rhythm matches the ground', {
      fontFamily: FONT, fontSize: '14px', color: '#e8d7c3',
    }).setOrigin(0.5);

    this.setState('build');
    this.subText.setText(L.intro);
    this.redraw();
  }

  // ---------- state ----------

  setState(state) {
    this.state = state;
    const build = state === 'build';
    const result = state === 'result';
    for (const b of [this.minusBtn, this.plusBtn, this.shakeBtn]) b.setVisible(build);
    for (const b of [this.retryBtn, this.nextBtn]) b.setVisible(result);
    if (build) {
      this.minusBtn.setEnabled(this.floors > this.level.minFloors);
      this.plusBtn.setEnabled(this.floors < this.level.maxFloors);
    }
    if (build || state === 'shaking') {
      this.messageText.setText('');
      this.subText.setText('');
      this.starG.clear();
    }
    this.updateFloorText();
  }

  updateFloorText() {
    const L = this.level;
    let t = `Floors: ${this.floors}   (allowed ${L.minFloors}–${L.maxFloors})`;
    if (this.state === 'result') {
      t += `\nTower rhythm ${towerPeriod(this.floors).toFixed(1)} s · ground rhythm ${L.groundInfo.period.toFixed(1)} s`;
    }
    this.floorText.setText(t);
  }

  changeFloors(delta) {
    if (this.state !== 'build') return;
    const L = this.level;
    this.floors = Phaser.Math.Clamp(this.floors + delta, L.minFloors, L.maxFloors);
    this.setState('build');
    this.redraw();
  }

  startShake() {
    if (this.state !== 'build') return;
    this.tries += 1;
    this.shake = new Shake({
      floors: this.floors,
      groundPeriod: this.level.groundInfo.period,
      seed: Math.floor(Math.random() * 1e9),
    });
    this.accum = 0;
    this.peakR = 0;
    this.setState('shaking');
    if (navigator.vibrate) navigator.vibrate(Array(12).fill([250, 250]).flat());
  }

  finishShake() {
    const stars = starsFor(this.shake.swayRatio);
    const canNext = stars >= 1 || this.tries >= 3;
    recordResult(loadProgress(), this.level.number, stars, canNext);

    this.setState('result');
    drawStars(this.starG, W / 2, 180, stars, 24);
    this.messageText.setText(messageFor(stars));
    if (stars <= 1 && this.tries >= 2) {
      this.subText.setText(hintText(hintDirection(this.level, this.floors)));
    } else if (stars === 3) {
      this.subText.setText(this.level.lesson);
    }
    this.nextBtn.setEnabled(canNext);
    this.nextBtn.label.setText(this.levelIndex === LEVELS.length - 1 ? 'Done' : 'Next');
  }

  retry() {
    this.shake = null;
    this.peakR = 0;
    this.setState('build');
    this.redraw();
  }

  next() {
    if (!this.nextBtn.enabled) return;
    if (this.levelIndex < LEVELS.length - 1) {
      this.scene.start('game', { level: this.levelIndex + 1 });
    } else {
      this.scene.start('menu', { message: 'All levels done! More coming soon.' });
    }
  }

  // ---------- loop ----------

  update(_time, deltaMs) {
    if (this.state !== 'shaking' || !this.shake) return;
    // Fixed-step substeps; cap the frame delta so a hidden tab doesn't jump.
    this.accum += Math.min(deltaMs / 1000, 0.1);
    while (this.accum >= DT && !this.shake.done) {
      this.shake.step();
      this.accum -= DT;
    }
    this.peakR = this.shake.swayRatio;
    this.redraw();
    if (this.shake.done) {
      this.finishShake();
      this.redraw();
    }
  }

  // ---------- drawing ----------

  drawSky() {
    const g = this.sky;
    g.fillStyle(0xbfe3f5, 1).fillRect(0, 0, W, GROUND_Y);
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(70, 330, 22).fillCircle(95, 322, 28).fillCircle(122, 332, 20);
    g.fillCircle(300, 230, 18).fillCircle(322, 222, 24).fillCircle(345, 232, 17);
  }

  redraw() {
    const s = this.shake;
    const live = this.state === 'shaking' && s;
    // Ground and tower are drawn by normalised acceleration / sway ratio rather
    // than metres, so the motion is visible on every ground type.
    const agNorm = live ? s.ag / s.A : 0;
    const gx = -agNorm * GROUND_PX;
    const signedR = live ? (s.u * s.omega * s.omega) / s.A : 0;
    const topSway = Phaser.Math.Clamp(signedR * SWAY_PX, -SWAY_MAX, SWAY_MAX);

    this.drawGround(gx, Math.abs(agNorm), live ? s.t : 0);
    this.drawTower(gx, topSway, live ? s.t : 0, Math.abs(signedR));
    this.drawMeter(Math.abs(signedR), this.peakR);
  }

  drawGround(gx, intensity, t) {
    const gg = this.groundG;
    gg.clear();
    const base = this.level.groundInfo.color;
    const c = Phaser.Display.Color.ValueToColor(base);
    gg.fillStyle(c.clone().lighten(10).color, 1).fillRect(-20 + gx, GROUND_Y, W + 40, 50);
    gg.fillStyle(base, 1).fillRect(-20 + gx, GROUND_Y + 50, W + 40, 80);
    gg.fillStyle(c.clone().darken(20).color, 1).fillRect(-20 + gx, GROUND_Y + 130, W + 40, 80);
    gg.fillStyle(c.clone().darken(30).color, 1);
    for (let i = 0; i < 14; i++) {
      gg.fillCircle(((i * 73) % (W + 40)) - 10 + gx, GROUND_Y + 20 + ((i * 37) % 160), 4);
    }
    if (intensity > 0.3) {
      gg.fillStyle(0xe9d8b4, 0.45 * intensity);
      for (let i = 0; i < 6; i++) {
        gg.fillCircle(W / 2 - 100 + i * 32 + gx + Math.sin(t * 20 + i) * 6, GROUND_Y - 4, 5 + intensity * 5);
      }
    }
  }

  drawTower(gx, topSway, t, R) {
    const N = this.floors;
    const fh = this.floorH;
    const tg = this.towerG;
    tg.clear();
    const cx = W / 2 - 20 + gx;
    const offset = (i) => cx + topSway * (i / N);
    const hw = TOWER_W / 2;
    const rattle = R > 3;
    const winH = Math.max(4, Math.round(fh * 0.45));

    for (let i = 0; i < N; i++) {
      const yBot = GROUND_Y - i * fh;
      const yTop = yBot - fh;
      const xb = offset(i);
      const xt = offset(i + 1);
      const pts = [
        { x: xb - hw, y: yBot }, { x: xb + hw, y: yBot },
        { x: xt + hw, y: yTop }, { x: xt - hw, y: yTop },
      ];
      tg.fillStyle(FLOOR_COLORS[i % FLOOR_COLORS.length], 1).fillPoints(pts, true);
      tg.lineStyle(2, INK, 0.5).strokePoints(pts, true);
      const xm = (xb + xt) / 2;
      const dx = rattle ? Math.sin(t * 60 + i) * 1.5 : 0;
      tg.fillStyle(0xfdf6e3, 1);
      for (const wx of [-32, 0, 32]) {
        tg.fillRect(xm + wx - 9 + dx, yTop + (fh - winH) / 2, 18, winH);
      }
    }
    const xr = offset(N);
    const yr = GROUND_Y - N * fh;
    tg.fillStyle(INK, 1).fillRect(xr - hw - 6, yr - 8, TOWER_W + 12, 8);
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
