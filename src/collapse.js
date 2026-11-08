// Collapse animation: a tower's floors break apart and pancake onto each other.
// Pure drawing/kinematics on plain objects; the scene calls make → step → draw.
import { INK } from './ui.js';
import { FLOOR_COLORS } from './art.js';

const GRAVITY = 1500; // px/s^2

/**
 * Snapshot a tower at the moment it fails.
 * offset(i) is the centre x of level line i at that instant (as used by drawTower).
 */
export function makeCollapse({ N, floorH, width, groundY, offset, rand = Math.random }) {
  const lean = offset(N) - offset(0);
  const dir = lean >= 0 ? 1 : -1;
  const pieces = [];
  for (let i = 0; i < N; i++) {
    const x0 = offset(i);
    const x1 = offset(i + 1);
    const restRot = dir * (0.08 + rand() * 0.18) * (i % 2 ? 1 : -0.6);
    pieces.push({
      x: (x0 + x1) / 2,
      y: groundY - (i + 0.5) * floorH,
      w: width,
      h: floorH,
      rot: Math.atan2(x1 - x0, floorH),
      vx: dir * (30 + i * 14 + rand() * 25),
      vy: -30 * rand(),
      vrot: dir * (0.6 + rand() * 1.6),
      // Pancake pile: each floor comes to rest overlapping the one below.
      restY: groundY - floorH / 2 - i * floorH * 0.42,
      restRot,
      delay: Math.max(0, (N - i) * 0.015), // upper floors let go a touch later
      color: FLOOR_COLORS[i % FLOOR_COLORS.length],
      settled: false,
    });
  }
  // Roof slab
  pieces.push({
    x: offset(N), y: groundY - N * floorH - 4, w: width + 12, h: 8,
    rot: 0, vx: dir * (60 + N * 16), vy: -60, vrot: dir * 2.4,
    restY: groundY - 4 - N * floorH * 0.42, restRot: dir * 0.35, delay: 0,
    color: INK, roof: true, settled: false,
  });

  // Flying chunks and a dust cloud at the base.
  const chunks = [];
  for (let k = 0; k < 16; k++) {
    chunks.push({
      x: offset(Math.floor(rand() * N)) + (rand() - 0.5) * width,
      y: groundY - rand() * N * floorH,
      vx: (rand() - 0.3 * dir) * 260 * dir,
      vy: -120 - rand() * 220,
      s: 3 + rand() * 6,
      color: FLOOR_COLORS[k % FLOOR_COLORS.length],
      rot: rand() * 6,
      settled: false,
    });
  }
  const dust = [];
  for (let k = 0; k < 14; k++) {
    dust.push({
      x: offset(0) + (rand() - 0.5) * width * 1.6,
      y: groundY - 6 - rand() * 20,
      r: 10 + rand() * 12,
      vr: 28 + rand() * 30,
      vx: (rand() - 0.5) * 60,
      vy: -10 - rand() * 25,
      a: 0.75,
    });
  }
  return { pieces, chunks, dust, groundY, age: 0 };
}

export function stepCollapse(c, dt) {
  c.age += dt;
  for (const p of c.pieces) {
    if (p.settled) continue;
    if (p.delay > 0) { p.delay -= dt; continue; }
    p.vy += GRAVITY * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vrot * dt;
    if (p.y >= p.restY) {
      p.y = p.restY;
      p.settled = true;
      p.rot = p.restRot;
    }
  }
  for (const ch of c.chunks) {
    if (ch.settled) continue;
    ch.vy += GRAVITY * dt;
    ch.x += ch.vx * dt;
    ch.y += ch.vy * dt;
    ch.rot += 8 * dt;
    if (ch.y >= c.groundY - ch.s / 2) {
      ch.y = c.groundY - ch.s / 2;
      ch.settled = true;
    }
  }
  for (const d of c.dust) {
    d.r += d.vr * dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.a = Math.max(0, d.a - dt * 0.32);
  }
}

export function drawCollapse(g, c) {
  // Settled pieces first so falling ones draw on top.
  const order = [...c.pieces].sort((a, b) => (b.settled - a.settled) || (b.y - a.y));
  for (const p of order) {
    g.save();
    g.translateCanvas(p.x, p.y);
    g.rotateCanvas(p.rot);
    g.fillStyle(p.color, 1).fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    if (!p.roof) {
      g.lineStyle(2, INK, 0.5).strokeRect(-p.w / 2, -p.h / 2, p.w, p.h);
      const ww = Math.min(18, p.w * 0.17);
      const wh = Math.max(4, Math.round(p.h * 0.45));
      g.fillStyle(0x2b2d42, 0.85); // broken, dark windows
      for (const wx of [-p.w * 0.29, 0, p.w * 0.29]) g.fillRect(wx - ww / 2, -wh / 2, ww, wh);
    }
    g.restore();
  }
  for (const ch of c.chunks) {
    g.save();
    g.translateCanvas(ch.x, ch.y);
    g.rotateCanvas(ch.rot);
    g.fillStyle(ch.color, 1).fillRect(-ch.s / 2, -ch.s / 2, ch.s, ch.s);
    g.restore();
  }
  for (const d of c.dust) {
    if (d.a <= 0) continue;
    g.fillStyle(0xe9d8b4, d.a).fillCircle(d.x, d.y, d.r);
  }
}
