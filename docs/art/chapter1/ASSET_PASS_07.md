# Chương 1 — đợt 07: sự cố, nhóm 3/3 — động vật

Ngày: 2026-10-28. Trạng thái **Review**. Sinh ảnh bằng imagegen tích hợp, đã nối vào mã, chưa chạy game/test/typecheck/build theo yêu cầu người dùng tự thử. Chưa push các đợt asset và chưa nghiệm thu Vertical Slice.

## File bàn giao

| Asset | Quy cách | Các pose |
|---|---|---|
| [hazard-cat-v1.png](../../../public/assets/slice/chapter1/hazard-cat-v1.png) | PNG alpha 4 cột × 2 hàng | đứng/chạy hai bước/vươn chân; góc trước và sau |
| [hazard-dogs-v1.png](../../../public/assets/slice/chapter1/hazard-dogs-v1.png) | PNG alpha 4 cột × 4 hàng | hai hàng chó nhỏ, hai hàng chó lớn; đứng/chạy hai bước/há miệng thè lưỡi |
| [hazard-pigeons-v1.png](../../../public/assets/slice/chapter1/hazard-pigeons-v1.png) | PNG alpha 4 cột × 2 hàng, ảnh rộng3:1 | đậu/cánh lên/cánh ngang/cánh xuống; góc trước và sau |
| [hazard-chickens-v1.png](../../../public/assets/slice/chapter1/hazard-chickens-v1.png) | PNG alpha 4 cột × 2 hàng | đứng/chạy hai bước/vỗ cánh; góc trước và sau |

Đường dẫn runtime: public/assets/slice/chapter1/. Chó đã chỉnh khoảng đệm một lượt; bồ câu đã chỉnh và đóng gói lại thành ảnh rộng để giữ đầu cánh trong ô. Đây là các bản được chọn đưa vào workspace; các bản thử trước không dùng runtime.

Giới hạn cạnh dài texture lúc nạp lần lượt768/768/1024/512 pixel, giữ PNG nguồn. Cùng atlas được dùng lại cho nhiều con, không sinh texture mới mỗi frame. Kích thước hiển thị tối đa dự kiến: mèo42, chó nhỏ32/chó lớn66, gà34, cánh bồ câu42 pixel thế giới theo chiều cao atlas. Tỷ lệ thực còn cần duyệt ở camera mobile.

## Đã nối vào mã

- Mèo: đứng ở warn, hai bước chạy khi thực sự đổi vị trí, pose vươn chân và nhảy nhẹ trong cảnh chạm người; giữ cảnh báo và hiệu ứng cũ.
- Chó: chó nhỏ ở warn, chó lớn ở active. Nếu cảnh báo bị hủy, ảnh chó nhỏ giữ nguyên cỡ khi fade thay vì đột ngột đổi thành chó lớn. Khi chạm người, dùng pose chó mới và mây va chạm; hình răng lớn cũ chỉ còn làm dự phòng khi atlas chưa sẵn sàng.
- Gà: vẫn ba con và các vị trí lệch cũ, bước lệch nhịp, pose vỗ cánh/hop khi chạm người. Giữ nhánh bung thùng sau khi né xe chở hàng, không thêm một loại spawn độc lập.
- Bồ câu: giữ vạch cảnh báo/đường vụn bánh; khi bay dùng năm con theo các offset cũ và khung vỗ cánh lệch nhịp. Điểm gắn theo tâm thân trong ô nguồn để vùng crop của cánh không tự quyết định vị trí thân.
- Cảnh bồ câu va chạm dùng năm con của cùng đàn, tắt ảnh đàn đang fade để tránh thêm một đàn thứ hai. Giữ quỹ đạo nhấc người và hiệu ứng ngã cũ.
- RunService chỉ xuất moving theo độ dời thật của động vật và trạng thái running. Không đổi tốc độ, mục tiêu đuổi, cách tránh tường, khoảng cách va chạm, thời điểm ngất hay điều kiện cứu hộ. Khi bị chặn hoặc người chơi đã ngất, động vật không tiếp tục pose chạy tại chỗ; pose va chạm vẫn diễn theo hit.
- Có hình code dự phòng nếu thiếu frame. Sprite động vật được dùng lại theo ID và dọn khi hết pha/rời scene.

## Phần cần tự thử

1. Đi hai chiều và quanh góc với mèo/chó/gà: mặt trước/sau/lật trái phải hợp lý, chân không nhảy vị trí, bóng và thân khớp nền.
2. Đứng yên sát vật cản: động vật dừng dáng chạy khi không tiến được. Logic đường đuổi vẫn là cơ chế cũ, chưa phải nâng cấp pathfinding.
3. Chó: thấy rõ cỡ nhỏ ở cảnh báo rồi cỡ lớn đuổi; nếu sự cố khác làm ngất giữa pha cảnh báo, chó nhỏ không tự lớn lên khi biến mất.
4. Né xe chở hàng: thùng mở rồi nhánh gà xuất hiện, đủ ba con; không bị vẽ thêm người/xe/gà ngoài số lượng chủ ý.
5. Bồ câu đi ngang/dọc và theo bánh mì: cảnh báo đủ rõ, cánh không bị cắt hoặc che quá nhiều chữ/nhân vật. Kiểm tra cảnh chạm người chỉ có một đàn và không còn ảnh dư sau chuyển chương.
6. Xem trên mobile dọc/ngang ở camera thật để chỉnh kích thước, vùng chạm và hiệu năng.

Đã xem ảnh, đọc metadata alpha/kích thước và rà diff; chưa xác nhận bản ghép trong game. Các pose AI vẫn cần chỉnh nếu khớp giữa frame chưa đều. Chưa có rig/animation thân nhân vật riêng cho từng phản ứng; VFX mây/lông/ngôi sao và âm thanh còn dùng bản hiện có.

## Tiến độ

**T-080: Review — đã nối hình cho 12/12 loại sự cố**, bao gồm nhánh gà phụ; không có nghĩa tất cả nhánh đã được chơi thử hay nghiệm thu. Đợt05/06/07 lần lượt là nhóm1/2/3.

Cập nhật phạm vi: T-081 đã Dropped theo yêu cầu người dùng; sáu kết thúc và mốc ép ngất theo thời gian đã bỏ ở T-086. Tiếp tục UI, animation nhân vật/cứu hộ, âm thanh, tối ưu và nghiệm thu thiết bị thật. Xem rà soát hiện hành trong VERTICAL_SLICE_READINESS.md §0.

## Prompt chính xác đã dùng

### Mèo

Ảnh tham chiếu: style-reference-v1.png; nền trong suốt.

```text
Use case: stylized-concept. Asset type: transparent2.5D game orange cat animation atlas. Reference is ART STYLE ONLY: warm soft-painted Hanoi chibi game, compact cute shapes, elevated orthographic camera, upper-left soft daylight. Exact regular FOUR columns by TWO rows, EIGHT full-body poses of the SAME small orange tabby cat with cream muzzle/chest, darker orange stripes, large expressive eyes, short paws, same proportions and scale. ROW1 faces screen DOWN-RIGHT front three-quarter, ROW2 faces screen UP-RIGHT REAR three-quarter showing back and tail, both rows point RIGHTWARD so engine can mirror left. In EACH row: col1 idle on four paws, col2 running stride paws extended, col3 alternate running stride paws tucked, col4 playful raised front paw swiping/reaching as a slapstick contact pose, no injury. Keep feet on same baseline85 percent cell height, all ears/tail/paws inside equal cells with ample transparent padding, same head/body size. No floor/ground, cast shadow outside body, props, people, labels, text, grids, borders, UI or watermark. Genuine alpha background, only eight isolated cat sprites, readable at42px height.
```

### Chó nhỏ/chó lớn

Ảnh tham chiếu: style-reference-v1.png; nền trong suốt.

```text
Use case: stylized-concept. Asset type: transparent2.5D dog game animation atlas. Reference is ART STYLE ONLY, warm soft-painted Hanoi chibi game with upper-left daylight and elevated orthographic camera. EXACT regular square FOUR columns by FOUR rows, sixteen isolated full-body sprites, genuine alpha background, same character within each pair of rows, ample transparent padding for tails and ears. ROW1 small tan CHIHUAHUA facing screen DOWN-RIGHT front three-quarter, enormous upright ears, short smooth fur, tiny paws. ROW2 SAME chihuahua facing UP-RIGHT REAR three-quarter, back and tail visible. ROW3 large stocky friendly brown MASTIFF facing DOWN-RIGHT front three-quarter, broad muzzle darker brown, floppy ears, shaggy short-to-medium coat, thick paws, small red collar. ROW4 SAME mastiff facing UP-RIGHT REAR three-quarter. All face RIGHTWARD so game mirrors leftward; each dog drawn at a useful consistent source scale within its row group, game will size chihuahua much smaller. In EACH row: col1 idle four paws planted, col2 running stride paws extended, col3 alternate running stride paws tucked, col4 lean forward with open happy mouth and small pink tongue out (chihuahua yapping, mastiff goofy licking). Keep body/head proportions identical between poses, paw baseline85 percent cell height. Cute playful slapstick, no bared fangs, no violence or injury. No people, floor, cast shadows, props, labels, text, gridlines, border, UI or watermark.
```

### Chỉnh khoảng đệm chó

Ảnh tham chiếu: atlas chó lượt đầu; nền trong suốt.

```text
Edit ONLY padding/scale/placement of this dog atlas, preserving all sixteen dog poses, the exact two dog identities, clothing/collar, colors, camera and row/column order. EXACT regular4 columns by4 rows. Each complete dog silhouette including ears, tail, nose and all paws MUST fit well INSIDE its own equal cell with at least12 percent transparent padding on EVERY side. Current large mastiffs nearly touch/cross cell boundaries; shrink each sprite uniformly so it occupies at most75 percent of cell width and height, centered horizontally with paws at85 percent cell height. Keep consistent size across the four poses of a dog, and don't crop or overlap neighbors. Reconstruct any clipped nose/ear/tail/paws. No floor, cast shadows, background glow, labels, gridlines, borders, UI or watermark. Preserve genuine alpha background. Do not change breeds or replace any pose.
```

### Bồ câu

Ảnh tham chiếu: style-reference-v1.png; nền trong suốt.

```text
Use case: stylized-concept. Asset type: transparent2.5D pigeon game animation atlas. Reference is ART STYLE ONLY: soft warm-painted Hanoi chibi game with elevated orthographic camera and fixed upper-left light. EXACT FOUR columns by TWO rows, EIGHT poses of the SAME small gray street pigeon, round gray body, dark slate wing tips, subtle muted green neck, tiny orange beak and feet. ROW1 faces screen DOWN-RIGHT front three-quarter; ROW2 faces UP-RIGHT REAR three-quarter, showing back and tail. Each row points RIGHTWARD, engine mirrors leftward. EACH ROW col1 perched with folded wings, col2 flying wings lifted UP, col3 flying wings extended horizontally, col4 flying wings swept DOWN. Critical animation alignment: keep the BODY/BREAST CENTER at exactly50 percent cell width and55 percent cell height in ALL poses; wings move around a stationary body of identical size. Whole head/wings/tail fully inside equal cells with at least10 percent transparent padding, no overlap. Simplified bold feather groups, cute everyday bird, readable small. Genuine alpha background, no ground, cast shadows, breadcrumbs, people, other animals, labels, text, grids, border, UI or watermark.
```

### Chỉnh vị trí/cánh bồ câu

Ảnh tham chiếu: atlas bồ câu lượt đầu; nền trong suốt.

```text
Edit ONLY animation alignment/padding/scale in this pigeon atlas. Preserve the SAME pigeon identity, colors, eight poses, FOUR-column TWO-row order, direction and art style. Each cell must have a complete pigeon with every wingtip, tail and beak contained within at least10 percent transparent padding on every side. Current horizontally spread wings nearly cross cell boundaries: uniformly shrink ALL poses enough that widest wingspan is at most75 percent of cell width. Keep BODY size identical in all poses, and place BODY/BREAST CENTER at exactly50 percent cell width and55 percent cell height in every equal cell; wing motion only around this fixed center. Do not scale each pose separately. Reconstruct any cut wingtip. Genuine transparent background, no scene/floor/shadow/gridlines/labels/UI/text/border/watermark.
```

### Đóng gói lại bồ câu thành atlas rộng

Ảnh tham chiếu: atlas bồ câu đã chỉnh lần một; nền trong suốt.

```text
Repack the eight pigeon poses from this reference into a NEW VERY WIDE landscape atlas, with much more EMPTY TRANSPARENT horizontal space between birds. Keep four columns and two rows, same order, same character, same body size across all poses. Make canvas about THREE TIMES WIDER than tall (3:1), each of the eight cells thus wider than tall, so the horizontally extended wings fit. CRITICAL: every complete silhouette must fit inside the CENTRAL70 percent of its own cell, with NO wing pixel ever crossing a cell boundary. Full wide wings are more important than filling canvas. Leave broad transparent corridors between all neighboring birds. Body center consistent at cell50 percent x,55 percent y. Same front row down-right and rear row up-right; columns folded, wings-up, wings-flat, wings-down. No ground, shadows, labels, grid, text, frame or watermark. Genuine alpha outside birds. This is a sprite packing correction only; preserve art style and all wing tips.
```

### Gà

Ảnh tham chiếu: style-reference-v1.png; nền trong suốt.

```text
Use case: stylized-concept. Asset type: transparent2.5D white hen game animation atlas. Reference is ART STYLE ONLY: warm soft painted Hanoi chibi game, compact cute proportions, elevated orthographic camera, upper-left light. EXACT regular FOUR columns by TWO rows, EIGHT complete poses of the SAME small white hen: warm cream-white feathers, vivid small red comb/wattle, golden orange beak/feet, large friendly eyes, short fan tail. ROW1 faces screen DOWN-RIGHT front three-quarter; ROW2 UP-RIGHT REAR three-quarter showing back/tail; both RIGHTWARD so engine mirrors left. In EACH row: col1 standing calmly, col2 running with left foot forward, col3 running right foot forward, col4 fluttering with wings raised and feet hopping off ground. Consistent body/head size and feather colors across poses, feet baseline85 percent cell height, all comb/wingtips/tail/feet fully inside own equal cell with at least12 percent transparent padding. No eggs, chicks, crate, other animals, ground, cast shadow, people, text labels gridlines border UI watermark. Genuine alpha background. Readable at34px height in game.
```


