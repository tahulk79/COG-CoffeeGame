# 11 — Kết quả regression

## Baseline trước sửa

Thời điểm: 2026-11-04, nhánh `audit/game-studio-playtest-optimization`, working tree có thay đổi chưa commit của người dùng (không đụng tới). Node v22.19.0. `package.json` không có script `test` (chỉ dev/build/preview, package.json:6-10).

### Lần 1 — đúng lệnh được giao: `node --test tests/`
- Kết quả: **FAIL, exit 1** — không phải lỗi game mà lỗi cách gọi.
- Node 22 coi `tests/` là một file entry, không quét thư mục:
  ```
  Error: Cannot find module '/Users/macos/Desktop/V2/tests'
  not ok 1 - tests
  # tests 1 # pass 0 # fail 1
  ```
- Output đầy đủ: `evidence/framework-qa/node-test-baseline.txt`.

### Lần 2 — cùng ý định, chỉ định file: `node --test tests/*.test.js`
- Kết quả: **PASS, exit 0 — 33/33 test đạt, 0 fail, 0 skip**, ~245 ms.
- 3 file: `tests/farm-gameplay.test.js`, `tests/heaven-gameplay.test.js`, `tests/worker-avoidance.test.js`.
- Nhóm nội dung (theo tên test): mở đất/kề nhau, gieo/tưới/thu hoạch, giữ chỗ hạt giống, hàng đợi máy + huỷ trả nguyên liệu, đơn hàng không tạo doanh thu ảo, thuê/lương/quyền thợ, migrate save cũ (kể cả save trước 03/11), kéo thả không nhân đôi ô, tìm đường quanh vật cản, va chạm góc/trượt chéo, câu hỏi thiên đàng → review → quà → tái sinh, né tránh giữa thợ/người chơi.
- Output đầy đủ: `evidence/framework-qa/node-test-glob.txt`.

### Ghi chú
- Lệnh chuẩn để chạy lại sau sửa: `node --test tests/*.test.js` (hoặc thêm script `"test"` — chưa thêm, ngoài phạm vi).
- Test chỉ phủ logic thuần (farm/heaven/avoidance); không có test cho cafe, render, UI, chuyển cảnh, hiệu năng.

## Sau đợt sửa 1
Ngày 2026-11-04, working tree chưa commit, cùng nhánh. Không mở trình duyệt/dev server, chưa đo lại hiệu năng (07_PERFORMANCE_AFTER.md chưa có).

- `node --test tests/*.test.js`: `# tests 33 · # pass 33 · # fail 0`.
- `EVENTS=1 node scripts/balance-sim.mjs 30` so với `evidence/economy/balance-sim-30.txt`:
  - Phần farm tất định **trùng khớp**: `market 1595`, `seeds 340`, `land 590`, `fertilizer 198`, `upgrades 90`, `gear 340`, `harvested 164`, cột `roastedFarm` (8244/15468/10344/22524/9072), toàn bộ dòng sự kiện (mua ruộng, lên cấp, gear, upgrade) giống từng dòng.
  - Khác ở phần quán (`cafe`, `shift`, `supplies`, `served`, `rep`, `coins` ±vài chục xu): script dùng `Math.random()` cho khách quán (balance-sim.mjs:70,74), 3 lần chạy liên tiếp cũng lệch nhau cùng mức (coinsEnd 1016/1062/1046; baseline 1045). Không phải do đợt sửa — đợt sửa không đụng `rules.js`/`service.js`/luật `act`.
- `node --input-type=module --check < file` cho 15 file `src/*.js` đã đổi: tất cả OK (app/game.js, characters/load-player.js, characters/npc.js, cafe/game.js, farm/assets.js, farm/game.js, farm/model.js, farm/ui.js, intro/scene.js, selection/scene.js, shared/three/dispose-scene.js, shared/three/models.js, shared/world/scene.js, state/progress.js, ui/settings.js). `farm.css` không kiểm cú pháp tự động.
- Chưa kiểm: hiển thị thật của 8 mục (vùng bấm 44px, nút «Chơi lại từ đầu», «Thiếu N xu», HUD làm tròn), fps intro sau sửa, bộ nhớ ImageBitmap.

## Sau review đợt sửa 1 (Producer)
- Sửa thêm 3 điểm review/đo phát hiện: `cafe.lots:[null]` vẫn crash (model.js `rebuildStock` → `objects()`); backup trong `resetProgress` lỗi quota không còn chặn reset (try riêng); vùng chạm nút đóng dải giống nới ra ngoài để không đè mũi tên cuộn phải.
- `node --test tests/*.test.js`: 33/33 pass. Node probe: save có `cafe.lots/lots/workers/decorations` chứa null → tải được, không crash.
- Chưa đo lại trên trình duyệt sau 3 sửa cuối (chỉ CSS + lọc dữ liệu, không ảnh hưởng hiệu năng).
