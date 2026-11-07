// Local café menus (docs/design/world-cities.md "Menu tham khảo"): each country's sample menu, in the document's order.
// The names live in the locale pack (culture.<cc>.menu, items joined with ' | ', same order as here).
// Every local item is served as one of the 3 café drinks (DRINKS in economy.js), so price, beans, brew time, XP and
// unlock rules stay those of the base drink:
//  · espresso — simple black coffee (drip, filter, americano, Türk kahvesi …)   1 bean, Lv1
//  · milk     — coffee with milk or sweetened (café au lait, nâu đá, kopi C …)  2 beans, Lv2 + roaster 1
//  · latte    — espresso-milk drinks and specialities (latte, egg coffee, cold brew, raf …)  3 beans, Lv5 + roaster 2
// A customer first picks a base drink (weighted, see shop/spawnCustomer), then one of this country's items of that base;
// the order keeps `drink` (base) for the economy and `item` (index into this list) for names and icons.
// Every country has at least one item of each base (tests/core/core.test.mjs).

const E = (icon = '☕') => ({ base: 'espresso', icon });
const M = (icon = '🥛') => ({ base: 'milk', icon });
const L = (icon = '🍮') => ({ base: 'latte', icon });

export const COUNTRY_MENUS = {
  // Blend coffee · hand drip · iced coffee · café au lait · latte · cold brew · canned coffee
  jp: [E(), L('🫖'), E('🧊'), M(), L(), L('🧊'), E('🥫')],
  // Un café / expresso · café crème · noisette · allongé · café au lait · cappuccino · filtre
  fr: [E(), M(), M('🌰'), E(), M(), L(), E('🫖')],
  // Flat white · latte · cappuccino · americano · espresso · filter coffee · iced latte · cold brew
  gb: [L(), L(), L(), E(), E(), E('🫖'), M('🧊'), L('🧊')],
  // Drip coffee · americano · latte · cold brew · iced coffee · flavored latte · mocha · nitro cold brew
  us: [E('🫖'), E(), L(), L('🧊'), E('🧊'), M('🍯'), L('🍫'), L('🧊')],
  // Flat white · long black · piccolo latte · latte · cappuccino · magic · batch brew
  au: [M(), E(), M(), L(), L(), L('✨'), E('🫖')],
  // Filterkaffee · Milchkaffee · cappuccino · espresso · latte macchiato · Eiskaffee · flat white
  de: [E('🫖'), M(), L(), E(), L(), M('🍨'), M()],
  // Türk kahvesi · sade · orta · şekerli · menengiç · espresso · latte
  tr: [E(), E(), M('🍬'), M('🍬'), L('🌰'), E(), L()],
  // Saudi coffee / qahwa · espresso · latte · Spanish latte · V60 · iced americano · cold brew
  sa: [E('🫖'), E(), L(), L(), M('🫖'), E('🧊'), M('🧊')],
  // Cà phê đen đá · nâu đá · bạc xỉu · cà phê trứng · cà phê muối · espresso · pour-over · cold brew
  vn: [E('🧊'), M('🧊'), M(), L('🥚'), L('🧂'), E(), L('🫖'), L('🧊')],
  // Americano · latte · coconut latte · iced latte · flat white · pour-over · fruit coffee
  cn: [E(), L(), L('🥥'), M('🧊'), M(), L('🫖'), M('🍓')],
  // Cafezinho · café coado · café com leite · pingado · cappuccino brasileiro · espresso · iced latte
  br: [E(), E('🫖'), M(), M(), L('🍫'), E(), L('🧊')],
  // Filter kaapi · cold coffee · cappuccino · latte · americano · iced coffee · coffee with chicory
  in: [M(), M('🧊'), L(), L(), E(), E('🧊'), E('🌿')],
  // Double-double · brewed coffee · americano · latte · flat white · iced coffee · cold brew · cappuccino
  ca: [M('🍬'), E('🫖'), E(), L(), M(), E('🧊'), L('🧊'), L()],
  // Iced americano · latte · vanilla latte · dalgona · Einspänner · cold brew · hand drip
  kr: [E('🧊'), L(), L('🌼'), L('🍯'), M('🍦'), M('🧊'), E('🫖')],
  // Americano · latte · hand drip · iced coffee · cold brew · espresso · flavored latte
  tw: [E(), L(), M('🫖'), E('🧊'), M('🧊'), E(), L('🍯')],
  // Kopi tubruk · kopi susu gula aren · es kopi susu · kopi hitam · V60 · espresso · latte · kopi talua
  id: [E(), M('🍯'), M('🧊'), E(), L('🫖'), E(), L(), L('🥚')],
  // Kopi · kopi O · kopi C · kopi peng · kopi O kosong · cham · white coffee · latte
  my: [M(), E(), M(), M('🧊'), E(), L('🍵'), L(), L()],
  // Raf coffee · cappuccino · latte · americano · flat white · espresso · filter coffee
  ru: [L('🍦'), M(), L(), E(), M(), E(), E('🫖')],
};

/** Indices of a country's menu items served as `base` (a DRINKS id). */
export const menuItemsOf = (countryId, base) => (COUNTRY_MENUS[countryId] || []).flatMap((item, i) => (item.base === base ? [i] : []));
/** The menu item record of an order, or null (unknown country / index / base mismatch). */
export function menuItem(countryId, index, base) {
  const item = Number.isInteger(index) ? COUNTRY_MENUS[countryId]?.[index] : null;
  return item && (!base || item.base === base) ? item : null;
}
