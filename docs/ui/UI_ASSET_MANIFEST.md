# UI Asset Manifest

Registry: `src/ui/theme/assetRegistry.ts`. Components ask for a logical key; `createIcon()` returns the production texture if one is loaded under the Phaser texture key `ui/<key>`, otherwise the vector placeholder. Swapping art means loading textures; no gameplay or component code changes.

| Key | Kind | Placeholder | Future path | Size | Anchor |
|---|---|---|---|---|---|
| coin, star, starEmpty, heart, gear, farm, cup, people, brush, map, book, lock, check, exp, bell, scroll | icon | vector shapes from tokens | `assets/ui/icons/<key>.png` | 24×24 | 0.5, 0.5 |
| bean, cherry, sprout, bottle, chair, box | icon (item categories via `itemIconKey`) | vector shapes | `assets/ui/icons/<key>.png` | 24×24 (cards 34) | 0.5, 0.5 |
| avatar | avatar | caramel disc + silhouette | `assets/ui/avatars/avatar.png` | 44×44 | 0.5, 0.5 |
| customer | avatar | wood disc + silhouette | `assets/ui/avatars/customer.png` | 32×32 | 0.5, 0.5 |
| panel | panel | `drawPanel()` | `assets/ui/panels/panel.png` | 64×64 | 0, 0 · nine-slice 16/16/16/16 |

**Still placeholder / missing production art:** one icon per item and per furniture piece (today icons are per *category*; production art can be keyed `item.<id>` / `furniture.<type>`), drink thumbnails per recipe (the order bubble and cards use the generic cup), employee portraits per role (generic person), customer portraits per archetype, button and panel nine-slice textures, rating reaction faces, world sprites for characters and furniture (world objects are still extruded boxes), HUD sounds.
