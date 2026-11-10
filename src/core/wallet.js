// Wallets (docs/design/wallet-economy.md): one cash wallet (`usd`) for the account, one Gold wallet per owned city.
// s.player.coins stays the Gold of the city being played, so the economy code keeps one register to read and write;
// s.wallet.gold holds every city's balance and is mirrored from the register after each action (game.js apply()).
// Pure helpers only: nothing here reads the clock or the browser.
import { WALLET, loanRate } from './config/economy.js';
import { isRegionId } from './config/world.js';

const r2 = n => Math.round(n * 100) / 100;
const obj = v => (v && typeof v === 'object' && !Array.isArray(v)) ? v : null;
const clampNum = (v, min, max, d = 0) => (Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d);

export const newWallet = () => ({ v: WALLET.version, usd: 0, borrowed: 0, gold: {}, books: {}, ledger: [], requests: [], seq: 0, migrated: null });

/** Local calendar day as a running number, so a period is a plain subtraction. */
export const dayNumber = now => { const d = new Date(now); return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5); };

export const usdOf = s => s.wallet?.usd || 0;
export const goldOf = (s, regionId) => (regionId && regionId === s.world.currentRegion ? s.player.coins : s.wallet?.gold?.[regionId] || 0);
export const farmIds = s => (s.world.ownedRegions || []).filter(id => s.world.regions[id]?.status !== 'expired');
/** Gold across every owned farm, plus the purse while the player stands in no city yet. */
export const totalGold = s => r2(farmIds(s).reduce((n, id) => n + goldOf(s, id), s.world.currentRegion ? 0 : s.player.coins));

export const walletRate = () => WALLET.goldPerUsd;
export const goldForCents = (cents, rate = WALLET.goldPerUsd) => r2(cents * rate / 100);
/** USD cents worth this much Gold, rounded up: a debt is never shown or paid for less than it is. */
export const centsForGold = (gold, rate = WALLET.goldPerUsd) => Math.max(0, Math.ceil(r2(gold * 100 / rate) - 1e-9));
/** Interest on this many borrowed cents, rounded up to a whole cent. */
export const interestOn = (cents, rate = loanRate()) => Math.max(0, Math.ceil(cents * rate - 1e-9));
/** Cents of the cash wallet that are still borrowed money: never more than the balance or what is still owed. Spent first. */
export function borrowedOf(s) {
  const debt = (Array.isArray(s.loans) ? s.loans : []).reduce((n, ln) => n + (ln?.owed > 0 ? ln.owed : 0), 0);
  return Math.min(s.wallet?.borrowed || 0, usdOf(s), centsForGold(debt));
}
export const validRequest = id => typeof id === 'string' && id.length >= 8 && id.length <= 64;
export const seenRequest = (s, id) => (s.wallet.requests || []).includes(id);

/** What a conversion would do, or why it cannot be done. The preview and the action both read this. */
export function convertQuote(s, regionId, cents) {
  const rate = WALLET.goldPerUsd;
  // Interest only on the borrowed part of the amount, taken out of it: the deposit part converts in full.
  const interestRate = loanRate(), borrowed = borrowedOf(s), interest = Number.isInteger(cents) && cents > 0 ? interestOn(Math.min(cents, borrowed), interestRate) : 0;
  const base = { regionId, cents, rate, approved: WALLET.rateApproved, interestRate, borrowed, interest, gold: 0, usdAfter: usdOf(s), goldAfter: goldOf(s, regionId) };
  if (!farmIds(s).includes(regionId)) return { ...base, ok: false, error: 'notOwned' };
  if (!Number.isInteger(cents) || cents < WALLET.minConvertCents) return { ...base, ok: false, error: 'amount', minCents: WALLET.minConvertCents };
  if (cents > usdOf(s)) return { ...base, ok: false, error: 'usdShort', missingCents: cents - usdOf(s) };
  const gold = goldForCents(cents - interest, rate);
  if (goldOf(s, regionId) + gold > WALLET.maxGold) return { ...base, ok: false, error: 'goldCap' };
  return { ...base, ok: true, gold, usdAfter: usdOf(s) - cents, goldAfter: r2(goldOf(s, regionId) + gold) };
}

export function addLedger(s, now, row) {
  const w = s.wallet;
  w.seq = (w.seq || 0) + 1;
  w.ledger = [...w.ledger, { id: w.seq, at: now, ...row }].slice(-WALLET.ledgerKeep);
}
export function rememberRequest(s, id) { s.wallet.requests = [...s.wallet.requests, id].slice(-WALLET.requestKeep); }

/** Adds real income / cost to a city's day row. cat: which part of the farm it came from. */
export function bookDay(s, regionId, now, earned, spent, cat) {
  if (!regionId || !s.wallet) return;
  const rows = (s.wallet.books[regionId] ||= []), d = dayNumber(now);
  let row = rows[rows.length - 1];
  if (!row || row.d !== d) { row = { d, earned: 0, spent: 0, by: {} }; rows.push(row); if (rows.length > WALLET.bookDays) rows.shift(); }
  if (earned > 0) row.earned = r2(row.earned + earned);
  if (spent > 0) { row.spent = r2(row.spent + spent); row.by[cat] = r2((row.by[cat] || 0) + spent); }
}
/** Income, cost and profit of a city over the last `days` calendar days, from what was really booked. */
export function periodOf(s, regionId, days, now) {
  const from = dayNumber(now) - days + 1;
  const out = { earned: 0, spent: 0, profit: 0, by: {}, hasData: false };
  for (const row of s.wallet?.books?.[regionId] || []) {
    if (row.d < from) continue;
    out.hasData = true; out.earned = r2(out.earned + row.earned); out.spent = r2(out.spent + row.spent);
    for (const [k, v] of Object.entries(row.by)) out.by[k] = r2((out.by[k] || 0) + v);
  }
  out.profit = r2(out.earned - out.spent);
  return out;
}

/** Old saves have one pot. It is not converted: the amount is shared out as Gold between the cities owned, whole cents, nothing lost. */
function migrate(out, now) {
  const w = newWallet(), ids = farmIds(out), cur = out.world.currentRegion;
  const coins = out.player.coins;
  w.migrated = { at: now, coins, farms: ids.length };
  if (ids.length) {
    const cents = Math.round(coins * 100), each = Math.floor(cents / ids.length), holder = cur && ids.includes(cur) ? cur : ids[0];
    for (const id of ids) w.gold[id] = each / 100;
    w.gold[holder] = r2((cents - each * (ids.length - 1)) / 100);
    if (cur) out.player.coins = w.gold[cur] ?? out.player.coins;
  }
  out.wallet = w;
  addLedger(out, now, { kind: 'migrate', gold: coins, farms: ids.length });
}
function sanitize(raw) {
  const w = { ...newWallet(), ...raw, v: WALLET.version };
  // Before v2 the rate was 100 Gold per unit of cash. The rate is now 1:1, so old balances are scaled to buy the same Gold.
  const scale = (Number(raw.v) || 1) < 2 ? 100 : 1;
  w.usd = Math.floor(clampNum(raw.usd * scale, 0, WALLET.maxUsdCents));
  w.borrowed = Math.floor(clampNum(raw.borrowed, 0, WALLET.maxUsdCents));
  w.gold = Object.fromEntries(Object.entries(obj(raw.gold) || {}).filter(([id, v]) => isRegionId(id) && Number.isFinite(v)).map(([id, v]) => [id, clampNum(v, 0, WALLET.maxGold)]));
  w.books = Object.fromEntries(Object.entries(obj(raw.books) || {}).filter(([id, rows]) => isRegionId(id) && Array.isArray(rows))
    .map(([id, rows]) => [id, rows.filter(r => obj(r) && Number.isInteger(r.d)).map(r => ({ d: r.d, earned: clampNum(r.earned, 0, WALLET.maxGold), spent: clampNum(r.spent, 0, WALLET.maxGold), by: obj(r.by) || {} })).slice(-WALLET.bookDays)]));
  w.ledger = (Array.isArray(raw.ledger) ? raw.ledger : []).filter(obj).slice(-WALLET.ledgerKeep).map(r => (scale > 1 && Number.isFinite(r.usd) ? { ...r, usd: r.usd * scale } : r));
  w.requests = (Array.isArray(raw.requests) ? raw.requests : []).filter(validRequest).slice(-WALLET.requestKeep);
  w.seq = Math.floor(clampNum(raw.seq, 0, Number.MAX_SAFE_INTEGER));
  w.migrated = obj(raw.migrated);
  return w;
}
/** Last step of normalizeSave: every other step may still have added coins (refunds). */
export function normalizeWallet(out, raw, now) {
  if (obj(raw)) out.wallet = sanitize(raw); else migrate(out, now);
  const cur = out.world.currentRegion, first = cur || farmIds(out)[0] || null;
  out.loans = out.loans.map(ln => (ln.regionId ? ln : { ...ln, regionId: first }));
  mirrorRegister(out);
}
export function mirrorRegister(s) { const cur = s.world.currentRegion; if (cur && s.wallet) s.wallet.gold[cur] = s.player.coins; }
