import { CROPS } from '../farm/content.js';
import { t } from '../../i18n/index.js';

// Display text lives in src/i18n/locales/cafe-recipes.js; the language is fixed per page load, so module-level t() is safe.
const L = (key, params) => t(`cafeRecipes.${key}`, params);

// Real-world reference ratios; game time compresses drip/extraction waits only.
export const SUPPLIES = [
  { id: 'cup', name: L('supply.cup'), icon: '🥤', unit: L('unit.pcs'), pack: 50, packLabel: L('pack.cup'), price: 5, start: 30 },
  { id: 'condensed', name: L('supply.condensed'), icon: '🥫', unit: 'ml', pack: 300, packLabel: L('pack.condensed'), price: 6, start: 300 },
  { id: 'milk', name: L('supply.milk'), icon: '🥛', unit: 'ml', pack: 1000, packLabel: L('pack.milk'), price: 5, start: 1000 },
  { id: 'ice', name: L('supply.ice'), icon: '🧊', unit: 'g', pack: 2000, packLabel: L('pack.ice'), price: 2, start: 2000 },
  { id: 'egg', name: L('supply.egg'), icon: '🥚', unit: L('unit.egg'), pack: 10, packLabel: L('pack.egg'), price: 4, start: 0 },
  { id: 'cream', name: L('supply.cream'), icon: '🍶', unit: 'ml', pack: 250, packLabel: L('pack.cream'), price: 6, start: 0 },
  { id: 'salt', name: L('supply.salt'), icon: '🧂', unit: 'g', pack: 100, packLabel: L('pack.salt'), price: 1, start: 0 },
  { id: 'filter', name: L('supply.filter'), icon: '📄', unit: L('unit.sheet'), pack: 40, packLabel: L('pack.filter'), price: 4, start: 0 },
];

// prices[level] is the cost to go from that level to the next; max level = prices.length.
const gearItem = (id, icon, start, prices, group) => ({ id, name: L(`gear.${id}`), icon, ...(group ? { group } : {}), start, prices, detail: L(`gearDetail.${id}`) });
export const GEAR = [
  gearItem('phin', '🫖', 1, [0, 40, 90]),
  gearItem('grinder', '⚙️', 1, [0, 80, 160]),
  gearItem('espresso', '☕', 0, [120, 200, 320]),
  gearItem('steamer', '🥛', 0, [60, 120]),
  gearItem('mixer', '🥚', 0, [70]),
  gearItem('v60', '🫗', 0, [90]),
  // Automation fills fixed counter slots, so layout and walking lanes never change when they are bought.
  gearItem('station', '🧰', 0, [150, 260], 'auto'),
  gearItem('register2', '🧾', 0, [180], 'auto'),
  // Renamed to robots (robot-staff.md 1); ids and rules unchanged so saves keep their levels.
  gearItem('kiosk', '🖥️', 0, [200, 300], 'auto'),
  gearItem('pickup', '📺', 0, [160], 'auto'),
  // Expansions open the reserved floor plots (Sân vườn, Góc rang); group 'expand' is the «Mở rộng» upgrade tab.
  gearItem('terrace', '🌿', 0, [400], 'expand'),
  gearItem('roastery', '🔥', 0, [300], 'expand'),
  gearItem('autoEspresso', '🤖', 0, [350], 'auto'),
];

// Staff train from level 1 to STAFF_MAX; each level adds +6 to every stat and work effects come from the stats.
export const STAFF_MAX = 5;
export const MAX_CREW = 10;
export const STAFF_STATS = ['speed', 'skill', 'charm', 'memory'].map(id => [id, L(`stat.${id}`)]);
// max per role keeps a 10-person crew balanced (2 + 3 + 3 + 1 + 1).
const role = (id, icon, wage, max, color) => ({ id, name: L(`role.${id}`), icon, wage, max, color, detail: L(`roleDetail.${id}`) });
export const STAFF_ROLES = [
  role('cashier', '🧾', 6, 2, '#9a6a8a'),
  role('barista', '☕', 12, 3, '#5b4a3a'),
  role('waiter', '🛎️', 6, 3, '#3f6f62'),
  role('cleaner', '🧽', 5, 1, '#6f8fb0'),
  role('manager', '📋', 15, 1, '#8a5a33'),
];
const ROBOT_WAITER = { speed: 2.4, tip: 0, carry: 1 };
const person = (id, roleId, name, avatar, stats) => ({ id, role: roleId, person: name, avatar, stats, bio: L(`bio.${id}`) });
export const CANDIDATES = [
  person('mai', 'cashier', 'Mai', '👩‍💼', { speed: 55, skill: 40, charm: 65, memory: 60 }),
  person('lan', 'cashier', 'Lan', '👩', { speed: 65, skill: 35, charm: 55, memory: 50 }),
  person('khoa', 'barista', 'Khoa', '🧑‍🍳', { speed: 45, skill: 60, charm: 40, memory: 55 }),
  person('vy', 'barista', 'Vy', '👩‍🍳', { speed: 50, skill: 70, charm: 45, memory: 50 }),
  person('phat', 'barista', 'Phát', '👨‍🍳', { speed: 62, skill: 52, charm: 38, memory: 45 }),
  person('ngan', 'barista', 'Ngân', '🧕', { speed: 42, skill: 64, charm: 55, memory: 68 }),
  person('tuan', 'waiter', 'Tuấn', '🙋‍♂️', { speed: 60, skill: 45, charm: 55, memory: 45 }),
  person('hung', 'waiter', 'Hùng', '🧑', { speed: 70, skill: 40, charm: 45, memory: 40 }),
  person('thao', 'waiter', 'Thảo', '👧', { speed: 55, skill: 50, charm: 66, memory: 45 }),
  person('duy', 'waiter', 'Duy', '👦', { speed: 64, skill: 46, charm: 42, memory: 52 }),
  person('bay', 'cleaner', L('person.bay'), '👴', { speed: 60, skill: 52, charm: 40, memory: 40 }),
  person('tu', 'cleaner', L('person.tu'), '👵', { speed: 50, skill: 60, charm: 50, memory: 48 }),
  person('quang', 'manager', 'Quang', '🧔', { speed: 50, skill: 55, charm: 70, memory: 68 }),
  person('hanh', 'manager', 'Hạnh', '👩‍🦰', { speed: 45, skill: 60, charm: 75, memory: 64 }),
  // Robots (robot-staff.md 2): fixedEffects instead of stat formulas, flat wage, never trained, no incidents.
  // stats only mirror fixedEffects for the staff sheet meters. giftOnly = trial gift members, never for hire.
  ...['01', '02', '03'].map(n => ({ id: `robo-b${Number(n)}`, role: 'waiter', person: L('person.roboWaiter', { n }), avatar: '🤖', kind: 'robot', wage: 3, fixedEffects: ROBOT_WAITER, stats: { speed: 36, skill: 0, charm: 0, memory: 0 }, bio: L('bio.roboWaiter') })),
  { id: 'robo-d1', role: 'cleaner', person: L('person.roboCleaner'), avatar: '🤖', kind: 'robot', wage: 3, fixedEffects: { speed: 2.4, cleanMs: 3200 }, stats: { speed: 36, skill: 36, charm: 0, memory: 0 }, bio: L('bio.roboCleaner') },
  { id: 'gift-pha', role: 'barista', person: L('person.giftPha'), avatar: '🤖', kind: 'robot', giftOnly: true, wage: 0, stats: { speed: 20, skill: 0, charm: 0, memory: 0 }, bio: L('bio.giftPha'),
    // faults: the fixed real mistakes it makes (robot-staff.md 5), shown when a guest refuses its cup and in the shift report.
    fixedEffects: { ms: 14000, score: 50, recipes: ['phin-den', 'nau-da'], cups: 10, speed: 2.2,
      faults: { 'phin-den': L('fault.phin-den'), 'nau-da': L('fault.nau-da') } } },
  { id: 'gift-bung', role: 'waiter', person: L('person.giftBung'), avatar: '🤖', kind: 'robot', giftOnly: true, wage: 0, fixedEffects: ROBOT_WAITER, stats: { speed: 36, skill: 0, charm: 0, memory: 0 }, bio: L('bio.giftBung') },
];
export const roleOf = id => STAFF_ROLES.find(r => r.id === CANDIDATES.find(c => c.id === id)?.role);
export const candidateById = id => CANDIDATES.find(c => c.id === id);
export const staffStat = (person, level, key) => Math.min(100, person.stats[key] + 6 * (level - 1));
export function staffEffects(person, level) {
  const s = key => staffStat(person, level, key);
  if (person.kind === 'robot') return person.fixedEffects;
  if (person.role === 'cashier') return { delay: 3.2 - s('speed') * .022, patience: 1 + s('charm') / 400 };
  // People carry up to 2 cups a trip; robots 1 (the main edge of a person over a robot).
  if (person.role === 'waiter') return { speed: 1.6 + s('speed') * .022, tip: s('charm') / 1000, carry: 2 };
  if (person.role === 'cleaner') return { speed: 1.6 + s('speed') * .022, cleanMs: 4200 - s('skill') * 28 };
  if (person.role === 'manager') return { boost: 1 + (s('charm') + s('memory')) / 1400, restock: true };
  return { ms: 16000 - s('speed') * 100, score: Math.round(50 + s('skill') * .4), mastery: Math.round(90 - s('memory') * .4), speed: 2.2 };
}
export function effectLines(person, level) {
  const e = staffEffects(person, level), name = person.person;
  const E = (key, params) => L(`effect.${key}`, params);
  const walk = () => [E('speed'), E('walk', { v: e.speed.toFixed(1) })];
  if (person.kind === 'robot') {
    if (person.role === 'barista') return [[E('speed'), E('secPerCup', { s: (e.ms / 1000).toFixed(1) })], [E('skill'), E('robotSkill', { score: e.score, cups: e.cups })]];
    if (person.role === 'cleaner') return [walk(), [E('clean'), E('robotClean', { s: (e.cleanMs / 1000).toFixed(1) })]];
    return [walk(), [E('carry'), E('robotCarry', { n: e.carry })]];
  }
  if (person.role === 'cashier') return [[E('speed'), E('cashierSpeed', { s: e.delay.toFixed(1) })], [E('charm'), E('cashierCharm', { name, p: Math.round((e.patience - 1) * 100) })]];
  if (person.role === 'waiter') return [walk(), [E('charm'), E('waiterCharm', { name, p: (e.tip * 100).toFixed(1) })], [E('carry'), E('waiterCarry', { n: e.carry })]];
  if (person.role === 'cleaner') return [walk(), [E('dexterity'), E('cleanerClean', { s: (e.cleanMs / 1000).toFixed(1) })]];
  if (person.role === 'manager') return [[E('charmMemory'), E('managerBoost', { p: Math.round((e.boost - 1) * 100) })], [E('stock'), E('managerStock')]];
  return [[E('speed'), E('secPerCup', { s: (e.ms / 1000).toFixed(1) })], [E('dexterity'), E('baristaSkill', { score: e.score })], [E('memory'), E('baristaMemory', { m: e.mastery })]];
}
// Robots earn their flat candidate wage at any level; pass `person` everywhere a wage is shown or paid.
export const staffWage = (role, level = 1, person = null) => person?.kind === 'robot' ? person.wage : Math.round(role.wage * (1 + .25 * (level - 1)));
export const trainCost = level => 40 * level;

// Per-table upgrades: seats, comfort (seated patience multiplier) and tip bonus.
export const TABLE_LEVELS = [
  { seats: 2, patience: 1, tip: 0, price: 0 },
  { seats: 4, patience: 1, tip: 0, price: 60 },
  { seats: 4, patience: 1.25, tip: .1, price: 120 },
  { seats: 4, patience: 1.4, tip: .2, price: 220 },
].map((level, i) => ({ name: L(`table.${i}`), ...level, detail: L(`tableDetail.${i}`) }));
// A cup the owner brews by hand sells at OWN_CUP × the base price (cafe-fun-review P2): skill keeps paying late game.
export const OWN_CUP = 2;
// Shift goal tiers as multiples of the bronze goal: [bronze, silver, gold] (cafe-fun-review P1).
export const SHIFT_TIERS = [1, 1.4, 1.8];
export const MAX_TABLES = 12; // 10 indoor/porch + 2 in the garden (Sân vườn)

// Steps carry language-free ids for the bench art: tool (what toolFor picks) and, for hand picks, hand (the handArt id),
// so bench.js never has to match step text. unit 'min' is the whisk timer (shown as «phút»/«min»).
// Grind options carry no emoji; the bench draws a particle-size sample instead.
const GRINDS = [0, 1, 2, 3].map(i => [L(`grind.${i}`), '']);
function grind(correct, learnKey) {
  return { type: 'pick', text: L('grind.title'), tool: 'grinder', learn: L(`learn.${learnKey}`), options: GRINDS.map(([label, icon], i) => ({
    label, icon, ok: i === correct ? 1 : 0,
    why: i < correct ? L('grind.tooFine') : L('grind.tooCoarse'),
  })) };
}
const POUR_TOOL = { '🫘': 'scoop', '🥫': 'can', '🥛': 'milk', '🍶': 'cream', '🧂': 'salt' };
function pourTool(key, icon, unit) {
  if (unit === '°C') return 'steamer';
  if (unit === 'min') return 'whisk';
  if (icon === '☕') return key === 'espShot' ? 'espresso' : 'coffee';
  return POUR_TOOL[icon] || 'kettle';
}
// wait: a real-world waiting phase played as a fast-forward animation after the step ([label, real duration]).
// key: step text + learn text ids in the locale; learnParams fills the learn text.
const pour = (key, icon, unit, target, max, layer = null, wait = false, learnParams) => ({
  type: 'pour', text: L(`step.${key}`), icon, unit: unit === 'min' ? L('unit.min') : unit, target, max, learn: L(`learn.${key}`, learnParams), layer,
  wait: wait ? L(`wait.${key}`) : null, tool: pourTool(key, icon, unit),
});
const opt = (key, icon, ok) => ({ label: L(`opt.${key}`), icon, ok, why: L(`why.${key}`) });
const pick = (key, hand, options, extra = {}) => ({ type: 'pick', text: L(`step.${key}`), learn: L(`learn.${key}`), tool: 'hands', hand, options, ...extra });
const bean = learnKey => ({ type: 'bean', learn: L(`learn.${learnKey}`), tool: 'beans' });
const phinSteps = (grams, water) => [
  bean('phinBean'),
  grind(2, 'phinGrind'),
  pour('phinDose', '🫘', 'g', [grams - 1, grams + 1], grams + 10, null, false, { grams }),
  pick('phinLid', 'lid', [opt('phinLidLevel', '✋', 1), opt('phinLidPress', '✊', 0), opt('phinLidNone', '🚫', .5)]),
  pour('phinBloom', '💧', 'ml', [15, 25], 50, null, true),
  pour('phinFill', '💧', 'ml', [water - 10, water + 10], water + 40, '#3b2416', true),
];
const espressoSteps = () => [
  bean('espBean'),
  grind(0, 'espGrind'),
  pour('espDose', '🫘', 'g', [17, 19], 26),
  pick('espTamp', 'tamper', [opt('espTampLevel', '⬇️', 1), opt('espTampTilt', '↘️', 0), opt('espTampNone', '🚫', 0)]),
  pour('espShot', '☕', 'g', [33, 39], 60, '#4a2a17'),
];

// Short names for order bubbles and order tickets (several drinks share one icon, so the name is what tells them apart).
const SHORT = Object.fromEntries(['phin-den', 'nau-da', 'bac-xiu', 'phin-mit', 'espresso', 'americano', 'cappuccino', 'latte', 'trung', 'muoi', 'v60'].map(id => [id, L(`short.${id}`)]));
export const recipeShort = id => SHORT[id] || recipeById(id)?.name || '';
const text = id => ({ name: L(`recipe.${id}`), card: L(`card.${id}`), story: L(`story.${id}`) });
export const RECIPES = [
  { id: 'phin-den', ...text('phin-den'), icon: '☕', price: 2.5, beans: 20, bean: 'robusta', uses: { cup: 1 }, gear: { phin: 1 }, reputation: 0,
    steps: phinSteps(20, 70) },
  { id: 'nau-da', ...text('nau-da'), icon: '🧋', price: 3, beans: 20, bean: 'robusta', uses: { cup: 1, condensed: 25, ice: 150 }, gear: { phin: 1 }, reputation: 0,
    steps: [pour('nauCondensed', '🥫', 'ml', [20, 30], 50, '#f3e2b8'), ...phinSteps(20, 70).slice(0, 3), ...phinSteps(20, 70).slice(4),
      pick('nauFinish', 'spoon', [opt('nauStir', '🥄', 1), opt('nauIceFirst', '🧊', .5)])] },
  { id: 'bac-xiu', ...text('bac-xiu'), icon: '🥛', price: 3, beans: 10, bean: 'robusta', uses: { cup: 1, condensed: 20, milk: 60, ice: 150 }, gear: { phin: 1 }, reputation: 55,
    steps: [pour('bacCondensed', '🥫', 'ml', [15, 25], 40, '#f3e2b8'), pour('bacMilk', '🥛', 'ml', [50, 70], 100, '#fbf6ea'),
      pick('bacIce', 'ice', [opt('bacIceFull', '🧊', 1), opt('bacNoIce', '🚫', 0)]),
      pour('bacCoffee', '☕', 'ml', [25, 35], 60, '#6b4325')] },
  { id: 'phin-mit', ...text('phin-mit'), icon: '🫘', price: 3.5, beans: 20, bean: 'liberica', uses: { cup: 1 }, gear: { phin: 1 }, reputation: 55,
    steps: [bean('mitBean'), ...phinSteps(20, 70).slice(1)] },
  { id: 'espresso', ...text('espresso'), icon: '☕', price: 3, beans: 18, bean: 'arabica', uses: { cup: 1 }, gear: { espresso: 1 }, reputation: 0,
    steps: espressoSteps() },
  { id: 'americano', ...text('americano'), icon: '🫖', price: 3.2, beans: 18, bean: 'arabica', uses: { cup: 1 }, gear: { espresso: 1 }, reputation: 0,
    steps: [...espressoSteps(), pour('amWater', '💧', 'ml', [100, 140], 180, '#7a5232')] },
  { id: 'cappuccino', ...text('cappuccino'), icon: '☕', price: 4, beans: 18, bean: 'arabica', uses: { cup: 1, milk: 120 }, gear: { espresso: 1, steamer: 1 }, reputation: 0,
    steps: [...espressoSteps(), pour('capSteam', '🌡️', '°C', [60, 65], 80),
      pick('capFoam', 'pitcher', [opt('capThick', '☁️', 1), opt('capThin', '〰️', 0)]),
      pour('capPour', '🥛', 'ml', [100, 140], 180, '#efe0c4')] },
  { id: 'latte', ...text('latte'), icon: '🥛', price: 4, beans: 18, bean: 'arabica', uses: { cup: 1, milk: 200 }, gear: { espresso: 1, steamer: 1 }, reputation: 0,
    steps: [...espressoSteps(), pour('latSteam', '🌡️', '°C', [60, 65], 80),
      pick('latFoam', 'pitcher', [opt('latThin', '〰️', 1), opt('latThick', '☁️', 0)]),
      pour('latPour', '🥛', 'ml', [180, 220], 260, '#f1e6cf')] },
  { id: 'trung', ...text('trung'), icon: '🥚', price: 5, beans: 15, bean: 'robusta', uses: { cup: 1, egg: 1, condensed: 20 }, gear: { phin: 1, mixer: 1 }, reputation: 60,
    steps: [pick('trungSplit', 'egg', [opt('trungYolk', '🟡', 1), opt('trungWhole', '🥚', 0)]),
      pour('trungCondensed', '🥫', 'ml', [15, 25], 40),
      pour('trungWhisk', '🌀', 'min', [3, 5], 8),
      pour('trungCoffee', '☕', 'ml', [35, 45], 70, '#3b2416'),
      pick('trungFinish', 'spoon', [opt('trungHotBowl', '♨️', 1), opt('trungIce', '🧊', .5)], { layer: '#f1d98a' })] },
  { id: 'muoi', ...text('muoi'), icon: '🧂', price: 4.5, beans: 18, bean: 'robusta', uses: { cup: 1, cream: 40, salt: 1, condensed: 15, ice: 120 }, gear: { phin: 1, mixer: 1 }, reputation: 65,
    steps: [pour('muoiCoffee', '☕', 'ml', [35, 45], 70, '#3b2416'),
      pour('muoiCondensed', '🥫', 'ml', [12, 18], 30, '#a07a52'),
      pour('muoiCream', '🍶', 'ml', [35, 45], 70),
      pour('muoiSalt', '🧂', 'g', [.4, .8], 2),
      pick('muoiFinish', 'spoon', [opt('muoiTop', '🧊', 1), opt('muoiStir', '🥄', .5)], { layer: '#f4ead7' })] },
  { id: 'v60', ...text('v60'), icon: '🫗', price: 5, beans: 15, bean: 'arabica', uses: { cup: 1, filter: 1 }, gear: { v60: 1 }, reputation: 0,
    steps: [bean('v60Bean'),
      grind(1, 'v60Grind'),
      pick('v60Filter', 'filter', [opt('v60Rinse', '💧', 1), opt('v60Dry', '📄', .5)]),
      pour('v60Dose', '🫘', 'g', [14, 16], 25),
      pour('v60Bloom', '💧', 'g', [25, 40], 60, null, true),
      pour('v60Pour', '🫗', 'g', [235, 265], 320, '#8a5a33', true)] },
];

export const recipeById = id => RECIPES.find(recipe => recipe.id === id);
export const stars = score => score >= 90 ? 3 : score >= 70 ? 2 : score >= 40 ? 1 : 0;
export const cafeRank = reputation => Math.max(1, Math.min(5, 1 + Math.floor((reputation - 10) / 20)));

// What keeps a recipe off the menu: { gear } (missing gear name) or { rep } (reputation needed), or null.
function lockInfo(recipe, cafe) {
  const gear = Object.entries(recipe.gear).find(([id, level]) => (cafe.gear[id] || 0) < level);
  if (gear) return { gear: GEAR.find(item => item.id === gear[0]).name };
  return cafe.reputation < recipe.reputation ? { rep: recipe.reputation } : null;
}
export function lockReason(recipe, cafe) {
  const lock = lockInfo(recipe, cafe);
  if (!lock) return '';
  return lock.gear ? L('lock.gear', { name: lock.gear }) : L('lock.rep', { rep: lock.rep });
}

export function missingFor(recipe, cafe, cropId) {
  const missing = [];
  const lock = lockInfo(recipe, cafe);
  if (lock) missing.push(lock.gear ? L('missing.gear', { name: lock.gear }) : L('missing.rep', { rep: lock.rep }));
  if ((cafe.stock.roasted[cropId] || 0) < recipe.beans) missing.push(L('missing.beans', { grams: recipe.beans, crop: CROPS.find(crop => crop.id === cropId)?.short || '' }));
  for (const [id, amount] of Object.entries(recipe.uses)) {
    const supply = SUPPLIES.find(item => item.id === id);
    if ((cafe.supplies[id] || 0) < amount) missing.push(`${supply.name} ${amount} ${supply.unit}`);
  }
  return missing;
}

export function gearBonus(recipe, gear) {
  return Object.keys(recipe.gear).reduce((sum, id) => sum + Math.max(0, (gear[id] || 0) - 1) * 4, Math.max(0, (gear.grinder || 1) - 1) * 3);
}
