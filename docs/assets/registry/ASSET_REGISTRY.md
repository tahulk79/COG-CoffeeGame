# Asset registry

Cập nhật 2026-11-03 17:00 (phiên 4: nền Meshy + đất texture; phiên 3: asset thủ tục màu đỉnh; `trong game*` = đã nối code, chưa chạy game). Trạng thái: `trong game` (GLB tải và gắn, đã chụp kiểm) · `trong game*` (đã gắn, chưa chụp tới) · `giữ code` (khối dựng bằng code có logic trạng thái, giữ có chủ đích) · `khối tạm` · `chờ`.
Nguồn: `M` = Meshy (30 credit), `T` = Blender thủ tục (0 credit), `R` = rig Meshy (5 credit).

## Màn chọn nhân vật

| Slot / vật | Nguồn | Trạng thái | File |
|---|---|---|---|
| Người chơi nam / nữ | có sẵn (rig Meshy) | trong game, texture nén 47 → 5,6 MB | `public/models/male.glb`, `girl.glb` |
| Sân khấu (hiên gỗ, lan can, ghế, dây đèn, nền cỏ; đồi + cụm cây Meshy phía sau; 4 chậu cây) | T (hiên, lan can, ghế, dây đèn) + M (cây/đồi từ farm_meshy, chậu cafe/plant) | trong game* | `public/models/selection/stage.glb` |

## Màn 1 (intro)

| Slot | Nguồn | Trạng thái | File |
|---|---|---|---|
| `intro/street/shops` | M ×2 mẫu, 14 căn | trong game | `intro/shops.glb` |
| `intro/street/trees` | T | trong game | `intro/trees.glb` |
| `intro/street/road` | T (vỉa hè gạch, bó vỉa, đường, cột điện + dây, 3,8k) | trong game* | `intro/street.glb#intro_road` |
| `intro/warning-sign/post` | T (cột thép, tay, xích) | trong game* | `intro/street.glb#warning_post` |
| `intro/warning-sign/board` | — | giữ code (chữ "CHÚ Ý ĐẦU" phải đọc được) | — |
| `intro/bicycle` | M | trong game* | `intro/bicycle.glb` |
| `intro/ambulance` | M | trong game (còn logo nhỏ ở đuôi, xem PROGRESS) | `intro/ambulance.glb` |
| `intro/stretcher` | T (khung nhôm, nệm cao .855, tay cầm ±1,2/.9/±.31 giữ điểm IK) | trong game* | `intro/street.glb#stretcher` |
| `intro/reaper` | M | trong game | `heaven/reaper.glb` |
| `intro/heaven/path` | T (bậc đá mây, viền vàng, đèn, mây) | trong game* | `intro/street.glb#heaven_path` |
| `intro/heaven/gate/frame`, `left-leaf`, `right-leaf` | T | trong game* | `intro/sky-gate.glb#sky_*` |
| Y tế ×2 | M (khách quán nam/nữ, tô lại texture áo+quần thành đồng phục y tế xanh theo trọng số xương; tay rig nhắm điểm nắm của gripStretcher) | trong game | `intro/medic-m.glb`, `intro/medic-f.glb` |
| Linh hồn | code rig | giữ code | — |

## Thiên đàng

| Slot | Nguồn | Trạng thái | File |
|---|---|---|---|
| `heaven/reaper` | M | trong game | `heaven/reaper.glb` |
| `heaven/growing`, `brewing`, `business`, `clerk` | M (thần) + T (bàn, đạo cụ) | trong game | `heaven/<id>.glb` |
| `heaven/portal/frame`, `left-leaf`, `right-leaf` | T | trong game | `heaven/portal.glb#portal_*` |
| `heaven/plaza` (slot mới, `scene.js`) | T (sân lát, lối viền vàng, đĩa thần, gò mây, đèn đá, lan can cổng; 12,3k) | trong game* (`dressSlot`, vùng cản giữ khối tạm) | `heaven/plaza.glb` |
| `heaven/surroundings` (slot mới) | T biển mây + M (5 bờ mây, 3 đảo mây; atlas 1024, 26k tris, 2 draw call) | trong game* | `heaven/surroundings.glb#heaven_sea`, `#heaven_meshy` |

## Farm

| Slot | Nguồn | Trạng thái | File |
|---|---|---|---|
| `farm/plot-*/crop` | T (Arabica thủ tục, 4k tris; Meshy cũ ở `assets-src/original/coffee-tree-meshy.glb`, Meshy v2 bị loại) | trong game* (có sẵn `fruit_ripe` đỏ + `fruit_green` vàng xanh) | `farm/coffee-tree.glb` |
| `farm/plot-*/bed` | — | giữ code (đất bo góc, vật liệu đổi theo khô/ướt/khóa) | — |
| Cỏ dại, hoa cà phê trên luống | T (đổi geometry) | trong game* | `farm/props.glb#weeds`, `#blossoms` |
| `farm/field-*/fence`, `gates`, `sign` | T (`dressSlot`, cổng vẫn ẩn theo ruộng đã mua) | trong game* | `farm/grounds.glb#field_fence`, `#field_gates`, `#field_sign` |
| `farm/field-*/terrain` | — | giữ code (bị `farm_land` che, y −0,001) | — |
| Mặt đất trong map | T (texture cỏ 512 × màu đỉnh, mòn quanh đường/trạm/cổng ruộng) | trong game* | `farm/surroundings.glb#farm_land` |
| `farm/dryer/tier-1` | M (có sẵn) | trong game | `farm/dryer-tier-1.glb` |
| `farm/roaster/tier-1` | M (có sẵn) | trong game | `farm/roaster-tier-1.glb` |
| `farm/grinder/tier-1` | M | trong game | `farm/grinder-tier-1.glb` |
| `farm/well/tier-1` | T | trong game | `farm/well-tier-1.glb` |
| `farm/market/tier-1`, `farm/seed-shop/tier-1` | M (market có sẵn) | trạm đang ẩn trong gameplay (`initialVisible:false`) | `farm/market-tier-1.glb` |
| `farm/<id>/tier-2..5` | tier-1 GLB + T cờ bậc | trong game* (Meshy tier-3/5 đang ở hàng đợi brief) | tier-1 + `farm/decor.glb#tier_<n>` |
| `farm/surroundings` (slot mới) | T (đất, đường đất, cỏ/hoa/đá) + M (3 đồi cà phê, 10 cụm cây, nhà vườn; atlas 1024) | trong game* (30k tris, 3 draw call) | `farm/surroundings.glb#farm_land`, `#farm_scenery`, `#farm_meshy` |
| `farm/paths`, `farm/pond`, `farm/boundary` | T (`dressSlot`) | trong game* | `farm/grounds.glb#paths`, `#pond`, `#boundary` |
| `farm/<id>/upgrade-markers`, `farm/upgrades/*`, cá trong ao | T (đổi geometry: sao, cá) | trong game* | `farm/props.glb#marker`, `#fish` |
| `farm/worker/<id>` | M + R | trong game* (qua `dressPerson`) | `farm/worker.glb` |
| Trang trí `flowers`, `lamp`, `sign` | T (`decoration-builder.js`; biển giữ chữ canvas) | trong game* | `farm/decor.glb#decor_*` |

## Quán

| Slot | Nguồn | Trạng thái | File |
|---|---|---|---|
| `cafe/espresso-machine` | M (có sẵn) | trong game | `cafe/espresso-machine.glb` |
| `cafe/table-<i>/*` | M (có sẵn) | trong game | `cafe/table.glb` |
| `cafe/register/counter-<i>` (slot con mới) | M | trong game (quầy 2 hiện khi mua nâng cấp) | `cafe/register-counter.glb` |
| `cafe/pickup/counter` (slot con mới) | M | trong game* (hiện khi mua) | `cafe/pickup-counter.glb` |
| `cafe/kiosk/unit-<i>` (slot con mới) | M | trong game* (hiện khi mua) | `cafe/kiosk.glb` |
| Khách (14 tên) | M ×2 + R | trong game (nam/nữ xen kẽ theo id) | `cafe/guest-m.glb`, `cafe/guest-f.glb` |
| Nhân viên (5 vai) | M + R | trong game* | `cafe/staff.glb` |
| `cafe/room` | T (+ phiên 4: ván sàn texture vân gỗ `cafe_floor`, vữa vôi loang, gạch trần sau quầy, dây đèn; sàn gỗ, sân hiên, tường ốp gỗ, cửa sổ, kệ hũ hạt, đèn thả, tủ bánh, tự phục vụ, góc sofa, kệ sách, bồn cây, cây chậu, cột đèn, dây xếp hàng; 11,5k) | trong game* (biển/menu canvas giữ) | `cafe/room.glb` |
| `cafe/bar/counter`, `station-<i>`, `steamer`, `mixer`, `v60`, `autoEspresso` (slot con mới) | T | trong game* | `cafe/fixtures.glb#bar_*` |
| `cafe/pantry`, `board`, `terrace`, `roastery`, `exit` | T (bảng chữ A giữ chữ canvas) | trong game* | `cafe/fixtures.glb#pantry`, `#board`, `#expansion`, `#exit_mat` |
| Phụ kiện bàn: sofa (cấp 4), đệm (3), đèn (≥3), hoa (≥4), bàn chưa mở | T | trong game* | `cafe/fixtures.glb#table_*`, `cafe/props.glb#cushion` |
| Ly (quầy trả, bàn bẩn, tay cầm) | T (đổi geometry + vật liệu) | trong game* | `cafe/props.glb#cup` |
| Cây chậu ×6, tủ bánh (trong slot `cafe/room`) | M (cog_full: 1.416 / 4.802 tris) | trong game* (vùng cản giữ khối tạm) | `cafe/plant.glb`, `cafe/pastry-case.glb` |
| `cafe/surroundings` (slot mới) | T (nền texture grit, cột điện + dây, rào, ghế) + M (19 nhà ống từ 2 mẫu `intro/shops.glb`, 6 xe máy, xe đẩy, 3 cây phố; atlas 1024) | trong game* (32k tris, 3 draw call) | `cafe/surroundings.glb#cafe_land`, `#cafe_scenery`, `#cafe_meshy` |
| Khung trống ô chưa mua | — | giữ code (dấu hiệu chỗ mua) | — |

## Credit

Phiên 4: +8 job Meshy nền × 30 = 240 (session chính chạy; lần đầu cây phố lỗi phía Meshy). Số dư: xem session chính.

Đã dùng 530 / 922 (17 model × 30 + 4 rig × 5). Phiên 3: +3 job × 30 (cây chậu, tủ bánh, cây cà phê v2 bị loại) = 620 / 922. Còn **302** (API 14:48). 6 brief tier-3/5 (180) ở hàng đợi `docs/assets/asset-pipeline.md`. Chi tiết job ở `../../archive/redesign/3d-progress.md`.
