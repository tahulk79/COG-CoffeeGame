# 08 · Bộ nhớ, rò rỉ và render — phân tích tĩnh

> **Phạm vi:** chỉ đọc code (three 0.185.1, nhánh `audit/game-studio-playtest-optimization`, working tree gồm cả thay đổi chưa commit). **Chưa chạy runtime.** Mỗi mục dưới đây là giả thuyết có dẫn chứng `file:line`; phải có heap snapshot / `__bench` / GPU memory xác nhận mới được coi là lỗi thật. Số MB VRAM/RAM là **ước lượng** (RGBA8 + mipmap = w·h·4·4/3, chưa tính nén GPU).
> Bằng chứng thô: `production/audit/evidence/asset-render-static/` (glbinfo.txt, texture-dims.txt, scene-totals.txt).

## 1. Đã kiểm chứng là ổn (không cần sửa)
| Hạng mục | Bằng chứng |
|---|---|
| Chỉ một vòng render 3D | `renderer.setAnimationLoop` chỉ ở `src/app/game.js:84,105,200,225,272`; quán vẽ qua getter `scene/camera` của farm (`src/features/farm/game.js:793`). `requestAnimationFrame` ở `cafe/bench.js:271` là minigame DOM, có `cancelAnimationFrame` (`bench.js:88,218,312`). |
| Dừng loop khi ẩn tab | `src/app/game.js:269-273`; audio suspend `src/shared/audio/index.js:44-47`. |
| Listener gỡ khi đổi màn | Mọi listener `document/window` của màn dùng `AbortController`: farm `farm/game.js:39,620-650` + `events.abort()` ở `:863`; heaven `heaven/game.js:194-219`, `heaven/ui.js:9,174`; cafe `cafe/game.js:428,444,614-637`; farm UI `farm/ui.js:18`; hud-drawer, joystick, lesson-prompt nhận `signal`. Cafe debug gỡ tay `cafe/debug.js:111-113`. Listener toàn cục cố ý sống suốt phiên: `app/game.js` (cả app), `shared/audio/index.js:42-55`, `ui/dialogue.js:6`. |
| Badge canvas không vẽ lại mỗi frame | Có khoá `badgeKey`: `shared/world/scene.js:390-395,409-411`; bong bóng NPC quán `cafe/game.js:481-482`. |
| VFX dùng pool | 11 `Points` cố định, ẩn khi rỗng, giới hạn hạt theo preset: `shared/vfx/index.js:49,101-117,121,221`; dispose đủ geometry/material/texture `:232-241`. |
| Có dispose cho mọi màn | selection `selection/scene.js:259`, intro `intro/scene.js:449-453`, heaven `heaven/game.js:279`, farm `farm/game.js:863`, cafe `cafe/game.js:688-692`, world chung `shared/world/scene.js:773` (kèm `sun.shadow.dispose()`). Khách/nhân viên quán rời đi được `disposeScene` (`cafe/game.js:532,552`). |
| Ẩn mesh bằng material vô hình | `dressSlot` dùng `MeshBasicMaterial({visible:false})` (không tốn draw call) `shared/three/models.js:35-44`; vòng focus opacity 0 cũng `visible=false` `shared/world/scene.js:512`. |

## 2. Nghi vấn bộ nhớ / rò rỉ
| ID | Mức | Nghi vấn | Bằng chứng | Cách xác nhận runtime |
|---|---|---|---|---|
| M1 | P2 | **ImageBitmap không được `close()`** khi dispose. GLTFLoader nạp ảnh bằng `ImageBitmapLoader` và ghi chú rõ bitmap "not automatically GC-collected… require special handling" (`node_modules/three/examples/jsm/loaders/GLTFLoader.js:80-82,2600-2606`). `disposeScene` chỉ gọi `texture.dispose()` (`src/shared/three/dispose-scene.js:31`). | Model nạp **không cache** rồi bị dispose: nhân vật chính `loadPlayer` (`characters/load-player.js:7`) được gọi ở selection ×2 giới tính (`selection/scene.js:12-13`), heaven (`heaven/game.js:24`), farm (`farm/game.js:34`), quán (`farm/game.js:778`) → tối đa 5 lần/phiên; máy pha + bàn quán (`cafe/game.js:314-322`). Ảnh nhân vật 2048²+1024² ≈ 20 MB giải nén/lần (**ước lượng**) → tới ~100 MB nếu bitmap thật sự không được thu. | Chrome Task Manager (cột GPU/Image memory) hoặc `performance.measureUserAgentSpecificMemory` qua 1 vòng selection→intro→heaven→farm→quán; so trước/sau khi thêm `texture.image?.close?.()` trong `disposeScene` (chỉ cho texture không `keep` và không thuộc cache). |
| M2 | P2 | **Farm và quán cùng nằm trên GPU** sau lần vào quán đầu, và nhân vật chính có **2 bản riêng** (farm + quán). | `cafeKept` giữ đến khi farm dispose (`farm/game.js:770-786,863`); `cafeCharacter` nạp lại GLB (`farm/game.js:778`). Ước lượng texture: farm ~60 MB + quán ~95 MB, trong đó nhân vật ~26.7 MB × 2 (`evidence/.../scene-totals.txt`). | `__bench` ở farm trước/sau lần vào quán đầu: `gpu.tex`, VRAM. Cần **quyết định thiết kế**: đổi lấy vào lại quán tức thì. Tối thiểu: dùng chung texture nhân vật (SkeletonUtils.clone từ một nguồn) thay vì nạp lại. |
| M3 | P3 | **Cache CPU giữ asset của màn không bao giờ quay lại.** Luồng một chiều selection→intro→heaven→farm, nhưng `loadModel` cache theo URL suốt phiên (`shared/three/models.js:8,21-30`) và `dressPerson` cache medic intro / worker (`characters/npc.js:7,23`). | Ảnh còn giữ trong cache sau khi rời màn (đếm từ texture-dims): selection stage 1 ảnh 1024 + 1 ảnh 512; intro reaper 3, ambulance 1, bicycle 1, shops 2, medic 2; heaven surroundings 1, growing 3, brewing 3, business 1, clerk 1 → ~20 ảnh 1024² ≈ 80 MB bitmap giải nén (**ước lượng**, nếu ImageBitmap còn sống). | Heap snapshot sau khi vào farm: đếm `ImageBitmap`, `Texture`, `BufferGeometry` thuộc file intro/heaven. Hướng sửa: `clearModelCache(prefix)` khi rời intro/heaven (cần ok, đụng `models.js`). |
| M4 | P3 | Nhân vật quán `keepOnGPU` giữ vĩnh viễn (cố ý, đã ghi ở SKILL: +27 tex/+411 buf). | `characters/npc.js:23`, `shared/three/dispose-scene.js:3-13`. | Không phải rò; chỉ cần ghi vào ngân sách VRAM quán. |
| M5 | P4 | Khối tạm bị thay được dời vào nhóm ẩn `retired-assets`, sống tới khi scene dispose. | `shared/world/scene.js:35,737`. | Nhỏ (geometry dùng chung). Không ưu tiên. |

## 3. Nghi vấn hiệu năng render / CPU
| ID | Mức | Nghi vấn | Bằng chứng | Ghi chú |
|---|---|---|---|---|
| R1 | P2 | **48 cây cà phê clone riêng**, mỗi cây 4 048 tam giác, 3 mesh, đều **đổ bóng**. Đủ 48 ô có cây → ~194k tam giác + lặp lại trong shadow pass, ~144 draw call (+ bóng) — **ước lượng**, chưa đo. | 48 ô: `farm/content.js:27,37` (4 field × 12); clone mỗi ô `farm/assets.js:32-39`; `replaceAsset` bật `castShadow=true` cho mọi mesh `shared/world/scene.js:738`; tam giác `glbinfo.txt` (farm/coffee-tree). | Ứng viên `InstancedMesh` hoặc tắt bóng cây ở preset medium — chỉ làm khi `__bench` farm cho thấy draw/tris vượt ngân sách (150 draw / 300k tris). |
| R2 | P3 | Shadow map vẽ lại **mỗi frame**: không chỗ nào đặt `shadowMap.autoUpdate=false`; PCF 1024 ở heaven/farm/cafe (`shared/world/scene.js:25`), intro (`intro/scene.js:58`), selection (`selection/scene.js:31`). Preset medium (mặc định trên máy cảm ứng, `state/progress.js:67-70`) vẫn bật bóng (`shared/vfx/index.js:6`). | `grep autoUpdate src` = 0 kết quả. | Cảnh có người di chuyển nên vẫn cần cập nhật; chỉ tối ưu (giảm caster, cập nhật 30 Hz) khi trace cho thấy shadow pass đáng kể. |
| R3 | P3 | **Cập nhật skeleton 2 lần/frame.** Code tự gọi `skeleton.update()` trước render, trong khi WebGLRenderer đã tự update mỗi skeleton một lần mỗi frame. | `shared/world/scene.js:537`, `intro/scene.js:436-438`; three `src/renderers/webgl/WebGLObjects.js:46-55`. | Rẻ với 1–3 nhân vật; kiểm tra không có code đọc `boneMatrices` giữa update và render trước khi bỏ. |
| R4 | P3 | **Cấp phát trong vòng frame (intro):** `new THREE.Vector3()` mỗi medic mỗi frame `intro/scene.js:362`; `crouchMedic`/`gripStretcher` tạo ~8 Vector3/medic/frame `intro/rescue.js:17-21,31-49`. Farm: mảng + `filter` mỗi frame `farm/game.js:799`. | Như cột trái. | Intro chỉ ~22 s; ảnh hưởng là GC nhỏ. Sửa bằng biến tạm dùng lại — rủi ro thấp. |
| R5 | P3 | **`rebuildColliders()` chạy ngay mỗi lần `replaceAsset`** — mỗi lần traverse toàn scene + `Box3.setFromObject`. Farm gọi ~48 (cây) + 15 (tier trạm) + các slot khác lúc tải → O(slot × mesh). | `shared/world/scene.js:314-336,739`; farm `farm/assets.js:32-52`. Đã có cờ lười `collidersDirty` xử lý ở `update()` `:426` và `prepareNavigation()` `:559`. | Giật lúc tải, không phải lúc chơi. Đổi `rebuildColliders()` trong `replaceAsset` thành `collidersDirty=true` — cần đo thời gian tạo farm trước/sau. |
| R6 | P3 | **Raycast đệ quy cả scene gồm SkinnedMesh** khi bấm: decoration builder `farm/decoration-builder.js:83` (`world.scene.children`, true); pick nhân vật selection `selection/scene.js:222`; pick nhân viên quán `cafe/game.js:645`. Raycast SkinnedMesh tính bone transform từng đỉnh trên CPU (~10k tam giác/người). | Như cột trái. | Chỉ chạy khi click, không chạy theo `pointermove`. Ưu tiên thấp. |
| R7 | P4 | `pointermove` không throttle nhưng chỉ làm việc khi đang kéo; mỗi lần gọi `getBoundingClientRect()` + tạo `Vector2/Vector3` mới trong `panCamera`. | `farm/game.js:627-633`, `heaven/game.js:202-208`, `cafe/game.js:616`, `shared/world/scene.js:743-750`. Decoration `locate` chỉ cắt mặt phẳng `farm/decoration-builder.js:89-95`. | Chấp nhận được. |
| R8 | P4 | Selection ghi 4 CSS custom property mỗi frame dù không đổi → style recalc. | `app/game.js:141-145`. | So giá trị cũ trước khi ghi nếu trace thấy Recalculate Style. |
| R9 | P4 | Plot `setState` traverse cây mỗi lần refresh (2 Hz × 48 ô). | `farm/environment.js:90`, gọi từ `refresh` (`farm/game.js:559`, chạy 2 Hz ở `:833`). | Nhỏ. |

## 4. pixelRatio / renderer
- DPR bị chặn theo preset: low 1, medium 1.25, high 1.5 (`shared/vfx/index.js:5-7,21-24`). MSAA tắt trên màn cảm ứng DPR ≥ 2 (`app/game.js:170-171`). Auto hạ quality một chiều khi < 25 fps trong 2 s (`app/game.js:50-58`, `ui/settings.js:124-128`).
- Bật/tắt bóng đánh dấu `needsUpdate` mọi material → biên dịch lại shader (đã ghi chú, `shared/vfx/index.js:28-32`).
- Quán không qua `renderer.compileAsync` (chỉ có ở `app/game.js:77,98,194,218`) → lần đầu vào quán có thể khựng biên dịch shader (**AI heuristic**, cần trace).

## 5. Việc cần runtime xác nhận (theo thứ tự)
1. M1 + M2: đo bộ nhớ ảnh/GPU qua một phiên đầy đủ (selection→farm→quán→farm).
2. R1/R2: `__bench` farm với 48 ô có cây (draw, tris, CPU ms).
3. M3: heap snapshot sau khi vào farm, đếm object của intro/heaven.
4. R5: thời gian `createFarmGame` (performance mark).

_Không kiểm tra: GPU điện thoại thật, Safari/iOS (ImageBitmap path khác: Safari < 17 dùng TextureLoader), dung lượng sau gzip/brotli._

## Runtime (heap/GPU qua các vòng)

> **Đo trên Chrome desktop (Mac) giả lập viewport/CPU throttle; không phải thiết bị di động thật.** Chrome 156 riêng qua CDP (MCP chrome-devtools không khởi động được), `bench-init.js` đếm đối tượng WebGL. Heap đo sau `HeapProfiler.collectGarbage`. So snapshot bằng `heapdiff.py`; snapshot đã xoá khỏi `node_modules/.perf/`, kết quả giữ ở `evidence/perf/heapdiff-*.txt`. Số thô: `evidence/perf/raw-results.json`.

Quy trình: farm (fixture mở khoá) → 1 vòng farm→quán→farm → snapshot A → 10 vòng farm→quán→farm (tap thật «Vào quán» / «Nông trại», chờ 1.5 s mỗi màn, GC + đọc `__gl` mỗi màn) → snapshot B.

| Lượt | Điều kiện | gpu tex qua 10 vòng | gpu buf | heap sau GC | heapdiff B−A | Mesh / MSMaterial / Group / CanvasTexture / SkinnedMesh / AnimationMixer |
|---|---|---|---|---|---|---|
| Mobile 390×844, 4× | quán **đang mở** (khách ra vào) | 54 → 55 → 56 … 57 | 618 (không đổi) | 46.8 → 47.3 MB | +0.68 MB | 3154→3165 / 288→293 / 1153→1158 / 284→285 / 11→12 / 9→10 |
| Desktop 1280×720, 1× | quán **đóng** | 64 (không đổi) | 709 → 713 (+4 ở vòng 7, sau đó đứng) | 46.4 → 46.7 MB | +0.27 MB | 3132 / 278 / 1143 / 282 / 9 / 7 — **không đổi** |

Kết luận:
- **Không thấy rò khi chuyển farm↔quán** ở lượt quán đóng: Mesh/Material/Group/Texture không tăng, gpu tex không tăng (đạt tiêu chí SKILL §2.7). +4 buffer một lần, chưa rõ nguồn.
- Lượt quán mở tăng nhẹ (+1 SkinnedMesh, +1 AnimationMixer, +5 Group, +3 tex) — khớp với **một vị khách nhiều hơn** đang có mặt lúc chụp B; không tăng theo số vòng (không +10). Chưa đủ để gọi là rò; cần lặp lại với số khách cố định nếu muốn chắc.
- **M2 xác nhận:** sau lần vào quán đầu, farm và quán cùng sống trên GPU. Mobile: farm một mình 24 tex / 203 buf → sau quán 51/610 và ở lại 54–57/618 khi đã về farm. Desktop: 32/303 → 64/709.
- Heap snapshot farm+quán: **CanvasTexture 282–285 đối tượng JS** trong khi chỉ 54–64 texture WebGL sống → phần lớn CanvasTexture chưa upload hoặc không hiển thị (nguyên nhân là **AI heuristic**, chưa truy).
- Modal Cửa hàng ×5: gpu tex/buf/prog không đổi (24/199/18 mobile, 32/303/18 desktop).
- M1 (ImageBitmap không `close()`), M3 (cache CPU của intro/heaven) **chưa đo** — luồng đo không đi selection→intro→heaven→farm trong cùng một trang.
