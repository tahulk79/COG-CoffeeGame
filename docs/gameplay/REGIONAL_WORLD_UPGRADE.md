# Regional world progression — 2026-10-27

## Feature gap observed before this change

The café upgrade described in the supplied brief was already substantially present in this checkout. This work extends it rather than replacing it.

| Area | Observed before | Result of this change |
| --- | --- | --- |
| A: fullscreen world, follow, zoom, pan | Implemented in WorldScene | Preserved; existing desktop/mobile camera E2E retained |
| B–C: customer navigation, dine-in/takeaway, orders, brewing, serving | Implemented in CafeService, OrderService, BrewingService | Reused for each newly built café; employee service integration tested in a regional café |
| D–E: collectible payments, duplicate protection, dirty seats, cleaning | Implemented and persisted | Regional payments, dirty seats and upgrades isolated; payment keys scoped by region |
| F: cashier/barista/server/cleaner and farmer | Implemented | Regional teams use the existing roles and task policies independently |
| G: HUD and world feedback | Implemented | World map gains land/build/enter controls, pagination, bot farm visits and portrait layout |
| H: upgrades/furniture | Implemented for the original café | Regional cafés reuse upgrades, saved layouts, collisions and navigation |
| New-region development | Missing: districts only listed neighbor cafés | Buy land, then independently build a café and/or farm, then enter and operate it |
| Regional farm/equipment state | Missing | Separate plots, watering can, chosen seed, processing jobs and employees |
| Many farms to visit | Missing | Each new district offers six farm bots and six café bots, across four pages |
| Bot production/economy | Partial: crowd numbers and visual moving dots | Saved bot phases buy supplies, consume stock and sell output using each bot's own purse |
| Online ownership | Missing | Stable profile/business IDs, owner IDs and controller type; server transport/authentication remain future work |

## Player flow

Open **Bản đồ**, select **Phố cổ**, **Chợ đêm** or **Bờ sông**. Meet its level requirement, pay **Mua đất**, then pay **Xây quán** and/or **Xây nông trại**. Each construction is a one-time purchase and creates an immediately usable starter facility. A built farm does not automatically build a café.

Use **Vào quán** / **Vào nông trại** to enter. Regional farms use the same prepare → seed → water → grow → harvest → process/sell loop as the original farm. Regional cafés use the existing customer, brewing, payment and cleaning systems. The toolbar and signs connect the two facilities within the same region; an unbuilt destination is blocked.

| Region | Unlock | Land | Café | Farm |
| --- | ---: | ---: | ---: | ---: |
| Phố cổ | 3 | 800 | 600 | 400 |
| Chợ đêm | 5 | 2,000 | 1,400 | 900 |
| Bờ sông | 8 | 4,500 | 3,000 | 1,800 |

All prices are configured in `src/data/config/meta.json`. The original farm and café remain the starting facilities; existing progress is retained. Existing branch income is preserved; purchasing an additional passive branch now requires a built regional café.

Wallet, carried inventory, level, story, skills and quests are shared. Fields, machines, watering can, staffing, café reputation, upgrades, dirty seats and pending payments belong to the regional estate. Furniture layouts are already stored per map. The commodity market remains shared. Player facilities run while visited, following the existing simulation; crops use wall-clock growth when revisited.

## Visiting machine owners

Every new district has twelve independently identified neighbors (six cafés and six farms). **Trang tiếp** reaches all entries. **Ghé thăm** displays the facility, owner type **Máy**, production phase, supplies, money and lifetime units sold. **Quay lại** returns to the district; **Đóng** exits the map on touch screens as well as desktop.

Bots advance a small local simulation in 15-second steps. They buy supplies, consume them to produce output and sell it into their own wallet. Farm bots harvest 32 units per crop; café bots consume one ingredient unit per drink. They never credit the player's money. Bot state survives saving. Offline catch-up is bounded to 100 actions per frame.

Limits: bot visits are an overview with placeholder layouts and illustrative customer dots, rather than a second full Phaser customer simulation. Player-owned facilities reuse the full playable maps. Starter map geometry is shared; regional state and map/object identities are independent. Construction is immediate, with no building timer or placement editor added.

## Save and future online boundary

Schema v10 adds `regions` and `social.bots`; v9 saves migrate without changing original progression or economy. Regional structures and bot values are validated before loading. Root farm/café data stays in place for old saves. Regional map and object IDs are namespaced, and payment/employee/upgrade transaction keys are regional, preventing one facility from blocking another's legitimate purchase or collecting the same payment twice.

Profiles expose `id`, `ownerId`, `controller` (`bot` or `player`), `businessKind` and `region`. The UI consumes profiles/visits and issues commands, rather than making purchases itself. This is the boundary for a future online implementation: replace local neighbor data with authenticated server profiles and read-only visit snapshots. Land/build/payment commands must be validated and committed by a server with unique idempotency keys and ownership checks. Presence, networking, authentication, server authority and cross-user trade are not implemented in this local version.

## Verification

- Nine regional unit/integration cases cover gates, insufficient funds, repeat purchases, building independence, real crop harvest/sale, employee café operation, separate payments/upgrades/teams, save/load, old-save migration, URL bypass and bot economics.
- Browser tests purchase land, build both facilities, paginate to a bot farm, visit it, enter a playable regional farm, reload and travel to the regional café on desktop (1440×900), tablet (1024×768), phone portrait (390×844) and phone landscape (844×390), using touch input on tablet and phones.
- Existing café E2E covers manual dine-in/takeaway service, collecting payments, dirty-seat cleaning, camera navigation and mobile movement. Unit tests cover payment reload and duplicate prevention. A regression found and fixed here: a departing customer could intercept a click intended for the coins or dirty table beneath them.
- Screenshots live in `docs/screenshots/regions-*.png`.

These checks cover this integration and existing regressions; they do not certify every edge case in the supplied full café brief or production online behavior.

Final checks: `npm run typecheck` and `npm run build` passed; `npm test -- --maxWorkers=1` passed all 220 tests. Four existing café E2E cases and four regional E2E cases passed using `TCSS_BROWSER_CHANNEL=chrome`. Chrome was used because this machine lacks Playwright's bundled Chromium. The first parallel unit run exceeded the existing pathfinding timing threshold; the sequential full run passed.
