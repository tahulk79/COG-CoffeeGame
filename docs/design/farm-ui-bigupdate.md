# Farm UI big-update (từ 2 ảnh tham khảo, 2026-11-08)

Mục tiêu: màn nông trại phải "ra cà phê" và đọc được như 2 ảnh mẫu (vườn cây ăn quả kiểu châu Á/âu, vườn cà phê châu Phi). Làm bằng Three.js trước (placeholder tự vẽ), sau đó chỉ việc thay ảnh/GLB vào đúng đường dẫn dưới đây. Chỉ lấy *mẫu thiết kế*, không copy asset của game nào.

## 1. Đọc 2 ảnh mẫu

| Hạng mục | Ảnh mẫu | Hiện tại trong game |
|---|---|---|
| Góc nhìn | Nghiêng 30–45°, thấy rõ các tầng tán cây, có đường chân trời + núi | Pitch 52°, gần như nhìn từ trên xuống, zoom gần thì chỉ thấy 2 luống đất |
| Cây | Cây lớn nhiều tầng, tán chồng lên nhau, vòng đất quanh gốc, quả/hoa theo mùa | Cây low-poly nhỏ, 2 lớp, thân + tán đơn giản |
| Đất/nền | Cỏ có hoa nhỏ, đường đất lẫn sỏi, đất đỏ (châu Phi) | Cỏ phẳng, đường cam, luống đất hình chữ nhật |
| Không gian | Nhà kho, nhà kính, hàng rào, giàn phơi, chòi lá, chuối, cây che bóng | Chỉ vài cây + đá, các lô trống có bảng giá |
| Người | Công nhân trên thang hái quả, bóng chat có icon rổ | Nhân viên nhỏ, bóng chat chữ |
| HUD trên-trái | Pill xu, thanh năng lượng ⚡ (9/1), nhãn "Cấp độ" kèm icon trái cây | Huy hiệu cấp + tên, pill xu, pill kho |
| HUD trên-phải | Bánh răng + minimap tròn/vuông góc | Sổ, "Round 1", bánh răng, Vay, Auto |
| HUD dưới | **Thanh công cụ**: trái = cưa, kéo tỉa, bình tưới; phải = kéo cắt, xẻng, thùng/hộp; nút ghim bản đồ có số; nút ba lô bên trái | Thanh nav 5 nút (Seeds/Build/Bán hạt/Staff/Progress) |
| Theo vùng | Mỗi vùng một diện mạo (Việt Nam cao nguyên vs châu Phi đất đỏ) | Một diện mạo xanh chung cho mọi nước |

Kết luận: đây là đổi **ngôn ngữ chơi** (chọn công cụ rồi chạm cây), không chỉ đổi skin. Cần chốt các câu hỏi ở mục 5 trước khi làm HUD.

## 2. Các phase

1. **Camera (đã làm 1 phần)** — farm pitch 38° (`PITCH_FARM`, café giữ 52°). Còn: zoom-out vẫn thấy tổng thể, sương mù xa + phông núi/trời ở chân trời (xem asset B).
2. **Cây nhiều tầng** — cà phê trưởng thành to hơn, 3 tầng tán, vòng đất gốc cây (mulch ring), hoa/quả theo mùa, bóng chat icon rổ khi sẵn sàng thu hoạch.
3. **Môi trường** — hàng rào, nhà kho/nhà kính (Việt Nam), chòi lá + giàn phơi + chuối (châu Phi), vòi tưới, xe cút kít, rổ. Theo `palette`/vùng của `world.js`.
4. **HUD nông trại mới** — top-left, top-right + minimap, thanh công cụ trái/phải, nút ba lô, nút bản đồ. Các sheet cũ (Seeds/Build/Staff/Progress) vẫn giữ, chỉ đổi chỗ mở.
5. **Cơ chế công cụ** (nếu chốt) — chọn cưa/kéo/bình tưới rồi chạm cây.

## 3. Quy ước thay ảnh

Mọi ảnh để trong `public/assets/farm/`. Code luôn thử nạp file theo đúng tên dưới đây; **không có file thì dùng hình vẽ bằng Three.js/CSS** (placeholder), có file thì dùng file. Bạn chỉ cần đặt đúng tên, không phải sửa code.

PNG nền trong suốt, sRGB, nên làm 2× rồi để game thu nhỏ. Phong cách: tươi, bão hòa, viền mềm, bóng nhẹ ở dưới (giống ảnh mẫu).

### A. Icon HUD — `public/assets/farm/ui/` (256×256, PNG trong suốt)

| File | Nội dung |
|---|---|
| `nav-seeds.png` | **Đang dùng**: nút Seeds (cây non / hạt giống), thay emoji 🌱 |
| `nav-build.png` | **Đang dùng**: nút Build (búa / cưa) |
| `nav-staff.png` | **Đang dùng**: nút Staff (nhân viên) |
| `nav-progress.png` | **Đang dùng**: nút Progress (ngôi sao / cúp) |
| `nav-sell.png` | **Đang dùng**: nút Bán hạt (hạt cà phê) — nút tròn lớn góc phải |
| `coin.png` | Đồng xu vàng |
| `energy.png` | Tia sét xanh |
| `level-fruit.png` | Quả táo/quả cà phê cạnh nhãn Cấp độ |
| `btn-backpack.png` | Ba lô / giỏ đeo |
| `btn-map-pin.png` | Bản đồ + ghim đỏ |
| `btn-settings.png` | Bánh răng gỗ |
| `tool-saw.png` | Cưa tay |
| `tool-pruner.png` | Kéo tỉa cành |
| `tool-watering-can.png` | Bình tưới xanh |
| `tool-shears.png` | Kéo cắt (đỏ) |
| `tool-shovel.png` | Xẻng |
| `tool-crate.png` | Thùng/hộp chứa hàng |
| `tool-beans.png` | Hạt cà phê (nút bán hạt) |
| `tool-bag.png` | Túi vải đựng hạt |
| `slot-frame.png` | Khung ô công cụ thường (kem, viền gỗ), 192×192 |
| `slot-frame-active.png` | Khung ô đang chọn (xanh lá) |
| `bar-frame.png` | Khung thanh năng lượng/xu (9-slice, 256×64) |
| `bubble-harvest.png` | Bóng chat có rổ quả (512×512 nếu có đuôi) |
| `bubble-water.png`, `bubble-prune.png` | Bóng chat tưới / tỉa |

### B. Phông & nền — `public/assets/farm/env/`

| File | Kích thước | Nội dung |
|---|---|---|
| `sky-gradient.png` | 1024×512 | Trời + mây nhẹ, dùng làm phông chân trời |
| `mountains-vn.png` | 2048×512, lặp ngang | Dãy núi xanh cao nguyên (Việt Nam) |
| `mountains-af.png` | 2048×512, lặp ngang | Núi khô vàng nâu (châu Phi) |
| `treeline.png` | 2048×256, lặp ngang | Hàng cây xa |
| `grass-tile.png` | 512×512, lặp liền | Cỏ có hoa nhỏ |
| `soil-red-tile.png` | 512×512, lặp liền | Đất đỏ bazan |
| `soil-brown-tile.png` | 512×512, lặp liền | Đất nâu phù sa |
| `path-tile.png` | 512×512, lặp liền | Đường đất lẫn sỏi |

### C. Sprite 3D (billboard hoặc decal) — `public/assets/farm/props/` (512×512, trong suốt, nhìn từ góc 38°)

`mulch-ring.png` (vòng đất quanh gốc), `flower-patch.png`, `pebbles.png`, `sprinkler.png`, `wheelbarrow.png`, `basket-full.png`, `basket-empty.png`, `ladder.png`, `drying-bed.png`, `banana-plant.png`, `shade-tree.png`.

### D. Mô hình GLB (tùy chọn, thay placeholder Three.js) — `public/models/farm/`

Nếu bạn có GLB thay vì ảnh: `coffee-tree-mature.glb` (3 tầng tán), `shed.glb`, `greenhouse.glb`, `hut-thatched.glb`, `fence.glb`. Đã có sẵn một số file ở thư mục này (xem `public/models/farm/`), mình giữ chúng cho đến khi bạn thay.

### E. Theo vùng (mỗi bộ cùng tên, thêm hậu tố)

Việt Nam `-vn`: nhà kho gỗ, nhà kính, hàng rào gỗ. Châu Phi `-af`: chòi lá, giàn phơi, chuối, cây keo che bóng. Có thể thêm bộ khác về sau (`-br`, `-co`, …) mà không đổi code.

## 4. Đã làm (áp dụng vào màn nông trại)

- Camera farm: pitch 34°, FOV 46° (café giữ 52° / 38°) — `setPitch(rad, fov)` trong [camera.js](../../src/features/realm/camera.js). Kích thước vật thể trên màn hình giữ nguyên nhờ bù khoảng cách.
- Phông đồi/núi low-poly quanh khu đất ([backdrop.js](../../src/features/realm/backdrop.js)), tô màu theo bảng màu từng nước.
- Cây cà phê to hơn 25% để thấy tầng tán ([plots.js](../../src/features/realm/plots.js)).
- HUD farm: thanh dưới thành 2 cụm ô gỗ vuông ở hai góc (Seeds, Build trái · Staff, Progress phải), nút bán hạt tròn lớn trên cụm phải; minimap vuông dưới góc trên-trái ([minimap.js](../../src/features/hud/minimap.js), bắc ở trên, chỉ để xem). Icon thay bằng PNG khi có file (`nav-*.png`, [farm-assets.js](../../src/features/hud/farm-assets.js)).
- Cảnh quanh khu đất ([scenery.js](../../src/features/realm/scenery.js)): nhà kho gỗ, nhà kính, giàn phơi (Việt Nam và nước khác); chòi lá + giàn phơi (châu Phi: et, ke, ug, tz, rw, bi, ci, za). Đặt ngoài biên bản đồ, mỗi món là một group tên `shed`, `greenhouse`, `hut-thatched`, `drying-bed` để thay bằng GLB sau.
- Vòng đất rơm quanh gốc mỗi cây cà phê, lớn dần theo cây ([plots.js](../../src/features/realm/plots.js)).
- Chưa làm: thanh năng lượng ⚡ (game chưa có cơ chế), texture đất/cỏ theo vùng, bóng chat icon rổ.

## 5. Cần bạn chốt trước khi làm HUD

1. **Thanh ⚡ "9/1"** là năng lượng của người chơi? Mỗi công cụ tốn bao nhiêu? (Hiện game chưa có cơ chế này, nhân viên có `energy` riêng.)
2. **Công cụ**: chọn cưa/kéo/bình tưới rồi chạm cây (cơ chế mới), hay chỉ là nút tắt mở sheet cũ (Seeds, Build, ...)?
3. **Thanh nav cũ** (Seeds / Build / Bán hạt / Staff / Progress) thay hoàn toàn bằng thanh công cụ, hay giữ ở dạng nút nhỏ?
4. **Minimap**: chỉ để xem, hay chạm để dịch chuyển camera?
5. **Vùng nào có diện mạo riêng trước**: Việt Nam + một nước châu Phi (như 2 ảnh), hay làm khung chung rồi thêm dần?

## 6. Game feel (2026-11-08, sau phản hồi "giống web, không giống game")

Chuẩn tham chiếu: Hay Day / FarmVille 3 / Township — camera thuộc về người chơi, chạm là hành động ngay, kéo để làm hàng loạt, mọi thứ nảy và bay về kho.

**Đã làm**
- Camera không đuổi theo nhân vật trên nông trại; chạm đất chỉ chọn/bỏ chọn (không đi bộ), kéo để lia. Nông dân vẫn tự đi tới cây khi bạn trồng/hái.
- Camera mặc định lùi xa hơn 35% (thấy nhiều hàng cây trên điện thoại dọc).
- Bỏ các ô đất nhạt hình vuông và bảng giá ở mọi lô chưa mua: đất trống là cỏ liền mạch, bảng giá chỉ hiện trong chế độ Mở rộng; dấu "+" hiện theo vùng đang nhìn.
- **Popup công cụ cạnh ruộng** ([field-pop.js](../../src/features/hud/field-pop.js)): chạm một ruộng → các icon hạt giống (khi còn luống trống, kèm giá) và rổ (khi còn cây chín) nổi ngay trên ruộng, bám theo khi lia camera. Giữ icon và quét qua các luống để trồng / hái hàng loạt (`realm.toolDrag`). Ảnh thay thế: `ui/seed-<giống>.png`, `ui/tool-basket.png`.
- Vành đai nông lâm kết hợp kiểu Ethiopia quanh khu đất: cây che bóng tán dù cao (Albizia/Cordia), cây ăn quả tầng giữa (bơ/xoài), cụm enset/chuối tầng thấp. Cây cao chỉ ở phía xa (bắc, đông) để không che ruộng.

**Tiếp theo (theo thứ tự hiệu quả)**
1. ~~Popup ngay cạnh ruộng~~ và ~~bong bóng ruộng~~ (đã làm: bong bóng có đồng hồ / "Chín rồi!", thẻ dài ở đáy chỉ mở khi bấm ⋯).
2. **Juice** (đã có sẵn: cây rung khi hái, hạt bay về Kho, sao, âm thanh; còn thiếu: số XP bay, nút Kho nảy): cây nảy khi trồng/hái, quả bay theo vòng cung về nút Kho, số xu/XP bay lên, rung nhẹ nút khi nhận; âm thanh "pop".
3. ~~Tầng cây trong vườn~~ (đã làm, chỉ hình ảnh — [plots.js](../../src/features/realm/plots.js) `gardenStyle`): **forest** (Ethiopia, Kenya, Uganda, Tanzania, Rwanda, Burundi, Bờ Biển Ngà, Nam Phi) = cây che bóng tán dù cao 7–11 m giữa các hàng + cây ăn quả ở góc lô + enset xen giữa hàng; **shade** (Việt Nam, Ấn Độ, Indonesia…) = chuối xen ở mỗi hàng thứ hai + cây che bóng vùng cao như cũ; **sun** (Brazil) = đồn điền phơi nắng, không cây che. Còn: ảnh hưởng tới năng suất/chất lượng (cần chốt số).
4. **Asset thật** (mục 3.D): cây cà phê có quả, enset, cây che bóng, chòi lá, giàn phơi — quyết định 70 % độ "giống ảnh mẫu".
5. Giảm số nút HUD trên màn (gom Sổ/Vòng/Vay/Auto vào một menu).
