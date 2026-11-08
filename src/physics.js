// Quake Tower physics: a single-degree-of-freedom oscillator shaken at its base.
// No Phaser imports, so this module runs in Node for unit tests and in the browser.

export const DT = 1 / 240;          // integration step (s)
export const SHAKE_DURATION = 6;    // total shake length (s)
export const RAMP = 1;              // envelope ramp up / down (s)
export const DEFAULT_ZETA = 0.05;   // 5% damping (0.20 with a damper, later levels)
export const DEFAULT_AMPLITUDE = 1; // peak ground acceleration A (m/s^2)

export const GROUNDS = {
  rock:     { name: 'Rock',           period: 0.2, color: 0x9a9a9a },
  stiff:    { name: 'Stiff soil',     period: 0.5, color: 0xd2b48c },
  soft:     { name: 'Soft soil',      period: 1.0, color: 0x8b5a2b },
  softClay: { name: 'Very soft clay', period: 1.5, color: 0x5c3a1e },
};

/** Rule-of-thumb building period: T_b = 0.1 * N seconds. */
export function towerPeriod(floors) {
  return 0.1 * floors;
}

/** Steady-state dynamic amplification factor, r = T_b / T_g. */
export function daf(r, zeta = DEFAULT_ZETA) {
  return 1 / Math.sqrt((1 - r * r) ** 2 + (2 * zeta * r) ** 2);
}

/** Smooth 0 -> 1 -> 0 envelope: half-cosine ramps of RAMP seconds, hold in between. */
export function envelope(t, duration = SHAKE_DURATION, ramp = RAMP) {
  if (t <= 0 || t >= duration) return 0;
  if (t < ramp) return 0.5 - 0.5 * Math.cos(Math.PI * t / ramp);
  if (t > duration - ramp) return 0.5 - 0.5 * Math.cos(Math.PI * (duration - t) / ramp);
  return 1;
}

/** Small deterministic PRNG so tests and replays are repeatable. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A running simulation of one shake.
 * Call step() repeatedly (or advance(seconds)) and read u, ag, groundDisp, maxAbsU.
 */
export class Shake {
  constructor({
    floors,
    groundPeriod,
    zeta = DEFAULT_ZETA,
    amplitude = DEFAULT_AMPLITUDE,
    duration = SHAKE_DURATION,
    ramp = RAMP,
    noise = 0.05,        // noise level as a fraction of A
    seed = 1,
    envelopeFn = null,   // override, e.g. () => 1 for steady-state tests
  }) {
    this.floors = floors;
    this.Tb = towerPeriod(floors);
    this.Tg = groundPeriod;
    this.omega = (2 * Math.PI) / this.Tb;
    this.omegaG = (2 * Math.PI) / this.Tg;
    this.zeta = zeta;
    this.A = amplitude;
    this.duration = duration;
    this.ramp = ramp;
    this.noiseLevel = noise;
    this.rand = mulberry32(seed);
    this.envelopeFn = envelopeFn || ((t) => envelope(t, this.duration, this.ramp));

    this.t = 0;
    this.u = 0;      // relative displacement of the tower top (m)
    this.v = 0;      // relative velocity (m/s)
    this.ag = 0;     // current ground acceleration (m/s^2)
    this.noiseState = 0;
    this.maxAbsU = 0;
  }

  groundAccel(t) {
    // Low-pass filtered white noise keeps the "small random noise" smooth.
    const white = this.rand() * 2 - 1;
    this.noiseState += 0.05 * (white - this.noiseState);
    const env = this.envelopeFn(t);
    return this.A * env * (Math.sin(this.omegaG * t) + this.noiseLevel * 4 * this.noiseState);
  }

  /** Ground displacement for drawing (from the sine part: x = -a / omega_g^2). */
  get groundDisp() {
    return -this.ag / (this.omegaG * this.omegaG);
  }

  get done() {
    return this.t >= this.duration;
  }

  step(dt = DT) {
    this.ag = this.groundAccel(this.t);
    // u'' + 2 zeta w u' + w^2 u = -a_g   (semi-implicit Euler)
    const acc = -this.ag - 2 * this.zeta * this.omega * this.v - this.omega * this.omega * this.u;
    this.v += acc * dt;
    this.u += this.v * dt;
    this.t += dt;
    const a = Math.abs(this.u);
    if (a > this.maxAbsU) this.maxAbsU = a;
  }

  /** Advance by `seconds` of simulated time in fixed DT substeps. */
  advance(seconds) {
    const n = Math.max(0, Math.round(seconds / DT));
    for (let i = 0; i < n; i++) this.step();
  }

  /** Sway ratio R = peak|u| * omega^2 / A (about 1 for a tower that just rides the ground). */
  get swayRatio() {
    return (this.maxAbsU * this.omega * this.omega) / this.A;
  }
}

/** A tower whose live sway ratio reaches this collapses (same line as 0 stars). */
export const COLLAPSE_R = 6;

/** Stars from sway ratio: R < 2 -> 3, 2-4 -> 2, 4-6 -> 1, > 6 -> 0. */
export function starsFor(R) {
  if (R < 2) return 3;
  if (R < 4) return 2;
  if (R < 6) return 1;
  return 0;
}

export function messageFor(stars) {
  return ['Very wobbly!', 'Wobbly!', 'A little wobbly', 'Rock solid!'][stars];
}

/** Run a whole shake headlessly and return its result. */
export function simulate(opts) {
  const s = new Shake(opts);
  while (!s.done) s.step();
  return { R: s.swayRatio, stars: starsFor(s.swayRatio), maxAbsU: s.maxAbsU };
}
