// Level data and hint logic. No Phaser imports, so this is unit-testable.
import { GROUNDS, simulate, DEFAULT_ZETA } from './physics.js';

export const DAMPER_ZETA = 0.20;

// Grounds that only exist in later levels.
export const MYSTERY_PERIODS = [0.7, 0.8, 1.2, 1.4];
export const RANDOM_PERIODS = [1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0];
const MYSTERY_COLOR = 0x7d6b91;
const RANDOM_COLOR = 0x6b705c;

export const LEVELS = [
  {
    title: 'Rock', ground: 'rock', minFloors: 6, maxFloors: 10, startFloors: 8, goal: 'Any height',
    intro: 'Tap Shake! to see how an earthquake moves a tower.',
    lesson: 'Rock shakes fast and gently. Tall towers barely notice it.',
  },
  {
    title: 'Soft soil', ground: 'soft', minFloors: 3, maxFloors: 15, startFloors: 6, goal: 'Build at least 3 floors',
    intro: 'Soft soil shakes slower. Try different heights!',
    lesson: 'Some heights shake far more than others.',
  },
  {
    title: 'Stiff soil', ground: 'stiff', minFloors: 2, maxFloors: 10, startFloors: 4, goal: 'Build at least 2 floors',
    intro: 'New ground, new rhythm. Is the wobbly height the same?',
    lesson: 'The wobbly height moves when the ground changes.',
  },
  {
    title: 'Rock', ground: 'rock', minFloors: 1, maxFloors: 5, startFloors: 2, goal: 'Build at least 1 floor',
    intro: 'Small houses on rock. Surely nothing can go wrong?',
    lesson: 'Even small houses can wobble if their rhythm matches the ground.',
  },
  {
    title: 'Very soft clay', ground: 'softClay', minFloors: 8, maxFloors: 20, startFloors: 15, goal: 'Build at least 8 floors',
    intro: 'Very soft clay: slow, strong shaking.',
    lesson: 'Soft ground is hardest on tall towers.',
  },
  {
    title: 'Hospital', ground: 'soft', groundChoice: ['soft', 'rock'],
    minFloors: 10, maxFloors: 10, startFloors: 10, goal: 'A 10-floor hospital with 3 stars', minStars: 3,
    intro: 'A hospital must keep working after a quake. Choose where to build it.',
    lesson: 'Where you build matters as much as what you build.',
  },
  {
    title: 'Damper', ground: 'soft', damper: true,
    minFloors: 10, maxFloors: 10, startFloors: 10, goal: 'At least 2 stars', minStars: 2,
    intro: 'New: a damper! A heavy swinging weight that soaks up sway. Tap to switch it on.',
    lesson: 'Dampers calm a tower whose rhythm matches the ground.',
  },
  {
    title: 'Street', ground: 'stiff', towers: 3, startFloors: [4, 5, 6],
    minFloors: 2, maxFloors: 12, goal: 'All three towers 2+ stars', minStars: 2,
    intro: 'Plan a whole street: three towers, one earthquake.',
    lesson: 'A safe street keeps every building away from the wobbly height.',
  },
  {
    title: 'Mystery ground', mystery: true, minFloors: 2, maxFloors: 20, startFloors: 10,
    goal: '3 stars', minStars: 3,
    intro: 'Nobody knows this ground. Tap Probe to feel its rhythm before you build.',
    lesson: 'Engineers measure the ground before they build. One method, HVSR, listens to its tiny natural shaking.',
  },
  {
    title: 'Free build', randomGround: true, minFloors: 1, maxFloors: 20, startFloors: 10,
    goal: 'Tallest tower with 3 stars', minStars: 3, tallest: true,
    intro: 'A new ground every time. How tall can you build and still get 3 stars?',
    lesson: 'Stay well away from the ground\'s rhythm: much shorter, or (sometimes) much taller.',
  },
].map((l, i) => ({ number: i + 1, towers: 1, ...l }));

/** The ground a level starts on (mystery and random grounds are rolled here). */
export function makeGround(level, rand = Math.random) {
  if (level.mystery) {
    const period = MYSTERY_PERIODS[Math.floor(rand() * MYSTERY_PERIODS.length)];
    return { key: 'mystery', name: 'Mystery ground', period, color: MYSTERY_COLOR, hidden: true };
  }
  if (level.randomGround) {
    const period = RANDOM_PERIODS[Math.floor(rand() * RANDOM_PERIODS.length)];
    return { key: 'random', name: 'Random ground', period, color: RANDOM_COLOR };
  }
  return groundFor(level.ground);
}

export function groundFor(key) {
  const g = GROUNDS[key];
  return { key, name: g.name, period: g.period, color: g.color };
}

// Fixed seed so hints and tests are repeatable.
const HINT_SEED = 7;

export function starsAt(floors, period, zeta = DEFAULT_ZETA) {
  return simulate({ floors, groundPeriod: period, zeta, seed: HINT_SEED }).stars;
}

/**
 * Nearest floor count that gets 3 stars: 'shorter', 'taller' or null.
 */
export function hintDirection(level, floors, period, zeta = DEFAULT_ZETA) {
  let best = null;
  for (let n = level.minFloors; n <= level.maxFloors; n++) {
    if (n === floors || starsAt(n, period, zeta) < 3) continue;
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

/** Has this result met the level's goal? (Levels 1-5 just need any result.) */
export function goalMet(level, stars) {
  return stars >= (level.minStars ?? 0);
}
