// Countries and cities (world map). Source of truth: docs/design/world-cities.md (the user's coffee-culture document).
// The map is chosen by CITY: each city is its own region `<country>-<n>` (n = the city's order in the document, 1-based),
// so old saves `vn-1`, `jp-1`, `us-1`, `br-1`, `id-1` stay valid. Country outlines: src/features/world-map/content.js.
// Names, city vibes, drinking rhythm, tips and menus: src/i18n/locales/world-cities.js (country.*, regionName.*, city.*, culture.*).
// No Round gating: every city can be opened with coins. The very first region is free, and after the Level-10 expiration
// the next new region is free once (no softlock). Price = country base × CITY_TIER[n].
//
// games: what a city of this country can be played as ('farm' | 'cafe'); a city may override it (Kunming grows Yunnan coffee).
// Coffee-growing countries (VN, Brazil, Indonesia, India) offer both; the others are café-only. In Africa the café
// cities are café-only and the growing regions (Yirgacheffe, Nyeri, Bugisu…) are farm-only.
// cities[].lon/lat: real coordinates (degrees) for the city pins on the atlas.

const city = (slug, lon, lat, extra = {}) => ({ slug, lon, lat, ...extra });
const FARM = { games: ['farm'] };

export const COUNTRIES = {
  jp: { id: 'jp', flag: '🇯🇵', baseCost: 900, games: ['cafe'], palette: { ground: 0x7aa868, accent: 0xd0485a },
    cities: [city('tokyo', 139.69, 35.69), city('kyoto', 135.77, 35.01), city('osaka', 135.5, 34.69), city('nagoya', 136.91, 35.18)] },
  fr: { id: 'fr', flag: '🇫🇷', baseCost: 1100, games: ['cafe'], palette: { ground: 0x93ac63, accent: 0x3a5fb5 },
    cities: [city('paris', 2.35, 48.86), city('lyon', 4.84, 45.76), city('marseille', 5.37, 43.3), city('bordeaux', -.58, 44.84)] },
  gb: { id: 'gb', flag: '🇬🇧', baseCost: 1100, games: ['cafe'], palette: { ground: 0x6f9f5a, accent: 0x2f4c8f },
    cities: [city('london', -.13, 51.51), city('manchester', -2.24, 53.48), city('edinburgh', -3.19, 55.95), city('bristol', -2.59, 51.45)] },
  us: { id: 'us', flag: '🇺🇸', baseCost: 1200, games: ['cafe'], palette: { ground: 0x8fb06a, accent: 0x4a73b5 },
    cities: [city('newYork', -74, 40.71), city('seattle', -122.33, 47.61), city('losAngeles', -118.24, 34.05), city('sanFrancisco', -122.42, 37.77), city('chicago', -87.63, 41.88)] },
  au: { id: 'au', flag: '🇦🇺', baseCost: 900, games: ['cafe'], palette: { ground: 0xb3a75e, accent: 0x2f6f4f },
    cities: [city('melbourne', 144.96, -37.81), city('sydney', 151.21, -33.87), city('brisbane', 153.03, -27.47), city('perth', 115.86, -31.95)] },
  de: { id: 'de', flag: '🇩🇪', baseCost: 1000, games: ['cafe'], palette: { ground: 0x84a85c, accent: 0xd8a83a },
    cities: [city('berlin', 13.4, 52.52), city('hamburg', 9.99, 53.55), city('munich', 11.58, 48.14), city('cologne', 6.96, 50.94)] },
  tr: { id: 'tr', flag: '🇹🇷', baseCost: 600, games: ['cafe'], palette: { ground: 0xa4a861, accent: 0xc8323a },
    cities: [city('istanbul', 28.98, 41.01), city('ankara', 32.85, 39.93), city('izmir', 27.14, 38.42)] },
  sa: { id: 'sa', flag: '🇸🇦', baseCost: 800, games: ['cafe'], palette: { ground: 0xc9b278, accent: 0x2f8a4a },
    cities: [city('riyadh', 46.72, 24.71), city('jeddah', 39.19, 21.49), city('dammam', 50.1, 26.43), city('alKhobar', 50.21, 26.28)] },
  vn: { id: 'vn', flag: '🇻🇳', baseCost: 300, games: ['farm', 'cafe'], palette: { ground: 0x7fae5a, accent: 0xe0a93a },
    cities: [city('hanoi', 105.85, 21.03), city('hcmc', 106.7, 10.78), city('danang', 108.22, 16.05), city('hue', 107.59, 16.46)] },
  cn: { id: 'cn', flag: '🇨🇳', baseCost: 700, games: ['cafe'], palette: { ground: 0x8aa860, accent: 0xd8402f },
    cities: [city('shanghai', 121.47, 31.23), city('beijing', 116.41, 39.9), city('shenzhen', 114.06, 22.54), city('chengdu', 104.07, 30.57),
      city('kunming', 102.83, 25.04, { games: ['farm', 'cafe'] })] },
  br: { id: 'br', flag: '🇧🇷', baseCost: 450, games: ['farm', 'cafe'], palette: { ground: 0x86b257, accent: 0x3c9a5f },
    cities: [city('saoPaulo', -46.63, -23.55), city('rio', -43.17, -22.91), city('beloHorizonte', -43.94, -19.92), city('curitiba', -49.27, -25.43)] },
  in: { id: 'in', flag: '🇮🇳', baseCost: 450, games: ['farm', 'cafe'], palette: { ground: 0xa2a95a, accent: 0xe08a2f },
    cities: [city('mumbai', 72.88, 19.08), city('delhi', 77.21, 28.61), city('bengaluru', 77.59, 12.97), city('chennai', 80.27, 13.08), city('hyderabad', 78.49, 17.39)] },
  ca: { id: 'ca', flag: '🇨🇦', baseCost: 900, games: ['cafe'], palette: { ground: 0x7da469, accent: 0xc8323a },
    cities: [city('toronto', -79.38, 43.65), city('vancouver', -123.12, 49.28), city('montreal', -73.57, 45.5), city('calgary', -114.07, 51.05)] },
  kr: { id: 'kr', flag: '🇰🇷', baseCost: 700, games: ['cafe'], palette: { ground: 0x7fa86a, accent: 0x2f5fb5 },
    cities: [city('seoul', 126.98, 37.57), city('busan', 129.08, 35.18), city('daegu', 128.6, 35.87), city('incheon', 126.71, 37.46)] },
  tw: { id: 'tw', flag: '🇹🇼', baseCost: 600, games: ['cafe'], palette: { ground: 0x6fa452, accent: 0x2f4fa8 },
    cities: [city('taipei', 121.57, 25.03), city('taichung', 120.68, 24.15), city('kaohsiung', 120.31, 22.63), city('tainan', 120.21, 22.99)] },
  id: { id: 'id', flag: '🇮🇩', baseCost: 400, games: ['farm', 'cafe'], palette: { ground: 0x5e9d4e, accent: 0xc4473a },
    cities: [city('jakarta', 106.85, -6.21), city('bandung', 107.62, -6.92), city('yogyakarta', 110.37, -7.8), city('surabaya', 112.75, -7.25), city('medan', 98.67, 3.59)] },
  my: { id: 'my', flag: '🇲🇾', baseCost: 500, games: ['cafe'], palette: { ground: 0x66a058, accent: 0xd8b02f },
    cities: [city('kualaLumpur', 101.69, 3.14), city('penang', 100.33, 5.41), city('ipoh', 101.08, 4.6), city('johorBahru', 103.76, 1.49)] },
  ru: { id: 'ru', flag: '🇷🇺', baseCost: 800, games: ['cafe'], palette: { ground: 0x8fa878, accent: 0x3a5fb5 },
    cities: [city('moscow', 37.62, 55.76), city('saintPetersburg', 30.32, 59.93), city('kazan', 49.11, 55.8), city('novosibirsk', 82.92, 55.03)] },
  // Africa (added 2026-11-07): café cities first, then the coffee-growing regions (farm only).
  et: { id: 'et', flag: '🇪🇹', baseCost: 350, games: ['cafe'], palette: { ground: 0x8fa85a, accent: 0x2f8a3a },
    cities: [city('addisAbaba', 38.74, 9.03), city('direDawa', 41.86, 9.6),
      city('sidama', 38.48, 6.73, FARM), city('yirgacheffe', 38.2, 6.16, FARM), city('jimma', 36.83, 7.67, FARM), city('guji', 38.95, 5.75, FARM)] },
  ke: { id: 'ke', flag: '🇰🇪', baseCost: 400, games: ['cafe'], palette: { ground: 0x93a85c, accent: 0xb8322f },
    cities: [city('nairobi', 36.82, -1.29), city('mombasa', 39.67, -4.04), city('nakuru', 36.07, -0.3),
      city('nyeri', 36.95, -0.42, FARM), city('kirinyaga', 37.3, -0.5, FARM), city('kiambu', 36.83, -1.03, FARM)] },
  ug: { id: 'ug', flag: '🇺🇬', baseCost: 350, games: ['cafe'], palette: { ground: 0x6fa452, accent: 0xd8b02f },
    cities: [city('kampala', 32.58, 0.35), city('entebbe', 32.46, 0.05), city('jinja', 33.2, 0.42),
      city('bugisu', 34.2, 1.08, FARM), city('kasese', 30.08, 0.18, FARM), city('masaka', 31.73, -0.33, FARM)] },
  tz: { id: 'tz', flag: '🇹🇿', baseCost: 400, games: ['cafe'], palette: { ground: 0x9aa860, accent: 0x2f7fb5 },
    cities: [city('darEsSalaam', 39.28, -6.79), city('arusha', 36.68, -3.37), city('dodoma', 35.75, -6.17),
      city('kilimanjaro', 37.34, -3.35, FARM), city('mbeya', 33.46, -8.9, FARM), city('kagera', 31.8, -1.33, FARM)] },
  rw: { id: 'rw', flag: '🇷🇼', baseCost: 400, games: ['cafe'], palette: { ground: 0x5e9d4e, accent: 0x2f9fd0 },
    cities: [city('kigali', 30.06, -1.95), city('musanze', 29.63, -1.5), city('rubavu', 29.27, -1.68),
      city('huye', 29.74, -2.6, FARM), city('nyamasheke', 29.1, -2.35, FARM), city('rutsiro', 29.33, -1.94, FARM)] },
  bi: { id: 'bi', flag: '🇧🇮', baseCost: 300, games: ['cafe'], palette: { ground: 0x66a058, accent: 0xc8323a },
    cities: [city('bujumbura', 29.36, -3.38), city('gitega', 29.93, -3.43),
      city('kayanza', 29.63, -2.92, FARM), city('ngozi', 29.83, -2.91, FARM), city('muyinga', 30.34, -2.85, FARM)] },
  ci: { id: 'ci', flag: '🇨🇮', baseCost: 350, games: ['cafe'], palette: { ground: 0x7aa858, accent: 0xe08a2f },
    cities: [city('abidjan', -4.02, 5.36), city('yamoussoukro', -5.28, 6.82),
      city('daloa', -6.45, 6.88, FARM), city('gagnoa', -5.95, 6.13, FARM)] },
  za: { id: 'za', flag: '🇿🇦', baseCost: 700, games: ['cafe'], palette: { ground: 0xa8a862, accent: 0x2f7a4a },
    cities: [city('johannesburg', 28.05, -26.2), city('capeTown', 18.42, -33.93), city('durban', 31.02, -29.86)] },
};// Order of the document (country list). The starter country (no save yet) is vn.
export const COUNTRY_ORDER = ['jp', 'fr', 'gb', 'us', 'au', 'de', 'tr', 'sa', 'vn', 'cn', 'br', 'in', 'ca', 'kr', 'tw', 'id', 'my', 'ru',
  'et', 'ke', 'ug', 'tz', 'rw', 'bi', 'ci', 'za'];
export const DEFAULT_COUNTRY = 'vn';
// City #n of a country costs baseCost × CITY_TIER[n] (sample numbers, see world-cities.md).
export const CITY_TIER = { 1: 1, 2: 1.4, 3: 1.8, 4: 2.3, 5: 2.8, 6: 3.3 };
// Countries removed with the city map (Colombia, Kenya, Italy): their old regions move to a city of a kept country.
// Kenya was removed once (ke-1 → in-3) and is back as its own country (Nairobi), so ke-1 is no longer remapped.
export const LEGACY_REGIONS = { 'co-1': 'br-3', 'it-1': 'fr-1' };

export const regionIdOf = (countryId, n) => `${countryId}-${n}`;
export function parseRegionId(regionId) {
  const m = /^([a-z]{2})-(\d)$/.exec(String(regionId || ''));
  if (!m || !Object.hasOwn(COUNTRIES, m[1])) return null;
  const n = Number(m[2]);
  if (n < 1 || n > COUNTRIES[m[1]].cities.length) return null;
  return { countryId: m[1], n };
}
/** Region ids (one per city) of a country, in document order. */
export const citiesOf = countryId => (COUNTRIES[countryId]?.cities || []).map((_, i) => regionIdOf(countryId, i + 1));
/** City record of a region id: { regionId, countryId, n, slug, lon, lat, games }, or null. */
export function cityOf(regionId) {
  const p = parseRegionId(regionId);
  if (!p) return null;
  const c = COUNTRIES[p.countryId].cities[p.n - 1];
  return { regionId, countryId: p.countryId, n: p.n, slug: c.slug, lon: c.lon, lat: c.lat, games: c.games || COUNTRIES[p.countryId].games };
}
export function regionCost(regionId) {
  const p = parseRegionId(regionId);
  return p ? Math.round(COUNTRIES[p.countryId].baseCost * CITY_TIER[p.n]) : null;
}
export const ALL_REGION_IDS = COUNTRY_ORDER.flatMap(citiesOf);
/** Games ('farm' | 'cafe') offered anywhere in a country (union of its cities). */
export const countryGames = countryId => {
  const def = COUNTRIES[countryId];
  if (!def) return [];
  const all = new Set(def.cities.flatMap(c => c.games || def.games));
  return ['farm', 'cafe'].filter(g => all.has(g));
};
// TEMPORARY (founder 2026-11-09): the café game is switched off while the farm is being finished. Set true to bring it back.
export const CAFE_ENABLED = false;
/** Games ('farm' | 'cafe') a region (city) offers. The café is hidden from choices while CAFE_ENABLED is false. */
export const regionGames = regionId => (cityOf(regionId)?.games || []).filter(g => CAFE_ENABLED || g !== 'cafe');
/** Games the city is meant to offer, switched-off ones included (the map shows the café as «updating»). */
export const plannedGames = regionId => cityOf(regionId)?.games || [];
export const isRegionId = id => parseRegionId(id) !== null;
