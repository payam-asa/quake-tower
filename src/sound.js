// All sounds are synthesised with WebAudio: no audio files to load or license.
const MUTE_KEY = 'quakeTower.muted';

let ctx = null;
let master = null;
let rumble = null; // { src, filter, gain }
let muted = false;
try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (_) { /* ignore */ }

/** Create / resume the audio context. Call from a tap (browsers require a gesture). */
export function unlockAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  if (!ctx) {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.8;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function isMuted() {
  return muted;
}

export function setMuted(m) {
  muted = m;
  try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch (_) { /* ignore */ }
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.02);
}

function ready() {
  return ctx && ctx.state === 'running';
}

function tone(freq, start, dur, { type = 'triangle', vol = 0.25, glideTo = null } = {}) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(master);
  o.start(start);
  o.stop(start + dur + 0.05);
  return o;
}

export function playClick() {
  if (!ready()) return;
  tone(660, ctx.currentTime, 0.06, { type: 'square', vol: 0.06 });
}

// ---------- earthquake rumble ----------

function noiseBuffer(seconds = 2) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    // Brown-ish noise: deep and rumbly.
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = last * 3.5;
  }
  return buf;
}

export function startRumble() {
  if (!ready()) return;
  stopRumble();
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer();
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 140;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  src.connect(filter).connect(gain).connect(master);
  src.start();
  rumble = { src, filter, gain };
}

/** level 0..1 from the ground shaking; wobble 0..1 from how much the tower sways. */
export function setRumble(level, wobble = 0) {
  if (!rumble || !ready()) return;
  const t = ctx.currentTime;
  rumble.gain.gain.setTargetAtTime(0.9 * level, t, 0.05);
  rumble.filter.frequency.setTargetAtTime(110 + 260 * wobble, t, 0.1);
}

export function stopRumble() {
  if (!rumble) return;
  const r = rumble;
  rumble = null;
  if (ready()) {
    r.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
    r.src.stop(ctx.currentTime + 0.5);
  } else {
    try { r.src.stop(); } catch (_) { /* ignore */ }
  }
}

// ---------- results ----------

/** Cheerful rising arpeggio for 3 stars. */
export function playChime() {
  if (!ready()) return;
  const t = ctx.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    tone(f, t + i * 0.09, 0.5, { vol: 0.2 });
    tone(f * 2, t + i * 0.09, 0.25, { type: 'sine', vol: 0.05 });
  });
}

/** Two friendly notes for 1-2 stars. */
export function playOkay(stars) {
  if (!ready()) return;
  const t = ctx.currentTime;
  tone(523.25, t, 0.25, { vol: 0.18 });
  tone(stars === 2 ? 659.25 : 587.33, t + 0.14, 0.35, { vol: 0.18 });
}

/** Silly "wobble" for 0 stars: a wavering, sliding boing. */
export function playWobble() {
  if (!ready()) return;
  const t = ctx.currentTime;
  const o = tone(330, t, 0.9, { type: 'sawtooth', vol: 0.12, glideTo: 140 });
  const lfo = ctx.createOscillator();
  const depth = ctx.createGain();
  lfo.frequency.setValueAtTime(9, t);
  lfo.frequency.linearRampToValueAtTime(4, t + 0.9);
  depth.gain.value = 40;
  lfo.connect(depth).connect(o.frequency);
  lfo.start(t);
  lfo.stop(t + 1);
}

/** Building collapse: a crunching noise burst over a deep thump. */
export function playCrash() {
  if (!ready()) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(1.6);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2400, t);
  filter.frequency.exponentialRampToValueAtTime(90, t + 1.4);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(1.4, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
  src.connect(filter).connect(g).connect(master);
  src.start(t);
  src.stop(t + 1.6);
  tone(70, t, 0.9, { type: 'sine', vol: 0.5, glideTo: 35 });
  // A few clattering debris hits
  for (let k = 0; k < 5; k++) tone(180 + k * 55, t + 0.25 + k * 0.11, 0.12, { type: 'square', vol: 0.05 });
}

export function playResult(stars) {
  if (stars === 3) playChime();
  else if (stars === 0) playWobble();
  else playOkay(stars);
}
