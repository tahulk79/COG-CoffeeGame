# General manager (Tổng quản lý): engineering spec

> **Superseded in part by `management-rules.md` (v1.1, founder answered §8 "theo đề xuất", 2026-11-08)** for: the
> inbox (Việc cần duyệt — requests are played-time tasks with reminders, expiry penalties, late approval only while the
> same manager is here), the licences (all five from Lv6, kept by the Level-10 wipe), loans (the GM *does* propose a
> loan task for a capital job it cannot pay, with the Tín dụng licence; a task the coins cannot pay is never filed),
> offline work (`GM.away`: share of the team rate, salary paid or turned into wage arrears; 10 unpaid salaries → he
> quits, no chaos), the return rules (+2 played min grace on every open task, loyalty lost on one return ≤ 40, with or
> without a manager) and the land / building rules (≤ 1 land buy/sell proposal per 30 min; a lot needs its own 30
> samples before it can be sold). Where this file disagrees, `management-rules.md` wins.

Founder asked for it on 2026-11-07 and told Claude to decide by the proposal's logic ("Có đề xuất bạn dựa vào logic để
chốt làm"), so all 6 questions follow the proposal page (`docs/design/general-manager-proposal.html`,
https://claude.ai/artifact/3kV4dDFk8WYR5x6o9AmzuZ):
1. One GM for the whole business (farm + café share the coins); it works the game on screen.
2. Unlocks at level 6. The Level-10 incident resets it (fresh `s.gm`, the headhunter board kept).
3. No offline work yet (needs the Go backend).
4. Loans are never proposed by the GM (out of its job: it runs the teams, not the finances or construction).
5. Chaos never ends by itself: a team meeting (`gm/calm`) or a new GM.
6. Big-job limit 🪙300 by default, adjustable 100 / 300 / 1 000.
Real-money purchases are never delegated.

All numbers: `GM` in `src/core/config/economy.js`. State: `s.gm` (`newGmState` / `normalizeGm` in state.js).

## Hire and pay
- Headhunter board: 3 candidates from a seed (`gmCandidatesFor`): skill 1–5 (mostly 1–3), style careful / balanced /
  bold, loyalty by style, fee 🪙400 × skill. Free new board every 30 min, or 🪙100. `gm/hire`, `gm/refreshBoard`.
- Pay per 10 min (`gmSalary`): 🪙20 × skill × mode (advisor ×0.5, operator ×1, full ×2) × (1 + 20% per raise), plus a
  share of the positive team profit (0 / 5 / 15%). `gm/payroll` every minute (realm). Paid → loyalty +1 per 10 min;
  unpaid → loyalty −10 per minute. Ledger category `wage` (report "Lương, phụ cấp"); `row.gm` marks the GM's own pay.

## Powers and the plan
- `D.gmPlan(s, now)`: candidate jobs for the game on screen, best first, each with a tier: safe (free), budget (small
  cost; big when cost ≥ the big-job limit), big, advice (never automatic: firing a D-grade worker).
  Jobs: sell beans at 90% storage / buy beans for waiting cups; nag (≤ once a minute per worker, else small bonus) or
  bonus a phone slacker; lunch (careful) or food, coffee, bonus; robot recharge / knock / cool / service, software after
  repeated trouble today, cooler / frame parts; raise the lowest affordable stat; promote (lead / manager = big);
  swap shifts / put a rested bench worker on shift; keep a poached worker (big); hire when 3+ jobs pile up and a place
  is free (big; the request names the applicant and is re-found on approval).
- `D.gmPermission`: advisor → suggest; operator → safe do, budget do within the 10-minute budget (careful style uses
  half), else request; big → request; full → do (coins permitting). Advice → suggest always.
- `gm/tick` (realm, every 20/15/10/7/5 s by skill): expire requests (5 min → "stuck"), resolve a poach that ran out,
  then do up to 1/1/2/2/3 jobs and file requests (max 6). `gmRun` runs the job's own handler, measures the real cost,
  logs it, tags its events `byGm` (HUD quiet) unless approved / delegated; level-ups always show.
- `gm/approve`, `gm/deny`, `gm/delegate` (hand a suggestion over now), `gm/setMode`, `gm/setBudget`, `gm/setBigLimit`.

## Poach and chaos
- `gm/rivalVisit` every 8 min, 40% chance; loyalty ≥ 70 refuses. Otherwise 180 s to keep: bonus (20 × base pay,
  loyalty +15) or a lasting +20% raise (loyalty +25), or let go.
- Leaving poached → `s.gm.chaos`: worker job lists of the current region wiped (robots back to auto), requests
  cancelled, slack chance ×2 and morale −1/min on shift; a Manager-rank worker in the zone halves both and stands in as
  advisor (suggestions + "hand over"). Ends with `gm/calm` (🪙300 + 🪙50 per unit, everyone +10 morale) or a new GM.
- `gm/fire`: planned handover, no chaos, no refund.

## UI
Staff modal tab «Quản lý» (badge = requests + poach + chaos): locked note before Lv6; chaos card; poach banner; GM card
(stars, style, loyalty, mode); powers (mode, pay, budget bar, big-job limit); "Có đáng tiền không" (running profit
today before the GM's pay, GM pay today, jobs done, ratio); requests with countdown (Duyệt / Từ chối); suggestions
(what the GM will do, or "Giao làm"); headhunter board; GM log; let go. Toasts for requests, poach, leaving, calm,
unpaid. The toolbar Staff dot lights for requests, poach and chaos.

## Not done
Offline work; café-specific GM jobs beyond buying beans; the GM never builds, buys land or takes loans.

## Founder feedback 2026-11-07: a manager keeps things steady, growth is yours, and it wants a present boss

- **Upkeep only.** The manager runs: care (nag ≤ once a minute, lunch / food, coffee, bonus), robot recharge / knock /
  cool / service, shift swaps, selling / buying beans, keeping a lured worker (request). Hiring, firing, promotions,
  stat upgrades, robot parts and software are **advice only** in every mode ("Phát triển: bạn tự làm" + a button that
  opens the right tab / profile). Future growth systems (new drink recipes, crop methods, suppliers) belong to the
  player the same way. Result: a manager holds the status quo or a little better; its pay eats most of the gain.
- **Mood** (`GM.mood`, shown as "Tinh thần" = the loyalty number):
  - idle — no job for 3 min (you play everything yourself): −1 / min (`gm/payroll`);
  - absent — no touch for 15 min while the game runs: −2 / min and the rival comes twice as often;
  - away — the game was closed > 2 h: on return −10 per hour beyond 2 h (max −40) in `gm/seen`; if that leaves it under
    70 the rival is already there (a 3-minute poach starts at once) — the pull back into the game;
  - each job done +0.3, each approval +2, each denial −1, pay +1 per 10 min (unpaid −10 / min).
- **Presence**: the HUD sends `gm/seen` on a touch / key (at most once a minute) and once at start.
- UI: the manager card shows the mood ("😴 Rảnh 8 phút…", "🚪 Không thấy bạn…"); toasts for idle, absent, return.

## Away play and the gear store (2026-11-07, "check what is not done")
- **Away earnings** (`GM.away`, `gmAwayPay` in game.js, run by `gm/seen` on return): "away" = the game was not running
  (time since max(payAt, seenAt); payroll stamps payAt every minute while it runs). Beyond 5 min, up to 120 min, the
  manager pays out operator 50% / full 70% of the team's running profit rate (staff ledger, last 30 played minutes,
  needs ≥ 5 of them) minus its base pay for that time. Advisor: nothing. Toast + log "🌙".
- **Mood tuning**: idle and absent drains never stack (the bigger counts); absent starts after 20 min at −1 / min. The
  "missed you" drop counts only closed time, never open-but-untouched time (already the absent drain).
- **Gear store** (`s.staff.gearStock`, `staff/equipGear`): a worker you fire hands its gear in (no more 50% gear
  refund); a poached / unpaid leaver takes it. Any worker of that game can be handed a better piece for free; its old
  piece goes back to the store. Shown under the gear tab.
- Research (recipes, crop methods, suppliers): proposal only — `docs/design/research-proposal.html`.
