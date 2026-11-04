# Scene registry

| Cảnh | Factory | Camera | Slot | Ghi chú redesign |
|---|---|---|---|---|
| Loading | `index.html#loading` | — | — | UI 2D |
| Chọn nhân vật | `src/features/selection/scene.js` | xoay quanh model | — | Dùng `male.glb`/`girl.glb`; cần sân khấu 3D nền |
| Màn 1 phố + tai nạn | `src/features/intro/scene.js` | cinematic theo `timeline.js` | `intro/street/*`, `warning-sign/*`, `bicycle` | Phố Việt Nam: nhà ống, mái hiên, cây xanh |
| Màn 1 cứu hộ | như trên + `rescue.js` | | `ambulance`, `stretcher`, `reaper` | Y tế dùng `createPerson({medical})` |
| Màn 1 đường mây + cổng | như trên | | `intro/heaven/*` | |
| Hội đồng trùng sinh | `src/features/heaven/scene.js` → `createAdventureScene` | isometric theo người chơi | `heaven/*` | 4 thần + Thần Chết = "năm vị thần" |
| Nông trại | `src/features/farm/game.js` + `environment.js` | isometric, zoom, pan | `farm/*` | Gameplay chính; bounds X −20..11, Z −19..4, mở rộng theo ruộng |
| Quán cà phê | `src/features/cafe/game.js` | isometric | `cafe/*` | Quầy pha `bench.js` là UI 2D (giữ) |
| Công cụ kiểm tra | `tools/intro-preview`, `tools/farm-preview` | | | Không vào build |

Chuyển cảnh: `src/app/game.js` (`#scene-transition`). Giải phóng: `disposeScene`.
