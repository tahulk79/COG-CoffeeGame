# Chương 1 — đợt 03: người đi phố và xe máy

Ngày: 2026-10-28. Trạng thái **Review**: đã tạo ảnh bằng imagegen tích hợp và nối vào mã, chưa chạy game/test/typecheck/build theo yêu cầu người dùng tự thử. Chưa push các đợt asset.

## File bàn giao

| File | Hàng 1 → 4 | Quy cách |
|---|---|---|
| [citizens-v1.png](../../../public/assets/slice/chapter1/citizens-v1.png) | walker, phone, tourist, kid | PNG alpha, 4 cột × 4 hàng |
| [vendors-v1.png](../../../public/assets/slice/chapter1/vendors-v1.png) | vendor, seller, cook, granny | PNG alpha, 4 cột × 4 hàng |
| [workers-v1.png](../../../public/assets/slice/chapter1/workers-v1.png) | old, shipper, driver, guard | PNG alpha, 4 cột × 4 hàng |
| [motorbikes-v1.png](../../../public/assets/slice/chapter1/motorbikes-v1.png) | hướng xuống phải, lên trái, xuống trái, lên phải | PNG alpha, 4 cột × 4 hàng; cột là bốn màu đỏ san hô/xanh/hồng/vàng |

Đường dẫn runtime nằm tại public/assets/slice/chapter1/. Ảnh nguồn giữ nguyên, texture dùng trong game được giới hạn cạnh dài 768 pixel khi nạp, dùng chung giữa nhiều instance.

## Cách dùng

Mỗi hàng người là một vai trò. Bốn cột lần lượt: đứng nhìn xuống phải, bước nhìn xuống phải, đứng nhìn lên phải, bước nhìn lên phải. Lật ngang để có hướng trái; tám hướng gameplay được ánh xạ về bốn hướng hình. Hai khung đứng/bước luân phiên là animation bước đi cơ bản, chưa phải chu kỳ bước đầy đủ được nghiệm thu.

Người lớn cao khoảng 62–66 pixel thế giới, trẻ em 50 pixel, hero khoảng 70 pixel. Mỗi vai trò dùng một hệ số scale cố định qua các pose. Giữ nguyên ID/look của mô phỏng để không thay hội thoại, lựa chọn hoặc tương tác. Vùng chạm giữ đủ rộng cho mobile.

Bảo vệ giữ mũ, áo olive và còi; người bán giữ nón/tạp dề/quang gánh theo vai trò. Người dùng điện thoại và khách du lịch có phụ kiện phân biệt. Đây là các kiểu hình, không phải thêm 12 NPC vào bản đồ.

Xe máy có bốn hướng vẽ riêng, chọn theo chuyển động thực tế, gồm các đoạn đi vòng ở hai đầu phố và xe qua barie. Màu chọn ổn định theo ID, không đổi mỗi frame. Không thay điểm sinh, tốc độ, đường chạy, va chạm hoặc điều kiện rời cảnh. Bộ xe chở hàng thuộc sự cố trong RunService chưa thay ở đợt này.

Hình xe+rider cao tối đa khoảng 84 pixel thế giới. Bánh chưa có animation quay riêng; người lái chưa có pose phanh/tông riêng. Các vệt phanh/khói tiếp tục dùng hiệu ứng hiện có.

## Mã liên quan

- sliceAssets.ts: asset, kích thước atlas/ngân sách texture, ánh xạ role và frame. Metadata ô dùng chung cho đăng ký frame và kiểm tra atlas sẵn sàng.
- streetArt.ts: dựng người/xe từ atlas, bóng tiếp xúc, chọn khung theo hướng/chuyển động; bóng và sprite được dọn khi rời scene. Chỉ dựng hình tạm dự phòng cho nhóm chưa có atlas hợp lệ.
- StreetService.ts: cập nhật facing từ độ dời thực tế, giữ hướng khi đứng. Không thay dir điều khiển dòng giao thông.
- Bong bóng thoại lấy độ cao từ sprite thực tế để tránh che nón/mũ/đầu người.

## Giới hạn và tự thử

Đã xem atlas và rà diff, chưa xác nhận hình tích hợp trong game hoặc hiệu năng trên điện thoại. File PNG tải xuống vẫn là bản nguồn; xuất bản nhỏ/nén và đo tải còn thuộc T-084.

1. Đứng cạnh các quầy và bảo vệ, chọn hội thoại: đúng người nói, đủ nút, không đổi hình/nhấp nháy khi đứng yên.
2. Xem người đi hai chiều, đi vòng đám đông rồi dừng: hướng mặt/khung đứng hợp lý, nón/quang gánh không bị cắt.
3. Xem xe thường và xe qua Ô Quan Chưởng đi trọn đoạn đường, rẽ ở hai đầu phố: chọn hình đúng hướng và không biến mất giữa cảnh.
4. Kiểm tra chữ trên mobile dọc/ngang và trường hợp cứu thương tụ tập đông người. Đợt này chưa có pose NPC giơ máy/chỉ tay riêng; flash hiện có chưa căn theo tay mới.

Các atlas AI cần chỉnh nếu khung bước lệch vị trí hoặc phụ kiện chưa đồng nhất. Chưa coi nhóm này là art/animation final chỉ vì đã có ảnh.

## Prompt chính xác đã dùng

### Người đi phố

Ảnh tham chiếu: hero-v1.png. Nền trong suốt.

```text
Use case: stylized-concept. Asset type: transparent 2.5D chibi street NPC sprite atlas for a Hanoi mobile game. Reference image is the HERO STYLE REFERENCE ONLY; create distinct civilians, matching soft painted materials, warm daylight, elevated orthographic game camera, large heads, compact bodies, simple readable silhouettes. Exact regular square 4 columns by 4 rows, sixteen full-body sprites, genuine alpha background. EACH ROW is a DIFFERENT PERSON, same identity and clothes across all four columns. Row1 Vietnamese young man short neat black hair, muted green casual shirt, navy trousers, brown shoes, no bag. Row2 Vietnamese young woman black ponytail, cyan blue shirt, charcoal trousers, holding a small dark smartphone close to chest. Row3 middle-aged tourist with beige sunhat, mustard yellow shirt, beige shorts, small red backpack. Row4 Vietnamese little girl with short bob hair, pink shirt, teal trousers, white shoes; same reference body scale within cells, game will make child smaller. COLUMN1 each person standing idle facing screen DOWN-RIGHT, front three-quarter. COLUMN2 same facing, a natural walking step, one leg forward. COLUMN3 standing idle facing screen UP-RIGHT, REAR three-quarter, clearly show BACK of head and clothes. COLUMN4 same rear facing, walking step. All views oriented RIGHTWARD; engine mirrors them for leftward. Keep every sprite centered in own equal cell, feet at90 percent cell height, consistent scale and head size across columns, ample padding, no overlap. Preserve role accessories in front and back views. No environment, ground, cast shadows, text, labels, grids, UI, borders or watermark. All bodies and hats fully inside cells. Do not draw the reference hero.
```

### Người bán hàng

Ảnh tham chiếu: hero-v1.png. Nền trong suốt.

```text
Use case: stylized-concept. Asset type: transparent 2.5D Hanoi street vendor NPC sprite atlas. Reference is HERO STYLE/PROPORTION only, not identity. Match its soft painted warm chibi look, large head compact body, same elevated orthographic camera, simple game-readable detail. EXACT square 4 columns by 4 rows, sixteen fully isolated full-body sprites on genuine transparent background. Each row is one different role, consistent person and clothing in its four columns. Row1 Vietnamese middle-aged woman wearing conical non la hat, peach blouse, brown trousers, carrying a simple shoulder pole with TWO shallow woven baskets hanging at waist level; baskets fully fit inside cell, keep narrow silhouette. Row2 young Vietnamese male stall seller, short black hair, brick red shirt, cream apron, navy trousers. Row3 middle-aged Vietnamese male cook, cream short-sleeve shirt and apron, brown trousers, small red cooking cap. Row4 older Vietnamese woman, lavender blouse, brown trousers, non la conical hat, gray hair near temples, no baskets. COLUMN1 idle facing screen DOWN-RIGHT front three-quarter, COLUMN2 same facing walking step, COLUMN3 idle screen UP-RIGHT REAR three-quarter showing back, COLUMN4 same rear view walking step. All face RIGHTWARD, game mirrors for left. Same scale, feet baseline90 percent, centered in equal cells, enough padding around hats and baskets, no overlap or cropping. Preserve each role's props in rear view. No stall or environment, ground, cast shadows, text labels grid lines UI borders or watermark. Do not draw reference hero or medical clothing.
```

### Người già, shipper, tài xế và bảo vệ

Ảnh tham chiếu: hero-v1.png. Nền trong suốt.

```text
Use case: stylized-concept. Asset type: transparent 2.5D Hanoi street NPC sprite atlas. Reference is hero ART STYLE ONLY. Match elevated orthographic camera, warm soft hand-painted chibi materials, large head compact body and simple mobile-readable silhouettes. EXACT square 4 columns by 4 rows, sixteen separate FULL BODY sprites, genuine transparent background. Each ROW is a distinct person with identical clothes/identity through its columns. Row1 elderly Vietnamese man with short GRAY hair, gentle face, plain white shirt, dark gray trousers, brown sandals. Row2 Vietnamese delivery courier with green jacket, green helmet, dark trousers, carrying a small square green parcel at side, NO text or brand. Row3 middle-aged Vietnamese motorbike taxi driver, olive shirt, mustard yellow helmet, navy trousers, no bike. Row4 Vietnamese street gate security guard, muted olive uniform shirt with dark olive trousers, dark green peaked cap, small red armband and whistle, no weapons. COLUMN1 person standing idle facing screen DOWN-RIGHT front three-quarter, COLUMN2 walking step same direction, COLUMN3 idle facing UP-RIGHT REAR three-quarter clearly show back of cap/head and clothes, COLUMN4 walking step same rear direction. All sprites face RIGHTWARD, game mirrors leftward. Keep equal cell spacing, centered, feet baseline90 percent, same height across poses, all hats/head/body/props inside own cell with padding. No ground, environment, cast shadows, text, labels, gridlines, border, UI or watermark. Do not draw reference hero.
```

### Xe máy

Ảnh tham chiếu: style-reference-v1.png. Nền trong suốt.

```text
Use case: stylized-concept. Asset type: transparent 2.5D Hanoi motorbike traffic sprite atlas. Reference image is ART DIRECTION: warm soft hand-painted chibi game appearance. Create EXACT square 4 columns by 4 rows, SIXTEEN complete scooters WITH a seated chibi Vietnamese rider wearing a light teal casual jacket, dark trousers and plain cream helmet. Compact everyday Vietnamese step-through scooters, no brands, not racing bikes. Same rider and same scooter model in every cell, only body paint varies by COLUMN: col1 coral red, col2 sky blue, col3 muted pink, col4 mustard yellow. Same light direction fixed upper-left. Camera STRICT elevated ORTHOGRAPHIC 2:1 dimetric, ground parallel edges at26.565 degrees. ROW1 scooter FRONT wheel/headlight points screen DOWN-RIGHT, see rider front three-quarter. ROW2 FRONT wheel points screen UP-LEFT, see rider BACK and scooter taillight. ROW3 FRONT wheel points screen DOWN-LEFT, see rider front three-quarter. ROW4 FRONT wheel points screen UP-RIGHT, see rider BACK and scooter taillight. Clearly distinguish FRONT and BACK views; all complete scooters fully fit inside their equal cells with ample transparent padding. Hands on handlebars, feet resting correctly on scooter, same scale, consistent ground anchor and cell spacing throughout. Genuine transparent background. No floor, road, cast shadows, extra people, traffic signs, text, labels, numbers, logos, gridlines, border, UI or watermark. Simple readable shapes at90px sprite width.
```

### Chỉnh khoảng đệm xe máy

Ảnh tham chiếu: atlas xe máy lượt đầu; chọn bản sau chỉnh làm motorbikes-v1.png. Nền trong suốt.

```text
Edit only the padding and framing of this sprite atlas. Preserve the SAME sixteen scooters, colors, riders, order and orientations in the EXACT 4-column by 4-row grid. Critical fix: ALL helmet tops and wheels must be fully visible INSIDE every cell, especially first row helmets currently touching the upper canvas edge. Make each complete rider+scooter silhouette about82 percent of cell height, add generous transparent padding above helmet and below wheels and to sides, centered consistently in each equal cell. Reconstruct any helmet cap clipped at the top. Keep same scale in ALL cells, no new poses or objects. Genuine transparent background, no ground/shadow/text/labels/border/gridlines/watermark. Do not change the soft painted chibi art style.
```


## Đợt tiếp theo

T-079: quầy hàng, cây, Ô Quan Chưởng/barie, đường/vỉa hè/hồ và phần nhà ngoài rìa còn tạm. Giữ bố cục, lối đi và vùng va chạm; ưu tiên kiểm tra tỷ lệ và phần che nhân vật.

