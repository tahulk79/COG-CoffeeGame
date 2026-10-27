# H5 art, story scenes and UI integration

Implemented in the existing Phaser project on 2026-10-27. Final user direction prioritizes image assets; Blender rig/model production is deferred. The live Blender connection was inspected only; its existing scene was not edited.

## Art and assets

All generated PNGs are copied into the project, with alpha preserved:

- `public/assets/h5/`: panel/button skins, 16 HUD icons, hero portrait, 16 directional/walk hero frames, 16 café props, 16 farm props, 16 supplemental props/icons and 16 ground textures.
- `public/assets/story/`: café façade, foliage, portal arch and neutral sensory monolith.
- Both directories contain `manifest.json` with logical asset keys, paths, origin/grid rules and the exact ImageGen prompts. Generation used the built-in image tool.

Skins are applied through the shared Panel, GameButton and createIcon components. Text, prices, progress, quest state and hit areas remain dynamic. Ground uses separate image tiles for wood, wet asphalt, sidewalk, mossy paths and grass. Their opaque diamond bounds are normalized to the existing 128×64 projection. Light, glyphs, weather, progress bars and interaction outlines remain separate procedural layers. This is not a flattened level image.

NPCs currently reuse the directional hero artwork; distinct staff/customer identities and full skeletal animation remain for the later Blender production pass. Current walking uses two directional poses per facing. Artwork is a consistent provisional H5 set, not a claim of pixel-identical reproduction of the concept.

## UI corrections

- Bottom navigation starts hidden and is allowed only on the original or regional café/farm maps. It remains hidden through story transitions.
- Removed abrupt white camera flashes. Story objectives remain active during chapter travel.
- Farm plot views filter against the active map. Café mission HUD selects café-related objectives rather than showing the original harvest mission.
- Hidden modal/page/button input is disabled and only visible controls reactivate. New modal children are explicitly initialized hidden.
- Nine-slice corners are clamped to the actual control dimensions. A 26px button no longer renders a 44px-tall panel around a smaller hitbox.
- Light order cards retain a bright skin and dark text for contrast. Compact currency labels abbreviate large balances to avoid colliding with the profile.
- Finished drinks show an image of a cup and a named ready badge anchored to the actor. Servers also expose their actual carried drink. The finished-drink HUD collapses to a short panel.
- Each table can be upgraded from level 1 to 4 via the Nâng bàn modal. Costs: 150/400/900 coins; level gates: 1/3/5. Each purchase adds 2 comfort and 1 décor through real café bonuses. Upgrades save with table IDs and survive moving; storing an upgraded table is blocked to avoid silently losing its paid level.
- Development test mode grants level 99 and tops the wallet up to at least 1 billion coins. Story can be preserved while testing it. Purchases are still real transactions.

## Chapter 1

Outdoor terrain classification replaces the indoor cutaway wall treatment. Shops, trees, warm lamps, wet surfaces, road markings and rainfall fill the surroundings beyond the playable bounds. Cat, cars, barriers, player and HUD are independent sprites. Rescue follows the existing A* route and timed interaction, then the existing portal-chapter transition. Mouse and touch rescue actions are retained. Saving after rescue restores the outro instead of leaving the chapter stuck.

## Chapter 2

Forest paths, vegetation, ruins, lanterns, a flowing stream, wooden bridges, optional coffee-memory discovery and foreground foliage surround the playable area. River tiles are nonwalkable and bridge tiles walkable; tests verify that all objectives remain reachable.

Original stone IDs are preserved for existing saves. Labels now reflect Aroma/Taste/Emotion (Hương thơm, Vị giác, Cảm xúc). Green/blue/purple runes expose IDLE, PLAYER_NEARBY, ACTIVATING and ACTIVATED visual states derived from actual interaction/progression. Activation is once per stone and persisted. The gateway stays locked until all three are active, then displays live golden swirls, light, an activation wave and a small synthesized chime. The player must still walk to and interact with the portal to reach the Coffee Master chapter.

## Camera and performance

The canvas uses Phaser RESIZE and a viewport-sized container, with display:block to remove inline-canvas baseline gaps. World projection is unchanged. HUD and world retain separate cameras. Story HUD respects safe-area offsets. Surrounding scenery fills camera corners; it does not change interaction coordinates or stretch tiles. The street-only renderer is identified by its own sidewalk terrain, so the café's entrance street does not accidentally trigger a city renderer.

Rain, splashes, flowing water, magical particles and the portal use fixed graphics buffers and no per-particle game objects. Reduced-motion preference disables rainfall and reduces/staticizes magical effects. Sprite textures and HUD skins are reused across scene changes. Generated atlas resolution is detected at load time rather than assuming the generator returned a particular pixel size.

Automated browser checks run with installed desktop Chrome in headless mode; they are not physical-device GPU or memory benchmarks. Frame-pacing measurements and screenshots are attached to portal browser tests.

## Validation

Unit/integration coverage includes original gameplay plus story gating/retry/save, all three stone routes, single activation, portal entry, table purchase/bonus/save, map-specific farm data, test-mode balances and hidden-control input restoration.

Browser matrix: 390×844, 430×932, 844×390, 1024×768, 1440×900, 1920×1080. Screenshots: `docs/screenshots/incident-*.png`, `portal-*.png`, `table-upgrade-*.png`, `cafe-held-drink.png`, and regional world screenshots. Existing café and land-development E2E are included in the final regression run.
