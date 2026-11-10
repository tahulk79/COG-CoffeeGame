# Farm Manager V2 (2026-11-08)

Upgrade of the existing Tổng quản lý on the farm. The café manager is unchanged. **Status: coded, `vite build` passes, nothing tested.** No unit test, simulation or browser run was done, because the project rule is build-only unless the founder asks for a test round. Every number in `FARM_MANAGER` (`economy.js`) is a proposal.

## 1. Audit of what existed

| Area | Found | Verdict |
|---|---|---|
| Four terraces | `ESTATES`, `FARM_TIERS`, `tierIndexAt`. Bought once, by coins and level | Kept |
| Crop by terrace | `CLIMATE_EFFECT`: wrong zone is slower and lower grade. No hard ban | Rule gap R1 |
| Manager | `GM_RULES` → `gmCandidates` → `gmPermission` → `gm/think` | Kept, V2 gates it |
| Economy | Payback gates and a 10-min budget (`farm-crew.md` §15) | Kept. Many "values" were scoring numbers, not coins per minute |
| Workers | `staff.js`: one `e.job` per unit, claims stop two units on one spot, real route distance | Kept |
| Water | Tanks are water points and speed up fields in reach. A bucket is 4+ plants per trip. Refills are free and unlimited | Kept. Tank stock not invented (R2) |
| Construction | `gmBuildNeeds`, `placementError`, handlers charge the real price | Kept |
| Offline | `gmAwayPay`: 70 % of the running rate, 120 min cap | Kept, summary added |
| Saves | `normalizeGm` whitelists fields | `gm.fm` added, old saves get defaults |

## 2. Defects fixed

1. Queued crew orders were not reserved, so several could promise the same coins. They now count as committed (`fmCommitted`).
2. A building upgrade was always valued at cost/10, so it always looked like a 10-minute payback. It now uses storage and processing formulas, or is marked as an estimate.
3. Fallback planting ignored altitude (`pickCropFor`, and the unskilled-worker fallback in `staff.js`).
4. A unit that could not reach a job walked forever. After 15 s without moving it drops the job and the spot is avoided for 12 s. A manager's order is carried out from the closest point instead.
5. Far fields could wait forever behind nearer ones. Waiting time now shortens their distance, capped at 30 m.
6. Terrace assignment (changed 2026-11-09 at the founder's request): every unit, robots included, has one terrace. Each trade is split evenly over the terraces that have fields, whatever their size. The headcount of the terraces is kept at most one apart. Field work is strictly the unit's own terrace; idle units wait there. Haulers and processors do their own terrace first and may help elsewhere. The manager's own hands go first to terraces with nobody of that trade. New fields go to the terrace with the fewest, and each kind of building to the terrace with the fewest of it. Pins stay.
7. A manager could sell land on his own. Land sales now always wait for a signature.

Fixed after the founder's report (2026-11-09: tiers 2–4 never planted, only losses visible). All four blocked or misled expansion and came from the first V2 pass:

- The stuck timer counted walking time, so long walks to upper terraces were cancelled. It now counts time without moving.
- Forecasts learned from coins received, but sales wait for a signature, so unsold beans read as "the farm earns little" and failed land on payback. Unsold stock no longer lowers the forecast, and land uses the §15 full-terrace test.
- The "land not planted enough" check ignored §14's rule that idle money opens the next tier.
- Spending with no earnings formula (animals, vehicles, shade, extra team upgrades) was unlimited. It now needs real profit and no debt.

The panel now shows debt, unsold goods, net worth, income, running cost, investment, profit per minute, why there is no profit and the estimated time to clear the debt.

## 2b. The manager's own hands (founder 2026-11-09: "nhanh nhẹn như tôi bấm")

Supersedes part of `farm-crew.md` §12: `gm/hands` runs every 2 s while auto-manage is on. He picks, sows, cuts back old trees and waters directly, 60 jobs a minute at ⚡1 and +20 % per ⚡ step, skipping plots the crew is on. He also opens fields himself. Crops are chosen per field by coins per minute among those suited to its terrace (`managerCropFor`), overriding the seed selected on the toolbar while auto-manage is on.

Selling: founder decided 2026-11-09 that the manager sells by himself by default, at 50 % storage (`autoSell`), which supersedes the earlier "selling beans needs my signature". The switch in the panel turns it off, and then sales need a signature again. Real-money top-ups always need the player.

Balance changes (proposals, not simulated): he counts as about 7 pickers' worth of hands, so fewer hires are planned; borrowed coins no longer raise the growth budget; no new storehouse while a sale waits for a signature; only the first processing station is mandatory.

## 2c. Crop and layout formulas (2026-11-09)

Crop choice per field: `cropEcon(load)`. `wait = max(0, fields × jobs / picks per minute − season)`, cycle = season + wait. A pick later than the crop's fresh window earns 1★ instead of 3★ (± the terrace's stars), and Arabica loses dropped cherries. Rate = (revenue − sapling / life) / cycle, among crops suited to the terrace. On a small farm the fast crop wins; once fields outrun the picking capacity, slow-to-spoil Liberica (lowland) wins, which is what the terrace card recommends.

A tree is replaced when it is penalised on its terrace and a suited crop exists, or when it is old and another crop earns at least `CLIMATE_PICK.switchMul` times more.

Layout: each terrace keeps a 3.4 m service strip for storage, processing and vehicles, so they never take field rows. Tanks and drip lines go where they newly cover the most fields. Shade trees are built only on terraces growing a crop they help.

## 2d. Performance with a big team (2026-11-09)

The save is written at most every 1.5 s and on leaving the page (`saveEveryMs`), so up to 1.5 s of play can be lost on a crash. Background updates with no events re-sync the world at most twice a second. Idle units look for work about once a second. Plot state and crop choices are memoised. Worker models are built one per frame. Only the 8 units nearest the camera cast shadows, the far ones animate at a lower rate, and only the nearest 22 are drawn; hidden units keep working (`FARM_MANAGER.lod`).

## 2e. Staffing from the counters (2026-11-09)

`farmStaffing` uses the same counters as the HUD chips. Units needed = (backlog / 5 min + arriving per minute − the manager's own hands) / jobs a unit does per minute, capped at the trade's share of the 30-unit crew (harvest 50 %, water 20 %, haul 15 %, prune 10 %). Storehouses needed = picked beans per minute × minutes held before sale (1 with auto-sell, 10 without). `farmOverloaded` stops new fields while ripe > 2 min of picking or more ripens than can be picked.

## 3. Architecture

`src/core/farm-manager.js` is pure: no three.js, timers or randomness. It decides; the existing action handlers execute and charge.

| Step | Code |
|---|---|
| Observe | `farmKnowledge`: each terrace's unlock, plots, crops, water, crew, earnings |
| Validate | `legalCrops`, `gate` |
| Forecast | `econOf`: flow, net = flow × horizon − investment, ROI, payback |
| Plan | `thinkContext` ranks; `refreshPlan` stores objective and bottlenecks every 20 s played |
| Reserve | Budget = coins − reserve − committed, reduced as each job passes |
| Execute | `gm/think` → `gmRun` or a crew order; `gm/execute` re-checks settings on arrival |
| Verify | `note`: bounded log with a reason code per outcome |
| Adjust | `calibrate`: measured income / modelled income scales later forecasts |

Cadence: the manager's existing think (2–5 s). Nothing runs per frame except the existing movement. The panel memoises for 3 s.

**Gate order for farm capital spending:** permission switch → Recovery → loan allowed → reserve → spending limit → payback and net → land checks (locked, compatible crop, land planted enough, crew) → saving for something better. Essentials (first fields, storehouse, first tank, first of a trade) skip the automatic reserve and payback, never the player's own minimum or limit.

**Recovery Mode:** running loss over 30 played minutes and cash plus stock below 1.5 × reserve. Only essentials, care and sales continue.

**Modes** (`Balanced` default): reserve ×, max payback, terrace payback, horizon, land use, loans. Balanced keeps §15's 120-minute terrace test. Manual Approval files every capital job to the inbox.

## 4. Unresolved design rules (need the founder)

| # | Gap | Temporary behaviour |
|---|---|---|
| R1 | No crop is banned on any terrace, only penalised | Manager never picks a penalised crop while another is unlocked. If only penalised crops exist it plants one and shows a bottleneck |
| R2 | Tanks have no stored water, refill rate, capacity or slot limit. `farm-crew.md` says watering is free | Unlimited refills, no queue. Adding tank stock is a new game rule |
| R3 | **Founder said 2026-11-08: no modes, budgets or limits in the UI. The V2 brief asks for them** | Built as the brief asks: the mode picker is visible, limits sit under one fold. Defaults still let him run everything except that he keeps a reserve |
| R4 | "Three workforce slots per farm": the code has a 30-per-zone ceiling and the founder removed level caps | Kept 30 |
| R5 | Who may fire: §10 and §14 let the manager fire or replace workers. The brief says no deleting assets without permission | Left as §10 and §14 |
| R6 | Offline earnings are a rate estimate, not per-crop simulation | Left as it was |

## 5. Model assumptions

`FARM_MANAGER.jobValue` (the share of a harvest's value that one job creates) is an assumption. Calibration corrects the overall level, not the split between jobs. It reads total income, so unsigned bean sales pull forecasts down. Shade trees, animals, vehicles and tank upgrades have no real formula yet: they stay `known: false`, rank last and never pass or fail on payback.

## 6. Scheduler and states

The queue stays distributed: each unit picks its next job and claims it, which is what enforces one job per unit and no duplicates. `taskBoard` is a read model of the same work (task id, type, terrace, job, value, age, dependencies), not the executor. The panel shows its counts. Phases shown in the panel come from `phaseOf`: IDLE, MOVING, WORKING, REFILLING_WATER, WAITING_FOR_WATER, WAITING_FOR_RESOURCE, BLOCKED, RECOVERING, UNAVAILABLE. ASSIGNED and COMPLETED are instantaneous and have no phase of their own.

## 7. The brief's 20 scenarios: where each is handled (none executed)

| # | Scenario | Where |
|---|---|---|
| 1, 2 | Four or one terrace, few workers | `planTiers`, `farmKnowledge` |
| 3, 20 | No cash for expansion; spending the reserve | `gate` → `reserve` |
| 4, 14 | Profitable farm; several options | ranking, `saving` |
| 5 | Operating at a loss | `inRecovery` |
| 6 | All busy | existing claims; a unit keeps its one job |
| 7, 9 | Robot lacks water; no tank | `staff.js` fetch step; `noWell` wait, `noWater` bottleneck, essential tank |
| 8, 10 | Tank empty; several refilling | not applicable under the current rules (R2) |
| 11 | Wrong crop | `legalCrops`, `pickCropFor`, `easyCropFor` (R1) |
| 12 | Construction blocks a path | existing `placementError`, `gmBuildSpot` |
| 13 | Worker stuck | `stuckSeconds`, `avoid` |
| 15 | Long offline | existing cap, `fm.away` summary |
| 16 | Save and load mid-task | jobs are not saved, units re-pick; orders and `fm` are saved |
| 17 | Disabled during construction | `gm/fmSet` drops queued orders; `gm/execute` re-checks |
| 18 | Player reassigns a worker | `gm/fmPin` |
| 19 | Several buildings of one type | extra tank rule in `gmBuildNeeds` |

## 8. Not done

- Automated tests, browser E2E, the baseline comparison and performance measurements. Existing tests may need updating: `gmSpendable`, `planTiers` and new fields in `newGmState` changed.
- Economy simulation (`npm run sim`), so no measured profit, cash-flow or utilisation result exists.
- New worker-support building types: only those already in `BUILDINGS` are used.

## 9. Manual check

Open a farm with a hired manager, go to Quản lý. Then:
1. Switch to Hỏi tôi: purchases appear in the inbox instead of happening.
2. Set a high minimum reserve: the log shows "Tạm giữ: sẽ đụng vào tiền dự phòng".
3. Turn off auto-manage while a builder walks to a site: the job is cancelled.
4. Pin a worker to a terrace in "Ai đang làm gì": it stays there.
5. Remove every tank with a waterer on the team: the panel reports the missing tank.

## Heart–Reason slider (founder 2026-11-10)

The mode buttons are replaced by one slider in the Manager tab, `fm.stance` from 0 (Heart) to 100 (Reason). A hired farm manager only: with none, or with Auto, the position counts as 50.

| Position | Goal (nearest mark sets the investment mode) | Worker speed | Morale per minute |
|---|---|---|---|
| 0 | Heart (`conservative`: double reserve, no loans) | −10% | +3 |
| 25 | Growth (`expansion`) | −5% | +1.5 |
| 50 | Balance (`balanced`) | none | none |
| 65 | Repay debt (`debt`) | +9% | −1.2 |
| 80 | Profit (`profit`) | +18% | −3.3 |
| 100 | Profit, full discipline | +30% | −7 |

Morale drain is `drainPerMin × tilt^drainPow` with tilt = (position − 50) / 50. All numbers are in `FARM_MANAGER.stance`.

- Position 50 changes nothing, so the Lv10 pacing at the default is untouched.
- Reason side: at each MVP round the best worker gets a Gold bonus and morale, the worst loses morale. The care wallet shrinks to nothing at 100. A farm worker who starts to sulk (morale under 20) quits, reason `stress`.
- Heart side: the care wallet grows by up to 50%, and nobody quits from pressure.
- Repay debt: at each think, Gold above his reserve and open orders pays the loan. It needs no credit licence, because the player chose the goal. He takes no new loans.
- "Ask me" (`fm.ask`) is a switch that works at any position. The old Careful mode is the Heart end. Old saves start on the mark of their mode.
- Measured over 60 played minutes (delegate, 6 seeds, farm only): income 12.4k at 0, 12.0k at 25, 14.2k at 50, 13.9k at 65, 15.9k at 80, 20.3k at 100. Workers quit from pressure: 0, 0, 0, 0, 3.5, 13.2.

