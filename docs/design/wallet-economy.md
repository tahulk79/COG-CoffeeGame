# Wallets and capital

Status: implemented for local play. No server exists, so this is not yet tamper-proof.

## Rules

- **USD**: one wallet for the account, stored as whole cents (`s.wallet.usd`). It only goes up through a deposit and only goes down through a conversion.
- **Gold**: one wallet per owned city (`s.wallet.gold[regionId]`). Production, purchases and sales use the Gold of the city being played.
- **Register**: `s.player.coins` is the Gold of the city on screen. All economy code keeps reading it. `world/enterRegion` swaps it, and `apply()` mirrors it into `s.wallet.gold` after each action.
- A cost of another city (bench upkeep of staff working there) uses `onWallet()` in `core/game.js`, which pays from and books to that city.
- USD and Gold are never summed.

## Money flow

Deposit → USD wallet → Capital sheet → choose farm → preview → confirm → that farm's Gold.

| Action | Guard |
|---|---|
| `wallet/sandboxDeposit` | demo gate (`WALLET.demoDeposit`, on in all builds), fixed packs, `requestId` |
| `wallet/convert` | owned farm, whole cents ≥ minimum, balance, rate equals previewed rate, `requestId` |

A `requestId` that succeeded once is a no-op afterwards. A failed one can be retried. The reducer is pure, so an action applies fully or not at all, and these actions are written to storage immediately.

## History and periods

- `s.wallet.ledger`: deposits, conversions, new-farm capital, migration, Level-10 resets (last 300).
- `s.wallet.books[regionId]`: real income and cost per local day (last 35), with cost groups. Filled from `earn()` and `spend()`. Loans, refunds and conversions are not income.

## Migration

Runs once, on the first load of a save with no `wallet`.

1. The raw save is kept under `<key>-pre-wallet1`.
2. USD starts at 0. Old coins are never converted to USD.
3. Old coins are split equally between owned, non-expired cities as Gold, in whole cents, with the remainder on the current city. The total is unchanged.
4. Open loans are tied to the current city.

A save in no city keeps its coins, which go to the first city entered.

## Awaiting approval

Rate decided: `$1 = 100 Gold`, approved by the founder on 2026-11-09 (`WALLET.goldPerUsd`).

1. **Real payments.** None exist. The demo gate is on in every build (founder 2026-11-09): a tap adds USD for free, so it must be replaced or set `WALLET.demoDeposit` to false before real money is involved.
2. **Server authority.** The save is in the browser, so a player can edit it. Meeting "the client cannot set a balance" needs the Go backend's ledger.
3. **Old coins** are split equally. The alternative is all on the current city.
4. **New farm capital.** Later farms start with `WALLET.newFarmStarterGold` (60), since USD may not exist yet.
5. **Opening a farm** is paid in Gold by the farm the player is in.
6. **Beans and goods are still shared** across cities, so beans grown in A and sold in B pay B.
7. **The general manager's salary** and wage arrears are paid by the city on screen.
8. **Level-10 restart** keeps USD and clears all Gold.
9. **Farm level.** Cities have no level of their own, so the screens show land tiers owned.
