// Science-card text. No Phaser imports, so this is unit-testable.

/** One plain-language sentence about the tower/ground rhythm ratio r = T_b / T_g. */
export function explainRatio(r) {
  if (r >= 0.8 && r <= 1.25) {
    return 'The rhythms match! Every push from the ground arrives just in time to add to the sway. This is called resonance.';
  }
  if (r < 0.8) {
    return 'Your tower swings faster than the ground shakes, so it simply rides along with the ground.';
  }
  return 'Your tower swings slower than the ground shakes. The pushes keep changing direction before the tower can build up a big sway.';
}

export const LIMITS_NOTE =
  'Real buildings sway in several ways at once, soil can soften in a strong quake, and real earthquakes mix many rhythms. This game shows the core idea only.';
