import { LEVELS, groundFor } from './levels.js';
import { loadProgress } from './progress.js';
import { W, FONT, FONT_BOLD, makeButton, makeMuteButton, drawStars } from './ui.js';
import { drawBackdrop, driftClouds, drawGround } from './art.js';
import { GROUNDS } from './physics.js';

// Menu colour for each level: its ground, or a theme colour for special levels.
const SPECIAL_COLORS = { mystery: 0x7d6b91, randomGround: 0x6b705c };

function levelColor(level) {
  if (level.mystery) return SPECIAL_COLORS.mystery;
  if (level.randomGround) return SPECIAL_COLORS.randomGround;
  return groundFor(level.ground).color;
}

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('menu');
  }

  create(data = {}) {
    const progress = loadProgress();
    this.backdrop = drawBackdrop(this, 690);
    drawGround(this.add.graphics(), 'soft', GROUNDS.soft.color, 690, 0);
    makeMuteButton(this, W - 44, 36);

    this.add.text(W / 2, 56, 'Quake Tower', {
      fontFamily: FONT_BOLD, fontSize: '42px', color: '#1d3557',
    }).setOrigin(0.5);
    this.add.text(W / 2, 102, 'Build towers that survive the shake', {
      fontFamily: FONT, fontSize: '19px', color: '#1d3557',
    }).setOrigin(0.5);

    // Two columns: levels 1-5 teach one idea each, 6-10 combine them.
    const g = this.add.graphics().setDepth(10);
    const label = (s) => ({ fontFamily: FONT_BOLD, fontSize: s, color: '#ffffff', stroke: '#1d3557', strokeThickness: 3 });
    LEVELS.forEach((level, i) => {
      const col = i < 5 ? 0 : 1;
      const x = col === 0 ? 125 : 355;
      const y = 175 + (i % 5) * 96;
      const unlocked = level.number <= progress.unlocked;
      const btn = makeButton(this, x, y, 214, 80, '', unlocked ? levelColor(level) : 0x8d99ae,
        () => this.scene.start('game', { level: i }), 20);
      btn.setEnabled(unlocked);
      btn.add(this.add.text(-96, -24, `${level.number}`, label('34px')));
      btn.add(this.add.text(-52, -26, level.title, { ...label('17px'), wordWrap: { width: 150 } }));
      if (unlocked) {
        drawStars(g, x + 2, y + 18, progress.best[i] ?? 0, 10, 3, 24);
      } else {
        btn.add(this.add.text(-52, 6, 'Locked', label('14px')));
      }
    });

    this.add.text(125, 650, 'Learn', { fontFamily: FONT_BOLD, fontSize: '15px', color: '#1d3557' }).setOrigin(0.5);
    this.add.text(355, 650, 'Combine', { fontFamily: FONT_BOLD, fontSize: '15px', color: '#1d3557' }).setOrigin(0.5);

    if (progress.tallest) {
      this.add.text(W / 2, 718, `Free build record: ${progress.tallest} floors`, {
        fontFamily: FONT_BOLD, fontSize: '18px', color: '#ffffff', stroke: '#1d3557', strokeThickness: 4,
      }).setOrigin(0.5);
    }
    if (data.message) {
      this.add.text(W / 2, 745, data.message, {
        fontFamily: FONT_BOLD, fontSize: '16px', color: '#ffffff', align: 'center', stroke: '#1d3557', strokeThickness: 4,
      }).setOrigin(0.5);
    }
    this.add.text(W / 2, 775, 'Progress is saved in this browser only', {
      fontFamily: FONT, fontSize: '14px', color: '#f1e3c8',
    }).setOrigin(0.5);
  }

  update(_t, deltaMs) {
    driftClouds(this.backdrop.clouds, deltaMs / 1000);
  }
}
