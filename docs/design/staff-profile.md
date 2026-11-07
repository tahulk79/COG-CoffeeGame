# Staff personnel file: engineering spec (step 1 of 4, farm first)

Founder approved the proposal "theo đề xuất" on 2026-11-07. Proposal page (Vietnamese, mockups, the 6 decisions):
`docs/design/staff-profile-proposal.html` — https://claude.ai/artifact/Vzga9MYhcALiesvNpcS7se

Decisions (all = the proposal's recommendation):
1. Wages: unchanged in Round 1 (working staff free, bench upkeep). A position allowance comes with Team lead / Manager (step 3).
2. Worker upgrades get two more layers: craft skills that grow by doing (step 3) and gear bought with coins (step 4).
3. Robots may buy software packs (bought, not learned; still one task) — step 4.
4. "Days" are real calendar days (local time of the device): tenure, robot age, the 7-day chart.
5. Profile photo = a shot of the unit's 3D model in the world (step 1, done). All farm workers share one model today, so
   photos differ by pose / place / gender only; per-person outfits need new art.
6. Team lead and Manager have real team effects (step 3).

The management shell (list, profile with tabs, report, timeline) is shared; worker and robot profiles plug in their own
sections. The café later adds its own sections on the same shell.

## Steps

1. **Profile shell + Overview + History** (this change).
2. Team report v2: 10 min / today / 7 days, where the money went (care / upgrades / robots / bench), A–D ranking, tips.
3. Career (Apprentice → Staff → Skilled → Team lead → Manager) + craft skills per farm task.
4. Worker gear (boots, hat, shears, watering can); robot warranty, resale by wear, software packs.

## Step 1: data (all numbers in `PROFILE`, `src/core/config/economy.js`)

Unit fields (normalized in `src/core/state.js` `normalizeProfile`):

| field | who | meaning |
|---|---|---|
| `hiredAt` | all | hire time (old saves: `book.since`) |
| `age`, `home` | workers | drawn for each applicant after its rarity (`applicantsFor`, a seed keeps its old board); old saves: `profileOfUid(uid)` (stable) |
| `serial` | robots | `robotSerial(type, uid)`, e.g. `SB-0427` |
| `days[]` | all | one row per local calendar day (`D.dayKey`, 20261107), last `PROFILE.daysKeep` (7): `jobs, earned, spent, capex, mistakes, shift, work, down` |
| `log[]` | all | the unit's own timeline, newest first, `PROFILE.logKeep` (20) |

- `tally(u, now, key, n)` (game.js) writes the lifetime `book` and today's row together: jobs (`staff/workDone`), earned,
  spent (`unitSpent`), mistakes (crooked plant, unripe harvest, spill, `staff/mistake`).
- `capex` = coins spent on stat upgrades and robot parts that day (investments: excluded from running profit).
- `staff/vitals` counts, while the unit is on shift here: `shift` = work + rest seconds, `work` = seconds on a job,
  `down` = shift seconds while blocked (`D.unitBlocked`, lunch not counted). The realm no longer drops idle seconds:
  batches that change no vital are held and sent with the next batch or once 30 s pile up (`flushVitals`).
- `log` gets every team-journal entry of the unit (`journal()` → `note()`), plus `part` (robot part fitted), `mvp`,
  and resumes paid from the bubble (`cared` with recharge / cool / repair / bonusSmall). `hired` carries `{ paid }`.

## Step 1: derive (`src/core/derive.js`)

- `dayKey(now)`, `lastDays(now, n)`, `dayRow(u, key)`, `daysSince(from, now)`, `runCost(row)` (= spent − capex).
- `dayKpis(row)` → `perHour` (jobs per shift hour), `quality` (1 − mistakes / jobs), `att` (1 − down / shift; robots:
  uptime), `profit` (earned − running costs), `costPerHour`.
- `unitGrade(s, u, key)`: needs `minShiftSeconds` (60) on shift. Each part 0..100; productivity and profit rate are
  relative to the average of the same zone + kind that worked that day (`par` 70 = the average); quality =
  100 − mistakes/jobs × 500; attendance = 100 × att. Workers 30 / 25 / 25 / 20 (prod / qual / att / profit), robots
  40 / 40 / 20 (prod / uptime / profit). Cuts: A ≥ 85, B+ ≥ 78, B ≥ 70, C ≥ 50, else D.
- `teamKpi(s, u, key, field)`: team average of a KPI (for "x% faster than the team").
- `robotPayback(u, now)`: cost = paid + partsSpent; net = earned − running costs (book.spent − partsSpent); `pct`,
  `etaMinutes` at today's running profit per shift hour.

## Step 1: UI (`src/features/hud/staff-modal.js`, CSS `.hud-pf-*` in `src/ui/styles/v3.css`, strings `hud.pf.*`)

Tapping a unit opens its profile: ID card (photo, name, "24 tuổi · Quê … · Vào làm 05/11 (3 ngày)" or
"Mẫu … · Số máy … · Mua …", level / trait / ★ / perk tags, what it does now), then sticky tabs:

- Worker: **Tổng quan** (Bây giờ: state, vitals, what to do, care, shift + 📍; Đánh giá hôm nay: grade + why + 4 KPIs
  with ▲▼ vs yesterday; Lãi 7 ngày chart; Giao việc) · **Chỉ số** (stats + how it works) · **Lịch sử** (since day
  one, timeline, fire).
- Robot: **Tổng quan** (Bây giờ; Vận hành hôm nay: grade + uptime / output / running cost / incidents; Hoàn vốn;
  Lãi 7 ngày; task) · **Bộ phận** (parts + how it works) · **Bảo trì** (since day one, service log, service, sell).

Photos: `realm.portrait(uid)` renders the realm scene from a small camera in front of the unit into the corner of the
main canvas and copies it to a 160 px JPEG (cached 30 s per unit). Units not drawn (bench, other area) show their icon
on a per-unit tint. The team list cards use the same avatar.

## Step 2: team report v2 (done)

Data:
- Team ledger rows (per minute, `s.staff.ledger`) and new team day rows (`s.staff.daily`, `PROFILE.teamDaysKeep` = 30)
  hold `earned`, `spent` and the spending categories `robot | upgrade | upkeep | hire`, as a team total and per game
  zone (`row.farm`, `row.shop`). `care` = spent − the others. `ledger(s, now, key, amount, cat, zone)` in game.js.
- Categories: care (workers' care, bubble fees, tending, keeping a poached worker), robot (a robot's care / fees),
  upgrade (stats, parts; also the unit row's `capex`), upkeep (bench; also the unit row's `upkeep`), hire (hire /
  recruit price actually paid; a free ticket costs nothing).
- Old saves without `daily`: rebuilt from the units' own day rows (`backfillDaily` in state.js; units that left and
  past hire prices are lost).

Derive: `REPORT_PERIODS` ('10m' | 'today' | '7d'), `periodKeys`, `teamMoney(s, now, period, zone)` (with `prev`: the
10 minutes before / yesterday), `teamRanking(s, keys, zone)`, `rowsOf(u, keys)`; `unitGrade` / `teamKpi` take one day
key or a list (7 days = summed rows, graded against the team's 7-day sums).

UI (Báo cáo tab): period switch · Tiền của đội (doanh thu ▲▼, chi phí ▲▼, lãi, hiệu quả chi = earned / spent) · Chi phí
đi đâu (stacked bar + legend) · Bảng đánh giá (photo, jobs, attendance, grade pill, running profit; tap → profile; the
10-minute view ranks today) · MVP · Gợi ý (first: the lowest C/D unit's weakest part and what to do) · Nhật ký (this
game's units only). Team cards show today's grade pill. The header's "Đội kiếm / 10 phút" now counts only this game.

## Step 3: career + craft (done)

Config `CAREER`, `CRAFT`, `rankOf`, `autoRank`, `craftLevel`, `craftSpeed` (economy.js).

- Ranks: apprentice (Lv 1–3) → staff (Lv 4, automatic) → skilled (Lv 8 + 5 days) → lead (Lv 12 + 10 days) →
  manager (Lv 16 + 20 days). Days = real calendar days on the team (`tenureDays`). `rankOf` never returns less than
  what the level gives. Above staff the player taps «Thăng chức» (`staff/promote`; errors maxRank / level / days /
  taken). Morale +30. Lead and manager: one each per game zone (`rankHolder`); `staff/stepDown` frees the seat
  (morale −20).
- Allowance: an on-shift lead 20 / manager 40 coins per 10 min, charged by `staff/upkeep` (category `wage`, shown as
  «Phụ cấp» in the report; unpaid → the same morale loss as bench upkeep).
- Waiting: a worker the player could promote (`canPromote`) for more than 10 minutes of play loses 0.5 morale per
  minute (`u.eligibleAt`, in `staff/vitals`). The toolbar Staff dot and a report tip show who can be promoted.
- Team effects while a lead / manager works here (`zoneLeaders`: on shift, not blocked): every other worker of the zone
  +1 morale per minute (`staff/vitals`); a phone slacker goes back after 20 s for free (`staff/nudge`, realm
  `leaderRound` every 5 s); a manager also buys coffee (tired) / food (hungry) from the player's coins
  (`staff/care` with `by`, journal `managerCare`).
- Craft: `u.craft = { harvest, plant, water }` counts (café tasks later), +1 in `farm/harvest` / `farm/plant` /
  `farm/water` by a worker. Steps at 50 / 200 / 600: Mới → Quen → Thạo → Chuyên gia. Each step: that job +5% speed
  (realm job time) and its mistakes −25% (`mistakeChance`: unripe ↔ harvest, crooked ↔ plant, spill / wrongTable ↔
  deliver). A new step goes to the unit's timeline.
- UI: rank on the ID card, cards and ranking; «Sự nghiệp» section on the worker overview (ladder, what the next rank
  needs, promote, current role + effects + allowance, step down); «Tay nghề» on the Chỉ số tab.
- Not done: rivals do not yet prefer "eligible but not promoted" workers (they do target low morale, which waiting
  causes).

## Step 4: gear + robot extras (done)

Config `GEAR`, `gearTier`, `gearWalk`, `WARRANTY`, `SOFTWARE`, `softwarePrice`, `hasSoftware` (economy.js).

- Worker gear (farm; café gear later): boots (walk +5/10/15%, realm movement), straw hat (energy drain ×0.85/0.72/0.6
  in `staff/vitals`), shears (unripe picks ×0.8/0.65/0.5 in `mistakeChance`), watering can (tending waters 4 + 1/2/3
  plots, `D.tendPlots`). Tier n → n+1 costs 60 / 90 / 180. `staff/buyGear { uid, item }` (category upgrade, unit
  `gearSpent`, timeline `gear`). Leaving: hire refund + 50% of gear. Worker profile tab «Trang bị».
- Robot warranty: the first 3 jam repairs cost nothing (`D.warrantyLeft`, `u.warrantyUsed`, timeline `warranty`); a
  «Bảo hành n» tag on the ID card.
- Resale: (50% price + 50% parts + 50% software) × wear / 100 (`D.fireRefund`).
- Software packs (`staff/buySoftware { uid, pack }`, category upgrade, `u.software`, `softwareSpent`): autoCharge
  (⅓ of the robot price: pays the recharge by itself when the battery is empty), autoUnjam (¼: knocks itself free
  after 10 s). Realm `softwareRound` every 5 s; journal `autoCare`. Shown on the robot's «Bộ phận» tab with the
  warranty line. Payback cost now includes software.
- Not done: handing a leaver's gear to a new hire (the proposal's "if you want"); café gear and café craft.
