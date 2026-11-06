// Countries and regions (world map). Country ids/outlines come from src/features/world-map/content.js.
// No Round gating: every region can be opened with coins (more coins → more regions). The very first region is free,
// and after the Level-10 expiration the next new region is free once (no softlock). Price = country base × tier factor.

export const COUNTRIES = {
  vn: { id: 'vn', baseCost: 300, palette: { ground: 0x7fae5a, accent: 0xe0a93a } },
  br: { id: 'br', baseCost: 350, palette: { ground: 0x86b257, accent: 0x3c9a5f } },
  co: { id: 'co', baseCost: 350, palette: { ground: 0x6fa452, accent: 0xd8c040 } },
  ke: { id: 'ke', baseCost: 600, palette: { ground: 0xa2a95a, accent: 0xb5523a } },
  id: { id: 'id', baseCost: 600, palette: { ground: 0x5e9d4e, accent: 0xc4473a } },
  it: { id: 'it', baseCost: 900, palette: { ground: 0x93ac63, accent: 0x5f9a3c } },
  jp: { id: 'jp', baseCost: 1200, palette: { ground: 0x7aa868, accent: 0xd07a8a } },
  us: { id: 'us', baseCost: 1500, palette: { ground: 0x8fb06a, accent: 0x4a73b5 } },
};
export const COUNTRY_ORDER = ['vn', 'br', 'co', 'ke', 'id', 'it', 'jp', 'us'];
export const REGIONS_PER_COUNTRY = 3;
// Region #n of a country costs baseCost × REGION_TIER[n].
export const REGION_TIER = { 1: 1, 2: 1.6, 3: 2.5 };
export function regionCost(regionId) {
  const p = parseRegionId(regionId);
  return p ? Math.round(COUNTRIES[p.countryId].baseCost * REGION_TIER[p.n]) : null;
}

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
