import { LEVELS } from './levels.js';
import { loadProgress } from './progress.js';
import { W, FONT, FONT_BOLD, makeButton, makeMuteButton, drawStars } from './ui.js';
import { drawBackdrop, driftClouds, drawGround } from './art.js';
import { GROUNDS } from './physics.js';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('menu');
  }

  create(data = {}) {
    const progress = loadProgress();
    this.backdrop = drawBackdrop(this, 690);
    drawGround(this.add.graphics(), 'soft', GROUNDS.soft.color, 690, 0);
    makeMuteButton(this, W - 44, 36);
    this.add.text(W / 2, 60, 'Quake Tower', {
      fontFamily: FONT_BOLD, fontSize: '44px', color: '#1d3557',
    }).setOrigin(0.5);
    this.add.text(W / 2, 112, 'Build towers that survive the shake', {
      fontFamily: FONT, fontSize: '20px', color: '#1d3557',
    }).setOrigin(0.5);

    const g = this.add.graphics();
    LEVELS.forEach((level, i) => {
      const y = 200 + i * 100;
      const unlocked = level.number <= progress.unlocked;
      const btn = makeButton(this, W / 2, y, 360, 80, '', unlocked ? level.groundInfo.color : 0x8d99ae,
        () => this.scene.start('game', { level: i }), 22);
      btn.setEnabled(unlocked);
      btn.add(this.add.text(-160, -26, `${level.number}`, {
        fontFamily: FONT_BOLD, fontSize: '40px', color: '#ffffff', stroke: '#1d3557', strokeThickness: 3,
      }));
      btn.add(this.add.text(-110, -26, level.groundInfo.name, {
        fontFamily: FONT_BOLD, fontSize: '22px', color: '#ffffff', stroke: '#1d3557', strokeThickness: 3,
      }));
      btn.add(this.add.text(-110, 6, unlocked ? level.goal : 'Locked', {
        fontFamily: FONT, fontSize: '16px', color: '#ffffff', stroke: '#1d3557', strokeThickness: 3,
      }));
      if (unlocked) drawStars(g, W / 2 + 112, y, progress.best[i] ?? 0, 14, 3, 32);
    });
    g.setDepth(10);

    if (data.message) {
      this.add.text(W / 2, 735, data.message, {
        fontFamily: FONT_BOLD, fontSize: '22px', color: '#ffffff', align: 'center', stroke: '#1d3557', strokeThickness: 4,
      }).setOrigin(0.5);
    }
    this.add.text(W / 2, 770, 'Progress is saved in this browser only', {
      fontFamily: FONT, fontSize: '14px', color: '#f1e3c8',
    }).setOrigin(0.5);
  }

  update(_t, deltaMs) {
    driftClouds(this.backdrop.clouds, deltaMs / 1000);
  }
}
