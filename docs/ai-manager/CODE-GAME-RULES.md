# Code game rules

The rules of this game as the code implements them, not as the design docs describe them. Read from the working tree on 2026-11-09, branch `feat/coffee-varieties`, which has uncommitted changes. No test, simulation or game code was executed. No clone time or win rate is measured here.

Short names used below: `game.js` = `src/core/game.js`; `derive.js` = `src/core/derive.js`; `state.js` = `src/core/state.js`; `store.js` = `src/core/store.js`; `economy.js` = `src/core/config/economy.js`; `layout.js` = `src/core/config/layout.js`; `research.js` = `src/core/config/research.js`; `staff.js` = `src/features/realm/staff.js`; `staff-brain.js` = `src/features/realm/staff-brain.js`; `index.js` = `src/features/realm/index.js`; `D.` = exports of `derive.js`.

Every action block has eight fields: Where, Conditions, Consumes, Changes, Rewards, Duration, Dependencies, Failures. A "play gate" means `apply()` requires `story.phase==='play'` and a `world.currentRegion`.

Flags that decide many results: `EXPIRY_ENABLED=false` (economy.js:912), `CAFE_ENABLED=false` (`src/core/config/world.js:118`), `hireLimit()` always 30 (economy.js:313,316), `robotCap(30)=15`, `GM.modes` holds only `full`, `GM.unlockLevel` 1, `cropUnlocked` ignores level (derive.js:169), `fieldCost()=0` (derive.js:295), `maxCount` 9999 (derive.js:541).

Save schema is 3 (state.js:11). `LAYOUT_VERSION` is 5 (state.js:617).

---

## 1. Engine, state and bookkeeping

**apply (reducer entry, runs on every action)**
- Where: game.js:2726 `apply`.
- Conditions: gates in order. A handler exists in `handlers[action.type]`. `txId` is not already in `state.tx`. PAUSABLE regex (line 20) blocks only when `story.phase==='expiry'`. Prefixes farm, shop, build, land, prod, staff, rival, gm, task, research, supply, farmlab need the play gate. CAFE_LOOP actions (line 2719: shop/spawnCustomer, customerLeft, takeOrder, brew, serve, spill, venueSale, review) need `!D.shopPaused(state)`.
- Consumes: CPU, one full `clone(state)` (structuredClone, state.js:782) before the handler, on every action that passes the gates, including those ending in fail or noop.
- Changes: handler mutates the draft. On success `draft.tx=[...tx,txId].slice(-64)` when a txId is given, `draft.rev=(state.rev||0)+1`, `draft.updatedAt=ctx.now`. Module vars `ACTOR=actorOf(type,payload)`, `NOW=ctx.now`, `CUR=draft`; ACTOR and CUR reset in finally. Input state is not mutated.
- Rewards: returns `{ok:true,state:draft,events}`. Fail or noop discards the draft and all events.
- Duration: synchronous. All time comes from `ctx.now`.
- Dependencies: handlers registry (line 906, 126 keys), `clone` (state.js:782), `D.shopPaused` (derive.js:403).
- Failures: unknownAction, paused, notPlaying, cafeClosed, any handler `fail(error,data)`. Non-error exits: `{ok:true,duplicate:true}` for a repeated txId, `{ok:true,noop:true}` with the old state. A handler throw is not caught (try/finally only) and propagates out of dispatch.

**Store dispatch**
- Where: store.js:76 `createStore.dispatch`.
- Conditions: none of its own; apply decides.
- Consumes: apply's clone. For `expiry/execute` with `story.expiry.status==='pending'`, a JSON.stringify of the whole save to `<key>-pre-expiry` (store.js:78-80).
- Changes: replaces held state only when `result.ok && result.state!==state`, then requestSave, then notifies every listener with `(state,events,type)`.
- Rewards: returns apply's result to the caller.
- Duration: synchronous; the save may be deferred.
- Dependencies: apply. The ctx passed is only `{now: opts.now ?? now(), dev}`.
- Failures: passes apply's errors through. Fail, noop and duplicate do not save or notify.

**Persist save (grouped write)**
- Where: store.js:53 `persist`, `requestSave`, `flush`.
- Conditions: not readOnly. App store uses `saveEveryMs:1500` (`src/app/game.js:43`). Flush also runs on pagehide (`src/app/game.js:44`) and when the document becomes hidden (`src/app/game.js:560`).
- Consumes: `storage.getItem(key)`, `setItem(key-prev, old string)`, JSON.stringify of the whole save, `setItem(key, new string)`. Two full copies live in localStorage.
- Changes: localStorage `<key>` and `<key>-prev`; `saveFailed` flag.
- Rewards: durability; the prior good copy survives as `-prev`.
- Duration: a timer of `saveEveryMs` (1500 ms in the app) starts on the first dirty action; later actions join it. With `saveEveryMs` 0 (the default) it writes on every changing action.
- Dependencies: `globalThis.localStorage` or injected storage.
- Failures: exceptions are caught, `saveFailed=true`, returns false, play continues in memory. readOnly returns true without writing.

**Load save**
- Where: store.js:27 `createStore.load`.
- Conditions: runs at store creation and in reload. Order: main key, `<key>-prev`, legacy v1 keys, new save.
- Consumes: JSON.parse of the save; normalizeSave.
- Changes: if any region has `layout<LAYOUT_VERSION` (5), the raw save is copied once to `<key>-pre-layout5`. A save failing normalizeSave is copied once to `<key>-corrupt`, then `<key>-prev` is tried, then migrateLegacy (persisted at once), then `createSave(now())`.
- Rewards: a usable state in every path.
- Duration: synchronous at boot.
- Dependencies: normalizeSave, createSave, migrateLegacy, LAYOUT_VERSION.
- Failures: never throws to the caller; storage errors are caught and it falls through. Blocked storage runs in memory. Result is a fresh save if nothing parses.

**Reset / reload**
- Where: store.js:100 `createStore.reset`, `createStore.reload`.
- Conditions: reset is called from `src/app/game.js:449`. No caller of `store.reload` was found in src.
- Consumes: nothing in game terms (reset drops the save).
- Changes: reset copies the raw save to `<key>-backup`, removes key and `-prev`, sets `state=createSave(now())`, listeners get `[{type:'reset'}]`. Reload flushes, sets `state=load()`, listeners get `[{type:'reload'}]`.
- Rewards: none.
- Duration: immediate.
- Dependencies: createSave, load, flush.
- Failures: reset swallows storage errors.

**New save**
- Where: state.js:14 `createSave`.
- Conditions: no loadable save, or reset.
- Consumes: none.
- Changes: schema 3, rev 0; `story.phase` 'select' ('intro' if a character is passed); player `{coins:startCoins()=START.coins=60 because PLAYTEST.coins=0, xp:0, round:1}`; inventory `{beans:0, items:{dried:0,roasted:0,bag:0}}`; empty world, staff, gm (newGmState), research, supply, farmLab, rewards, loans, `debt.wages {gm:0,follower:0}`, `clock {played:0}`, `income {rows:[]}`, tasks, history; tutorial step 0 with done, farmDone, cafeDone all true; `tx []`, `nextUid 1`.
- Rewards: 60 coins.
- Duration: immediate.
- Dependencies: newGmState, newTasks, newHistory, startCoins.
- Failures: none.

**Normalize loaded save**
- Where: state.js:73 `normalizeSave` (normalizeGm:319, normalizeMoney:395, normalizeHistory:445, normalizeTasks:503, normalizeRegion:720).
- Conditions: raw is a plain object with `schema===3`.
- Consumes: rebuilds nearly every block.
- Changes: clamps coins [0,1e15], xp [0,1e12]; forces `player.round=1`; if `!EXPIRY_ENABLED` and phase is expiry, sets phase 'play' and expiry null; beanMix reset to all-Robusta when its sum differs from `inventory.beans`; layout migrations with coin refunds added to `player.coins`; legacy regions co-1 to br-3, it-1 to fr-1; drops regions with invalid ids; `ownedRegions` is the union of the saved list (legacy ids remapped) and the non-expired region records, with invalid ids dropped, so a saved entry stays even when its region is expired or has no record. Units: farmhand and sproutBot become crew trades through toCrew then crewTypeOf (farmhand `tasks[0]` water to waterer, plant to planter, harvest to picker, else alternates picker/planter; sproutBot task plant to plantBot, else harvestBot); unknown STAFF types dropped. `gm.unit.backlog` forced to 0; `gm.chaos=null`. Trims tx to 64, income.rows to 60, ledger to 30, daily to 30, history.rows to 400, tasks.open to 8, tasks.done to 50; expired cooldowns removed; old `s.loan` converted to `s.loans[]`; old `s.gm.requests` and poach become tasks; `wages.gm` zeroed without a GM and `wages.follower` zeroed without a follower.
- Rewards: layout-migration coin refunds (`nr.refund`). PLAYTEST top-up only when `PLAYTEST.coins>0` (currently 0).
- Duration: at load only. Not re-run during play.
- Dependencies: createSave, config tables, LEGACY_REGIONS, normalizeActive, withEstates.
- Failures: returns null when not an object or `schema!==3`; the store then falls back.

**Normalize / migrate a region**
- Where: state.js:720 `normalizeRegion`, `migrateLayout`.
- Conditions: any input; non-objects become `{}`.
- Consumes: nothing.
- Changes: layout 1 to 2 moves cafe buildings (+x -10, +z +100), B3 to C2. 2 to 3 removes B1-B5 lots and farm-side buildings. 3 to 4 fits buildings into lots (migrateFarmLots). 4 to 5 turns owned farm lots into fields with classic ids F1-1.. (6 each). Parcels completed by withEstates (state.js:714; home estate always added, owning any lot of an estate completes it). Plots kept only on existing field ids. The returned object has a fixed key list that does not include `r.tilled`.
- Rewards: refund coins for things that no longer fit (old lot costs B2 150, B3 800, B4 3000, B5 4500, or builtValue).
- Duration: instant, on load and in freshRegion.
- Dependencies: PARCELS, FIXED, BUILDINGS, ESTATES, plotsOf.
- Failures: none; invalid entries are filtered.

**Migrate v1 save**
- Where: `src/core/migrate.js:19` `migrateLegacy`.
- Conditions: `progress.version===1` or `player.gender` male or female.
- Consumes: nothing; old keys left untouched.
- Changes: new V3 save with `migratedFrom=1`. introCompleted gives phase teacher. `heaven.completed` or farm gives phase gate, teacherMet true. startCountry from startingRegion or farm.region. Tutorial set to `{step:0, done:false}` (migrate.js:42).
- Rewards: `coins = max(start, min(round(farm.coins), 50000))`; `xp = xpForLevel(min(9, legacyLevel(farm.xp)))` with table [0,0,30,80,150,250,380,540,740,980,1260].
- Duration: instant, once at load when no V3 save exists.
- Dependencies: createSave, EXPIRY_LEVEL 10, xpForLevel, COUNTRIES.
- Failures: returns null when nothing to migrate.

**Played clock tick**
- Where: game.js:2532 `handlers['clock/tick']`.
- Conditions: not gated by apply's prefix regexes. Internally needs `story.phase==='play'`, `world.currentRegion`, and clamped `ms>0`, else noop.
- Consumes: one full clone every tick; expiries can fine coins.
- Changes: if `!D.haulActive`, every `plot.pile` goes into beans and is deleted. If `now-clock.at >= TASKS.returnAwayMin` (5 min): returnGrace. `clock={played+d, at:now}`. Every unit and GM `tenurePlayedMin += d/60000`. GM: backlog decay (-1, or -2 when none of his requests is open, per 10 played min), waiting and training end checks, strike morale -1/min. Then remindDue, expireDue, settleGm; returnCap removed once played passes untilPlayed.
- Rewards: tenure; GM training completion (skill up, capped at 5 via `GM.thinkSeconds.length`).
- Duration: sent every `CLOCK.tickSeconds`=5 s of play; d capped at `CLOCK.maxTickMs`=30000.
- Dependencies: sender at staff.js:1294. CLOCK, TASKS, PENALTY.backlog, GM.
- Failures: noop only. With d>0 it always returns a new state: rev+1, save scheduled, listeners called.

**Loan tick**
- Where: game.js:2513 `handlers['loan/tick']`.
- Conditions: sent only when `state.loans` is non-empty.
- Consumes: one full clone per call, then discarded.
- Changes: nothing. Line 2514 returns noop; the overdue code after it is unreachable.
- Rewards: none.
- Duration: every `CLOCK.loanTickSeconds`=60 s of play.
- Dependencies: staff.js:1295.
- Failures: always `{noop:true}`; paused in phase expiry.

**Coin income**
- Where: game.js:102 `earn`.
- Conditions: internal; called by farm/sell family, prod/collect premium, served order (1270), venue sale (1296), gmAwayPay (304), gmRun sale bonus (233), dev/grant (2692). Not called for level gifts or loan principal.
- Consumes: while loans are open, `r2(amount*LOAN.autoRepay)` (0.2) goes to loans oldest first; then wage arrears.
- Changes: loan owed reduced, paid loans removed; `bookIncome(amount in full)`; `player.coins += amount minus loan cut`, rounded to 2 dp; `stats.earned += amount`; `payArrears(left)`.
- Rewards: coins. Emits loanRepaid when the last loan clears.
- Duration: instant.
- Dependencies: D.loansOf, LOAN.autoRepay, bookIncome, payArrears.
- Failures: none.

**Coin spend**
- Where: game.js:95 `spend`.
- Conditions: internal. No affordability check; the caller must check.
- Consumes: coins, floored at 0.
- Changes: `player.coins`; `bookIncome(0, actual amount removed)`.
- Rewards: none.
- Duration: instant.
- Dependencies: bookIncome. Loan repayments and refunds bypass it.
- Failures: none.

**Wage arrears payment**
- Where: game.js:124 `payArrears`.
- Conditions: `s.debt.wages.gm` or follower > 0, and income just arrived with left>0.
- Consumes: up to the amount just earned after the loan cut; GM first, then follower.
- Changes: spend under ACTOR 'staff'; wages reduced; ledger 'spent' cat 'wage'; GM: ledger `row.gm` and gmDay salary.
- Rewards: emits arrearsPaid `{who,coins,owed}`.
- Duration: instant.
- Dependencies: spend, ledger, gmDay.
- Failures: none.

**Income series booking**
- Where: game.js:84 `bookIncome`, `incomeRow`.
- Conditions: earned>0 or spent>0.
- Consumes: none.
- Changes: `s.income.rows` row for `D.playedMinute`: earned, spent, `by[ACTOR]` net. Also `histDay(s,ACTOR)` earned and spent for the real calendar day.
- Rewards: feeds D.I10, D.I30, incomeNetBy, gmProfitBetween.
- Duration: row key is the played minute. Trim is by row count: `INCOME.keepMinutes`=60 rows.
- Dependencies: D.playedMinute, histDay, INCOME.
- Failures: none.

**Team ledger**
- Where: game.js:779 `ledger`.
- Conditions: amount>0.
- Consumes: none.
- Changes: `s.staff.ledger` row keyed `floor(now/60000)` (wall minute, game.js:783, `BOOKS.ledgerKeep`=30 rows) and `s.staff.daily` keyed `D.dayKey(now)` (`PROFILE.teamDaysKeep`=30 rows). Tracks earned, spent, categories robot, upgrade, upkeep, wage, hire, research, and per-zone sub-objects farm and shop.
- Rewards: team report data.
- Duration: instant.
- Dependencies: BOOKS, PROFILE, D.dayKey.
- Failures: none.

**History row**
- Where: game.js:477 `hist` (histOf:471).
- Conditions: internal.
- Consumes: none.
- Changes: pushes `{id h<seq>, atPlayed, at, actor, group, type, zone, regionId, optional subject/cost/gain/taskId/extra/name/gm}` to `s.history.rows` (`HISTORY.rows`=400). Unless `type==='work'`, copies it into `u.recent` (`HISTORY.perUnit`=30) of actor and subject units; the manager is uid 'g1'.
- Rewards: log data.
- Duration: instant.
- Dependencies: HISTORY, D.playedMs, D.histGroupOf. journal and note (lines 732, 736) and gmLog (line 202) write through it.
- Failures: none.

**Per-day actor row**
- Where: game.js:493 `histDay`.
- Conditions: internal.
- Consumes: none.
- Changes: `s.history.days` row `{d,actor,jobs,earned,spent,mistakes,tasksDone,tasksExpired}`; keeps `HISTORY.days`=30 distinct days.
- Rewards: log data.
- Duration: real calendar day (`D.dayKey(NOW)`).
- Dependencies: D.dayKey.
- Failures: none.

**Work row folding**
- Where: game.js:750 `workRow`.
- Conditions: internal.
- Consumes: none.
- Changes: adds n to a row with same unit and task in the same `HISTORY.workBatchSec`=60 played-second slot, else creates a 'work' row. Scan stops at the first row outside the slot.
- Rewards: log data.
- Duration: 60 played seconds per slot.
- Dependencies: histOf, hist.
- Failures: none.

**Tombstone**
- Where: game.js:506 `tombstone`.
- Conditions: a unit or manager left.
- Consumes: none.
- Changes: `s.history.tombstones`, one per uid, `HISTORY.tombstones`=50 kept.
- Rewards: names stay readable.
- Duration: instant.
- Dependencies: histOf.
- Failures: none.

**GM runs one action**
- Where: game.js:216 `gmRun`.
- Conditions: `handlers[item.act.type]` exists; for staff/recruit with a name, the applicant is on today's board.
- Consumes: whatever the inner handler costs, tracked in `s.gm.careWin` (budget 'care') or `s.gm.window` (budget true).
- Changes: calls the handler directly on the same draft with `ACTOR='g1'`. Adds `gm.worked`, loyalty `+GM.mood.jobLoyalty`, book, day rows, lastJobAt; closes matching inbox tasks. `farm/sell*` adds a bonus via earn scaled by gmMoneyMul.
- Rewards: inner action's rewards; smart stat every `GM.smartEveryJobs` jobs.
- Duration: instant; caller cadence set by gm/think and gm/hands.
- Dependencies: handlers, D.applicants, GM config.
- Failures: returns false on missing handler, missing applicant, inner fail or noop. On inner fail only events are truncated (`ev.length=from`); draft edits made before the failure are not rolled back.

**Return grace**
- Where: game.js:333 `returnGrace`.
- Conditions: not already inside an open return (`rc && P<=rc.untilPlayed`). Called from clock/tick when wall gap >= 5 min, or from gmBack (line 345).
- Consumes: none.
- Changes: every open task gets `untilPlayed >= played+TASKS.graceMin` (2 min). With a GM: `s.gm.returnCap={untilPlayed:grace,lost:0}`.
- Rewards: emits tasksWaiting `{n,name}` when tasks are open.
- Duration: 2 played minutes.
- Dependencies: TASKS.graceMin, TASKS.returnAwayMin, D.tasksOpen, D.playedMs.
- Failures: returns false when the return is already open.

**Level-10 wipe**
- Where: game.js:2575 `handlers['expiry/execute']`, trigger in grantXp (line 57).
- Conditions: `s.story.expiry` exists. Not in PAUSABLE or the notPlaying regex. Unreachable by play: `EXPIRY_ENABLED=false`, and state.js:83 clears a saved pending expiry on load.
- Consumes: almost the whole save.
- Changes: coins to `startCoins` (`START.coins` 60), xp 0 (level 1), round 1; beans, beanMix, goods 0; units removed except optional follower (tombstones; stats and gear kept, unassigned, wage-paid); staff ledger, daily, upkeepAt, mvp, gearStock cleared; gm reset keeping board and licences; open tasks cancelled, cooldowns and fines cleared; history keeps 'plan' and 'approval' groups plus newest 50 others (`HISTORY.keepOthersOnWipe`); GM arrears; follower arrears unless kept; `s.income={rows:[]}`; rewards (claimed, tickets) reset; world.regions replaced by the expired record; `ownedRegions []`, freeUnlocks 0, currentRegion and mode null; `ex.snapshot`, `ex.status 'reset'`, `story.level10Done` true, phase 'chooseRegion', history row 'rebirth'. Untouched: `s.loans`, `s.clock`, `s.research`, `s.supply`, `s.farmLab`, `s.stats`, `s.rebirth`, `s.autoplay`, `s.tutorial`, `story.seen`, character.
- Rewards: follower kept if chosen; next region is free because ownedRegions is empty. Events followerKept, regionExpired.
- Duration: instant, two-phase: pending (cinematic) then execute.
- Dependencies: store.dispatch snapshot to `-pre-expiry`, HISTORY, newGmState, EXPIRY_LEVEL 10, FOLLOW.
- Failures: `fail('none')` with no expiry. Status 'reset' gives noop, so its phase assignment is discarded by apply.

**Who gets credited (actor)**
- Where: game.js:70 `actorOf`.
- Conditions: set by apply per action.
- Consumes: none.
- Changes: 'system' for clock/tick, loan/tick, rival/visit, rival/resolve, task/expire, gm/rivalVisit; 'staff' for gm/payroll, staff/upkeep, farm and shop actions with `payload.uid`, staff/care with `payload.by`; else 'player'. Overrides during an action: gmRun, planDay and the field-job loop in gm/hands set 'g1' (crew orders get it through gm/execute, which calls gmRun); payArrears and payroll settle set 'staff'; a fine sets 'penalty' (line 601).
- Rewards: decides `by[ACTOR]`, histDay rows and GM profit share (gmProfitBetween reads `by.g1`).
- Duration: the one synchronous action.
- Dependencies: SYSTEM_ACTIONS line 69.
- Failures: none.

### Engine facts

- Cost of one apply: a full deep copy of the entire save via structuredClone (JSON round-trip fallback), synchronous on the main thread, with no structural sharing and no dirty tracking. It happens after the gates and before the handler, so fail and noop calls pay the same price as real changes.
- What is copied, with config bounds: every visited region (plots, fields, buildings, shop orders, street); `staff.units` each with up to 30 `u.recent` and 7 `u.days` rows; `history.rows` up to 400; `history.days` up to 30 distinct days per actor; tombstones up to 50; `income.rows` up to 60; `staff.ledger` up to 30; `staff.daily` up to 30; `tasks.open` up to 8; `tasks.done` up to 50; `tx` up to 64; `gm.unit.recent` up to 30, `gm.days` up to 7, `gm.util.rows` up to 30, `gm.fm.log` up to 40. Clone cost grows with team size and regions visited.
- Every state-changing action also costs handler work plus, at most every 1500 ms, one JSON.stringify of the full save and two localStorage writes. The save occupies double its size in localStorage.
- Handlers registry: module-private const at game.js:906, names exported only via ACTIONS (line 2716). 126 keys by prefix: staff 29, gm 28, farm 14, shop 12, build 4, supply 4, task 5, land 3, loan 3, story 3, dev 3, farmlab 2, prod 2, rebirth 2, rival 2, play 2, world 2, research 1, character 1, clock 1, expiry 1, level 1, tutorial 1.
- Handlers calling handlers directly (lines 368, 452-453, 990, 993, 1701, 1717, 1969, 2118, 2252, 2324-2325, plus gmRun) share the same draft: no extra clone, and they bypass all apply gates (paused, notPlaying, cafeClosed) and txId checks.
- PAUSABLE covers prefixes farm, shop, build, land, prod, staff, rival, round, country, rebirth, level, loan. No handler exists with prefix round or country. The only 'expiry' phase assignment is game.js:59, guarded by `EXPIRY_ENABLED=false`, and normalizeSave clears a stored one, so 'paused' cannot fire on a normal save.
- The notPlaying regex omits loan, level, rebirth, world, story, character, tutorial, play, dev, expiry and clock. apply does not stop those outside phase 'play'. clock/tick has its own internal check.
- Two time bases coexist. Played: `s.clock.played` (ms) drives income rows, `history.atPlayed`, task deadlines, cooldowns, tenure, GM plan and training, GM think turn number. Wall (`ctx.now`): `s.clock.at`, `s.staff.ledger` and daily, `u.days`, histDay, `gm.days`, `gm.window` (growth budget), `gm.payAt`, supply scouts and pending, `s.staff.upkeepAt`. Crop timing uses plantedAt with ctx.now.
- Coins earned while the played clock is stalled book into the current played minute row. Rows exist only for minutes in which coins moved; the 60 limit counts rows, not minutes, while D.incomeRows filters by minute index.
- `D.incomeSum` floor: `max(INCOME_FLOOR 0.3 x I(L) x minutes, earned)`. I10 uses `INCOME.shortMin`=10, I30 uses `longMin`=30.
- `INCOME.actors` = player, g1, staff, penalty, system; normalizeMoney drops any by-key outside this list.
- Grant paths that bypass earn and bookIncome (not income, no loan cut): grantItems coins (line 147), refunds (lines 1374, 1829), loan/take principal (line 2486).
- `store.dispatch` passes `ctx={now,dev}` only, so rebirth/addCredits with source 'receipt' always fails 'unverified' through the store (game.js:2650 needs `ctx.verifiedReceipt`).
- `setReadOnly` has no caller in src, so readOnly stays false in the app.
- `TX_KEEP`=64 at game.js:18; normalizeSave hardcodes 64 too (state.js:215). A noop action with a txId is not recorded in tx.
- `loanTerm` and `termMin` are still computed and stored on new loans (game.js:2484) though nothing reads them for lateness.

---

## 2. Crops

**farm/plant**
- Where: game.js:960 `handlers['farm/plant'](s,{plotId,crop='robusta',crooked=false,uid})`.
- Conditions: play gate (game.js:2731). Region exists and region mode is not cafe (otherGame). plotId is a field of this region (D.plotOf, `region.fields` only; plotById of static classic ids only chooses the error code). Field has no tree. D.cropUnlocked: the crop id only has to exist in CROPS; no level, round or terrace check. Coins >= D.seedCost.
- Consumes: D.seedCost coins (derive.js:415): robusta 15, arabica 35, liberica 30. Robusta costs 0 while graceActive (`GRACE.freeCrop='robusta'`).
- Changes: `r.plots[plotId]={crop,plantedAt:now,born:now,n:0}`. Adds `method[]` when the adopted way differs from `FARMLAB.defaultMethod`. `crooked===true` sets `slow:true` and tallies a unit mistake. Sets `fast:true` when `stats.harvested` is 0 and neither `tutorial.done` nor `tutorial.farmDone`. `stats.planted++`. `practice(unit,'plant')` when uid is given.
- Rewards: a sapling. No XP at planting. Event planted.
- Duration: instant action. First crop is plotGrowMs with n=0: growSeconds (60/120/240 s) x 1000 / speedOf, then x method timeMul x zone timeMul x garden timeMul x drip 0.7 (unwatered and drip-covered) x 1.1 if slow. fast: `min(TUTORIAL.firstGrowSeconds=4 s, base)`. `speedOf = 1 + staffBonus growSpeed + blessing grow + wellBonus`.
- Dependencies: field must exist (farm/plantAt or build/place). Terrace affects only time and stars through CLIMATE_EFFECT, read later.
- Failures: unknown (no region or no such field), gameLocked, notOwned (classic plot id not placed here), occupied, locked (crop id not in CROPS), coins `{missing}`. From apply: notPlaying, unknownAction.

**farm/plantAt**
- Where: game.js:983 `handlers['farm/plantAt'](s,{x,z,crop='robusta'})`.
- Conditions: region exists. D.cropUnlocked. Coins >= `D.buildCost('field')` (always 0) + D.seedCost. Then build/place('field') must pass: D.buildError and D.placementError (derive.js:455). The terrace at the point must be on an owned estate, the footprint flat (height spread <=0.25 m) and inside one tier, with no overlap on fields or buildings.
- Consumes: field 0 coins + seed cost.
- Changes: pushes `r.fields {id:'fd'+uid,x,z}` snapped, then runs farm/plant on it. If planting fails, `r.fields` is truncated and coins restored.
- Rewards: `FIELD.xp`=2 through `firstBuildXp(r,'field')` each time the field count exceeds `r.peak.field` (nothing when re-placing at or below the peak), plus the farm/plant result. Events fieldPlaced, planted.
- Duration: instant. Growth as farm/plant.
- Dependencies: estate of that tier owned (land/buyParcel). Handler calls build/place (game.js:990) then farm/plant (993).
- Failures: unknown, locked, coins `{missing}`, gameLocked. From build/place: outside, notOwned, mountain, onField, overlap. From farm/plant: its codes.

**build/place (field branch)**
- Where: game.js:1320 `handlers['build/place'](s,{type:'field',x,z})`.
- Conditions: D.buildError('field'): region mode not cafe, coins >= 0. D.placementError: FIELD footprint 0.5 x 0.5 cells (1 x 1 m with CELL 2) inside BOUNDS, tierZoneAt centre belongs to an owned estate, ground spread <=0.25 m across 5 sample points, all samples in the same tier zone, no overlap. Roads and lot edges are allowed.
- Consumes: 0 coins (derive.js:295 `fieldCost=()=>0`).
- Changes: `r.fields` push; id `fd<nextUid>`; snapped to 0.1 m.
- Rewards: `FIELD.xp`=2 each time the field count sets a new `r.peak.field` (firstBuildXp); nothing when re-placing at or below the peak. Event fieldPlaced `{plotId,cost}`.
- Duration: instant.
- Dependencies: estate ownership of the tier under the point.
- Failures: unknown, gameLocked, outside, notOwned, mountain, onField, overlap.

**farm/harvest**
- Where: game.js:998 `handlers['farm/harvest'](s,{plotId,unripe=false,uid})`.
- Conditions: tree exists (`D.own(r.plots,plotId)`). `plotState.stage==='ready'` (elapsed >= plotGrowMs). `D.stored < D.capacity`. No otherGame check in this handler.
- Consumes: nothing, except `BUILDINGS.dripLine.effect.fee` (1) coin if a drip line covers the field and coins are enough.
- Changes: `plantedAt=now`, `born??=plantedAt`, delete fast and watered. Liberica first pick: `pl.wave=remainder`, n unchanged, trimmed and sprayed kept. Otherwise delete wave, slow, trial, pruned, trimmed, sprayed and `n+1`. `stats.harvested++`. Beans go to inventory via addBeans, or to `pl.pile` if a unit harvested and D.haulActive. Trial fields write `farmLab.results` and clear the trial. Unit: unitEarned (beans x beanPrice), practice, mistake tally if unripe.
- Rewards: stars = clamp 1..3 of `(unit ? unitStars : fresh ? 3 : 1)` + 1 if `luck < min(1, method quality + garden.quality)` + zone stars + shadeStars. `fresh = overMs <= freshSeconds (30/10/600) x 1000 x garden.freshMul`. Beans: `max(1, round(starYield x method yieldMul x garden.yieldMul) - unripe 1)`; then `max(1, that - dropped - lonely) + trimmed + sprayed (+1)`; old tree `max(1, round(x0.5))`; Liberica first pick `max(1, round(x0.6))`. dropped (Arabica) = `overMs>30000 ? 1+floor((overMs-30000)/20000) : 0`. XP crop.xp (2/4/6) via grantXp; 0 on Liberica's first pick. Events harvested, trialDone.
- Duration: instant action. Next season: cycleSeconds 36/80/150 s under the same multipliers. Liberica second pick: `waves.regrowSeconds` 45 s / speedOf x the same multipliers.
- Dependencies: stage ready. Storage room. Terrace stars from climateOfPlot (tierZoneAt). Shade tree or cordia in radius for Arabica. Trim and spray from crew. Garden from the region's country.
- Failures: empty, notReady `{remainingMs}`, storageFull `{capacity}`.

**farm/prune (cut back old tree)**
- Where: game.js:1050 `handlers['farm/prune'](s,{plotId,uid})`.
- Conditions: tree exists. Mode not cafe. D.treeOld (n >= life: robusta 6, arabica 6, liberica 8). Stage not ready. Coins >= pruneCost.
- Consumes: `D.pruneCost = round(seedCost x 0.6)`: robusta 9, arabica 21, liberica 18.
- Changes: `n=0`, `pruned=true`, `plantedAt=now`, `born??=plantedAt`, delete wave and watered. `practice(unit,'prune')` when uid is given.
- Rewards: tree young again (no 0.5 yield). Event pruned.
- Duration: instant action. Regrow = establishMs x `PERENNIAL.pruneGrow` 0.6 = 36/72/144 s at speed 1, then the plotGrowMs multipliers.
- Dependencies: enough harvests to be old. A ripe old tree must be harvested first.
- Failures: empty, gameLocked, notOld, ripe, coins `{missing}`.

**farm/trim (light pruning)**
- Where: game.js:1066 `handlers['farm/trim'](s,{plotId,uid})`.
- Conditions: tree exists. Unit has job 'prune' (doesJob). A uid is required; the player cannot trim directly.
- Consumes: nothing.
- Changes: `pl.trimmed=trimBeansOf(unit)`. `practice(unit,'prune')`.
- Rewards: +trimBeansOf beans at this season's harvest: `CREW.trimBeans` 1, +1 for a non-bot unit with accuracy >=4 (`CREW.accuracy.trimTwoFrom`). Event trimmed.
- Duration: instant. Lasts until the season's final pick clears it. Once per season.
- Dependencies: pruner or TrimBot unit.
- Failures: unknown. Noop if already trimmed or stage ready.

**farm/spray**
- Where: game.js:1075 `handlers['farm/spray'](s,{plotId,uid})`.
- Conditions: tree exists. Unit has job 'spray'. Not already sprayed. Stage not ready. Coins >= `CREW.sprayFee` 1.
- Consumes: 1 coin (booked with unitSpent).
- Changes: `pl.sprayed=true`.
- Rewards: +`CREW.sprayBeans` 1 bean at harvest. Event sprayed.
- Duration: instant. Once per season.
- Dependencies: unit with the spray job.
- Failures: unknown, coins `{missing}`. Noop if already sprayed or stage ready.

**farm/uproot**
- Where: game.js:1113 `handlers['farm/uproot'](s,{plotId})`.
- Conditions: tree exists. Mode not cafe. Any age or stage.
- Consumes: the tree. No refund.
- Changes: `pl.pile` beans go to inventory via addBeans. `delete r.plots[plotId]`. The field stays.
- Rewards: empty field ready for another variety. Event uprooted.
- Duration: instant.
- Dependencies: none.
- Failures: empty, gameLocked.

farm/water is in section 6.

### Crop facts

- Real crop unlock: all three crops are plantable from level 1. derive.js:169 `cropUnlocked = !!own(CROPS,cropId)`. `CROPS.level` (robusta 1, arabica 3, liberica 5) and `CROPS.round` are read only by `hud/sheets.js:459` levelUnlocks, the level-up banner.
- Terraces do not restrict crops for the player: no zone check in farm/plant or farm/plantAt, and economy.js:150 says no zone forbids a crop. Terrace gives only timeMul and stars (CLIMATE_EFFECT).
- Soft restriction for AI only: `farm-manager.js:46` legalCrops drops 'bad' crops unless only bad ones exist. derive.js:1306 pickCropFor filters by fit only when `s.gm?.unit` exists and the preferred crop is not usable.
- Terraces restrict where fields go: placementError returns notOwned unless the estate of tierZoneAt is owned.
- CROPS (seedCost / growSeconds / cycleSeconds / life / beans / xp / price / freshSeconds): robusta 15/60/36/6/3/2/2/30; arabica 35/120/80/6/2/4/7/10 with drop `{after:30,every:20}`; liberica 30/240/150/8/4/6/3/600 with waves `{first:0.6,regrowSeconds:45}`. isHardCrop = arabica and liberica.
- PERENNIAL: oldYield 0.5, pruneCost 0.6, pruneGrow 0.6. QUALITY: yield [1,1,1.25,1.5] by stars, price [1,1,1.2,1.5], freshSeconds 10, workerTwoStar 3.
- starYield at yieldBonus 0 for 1, 2, 3 stars: robusta 3/4/5, arabica 2/3/3, liberica 4/5/6.
- GARDEN (by country id, `slice(0,2)` of region): forest timeMul 1.2, yieldMul 0.9, freshMul 1.5, quality 0.35 (et, ke, ug, tz, rw, bi, ci, za); shade 1.08, 1, 1.2, 0.15 (default); sun 0.9, 1.15, 0.8, 0 (br).
- CLIMATE_EFFECT: arabica lowland x1.35 -1 star, upland x1.15, highland x0.9 +1 star, slope neutral. robusta upland x0.9, highland x1.3 -1 star, lowland and slope neutral. liberica lowland x0.9 +1 star, slope x1.2, highland x1.4 -1 star, upland neutral.
- climateFit result: arabica lowland bad, upland bad (timeMul>1), slope ok, highland good. robusta lowland ok, upland good, slope ok, highland bad. liberica lowland good, upland ok, slope bad, highland bad.
- ESTATES: home lowland cost 0 level 1 seed F1 (F1,Y0,F2,F5,F6,W1,D1,F13,F14); upland 1500 level 3 seed F3 (F3,F4,F7-F12); slope 6000 level 5 seed F15 (F15,F16,P1,P2,F17,F18,W2,W3,PD1,O1); highland 18000 level 8 seed P3 (P3,P4,G1,O2,W4,W5,H1). Order: home, upland, slope, highland.
- FARM_TIERS height m: lowland 0, upland 2.2, slope 4.4, highland 6.6. TIER_EDGES: z -2.5 (h 2.2), z -20.5 (h 4.4), z -51.5 west / -46.5 east for x>0 (h 6.6). tierIndexAt returns 0..3 and tierZoneAt the zone name. North is -z. Every estate lot rect checked falls inside the tier of its `ESTATES.zone`, so climateOfLot and tierZoneAt agree for points inside lots.
- Cuttings: TIER_CUTS ramp x 0 (half 1.5, length 8.5) and steps at x +-15 (half 1.05, length 6). farmRouteDist goes tier by tier through the best cut.
- plotState: stage 'ready' at ratio>=1, 'planted' at ratio<0.08, else 'growing'; 'empty' if no tree. Also returns age=n, old, young(n===0).
- plotNeeds priority: ready, then prune (treeOld), then thirst (growing, unwatered, ratio>=0.5), else null. A drip-covered unwatered field still returns thirst because the function does not check dripCovers.
- plotGrowMs order: wave regrow if `p.wave`, else growMs if n>0, else establishMs (x0.6 if pruned); then x method x zone x garden x drip x slow 1.1; `p.fast` overrides to min(4 s, base). wellBonus is added inside speedOf (`BUILDINGS.well.effect.grow` 0.15..0.3, radius 6..10, best well only).
- treeOld = n>=life. n increments only on a season's final pick. The old check runs before n increments, so the harvest that reaches life is still at full yield.
- shadeStars: +1 star for Arabica within radius of shadeTree (7 m) or cordia (6 m). The crop list and star value come from `BUILDINGS.shadeTree.effect`.
- pollinate: no CROPS entry defines it, so D.pollinated returns true and 'lonely' in farm/harvest is always 0.
- autoTill (game.js:842-843) begins with return, so buying an estate creates no fields and level-ups till nothing. `FIELD.extraBase` pricing is bypassed because fieldCost and fieldRefund are constant 0.

---

## 3. Land and buildings

**land/buyParcel**
- Where: game.js:1430 `handlers['land/buyParcel'](s,{parcelId})`.
- Conditions: play gate. `D.parcelError(s,parcelId)` null. Any lot id of an estate buys the whole estate. Estate must be nextEstate (order home, upland, slope, highland). `ESTATES[].level` is not checked. No region-mode check, so estates can be bought in a cafe-mode region and C2/C3 in a farm-mode region.
- Consumes: coins via spend. `D.parcelCost(id)` = estate cost (upland 1500, slope 6000, highland 18000; home 0 and always owned) or PARCELS cost for cafe lots C2 500, C3 1400. spend floors coins at 0 and books `income.spent`.
- Changes: `region.parcels` gets all estate lots (or the single cafe lot); `s.stats.parcels+1`; `player.xp`. autoTill is called but returns immediately (game.js:843), so `region.tilled` and `region.fields` do not change. addPreTilled runs only for non-estate lots (only C2/C3, kind shop, yields 0).
- Rewards: `XP.buyLand` 6 (x D.xpMultiplier). Estate tier becomes placeable. Roads open through roadOpen (owned lot lists or touches them). Zero fields granted: event parcelBought.fields is 0. Events parcelBought, roadsOpened if any.
- Duration: instant in the reducer (0 s, no timer). Manager purchases are queued as gm.orders with job 'expand' (D.orderJob:1792) and carried out by a crew unit.
- Dependencies: D.parcelError, parcelCost, openRoads; layout ESTATES, estateOfLot; state.withEstates on normalize.
- Failures: owned returns noop; unknown; order; coins `{missing}`; notPlaying; unknownAction. Branch `err==='level'` at game.js:1434 is dead.

**land/sell**
- Where: game.js:1451 `handlers['land/sell']`.
- Conditions: play gate plus `D.landSellError` null. In practice can never pass: all 34 farm lots belong to an estate (9+8+10+7), so an owned farm lot returns 'starter' (F1, Y0) or 'estate'; cafe lots return 'unknown'.
- Consumes: the lot and its plots and fields (would).
- Changes: would remove the lot from `region.parcels`, matching `r.fields` and `r.plots`, `gm.plan.crops[parcelId]`, and write history landSold. Unreachable with current data.
- Rewards: would refund `D.landSellRefund = floor(LAND.sellRefund 0.6 x PARCELS[id].cost)`, added directly to coins (not income). Uses lot cost, not estate cost.
- Duration: instant (0 s).
- Dependencies: D.landSellError (1426), landSellRefund (1436), economy LAND `{sellRefund:0.6, sellPaybackMin:40}`.
- Failures: unknown; notOwned; starter; estate; last and buildings are unreachable because the estate check returns first for every farm lot; notPlaying.

**build/place**
- Where: game.js:1320 `handlers['build/place']`.
- Conditions: play gate; D.buildError null (exists, not starter, not retired, region mode matches zone, barn present and housing free for animals, coins >= buildCost); then D.placementError null at the snapped position. No level, round or count gate.
- Consumes: coins `D.buildCost`: `round(def.cost x costGrowth^(copies in this region) / 5) x 5`. Fields cost 0.
- Changes: field: pushes `{id 'fd...',x,z}` to `r.fields`, event fieldPlaced. Building: pushes `{uid,type,x,z,rot,level:1,spent:cost}` to `r.buildings`, `stats.built+1`, event built. firstBuildXp updates `r.peak[type]`.
- Rewards: XP only when copy count exceeds `r.peak[type]`: `def.xp ?? XP.build` (10); `FIELD.xp` 2. Otherwise the building's effect.
- Duration: instant (0 s). No construction timer. Manager orders use job 'build', 'openField' or 'livestock' (D.orderJob).
- Dependencies: D.buildError, snapPosition (fields 0.1 m, others 0.5 m SNAP), placementError, buildCost, defOf; rot4; farm/plantAt calls this handler for type 'field' (game.js:990).
- Failures: from buildError: unknown, gameLocked, needBarn, barnFull, coins `{missing}`. Farm placement: unknown, outside, notOwned, mountain, onField, overlap. Cafe placement: onRoad, blocked, edge, outside, wrongZone, notOwned, terrain_*, onField, overlap. The noAccess check (derive.js:491) is unreachable. notPlaying. The `err==='limit'` branch at line 1322 is dead.

**build/move**
- Where: game.js:1343 `handlers['build/move']`.
- Conditions: play gate. Id is a field in `r.fields` or a building uid. Building must not be `def.fixed`. New spot passes placementError with ignoreId. No check on running jobs or retired flag.
- Consumes: nothing.
- Changes: field x,z (crop stays, keyed by field id). Building x,z,rot (rot4).
- Rewards: none. No XP.
- Duration: instant (0 s).
- Dependencies: D.snapPosition, placementError.
- Failures: unknown; fixed; any placementError code; field at same position returns noop (buildings have no noop and emit moved); notPlaying.

**build/remove**
- Where: game.js:1367 `handlers['build/remove']`.
- Conditions: play gate; D.removeError null. Field: no crop entry in `r.plots`. Building: not starter, not fixed, `def.refund>0`, no `b.job`, and if it has capacity then stored <= capacity minus this building's capacity.
- Consumes: the building or empty field.
- Changes: splices from `r.fields` (and deletes `r.plots[id]`) or `r.buildings`; coins += refund, not booked as income (no XP, no loan cut). `r.peak` is kept.
- Rewards: building `floor(def.refund x spentOn(b))`; refund is 0.5 for every farm type, spentOn = `b.spent` or `def.cost` + upgrades paid. Field: D.fieldRefund returns 0 always.
- Duration: instant (0 s).
- Dependencies: D.removeError (588), removeRefund (602), spentOn (582), fieldRefund (297).
- Failures: unknown; fixed; fieldBusy; jobBusy; storageFull; notPlaying.

**build/upgrade**
- Where: game.js:1377 `handlers['build/upgrade']`.
- Conditions: play gate; building exists in current region; D.upgradeError null: not `def.decor`, level within upgrade list, coins >= cost. No level, round, mode, job or retired check, so retired types in old saves can upgrade and a building with a running job can upgrade.
- Consumes: coins `D.upgradeCost = def.upgrade[level-1]`.
- Changes: `b.spent = spentOn(b)+cost`; `b.level+1`; `stats.upgraded+1`.
- Rewards: `XP.upgrade` 8 (x xpMultiplier). Effects read by level through pick (clamped to array length). A running batch keeps its original duration and outputs.
- Duration: instant (0 s). Manager orders use job 'build'.
- Dependencies: D.upgradeError (719), upgradeCost (715), spentOn.
- Failures: unknown; maxLevel (decor or end of list); coins `{missing}`; notPlaying.

**Pure checks (no consumption, no changes, no rewards, no duration)**

- parcelError. Where: derive.js:730. Conditions: pure. Consumes, Changes, Rewards, Duration: none. Dependencies: own(PARCELS), region, estateOfLot, nextEstate. Failures: returns unknown, owned, order, coins, or null; never 'level'; `ESTATES[].level` is not read.
- nextEstate. Where: derive.js:194. Conditions: pure. Consumes, Changes, Rewards, Duration: none. Dependencies: ESTATE_ORDER; estateOwned (192): every lot of the estate is in `r.parcels`. Failures: returns first unowned estate or null.
- placementError. Where: derive.js:455. Conditions: farm branch applies to type 'field', zone 'farm', and zone 'any' at farm coordinates. Checks in order: BOUNDS (x -32..32, z -76..28); tier of footprint centre must be an owned estate (tierSign exempt); 5 sample points (4 corners and centre) must differ in ground height by <=0.25 and share one tier; no overlap with fields; no overlap with buildings. Roads, lot edges and terrain are not checked in this branch. Consumes, Changes, Rewards, Duration: none. Dependencies: footprint (size x CELL 2), tierZoneAt, farmGroundY, estateOwned, lotContaining (cafe branch), lotAllows, cutsAccess. Failures: farm: unknown, outside, notOwned, mountain, onField, overlap. Cafe: onRoad, blocked, edge, outside, wrongZone, notOwned, terrain_*, onField, overlap. noAccess is unreachable: it requires a non-cafe lot in the second branch, but fields and farm-zone items return from the first branch, a shop-zone item on a non-cafe lot returns wrongZone, and a zone-any item enters the second branch only at z>=82, where no farm lot exists. placementWarning (449) returns soft 'blocked' for RESERVED overlap (gate plaza).
- buildError. Where: derive.js:566. Conditions: pure. Consumes, Changes, Rewards, Duration: none. Dependencies: defOf, buildCost, housingOf (565). Failures: unknown (no def, starter, retired); gameLocked (cafe mode + zone farm, or farm mode + zone shop); needBarn; barnFull (animals >= housingOf); coins. Never limit, level or round.
- buildCost. Where: derive.js:558. Conditions: pure. Consumes, Changes, Rewards, Duration: none. Dependencies: defOf, countOf (region-scoped), fieldCost. Failures: unknown type returns 0. Field returns 0. Otherwise `round(cost x (costGrowth||1)^count / 5) x 5`.
- upgradeCost. Where: derive.js:715. Conditions: currentLevel between 1 and upgrade.length. Consumes, Changes, Rewards, Duration: none. Dependencies: `BUILDINGS[type].upgrade`. Failures: returns null outside range.
- upgradeError. Where: derive.js:719. Conditions: pure. Consumes, Changes, Rewards, Duration: none. Dependencies: upgradeCost. Failures: unknown (no building); maxLevel (`def.decor` or cost null); coins; null.
- fieldCost. Where: derive.js:295. Conditions: none. Consumes, Changes, Rewards, Duration: none. Dependencies: none; `FIELD.extraBase`, extraGrowth, extraPerLevel, extraMax and fieldExtraCost are not used by it. Failures: always returns 0.

### Building data

All farm types have refund 0.5 unless noted. Sizes are in cells (CELL 2 m).

| Type | Category and flags | Cost, costGrowth | Limit field (not enforced) | Size | Upgrades | Effect by level |
|---|---|---|---|---|---|---|
| silo | storage, level 1 | 100, 1.35 | 99 | [1.9,1.6] | 60,220,600,1400,3000,6000,12000 | capacity 40,70,110,160,220,300,400,520 |
| dryer | processing, level 1, recipe dry | 120, 1.6 | [[1,1],[4,2],[7,3],[12,4],[18,5]] | [1.5,.5] | 200,500,1100,2400,4800,9600,19200 | speed 1,1.25,1.25,1.5,1.5,1.75,1.75,2; batch 1,1,2,2,3,3,4,4 |
| wetMill | processing, level 1, recipe wash | 220, 1.6 | [[1,1],[6,2],[10,3]] | [2,1] | 300,700,1500,3200,6400,12800,25600 | same speed and batch as dryer |
| roastery | RETIRED, processing, level 4, recipe roast | 300, 1.6 | [[4,1],[6,2],[9,3],[14,4]] | [1.5,1.5] | 400,900,2000,4000,8000,16000,30000 | same speed and batch as dryer |
| packer | RETIRED, processing, level 6, recipe pack | 700, 1.7 | [[6,1],[9,2],[16,3]] | [1.5,1.25] | 800,1800,3600,7000,13000,24000,40000 | same speed and batch as dryer |
| dripLine | processing, level 1, xp 5 | 180, 1.5 | 6 | [3,1] | 120,300,700,1500 | radius 12,14,16,18,20; fee 1 (charged at harvest, game.js:1030) |
| pulper | processing, level 1, xp 5 | 350, 1.5 | 2 | [1.4,1.4] | 250,600,1300,2800 | timeCut 0.3,0.35,0.4,0.45,0.5; radius 12,12,14,14,16; fee 1 (added to batch fee in reach, recipeIOFor derive.js:625; best cut applies) |
| motorbike | processing, level 1, xp 5 | 120, 1.5 | 1 | [1.8,.8] | 100,250,600,1200 | load 6,8,10,12,14; tripFee 1 |
| tillerCart | processing, level 1, xp 5 | 450, 1.5 | 1 | [3.4,1.5] | 350,800,1800,3600 | load 14,18,22,26,30; tripFee 2 |
| farmTruck | processing, level 1, xp 5 | 1500, 1.5 | 1 | [2.2,5] | 1000,2200,4500,9000 | load 30,38,46,54,64; tripFee 6 |
| warehouse | RETIRED, storage, level 3 | 150, 1.5 | [[3,1],[5,2],[7,3],[9,4],[13,6]] | [1.9,1.6] | 150,350,800,1600,3200,6400,12000 | capacity 30,45,65,90,120,160,210,270 (still counted for old saves) |
| well | infrastructure, level 1 | 200, 1.5 | [[1,1],[5,2],[7,3],[9,4]] | [1,1] | 250,600,1400,3000,6000,12000,24000 | grow 0.15,0.15,0.2,0.2,0.25,0.25,0.3,0.3; radius 6,7,7,8,8,9,9,10 |
| shadeTree | infrastructure, decor, walkable, level 2, xp 4 | 90, 1.25 | [[2,2],[4,4],[6,6],[9,9]] | [1,1] | none | radius 7, stars 1, crops [arabica] |
| cordia | infrastructure, decor, walkable, level 1, xp 4 | 110, 1.2 | 99 | [1,1] | none | radius 6, stars 1, crops [arabica] |
| tierSign | RETIRED, decoration, level 1, xp 0 | 0 | 0 | [1,1] | none | no refund, no effect; build/place returns unknown; placement ghost only |
| barn | livestock, use decor, no decor flag, level 1, xp 6 | 180, 1.15 | 6 | [2,2] | 200,450,900,1800 | housing 8,10,12,15,18 |
| chickenCoop | livestock, animal, level 1, xp 3 | 60, 1.15 | 12 | [.6,.6] | 40,90,180,360 | size 1,1.1,1.2,1.3,1.4 |
| rooster | livestock, animal, level 1, xp 3 | 70, 1.15 | 12 | [.6,.6] | 40,90,180,360 | size 1,1.1,1.2,1.3,1.4 |
| cow | livestock, animal, level 1, xp 6 | 240, 1.15 | 8 | [1.2,1.2] | 180,400,800,1600 | size 1,1.1,1.2,1.3,1.4 |
| goat | livestock, animal, level 1, xp 5 | 150, 1.15 | 10 | [.9,.9] | 100,220,450,900 | size 1,1.1,1.2,1.3,1.4 |
| farmDog | livestock, animal, level 1, xp 3 | 90, 1.15 | 3 | [.8,.8] | 70,160,320,640 | size 1,1.1,1.2,1.3,1.4 |
| enset | decoration, decor, walkable, level 2, xp 3 | 35, none | 12 | [1,1] | none | none |
| flowers (zone any) | decor, walkable, level 2, xp 3 | 25, none | 12 | [1,1] | none | none |
| plant (zone any) | decor, walkable, level 2, xp 3 | 30, none | 12 | [1,1] | none | none |
| lamp (zone any) | decor, solid, level 3, xp 4 | 40, none | 12 | [1,1] | none | none |

### Land facts

- The limit field is not enforced. maxCount (derive.js:541) returns 9999 for every type. buildError has no limit branch; its comment at line 572 says no level, round or count gates. limit is read only by nextLimitLevel (548, via limitAt 534), which is called only on `err==='limit'` (game.js:1322, sheets.js:50,70, action-bar.js:96, feedback.js:43), and that error is never produced. tierSign limit 0 is blocked by retired, not by limit.
- `BUILDINGS` level and round are not enforced for placement. UI branches for err 'level' and 'round' (sheets.js:69,85,86) are dead.
- Max building level = upgrade.length + 1. upgradeError does not read ROUND_LEVEL_CAP (all 8).
- Build cost rounds to 5 and counts copies in the current region only; removing a copy lowers the next price.
- `D.capacity` = STORAGE_BASE 30 + sum silo + sum warehouse. silo is not a starter.
- RECIPES: dry 12 beans to 12 dried, 30 s, fee 0, xp 1, premium 1 (dryer). wash 12 beans to 12 dried, 20 s, fee 2, xp 2, premium 1.5 (wetMill). roast 12 dried to 9 roasted, 45 s, fee 3, xp 2 (roastery). pack 9 roasted to 3 bags, 40 s, fee 2, xp 2 (packer). in, out, fee and xp all scale with batch.
- `derive.haulVehicle` uses the single vehicle with the largest load.
- FIELD: zone farm, use field, size [.5,.5] (1 x 1 m), cost 0, xp 2, refund 0.5, extraBase 60, extraGrowth 1.3, extraPerLevel 2, extraMax 40. Runtime price is always 0 and refund always 0.
- BUILD_MENU_FARM (economy.js:304): wetMill, dryer, pulper, dripLine, motorbike, tillerCart, farmTruck, silo, well, shadeTree, cordia, enset, flowers, plant, lamp, barn. Animals are not in it.
- Owned tier is decided by `tierZoneAt(x,z)` from z edges (-2.5, -20.5, -51.5 west / -46.5 east), not by lot rects, so farm-branch placement covers the whole band out to BOUNDS, including roads and non-lot ground.
- land/openRoad (game.js:1464) cannot succeed: roadError returns only unknown, owned or 'road' (derive.js:745). Roads open only through owned lots.
- XP constants: `XP.build` 10, `XP.upgrade` 8, `XP.buyLand` 6, `XP.openRoad` 4. grantXp multiplies by D.xpMultiplier and rounds.

---

## 4. Staff

**Job selection tick (farm)**
- Where: staff.js:1412 `update`, `farmJob`, `maybeGoof`, `startJob`.
- Conditions: not paused (isPaused false, story.phase play, currentRegion set); `e.working` (active and !unitBlocked); `!e.stopped`; `e.job` null; `e.think<=0`. Priority in farmJob:646: gm orders (takes(o.job), claim free; openField skipped if >=4 empty plots), process, haul, harvest (storage room), plant, water, prune, spray.
- Consumes: nothing.
- Changes: realm only: `e.job`, claims Map (plot:, station:), `e.reason`, `e.reasonMs`, `e.think`.
- Rewards: none.
- Duration: search interval `e.think`: THINK .35 s after a search that found a job; if nothing found on farm `FARM_MANAGER.idleThink` 1 + rand*.5 s (line 1419). Post-job delay: harvest and goof keep the .35 s; plant 1.2 s unless robot or smart>=4 then 0; water, prune, spray, process, execute, haul 0; stuck abort 0.
- Dependencies: ownedPlots, plotState (memo 250 ms), stored and capacity, gm.tiers (homeOnly field jobs; homeFirst haul), near(): farmRouteDist + CROWD_COST 5 m per busy unit within CROWD_R 3 m + TIER_AWAY 40 m off tier - min(ageCapM 30, age).
- Failures: no codes; idle reasons in `e.reason`: noBatch, noStore, noPile, storageFull, noPlots, noWell, cantDo, noSeeds, fieldsFull, growing.

**Walk to job**
- Where: staff.js:498 `moveTo`, `plan`, `steer`.
- Conditions: `e.job` set, not arrived.
- Consumes: counts as work time for vitals and battery (`e.job && e.working`).
- Changes: `root.position` x,z, `e.path`, `e.moving`, `e.yaw`.
- Rewards: none.
- Duration: `distance / (SPEED[kind] * (brewBot 1.15) * unitSpeed * gearWalk * speedK * stateK)` on grid path from nav; arrive at .2 m waypoint, .1 m final.
- Dependencies: navigate (nav.js), steer dodge AVOID_R 1.5 m, separate push, tier ground y is cosmetic (no slope penalty).
- Failures: stuck within 1.5 m of anchor for `FARM_MANAGER.stuckSeconds` 15 s: job dropped, claims in avoid map for `avoidSeconds` 12 s (execute instead counts as arrived). <.1 m in .8 s: repath, after 3 teleport to next waypoint.

**Work timer**
- Where: staff.js:1462 `update (j.work)`.
- Conditions: `j.arrived`; job target still valid (1405-1409, else dropped).
- Consumes: work seconds.
- Changes: `j.work`; finish when reached.
- Rewards: see finish branches.
- Duration: `j.hold` if set, else `(deliver ? STAFF_SIM.deliverSeconds .25 : WORK[type]||1) / (unitSpeed * craftSpeed(u,j.type) * gearJob(u,j.type) * stateK)`. `craftSpeed = 1+.05*step`, steps at 50/200/600 jobs, robots 1. gearJob only kettle on brew [1,1.08,1.16,1.25].
- Dependencies: STAFF_SIM.work, CREW.speedCurve, CREW.robotSpeed, VITALS tired .6 and hungry .7.
- Failures: none.

**Harvest**
- Where: staff.js:969 `finish (harvest)` then farm/harvest.
- Conditions: plot stage ready, stored<capacity; job search also needs canCrop (hard crop: smart>=2, robot frame>=1), plot unclaimed, on own tier. picker, harvestBot.
- Consumes: plot season (plantedAt reset; tree stays).
- Changes: beans into `pl.pile` if unit and D.haulActive, else addBeans; `u.craft.harvest+1`; `s.stats.harvested+1`.
- Rewards: beans = starYield with unitStars (worker 2 star at accuracy>=3 or goldHands, robot 1, precision pack 2) minus 1 if unripe, minus Arabica drop, plus trim and spray; crop XP; book earned beans*beanPrice; workDone (XP batch, jam roll). smart>=5 worker: secondPlot within 3.5 m in same trip with no extra time.
- Duration: picker 1.2 s, harvestBot .8 s at factor 1.
- Dependencies: oops unripe (`MISTAKES.rates.unripe` by accuracy * traitMul lazy 1.5 / diligent .7 * craft cut * shears).
- Failures: reducer: empty, notReady, storageFull; realm drops silently.

**Plant**
- Where: staff.js:979 `finish (plant)` then farm/plant.
- Conditions: planter, plantBot; plot empty, cropFor returns crop; canCrop else easyCropFor substitution.
- Consumes: D.seedCost coins.
- Changes: `r.plots[id]` created; slow flag if crooked (grow x1.1); `u.craft.plant+1`.
- Rewards: workDone.
- Duration: planter 1.2 s, plantBot .8 s at factor 1; then think 1.2 s (worker smart<4).
- Dependencies: cropFor: managerCropFor or planCropFor, else pickCropFor; playerCrop rule smart>=3 and robots use active crop.
- Failures: unknown, gameLocked, notOwned, occupied, locked, coins.

**Prune old tree / trim**
- Where: staff.js:997 `finish (prune)` then farm/prune or farm/trim.
- Conditions: pruner, pruneBot; growing plot; old: treeOld, pruneCost<=coins, knows oldTree (smart>=3, motor>=2); trim: not trimmed, not old.
- Consumes: prune: D.pruneCost coins; trim: nothing.
- Changes: prune: n=0, pruned, plantedAt=now; trim: `pl.trimmed=trimBeansOf(u)`.
- Rewards: trim +1 bean next harvest (+2 at accuracy>=4).
- Duration: pruner 1.6 s, pruneBot 1 s.
- Dependencies: PERENNIAL.
- Failures: empty, gameLocked, notOld, ripe, coins, unknown; trim noop.

**Spray**
- Where: staff.js:1000 `finish (spray)` then farm/spray.
- Conditions: droneBot; coins>=`CREW.sprayFee` 1; unsprayed growing plot.
- Consumes: 1 coin.
- Changes: `pl.sprayed=true`.
- Rewards: +1 bean next harvest; workDone.
- Duration: .6 s at factor 1.
- Dependencies: none.
- Failures: unknown, coins; noop.

**Process batch**
- Where: staff.js:1003 `processJob`, `finish (process)`, then prod/start or prod/collect.
- Conditions: processor; building with recipeOf, unclaimed; wetMill needs smart>=2; collect first, else start where !prodError.
- Consumes: recipe inputs and fee (prod/start).
- Changes: `b.job` set or cleared; goods added on collect.
- Rewards: premium * (1+.05*(accuracy-1)); recipe XP; workDone.
- Duration: processor 1.4 s for each of start and collect; batch time `io.ms` is separate.
- Dependencies: RECIPES, pulper.
- Failures: prodError codes, noInput, coins, notDone, storageFull; no job gives reason noBatch.

**Haul load**
- Where: staff.js:1010 `haulJob`, `finish (haul load)`, then farm/pickUp.
- Conditions: hauler, haulBot; storeBuildings non-empty; pile unclaimed; if already loaded only with chainPiles (smart>=3, robot battery>=1), room left and pile within `CREW.haulChainM` 8 m (straight line).
- Consumes: pile.
- Changes: `unit.cargo` (saved), `pl.pile` reduced.
- Rewards: none; no workDone.
- Duration: hauler 1.4 s, haulBot 1 s.
- Dependencies: haulCapacity = 6 + best vehicle + 2*(stamina-1) (robot 2*battery tier); biggestFirst smart>=2.
- Failures: unknown; noop; idle noStore or noPile.

**Haul drop**
- Where: staff.js:1011 `haulJob`, `finish (haul drop)`, then farm/deposit.
- Conditions: cargo>0, stored<capacity.
- Consumes: vehicle tripFee if coins suffice; 1 unit on drop mistake.
- Changes: addBeans, delete `unit.cargo`, `u.craft.haul+1`.
- Rewards: workDone.
- Duration: hauler 1.4 s, haulBot 1 s.
- Dependencies: near storehouse, machineSpot; oops drop.
- Failures: unknown, storageFull; idle storageFull.

**Manager order**
- Where: staff.js:1006 `farmJob` orders, `finish (execute)`, then gm/execute.
- Conditions: unit takes o.job (planter openField, surveyor expand, builder build, herder livestock), station claim free.
- Consumes: order cost through gmRun.
- Changes: order removed; order's act executed; practice.
- Rewards: workDone.
- Duration: hold 2.5 s fixed, not scaled by speed.
- Dependencies: `s.gm.orders`, orderSpot.
- Failures: unknown; noop when gmRun fails; on stuck 15 s it counts as arrived.

**Funny incident roll**
- Where: staff.js:750 `maybeGoof`, `funnyRoll`, then staff/funny (game.js:1775).
- Conditions: farm units only, on every job found by search, rolled before goof.
- Consumes: the found job is discarded.
- Changes: `unit.stopped {kind funny, id, level, at, fee}`; journal; blocks until settle or fire.
- Rewards: none.
- Duration: until staff/care settle or staff/fire; no timer.
- Dependencies: chance `FUNNY.chance[n-1]*gmCalmMul`; n = linked stat or part tier+1; level 11-n; random incident from 8 worker or 6 robot; fee `max(1,round((worker 2+level | robot 3+2*level)*gmHaggleMul))`.
- Failures: unknown; noop if already stopped.

**Goof walk**
- Where: staff.js:752 `maybeGoof`, `goofRoll`, startJob type goof.
- Conditions: farm only, after no incident; cumulative roll. play and lost need a target by route 10-60 m / 4-14 m else job goes on; dock targets `e.home`.
- Consumes: replaces the job; counts as work for vitals and battery.
- Changes: `e.job` goof (realm only).
- Rewards: none, no workDone.
- Duration: walk + goofHold: play by stamina [14,13,12,11,10,9,8,6,5,4] s; lost 3 s; dock 6 s.
- Dependencies: GOOF tables; traitMul lazy 1.5, diligent .6; not reduced by gmCalmMul.
- Failures: staff/recall coins (game.js:1785) cancels for goofFee.

**Cafe order**
- Where: staff.js:1013 `shopJob`, `pickShopJob`, `finish (order)`, then shop/takeOrder.
- Conditions: cafe not paused; queue head, free seat, beans per orderBlock; `station:order` free.
- Consumes: none here.
- Changes: order taken.
- Rewards: workDone.
- Duration: barista .7 s, brewBot .4 s at factor 1 (barista speed 1+.08*(n-1)); think 0.
- Dependencies: POST_JOBS, assignPosts, cafe.queuedOrder.
- Failures: orderBlock noQueue, noSeat, noBeans.

**Cafe brew**
- Where: staff.js:1017 `finish (brew)` then shop/brew.
- Conditions: taken order, brewing<brewSlots, beans, canBrew (hard drinks accuracy>=5, never robots).
- Consumes: beans.
- Changes: order brewing; chain to deliver wait if smart>=4, brewMs<=2500, post delivers.
- Rewards: workDone.
- Duration: barista .7 s, brewBot .4 s.
- Dependencies: kettle gear via gearJob.
- Failures: silent drop.

**Cafe deliver**
- Where: staff.js:1034 `finish (deliver)` then shop/serve, shop/spill, staff/mistake.
- Conditions: ready cup, not player's, unclaimed, customer seated.
- Consumes: none; spill loses a cup and rebrews.
- Changes: order served.
- Rewards: coins in shop/serve; workDone per cup; two cups smart>=3 within 4 m.
- Duration: pickup and each drop .25 s/(factors) + walk; urgent x1.25 walk at smart>=2 and patience ratio>=.7.
- Dependencies: wrongTable and spill rolls, getSeat from cafe.js.
- Failures: silent.

**Robot battery out**
- Where: staff.js:1391 `update` then staff/stop (game.js:1764).
- Conditions: robot with `e.job`; `e.workT>=batteryMinutes*60`.
- Consumes: none.
- Changes: `unit.stopped {battery, fee unitFee}`; `e.workT=0`.
- Rewards: none.
- Duration: battery [6,9,13,18,24,30,38,46,55,65] min by tier of job time; fee = `max(15,round(cost*.03))*feeMul` rounded.
- Dependencies: `e.workT` lives only in realm; resumed() zeroes it on any stop ending (line 1089).
- Failures: unknown; noop.

**Worker phone slack**
- Where: staff.js:1392 `update` then staff/stop.
- Conditions: worker, `e.job`, zone != farm (cafe only).
- Consumes: none.
- Changes: `unit.stopped {phone, fee}`.
- Rewards: none.
- Duration: per second chance `.3/60 * slackMul * chaosSlackMul`; `slackMul = trait(.4/2/1)*max(.2,1-.15*(stamina-1))`; fee `max(10,round(cost*.1))`.
- Dependencies: STAFF_BREAKS.worker.
- Failures: unknown; noop.

**Jam roll**
- Where: staff.js:961 `workDone` then staff/jam (game.js:1619).
- Conditions: robot finished a job counted by workDone.
- Consumes: none.
- Changes: `unit.stopped {jam, fee CARE.repair 20}`.
- Rewards: none.
- Duration: until knock (free, 3 taps within 1.5 s gaps), repair or autoUnjam after 10 s.
- Dependencies: `jamChance=.02*(farm 3)*frame.jamMul*(wear<30 ? 2 : 1)`.
- Failures: unknown; noop.

**staff/hire**
- Where: game.js:1478 `handlers['staff/hire']`, D.staffError (derive.js:776).
- Conditions: play gate. type is a key of STAFF; round; level; zone<30 (hireLimit ignores level); robots < ceil(30*.5)=15 in zone; coins or free-hire ticket. All STAFF rows are round 1, level 1. No game-lock check.
- Consumes: `STAFF[type].cost` or 1 reward ticket. picker 150, planter 130, waterer 120, processor 170, hauler 140, pruner 160, surveyor 200, builder 180, herder 160, barista 200; harvestBot 1200, plantBot 1200, waterBot 1000, haulBot 1400, pruneBot 1300, droneBot 1600, brewBot 1500.
- Changes: makeUnit: robot task auto, parts 0, heat 0, wear 100; assigned to current region and zone, active if freeSlots>0; ledger 'hire', journal 'hired'.
- Rewards: `XP.hire` 5; event hired.
- Duration: instant.
- Dependencies: STAFF, STAFF_CAP, makeUnit, D.freeSlots.
- Failures: notPlaying; unknown (type not in STAFF, including farmhand and sproutBot); round; level; hireLimit; robotShare; coins `{missing}`; teamFull is unreachable because hireCap is also 30.

**staff/recruit**
- Where: game.js:1490 `handlers['staff/recruit']`, D.recruitError (derive.js:806), D.applicants (802).
- Conditions: applicant at index; round, level, zone<30, coins or ticket.
- Consumes: `a.cost = round5(STAFF.cost*TRAITS.costMul diligent 1.3 / lazy .6 / funny 1)`, rare x2.
- Changes: unit with trait, name, perk, stats, energy 100, fullness 100, morale 80; new pool seed.
- Rewards: `XP.hire` 5.
- Duration: instant; board 3 applicants, free refresh 10 min or 20 coins.
- Dependencies: tradesFor sorts by gmCrewGap then fewest team; first applicant is top trade.
- Failures: unknown, round, level, hireLimit, teamFull, coins.

**staff/vitals**
- Where: game.js:1575 `handlers['staff/vitals']`; sent by flushVitals (staff.js:479).
- Conditions: unit exists. Sent every max(5, units/2) s; a no-op batch held up to 30 s.
- Consumes: none.
- Changes: worker: energy -10/min*drain working, +20/min resting (x2 benched), cap energyMax; fullness -12.5/min working (x.5 at stamina>=4), never regenerates; morale -3/min if energy<=0, funny +2/min, chaos. Robot: heat +heatPerMin working, -40/min rest; wear `-n*.2*frame.wearMul`; heat>=100 gives stopped overheat 30 s. Clears expired lunch and overheat.
- Rewards: none.
- Duration: work and rest clamp 120 s per batch, jobs clamp 20.
- Dependencies: VITALS, ROBOT_WEAR, gearDrain, tireless .5.
- Failures: unknown; noop.

**staff/care**
- Where: game.js:1629 `handlers['staff/care']`, D.careError (derive.js:929), D.careCost (916).
- Conditions: kind applicable to state.
- Consumes: settle, bonusSmall, recharge: `stopped.fee`; coffee 20; food 15; bonus 50; cool 10; repair 20 (0 with warranty, 3 repairs); service 10% cost; nag, lunch, rest, knock free.
- Changes: nag 60% unstop, -5 morale always; coffee +60 energy; food fullness 100; lunch breakUntil +60 s, fullness 100; bonus +40 morale; rest bench; cool heat 0; service wear 100.
- Rewards: unit resumes.
- Duration: instant; lunch 60 s.
- Dependencies: softwareRound autoCharge, autoUnjam every 5 s (staff.js:1323).
- Failures: unknown, notNeeded, coins.

**staff/funny**
- Where: game.js:1775 `handlers['staff/funny']`.
- Conditions: incident valid for kind.
- Consumes: none (fee due later).
- Changes: `unit.stopped` kind funny.
- Rewards: none.
- Duration: until settle or fire.
- Dependencies: funnyLevel, funnyFee, gmHaggleMul.
- Failures: unknown; noop.

**staff/setActive**
- Where: game.js:1516 `handlers['staff/setActive']`.
- Conditions: unit assigned to current region; on needs freeSlots>0 (slots=30).
- Consumes: none.
- Changes: `unit.active`; journal.
- Rewards: none.
- Duration: instant.
- Dependencies: D.slots (derive.js:758).
- Failures: unknown, slotsFull; noop.

**staff/workDone**
- Where: game.js:1663 `handlers['staff/workDone']`; flushXp (staff.js:964).
- Conditions: unit exists. Sent at 3 jobs, on task change, or 15 s after last.
- Consumes: none.
- Changes: book jobs, history; worker `xp += n*xpMul` (1.25/.75/1), every 20 xp 1 point.
- Rewards: skill points.
- Duration: instant; n clamp 1..20.
- Dependencies: `SKILL.xpPerPoint`.
- Failures: unknown.

**staff/upkeep**
- Where: game.js:1544 `handlers['staff/upkeep']`, D.upkeepOf (derive.js:955).
- Conditions: play gate. Dispatched every 60 s while playing with units; the first call only sets upkeepAt; mins>0.
- Consumes: for each unit `r2(upkeepOf x mins/10)`, mins capped at `UPKEEP.maxCatchUpMinutes` 10. Benched worker 0.1 x hire cost per 10 min (`benchRatio`). Robot with !active and !assigned: `round(0.03 x price)` (`robotStandbyRatio`). Follower: followerWage (workers `max(10, round(0.1 x cost))`; robot 20), on or off shift. Working workers, robots on shift or assigned: 0.
- Changes: coins, upkeepAt, unit book. Unpayable: follower: partial pay then `debt.wages.follower`, leaves at 10 x wage; robot: flagged only; worker: morale `-10 x mins/10`, removed at 0. Events upkeepPaid, followerDebt.
- Rewards: none.
- Duration: charged about every 60 s by the realm; period unit 10 minutes. A long gap bills at most 10 minutes.
- Dependencies: UPKEEP, FOLLOW, DEBT.
- Failures: notPlaying, paused; noop when mins<=0.

### Staff facts

- WORK seconds (`STAFF_SIM.work`, economy.js:844): picker 1.2, planter 1.2, waterer 1, processor 1.4, hauler 1.4, pruner 1.6, surveyor, builder, herder 2.5 (unused), harvestBot .8, plantBot .8, waterBot .7, haulBot 1, pruneBot 1, droneBot .6, barista .7, brewBot .4, deliverSeconds .25.
- Effective job seconds on a fresh hire (speed stat 1 = .65): picker and planter 1.846, waterer 1.538, processor and hauler 2.154, pruner 2.462. At stat 5 (factor 1) the table values; at stat 10 (1.45) picker .828. Fresh farm robot (motor 0 = .7): harvest and plant 1.143, water 1.0, haul and prune 1.429, drone .857.
- Walking speed: worker 2.6 m/s, robot 3.2 m/s base (economy.js:843), times unitSpeed. Fresh farm worker 1.69 m/s; stat 5 2.6; stat 10 3.77. Fresh farm robot 2.24 m/s; motor tier 9 (1.8) 5.76 m/s. brewBot 3.68 x [1,1.1,1.2,1.35]. Barista 2.6 x (1+.08*(speed-1)), stat max 5. Boots and shoes x[1,1.05,1.1,1.15] on walk only. Tired x.6, hungry x.7 on walk and work.
- unitSpeed (economy.js:851): farm robot `CREW.robotSpeed[motor]` = .7,.82,.94,1.06,1.18,1.3,1.42,1.54,1.66,1.8; shop robot `ROBOT_PARTS.motor.speed[motor]`; farm worker `CREW.speedCurve[speed-1]` = .65,.73,.82,.91,1,1.09,1.18,1.27,1.36,1.45; barista 1+.08*(speed-1).
- `GM.value.jobsPerMin` (economy.js:586) is a planner assumption only: surveyor 1, builder 2, herder 2, picker, planter, waterer 8, processor, hauler, pruner 6, barista 8, harvestBot, plantBot, waterBot 11, haulBot, pruneBot 8, droneBot 11, brewBot 10. `D.jobsPerMin` = table x unitSpeed (derive.js:1170). The realm never reads it.
- haulLoadOf: 6 + vehicle + 2*(stamina-1), robot 2*battery tier. Bucket size is in section "Water, exactly".
- Worker vitals from full with constant job time: tired (energy<25) at 7.5 min, energy 0 at 10 min at stamina 1. Hungry (<20) at 6.4 min, fullness 0 at 8 min (16 min at stamina>=4).
- Fullness never regenerates by rest: only staff/care food or lunch (game.js:1647-1648). unitBlocked is true at fullness<=0 (derive.js:901), so an uncared worker stops permanently after 8 min of job time.
- Energy at 0 blocks, but blocked time counts as rest at +20/min, so the worker flips back as soon as a vitals batch lands.
- Robot heat at motor 0, cooler 0: 25/min, overheat after 4 min continuous job time, sooner than the 6 min battery. Self-cool lasts 30 s and removes only 20 heat at 40/min, so heat restarts near 80 and overheats again after about 48 s of job time unless staff/care cool sets it to 0.
- Tier 3 and above farm cooler reduces via `CREW.robotCooler` [1,.85,.7,.58,.46,.36,.26,.16,.08,0]; only tier 9 eliminates heat on the farm. Motor heatMul raises it [1..1.8].
- Recharge fee at tier 0: harvestBot and plantBot 36, waterBot 30, haulBot 42, pruneBot 39, droneBot 48, brewBot 45.
- Any stop ending calls resumed(), which zeroes `e.workT` (staff.js:1089), so a free knock after a jam or a free self-cool also fully restores battery. `e.workT` is not saved, so a reload also refills it.
- Jam chance per finished job: farm .06, cafe .02 at frame 0; doubled when wear<30. Only successful workDone jobs count (pickUp and well fetch do not). Wear drops .2 per job at frame 0, so 350 jobs reach wear 30.
- Funny chance by number 1..10: 6, 5, 4, 3, 2.2, 1.6, 1, .6, .3, .1 %. Robot number = part tier+1. Fee worker 2+level, robot 3+2*level, level = 11-number. Fresh worker level 10 fee 12; fresh robot level 10 fee 23 (before haggle).
- Funny and goof rolls happen only for farm units (update line 1417). Cafe units never roll them; only farm workers are exempt from phone slack (line 1392).
- Goof tables: play by stamina .3,.24,.19,.15,.11,.08,.05,.03,.015,.005; lost by smart .25,.2,.16,.12,.09,.07,.05,.03,.015,.005; robotLost by frame .2,.16,.13,.1,.07,.05,.03,.02,.01,.003; robotDock by battery .14,.11,.09,.07,.05,.035,.02,.012,.006,.002. goofFee = `max(1,round((worker 2|robot 3 + 11-n)*gmHaggleMul))`.
- A fresh farm worker (lost+play at stat 1) discards 55% of found jobs into goofs before trait, plus funny chance. Lazy multiplies goof by 1.5, giving .825.
- The harvest replant chain (staff.js:976) never runs for current trades: picker does not take plant, and perennial harvest leaves the plot occupied.
- WORK entries for surveyor, builder, herder are dead: their only jobs are execute orders, which use hold 2.5.
- Robots default to task 'auto' (makeUnit) and robotTask returns auto; farm robots have one task so it is harmless, only brewBot switches, every `ROBOT_AUTO.autoSeconds` 30.
- `STAFF_CAP.perZone` 30, robot cap ceil(30*.5)=15 per zone. hireLimit is a constant 30, so level does not limit hiring; every STAFF def has level 1, round 1.
- Piles fall into storage when no hauler: game.js:2537 flushes if `!D.haulActive`. haulActive needs a farm storage building and an active haul-capable unit.
- The staff loop runs only while the frame loop runs. Nothing in staff work advances while the tab is hidden, though plot growth uses wall-clock Date.now.
- `scripts/economy-sim.mjs` approximates the team with credit per second: `1/realmJobSec = .35 + WALK_M/(base speed, without unitSpeed) + work/unitSpeed + plant 1.2 s`. WALK_M harvest 3, plant 1, water 3, order 1.5, brew 1.5, deliver 8.

---

## 5. General manager

**gm/think (one decision round)**
- Where: game.js:2150 `handlers['gm/think']`.
- Conditions: D.gmOf(s) else noop. After expireDue: needs `g.unit`, !gmStrike (always null), mode != 'advisor' (`GM.modes` only has 'full'). On the farm `g.fm.auto` must be true, otherwise queued orders are cleared and he only watches. gmCandidates needs a region and phase play.
- Consumes: nothing itself; each executed candidate consumes its own cost via gmRun.
- Changes: expires due tasks; sampleUtil, sampleLoad; planDay when due; `g.ticks`; drops orders nobody can do; closes surplus sale requests; `g.tiers = planTiers`; `g.fm.plan` via refreshPlan every 20 played s; `g.busy`; wishLicence; `g.fm.log` via FM.note; `g.orders`; tasks filed; cooldowns.
- Rewards: runs candidates sorted by `score = urgency x (value+1)/(cost/I10+0.05) x styleMul`.
- Duration: every `D.gmThinkSeconds`; `gmThinkOf = max(2, 5 - 0.35 x (speed-1))` s: 5 s at speed 1, 2 s at speed 10 (x2 only if `backlog >= PENALTY.backlog.waitAt` = Infinity, never). Confirmed at staff.js:1315 and derive.js:1088. Off-screen zone only when `floor(played s / think s) % 2 == 0`.
- Dependencies: realm timer staff.js:1315; D.gmCandidates, D.gmPermission, FM.thinkContext, FM.gate, gmRun, fileTask.
- Failures: `{noop:true}` when nothing changed. A sellAsk block is not logged: gm/think sets perm to 'file', so the candidate becomes a filed task. The other blocks are logged, not returned: cash, buildOff, landOff, hireOff, recovery, noLoan, reserve, limit, payback, noProfit, locked, noCrop, underused, noCrew, saving, queued, done, failed.

**gm/hands (manager's own field round)**
- Where: game.js:2109 `handlers['gm/hands']`, FM.handsJobs (`src/core/farm-manager.js:67`).
- Conditions: gmOf, `fm.auto`, gmZone 'farm', !gmStrike. Plots in skip (crew claims) are excluded. Does not check mode.
- Consumes: seed and prune coins, kept so coins never go under `fm.minReserve` (the player's minimum only, not fmReserve). Not charged to any budget window.
- Changes: calls farm/harvest, farm/plant, farm/uproot, farm/prune, farm/water directly with ACTOR g1, not through gmRun. `g.lastJobAt`; `g.unit.book.jobs += did`.
- Rewards: crop chosen per field by managerCropFor. Does not add `gm.worked` (no smart growth), no loyalty, no cooldown, no gmActed.
- Duration: every `FARM_MANAGER.hands.everySec` = 2 s. Jobs per round = `max(1, round(gmHandsPerMin x 2/60))`, `gmHandsPerMin = 60 x (1 + 0.2 x (speed-1))`: 2 jobs at speed 1, 6 at speed 10.
- Dependencies: order: ceil(n x 0.7) picks, then sow until n, then pick, uproot, prune, water until n. Harvest skipped if stored >= capacity. Tiers without that trade first (empty, dry, ripe).
- Failures: `{noop:true}` if not eligible or nothing done; individual job failures are skipped silently.

**handsSell (auto sale inside gm/hands)**
- Where: game.js:2126, via gmRun farm/sellAll (handler line 1127).
- Conditions: `fm.autoSell`, capacity>0, `stored/capacity >= hands.sellAt` 0.5, and the gm/hands preconditions.
- Consumes: all goods in sellAllQuote; no budget window (budget:false).
- Changes: inventory, coins, gmRun bookkeeping, `g.lastJobAt`, loyalty +0.3.
- Rewards: quote coins plus bonus `quote x (gmMoneyMul-1)`, `gmMoneyMul = 1 + 0.03 x (smart-1)`. `gm.worked` +1 (smart +1 every 40 jobs, max 10).
- Duration: at most one per 2 s round.
- Dependencies: not limited by actions per think. gm/think skips sale candidates while autoSell is on.
- Failures: gameLocked, noBeans (gmRun returns false).

**gm/execute (crew member completes a queued order)**
- Where: game.js:2392 `handlers['gm/execute']`.
- Conditions: order id exists, `doesJob(unit, o.job)`, `g.unit`. FM.orderAllowed: `fm.auto`, `coins - cost >= minReserve`, `fm.land` for land/buyParcel, `fm.build` for build/*.
- Consumes: the act's real price, through gmRun growth window (budget default true).
- Changes: removes order; runs act; `practice(unit, job)`. When the act fails the draft is discarded, so the order stays in `s.gm.orders`.
- Rewards: the building, upgrade or land.
- Duration: walk plus hold 2.5 s (staff.js:659, 1007). Coins charged only on arrival; until then fmCommitted counts them.
- Dependencies: unit claims order in staff.js:657; job from D.orderJob: expand, build, livestock (openField orders no longer created, line 2199).
- Failures: `fail('unknown')`; settings changed returns undefined, logged 'orderOff'; act failed returns `{noop:true}`, and apply then discards the draft, so the order removal and the handler's `cool(key,'failed')` are both lost: the order stays with no cooldown.

**gm/hire**
- Where: game.js:2040 `handlers['gm/hire']`.
- Conditions: play gate; level >= `GM.unlockLevel` (1); no GM; board index exists; coins >= fee.
- Consumes: fee = 250 x skill.
- Changes: `s.gm.unit` created (uid g1); payAt, lastJobAt, seenAt = now; window, shareFrom set; board re-seeded; day plan unless mode advisor.
- Rewards: event gmHired.
- Duration: instant.
- Dependencies: D.gmBoard, gmCandidatesFor, D.gmDefaultLimits, planDay.
- Failures: notPlaying; level; hasGm; unknown; coins `{missing}`.

**gm/payroll**
- Where: game.js:2351 `handlers['gm/payroll']`, gmSalary (economy.js:677).
- Conditions: play gate. If `s.gm.payAt` is set, gmBack runs first. GM hired, else noop unless a return was settled. First call only sets payAt and shareFrom. mins>0.
- Consumes: `pay = r2(salary x mins/10 + max(0, g1 profit since shareFrom) x 0.05)`. `salary = round(20 x skill x 1 x (1 + 0.2 x raises))` per 10 min. mins capped at `GM.payMinutes` 10. Paid as far as coins allow.
- Changes: coins, ledger 'wage', gm day salary, payAt = now, shareFrom = current played minute. Short pay goes to `s.debt.wages.gm`.
- Rewards: paid in full: loyalty +1 per 10 min (`GM.loyalty.paidPer10`, max 100). Short: loyalty -1 per min. Events gmPaid, gmUnpaid, gmLeft.
- Duration: about every 60 s (staff.js:1317).
- Dependencies: D.gmProfitBetween (income rows by g1), `GM.salaryPerSkill`, payMinutes, modes.full, raiseStep, loyalty, quitArrearsSalaries.
- Failures: notPlaying; `{noop:true}`; arrears >= 10 x salary triggers gmLeave 'quit'.

**gm/fmSet**
- Where: game.js:2089 `handlers['gm/fmSet']`.
- Conditions: mode in FM.modes; minReserve in [0,200,500,1000,2000,5000,10000]; spendLimit in [0,200,500,1000,3000,10000]; auto, build, land, hire, autoSell boolean.
- Consumes: nothing.
- Changes: `f[key]`, `f.sellChosen` on autoSell, `f.plan = null`. auto false clears orders; build false drops build/* orders; land false drops land/buyParcel orders; a mode with ask (manual) clears orders.
- Rewards: player control.
- Duration: instant.
- Dependencies: HUD staff-modal.js:410.
- Failures: unknown; `{noop:true}` if unchanged.

**gm/fmPin**
- Where: game.js:2101 `handlers['gm/fmPin']`.
- Conditions: D.unitOf(uid) exists; tier null or integer 0..3. Does not check the tier has fields.
- Consumes: nothing.
- Changes: `f.pins[uid]`, `s.gm.tiers[uid]`.
- Rewards: planTiers keeps the pin.
- Duration: instant.
- Dependencies: HUD staff-modal.js:435.
- Failures: unknown; `{noop:true}` if unchanged.

**planDay (crops per lot, worker tasks, robot tasks, target)**
- Where: game.js:428 `planDay`.
- Conditions: `g.unit` and region. Called from gm/hire (mode != advisor), gm/think when `!g.plan` or `played - atPlayed >= 10 min`, gm/planDay (line 2254).
- Consumes: nothing.
- Changes: staff/setTasks per worker, staff/setTask per robot (from D.planTasks), `g.plan = {atPlayed, crops, target}`; closes open topUp tasks with cooldown 'expired'.
- Rewards: `target = round10(I10 x 2 x 1.1)`; event gmDayPlan.
- Duration: `GM.plan.everyMin` = 10 played min.
- Dependencies: D.chooseCrop, bestCropFor, climateFit, planTasks.
- Failures: silent return; gm/planDay: `fail('unknown')`. Not counted in actions per think.

**Manager rules (GM_RULES, economy.js:1107-1201)**

**Robot care: recharge, knock, cool, service**
- Where: economy.js:1116, runs staff/care (game.js:1629).
- Conditions: per robot: state battery, jam, overheat; service when wear < `ROBOT_WEAR.lowWear`. okOrCoins(careError). Also off-screen.
- Consumes: careCost(unit, kind); care wallet if cost <= walletLeft, else growth window.
- Changes: unit state; gmRun records.
- Rewards: unit back at work; value = contrib.
- Duration: key cooldown 1 played min after done.
- Dependencies: urgency blocking (service: morale). Group care or ops is free of the slot check.
- Failures: unknown, notNeeded, coins.

**Worker care: nag, bonusSmall, lunch, lunchShop, food, coffee, bonus, funnyPayW, funnyPayR**
- Where: economy.js:1125, runs staff/care.
- Conditions: nag: state phone, phoneSoft false. bonusSmall: phone, phoneSoft true. lunch: hungry, on shift, style careful. lunchShop: shop, balanced or bold. food: farm, balanced or bold. coffee: tired on shift. bonus: sulking on shift. funnyPay: farm, state funny, funnyWorth true.
- Consumes: careCost; care wallet if it fits, else growth window.
- Changes: unit vitals and stopped state.
- Rewards: value = contrib.
- Duration: key cooldown 1 played min.
- Dependencies: off-screen allowed. Not stopped by the slot limit, but each adds to done.
- Failures: unknown, notNeeded, coins.

**shift (swap), active (bench to shift)**
- Where: economy.js:1142, runs staff/swapShift (game.js:1528), staff/setActive (1516).
- Conditions: shift: tiredOn and restedOff. active: restedOff, freeSlots>0, tiredOn false. Screen zone only.
- Consumes: 0 coins.
- Changes: unit active flags.
- Rewards: rested workers on shift.
- Duration: key cooldown 1 played min.
- Dependencies: group ops.
- Failures: not read.

**collect, produce (station)**
- Where: economy.js:1146, runs prod/collect (1415), prod/start (1393).
- Conditions: farm. collect: `b.job` and no collectError. produce: no `b.job`, okOrCoins(prodError), !missingInput. Per recipe building.
- Consumes: produce: recipe fee (recipeIO.fee) and inputs.
- Changes: `b.job`, inventory.
- Rewards: processed goods; value = margin per min.
- Duration: recipe time; key cooldown 1 played min.
- Dependencies: group ops.
- Failures: collect: unknown, notDone, storageFull. produce: unknown, gameLocked, jobBusy, noRecipe, noInput, coins.

**sellFull, sellCare (sell all, needs signature when autoSell off)**
- Where: economy.js:1107, runs farm/sellAll (1127).
- Conditions: sellFull: storagePct >= 0.5, saleBlocked false. sellCare: careShort, storageValue>0, saleBlocked false. `fm.autoSell` false, otherwise skipped. `c.always` gives perm 'file'.
- Consumes: goods.
- Changes: task kind trade (life 10 played min); on approval inventory and coins.
- Rewards: coins x gmMoneyMul.
- Duration: filed; one sale request at a time.
- Dependencies: player approval via task/approve.
- Failures: gameLocked, noBeans.

**sellSome**
- Where: economy.js:1109, runs farm/sell (1123).
- Conditions: storagePct >= 0.5, saleBlocked true, autoSell off; amount = most valuable good under `gmHighValue` = 20 x I(L). Always file.
- Consumes: goods.
- Changes: task trade.
- Rewards: coins x gmMoneyMul.
- Duration: filed.
- Dependencies: blocked while another sale request is open (line 2212).
- Failures: sellGood errors, not read.

**beans (cafe buys beans)**
- Where: economy.js:1113, runs shop/buyBeans (1140).
- Conditions: shop, beansLow (beans < 2 x beanNeed, quote ok, amount>0).
- Consumes: quote cost or free.
- Changes: bean stock.
- Rewards: orders served; urgency orders.
- Duration: key cooldown 1 played min.
- Dependencies: group trade: no FM gate (zone shop).
- Failures: not read.

**keep (poached worker)**
- Where: economy.js:1151, runs staff/keep (1919).
- Conditions: poachHere. noFile true.
- Consumes: `p.fee`.
- Changes: clears poach.
- Rewards: worker stays.
- Duration: poach task life 1 played min.
- Dependencies: farm: FM.gate applies as capital.
- Failures: not read.

**hire (recruit), hireRobot**
- Where: economy.js:1153, runs staff/recruit (1490), staff/hire (1478).
- Conditions: piling >= 3, hireRoom>0, condition held 2 thinks. Farm: hireRoom capped at ceil(plots/3) - units. hireRobot: robotRoom>0, robotWorth>=0. `fm.hire` on the farm.
- Consumes: applicant or robot price (0 if freeHire).
- Changes: new unit.
- Rewards: throughput.
- Duration: instant via gmRun (no crew order).
- Dependencies: gmBudgetLeft; FM.gate.
- Failures: recruitError: unknown, level, round, hireLimit, teamFull, coins. staffError adds robotShare.

**crewHire**
- Where: economy.js:1175, RULE_ARGS.crewHire, runs staff/recruit or staff/hire.
- Conditions: farm, crewGap (gmStaffPlan non-empty, units<30). Most short-handed job first. Robot if avail >= 6 x cost and cost <= 3 x I10; else best applicant with cost <= avail or have == 0.
- Consumes: hire price.
- Changes: new unit.
- Rewards: essential when have == 0.
- Duration: instant.
- Dependencies: gmStaffPlan, farmStaffing.
- Failures: as hire.

**upgrade, quality, richUp**
- Where: economy.js:1157, runs staff/upgradeStat (1678) or the act named by the builder: staff/upgradePart (1738), staff/buyGear (1837), staff/buySoftware (1864).
- Conditions: upgrade: upgradeBest>0. quality: mistakes>=3 and qualityBest>0. richUp: farm; worker avail >= 3 x cost, robot >= 5 x cost; cost <= contrib x 30.
- Consumes: upgrade price.
- Changes: unit stat, part, gear or software.
- Rewards: unit contribution.
- Duration: instant; key cooldown 1 min.
- Dependencies: gmBudgetLeft, FM.gate; richUp is known:false so needs net>0 and no debt.
- Failures: statError: unknown, maxLevel, cap, points, coins. partError: unknown, maxLevel, coins.

**autoCharge, autoUnjam**
- Where: economy.js:1161, runs staff/buySoftware (1864).
- Conditions: recharges (or jams) >= 2 today and canCharge or canUnjam.
- Consumes: softwarePrice.
- Changes: `u.software`.
- Rewards: robot self-care.
- Duration: instant.
- Dependencies: capital checks.
- Failures: unknown, level, owned, coins.

**funnyFireW/R, fire, replaceWeak (fire units)**
- Where: economy.js:1169, runs staff/fire (1825).
- Conditions: funnyFire: farm, state funny, funnyWorth false. fire: gradeD2 worker. replaceWeak: farm worker, isWeak, 'replace' not cooling.
- Consumes: 0 coins.
- Changes: removes unit, refund fireRefund.
- Rewards: slot freed.
- Duration: replaceWeak at most one per `GM.growth.replaceEveryMin` = 3 played min.
- Dependencies: cost 0 so FM.gate returns null. funnyFire counts as free of the slot limit.
- Failures: unknown.

**fieldBuy (open a field)**
- Where: economy.js:1177, runs build/place type field (game.js:1320), spots from gmFieldSpots (derive.js:1730).
- Conditions: buildError('field') empty; not farmOverloaded when hands active; `n = min(6, room, plots<6 ? 6-plots : floor(spendable/(seed+5)))`; `room = planters x 3 + 6 - empty - pending` with hands. A field costs 0, so FM.gate returns null before its buildOff check (`fm.build` does not stop it) and the gmBudgetLeft check in gm/think, which needs cost>0, does not apply. gm/think also needs `fm.auto` on the farm, so gmFieldSpots takes its hands branch, where spendable is gmSpendable.
- Consumes: buildCost(s,'field').
- Changes: new field, in tier with fewest fields.
- Rewards: land for sowing.
- Duration: instant, by him (job forced null).
- Dependencies: not counted in done; at most 6 candidates per think.
- Failures: buildError: unknown, gameLocked, needBarn, barnFull, coins. placementError: unknown, outside, notOwned, overlap, onField, mountain.

**crewBuild (place or upgrade what the crew lacks)**
- Where: economy.js:1185, runs build/place or build/upgrade (1377), items from gmBuildNeeds (derive.js:1645).
- Conditions: gmBuildNeeds item ok. Up to 6 placements + 2 upgrades. silo, well per tier, extra well, dryer or wetMill (planted>=6, stations<ceil(planted/15)), pulper, motorbike, tillerCart, farmTruck, dripLine, shadeTree. Extras need avail >= 4 x cost and cost <= 2 x I10; upgrades avail >= 5 x cost, cost <= I10.
- Consumes: buildCost or upgradeCost, on execution.
- Changes: building, via crew order if a 'build' unit is on shift, else directly.
- Rewards: basic items are essential.
- Duration: order: walk + 2.5 s. Else instant.
- Dependencies: `fm.build`, FM.gate.
- Failures: as fieldBuy; upgrade: unknown, maxLevel, coins.

**herdBuy**
- Where: economy.js:1179, runs build/place.
- Conditions: herdNeed: >=3 farm units, coins >= 5 x cost; barn first, then chickenCoop, goat, cow.
- Consumes: buildCost.
- Changes: barn or animal; crew order job livestock if available.
- Rewards: known:false, needs net>0 and no debt.
- Duration: order walk + 2.5 s.
- Dependencies: `fm.build`.
- Failures: as build/place.

**train (manager training)**
- Where: economy.js:1189, runs gm/train (game.js:2272).
- Conditions: trainDue: `g.busy.n >= 3`, okOrCoins(gmTrainError), pays back <= 40 min (uses `GM.thinkSeconds` and actionsPerThink tables).
- Consumes: 400 x (skill+1).
- Changes: `gm.training` until played + 1 shift-day.
- Rewards: skill +1.
- Duration: `GM.training.shiftDays x CAREER.shiftDayMin` played min.
- Dependencies: capital.
- Failures: unknown, maxLevel, busy, coins.

**landBuy**
- Where: economy.js:1192, runs land/buyParcel (1430), landSnap (derive.js:1550).
- Conditions: next estate with no parcelError; pay (coins >= 1.2 x price or gmLoanFor); price/(30 x perPlot) <= 120; tight or rich (6+ plots, coins >= 2 x price) or (payback <= 90 and busyPct >= 0.6). `fm.land`; FM.landBlock.
- Consumes: parcelCost.
- Changes: parcel owned, via 'expand' crew order if available.
- Rewards: new tier.
- Duration: order walk + 2.5 s or instant.
- Dependencies: exempt from gmBudgetLeft (line 2197).
- Failures: parcelError: unknown, owned, order, coins; gate: locked, noCrop, underused, noCrew.

**landSell**
- Where: economy.js:1194, runs land/sell (1451).
- Conditions: utilRows >= 30, lot with >= 30 samples, usage<0.2, !landSellError; coins < care wallet or refund >= keepValue.
- Consumes: the lot.
- Changes: always filed (FM.gate sellAsk). Task kind land, life 60 played min; 'land' cooldown landEveryMin.
- Rewards: refund `LAND.sellRefund x price`.
- Duration: filed; <= 1 land proposal per 10 played min (2 if land-bound).
- Dependencies: player approval.
- Failures: landSellError: unknown, notOwned, starter, estate, last, buildings.

**buildUp**
- Where: economy.js:1196, runs build/upgrade (1377), buildSnap (derive.js:1583).
- Conditions: station type queue full >= 10 played min; cost/value <= 45.
- Consumes: upgradeCost.
- Changes: level + 1.
- Rewards: station capacity.
- Duration: crew order if build unit, else instant.
- Dependencies: `fm.build`, FM.gate.
- Failures: unknown, maxLevel, coins.

**loan for capital job (perm 'loan')**
- Where: game.js:2207 inside gm/think, gmRun loan/take (2481).
- Conditions: coins < c.cost, gmLoanFor: smallest pack in [1000,2000,5000] >= gap with no loanError, payback < term x 0.5; FM.gate noLoan passes (`mode.loan` true, not recovery); done<max; 'loan' not cooling.
- Consumes: debt owed = loanOwed (the principal; interest LOAN.interest 0.1 is paid when borrowed cash is exchanged for Gold, docs/design/wallet-economy.md).
- Changes: `s.loans`, coins.
- Rewards: cash; the target job is retried later.
- Duration: one per `GM.loanRule.everyMin` = 10 played min.
- Dependencies: runs alone, no signature.
- Failures: loanError codes include unknown, loanBlocked.

**repay**
- Where: economy.js:1199, runs loan/repay (2493).
- Conditions: repayRoom>0: owed>0, coins >= owed + care wallet + g.budget; amount min(owed, g.budget).
- Consumes: coins.
- Changes: loans.
- Rewards: debt down.
- Duration: key cooldown 1 min.
- Dependencies: skips FM.gate (loan/repay).
- Failures: invalid, coins; noop.

**topUp proposal**
- Where: economy.js:1201, runs gm/topUpSeen (2284).
- Conditions: topUpDue: >=2 denied loans today, I10 < 0.5 x target, <=1 per day. Always file.
- Consumes: nothing.
- Changes: task kind topUp, life 60 min; closed at the next planDay.
- Rewards: logs answer only; no coins move.
- Duration: filed.
- Dependencies: player.
- Failures: none read.

### Manager facts

- Limit per think, do path: `max = gmActionsOf = 1 + floor((accuracy-1)/3)` (accuracy 1-3: 1, 4-6: 2, 7-9: 3, 10: 4). `rich = min(5, floor(gmSpendable/2000))`. Non-free 'do' jobs stop at `done >= max + rich` (game.js:2195), so at most 9 per think. The waiting or slow branch (max = 1) is dead: gmWaiting returns false and `PENALTY.backlog.waitAt` is Infinity.
- `free(c)` = group care or ops, funnyFireW, funnyFireR, or fieldBuy (game.js:2175-2176): these pass the slot check. Only fieldBuy is excluded from `done++` (line 2205); care, ops and funnyFire still add to done, so they use up slots for capital jobs after them.
- fieldBuy is bounded by gmFieldSpots: at most 6 candidates per think. FM.gate and gmBudgetLeft do not limit it, because a field costs 0.
- Queued crew orders add `done++` and reserve budget; there is no cap on `g.orders` except one per key and the done limit.
- Loan path uses `done >= max` (no rich) and one loan per 10 played minutes.
- File path limits: filed < `TASKS.maxFiledPerThink` (2), done + filed < max + 2, open tasks < `TASKS.cap` (8), no pending duplicate, one sale request at a time, one land proposal per landEveryMin (10, or 2 if landBound). Full inbox: key gets 'done' cooldown and a gmLater log at most every 10 played min.
- gmPermission (derive.js:2049) returns only: suggest (advice or no unit), file (`c.always`), loan or suggest (coins short), do. bigLimit, highValue and care wallet are not consulted.
- 'file' can only arise from: `GM.alwaysApprove` acts (gm/topUpSeen, farm/sell, farm/sellAll, farm/sellVariety, farm/sellBeans; economy.js:573), landSell via FM.gate sellAsk, or Manual Approval mode (ask) for capital cost>0 on 'do'.
- game.js:2211 `perm === file || perm === loan`: the loan half is unreachable because line 2207 handles loan first, so the loan-task filing code (2214-2215, 2229, 2234) never runs.
- `gmLicensed = () => true` (derive.js:1122), so licence checks never block and the licence candidates and wishLicence paths never trigger.
- Budget checks, in order, for farm capital cost>0: gmPermission coins; FM.gate; then non-essential non-landBuy must fit gmBudgetLeft (`cap = max(150, I10 x 0.6 + (no debt ? coins x 0.03 : 0))` per 10 min). FM `x.budget = coins - fmReserve - committed`, reduced per passed job.
- `fmReserve = max(minReserve, (care wallet + 2 salaries + upkeepPer + min(6, empty) x seed) x mode.reserveMul)`.
- FM.gate applies only to zone farm. Cafe capital has only coins and gmBudgetLeft checks. loan/repay and cost-0 capital skip the gate.
- FM.gate order: sellAsk, buildOff, landOff, hireOff, recovery, noLoan, reserve, limit, payback, noProfit, land block (locked, noCrop, underused, noCrew), saving.
- Recovery: played >= 30 min, net over 30 min < 0, and coins + stock < reserve x 1.5.
- Cooldowns (played min): done 1, failed 1, denied 5, expired 3, replace 3, loan 10. A queued order sets no cooldown, and gm/execute success sets none.
- farmStaffing: `units = min(ceil(30 x share), ceil(max(0, backlog/5 + arriving - hands)/rate))`, rates picker 8, waterer 8, pruner 6; shares harvest .5, water .2, prune .1, haul .15. Harvest is at least the open tier count when more than one tier. `haul = min(ceil(30 x .15), ceil(harvest/2))`. Storage want from flow x hold (1 min auto-sell, 10 manual).
- gmStaffPlan want: plant `min(8, max(own ? 0 : 1, ceil((empty+growth)/6) - floor(own x .3)))`, `own = gmHandsPerMin/8`; process ceil(stations/2); haul if planted>=6 and a store exists; build 1 if crew>=2 and avail>=400; expand 1 if crew>=3, avail>=600, next estate; livestock 1 if crew>=3 and avail>=800.
- planTiers: only tiers with fields; pins kept; per-trade even spread then rebalanced until tier headcounts differ by at most 1; prior tier kept on ties. It runs on every think.
- gm/hands and gm/think both skip when auto is off on the farm, but gm/think still expires tasks and samples first.
- gm/hands jobs do not pass through gmRun, so they do not affect budget windows, loyalty, `gm.worked` or per-key cooldowns.
- Manager acts never used: gm/buyLicence candidate requires unlicensed group; playerAdvice items (group advice) are never run by gm/think, only by gm/delegate which rejects tier advice.
- Other GM config: `GM.poach {everyMinutes 45, chance 0.25, keepSeconds 180}`. Loyalty paidPer10 1, unpaidPerMin 1, quitArrearsSalaries 10, raiseStep 0.2, keepBonusSalaries 6. `GM.modes.full`: mul 1, share 0.05, budgetMul 1. `TASKS.life`: care 5, trade 10, staffGrowth 30, land 60, loan 30, poach 1, gmPoach 180, topUp 60 (played minutes).

---

## 6. Water and walking actions

**Water one plot (waterer or RainBot, core action)**
- Where: game.js:1704 `handlers['farm/water'](s,{plotId,uid})` with uid.
- Conditions: plot is planted and `doesJob(unit,'water')` (`STAFF.waterer.jobs` or `ROBOT_TASKS.waterBot`). Not watered, not drip-covered, stage not ready. The core handler does not check for a tank, a bucket or distance; those are realm-only.
- Consumes: nothing in saved state. No coins. On the realm side one bucket unit is deducted by the caller (staff.js:995).
- Changes: `pl.plantedAt -= round(D.plotGrowMs(s,pl) * waterSpeedupOf(unit))`; `pl.watered=true`; `practice(unit,'water',now)`; event watered. `pl.watered` is deleted on harvest (game.js:1039) and on hard prune (game.js:1061).
- Rewards: ripens sooner by a share of grow time: worker `0.3 + 0.03*(accuracy-1)`, so 0.30 at accuracy 1 and 0.57 at accuracy 10; robot flat 0.30 (`TEND.speedup`). Once per planting or season.
- Duration: instant in core. The realm work time is the pour step.
- Dependencies: D.plotGrowMs, waterSpeedupOf (economy.js:773), D.dripCovers, D.plotState.
- Failures: `fail('unknown')` when the plot is empty or the unit cannot do the job. `{noop:true}` when already watered, a drip line covers the plot, or stage is ready. apply returns ok:true for a noop (game.js:2743).

**Water one plot by hand (player)**
- Where: game.js:1704 with no uid; callers `index.js:641`, `hud/placement.js:42`, `hud/tree-viewer.js:27`.
- Conditions: plot is planted. Tap path (index.js:641) additionally needs `plotNeeds==='thirst'`: growing, not watered, ratio>=0.5. No tank needed.
- Consumes: nothing.
- Changes: same as farm/water; unit is null so no practice.
- Rewards: `waterSpeedupOf(null)` = 0.30 of grow time.
- Duration: instant on tap.
- Dependencies: derive.js plotNeeds:56 (tap only); the core handler has no 0.5 ratio gate.
- Failures: `fail('unknown')` for an empty plot; `{noop:true}` when watered, drip-covered, or ready.

**Water one plot (General Manager's hands)**
- Where: `src/core/farm-manager.js:89` handsJobs pour(), dispatched by gm/hands (game.js:2109).
- Conditions: gm exists, `fmOf(s).auto`, `D.gmZone(s)==='farm'`, not on strike. Plot in the dry list (`!pl.watered && !dripCovers`, farm-manager.js:78) and not in the skip list. Timer `FARM_MANAGER.hands.everySec` in staff.js:1316. No tank needed.
- Consumes: nothing.
- Changes: same as farm/water with no uid; `ev.byGm=true`.
- Rewards: 0.30 of grow time (payload has no uid).
- Duration: instant per round.
- Dependencies: FM.handsJobs, gmHandsPerRound.
- Failures: gm/hands `{noop:true}` on unmet preconditions; individual job failures are skipped.

**Pick a waterer job (decide fetch vs pour)**
- Where: staff.js:678 `farmJob`, `takes(e,'water')` branch.
- Conditions: takes(e,'water'). Candidate plots: not claimed, planted, !watered, !dripCovers, stage not ready, filtered by homeOnly (the unit's assigned tier if that tier has fields). Target: 'driestFirst' rule (smart>=2, workers only) picks longest remainingMs; otherwise near() = farmRouteDist + crowd cost 5 m within 3 m + 40 m off-tier - age bonus (capped `FARM_MANAGER.ageCapM` 30).
- Consumes: nothing.
- Changes: returns job `{type:'water',plotId,x,z}` if `e.water>0`, else `{type:'water',step:'fetch',plotId,x,z at tank}`. startJob claims `plot:<id>` only (staff.js:886); no claim on the tank.
- Rewards: none directly.
- Duration: job search every THINK 0.35 s; when idle on the farm `FARM_MANAGER.idleThink` 1 s + random 0..0.5 s (staff.js:1419).
- Dependencies: waterSource, dripCovers, plotState, near, homeOnly, rule.
- Failures: no tank and an empty bucket: `e.reason='noWell'`, returns null, status icon, state label WAITING_FOR_WATER (staff.js:868), and the unit wanders (staff.js:1422). No failure if `e.water>0`: it keeps pouring with no tank.

**Choose water point**
- Where: staff.js:720 `waterSource`.
- Conditions: at least one building of type 'well' in the current region (any level, any tier, ignoring the unit's home tier).
- Consumes: nothing.
- Changes: none; returns `machineSpot(state,best) = freeFarmSpot({x:b.x, z:b.z + max(size)/2 + 0.8})`, about 1.3 m south of a 1x1 tank, or the nearest free spot on rings up to 8 m.
- Rewards: none.
- Duration: instant.
- Dependencies: minimum of farmRouteDist(unit to tank) + farmRouteDist(tank to plant); buildingsOf(state,'well').
- Failures: returns null with no tanks.

**Fetch water (refill bucket)**
- Where: staff.js:983 `finish`, branch `j.type==='water' && j.step==='fetch'`; timing in the update loop.
- Conditions: job with step 'fetch' has arrived at the tank spot. Only started when `e.water<=0` (no top-up of a part-full bucket). The tank is not re-validated en route: staff.js:1405-1408 only checks that the plot exists during fetch, so a tank removed mid-walk still fills the bucket at the old spot.
- Consumes: nothing: no tank stock, no coins, no energy cost specific to the refill.
- Changes: `e.water = bucketPlots(e.u)` (realm entity, not saved). Job becomes step 'pour', target plotSpot (plot.x, plot.z+1.25), work 0, arrived false. `e.bucket.visible=true` if the mesh exists (mesh only for units with `kind!=='robot' && !def.looks`, staff.js:293; waterer has looks, so no bucket mesh).
- Rewards: bucket of plants: worker `4 + can[0,1,2,3] + (stamina-1)`; robot `8 + 2*battery tier`.
- Duration: walk: distance / walk speed. Work seconds: `STAFF_SIM.work[e.type]` (waterer 1, waterBot 0.7) / (unitSpeed * craftSpeed(e.u,'water') * gearJob * stateK) (staff.js:1462).
- Dependencies: bucketOf (economy.js:770), moveTo, plotOf.
- Failures: if the plot is gone at fill time: no conversion to pour; bucket stays filled and the branch falls through. Stuck more than `FARM_MANAGER.stuckSeconds` 15 s: job dropped, claims avoided for `avoidSeconds` 12 s (staff.js:1435-1441). No workDone is counted for a fetch.

**Pour (consume 1 bucket unit)**
- Where: staff.js:994 `finish`, branch `j.type==='water'`.
- Conditions: arrived at plotSpot. Job is dropped silently if the plot was removed or moved (staff.js:1405-1408). Reached with `e.water>0` or just fetched.
- Consumes: `e.water` -1 (min 0) whenever `act('farm/water').ok` is true. A noop also returns ok:true, so a plot watered by someone else mid-walk, or that ripened or gained drip coverage, still costs 1 unit and counts workDone.
- Changes: calls farm/water; workDone(e) counts the job (worker XP batch, robot wear and jam roll); `e.think=0`; `u.craft.water+1`.
- Rewards: see farm/water.
- Duration: same work formula as fetch: waterer 1 s, waterBot 0.7 s, divided by speed factors.
- Dependencies: farm/water, workDone, jamChance for robots.
- Failures: if farm/water returns ok:false, no unit is deducted and no workDone.

**Well/tank passive growth aura**
- Where: derive.js:309 `wellBonus`; applied in plotGrowMs:147 and speedOf.
- Conditions: field centre within straight-line radius of a built 'well'. Radius by level [6,7,7,8,8,9,9,10]. Crosses tiers: plain Math.hypot.
- Consumes: nothing, no running fee.
- Changes: derived only: extra added to the speed divisor, `speed = 1 + staffBonus(growSpeed) + blessing(grow) + extra`.
- Rewards: grow by level [0.15,0.15,0.2,0.2,0.25,0.25,0.3,0.3]. Best single well only, no stacking.
- Duration: continuous, live-computed (memoised per region).
- Dependencies: memoOf(r), `BUILDINGS.well.effect`.
- Failures: returns 0 with no region, no wells, or no field.

**Drip line coverage**
- Where: derive.js:299 `dripCovers`; plotGrowMs:155.
- Conditions: field within straight-line radius of a built dripLine. Radius by level [12,14,16,18,20].
- Consumes: fee at harvest.
- Changes: plotGrowMs multiplied by `(1 - TEND.speedup)` = 0.7 when `!p.watered` and covered. farm/water becomes noop; waterers skip the plot. Applied live, so building or removing a drip line retimes growing plots.
- Rewards: 30% shorter grow time with no labour, no tank needed.
- Duration: continuous.
- Dependencies: memoOf(r), TEND.speedup.
- Failures: false with no region or drips.

**Drip line water bill**
- Where: game.js:1030, inside farm/harvest.
- Conditions: `D.dripCovers(s,plotId) && s.player.coins >= 1` at harvest.
- Consumes: `BUILDINGS.dripLine.effect.fee` = 1 coin per harvest. The line runs on every harvest, so a crop with waves pays on the first pick and on the wave pick.
- Changes: coins -1.
- Rewards: none extra; coverage stays even if unpaid.
- Duration: at harvest.
- Dependencies: spend, dripCovers.
- Failures: no failure: skipped when the player cannot pay; the drip keeps working.

**Build water tank (well)**
- Where: game.js:1320 build/place with type 'well'; D.buildError:566, D.placementError:455.
- Conditions: buildError: def exists and not retired; region mode not 'cafe' (else gameLocked); coins >= cost. Level, round and count are not checked. placementError (zone 'farm' branch): footprint inside BOUNDS x -32..32, z -76..28; the centre's tier zone belongs to an owned estate; ground height difference across the 4 corners and centre <= 0.25 m; all those points on one tier; no overlap with fields or buildings. Roads and lot edges allowed.
- Consumes: coins: `buildCost = round(200 * 1.5^(wells already built) / 5) * 5`: 200, 300, 450, 675...
- Changes: pushes building `{uid,type:'well',x,z,rot,level:1,spent}`; `s.stats.built++`; first-build XP; event built. Solid (not walkable), so the nav grid rebuilds with it as an obstacle.
- Rewards: water point for units plus the growth aura. No stock.
- Duration: instant when the player places it. Manager orders go through a builder job with hold 2.5 s (staff.js:659).
- Dependencies: snapPosition, estateOwned, farmGroundY, tierZoneAt.
- Failures: unknown, gameLocked, coins (data.missing), outside, notOwned, mountain, onField, overlap.

**Upgrade water tank**
- Where: game.js:1377 build/upgrade.
- Conditions: upgradeError null: not max level, coins >= cost.
- Consumes: coins by current level 1..7: 250, 600, 1400, 3000, 6000, 12000, 24000.
- Changes: `b.level++`, `b.spent += cost`, `stats.upgraded++`, `XP.upgrade`.
- Rewards: larger grow and radius only. Bucket size, refill speed and capacity are unaffected (no tank capacity exists).
- Duration: instant.
- Dependencies: upgradeCost, D.spentOn.
- Failures: unknown, maxLevel, coins.

**Remove or move water tank**
- Where: game.js:1367 build/remove, game.js:1343 build/move.
- Conditions: remove: removeError null. Move: placementError null.
- Consumes: nothing.
- Changes: remove splices the building; move rewrites x, z, rot. Tank coverage and memo change.
- Rewards: remove refunds `def.refund` 0.5 of coins spent (D.removeRefund).
- Duration: instant.
- Dependencies: D.removeError, D.removeRefund, D.placementError.
- Failures: unknown, fixed, jobBusy; move: unknown, fixed, placement codes.

**Manager plans tanks**
- Where: derive.js:1668 `gmBuildNeeds`.
- Conditions: tier has fields and no well on it (basic need, essential=true). A second tank needs `has('water')`, a well on the tier, at least `FARM_MANAGER.water.extraMinFields` 6 fields, and at least `extraUncovered` 0.5 of fields outside any well reach. Drip line per tier with at least 6 fields (line 1678).
- Consumes: coins at execution via build/place.
- Changes: adds a build candidate.
- Rewards: see Build water tank.
- Duration: manager round.
- Dependencies: thinnest, onTier, tierPlots helpers, wellBonus.
- Failures: silently no candidate.

**Walk a unit along a nav path**
- Where: staff.js:499 `moveTo`, `plan`; `navigate = navs[areaAt(tx,tz)].path` (index.js:181).
- Conditions: job or wander target.
- Consumes: time.
- Changes: `e.root.position`. Waypoint accepted at <0.2 m (last waypoint <0.1 m). Farm units steer around others within AVOID_R 1.5 m.
- Rewards: none.
- Duration: m/s = `STAFF_SIM.speed[worker 2.6, robot 3.2] * unitSpeed * gearWalk * speedK * stateK` (hungry 0.7, tired 0.6). Boots 1, 1.05, 1.1, 1.15.
- Dependencies: nav.js path, steer, separate.
- Failures: moved <0.1 m in 0.8 s: repath, up to 3 times; then teleports to the next waypoint. Farm job with no 1.5 m progress for 15 s: job dropped, claims avoided 12 s.

**A\* path search**
- Where: `src/features/realm/nav.js:130` `createNav().path`.
- Conditions: nav grid built (index.js:180, radius 0.45, cell 0.5, margin 2). Rebuilt only when region, owned lots, or solid buildings change (index.js:322-325).
- Consumes: CPU, capped at MAX_ITER 40000.
- Changes: returns waypoints.
- Rewards: straight line if clear; else 8-neighbour A*, no corner cutting, line-of-sight string-pull.
- Duration: same frame.
- Dependencies: navObstacles (footprints shrunk 0.15), NAV_CLEAR (forced walkable), hard = tierWallRects (re-blocked after clear).
- Failures: blocked goal snaps to nearest free cell (ring 24). If none, returns the raw target. No path found or iteration cap reached: goes to the closest node reached.

**Route distance estimate**
- Where: layout.js:194 `farmRouteDist`.
- Conditions: any two farm points.
- Consumes: nothing.
- Changes: none.
- Rewards: used for near() (staff.js:617), waterSource (723), and goof distance (758).
- Duration: instant.
- Dependencies: tierIndexAt, TIER_EDGES, TIER_CUTS.
- Failures: none. Estimate only: per tier crossing it picks the cut minimising `|c.x-x|+|c.x-bx|` and sums straight legs; it ignores buildings.

---

## 7. Money, goods and progression

**Sell a good (all or amount)**
- Where: game.js:1123 `handlers['farm/sell']`, sellGood.
- Conditions: play gate (game.js:2730-2733). Region mode is not 'cafe' (null accepted). good or item is a GOODS key. Floor(stock)>0 and amount>0. Payload `{good='beans', item, amount}`; item overrides good. amount must be a real number: sellQuote uses Number.isFinite without coercion, so a string amount sells the whole stack.
- Consumes: the good, via addGood(-n). Beans leave dearest variety first (`D.BEAN_SELL_ORDER`: arabica, liberica, robusta).
- Changes: `inventory.beans`, beanMix or `inventory.items[good]`; `player.coins` through earn; `stats.earned`; `stats.sold += n`; income row. Events beansSold (beans only), goodsSold.
- Rewards: coins = `n x unit price x buyer mul[good]`, rounded to 2 decimals. Unit: robusta 2, liberica 3, arabica 7, dried 4, roasted 9, bag 33. Buyer mul is 1 at the storehouse, 0.85-1.3 at a found buyer. No XP. Rebirth price blessing is not applied. Income is cut by the loan auto-repay, then arrears. If the GM runs the sale: extra earn of `gain x 0.03 x (smart-1)` (game.js:233, gmMoneyMul).
- Duration: instant.
- Dependencies: D.sellQuote (derive.js:353), D.buyerNow (derive.js:2443), GOODS, `CROPS.price`, earn.
- Failures: gameLocked, unknown, noBeans, notPlaying, paused.

**Sell beans (older HUD alias)**
- Where: game.js:1125 `handlers['farm/sellBeans']`, `sellGood(s,'beans',amount)`.
- Conditions: same as farm/sell with good='beans'.
- Consumes: beans, dearest variety first.
- Changes: same as farm/sell.
- Rewards: same as farm/sell, using buyer `mul.beans`.
- Duration: instant.
- Dependencies: sellGood, D.sellQuote.
- Failures: gameLocked, noBeans, notPlaying, paused.

**Sell one bean variety**
- Where: game.js:1124 `handlers['farm/sellVariety']`, sellVariety.
- Conditions: play gate. Region mode not 'cafe'. crop is a CROPS key. `n = min(have, floor(Number(amount)))>0`; a non-finite amount means all (this handler coerces with Number, unlike sellQuote).
- Consumes: n beans of that crop only (order [crop]).
- Changes: `inventory.beanMix`, beans, coins via earn, `stats.sold += n`. Events beansSold, goodsSold (parts with kinds).
- Rewards: coins = `round2(n x CROPS[crop].price x buyer mul.beans)`. No XP.
- Duration: instant.
- Dependencies: D.beanMix, D.beanPrice, D.buyerNow, earn.
- Failures: gameLocked, unknown, noBeans, notPlaying, paused.

**Sell everything stored**
- Where: game.js:1127 `handlers['farm/sellAll']`, D.sellAllQuote (derive.js:381).
- Conditions: play gate. Region mode not 'cafe'. Total quoted amount>0.
- Consumes: all of every good (beans, dried, roasted, bag).
- Changes: inventory emptied, coins via a single earn of the total, `stats.sold += total`. Events beansSold (beans part), goodsSold.
- Rewards: sum of each sellQuote part, each with its own buyer mul. No XP. GM-run sale bonus same as farm/sell.
- Duration: instant.
- Dependencies: D.sellAllQuote, GOOD_ORDER, earn.
- Failures: gameLocked, noBeans, notPlaying, paused.

**Start a processing batch**
- Where: game.js:1393 `handlers['prod/start']`, D.prodError (derive.js:646), D.missingInput (639), D.recipeIO (617), D.recipeIOFor (625).
- Conditions: play gate. Building uid exists in current region and its type has a recipe. Region mode not 'cafe'. No `b.job` running. Floor(input stock) >= need x batch (beans counted by processableBeans; no crop has rawOnly). coins >= fee. No storage check at start. Payload `{uid, by}` (by = staff unit).
- Consumes: inputs x batch, taken cheapest variety first (robusta, liberica, arabica). Fee x batch; +1 flat when a pulper is in reach (spend). dry 12 beans, fee 0. wash 12 beans, fee 2. roast 12 dried, fee 3. pack 9 roasted, fee 2.
- Changes: `b.job = {recipe, at: ctx.now, ms, out, xp, premium?}`; inventory down; coins down; `stats.batches +1`; unit practice 'process' when by is set. Event prodStarted.
- Rewards: none at start. Premium is stored on the job, and normalizeBuilding rebuilds `b.job` without it (state.js:762), so a batch reloaded from a save before collection pays no premium. Amount: sum over beans of `k x max(0, price-2) x RECIPES[].premium` (dry 1, wash 1.5; arabica 5 or 7.5 per bean, liberica 1 or 1.5, robusta 0), x premiumMulOf(unit) when by is set.
- Duration: `ms = round(seconds x 1000 / speed(level))` then `x (1 - pulper timeCut)` if in reach. seconds: dry 30, wash 20, roast 45, pack 40. speed L1-8: 1, 1.25, 1.25, 1.5, 1.5, 1.75, 1.75, 2. batch L1-8: 1, 1, 2, 2, 3, 3, 4, 4. Pulper timeCut L1-5: 0.3-0.5 (best in radius 12-16 m). Fixed at start. Runs on ctx.now wall time, not the played clock, so it keeps running while the game is closed.
- Dependencies: BUILDINGS dryer, wetMill (buildable); roastery, packer (retired, old saves only); pulper; RECIPES.
- Failures: unknown, noRecipe, gameLocked, jobBusy, noInput `{need, amount, have}`, coins `{missing}`, notPlaying, paused.

**Collect a finished batch**
- Where: game.js:1415 `handlers['prod/collect']`, D.collectError (derive.js:657).
- Conditions: play gate. `b.job` exists. `now >= job.at + job.ms`. stored<capacity (soft cap: one batch may overflow). No game-lock check in collectError.
- Consumes: nothing.
- Changes: goods added to the shared store; `b.job` deleted; `stats.produced +1`; `player.xp`. Events specialtyBonus (if premium), prodCollected, levelUp possible.
- Rewards: output x batch: dry and wash 12 dried, roast 9 roasted, pack 3 bags. Premium coins via earn (subject to loan cut), only if the job still carries the premium. XP = recipe xp x batch (dry 1, wash 2, roast 2, pack 2), via grantXp x (1 + xp blessing).
- Duration: instant once ready.
- Dependencies: D.capacity, D.stored, grantXp, earn.
- Failures: unknown, notDone `{remainingMs}`, storageFull `{capacity}`, notPlaying, paused.

**Scout for buyers**
- Where: game.js:1990 `handlers['supply/scout']` with group 'buyers'.
- Conditions: play gate. No scout in progress (one at a time, all groups, all regions). suppliersFound('buyers')<3. coins>=40.
- Consumes: 40 coins (spend, ledger 'research').
- Changes: `s.supply.scout = {regionId, group, until}`. Event scoutStarted. A finished scout is counted at once by D.suppliersFound and saved by settleSupply on the next supply or shop-beans action.
- Rewards: one more buyer in this region (max 3).
- Duration: 5 real minutes (`SUPPLY.scout.minutes`).
- Dependencies: SUPPLY.scout, `SUPPLY.buyers.count`, settleSupply (game.js:180).
- Failures: unknown, busy, maxLevel, coins `{missing}`, notPlaying.

**Choose buyer**
- Where: game.js:2016 `handlers['supply/setBuyer']`.
- Conditions: play gate. Integer i, 0 <= i <= buyers found (0 = storehouse). No lock in force for this region.
- Consumes: nothing.
- Changes: `s.supply.buyer[region] = {i}`. Event buyerSet.
- Rewards: subsequent sales use `buyerOf(region, i, dayKey)` multipliers per good, rolled per real day in [0.85, 1.3].
- Duration: instant; prices change each real day.
- Dependencies: D.suppliersFound, `research.js:97` buyerOf.
- Failures: unknown, locked, notPlaying.

**Lock buyer prices**
- Where: game.js:2025 `handlers['supply/lockBuyer']`.
- Conditions: play gate. Integer i, 1 <= i <= found. 1 <= days <= 3 (range-checked, not checked as integer). coins >= 50 x days.
- Consumes: 50 x days coins (ledger 'research').
- Changes: `s.supply.buyer[region] = {i, lockedUntil, mul: today's multipliers}`. Event buyerLocked.
- Rewards: today's multipliers held for the lock.
- Duration: days x 86400000 ms real time.
- Dependencies: `SUPPLY.buyers.lockFee`, lockDays, D.buyerNow.
- Failures: unknown, coins `{missing}`, notPlaying.

**Take a loan**
- Where: game.js:2481 `handlers['loan/take']`, D.loanError (derive.js:2244).
- Conditions: amount is one of 1000, 2000, 5000. That is the only live check: loanBlocked is hard-coded false; level, credit limit and open-count are not checked. Blocked only in phase 'expiry' (paused). Not subject to the notPlaying gate.
- Consumes: nothing up front; debt of `round(amount x 1.1)`: 1100, 2200, 5500.
- Changes: appends `{id, amount, owed, takenAtPlayed, termMin, late:false}` to `s.loans`; coins += amount (not booked as income); history row loanTaken. Event loanTaken.
- Rewards: coins = amount.
- Duration: instant. termMin is computed and stored but not enforced.
- Dependencies: LOAN.packs, loanOwed, D.loanTerm.
- Failures: unknown, paused. level, credit, loanMax, loanBlocked are unreachable.

**Repay a loan by hand**
- Where: game.js:2493 `handlers['loan/repay']`.
- Conditions: total owed>0 (else noop). amount null or positive finite. Not in phase 'expiry'.
- Consumes: `pay = min(owed, floor(coins), floor(amount))` coins; not booked as spending.
- Changes: reduces loans (late first, then oldest; none can be late today); `s.loans` filtered; history row loanPaid or loanRepaid. Event loanPaid or loanRepaid.
- Rewards: debt reduced.
- Duration: instant.
- Dependencies: D.loansOf, D.loanTotal.
- Failures: invalid, coins `{missing}`, paused.

**XP grant and level-up**
- Where: game.js:52 `grantXp`.
- Conditions: called by handlers: harvest crop.xp (robusta 2, arabica 4, liberica 6; 0 on Liberica's first wave), serve drink xp 2/4/6, venue items 1-3, recipe batch, `XP.build` 10, `XP.upgrade` 8, `XP.buyLand` 6, `XP.openRoad` 4, `XP.hire` 5, `FIELD.xp` 2 and `def.xp` on first copy.
- Consumes: nothing.
- Changes: `player.xp += round(amount x (1 + xp blessing))`. On level-up: event levelUp, autoTill if a region is current. If EXPIRY_ENABLED and level>=10 and not level10Done and no story.expiry and phase play: story.expiry pending, phase 'expiry', event expiryTriggered.
- Rewards: levels via levelForXp; gifts become pending.
- Duration: instant.
- Dependencies: xpForLevel, levelForXp (economy.js:898, 905), `EXPIRY_ENABLED=false`.
- Failures: none.

**Open a level gift**
- Where: game.js:2466 `handlers['level/claim']`, D.pendingGifts (derive.js:2210).
- Conditions: at least one level in 2..current not in `rewards.claimed` (else noop). level defaults to lowest pending. Not in phase 'expiry'; not subject to the notPlaying gate.
- Consumes: the pending gift.
- Changes: `rewards.claimed` push; coins (direct, no earn, so no loan cut and not income), beans (addBeans robusta, ignores storage cap), `rewards.tickets`. Event giftOpened.
- Rewards: normal: 40 x L coins. L2, L8: +1 hireTicket. L4, L7: +60 x L coins. Chest at L5/10/15 (replaces normal gift), weights: jackpot 3 = 150 x L; helpers 2 = 2 tickets + 40 x L; beans 2 = 30 beans + 60 x L; auto 1 = 120 x L coins.
- Duration: instant.
- Dependencies: levelGift, chestPrize, CHEST_LEVELS; roll from payload (default 0 picks jackpot; the HUD uses Math.random, `src/features/hud/gifts.js:14`).
- Failures: level, paused.

**GM away settlement**: see section 8.

### Money facts

- GOODS prices: beans 2, dried 4, roasted 9, bag 33. CROPS raw price: robusta 2, liberica 3, arabica 7. GOOD_ORDER: beans, dried, roasted, bag. ITEM_GOODS: dried, roasted, bag.
- Value added per L1 batch from robusta at storehouse price: dry +24, wash +22, roast +30, pack +16.
- roastery, packer and warehouse have `retired: true`; D.buildError (derive.js:568) returns 'unknown'. On a new save the buildable chain ends at dried; roasted and bags exist only on old saves that already have those buildings.
- Dried, roasted and bag carry no variety: a variety's extra value is paid only as the premium on the dry or wash batch.
- Storage: D.capacity (derive.js:41) = STORAGE_BASE 30 + sum silo capacity + sum warehouse capacity. `stored() = floor(beans)+dried+roasted+bag`, 1 space each.
- Storage is a soft cap: farm/harvest (game.js:1004), farm/deposit (1102) and prod/collect refuse only when stored >= capacity, so a single addition can overflow. shop/buyBeans clamps to storageRoom. Gifts ignore capacity. prod/start has no storage check.
- Buyers: research.js SUPPLY.buyers = `{count 3, swing [0.85, 1.3], lockFee 50, lockDays [1, 3]}`. `buyerOf(regionId, i, day)` rolls one multiplier per good per real day; i 0 = storehouse x1. Selection and locks are per region.
- Sale prices are flat per unit: no market saturation, quality or star effect in sellQuote.
- LOAN = packs [1000, 2000, 5000], fee 0.1, autoRepay 0.2, maxOpen 2, packLevel `{1000:4, 2000:6, 5000:8}`, creditMul 1.5, creditLevelStep 0.1, term `{mul 2, minMin 30, maxMin 150, round 10}`, lateFee 0.05. Live effect today: packs, fee, autoRepay, and term through the manager's borrow decision (gmLoanFor compares payback with loanTerm x `GM.loanRule.paybackTermShare`, so a changed term changes whether gmPermission returns 'loan'). `ln.termMin` is stored but unused, and lateness has no consequences.
- creditLimit (derive.js:2227) = `round(1.5 x I(L) x 10 x (1 + 0.1 x level))`; only referenced from loanErrorData's unreachable branch. INCOME_REF farm `{1:80, 3:150, 6:250, 10:310, 15:440, 20:550, 30:750}`, cafe `{1:80, 3:200, 6:440, 10:620, 15:1050, 20:1300, 30:1800}`, linear between keys, flat past 30.
- Loans have no in-reducer term, late fee or block. A player can open unlimited loans of any pack at any level from any non-expiry phase.
- XP: LEVEL_XP cumulative by level index = [0, 0, 20, 50, 95, 160, 250, 370, 520, 700, 920]. Above L10: previous + 260 + 40 x (l-10), so L11 = 1220, L12 = 1560, L100 = 188120 (computed from the formula). MAX_LEVEL 100. levelForXp caps at 100.
- Selling gives no XP. XP multiplier is 1 + 0.1 x stacks of the xp blessing.
- Level gifts start at L2 (L1 has none). L4 total = 400 coins, L7 total = 700 coins, L2 = 80 + ticket, L8 = 320 + ticket. Gifts continue at 40 x L past L15 with no end besides MAX_LEVEL. Unclaimed gifts stack.
- START.coins 60, PLAYTEST.coins 0. BEANS: sellPrice 2, buyPrice 4, buyPack 10, grace 3.
- `GM.alwaysApprove` applies to GM plan items via D.gmCandidates. Player sales are not gated by it.
- GM salary is charged per minute of a 10-minute rate.
- No 'round/' handler exists in game.js, though 'round' remains in the PAUSABLE regex.

---

## 8. Away from the game, story and tools

**Return from closed game (manager side)**
- Where: game.js:345 `gmBack`.
- Conditions: GM hired; `now - max(gm.payAt, gm.seenAt) >= TASKS.returnAwayMin` (5 min). Called from gm/seen and from gm/payroll when payAt is set.
- Consumes: see gmAwayPay.
- Changes: runs returnGrace, gmAwayPay, then `gm.payAt = now` if payAt was set. Applies no per-hour loyalty drop.
- Rewards: see gmAwayPay.
- Duration: instant, computed from the real-time gap.
- Dependencies: returnGrace, gmAwayPay, TASKS.returnAwayMin.
- Failures: returns false with no GM or a gap under 5 min.

**Away earnings of the manager**
- Where: game.js:281 `gmAwayPay`.
- Conditions: GM hired, `gm.payAt` non-zero, `awayMin >= GM.away.minMinutes` (5). Called through gmBack.
- Consumes: `salary = r2(gmSalary * mins / GM.payMinutes(10))`, paid only as far as coins allow.
- Changes: `gm.payAt = now`. Income booked via earn with ACTOR 'staff' (loan cut and arrears first). Salary via spend and ledger 'wage'. gm day row, 'away' log, `s.gm.fm.away` summary `{at, minutes, awayMinutes, earned, salary, net, ripe, empty, orders}`. Short pay: `debt.wages.gm += short` and `loyalty -= GM.loyalty.unpaidPerMin * mins * short/salary`, limited by `PENALTY.returnLoyaltyCap` (40) minus `returnCap.lost`. If arrears >= `GM.quitArrearsSalaries` (10) salaries the GM quits (gmLeave 'quit').
- Rewards: `earned = r2(max(0, rate) * share * mins)`; `mins = min(120, awayMin)` (`GM.away.capMinutes`); `rate = net / distinct ledger minutes` in the 30 wall minutes up to payAt (`rateWindowMin`), 0 when fewer than 5 minutes have rows; `net = sum(earned - (spent - hire - upgrade - gm))`; `share = GM.away.share[mode]`, only full = 0.7. Events gmAway, gmUnpaid. Re-read at game.js:287-294: the rows are `staff.ledger` wall-minute rows, not income played rows.
- Duration: lump sum at return; counts min(120, away minutes).
- Dependencies: `s.staff.ledger`, D.gmOf, D.gmZone, earn, spend, gmLeave.
- Failures: silent return: no GM, no payAt, away under 5 min, or (earned<=0 and share<=0).

**gm/seen**
- Where: game.js:2438 `handlers['gm/seen']`.
- Conditions: play gate; GM hired, else noop.
- Consumes: via gmBack.
- Changes: runs gmBack; if GM still present sets `gm.seenAt = now` and clears moodNote 'absent'.
- Rewards: via gmBack.
- Duration: HUD sends at most once per `GM.mood.seenEverySeconds` (60), plus forced on tab visible.
- Dependencies: gmBack.
- Failures: notPlaying; noop without GM.

**Offline crop growth by timestamp**
- Where: derive.js:333 `plotState`, `plotGrowMs`.
- Conditions: a planted plot in `region.plots`.
- Consumes: nothing.
- Changes: nothing stored. Stage is derived from `now - plantedAt` with no clock and no cap, so closed time counts in full.
- Rewards: plants ready on return.
- Duration: plotGrowMs as in section 2. Config: robusta 60 s / 36 s, arabica 120 / 80, liberica 240 / 150. Fast seeds: min(4000 ms, base).
- Dependencies: CROPS, wellBonus, climateEffect, gardenOf, dripCovers, methodEffect.
- Failures: stage 'empty' when no plot.

**Late harvest effects after being away**
- Where: game.js:998 farm/harvest.
- Conditions: play gate; plot exists; stage ready; stored<capacity.
- Consumes: drip line fee if covered and affordable.
- Changes: `overMs = now - plantedAt - plotGrowMs`. Player pick is 3 stars only within `freshSeconds * garden.freshMul` of ripening, else 1. Tree stays, `plantedAt = now`.
- Rewards: beans per stars; Arabica loses `1 + floor((overMs - 30 s) / 20 s)` beans once over 30 s, minimum 1.
- Duration: instant.
- Dependencies: plotState, garden, climate, QUALITY.
- Failures: notPlaying, empty, notReady `{remainingMs}`, storageFull `{capacity}`.

**Cafe pause / resume**
- Where: game.js:1157 `handlers['shop/pause']`, `handlers['shop/resume']`.
- Conditions: play gate.
- Consumes: nothing.
- Changes: `pausedAt = now`; resume adds the pause length to each order's at, takenAt, brewStart and clears pausedAt.
- Rewards: none.
- Duration: any.
- Dependencies: `r.shop`.
- Failures: noRegion; noop if already in that state.

**Story to gate**
- Where: game.js:913 `handlers['story/introDone']`, `handlers['story/teacherDone']`.
- Conditions: none. Outside phase intro introDone returns undefined, not `{noop:true}`, so apply treats it as a success: state cloned, rev +1, updatedAt set, and the store saves and notifies listeners, with no other change.
- Consumes: nothing.
- Changes: intro to teacher; teacherDone sets teacherMet and moves teacher, intro or select to gate.
- Rewards: none.
- Duration: instant.
- Dependencies: createSave with a character gives phase intro.
- Failures: none.

**Unlock region**
- Where: game.js:926 `handlers['world/unlockRegion']`.
- Conditions: valid region id.
- Consumes: `regionCost = round(baseCost * CITY_TIER[n])`; 0 while ownedRegions is empty or freeUnlocks>0 (vn baseCost 300, tier 1 = 1).
- Changes: ownedRegions gets the id; freeUnlocks -1 when free and not the first.
- Rewards: event regionUnlocked.
- Duration: instant.
- Dependencies: D.regionUnlockCost, D.ownsRegion.
- Failures: unknown; coins `{missing}`; noop if owned.

**Enter region**
- Where: game.js:938 `handlers['world/enterRegion']`, freshRegion (877).
- Conditions: phase gate, chooseRegion or play; region owned.
- Consumes: nothing.
- Changes: first visit: freshRegion = home estate parcels plus S, open roads, starter buildings orderCounter, brewCounter, terrace, `fields []`, `tilled {}`. Revisit: ensureStarters (re-adds F1-1..F1-6 if the region has no field at all). currentRegion set, mode = game if offered, phase play, startCountry set, unassigned units join.
- Rewards: events regionFirstVisit, regionEntered.
- Duration: instant.
- Dependencies: D.regionAccess, D.currentGames, normalizeRegion.
- Failures: phase; unknown; locked `{cost, free, affordable, missing}`; expired.

**Choose game for region**
- Where: game.js:2670 `handlers['play/chooseGame']`.
- Conditions: a current region; region mode not yet set; game offered by regionGames (cafe filtered out while CAFE_ENABLED false).
- Consumes: nothing.
- Changes: `r.mode` and `s.mode` = game.
- Rewards: none.
- Duration: instant.
- Dependencies: D.currentGames, CAFE_ENABLED.
- Failures: invalid; phase; gameLocked (any cafe choice now); noop if mode already set.

**Dev set / grant / ripen**
- Where: game.js:2688 `handlers['dev/grant']`, `dev/set`, `dev/ripen`.
- Conditions: `ctx.dev` true. Not phase-gated. A region is needed only for dev/ripen to do anything.
- Consumes: nothing.
- Changes: dev/set writes coins (0..1e15), beans, `xp = xpForLevel(level)`, level capped by MAX_LEVEL because EXPIRY_ENABLED is false. dev/grant uses earn, addBeans (robusta), grantXp. dev/ripen sets every `plantedAt = now - 1e9`.
- Rewards: as set.
- Duration: instant.
- Dependencies: xpForLevel, earn.
- Failures: forbidden when `ctx.dev` is false.

**Existing test harness**
- Where: `tests/core/helpers.mjs:11` `harness`, `playing`.
- Conditions: none.
- Consumes: nothing.
- Changes: harness: `createSave(T0, female/Test)`, dev default true, act, must, tick, go, region. playing: story/introDone, story/teacherDone, `go('vn-1')`. `PLAYTEST.coins` forced to 0 (already 0).
- Rewards: none.
- Duration: `tick(ms)` moves `h.now` only; it never sends clock/tick.
- Dependencies: apply, createSave.
- Failures: must throws `<type> failed: <error> <data>`.

**Economy simulation**
- Where: `scripts/economy-sim.mjs:96` `runSim`.
- Conditions: minutes, options game both, farm or cafe, persona tapper, delegate or neglect.
- Consumes: nothing outside its save.
- Changes: drives real apply with dev false, enters vn-1 (fr-1 for cafe), one action per tap (1200 ms, 2400 ms managed; 500 ms step when idle). Returns log, perMinute, failures, counts, spans, bugs and more.
- Rewards: none.
- Duration: simulated minutes.
- Dependencies: apply, D.*, STAFF_SIM, `GM.value.jobsPerMin`.
- Failures: caught reducer throws go to `bugs[]`; refused actions counted in failures by type:error.

**Sim team loop**
- Where: economy-sim.mjs:299 `findJob`, `teamStep`, `react`, `hireCheck`, `answer`, timers.
- Conditions: persona delegate or neglect (managed); timers run only in phase play with a region.
- Consumes: via dispatched actions.
- Changes: each unit earns credit `dt * stateSpeedMul * 1/realmJobSec` (or jobsPerMin/60 with jobRate 'ref'); jobs are harvest and plant on farm, serve, brew, takeOrder in cafe. Sends staff/stop, staff/jam, staff/vitals every 10 s, staff/workDone every 3 jobs, staff/care after reactMin, hire check every 15 s, staff/upkeep and gm/seen every 60 s, gm/payroll every 60 s, gm/think by D.gmThinkSeconds, gm/rivalVisit, rival/visit, staff/mvp, loan/tick. Non-managed: only clock/tick.
- Rewards: none.
- Duration: `realmJobSec = 0.35 + walk metres (harvest 3, plant 1, water 3, order 1.5, brew 1.5, deliver 8) / speed (worker 2.6, robot 3.2) + work / unitSpeed + 1.2 s` after planting without 'quick'.
- Dependencies: `STAFF_SIM.work`, D.unitTasks, D.unitWorking, D.quickFix, STAFF_BREAKS.
- Failures: no job returns null, credit capped at 0.5.

**Sim gates**
- Where: economy-sim.mjs:628 `runGates`.
- Conditions: runs 10, gmSeeds 10 by default.
- Consumes: nothing.
- Changes: runs tapper, delegate, neglect for farm and cafe and builds PASS, FAIL, SKIP rows: Lv10 played minutes 9-25, mandatory cost <= 25 %, upgrade payback, loan payback >= 90 %, neglect fines 8-12 % I30, no negative coins, manager acts, GM net value.
- Rewards: none.
- Duration: long runs 45, 110, 130 minutes, loans 220, GM value 110 per seed and arm.
- Dependencies: runSim, GM_RULES data.
- Failures: exit code 1 via printGates when a gate fails.

### Away facts

- Only timestamp-based state moves while closed: plots (plantedAt), production (`job.at + ms`), `research.busyUntil`, supply timers, GM away lump sum. `s.clock.played`, inbox deadlines, tenure, loan terms and the income series stop. Staff do no work offline. Bench upkeep bills at most 10 minutes. There is no offline per-crop simulation; gmAwayPay is a ledger rate estimate.
- Return order: whichever of clock/tick, gm/seen, gm/payroll comes first opens the return. returnCap makes returnGrace once-only with a GM; gmAwayPay is protected from double pay because it sets `gm.payAt = now`. Without a GM, grace runs only from clock/tick.
- Save keys: `<key>`, `-prev`, `-corrupt`, `-backup`, `-pre-expiry`, `-pre-layout5`.
- normalizeRegion does not return `r.tilled`, so it is lost on every reload and D.fieldAllowance then uses its old-save branch. With `fieldCost()=0` this has no coin effect today.
- migrateLegacy returns tutorial `{step:0, done:false}` with no farmDone. Until the next reload normalizes it, farm/plant adds `fast:true` (game.js:978) for a migrated save. After normalizeSave, farmDone comes back true from the base save.
- withEstates always adds the home estate, even for an empty or expired record, so a record with no parcels gains 9 lots.
- ensureStarters (game.js:899-903) gives a region with zero fields F1-1..F1-6 on re-entry, while freshRegion starts with `fields []`. access.current returns early at game.js:942, so re-entering the current region does not trigger it; it requires leaving and coming back.

### Why existing tests and the sim drift from the code

Test counts come from a read-only text scan of `tests/core/*.test.mjs` (174 `test()` blocks). The scan cannot say which test fails; only `npm test` can.

1. `staff/hire failed: unknown`. STAFF no longer has farmhand or sproutBot (economy.js:319-338). D.staffError returns 'unknown' at derive.js:778. toCrew converts these types only inside normalizeSave. 29 tests name these types (staff-manager 12 of 16, management-rules 9, core 5, edge 3). Replace with picker, planter, waterer and harvestBot, plantBot. Expected numbers change too: picker 150, planter 130, harvestBot 1200; old tests assert values such as `staffFee('sproutBot')=36`, which now returns 0 because the type is unknown (economy.js:891).
2. `farm/plant failed: notOwned`. freshRegion sets `r.fields=[]` (game.js:883). D.plotOf finds nothing and plotById('F1-1') still finds the static layout id, so game.js:965 returns notOwned. autoTill is retired. 31 tests reference classic plots or plotsOf, ALL_PLOTS, ownedPlots (core 13, farm-world 13, edge 4, staff-manager 1). 56 of 174 tests match cause 1 or 2.
3. Estates. A new region owns the whole home estate plus S. land/buyParcel on those is a noop; other farm lots buy their whole estate in order and any lot out of order returns 'order'. Stale: core.test:659 (parcels ['F1']), farm-world.test:306 (fields 6 from buying F3), core.test:144-145 (W1, D1 notOwned). 11 tests use land/buyParcel.
4. Free placement. build/place on farm no longer returns limit, level, round, onRoad, terrain_*, edge or lot-based notOwned. Stale: core.test:143-154, farm-world.test:85-87, 122-138, 156. fieldExtraCost still exists in config but is unused by fieldCost.
5. Silo is not a starter (economy.js:194). Starters are orderCounter, brewCounter, terrace, so core.test:28 expecting four including silo is stale.
6. Hire limits. Slots and hire cap are 30, not the player level, and every robot is level 1. Stale: core.test:213,218,224,805, staff-manager.test:31,67,70, management-rules.test:812,825.
7. Level-10 off. edge.test toLevel10 asserts phase 'expiry' (edge.test:24); economy.test 'expiry executes once' expects 1 event; core.test's incident section uses it. In runGates regionNo stays 1, so neglectFrom stays null with neglectRegion 2 and GM-value hires with region>=2 are never found.
8. Cafe off. `play/chooseGame {game:'cafe'}` returns gameLocked (core.test:497,515, farm-world.test:173). A region left with mode null still accepts farm and cafe actions (otherGame at game.js:25), so helpers.playing() is not itself stale.
9. Tutorial removed. createSave has `tutorial.done:true`, so fast seeds never apply to a new save; core.test:31 needs a tutorial state set explicitly as well as a field.
10. Manager rules. gmBack has no away loyalty drop, so management-rules.test:506-508 (l0 - 30 after 5 h) contradicts the code. Tests of sit-ins or chaos are stale.
11. The sim never places fields. economy-sim.mjs has no build/place of type 'field' and no farm/plantAt (only ownedPlots loops at lines 303, 304, 378, 538). A new region has no owned plots, so farm actions never run. Farm-only runs have no crop income; economy.test farm tests (Lv10 timing, roastery built, batches > 50, no stall) cannot pass as written. roastery and packer are retired, so goal() skips them and STAGES 'roast' and 'pack' have no buildings.
12. Sim drift. The uncommitted diff only renamed farmhand to picker and sproutBot to harvestBot. netWorth counts `PARCELS[id].cost` for every owned lot (home estate lots sum 18330 at start; upland lots sum 18930 versus 1500 paid). nextLand and invest use `p.cost`, not estate cost, so canSpend(180) can pass while buying F3 needs 1500 and fails with 'coins'. Sim `may()` lets any worker with empty tasks plant because D.unitTasks is [] for a picker, whereas `STAFF.picker.jobs` is ['harvest'] only. gm/hands, water, haul, prune, process jobs are not modelled.

---

## Water, exactly

- **Storage.** There is no water resource in saved state. The only quantity is the realm entity field `e.water` (staff.js:294, 985, 995), set to 0 when the entity is created, so it is not saved and resets when entities are rebuilt. Units also have a saved `u.water` field (game.js:818 sets 0; state.js:229 clamps 0..9), but nothing in the water job writes it.
- **Carry.** bucketOf (economy.js:770): worker = `TEND.bucketPlots` 4 + `GEAR.items.can.plots[tier 0..3]` 0,1,2,3 + `CREW.perStamina.water` 1 x (stamina-1). Stamina is 1..10 on the farm (maxStatOf, economy.js:704), so worker range is 4..16. Robot = `CREW.robotBucket` 8 + `CREW.perBattery.water` 2 x battery tier. The unit is plants per trip, not litres.
- **Consumption.** Exactly 1 bucket unit per pour, regardless of crop, plot or level (staff.js:995). The player's and the manager's watering consume nothing.
- **Effect.** Each watering subtracts from plantedAt, so a plot with less time left than the saving becomes ready immediately. Worker `0.3 + 0.03*(accuracy-1)`, robot, player and manager 0.30. Once per season: harvest deletes `watered`, including Liberica's first pick.
- **Where tanks can be built.** Anywhere on an owned tier inside BOUNDS (x -32..32, z -76..28), including roads and lot edges, provided ground is flat within 0.25 m under corners and centre, all on one tier, not overlapping fields or buildings, and the region is not in cafe mode (derive.js:455-474, 566-577). Size [1,1].
- **Tank capacity.** None. `BUILDINGS.well.effect` has only grow and radius; no stock field exists. Tank level does not affect refills.
- **Replenishment.** Not applicable. A tank is an infinite free source; nothing depletes or regenerates.
- **Refill.** Only when `e.water<=0` at job selection. The unit walks to machineSpot of the tank with minimal unit-to-tank plus tank-to-plant route, waits the work time (waterer 1 s, waterBot 0.7 s, divided by speed factors), and `e.water` is set to full bucketOf. No coin or stock cost. No partial top-up.
- **Sharing.** Refill points serve unlimited units concurrently. No claim is taken on the tank (startJob claims only `plot:<id>`, staff.js:886), no queue exists, and machineSpot gives the same stand spot to all; separate() only pushes overlapping units apart (staff.js:571).
- **With no tank.** A unit with `e.water>0` keeps pouring until empty. With an empty bucket and a target plot, farmJob sets `e.reason='noWell'` and returns null (staff.js:686); icon noWell, label WAITING_FOR_WATER; the unit wanders (staff.js:1422) and rechecks about every 1..1.5 s. The player and manager can still water. Passive aura absent. New farms have no usable tank: the FARM_WELL model at (-3.5, 25.3) is never shown: the group is set `visible=false` (staff.js:168) and the Gedeo load (staff.js:171) only adds the model inside that hidden group. It is never a water source.
- **Stacking.** Waterer and RainBot also give a global passive growth bonus while working via `STAFF.effect.growSpeed`: waterer 0.15 x levelSpeed (`CREW.speedCurve`, so 0.0975 at speed 1), waterBot 0.20, added in staffBonus to every field's speed (derive.js:36-37, economy.js:323,333). It is independent of watering. Well aura and watering stack: aura is a growth speed term, watering is a plantedAt jump. Drip and manual watering are mutually exclusive (drip factor applies only if `!p.watered`; farm/water noops under drip).
- **Thirst display.** plotNeeds (derive.js:56) returns 'thirst' without checking dripCovers, so a drip-covered plot at ratio>=0.5 counts as thirsty in farmWorkload and tapping it dispatches a noop farm/water.
- **Manager load sample.** taskQueue (derive.js:1341-1348), read only by manager planning and load, counts water demand only if an assigned unit has saved `u.water>0`. The water job writes `e.water` only (staff.js:985), and new units start at 0. farmJob selects water jobs without taskQueue.
- **Costs.** waterer hire 120 (economy.js:323), waterBot 1000 (economy.js:333); can tiers cost 80, 160, 320 (`GEAR.cost`). well cost 200, costGrowth 1.5, refund 0.5, 8 levels. dripLine cost 180, costGrowth 1.5, refund 0.5, upgrades 120/300/700/1500, 5 levels, size [3,1], fee 1.
- **Walking speeds.** Staff worker 2.6 m/s, robot 3.2 (economy.js:843), player SPEED 5.2 (`src/features/realm/avatar.js:11`), GM walkSpeed 2.8 (economy.js:613). Wander walks at speedK 0.55 unless returning to its tier.
- **Terraces.** TIER_CUTS (layout.js:163): spine ramp x 0, half 1.5, len 8.5; stone steps x -15 and x 15, half 1.05, len 6. TIER_EDGES: z -2.5 (h 2.2), z -20.5 (h 4.4), z -51.5 west / -46.5 east (h 6.6). Hard wall bands block everything else, leaving gaps of cut half-width + 0.45 (index.js:168-175).
- **Nav grid.** 0.5 m cells, agent radius 0.45 in the realm (index.js:180; default 0.35), 8-neighbour, MAX_ITER 40000, shared by player, staff, customers, manager.
- **Estimate vs real walk.** farmRouteDist ignores buildings and chooses the cut greedily by x only, while nav.path finds the real route. Selection uses the estimate; movement uses the grid.
- **Layer.** The water job runs only in the realm update loop in staff.js. No water job logic exists in the core handlers beyond farm/water.

---

## Logic that exists only in the realm layer

A headless model has to reimplement or approximate everything below. Reducers only apply finished results.

**Timers and dispatch cadence**
- staff.js:1290 teamTimers, called at line 1467 only when `!paused`, is the only sender of the periodic actions. The code comment says the loop stops when the tab is hidden or the game is paused.
- Full-clone dispatch cadence: clock/tick every 5 s (12/min); staff/upkeep every 60 s (`TICKS.upkeepSeconds`) when units exist, plus once at start (staff.js:1299, staff-brain.js:211); gm/payroll every 60 s with a GM or when payAt is unset (staff.js:1317); loan/tick every 60 s with open loans (staff.js:1295); gm/hands every 2 s (`FARM_MANAGER.hands.everySec`) when `fm.auto` is on (with skip = plots in the claims map); gm/think every D.gmThinkSeconds, 5 s at speed 1 to 2 s at speed 10; staff/mvp every `BOOKS.mvpMinutes` = 10 min; rival/visit `RIVAL.everyMinutes` 8 per zone with workers; softwareRound every 5 s; gm/rivalVisit every `GM.poach.everyMinutes` 45 min. Without clock/tick, played time does not advance; a headless harness must send it itself.
- staff/vitals per unit every `vitalsInterval(n)=max(5, n/2)` seconds (staff-brain.js:213), so at most about 2 per second team-wide. Skipped when vitalsNoop holds and under 30 s is held back (staff.js:478,487).
- Realm frame dt is clamped to 0.1 s at index.js:1291. Re-read: that same dt goes to `staff.update` (index.js:1320) and into teamTimers (staff.js:1467), so played time and staff work lose whatever exceeds 0.1 s per frame.
- index.js:396 QUIET set (staff/vitals, clock/tick, gm/payroll, gm/think): with no events the realm listener defers its re-sync. The clone and state replacement still happened.
- index.js:282-283 dispatches shop/resume and shop/pause, which control D.shopPaused and hence the cafeClosed gate.
- `src/features/hud/index.js:270-283` fires gm/seen on pointerdown, keydown, a 1.5 s boot timer and on returning visible, at most once per 60 s except when forced.
- `Math.random` roll for gm/think comes from the realm (staff.js:1315). Chest roll comes from `src/features/hud/gifts.js:14`.
- Store creation with `saveEveryMs` 1500 and legacy keys, plus flush on pagehide and hidden tab: `src/app/game.js:43-44, 558-560`. The pre-expiry backup is written by the store, not the reducer: store.js:78-80.
- Sending the player away from a cafe city while CAFE_ENABLED is false: `src/app/game.js:343-345`, not enforced in the reducer.

**Per-unit job loop**
- The whole loop: farmJob, shopJob, near() scoring, startJob, work timer, finish(). No reducer ever advances a staff job.
- Think delays between jobs (.35 s, 1.2 s plant, 0, idleThink 1-1.5 s).
- Walking: grid paths (nav.js), steer dodging, separate() pushes, step-aside, stuck detection and avoid map (15 s, 12 s). A headless model can use farmRouteDist (layout.js:194) as distance, which the realm uses for selection, but actual paths come from nav.
- Claims (plot:, station:, order:) that prevent two units doing the same job; gm/hands receives them as skip.
- Crowd penalty and tier preference in near(), homeOnly and homeFirst.
- Crew skill gates are enforced only in staff.js, not in the handlers: hardCrop (staff.js:640,652; SKILL_GATE smart 2, frame 1) and oldTree (staff.js:693; smart 3, motor 2). farm/plant, farm/harvest and farm/prune accept any uid.
- Tier-bound work: staff.js:603-619 and 1160-1171 keep a unit to its tier via tierIndexAt. Core handlers do not check the unit's tier and have no walking or distance requirement.
- Water: bucket count `e.water`, requirement of a tank (staff.js:685-686; farm/water does not check it), fetch step, refill and bucket deduction (983-996), driestFirst and near target choice (681), noWell status and WAITING_FOR_WATER (686,868), hidden FARM_WELL visual (152-171), and the tap gate at plotNeeds 'thirst' (index.js:640-641).
- Multi-leg haul trips: load, chain, drop as separate jobs (cargo itself is saved).
- Funny incident rolls (funnyRoll), goof rolls, walks and holds (goofRoll, goofHold).
- Mistake rolls: unripe, crooked, drop, spill, wrongTable. Reducers receive only booleans; `crooked` and `unripe` are payload flags (game.js:959 comment: realm roll, mistakeChance).
- Secondary harvest (twoPlots), two cups, chain brew.
- Robot battery timer `e.workT`, including its reset on any resume; not saved. Jam roll per job (jamChance) and vJobs for wear. Worker phone slack roll (cafe only).
- Work and rest second accounting and batching into staff/vitals, workDone batching, overheat clear trigger (timerDue).
- softwareRound: autoCharge and autoUnjam. Robot auto task re-pick every 30 s (autoTask) for brewBot.
- Staff processing jobs dispatch prod/start and prod/collect with `by` = unit (staff.js:1004). Tapping a building with a ready batch dispatches prod/collect (index.js:652).
- Cafe posts and pad logic (assignPosts, pickShopJob are pure in staff-brain.js and reusable), customer spawn, queue, seats and patience leaving in cafe.js (shop/spawnCustomer, shop/customerLeft, getSeat, getQueued), street venue sales in street.js.

**Manager**
- Core has no timer of its own; staff.js gmTimers (1313-1320) drives it.
- Order pickup: staff.js:657-659. A unit that takes the job claims `station:<order id>`, skips openField orders if 4 or more plots are empty, walks to freeFarmSpot near orderSpot, holds 2.5 s, then dispatches gm/execute at staff.js:1007. The core has no timer for orders.
- Stuck handling, avoid list and claims (`FARM_MANAGER.stuckSeconds` 15, `avoidSeconds` 12) are in staff.js.
- Manager walking and pointing in the world is cosmetic, in `src/features/realm/manager.js`, driven by gmActed events; not read in this pass.

**Land and presentation**
- Placement ghost and snapping preview: realm.startPlacement, started from `src/features/hud/sheets.js:65`; land overlay modes 'build' and 'expand' in `src/features/realm/world.js:1161-1208` and index.js:1150-1189.
- Moving a tier signboard: index.js:1437 and 1570 use type 'tierSign' as a ghost. No building is made and no build/* action is dispatched for it.
- Estate signboards and forest beyond the next estate come from frontierParcels (derive.js:185) rendered by the realm; only the next estate's lots are listed for sale.
- farmGroundY is presentation and picking height for the realm, but core also uses it in placementError for the flatness check, so it is not purely visual.
- Liberica and old-tree visuals read `pl.wave` and age in `src/features/realm/plots.js:535,599,608`.

---

## Contradictions between code and docs

Doc paths are under `docs/design/` unless given in full. "Code" states what runs.

| Area | Topic | Code | Doc or other source | Where |
|---|---|---|---|---|
| Loans | Overdue loans and late fee | loan/tick returns noop at its first line (founder note 2026-11-08: no term, no late fee); late logic after it is dead; D.loanBlocked always false; loanOf always late:false | management-rules §4.5: past term, owed x1.05 once, `ln.late=true`, new loans blocked; term clamp 30..150; summary table line 32 repeats it. CLOCK and LOAN comments also describe it; `LOAN.lateFee`=0.05 still configured | game.js:2513-2525, derive.js:2225, management-rules.md:32,539-551, economy.js:47-48,941-946 |
| Loans | Loan limits | loanError only checks pack is valid; comment says borrowing is unlimited; state.js:419 says no cap on open loans. HUD branches for level and loanMax locks never fire | LOAN.maxOpen 2, packLevel 1000:Lv4 2000:Lv6 5000:Lv8, creditLimit, loanAllowed in §4.5. Config holds these; comments at state.js:45 and game.js:2480 say at most maxOpen. level-progression §6 says borrow repeatedly, matching code | derive.js:2244-2249, state.js:45,419, management-rules.md:32,266,542,550,602, economy.js:948-951, sheets.js:490-493 |
| Loans | Term multiplier | `LOAN.term.mul`=2 (comment: changed from 1.5 on 2026-11-08) | §2.7 table says 2; summary line 32, line 602 and the §4.5 worked example use 1.5 | economy.js:950-951, management-rules.md:32,268,554,602 |
| GM | Backlog consequences | `PENALTY.backlog` waitAt, poachAt, strikeAt all Infinity (founder 2026-11-08: no sit-ins); gmWaiting false; gmStrike null; normalizeGm forces backlog 0, chaos null | management-rules: backlog 3 Cho lenh for 10 min, 6 poachable, 8 strike with chaos; §3.3 backlog >=3 slows. farm-crew 11 agrees with code | economy.js:81, state.js:334,357, management-rules.md:278,341,505-507 |
| GM | Poach offer life | `TASKS.life.gmPoach`=180 played minutes | poach / gmPoach life 1 / 3 played minutes | economy.js:60, management-rules.md:481 |
| Engine | Return grace trigger | first clock/tick after a gap of at least 5 min runs returnGrace even with no manager; gm/seen and gm/payroll can also trigger it through gmBack | §4.1 names gm/seen after at least 5 min away; §8 Q10 still open | game.js:333,345,2541, management-rules.md:484,680 |
| Engine | Team ledger scope | ledger also written for research fees, GM hire fee, GM wages and task wages (lines 1946, 1968, 1998, 2010, 2032, 2047, 2334). Code comment says 'game minute' though key is `floor(now/60000)`, wall time; game.js:291 comment says minutes of play | s.staff.ledger and daily stay wall-clock, staff-only | game.js:772-794, management-rules.md:115 |
| Engine | Income series actors | by keys player, g1, staff, penalty, system | §2.0 defines by as { player, g1, staff }; §4.3 books 'penalty' | economy.js:43, management-rules.md:115,510 |
| Progress | Level-10 wipe active | `EXPIRY_ENABLED=false` (temporary, 2026-11-09); never fires; saved pending cleared on load. Atlas how-to still shows the Lv10 warning whenever !level10Done; top-bar and banner check the flag | Rules, career timing, history retention, v3-gdd §2 §5, level-progression §3 §6 (Lv10 chest lost in first region), economy.js comments, sim header and gates all assume it is live | economy.js:912,966, game.js:57, state.js:83, atlas/index.js:267, management-rules.md:208,562, level-progression.md, v3-gdd.md, scripts/economy-sim.mjs lines 642,702-716,735, tests/core/economy.test.mjs |
| Progress | What the incident wipes | full restart: coins to 60, XP 0, round 1, goods, regions, owned regions, staff, GM | v3-gdd §5: keeps coins, level, XP, round, beans, land titles, unlocked regions, staff ownership. level-progression agrees with code | game.js:2575-2635, v3-gdd.md §5 |
| Progress | What survives the incident | s.loans, s.clock, s.research, s.supply, s.farmLab, s.stats, plan and approval history, GM board and licences untouched | comment: 'Nothing is kept except who you are (character, story, rebirth credits/blessings, auto runs, tutorial done)'. level-progression mentions recipes, maybe a follower, the loan | game.js:2579-2580, level-progression.md |
| Engine | History repaint signal | store has no 'history' event; listeners receive (state, events, type); no event of type 'history' emitted | repaint is event-driven via store event 'history' | store.js:85, management-rules.md:568 |
| Crops | Crop unlock level | all crops plantable at level 1; CROPS.level not enforced | coffee-varieties §2: Robusta Lv1, Arabica Lv3, Liberica Lv5. level-progression lines 12, 56. economy.js holds 1/3/5 | derive.js:169, economy.js:123-127, coffee-varieties.md:25, level-progression.md:12,56 |
| Crops | Level-up banner | levelUnlocks lists a crop at CROPS.level although plantable since Lv1 | derive.js:169 comment says no level or round gate | hud/sheets.js:459, derive.js:169 |
| Crops | Liberica second pick yield (likely bug; re-read and confirmed) | game.js:1021 computes the split only when `!pl.wave`. On the second pick beans stay at the full season amount; `pl.wave` is a flag and its stored remainder is never paid. A 1-star season gives 2 + 4 = 6 beans before multipliers | economy.js:117: first pick gives `first` of the beans, the rest ripen later; coffee-varieties:28,38: second wave is the remainder | game.js:1021,1040, economy.js:117, coffee-varieties.md:28,38 |
| Crops | Second-wave harvested event (confirmed) | `pl.wave` is deleted at 1041 before the event at 1045, so `wave ? 1 : pl.wave ? 2 : 0` reports 0 on the second pick, never 2 | expression at 1045 intends 2 | game.js:1041,1045 |
| Crops | Tree life | robusta 6, arabica 6, liberica 8 | §2b: 40 / 30 / 50 seasons | economy.js:123-127, coffee-varieties.md:58 |
| Crops | Beans per harvest | robusta 3, arabica 2, liberica 4 | §2: 2 / 3 / 3; §2b says beans stay as in §2 | economy.js:123-127, coffee-varieties.md:28,61 |
| Crops | Arabica bean price | 7 | §2: 5; §2b says price stays as §2 | economy.js:125, coffee-varieties.md:30,61 |
| Crops | Robusta cross-pollination | no crop has pollinate; economy.js:120 says no penalty; derive.js:253 comment still calls Robusta self-sterile | §2: -1 bean if all fields within 3.5 m grow another variety | economy.js:120-124, derive.js:253, coffee-varieties.md:37 |
| Crops | Zones and terrace model | 4 altitude zones lowland, upland, slope, highland; no pond zone; PD1 and O1 are slope | §3: lowland, upland (F15,F16,P1,P2), highland (F17,F18,W2,W3), pond zone Ven ao (PD1,O1) | layout.js:110-116, coffee-varieties.md:116-121 |
| Crops | Climate effects | Arabica lowland x1.35, upland x1.15 (bad), slope neutral; Liberica lowland +1 star; further Robusta and Liberica modifiers | §3: Arabica lowland slower 30%; upland neutral for all; Arabica highland +1 star; Liberica +1 star only at pond zone; upland the early place for Arabica | economy.js:154-158, coffee-varieties.md:118-124 |
| Crops | Early upland lot price | F3 in estate upland, cost 1500 | §3: F3 at 180 coins, about minute 6 | layout.js:113, D.parcelCost, coffee-varieties.md:124 |
| Land | Estate level gate | parcelError checks only order and coins; upland (3), slope (5), highland (8) buyable at level 1; game.js:1434 and hud/sheets.js:110 'level' branches dead | layout.js:107 'coins + a level gate'; derive.js:735 'from its level'; land-ui-simplify §2A, §6 | derive.js:730-744, layout.js:107-115, land-ui-simplify.md:74 |
| Land | Estate list, prices, levels | home 0/Lv1, upland 1500/Lv3, slope 6000/Lv5, highland 18000/Lv8; PD1, O1 in slope, O2 in highland, F13, F14 in home | land-ui-simplify §2A: Trung du ~1500/Lv3, Cao nguyen ~8000/Lv6 (F13,F14,F17,F18,W2-W5), Ven suoi ~20000/Lv8 (PD1,O1,O2). Doc header says option A was built | layout.js:110-116, land-ui-simplify.md:25-30 |
| Land | Free fields on purchase or level-up | autoTill returns on first line; freshRegion `tilled {}` and `fields []` | land-ui-simplify §6: row of 6 beds per estate, +1 row per level; QA says buying Trung du gave a row. farm-world-2.0 §1: land comes with 6 beds. layout.js 109,121-122 and game.js:833,1440 comments | game.js:843,1440, land-ui-simplify.md:75,91, layout.js:108-109,121-122, derive.js:285-286 |
| Land | Field price and cap | fieldCost 0, maxCount 9999, fieldRefund 0; FIELD.extraBase, extraGrowth, refund unused | farm-world-2.0 §3 §6: extra beds 60 coins, x1.3 each, +2 per level. land-ui-simplify §2 §6: rising prices. economy.js:291-293 comment, FIELD.refund 0.5 | derive.js:295,297,544, farm-world-2.0.md:35,66, land-ui-simplify.md:32,75, economy.js:294 |
| Crops | Flat ground versus terraces | farmGroundY has 4 plateaus 0, 2.2, 4.4, 6.6 m with walls and ramps. TERRACE_STEP is {} in plots.js:81 | coffee-varieties:70 flat ground plus backdrop hills; :86-87 TERRACE_STEP upland 0.22 m, highland 0.45 m | layout.js:151-190, realm/plots.js:80-81, coffee-varieties.md:70,86-87 |
| Crops | Shade bonus status | coded: D.shadeStars applied at harvest | coffee-varieties §8: not coded (gedeo-full-chain:29 documents it as coded) | derive.js:323, game.js:1010, coffee-varieties.md:180 |
| Crops | Replacement threshold | betterCropFor uses `CLIMATE_PICK.switchMul` 1.5 | §2b: replace at >=1.3x | derive.js:1302, economy.js:161, coffee-varieties.md:96 |
| Crops | Terrain doc reference | height is in layout.js farmGroundY; no `src/core/config/terrain.js` | memory note farm-terrain-4-levels cites terrain.js, heights 0/2/4/6 and docs/design/farm-terrain.md, which does not exist | layout.js:151-190 |
| Land | Building count limits | maxCount 9999; no limit branch; limit field has no effect | farm-world-2.0 §1 'gioi han theo cap'; economy.js:181 'limit: max count'; derive.js:540 'data-driven' | derive.js:541,566, farm-world-2.0.md:15, economy.js:181 |
| Land | Cafe buildings one copy | roaster, kiosk, pastry have limit 1 but nothing enforces it, and no costGrowth so copies stay the same price | farm-world-2.0 §6 item 6: 1 copy; economy.js:207 'keep ONE copy each' | derive.js:566, farm-world-2.0.md:69 |
| Land | Building level gates | buildError ignores def.level; config also differs from doc (dryer 1, well 1) | farm-world-2.0 §3: Dryer Lv2, Warehouse Lv3, Well Lv3, Roastery Lv4, Packer Lv6. land-ui-simplify §4 item 5: locked cards | derive.js:572, economy.js:212,251, farm-world-2.0.md:36 |
| Land | Land sale | land/sell can never succeed; manager proposal filter (derive.js:1573) never yields a lot | management-rules 212, 600: refunds 0.6 x price through approval. land-ui-simplify §6 forbids selling estate lots; no doc says sale is removed | derive.js:1431, management-rules.md:212,600, land-ui-simplify.md:78 |
| Land | Building on roads | farm branch does not check roads or lot edges | farm-world-2.0 §3 'Khong xay tren duong'; layout.js:2 'Nothing may be built on roads' | derive.js:460-475, farm-world-2.0.md:34 |
| Land | Terrain restrictions | TERRAIN_USES allows field, building, decor on every farm terrain; farm branch never reads terrain | farm-world-2.0 §3 §6: pond and hill decor only, pasture no beds, orchard no buildings | layout.js:135-144, farm-world-2.0.md:34,65 |
| Land | Gate plaza and access | gate plaza is a soft warning; noAccess sits in a branch farm placements never enter | farm-world-2.0 §3: must not block access | derive.js:449,471,491, farm-world-2.0.md:34 |
| Land | Production chain | roastery, packer, warehouse retired and return unknown. Live processing is wetMill and dryer; recipes and goods remain | farm-world-2.0 §1 §3: Field > Dryer > Roastery > Packer > Store. FARM-ECONOMY-BALANCE and economy.js:993-995: full chain to bags | economy.js:216-223,245, derive.js:568, farm-world-2.0.md:13,36, docs/farm-world-2.0/FARM-ECONOMY-BALANCE.md:18-22 |
| Land | Footprints | field [.5,.5] x CELL 2 = 1 x 1 m; dryer 3 x 1 m; silo 3.8 x 3.2 m | farm-world-2.0 §3: workshops and warehouses 3 x 3 m; economy.js:293 comment: field 3 x 3 m, bed mesh 2.4 m | economy.js:213,293-294, farm-world-2.0.md:33 |
| Land | Upgrade entry point | build/upgrade has no UI-path restriction | farm-world-2.0 §5 'nang cap chi qua ▲'; land-ui-simplify header and §6 override it; docs conflict, land-ui is newer | farm-world-2.0.md:38,57, land-ui-simplify.md:3,83 |
| Land | Buying land by lot | any lot id buys the full estate | farm-world-2.0 §1: bought by lot; layout.js:5-7: bought only when touching an open road. land-ui-simplify overrides | game.js:1437, farm-world-2.0.md:10 |
| Land | Storage removal | refused only if remaining capacity would be below stored goods | farm-world-2.0 §3: cannot remove a store that holds goods | derive.js:598, farm-world-2.0.md:39 |
| Land | Silo as a starter | no starter flag; capacity starts at STORAGE_BASE 30; a new region has no silo; layout FIXED still lists a position | farm-world-2.0 §3 assumes a starter store; v3-gdd: Kho fixed free starter; tests expect it. economy.js:192 comment agrees with code | economy.js:192-196, layout.js:237-239, farm-world-2.0.md:37,39, tests/core/core.test.mjs:28 |
| Money | Storage model | unit count; 30 base plus built silos | v3-gdd: fixed free starter. FARM-ECONOMY-BALANCE: capacity = silo(L) + barns, no base. godbean-gdd: gram lots, 60 kg x factor | derive.js:41, economy.js:300, v3-gdd.md §4, FARM-ECONOMY-BALANCE.md:45, godbean-gdd.md line 409 |
| Staff | Worker speed curve | `CREW.speedCurve` 10 steps .65,.73,.82,.91,1,1.09..1.45 | farm-crew §6: n=1..5: .65,.8,1,1.15,1.3 | economy.js:348, farm-crew.md:61 |
| Staff | Farm robot speed | .7,.82,.94,1.06,1.18,1.3,1.42,1.54,1.66,1.8 | t=0..3: .7,1,1.2,1.4 | economy.js:348, farm-crew.md:61 |
| Staff | Stat range | farm stats 1..10, parts 0..9 (maxStatOf, maxTierOf) | §6 n 1..5, t 0..3; §9 says 1..10 | economy.js:704, farm-crew.md:57,107 |
| Staff | Goof worker rates | play .3,.24,.19,.15,.11,...; lost .25,.2,.16,.12,.09,... | play 30,18,10,4,0%; lost 25,15,8,3,0% | farm-crew.md §7 |
| Staff | Goof robot rates | dock .14,.11,.09,.07,...; lost .2,.16,.13,.1,... | dock 14,8,3,0%; lost 20,10,4,0% | farm-crew.md §7 |
| Staff | Play duration | 14,13,12,11,10,9,8,6,5,4 | 14,11,8,6,4 s | farm-crew.md §7 |
| Staff | Mistake rates | unripe .25,.2,.16,.12,.09,...; crooked and drop .2,.16,.13,.1,.08,... | unripe 25,15,8,3,0%; crooked and drop 20,12,6,2,0% | farm-crew.md §7 |
| Staff | Upgrade price on farm | statCostOf farm points 0, coins 100*n | §6: n skill points + 100*n coins; §14: coins only | farm-crew.md §6, §14 |
| Staff | Stamina and laziness | slackMul only used for phone slack, and farm units are excluded. Goof uses stamina through its own table | every trade 15% less lazy per step | staff.js:1392, farm-crew.md §6 |
| Staff | Smart n=4 next job | quick read only in the plant branch (staff.js:982); harvest and goof keep .35 s; others always 0 | every trade finds a new job immediately at n=4 | staff.js:982, farm-crew.md §6 |
| Staff | Speed on manager orders | execute uses hold 2.5 regardless of speed | speed affects work and walk for every trade | staff.js:659,1462, farm-crew.md §6 |
| Staff | 2 star work by trade | unitStars applied in farm/harvest only; plant and deposit have no stars | picker, planter, hauler from n=3 make 2 star goods | farm-crew.md §6 |
| Staff | Haul chaining | only with chainPiles (smart>=3, robot battery>=1) | §5 unconditional within 8 m; §6 gates at n=3 | staff.js:733, farm-crew.md §5,§6 |
| Staff | Hiring limit | hireLimit constant 30, slots 30 | slots and hires per zone = player level, cap 30; level-progression 1 hire per level; game.js:1475-1477 comment | economy.js:313, derive.js:757-758,767,770, management-rules.md:133-135, level-progression.md |
| Staff | Robot limit | robotCap ceil(30*.5)=15 per zone, error robotShare | no limit by level, only ceiling 30 per zone; robot share not mentioned | farm-crew.md header |
| Staff | Robots unlocked at Lv4 | all STAFF defs level 1 | economy.js:311 comment and level-progression 88, 109 say Lv4; farm-crew says no level unlocks | economy.js:311, level-progression.md |
| Staff | No Auto on robots | makeUnit sets task auto; robotTask returns auto; robotIdle runs autoTask (harmless on one-task farm robots) | each robot one job, no Auto | farm-crew.md §2 |
| Staff | Crew names in rule docs | STAFF has trades and specific robots only; farmhand and sproutBot only in migration | management-rules names them (11 lines); farm-crew replaces them and says it was not simulated | management-rules.md, farm-crew.md:3,168 |
| Sim | Slack | realm has no phone slack on farm | economy-sim rolls slack for all workers, including farm | staff.js:1392, scripts/economy-sim.mjs:336 |
| Sim | Walking | realm walking includes unitSpeed, gearWalk, stateK | sim comment says walk at STAFF_SIM.speed; realmJobSec divides by base speed only | scripts/economy-sim.mjs:78-86 |
| Sim | Job coverage | realm has water, prune, spray, process, haul, execute, goof, funny, gm/hands, field placement, one trade per unit | sim header says the realm's team loop runs here. findJob does only harvest and plant for farm, any empty-task worker takes both; no goof, funny or mistakes. farm-manager-v2 says untested and unsimulated | scripts/economy-sim.mjs:21-31,298-311, farm-manager-v2.md:3,127 |
| GM | Think cadence | `gmThinkOf` max(2, 5-.35 x (speed-1)) s. `GM.thinkSeconds` [8,6,5,4,3] used only for training logic | management-rules §3.3: [20,15,10,7,5] by skill. farm-crew 9/11 and V2 §3: 5 s to 2 s by speed | management-rules.md:341, economy.js:513,655 |
| GM | Actions per think | gmActionsOf by accuracy + rich bonus; GM.actionsPerThink only in gmTrainDue | management-rules §3.3: [1,1,2,2,3] by skill; game.js:2146 comment repeats; farm-crew 9, 13 match code | management-rules.md:341,358, game.js:2146,2165-2166 |
| GM | Incidents and slot count | care, ops, funnyFire bypass the check but do done++ | farm-crew 11: incidents do not count | game.js:2205, farm-crew.md:123 |
| GM | Permission order, alwaysApprove | gmPermission only files c.always; fire, landBuy, loan, build and cost >= bigLimit are 'do'. alwaysApprove = top-up and all farm/sell actions, any size | management-rules 3.1/3.3: loan, topUp, landBuy, landSell, fire, build >= bigLimit, sell >= highValue; gmPermission docstring describes old order | management-rules.md:325,365-371, derive.js:2043-2054, economy.js:573 |
| GM | Loan taking | he borrows himself via gmRun | management-rules 3.1: loan/take always needs approval. economy.js loanRule comment 'file a loan task' | game.js:2210, management-rules.md:321, economy.js:597 |
| GM | Firing | staff/fire runs as 'do' | management-rules 3.1: always files. farm-crew 10/14 let him fire. V2 R5 unresolved | management-rules.md:298, farm-manager-v2.md:93 |
| GM | Modes, salary, shares | GM.modes only { full: mul 1, share .05, budgetMul 1 }; GM.away.share only full 0.7; gmBudgetCap ignores mode and style | management-rules §2.6/3.1: advisor 0.5, operator 1, full 1.6; share 0/.05/.05; full budget x3. general-manager: operator 50 %, full 70 %, advisor nothing; share 0/5/15 %. economy.js:502, derive.js:1091 comments | economy.js:502-505,547, derive.js:1091, management-rules.md:236,327, general-manager.md:29,82-85 |
| GM | Licences | gmLicensed always true; prices 300/1000/1500 unused | management-rules 3.1 requires paid licences | derive.js:1122, management-rules.md:288-323 |
| GM | Day plan interval | `GM.plan.everyMin`=10 | §3.3/3.4: every 20 played min | economy.js:565, management-rules.md:348,398 |
| GM | Storage sell threshold | `GM.planRules.storageFull`=0.5; hands.sellAt 0.5 | §3.3 rows and urgency bands 0.9. farm-crew 11 and V2 2b: 50 % | management-rules.md:378,389, economy.js:559 |
| GM | Cooldowns | denied 5, expired 3 | §3.3: denied 15, expired 10 | economy.js:84, management-rules.md:389 |
| GM | Care wallet | care exceeding the wallet still runs, charged to growth window | economy.js:553 comment and management-rules 3.1: never the growth budget | game.js:2204, economy.js:553-555 |
| GM | Who sells beans | autoSell default true; gm/hands sells at 50 %; alwaysApprove still lists sales for the off case | farm-crew 11/12: player signs. V2 2b and farm-crew 15 supersede | farm-crew.md:122,133,164, farm-manager-v2.md:42 |
| GM | First six fields essential | RULE_ARGS.fieldNeed sets no essential flag | farm-crew 15, V2 §3 list first 6 fields as essentials | derive.js:1880, farm-crew.md:158, farm-manager-v2.md:79 |
| GM | Who opens fields | fieldBuy job forced null; he opens them; orderJob 'openField' unused for new orders | farm-crew 12: planters open. V2 2b supersedes | game.js:2199, farm-crew.md:130, farm-manager-v2.md:40 |
| GM | Fields per round | with hands: room = planters x 3 + 6 - empty - pending | farm-crew 13: limited by 3 empty per planter | derive.js:1739, farm-crew.md:138 |
| GM | Staffing formula | farmStaffing backlog/5 + arrivals - hands, /rate | farm-crew 13: harvest fields/10, water dry/14, prune fields/30. V2 2e has the code's version, does not say it replaces 13 | derive.js:97-110, farm-crew.md:139, farm-manager-v2.md:60 |
| GM | Investable coins | coins - fmReserve - committed | farm-crew 13: coins - care fund - 2 salaries | derive.js:1691-1699, farm-crew.md:137 |
| GM | Land purchase field minimum | rich = plots >= 6 and coins >= 2 x price | farm-crew 13: 12 fields; 14: 6 fields | derive.js:1565, farm-crew.md:142,148 |
| GM | New field tier | fewest fields first; stale comment at 1755 says best earnings | farm-crew 14: highest field value/(fields+1). V2 item 6: fewest | derive.js:1755-1759, farm-crew.md:147, farm-manager-v2.md:26 |
| GM | Upgrade payback | gate uses mode maxPayback (Balanced 60). buildSnap 45, UPGRADE_GATE 40/90, richUp 30 | farm-crew 15: 30 min, says rules still apply under V2 | economy.js:624,596,1084, farm-crew.md:159,162 |
| GM | Terrace payback per mode | landSnap hard-limits to `GM.growth.landPaybackMin` 120 before FM.gate, so Expansion's 180 cannot widen it | V2 §3: modes set terrace payback | derive.js:1566, economy.js:626, farm-manager-v2.md:83 |
| GM | Machines | gmBuildNeeds buys pulper, motorbike, tillerCart, farmTruck | farm-crew 11 says he buys them; 16 says not yet | derive.js:1676, farm-crew.md:121,170 |
| GM | Forecast calibration | calibrate treats unsold stock >= earned as neutral | V2 §2: unsold stock no longer lowers forecasts; §5: unsigned sales pull forecasts down | farm-manager.js:323-326, farm-manager-v2.md:32,98 |
| GM | UI modes | mode picker and limits exist | V2 R3: founder said no modes, budgets or limits in UI; V2 brief asks for them. Open question | economy.js:621-631, farm-manager-v2.md:91 |
| GM | Manager crew seed at start | with auto on and a manager, want.plant can be 0 | farm-crew 12: from an empty start, hire a planter | derive.js:1718, farm-crew.md:132 |
| GM | Away loyalty drop | gmBack only runs returnGrace and gmAwayPay. GM.mood.awayPerHour, awayMax, awayGraceHours read nowhere | -10 loyalty per hour closed beyond 2 h, max -40 on return; game.js:343 comment; test expects it | game.js:345-353, economy.js:539, management-rules.md:484, general-manager.md:75, tests/core/management-rules.test.mjs:501-508 |
| GM | Idle and absent drain | D.gmMood only reports idle and absent; payroll has no drain; idlePerMin, absentPerMin unused | idle -1 per min, absent -1 per min beyond grace (an older line 15 min, -2 per min) | general-manager.md:73-74, economy.js:536-537, derive.js:2031-2034 |
| GM | Away pay when rate not positive | returns only when earned<=0 AND share<=0. With share 0.7 and rate 0 salary is still charged or becomes arrears | comment: 'nothing when the rate was not positive' | game.js:278-280,296 |
| Water | Which tank | waterSource minimises unit-to-tank plus tank-to-plant | farm-crew §1, §2: nearest tank; §5: shortest route (matches) | staff.js:720, farm-crew.md:14,27,55 |
| Water | No-tank behaviour | empty bucket and no tank wanders with noWell status; water left keeps working | §5: stand waiting and report | staff.js:686,1422, farm-crew.md:55 |
| Water | Fixed farm well | waterSource reads only built wells; FARM_WELL only positions a visual | comments say waterers fill at the farm well, workers use this spot with no well | economy.js:728-729, staff.js:151,168,720-724 |
| Water | Well and drip limits | maxCount 9999; no count or level gate | config well.limit [[1,1],[5,2],[7,3],[9,4]], dripLine.limit 6. farm-crew line 6 agrees with code | economy.js:233,251, derive.js:541-546,566-577 |
| Water | Drip fee unit | per harvest action, so a crop with waves pays each pick; skipped under 1 coin with coverage unaffected | §3: 1 coin per plot per season | game.js:1030,1040, farm-crew.md:36 |
| Water | Waterer passive bonus | waterer 0.15 and waterBot 0.2 growSpeed globally through staffBonus | farm-crew §1, §2, §6 list only fetching and watering | economy.js:323,333, derive.js:36-37, farm-crew.md:14,27 |
| Water | near() cost | also adds 40 m off-tier and subtracts up to 30 m for waiting age | §8: only the 3 m / +5 m crowd cost | staff.js:598,618-620, farm-crew.md:101 |
| Money | Level gift contents | L4 and L7 extra coins 60 x L; chest 'auto' gives 120 x L coins; no auto runs granted | §6: L4, L7 add a free Auto run; chest can win one. §3: fixed L5 400 coins (superseded) | economy.js:920-933, level-progression.md §3,§6 |
| Money | Max level and XP curve | MAX_LEVEL 100, LEVEL_XP ...920 at L10, then +260+40(l-10) | level-progression §7.4: 30. godbean-gdd §9.2: 0, 30, 90 ... 2800, then quadratic, to 999. v3-gdd L10=920 matches | economy.js:896-909, level-progression.md §7, godbean-gdd.md §9.2 |
| Money | XP sources | harvest 2/4/6 per season; batch 1-2 x batch; selling 0 | v3-gdd §5: harvest 1/3/6. godbean-gdd §9.2: harvest 6, batch 4, market sale floor(coins/2) capped at 40 | economy.js:123-128,1009-1013, v3-gdd.md §5, godbean-gdd.md §9.2 |
| Money | Market model | flat unit price x daily buyer multiplier | godbean-gdd §10.3: marginal price falls to 30% floor per work-day; §10.2 quality and variety factors; Market Orders | derive.js:353-363, godbean-gdd.md §10.2-10.3 |
| Money | Starting coins | START.coins 60 | godbean-gdd §9.2: 200 | economy.js:11, godbean-gdd.md §9.2 |
| Money | Follower unpaid wage | goes to `s.debt.wages.follower`, paid first from new income; leaves at 10 x wage | level-progression: follower debt on s.loan.owed, repaid by the 20%. management-rules §2.7 matches code | game.js:1556-1562, level-progression.md:138 |
| Money | Goods ladder comment | GOODS.dried.price 4; per-batch gains +24, +30, +16 | comment: dried 3 and +12/+24/+19. FARM-ECONOMY-BALANCE agrees with 4 | economy.js:993-998 |
| Money | Reducer determinism | sellQuote and sellVariety call buyerNow(s) with default `now=Date.now()`, so sale prices do not use ctx.now | reducer header: 'All timing comes from ctx.now' | derive.js:360,362,2443, game.js:2-3,44 |
| Money | Sell panel with a buyer | reducer applies buyer mul[good] to all goods | action-bar applies mul.beans to bean rows but shows GOODS[g].price unmultiplied for dried, roasted, bag and in Sell All | action-bar.js:322,347-348,353, derive.js:362 |
| Money | prod/start coin error data | prodError checks recipeIOFor fee (with pulper +1) | failure data reports missing from recipeIO fee, understated by 1 with a pulper and can be <=0 | game.js:1398, derive.js:653 |
| Money | Robot standby comment | upkeepOf charges standby only when !active and !assigned | economy.js:361 robots are free; line 363 benched or unassigned robots cost standby | derive.js:955, economy.js:361-365 |
| Money | Rounds | no round/ handler; only Round 1 playable | v3-gdd §5: R2 1,800 coins (L10), R3 7,000 (L13), charged once | game.js, economy.js:965-967, v3-gdd.md §5 |
| Engine | Tutorial fast seeds | createSave `tutorial.done:true`; fast only when not done | TUTORIAL.firstGrowSeconds comment says seeds ripen in seconds for new players; migrateLegacy still sets done:false | economy.js:14-15, state.js:59, game.js:977-978, migrate.js:42 |

---

## How to set up a headless farm save

Hand-derived from reading code; not executed. The first run of a new harness should confirm the `fd4` first field id and the success of each step.

Use `apply` from game.js with `createSave` from state.js, passing `{now, dev}` as ctx. Exact order:

1. `s = createSave(now, {gender:'female', name:'Bot'})`. Phase is intro because a character is passed.
2. `story/introDone`, then `story/teacherDone`. Phase becomes gate.
3. `world/unlockRegion {regionId:'vn-1'}`. Cost 0 because ownedRegions is empty.
4. `world/enterRegion {regionId:'vn-1', game:'farm'}`. Phase play, mode farm, `fields []`. Use `play/chooseGame {game:'farm'}` instead only if game was omitted at entry.
5. Coins: `dev/set {coins:1e6, level:5}` with `ctx.dev` true, or real earnings from 60 coins. dev/set may run at any point; dev false returns forbidden.
6. `build/place {type:'field', x:-9, z:5}`. Read plotId from the fieldPlaced event or `r.fields.at(-1).id`. Do not hard-code it: ids are `fd<nextUid>`; the three starter buildings take b1-b3, so by reading the first is fd4.
7. `farm/plant {plotId, crop:'robusta'}`. Needs step 6 first; cost 15.
8. `build/place {type:'dryer', x:14, z:13.5, rot:0}`. 120 coins, footprint [12.5,13,15.5,14], snaps to the same point.
9. `staff/hire {type:'picker'}`. 150 coins. Must be a current STAFF key.

`farm/plantAt {x,z,crop}` replaces steps 6 and 7.

Placement limits:
- The farm tier check uses the centre's tier. Lowland needs z >= -2.5. BOUNDS is x -32..32, z -76..28. Stay at z >= -1.7 with a field to avoid the wall slope (mountain error).
- F1 rect x -14..-4, z 2.5..8.5 is safe. A field footprint is 1 x 1 m; rectsOverlap is strict, so centres 1 m apart are valid.
- Non-home tiers need the estate bought first, in order (upland 1500, slope 6000, highland 18000).
- Do not place cafe-zone buildings in a farm region (gameLocked). Do not use retired types (roastery, packer, warehouse, tierSign): unknown.

Coins without dev actions: from 60 you can place fields and plant up to 4 robusta (60 / 15). The dryer at 120, cheapest worker waterer at 120 and picker at 150 need harvest income.

Time:
- Crop and batch timing read `ctx.now`. To skip time with dev false, advance now past plotGrowMs instead of using dev/ripen.
- Played time moves only through `clock/tick {ms}`, clamped to 30000 ms per tick. Send it yourself, normally every 5 s of simulated play. Task deadlines, tenure, income rows, GM plan and training depend on it. `tick(ms)` in `tests/core/helpers.mjs` moves the clock but never advances played time.
- To run the periodic layer headless, also send `staff/upkeep` (60 s), `gm/think` with `{roll}` (D.gmThinkSeconds), `gm/hands` with `{skip:[]}` (2 s, when `fm.auto`), `gm/payroll` (60 s) and `staff/vitals` and `staff/workDone` batches if units work. Staff jobs need a model of the realm loop; see "Logic that exists only in the realm layer".
- To exercise away play, advance now by at least 5 minutes without dispatching, then send gm/seen, gm/payroll or clock/tick.

Manager: `gm/hire` with board index 0, fee 250 x skill. Set coins first.

Keeping classic plot ids in a stale test: seed fields through a real path. Load a region with layout 4 and parcels ['F1'] through normalizeSave or normalizeRegion, which creates F1-1..F1-6 (state.js:652-654). If pushing to `h.state` region fields directly, do it before any D.ownedPlots or D.plotOf call on that same region object: derive memoizes per region object in a WeakMap (derive.js:212), and only the clone inside the next apply clears it.
