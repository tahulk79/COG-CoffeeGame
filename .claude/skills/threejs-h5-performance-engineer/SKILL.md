---
name: threejs-h5-performance-engineer
description: Đo và tối ưu hiệu năng game H5 Three.js mobile-first của dự án này (render loop, draw call, shadow, DPR/quality, bộ nhớ GPU/heap, rò rỉ khi chuyển màn, kích thước/nén GLB, KTX2). Luôn đo trước–sau bằng script trong scripts/, sửa bottleneck lớn nhất trước, không đổi gameplay/UI/art. Dùng khi người dùng gõ /threejs-h5-performance-engineer [audit|render|memory|assets|mobile|<cảnh>] hoặc hỏi game có lag/nặng/tốn RAM/tải chậm không.
---
Kỹ sư tối ưu Three.js cho game H5 chạy điện thoại. Nguyên tắc số một: **không có số đo thì không có cải thiện**.

## 0. Luật cứng
- Lần gọi skill này = người dùng yêu cầu đo, nên được mở dev server và trình duyệt để đo trong lượt đó (ngoại lệ của AGENTS.md). Hết lượt thì quay về mặc định "người dùng tự test".
- Không đổi luật chơi, UI, bố cục, art direction; không xoá/giảm hiệu ứng, bóng, độ nét để lấy FPS khi chưa có số đo chứng minh cần, và khi giảm thì chỉ giảm ở preset thấp.
- Mỗi thay đổi: đo trước → sửa một việc → đo sau cùng điều kiện → ghi bảng. Không gộp nhiều tối ưu vào một lần đo.
- Không có thiết bị thật thì ghi rõ: "đo trên Chrome desktop giả lập viewport + CPU throttle; GPU là GPU máy Mac, không đại diện GPU điện thoại".
- Dừng chờ người dùng duyệt plan trước khi sửa code (CLAUDE.md). Không tự thêm test (dự án cấm); chạy test sẵn có chỉ khi người dùng yêu cầu.
- Thêm dependency (glTF Transform, meshoptimizer, KTX tools) là việc cần người dùng `ok`.

## 1. Bản đồ dự án (đọc trước khi sửa)
| Việc | File |
|---|---|
| Renderer, render loop, chuyển màn, auto hạ quality, `?fps` meter | `src/app/game.js` |
| Preset LOW/MEDIUM/HIGH (pixelRatio, shadows, particles, outline), `applyRendererQuality`, VFX pool | `src/shared/vfx/index.js` |
| Chọn quality, `lowerQuality()` (chỉ hạ, không lưu) | `src/ui/settings.js` |
| Tải GLB có cache theo URL, `dressSlot`, `attachModels` | `src/shared/three/models.js` |
| Giải phóng scene | `src/shared/three/dispose-scene.js` |
| Scene chung heaven/farm/cafe (đèn, shadow 1024, label CanvasTexture, va chạm) | `src/shared/world/scene.js` |
| Gộp mesh farm (merge theo material, collider vô hình) | `src/features/farm/environment.js` |
| Intro: bounding box chính xác từng đỉnh của nhân vật skinned (`getCharacterBounds`, `setFromObject(x, true)`) rất đắt — chỉ gọi khi kết quả được dùng | `src/features/intro/scene.js`, `src/characters/bounds.js` |
| Model: `public/models/**.glb` (Meshy → Blender → GLB, xem `docs/asset-pipeline.md`, agent `asset-3d`) |

Đã có sẵn, đừng viết lại: preset quality, auto hạ quality khi < 25 fps trong 2 s, dừng loop khi tab ẩn, `compileAsync` trước khi vào cảnh, cache GLB, merge mesh tĩnh farm, VFX pool Points + giới hạn hạt theo preset, collider `visible:false` (không tốn draw call).

## 2. Đo (bắt buộc trước mọi sửa)
Công cụ: MCP `chrome-devtools` (có CPU throttle, viewport mobile, heap snapshot). Pane trình duyệt nội bộ dừng rAF khi bị ẩn nên không dùng để đo FPS.

1. `preview_start {name:"game"}` (port 5173).
2. `emulate`: `viewport "390x844x3,mobile,touch"` (iPhone) hoặc `"412x915x2.625,mobile,touch"` (Android), `cpuThrottlingRate 4`.
3. `navigate_page` tới `http://localhost:5173/?fps` với `initScript` = nội dung `scripts/bench-init.js` (phải gắn lại ở mỗi lần navigate; reload thường làm mất). Script đếm draw call, tam giác, texture/buffer/program/framebuffer đang sống và có `__bench(giây)`.
4. Vào thẳng cảnh bằng localStorage `cog-coffee-progress`:
   - Thiên đàng: `{version:1,chapter:2,introCompleted:true}`
   - Nông trại: `{version:1,chapter:3,introCompleted:true,heaven:{completed:true,gift:'capital'},startingGift:'capital'}`
   - Chọn nhân vật / Intro: `localStorage.clear()`; Intro bắt đầu bằng `document.getElementById('player-form').requestSubmit()`.
   - Quán: từ farm bấm `[data-shortcut="cafe-play"]`; ra bằng nút "Nông trại". Prompt bài học có nút "Để sau" chặn luồng.
5. Chờ cảnh ổn định 3–4 s rồi `await __bench(8)` → `fpsAvg, fps1Low, p95ms, drawCalls, triangles, longTasks, heapMB, gpu{tex,buf,prog,fb}`.
6. Thời gian CPU mỗi frame (FPS bị vsync khoá 60 nên phải đo riêng): `await __cpu(5)` → median/p95. Cảnh nặng thì `performance_start_trace {reload:false, autoStop:false}` → `performance_stop_trace {filePath}` rồi `python3 -I scripts/tracetop.py trace.json [từGiây tớiGiây]` ra hàm tốn CPU nhất. Intro chạy theo thời gian (~22 s) nên đo ngay sau khi bấm vào màn, đừng đo trễ.
   Đang đo mà có người sửa file trong `src/` thì Vite tải lại trang, mất `initScript`: kiểm tra `window.__gl` trước khi tin số.
7. Rò rỉ: 1 vòng khởi động → heap snapshot A → 10 vòng chuyển màn → snapshot B (snapshot tự ép GC). File snapshot phải nằm trong workspace (vd. `node_modules/.perf/`, xoá sau). So bằng `python3 -I scripts/heapdiff.py A B`. Đạt khi số Mesh/Material/Texture/Group không tăng và `gpu.tex/buf` không tăng qua các vòng (nhân vật quán được `keepOnGPU` giữ lại có chủ đích sau lần vào quán đầu: +27 tex/+411 buf, không phải rò).
8. Asset: `python3 -I scripts/glbinfo.py public/models/**/*.glb` → KB, KB ảnh, tam giác, extension, loại ảnh.

Ghi kết quả vào bảng (mỗi cảnh một dòng): FPS TB · 1% low · p95 ms · CPU ms/frame · draw · tris · heap MB · tex/buf/prog.

## 3. Thứ tự ưu tiên khi sửa
Chọn theo số đo, không theo danh sách. Gợi ý theo chi phí/lợi ích cho dự án này:
1. **Asset**: ĐÃ LÀM (2026-11-04) — mọi GLB nén meshopt bằng `scripts/optimize-models.mjs`, nạp qua `gltfLoader` chung trong `src/shared/three/models.js` (có `MeshoptDecoder`); không tạo `new GLTFLoader()` riêng. Chế độ mặc định **không quantize POSITION**: quantize vị trí ghi scale/offset vào transform node, làm hỏng code chép `.geometry` từ node GLB sang mesh khác (`farm/props.glb` marker/weeds/blossoms, `cafe/props.glb` cup/cushion), `position.set` lên node `cafe/fixtures.glb`, và đọc đỉnh theo mét ở `selection/scene.js`. Chỉ dùng `--full` khi đã sửa hết các chỗ đó. Kiểm tra sau nén: so tên node/transform/animation/vật liệu/số tam giác + `scripts/imgdiff.py` ảnh trước/sau. Texture: thử KTX2 (UASTC cho nhân vật, ETC1S cho môi trường) cần `KTX2Loader` + transcoder basis trong `public/`; so VRAM và chất lượng ảnh trước khi chốt. Texture 2048 của nhân vật chính là ứng viên đầu tiên.
2. **Render**: instancing cho vật lặp *khi* draw call là bottleneck; shadow map chỉ cập nhật khi cần nếu cảnh tĩnh; giới hạn shadow caster; transparency sắp xếp ít lớp chồng.
3. **Adaptive DPR có hysteresis**: hiện chỉ hạ một chiều (`lowerQuality`). Thêm tăng lại chỉ khi có số đo cho thấy máy dư nhiều (p95 < ~12 ms trong 10 s) và không bao giờ vượt mức người chơi chọn.
4. **Memory**: AssetManager đếm tham chiếu chỉ cần khi heap diff cho thấy rò; hiện `loadModel` cache + `disposeScene` (dispose GPU, cache CPU giữ lại để vào lại nhanh).
5. **Mobile**: kiểm tra `visibilitychange` dừng loop, chạy lâu 10 phút xem heap sawtooth và alloc/giây.

Không làm: chunk/LOD cho bản đồ chỉ ~50×50 m với camera trực giao chưa có số đo vượt ngân sách; xoá hiệu ứng; đổi preset mặc định của người chơi.

## 4. Ngân sách tham chiếu (máy tầm trung)
Draw call ≤ 150 · tam giác ≤ 300k · frame CPU ≤ 8 ms (đo ở throttle 4x) · VRAM texture mỗi cảnh ≤ ~64 MB · tải một cảnh ≤ 5 MB · heap ổn định sau 10 lần chuyển màn.

## 5. Kiểm tra sau tối ưu asset
- Đổi file GLB → so ảnh chụp trước/sau cùng góc camera ở mỗi cảnh có model đó (`take_screenshot`), kiểm tra animation (nhân vật đi/đứng), UV/vật liệu, tên node mà code tìm.
- Đo lại bảng ở mục 2.

## 6. Báo cáo
Tiếng Việt, ngắn: bảng trước/sau, việc đã làm (file), giới hạn đo (thiết bị, GPU, mạng), việc chưa làm và lý do. Không viết "cải thiện" nếu không có cặp số trước–sau.
