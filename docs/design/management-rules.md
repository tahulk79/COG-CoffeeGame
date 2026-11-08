> **Đã thay thế một phần (2026-11-08):** Tổng quản lý chỉ còn một luật: toàn quyền mọi việc, chỉ nạp tiền và bán hạt cần chủ ký. Không còn chế độ quyền, ngân sách, hạn mức, giấy phép. Không còn tinh thần, bị đối thủ dụ đi và đội loạn. Nhân viên không còn chức vụ, chỉ dựa vào chỉ số nâng cấp.

# Management Rules — Nhân viên · Robot · Tổng quản lý (Standard v1.1)

**Status:** proposal, 2026-11-07 (rev 2 after the balance audit). Nothing here is coded. Supersedes the balance parts of `staff-manager.md`, `general-manager.md` §4 ("GM never borrows / builds / buys land") and `research.md:6` where they conflict. Code facts cite `economy.js` / `derive.js` / `game.js` / `state.js` / `realm/staff.js` at `61e0cb1`.

**Founder decisions this spec assumes** (all reversible, see §8 for what still needs him):
- The GM (Tổng quản lý) may *propose* loans, land buys/sells, builds and real-money top-ups as approval tasks; only the player executes real money.
- Penalty order for an ignored task is **loyalty → throttle → coins**: the coin fine is the last layer, capped, never debt.
- Task deadlines run on **played time** (the clock stops when the app is closed; the existing "away" mood keeps running on real time — §4.1 says how the two meet; §8 Q10 asks whether that is what he wants).
- Career tenure is counted in **shift-days of played time**, not calendar days.
- Everything is keyed to one reference income curve **per game** `I(L)` so the tables port to another game by swapping one table and the unit catalogue.

---

## 0. Tóm tắt (đọc trước — một trang)

Ví dụ ở cột cuối: **nông trại, Lv6**, thu nhập chuẩn I(6) = 🪙250/phút → I10 = 🪙2 500 (10 phút), I30 = 🪙7 500.

| Quyết định | Số | Ví dụ Lv6 (farm) |
|---|---|---|
| Mọi giá tiền = số phút thu nhập; mọi chi phí chạy = % thu nhập; mọi phạt = % thu nhập 30 phút | §2.0 | thuê nông dân 🪙150 ≈ 1 phút I(3) |
| Thu nhập chuẩn **riêng từng game** (`INCOME_REF.farm` / `.cafe`), đo trên **toàn nông trại** (cả tay anh/chị + nhân viên), theo phút chơi | §2.0 | farm 250/phút, café 440/phút |
| Đội mỗi khu = cấp (giữ luật 07/11); robot ≤ một nửa; dự bị +2 là **câu hỏi mở** | §2.1, §8 Q7 | Lv6: 6 chỗ, ≤ 3 robot |
| Chi phí chạy cả đội (chỉ phí lười/pin, không tính cà phê) ≤ **25 %** thu nhập **thực kiếm** ở cấp đó; cà phê/cơm là nâng cấp có hoàn vốn, không phải chi phí bắt buộc | §2.3 | sim 08/11: người giao việc ở farm Lv6 chỉ có 0–1 nông dân, chưa có QL (thuê ở Lv8–9) → 5 %; bảng 4 W + 2 R là ước tính tay, chưa đạt |
| Pin robot [6, 9, 13, 18] phút, phí sạc 3 % giá (36 / 45); giá linh kiện ×[0.15, 0.3, 0.5] | §2.3, §2.5 | sạc 🪙36 mỗi 6 phút = 6/phút |
| Ví chăm sóc = 1.5 × chi phí chăm sóc dự kiến của đội / 10 phút (không phải % thu nhập) | §2.3 | 4 W + 2 R → (4 × 35 + 2 × 56) × 1.5 = 🪙378 / 10 phút |
| Lương QL = 20 × kỹ năng × hệ số chế độ / 10 phút + 5 % lợi nhuận **của việc QL tự làm**; thiếu lương → nợ lương (`s.debt.wages`), không sập lòng trung thành | §2.6 | kỹ năng 2, Vận hành: 🪙40 + 5 % |
| Tự chi ≤ autoLimit = round(0.3 × I(L) / 50) × 50; việc ≥ bigLimit = round(I(L)/100) × 100 **phải duyệt**; bán ≥ highValue = 20 × I(L) phải duyệt | §2.7 | 100 / 300 / 5 000 |
| Vay, mua/bán đất, xây lớn, sa thải, nạp tiền: **luôn phải duyệt**, mọi chế độ | §3.1 | — |
| Việc hết hạn: lòng trung thành −3 → tồn đọng (3: Chờ lệnh, 6: dễ bị dụ, 8: đình công) → phạt tiền ≤ 3 % I30 / việc, ≤ 25 % I10 / 30 phút, không bao giờ nợ → khu đó −3 tinh thần | §4.3 | phạt 🪙225 / việc, tối đa 🪙625 / 30 phút |
| Vay: gói 1 000 (Lv4) / 2 000 (Lv6) / 5 000 (Lv8), tối đa 2 khoản, hạn = 1.5 × thời gian tự trả ở thu nhập chuẩn (30–150 phút chơi), trễ +5 % một lần rồi khoá vay; 20 % mọi thu nhập tự trả (đã có trong code) | §2.7, §4.5 | vay 1 000: hạn 40 phút, trả xong sau ≈ 22 phút |
| Mỗi đơn vị (kể cả QL) có `book`, `days`, 30 dòng lịch sử riêng + sổ chung 400 dòng; kế hoạch & duyệt của QL không bị xoá khi reset Lv10 | §5 | 📒 Nhật ký → lọc *Quản lý* |
| QL màu **tím hoàng gia** `#7c4dbd`, bàn điều hành, bong bóng 📋 đếm ngược | §6 | — |

---

## 1. The standard framework

Three generic models. Game-specific content (farmhand, brewBot, robusta…) is *data* in these models; no algorithm branches on a game id. The schemas below are the contract; the prose after each one is what a reader on a phone needs.

### 1.1 Unit (Nhân viên / Robot / Tổng quản lý)

```
Unit {
  uid, kind: 'worker'|'robot'|'manager', type,          // type = catalogue id (farmhand, brewBot, gm)
  name, gender, zone|'all', regionId|null, assigned, active,
  caps: UNIT_KINDS[kind],                                // capability flags, see below
  stats: { a, b, c, d } 1..5,                            // worker speed/smart/accuracy/stamina
                                                         // robot motor/battery/cooler/frame (tier+1)
                                                         // manager skill, style, raises, —
  vitals: { v1, v2, v3 } 0..100,                         // worker energy/fullness/morale
                                                         // robot charge/heat(inverted)/wear
                                                         // manager loyalty / mood / backlog(inverted)
  state: 'ok'|'slow'|'blocked'|'off', stopped?, rank, tasks[] | task,
  paid, spent: { parts, software, gear, training }, hiredAt, tenurePlayedMin,
  book: { jobs, earned, spent, mistakes, since }, days: [≤7], recent: [≤30 history rows]
}
UNIT_KINDS = {                   // economy.js (new)
  worker:  { learns:1, eats:1, rests:1, jams:0, slacks:1, decides:0, orders:0, scope:'zone',   paysUpkeep:'bench' },
  robot:   { learns:0, eats:0, rests:0, jams:1, slacks:0, decides:0, orders:0, scope:'zone',   paysUpkeep:'standby' },
  manager: { learns:1, eats:0, rests:0, jams:0, slacks:0, decides:1, orders:1, scope:'all',    paysUpkeep:'salary' },
}
```

Shared: id, state machine (`blocked > slow > ok`, speed mul 0 / 0.7–0.6 / 1), book, days, `recent`, history rows, tasks, upkeep hook, fire/sell refund hook. Role-specific: which vitals drain, which blocking states exist (worker phone/lunch/sulking, robot battery/overheat/jam, manager poached/unpaid/strike), which upgrade table applies.

**Where the GM lives (decision).** The GM stays in `s.gm.unit` and gets only the shared Unit *interface* (`uid 'g1'`, `kind 'manager'`, `book`, `days`, `recent`, `tenurePlayedMin`, `backlog`); it is **not** pushed into `s.staff.units`. Reason: every staff helper assumes `STAFF[u.type]` exists with `kind ∈ {worker, robot}` and `zone ∈ {farm, shop}` — `normalizeSave` would drop a `type 'gm'` row on the next load (`state.js:119`), `zoneUnits` / `hireCap` would count it against a zone (`derive.js:504, 518`), `staff/upkeep` would call `upkeepOf` on it (`game.js:841`), `gm/calm` reads `STAFF[u.type].kind` and would throw (`game.js:1564`), `normalizeActive` sorts by the numeric part of the uid so `'g1'` collides with `'u1'` (`state.js:350`), and the migration round-trip test (`staff-manager.test.mjs:277`) would fail. Derived views (`allUnits(s)` = staff units + GM, used by Nhật ký filters and the roster screen) give the "every unit in one place" the founder asked for without touching those call sites. Licences are **not** on the unit (§2.5): they belong to the player.

### 1.2 Task (Việc cần duyệt — one inbox for everything the player must answer)

```
Task { id, kind: care|trade|staffGrowth|land|loan|poach|gmPoach|topUp,   // family: drives life + reminders (§4.1)
       key, group,                                                      // group = powers group §3.1 (licence)
       by: 'g1'|'system', act: {type, payload}, cost, value,
       reason: [i18nKey, params], atPlayed, untilPlayed, remindedAt[],
       status: open|approved|denied|expired|late|failed, answeredAtPlayed?, fine? }
s.tasks = { open: Task[] ≤ 8, done: Task[] ≤ 50 }
```

`failed` = approved but `coins < cost` at that moment (§4.2); the GM re-files it after the cooldown.

### 1.3 History event (Nhật ký)

```
Row { id, atPlayed, at, actor: 'player'|'g1'|uid|'system', subject?: uid|fieldId|parcelId,
      group: work|care|hr|money|plan|approval|event, type, zone, regionId,
      cost?, gain?, taskId?, extra? }
s.history = { rows: ring ≤ 400, days: [{ d, actor, jobs, earned, spent, mistakes, tasksDone, tasksExpired }] ≤ 30,
              tombstones: [{ uid, name, kind, leftAt }] }
```

### 1.4 Porting checklist

Another game supplies: `INCOME_REF` (one curve per game it ships), a unit catalogue (`type → kind, price, effect, unlockLevel`), task families per zone, a crop/product table with `(cost, seconds, units, price)`, and `GM_RULES` rows (§3.3 — **data rows with a fixed metric vocabulary, not predicates**). Everything else — slots, upkeep %, care %, upgrade growth, salary, approval thresholds, penalties, history — is formula.

---

## 2. Balanced numbers

### 2.0 The anchor: reference income `I(L)`

From `scripts/economy-sim.mjs` (tap 1.2 s, gross manual, no staff running costs), income per minute by level: farm-only Lv3 ≈ 145, Lv6 ≈ 255, Lv10 ≈ 306, Lv15 ≈ 442; café-only Lv3 ≈ 204, Lv6 ≈ 441, Lv10 ≈ 624, Lv15 ≈ 1 056. One blended curve mispriced both games by ≈ 2× (a region plays **one** game), so the reference is per game:

```
INCOME_REF = {                                    // coins per PLAYED minute, interpolate between keys
  farm: { 1: 80, 3: 150, 6: 250, 10: 310, 15: 440, 20: 550, 30: 750 },
  cafe: { 1: 80, 3: 200, 6: 440, 10: 620, 15: 1050, 20: 1300, 30: 1800 },
}
I(L)      = interp(INCOME_REF[regionGame(s)], L)                       // coins / min
I10       = max(0.3 × I(L) × 10, Σ s.income.rows.earned over the last 10 PLAYED minutes)   // a 10-min SUM
I30       = same over 30 played minutes; dayIncome = Σ earned over today's played minutes
```

**Income series (new, P1).** `s.income = { rows: ring ≤ 60 of { m: playedMinute, earned, spent, by: { player, g1, staff } } }`, written by `earn()` and by every coin spend. Today the only income ledger is `s.staff.ledger` (`game.js:231`), written only by `unitEarned()` (`game.js:253`), i.e. staff harvests and serves — a hands-on player with one worker would be measured at the floor for every limit and fine. `s.income` counts the player's own taps too, is keyed to **played** minutes (`s.clock.played`, §4.1), and is the one source for I10 / I30 / dayIncome / `profit10` / plan.target. `s.staff.ledger` and `s.staff.daily` stay as they are (wall-clock, staff-only) for the team report. The floor is 0.3 (not 0.5): the sim's farm-only income at Lv9–11 and 14 is 45–47 % of the old blended reference, so 0.5 would have charged fines on income never earned.

Units in this document: **`I(L)` is per minute, `I10` / `I30` are sums.** Every formula names which one it uses.

**Whose income `I(L)` is (audit 2026-11-08).** `INCOME_REF` matches the full-speed *tapper* (sim, 110-min runs: farm L3 173 / 150, L6 248 / 250, L10 310 / 310). The *delegate* persona (tap × 0.5 + its team) earns about half of it on the farm (L3 82, L6 152, L10 151) and 72 % at café Lv15 (755 / 1 050). Every price read on `I(L)` — loan term, creditLimit, GM hire price, the fine caps, the §2.3 table — is therefore calibrated on the tapper, not on the player who delegates. Kept as is for now (re-anchoring moves every pinned number in `core.test.mjs` / `management-rules.test.mjs`); the loan term is checked against delegate income by the autoRepay-only loan gate (§7.4) and the decision is **§8 Q14**.

Rules of the standard: **a price = k minutes of `I` at its unlock level; a running cost = % of `I`; a penalty = % of `I30`.** Targets:
- full roster *mandatory* running cost (slack fees, recharges, cooling, service, allowances, GM salary + share) **≤ 25 % of the coins the player actually earns at that level** (measured earnings, as the §7.4 gate reads it — not of `I(L)`: the farm delegate earns ≈ 50 % of `I(L)`, so the two readings differ by ≈ × 2) at every level with the roster the §3.7 hire rule would build; paid coffee / food are *optional* upgrades with their own payback (coffee: 🪙20 buys ≈ 6 min at ×1 instead of ×0.6 → pays back whenever `0.4 × 6 × contrib(u) > 20`, i.e. contrib > 8.3/min — always from Lv2) and are reported in a second column, not in the target;
- each unit's mandatory running cost ≤ 30 % of its contribution `contrib(u) = jobsPerMin(u) × perJob(zone)` (the §3.5 `labourCap` term, **not** an effect share — the old `I(L) × effectShare` definition put a farmhand at 81 % at Lv1);
- **every throughput upgrade pays back in ≤ 40 played minutes at its unlock level**; tier ≥ 2 robot parts and stat steps ≥ 3 are late-game and get ≤ 90 min; *quality* upgrades (accuracy, smart, shears, hat, frame) are priced by the same ladder but are outside the coin gate and carry a value formula instead (§2.5). The sim acceptance check is §7.4.

### 2.1 Hire & slots

| Item | Value | Formula / note |
|---|---|---|
| farmhand / barista | 🪙150 / 200 (keep) | ≈ 1 min of farm I(3) / 1 min of café I(3) |
| sproutBot / brewBot | 🪙1200 / 1500, Lv4 (keep) | ≈ 5 min of farm I(6) / 3.4 min of café I(6) |
| GM hire | **250 × skill** (changed 2026-11-08 after the sim: 400 → 250, because skill 2 at 🪙800 ≈ 6 min of a delegate's Lv6 income and the GM came at Lv8–9) | skill 1..5 = 1–5 min of farm I(6), 0.6–2.8 min of café I(6) |
| Working slots per zone | = player level, cap 30 (keep `hireLimit`, `STAFF_CAP`) | |
| **Robot share** | **new: robots ≤ ceil(slots/2)** | a robot never displaces the last worker |
| Hires per zone | **= slots (keep `hireCap = level`, founder rule 2026-11-07)** | the earlier draft said "slots + 2 bench"; that reverses a same-day founder rule pinned by `core.test.mjs:190, 751` and `staff-manager.test.mjs:27` ("no bench overflow"), so it is **§8 Q7**, not a tweak |
| Recruit board | 3 / 10 min / 🪙20 (keep) | |

### 2.2 Upkeep (per 10 minutes of play)

`staff/upkeep` is timed on the **wall clock** (`s.staff.upkeepAt`, `game.js` `'staff/upkeep'`), dispatched by the realm about once a minute while the game is played; a gap with the game closed is billed for at most `UPKEEP.maxCatchUpMinutes` (10), so a robot parked for 3 h with the app closed costs one 10-min standby (36), not 18. It is not on the played clock (§4.1); the tests pin this wall-clock + catch-up-cap behaviour (`management-rules.test.mjs` "robot standby…", `staff-manager.test.mjs` "upkeep: an unassigned robot…").

| Unit | Value | Change |
|---|---|---|
| Worker on shift | 0 (keep) | |
| Worker benched | 10 % hire price (keep) | |
| **Robot standby** | **3 % price (36 / 45)** | **was 0** → robots parked forever were free; standby only while unassigned |
| Lead / manager-rank allowance | 20 / 40 (keep) | |
| GM salary | §2.6 | |

### 2.3 Care & breaks

Standard: paid care ≈ `round5(0.1 × P)` per 60 energy-equivalent of the zone's cheapest worker.

| Item | Value | Change |
|---|---|---|
| coffee +60 energy | 🪙20 (keep) | |
| food fullness 100 | 🪙15 (keep); lunch free 60 s (keep) | |
| bonus +40 morale | 🪙50 (keep); bonusSmall / nag (keep) | |
| **Care wallet** | **new: `careWallet = max(50, 1.5 × Σ_units carePer10(u))` per 10-min window**; `carePer10` = worker 35 (coffee 20 + food 15), robot `fee + 20` (one recharge + a cool / unjam) | care / ops in operator mode spend from this wallet, never from the growth budget, never become approval tasks ("smooth-running guarantee"). Sized from the **roster**, not from income: the earlier `2 × I10/10` was 20 % of I(L) — the whole running-cost target — and let the GM buy beans with it |
| worker slack fee | 15 / 20, 30 %/min × slackMul (keep) ≈ 4.5–6 /min = 3 % of I(3) | |
| **robot battery minutes** | **[6, 9, 13, 18]** | **was [3,4,6,9]**; `core.test.mjs:827` pins tier-2 = 6 → becomes 13 (P1 test list) |
| **robot recharge fee** | **max(15, 0.03 × price) × [1,.8,.6,.4] = 36 / 45 at tier 0** | **was max(25, 0.06 × price) = 72 / 90** → tier-0 cost 24–30 /min (more than a worker's whole contribution) → now 6–7.5 /min ≈ 2.4 % of farm I(6) |
| heat / jam / wear / warranty / cool / repair / service | keep (`ROBOT_WEAR`, `CARE.cool 10`, `repair 20`, `serviceRatio 0.1`) | the GM's robot rules are in §3.7 |

**Per-robot mandatory cost at tier 0 (sproutBot)**: recharge 36 / 6 min = 6.0 + cool 10 per 4 min (heat 25/min) = 2.5 + service 120 per ≈ 500 jobs = 1.2 + jam 2 % × 🪙20 × ≈ 5 jobs/min = 2.0 → **11.7 /min** (the earlier draft said 7). brewBot: 45 / 6 = 7.5 + 6.5 → 14 /min.

**Sim-measured (2026-11-08, `node scripts/economy-sim.mjs --gates`, delegate persona, 110 min, seed 1; cost = mandatory + GM over measured earnings).** The roster the hire rule actually builds is far smaller than the hand table below assumed: the delegate's own taps keep the backlog under the §3.7 trigger (3 ripe plots / waiting orders) until region 2.

| Game, region:L | Roster (max) | GM on duty | earned/min (I(L)) | mandatory + GM | % earned | gate |
|---|---|---|---|---|---|---|
| farm 1:3 | 0 | — | 115 (150) | 0 | 0 % | **FAIL — vacuous** (no unit) |
| farm 1:6 | 1 W | no (hired Lv9) | 123 (250) | 15 | 5.2 % | **FAIL — vacuous** (no manager) |
| farm 2:10 | 1 W | 4.9 min | 203 (310) | 10 | 1.0 % | PASS |
| farm 2:15 | 3 W | 4.4 min | 380 (440) | 23 | 1.4 % | PASS |
| café 1:3 | 0 | — | 213 (200) | 0 | 0 % | **FAIL — vacuous** (no unit) |
| café 1:6 | 1 W | 0.7 min | 393 (440) | 0 | 0 % | PASS (barely staffed) |
| café 2:10 | 1 W | 5.5 min | 593 (620) | 52 | 1.6 % | PASS |
| café 2:15 | 6 (W + R) | 8.2 min | 737 (1050) | 56 | 0.9 % | PASS |

Hand estimate kept for reference only (**superseded by the table above; its rosters are not what the delegate builds** — no farm row below Lv11 ever reaches 4 W + 2 R + GM). Column *mandatory* = slack fees + robots + allowances + GM; *+care* adds paid coffee + food for every worker (optional, see §2.0).

| Game, L | I(L) | Roster | Workers | Robots | GM (salary + 5 % of GM-run profit) | mandatory | % I(L) | +care | % I(L) |
|---|---|---|---|---|---|---|---|---|---|
| farm 3 | 150 | 3 W | 13.5 | — | — | 13.5 | 9 % | 29 | 19 % |
| farm 6 | 250 | 4 W + 2 R(t0) + GM s2 operator | 18 | 23.4 | 4 + 7 | 52 | 21 % | 76 | 30 % |
| café 6 | 440 | 4 W + 2 R(t0) + GM s2 operator | 24 | 28 | 4 + 18 | 74 | 17 % | 95 | 22 % |
| farm 10 | 310 | 8 W + 2 R (rule stops at 2 robots: `contrib(robot) − 11.7 < contrib(worker)`) | 36 | 23.4 | 6 + 6 | 71 | 23 % | 113 | 36 % |
| café 10 | 620 | 6 W + 4 R + GM s3 operator | 36 | 56 | 6 + 13 | 111 | 18 % | 142 | 23 % |
| farm 15 | 440 | 9 W + 3 R(t2) + lead + GM s3 full | 40.5 | 24.3 | 6 allow + 9.6 + 9 | 89 | 20 % | 136 | 31 % |
| café 15 | 1050 | 9 W + 6 R(t2) + lead + mgr + GM s3 full | 54 | 49 | 6 + 9.6 + 24 | 143 | 14 % | 190 | 18 % |

Reading: the farm plateau (Lv10 ≈ 310/min) is what makes robots marginal there — the hire rule, not a table, keeps the farm at 2 robots. Full mode's share is 5 % like operator's (§2.6); full mode is paid through `modeMul 1.6`, not through a bigger cut.

### 2.4 Vitals, mistakes, quality, craft, smart rules, tasks, rivals — keep

`VITALS`, `MISTAKES`, `QUALITY`, `CRAFT`, `SMART`, `TASK_LIMIT`, `ROBOT_TASKS`, `RIVAL` are sound and config-driven. Two edits: (a) `staff/setTasks` / `setTask` / robot task writes a history row with `actor`; (b) rival visits become `s.tasks` entries of kind `poach` (60 s) / `gmPoach` (180 s) so every deadline lives in one inbox. Drop the "bench rest only with free slot" idea — the care wallet solves the paid-care trap legibly.

### 2.5 Upgrades (one formula family)

`price(step n) = base × growth^(n−1)`, rounded to 5; refund 0.5 everywhere (worker fire 0.3, keep).

| Target | Formula | Numbers | Change |
|---|---|---|---|
| Worker stat n→n+1 | n points + 100·n 🪙 (keep `SKILL.coinPerLevel`) | 1→5 = 🪙1000 + 10 pts (200 jobs); 4 stats = 🪙4000 | keep price; **gate** below |
| Worker gear tier | [80, 160, 320], ×2 | 4 items 🪙2240 | keep |
| **Robot part tier** | **price × [0.15, 0.3, 0.5]** | sproutBot 180/360/600 → full set 🪙4560; brewBot 225/450/750 | **was [0.3, 0.6, 1.0] = 🪙9120**; tier 1 at 0.15 so battery / motor / cooler pay back ≤ 40 min and frame ≤ 90 (table below) |
| Robot software | autoCharge P/3, autoUnjam P/4 (keep); **new `precision` P/3, Lv10 → robot 2★** | 400 / 300 / 400 | robots no longer strictly worse late |
| **Career tenure** | **shift-days: 1 sd = 5 played min** (`u.tenurePlayedMin`) | skilled Lv7 / 2 sd (10 min), lead Lv9 / 4 sd (20 min), manager Lv13 / 12 sd (60 min) | **was** Lv8/5 d, Lv12/10 d, Lv16/20 real days. The sim reaches Lv10 at 12.7 (both) / 15.9 (farm) / 20.3 (café) played min and `expiry/execute` empties `s.staff.units` except the follower (`game.js:1621`), so skilled must be reachable inside ≈ 15 min and lead just before the incident; **manager rank is region-2 content**. The follower keeps `tenurePlayedMin` across the wipe |
| GM training (Đào tạo) | 400 × (skill+1), 1 shift-day | 2→3 = 🪙1200 | new; when the GM proposes it: §3.7 |
| GM licences (Giấy phép) | flat, **all available from the GM unlock (Lv6)**, stored on the **player** (`s.gm.licences`, kept by `expiry/execute` like `board`) so they **survive the Lv10 wipe** | Nhân sự 0, Giao việc 0, Hạt 🪙300, Đất & xây 🪙1000 (4 min farm I(6)), Tín dụng 🪙1500 (6 min) | new; level gates (Lv8 / Lv9) dropped — coins pace them and the Lv6 worked session (§4.4) is possible (§8 Q11) |
| Buildings / fields | keep tables, copies × 1.6–1.7 | | keep |
| **Land sell** | **new `land/sell` refund 0.6 × price**, only via approval task | | new |

**Value of an upgrade (so the gate can be run).** `value(up)` in coins per played minute at the unlock level; payback = price / value.

**Sim-measured paybacks (2026-11-08, `--gates`; `GM.value.jobsPerMin` 8 / 8 / 11 / 10, priced at the level the delegate first owns that unit / reaches that step, rate over working seconds).** Farm farmhand (12.4 harvests / working min): speed 1→2 @Lv6 10.1 min ✓, 2→3 @R2 Lv10 18.7 ✓, 3→4 @Lv15 12.5 ✓; stamina 1→2 @Lv6 24.2 ✓, 2→3 @R2 Lv18 30.3 ✓; boots t0→1 @Lv6 12.9 ✓, t1→2 24.0 ✓, t2→3 30.3 ✓. Café barista (20.0 jobs / working min): speed 1→2 @Lv7 6.5 ✓, 2→3 12.0 ✓; stamina 1→2 14.1 ✓, 2→3 25.7 ✓; kettle / shoes t0→1 8.3 ✓, t1→2 15.3 ✓, t2→3 25.4–25.9 ✓. brewBot @R2 Lv17: battery t0→1 24.9 ✓, **cooler t0→1 105.8 ✗** (value 0.82/min: overheat downtime is small at the measured rate). **sproutBot: unmeasured** — the farm delegate never owns a robot. The table below is the hand model at the old `jobsPerMin 3` (contrib 36); its ✓ marks are the hand model's, not the sim's.

| Upgrade | value formula | at unlock (farm) | payback | gate (hand model; see sim line above) |
|---|---|---|---|---|
| speed n→n+1 | `0.08 × contrib(u) × throughputShare` (changed 2026-11-08 after the sim: × share, §7.1) | Lv4 farmhand contrib 36 → 2.9 | 35 min | ≤ 40 |
| stamina n→n+1 | `0.15 × slackFee/min + 0.2 × energyDowntime × contrib` | Lv4 1.5 + 0.9 | 42 min | ≤ 90 (step ≥ 2) |
| accuracy n→n+1 | `Δmistake × jobsPerMin × beansPerMistake × perBean` | Lv4 0.015 × 3 × 1 × 2 = 0.1 | — | quality (outside the gate; value = mistakes shown in the profile) |
| smart n→n+1 | measured by the sim: Δ jobs/min with the rule on vs off | — | — | quality |
| boots t1 | `0.05 × contrib` | 1.8 | 44 min | ≤ 90 |
| hat / shears / tray t1 | coffee −15 % / unripe ×0.8 / spill ×0.8 | 0.5 / 0.1 / 0.1 | — | quality |
| battery t0→t1 (180) | `Δ(fee/min) + contrib × Δ(R / (R + minutes))`, R = 1 min player reaction | 6 − 3.2 + 62 × (1/7 − 1/10) = 5.5 | 33 min | ≤ 40 |
| battery t1→t2 (360), t2→t3 (600, Lv8) | same | 2.9 / 1.7 | 124 / 350 min | late-game luxury; its value is **downtime**: with `autoCharge` the ladder is pure fee → the GM never proposes battery ≥ t2 (§3.7) |
| motor t1 (180) | `0.10 × contrib` − extra cooling | 6.2 − 0.4 | 31 min | |
| cooler t1 (108 / 135) | overheat downtime × contrib + cool fee saved | 3.5 | 31 min | ≤ 90 (changed 2026-11-08 after the sim: cooler priced ×0.6 — `PART_COST.partMul.cooler` — because a café brewBot rarely overheats and a full-price cooler t1 paid back in 106 min; the code now also files the cooler under the ≤ 90 reliability gate as this table says) |
| frame t1 (180) | `Δjam × jobs × (unjam 20 + downtime) + Δwear × service` | 2.4 | 75 min | ≤ 90 |
| precision (400, Lv10) | `0.25 × contrib` (2★ yield) | 40.6 | 10 min | |
| autoCharge (400) | battery downtime removed, R = 1 | 62 × 1/7 = 8.9 | 45 min | ≤ 90 (R = 0.5: 65 min) |

### 2.6 Manager salary (per 10 played min)

```
gmSalary = round(20 × skill × modeMul × (1 + 0.2 × raises))       modeMul advisor .5 | operator 1 | full 1.6   (was 2)
share    = modes[mode].share × max(0, gmProfit10)                   share 0 | .05 | .05                        (was .05 / .15)
gmProfit10 = Σ s.income.rows over the window with by == 'g1' (earned − spent of jobs the GM itself ran);
           a passive GM costs salary alone. profit10 (team-wide, excluding hire/capex/gm rows) stays ONE definition
           for gmAwayPay and the HUD "worth" (today three definitions)
keep fee on poach = 6 × gmSalary   (was 20 → 🪙4000 > re-hire 🪙2000)
loyalty: start careful 75–95 / balanced 55–75 / bold 45–60 (was 30–50)
```

**Loyalty trajectory** (why those bands): `loyalty(t) ≈ start + 0.3 × jobs + 2 × approvals − 1 × denials − 3 × expiries + 1 × paidPayrolls` (`GM.mood.jobLoyalty`, `approveLoyalty`, `denyLoyalty`, `GM.loyalty.paidPer10`, all existing). A balanced GM starting at 65 crosses the refuse line 70 after ≈ 10 jobs + 2 approvals ≈ 8 played min; a bold one from 50 needs ≈ 40 jobs + 5 approvals ≈ 30 min — a window in which the rival (every 8 min, chance 0.4) can lure him, which is the point of "bold". The old 30–50 band needed ≈ 60 jobs + 10 approvals ≈ 1 h and the rival usually won first.

**Unpaid salary (new).** Today `gm/payroll` pays all-or-nothing and on `coins < pay` drains `unpaidPerMin 10 × 10 min = −100` in one payroll (`game.js:1486-1492`, `economy.js:296`) → below refuse → poach → chaos → calm fee 300 + 50 × units: one cash dip (the sim is at 32–79 coins in several minutes) starts the whole chain. Standard: payroll pays what it can, the shortfall goes to `s.debt.wages.gm`; loyalty −1 per unpaid minute (same scale as idle / absent); arrears are paid first out of the next income; `arrears ≥ 10 × gmSalary` → the GM leaves (`quit`, re-hire at the board), never chaos. `GM.loyalty.unpaidPerMin 10 → 1`.

**Break-even (sim gate).**
```
gmValue/min = Σ_units contrib(u) × downtimeRemoved(u, R) + awayIncome/min − gmSalary/10 − share
downtimeRemoved(u, R) = events(u)/min × max(0, R − thinkSeconds/60)
  events: worker slack 0.3/min (× slackMul), robot recharge 1/batteryMinutes, robot jam 0.02 × jobs/min, hungry/tired 1/8
awayIncome = GM.away share × team net rate × min(awayMin, 120) − salary for that time   (existing, game.js:139-160)
```
R = the player's own reaction time to a blocked unit. The sim's *delegate* persona fixes **R = 1 min, tap × 0.5**; the gate is "net < 0 with ≤ 2 units, > 0 with ≥ 4 units at Lv6–10" (from the audit model: at R = 1 the GM pays from 2 units, at R = 0.5 from 5–6, at R = 0.25 never — a player who reacts in 15 s does not need a manager, and the spec says so in the hire bubble).

### 2.7 Approval thresholds & loans

| Item | Formula | Default (farm / café) | Change |
|---|---|---|---|
| autoLimit (growth budget / 10 min) | options [50,100,200,500,1000]; default `snap(round(0.3 × I(L) / 50) × 50)` — **I(L) per minute** | Lv6 100 / 150→**100**, Lv10 100 / **200** | was fixed 100; `normalizeGm` only accepts listed values (`state.js:271`), so the default snaps to the nearest option (ties snap down) |
| bigLimit | options **[100,300,600,1000,3000]**; default `snap(round(I(L) / 100) × 100)` | Lv6 300 / 400→**300**, Lv10 300 / **600** | was 300; 600 added to the options so café Lv10 lands on 600, not 1000 |
| highValue sale | `20 × I(L)` (= 2 × I10 at reference) | Lv6 5 000 / 8 800 | new |
| creditLimit | `1.5 × 10 × I(L) × (1 + 0.1 × level)` total owed — the **reference** 10-minute income, not the measured `I10` (as coded, `derive.js` `creditLimit`; the worked numbers only fit this reading: the measured reading with a fresh save's 0.3 floor gives 1.5 × 750 × 1.6 = 1 800 at Lv6). Pinned by a test that seeds 2× and 0.3× income and sees no change; **§8 Q13** asks the founder to confirm | farm Lv4 3 850, Lv6 6 000, Lv8 7 560; café Lv8 14 300 | **was none**; it binds at Lv4–8 on the farm (one 5 000 pack at Lv8) and on a debt carried over the wipe; the café is capped by `maxOpen 2` + pack gates from Lv8 |
| loan packs by level | **1 000 from Lv4, 2 000 from Lv6, 5 000 from Lv8** (`LOAN.packLevel`) | | **new rule** (today `loanError` only checks the pack exists, `derive.js:1068`) — a pack is ≤ ≈ 20 min of I(L) at its level (1 000 = 5.5 min of farm I(4); 5 000 = 18 min of farm I(8), 9 min of café I(8)) |
| loan term | **`termMin = clamp(round10up(2 × loanOwed(pack) / (0.2 × I(L))), 30, 150)`**, fixed when the loan is taken | farm Lv6: 1 000 → 50 min, 2 000 → 90; farm Lv8 5 000 → 150 (cap); café Lv8 5 000 → 110 | changed 2026-11-08 after the sim: mul 1.5 → 2, because the delegate earns ≈ 50 % of I(L) and the farm 2 000 pack was late in 2/10 runs at 1.5; 2× the reference repayment time means a player at ≥ 50 % of reference income is never late |
| loans | **max 2 open** (`s.loans[]`, today one stacked `s.loan`), fee 10 % (keep), **late fee +5 % once then "không thể vay"** until owed = 0; autoRepay 20 % of every `earn()` **already in code** (`game.js:44-52`, the GM's own sales go through `earn()` too) | | algorithm §4.5 |
| carried-over debt | `expiry/execute` keeps the debt (`game.js:1636`); after the wipe `owed > creditLimit(Lv1)` is normal → **nobody** (GM or player) can borrow until owed ≤ creditLimit; the HUD shows "Hết hạn mức" and the GM never files a loan task | | new |
| wage arrears | separate `s.debt.wages { follower, gm }`, cap 10 × wage / salary, then the unit leaves | | was piled into `s.loan.owed` |

### 2.8 Penalties (see §4 for the algorithm)

| Layer | Formula | Cap |
|---|---|---|
| loyalty | −3 per expired task (top-up / system tasks 0) | ≤ 15 / day |
| backlog | +1 per expired task, decays −1 / 10 played min (−2 while inbox empty) | 3 → Chờ lệnh, 6 → poachable, 8 → strike |
| zone morale | −3 per expired task to units in the task's zone; −1 / min per unit while the GM strikes (chaos rules) | **≤ 30 per zone per day** from this layer; repair = bonus 🪙50 (+40) or apologise 2 × gmSalary (🪙80 at Lv6 s2) |
| coin fine | `min(0.03 × I30, 0.25 × I10 − finesLast30, coins)` | ≤ 25 % of a 10-min income per rolling 30 min, never < 0 coins, never debt |

The earlier draft had a third cap "2 % of dayIncome". It always bound first (2 % of a 45-min day < one 3 % fine) and made the stated "24 % of I30" bound unreachable, so it is dropped; the rolling cap is now expressed in the same unit as the per-task fine (I30 = 3 × I10): worst 30 min = 25 % of I10 = 8.3 % of I30 = 2.5 played minutes of income.

---

## 3. The manager — Tổng quản lý

### 3.1 Powers by licence (Giấy phép)

One short table per licence. *Tự làm* = runs alone (from the care wallet or the growth budget), *Cần duyệt* = files a task.

**Nhân sự (free)**
| Hành động | Tự làm | Cần duyệt |
|---|---|---|
| care (coffee, food, bonusSmall, nag), shifts, knock, cool, recharge, repair, service | ✓ care wallet | — |
| hire, promote, stat / gear / part / software | ✓ if cost ≤ autoLimit (budget left) | ≥ autoLimit, and always ≥ bigLimit |
| keep a poached worker | ✓ < bigLimit | ≥ bigLimit |
| **fire** | — | always |

**Giao việc (free)**
| Hành động | Tự làm | Cần duyệt |
|---|---|---|
| setTasks, robot task, crop per parcel, water / tend, start / collect production, day plan | ✓ | — |

**Hạt (🪙300)**
| Hành động | Tự làm | Cần duyệt |
|---|---|---|
| sell goods | ✓ < highValue | ≥ highValue |
| buy beans | ✓ ≤ autoLimit (growth budget — **not** the care wallet) | ≥ bigLimit |

**Đất & xây (🪙1000)**
| Hành động | Tự làm | Cần duyệt |
|---|---|---|
| build / upgrade building | ✓ < bigLimit (budget) | ≥ bigLimit |
| buy parcel, **sell parcel** | — | always |

**Tín dụng (🪙1500)**
| Hành động | Tự làm | Cần duyệt |
|---|---|---|
| repay from surplus | ✓ ≤ autoLimit | ≥ bigLimit |
| **loan/take** | — | always |

**Nạp (always)**: top-up **proposal** only (pack id); the player executes real money. Never run by the GM.

`alwaysApprove = { loan, topUp, landBuy, landSell, fire, build ≥ bigLimit, sell ≥ highValue }` — **no mode bypasses it**. Today's `gmPermission` (`derive.js:983-985`) checks `mode === 'full' → 'do'` *before* the tier, which bypasses the bigLimit for the one `big` item that exists (`keep:` a poached worker, `derive.js:953`) and for any future big item; growth items are all tier `advice` and already return `suggest` first, and `gmPlan` produces no loan / land / build items today. The fix is ordering: `alwaysApprove` and `cost ≥ bigLimit` are checked before the mode branch.

Modes: **Cố vấn** (advisor: suggest only, salary ×0.5), **Vận hành** (operator: do safe + care wallet + budget, file the rest), **Toàn quyền** (full: budget ×3, salary ×1.6, share 5 %, alwaysApprove still files). Scope: all owned regions and both zones; off-screen zones get **care + trade + plan rows only** (no production model exists off screen) at tick ÷ 2.

### 3.2 Delegation chain (keeps the farm running smoothly)

```
player ── approves/denies tasks, real money, sets mode/budget/limits
  └─ g1 Tổng quản lý ── plans, assigns, trades, proposes
       ├─ lead / manager-rank worker (one per zone) ── nudges, buys care for its zone every careEverySeconds (keep)
       ├─ workers ── follow u.tasks from the day plan; brain picks within the list (keep)
       └─ robots ── follow u.task from the day plan; software auto-care (keep)
```

### 3.3 Planning loop (`gm/think`, replaces `gm/tick`)

Cadence `thinkSeconds [20,15,10,7,5]`, `actionsPerThink [1,1,2,2,3]` by skill (keep). Backlog ≥ 3 → cadence ×2 and actions 1.

```
think(s, nowPlayed, roll):
  expireTasks(s, nowPlayed)                         // §4.3
  if g1.poach and nowPlayed ≥ poach.until: leave('poached'); return
  if g1.strike or mode == 'advisor' and !suggestionsDue: return
  if nowPlayed − plan.at ≥ PLAN_EVERY_MIN(20): planDay(s)   // §3.4
  snap = snapshot(s)      // fixed metric vocabulary, per zone (see below)
  C = []
  for rule in GM_RULES:   // DATA rows, evaluated by one generic evaluator in derive.js
    if licensed(rule.group) and test(snap[rule.zone][rule.metric], rule.op, rule.value): C.push(candidate(rule, snap))
  for c in C: c.score = c.urgency × (c.value + 1) / (c.cost / I10 + 0.05) × styleMul(style, c.group)
  C.sort(score desc); done = 0; filed = 0
  for c in C:
    if cooling(c.key) or pending(c.key): continue
    perm = permission(c)
    if perm == 'do' and done < actionsPerThink:        run(c, roll_k); done++; hist(g1 → c.subject)
    elif perm == 'file' and filed < 2 and open.length < 8 and done + filed < actionsPerThink + 2:
         file(c, nowPlayed); filed++
    elif perm == 'file': say('Để sau')                 // inbox full: never silently dropped
    elif perm == 'suggest': suggestions.push(c)
    if done ≥ actionsPerThink and filed ≥ 2: break

permission(c):
  if mode == 'advisor' or !licensed(c.group): return 'suggest'
  if c.kind in alwaysApprove or c.cost ≥ bigLimit or c.value ≥ highValue: return 'file'
  if c.group in {care, ops} and c.cost ≤ careWalletLeft: return 'do'
  if coins < c.cost: return licensed('Tín dụng') and loanAllowed(c) ? 'file(loan for c)' : 'suggest'
  if c.cost ≤ budgetLeft: return 'do'
  return 'file'
```

**GM_RULES are rows, not predicates** (the earlier draft had `when(snap) → bool` functions in `economy.js`, which is code, not config, and would have to be rewritten per game):

```
GM_RULES = [ // economy.js; metric names come from the fixed snapshot vocabulary
  { key:'sellFull',   group:'trade', zone:'any',  metric:'storagePct',   op:'>=', value:0.9, urgency:5, act:'farm/sellAll',  cost:'none',        valueOf:'storageValue' },
  { key:'recharge',   group:'care',  zone:'any',  metric:'robotCharge',  op:'<=', value:0.2, urgency:5, act:'staff/care',    cost:'careCost',    valueOf:'contrib',  each:'robot' },
  { key:'hireFarm',   group:'hr',    zone:'farm', metric:'ripeWaiting',  op:'>=', value:3,   urgency:2, act:'staff/recruit', cost:'applicantCost', valueOf:'contrib', ticks:2 },
  …
]
snapshot vocabulary (per zone): units[], blockedUnits, idleUnits, moraleMin, robotCharge, robotHeat, robotWear, jamsIn10, rechargesIn10,
  ripeWaiting, emptyPlots, busyPct, storagePct, storageValue, waitingOrders, beans, beanDemandPerMin, coins, owed, I10, I30,
  openTaskKeys, cooldowns, landForSale[], buildingsIdle[], productionQueueFullMin
```
`each` expands a rule over units; `ticks` requires the condition for n consecutive thinks; `cost` / `valueOf` name functions of a fixed derive vocabulary (`careCost`, `applicantCost`, `partPrice`, `contrib`, `storageValue`, …). Another game supplies rows and a snapshot with the same metric names.

Urgency bands (config): blocking unit 5, storage ≥ 90 % 5, waiting orders 4, idle plots 3, morale < 40 3, growth (hire / upgrade / land) 2, cosmetic 1. Cooldowns: denied key 15 min, expired key 10 min, done key 1 min. Requests count toward the think budget (max 2 filed per tick). All thresholds now hard-coded in `derive.js gmPlan` (0.9, 40, 60 s, 3, 2) move into `GM_RULES`.

**styleMul (3 styles × 3 groups)**
| style | capital (hire, part, land, build, loan) | care | trade |
|---|---|---|---|
| careful | 0.5 | 1.2 | 1.0 |
| balanced | 1.0 | 1.0 | 1.0 |
| bold | 1.5 | 0.8 | 1.2 |

### 3.4 Day plan — Kế hoạch ngày (every 20 played min and on hire)

```
planDay(s):
  for zone in scope:
    crop = chooseCrop(zone)                                    // §3.5
    for parcel in parcels(zone): if every plot in plotsOf(parcel) is empty: plan.crops[parcel.id] = crop
        // "field group" = a parcel (layout.js lot → plotsOf(lotId)); region.fields is a flat {id,x,z} list and
        // crops live per field id in region.plots, so the plan stores the crop per parcel and the worker brain
        // plants plan.crops[parcelOf(fieldId)]. Hysteresis: a parcel with any growing plot keeps its crop.
    for w in workers(zone): w.tasks = top taskLimit(w) of TASKS[zone] by need(task) × fit(w, task)
        // every task family keeps ≥ 1 unit
    for r in robots(zone): r.task = argmax need(task) over ROBOT_TASKS[type] (else 'auto')
  plan.target = round10(I10 × 2 × GM.plan.targetMul 1.1)        // coins expected in the next 20 min
  hist({ actor:'g1', group:'plan', type:'dayPlan', extra:{ crops, target, assignments } })   // one report row
  say("Hôm nay: Arabica 60 % · Robusta 40 % · mục tiêu 🪙5 500")   // farm Lv6: 2 500 × 2 × 1.1
```

**Changed 2026-11-08 after the sim (balance pass):**
- **Café workers are not locked** (`GM.plan.lockWorkers = { farm: true, shop: false }`): their posts already re-split order / brew / deliver every second; a fixed 20-min list cost the café 9–14 coins/min of net worth (team of 4: −27 → −18; team of 6: −10 → +4). Robots still get their one task; farm workers keep the need × fit list (it pays there).
- **Throughput upgrades read the manager's measured load**, not a demand model: every think he samples `D.actionableJobs(zone)` — jobs a free worker could start right now (café: ready cups + taken orders that fit a free brew slot + waiting customers that fit a free seat; farm: ripe plots with storage room + empty plots + paid watering) — into an EMA `s.gm.load[zone]` (`GM.load.ema 0.2`). A speed / gear / motor step is worth `clamp((load / working units − 1) / 1, 0, 1)` of its value. The old arrival-based demand model (walk-ins only) ignored seats and brew slots, so the manager kept buying speed, shoes and kettles for baristas who were waiting on chairs — the café earned 110–140 coins/min less with him than without.

**need / fit (the two functions the plan depends on):**
```
need(task) = queued(task) / (1 + unitsOn(task))
  queued: harvest → ripe plots; plant → empty plots; water → dry plots; order → customers waiting;
          brew → orders taken, not brewed; deliver → cups ready
fit(w, task) = 0.5 + 0.1 × stat(w, STAT_OF[task])     // STAT_OF: harvest→accuracy, deliver→speed, plant→stamina, water→stamina,
                                                       //          order→smart, brew→smart   (1.0 at stat 5, 0.6 at stat 1)
robots: fit = 1 (one task, no stats)
```

### 3.5 Crop rule (labour-aware ROI)

```
cropRate(crop, zone):
  perBean   = bestSellValuePerBean(zone)             // raw 2; bag ladder ≈ 7.8 when packer owned and idle
  perPlot   = (yield × perBean × (1 + yieldBonus) − seed) / growMin
  perJob    = yield × perBean × (1 + yieldBonus) − seed
  plotCap   = emptyOrOwnedPlots × perPlot
  labourCap = Σ_units jobsPerMin(u) × perJob          // jobsPerMin from WORK table ÷ unitSpeed; contrib(u) = jobsPerMin(u) × perJob
  return min(plotCap, labourCap)
chooseCrop = argmax cropRate over crops with level ≥ crop.level and silo space; tie → higher XP
```
Lv6 example (12 plots, 2 farmhands ≈ 6 jobs/min, raw sale): robusta plotCap 96, labourCap 12 → labour-bound; with the packer ladder arabica perJob 25 vs robusta 13.6 → **arabica**.

### 3.6 Land rule

```
utilisation(parcel) = mean over the last 30 played min of busyPlots(parcel) / plots(parcel)   // sampled each think
paybackMin(parcel)  = price / (fields(parcel) × perPlot(bestCrop) × utilisation(zone))
propose BUY  if paybackMin ≤ 45 and busyPct(zone) ≥ 85 % and (coins ≥ 1.2 × price or loanAllowed)   // ≤ 1 proposal / 30 min
propose SELL if utilisation(parcel) < 20 % for 30 played min
             and (coins < careWallet                                  // sell to stay liquid, or
                  or refund 0.6 × price ≥ 40 × fields(parcel) × perPlot(bestCrop) × utilisation(parcel))   // the land earns less in 40 min than it refunds
             // ≤ 1 / 30 min; never the last parcel of a zone
```
Lv6 farm: F5 🪙600, 6 fields × 8/min × 0.9 ≈ 43/min → payback 14 min ⇒ propose. P1 🪙4800 needs ≥ 107/min ⇒ only with the packer ladder. SELL example: a 6-field parcel at 15 % use earns 6 × 8 × 0.15 × 40 = 🪙288 in 40 min < refund 360 ⇒ propose.

### 3.7 Staffing, robot, trade, building, loan and self-upgrade rules

- **Hire** when backlog of ready plots / waiting orders ≥ 3 for 2 ticks and a free slot; best applicant by Σ stats, diligent +1, lazy −1; robot only if the robot share allows and `contrib(robot) − runningCost(robot) ≥ contrib(worker)` (on the farm this stops at ≈ 2 robots, §2.3).
- **Upgrade** the stat / part with the best `value / cost` (§2.5 value table) whose payback ≤ 40 min (≤ 90 for tier ≥ 2 / step ≥ 3); quality upgrades (accuracy, smart, shears, hat, frame) only when the unit's mistakes today ≥ 3; fire only after two D grades (task).
- **Robots (new block)**: `recharge` when charge ≤ 20 % (care wallet, urgency 5); `knock` on jam at once (urgency 5, free); `cool` when heat ≥ 80 % (🪙10, care wallet); `repair` when wear < `lowWear 30` and `repairCost ≤ careWalletLeft`; `service` when heat events ≥ 2 in 10 min; propose `autoCharge` when recharges ≥ 2 in the window, `autoUnjam` when jams ≥ 2 (mirrors `derive.js:887-890`); never propose battery ≥ t2 when `autoCharge` is owned (pure fee, payback > 90 min). Each ≥ bigLimit → a `staffGrowth` task.
- **Bean trade**: sell goods when storage ≥ 90 %, or when `coins < careWalletLeft` **and** a care action is pending (not merely "coins < wallet" — the sim's cash balance is below any wallet most of the time); buy beans when cups wait and beans < 2 × demand per minute, inside autoLimit; sell ≥ highValue → task.
- **Building**: build / upgrade when the production queue has been full ≥ 10 min and payback (price / Δ throughput value) ≤ 45 min; ≥ bigLimit → task.
- **Loan**: file only if `Σ owed + loanOwed(pack) ≤ creditLimit`, `open < 2`, `level ≥ packLevel`, no `blocked` loan, and `paybackMin(target) < term / 2`; one loan task per 30 min; the task names the target ("Vay 1 000 để mua đất F5"). **Repay**: when `coins ≥ owed + careWallet + autoLimit` → repay alone up to autoLimit, else file `repay` (≥ bigLimit). **Top-up**: file only after ≥ 2 denied loan tasks in the session and `I10 < 0.5 × plan.target`; never penalised; at most once per day.
- **Self-upgrade (new)**: propose `gm/buyLicence {group}` (suggest only, player pays) when a rule of that group would have fired ≥ 3 times this session ("Em có thể lo việc mua hạt nếu sếp cấp giấy phép Hạt — 3 lần hôm nay"); propose `gm/train` as a `staffGrowth` task when candidates > actionsPerThink for 3 consecutive thinks and `Δ actions × avg candidate value` pays the 400 × (skill+1) back in ≤ 40 min.
- **Chaos / poach**: keep as coded (chaos slack ×2, morale −1/min, calm 300 + 50 × units, `+10` morale moved to config); the GM's own poach is a `gmPoach` task; backlog ≥ 6 makes him poachable regardless of loyalty.

---

## 4. Verification system — Việc cần duyệt

### 4.1 Kinds, life, reminders (played minutes)

| kind | examples | life | reminders (toast + badge) |
|---|---|---|---|
| care | keep poached worker ≥ bigLimit | 5 | file, 50 %, last min |
| trade | sell ≥ highValue, buy ≥ bigLimit | 10 | file, 50 %, last min |
| staffGrowth | hire / upgrade / train ≥ bigLimit, fire | 30 | file, 50 %, last 2 min |
| land | buy parcel, sell parcel, build ≥ bigLimit | 60 | file, 50 %, last 5 min |
| loan | loan/take pack, repay ≥ bigLimit | 30 | file, 50 %, last 2 min |
| poach / gmPoach (system) | rival visit | 1 / 3 | file, 50 % |
| topUp | real-money pack | until the next day plan or 60 played min, whichever first | file only |

**Clock.** `s.clock.played` (ms, advanced only by realm ticks while the app is foregrounded). Tasks **freeze** while the app is closed. The existing real-time layer stays: `GM.mood.away` (−10 loyalty per hour closed beyond 2 h, ≤ 40, `game.js:1526-1540`) and `GM.away` pay. The two meet on return (`gm/seen` after ≥ 5 min away): every open task gets `until = max(until, nowPlayed + 2 min)`, one grouped toast "Quản lý có 3 việc chờ anh/chị", the HUD top-bar badge **Duyệt (n)** in the manager colour, and the **combined loyalty loss on one return (away drop + expiries that fire in the first 2 min) is capped at `awayMax 40`**. Whether a closed app should also let tasks expire is **§8 Q10**. Inbox cap 8; a 9th candidate is spoken as "Để sau" and logged, never dropped silently.

### 4.2 Answering

```
approve(t): coins ≥ cost ? run(t.act, approved) : t.status = 'failed' (re-filed after cooldown); loyalty +2; backlog −1; hist(player→g1, taskId)
deny(t):    loyalty −1 (free of penalty); cooldown(key, 15 min); backlog −1; hist
late(t):    allowed from done within 5 min of expiry: run as approve, loyalty +1 (not +2), backlog −1, clears the cooldown; fine not refunded
apologise:  gm/apologise costs 2 × gmSalary → backlog 0, loyalty +10, strike ends
```

### 4.3 On expiry (penalty order: loyalty → throttle → coins)

```
expire(t):
  t.status = 'expired'; move to done; cooldown(t.key, 10 min); hist({actor:'system', type:'taskExpired', taskId})
  if t.kind == 'topUp' or t.by == 'system': return            // never penalised (rival outcome is its own consequence)
  // 1. loyalty
  g1.loyalty −= min(3, 15 − loyaltyLostToday)
  // 2. throttle
  g1.backlog += 1
  if backlog ≥ 3 and !g1.waiting: g1.waiting = { until: now + 10 min }   // Chờ lệnh: safe + care only, 1 action/think, no filing, yawn
  if backlog ≥ 6: g1.poachable = true; next rival visit targets g1
  if backlog ≥ 8: strike (Đình công): GM stops, chaos rules apply until apologise or inbox empty
  // 3. coins, last and capped
  fine = min(0.03 × I30, 0.25 × I10 − finesLast30, coins)      // finesLast30 over (now − 30, now]
  if fine > 0: coins −= fine; s.income 'penalty'; t.fine = fine
  // 4. imbalance the player can see
  for u in units(t.zone): u.morale −= min(3, 30 − moraleLostToday(zone))
backlog decay: −1 per 10 played min since the last rise, −2 while inbox is empty; waiting ends when backlog < 3 or any task is answered
// changed 2026-11-08 after the sim/tests: decay timer → restarts on each new expiry, because a free-running timer fired at 74:00 and contradicted the §4.4 table (backlog 3 at 74:00)
```

**Bounds.** Coins: per task 3 % of I30 (= 9 % of I10); per rolling 30 min ≤ 25 % of I10 (2.5 played minutes of income; at farm Lv6 🪙625, at café Lv15 🪙2 625); never below 0, never debt. Loyalty ≤ −15 / day. Morale: −3 per expired task **plus −1 / min per unit during a strike**, together ≤ −30 per zone per day (repair: one 🪙50 bonus = +40, or apologise 2 × gmSalary = 🪙80 at Lv6 s2). No death spiral; the real "imbalance" is the problem itself persisting (storage full, worker poached, land not bought) plus a slower GM.

### 4.4 Worked session (farm Lv6: I(6) = 250/min, I10 ≈ 2 500, I30 ≈ 7 500; skill-2 operator, balanced, loyalty 65; autoLimit 100, bigLimit 300, highValue 5 000; licences Hạt + Đất & xây bought earlier; fine/task 225, 30-min cap 625)

| played | event | effect |
|---|---|---|
| 00:00 | GM hired, day plan: Arabica 60 %, mục tiêu 🪙5 500 | plan row |
| 02:00 | sells 420 hạt rang 🪙3 780 **alone** (3 780 < highValue 5 000) | did row |
| 04:00 | files «Mua đất F5 🪙600» (land, until 64:00, payback 14 min) + «Thuê nông dân Tí 🪙160» (staffGrowth, until 34:00: 160 < bigLimit 300 but > autoLimit 100) | 2 open |
| 05:00 | player buys the packer 🪙3 000 himself → coins 560 | — |
| 10:00 | app closed 25 real min — clock stops, tasks freeze; no away drop (< 2 h) | — |
| 35:00 real / 10:00 played | return: both tasks keep their `until` (≥ now + 2), toast "2 việc chờ" | — |
| 34:00 | hire task expires: loyalty 65 → 62, backlog 1, fine min(225, 625, 560) = **🪙225**, farm morale −3; hire re-filed at 44:00 (cooldown 10) | first fine |
| 44:00 | backlog decays to 0; «Thuê Tí» re-filed, until 74:00 | 2 open |
| 60:00 | storage 92 % → files «Bán 600 hạt rang 🪙7 200» (≥ highValue, trade, until 70:00) | 3 open |
| 64:00 | land task expires: loyalty 59, backlog 1, fine min(225, 625 − 0) = **🪙225** (the 34:00 fine is outside (34, 64]) | 450 |
| 70:00 | sale task expires: loyalty 56, backlog 2, fine min(225, 625 − 225) = **🪙225**; the GM sells 420 of the 600 alone next think (3 780 < 5 000) and keeps the rest | 675 |
| 74:00 | hire task expires again: loyalty 53, backlog 3 → **Chờ lệnh** 10 min (yawn bubble, safe + care only); fine min(225, 625 − 450) = **🪙175** | 850 |
| 78:00 | player opens the inbox, late-approves the hire (within 5 min: +1 loyalty, backlog 2, waiting ends) | recovered |

Net cost of ignoring for ≈ 45 played minutes: **🪙850 = 11 % of I30 (3.4 min of income)**, loyalty −12 (+1 back), farm morale −12, 4 min of Chờ lệnh. Same neglect at café Lv15 (I10 10 500, I30 31 500): fines 945 / 945 / 945 / 735 (the 30-min cap 2 625 binds on the fourth) = 🪙3 570 = 11 % of I30.

### 4.5 Loan life (`loan/tick`, from the realm minute tick on played time)

```
s.loans = [ { id, amount, owed, takenAtPlayed, termMin, late: false, target? } ]   // ≤ LOAN.maxOpen 2; termMin from §2.7 at take time
earn(amount):           // existing, game.js:44 — 20 % of every income goes to the oldest open loan first
  cut = min(oldest.owed, 0.2 × amount); oldest.owed −= cut; … (then the next loan)
loan/tick(nowPlayed):
  for ln in s.loans: if !ln.late and nowPlayed ≥ ln.takenAtPlayed + ln.termMin and ln.owed > 0:
      ln.owed = round(ln.owed × 1.05); ln.late = true; s.loan.blocked = true        // +5 % once, "không thể vay"
      hist({ actor:'system', group:'money', type:'loanLate', extra:{ id, owed } }); say(g1: "Sếp ơi, khoản vay quá hạn rồi")
  s.loan.blocked = s.loans.some(ln => ln.late)        // lifted when every late loan is cleared
loanAllowed(pack): !blocked and open < 2 and level ≥ packLevel[pack] and Σ owed + loanOwed(pack) ≤ creditLimit
```
Repayment order: autoRepay → GM `repay` from surplus (§3.7) → player `loan/repay`. The care wallet and the growth budget are computed on income **after** the 20 % cut, so a loan slows the GM's growth spending by exactly the repayment.

Worked example, pack 1 000 at farm Lv6: owed 1 100; term = round10up(1.5 × 1 100 / 50) = 40 played min; autoRepay 20 % × 250/min = 50/min → cleared in **22 played min**. If the player idles and the GM is in Chờ lệnh (income ≈ 40 %, 20/min): 55 min → late at 40:00, owed 300 → 315 (+🪙15), "không thể vay" until it is cleared ≈ 16 min later — a mild, visible consequence, never a spiral. A 5 000 pack at farm Lv8 (I(8) = 280): owed 5 500, term 150 (cap), cleared in 98 min at reference; at the café Lv8 (530/min): term 80, cleared in 52.

---

## 5. Unified history — Nhật ký

**Write path.** One helper `hist(s, row)` replaces `journal()`, `note()`, `gmLog()`; the old arrays become derived views (`unitLog(uid)`, `teamJournal(zone)`, `gmLog()`) so current HUD code keeps working during migration. Every GM action writes `actor:'g1', subject: uid|fieldId|parcelId, taskId?`; every player answer writes `actor:'player', subject:'g1', taskId`. Realm job completions come through `staff/workDone {uid, n, task}` and are **aggregated to one row per unit per played minute** («thu hoạch ×12»). `staff/setTasks`, robot task, crop assignment, loans, land, builds, top-ups and penalties all get rows (today none of them do).

**Retention (per unit, not only shared).** The shared `rows` ring of 400 holds ≈ 40 min for a 10-unit team writing a row per minute each, so it is not a unit's history. Each unit (GM included) also keeps **`u.recent`, a ring of its last 30 rows** (`HISTORY.perUnit 30`), written at the same time; the profile's *Lịch sử* reads `u.recent` first and the shared ring after. `days` 30 per actor per day; tombstones for units that leave so rows stay readable. The Lv10 wipe keeps `days`, tombstones, the follower's `recent`, and **every row with `group ∈ {plan, approval}`** (the manager's trail), trims the rest to the last 50, and stamps a `rebirth` row.

**Screens.**
- Top-bar 📒 → **Nhật ký**: actor chips *Tất cả / Tôi / Quản lý / Nhân viên / Robot*, group chips *Việc / Chăm sóc / Nhân sự / Tiền / Kế hoạch / Duyệt / Sự kiện*, zone and day filters; grouped by day, 50 rows per page; manager rows carry a violet bar; `taskId` taps open the task with ask→answer latency.
- Unit profile → *Lịch sử* = `u.recent` + the shared list filtered by `actor == uid || subject == uid`; GM profile shows its day plans, tasks filed and their outcomes.
- Inbox *Đã xử lý* = `s.tasks.done` with status, latency and fine.
- Repaint is **event-driven** (store event `history`), not the 1-s modal timer.

---

## 6. Manager look

- **Colour token** `--c-manager: #7c4dbd` (royal purple) reserved for the manager only: HUD avatar, name tag, badge, history bar, bubble rim. Farm green `#6f9a4a`, shop brown `#8a5a3a`, robots mint/orange stay. Lead / manager-rank workers get only a gold armband `#f0b429`.
- **Model**: `createPerson('#7c4dbd')` + `dressPerson('manager')`: white shirt, purple vest, flat cap, clipboard; height ×1.05; gender per unit.
- **Idle spot**: a small desk (*bàn điều hành*) by the lot gate of each zone; every think he walks (2.8 m/s) to the unit or field he acts on, `point` 0.8 s, returns; chaos / strike = desk empty, sitting on a crate with 🪧.
- **Animations / bubbles**: `phone` + 📋 bubble with countdown while a task is open (speech priority high, violet rim); red ring under his feet when any task is < 10 % life; `yawn` while *Chờ lệnh*; `facepalm` when a task expires; `thumbsUp` on approve; 😒 bubble when loyalty < 70.
- **Speech style**: short, respectful Vietnamese to the boss ("Sếp ơi, duyệt giúp em mua đất F5 nhé — còn 5 phút", "Hôm nay trồng Arabica 60 %", "Để sau vậy").

---

## 7. Migration from the current code

### 7.1 Config (`economy.js`) — one key per line

Add:
- `INCOME_REF { farm, cafe }` and `INCOME_FLOOR 0.3`
- `UNIT_KINDS`
- `GM_RULES` (data rows: key, group, zone, metric, op, value, urgency, act, cost, valueOf, each?, ticks?) + `GM_SNAPSHOT_METRICS` (the vocabulary)
- `GM.licences { groups, prices, unlockLevel 6 }`
- `GM.training { basePerSkill 400, shiftDays 1 }`
- `GM.plan { everyMin 20, targetMul 1.1 }`
- `GM.careWallet { min 50, rosterMul 1.5, workerPer10 35, robotExtra 20 }`
- `GM.styleMul` (3 × 3 table, §3.3)
- `GM.urgency` bands, `GM.cooldownMin { denied 15, expired 10, done 1 }`
- `GM.quitArrearsSalaries 10`
- `TASKS { life per kind, remindAt, cap 8, graceMin 2, lateMin 5, topUpLifeMin 60 }`
- `PENALTY { perTask .03, cap30OfI10 .25, loyalty 3, loyaltyDay 15, morale 3, moraleZoneDay 30, backlog { waitAt 3, poachAt 6, strikeAt 8, waitMin 10, decayPer10 1, emptyDecay 2 }, apologiseSalaries 2, returnLoyaltyCap 40 }`
- `HISTORY { rows 400, perUnit 30, days 30, workBatchSec 60, keepGroupsOnWipe ['plan', 'approval'] }`
- `LAND.sellRefund 0.6`, `LAND.sellPaybackMin 40`
- `DEBT.wageCapMul 10`
- `LOAN.creditMul 1.5`, `LOAN.maxOpen 2`, `LOAN.term { mul 1.5, minMin 30, maxMin 150 }`, `LOAN.lateFee .05`, `LOAN.packLevel { 1000: 4, 2000: 6, 5000: 8 }`
- `SOFTWARE.packs.precision`
- `UPGRADE_GATE { paybackMin 40, latePaybackMin 90, quality: ['accuracy', 'smart', 'shears', 'hat', 'tray', 'frame'] }`

Change:
- `ROBOT_PARTS.battery.minutes [3,4,6,9] → [6,9,13,18]`
- `STAFF_BREAKS.robot { feeRatio .06 → .03, minFee 25 → 15 }`
- `PART_COST.costRatio [.3,.6,1] → [.15,.3,.5]`
- `UPKEEP.robotStandbyRatio .03` (new key)
- `STAFF_CAP.robotShare .5` (new key); **no `benchExtra`** (§8 Q7)
- `CAREER.need → { skilled: {level 7, sd 2}, lead: {level 9, sd 4}, manager: {level 13, sd 12} }`, `CAREER.shiftDayMin 5`
- `GM.modes.full { mul 2 → 1.6, share .15 → .05 }`
- `GM.keepBonusSalaries 20 → 6`
- `GM.styles.bold.loyalty [30,50] → [45,60]`
- `GM.loyalty.unpaidPerMin 10 → 1`
- `GM.bigLimits [100,300,1000] → [100,300,600,1000,3000]`, `GM.budgets + 1000`, `GM.defaults` computed from I(L) and snapped
- `LOAN.autoRepay .2` **unchanged and already applied** (`game.js:44`)
- `GM.value.jobsPerMin { farmhand 3, barista 4, sproutBot 4, brewBot 5 } → { farmhand 8, barista 8, sproutBot 11, brewBot 10 }` — changed 2026-11-08 after the sim: the realm job loop (`STAFF_SIM`) finishes 8.7–9.1 harvests / min per farmhand and 8.8 café jobs / min per barista, so the planner saw ⅓–½ of a unit's real value; robots keep their old ratio to the worker (×1.375 / ×1.25)
- `D.throughputShare(s, u)` (new rule, no key) — changed 2026-11-08 after the sim: a throughput step (speed, stamina downtime, walk / brew gear, motor, battery downtime) counts only the jobs the zone can still absorb: share = clamp((demand − capacity) / (0.1 × capacity), 0, 1), demand = walk-ins / min × jobsPerDrink (café) or fields ÷ grow minutes (farm), capacity = Σ jobsPerMin of the zone's working team; because the café is demand-bound (one walk-in / 9 s) and the GM bought speed / shoes for baristas who were waiting for customers

Move literals into config: `gm/calm +10`, gmPlan thresholds, realm `SPEED/WORK`, brewBot 1.15, deliver .25, staff-brain constants, HUD energy warn 50.

### 7.2 Actions

New: `gm/think` (renames `gm/tick`), `gm/planDay`, `gm/train {stat}`, `gm/buyLicence {group}`, `gm/apologise`, `gm/quit` (arrears), `task/approve|deny|late|expire|extend`, `land/sell {parcelId}`, `loan/propose`, `loan/tick`, `topup/propose` (task only; player executes through the store), `clock/tick {ms}`, `history/add` (internal). `gm/approve|deny`, `staff/keep|letGo`, `gm/keep|letGo` become aliases over `task/*`. `staff/workDone` gains `task`. `gm/payroll` pays partially and books arrears. `expiry/execute` keeps `s.gm.licences`, `history.days`, tombstones, plan / approval rows, the follower's `recent` and `tenurePlayedMin`, `s.clock`, `s.loans` (debt carries over, as today).

### 7.3 State & normalize

- `s.clock { played }`
- `s.income { rows }` (§2.0) — new, empty on old saves (I10 starts at the floor)
- `s.tasks { open, done }` ← migrate `s.gm.requests`, `s.staff.poach`, `s.gm.poach`
- `s.history` ← migrate `u.log`, `s.staff.journal`, `s.gm.log` (actor inferred: unit rows → uid, gm rows → g1); `u.recent` ← last 30 of `u.log`
- `s.gm.unit` gains `uid 'g1'`, `kind 'manager'`, `backlog 0`, `book`, `days`, `recent`, `tenurePlayedMin` (**stays in `s.gm`**, §1.1); `s.gm.licences []` (player-owned)
- `s.loan {amount, owed, takenAt} → s.loans[]` (one entry from the old object, `takenAtPlayed = 0`, `termMin` from §2.7 at the current level); `D.loanOf` becomes a view over the oldest open loan so the HUD Borrow/Repay tabs keep working
- `s.debt { wages: { follower, gm } }`
- `u.tenurePlayedMin` ← `(now − hiredAt)` capped at one shift-day for old saves
- Normalize must be idempotent (run twice = same state) and covered by a fixture test on a pre-migration save.

### 7.4 Phased rollout (each shippable alone)

**Balance pass 2 (2026-11-08, founder: "ok" to the five proposals):**
- **GM value gate premise changed.** "< 0 at ≤ 2 units" is dropped: on the farm the manager's worth comes from growth decisions (crops, land, upgrades), so even a team of 2 gained +39 coins/min of net worth. New gate: from 4 units the 95 % interval of Δ net worth is > 0 **and** the manager pays back his fee + licences within 60 played minutes; ≤ 2 units is shown for information.
- **Café manager uses free care first:** a hungry café worker goes to the free 60-s lunch (rule `lunchShop`, every style); paid food stays a farm choice. Beans are still bought only when waiting cups need them (`beansLow`).
- **Upgrade buttons show the planner's payback** ("Hoàn vốn ~X phút", amber past 90 min, "Lúc này chưa đáng" when the step adds nothing now) and the café shows "Quán đang thiếu khách, không thiếu người" when the measured load says staff are not the bottleneck. Late café stat / gear prices are kept (they still pay on the farm).
- **Neglect fines unchanged:** the calmer manager files fewer tasks, so 45 min of neglect costs the café ≈ 5 % of I30 instead of 8–12 %; the per-task fine is as designed.
- **Sim persona:** the delegate hires a first helper from Lv3 (a real player does), so the Lv3 running-cost rows measure a roster.

**Founder feedback 2026-11-08 ("rich, many staff, 2 lots — the manager is asleep"):**
- A job held back only by a missing licence (land, beans, credit) now files an **inbox task** for that licence ("Sếp cấp giấy phép Đất & xây giúp em, em làm được ngay: mua lô F2"), instead of a quiet suggestion in the manager's tab.
- **Land-bound farm** (`D.landBound`: farm units × `GM.planRules.plotsPerWorker` 3 > plots): no more hires (`hireRoom` capped at ⌈plots / 3⌉), and land is proposed every `GM.land.boundEveryMin` 10 min instead of 30.
- **Farm well** (giếng nước, layout `FARM_WELL`, south-west edge of the gate plaza): tending workers walk to it, fill a bucket (`TEND.bucketPlots` 2 plants per trip), carry it and water.

**Gate run after balance pass 1 (`--gates --runs 10 --gm-seeds 6`): 41 PASS, 13 FAIL, 2 SKIP** (before: 38 / 41): 3 vacuous cost rows (no unit at Lv3 / no manager at farm Lv6), 6 late café / farm stat and gear paybacks of 105–343 min, café neglect 5.3 %, farm neglect read at Lv7, GM value farm N=2 +39 (old premise) and café N=4 −14.

**GM net value gate, measurement (changed 2026-11-08):** Δ **net worth** (coins − debt + buildings, lots, units' hire / parts / software / gear / stat steps at cost; fees, licences, care, salary and fines are lost) per played minute over **40** played minutes (the throughput payback horizon) from the region-2 hire, manager vs the same coins sunk. Cash over 20 min counted every upgrade the delegate approved as a loss and none of what it bought.

| Phase | Ships | Tests that change / are added | Sim gate |
|---|---|---|---|
| **P1 Reprice + anchor** | `INCOME_REF` per game + `s.income`, robot battery / fee / parts, robot standby, robot share, career shift-days, GM salary / share / keep fee / loyalty start / arrears, loan list + creditLimit + maxOpen + term + late fee + pack levels, literals → config | economy tables snapshot (new battery / part / limit numbers); `core.test.mjs:827` (battery tier-2 minutes 6 → 13; `:826` "cheaper" still holds); `core.test.mjs:253` loan test rewritten for `s.loans[]` (two packs = two entries, not one 3 000 / 3 300 object); `loanError` cap / count / level; `tenure` in played time; `gm/payroll` partial pay + arrears | sim adds a *delegate* persona (tap ×0.5, R = 1 min, hires GM at Lv6, dispatches `staff/upkeep`, `staff/vitals`, `staff/care`, `gm/think`, `gm/payroll`, `rival/visit`): Lv10 at 12–20 **played** min (±25 %) for the tapper and the delegate (the neglect persona is the delegate until region 2, so it has no Lv10 row); mandatory running cost ≤ 25 % of **measured earnings** at Lv3/6/10/15 per game, one region per row (spans keyed `region:level`), **vacuous = FAIL** when the roster is empty or (from Lv6) no manager was on duty; every throughput upgrade pays back ≤ 40 min (≤ 90 for late tiers) **at the level that step first became available to the delegate** (it owns that unit type and, for step ≥ 2 / tier ≥ 1, one of its units stands at that step), on its real processing chain, with the job rate measured over **working** seconds (idle on-shift time is demand, already in `throughputShare`); unit types the delegate never owned are **SKIP (unmeasured)**; loan payback < term in 90 % of runs per pack at its level **with autoRepay only** (no deadline top-up by hand). `node scripts/economy-sim.mjs --gates` exits 1 when any row FAILs |
| **P2 Clock + inbox + history** | `s.clock`, `s.tasks` (absorbs poach), expiry algorithm §4.3, late / deny / apologise, care wallet, `s.history` + `u.recent` + views, Nhật ký screen, HUD badge, `loan/tick` | task lifecycle (file → remind → expire → late), penalty bounds with exact inputs (farm Lv6: 225 / 225 / 225 / 175 as §4.4; never < 0 coins; ≤ 25 % I10 per 30 min; morale ≤ 30 / zone / day), backlog states, return cap 40, history ring + per-unit ring invariants + tombstones + wipe keep-groups, normalize fixture | 45 min of neglect costs 8–12 % of I30, read only when the region-2 manager was hired at `GM.unlockLevel` (else FAIL "wrong window"); coins never < 0 |
| **P3 Planner v2** | `GM_RULES` rows + evaluator, `permission` ordering, day plan with parcel hysteresis, need / fit, crop / land / staffing / robot / trade / building rules, licences, training, self-upgrade proposals, `land/sell`, loan / top-up proposals, both zones (care + trade + plan off screen) | planner determinism (same state + roll → same actions), permission matrix × modes (full never bypasses alwaysApprove), crop argmax, land payback + sell predicate, loan proposal bounds, top-up only after 2 denials | GM net value < 0 at ≤ 2 units, > 0 at ≥ 4 (R = 1), net = Δ coin balance over 20 played min (every coin out, capital the GM triggers included), ≥ 10 seeds, PASS only when the whole 95 % interval is on the right side of 0; chosen crop = cropRate argmax; ≤ 1 land / loan proposal per 30 min |
| **Gate status 2026-11-08** (after the audit fixes; `--gates --runs 10 --gm-seeds 10`: 41 PASS, 15 FAIL, 1 SKIP, exit 1; two of the FAILs were the Lv10 cost rows reading region 1's 0-minute Lv10 — fixed after the run to read region 2, re-checked alone: farm 1.0 %, café 1.6 % PASS → 43 / 13 / 1) | **P1–P3 are not shipped by the gates.** Open: farm delegate hires the manager at Lv9 (R1) / Lv8 (R2), not Lv6 — the 🪙800 skill-2 fee is ≈ 6 min of its ≈ 125/min at Lv5–6 while Lv6 lasts ≈ 2–3 min, so the Lv6 cost row and the farm neglect window are FAIL (vacuous / wrong window); Lv3 rows are vacuous on both games (no hire before Lv4–6); farm 2 000 loan with autoRepay only is late in 2/10 runs (payback 68.7 vs term 70); café neglect fines 6.2 % (< 8 %); brewBot cooler t0→1 105.8 min; GM net value: no row's 95 % interval is on the required side (farm N=6 is significantly **negative**, −9.5 ± 6.6) | — | needs a balance decision (GM fee / delegate income / §8 Q14), not a test change |
| **P4 Manager in the world** | purple token, model, desk, walk / point / phone / yawn / facepalm / thumbsUp, 📋 countdown bubble, red ring, armbands, speech lines | visual QA on phone portrait | — |
| **P5 Hardening** | `gm/*` + `task/*` + `history/*` + `loan/*` test suite, old-save migration corpus, spec sync (`general-manager.md`, `staff-manager.md`, `research.md`) | coverage of every new action | all gates re-run |

---

## 8. Open questions for the founder

1. **Coin fine at all?** The spec keeps a capped coin fine as the *last* layer (≤ 3 % of 30-min income per task, ≤ 25 % of a 10-min income per 30 min). Do you want it, or loyalty + Chờ lệnh + morale only?
2. **Real-money top-up proposals**: at most one per day, only after two denied loans — acceptable, or should the GM never mention real money and the player only sees the shop?
3. **Full mode (Toàn quyền)**: confirm it still files loan / land / fire / high-value tasks (never bypasses approval); today's code lets full mode skip the big-job limit for "keep a poached worker" (the only big item) — and the share drops from 15 % to 5 % (full mode is paid through ×1.6 salary).
4. **Land sell refund 0.6** and GM-proposed land sales only when a parcel sits < 20 % used for 30 min and selling beats 40 min of its income — or forbid selling land entirely?
5. **Career tenure in played shift-days** (1 sd = 5 played min: skilled Lv7 after 10 min, lead Lv9 after 20 min, manager Lv13 after 60 min = region 2) replaces real calendar days — this changes the "come back tomorrow" retention hook; confirm.
6. **Lv10 wipe scope**: licences (on the player), history days, the manager's plan / approval rows and the play clock survive; the GM itself is still wiped (hired again at Lv6 of the new region) and only the follower keeps tenure. Keep, or let the GM follow like the chosen follower?
7. **Bench +2 (Dự bị)**: the earlier draft proposed hires per zone = slots + 2 so a tired worker can be swapped. That undoes your 2026-11-07 rule "team per zone = level, nobody waits on the bench" (code comment `derive.js:514`, tests `core.test.mjs:190, 751`, `staff-manager.test.mjs:27`). The spec keeps your rule; say if you want the bench back. Robot share ceil(slots/2): fine, or a separate robot pool?
8. **I10 floor** 0.3 × reference (down from 0.5, because farm-only income at Lv9–14 is only 45–55 % of the old blended curve) and **one reference curve per game** — approve, or one curve with a farm factor?
9. **Manager colour**: royal purple `#7c4dbd` reserved for him; lead / manager-rank workers get a gold armband only — approve the palette?
10. **Played clock vs real clock for deadlines**: tasks freeze while the app is closed, so a player who closes the app is never fined — only the existing "missed you" loyalty drop (−10/h after 2 h, ≤ 40) applies. Is that what "nếu tôi không xử lý sẽ bị phạt" means, or should tasks keep running in real time with a grace (e.g. 2 h) after which they expire on return?
11. **Licence levels**: all five licences from the GM's unlock (Lv6), paced by their coin price (Hạt 300, Đất & xây 1 000, Tín dụng 1 500) — or keep land at Lv8 and credit at Lv9 (then the GM cannot propose land or loans in the first region)?
12. **Unpaid salary**: arrears instead of the loyalty cliff; the GM quits at 10 unpaid salaries (no chaos) — confirm.
13. **creditLimit on reference or measured income?** (audit 2026-11-08; **decided during the balance pass: keep the reference** — borrowing room must not shrink on a bad minute and a fresh region can take its first pack; reversible) The code and the §2.7 numbers use the reference `10 × I(L)`; the earlier §2.7 text said the measured `I10`. Reference: a player's borrowing room does not shrink when income dips (and a fresh region can borrow its first pack). Measured: a player who earns little cannot over-borrow. The tests pin the reference reading until you answer.
14. **Anchor `INCOME_REF` on the tapper or on the delegating player?** (audit 2026-11-08; **decided during the balance pass: keep the tapper anchor** and widen the loan term to 2× so a ≥ 50 % earner is never late; reversible) Today it is the full-speed tapper's income; the delegate earns ≈ 50 % of it on the farm at Lv3–10. Re-anchoring on the delegate halves farm loan packs' term base, credit limit, fines and the GM price reference; keeping it means the delegate's loans run closer to their term (see the autoRepay-only loan gate, §7.4).
