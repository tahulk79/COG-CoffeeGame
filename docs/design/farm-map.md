# Bản đồ nông trại mới: "Trục Lõi Mọc Bắc"

> **Đã code (2026-11-06), chưa commit.** Founder chốt:
> - Chỉ đặt nhà trong lô đã mua.
> - Đất mua **chỉ cần đủ xu**, không có cấp yêu cầu, nên bỏ mọi cột "Cấp" bên dưới.
> - Giữ camera xoay 45°: mua đất xong camera tự lướt tới mảnh mới.
> - `MAX_LEVEL = 100`.

> Bản đề xuất để review (2026-11-06). Chưa code. 3 agent vẽ 3 bố cục độc lập, script tự kiểm tra hình học (không chồng
> lấn, mảnh nào cũng giáp đường, đường nào cũng nối về cổng), 1 agent chấm điểm và ghép, 1 agent rà soát với code thật.
> Các lỗi rà soát tìm ra đã được sửa trong bản này (mục 11). Tọa độ đầy đủ: `docs/design/farm-map-layout.json`.

## 1. Kết luận nhanh
- Giữ nguyên 14 ruộng cũ F1-F14 (đúng tọa độ). Save cũ an toàn, không mất cây đang trồng.
- Thêm một **trục đường chính** chạy lên phía bắc. Trên điện thoại dọc, nông trại mọc dần lên trên màn hình.
- Có 6 khu: Sân kho & cổng, Ruộng lõi cũ, Ruộng tây bắc, Đồng cỏ & xưởng (đông bắc), Vườn cây & ao, Đồi cối xay gió.
- Tổng 34 mảnh, 22 đoạn đường. Map rộng 64 x 104 m.
- Mua một mảnh thì mở đoạn đường cạnh nó. Đất chưa mở là bụi rậm, có biển giá + cấp.
- Script đã kiểm tra: không chồng lấn, mảnh nào cũng giáp đường, đường nào cũng nối về cổng, ruộng đều 10x6 m.

So 3 phương án: Hub & Spokes giữ save tốt nhưng quá rộng cho điện thoại. Winding Trail đẹp trên điện thoại dọc nhưng phải dời hết ruộng. Deed Grid gọn nhưng đơn điệu. Bản cuối lấy Hub & Spokes làm gốc, đổi sang dáng dọc của Winding Trail, và lấy cách xếp hàng làn đường của Deed Grid.

## 2. Hiện trạng & vấn đề
- Map 60 x 48 m, chỉ có ruộng. Đường đi đã mở hết từ đầu, nên không có cảm giác "mở đường".
- Ruộng nào cũng mua được ngay từ Lv1, chỉ cần đủ xu. Không có luật giáp đường hay cấp yêu cầu.
- Nhà máy, trang trí đặt trên cỏ trống bất kỳ. Không có lô đất xây dựng, không có cảm giác mua đất để xây.
- Đất chưa mua chỉ là cỏ + biển giá. Không có khu chăn nuôi, vườn, ao.
- Không có cấp yêu cầu để mua đất, nên Lv1-100 không có nhịp.

## 3. Bố cục mới

| Khu (zone) | kind | Số mảnh | Cấp | Giá |
|---|---|---|---|---|
| Sân kho & cổng | build, decor | 3 (Y0, W1, D1) | 1-6 | 0 / 300 / 450 |
| Ruộng quanh nhà (lõi cũ) | farm | 14 (F1-F14) | 1-22 | 0 - 9000 (giá cũ) |
| Ruộng tây bắc | farm | 4 (F15-F18) | 20-48 | 6200 - 18500 |
| Đồng cỏ & xưởng (đông bắc) | pasture, build | 8 (P1-P4, W2-W5) | 16-86 | 4800 - 55000 |
| Vườn cây & ao (tây bắc xa) | pond, orchard, decor | 4 (PD1, O1, G1, O2) | 52-75 | 21000 - 42000 |
| Đồi cối xay gió (đỉnh) | decor | 1 (H1) | 93 | 70000 |

Vật cố định:
- Kho `silo` giữ nguyên ở (9,14).
- Cổng `GATE` giữ nguyên ở (0,23).
- `PLAYER_SPAWN` giữ nguyên ở (0,18).
- `gatePlaza` nới thành [-4,17.5,4,26], vẽ bằng đất. Điểm spawn nằm trên đất, không lơ lửng trên cỏ.

Kích thước:
- Ruộng 10 x 6 m (3x2 ô trồng như cũ).
- Lô xây theo ô 2 m: Y0 và W1 8x8 (vừa 4 máy sấy). Đồng cỏ, xưởng, vườn 12x10. Lô lớn W4, W5 10x10. H1 16x10.

## 4. Đường đi & cách mở rộng
- **Mở sẵn từ đầu:** `mainEW` đoạn giữa, `gateRoad`, `swLane`, `seLane`.
- **Lõi cũ:** mua F2 mở `mainEW_W`. Mua F3 mở `spine0` + `nLane_W`. Mua F7 mở `spine1` + `nRing_W`. Mua F9 mở `nLane_E`. Mua F11 mở `nRing_E`. Mua F13 mở `mainEW_E`.
- **Phía bắc:** trục `spine2..spine5` đi thẳng lên. Mỗi hàng có làn tây (`wLane2..4`) và làn đông (`eLane2..4`). Mảnh nào ở hàng trước thì mở làn của hàng sau.
- **Luật mua:**
  - Chưa sở hữu.
  - Cấp người chơi >= `level`.
  - Có một cạnh chung với đường đang mở (không dùng dung sai).
- **Nhịp Round 1 (Lv1-9), 11 lần mua:** F2 (Lv1) 80, F3 (Lv2) 180, W1 (Lv3) 300, F4 (Lv3) 350, F5 (Lv4) 600, D1 (Lv5) 450, F6 (Lv5) 900, F7 (Lv6) 1300, F8 (Lv7) 1800, F9 (Lv8) 2400, F13 (Lv9) 7000. Không có gì đặt ở Lv10, vì Lv10 là lúc sự cố.
- **Lv11-40:** lấp nửa đông lõi cũ và hàng bắc đầu tiên. Có gà ở P1 (Lv16) và heo ở P2 (Lv37).
- **Lv41-100:** ao, vườn, xưởng lớn, cuối cùng là đồi cối xay gió H1 (Lv93).

## 5. Đất bị khóa trông thế nào
- **Giáp đường mở (frontier):** bụi, đá, gốc cây, cỏ cao. Có biển gỗ ghi giá. Nếu thiếu cấp thì ghi "Cần Lv N" + ổ khóa.
- **Xa hơn:** rừng phẳng, không biển. Đỡ tốn mesh, nhìn như rừng chưa khai phá.
- **Đường chưa mở:** vệt cỏ mờ, chỉ hiện ở frontier. Người chơi thấy trước đường sẽ đi đâu.
- **Lúc mua:** bụi tan, đường đất "chạy" ra (event `roadsOpened`), camera lùi nhẹ cho thấy phần mới.
- **Đất đã mua, vẽ theo kind:** ruộng đất cày + rào. Lô xây nền sỏi, hiện lưới 2 m khi xây. Đồng cỏ có rào gỗ. Vườn có cây ăn trái. Ao có mặt nước.
- Rào và đồ trang trí lùi vào trong mép mảnh 0.2 m, vì đường giờ sát mép.

## 6. Camera điện thoại
- Map dọc 64 x 104 m. **Lưu ý:** camera nông trại đang xoay 45° (`YAW = -45°` trong `camera.js`, bạn đã chỉnh trước đây), nên hướng bắc hiện ra **chéo lên bên trái** màn hình, không thẳng lên trên. Xem câu hỏi 8.
- Lúc đầu camera bị giới hạn trong `START_BOUNDS` [-30,-22,30,28], tức lõi cũ.
- Sau đó dùng `farmViewBounds(s)`: gộp đất đã mua + đường mở + đất mua được, đệm 6 m. Mỗi lần mua thì nới dần (có tween).
- Màn hình dọc cho zoom xa thêm một chút để thấy đủ chiều ngang 56 m.

## 7. Save cũ
- `LAYOUT_VERSION` 3 -> 4, thêm bước `if (out.layout < 4)` trong `migrateLayout`.
- F1-F14 giữ nguyên id và rect. Cây, timer, nhân viên không đổi. Không hoàn tiền.
- Mọi save được tặng Y0. Save có nhà/đồ trang trí ngoài ruộng được tặng thêm W1.
- Đường: thêm `opensRoads` của mọi mảnh đã có, cộng chuỗi đường nối về cổng. Bỏ id cũ `mainNS`, `southWest`, `north`.
- Công trình:
  - Nằm trọn trong lô đã sở hữu và không chồng gì thì giữ nguyên.
  - Không thì dời vào Y0, rồi W1, rồi lô khác.
  - Không còn chỗ thì hoàn `builtValue` vào `refund` (toast có sẵn).
- Cấp yêu cầu chỉ áp cho lần mua mới. Café (S, C2, C3) không đụng tới.

## 8. Kế hoạch code

**Phase 1: dữ liệu + logic core**
- `src/core/config/layout.js`:
  - `BOUNDS`, `START_BOUNDS`, 22 `ROADS`, 34 parcel farm (kind, zone, level, opensRoads).
  - `parcelRoads(id)`. `RESERVED` thêm silo, nới `gatePlaza`.
- `src/core/derive.js`:
  - `roadOpen`, `parcelError` (thêm 'level').
  - `buyableParcels`, `farmViewBounds`.
  - `placementError` bỏ đặt trên cỏ: phải nằm trong lô đã mua đúng loại (`lot`).
- `src/core/config/economy.js`: thêm `lot` cho BUILDINGS farm.
- `src/core/game.js`: `land/buyParcel` mở đường + emit `roadsOpened`.
- `src/core/state.js`: migration v4.

**Phase 2: hiển thị**
- `src/features/realm/world.js`:
  - Đường gộp 1 geometry.
  - Bụi rậm bằng InstancedMesh.
  - Biển chỉ ở frontier.
  - Mặt đất theo kind.
- `src/features/realm/camera.js`: bounds động.

**Phase 3: HUD + chữ**
- `src/features/hud/sheets.js`, `modal.js`: danh sách đất theo khu, khóa cấp, "mở đường tới...".
- `src/i18n/locales/*`: tên khu, lỗi mới.

**Phase 4: test + cân bằng**
- `tests/core/*.test.mjs`: chồng lấn, giáp đường, ruộng 10x6, mô phỏng thứ tự mua, migration v3->v4.
- `scripts/economy-sim.mjs`: giá và cấp mới.

## 9. Rủi ro
- Bỏ đặt đồ trên cỏ: người thích trang trí có thể bị hoàn tiền. Đã giảm bớt bằng W1 miễn phí + toast.
- Đường rộng hơn (`mainEW` 5 m, làn 3 m) đè lên cỏ cũ. Công trình ở đó phải dời hoặc hoàn tiền.
- Map lớn gấp ~2.3 lần. Bắt buộc instancing, gộp đường, rừng phẳng ở xa, không thì máy yếu sẽ giật.
- H1 cách cổng ~90 m, đi bộ xa. Sau này cần chạm để dịch chuyển hoặc kho phụ.
- Đồng cỏ, ao, vườn, xưởng lớn chưa có nội dung. P1 mở ở Lv18 có thể thấy trống.
- Giá Lv40-100 là ước lượng, phải chạy economy-sim.
- `areaAt` của café dùng z >= 82. Farm tới z 28 là an toàn, đừng nâng maxZ quá 72.

## 10. Cần bạn chốt
1. Giữ nguyên vị trí 14 ruộng cũ? **Mặc định: có** (save an toàn nhất).
2. Bỏ hẳn đặt nhà trên cỏ trống, chỉ đặt trong lô đã mua? **Mặc định: có**, kèm Y0 + W1 tặng cho save cũ.
3. Thêm cấp yêu cầu khi mua đất? **Mặc định: có**, theo bảng ở mục 4.
4. Mở rộng lên phía bắc (dọc màn hình)? **Mặc định: có**.
5. Khi chưa có nội dung chuồng gà, heo: vẫn bán P1, P2 để trang trí? **Mặc định: vẫn bán**, cho phép đặt decor. Nội dung thật làm ở Round 2.
6. Giá đất Lv40-100 (16k - 70k)? **Mặc định: dùng tạm**, chỉnh sau khi chạy `scripts/economy-sim.mjs`.
7. Dời công trình không vừa thì ưu tiên dời hay hoàn tiền? **Mặc định: dời trước, không còn chỗ mới hoàn tiền.**
8. **Hướng mọc của bản đồ so với camera xoay 45°:** giữ camera như cũ và chấp nhận đất mới mọc chéo lên trái, hay đổi hướng mọc sang đông bắc (thẳng lên màn hình)? **Mặc định: giữ camera, mọc lên bắc.** Đổi camera sẽ làm đổi toàn bộ góc nhìn nông trại.
9. **Nâng cấp tối đa lên 100:** code hiện dừng ở `MAX_LEVEL = 30`, nên đất cấp 31-93 chưa mua được. **Mặc định: nâng `MAX_LEVEL` lên 100 và nối dài đường XP ngay khi làm bản đồ.**

## 11. Rà soát với code (đã sửa trong bản này)

| Vấn đề | Cách xử lý |
|---|---|
| `MAX_LEVEL = 30` trong `economy.js`: đất cấp trên 30 không bao giờ mua được | Câu hỏi 9: nâng lên 100 cùng lúc. Thêm test: cấp của mọi mảnh ≤ `MAX_LEVEL` |
| F8 đặt Lv10 trùng đúng lúc sự cố xoá vùng | Dời mọi mốc Round 1 vào Lv1-9 (mục 4) |
| Round 1 ít đất mua hơn hiện tại (hôm nay F2-F14 mua được từ Lv1) | Thêm F9 (Lv8) và F13 (Lv9): 11 lần mua trước sự cố. Phải chạy `economy-sim` để chốt |
| Camera xoay 45°, "bắc" không phải "lên trên" | Ghi rõ ở mục 6, câu hỏi 8 |
| `world.js` gắn cứng id đường `mainNS` để cắt đường nhánh | Phase 2: bỏ `MAIN_NS`, gộp đường thành 1 mesh |
| `placement.js` có logic cỏ trống riêng (phủ màu cả `BOUNDS`, bóng ma xuất phát ở (9,10)) | Phase 2: chỉ tô màu các lô đã mua đúng loại, bóng ma bắt đầu từ Y0. Mở rộng `PARCEL_FOR_ZONE` |
| Người chơi và nhân viên đi được vào đất khóa (lưới `nav` phủ hết `BOUNDS`, đường đóng vẫn được coi là đi được) | Đất khóa + đường đóng thành vật cản. Giới hạn `avatar.setBounds` theo `farmViewBounds` |
| Biển giá: lẫn giữa "mua được" và "giáp đường" | `frontierParcels` = chưa mua và giáp đường mở (bỏ qua cấp), dùng cho biển và camera. `buyableParcels` (cấp + xu) chỉ cho nút Mua |
| Ruộng xa phía bắc làm nhân viên đi giao hàng rất xa (kho chỉ ở (9,14)) | Ruộng giữ trong khoảng 30 m quanh kho. Hàng xa để ao, vườn, đồi. Sau này thêm kho phụ phía bắc |
| Mỗi mảnh tạo riêng 1 mesh nền + 1 biển + 1 sprite chữ: 34 mảnh là nặng | Gộp nền theo kind thành 1 mesh. Biển và chữ chỉ tạo cho đất frontier (pool khoảng 6) |
| Save có nhiều đồ trang trí trên cỏ (tối đa 36 món) không vừa Y0 + W1 | Migration tặng thêm D1 khi tràn, toast báo số món được hoàn tiền, test với save đầy decor |
