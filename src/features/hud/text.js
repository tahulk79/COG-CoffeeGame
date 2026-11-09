// HUD text helpers: t() with a fallback to this feature's own locale pack (works even before the pack is
// registered in src/i18n/index.js), number/time formatting and error-code → message mapping.
import { t, getLang, formatNumber } from '../../i18n/index.js';
import pack from '../../i18n/locales/v3-hud.js';

export function T(key, params) {
  const value = t(key, params);
  if (value !== key) return value;
  const own = pack[getLang()]?.[key] ?? pack.en[key];
  if (own === undefined) return key;
  if (typeof own === 'function') return own(params || {});
  if (typeof own !== 'string' || !params) return own;
  return own.replace(/\{(\w+)\}/g, (m, name) => (params[name] ?? m));
}
export const has = key => T(key) !== key;
export const fmt = n => formatNumber(Math.round(Number(n) || 0));

/** 15 s → "15s", 90 s → "1m 30s" (short, for crop grow times). */
export function duration(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return T('hud.time.s', { s });
  const m = Math.floor(s / 60), r = s % 60;
  return r ? T('hud.time.ms', { m, s: r }) : T('hud.time.m', { m });
}
/** Countdown clock "0:12". */
export function clock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Human message for a failed store/realm result: err.<code> with formatted params, falls back to err.unknown. */
export function errorText(result) {
  const code = typeof result === 'string' ? result : result?.error;
  if (!code) return '';
  const data = (result && typeof result === 'object' && result.data) || {};
  const params = { ...data };
  for (const k of ['missing', 'capacity', 'need', 'have', 'cost']) if (Number.isFinite(data[k])) params[k] = fmt(data[k]);
  if (Number.isFinite(data.remainingMs)) params.time = clock(data.remainingMs);
  const key = `err.${code}`;
  return has(key) ? T(key, params) : T('err.unknown');
}

/** A general-manager plan reason ([i18n key under hud.gm.r., params]) as text: stat / rank names translated, a robot
 *  named by its serial. Shared by the toasts and the Quản lý tab. */
export function gmReasonText(reason) {
  const [key, params = {}] = Array.isArray(reason) ? reason : [reason];
  const p = { ...params, name: params.name || params.serial || '' };
  if (p.stat) p.stat = T(`hud.stat.${p.stat}`);
  if (p.staffType) p.name = T(`staff.${p.staffType}`);
  if (p.rank) p.rank = T(`hud.cr.rank.${p.rank}`);
  if (p.group) p.group = T(`hud.sup.g.${p.group}`);
  if (p.crop) p.crop = T(`crop.${p.crop}`);
  // planner v2 (management-rules §3.7): what an upgrade buys, a licence, a building, a good, the job a loan is for
  if (params.part) p.what = T(`hud.staff.part.${params.part}`);
  else if (params.item) p.what = T(`hud.g4.item.${params.item}`);
  else if (params.pack) p.what = T(`hud.g4.pack.${params.pack}`);
  else if (params.stat) p.what = p.stat;
  if (p.lic) p.lic = T(`hud.gm.lic.${p.lic}`);
  if (p.building) p.building = T(`building.${p.building}`);
  if (p.good) p.good = T(`good.${p.good}`);
  if (Array.isArray(params.for)) p.for = gmReasonText(params.for);
  for (const k of ['coins', 'n']) if (Number.isFinite(params[k])) p[k] = fmt(params[k]);
  return T(`hud.gm.r.${key}`, p);
}
