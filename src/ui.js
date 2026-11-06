// Shared drawing helpers for the Phaser scenes.
export const W = 480;
export const H = 800;
export const INK = 0x1d3557;
export const STAR_ON = 0xffc93c;
export const STAR_OFF = 0xdde6ea;

export const FONT = 'Arial, sans-serif';
export const FONT_BOLD = 'Arial Black, Arial, sans-serif';

export function makeButton(scene, x, y, w, h, label, color, onClick, fontSize = 30) {
  const c = scene.add.container(x, y);
  const bg = scene.add.graphics();
  const draw = (fill) => {
    bg.clear();
    bg.fillStyle(0x000000, 0.25).fillRoundedRect(-w / 2, -h / 2 + 4, w, h, 14);
    bg.fillStyle(fill, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 14);
  };
  draw(color);
  const txt = scene.add.text(0, 0, label, {
    fontFamily: FONT_BOLD, fontSize: `${fontSize}px`, color: '#ffffff', align: 'center',
  }).setOrigin(0.5);
  c.add([bg, txt]);
  c.setSize(w, h);
  c.setInteractive({ useHandCursor: true });
  c.enabled = true;
  const dark = Phaser.Display.Color.ValueToColor(color).darken(15).color;
  c.on('pointerdown', () => { if (c.enabled) draw(dark); });
  c.on('pointerout', () => draw(color));
  c.on('pointerup', () => { draw(color); if (c.enabled && c.visible) onClick(); });
  c.setEnabled = (on) => { c.enabled = on; c.setAlpha(on ? 1 : 0.4); return c; };
  c.label = txt;
  return c;
}

export function starPoints(x, y, outer, inner = outer * 0.42) {
  const pts = [];
  for (let j = 0; j < 10; j++) {
    const r = j % 2 ? inner : outer;
    const a = -Math.PI / 2 + (j * Math.PI) / 5;
    pts.push({ x: x + r * Math.cos(a), y: y + r * Math.sin(a) });
  }
  return pts;
}

/** Draw `total` stars centred on (x, y), the first `n` filled. */
export function drawStars(g, x, y, n, size = 24, total = 3, gap = size * 2.3) {
  for (let k = 0; k < total; k++) {
    const pts = starPoints(x + (k - (total - 1) / 2) * gap, y, size);
    g.fillStyle(k < n ? STAR_ON : STAR_OFF, 1).fillPoints(pts, true);
    g.lineStyle(Math.max(2, size / 8), INK, 1).strokePoints(pts, true);
  }
}
