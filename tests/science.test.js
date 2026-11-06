import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explainRatio } from '../src/science.js';

test('science card explains all three regimes', () => {
  assert.match(explainRatio(1.0), /resonance/);
  assert.match(explainRatio(0.4), /rides along/);
  assert.match(explainRatio(2.0), /slower/);
});
