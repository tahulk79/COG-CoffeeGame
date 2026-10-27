# HUD Layout

`HudLayout` measures the viewport (and CSS safe-area variables from `index.html`) and publishes a `HudFrame` `{w, h, safe, mode, portrait, margin}`. Components subscribe once and re-layout on resize. `worldViewInsets()` tells the camera how much screen the HUD keeps, so the world is fitted into what is left.

**Modes:** `compact` when width < 760 or height < 520, otherwise `wide`.

| Zone | Wide (desktop / tablet) | Compact portrait (phone) | Compact landscape |
|---|---|---|---|
| Top left | Player profile (avatar, level, EXP bar, reputation stars), mission tracker under it | same, narrower | same |
| Top right | Coins + settings; order cards under it | Coins + settings | Coins + settings; one order card under it |
| Orders | Up to 4 cards, current actionable order first + gold border, "+N" overflow | One card above the toolbar, centred | One card, right column |
| Bottom centre | Toolbar: icon + label | Toolbar: icons only | icons only |
| Contextual | Brewing panel bottom right (only while brewing / holding a drink / at the supply shelf) | above the order card | bottom right |
| Panels | Staff panel bottom left (toggle), Sổ tay / Bản đồ / Settings centred modals | same | same |

Toolbar: Quán⇄Nông trại (locked until the story is done), Nhân viên (locked where no staff exist), Trang trí (café only), Bản đồ, Sổ tay. Locked buttons are greyed and show the reason on hover. Inventory and Recipes have no panels yet; they are planned for UI-P4 and are deliberately **not** shown as dead buttons.

**Known gaps:** on the farm the seed shop and processing/market panels are still fixed 330 px columns (UI-P4); they overlap the world on phones.
