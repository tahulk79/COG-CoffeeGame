# 01 — Project Audit (Phase 1.1)

> **Lưu trữ.** Tài liệu lịch sử, có thể đã lệch code. Không dùng làm đặc tả; xem [docs/README.md](../../README.md) để tìm tài liệu hiện hành.

Ngày: 2026-11-03 · Nhánh: `feat/round-1-foundation` (working tree có nhiều thay đổi chưa commit) · Nguồn: đọc source thực tế + chạy dev server.

## 1. Stack & render architecture

| Hạng mục | Thực tế trong code |
|---|---|
| Framework | Vanilla JS + Three.js `^0.185` + Vite 7. Không React/Vue, không UI lib. Dependency duy nhất: `three`. |
| Entry | `index.html` (toàn bộ HUD tĩnh) → `src/main.js` → `startGame()` trong `src/app/game.js` |
| Renderer | 1 `WebGLRenderer` dùng chung mọi cảnh. ACES Filmic, sRGB, PCFShadowMap. MSAA tắt trên máy cảm ứng DPR ≥ 2 (`game.js` initialize). |
| Render loop | `renderer.setAnimationLoop(frame)`; dừng khi tab ẩn; auto hạ quality khi < 25 fps trong 2 s (`watchFrame`). `?fps` hiện meter fps/draw/quality. |
| Post-processing | **Không có** (không EffectComposer). Outline ở preset high là mesh outline trong `shared/vfx`. |

## 2. Scene manager & chuyển cảnh

`src/app/game.js` là state machine: `loading → selection → playing (intro) → heaven → farm`. Quán (`cafe`) không phải state riêng: `features/farm/game.js` tạo `createCafeGame` lồng trong farm (`cafeGame`), đổi qua `enterCafe()` / nút "Nông trại".

- Vào thẳng cảnh dựa trên `localStorage['godbean-progress']` (`state/progress.js`, schema `version:1`).
- Mỗi cảnh có `scene, camera, update, resize, dispose`; chuyển cảnh = loading screen + `compileAsync` + `dispose` cảnh cũ.
- Hiệu ứng chuyển: `#scene-transition` (2 tấm trượt) + fade vignette. Không có transition riêng cho modal ngoài CSS.

| Cảnh | File chính | Camera |
|---|---|---|
| Chọn nhân vật | `features/selection/scene.js` | Perspective 34°, fog |
| Màn 1 (tai nạn → cổng trời) | `features/intro/scene.js`, `timeline.js` | Perspective 38°, cutscene theo timeline |
| Thiên đàng | `features/heaven/*` + `shared/world/scene.js` | Perspective 43° theo người chơi |
| Nông trại | `features/farm/*` + `shared/world/scene.js` (`farming=true`) | Orthographic isometric, zoom +/−, kéo để xoay |
| Quán | `features/cafe/*` | Orthographic isometric |

## 3. UI & styling architecture

- **DOM overlay** trên canvas. HTML tĩnh trong `index.html`; farm/cafe tạo thêm DOM bằng JS (`features/farm/ui.js` 672 dòng, `features/cafe/ui.js` 423 dòng).
- CSS: `src/ui/styles/` — `game.css` (token `--ui-*`), `ui-kit.css` (`.ui-btn`, `.ui-modal`, `.ui-tab`, `.ui-hud-btn`, toast, coach), `farm.css` **1.103 dòng**, `cafe.css` 215, `heaven.css` 70, `dialogue.css` 77.
- Đã có design token gỗ/giấy/lá (round-1 §1.2) và bí danh `:where()` để selector cũ dùng chung kit → **nền tảng tốt, nhưng chưa phủ hết**: farm.css vẫn tự định nghĩa nhiều kích thước/màu, 91 `@media` rải rác.
- Font: Baloo 2 + Fredoka (Google Fonts) — hỗ trợ tiếng Việt, hợp phong cách cozy.
- **Icon**: gần như toàn bộ là emoji hệ thống (☕ 🌱 🤖 👩 📦 💧 🔒 🌾 🧺 🪙 ⚙️ 📖 🎒 …, ~400 lần xuất hiện trong `src/` + `index.html`). Chỉ đồng xu ₫ (`ui/currency.js`) và vài nút là SVG. Emoji render khác nhau theo OS → vi phạm yêu cầu "không emoji làm icon production".
- Nhãn trong thế giới 3D: `CanvasTexture` (14 chỗ) — pill xám vẽ bằng canvas, nằm phẳng trên mặt đất hoặc billboard.
- Hội thoại: `ui/dialogue.js` + `#caption-box` dùng chung intro/heaven; avatar là chữ cái đầu / emoji.
- Settings: `ui/settings.js` (`<dialog>`), âm thanh 5 bus (UI hiện 3 slider), chất lượng low/medium/high, reset tiến trình.

## 4. Camera, lighting, material

- Ánh sáng chung (`shared/world/scene.js`): Hemisphere `#fff8e3/#94ac99` **2.8** + Directional **2.4**, shadow 1024, không fog ở farm. Chọn NV: hemi 1.8 + 3 directional. Intro: hemi 2.5 + sun 3.
- Hệ quả quan sát được: ambient quá mạnh so với key light → cảnh phẳng, ít khối, độ tương phản thấp (rõ nhất ở thiên đàng: kem trên kem).
- Material: chủ yếu `MeshStandardMaterial` từ GLB Meshy (1 material + 1 texture JPEG/mesh) xen lẫn khối thủ tục màu phẳng → hai "ngôn ngữ" vật liệu lệch nhau.
- Quality preset (`shared/vfx/index.js`): pixelRatio 1 / 1.25 / 1.5, shadow off ở low, particle 120/400/800.

## 5. 3D models, texture, animation, VFX

- 42 GLB, **~31 MB** tổng (ảnh 9,4 MB, hình học 21,9 MB). **Không nén hình học** (không meshopt/Draco), không KTX2.
- Model nặng nhất: `girl.glb` 2,9 MB, `male.glb` 2,6 MB, `cafe/surroundings` 2,4 MB, `farm/surroundings` 1,9 MB.
- Nhân vật chính, NPC (worker/guest/staff/gods/reaper) là Meshy + rig, 8–12k tris, 1 clip Walking.
- Nguồn & quy trình: `docs/assets/asset-pipeline.md`, `docs/assets/registry/*` (ASSET_REGISTRY), `docs/archive/redesign/3d-progress.md` (PROGRESS — redesign 3D đang chạy dở, còn khối tạm).
- VFX: `shared/vfx/index.js` (Points pool, burst, shake, pulse, outline), `features/farm/feedback.js`, `features/cafe/feedback.js`.
- Audio: `shared/audio/` (index 288 dòng, `sounds.js` 218) — có bus và `data-sfx` trên nút → **đã có hook âm thanh cho UI**.

## 6. Asset loading, caching, memory

- `shared/three/models.js`: `loadModel` cache theo URL, `dressSlot` (giữ khối tạm làm collider vô hình), `attachModels`.
- `shared/three/dispose-scene.js` giải phóng GPU khi rời cảnh; cache CPU giữ lại.
- Farm gộp mesh tĩnh theo material (`features/farm/environment.js`).
- Có sẵn skill đo `threejs-h5-performance-engineer` + `scripts/bench-init.js`, `glbinfo.py`, `heapdiff.py`.

## 7. Trạng thái gameplay & UI (đã khám phá)

Loading · Chọn NV · Intro cutscene + phụ đề · Thiên đàng (quest tracker, hồ sơ 3 dấu, joystick, nút tương tác E, toast, choices, ending modal) · Farm (profile/XP, quest tracker + coach "chạm để dẫn đường", xu, cài đặt, hướng dẫn, kho; mở dần: cửa hàng, nâng cấp, nhân viên, đơn hàng, xây dựng, vào quán; toolbelt, thanh làm việc, chọn giống dải dưới, mua ruộng, sự cố) · Quán (bảng ca, mở/đóng cửa, kho, nâng cấp, nhân viên, đơn farm, công thức, quầy pha `bench.js`, sự cố) · Settings · Error.

## 8. Responsive

- Có `viewport-fit=cover`, 58 chỗ dùng `safe-area`, breakpoint chính `max-width:600px` / `800px`.
- Không khóa orientation; cả portrait lẫn landscape đều chạy nhưng **landscape không được thiết kế riêng** (HUD portrait co lại → che 50–60% màn hình quán).
- Desktop: HUD giữ kích thước px cố định → chữ 11px, nhỏ so với màn 1440.

## 9. Test & build sẵn có

`tests/farm-gameplay.test.js`, `tests/heaven-gameplay.test.js` (chạy bằng `node --test`), `npm run build`. AGENTS.md: không tự chạy test/build khi chưa được yêu cầu.

## 10. Kết luận kiến trúc cho redesign

- **Không cần đổi framework.** DOM overlay + token CSS là đúng hướng cho game H5; vấn đề là *ngôn ngữ thiết kế* và *bố cục HUD*, không phải công nghệ.
- Đòn bẩy lớn nhất, rủi ro thấp: (1) bộ icon SVG thống nhất thay emoji, (2) gom HUD theo vùng an toàn + thu gọn, (3) chỉnh ánh sáng/độ tương phản trong `shared/world/scene.js`, (4) chuẩn hóa modal/shop về một component.
- Toàn bộ thay đổi đều nằm ở `ui/`, `index.html`, `features/*/ui.js`, CSS và tham số đèn — không chạm `model.js`, `rules.js`, `progress.js`.
