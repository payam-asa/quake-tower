// Level data and hint logic. No Phaser imports, so this is unit-testable.
import { GROUNDS, simulate } from './physics.js';

export const LEVELS = [
  {
    ground: 'rock', minFloors: 6, maxFloors: 10, startFloors: 8, goal: 'Any height',
    intro: 'Tap Shake! to see how an earthquake moves a tower.',
    lesson: 'Rock shakes fast and gently. Tall towers barely notice it.',
  },
  {
    ground: 'soft', minFloors: 3, maxFloors: 15, startFloors: 6, goal: 'Build at least 3 floors',
    intro: 'Soft soil shakes slower. Try different heights!',
    lesson: 'Some heights shake far more than others.',
  },
  {
    ground: 'stiff', minFloors: 2, maxFloors: 10, startFloors: 4, goal: 'Build at least 2 floors',
    intro: 'New ground, new rhythm. Is the wobbly height the same?',
    lesson: 'The wobbly height moves when the ground changes.',
  },
  {
    ground: 'rock', minFloors: 1, maxFloors: 5, startFloors: 2, goal: 'Build at least 1 floor',
    intro: 'Small houses on rock. Surely nothing can go wrong?',
    lesson: 'Even small houses can wobble if their rhythm matches the ground.',
  },
  {
    ground: 'softClay', minFloors: 8, maxFloors: 20, startFloors: 15, goal: 'Build at least 8 floors',
    intro: 'Very soft clay: slow, strong shaking.',
    lesson: 'Soft ground is hardest on tall towers.',
  },
].map((l, i) => ({ ...l, number: i + 1, groundInfo: GROUNDS[l.ground] }));

// Fixed seed so hints and tests are repeatable.
const HINT_SEED = 7;

export function starsAt(level, floors) {
  return simulate({ floors, groundPeriod: level.groundInfo.period, seed: HINT_SEED }).stars;
}

/**
 * Hint after a poor result: point to the nearest floor count that gets 3 stars.
 * Returns 'shorter', 'taller' or null if nothing better exists.
 */
export function hintDirection(level, floors) {
  let best = null;
  for (let n = level.minFloors; n <= level.maxFloors; n++) {
    if (n === floors || starsAt(level, n) < 3) continue;
    if (best === null || Math.abs(n - floors) < Math.abs(best - floors)) best = n;
  }
  if (best === null) return null;
  return best < floors ? 'shorter' : 'taller';
}

export function hintText(direction) {
  if (direction === 'shorter') return 'Hint: try a shorter tower';
  if (direction === 'taller') return 'Hint: try a taller tower';
  return 'Hint: try a very different height';
}
