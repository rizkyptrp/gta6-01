// Shared math and random helpers for Solara Bay.
// Every helper here is pure and deterministic when given a seed, so the
// screenshot scenes and the live game build the same city from one seed.

export function makeRng(seed) {
  let state = seed >>> 0;
  if (state === 0) state = 0x9e3779b9;
  return function nextRandom() {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}

export function pickFrom(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function randomInRange(rng, low, high) {
  return low + rng() * (high - low);
}

export function randomInt(rng, low, high) {
  return low + Math.floor(rng() * (high - low + 1));
}

export function clampNumber(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

export function lerpNumber(a, b, t) {
  return a + (b - a) * t;
}

export function angleDifference(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function turnTowardAngle(current, target, maxStep) {
  const d = angleDifference(current, target);
  if (Math.abs(d) <= maxStep) return target;
  return current + Math.sign(d) * maxStep;
}

export function distance2D(ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  return Math.sqrt(dx * dx + dz * dz);
}

export function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}m ${seconds < 10 ? '0' : ''}${seconds}s`;
}
