# Progress — checkpoint khôi phục

> **Lưu trữ.** Tài liệu lịch sử, có thể đã lệch code. Không dùng làm đặc tả; xem [docs/README.md](../../README.md) để tìm tài liệu hiện hành.

Cập nhật: 2026-11-03 17:00 (phiên 4: nền trong/ngoài map — đất có texture + cảnh nền Meshy). Phạm vi người dùng chốt: thay toàn bộ từ màn chọn nhân vật tới màn quán; toàn quyền, hết credit Meshy thì dựng free (Blender thủ tục).

## Trạng thái nhanh

- Phase hiện tại: 03–05 (farm, quán, NPC) song song; 02 (Màn 1, thiên đàng) phần lớn xong.
- Credit Meshy: **302 / 922 còn lại** (API `/openapi/v1/balance` lúc 14:48; session chính chạy 3 job phiên 3: cây chậu, tủ bánh, cây cà phê v2 bị loại). Giá thật: text-to-3D có texture 30, rig 5.
- Phiên 3 chưa chạy game/trình duyệt: mọi mục phiên 3 là `code`, cần người dùng kiểm trong game.
- Phiên 4: session chính chạy 8 job Meshy nền (8 × 30 = 240; lần đầu cây phố lỗi phía Meshy). Số dư cập nhật ở session chính. Chưa chạy game.
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
| P03-grounds | `farm/grounds.glb` (T): `paths` 3,4k, `boundary` 4,5k, `field_fence` 1,3k, `field_gates` 1,4k, `field_sign` 0,3k, `pond` 2,7k tris → `farm/paths`, `farm/boundary`, `farm/field-N/fence|gates|sign`, `farm/pond` qua `dressSlot` | code (chưa chạy game) |
| P03-tiers | `farm/<id>/tier-2..5` = tier-1 GLB + `farm/decor.glb#tier_<n>` (cột cờ, n−1 cờ màu bậc, 100–150 tris) | code |
| P03-props | `farm/props.glb` (T, có normal): `marker` (sao bậc), `fish`, `weeds`, `blossoms` → đổi geometry tại chỗ | code |
| P03-decor | `farm/decor.glb#decor_flowers|lamp|sign` (T, 1,1k/0,2k/0,2k) trong `decoration-builder.js`; biển giữ chữ canvas | code |
| P04-room | `cafe/room.glb` (T, 11,5k tris, 3 vật liệu: thường, đèn, kính) → `cafe/room` qua `dressSlot`, giữ biển/menu canvas | code |
| P04-fixtures | `cafe/fixtures.glb` (T): quầy pha 0,6k, trạm ×3 0,56k, máy phụ (steamer/mixer/v60/auto), kho 0,9k, bảng chữ A, biển mở rộng, thảm lối ra, sofa/đèn/hoa/bàn khóa của bàn | code |
| P04-props | `cafe/props.glb` (T, có normal): `cup` (ly + đĩa + cà phê), `cushion` → đổi geometry ly quầy trả/bàn bẩn/tay cầm, đệm | code |
| P04-bg | `cafe/surroundings.glb` (T, 11,8k tris, không đổ bóng): vỉa hè, đường, dãy nhà thấp, vườn phải, cây + mái nhà sau tường, đồi → slot mới `cafe/surroundings` | code |
| P02-plaza | `heaven/plaza.glb` (T, 12,3k): sân lát, lối viền vàng, đĩa thần, gò mây, đèn đá, lan can cổng → slot mới `heaven/plaza` (`scene.js`) qua `dressSlot` | code |
| P02-intro | `intro/street.glb` (T): `intro_road` 3,8k (vỉa hè gạch, bó vỉa, cột điện + dây), `warning_post`, `stretcher` (nệm cao .855, tay cầm ±1,2), `heaven_path` 5,4k → 4 slot Màn 1 | code |
| P04-plant | `cafe/plant.glb` (Meshy → cog_full: 1.416 tris, 512 JPEG, cao 1,2) ×6 vị trí `PLANTS` trong slot `cafe/room` | code |
| P04-pastry | `cafe/pastry-case.glb` (Meshy → cog_full: 4.802 tris, 1024 JPEG, 2 × 0,9 × 1,65, mặt trước +Z) tại (9,4; COUNTER_Z) trong slot `cafe/room`; vùng cản giữ đế + kính khối tạm. `cafe_room` bỏ cây/tủ thủ tục → 9,4k tris | code |
| P03-tree-v3 | `farm/coffee-tree.glb` thay bằng cây Arabica thủ tục (`build_tree.py`): thân thẳng, cành ngang mọc đối, dáng tháp, lá elip mũi nhọn rũ, chùm quả ở nách lá; node `tree` 2.128 + `fruit_ripe` 960 + `fruit_green` 960 = 4.048 tris, 88 KB, cao 1,39, tán Ø1,16. Bản Meshy cũ ở `assets-src/original/coffee-tree-meshy.glb` | code |
| P13-ground-bg | Phiên 4 (xem mục dưới): `farm/surroundings.glb`, `cafe/surroundings.glb`, `cafe/room.glb`, `heaven/surroundings.glb` | code (chỉ xem trong Blender bằng camera giả lập, chưa chạy game) |
| P12-player-tex | `male.glb` 21,5 → 2,7 MB, `girl.glb` 25,5 → 2,9 MB (texture JPEG, rig/anim giữ nguyên; gốc ở `assets-src/original/`) | màn chọn nhân vật |

## Inventory khối tạm (2026-11-03, phiên 3) — ưu tiên theo độ thấy trên điện thoại

A = chiếm khung hình / luôn thấy · B = thấy thường xuyên · C = nhỏ hoặc hiếm. Cách thay: `dress` = `dressSlot()` (giữ khối tạm làm va chạm vô hình, hình mới không chặn đường), `replace` = `replaceAsset`, `geo` = chỉ đổi geometry (giữ vật liệu/logic ẩn hiện).

| # | Cảnh | Vật / slot | Ưu tiên | Cách | Trạng thái |
|---|---|---|---|---|---|
| 1 | Chọn NV | (sân khấu, NV đã xong; halo/bụi là VFX) | — | — | xong |
| 2 | Màn 1 | `intro/street/road` (nền, đường, vỉa hè, vạch) | A | replace | xong (T) |
| 3 | Màn 1 | `intro/warning-sign/post` (biển giữ chữ) | B | replace | xong (T) |
| 4 | Màn 1 | `intro/stretcher` (tay cầm IK ±1,2; .9; ±.31) | B | replace | xong (T) |
| 5 | Màn 1 | `intro/heaven/path` (đường mây) | A | replace | xong (T) |
| 6 | Thiên đàng | sân, lối, đĩa đứng của thần, gò mây 2 bên, cột, tường cổng → slot mới `heaven/plaza` | A | dress | xong (T) |
| 7 | Farm | `farm/paths` | A | dress | xong (T) |
| 8 | Farm | `farm/boundary` | A | dress | xong (T) |
| 9 | Farm | `farm/field-N/fence`, `gates`, `sign` | A/B | dress | xong (T) |
| 10 | Farm | `farm/pond` (bờ, rào, nước) + cá | B | dress + geo | xong (T) |
| 11 | Farm | `farm/<id>/tier-2..5` | B (từ cấp 10) | replace (tier-1 GLB + cờ bậc) | xong (T) |
| 12 | Farm | `upgrade-markers`, `farm/upgrades/*` | C | geo (sao) | xong (T) |
| 13 | Farm | đồ trang trí `flowers`, `lamp`, `sign` | B | GLB trong `decoration-builder.js` | xong (T) |
| 14 | Farm | cỏ dại, hoa cà phê trên luống | C | geo | xong (T) |
| 15 | Farm | luống `farm/plot-*/bed` | A | — | giữ code: đã là đất bo góc, vật liệu đổi khô/ướt/khóa |
| 16 | Farm | nền cỏ, `field-N/terrain` | A | — | giữ: mặt phẳng màu, đổi kích thước theo ruộng |
| 17 | Farm | túi "sẵn sàng" + thanh tiến độ trên trạm | C | — | giữ: chỉ báo UI 3D |
| 18 | Farm | giàn giáo khi đang xây trang trí | C | — | giữ: trạng thái tạm thời |
| 19 | Quán | `cafe/room` vỏ (sàn, sân hiên, tường, cửa sổ, kệ, đèn) + đồ (tủ bánh, tự phục vụ, góc sofa, kệ sách, cây, bồn cây, cột đèn, dây xếp hàng) | A | dress (giữ biển chữ canvas) | xong (T); cây chậu là khối cầu thấp poly, ứng viên Meshy |
| 20 | Quán | quầy pha `cafe/bar/counter` + 3 trạm + máy phụ | A | dress | xong (T) |
| 21 | Quán | `cafe/pantry`, `board`, `terrace`, `roastery`, `exit` | B | dress | xong (T) |
| 22 | Quán | phụ kiện bàn: sofa (cấp 4), đệm (3), đèn (≥3), hoa (≥4), bàn khóa | B/C | dress + geo | xong (T) |
| 23 | Quán | ly (quầy trả, bàn bẩn, tay cầm) | B | geo | xong (T) |
| 24 | Quán | nền ngoài bản đồ → slot mới `cafe/surroundings` | A | dress, không đổ bóng | xong (T) |
| 25 | Quán | khung trống ô chưa mua (thu ngân 2, nhận đồ, kiosk) | C | — | giữ: dấu hiệu "mua ở đây" |
| 26 | Mọi cảnh | biển/menu chữ canvas, nhãn tên, vòng chọn, mũi tên dẫn | — | — | giữ: chữ phải đọc được / UI |
| 27 | Farm | quầy chợ, tiệm giống | — | — | đang ẩn trong gameplay |

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
| t2r 01a1a054-60cb-72e0-9ceb-e12bd8554b58 | Cây chậu quán → `cafe/plant.glb` | 30 |
| t2r 01a1a055-008c-7580-a73b-e3a706fe708e | Tủ bánh → `cafe/pastry-case.glb` | 30 |
| (session chính, job id chưa ghi) | Cây cà phê v2 — loại (bụi tròn kiểu cây ô rô trên một thân), đã xoá khỏi Blender | 30 |
| t2r 01a1a09e-8988-7032-adf8-00598b2b72de | Cụm cây che bóng farm → `bg_trees_s` | 30 |
| t2r 01a1a09f-55c4-7496-9a9d-e70400974441 | Nhà vườn farm → `bg_farmhouse_s` | 30 |
| t2r 01a1a09f-72b7-764a-aaa6-d9b1fb0427e5 | Đồi cà phê bậc thang → `bg_hill_s` | 30 |
| t2r 01a1a0a0-c9d9-7112-8adb-cdf6f009ac70 | Xe máy → `bg_scooter2` | 30 |
| t2r 01a1a0a1-6aa1-74b7-b642-38275f30b957 | Xe đẩy hàng rong → `bg_cart` | 30 |
| t2r 01a1a0a2-0b7f-71f3-836b-ff08183a3201 | Đảo mây → `bg_island_s` | 30 |
| t2r 01a1a0a2-abf2-71a0-94a5-f1752b6b9f1c | Bờ mây → `bg_cloud` | 30 |
| t2p 01a1a0b8-2942-7444-b7ab-17bc493a0c83 | Cây phố — lỗi phía Meshy | (theo session chính) |
| t2r 01a1a0bb-5755-7554-8128-c329f9d7f364 | Cây phố → `bg_street_tree_s` | 30 |

## Quy trình (Blender, hàm trong `bpy.app.driver_namespace` — mất khi tắt Blender, viết lại theo mô tả)

- `cog_full(raw, final, tris, scale|height)`: gộp đỉnh trùng → pivot tâm đáy → bản low-poly decimate → UV mới + bake diffuse từ bản gốc (Cycles). Dùng cho mọi model Meshy (decimate trực tiếp làm vỡ UV).
- `cog_export(objs, path)`: validate mesh, xuất từ scene tạm, JPEG 85.
- Rig: API Meshy giới hạn 380k tris → gửi bản low-poly đã bake qua `model_url` data URI (`POST /openapi/v1/rigging`), tải `basic_animations.walking_glb_url`.
- `generate_3d` chỉ chạy được khi đang ở scene `gen_reaper` (cài đặt Meshy của addon lưu theo scene).
- Metallic ≤ 0,15 (cảnh không có env map nên kim loại bị đen).
- Hướng model: kiểm bằng `look` view `right`; xoay bằng `mesh.transform` sau khi bake (xoay object trước apply không ăn).
- `cog_full`/`cog_export` viết lại thành file `assets-src/blender/cog_full.py` (decimate + smart UV + bake DIFFUSE màu từ bản gốc, pivot tâm đáy, scale theo (rộng, cao, sâu) Three; xuất JPEG; bỏ chọn ở scene gốc trước khi xuất vì vùng chọn lọt sang scene xuất).
- **Thủ tục (phiên 3)**: `assets-src/blender/cog_proc.py` (Builder: hộp/trụ/cầu/tròn xoay/đa giác theo toạ độ Three, màu đỉnh, 1 vật liệu `cog_vc` + `cog_glow` + `cog_glass`), `build_farm.py`, `build_cafe.py`, `build_bg.py`. Chạy: `exec(open(path).read(), {'EXPORT': True})` trong Blender → build + xuất. Namespace MCP không giữ biến giữa các lần gọi: mỗi lần phải `exec` lại `cog_proc.py`.
- Xuất không kèm NORMAL (`normals=False`): GLTFLoader tự bật `flatShading`, đỉnh dùng chung → file nhỏ ~4 lần (vd. rào 330 → 84 KB). Mesh đem đổi geometry vào vật liệu sẵn có của game (ly, đệm, sao, cá, cỏ, hoa) phải xuất `normals=True`.
- `dressSlot(slot, model, cast)` (`src/shared/three/models.js`): khối tạm đặc → vật liệu vô hình (vẫn là vùng cản, 0 draw call), khối trang trí/nhóm con thường → ẩn, biển chữ canvas (có `map`) và slot con giữ nguyên; model thêm vào với `nonSolid`. Dùng cho mọi vật mà mesh gộp sẽ làm hỏng vùng cản (rào, phòng, sân).
- Script nén texture GLB không đụng rig: scratchpad `recompress-glb.mjs` (chỉ dùng cho texture > 1024; nếu file ra lớn hơn thì giữ bản gốc).

## Phiên 4: nền trong map + cảnh nền (2026-11-03)

Người dùng: nền phải dùng Meshy, không dùng kiểu tạm. Thủ tục chỉ còn mặt đất (texture lặp + màu đỉnh), cỏ/hoa/đá, cột điện, rào, ghế; cây/nhà/đồi/mây/xe là Meshy.

| Cảnh | File → node | Tris | Ghi chú |
|---|---|---|---|
| Farm | `farm/surroundings.glb` → `farm_land` 4,8k (texture cỏ 512 × màu đỉnh: mòn quanh đường/trạm/cổng, đất ruộng, cỏ rậm chân rào, đường đất) + `farm_scenery` 1,6k (cỏ, hoa, đá) + `farm_meshy` 23,8k (atlas 1024: 3 đồi cà phê lún chân sau-trái, 10 cụm cây, nhà vườn trước-phải) | 30,2k, 1,9 MB, 3 draw call (bản cũ 14) | `farm_land` nằm y −0,001 trong map, nhận bóng; phần còn lại không đổ/nhận bóng |
| Quán | `cafe/surroundings.glb` → `cafe_land` 3,1k (texture grit 512: hẻm bê tông, vỉa hè gạch, đường nhựa có vạch + vạch qua đường, công viên) + `cafe_scenery` 2,7k (cột điện + dây, rào, ghế, bồn hoa, hàng rào xanh) + `cafe_meshy` 27,4k (atlas: nhà ống sau hẻm sau mặt +Z, mặt tiền z −24,5, cỡ 90% — lùi xa để không chiếm nửa khung camera quán, 7 nhà hẻm trái mặt +X — 2 mẫu của `intro/shops.glb`; 6 xe máy, xe đẩy, 3 cây phố) | 33k, 2,5 MB, 3 draw call (bản cũ 2) | vật cao phía trước/phải qua hàm `safe()` không che map |
| Quán | `cafe/room.glb` → `cafe_room` 12,1k (vữa vôi loang, mảng gạch trần sau quầy, dây đèn) + `cafe_floor` 0,3k (ván sàn, texture vân gỗ 512) | 12,4k, +1 draw call | |
| Thiên đàng | `heaven/surroundings.glb` → `heaven_sea` 1,2k (biển mây màu đỉnh) + `heaven_meshy` 24,8k (atlas: 5 bờ mây dẹt quanh sân, 3 đảo mây xa) | 26k, 1,5 MB, 2 draw call (bản cũ 9) | |
| Chọn nhân vật | `selection/stage.glb` → `selection_stage`: `stage_proc` 3,0k (hiên, lan can, ghế, dây đèn + bóng phát sáng, mặt cỏ phẳng sau lan can; 1 vật liệu palette PNG 8×1 + emissive) + `stage_farm` 7,3k (từ `farm_meshy`: 3 đồi cà phê scale 0,4 bỏ cây đỉnh, decimate 0,5×0,75; 4 cụm cây cao ~4 m hai bên x ±5,6…8,8) + `stage_plants` 5,7k (4 × `cafe/plant`: x −4,5/+4,6 z −0,5 trước; x −3,9 và +3,2 cạnh ghế, sát lan can) | 15,9k, 1,38 MB, 3 draw call (bản cũ 14 vật liệu) | Bỏ cây/chậu cà phê/đá/bao tải/đồi thủ tục. 0 credit. Chụp `look` camera giả lập (chưa có fog), chưa chạy game |

- Script: `assets-src/blender/build_farm_bg.py`, `build_cafe_bg.py`, `build_heaven_bg.py`, `build_cafe.py` (`ROOM_ONLY`), thư viện `env_lib.py` (noise, texture lặp FFT, vật liệu texture × màu đỉnh, `export_env` có extras/normal), `meshy_bg.py` (`shrink`, `build_atlas`, `merge_instances` cắt mặt ngoài vùng camera thấy), `preview.py` (dựng camera iso/phối cảnh giống game để `look`).
- `cog_full.py`: thêm `voxel=` (remesh voxel trước decimate; mesh Meshy hàng triệu mặt decimate thẳng bị xé/mất mảnh) và decimate nhiều nhịp. Model nhiều lá (cây phố) không giảm dưới ~2,4k vì nhiều mảnh rời.
- Low đã bake lưu ở `assets-src/meshy/bg/*.glb` (dựng lại không cần Meshy). Bản GLB cũ: `assets-src/original/*-v1.glb`.
- Lỗi xuất đã sửa: exporter glTF ghi mọi scene Blender vào file (file phình, import sinh scene theo cấp số) → `use_active_scene=True` trong `cog_proc.export` và `env_lib.export_env`. GLB cũ khác (grounds, plaza, fixtures…) vẫn có 4 scene rỗng, game đọc scene 0 nên không sai.
- Camera farm/quán là ortho: vật xa hơn ~11 m sau rào không bao giờ lọt khung; "núi xa" chỉ gợi được bằng đồi gần. Màn 1, chọn nhân vật: chưa làm phiên này.
- Code: `src/features/farm/game.js` (nền không nhận bóng trừ `farm_land`), `src/features/cafe/game.js` (nền không nhận bóng trừ `cafe_land`), `src/features/heaven/game.js` (nền không đổ/nhận bóng).

## Code đã sửa

- `src/shared/three/models.js` (mới): `loadModel('file.glb#node')`, `attachModels(target, slots)`.
- `src/characters/npc.js` (mới): `dressPerson(person, file)` — rig GLB thay khối `createPerson`, đọc `userData.legs`/`userData.seated` để chọn đi/đứng/ngồi; animation chỉ chạy khi được vẽ.
- `src/app/game.js`: `INTRO_MODELS`.
- `src/features/heaven/game.js`: `HEAVEN_MODELS`.
- `src/features/farm/assets.js`: thêm `well`, `grinder`.
- `src/features/farm/crew.js`: `dressPerson(group,'farm/worker.glb')` (file này có thay đổi chưa commit của người dùng, chỉ thêm 2 dòng).
- `src/features/cafe/game.js`: slot con quầy, `attachModels` quầy, `dressPerson` khách/nhân viên, cờ `seated`.

- Phiên 3: `src/shared/three/models.js` thêm `dressSlot`; `src/features/farm/assets.js` (grounds/props/decor, tier 2–5, đổi geometry); `src/features/farm/environment.js` (đặt tên nhóm hoa `blossoms`); `src/features/farm/decoration-builder.js` (hình decor.glb, khối tạm dự phòng); `src/features/cafe/game.js` (slot `cafe/surroundings`, `cafe/bar/counter|station-<i>|steamer|mixer|v60|autoEspresso`, tên nhóm phụ kiện bàn, tên `cup`, nạp hình); `src/shared/world/scene.js` (slot `heaven/plaza` gom sân/lối/đĩa/gò mây/cột/tường cổng); `src/features/heaven/game.js` (dress plaza); `src/app/game.js` (`INTRO_MODELS` +4).

## Test

- `node --test tests/*.test.js` (05:16): 24/32 pass; 8 fail giống hệt trước khi sửa (#7, 8, 10, 15, 16, 17, 18 luật farm/nhân viên; #26 thiếu canvas 2D trong Node). Không hồi quy.
- `npm run build` (05:17): OK; cảnh báo chunk 701 kB có sẵn.

## Việc kế tiếp

1. Người dùng kiểm trong game (phiên 3 chưa chạy): farm (rào, cổng ruộng, đường, ao, cờ bậc khi lên cấp 10, trang trí), quán (phòng, quầy, nền ngoài), thiên đàng (sân), Màn 1 (đường, cáng, đường mây). Chú ý: model trang trí không chặn đường (vùng cản vẫn là khối tạm vô hình).
2. Meshy (chờ người dùng đồng ý trong lượt chạy; agent asset-3d không tự tiêu credit): 8 brief ở hàng đợi `docs/assets/asset-pipeline.md` (tier-3/5 lò rang, máy xay, sân phơi; cây chậu và tủ bánh quán), tổng 240 credit; cây chậu + tủ bánh đã chạy và gắn, còn 6 brief tier-3/5 (180) / 302. Orchestrator gọi `generate_3d` (provider meshy, scene `gen_reaper`) với prompt trong bảng, rồi agent asset-3d chuẩn hoá bằng quy trình `cog_full`.
3. Còn khối tạm có chủ đích: luống, nền cỏ, túi/thanh tiến độ, giàn giáo đang xây, khung ô chưa mua, biển chữ canvas.
4. Ánh sáng/vật liệu thống nhất, QA 3 kích thước màn hình, đo FPS/draw call farm + quán sau khi gộp.

## Việc kế tiếp (phiên 2, giữ để đối chiếu)

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
