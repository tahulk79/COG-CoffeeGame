# Bộ ảnh UI theo mẫu — v1

Ngày: 2026-10-30. Trạng thái: Review, chờ người dùng duyệt ảnh. Tạo bằng imagegen tích hợp; chưa ghép vào game, chưa đổi camera/map. Không chạy game/test/typecheck/build.

## Bàn giao

Master PNG: `art-src/slice/chapter2/reference-ui/`. Bản dùng cho game: `public/assets/slice/chapter2/reference-ui/`. Giữ nguyên ảnh nguồn tại `source/`.

- `island-scene-v1.png`: nền 1774×887, góc nhìn isometric cố định, không HUD/nhân vật/chữ. Đây là ảnh nền phẳng; khi triển khai cần vùng đi bộ/va chạm riêng và lớp che phía trước nếu nhân vật đi sau cây/lan can. Chưa phải tilemap hoặc scene đã chơi được.
- Sáu PNG trong suốt: `player-panel-v1.png`, `progress-panel-v1.png`, `quest-panel-v1.png`, `karma-panel-v1.png`, `dialogue-panel-v1.png`, `action-button-v1.png`. Cắt riêng từ atlas bằng ImageMagick; có padding 8px, chữ/portrait/tiến độ ghép bằng code. Kích thước ảnh sinh không theo lưới đều, không dùng atlas thẳng như spritesheet.
- Bốn icon PNG trong suốt, mỗi ảnh 272×272: `map-icon-v1.png`, `bag-icon-v1.png`, `journal-icon-v1.png`, `settings-icon-v1.png`.
- `source/user-reference-v1.png`: ảnh mẫu người dùng; `source/panels-v1.png` và `source/menu-icons-v1.png`: đầu ra gốc.

Đã xem ảnh nền/atlas, kiểm kênh alpha và xem khung trên nền kem. Chữ cố ý bỏ khỏi ảnh để giữ rõ tiếng Việt và co giãn UI; icon chưa gắn hành động. Nhân vật hiện tại vẫn là bộ riêng của các luồng trước.

## Prompt nền

Use case: stylized-concept. Asset type: playable game environment background, landscape 2:1, highest available resolution. Input image 1 is the exact art direction and composition reference. Create a CLEAN ENVIRONMENT PLATE of this heavenly cloud island, matching the rich cozy painted storybook style, cream stone, ornate warm gold railings, cherry blossom pink foliage, peach sunset clouds, floating mountains and waterfalls. Preserve the reference's wide fixed isometric diorama composition: ornate blue-roof glowing arrival gate on left, large EMPTY central paved plaza, bridges to a small upper-right temple and lower-right circular library terrace with a small desk and books. Connected walkable stone routes visibly coherent; generous open central space for movable characters. Preserve left foreground arched bridge, right descending stairway, blossom trees around edges, layered distant floating temples and waterfall depth. Paint the scenery naturally behind all removed overlays. Frame whole main island with cloud margins, no rectangular tile-map borders. REMOVE ALL UI, HUD, panels, buttons, icons, dialogue boxes, names, progress bars, speech bubbles, exclamation marks, portraits, humans, NPCs, player, cup mascot and all writing. No characters at all. No text or watermark. Only the environment, polished production illustration matching reference closely. Opaque full-frame background.

## Prompt khung UI

Use case: ui-mockup. Asset type: reusable transparent game UI panel atlas. Input image 1 is STYLE REFERENCE for cream parchment and warm golden-brown ornate game HUD. Generate a landscape 2:1 PNG atlas with exactly SIX SEPARATE EMPTY UI components in a tidy TWO COLUMN by THREE ROW equal-cell grid. Each component entirely contained in its cell with generous transparent gutters. Order row1 left: horizontal player status frame, circular EMPTY portrait socket joined to rounded cream panel with empty inset experience bar; row1 right: rounded horizontal cream progress panel with five empty circular sockets aligned on the right and blank area left. Row2 left: parchment quest panel with gold corner posts, blank brown header strip and spacious blank cream body; row2 right: small horizontal rounded cream currency panel, blank interior. Row3 left: wide dialogue panel, cream interior, rounded golden-brown border and attached small blank brown speaker-name tab upper-left; row3 right: caramel gold rounded action button blank centre. Match reference painted storybook shading, fine dark brown outlines, warm gold bevels, restrained ornamental corners. Make flat front-facing UI, no perspective. All writing areas EMPTY; no text, letters, numbers, labels, portraits, characters, symbols, scenery, icons or watermark. Genuine transparent background outside all six components and inside portrait socket; no colored rectangular backdrop, no grid lines. Components are reusable separate pieces, NOT a full screenshot.

## Prompt icon

Use case: stylized-concept. Asset type: transparent game menu icon atlas. Input image is style reference. Create EXACTLY FOUR icons in a single evenly spaced horizontal row, each in an equal square cell, landscape4:1 if possible, no overlap, generous transparent padding. Left to right: folded cream parchment MAP with green hills and small red location pin; warm tan leather BACKPACK with flap and clasp; brown leather JOURNAL with embossed rectangular cover and cream page edges; dark warm-brown SETTINGS GEAR with central cream circular hole. Each object sits inside its own cream rounded-square medallion with softly beveled golden border, matching the top-right menu buttons in the reference. Cute polished storybook painted game art, golden highlights, clear brown outlines, readable at64px. Straight front view. No text, no captions, no letters, no numbers, no watermark, no character, no scenery, no notification dots. True transparent background outside the four individual rounded-square buttons. Four icons only, one row, consistent scale.



## Đã ghép vào game (T-120)

Xem [ISLAND_ACCEPTANCE](ISLAND_ACCEPTANCE.md). Runtime dùng WebP từ master PNG; riêng karma-panel-v2 cắt sát mép alpha từ v1 để khung thoại trên điện thoại không có đệm rỗng quá lớn. Bản v1 và ảnh sinh gốc giữ nguyên. Camera/map và UI đã nối; các đoạn “chưa ghép” ở trên mô tả thời điểm bàn giao ảnh ban đầu.
