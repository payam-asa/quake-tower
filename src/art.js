// Simple flat-colour art drawn with Phaser Graphics: no image assets needed.
import { W, INK } from './ui.js';

const SKY_TOP = 0x8ecae6;
const SKY_BOTTOM = 0xd7f0fa;

/** Sky gradient, sun, hills and a far-off skyline. Returns drifting cloud objects. */
export function drawBackdrop(scene, horizonY) {
  const g = scene.add.graphics();
  g.fillGradientStyle(SKY_TOP, SKY_TOP, SKY_BOTTOM, SKY_BOTTOM, 1);
  g.fillRect(0, 0, W, horizonY);

  // Sun
  g.fillStyle(0xffe8a3, 0.5).fillCircle(56, 190, 36);
  g.fillStyle(0xffd166, 1).fillCircle(56, 190, 25);

  // Hills
  g.fillStyle(0xa8d5ba, 1);
  g.fillEllipse(70, horizonY + 10, 320, 150);
  g.fillEllipse(420, horizonY + 20, 380, 130);
  g.fillStyle(0x95c9a8, 1).fillEllipse(250, horizonY + 25, 300, 100);

  // Distant skyline silhouette
  g.fillStyle(0x7fa7c4, 0.55);
  const blocks = [[18, 40], [44, 70], [70, 52], [96, 88], [122, 46], [330, 60], [356, 96], [382, 54], [408, 74], [434, 40]];
  for (const [x, h] of blocks) g.fillRect(x, horizonY - h, 24, h);

  // Clouds on their own objects so they can drift.
  const clouds = [[80, 300, 1], [330, 250, 0.8], [200, 360, 0.65]].map(([x, y, s]) => {
    const c = scene.add.graphics({ x, y });
    c.fillStyle(0xffffff, 0.85);
    c.fillCircle(-26 * s, 6 * s, 20 * s).fillCircle(0, 0, 27 * s).fillCircle(26 * s, 7 * s, 18 * s);
    c.fillRect(-26 * s, 6 * s, 52 * s, 18 * s);
    c.speed = 4 + 6 * s;
    return c;
  });
  return { graphics: g, clouds };
}

export function driftClouds(clouds, dtSeconds) {
  for (const c of clouds) {
    c.x += c.speed * dtSeconds;
    if (c.x > W + 60) c.x = -60;
  }
}

/** Ground in layers. Soil gets grass; rock gets cracks. `gx` shifts it sideways. */
export function drawGround(g, groundKey, color, groundY, gx) {
  const c = Phaser.Display.Color.ValueToColor(color);
  const light = c.clone().lighten(10).color;
  const dark = c.clone().darken(20).color;
  const darker = c.clone().darken(32).color;
  const x0 = -30 + gx;
  const w = W + 60;

  g.fillStyle(light, 1).fillRect(x0, groundY, w, 50);
  g.fillStyle(color, 1).fillRect(x0, groundY + 50, w, 80);
  g.fillStyle(dark, 1).fillRect(x0, groundY + 130, w, 90);

  // Wavy boundaries between layers
  for (const [y, col] of [[groundY + 50, color], [groundY + 130, dark]]) {
    g.fillStyle(col, 1);
    for (let x = 0; x < w; x += 24) g.fillCircle(x0 + x, y, 9);
  }

  if (groundKey === 'rock' || groundKey === 'stiff') {
    // Cracks and stones
    g.lineStyle(2, darker, 0.8);
    const cracks = [[40, 15, 60, 40, 52, 70], [190, 70, 214, 96, 204, 120], [330, 20, 350, 48, 372, 60], [420, 140, 440, 170, 430, 200]];
    for (const [ax, ay, bx, by, cx, cy] of cracks) {
      g.beginPath();
      g.moveTo(x0 + ax, groundY + ay);
      g.lineTo(x0 + bx, groundY + by);
      g.lineTo(x0 + cx, groundY + cy);
      g.strokePath();
    }
    g.fillStyle(darker, 1);
    for (let i = 0; i < 10; i++) g.fillEllipse(x0 + ((i * 83) % w), groundY + 30 + ((i * 41) % 170), 16, 9);
  } else {
    // Soft ground: pebbles and roots
    g.fillStyle(darker, 1);
    for (let i = 0; i < 16; i++) g.fillCircle(x0 + ((i * 73) % w), groundY + 22 + ((i * 37) % 180), 3 + (i % 3));
  }

  // Grass on top (not on rock)
  if (groundKey !== 'rock') {
    g.fillStyle(0x6ab04c, 1).fillRect(x0, groundY - 4, w, 8);
    g.fillStyle(0x58a03c, 1);
    for (let x = 0; x < w; x += 14) g.fillTriangle(x0 + x, groundY - 3, x0 + x + 5, groundY - 11, x0 + x + 9, groundY - 3);
  } else {
    g.fillStyle(c.clone().lighten(20).color, 1).fillRect(x0, groundY - 2, w, 5);
  }
}

export const FLOOR_COLORS = [0xf26b5b, 0xf7b538, 0x4fb3bf, 0x7bc96f, 0xa58ad9];

/**
 * Tower with N floors. offset(i) gives the centre x of level line i (0 = ground).
 * Floor 0 gets a door; the roof gets a water tank and an antenna.
 */
export function drawTower(g, { N, floorH, width, groundY, offset, t = 0, rattle = false, damper = false }) {
  const hw = width / 2;
  const ws = width * 0.29; // window spacing
  const ww = Math.min(18, width * 0.17);
  const winH = Math.max(4, Math.round(floorH * 0.45));
  for (let i = 0; i < N; i++) {
    const yBot = groundY - i * floorH;
    const yTop = yBot - floorH;
    const xb = offset(i);
    const xt = offset(i + 1);
    const pts = [
      { x: xb - hw, y: yBot }, { x: xb + hw, y: yBot },
      { x: xt + hw, y: yTop }, { x: xt - hw, y: yTop },
    ];
    const col = FLOOR_COLORS[i % FLOOR_COLORS.length];
    g.fillStyle(col, 1).fillPoints(pts, true);
    // Slab line under each floor
    g.lineStyle(3, Phaser.Display.Color.ValueToColor(col).darken(25).color, 1);
    g.lineBetween(xb - hw, yBot - 1, xb + hw, yBot - 1);
    g.lineStyle(2, INK, 0.45).strokePoints(pts, true);

    const xm = (xb + xt) / 2;
    const dx = rattle ? Math.sin(t * 60 + i * 1.7) * 1.6 : 0;
    const wy = yTop + (floorH - winH) / 2;
    if (i === 0) {
      // Door in the middle, windows either side
      const dh = Math.max(8, floorH - 6);
      g.fillStyle(0x6d4c41, 1).fillRoundedRect(xm - 9, yBot - dh, 18, dh, { tl: 6, tr: 6, bl: 0, br: 0 });
      g.fillStyle(0xffd166, 1).fillCircle(xm + 5, yBot - dh / 2, 1.6);
      for (const wx of [-ws, ws]) drawWindow(g, xm + wx - ww / 2 + dx, wy, ww, winH);
    } else {
      for (const wx of [-ws, 0, ws]) drawWindow(g, xm + wx - ww / 2 + dx, wy, ww, winH);
    }
  }
  // Roof, water tank and antenna
  const xr = offset(N);
  const yr = groundY - N * floorH;
  if (damper) {
    // A heavy pendulum hung from the roof; it lags behind the tower's sway.
    const lean = offset(N) - offset(N - 1);
    const len = Math.max(floorH * 1.6, 20);
    const bx = xr - lean * 3;
    const by = yr + len;
    g.lineStyle(3, INK, 1).lineBetween(xr, yr, bx, by);
    g.fillStyle(0x495057, 1).fillCircle(bx, by, Math.max(6, floorH * 0.38));
    g.lineStyle(2, 0xffd166, 1).strokeCircle(bx, by, Math.max(6, floorH * 0.38));
  }
  g.fillStyle(INK, 1).fillRect(xr - hw - 6, yr - 8, width + 12, 8);
  g.fillStyle(0x8d99ae, 1).fillRect(xr - hw + 8, yr - 22, Math.min(22, width * 0.2), 14);
  g.fillStyle(0x6c7a89, 1).fillRect(xr - hw + 6, yr - 25, Math.min(26, width * 0.24), 4);
  g.lineStyle(2, INK, 1).lineBetween(xr + hw - 14, yr - 8, xr + hw - 14 + (offset(N) - offset(N - 1)) * 2, yr - 34);
  g.fillStyle(0xe63946, 1).fillCircle(xr + hw - 14 + (offset(N) - offset(N - 1)) * 2, yr - 35, 3);
}

function drawWindow(g, x, y, w, h) {
  g.fillStyle(0xfdf6e3, 1).fillRect(x, y, w, h);
  g.fillStyle(0xbfe3f5, 0.9).fillRect(x + 2, y + 2, w / 2 - 3, h - 4);
}
