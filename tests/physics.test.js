import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Shake, daf, simulate, GROUNDS, starsFor } from '../src/physics.js';

// Steady state: a long, constant-amplitude sine with no noise.
function steadyStateRatio(r) {
  const Tg = 1.0;
  const floors = Math.round((r * Tg) / 0.1);
  const s = new Shake({
    floors,
    groundPeriod: Tg,
    noise: 0,
    duration: 200,
    envelopeFn: () => 1,
  });
  s.advance(150);          // let the transient die out
  s.maxAbsU = 0;
  s.advance(20);           // measure over 20 ground cycles
  return s.swayRatio;
}

for (const r of [0.5, 1.0, 2.0]) {
  test(`steady state matches DAF within 10% (r = ${r})`, () => {
    const measured = steadyStateRatio(r);
    const expected = daf(r);
    const err = Math.abs(measured - expected) / expected;
    assert.ok(err < 0.1, `r=${r}: measured ${measured.toFixed(3)}, DAF ${expected.toFixed(3)}, err ${(err * 100).toFixed(1)}%`);
  });
}

test('on soft soil, 10 floors gets fewer stars than 4 or 15 floors', () => {
  const Tg = GROUNDS.soft.period;
  const res = Object.fromEntries([4, 10, 15].map((n) => [n, simulate({ floors: n, groundPeriod: Tg })]));
  for (const n of [4, 10, 15]) console.log(`  N=${n}: R=${res[n].R.toFixed(2)}, stars=${res[n].stars}`);
  assert.ok(res[10].stars < res[4].stars);
  assert.ok(res[10].stars < res[15].stars);
});

test('star thresholds', () => {
  assert.equal(starsFor(1.5), 3);
  assert.equal(starsFor(3), 2);
  assert.equal(starsFor(5), 1);
  assert.equal(starsFor(7), 0);
});
