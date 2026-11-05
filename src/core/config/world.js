// Countries and regions (world map). Country ids/outlines come from src/features/world-map/content.js.
// Round gating: Round 1 → starter countries, regions #1–2. Round 2 → region #3 everywhere + expired regions reopen.
// Round 3 → other countries can be unlocked with coins.

export const COUNTRIES = {
  vn: { id: 'vn', starter: true, unlockCost: 0, round: 1, palette: { ground: 0x7fae5a, accent: 0xe0a93a } },
  br: { id: 'br', starter: true, unlockCost: 0, round: 1, palette: { ground: 0x86b257, accent: 0x3c9a5f } },
  co: { id: 'co', starter: true, unlockCost: 0, round: 1, palette: { ground: 0x6fa452, accent: 0xd8c040 } },
  ke: { id: 'ke', starter: false, unlockCost: 4000, round: 3, palette: { ground: 0xa2a95a, accent: 0xb5523a } },
  id: { id: 'id', starter: false, unlockCost: 5000, round: 3, palette: { ground: 0x5e9d4e, accent: 0xc4473a } },
  it: { id: 'it', starter: false, unlockCost: 6500, round: 3, palette: { ground: 0x93ac63, accent: 0x5f9a3c } },
  jp: { id: 'jp', starter: false, unlockCost: 8000, round: 3, palette: { ground: 0x7aa868, accent: 0xd07a8a } },
  us: { id: 'us', starter: false, unlockCost: 10000, round: 3, palette: { ground: 0x8fb06a, accent: 0x4a73b5 } },
};
export const COUNTRY_ORDER = ['vn', 'br', 'co', 'ke', 'id', 'it', 'jp', 'us'];
export const REGIONS_PER_COUNTRY = 3;
// Minimum Round to enter region #n (1-based) of an unlocked country.
export const REGION_ROUND = { 1: 1, 2: 1, 3: 2 };

export const regionIdOf = (countryId, n) => `${countryId}-${n}`;
export function parseRegionId(regionId) {
  const m = /^([a-z]{2})-(\d)$/.exec(String(regionId || ''));
  if (!m || !COUNTRIES[m[1]]) return null;
  const n = Number(m[2]);
  if (n < 1 || n > REGIONS_PER_COUNTRY) return null;
  return { countryId: m[1], n };
}
export const ALL_REGION_IDS = COUNTRY_ORDER.flatMap(c => Array.from({ length: REGIONS_PER_COUNTRY }, (_, i) => regionIdOf(c, i + 1)));
export const isRegionId = id => parseRegionId(id) !== null;
