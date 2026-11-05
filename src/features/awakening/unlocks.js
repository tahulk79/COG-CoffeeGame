// F-35 §6 "Awaken": what each Key opens (docs/shared/decode-awaken.md). Pure helpers: information and tools only, no economy number is read
// or changed here (keys never alter yield, price, quality or speed). UI files gate every unlock with hasKey().
import { regionCrop } from '../farm/rules.js';
import { TASTE_KEYS } from '../../state/memory.js';

/** True when the Key `id` is in `farm.progress.awakening.keys`. `p` = the progress (farm.peek()). */
export const hasKey = (p, id) => Boolean(p?.awakening?.keys?.some(k => k.id === id));

const r2 = n => Math.round(n * 100) / 100;
const mul = n => `×${r2(n)}`;
const plus = n => n < 0 ? `−${Math.abs(n)}` : `+${n}`;

// ---- Nature: numeric region multipliers on the seed card (F-43) ----
/** { yield: '×1.1', quality: '+3', growth: '×1' } - growth is the growth-TIME multiplier (×1.1 = 10 % slower). */
export function regionNumbers(region, cropId) {
  const r = regionCrop(region, cropId);
  return { yield: mul(r.yield), quality: plus(r.quality), growth: mul(r.growth) };
}

// ---- Transformation: last batches of one machine, newest first, at most `cap` ----
export const BATCH_CAP = 10;
export const lastBatches = (batches, machine, cap = BATCH_CAP) => (batches || []).filter(b => b.machine === machine).slice(-Math.min(cap, BATCH_CAP)).reverse();

// ---- Empathy: a taste hint per customer, deterministic from the customer's colour seed ----
export const TASTE_HINTS = ['acid', 'sweet', 'body'];
export const tasteHint = seed => { let h = 0; for (const ch of String(seed ?? '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return TASTE_HINTS[h % TASTE_HINTS.length]; };

// ---- Balance: profit = revenue − supplies − wages − imported beans ----
export const shiftProfit = s => r2((s.revenue || 0) - (s.costs || 0) - (s.wages || 0) - (s.beans || 0));
/** Per-recipe cups and revenue of one shift (costs are tracked per shift only), best revenue first. */
export const recipeRows = byRecipe => Object.entries(byRecipe || {}).map(([id, v]) => ({ id, cups: v.cups || 0, revenue: r2(v.revenue || 0) })).sort((a, b) => b.revenue - a.revenue);

// ---- Curiosity: "Thí nghiệm" - count the variables that differ from the last entry ----
const GROUPS = ['intended', 'actual', 'bean', 'equipment', 'preparation', 'ingredients', 'environment'];
const filled = v => v !== undefined && v !== null && v !== '' && v !== false;
/** Keys 'group.field' that are filled on both sides and differ. Numbers compare by value, text case-insensitively. */
export function experimentDiff(base, form) {
  const out = [];
  for (const g of GROUPS) for (const k of new Set([...Object.keys(base?.[g] || {}), ...Object.keys(form?.[g] || {})])) {
    const a = base?.[g]?.[k], b = form?.[g]?.[k];
    if (!filled(a) || !filled(b) || typeof a === 'object' || typeof b === 'object') continue;
    const na = Number(a), nb = Number(b), numeric = a !== '' && b !== '' && Number.isFinite(na) && Number.isFinite(nb);
    if (numeric ? na !== nb : String(a).trim().toLowerCase() !== String(b).trim().toLowerCase()) out.push(`${g}.${k}`);
  }
  return out;
}

// ---- Connection: Coffee DNA (self-understanding profile, not a scientific label) ----
export const LIKED_FROM = 4;
const mean = vals => { const v = vals.filter(n => Number.isFinite(n) && n >= 1); return v.length ? r2(v.reduce((s, n) => s + n, 0) / v.length) : null; };
const top = list => { const c = new Map(); for (const x of list) if (x) c.set(x, (c.get(x) || 0) + 1); return [...c].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null; };
/** entries: saved (non-draft) memory entries. Missing / 0 values are ignored in every average. */
export function coffeeDna(entries) {
  const tasted = (entries || []).filter(e => e.taste), liked = tasted.filter(e => e.taste.liking >= LIKED_FROM);
  const avg = list => Object.fromEntries(TASTE_KEYS.map(k => [k, mean(list.map(e => e.taste[k]))]));
  return { n: tasted.length, nLiked: liked.length, all: avg(tasted), liked: avg(liked), topMethod: top(liked.map(e => e.kind === 'real' ? e.method : e.recipeId)), topBean: top(liked.map(e => (e.bean?.name || '').trim())) };
}
