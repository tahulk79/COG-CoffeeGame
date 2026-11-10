# Wallets and capital

Status: implemented for local play. No server exists, so this is not yet tamper-proof.

## Rules

- **Cash**: one wallet for the account, stored as whole cents (`s.wallet.usd`). It is valued in USD but the screens never print "USD" or "$". It goes up through a deposit or a loan, and down through a conversion or a loan repayment.
- **1 cash = 1 Gold** (`WALLET.goldPerUsd`, founder 2026-11-10).
- **Loans (founder 2026-11-10)**: packs are 1,000, 2,000 and 5,000 and land in the cash wallet. Gold cannot be borrowed, it only comes from exchanging cash. The debt is the principal and belongs to the account: 20% of the Gold income of any farm pays it off, and it can be repaid by hand from the Gold of the farm being played or from cash. The total owed stays within the credit limit, `1.5 × 10 × I(L) × (1 + 0.1 × level)` (`D.creditLimit`).
- **Interest**: 10% today (`LOAN.interest`, read only through `loanRate()`, the one place a future operator-controlled rate plugs in). It is paid when borrowed cash is exchanged for Gold, out of the amount exchanged: exchanging 1,000 borrowed gives 900 Gold and still owes 1,000. Deposited cash exchanges free. Borrowed cash is used first (`s.wallet.borrowed`, read through `borrowedOf()`, capped by the balance and the open debt). Cash returned as a repayment before being exchanged bears no interest.
- **Hired manager**: borrows through the same rule. His pack is exchanged at once for the farm, interest included, and he picks a pack whose amount after interest covers the purchase.
- **Gold**: one wallet per owned city (`s.wallet.gold[regionId]`). Production, purchases and sales use the Gold of the city being played.
- **Register**: `s.player.coins` is the Gold of the city on screen. All economy code keeps reading it. `world/enterRegion` swaps it, and `apply()` mirrors it into `s.wallet.gold` after each action.
- A cost of another city (bench upkeep of staff working there) uses `onWallet()` in `core/game.js`, which pays from and books to that city.
- Cash and Gold are never summed.

## Money flow

Deposit → USD wallet → Capital sheet → choose farm → preview → confirm → that farm's Gold.

| Action | Guard |
|---|---|
| `wallet/sandboxDeposit` | demo gate (`WALLET.demoDeposit`, on in all builds), fixed packs, `requestId` |
| `wallet/convert` | owned farm, whole cents ≥ minimum, balance, exchange rate and interest rate equal the preview, `requestId` |

A `requestId` that succeeded once is a no-op afterwards. A failed one can be retried. The reducer is pure, so an action applies fully or not at all, and these actions are written to storage immediately.

## History and periods

- `s.wallet.ledger`: deposits, conversions, new-farm capital, migration, Level-10 resets (last 300).
- `s.wallet.books[regionId]`: real income and cost per local day (last 35), with cost groups. Filled from `earn()` and `spend()`. Loans, refunds and conversions are not income.

## Migration

Runs once, on the first load of a save with no `wallet`.

1. The raw save is kept under `<key>-pre-wallet1`.
2. Cash starts at 0. Old coins are never converted to USD.
3. Old coins are split equally between owned, non-expired cities as Gold, in whole cents, with the remainder on the current city. The total is unchanged.
4. Open loans remember the city they were taken in, for the record only.

A save in no city keeps its coins, which go to the first city entered.

A wallet saved at the old rate (`v: 1`, 100 Gold per unit) has its cash and history multiplied by 100 once, so it buys the same Gold. Loans already open keep the 10% fee inside what they owe and are not charged interest again.

## Awaiting approval

Rate decided: `1 cash = 1 Gold`, founder 2026-11-10 (`WALLET.goldPerUsd`).

1. **Real payments.** None exist. The demo gate is on in every build (founder 2026-11-09): a tap adds cash for free, so it must be replaced or set `WALLET.demoDeposit` to false before real money is involved.
2. **Server authority.** The save is in the browser, so a player can edit it. Meeting "the client cannot set a balance" needs the Go backend's ledger.
3. **Old coins** are split equally. The alternative is all on the current city.
4. **New farm capital.** Later farms start with `WALLET.newFarmStarterGold` (60), since USD may not exist yet.
5. **Opening a farm** is paid in Gold by the farm the player is in.
6. **Beans and goods are still shared** across cities, so beans grown in A and sold in B pay B.
7. **The general manager's salary** and wage arrears are paid by the city on screen.
8. **Level-10 restart** keeps cash and clears all Gold.
9. **Farm level.** Cities have no level of their own, so the screens show land tiers owned.
