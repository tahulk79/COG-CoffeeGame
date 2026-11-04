# 06 · Performance baseline

## Asset (tĩnh)

> **Phân tích tĩnh** từ file GLB + code nạp model; chưa đo runtime. Công cụ: `python3 -I .claude/skills/threejs-h5-performance-engineer/scripts/glbinfo.py public/models/*/*.glb public/models/*.glb` + script đọc kích thước JPEG (chỉ đọc, không sửa repo). Bằng chứng thô: `production/audit/evidence/asset-render-static/{glbinfo.txt,texture-dims.txt,scene-totals.txt}`.
> VRAM = **ước lượng** RGBA8 + mipmap (w·h·4·4/3): 2048² ≈ 21.3 MB, 1024² ≈ 5.3 MB, 512² ≈ 1.3 MB. Chưa tính geometry, shadow map, render target.

### Tổng quan
- 45 file GLB, **21.6 MB** trên đĩa (ảnh 10.0 MB, geometry/khác 11.6 MB).
- **Mọi file đã nén `EXT_meshopt_compression`**; 3 file thêm `KHR_materials_emissive_strength` (heaven/portal, intro/sky-gate, selection/stage). Không file nào dùng KTX2/Basis; ảnh nhúng là **JPEG** (selection/stage thêm 2 PNG 8×1).
- Ảnh: nhân vật chính `girl.glb`/`male.glb` mỗi file **2048² + 1024²** (ảnh chiếm 1.38 / 1.17 MB); còn lại 1024² hoặc 512².
- Nạp: mọi model qua `gltfLoader` chung có `MeshoptDecoder` (`src/shared/three/models.js:6`); ngoại lệ dùng thẳng loader không cache: `loadPlayer` (`src/characters/load-player.js:7`), máy pha + bàn quán (`src/features/cafe/game.js:314`), trạm farm (`src/features/farm/assets.js:15-23`, có cache module).

### Từng file (KB tổng · KB ảnh · tam giác · ảnh)
| File | KB | KB ảnh | Tam giác | Ảnh | Ghi chú |
|---|---:|---:|---:|---|---|
| girl.glb | 1900 | 1378 | 10 341 | 2048+1024 | nhân vật chính, 2 animation |
| male.glb | 1680 | 1171 | 10 432 | 2048+1024 | nhân vật chính, 2 animation |
| selection/backdrop.glb | 739 | 0 | **79 612** | — | file nhiều tam giác nhất |
| selection/stage.glb | 822 | 309 | 15 932 | 1024+512+2×png8×1 | |
| intro/shops.glb | 972 | 461 | 19 998 | 2×1024 | |
| intro/bicycle.glb | 747 | 222 | 14 454 | 1024 | |
| intro/medic-m.glb / medic-f.glb | 694 / 539 | 325 / 235 | ~10k mỗi file | 1024 | skinned |
| intro/ambulance.glb | 428 | 191 | 9 988 | 1024 | |
| intro/street, sky-gate, trees | 85 / 58 / 24 | 0 | 9 880 / 2 196 / 1 288 | — | màu đỉnh |
| heaven/surroundings.glb | 884 | 205 | 25 954 | 1024 | |
| heaven/clerk.glb | 650 | 262 | 11 635 | 1024 | |
| heaven/business, brewing, growing | 537 / 503 / 474 | 195 / 310 / 288 | 10 047 / 8 668 / 8 735 | 1 / 3 / 3 ảnh 1024 | |
| heaven/reaper.glb | 443 | 274 | 8 000 | 3×1024 | dùng cả ở intro |
| heaven/plaza, portal | 78 / 58 | 0 | 12 340 / 2 196 | — | |
| farm/surroundings.glb | 1085 | 253 | 30 212 | 1024+512 | không đổ bóng (`farm/game.js:38`) |
| farm/roaster-tier-1 / dryer-tier-1 | 644 / 617 | 408 / 382 | 11 795 / 10 704 | 2×1024 mỗi file | clone 5 bậc mỗi trạm |
| farm/worker.glb | 570 | 221 | 9 997 | 1024 | skinned, clone theo số thợ |
| farm/grounds, well, coffee-tree, props, decor | 98 / 64 / 36 / 25 / 22 | 0 | 13 480 / 2 200 / **4 048** / 548 / 1 948 | — | cây clone **48 lần** |
| farm/market-tier-1 / grinder-tier-1 | 824 / 592 | 492 / 239 | 11 774 / 11 981 | — | **không được code nạp** |
| cafe/surroundings.glb | 1321 | 292 | 33 417 | 1024+512 | file quán lớn nhất |
| cafe/guest-m / guest-f / staff | 610 / 473 / 485 | 241 / 170 / 171 | ~10k mỗi file | 1024 | skinned, `keepOnGPU` |
| cafe/espresso-machine.glb | 556 | 439 | 4 889 | 2×1024 | ảnh = 79% file |
| cafe/register-counter, pastry-case, table, pickup-counter | 417 / 378 / 304 / 209 | 238 / 267 / 249 / 94 | 5 962 / 4 802 / 2 450 / 5 997 | 1–2 ảnh 1024 | register ×2, table ×N clone |
| cafe/kiosk, plant, room, fixtures, props | 138 / 135 / 134 / 43 / 11 | 78 / 89 / 38 / 0 / 0 | 2 999 / 1 416 / 12 390 / 3 846 / 308 | 1024 / 512 / 512 / — / — | |

(Đầy đủ: `evidence/asset-render-static/glbinfo.txt`.)

### Theo cảnh (model mà code nạp)
Danh sách model lấy từ code: selection `selection/scene.js:12,54`; intro `app/game.js:12-25` + `intro/scene.js:181`; heaven `heaven/game.js:11-28`; farm `farm/game.js:34,38`, `farm/assets.js:7-10`, `farm/crew.js:212`, `farm/decoration-builder.js:8`; quán `cafe/game.js:314-341,509-538` + nhân vật `farm/game.js:778`.

| Cảnh | Số file | Tải (MB, nhân vật nữ / nam) | Tam giác (1 bản mỗi file) | VRAM texture ước lượng | So ngân sách SKILL (≤ 5 MB tải, ≤ ~64 MB VRAM) |
|---|---:|---:|---:|---:|---|
| Chọn nhân vật | 4 (cả 2 nhân vật) | 5.02 | 116k | ~60 MB | tải sát ngưỡng |
| Intro (nhân vật chuyển từ selection) | 9 | 3.90 | 86k | ~48 MB + ~27 MB nhân vật | VRAM vượt nếu tính nhân vật |
| Thiên đàng | 9 | 5.40 / 5.18 | 98k | **~91 MB** | **vượt** tải và VRAM |
| Nông trại | 10 | 4.94 / 4.73 | 95k | ~60 MB | đạt (chưa tính bản clone) |
| Quán | 15 | 6.95 / 6.73 | 119k | **~95 MB** | **vượt** tải và VRAM |
| Farm + quán cùng lúc (sau lần vào quán đầu, `farm/game.js:770-786`) | — | — | — | **~155 MB** | vượt |

Lưu ý khi đọc bảng:
- "Tải" tính cả GLB nhân vật dù trình duyệt có thể đã cache HTTP; parse + upload GPU vẫn lặp lại vì `loadPlayer` không cache (xem 08 · M1/M2).
- Tam giác là 1 bản mỗi file. Trên màn thật lớn hơn nhiều vì clone: 48 cây cà phê × 4 048 = ~194k khi đủ cây (`farm/content.js:27,37`, `farm/assets.js:32-39`); 5 bậc mỗi trạm (chỉ bậc hiện tại hiển thị); khách/nhân viên quán ~10k mỗi người.
- VRAM là trần ước lượng, giả định mọi texture được upload; texture `metalnessMap` bị gỡ (`models.js:12-17`) vẫn là cùng ảnh với `roughnessMap` nên vẫn upload.

### Phát hiện asset
| ID | Mức | Nội dung | Bằng chứng | Đề xuất (chưa làm) |
|---|---|---|---|---|
| A1 | P2 | VRAM texture thiên đàng ~91 MB và quán ~95 MB (ước lượng) vượt ngân sách ~64 MB; riêng texture 2048² của nhân vật ~21 MB. | texture-dims.txt, scene-totals.txt | Theo SKILL §3.1: thử KTX2 (UASTC nhân vật, ETC1S môi trường) **hoặc** hạ ảnh nhân vật xuống 1024. Thêm dependency/transcoder cần người dùng `ok`; so ảnh trước/sau. |
| A2 | P2 | Tải lần đầu thiên đàng 5.2–5.4 MB, quán 6.7–7.0 MB > 5 MB. | scene-totals.txt | Như A1 (ảnh chiếm phần lớn: espresso 79%, nhân vật 70%). Đo thời gian tải thật trên mạng Fast 3G trước khi quyết. |
| A3 | P3 | `cafe/robots.glb` được code nạp nhưng **không có file** → 1 request lỗi mỗi phiên, robot giữ khối tạm. | `cafe/game.js:464`; `public/models/cafe/robots.glb` không tồn tại. `loadModel` cache kết quả `null` theo URL (`models.js:24`) nên chỉ lỗi 1 lần. | Tạo asset (agent asset-3d) hoặc bỏ lời gọi cho đến khi có file. Cần **quyết định thiết kế**. |
| A4 | P4 | `farm/market-tier-1.glb` + `farm/grinder-tier-1.glb` (1.4 MB) không được code nạp nhưng vẫn nằm trong `public/` nên vào bản build. | `farm/assets.js:6-7` (shortcut có ghi chú: quầy chợ đang ẩn); không có tham chiếu `grinder-tier`. | Giữ (đã ghi shortcut); chỉ là dung lượng deploy, không ảnh hưởng tải cảnh. |
| A5 | P3 | `selection/backdrop.glb` 79 612 tam giác — một mình gần bằng tổng các cảnh khác, chỉ làm nền xa có sương. | glbinfo.txt; dùng ở `selection/scene.js:54-77`. | Decimate nếu `__bench` selection cho thấy tris/CPU cao. |
| A6 | P4 | Không model nào có KTX2/WebP; ảnh JPEG nhúng phải giải mã thành RGBA đầy đủ trên GPU. | glbinfo.txt (cột loại ảnh) | Như A1. |

Không kiểm tra: dung lượng sau gzip/brotli khi deploy, thời gian decode meshopt/JPEG thật, VRAM thật (cần `__bench` → `gpu.tex` và Chrome Task Manager).

## Runtime

> **Đo trên Chrome desktop (Mac) giả lập viewport/CPU throttle; không phải thiết bị di động thật.** GPU là GPU của Mac, không đại diện GPU điện thoại. Server là Vite dev (module ES chưa bundle) → thời gian tải **không** đại diện bản build production. Cache trình duyệt ấm (đã vào origin trước đó), không giả lập mạng.
> Công cụ: MCP `chrome-devtools` **không khởi động được** (profile đang bị một phiên khác giữ) → dùng Chrome 156 riêng (user-data-dir tạm, CDP cổng 9333) với đúng các lệnh tương đương: `Emulation.setDeviceMetricsOverride`/`setTouchEmulationEnabled`/`setCPUThrottlingRate`, `bench-init.js` qua `Page.addScriptToEvaluateOnNewDocument`, thao tác bằng `Input.dispatchTouchEvent` (mobile) / `dispatchMouseEvent` (desktop), `HeapProfiler`, `Tracing`. Origin `http://perf.localhost:5174/?fps`.
> Mỗi cảnh: chờ 3–4 s → `__bench(8)` → `__cpu(5)`. Số thô: `evidence/perf/raw-results.json`; ảnh `evidence/perf/{m,d}-*.png`; top hàm trace `evidence/perf/tracetop-*.txt`.

### Cấu hình
- **Mobile**: 390×844×3, mobile+touch, CPU throttle 4×. Preset tự chọn = `medium` (canvas 487×1055 → pixelRatio 1.25). Không thấy auto hạ quality trong lúc đo (meter vẫn `medium`).
- **Desktop đối chiếu**: 1280×720×1, không throttle, preset `high`.
- Fixture: selection/intro = `localStorage.clear()`; heaven/farm theo SKILL §2.4. Farm mobile dùng save mới (shop/quán còn khoá); để mở được Cửa hàng + Vào quán dùng fixture `evidence/perf/fixture-farm-unlocked.json` (claimed `harvest,serve,dry,roast,sell`, `stats.sold=1`, `stats.served=1`). **Farm desktop đo bằng fixture mở khoá → không cùng trạng thái với farm mobile.**

### Bảng mỗi cảnh
`heapMB` là `usedJSHeapSize` lúc đo, **chưa ép GC**. `tex/buf/prog` = số đối tượng WebGL đang sống (không phải MB). Tải = từ lệnh navigate/tap tới khi `#loading` ẩn và đã có frame.

**Mobile (throttle 4×, medium)**
| Cảnh | Tải ms | FPS TB | 1% low | p95 ms | max ms | CPU med/p95 ms | draw | tris | heap MB | tex/buf/prog | long task |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| Chọn nhân vật | 2 242 | 60 | 56.5 | 17.6 | 17.7 | 1.5 / 2.1 | 23 | 132.6k | 23.1 | 18/68/10 | 0 |
| Intro (đo từ 1.5 s sau khi vào) | 2 561 | **37.7** | **2.6** | 34.2 | **966** | 4.5 / 6.0 | 61 (max 95) | 270.9k | 32.0 | 29/132/31 | **4 (1 560 ms)** |
| Thiên đàng | 1 980 | 60 | 56.4 | 17.6 | 17.8 | 2.5 / 3.1 | 85 | 132.5k | 28.6 | 16/189/15 | 0 |
| Farm (save mới) | 2 982 | 59.8 | 40.5 | 18.4 | 48.9 | **6.3 / 8.4** | 117 | 163.5k | 33.4 | 24/203/18 | 0 |
| Quán (lần đầu, đóng cửa) | 2 111 | 60 | 53.6 | 18.4 | 18.8 | 5.0 / 6.0 | 142 | 224.8k | 77.9 | 51/610/26 | 0 |
| Quán (15 s sau «Mở cửa») | — | 60 | 53.6 | 18.2 | 18.7 | 5.7 / 7.1 | 145 | 244.8k | 83.0 | 53/610/26 | 0 |

**Desktop đối chiếu (1280×720, không throttle, high)**
| Cảnh | Tải ms | FPS TB | 1% low | p95 ms | max ms | CPU med/p95 ms | draw | tris | heap MB | tex/buf/prog | long task |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| Chọn nhân vật | 494 | 60 | 53.5 | 18.4 | 18.7 | 0.3 / 0.5 | 23 | 132.6k | 15.5 | 18/68/10 | 0 |
| Intro | 378 | 58.6 | 18.3 | 18.2 | 167.1 | 1.0 / 1.4 | 76 (max 100) | **333.5k** | 46.6 | 32/133/34 | 2 (232 ms) |
| Thiên đàng | 481 | 60 | 53.6 | 18.4 | 18.7 | 0.7 / 0.9 | 117 | 163.3k | 18.5 | 23/218/15 | 0 |
| Farm (fixture mở khoá) | 560 | 60 | 53.6 | 18.4 | 18.7 | 1.5 / 1.8 | **183** | 197.7k | 33.4 | 32/303/18 | 0 |
| Quán (lần đầu) | 416 | 60 | 53.5 | 18.4 | 18.7 | 1.4 / 1.7 | 154 | 236.4k | 49.4 | 64/709/26 | 0 |

So ngân sách SKILL §4 (draw ≤150 · tris ≤300k · CPU ≤8 ms ở 4×): vượt ở **farm desktop/high 183 draw**, **quán desktop 154 draw**, **intro desktop 333.5k tris**, **farm mobile CPU p95 8.4 ms** (median 6.3). Mobile quán 142–145 draw sát ngưỡng.

### Trace và tương tác
| Việc | Kết quả | Bằng chứng |
|---|---|---|
| Intro (mobile, trace 14 s từ lúc bấm «Vào Game») | Long task 206/72/62/62/108/57/66 ms. `applyBoneTransform` = 12.9% thời gian trace (23% trong 3 s đầu) + `getVertexPosition`/`fromBufferAttribute` → **bounding box skinned từng đỉnh mỗi frame** khi `seconds < 4.45` (`src/features/intro/scene.js:327-331`) và lúc dựng cảnh (`:112,126,135,137`). | `tracetop-m-intro.txt` |
| Vào farm (mobile, trace navigate + 3 s) | `multiplyMatrices` 5.3%, `updateMatrixWorld` 8.5%, `getProgramInfoLog` 1.9%. | `tracetop-m-farm-enter.txt` |
| Farm đứng yên (mobile, 5 s) | `updateMatrixWorld` 10.2% + `multiplyMatrices` 7.9% + `compose`/`updateMatrix` 4.8% ≈ 23% → chi phí cập nhật ma trận cho rất nhiều object (heap snapshot: 3 132 Mesh, 1 143 Group khi farm + quán cùng sống). Nguyên nhân cụ thể (object tĩnh vẫn `matrixAutoUpdate`) là **AI heuristic**, chưa xác minh. `setStyle` (parse màu CSS) xuất hiện mỗi frame 0.5%. | `tracetop-m-farm-steady.txt` |
| Mở/đóng modal Cửa hàng farm ×5 (tap thật `#farm-shop-toggle` / `#farm-modal-close`) | Mobile: mở 423/246/182/199/197 ms, đóng 171/151/150/149/168 ms, 1 long task 239 ms (lần mở đầu). Desktop: mở 42/22/23/18/21, đóng 9/9/8/15/11 ms, 0 long task. GPU tex/buf/prog không đổi sau 5 lần. Số ms gồm vòng CDP + poll 20 ms (desktop cho thấy phần này ≲ 20 ms). | `tracetop-m-shop5.txt`, ảnh `m-farm-shop-open.png` |
| Farm → quán lần đầu (mobile) | 2 111 ms; `getProgramInfoLog` **564.6 ms (11.1%)** = biên dịch shader đồng bộ ở frame đầu. Quán dựng trong `enterCafe` (`src/features/farm/game.js:769-787`) **không gọi `compileAsync`** (chỉ có ở `src/app/game.js:77,98,194,218`) → xác nhận nghi vấn §4 của 08. | `tracetop-m-farm-to-cafe.txt` |
| Farm ↔ quán các lần sau (quán được giữ `cafeKept`) | Vào quán: mobile 162–208 ms, desktop 12–21 ms. Về farm: mobile 331–361 ms, desktop 216–227 ms. Trace một vòng mobile: 0 long task. | `tracetop-m-roundtrip.txt`, `raw-results.json` |

Console: chỉ cảnh báo `AudioContext was not allowed to start` (3 lần, intro/quán/desktop); không có error/exception.

### Chưa đo
- Farm đủ 48 ô có cây (nghi vấn R1 của 08) — fixture chỉ có ô mặc định.
- Tải lạnh (tắt cache), giả lập mạng, bản build production; viewport Android 412×915; thiết bị thật.
- FPS khi đang di chuyển bằng joystick/WASD (mọi `__bench` đo lúc nhân vật đứng yên, quán có khách tự đi).
