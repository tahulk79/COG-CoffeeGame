# Chương 1 — đợt 04: môi trường đường phố

Ngày: 2026-10-28. Trạng thái **Review**: đã sinh asset bằng imagegen tích hợp và ghép mã, chưa chạy game/test/typecheck/build theo yêu cầu người dùng tự thử. Chưa push đợt asset.

## Bàn giao

| File | Quy cách | Cách dùng |
|---|---|---|
| [stalls-v1.png](../../../public/assets/slice/chapter1/stalls-v1.png) | PNG alpha 4 cột × 2 hàng | trà đá, báo, phở, bún đậu, bánh mì, cắt tóc, chờ xe ôm, xôi |
| [trees-v1.png](../../../public/assets/slice/chapter1/trees-v1.png) | PNG alpha 3 cột × 1 hàng | ba biến thể cây, dùng ở vị trí cây sấu có sẵn |
| [parked-bikes-v1.png](../../../public/assets/slice/chapter1/parked-bikes-v1.png) | PNG alpha 2 cột × 2 hàng | xe không có người lái, bốn hướng, đặt tại các vật cản xe đỗ |
| [parked-cars-v1.png](../../../public/assets/slice/chapter1/parked-cars-v1.png) | PNG alpha 2 cột × 1 hàng | hai ô tô đỗ, màu san hô và xanh trầm |
| Ảnh thử cổng (đã xóa 2026-10-29) | Bản thử bị loại | Không tải vào game; đã dọn theo yêu cầu xóa asset không dùng |

Các PNG runtime ở public/assets/slice/chapter1/. Không đưa cả cảnh minh họa vào làm nền. Mỗi vật thể tách riêng, dùng atlas chung giữa các instance; giảm cạnh dài texture khi nạp: quầy 1536, cây 1024, xe máy đỗ 512, ô tô đỗ 768 pixel.

## Hành vi trong mã

- Bản đồ, walkability, footprint vật cản, đường xe và điểm tương tác không thay đổi. Ảnh mới thay phần vẽ của quầy, cây và xe đỗ; còn hình vẽ cũ làm dự phòng nếu không tải đủ frame.
- Quầy được gắn ở góc chân trước, lật ngang hình để cạnh dài theo trục của các quầy cũ. Nhãn tên đặt theo đỉnh ảnh thực tế. Kích thước/chân ảnh là hiệu chỉnh mỹ thuật ban đầu, chưa được duyệt trong game.
- Cây lấy gốc thân làm điểm đặt, cao khoảng140 pixel thế giới. Xe máy đỗ cao khoảng54 pixel, ô tô rộng theo footprint2×1. Các hình đỗ độc lập với xe đang chạy để không xuất hiện người lái trên xe đỗ.
- Cùng bộ nhà được dùng cho hàng chính, phần phố ngoài rìa và khối nhà giữa các vòng xe; không tạo thêm hàng nhà hoặc đổi đường vòng.
- Đường màu xám trầm, vỉa hè kem ấm, cỏ/hồ bớt bão hòa; thêm mạch lát và mép bó vỉa nhẹ. Nền/vạch kẻ vẫn chiếu theo lưới và bake một lần, không dùng ảnh nền sai phối cảnh.
- Barie/hàng rào giữ vị trí và hoạt động hiện có, đổi màu đỏ/kem dịu và bóng nhẹ; giảm độ đậm dây điện để phố dễ đọc hơn.

## Ô Quan Chưởng

Hai lượt ảnh sinh chưa khớp góc chiếu và tỷ lệ lối đi. Chỉ giữ ảnh cuối làm concept trong docs; không coi đó là sprite đã sẵn sàng.

Thay vì đưa ảnh đó vào, cityGate() được chỉnh trên hệ vẽ có sẵn: hai trụ trên vỉa hè, vòm cong được dựng theo tọa độ lưới, khối phía trên và chòi mái ngói. Phần dưới vòm không được tô thành một mặt kín. Toàn bộ cổng vẫn bake thành texture tĩnh, không vẽ lại mỗi frame. Đây là diễn giải phong cách của cổng, không phải bản phục dựng kiến trúc chính xác.

Chưa nghiệm thu cách che khuất ở dưới mái, vị trí chân cổng và xe đi qua cả hai hướng. Không thay logic di chuyển hay dùng hình ảnh làm collider. Nếu về sau thay PNG, cần bàn giao đúng góc chiếu, hai trụ ngoài làn và các lớp tách để kiểm soát che khuất.

## Phần cần tự thử và còn tạm

- Đến tám quầy: đồ vật đúng vai trò, không che người bán/thoại quá mức, nhấp tương tác vẫn chọn đúng quầy. Kiểm tra chân quầy trên vỉa hè, đặc biệt ghế cắt tóc có thể cần căn lại theo vùng va chạm.
- Đi sát cây/xe đỗ: vật cản vẫn chặn; tán cây và đồ trang trí không làm mất khả năng đọc nguy hiểm. Chưa có cơ chế làm mờ tán cây khi che nhân vật.
- Kéo camera ra hai đầu: nhà mới không đè vào vòng xe, xe vẫn đi hết đường; xem cả mobile dọc/ngang.
- Xem xe qua Ô Quan Chưởng và barie: không vẽ người/xe trên mái, không có trụ nằm giữa làn. Cổng cao hơn bản cũ nên cần duyệt độ che khuất và khung hình thực tế.
- Mặt đường/vỉa hè giữ khớp lưới nhưng chưa đo chi phí bake/tải hoặc FPS trên điện thoại. File PNG tải xuống vẫn là master, chưa phải bản export/nén cuối.
- Ghế nhựa, hàng rào, cột/dây điện, bồn hoa và các landmark xa bên hồ còn dùng hình code hiện có. VFX/sự cố/kết thúc/UI/audio sẽ làm ở các đợt sau; chưa đạt nghiệm thu Vertical Slice.

Đã xem các ảnh, đọc metadata kích thước/kênh alpha và rà diff. Các bước này không chứng minh bản ghép đã hoạt động đúng trong game.

## Prompt chính xác đã dùng

### Quầy hàng

Ảnh tham chiếu: style-reference-v1.png. Yêu cầu nền trong suốt.

```text
Use case: stylized-concept. Asset type: transparent 2.5D Hanoi street stall game atlas. Reference is ART DIRECTION ONLY: match warm painted wood, fabric, soft daylight, simple charming game shapes. Create EXACTLY 4 columns by 2 rows, EIGHT isolated full street stalls, genuine alpha background, same scale and orthographic 2:1 dimetric camera, ground axes slope26.565 degrees, LONG counter edge runs diagonally down-right, short side runs down-left. Each stall footprint is two units wide by one deep. Compact low striped fabric canopy, short wood counter, all complete inside its equal cell with generous padding. No people, no ground/platform, no cast shadows outside object, no signage or text. Row1 col1 iced-tea stand: muted brick-red and cream canopy, tea kettle, small glasses. Row1 col2 newspaper stand: muted blue and cream canopy, neat stacks of newspapers with abstract blank marks but NO legible letters. Row1 col3 pho noodle stand: mustard and cream canopy, one stock pot, simple bowls, sparse greens. Row1 col4 bun dau tofu stand: sage green and cream canopy, woven serving trays with tofu and herbs. Row2 col1 banh mi bread stand: warm orange and cream canopy, compact glass bread case, baguettes. Row2 col2 outdoor barber station: dusty rose and cream canopy, low wooden accessory stand with comb/scissors, small mirror and ONE compact empty barber chair, fit same footprint and height. Row2 col3 motorbike taxi waiting shelter: muted teal and cream canopy, simple low wooden bench and a yellow helmet on it, NO food and NO motorbike. Row2 col4 sticky rice stand: muted lavender and cream canopy, one bamboo steamer and wrapped parcels on counter. Keep canopy and counter scale consistent, avoid miniature clutter, readable at190px width. No environment, walls, extra trees, logos, labels, UI, gridlines, borders or watermark.
```

### Cây sấu

Ảnh tham chiếu: style-reference-v1.png. Yêu cầu nền trong suốt.

```text
Use case: stylized-concept. Asset type: transparent 2.5D Hanoi street tree game atlas. Match reference warm daylight, soft painted attractive foliage and simple readable game shapes. EXACTLY THREE columns in ONE row, three separate standalone trees, same scale, fully contained with generous alpha padding, genuine transparent background. Elevated orthographic isometric camera. Compact chibi Vietnamese sau (dracontomelon) shade trees: sturdy short brown trunks with visible forked branches, rounded loose canopies of medium broad leaves, warm olive and sage greens with a few golden sunlit leaves, dark leaf clusters beneath. Left tree rounded upright crown, middle tree slightly asymmetrical crown, right tree broader crown with a few tiny green fruits. Keep foliage mass simple, not thousands of tiny leaves, no flowers or coconut/palm shapes. Each tree about1.3 times as tall as wide, canopy high enough that bottom third shows a clear trunk; complete roots at center bottom of each cell, consistent baseline. NO square base, planter, pavement, ground plane, nearby scenery, cast shadow, people, labels, text, border, gridlines, UI or watermark. Only the three tree sprites.
```

### Xe máy đỗ

Ảnh tham chiếu: motorbikes-v1.png. Yêu cầu nền trong suốt.

```text
Use case: stylized-concept. Asset type: transparent 2.5D parked motorbike game atlas, no riders. Reference image is the approved traffic scooter atlas: keep exactly the same compact Vietnamese step-through scooter shape, warm soft painted materials and cream seat details, but REMOVE every rider entirely. Exact regular square2 columns by2 rows, FOUR complete freestanding parked scooters supported on a small kickstand, no helmets or attached boxes. Top-left coral red scooter front points screen DOWN-RIGHT; top-right muted sky blue scooter front points UP-LEFT showing back/taillight; bottom-left muted teal scooter front points DOWN-LEFT; bottom-right mustard scooter front points UP-RIGHT showing back/taillight. Strict elevated orthographic2:1 dimetric game camera, upper-left soft light. All same scale with full mirrors and wheels inside each cell, generous transparent padding, no touching cell boundaries. No person, no road or ground plane, no cast shadow outside silhouette, no text, brand, number plates lettering, labels, grids, UI, border or watermark. Genuine transparent background, only four parked scooter sprites.
```

### Ô tô đỗ

Ảnh tham chiếu: ambulance-v1.png. Yêu cầu nền trong suốt.

```text
Use case: stylized-concept. Asset type: transparent 2.5D parked car game atlas. Reference ambulance atlas is STYLE/CAMERA reference only. Create TWO compact everyday hatchback cars in a regular TWO-column ONE-row atlas, no people. Match warm soft painted chibi game forms, simplified materials, muted daylight upper-left lighting, elevated ORTHOGRAPHIC 2:1 dimetric game camera, projected ground long axis slopes26.565 degrees. Left car muted coral red body and cream roof, front points screen DOWN-RIGHT, see windshield and front lights. Right car muted dusty teal body and cream roof, front points screen UP-LEFT, see rear window and taillights. Same compact model and scale, full wheels/mirrors visible inside each cell with generous transparent padding. No road, floor, plinth, cast shadow outside silhouette, extra props, text, number plate lettering, brands, labels, gridlines, border, UI or watermark. Genuine alpha background. Make cars low and wide rather than tall miniature vans, readable at190px width.
```

### Concept cổng — chưa dùng làm sprite

Ảnh tham chiếu: style-reference-v1.png. Yêu cầu nền trong suốt.

```text
Use case: stylized-concept. Asset type: ONE transparent 2.5D Hanoi old city gate landmark game sprite inspired by O Quan Chuong. Match the reference game's warm hand-painted materials, simplified chibi proportions and sunny soft upper-left light. Standalone compact weathered warm brick gateway, central LARGE OPEN ARCHED PASSAGE, two substantial masonry supports at the ends, low crenellated upper parapet and one small raised guard pavilion with dark terracotta tiled roof. Subtle moss, restrained small details; no modern building, no flags or signage. The central arch is entirely EMPTY with genuine transparency through it: do NOT draw a dark solid wall inside the passage, no doors, no ground underneath, no foundation plinth crossing the opening. It must be obvious a small ambulance could drive through the arch. Strict ORTHOGRAPHIC 2:1 DIMETRIC camera: long facade spans screen DOWN-LEFT/UP-RIGHT with ground slope26.565 degrees, short building thickness runs DOWN-RIGHT/UP-LEFT. See broad facade and short rightward thickness; keep passage visible through its depth. Monument low and wide, not a tall tower. Draw full gate centered on transparent background, generous padding around every edge, no landscape or props, no road or pavement or cast shadow outside silhouette. No text, lettering, logos, UI, border or watermark. Single cohesive usable sprite, not a painting of a scene.
```

### Chỉnh concept cổng — vẫn chưa đạt quy cách tích hợp

Ảnh tham chiếu: ảnh cổng lượt đầu. Yêu cầu nền trong suốt.

```text
Edit this game gate sprite. Remove the ENTIRE brown/gold/black background and glow, including ALL pixels seen through the central arch, leaving actual transparent alpha. No simulated checkerboard or colored backdrop. Preserve the gate's identity/materials, but change the camera to a more elevated strict ORTHOGRAPHIC 2:1 ISOMETRIC game view: the long facade ground line must run diagonally DOWN-LEFT from upper right to lower left at26.565 degrees; its short thickness goes down-right. Keep all vertical lines vertical. The central arch opening should occupy the middle60 percent of total facade length, with narrow sturdy end supports occupying only20 percent each, so a three-lane game road visually fits underneath. No side wings or foundations extending into the opening. Remove the little doorway cutouts in the end supports; keep the tall main arch, brick parapet and modest small roof pavilion. Compact squat game proportions, simplified texture. Entire gate fully visible inside image with transparent padding. No ground shadow or floor under it, no text, no UI, no border or watermark. True clean cutout with an EMPTY transparent through-passage.
```


## Đợt tiếp theo

T-080: thay hình và chuyển động cho 12 sự cố, làm theo nhóm nhỏ, giữ nguyên dấu hiệu cảnh báo và thời điểm va chạm. Sau đó T-081 sáu kết thúc, T-082 UI và T-083 âm thanh.

