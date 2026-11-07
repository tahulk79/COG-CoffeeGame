// One-line effect descriptions built from config (never hardcoded numbers).
import { BUILDINGS, STAFF } from '../../core/config/economy.js';
import { T, fmt } from './text.js';

const PERCENT = new Set(['priceBonus', 'yieldBonus', 'tip', 'arrivalBonus', 'growSpeed', 'grow']);
const MULT = new Set(['brewSpeed', 'speed', 'batch']); // "×1.25" (batch: ×2 = twice the goods per batch)
function value(key, v) {
  if (PERCENT.has(key)) return fmt(v * 100);
  if (MULT.has(key)) return `×${Math.round(v * 100) / 100}`; // hud.fx.speed / brewSpeed carry no × of their own
  if (key === 'arrivalSeconds') return String(Math.round(v * 10) / 10);
  return fmt(v);
}
const at = (list, lvl) => (Array.isArray(list) && lvl > 0 ? list[Math.min(list.length, lvl) - 1] : null);

/**
 * "Storage 40 → 70" for a building at `level` (shows the next level when `withNext`). The key shown is the one that
 * CHANGES at the next level (processors alternate speed / batch, wells radius / grow), else the first key.
 */
export function buildingEffect(type, level = 1, withNext = true) {
  const def = BUILDINGS[type];
  if (!def) return '';
  if (def.decor) return T('hud.fx.decor', { xp: def.xp || 0 });
  const keys = Object.keys(def.effect || {});
  if (!keys.length) return '';
  const nextLevel = level + 1;
  const canNext = withNext && (def.upgrade || []).length >= level;
  const changes = k => canNext && nextLevel <= def.effect[k].length && at(def.effect[k], nextLevel) !== at(def.effect[k], level);
  const key = keys.find(changes) || keys[0];
  const cur = at(def.effect[key], level);
  const next = changes(key) ? at(def.effect[key], nextLevel) : null;
  const v = next != null ? `${value(key, cur)} → ${value(key, next)}` : value(key, cur);
  return T(`hud.fx.${key}`, { v });
}

export function staffEffect(type) {
  const eff = STAFF[type]?.effect || {};
  // What the unit does for you (it really works — staff.js), then its passive bonus.
  return [T(`hud.staffJob.${type}`), ...Object.entries(eff).map(([key, v]) => T(`hud.staffFx.${key}`, { v: fmt(v * 100) }))].join(' · ');
}
