# Farm Economy Balance (Farm World 2.0)

Status: first-pass numbers, tuned with the simulator on 2026-11-07. Every number lives in
`src/core/config/economy.js`; re-run `node scripts/economy-sim.mjs <minutes> <farm|cafe|both> <1|0>` after any change.
Guards: `tests/core/economy.test.mjs` (pacing, no stall, no negative coins, production pays), `scripts/qa-personas.mjs`
(exploits, bottlenecks, duplicates).

## 1. Chains
Farm: **Grow → Harvest (beans) → Dry → Roast → Pack → Store → Sell** (Transport = selling at the storehouse in Round 1).
Café (unchanged): **Beans (own farm or supplier) → Brew → Serve → Earn**; its Roaster raises drink prices.
The two link through shared goods: beans are one stock for both games; a café region imports beans (4¢), a farm region
sells them (2¢) or processes them. One game per region is enforced in core, so no region can import beans and sell
processed goods (no buy → process → sell loop).

| Good | Price | Made by | Per batch at Lv1 (2 taps) |
|---|---|---|---|
| Coffee beans | 2 | fields (robusta 2/15 s, arabica 4/40 s) | — |
| Dried beans | 4 | Drying yard: 12 beans → 12 dried, 30 s, no fuel | +24 coins |
| Roasted beans | 9 | Roastery: 12 dried → 9 roasted, 45 s, fuel 3 | +30 coins |
| Coffee bag | 33 | Packing shed: 9 roasted → 3 bags, 40 s, fuel 2 | +16 coins, and 9 → 3 storage |

One raw bean sold raw = 2 · dried = 4 · roasted ≈ 6.5 net · bagged ≈ 8 net (≈ 4× raw). A harvest action earns about
5.5 coins gross, so each stage is worth more per tap than farming — the reason to build it.

## 2. Formulas
Let `L` = building level, `n(L)` = batch multiplier (1, 1, 2, 2, 3, 3, 4, 4), `v(L)` = speed (1, 1.25, 1.25, 1.5, 1.5,
1.75, 1.75, 2), `r` = recipe.
- **Batch:** inputs `r.in × n`, outputs `r.out × n`, fuel `r.fee × n`, duration `r.seconds / v` (fixed at start).
- **Processing capacity of one building** (units of input per minute): `C = 60 × r.in × n(L) × v(L) / r.seconds`.
  Drying yard Lv1: 24 beans/min; Lv8: 192 beans/min. Roastery Lv1: 16 dried/min. Packing shed Lv1: 13.5 roasted/min.
- **Throughput of a stage with k copies:** `T_stage = min(Σ_i C_i, supply from the stage before)`.
  **Effective output of the farm** = the smallest of: bean supply (fields × yield / grow time, and the player's taps),
  every stage's `T`, storage room, and the player's taps for start + collect.
- **Duplicates:** price of copy k = `cost × g^(k−1)` (g = 1.5–1.7). Capacity adds linearly, so the marginal value of
  copy k is `min(C_k, spare supply)` — zero once the stage before (or the fields) is the bottleneck. With a rising price
  this gives diminishing marginal value (tested: a 2nd yard without beans adds nothing).
- **Gross revenue / minute** = Σ_goods sold × price. **Operating cost** = fuel fees + seeds. **Net profit** =
  revenue − operating cost.
- **Value added per batch** `ΔV = Σ out × price − Σ in × price − fee`.
- **Payback of a building** = `price / (ΔV × batches per minute it actually runs)`. Drying yard Lv1 fed fully:
  120 / (24 × 2) ≈ 2.5 min of busy time; Roastery: 300 / (30 × 1.33) ≈ 7.5 min; Packing shed 700 / (16 × 1.5) ≈ 29 min
  (its main value is storage compression and XP late in Round 1).
- **Upgrade efficiency** = `ΔT × ΔV_per_unit / upgrade price`; odd levels (batch) halve the taps per bean, even levels
  (speed) shorten waits.
- **Storage:** `capacity = silo(L) + Σ barns(L)`; `stored = beans + dried + roasted + bags`. Harvest and collect are
  refused once `stored ≥ capacity` (soft cap: one harvest or batch may overflow, as before).
- **Wells:** a field's grow time = `growSeconds / (1 + staff + blessing + best well in reach)`; wells never stack on
  one field.
- **Fields:** free while `fields < 6 × owned field lots`; extra field k costs `60 × 1.3^k` (rounded to 5), up to
  `2 × level` extras (max 40).
- **Removal refund** = `floor(0.5 × coins spent)` (build price paid + upgrades). Build XP once per copy slot.

## 3. Unlock pacing (Round 1, before the Level-10 incident)
Lv2 Drying yard · Lv3 Barn, Well · Lv4 Roastery, 2nd yard · Lv5 2nd barn, 2nd well · Lv6 Packing shed, 2nd roastery ·
Lv7 3rd yard, 3rd barn, 3rd well · Lv9 3rd roastery, 2nd packing shed, 4th barn. Nothing unlocks at Lv10.

## 4. Simulation results (45 simulated minutes, tap = 1.2 s per action, includes one Level-10 incident + restart)

| Run | Lv10 at | earned/min, min 5–15 | earned/min, min 35–45 | gross coins | batches | harvests |
|---|---|---|---|---|---|---|
| Farm only, with processing | 15.9 min | 278 | **331** | 11 814 | 132 | 811 |
| Farm only, sells everything raw | 14.8 min | 260 | 269 | 10 914 | 0 | 991 |
| Café only (imports beans) | 20.3 min | 468 | 570 | 19 922 | — | — |
| Both games in one region (old guard) | 12.6 min | 363 | 639 | 20 519 | 59 | 442 |

Reading:
- Processing raises farm income by about **+23 % once the chain runs** (331 vs 269 per minute), while the player
  harvests 18 % less — the workshops win by value per bean, not by more beans. Early on it is roughly even (capital
  goes into workshops instead of land).
- Pacing stays inside the approved window (10–35 min, design target ≈ 20 min farm-only, 22–30 café-only). Farm-only is
  a little fast (15–16 min) — unchanged by this update (the raw run is 14.8 min); see decision 3.
- Coins never went negative; income never stalled > 2 minutes after the incident.
- The "both" run is the historical guard (farm + café in one region, which Round 1 no longer allows); kept so old
  numbers stay comparable.

Earlier tuning passes (kept for the record): with 6-bean batches and dried = 3 the processing player earned *less* than
the raw player (each batch cost two taps worth more as harvests); with 12-bean batches and dried 3 / roasted 7 / bag 28
it was even. The numbers above are the first set where every stage beats a harvest tap.

## 5. Simulator player model
`scripts/economy-sim.mjs` (deterministic): one action per 1.2 s; every 15 s it tries one investment (land in order while
land is the cheaper way to grow, then saves for the next workshop of the chain; 2nd yard / roastery when inputs back up;
barns when storage ≥ 80 %; workshop upgrades first). Each beat: collect a finished batch → harvest → plant → start the
most downstream batch → sell (finished goods; raw beans only when nothing processes them or storage ≥ 85 %).
Limits of the model: it taps one plot per action (real players drag across beds, which makes beans cheaper and
processing relatively more valuable); no staff jobs, gifts, loans or venues.

## 6. Exploit checks (all pass)
- Build → remove → build loses coins and gives no extra XP (`region.peak`).
- Field place → remove never earns (refund ≤ half of what it cost; free fields refund 0).
- A farm region cannot import beans (`gameLocked`); a café region cannot sell goods or plant.
- Removing a barn that holds goods over the remaining capacity is refused.
- Junk payloads on every new action are refused without changing coins.
- **Open (founder rule):** loans still stack without a ceiling (approved as a playtest feature). Recommendation:
  `max debt = 2 000 + 1 000 × level`, loans only in phase `play` — needs the founder's OK (see GDD §8).
