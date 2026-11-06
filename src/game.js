import { Shake, GROUNDS, starsFor, messageFor, towerPeriod, DT } from './physics.js';

const W = 480;
const H = 800;
const GROUND_Y = 600;          // top of the ground layer
const FLOOR_H = 24;            // pixel height of one floor
const TOWER_W = 110;
const SWAY_GAIN = 300;         // pixels per metre of tower sway
const GROUND_GAIN = 400;       // pixels per metre of ground motion

// Milestone 1: a single level on soft soil.
const LEVEL = {
  number: 2,
  ground: GROUNDS.soft,
  minFloors: 3,
  maxFloors: 15,
  startFloors: 5,
  goal: 'Build at least 3 floors',
};

const FLOOR_COLORS = [0xf26b5b, 0xf7b538, 0x4fb3bf, 0x7bc96f, 0xa58ad9];

export class GameScene extends Phaser.Scene {
  constructor() {
    super('game');
  }

  create() {
    this.floors = LEVEL.startFloors;
    this.shake = null;
    this.state = 'build'; // build | shaking | result
    this.tries = 0;

    this.sky = this.add.graphics();
    this.groundG = this.add.graphics();
    this.towerG = this.add.graphics();
    this.drawSky();

    this.add.text(W / 2, 28, 'Quake Tower', {
      fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '34px', color: '#1d3557',
    }).setOrigin(0.5, 0);
    this.add.text(W / 2, 74, `Ground: ${LEVEL.ground.name}  ·  ${LEVEL.goal}`, {
      fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#1d3557',
    }).setOrigin(0.5, 0);

    this.floorText = this.add.text(W / 2, 104, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '20px', color: '#1d3557', fontStyle: 'bold',
    }).setOrigin(0.5, 0);

    // Build controls
    this.minusBtn = this.makeButton(70, 690, 80, 64, '−', 0x457b9d, () => this.changeFloors(-1));
    this.plusBtn = this.makeButton(160, 690, 80, 64, '+', 0x457b9d, () => this.changeFloors(1));
    this.shakeBtn = this.makeButton(345, 690, 190, 64, 'Shake!', 0xe63946, () => this.startShake());

    // Result controls
    this.retryBtn = this.makeButton(130, 690, 180, 64, 'Retry', 0x457b9d, () => this.retry());
    this.nextBtn = this.makeButton(350, 690, 180, 64, 'Next', 0x2a9d8f, () => this.next());

    this.resultText = this.add.text(W / 2, 150, '', {
      fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '40px', color: '#f4a261',
      stroke: '#1d3557', strokeThickness: 6, align: 'center',
    }).setOrigin(0.5, 0);
    this.messageText = this.add.text(W / 2, 212, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '24px', color: '#1d3557', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5, 0);
    this.starG = this.add.graphics().setDepth(5);
    this.hintText = this.add.text(W / 2, 248, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#6c3d00', align: 'center',
    }).setOrigin(0.5, 0);

    this.add.text(W / 2, 770, 'Tip: a tower sways most when its rhythm matches the ground', {
      fontFamily: 'Arial, sans-serif', fontSize: '14px', color: '#e8d7c3',
    }).setOrigin(0.5, 0.5);

    this.setState('build');
    this.redraw(0, 0);
  }

  // ---------- UI helpers ----------

  makeButton(x, y, w, h, label, color, onClick) {
    const c = this.add.container(x, y);
    const bg = this.add.graphics();
    const draw = (fill) => {
      bg.clear();
      bg.fillStyle(0x000000, 0.25).fillRoundedRect(-w / 2, -h / 2 + 4, w, h, 14);
      bg.fillStyle(fill, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 14);
    };
    draw(color);
    const txt = this.add.text(0, 0, label, {
      fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '30px', color: '#ffffff',
    }).setOrigin(0.5);
    c.add([bg, txt]);
    c.setSize(w, h);
    c.setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => { draw(Phaser.Display.Color.ValueToColor(color).darken(15).color); });
    c.on('pointerout', () => draw(color));
    c.on('pointerup', () => { draw(color); if (c.enabled !== false) onClick(); });
    c.setEnabled = (on) => { c.enabled = on; c.setAlpha(on ? 1 : 0.4); };
    return c;
  }

  setState(state) {
    this.state = state;
    const build = state === 'build';
    const result = state === 'result';
    for (const b of [this.minusBtn, this.plusBtn, this.shakeBtn]) b.setVisible(build);
    for (const b of [this.retryBtn, this.nextBtn]) b.setVisible(result);
    if (build) {
      this.minusBtn.setEnabled(this.floors > LEVEL.minFloors);
      this.plusBtn.setEnabled(this.floors < LEVEL.maxFloors);
      this.resultText.setText('');
      this.messageText.setText('');
      this.hintText.setText('');
      this.starG.clear();
    }
    this.updateFloorText();
  }

  updateFloorText() {
    let t = `Floors: ${this.floors}   (allowed ${LEVEL.minFloors}–${LEVEL.maxFloors})`;
    if (this.state === 'result') {
      t += `\nTower period ${towerPeriod(this.floors).toFixed(1)} s · ground period ${LEVEL.ground.period.toFixed(1)} s`;
    }
    this.floorText.setText(t).setAlign('center');
  }

  changeFloors(delta) {
    if (this.state !== 'build') return;
    this.floors = Phaser.Math.Clamp(this.floors + delta, LEVEL.minFloors, LEVEL.maxFloors);
    this.setState('build');
    this.redraw(0, 0);
  }

  startShake() {
    if (this.state !== 'build') return;
    this.tries += 1;
    this.shake = new Shake({
      floors: this.floors,
      groundPeriod: LEVEL.ground.period,
      seed: Math.floor(Math.random() * 1e9),
    });
    this.accum = 0;
    this.setState('shaking');
    if (navigator.vibrate) navigator.vibrate(Array(12).fill([250, 250]).flat());
  }

  finishShake() {
    const R = this.shake.swayRatio;
    const stars = starsFor(R);
    this.lastStars = stars;
    this.resultText.setText('');
    this.drawStars(stars);
    this.messageText.setText(messageFor(stars));
    const needHint = stars <= 1 && this.tries >= 2;
    this.hintText.setText(needHint ? 'Hint: try a shorter (or much taller) tower' : '');
    this.setState('result');
    // Next unlocks with at least 1 star, or after 3 tries whatever the result.
    this.nextBtn.setEnabled(stars >= 1 || this.tries >= 3);
  }

  retry() {
    this.shake = null;
    this.setState('build');
    this.redraw(0, 0);
  }

  next() {
    if (this.nextBtn.enabled === false) return;
    // Only one level exists in milestone 1: restart it fresh.
    this.tries = 0;
    this.floors = LEVEL.startFloors;
    this.retry();
    this.hintText.setText('More levels coming soon!');
  }

  drawStars(n) {
    const g = this.starG;
    g.clear();
    for (let k = 0; k < 3; k++) {
      const x = W / 2 + (k - 1) * 56, y = 180;
      const pts = [];
      for (let j = 0; j < 10; j++) {
        const r = j % 2 ? 10 : 24, a = -Math.PI / 2 + (j * Math.PI) / 5;
        pts.push({ x: x + r * Math.cos(a), y: y + r * Math.sin(a) });
      }
      g.fillStyle(k < n ? 0xffc93c : 0xdde6ea, 1).fillPoints(pts, true);
      g.lineStyle(3, 0x1d3557, 1).strokePoints(pts, true);
    }
  }

  // ---------- loop + drawing ----------

  update(_time, deltaMs) {
    if (this.state !== 'shaking' || !this.shake) return;
    // Fixed-step substeps; cap the frame delta so a hidden tab doesn't jump.
    this.accum += Math.min(deltaMs / 1000, 0.1);
    while (this.accum >= DT && !this.shake.done) {
      this.shake.step();
      this.accum -= DT;
    }
    this.redraw(this.shake.groundDisp, this.shake.u);
    if (this.shake.done) {
      this.redraw(0, 0);
      this.finishShake();
    }
  }

  drawSky() {
    const g = this.sky;
    g.fillStyle(0xbfe3f5, 1).fillRect(0, 0, W, GROUND_Y);
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(80, 300, 22).fillCircle(105, 292, 28).fillCircle(132, 302, 20);
    g.fillCircle(360, 360, 18).fillCircle(382, 352, 24).fillCircle(405, 362, 17);
  }

  redraw(groundDisp, u) {
    const gx = groundDisp * GROUND_GAIN;
    const ag = this.shake ? this.shake.ag : 0;
    const jitter = this.state === 'shaking' ? Math.abs(ag) * 2 : 0;

    // Ground layers
    const gg = this.groundG;
    gg.clear();
    const base = LEVEL.ground.color;
    const c = Phaser.Display.Color.ValueToColor(base);
    gg.fillStyle(c.clone().lighten(10).color, 1).fillRect(-20 + gx, GROUND_Y, W + 40, 50);
    gg.fillStyle(base, 1).fillRect(-20 + gx, GROUND_Y + 50, W + 40, 80);
    gg.fillStyle(c.clone().darken(20).color, 1).fillRect(-20 + gx, GROUND_Y + 130, W + 40, 80);
    // pebbles
    gg.fillStyle(c.clone().darken(30).color, 1);
    for (let i = 0; i < 14; i++) {
      gg.fillCircle(((i * 73) % (W + 40)) - 10 + gx, GROUND_Y + 20 + ((i * 37) % 160), 4);
    }
    // dust while shaking
    if (jitter > 0.2) {
      gg.fillStyle(0xe9d8b4, Math.min(0.6, jitter * 0.2));
      for (let i = 0; i < 6; i++) {
        gg.fillCircle(W / 2 - 80 + i * 32 + gx + Math.sin(this.shake.t * 20 + i) * 6, GROUND_Y - 4, 6 + jitter * 2);
      }
    }

    // Tower: floor i's top edge shifts by u * (i / N) * gain, on top of the ground motion.
    const N = this.floors;
    const tg = this.towerG;
    tg.clear();
    const cx = W / 2 + gx;
    const offset = (i) => cx + u * (i / N) * SWAY_GAIN;
    const nearResonance = this.shake && Math.abs(this.shake.u) * this.shake.omega ** 2 / this.shake.A > 3;

    for (let i = 0; i < N; i++) {
      const yBot = GROUND_Y - i * FLOOR_H;
      const yTop = yBot - FLOOR_H;
      const xb = offset(i);
      const xt = offset(i + 1);
      const hw = TOWER_W / 2;
      tg.fillStyle(FLOOR_COLORS[i % FLOOR_COLORS.length], 1);
      tg.fillPoints([
        { x: xb - hw, y: yBot }, { x: xb + hw, y: yBot },
        { x: xt + hw, y: yTop }, { x: xt - hw, y: yTop },
      ], true);
      tg.lineStyle(2, 0x1d3557, 0.5).strokePoints([
        { x: xb - hw, y: yBot }, { x: xb + hw, y: yBot },
        { x: xt + hw, y: yTop }, { x: xt - hw, y: yTop },
      ], true);
      // windows (rattle near resonance)
      const xm = (xb + xt) / 2;
      const rattle = nearResonance ? Math.sin(this.shake.t * 60 + i) * 1.5 : 0;
      tg.fillStyle(0xfdf6e3, 1);
      for (const dx of [-32, 0, 32]) {
        tg.fillRect(xm + dx - 9 + rattle, yTop + 7, 18, 13);
      }
    }
    // roof
    const xr = offset(N);
    const yr = GROUND_Y - N * FLOOR_H;
    tg.fillStyle(0x1d3557, 1).fillRect(xr - TOWER_W / 2 - 6, yr - 8, TOWER_W + 12, 8);
  }
}
