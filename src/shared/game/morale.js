// Staff morale (docs/shared/crew-autoplay.md mục 4): people tire and slack off, robots never do.
// Energy E ∈ [0, 100] lives on the actor for the session; it drains per finished job and recovers while idle or on a break.
const hash = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
export const TRAITS = { diligent: { base: .02, drain: .8 }, normal: { base: .05, drain: 1 }, lazy: { base: .14, drain: 1.3 } };
// Fixed per person (from the id), so the same hire always behaves the same way.
export const traitOf = id => ['diligent', 'normal', 'normal', 'lazy'][hash(id) % 4];
export const dislikeOf = (id, jobs) => jobs[hash(`${id}:dislike`) % jobs.length];

export const MORALE = { drainPerJob: 1.5, regenPerSec: .1, tired: 35, breakMs: { tired: 10000, lazy: 8000, dislike: 3000 }, breakEnergy: 30, maxChance: .6 };

// Chance to slack at the start of a job: p = base(trait) + 0.4·(1 − E/100)² + 0.15·[disliked job], capped at 0.6.
export function slackChance(energy, trait, disliked) {
  const e = Math.max(0, Math.min(100, energy)) / 100;
  return Math.min(MORALE.maxChance, TRAITS[trait].base + .4 * (1 - e) ** 2 + (disliked ? .15 : 0));
}
// Which excuse shows: tired beats a disliked job, otherwise plain laziness (healthy but lazy).
export const slackReason = (energy, disliked) => energy < MORALE.tired ? 'tired' : disliked ? 'dislike' : 'lazy';
// Tired people work slower: duration × (1 + 0.4·(1 − E/100)) → up to ×1.4 at E = 0.
export const tiredFactor = energy => 1 + .4 * (1 - Math.max(0, Math.min(100, energy)) / 100);
export const drain = (energy, trait) => Math.max(0, energy - MORALE.drainPerJob * TRAITS[trait].drain);
export const regen = (energy, dt) => Math.min(100, energy + MORALE.regenPerSec * dt);

// Roll once at job start. Returns null (works) or { reason, ms }. `random` injectable for tests.
export function rollSlack(energy, trait, disliked, random = Math.random) {
  if (random() >= slackChance(energy, trait, disliked)) return null;
  const reason = slackReason(energy, disliked);
  return { reason, ms: MORALE.breakMs[reason] };
}
