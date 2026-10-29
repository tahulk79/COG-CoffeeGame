# Chương 1 — đợt asset 2.5D đầu tiên

Ngày: 2026-10-28. Trạng thái: **Review — đã nối vào mã, chờ người dùng tự chơi thử**.

## Phạm vi và file bàn giao

Người dùng đã chọn tiếp tục phong cách 2.5D sau khi xem ảnh định hướng. Giữ Phaser và camera chéo cố định; đợt này không thêm renderer 3D hoặc phụ thuộc mới. Hình được tạo bằng công cụ imagegen tích hợp, không dùng API/CLI riêng.

| File | Vai trò | Quy cách |
|---|---|---|
| [style-reference-v1.png](style-reference-v1.png) | Ảnh định hướng đã xem | Chỉ tham chiếu, không tải làm nền trong game |
| [hero-v1.png](../../../public/assets/slice/chapter1/hero-v1.png) | Nhân vật chính màn 1 | PNG alpha; atlas 4 cột × 4 hàng, 16 ô |
| [houses-v1.png](../../../public/assets/slice/chapter1/houses-v1.png) | Ba mẫu nhà phố | PNG alpha; atlas 3 cột × 1 hàng |
| [sliceAssets.ts](../../../src/components/render/sliceAssets.ts) | Đăng ký asset/frame | Bỏ padding trong suốt theo alpha khi tạo frame, một lần lúc tải |

Các link từ tài liệu này nằm dưới `docs/art/chapter1/`; đường dẫn file game thực tế là `public/assets/slice/chapter1/` ở gốc repo.

Hero có bốn hướng **trên màn hình**: xuống phải, xuống trái, lên phải, lên trái. Mỗi hàng có đứng, bước một, chuyển bước, bước hai. Tám hướng di chuyển của gameplay được ánh xạ về bốn hướng vẽ; chưa có tám hướng hình riêng. Các bước AI sinh có thể chưa đều, cần duyệt trong game trước khi gọi là animation final. Chiều cao hiển thị khoảng 70 pixel thế giới, pivot tại chân; tiếp tục áp dụng pose ngã/khiêng từ mô phỏng hiện có.

Nhà được đặt riêng theo footprint có sẵn, thay cho các căn trong `streetHouses()`, dùng chung atlas. Không thay toàn bộ nhà phụ ngoài rìa, quầy hàng, cây, cổng, xe hoặc NPC trong đợt này. Điểm gắn của nhà là ước lượng mỹ thuật (`origin .54/.97`), không phải collider xuất từ phần mềm dựng; cần xem cạnh nhà, chân cửa và vùng che khuất khi chơi thật. Không coi art đã khớp chính xác va chạm chỉ vì dùng lại footprint.

## Prompt đã dùng — nhân vật

Ảnh tham chiếu: `style-reference-v1.png`. Bật nền trong suốt.

```text
Use case: stylized-concept. Derive a GAME SPRITE SHEET from the protagonist of the reference: cheerful Vietnamese chibi young man, large dark brown tousled hair, coral orange short sleeve shirt, dark navy trousers, white sneakers, small dark crossbody satchel. Preserve his identity and warm illustrated 2.5D appearance, simplify fine detail for 70px on-screen height. Output ONLY a perfectly regular square 4-column by 4-row sprite sheet, sixteen full-body sprites, on genuine transparent background. Each cell exactly one quarter canvas width and height. Every sprite centered horizontally in its cell, feet at 90 percent cell height, same scale and same head height; ample padding, no sprites touching neighboring cells. Orthographic elevated isometric game camera, same angle for every row, soft illumination from upper left. ROW 1 faces screen down-right (see front and rightward profile). ROW 2 faces screen down-left (see front and leftward profile). ROW 3 faces screen up-right (rear three-quarter, see back of head and shirt). ROW 4 faces screen up-left (rear three-quarter, see back of head and shirt). In EVERY row columns are the same four animation phases: column1 neutral standing idle both feet planted, column2 walking left foot forward right arm forward, column3 walking passing pose feet close, column4 walking right foot forward left arm forward. True rear views in rows3/4, NOT front views. Arms swing naturally and subtly. Same body proportions clothing bag face hair in every cell. No floor, NO cast shadows or contact shadows, no environment, no text labels gridlines UI border or watermark. Pixel-perfect regular grid placement matters. This is a deliverable sprite atlas, not concept art.
```

## Prompt đã dùng — nhà phố

Ảnh tham chiếu: `style-reference-v1.png`. Bật nền trong suốt. Lượt đầu ra nhà quá cao nên đã chỉnh một lượt trước khi chọn atlas đưa vào game.

```text
Use case: stylized-concept. Create a PRODUCTION GAME ENVIRONMENT SPRITE ATLAS with THREE separate standalone Hanoi Old Quarter two-storey houses, deriving warm yellow plaster, green shutters, terracotta roofs and modest balconies from the reference but simplifying detail substantially for mobile gameplay. Transparent background. Wide landscape canvas, exactly three equal-width cells in ONE horizontal row, each containing ONE complete freestanding two-storey building, all SAME SCALE, identical footprint and overall heights, ample transparent padding, no overlap. Left house warm ochre plaster and dark green shutters; middle house ivory plaster and teal shutters; right house muted pale sage plaster and brown shutters. All have a ground-floor CLOSED wooden shop door, a small upper balcony and a compact terracotta tiled roof, sparse potted greenery, no signage. CAMERA STRICT ORTHOGRAPHIC 2:1 DIMETRIC: vertical walls vertical; ground edges go diagonally down-right and down-left at exactly 26.565 degrees to horizontal; see front wall on LEFT image side and side wall on RIGHT image side; both visible walls similar width. Each building base is a clean rectangular diamond, its frontmost ground corner at horizontal center of its cell. SAME orientation for all three. Each building approximately square plan (slightly deeper than wide), low compact height. NO foundation platform, no pavement or ground plane, no attached stalls, no external trees, no neighboring buildings, no cast shadow outside silhouette. Only isolated buildings cut out in alpha. Warm softly shaded polished 2.5D hand-painted game sprites with clear forms and simplified textures, NO photorealism. Full buildings must fit inside each cell. No text, labels, UI, gridlines, borders, watermark.
```

Prompt chỉnh nhà, dùng atlas lượt đầu làm ảnh đích:

```text
Edit this game atlas. Keep THREE isolated houses, their colors, roof materials and transparent background, in three equally sized horizontal cells. Critical CHANGE: make them LOW WIDE COMPACT game buildings instead of tall narrow buildings. Each house complete silhouette bounding box MUST be approximately SQUARE: width equals total image height. Reduce the vertical height of both storeys to about HALF current height, while retaining doors and balcony, and widen the SIDE wall until front and side walls have equal projected widths. Think squat chibi buildings for a high overhead game camera, not realistic architecture. Strict orthographic 2:1 dimetric game grid: the four corners of each house ground footprint are a symmetric diamond with ratio2:1, wall edges vertical. Each building frontmost ground corner is exactly at the horizontal center of its cell. No ground plane or platform, no cast shadows. No text, no borders. Keep all three same camera, same size, same footprint, all fully inside cells with transparent padding. Much simpler surface texture and fewer leaves, readable small game sprites.
```

## Đợt tiếp theo và prompt để gửi

Đợt cứu hộ đã có atlas và mã tích hợp, đang chờ tự thử: xem [đợt 02](ASSET_PASS_02.md). Prompt bên dưới được giữ làm brief của đợt này.

Thứ tự: bác sĩ và xe cứu thương → NPC/quầy/cây/cổng → các sự cố/kết thúc → UI/âm thanh. Không đưa những nội dung đã bỏ như nội thất cà phê ông Tám trở lại.

Prompt yêu cầu đợt tiếp:

> Dựa trên ảnh định hướng và hero-v1 của Chương 1, hãy làm đợt asset cứu hộ 2.5D. Tạo bác sĩ và xe cứu thương đồng bộ màu, tỷ lệ, ánh sáng; tách riêng từng atlas nền trong suốt. Trước khi sinh ảnh hãy đọc timeline cứu hộ trong StreetService để liệt kê đúng hướng nhìn và động tác. Bác sĩ cần đứng, đi, nâng và khiêng đồng bộ; xe cần hình đúng hướng đường chính và ngõ, điểm cửa lên/xuống và bánh tách để dùng cho sự cố. Kết nối vào mã hiển thị, giữ va chạm và trình tự cứu hộ. Ghi rõ clip nào hoàn thiện, clip nào còn tạm. Không chạy test tự động vì tôi tự test.

## Giới hạn và kiểm tra

- Đã xem các ảnh sinh ra và rà diff; chưa chạy game, test, typecheck hoặc build theo yêu cầu người dùng tự thử.
- Chưa đo thời gian tải/FPS/bộ nhớ trên điện thoại thật. Dung lượng PNG không đại diện cho texture giải nén.
- NPC, xe và phần lớn đồ vật vẫn là hình tạm, nên màn 1 hiện trộn hai mức chất lượng; chưa đạt nghiệm thu Vertical Slice.
- Cần người dùng xem đứng/đi/đổi hướng/ngã/khiêng, cạnh mái/nhà và trong ngõ, ở camera mobile thực tế. Không dùng atlas AI như bằng chứng animation đã được nghiệm thu.
