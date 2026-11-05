// One-line effect descriptions built from config (never hardcoded numbers).
import { BUILDINGS, STAFF } from '../../core/config/economy.js';
import { T, fmt } from './text.js';

const PERCENT = new Set(['priceBonus', 'yieldBonus', 'tip', 'arrivalBonus', 'growSpeed']);
function value(key, v) {
  if (PERCENT.has(key)) return fmt(v * 100);
  if (key === 'brewSpeed' || key === 'arrivalSeconds') return String(Math.round(v * 10) / 10);
  return fmt(v);
}
const at = (list, lvl) => (Array.isArray(list) && lvl > 0 ? list[Math.min(list.length, lvl) - 1] : null);

/** "Storage 40 → 70" for a building at `level` (shows the next level when `withNext`). */
export function buildingEffect(type, level = 1, withNext = true) {
  const def = BUILDINGS[type];
  if (!def) return '';
  if (def.decor) return T('hud.fx.decor', { xp: def.xp || 0 });
  const key = Object.keys(def.effect || {})[0];
  if (!key) return '';
  const cur = at(def.effect[key], level);
  const nextLevel = level + 1;
  const hasNext = withNext && nextLevel <= def.effect[key].length && def.upgrade.length >= level;
  const next = hasNext ? at(def.effect[key], nextLevel) : null;
  const v = next != null && next !== cur ? `${value(key, cur)} → ${value(key, next)}` : value(key, cur);
  return T(`hud.fx.${key}`, { v });
}

export function staffEffect(type) {
  const eff = STAFF[type]?.effect || {};
  return Object.entries(eff).map(([key, v]) => T(`hud.staffFx.${key}`, { v: fmt(v * 100) })).join(' · ');
}
