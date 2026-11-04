# Baseline hiệu năng — tóm tắt

> **Đo trên Chrome desktop (Mac) giả lập viewport/CPU throttle; không phải thiết bị di động thật.** GPU Mac, Vite dev server, cache ấm. Ngày đo 2026-11-04, nhánh `audit/game-studio-playtest-optimization` (gồm thay đổi chưa commit). Chi tiết: `06_PERFORMANCE_BASELINE.md#runtime`, `08_MEMORY_AND_LEAKS.md#runtime-heapgpu-qua-các-vòng`, số thô `evidence/perf/raw-results.json`.

Cột: FPS TB · 1% low · p95 ms frame · CPU ms/frame median/p95 · draw · tris · heap MB (chưa GC) · tex/buf/prog WebGL · tải ms.

| Cảnh | Mobile 390×844, 4×, medium | Desktop 1280×720, 1×, high |
|---|---|---|
| Chọn nhân vật | 60 · 56.5 · 17.6 · 1.5/2.1 · 23 · 133k · 23.1 · 18/68/10 · 2 242 | 60 · 53.5 · 18.4 · 0.3/0.5 · 23 · 133k · 15.5 · 18/68/10 · 494 |
| Intro | **37.7 · 2.6** · 34.2 · 4.5/6.0 · 61 · 271k · 32.0 · 29/132/31 · 2 561 · 4 long task 1 560 ms | 58.6 · 18.3 · 18.2 · 1.0/1.4 · 76 · **334k** · 46.6 · 32/133/34 · 378 |
| Thiên đàng | 60 · 56.4 · 17.6 · 2.5/3.1 · 85 · 132k · 28.6 · 16/189/15 · 1 980 | 60 · 53.6 · 18.4 · 0.7/0.9 · 117 · 163k · 18.5 · 23/218/15 · 481 |
| Farm | 59.8 · 40.5 · 18.4 · **6.3/8.4** · 117 · 164k · 33.4 · 24/203/18 · 2 982 (save mới) | 60 · 53.6 · 18.4 · 1.5/1.8 · **183** · 198k · 33.4 · 32/303/18 · 560 (fixture mở khoá) |
| Quán (lần đầu) | 60 · 53.6 · 18.4 · 5.0/6.0 · 142 · 225k · 77.9 · 51/610/26 · 2 111 | 60 · 53.5 · 18.4 · 1.4/1.7 · **154** · 236k · 49.4 · 64/709/26 · 416 |
| Quán đang mở | 60 · 53.6 · 18.2 · 5.7/7.1 · 145 · 245k · 83.0 · 53/610/26 | — |

| Tương tác | Mobile 4× | Desktop |
|---|---|---|
| Modal Cửa hàng farm mở / đóng (×5) | 182–423 / 149–171 ms, 1 long task 239 ms | 18–42 / 8–15 ms |
| Farm → quán lần đầu | 2 111 ms, compile shader đồng bộ 565 ms | 416 ms |
| Farm → quán / quán → farm (lần sau) | 162–208 / 331–361 ms | 12–21 / 216–227 ms |
| Rò rỉ 10 vòng farm↔quán | +0.68 MB, tex +3 (quán mở, khách thay đổi) | +0.27 MB, object Three không đổi, tex không đổi |

Điểm nóng theo số đo (thứ tự ưu tiên đề xuất):
1. **Intro mobile** 37.7 fps, 1% low 2.6, frame tối đa 966 ms — `applyBoneTransform` (bounding box skinned từng đỉnh mỗi frame, `src/features/intro/scene.js:327-331`) + long task lúc vào.
2. **Lần đầu vào quán**: biên dịch shader đồng bộ 565 ms vì không `compileAsync` (`src/features/farm/game.js:769-787`).
3. **Farm CPU** p95 8.4 ms ở 4× (vượt 8 ms): ~23% trace là cập nhật ma trận (3 132 Mesh + 1 143 Group sống). Draw 183 ở preset high.
4. **VRAM**: farm + quán cùng sống sau lần vào quán đầu (tex 24→54, buf 203→618 trên mobile).
