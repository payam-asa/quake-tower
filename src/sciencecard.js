// The optional science card shown after a shake.
import { daf, towerPeriod, DEFAULT_ZETA } from './physics.js';
import { explainRatio, LIMITS_NOTE } from './science.js';
import { W, H, INK, FONT, FONT_BOLD, makeButton } from './ui.js';

const PANEL_W = 440;
const PANEL_H = 690;

export function showScienceCard(scene, { ground, floors, R, zeta = DEFAULT_ZETA, collapsed = false, onClose }) {
  const Tb = towerPeriod(floors);
  const Tg = ground.period;
  const r = Tb / Tg;

  const c = scene.add.container(0, 0).setDepth(100);
  const shade = scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.45).setInteractive(); // blocks taps behind
  c.add(shade);

  const px = (W - PANEL_W) / 2;
  const py = 55;
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.2).fillRoundedRect(px, py + 6, PANEL_W, PANEL_H, 20);
  g.fillStyle(0xfdf6e3, 1).fillRoundedRect(px, py, PANEL_W, PANEL_H, 20);
  g.lineStyle(3, INK, 1).strokeRoundedRect(px, py, PANEL_W, PANEL_H, 20);
  c.add(g);

  const text = (x, y, s, style = {}) => {
    const t = scene.add.text(x, y, s, { fontFamily: FONT, fontSize: '17px', color: '#1d3557', ...style });
    c.add(t);
    return t;
  };

  text(W / 2, py + 22, 'Science card', { fontFamily: FONT_BOLD, fontSize: '26px' }).setOrigin(0.5, 0);

  // --- Rhythm bars: one full back-and-forth swing, drawn to the same scale ---
  const barX = px + 150;
  const barMaxW = PANEL_W - 230;
  const scale = barMaxW / Math.max(Tb, Tg, 0.5);
  let y = py + 78;
  text(px + 24, y, 'One swing takes:', { fontStyle: 'bold' });
  y += 32;
  for (const [label, T, col] of [['Your tower', Tb, 0xf26b5b], ['The ground', Tg, ground.color]]) {
    text(px + 24, y, label);
    g.fillStyle(col, 1).fillRoundedRect(barX, y + 2, Math.max(6, T * scale), 18, 6);
    g.lineStyle(2, INK, 0.6).strokeRoundedRect(barX, y + 2, Math.max(6, T * scale), 18, 6);
    text(barX + Math.max(6, T * scale) + 8, y, `${T.toFixed(1)} s`, { fontStyle: 'bold' });
    y += 34;
  }
  text(px + 24, y, `Tower ÷ ground = ${r.toFixed(2)}`, { fontStyle: 'bold' });
  y += 34;

  // --- Resonance curve: amplification vs ratio, with this tower marked ---
  const gx0 = px + 50;
  const gy0 = y + 172;        // x-axis y
  const gw = PANEL_W - 80;
  const gh = 145;
  const rMax = 3;
  const yMax = 11;
  const X = (rr) => gx0 + (rr / rMax) * gw;
  const Y = (a) => gy0 - (Math.min(a, yMax) / yMax) * gh;

  g.lineStyle(2, INK, 1).lineBetween(gx0, gy0, gx0 + gw, gy0).lineBetween(gx0, gy0, gx0, gy0 - gh);
  g.lineStyle(1, INK, 0.25).lineBetween(X(1), gy0, X(1), gy0 - gh);
  for (const rr of [0, 1, 2, 3]) text(X(rr), gy0 + 6, `${rr}`, { fontSize: '14px' }).setOrigin(0.5, 0);
  text(gx0 + gw / 2, gy0 + 24, 'tower rhythm ÷ ground rhythm', { fontSize: '14px' }).setOrigin(0.5, 0);
  text(gx0 - 10, gy0 - gh - 26, 'How much it sways', { fontSize: '14px' });

  g.lineStyle(3, 0xe63946, 1);
  g.beginPath();
  for (let i = 0; i <= 150; i++) {
    const rr = (i / 150) * rMax;
    const p = [X(rr), Y(daf(rr, zeta))];
    if (i === 0) g.moveTo(...p); else g.lineTo(...p);
  }
  g.strokePath();

  const mx = X(Math.min(r, rMax));
  const my = Y(daf(r, zeta));
  g.fillStyle(INK, 1).fillCircle(mx, my, 8);
  g.fillStyle(0xffc93c, 1).fillCircle(mx, my, 5);
  const lbl = text(mx + (r > 2 ? -12 : 12), my - 26, 'your tower', { fontSize: '14px', fontStyle: 'bold' });
  if (r > 2) lbl.setOrigin(1, 0);

  y = gy0 + 50;
  text(px + 24, y, explainRatio(r), { wordWrap: { width: PANEL_W - 48 } });
  y += 74;
  const extra = zeta > DEFAULT_ZETA ? ' · damper on (flatter curve)' : '';
  const shakeLine = collapsed
    ? `This shake: the sway ratio passed 6 and the tower collapsed${extra}`
    : `This shake: sway ratio ${R.toFixed(1)}${extra}`;
  text(px + 24, y, shakeLine, { fontSize: '15px', color: '#457b9d' });
  y += 26;
  text(px + 24, y, LIMITS_NOTE, { fontSize: '13px', color: '#5c677d', wordWrap: { width: PANEL_W - 48 } });

  const close = makeButton(scene, W / 2, py + PANEL_H - 40, 160, 52, 'Got it', 0x2a9d8f, () => {
    c.destroy();
    if (onClose) onClose();
  }, 24);
  c.add(close);
  return c;
}
