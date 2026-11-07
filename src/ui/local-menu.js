// Names + icons of the local café menu (core/config/menus.js) for the HUD and the 3D café.
// Names come from the locale pack (culture.<cc>.menu, ' | '-joined, same order as COUNTRY_MENUS).
import { t, hasKey } from '../i18n/index.js';
import { DRINKS } from '../core/config/economy.js';
import { COUNTRY_MENUS, menuItem } from '../core/config/menus.js';
import { parseRegionId } from '../core/config/world.js';

const countryOf = regionId => parseRegionId(regionId)?.countryId ?? null;
const namesOf = countryId => (hasKey(`culture.${countryId}.menu`) ? t(`culture.${countryId}.menu`).split('|').map(name => name.trim()) : []);
// Short name for bubbles and captions: the trailing note in brackets is dropped ("Eiskaffee (often with ice cream)" → "Eiskaffee").
const short = name => name.replace(/\s*\([^)]*\)\s*$/, '').trim() || name;

/** The order's local drink: { name, full, icon, base } — or null when the country/item is unknown. */
export function localDrink(regionId, drink, item) {
  const countryId = countryOf(regionId), def = menuItem(countryId, item, drink), full = def && namesOf(countryId)[item];
  return full ? { name: short(full), full, icon: def.icon, base: def.base } : null;
}
/** Display name of an order's drink: the local item when known, else the base drink. */
export const drinkName = (regionId, drink, item) => localDrink(regionId, drink, item)?.name || t(`drink.${drink}`);
/** Icon of an order's drink: the local item's, else the base drink's. */
export const drinkIcon = (regionId, drink, item) => localDrink(regionId, drink, item)?.icon || DRINKS[drink]?.icon || '☕';
/** Local items of a region's country served as `base`: [{ name, full, icon }]. */
export function localItemsOf(regionId, base) {
  const countryId = countryOf(regionId), names = namesOf(countryId);
  return (COUNTRY_MENUS[countryId] || []).flatMap((def, i) => (def.base === base && names[i] ? [{ index: i, name: short(names[i]), full: names[i], icon: def.icon }] : []));
}
