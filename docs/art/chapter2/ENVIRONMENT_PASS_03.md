# Màn 2 · Môi trường luồng 7

> 2026-10-30 · T-117 Review · Imagegen tích hợp; chưa mở game/test/typecheck/build.
> Tiếp nối [CHARACTER_PASS_02](CHARACTER_PASS_02.md), giữ map và luật chơi.

## Asset

Master ở `art-src/slice/chapter2/`, runtime cùng tên WebP ở `public/assets/slice/chapter2/`.

| Master | Lưới/kích thước | WebP | Dùng |
|---|---|---|---|
| `cloud-ground-v1.png` | 1×1, 1024×1024, opaque | 1024×1024 | Vật liệu phẳng, runtime chiếu 2:1 thành mặt đường; không phải ảnh diamond có alpha |
| `rebirth-door-v1.png` | 2×1, 2048×1024 | 1024×512 | 0 đóng, 1 mở, cùng origin .5/.85, cỡ world 248×248 |
| `props-v1.png` | 3×2, 1536×1024 | 768×512 | 0 cột, 1 cây hoa, 2 đèn đá, 3 bảng trống, 4 chuông, 5 ghế |
| `sky-v1.png` | 1×1, 2048×1024, opaque | 2048×1024 | Trời hồng trái → vàng phải, phủ viewport giữ tỷ lệ, không lặp/lật trời |
| `cloud-wall-sample-v1.png` (giữ mẫu) | 2×1, 2048×1024 | 1024×512 | Áp dụng 5 trạm và tái dùng dọc mép đảo |

Bốn WebP mới khoảng 460 KiB tổng (dung lượng file, không phải RAM/GPU). Tất cả PNG nguồn sinh gốc giữ dưới `source/`: ground 1254×1254, cửa 1774×887, props 1536×1024, trời 1774×887. Cửa chia hai ô theo bố cục rồi resize/pad đều lên 1024/ô; mặt đường/trời giữ đúng tỷ lệ; props giữ layout 3×2. Không sinh lại NPC hay rào đã duyệt.

## Cách tích hợp

- `gardenArt.ts`: mặt đường là vật liệu opaque áp vào mặt phẳng isometric 128×64/tile. Tạo pattern với bốn góc phản chiếu để các mép chia sẻ pixel; áp UV toàn map nên không kẻ/cắt lại mỗi ô. Đây là xử lý vật liệu mây, không lật ảnh trời hoặc cảnh có công trình.
- Bake một lần theo dải 8 ô (map hiện tại 6 mảng), scale .75, mỗi texture dưới 1024². Mảng có phần chồng nhỏ để hạn chế khe do lấy mẫu. Dải sáng bên trong giúp đọc lối đi; dùng ảnh mây làm bờ mềm quanh đảo. Chưa xác nhận đường nối trong game.
- Tạo ảnh canvas theo scene và xoá các texture nền tạm khi shutdown; sky/walls/props là object của scene và được huỷ khi rời màn. WebP nguồn được cache để chơi lại không tải trùng.
- `PlaceholderRenderer` ưu tiên sprite mới cho cửa/cây/cột, giữ footprint và depth theo map; làm mờ khi silhouette che hero phía sau. Đèn/bảng/chuông/ghế thêm ở ngoài vùng đi, không thêm blocker hoặc thay `afterlife.json`. Không đổi đường tới trạm/cửa.
- `TrialEffects` giữ hai image solid/wisps riêng theo ID của từng trạm, tan theo `melt` có sẵn. Rào ảnh đặt sau người để không phủ kín hero; va chạm vẫn do service.
- `CloudSky` crop ảnh hồng/vàng theo tiến độ X từ điểm bắt đầu tới Bà, giữ tỷ lệ và phủ viewport sau resize/zoom. Đi ngược đường sẽ thấy lại phần trời hồng hơn; đây là chuyển theo vị trí, không bộ đếm thời gian.
- `queueWorldAssets` chỉ bổ sung registry Màn 2 khi map đích là `afterlife`. Boot Màn 1 chưa tải nó; vào thẳng `?chap=2` hoặc chuyển S03→S04 nạp ở preload WorldScene. Các asset chung/Màn 1 vẫn theo pipeline trước. Chưa nghiệm thu tải thật.
- Cửa đổi frame theo `StoryPresenter` khi `portalOpen`; giữ nhịp mở 700 ms → quay → chuyển màn của luồng 4. Ảnh dự phòng/code vẫn có nếu file không tải được.

Bề mặt bake hiện theo hình chữ nhật 46×9 của map hiện tại; nếu sau này đổi đường thành đảo có lỗ hoặc biên khác cần đổi clipping. Ở lượt này map và collision giữ nguyên. Mức FPS, thời gian tải và bộ nhớ thiết bị chưa đo.

Xuất lại:
```sh
zsh scripts/export-slice-webp.sh chapter2/cloud-ground-v1 chapter2/rebirth-door-v1 chapter2/props-v1 chapter2/sky-v1
```

## Prompt thực tế

Tạo bằng imagegen tích hợp, không CLI/API key. Ground/sky `transparent_background=false`, cửa/props `true`. Tham chiếu scholar mẫu và rào cho phong cách; trời dùng rào làm tham chiếu màu.

### Vật liệu đường mây

```text
Use case: stylized-concept. Create a seamless SQUARE 1024x1024 game ground MATERIAL TEXTURE, fully opaque edge to edge, NOT an isometric diamond (the game projects it). Reference scholar and cloud barrier are style/palette references only; no characters or props. Cozy storybook painted 3D aesthetic, cream-white heavenly cloud road surface, very soft rounded small cloud swirls, faint warm ivory/gold dust, subtle pearly highlights, exceptionally low contrast so a dark outline chibi character reads clearly. Flat straight top-down orthographic material with uniform diffuse upper-left illumination, no directional cast shadows. Seamless across all four boundaries, consistent detail density, no central spotlight, no large repeated motifs. NO objects, flowers, islands, skyline, buildings, text, borders, grid lines, diamond edges, watermark or transparency. Looks like soft walkable cloud ground rather than realistic storm clouds.
```

### Cửa đóng/mở

```text
Use case: stylized-concept. A 2-column ONE-row production sprite sheet of the SAME heavenly rebirth door, 2048x1024, two equal square cells, true transparent background. Cozy storybook painted 3D aesthetic matching reference scholar and cloud barrier, warm brown contours and upper-left golden light. Elevated orthographic 3/4 camera consistent with 2:1 isometric game. Tall cream wooden double doors within a thick gold arch, modest carved LOTUS and COFFEE BEAN motifs, a small round lantern above arch. Door faces toward lower-left on screen so the hero approaches from there. Cell left: closed double doors, thin soft glow at centre seam. Cell right: exact same frame in exact same position, both leaves swung open, soft white-gold light through doorway and a few short rays. Each door full silhouette within 80px safe margins, same scale and anchored footprint centre x512 y864 of its cell. No stairs or large cloud pedestal, no scenery or people, no written text, watermark, cell outlines or extra doors. Keep all glow contained inside each cell, transparent outside prop. Two aligned states, not two designs.
```

### Sáu props

```text
Use case: stylized-concept. Six separate isometric heavenly-road decoration props in ONE 3-column 2-row sprite sheet, 1536x1024, six equal square cells, fully transparent background. Match the cozy Vietnamese storybook painted 3D game style of the reference scholar and cloud barrier: warm dark brown contours, cream white cloud bases, restrained gold, pink blossoms, warm upper-left light. Orthographic elevated 3/4, foot bases use isometric 2:1 diamonds. Top row left to right: (1) short white marble pillar with gold cap and lotus decoration (2) small rounded pink blossom tree with brown trunk (3) short carved cream stone lantern glowing warm amber. Bottom row: (4) wooden signpost with three BLANK arrow boards (5) small floating cloud with a hanging gold bell (6) low bench sculpted from fluffy cloud, ivory/gold trim. Exactly one object per cell, each on a small cloud base. Fully contain all branches, bases and glow within its own cell with 48px safe margins, footprint centre x256 y432 in each cell, same projection throughout. No large cast shadows, rectangle backdrops, people, scenery, sky, readable text, labels, borders or watermark. True alpha transparency outside each object.
```

### Trời hồng → vàng

```text
Use case: stylized-concept. Wide 2048x1024 opaque background painting for a cozy Vietnamese storybook heavenly cloud-road game. Style and palette reference is the supplied cream/gold cloud barrier only, no characters. Endless soft distant sea of clouds seen slightly from above, low horizon and spacious sky. LEFT half pastel blush pink/lilac dawn, smoothly becoming warm ivory/gold sunlight at RIGHT. A few tiny very distant floating cloud islands, gentle light rays, no identifiable buildings. Restrained soft painted 3D storybook shading, slightly blurred, LOW DETAIL and LOW CONTRAST so foreground chibi characters and UI stay readable. Fill entire rectangle, no transparency. No road in foreground, no large foreground props, doors, trees, people, text, frames, watermark, solid blank corners or hard transitions. Pink and gold are both visible, blended continuously across width; suitable to crop a moving viewport from left to right during travel.
```

## Bàn giao

Đã xem nguồn, đọc alpha/kích thước và xem WebP cửa/props trên nền tĩnh. Rà code ghép mảng, UV, depth, đổi frame cửa, preload, cleanup và camera trong phiên bản Phaser cài tại repo. Chưa mở game, chạy test/typecheck/build hoặc đo FPS/tải/RAM.

Người dùng cần thử cả `?chap=2` và đi Màn 1→2: nhìn mặt đường ở mép/mối nối, 5 rào, vị trí props/che khuất, trời khi đi tới/lùi và khi xoay, cửa đóng/mở, rồi rời/chơi lại. Chưa làm UI/âm thanh/hiệu ứng cuối của luồng 8.

