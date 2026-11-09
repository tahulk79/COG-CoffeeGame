# Plan nâng cấp hình ảnh nông trại (2026-11-09)

Phạm vi: game nông trại. Không đụng logic gameplay và quán cà phê. Công cụ: Blender, ảnh chụp CC0, Three.js. Meshy là tùy chọn về sau, model mới giữ nguyên tên file nên thay vào được.

Hướng hình ảnh: giống thật nhất trong giới hạn điện thoại, vẫn sáng và dễ nhìn.

## Hiện trạng đo được

| Hạng mục | Số liệu | Vấn đề |
|---|---|---|
| Khử răng cưa | `game.js:498` tắt trên máy cảm ứng màn dày; `pixelRatio` tối đa 1.25–1.5 | Đây là lý do chính map không mịn trên điện thoại |
| Lưới đất chơi | ô 1.25 m | Mép tầng và đường hơi gãy |
| Lưới đồi xa | ô 4 m | Đồi có cạnh, thấy rõ ở rìa bản đồ |
| Dung lượng model | 136 file, 33 MB | Cà phê chiếm 7.3 MB |
| Model nặng bất thường | `coffea-robusta-mature-lod0` 280.757 mặt, arabica 93.143, liberica 78.174 | Gấp hơn 10 lần mức hợp lý cho một cây bản gần |
| Đã làm | 18 model nền, 4 bộ ảnh thật, ánh sáng, hạt khói, xây nhà dạng hoạt cảnh | Chưa xem trong game đang chạy |

## Quy tắc chung

- Mỗi giai đoạn kết thúc bằng ảnh render theo góc chơi để duyệt, rồi mới thay vào game.
- Giữ nguyên tên file, tên node, kích thước. Bản cũ sao lưu ở `art-backup/`.
- Ngân sách đề xuất, cần đo lại trên máy thật: toàn cảnh dưới 250.000 mặt, dưới 120 draw call, tổng model dưới 40 MB. Bản gần: cây cà phê 6.000–12.000 mặt, nhà 5.000–12.000, cây lớn 12.000–20.000.

## Giai đoạn 0: Cảnh tổng trong Blender

- Script `gedeo_master_scene.py` đặt mọi model đúng vị trí trong game, camera cùng góc và cùng FOV 38.
- Vị trí lấy từ dữ liệu game: `layout.js`, `mountain-dressing.js`, `terrain-meta.json`, và một bản lưu mẫu cho nhà do người chơi đặt.
- Dựng 3 góc chuẩn: tầng thấp, giữa map, toàn cảnh xa.
- Xong khi: có bộ ảnh "trước khi sửa" để so sánh ở mọi giai đoạn sau.

## Giai đoạn 1: Map mịn

| Việc | Cách làm | Nơi sửa |
|---|---|---|
| Khử răng cưa | Bật lại cho mức high và medium, nâng `pixelRatio` tối đa lên 2 ở high, tự hạ nếu FPS thấp | `game.js`, `shared/vfx` |
| Đồi mượt | Lưới 2 m gần farm, 4 m ở xa, sinh lại `terrain-meta.json` để cây bám đúng đồi | `gedeo_ground_pass.py` |
| Mép tầng, dốc | Lưới 0.6 m chỉ quanh mép tầng và đường dốc | `world.js` |
| Nối đất chơi và đồi | Đồi dùng cùng shader với đất chơi để hết đường ranh màu | `farm-textures.js` |
| Chuyển cỏ sang đất, đường | Trộn theo độ cao của ảnh để mép có răng tự nhiên, thay vì mờ đều | `farm-textures.js` |
| Bớt lặp ảnh | Trộn 2 tỉ lệ, xoay ngẫu nhiên theo vùng, thêm bản đá và đất phụ | `farm-textures.js` |
| Thảm cỏ gần camera | Cỏ và hoa instanced, chỉ hiện gần camera, tắt ở mức low | file mới `realm/ground-cover.js` |
| Bóng tiếp đất | Nướng độ tối khe đá vào tường, địa hình; miếng bóng mềm dưới nhà, cây, người | Blender, `realm` |
| Núi xa | Render lại nền núi từ Blender, thêm mây bóng trôi trên đồi | `backdrop.js` |

Xong khi: ảnh chụp cùng góc hết răng cưa ở mép tường, đồi không còn cạnh, không thấy ô lặp.

## Giai đoạn 2: Sửa từng nhóm asset

Dùng thêm ảnh CC0: `reed_roof_04`, `thatch_roof_angled`, ván gỗ, thạch cao đất, vỏ cây bạch đàn, tôn gỉ.

| Nhóm | File | Lỗi thấy trong render | Cách sửa |
|---|---|---|---|
| Mái tranh | tukul, compost-house, worker-shelter, nursery, stilt-house, wood-kitchen | Tấm phẳng, texture nhòe | Dựng mái nhiều lớp có độ dày và mép tua, dùng ảnh tranh thật |
| Nhà tôn | coffee-warehouse, wooden-house, packing-shed, wet-mill, roastery-shed | Vết gỉ dán thành mảng, mặt phẳng lặng | Sóng tôn có hình khối, gỉ theo mép và đinh, tường có khối gỗ và gạch thật |
| Bệ, bể | water-tank, hill-cistern, stone-pond, drying-yard | Bệ vuông thô, bãi cỏ tròn vô lý quanh ao và bể | Bỏ đĩa cỏ, viền đá hợp với nền mới |
| Máy móc, xe | pulper, tiller, truck, motorbike | Khá ổn, vật liệu phẳng | Vát mép, kim loại PBR, bụi đất ở bánh và gầm |
| Đồ vật | tarp, sacks, basket, wheelbarrow, gate-sign, lamp-post | Bạt xanh gắt, cổng tối | Hạ độ gắt, thêm nếp gấp, sáng cổng |
| Nhà cũ | `farm/market-tier-1`, roaster, dryer, well, `grounds`, `surroundings`, `props`, `decor` | Thế hệ cũ, 5 file không có texture | Rà xem còn dùng không: còn thì làm lại, không thì xóa |
| Đá, gốc cây | rock, rocks, stump | Đá đen vân ô, gốc cây phẳng màu | Dùng ảnh đá thật như tường, gốc cây có vòng gỗ và vỏ thật |
| Cây lớn | albizia, cordia, avocado, durian, ensete, banana, bamboo | Tán tối, thành cục | Làm lại thẻ lá sáng hơn, chỉnh pháp tuyến cho ánh sáng mềm, giảm mặt cordia |
| Cà phê | coffea-* 3 loại × 3 giai đoạn | Tối, quá nặng | Giảm mặt xuống ngân sách, sáng lá, quả đỏ dễ thấy, giữ node hoa và quả |
| Nhân vật | worker-*, villager-*, buyer | Chưa xem kỹ | Chỉ làm lại texture và màu, giữ model và 9 hoạt ảnh |
| Robot | robot-* | Chưa xem kỹ | Kim loại PBR, vết bẩn, đèn phát sáng |
| Động vật | cow, goat, dog, chicken | Bò trông giống lạc đà không bướu | Kiểm tra tỉ lệ; nếu phải dựng lại thì tách thành việc riêng vì dính xương |

Thứ tự: cà phê và cây trước vì chiếm nhiều màn hình nhất, rồi nhà, máy móc, đồ vật, cuối cùng nhân vật và động vật.

## Giai đoạn 3: VFX chuẩn

Nền tảng:
- Mô phỏng khói, lửa, bụi trong Blender, kết xuất thành atlas 8×8, game phát lại có trộn khung hình.
- Mép hạt mờ khi chạm vật thể (soft particles), chỉ bật ở high.
- Hạt kéo dài theo hướng bay cho tia lửa và giọt nước.
- Một bảng cấu hình duy nhất, có trần số hạt theo mức chất lượng.

| Nhóm | Hiệu ứng | Gắn vào |
|---|---|---|
| Trồng trọt | Đất văng khi trồng, tia tưới theo vòi, đất sẫm ướt rồi khô dần, lá rơi khi tỉa, quả rụng khi hái | sự kiện `planted`, `watered`, cắt tỉa, thu hoạch |
| Di chuyển | Bụi bước chân trên đường đất, bụi và khói xả của xe | `staff.js`, `avatar.js` |
| Sơ chế | Nước phun ở máy xát, hơi bốc từ giàn phơi, khói và ánh lửa máy rang | `buildings.js` |
| Xây dựng | Khói bụi theo tầng, búa và tiếng búa, thợ xây đi đến làm | `buildings.js`, `staff.js` |
| Sự cố | Robot hết pin xẹt điện, hỏng máy bốc khói | `staff.js` |
| Thiên nhiên | Gió lay cây và cà phê bằng shader, ong quanh tổ, chim, mây bóng, cầu vồng sau mưa | `ambient-vfx.js`, vật liệu cây |
| Nước | Bọt quanh đá suối, vòng sóng khi mưa, phản chiếu ở mặt nước | shader `gw_water` |
| Phần thưởng | Tiền, nâng cấp, mở đất: giữ rõ ràng kiểu game | `shared/vfx` |

Xong khi: mỗi sự kiện trong bảng có hiệu ứng, mức low vẫn mượt.

## Giai đoạn 4: Hậu kỳ, kiểm tra hiệu năng

- Phát sáng nhẹ và chỉnh màu bằng LUT, chỉ ở mức high.
- Đo FPS, mặt, draw call, dung lượng tải trên điện thoại thật; cắt phần vượt ngân sách.
- Rà sạch model không còn dùng.

## Rủi ro

- Blender và Three.js tính sáng khác nhau: màu luôn cần chỉnh lần cuối trong game.
- Hiệu năng trên điện thoại chưa đo được. Giai đoạn 1 và 3 có thể phải giảm bớt.
- Phiên "Farm Manager V2" cũng sửa `staff.js`, `game.js`: phải đọc lại trước khi sửa.

## Cần founder quyết

1. Xây nhà mất thời gian thật hay giữ hoạt cảnh. Mặc định: giữ hoạt cảnh.
2. Có chu kỳ ngày đêm không (đom đóm, đèn sáng về đêm). Mặc định: chưa làm.
3. Có cho mở game chụp ảnh để so màu không. Mặc định: không, founder tự xem.

## Tiến độ

Đợt 1 (2026-11-09), đã code, chưa xem trong game đang chạy:
- Khử răng cưa bật cho mọi máy, `pixelRatio` tối đa 1.5 (medium) và 2 (high).
- Hệ hạt phát flipbook 8×8 từ mô phỏng khói Blender (`scripts/blender/vfx_flipbook.py`), có trộn khung hình. Tia lửa và giọt nước kéo dài theo hướng bay.
- Gió lay lá trên mọi vật liệu lá (`tickWind`).
- Bụi bước chân cho người chơi và nhân viên trong tầm nhìn.
- Máy xát có nước phun và sương, giàn phơi có hơi bốc. Robot quá nhiệt hoặc kẹt có tia lửa, khói. Tỉa cây có lá rơi, phun thuốc có sương.

Chưa làm: giai đoạn 0, phần còn lại của giai đoạn 1 (lưới đồi, mép tầng, trộn mép đất, thảm cỏ, nướng bóng, núi xa), toàn bộ giai đoạn 2, ong, chim, mây bóng, xe, bọt suối, đất ướt, soft particles, giai đoạn 4.
