// Best stars per level, kept in this browser only (no accounts, no personal data).
const KEY = 'quakeTower.progress.v1';

export function loadProgress() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY));
    if (p && Array.isArray(p.best)) return p;
  } catch (_) { /* storage blocked or empty */ }
  return { best: [], unlocked: 1 };
}

export function saveProgress(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (_) { /* ignore */ }
}

/** Record a result; unlock the next level when allowed. */
export function recordResult(p, levelNumber, stars, unlockNext) {
  const i = levelNumber - 1;
  p.best[i] = Math.max(p.best[i] ?? 0, stars);
  if (unlockNext) p.unlocked = Math.max(p.unlocked, levelNumber + 1);
  saveProgress(p);
  return p;
}
