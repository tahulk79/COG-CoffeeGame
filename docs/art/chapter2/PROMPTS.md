# Màn 2 · Đường Chuyển Sinh: prompt tạo ảnh (ChatGPT)

> 2026-10-29 · Dùng cho ChatGPT (tạo ảnh). Kế hoạch màn: [CHAPTER_2.md](../../production/chapters/CHAPTER_2.md) · Phong cách chung: [ART_BIBLE](../../design/ART_BIBLE.md)
> Luồng 6 có đủ NPC/chân dung: [CHARACTER_PASS_02](CHARACTER_PASS_02.md). Luồng 7 đã tích hợp đường, trời, props, cửa và 5 rào: [ENVIRONMENT_PASS_03](ENVIRONMENT_PASS_03.md). Tái dùng art mẫu từ [SAMPLE_PASS_01](SAMPLE_PASS_01.md); tất cả vẫn chờ người dùng tự test.

## 0. Cách dùng

1. Mở một cuộc chat mới với ChatGPT, **đính kèm 2 ảnh mẫu của Màn 1** để giữ đúng phong cách:
   - `art-src/slice/chapter1/hero-v1.png` (nhân vật chính)
   - `art-src/slice/chapter1/owners-v1.png` (bà Ba, cô Sáu…)
2. Dán **khối phong cách chung (mục 1)** trước, rồi dán prompt của từng asset (mục 2–4). Mỗi asset một lượt, đừng gộp.
3. Mỗi lượt yêu cầu: **PNG nền trong suốt**, đúng kích thước và lưới ô ghi ở prompt. Không chữ, không watermark trong ảnh (chữ do game vẽ).
4. Lưu PNG gốc vào `art-src/slice/chapter2/`. Bản WebP dùng trong game ở `public/assets/slice/chapter2/`, xuất bằng `scripts/export-slice-webp.sh` (hỗ trợ `chapter2/<tên>`). Tên mẫu có hậu tố `sample-v1`, chưa thay thế tên bộ hoàn chỉnh bên dưới.
5. Kiểm tra trước khi lưu: các ô trong lưới cùng cỡ, nhân vật đứng giữa ô, chân chạm cùng một đường đáy, không bị cắt mất đầu hay tay.

**File runtime thực tế sau luồng 6:** dùng lại `scholar-sample-v1`/`scholar-portrait-sample-v1` cho cả trạm 1 và 4; ba người gác còn lại ở `keepers-extra-v1` (4×3), hai thần ở `gods-v1` (4×2), sáu chân dung bổ sung ở `portraits-extra-v1` (3×2). Không sinh lại Ông Đồ hoặc hero chỉ để gộp vào sheet. Các prompt bộ đầy đủ bên dưới là mô tả thiết kế; tên/lưới đang chạy và prompt thực tế xem CHARACTER_PASS_02.

**Môi trường sau luồng 7:** `cloud-ground-v1` là vật liệu opaque vuông 1024×1024 (game chiếu sang mặt phẳng 2:1), không dùng diamond tile trong suốt. `rebirth-door-v1` có 2 trạng thái, `props-v1` có 6 ô, `sky-v1` là ảnh opaque 2:1. Dùng lại `cloud-wall-sample-v1` cho mọi trạm và mép mây, không tạo file `cloud-wall-v1` trùng. Các prompt thực tế/quy cách đang chạy nằm trong ENVIRONMENT_PASS_03, thay phần prompt môi trường nháp bên dưới khi tái tạo asset.

### Quy cách tích hợp sau mẫu luồng 5

- Mã chuẩn: C2-01 người gác, C2-02 hai thần, C2-03 chân dung; E2-01 đường, E2-02 rào, E2-03 cửa, E2-04 props, E2-05 trời; U2-01 UI.
- Góc nhìn orthographic 3/4 nâng cao, theo ảnh Màn 1; mặt người gác hướng nhẹ sang phải màn hình. Mặt phẳng môi trường theo lưới 2:1; không xoay camera game để khớp ảnh.
- Nhân vật: ô 512×512, không tự cắt ô sát nội dung khi nạp. Giữ chung pivot/tỷ lệ giữa các pose của cùng người, chừa lề để tay/đạo cụ không sang ô bên; bốn trạng thái, không phải bốn frame đi bộ. Mẫu Ông Đồ giữ điểm chân `(282,492)`, origin nguồn `.55,.96`; world lật ngang và bù X thành `.45`. Các người khác có anchor theo từng hàng đã chuẩn hoá trong CHARACTER_PASS_02, không ép cùng anchor của Ông Đồ. Chân dung giữ chiều nguồn. Ông Đồ hiển thị toàn ô 88×88, silhouette khoảng 80 px so với hero 70 px.
- Không vẽ sẵn bệ mây/bóng lớn vào sheet người; nền và bóng đặt riêng. Chân dung có vòng nền kem và vùng ngoài trong suốt; mẫu toàn ảnh hiển thị 100×100, vòng mặt thực khoảng 80 px. Hình hero dùng lại ảnh hiện có.
- Rào: ô 1024×1024, chung origin `.5,.72`; đường chân chạy từ trái dưới lên phải trên, dốc −0,5. Ghép chéo solid/wisps theo `melt` 700 ms, đặt sau người để không che hero; va chạm giữ ở gameplay. Luồng 7 đã dùng cho cả 5 trạm; mỗi trạm có image riêng.
- Imagegen có thể trả kích thước khác yêu cầu: giữ nguyên nguồn trong `source/`, chia theo số ô đã thấy rồi resize/pad đồng đều, không kéo méo từng pose hoặc trim riêng từng ô. Các số anchor trên là quy cách của mẫu hiện tại; asset mới phải đối chiếu mẫu trước khi thay.

## 1. Khối phong cách chung (dán đầu mỗi lượt)

```text
Match the style of the attached reference images exactly (same game, same artist).
Cozy storybook 3D-rendered look for a Vietnamese mobile game: soft global illumination,
rounded chunky shapes, chibi proportions (head about 1/3 of body height), big expressive eyes,
simple hands, warm friendly faces, slightly exaggerated comedic expressions.
Lighting: key light from the upper left, warm; soft contact shadow toward the lower right.
Camera: elevated orthographic 3/4 view matching the reference characters; face slightly toward screen right.
Setting of this level: a heavenly cloud road between life and rebirth, pastel pink sky turning golden,
cream-white clouds, gold accents. Funny and kind, not scary.
Output: PNG with a fully transparent background, no text, no letters, no watermark, no frame,
every cell of the grid the same size, each figure centred in its cell with feet on the same baseline.
```

## 2. Nhân vật

### C2-01 · `keepers-v1.png`: bốn người gác trạm (lưới 4×4, 2048×2048, mỗi ô 512×512)

Mỗi **hàng** là một nhân vật, mỗi **cột** là một tư thế: (1) đứng yên, (2) đang nói, tay ra hiệu, (3) vui, gật gù (người chơi trả lời hay), (4) sốc, lắc đầu, tay ôm mặt (trả lời sai).

```text
A 4x4 character sprite sheet, 2048x2048 px, cells of 512x512.
Each ROW is one character, each COLUMN is one pose:
column 1 idle standing, column 2 talking with one hand gesturing, column 3 happy nodding and smiling,
column 4 shocked, shaking head, hand on face (comically).

Row 1 "Mr. IQ Scholar": elderly Vietnamese village scholar, long white goatee beard, round black scholar hat,
blue traditional ao dai robe, holds a small green chalkboard with chalk scribbles (no readable text),
smug know-it-all smile, no cloud pedestal; feet on a common baseline, separate shadow drawn by the game.
Row 2 "Cloud Librarian": middle-aged Vietnamese woman, round glasses, hair in a bun, lavender cardigan
and long skirt, hugs a tall stack of colourful books, strict but caring, finger to lips in the idle pose,
no cloud pedestal; feet on a common baseline, separate shadow drawn by the game.
Row 3 "Karma Scale Keeper": bald chubby old man with a calm monk-like face, golden-yellow robe,
holds a big golden balance scale above his head with both hands; the scale tilts up in the happy pose
and down with a rattle in the shocked pose, no cloud pedestal; feet on a common baseline, separate shadow drawn by the game.
Row 4 "Door Keeper Granny": tiny old Vietnamese grandmother, purple headscarf, red ao ba ba,
holds a glowing red paper lantern on a bamboo stick, cheeky grin, no cloud pedestal; feet on a common baseline, separate shadow drawn by the game.
```

### C2-02 · `gods-v1.png`: Thần Chết và Thần Cà Phê (lưới 4×2, 2048×1024, mỗi ô 512×512)

```text
A 4x2 character sprite sheet, 2048x1024 px, cells of 512x512.

Row 1 "Death God on duty" (funny, not scary): chibi grim reaper in a dark purple-black hooded robe,
pale round friendly face with sleepy half-closed eyes, holds a big silver PHO SOUP LADLE instead of a scythe,
an office-style paper file under one arm.
Poses: column 1 idle, bored; column 2 talking, reading the file; column 3 stamping the file with a red stamp,
proud; column 4 shocked, flipping the file, eyes wide, sweat drop.

Row 2 "Coffee Spirit" (the guide): a small flying white coffee cup with tiny white wings, coffee inside,
cute face on the cup, little steam curls on top, floating above a soft glow, no legs.
Poses: column 1 floating idle; column 2 talking, wings open; column 3 happy, spinning with sparkles;
column 4 apologising, bowing, embarrassed blush.
```

### C2-03 · `portraits-v1.png`: chân dung cho footer thoại (lưới 4×2, 1024×512, mỗi ô 256×256)

Footer hiển thị ảnh có **nền tròn và alpha ngoài vòng**, không cắt mask cứng vì có đạo cụ nhô khỏi vòng; mặt nằm giữa ô, chừa khoảng 10% viền và không tràn ô.

```text
A 4x2 sheet of round character portraits for a dialogue box, 1024x512 px, cells of 256x256.
Each cell: head and shoulders only, centred, facing slightly left, neutral-happy talking expression,
soft pastel circular background behind each bust (fits inside a circle with 10% margin).
Order, left to right, top row: Mr. IQ Scholar, Cloud Librarian, Karma Scale Keeper, Door Keeper Granny.
Bottom row: Death God with pho ladle, Coffee Spirit cup, the hero from the attached reference image,
and an open old karma book with a golden lotus on its cover (no readable text).
Same characters and outfits as the sprite sheets.
```

## 3. Môi trường

### E2-01 · `cloud-ground-v1.png`: mặt đường mây (1 ô lặp, 1024×512)

```text
One seamless isometric 2:1 floor tile, 1024x512 px, diamond-shaped, transparent outside the diamond.
Soft cream-white cloud ground with a faint golden path texture and a few tiny pastel flowers,
tiles seamlessly with copies of itself on all four sides. No objects, no shadows from objects.
```

### E2-02 · `cloud-wall-v1.png`: tường mây chặn trạm (lưới 2×1, 2048×1024, mỗi ô 1024×1024)

```text
A 2x1 sprite sheet, 2048x1024 px, cells of 1024x1024.
A fluffy wall of white cumulus clouds crossing an isometric road from upper right to lower left,
about 3 character heights tall, soft golden rim light.
Cell 1: solid wall, dense and puffy. Cell 2: the same wall melting away, thin and wispy,
half transparent, drifting upward with small sparkles.
```

### E2-03 · `rebirth-door-v1.png`: cánh cửa trùng sinh (lưới 2×1, 2048×1024, mỗi ô 1024×1024)

```text
A 2x1 sprite sheet, 2048x1024 px, cells of 1024x1024, isometric 3/4 view, standing on a cloud.
A tall arched heavenly door: cream wooden double doors, thick gold frame, small round lantern on top,
carved lotus and coffee bean ornaments (no text).
Cell 1: doors closed, soft glow at the seam.
Cell 2: doors swung wide open, warm white-gold light and light rays pouring out.
```

### E2-04 · `props-v1.png`: đồ trang trí hai bên đường (lưới 3×2, 1536×1024, mỗi ô 512×512)

```text
A 3x2 sprite sheet of isometric decoration props, 1536x1024 px, cells of 512x512, each on a small cloud base.
Top row: white marble column with gold cap; pink blossom tree; tall stone lantern with a warm light.
Bottom row: wooden signpost with three blank arrow boards; a small floating cloud with a golden bell;
a low cloud bench.
```

### E2-05 · `sky-v1.png`: nền trời (2048×1024, không cần nền trong suốt)

```text
A wide background painting, 2048x1024 px, no transparency, no characters.
Endless sea of soft clouds seen from above, pastel pink sky at the left turning warm golden at the right
(the road goes from left to right toward the rebirth door), a few distant floating islands and gentle light rays.
Low detail, slightly blurred so characters in front stay readable.
```

## 4. UI và hiệu ứng

### U2-01 · `ui-v1.png`: icon và biển hiệu (lưới 4×2, 1024×512, mỗi ô 256×256)

```text
A 4x2 sheet of game UI icons, 1024x512 px, cells of 256x256, cozy cartoon style matching the game,
thick dark brown outline (#5A3825), soft shading, no text.
Top row: lotus flower closed and grey; lotus half open, pale pink; lotus fully open, pink with a golden glow;
open karma book with a golden lotus on the cover.
Bottom row: white wooden sign board with a thick red border and EMPTY centre (the game writes "SAI" on it);
golden bell ringing with motion lines; small hourglass/stopwatch; golden wheel-of-fortune pointer arrow.
```

## 5. Bảng file

| Mã | File gốc (`art-src/slice/chapter2/`) | Lưới | Thay cho hình code |
|---|---|---|---|
| C2-01 | `keepers-v1.png` | 4×4 | `drawKeeper` (Ông Đồ, Bà Thủ Thư, Ông Cân, Bà Gác Cửa) |
| C2-02 | `gods-v1.png` | 4×2 | Thần Chết trong `drawKeeper`, `drawSpirit` |
| C2-03 | `portraits-v1.png` | 4×2 | Chân dung footer (`StoryHud.drawFace`) |
| E2-01 | `cloud-ground-v1.png` | 1×1 | Mặt đất `drawGardenEnvironment` |
| E2-02 | `cloud-wall-v1.png` | 2×1 | Tường mây `wall()` |
| E2-03 | `rebirth-door-v1.png` | 2×1 | Cánh cửa `heavenDoor` |
| E2-04 | `props-v1.png` | 3×2 | Cột, cây hoa, đồ trang trí |
| E2-05 | `sky-v1.png` | 1×1 | Màu nền trời |
| U2-01 | `ui-v1.png` | 4×2 | Đèn sen, Sổ Phúc Đức, bảng "SAI", chuông, đồng hồ |

Ưu tiên làm trước: **C2-01, C2-02, C2-03** (nhân vật và chân dung xuất hiện nhiều nhất), sau đó E2-02, E2-03.
