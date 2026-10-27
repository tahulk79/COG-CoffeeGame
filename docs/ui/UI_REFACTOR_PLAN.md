# UI Refactor Plan

| Phase | Scope | Acceptance | Status |
|---|---|---|---|
| **UI-P1** Clean presentation | Debug overlay off by default (F3 / `), no state names in the world, design tokens, asset registry, GameButton / ProgressBar / Panel / Modal, `setShown`, HudLayout | No debug text on first load; one place for colours; no hidden panel swallows clicks; unit tests + E2E still pass | Done |
| **UI-P2** Core HUD | Player profile, currency + settings, mission tracker, order cards, bottom toolbar, contextual brewing panel, responsive frame + camera insets | Desktop 1440×900, tablet 1024×768, phone 390×844 and 844×390 screenshots reviewed; every toolbar button opens a real feature or shows why it is locked | Done (see report) |
| **UI-P3** Gameplay feedback | Customer drink bubble, interaction indicators, in-world brewing progress, rating popup (stars, feedback, coins/EXP) from `cafe:rated`, floating coin/EXP rewards, highlight the next station | Every popup is driven by a real event; values equal the transaction | Done |
| **UI-P4** Management panels | Employee, Inventory, Decoration, shop/upgrade panels on the shared components; collapsible farm panels | Purchase/hire/placement behaviour unchanged; farm usable on phones | Done |
| **UI-P5** Responsive & polish | Animations (panel, bubble, stars, quest completion, unlock), reduced motion everywhere, performance measurement, screenshot baselines | frame cost measured and cut (24.9 → 7.5 ms CPU frame in the test browser); 60 fps on real hardware not yet demonstrated | Done (see UI_COMPLETION_REPORT) |

## UI-P1 / UI-P2 report (2026-10-27)
- **Verified:** `tsc`, `vite build`; 186 unit tests (the A* "< 2 ms" timing test fails only when the machine is busy and passes alone); the full E2E suite, 27/27, run with system Chrome after the refactor (needs `npx playwright install` for the bundled browser otherwise).
- **Screenshots (reviewed by eye, no concept art to compare against):** [desktop 1440×900](../screenshots/ui-desktop-1440x900.jpg), [with an order card](../screenshots/ui-desktop-order-card.jpg), [tablet 1024×768](../screenshots/ui-tablet-1024x768.jpg), [phone portrait 390×844](../screenshots/ui-mobile-portrait-390x844.jpg), [phone landscape 844×390](../screenshots/ui-mobile-landscape-844x390.jpg). The 1440×900 shot shows no order because the background tab throttled the customer; the order-card shot is from an earlier run of the same layout.
- **Bug found by running it:** hidden panels still swallowed clicks (a closed modal's full-screen backdrop blocked the whole world). This also affected the Sổ tay / Bản đồ panels added earlier. Fixed with `setShown()`; world clicks verified in the browser.
- **Not measured:** frame rate / memory (no profiling done yet), reduced-motion behaviour on real devices, touch input on a real phone.
- **Remaining:** UI-P3 (world bubbles, interaction indicators, rating/reward popups), UI-P4 (staff, inventory, decoration, shop panels; farm panels on phones), UI-P5 (animation polish, performance measurement, screenshot baselines).
