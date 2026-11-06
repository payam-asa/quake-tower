import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, starsAt, hintDirection } from '../src/levels.js';

// "Wobbly height" from the design doc (T_b ≈ T_g); null = none in range.
const WOBBLY = { 1: null, 2: 10, 3: 5, 4: 2, 5: 15 };

for (const level of LEVELS) {
  test(`level ${level.number}: has a 3-star choice and a clear bad choice`, () => {
    const stars = [];
    for (let n = level.minFloors; n <= level.maxFloors; n++) stars.push(starsAt(level, n));
    assert.ok(stars.includes(3), 'no 3-star height');
    const w = WOBBLY[level.number];
    if (w !== null) assert.ok(starsAt(level, w) <= 1, `wobbly height ${w} should get <= 1 star`);
    assert.ok(level.startFloors >= level.minFloors && level.startFloors <= level.maxFloors);
  });
}

test('levels 1-3 are easy to 3-star (at least 3 heights each)', () => {
  for (const level of LEVELS.slice(0, 3)) {
    let count = 0;
    for (let n = level.minFloors; n <= level.maxFloors; n++) if (starsAt(level, n) === 3) count++;
    assert.ok(count >= 3, `level ${level.number} has only ${count} 3-star heights`);
  }
});

test('hints point away from resonance', () => {
  assert.equal(hintDirection(LEVELS[1], 9), 'shorter');   // soft soil, 9 floors: 5 is closer than 14
  assert.equal(hintDirection(LEVELS[1], 12), 'taller');   // 14 is closer than 5
  assert.equal(hintDirection(LEVELS[3], 2), 'shorter');   // rock, 2 floors: 1 and 3 tie, pick first found
  assert.equal(hintDirection(LEVELS[4], 15), 'shorter');  // clay: only 8 floors gets 3 stars
});
