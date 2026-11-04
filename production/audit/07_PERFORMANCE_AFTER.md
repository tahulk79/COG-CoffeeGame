# 07 — Hiệu năng sau đợt sửa 8 mục

> **Đo trên Chrome desktop Mac giả lập, không phải thiết bị thật.** GPU là GPU của Mac. Server là Vite dev, cache ấm, không giả lập mạng. Ngày đo 2026-11-04, nhánh `audit/game-studio-playtest-optimization`. Code gồm thay đổi chưa commit của người dùng và 8 mục sửa trong `12_FINAL_RECOMMENDATIONS.md`.

## Điều kiện (giống baseline `06_PERFORMANCE_BASELINE.md#runtime`)
- Chrome 156 headless chạy riêng: `--user-data-dir` tạm trong scratchpad, CDP cổng 9333. Chrome tạm đã tắt và đã xoá profile sau khi đo.
- Script lấy từ driver của baseline (`driver.mjs`). Chỉ đổi thư mục lưu ảnh sang `perf-after/`. Bản sao nằm ở `evidence/perf-after/scripts/`.
- `bench-init.js` được nạp qua `Page.addScriptToEvaluateOnNewDocument`. Thao tác bằng touch trên mobile, chuột trên desktop. Origin là `http://perf.localhost:5174/?fps`.
- **Mobile**: 390×844×3, mobile + touch, CPU 4×, preset `medium` (canvas 487×1055). **Desktop**: 1280×720×1, không throttle, preset `high`.
- Cách đo mỗi cảnh: chờ 3,5 s → `__bench(8)` → `__cpu(5)`. Intro: `requestSubmit()` → chờ `#loading` ẩn → chờ 1,5 s → `__bench(8)`.
- Fixture: selection/intro dùng `localStorage.clear()`. Thiên đàng và farm "save mới" theo SKILL §2.4. Shop và quán dùng `evidence/perf/fixture-farm-unlocked.json`.
- Khi bắt đầu lượt này, dev server cổng 5174 **không chạy**. Tôi tự bật `vite --port 5174` và đã tắt khi đo xong.

## Trước / sau — mục tiêu của đợt sửa (mobile 4×, medium)
| Chỉ số | Trước | Sau | Ghi chú |
|---|---:|---:|---|
| **Intro** FPS TB | 37,7 | **44,9** (2 lần chạy: 44,9 / 44,9) | |
| Intro 1% low | 2,6 | **12,0 / 12,6** | |
| Intro p95 ms | 34,2 | 33,4 / 33,4 | Không đổi: frame vẫn thường lỡ 1 vsync |
| Intro frame tối đa | 966 ms | **133 ms** | |
| Intro long task (trong `__bench`) | 4 · 1 560 ms | **4 · 329–336 ms** | |
| Intro CPU med/p95 | 4,5 / 6,0 | 4,9 / 6,0–6,4 | Trong khoảng nhiễu |
| Intro `applyBoneTransform` (trace 14 s) | 1 847 ms · 12,9% | 1 264 ms · 8,8% | Phần còn lại tập trung ở 2 khoảng, xem dưới |
| **Farm → quán lần đầu**, thời gian | 2 111 ms | 2 108 ms | Thời gian hầu như giữ nguyên |
| Farm → quán lần đầu, `getProgramInfoLog` (compile đồng bộ) | **564,6 ms** (11,1%) | **97,0 ms** (1,9%) | `compileAsync` có tác dụng |
| Farm → quán lần đầu, long task lớn nhất | (compile nằm trong frame đầu) | 529 ms | Đây là bước dựng quán đồng bộ (`createCafeGame`: `measureText`/`fillText`, tạo geometry), không phải compile |
| **Modal Cửa hàng farm** mở ×5 | 423/246/182/199/197 ms | 510/200/228/183/204 ms | Không có trong đợt sửa. Không đổi trong khoảng nhiễu |
| Modal đóng ×5 | 171/151/150/149/168 ms | 193/304/183/184/168 ms | Như trên |
| Modal long task | 1 · 239 ms | 3 · 232/189/88 ms | Như trên. GPU tex/buf/prog không đổi sau 5 lần |
| **Farm CPU** med/p95 (save mới) | 6,3 / **8,4** | 6,2 / **8,6** | Không có trong đợt sửa. Vẫn vượt ngân sách 8 ms |

## Không hồi quy (mobile 4×, medium)
Cột: FPS TB · 1% low · p95 · max ms · CPU med/p95 · draw · tris · tex/buf/prog · long task.
| Cảnh | Trước | Sau |
|---|---|---|
| Chọn nhân vật | 60 · 56,5 · 17,6 · 17,7 · 1,5/2,1 · 23 · 132,6k · 18/68/10 · 0 | 60 · 59,5 · 16,7 · 16,8 · 1,6/2,2 · 23 · 132,6k · 18/68/10 · 0 |
| Thiên đàng | 60 · 56,4 · 17,6 · 17,8 · 2,5/3,1 · 85 · 132,5k · 16/189/15 · 0 | 60 · 59,5 · 16,8 · 16,8 · 2,7/3,2 · 85 · 132,5k · 16/189/15 · 0 |
| Farm (save mới) | 59,8 · 40,5 · 18,4 · 48,9 · 6,3/8,4 · 117 · 163,5k · 24/203/18 · 0 | 60 · 59,5 · 16,8 · 16,8 · 6,2/8,6 · 117 · 163,5k · 24/203/18 · 0 |
| Farm (fixture mở khoá) | — | 60 · 59,5 · 16,7 · 16,8 · 5,9/8,1 · 122 · 164,1k · 24/202/18 · 0 |
| Quán (lần đầu) | 60 · 53,6 · 18,4 · 18,8 · 5,0/6,0 · 142 · 224,8k · 51/610/26 · 0 | 60 · 59,5 · 16,8 · 16,8 · **7,1/8,6** · 142 · 224,8k · 53/616/28 · 0 |
| 5 vòng farm↔quán | tex/buf/prog không tăng | tex/buf/prog giữ 53/616/28 cả 5 vòng. Heap 77,2→73,8 MB (farm), 83,5→79,6 MB (quán) |

- Quán: CPU med 5,0→7,1 ms, p95 6,0→8,6 ms. Một lần đo nên **chưa kết luận** được đây là hồi quy hay nhiễu (quán có khách tự đi). Draw, tris và FPS giữ nguyên. Cần đo lặp nếu muốn chắc.
- Quán có +2 program, +6 buffer so với trước. Lý do có thể là `compileAsync` biên dịch sẵn biến thể shader. Tôi chưa xác minh.
- Thời gian về farm đo được 29–61 ms, trước là 331–361 ms. Hai số này **không so được**: script này dừng đồng hồ khi `document.title` đổi, còn cách dừng của baseline không ghi lại.
- Thời gian tải cảnh (selection 909–972 ms, thiên đàng 1 011 ms, farm 1 910–2 084 ms) thấp hơn baseline (2 242 / 1 980 / 2 982 ms). Nguyên nhân có thể do độ ấm của cache, vì chưa có lần sửa nào nhắm vào phần tải. **Không coi là cải thiện.**

## Desktop đối chiếu (1280×720, không throttle, high)
| Cảnh | Trước | Sau |
|---|---|---|
| Intro | 58,6 · 1% low 18,3 · max 167 ms · 2 long task 232 ms | 59,8 · 1% low **42,7** · max **50 ms** · 1 long task 52 ms |
| Thiên đàng | 60 · 117 draw · CPU 0,7/0,9 | 60 · 117 draw · CPU 0,8/0,9 |
| Farm (fixture) | 60 · **183** draw · 197,7k · 32/303/18 · CPU 1,5/1,8 | 60 · **191** draw · 198,5k · 32/307/18 · CPU 1,7/2,0 |
| Quán lần đầu | 60 · 154 draw · 64/709/26 | 60 · 154 draw · 64/713/28 |
| Shop mở / đóng ×5 | 18–42 / 8–15 ms | 17–26 / 12–15 ms |

- Farm desktop tăng 8 draw (183→191) và mobile fixture có 122 draw. Fixture có mốc thời gian cố định, nên sau ~3 giờ cây và biểu tượng trạng thái có thể đã khác. Đây là **suy đoán, chưa xác minh**. Farm "save mới" trên mobile vẫn đúng 117 draw như trước.

## Phần còn lại của PERF-1 (intro)
Trace 14 s, mốc 0 là lúc bấm "Vào Game" (intro bắt đầu khoảng 0,8 s sau):
- `applyBoneTransform` dồn vào 2 khoảng. Khoảng 2–4,5 s chiếm 478 ms (19%), là lúc nhân vật tới gần biển, khi gate `hero.position.x > contactX - 1` đang mở. Khoảng 7–10 s chiếm 647 ms (22%), là lúc y tá đỡ người, khi `supportWeight > 0`. Hai khoảng 4,5–7 s và 10–14 s gần như bằng 0.
- Long task > 50 ms: 343 ms ở 0,04 s (dựng cảnh) và 182 ms ở 0,43 s. Ở 6,6–9,7 s có 6 task 50–145 ms, trùng khoảng y tá đỡ.
- Muốn giảm tiếp thì cache bounding box hoặc dùng bounds của xương thay cho bounds từng đỉnh trong 2 khoảng này. Việc này **chưa làm** vì nằm ngoài phạm vi đã duyệt.

## Kiểm tra chức năng (ảnh trong `evidence/perf-after/`)
| Việc | Kết quả | Ảnh |
|---|---|---|
| Intro mobile | Chạy bình thường | `m-intro.png` |
| Farm mobile | Chạy bình thường, HUD xu hiện số nguyên ("3", "350") | `m-farm.png`, `m-farm-unlocked.png` |
| Shop khi thiếu xu (xu = 3, giống 10 xu) | Thẻ hiện "Thiếu 7 xu". Nút "10 xu" vẫn bấm được. Bấm vào thì báo "Cần 10 xu · Bạn còn thiếu 7 xu." và xu vẫn là 3 | `m-shop-short.png`, `m-shop-short-tap.png` |
| Save hỏng `workers:[null]` (origin riêng `broken.localhost`) | **Không còn vào màn lỗi**: farm tải bình thường. Các case `plots:[null]`, `fields:[null]`, `stock/seeds/upgrades/stats:null`, `farm:null`, `cafe:{stock:5}` cũng tải được | `m-broken-workers-null.png` |
| Màn lỗi + nút "Chơi lại từ đầu" | Vẫn còn một save hỏng gây kẹt: **`farm.cafe.lots:[null]` vẫn ra màn lỗi**. Trên màn đó, bấm lần 1 nút đổi thành "Bấm lần nữa để xóa tiến trình". Bấm lần 2 thì trang tải lại về màn chọn nhân vật, localStorage chỉ còn `cog-coffee-progress-backup` | `m-error-broken-save.png`, `m-error-reset-armed.png`, `m-after-reset.png` |
| Console | Chỉ có cảnh báo `AudioContext was not allowed to start`, không có error hay exception | `raw-results.json` |

**Lỗi còn sót của EX-1:** `src/features/farm/model.js:159` chạy `target.lots.filter(l=>productById(l.product)…)` với `target = progress.cafe`. Mảng `cafe.lots` không đi qua `objects()`, nên phần tử `null` gây TypeError. Cách sửa gợi ý là dùng `objects(target.lots)` thay cho `(target.lots||[])` ở dòng đó. **Chưa sửa** vì file này không thuộc phạm vi của bước đo.

## Bằng chứng
- Số thô: `evidence/perf-after/raw-results.json` (3 lần chạy intro mobile, 1 lần chạy intro desktop, các cảnh mobile và desktop, shop, 5 vòng chuyển cảnh).
- Top hàm trong trace: `tracetop-m-intro.txt`, `tracetop-m-farm-to-cafe.txt`, `tracetop-m-shop5.txt`. File trace JSON đã xoá khỏi `node_modules/.perf/`.
- Script: `evidence/perf-after/scripts/`.

## Chưa đo
- Thiết bị thật, safe-area, viewport Android, mạng chậm, bản build production.
- Heap snapshot / heapdiff 10 vòng. Lượt này chỉ chạy 5 vòng và chỉ đếm đối tượng WebGL cùng heap chưa GC.
- Đo lặp CPU quán để tách hồi quy khỏi nhiễu.
- Farm đủ 48 ô có cây.
