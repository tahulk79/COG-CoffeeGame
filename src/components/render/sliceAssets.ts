import type Phaser from 'phaser';
import type { Facing } from '../../entities/Actor';
import SLICE_BAKE from '../../data/sliceBake.json';
import { analyzeSheet, type SheetPlan } from './sliceClean';

/**
 * 2.5D art passes. Separate keys keep the legacy 4×4 hero atlas untouched.
 * The PNG masters live in `art-src/slice/chapter1/` (never downloaded); the game loads WebP exported at
 * `maxEdge` by `scripts/export-slice-webp.sh`, so `registerSliceFrames()` no longer has to shrink them.
 */
export const SLICE_ASSETS = {
  asphalt: { key: 'slice.chapter1.asphalt.v1', url: '/assets/slice/chapter1/asphalt-v1.webp', columns: 1, rows: 1, maxEdge: 1024 },
  shopfronts: { key: 'slice.chapter1.shopfronts.v1', url: '/assets/slice/chapter1/shopfronts-v1.webp', columns: 2, rows: 2, maxEdge: 1536 },
  southShopsVaried: { key: 'slice.chapter1.south-shops.v2', url: '/assets/slice/chapter1/south-shops-v2.webp', columns: 2, rows: 2, maxEdge: 1536 },
  southShopTile: { key: 'slice.chapter1.south-shop.tile.v1', url: '/assets/slice/chapter1/south-shop-tile-v1.webp', columns: 1, rows: 1, maxEdge: 768 },
  southShopTin: { key: 'slice.chapter1.south-shop.tin.v1', url: '/assets/slice/chapter1/south-shop-tin-v1.webp', columns: 1, rows: 1, maxEdge: 768 },
  neighbors: { key: 'slice.chapter1.neighbors.v1', url: '/assets/slice/chapter1/neighbors-v1.webp', columns: 4, rows: 4, maxEdge: 768 },
  owners: { key: 'slice.chapter1.owners.v1', url: '/assets/slice/chapter1/owners-v1.webp', columns: 4, rows: 4, maxEdge: 768 },
  housesVaried: { key: 'slice.chapter1.houses.v2', url: '/assets/slice/chapter1/houses-v2.webp', columns: 3, rows: 2, maxEdge: 1536 },
  residents: { key: 'slice.chapter1.residents.v1', url: '/assets/slice/chapter1/residents-v1.webp', columns: 4, rows: 4, maxEdge: 768 },
  locals: { key: 'slice.chapter1.locals.v1', url: '/assets/slice/chapter1/locals-v1.webp', columns: 4, rows: 4, maxEdge: 768 },
  heroReactions: { key: 'slice.chapter1.hero.reactions.v1', url: '/assets/slice/chapter1/hero-reactions-v1.webp', columns: 4, rows: 2, maxEdge: 1024 },
  hero: { key: 'slice.chapter1.hero.v1', url: '/assets/slice/chapter1/hero-v1.webp', columns: 4, rows: 4, maxEdge: 768 },
  houses: { key: 'slice.chapter1.houses.v1', url: '/assets/slice/chapter1/houses-v1.webp', columns: 3, rows: 1, maxEdge: 1536 },
  medic: { key: 'slice.chapter1.medic.v1', url: '/assets/slice/chapter1/medic-v1.webp', columns: 4, rows: 4, maxEdge: 768 },
  medicCarry: { key: 'slice.chapter1.medic-carry.v1', url: '/assets/slice/chapter1/medic-carry-v1.webp', columns: 4, rows: 4, maxEdge: 768 },
  ambulance: { key: 'slice.chapter1.ambulance.v1', url: '/assets/slice/chapter1/ambulance-v1.webp', columns: 3, rows: 4, maxEdge: 1280 },
  wheel: { key: 'slice.chapter1.wheel.v1', url: '/assets/slice/chapter1/wheel-v1.webp', columns: 1, rows: 1, maxEdge: 64 },
  citizens: { key: 'slice.chapter1.citizens.v1', url: '/assets/slice/chapter1/citizens-v1.webp', columns: 4, rows: 4, maxEdge: 768 },
  vendors: { key: 'slice.chapter1.vendors.v1', url: '/assets/slice/chapter1/vendors-v1.webp', columns: 4, rows: 4, maxEdge: 768 },
  workers: { key: 'slice.chapter1.workers.v1', url: '/assets/slice/chapter1/workers-v1.webp', columns: 4, rows: 4, maxEdge: 768 },
  motorbikes: { key: 'slice.chapter1.motorbikes.v1', url: '/assets/slice/chapter1/motorbikes-v1.webp', columns: 4, rows: 4, maxEdge: 768 },
  stalls: { key: 'slice.chapter1.stalls.v1', url: '/assets/slice/chapter1/stalls-v1.webp', columns: 4, rows: 2, maxEdge: 1536 },
  parkedBikes: { key: 'slice.chapter1.parked-bikes.v1', url: '/assets/slice/chapter1/parked-bikes-v1.webp', columns: 2, rows: 2, maxEdge: 512 },
  parkedCars: { key: 'slice.chapter1.parked-cars.v1', url: '/assets/slice/chapter1/parked-cars-v1.webp', columns: 2, rows: 1, maxEdge: 768 },
  hazardBanana: { key: 'slice.chapter1.hazard.banana.v1', url: '/assets/slice/chapter1/hazard-banana-v1.webp', columns: 2, rows: 1, maxEdge: 256 },
  hazardDurian: { key: 'slice.chapter1.hazard.durian.v1', url: '/assets/slice/chapter1/hazard-durian-v1.webp', columns: 2, rows: 1, maxEdge: 384 },
  hazardWater: { key: 'slice.chapter1.hazard.water.v1', url: '/assets/slice/chapter1/hazard-water-v1.webp', columns: 2, rows: 2, maxEdge: 512 },
  hazardShuttlecock: { key: 'slice.chapter1.hazard.shuttlecock.v1', url: '/assets/slice/chapter1/hazard-shuttlecock-v1.webp', columns: 2, rows: 2, maxEdge: 384 },
  hazardHoles: { key: 'slice.chapter1.hazard.holes.v1', url: '/assets/slice/chapter1/hazard-holes-v1.webp', columns: 2, rows: 2, maxEdge: 768 },
  hazardLaundry: { key: 'slice.chapter1.hazard.laundry.v1', url: '/assets/slice/chapter1/hazard-laundry-v1.webp', columns: 2, rows: 2, maxEdge: 384 },
  hazardSlipper: { key: 'slice.chapter1.hazard.slipper.v1', url: '/assets/slice/chapter1/hazard-slipper-v1.webp', columns: 2, rows: 2, maxEdge: 384 },
  hazardCargoBike: { key: 'slice.chapter1.hazard.cargo-bike.v1', url: '/assets/slice/chapter1/hazard-cargo-bike-v1.webp', columns: 2, rows: 4, maxEdge: 768 },
  hazardCat: { key: 'slice.chapter1.hazard.cat.v1', url: '/assets/slice/chapter1/hazard-cat-v1.webp', columns: 4, rows: 2, maxEdge: 768 },
  hazardDogs: { key: 'slice.chapter1.hazard.dogs.v1', url: '/assets/slice/chapter1/hazard-dogs-v1.webp', columns: 4, rows: 4, maxEdge: 768 },
  hazardPigeons: { key: 'slice.chapter1.hazard.pigeons.v1', url: '/assets/slice/chapter1/hazard-pigeons-v1.webp', columns: 4, rows: 2, maxEdge: 1024 },
  hazardChickens: { key: 'slice.chapter1.hazard.chickens.v1', url: '/assets/slice/chapter1/hazard-chickens-v1.webp', columns: 4, rows: 2, maxEdge: 512 },
} as const;

/** Chapter 2 keeps complete cells: a shared pivot must survive pose changes. */
export const CHAPTER2_SLICE_ASSETS = {
  speakerNameplate: { key: 'slice.chapter2.reference.speakerNameplate.v1', url: '/assets/slice/chapter2/reference-ui/speaker-nameplate-v1.webp', columns: 1, rows: 1, maxEdge: 1024 },
  cloudOrnament: { key: 'slice.chapter2.reference.cloudOrnament.v1', url: '/assets/slice/chapter2/reference-ui/cloud-ornament-v1.webp', columns: 1, rows: 1, maxEdge: 1024 },
  island: { key: 'slice.chapter2.reference.island.v1', url: '/assets/slice/chapter2/reference-ui/island-scene-v1.webp', columns: 1, rows: 1, maxEdge: 2048 },
  progressPanel: { key: 'slice.chapter2.reference.progressPanel.v1', url: '/assets/slice/chapter2/reference-ui/progress-panel-v1.webp', columns: 1, rows: 1, maxEdge: 2048 },
  questPanel: { key: 'slice.chapter2.reference.questPanel.v2', url: '/assets/slice/chapter2/reference-ui/quest-panel-v2.webp', columns: 1, rows: 1, maxEdge: 2048 },
  karmaPanel: { key: 'slice.chapter2.reference.karmaPanel.v1', url: '/assets/slice/chapter2/reference-ui/karma-panel-v2.webp', columns: 1, rows: 1, maxEdge: 2048 },
  actionButton: { key: 'slice.chapter2.reference.actionButton.v1', url: '/assets/slice/chapter2/reference-ui/action-button-v1.webp', columns: 1, rows: 1, maxEdge: 2048 },
  settingsIcon: { key: 'slice.chapter2.reference.settingsIcon.v1', url: '/assets/slice/chapter2/reference-ui/settings-icon-v1.webp', columns: 1, rows: 1, maxEdge: 2048 },

  scholar: { key: 'slice.chapter2.scholar.sample.v1', url: '/assets/slice/chapter2/scholar-sample-v1.webp', columns: 4, rows: 1, maxEdge: 1024 },
  heroAvatar: { key: 'slice.chapter2.hero.avatar.v1', url: '/assets/slice/chapter2/hero-avatar-v1.webp', columns: 1, rows: 1, maxEdge: 256 },
  scholarPortrait: { key: 'slice.chapter2.scholar.portrait.sample.v1', url: '/assets/slice/chapter2/scholar-portrait-sample-v1.webp', columns: 1, rows: 1, maxEdge: 256 },
  cloudWall: { key: 'slice.chapter2.cloud.wall.sample.v1', url: '/assets/slice/chapter2/cloud-wall-sample-v1.webp', columns: 2, rows: 1, maxEdge: 1024 },
  keepers: { key: 'slice.chapter2.keepers.extra.v1', url: '/assets/slice/chapter2/keepers-extra-v1.webp', columns: 4, rows: 3, maxEdge: 1024 },
  gods: { key: 'slice.chapter2.gods.v1', url: '/assets/slice/chapter2/gods-v1.webp', columns: 4, rows: 2, maxEdge: 1024 },
  portraits: { key: 'slice.chapter2.portraits.extra.v1', url: '/assets/slice/chapter2/portraits-extra-v1.webp', columns: 3, rows: 2, maxEdge: 768 },
  ground: { key: 'slice.chapter2.cloud.ground.v1', url: '/assets/slice/chapter2/cloud-ground-v1.webp', columns: 1, rows: 1, maxEdge: 1024 },
  door: { key: 'slice.chapter2.rebirth.door.v1', url: '/assets/slice/chapter2/rebirth-door-v1.webp', columns: 2, rows: 1, maxEdge: 1024 },
  props: { key: 'slice.chapter2.props.v1', url: '/assets/slice/chapter2/props-v1.webp', columns: 3, rows: 2, maxEdge: 768 },
  sky: { key: 'slice.chapter2.sky.v1', url: '/assets/slice/chapter2/sky-v1.webp', columns: 1, rows: 1, maxEdge: 2048 },
  ui: { key: 'slice.chapter2.ui.v1', url: '/assets/slice/chapter2/ui-v1.webp', columns: 4, rows: 2, maxEdge: 1024 },
} as const;

export const SLICE_STALL_FRAMES: Readonly<Record<string, number>> = {
  tra_da: 0, bao: 1, pho: 2, bun_dau: 3, banh_mi: 4, cat_toc: 5, xe_om: 6, xoi: 7,
};

/** Existing gameplay looks stay stable; each NPC uses one row of a shared atlas. */
export const SLICE_PEOPLE: Readonly<Record<string, { asset: 'citizens' | 'vendors' | 'workers'; row: number; height: number }>> = {
  walker: { asset: 'citizens', row: 0, height: 64 },
  phone: { asset: 'citizens', row: 1, height: 64 },
  tourist: { asset: 'citizens', row: 2, height: 64 },
  kid: { asset: 'citizens', row: 3, height: 50 },
  vendor: { asset: 'vendors', row: 0, height: 64 },
  seller: { asset: 'vendors', row: 2, height: 64 },
  cook: { asset: 'vendors', row: 2, height: 64 },
  granny: { asset: 'vendors', row: 3, height: 62 },
  old: { asset: 'workers', row: 0, height: 62 },
  shipper: { asset: 'workers', row: 1, height: 64 },
  driver: { asset: 'workers', row: 2, height: 64 },
  guard: { asset: 'workers', row: 3, height: 66 },
};

/** Stable appearance: never reroll a face while walking, turning or re-entering the camera. */
export function appearanceSeed(id: string): number {
  let value = 2166136261;
  for (const char of id) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}

type PersonArt = { asset: 'citizens' | 'vendors' | 'workers' | 'residents' | 'locals' | 'owners' | 'neighbors'; row: number; height: number };

const NAMED_PEOPLE: Readonly<Record<string, PersonArt>> = {
  'tra_da:tu': { asset: 'locals', row: 0, height: 63 },
  'tra_da:bay': { asset: 'neighbors', row: 1, height: 63 },
  'tra_da:tam': { asset: 'neighbors', row: 2, height: 64 },
  'bao:hai': { asset: 'neighbors', row: 0, height: 63 },
  'pho:ba': { asset: 'owners', row: 0, height: 62 },
  'bun_dau:sau': { asset: 'owners', row: 1, height: 64 },
  'bun_dau:ongkhach': { asset: 'workers', row: 0, height: 60 },
  'banh_mi:anhbay': { asset: 'owners', row: 2, height: 65 },
  'cat_toc:hung': { asset: 'owners', row: 3, height: 68 },
  'xe_om:nam': { asset: 'workers', row: 2, height: 65 },
  'xe_om:tho': { asset: 'neighbors', row: 3, height: 66 },
  'xoi:xoi': { asset: 'locals', row: 3, height: 59 },
};

/** Every person in the atlases (bar the guard): passers-by are dealt from here so no two look alike. */
const PERSON_POOL: readonly PersonArt[] = (['citizens', 'residents', 'vendors', 'locals', 'workers', 'neighbors', 'owners'] as const)
  .flatMap((asset) => [0, 1, 2, 3].map((row) => ({ asset, row, height: row === 3 && (asset === 'citizens' || asset === 'residents') ? 50 : 64 })))
  .filter((a) => !(a.asset === 'workers' && a.row === 3));
const artKey = (a: PersonArt) => `${a.asset}:${a.row}`;
/** Looks already on the street (the stall people first, as they are drawn first), and what each passer-by got. */
const takenArt = new Set(Object.values(NAMED_PEOPLE).map(artKey));
const walkerArt = new Map<string, PersonArt>();

export function streetPerson(look: string, id: string): PersonArt | null {
  if (NAMED_PEOPLE[id]) return NAMED_PEOPLE[id]!;
  const base = SLICE_PEOPLE[look];
  if (!base) return null;
  // Passers-by: their look's own figure if nobody has it yet, otherwise any figure not on the street.
  if (/^walker\d+$/.test(id)) {
    const known = walkerArt.get(id);
    if (known) return known;
    const own = [base.asset, base.asset === 'citizens' ? 'residents' : base.asset === 'vendors' ? 'locals' : base.asset]
      .map((asset) => PERSON_POOL.find((a) => a.asset === asset && a.row === base.row)).filter((a): a is PersonArt => !!a);
    const art = own.find((a) => !takenArt.has(artKey(a))) ?? PERSON_POOL.find((a) => !takenArt.has(artKey(a))) ?? own[0] ?? PERSON_POOL[0]!;
    takenArt.add(artKey(art));
    walkerArt.set(id, art);
    return art;
  }
  const seed = appearanceSeed(id);
  if (look === 'walker') {
    const index = seed % 6;
    const art: PersonArt = { asset: index < 3 ? 'citizens' : 'residents', row: index % 3, height: [63, 66, 61, 62, 65, 64][index]! };
    takenArt.add(artKey(art));
    return art;
  }
  const alternate = base.asset === 'citizens' ? 'residents' : base.asset === 'vendors' ? 'locals' : base.asset;
  const art: PersonArt = { ...base, asset: seed % 2 ? alternate : base.asset, height: base.height * (1 + ((seed >>> 8) % 5 - 2) * .025) };
  takenArt.add(artKey(art));
  return art;
}

export function sliceHeroReactionFrame(facing: Facing, phase: 'stumble' | 'fall' | 'down' | 'carry'): string {
  const column = { stumble: 0, fall: 1, down: 2, carry: 3 }[phase];
  // Rescue choreography keeps the head screen-left; lying and carry share that orientation.
  return String((column < 2 && HERO_ROWS[facing] >= 2 ? 4 : 0) + column);
}

/** Grid-space facings projected to the four illustrated screen directions. */
const HERO_ROWS: Record<Facing, number> = { E: 0, SE: 0, S: 1, SW: 1, N: 2, NE: 2, W: 3, NW: 3 };
const MOTORBIKE_ROWS: Record<Facing, number> = { E: 0, SE: 0, W: 1, NW: 1, S: 2, SW: 2, N: 3, NE: 3 };

/** Animal rows are front/rear pairs, each with four animation poses. */
export function sliceAnimalFrame(facing: Facing, phase: number, rowOffset = 0): { frame: number; flipX: boolean } {
  const direction = HERO_ROWS[facing];
  return { frame: (rowOffset + (direction >= 2 ? 1 : 0)) * 4 + phase, flipX: direction === 1 || direction === 3 };
}

export function slicePersonFrame(row: number, facing: Facing, moving: boolean, time: number): { frame: string; flipX: boolean } {
  const direction = HERO_ROWS[facing], rear = direction >= 2;
  const step = moving ? Math.floor(time / 170) % 2 : 0;
  return { frame: String(row * 4 + (rear ? 2 : 0) + step), flipX: direction === 1 || direction === 3 };
}

export function sliceMotorbikeFrame(facing: Facing, color: number): string {
  return String(MOTORBIKE_ROWS[facing] * 4 + color);
}

export function sliceCargoBikeFrame(facing: Facing, open: boolean): string {
  return String(MOTORBIKE_ROWS[facing] * 2 + (open ? 1 : 0));
}

export function sliceMedicFrame(facing: Facing, moving: boolean, carrying: boolean, time: number): string {
  const phase = carrying ? 3 : moving ? 1 + Math.floor(time / 160) % 2 : 0;
  return String(HERO_ROWS[facing] * 4 + phase);
}

export function sliceMedicCarryFrame(facing: Facing, moving: boolean, lift: number, time: number): string {
  const phase = lift < .5 ? 0 : lift < 1 || !moving ? 1 : 2 + Math.floor(time / 180) % 2;
  return String(HERO_ROWS[facing] * 4 + phase);
}

export function sliceAmbulanceFrame(axis: 'x' | 'y', dir: number, doorOpen: boolean, damaged: boolean): string {
  const row = axis === 'y' ? dir > 0 ? 2 : 3 : dir > 0 ? 0 : 1;
  return String(row * 3 + (damaged ? 2 : doorOpen ? 1 : 0));
}

export function sliceHeroFrame(facing: Facing, moving: boolean, time: number): string {
  const phase = moving ? [1, 2, 3, 2][Math.floor(time / 130) % 4]! : 0;
  return String(HERO_ROWS[facing] * 4 + phase);
}

/**
 * Read alpha once at load time; transparent cell padding must not set a sprite's size. AI atlases often let a
 * neighbour's edge (a roof corner, a vine) spill into a cell: per cell, opaque pixels are grouped into connected
 * pieces, small pieces touching the cell edge are erased, and the frame is cut round what is left.
 */
export function registerSliceFrames(scene: Phaser.Scene): void {
  for (const asset of Object.values(CHAPTER2_SLICE_ASSETS)) {
    if (!scene.textures.exists(asset.key)) continue;
    const texture = scene.textures.get(asset.key);
    if (texture.has('0')) continue;
    const source = texture.getSourceImage() as HTMLImageElement;
    const w = source.width / asset.columns, h = source.height / asset.rows;
    for (let row = 0; row < asset.rows; row++) for (let col = 0; col < asset.columns; col++) {
      texture.add(String(row * asset.columns + col), 0, col * w, row * h, w, h);
    }
  }
  for (const asset of Object.values(SLICE_ASSETS)) {
    if (!scene.textures.exists(asset.key) || scene.textures.get(asset.key).has('0')) continue;
    const source = scene.textures.get(asset.key).getSourceImage() as HTMLImageElement;
    const { w, h } = sheetCanvasSize(asset, source.width, source.height);
    // The plan comes from `scripts/bake-slice.mjs` (alpha analysis of a static image, done once at build time); reading pixels back
    // and analysing them on every page load cost ~0.8 s on a desktop and ~3 s on a mid-range phone. No baked plan (new or changed art): analyse here.
    const baked = (SLICE_BAKE as unknown as Record<string, { w: number; h: number } & SheetPlan>)[asset.key];
    let plan: SheetPlan | undefined = baked && baked.w === w && baked.h === h ? baked : undefined;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    context.imageSmoothingQuality = 'high';
    context.drawImage(source, 0, 0, w, h);
    plan ??= analyzeSheet(new Uint32Array(context.getImageData(0, 0, w, h).data.buffer), w, h, asset.columns, asset.rows);
    for (const [x, y, ew, eh] of plan.erase) context.clearRect(x, y, ew, eh);
    // The cleaned, game-sized canvas replaces the loaded image on the GPU.
    scene.textures.remove(asset.key);
    const texture = scene.textures.addCanvas(asset.key, canvas)!;
    for (const [frame, x, y, cw, ch] of plan.cuts) texture.add(frame, 0, x, y, cw, ch);
  }
}

/** Size of a sheet's game canvas: the loaded image, shrunk to `maxEdge` if larger (never below one pixel per cell). */
export function sheetCanvasSize(asset: { columns: number; rows: number; maxEdge: number }, width: number, height: number): { w: number; h: number } {
  const scale = Math.min(1, asset.maxEdge / Math.max(width, height));
  return { w: Math.max(asset.columns, Math.round(width * scale)), h: Math.max(asset.rows, Math.round(height * scale)) };
}
