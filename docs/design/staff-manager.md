# Staff manager: implementation spec (founder approved "theo đề xuất", 2026-11-07)

> **Superseded in part by `management-rules.md` (v1.1, 2026-11-08)** for: career tenure (played shift-days, 1 = 5
> played min), robots per zone (≤ ceil(slots / 2); team per zone = level, no bench +2), wage arrears (unpaid pay is
> owed, paid first from new income), the lead / manager-rank gold armband (#f0b429, the manager's violet #7c4dbd is
> reserved), the inbox for rival offers (played-time deadlines, +2 min grace on a return) and the history (Nhật ký).
> Where this file disagrees, `management-rules.md` wins.

Source design (Vietnamese, for the founder): Claude Doc "Quản lý Nhân viên & Robot: thiết kế modal".
This file is the **engineering spec**: exact rules and numbers. All numbers live in `src/core/config/economy.js`
(never hardcode in UI/scene). Everything is deterministic in the reducer (`src/core/game.js`): time from `ctx.now`,
randomness from action payloads (`roll`), as the rest of the codebase does.

Founder answers to the 6 open questions (all = the proposal):
1. Working slots = player level, **counted per game** (farm zone and café/shop zone separately).
2. Active (working) staff have **no wage**; only **bench** staff cost upkeep.
3. All 4 worker states: phone (slacking), tired, hungry, sulking.
4. Rivals can **really take** a worker (with a 60 s chance to keep them).
5. Robots get **overheat** and **jam** (and wear), besides the existing empty battery.
6. "Train to next level" is replaced by **per-stat upgrades**.

Do NOT commit. The founder tests in the browser himself. Keep all existing uncommitted work.

---

## 1. Hiring, slots, bench

- **Hiring cap (user decision 2026-11-07, replaces "unlimited hiring")**: a zone's team (workers + robots, all regions)
  is at most the **player level** (`D.hireCap`; `staffError` / `recruitError` → `hireLimit { level }` = the level that
  allows one more). So every hire has a working slot; the bench is only for resting (setActive / swapShift) or for old
  saves with more staff than the level (nobody is fired). Soft cap `STAFF_CAP.perZone = 30` stays behind it (`teamFull`).
- New unit field `active: boolean`. Working = `assigned.regionId === currentRegion && active && !stopped && no break`.
- `slots(s, zone) = hireLimit(level)` (= level). `activeCount(s, zone)` counts active units assigned to the current
  region in that zone. `freeSlots(s, zone) = slots - activeCount`.
- On hire/recruit: assigned to the current region + zone; `active = freeSlots > 0`.
- `staff/setActive { uid, active }`: activating needs a free slot (`fail('slotsFull')`). Deactivating = bench.
- `staff/swapShift { zone }` (the "Đổi ca" button): every active worker with energy < 40 (or a blocking state:
  tired/hungry/sulking) is benched, and the best rested bench workers (energy ≥ 70, no blocking state) fill the free
  slots (highest level first). Robots are not touched.
- Normalize old saves: per zone, the first `level` units (uid order) get `active = true`, the rest `false`.
- `staff/assign` / `staff/unassign` stay (moving between regions); unassigned units are not active.

## 2. Upkeep (bench only)

- `UPKEEP = { benchRatio: 0.1, perMinutes: 10, unpaidMorale: 10, maxCatchUpMinutes: 10 }`.
- Bench **worker** costs `benchRatio × STAFF[type].cost` coins per `perMinutes` minutes. Bench robots are free.
- `staff/upkeep {}` with `ctx.now`: charges for the time since `s.staff.upkeepAt` (elapsed capped at
  `maxCatchUpMinutes`; first call just sets `upkeepAt`). Prorated, rounded to 2 decimals. If the player cannot pay a
  unit's share, that unit's morale −`unpaidMorale` × (elapsed / perMinutes) instead (no debt). A worker whose morale
  reaches 0 while on the bench and unpaid **leaves** (event `staffLeft { reason: 'unpaid' }`, journal entry).
- The realm (or HUD) dispatches `staff/upkeep` about every 60 s while in phase `play` (not while the café/farm is
  paused or the game is in the expiry cinematic). Not dispatched while offline (no catch-up beyond 10 min).

## 3. Worker vitals and states

Worker fields: `energy` (0–100), `fullness` (0–100), `morale` (0–100). New hires: 100 / 100 / 80.
`VITALS = { energyDrainPerMin: 10, energyRestPerMin: 20, benchRestMul: 2, hungerPerMin: 12.5, moraleOverworkPerMin: 3,
funnyMoraleRegenPerMin: 2, tiredBelow: 25, hungryBelow: 20, sulkBelow: 20 }`
(≈ 10 min of work from full energy to empty; ≈ 8 min of work to hungry.)

- `staff/vitals { uid, work, rest }` (seconds, batched by the realm every ~5 s per unit, clamp each to 0..120):
  energy −= work/60 × energyDrainPerMin × drainMul; energy += rest/60 × energyRestPerMin × (bench ? benchRestMul : 1);
  fullness −= work/60 × hungerPerMin × (stamina ≥ 4 ? 0.5 : 1); morale −= work/60 × moraleOverworkPerMin while
  energy ≤ 0; funny trait: morale += (work+rest)/60 × funnyMoraleRegenPerMin. Clamp 0..max (energy max =
  `100 + 20 × (stamina − 1)`). drainMul: 0.5 with the `tireless` perk.
- Derived state `D.unitState(u, now)` → `'phone' | 'battery' | 'overheat' | 'jam' | 'lunch' | 'sulking' | 'hungry' |
  'tired' | 'ok'`, priority in that order. Blocking (no work at all): phone, battery, overheat, jam, lunch, sulking,
  fullness ≤ 0, energy ≤ 0. Non-blocking but slow: hungry (speed ×0.7), tired (speed ×0.6).
- The existing slack-to-phone break (`staff/stop` kind `phone`) stays, rate from the stamina stat (§5) × trait.
- On the farm a slacking worker wanders with its phone (already coded).

### Care actions: `staff/care { uid, kind, roll? }`

| kind | for | cost | effect |
|---|---|---|---|
| `nag` | phone | free | `roll < 0.6` → back to work; always morale −5 |
| `bonusSmall` | phone | `unitFee(u)` (existing "back to work" fee) | back to work (same as `staff/resume`) |
| `coffee` | tired | 20 | energy +60 |
| `food` | hungry | 15 | fullness = 100 |
| `lunch` | hungry | free | break 60 s (`u.breakUntil = now + 60000`, state `lunch`), fullness = 100 at the start |
| `bonus` | sulking (any time) | 50 | morale +40 |
| `rest` | tired / sulking | free | bench the unit (`active = false`) |
| `recharge` | battery | existing fee | = `staff/resume` |
| `cool` | overheat | 10 | heat = 0, unstop |
| `knock` | jam | free | unstop (the realm sends it after 3 taps on the robot) |
| `repair` | jam | 20 | unstop |
| `service` | wear | 10 % of robot price | wear = 100 |

Costs go to `CARE` in economy.js. Every paid care adds to the unit's book `spent` and the team ledger (§8).
`staff/resume` keeps working for old code paths.

## 4. Robots: heat, jam, wear, parts

- Robot fields: `heat` (0–100), `wear` (100 = new → 0), `parts = { battery, motor, cooler, frame }` tiers 0..3.
  Migration: old `charger` tier → `battery = max(battery, charger)`, drop `charger`.
- `ROBOT_PARTS`: battery `{ minutes: [3,4,6,9], feeMul: [1,.8,.6,.4] }` (charger merged into battery),
  motor `{ speed: [1,1.1,1.2,1.35], heatMul: [1,1.15,1.3,1.5] }`, cooler `{ heatMul: [1,.67,.5,0] }`,
  frame `{ jamMul: [1,.67,.44,.3], wearMul: [1,.67,.44,.3] }`. Prices: `PART_COST` as today (30/60/100 % of robot
  price, tier 3 needs player level 8). `PART_ORDER = ['battery','motor','cooler','frame']`.
- `ROBOT_WEAR = { heatPerMin: 25, coolPerMin: 40, overheatSeconds: 30, jamChance: 0.02, wearPerJob: 0.2,
  lowWear: 30, lowWearJamMul: 2 }`.
- `staff/vitals { uid, work, rest, jobs, roll }` for robots: heat += work/60 × heatPerMin × motor.heatMul × cooler.heatMul;
  heat −= rest/60 × coolPerMin; heat ≥ 100 → `stopped = { kind: 'overheat', at, until: now + 30000, fee: CARE.cool }`
  (auto-clears after `until`, checked in `D.unitState` and cleared by the next vitals/care). wear −= jobs × wearPerJob ×
  frame.wearMul. Jam: for each job, chance `jamChance × frame.jamMul × (wear < lowWear ? lowWearJamMul : 1)`; the
  realm rolls per finished job and sends `staff/jam { uid }` (deterministic reducer, realm-side `Math.random`).
- Robots keep: one task (`task`), never learn, never mistakes, always 1★, no hard drinks.

## 5. Per-stat upgrades (workers)

- `u.stats = { speed, smart, accuracy, stamina }` 1..5, `u.points` (skill points), `u.xp` (toward the next point).
- `SKILL = { xpPerPoint: 20, coinPerLevel: 100, maxStat: 5 }`. `staff/workDone` adds XP (× trait xpMul); every
  `xpPerPoint` XP → +1 point (no cap on banked points).
- `staff/upgradeStat { uid, stat }`: stat n → n+1 costs **n points + 100 × n coins**; errors `maxLevel`, `points`,
  `coins`, `cap` (trait cap).
- Unit level (display, sorting) = `speed + smart + accuracy + stamina − 3` (1..17).
- What each stat drives (replace today's single-level helpers; keep the exported names working where possible):
  - speed: `unitSpeed = 1 + 0.08 × (speed − 1)` (× tired/hungry mul in the realm). Worker effect bonus scales with it.
  - smart: smart rules — urgent 2, twoCups 3, chain 4, restock 5 (café); ripeFirst 2, playerCrop 3, quick 4,
    twoPlots 5 (farm). Worker task count: 1 task, 2 tasks from smart 3.
  - accuracy: mistake rates indexed by accuracy (today's `MISTAKES.rates[k][accuracy−1]`); stars 2★ from accuracy 3;
    hard drinks (latte) need accuracy 5.
  - stamina: slack chance × `max(0.2, 1 − 0.15 × (stamina − 1))`; energy max +20 per step above 1; hunger ×0.5 from 4.
- Traits: diligent starts stamina 2; lazy stamina capped at 3 (error `cap`); funny morale regen (§3).
- Migration: an old `level` L (1..5) → all four stats = L, points 0, xp kept modulo `xpPerPoint`. Remove the old
  `staff/train` from the UI (keep the reducer for old tests or update the tests).

## 6. Worker tasks

- `u.tasks: string[]` — empty = auto. Farm workers: `harvest | plant | water`; café workers: `order | brew | deliver`.
  Max 1 task, 2 from smart 3. `staff/setTask { uid, task }` keeps working for robots (single task / `auto`);
  `staff/setTasks { uid, tasks }` for workers (validated, deduped, `[]` = auto).
- Realm: a worker with tasks only takes those job types (farm: harvest→replant chain only if `plant` is allowed too;
  café: `pickShopJob` with `ctx.onlyAny = tasks`).

## 7. Rivals (poaching) and rare applicants

- `RIVAL = { everyMinutes: 8, chance: 0.5, keepSeconds: 60, keepFeePerLevel: 50, refuseMorale: 70, targetMorale: 50,
  letGoRefund: 0.3, names: { farm: 'Bà Tư', shop: 'Anh Ba' } }`.
- `rival/visit { zone, roll }` (realm timer every `everyMinutes`): with `roll < chance`, target = the worker with
  morale < `targetMorale` and the highest level in that zone, else the highest-level rare-perk worker. If target
  morale ≥ `refuseMorale` → event `poachRefused` (journal) and nothing else. Else `s.staff.poach = { uid, zone,
  until: now + keepSeconds×1000, fee: keepFeePerLevel × unitLevel }`, event `poachStarted`.
- `staff/keep { uid }`: pay `fee` → morale +20, poach cleared. `staff/letGo { uid }`: unit removed, refund
  `letGoRefund × paid`. `rival/resolve {}` (realm, when `now > until`): the unit leaves, no refund (`staffLeft
  { reason: 'poached' }`).
- Rare applicants: `RARE = { chance: 0.1, costMul: 2, perks: ['goldHands','swift','tireless','charming'] }`, drawn in
  `applicantsFor` from the seeded rng. goldHands: stars ≥ 2 always; swift: speed starts 3; tireless: energy drain ×0.5;
  charming: +10 % coins on cups it serves. Unit keeps `perk`.

## 8. Fire / sell, books, ledger, journal

- Units keep `paid` (coins actually paid at hire; 0 with a ticket).
- `staff/fire { uid }`: workers refund 30 % of `paid`; robots (`sell`) refund 50 % of `paid` + 50 % of parts spent.
- Per unit `book = { jobs, earned, spent, mistakes, since }`. `earned`: café cups it served (coins, so `shop/serve`
  takes an optional `uid`), farm beans it harvested valued at `BEANS.sellPrice`. `spent`: care + upkeep + upgrades.
  `jobs` via `staff/workDone`, `mistakes` via the mistake actions (pass `uid`).
- Team ledger `s.staff.ledger = [{ min, earned, spent }]` per game minute (`floor(now/60000)`), last 30 kept.
- Journal `s.staff.journal = [{ at, type, uid, name, extra }]`, newest first, max 30: slacked, nagged, cared, upgraded,
  hired, benched, activated, poachStarted, poachRefused, kept, left, jam, overheat.
- `staff/mvp {}` (realm timer every 10 min): the worker with the most `earned` in the last 10 min → event `mvp`,
  every worker +10 morale.

## 9. Realm (`src/features/realm/staff.js`, `index.js`)

- Only working units (§1) run jobs; bench units are **not drawn** in the farm/café (user 2026-11-07: only listed under Dự bị in the manager; back on shift they reappear at their rest spot: farm near the storehouse, café terrace edge)
  and idle there.
- Vitals batching (§3/§4), jam rolls, `staff/upkeep` every 60 s, `rival/visit` every 8 min, `rival/resolve`,
  `staff/mvp` every 10 min — all dispatched from the realm update loop (skip while paused / not `play`).
- Visuals per state: icon over head (📱 phone, 😮‍💨 tired, 🍔 hungry, 😤 sulking, 🍽️ lunch, 🔋, 🔥 overheat, ⚙️ jam,
  🪑 bench). Tired → walk ×0.6, at 0 sits down (body low). Sulking → stands still facing away. Overheat → smoke puffs
  (vfx), body tinted red. Jam → jitter in place. A tappable 🪙 bubble with the paid fix's price over blocking states
  (reuse the existing fee bubble: `drawBreak` kinds); tap → the paid care. Jam: 3 taps on the robot body → `knock`.
- Rival visit: a short speech line over the target («Về đây chị trả gấp đôi!» from the rival name) + the HUD toast.
- `realm.focusUnit(uid)`: camera `glideTo` the unit + a highlight ring for 3 s; works for both areas (switch view if
  needed is NOT required: only focus units of the current view; return false otherwise).
- Expose `realm.staffInfo(uid)` (existing) + state.

## 10. HUD modal (replaces the staff bottom sheet)

> **Làm lại mobile-first (2026-11-08, founder chọn "Hàng việc thông minh").** Phần dưới mục này là bản cũ, chỉ để
> tham khảo. Bản hiện tại (`src/features/hud/staff-modal.js`):
> - **3 tab:** Đội · Tuyển · Quản lý. Báo cáo không còn là tab riêng, mà nằm cuối tab Đội, gập lại (`📊 Báo cáo`).
> - **Đầu trang:** 3 ô số: `👥 4/6 đang làm` · `🪙 +420 / 10 phút` · `⚠️ 2 cần xử lý` (hoặc `✅ Đội ổn`). Chi phí nuôi
>   đội chuyển xuống dưới danh sách Đội.
> - **Cần bạn:** một danh sách duy nhất, mỗi dòng có 1 nút. Xếp hạng theo đúng luật Quản lý dùng (`needsYou`):
>   - 0 = dụ dỗ của đối thủ, nhân viên bị chặn (kèm nút sửa có phí).
>   - 1 = việc QL đang chờ duyệt (thẻ giống hộp thư, `taskCard`).
>   - 2 = nhân viên chậm (mệt, đói, mòn).
>   - 3 = người dự bị khi ca còn chỗ, người chưa được giao.
>   - 4 = đủ điều kiện thăng chức.
>   - 5 = tối đa 2 nâng cấp hoàn vốn nhanh nhất của cả đội (`D.upgradeOptions`, ≤ `UPGRADE_GATE.paybackMin`).
>
>   Hiện 4 dòng đầu, có nút «Xem thêm n việc». Từ 2 nút sửa trở lên thì có thêm «Xử lý tất cả». Băng báo đối thủ ở
>   đầu trang đã bỏ, vì nó là dòng đầu của danh sách này.
> - **Danh sách đội:** mỗi người 1 dòng gồm ảnh, tên, ⭐, điểm hôm nay, đang làm gì, và 1 cột "thể trạng" (chỉ số yếu
>   nhất trong năng lượng / tinh thần / no, robot là pin / nhiệt / mòn). Nút «Đổi ca» ở tiêu đề. Bỏ các chip lọc.
> - **Hồ sơ, 3 tab:**
>   - **Hôm nay:** trạng thái, chăm sóc, ca làm, điểm hôm nay, việc được giao. Biểu đồ 7 ngày gập lại.
>   - **Phát triển:** "Nên nâng cấp" (3 lựa chọn hoàn vốn nhanh nhất), thăng chức, chỉ số / linh kiện, đồ nghề /
>     phần mềm. Kỹ năng nghề và «Cách làm việc» gập lại.
>   - **Nhật ký.**
>
>   Id tab cũ (`overview`, `stats`, `gear`, `parts`, `service`) được tự chuyển sang tab mới (`PTAB_OF`).
> - **Quản lý:** thẻ QL → Chờ bạn duyệt → Quyền hạn → Kế hoạch ngày. Giấy phép, Có đáng tiền, Việc nên làm và Nhật ký
>   quản lý gập lại.
> - **Phần gập:** `fold(key, …)` chỉ dựng nội dung khi đang mở. Trạng thái mở/đóng được nhớ trong lúc modal còn sống
>   (`st.folds`).


Tapping the Staff tool opens a **full modal** (portrait phone first, 16 px gutters, safe areas, scrollable body,
sticky header + tabs). One modal per game (farm / café = zone of the current view).

- Header: title «Quản lý nhân viên · Nông trại / Quán», line «Đang làm 3/3 · Dự bị 2 · Nuôi 🪙30 / 10 phút ·
  Đội kiếm 🪙420 / 10 phút», close ×.
- Tabs: **Đội** (default) · **Tuyển dụng** · **Báo cáo**.
- Đội: filter chips Tất cả · Đang làm · Dự bị · Có vấn đề (n). Bulk buttons «Xử lý tất cả 🪙x» (pays the paid fix of
  every unit with a blocking or slow state) and «Đổi ca». Cards: avatar icon, name + trait, level, big state icon +
  report line, energy + morale bars (robots: battery% / heat / wear), quick fix button. Tap a card → Detail.
- Detail (a sub-screen with ← back): header (icon, name, trait, perk, level, current line), State + «Bạn cần làm gì»
  + care buttons (free and paid), **📍 Xem ở đâu**, toggle **Đang làm / Dự bị**, **Giao việc** chips (Auto + tasks,
  max per smart), **Chỉ số** (4 rows: bar 1–5, what the next step gives, «Nâng · n điểm + 🪙»; points + XP bar),
  robots: task chips + 4 part rows, **Hôm nay** (jobs, earned, spent, profit, mistakes), **Cách làm việc** (existing
  howItWorks, updated to stats), «Cho nghỉ việc (hoàn 🪙x)» / «Bán robot (hoàn 🪙x)» with a confirm.
- Xem ở đâu: the modal collapses to a bottom strip (name, state, the fix button, «Mở lại») and calls
  `realm.focusUnit`; «Mở lại» restores the Detail.
- Tuyển dụng: applicants (existing board + 4 starting stats + rare perk badge «Hiếm» + «Đối thủ cũng đang nhắm» on
  rare ones) + robots catalogue (buy many); note when hiring goes to the bench and its upkeep.
- Báo cáo: last 10 min earned / spent / profit (from the ledger), ranking per unit (earned, spent, profit), MVP,
  2–3 tips derived from state counts (e.g. "Tèo tired 4 times: upgrade Stamina or swap shifts", "robot overheats:
  upgrade Cooler", "2 lattes left: need accuracy 5"), journal list.
- Poach banner at the top of the modal (and a toast) while `s.staff.poach` is set: «💼 Bà Tư đang rủ Tèo! (còn 45
  giây)» + «Giữ lại 🪙x» / «Cho đi».
- The modal refreshes every second while open (the realm state changes without store events).
- All strings in `src/i18n/locales/v3-hud.js` (vi + en, every key both). Copy samples: see the founder doc §Text mẫu.
- Toolbar Staff dot: any unit with a blocking state, a poach, or an affordable stat upgrade.

## 11. Tests and checks

- Extend `tests/core/*.test.mjs` for every new reducer action and rule (slots per zone, bench + setActive, swapShift,
  upkeep + unpaid morale + leaving, vitals + states, every care kind, robot heat/jam/wear/parts migration, stats +
  upgradeStat + migration from level, tasks, rivals visit/keep/letGo/resolve/refuse, rare perks, fire/sell, books,
  ledger, journal, mvp, normalizeSave round-trip).
- `npm test` must pass. Run `node scripts/economy-sim.mjs` and report the summary.
