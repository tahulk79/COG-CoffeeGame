# Progress — checkpoint khôi phục

Cập nhật: 2026-11-03 05:15. Phạm vi người dùng chốt: thay toàn bộ từ màn chọn nhân vật tới màn quán; toàn quyền, hết credit Meshy thì dựng free (Blender thủ tục).

## Trạng thái nhanh

- Phase hiện tại: 03–05 (farm, quán, NPC) song song; 02 (Màn 1, thiên đàng) phần lớn xong.
- Credit Meshy: **392 / 922 còn lại** (đo bằng API `/openapi/v1/balance`). Giá thật: text-to-3D có texture 30, rig 5.
- Server dev: `.claude/launch.json` tên `game` (port 5173).

## Đã xong và kiểm trong game

| Task | Asset / file | Kiểm chứng |
|---|---|---|
| P01-well | `public/models/farm/well-tier-1.glb` (thủ tục) | farm-preview |
| P02-reaper | `public/models/heaven/reaper.glb` → `intro/reaper`, `heaven/reaper` | Màn 1 + thiên đàng |
| P02-gods | `heaven/growing|brewing|business|clerk.glb` (thần Meshy + bàn thủ tục) | thiên đàng |
| P02-portal | `heaven/portal.glb` (3 node) → khung + 2 cánh cổng trùng sinh | thiên đàng |
| P02-skygate | `intro/sky-gate.glb` (3 node) → cổng trời Màn 1 | chưa chụp tới đoạn cổng |
| P02-street | `intro/shops.glb` (14 nhà ống, 2 mẫu Meshy), `intro/trees.glb` (thủ tục) | Màn 1 |
| P02-vehicles | `intro/ambulance.glb`, `intro/bicycle.glb` | Màn 1 (xe cứu thương); xe đạp chưa chụp |
| P03-grinder | `farm/grinder-tier-1.glb` | farm-preview |
| P04-counters | `cafe/register-counter.glb`, `pickup-counter.glb`, `kiosk.glb` + slot con `cafe/register/counter-<i>`, `cafe/pickup/counter`, `cafe/kiosk/unit-<i>` (giữ bật/tắt nâng cấp) | quán: thu ngân hiện, ô chưa mua vẫn là viền trống |
| P05-npc | `farm/worker.glb`, `cafe/guest-m.glb`, `cafe/guest-f.glb`, `cafe/staff.glb` (Meshy + rig API, clip Walking) qua `src/characters/npc.js` `dressPerson()` | quán: khách nữ rig đi tới quầy |
| P11-selection-stage | `selection/stage.glb` (T) trong `src/features/selection/scene.js` | màn chọn nhân vật |
| P03-surroundings | `farm/surroundings.glb` (T, gộp 1 mesh, không đổ bóng), slot mới `farm/surroundings` | farm-preview: tải 200 OK |
| P02-heaven-bg | `heaven/surroundings.glb` (T), slot mới `heaven/surroundings` trong `src/shared/world/scene.js` | thiên đàng |
| P03-fruit-green | bản sao `fruit_ripe` tô xanh trong `src/features/farm/assets.js` | code |
| QA-portrait/landscape | Thiên đàng 390×844 và 844×390: không tràn UI; nhãn "CỔNG TRÙNG SINH" nâng lên 5,9 để không bị vòm mới che | ảnh chụp |
| FIX-cafe-player | Quán dùng GLB nhân vật đã chọn (`enterCafe` tải `playerModel(profile.gender)`, truyền `character` vào `createCafeGame`) thay khối `createPerson` | quán: nhân vật nam đi lại được |
| FIX-worker-legs | `dressPerson` coi là "đi" chỉ khi góc chân đổi giữa 2 khung (code cũ để nguyên góc bước cuối lúc làm việc) | code |
| FIX-tab-drag | Farm/quán xoá trạng thái kéo camera khi `blur`/`visibilitychange` (pointerup rơi vào tab khác làm camera trôi, nuốt cú bấm) | giả lập ẩn/hiện 15 s: 60 FPS, không long task; đổi tab thật chưa thử được |
| P12-player-tex | `male.glb` 21,5 → 2,7 MB, `girl.glb` 25,5 → 2,9 MB (texture JPEG, rig/anim giữ nguyên; gốc ở `assets-src/original/`) | màn chọn nhân vật |

## Nhật ký Meshy (resume bằng `generate_3d(job=...)` không trả tiền lại)

| Job | Asset | Credit |
|---|---|---|
| t2r 01a19e2c-5a7a-734d-b090-06d5deffe0f6 | Thần Chết | 30 |
| t2r 01a19e2f-dfb2-7545-bbfc-6b24f7a9cb51 | Thần Nông | 30 |
| t2r 01a19e32-8d4e-7491-a8e6-d9c9f762d70c | Thần Pha Chế | 30 |
| t2r 01a19e33-4d49-77dd-8e1e-c24aa9989068 | Thần Thương Hội | 30 |
| t2r 01a19e33-ee1a-76cd-819a-da02b77fe98a | Thần Tiếp Nhận | 30 |
| t2r 01a19e3d-2b31-7247-8718-94d5b0671a0b | Xe cứu thương | 30 |
| t2r 01a19e41-01d3-7449-9205-578c1ddcaac9 | Xe đạp + người lái | 30 |
| t2r 01a19e41-c7b5-7540-8e7a-03ff4d5401c9 | Máy xay tier-1 | 30 |
| t2r 01a19e42-afaa-70e5-81f2-bf4e0ba2e098 | Nhà ống A | 30 |
| t2r 01a19e42-cd98-7494-aa0e-92cb18e78b24 | Nhà ống B | 30 |
| t2r 01a19e42-ead5-7022-bffc-58e0f488e402 | Quầy thu ngân | 30 |
| t2r 01a19e43-0825-740b-ad0a-9780918aad7e | Quầy nhận đồ | 30 |
| t2r 01a19e43-251f-701c-b965-5649a2b8d6e5 | Kiosk | 30 |
| t2r 01a19e4d-c48d-7230-8a2b-fad53cb4218f | Thợ farm (A-pose) | 30 |
| t2r 01a19e4d-e341-768a-8b25-5862b89f2b02 | Khách nam | 30 |
| t2r 01a19e4e-0018-77b5-9912-32c4c0e6b112 | Khách nữ | 30 |
| t2r 01a19e4e-1d3d-761f-8c3d-2f3727d2f654 | Nhân viên quán | 30 |
| rig 01a19e4f-894f-761d-9515-444f53ec2dec | rig thợ | 5 |
| rig 01a19e51-01ce-7135-8451-9fd313c362b8 | rig khách nam | 5 |
| rig 01a19e51-44d1-752b-97a8-ee9232b0835e | rig khách nữ | 5 |
| rig 01a19e51-883b-765d-8e41-4de87a83fe06 | rig nhân viên | 5 |

## Quy trình (Blender, hàm trong `bpy.app.driver_namespace` — mất khi tắt Blender, viết lại theo mô tả)

- `cog_full(raw, final, tris, scale|height)`: gộp đỉnh trùng → pivot tâm đáy → bản low-poly decimate → UV mới + bake diffuse từ bản gốc (Cycles). Dùng cho mọi model Meshy (decimate trực tiếp làm vỡ UV).
- `cog_export(objs, path)`: validate mesh, xuất từ scene tạm, JPEG 85.
- Rig: API Meshy giới hạn 380k tris → gửi bản low-poly đã bake qua `model_url` data URI (`POST /openapi/v1/rigging`), tải `basic_animations.walking_glb_url`.
- `generate_3d` chỉ chạy được khi đang ở scene `gen_reaper` (cài đặt Meshy của addon lưu theo scene).
- Metallic ≤ 0,15 (cảnh không có env map nên kim loại bị đen).
- Hướng model: kiểm bằng `look` view `right`; xoay bằng `mesh.transform` sau khi bake (xoay object trước apply không ăn).
- Script nén texture GLB không đụng rig: scratchpad `recompress-glb.mjs` (chỉ dùng cho texture > 1024; nếu file ra lớn hơn thì giữ bản gốc).

## Code đã sửa

- `src/shared/three/models.js` (mới): `loadModel('file.glb#node')`, `attachModels(target, slots)`.
- `src/characters/npc.js` (mới): `dressPerson(person, file)` — rig GLB thay khối `createPerson`, đọc `userData.legs`/`userData.seated` để chọn đi/đứng/ngồi; animation chỉ chạy khi được vẽ.
- `src/app/game.js`: `INTRO_MODELS`.
- `src/features/heaven/game.js`: `HEAVEN_MODELS`.
- `src/features/farm/assets.js`: thêm `well`, `grinder`.
- `src/features/farm/crew.js`: `dressPerson(group,'farm/worker.glb')` (file này có thay đổi chưa commit của người dùng, chỉ thêm 2 dòng).
- `src/features/cafe/game.js`: slot con quầy, `attachModels` quầy, `dressPerson` khách/nhân viên, cờ `seated`.

## Test

- `node --test tests/*.test.js` (05:16): 24/32 pass; 8 fail giống hệt trước khi sửa (#7, 8, 10, 15, 16, 17, 18 luật farm/nhân viên; #26 thiếu canvas 2D trong Node). Không hồi quy.
- `npm run build` (05:17): OK; cảnh báo chunk 701 kB có sẵn.

## Việc kế tiếp

1. Chạy lại test + build.
2. Farm thủ tục: luống (`farm/plot-*/bed`), rào/cổng ruộng, đường, ao, ranh giới; `fruit_green` cho cây.
3. Quán: phòng (`cafe/room`) — sàn, tường, cửa sổ, kệ; quầy pha chế.
4. Màn chọn nhân vật: sân khấu 3D nền.
5. Thiên đàng: nền mây/đường, trang trí.
6. Ánh sáng/vật liệu thống nhất, VFX rà soát, QA 3 kích thước màn hình, đo FPS.
7. Còn credit (392): tier 2–5 công trình farm, y tế (nếu thay được IK), thùng/bao hạt, quầy pha chế.

## Rủi ro

- Xe cứu thương có logo xe thật + biển số nhỏ ở đuôi (từ Meshy); camera Màn 1 nhìn bên hông. Cần xoá trên texture.
- Khách/nhân viên đứng ở tư thế bind (A-pose) khi không đi — rig Meshy không có clip idle.
- Thần Tiếp Nhận hơi gãy khối sau giảm poly (11k tris) — chấp nhận ở góc camera isometric.
- Lưu `.blend` checkpoint lỗi (texture tạm Meshy); GLB là sản phẩm.
