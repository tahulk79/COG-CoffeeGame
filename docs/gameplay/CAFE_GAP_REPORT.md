# Café feature gap report (before this upgrade)

Inspected the real source (`src/gameplay/cafe`, `src/gameplay/employees`, `src/components/render`, `src/scenes`, tests) on 2026-10-27.

| Requirement | Status before | Notes |
|---|---|---|
| Full-screen world | Partial | Full-bleed camera + endless ground + follow + wheel zoom existed; no pan, no pinch |
| Customer state machine | Partial | `SPAWNING→ENTERING→QUEUING→WALKING_TO_ORDER→ORDERING→WAITING→RECEIVING→TASTING→RATING→LEAVING`; names differed from the brief, no CONSUMING at a seat distinct from paying |
| Dine-in vs takeaway | Missing | Everyone was served at a seat or standing spot |
| Order data | Partial | id, customer, recipe, ingredients, createdAt, patience, status; missing service type, worker, quality, payment status |
| Brewing / serving / recipes | Exists | 5 recipes, per-station steps, carry + serve; one machine of each type assumed |
| Payment collection | Missing | Coins/EXP credited immediately at rating |
| Table cleaning | Missing | Seat freed instantly when the customer left |
| Employees | Partial | Cashier, barista, server existed; no cleaner; cashier did not handle payment; two baristas could walk to the same order |
| HUD | Exists (UI-P1–P5 + concept redesign) | Order cards, mission, toolbar, modals |
| World-space feedback | Partial | Order bubble, rating bubble, floating rewards, glows existed; no coin / broom indicators |
| Expansion | Partial | Furniture buying + decorate mode existed; no machine purchase, no upgrades affecting gameplay |
| Asset replacement | Partial | `ui/theme/assetRegistry` for HUD; world objects still used per-type placeholder styles |
| Tests | Partial | 186 unit tests, 27 E2E |

## What this upgrade changed
The customer, payment, cleaning, employee and expansion implementation is present in this checkout. For the subsequent regional land/construction extension and its remaining limits, see [REGIONAL_WORLD_UPGRADE.md](REGIONAL_WORLD_UPGRADE.md).
