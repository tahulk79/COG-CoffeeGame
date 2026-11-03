# Asset registry

Cập nhật 2026-11-03 05:22. Trạng thái: `trong game` (GLB tải và gắn, đã chụp kiểm) · `trong game*` (đã gắn, chưa chụp tới) · `giữ code` (khối dựng bằng code có logic trạng thái, giữ có chủ đích) · `khối tạm` · `chờ`.
Nguồn: `M` = Meshy (30 credit), `T` = Blender thủ tục (0 credit), `R` = rig Meshy (5 credit).

## Màn chọn nhân vật

| Slot / vật | Nguồn | Trạng thái | File |
|---|---|---|---|
| Người chơi nam / nữ | có sẵn (rig Meshy) | trong game, texture nén 47 → 5,6 MB | `public/models/male.glb`, `girl.glb` |
| Sân khấu (hiên gỗ, chậu cà phê, bao tải, ghế, dây đèn, đồi xa) | T | trong game | `public/models/selection/stage.glb` |

## Màn 1 (intro)

| Slot | Nguồn | Trạng thái | File |
|---|---|---|---|
| `intro/street/shops` | M ×2 mẫu, 14 căn | trong game | `intro/shops.glb` |
| `intro/street/trees` | T | trong game | `intro/trees.glb` |
| `intro/street/road` | — | khối tạm (đường, vỉa hè đã có màu/vạch) | — |
| `intro/warning-sign/post`, `board` | — | giữ code (biển có chữ "CHÚ Ý ĐẦU" là cốt truyện, chữ phải đọc được) | — |
| `intro/bicycle` | M | trong game* | `intro/bicycle.glb` |
| `intro/ambulance` | M | trong game (còn logo nhỏ ở đuôi, xem PROGRESS) | `intro/ambulance.glb` |
| `intro/stretcher` | — | khối tạm (tay cầm là điểm IK) | — |
| `intro/reaper` | M | trong game | `heaven/reaper.glb` |
| `intro/heaven/path` | — | khối tạm | — |
| `intro/heaven/gate/frame`, `left-leaf`, `right-leaf` | T | trong game* | `intro/sky-gate.glb#sky_*` |
| Y tế ×2, linh hồn | code rig (IK nâng cáng) | giữ code | — |

## Thiên đàng

| Slot | Nguồn | Trạng thái | File |
|---|---|---|---|
| `heaven/reaper` | M | trong game | `heaven/reaper.glb` |
| `heaven/growing`, `brewing`, `business`, `clerk` | M (thần) + T (bàn, đạo cụ) | trong game | `heaven/<id>.glb` |
| `heaven/portal/frame`, `left-leaf`, `right-leaf` | T | trong game | `heaven/portal.glb#portal_*` |
| `heaven/surroundings` (slot mới) | T (biển mây, vách mây, 4 đảo bay có đình) | trong game* (nằm ngoài khung camera gần) | `heaven/surroundings.glb` |

## Farm

| Slot | Nguồn | Trạng thái | File |
|---|---|---|---|
| `farm/plot-*/crop` | M (có sẵn) | trong game; thêm `fruit_green` bằng bản sao tô xanh | `farm/coffee-tree.glb` |
| `farm/plot-*/bed` | — | giữ code (vật liệu đổi theo khô/ướt/khóa) | — |
| `farm/field-*/terrain`, `fence`, `gates` | — | giữ code (cổng ẩn theo ruộng đã mua) | — |
| `farm/dryer/tier-1` | M (có sẵn) | trong game | `farm/dryer-tier-1.glb` |
| `farm/roaster/tier-1` | M (có sẵn) | trong game | `farm/roaster-tier-1.glb` |
| `farm/grinder/tier-1` | M | trong game | `farm/grinder-tier-1.glb` |
| `farm/well/tier-1` | T | trong game | `farm/well-tier-1.glb` |
| `farm/market/tier-1`, `farm/seed-shop/tier-1` | M (market có sẵn) | trạm đang ẩn trong gameplay (`initialVisible:false`) | `farm/market-tier-1.glb` |
| `farm/<id>/tier-2..5` | — | khối tạm + cờ bậc | — |
| `farm/surroundings` (slot mới) | T (đồi, đồi cà phê, 70 cây, núi xa, nhà sàn) | trong game | `farm/surroundings.glb` |
| `farm/paths`, `pond`, `boundary`, `upgrades/*` | — | khối tạm | — |
| `farm/worker/<id>` | M + R | trong game* (qua `dressPerson`) | `farm/worker.glb` |
| Trang trí `flowers`, `lamp`, `sign` | — | khối tạm | — |

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
| `cafe/room`, `bar`, `pantry`, `board`, `terrace`, `roastery`, `exit` | — | khối tạm (bảng/biển có chữ phải đọc được) | — |

## Credit

Đã dùng 530 / 922 (17 model × 30 + 4 rig × 5). Còn 392. Chi tiết job ở `PROGRESS.md`.
