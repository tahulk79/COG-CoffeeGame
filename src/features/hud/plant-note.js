// What suits the land in front of the player, how to plant it and how to earn more from it: shown in the seed menus and on the bar
// while a seed is in hand. Everything is read from the numbers the game plays by (CLIMATE_EFFECT, QUALITY, cropEcon), so the note can
// never promise what the land does not give.
import { tierIndexAt, ESTATES, ESTATE_ORDER } from '../../core/config/layout.js';
import { CROPS, GOODS, QUALITY, RECIPES } from '../../core/config/economy.js';
import { climateEffect, unlockedCrops, perBean, cropBeanValue, beanPrice, buildingsOf, gardenOf, region } from '../../core/derive.js';
import { cropEcon, pickLoad } from '../../core/farm-manager.js';
import { h } from './dom.js';
import { T, fmt, duration } from './text.js';

/** The tier at a farm point: { id, zone }. */
export function areaAt(x, z) { const id = ESTATE_ORDER[tierIndexAt(x, z)]; return { id, zone: ESTATES[id].zone }; }
/** The tier the camera is on. */
export function focusArea(ctx) { const p = ctx.realm?.focusPoint; return p ? areaAt(p.x, p.z) : areaAt(0, 18); }

const score = (crop, zone) => { const e = climateEffect(crop, zone) || {}; return (e.stars || 0) * 10 - (e.timeMul || 1); };
/** The unlocked varieties that do best in a zone (several when they tie). */
export function bestCrops(s, zone) {
  const open = unlockedCrops(s), top = Math.max(...open.map(c => score(c, zone)));
  return open.filter(c => score(c, zone) === top);
}
export const bestText = (s, zone) => T('hud.plantNote.best', { list: bestCrops(s, zone).map(c => T(`crop.${c}`)).join(', ') });
/** How one variety does in a zone: { text, tone: 'good' | 'ok' | 'bad' }. */
export function fitOf(crop, zone) {
  const e = climateEffect(crop, zone), name = T(`crop.${crop}`);
  if (!e) return { text: T('hud.plantNote.ok', { crop: name }), tone: 'ok' };
  if ((e.stars || 0) >= 0 && (e.timeMul || 1) <= 1) return { text: T('hud.plantNote.good', { crop: name }), tone: 'good' };
  return { text: T((e.stars || 0) < 0 ? 'hud.plantNote.badStar' : 'hud.plantNote.bad', { crop: name, pct: Math.round(((e.timeMul || 1) - 1) * 100) }), tone: 'bad' };
}
/** The variety that earns most per tree per minute here, with this farm's own crew: { crop, rate }. */
export function richestCrop(s, zone) {
  if (!region(s)) return null;
  const pb = perBean(s), load = pickLoad(s);
  return unlockedCrops(s).map(c => ({ crop: c, rate: cropEcon(s, c, zone, pb, load).rate })).sort((a, b) => b.rate - a.rate)[0] || null;
}
/** How to pick a variety for the most beans in a zone. */
export function pickTip(s, crop, zone) {
  const c = CROPS[crop], e = climateEffect(crop, zone) || {}, st = Math.max(1, Math.min(3, 3 + (e.stars || 0)));
  const fresh = (c.freshSeconds ?? QUALITY.freshSeconds) * gardenOf(s).freshMul;
  return T('hud.plantNote.pick', { t: duration(fresh * 1000), st, pct: Math.round((QUALITY.yield[st] / QUALITY.yield[1] - 1) * 100) })
    + (c.drop ? T('hud.plantNote.drop', { s: c.drop.after }) : '') + (c.waves ? T('hud.plantNote.waves') : '');
}
/** What selling through the chain adds to one bean of a variety ('' when it adds nothing). */
function sellTip(s, crop) {
  const raw = beanPrice(crop), now = cropBeanValue(s, crop);
  if (now > raw) return T('hud.plantNote.process', { a: fmt(raw), b: fmt(now) });
  if (buildingsOf(s, RECIPES.dry.building).length) return '';
  const dried = GOODS.dried.price + Math.max(0, raw - GOODS.beans.price) * (RECIPES.dry.premium || 0);
  return dried > raw ? T('hud.plantNote.build', { name: T(`building.${RECIPES.dry.building}`), a: fmt(raw), b: fmt(dried) }) : '';
}
/** The note above the seed cards. */
export function plantNote(ctx, s) {
  const { id, zone } = focusArea(ctx), rich = richestCrop(s, zone), line = (head, ...text) => h('p', null, h('b', null, `${head}: `), ...text);
  return h('div', { class: 'hud-plantnote' },
    h('strong', null, `📍 ${T(`estate.${id}`)} · ${bestText(s, zone)}`),
    rich ? h('p', { class: 'hud-plantnote-money' }, T('hud.plantNote.money', { crop: T(`crop.${rich.crop}`), n: fmt(Math.max(1, Math.round(rich.rate))) })) : null,
    line(T('hud.plantNote.how'), T('hud.plantRow.hint')),
    rich ? line(T('hud.plantNote.more'), `${pickTip(s, rich.crop, zone)} ${sellTip(s, rich.crop)}`) : null);
}
