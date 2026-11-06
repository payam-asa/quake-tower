import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LEVELS, starsAt, hintDirection, groundFor, MYSTERY_PERIODS, RANDOM_PERIODS, DAMPER_ZETA, goalMet,
} from '../src/levels.js';

const L = (n) => LEVELS[n - 1];
const period = (key) => groundFor(key).period;

// "Wobbly height" from the design doc (T_b ≈ T_g); null = none in range.
const WOBBLY = { 1: null, 2: 10, 3: 5, 4: 2, 5: 15 };

for (const n of [1, 2, 3, 4, 5]) {
  const level = L(n);
  test(`level ${n}: has a 3-star choice and a clear bad choice`, () => {
    const p = period(level.ground);
    const stars = [];
    for (let f = level.minFloors; f <= level.maxFloors; f++) stars.push(starsAt(f, p));
    assert.ok(stars.includes(3), 'no 3-star height');
    const w = WOBBLY[n];
    if (w !== null) assert.ok(starsAt(w, p) <= 1, `wobbly height ${w} should get <= 1 star`);
    assert.ok(level.startFloors >= level.minFloors && level.startFloors <= level.maxFloors);
  });
}

test('levels 1-3 are easy to 3-star (at least 3 heights each)', () => {
  for (const level of LEVELS.slice(0, 3)) {
    let count = 0;
    for (let f = level.minFloors; f <= level.maxFloors; f++) if (starsAt(f, period(level.ground)) === 3) count++;
    assert.ok(count >= 3, `level ${level.number} has only ${count} 3-star heights`);
  }
});

test('hints point to the nearest 3-star height', () => {
  assert.equal(hintDirection(L(2), 9, 1.0), 'shorter');
  assert.equal(hintDirection(L(2), 12, 1.0), 'taller');
  assert.equal(hintDirection(L(5), 15, 1.5), 'shorter');
});

test('level 6: the hospital passes on rock and fails on soft soil', () => {
  assert.equal(starsAt(10, period('rock')), 3);
  assert.ok(starsAt(10, period('soft')) <= 1);
  assert.ok(goalMet(L(6), 3) && !goalMet(L(6), 2));
});

test('level 7: the damper turns a 0-star tower into a goal-meeting one', () => {
  const off = starsAt(10, period('soft'));
  const on = starsAt(10, period('soft'), DAMPER_ZETA);
  assert.ok(off <= 1, `without damper: ${off}`);
  assert.ok(goalMet(L(7), on), `with damper: ${on}`);
});

test('level 8: the start street has a bad tower and a full 2-star street exists', () => {
  const p = period('stiff');
  assert.ok(Math.min(...L(8).startFloors.map((f) => starsAt(f, p))) < 2);
  let good = 0;
  for (let f = 2; f <= 12; f++) if (starsAt(f, p) >= 2) good++;
  assert.ok(good >= 3);
});

test('level 9: every mystery ground has several 3-star heights and a wobbly one', () => {
  for (const p of MYSTERY_PERIODS) {
    let three = 0;
    for (let f = 2; f <= 20; f++) if (starsAt(f, p) === 3) three++;
    assert.ok(three >= 3, `T_g=${p}: ${three} three-star heights`);
    assert.ok(starsAt(Math.round(p * 10), p) <= 1, `T_g=${p}: resonant height not wobbly`);
  }
});

test('level 10: every random ground has a 3-star height and a wobbly zone', () => {
  for (const p of RANDOM_PERIODS) {
    const stars = [];
    for (let f = 1; f <= 20; f++) stars.push(starsAt(f, p));
    assert.ok(stars.includes(3), `T_g=${p}`);
    assert.ok(Math.min(...stars) <= 1, `T_g=${p}: no wobbly zone`);
  }
});
