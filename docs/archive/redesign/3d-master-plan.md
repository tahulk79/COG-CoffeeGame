# Kế hoạch tổng — 3D redesign COG

> **Lưu trữ.** Tài liệu lịch sử, có thể đã lệch code. Không dùng làm đặc tả; xem [docs/README.md](../../README.md) để tìm tài liệu hiện hành.

Ngày lập: 2026-11-03. Nhánh: `feat/round-1-foundation`.

## Kết quả audit (Phase 00)

- Engine: **Three.js 0.185 + Vite 7**, JS thuần, không Phaser. Không cần đổi kiến trúc: mọi cảnh đã là 3D thời gian thực.
- Điểm thay hình có sẵn: `getAssetSlots()` / `replaceAsset(id, object3D)` ở `src/shared/world/scene.js`, `src/features/intro/scene.js`, `src/features/cafe/game.js`, `src/features/farm/crew.js`. Slot là wrapper cố định; animation/anchor gameplay nằm ngoài model → thay art không đụng luật chơi.
- Loader: `GLTFLoader` (không Draco/KTX2/Meshopt). Cache module ở `src/features/farm/assets.js`. Giải phóng: `src/shared/three/dispose-scene.js`.
- Chất lượng đồ hoạ: `src/shared/vfx/index.js` (`getQuality/setQuality/applyRendererQuality`) đã có 3 mức.
- Model thật hiện có: 2 nhân vật người chơi (GLB rig, 21–25 MB), cây cà phê, lò rang, sân phơi, quầy chợ (đã xuất, chưa tải vì quầy ẩn), máy espresso, bộ bàn ghế quán. Còn lại là khối tạm dựng bằng code.
- Blender MCP: Blender 5.2.2 LTS, addon v1.8, generator Meshy **bật**. Thư viện Poly Haven / Sketchfab / Poly Pizza **tắt**.
- Test: `node --test tests/` (3 file luật chơi). Build: `npm run build`.

## Ràng buộc

1. Không đổi luật chơi, save schema (`cog-coffee-progress` v1), id vật phẩm/slot.
2. Model chuẩn hoá trước khi gắn: pivot tâm đáy, +Z mặt chính, người cao 2 đơn vị (`docs/assets/scene-assets.md`).
3. Ngân sách tris/texture theo `docs/assets/asset-pipeline.md`.
4. **Meshy: ngân sách 922 credit** (người dùng cấp 2026-11-03), phân bổ ở `3d-progress.md`. Mọi asset làm được bằng dựng thủ tục trong Blender (0 credit) được ưu tiên.
5. Không thêm dependency khi chưa được đồng ý (README). Nén Draco/KTX2 cần thêm decoder → để ở Phase 12, xin duyệt riêng.
6. Không commit/push khi chưa được `ok` (CLAUDE.md). Không đè thay đổi chưa commit của người dùng (6 file đang sửa).

## Thứ tự phase và trạng thái

| Phase | Nội dung | Phụ thuộc | Trạng thái |
|---|---|---|---|
| 00 | Audit + registry | — | xong |
| 01 | Pipeline Blender → GLB → slot, kiểm chứng 1 model thật | 00 | kiểm chứng xong (giếng); còn đo credit Meshy, nén |
| 02 | Môi trường (phố, mây, farm, quán) | 01 | chờ |
| 03 | Farm (luống, cây theo giai đoạn, công trình tier 1–5) | 01 | một phần có sẵn |
| 04 | Quán + công trình | 01 | một phần có sẵn |
| 05 | Nhân vật/NPC | 01 + rig | chờ (cần Meshy hoặc dựng tay) |
| 06 | Đạo cụ/vật phẩm | 01 | chờ |
| 07 | Animation | 05 | chờ |
| 08 | Ánh sáng/vật liệu | 02 | chờ |
| 09 | VFX | có hệ thống `src/shared/vfx` | rà soát |
| 10 | Cinematic | 05, 07 | chờ |
| 11 | UI/UX | ui-kit có sẵn | rà soát |
| 12 | Tối ưu mobile | 02–06 | chờ, cần duyệt dependency nén |
| 13 | QA | tất cả | chờ |

## Quy tắc chọn nguồn asset (theo thang ponytail)

1. Model đã có trong `public/models` → dùng lại.
2. File gốc Meshy đã có trong `assets-src/meshy` → hậu kỳ Blender.
3. Hình học đơn giản (giếng, hàng rào, luống, đường, đá, đèn, biển, thùng) → dựng thủ tục trong Blender, 0 credit.
4. Hữu cơ/phức tạp (nhân vật, NPC, xe) → Meshy, chỉ khi có ngân sách.
