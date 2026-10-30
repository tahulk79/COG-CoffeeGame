# Màn 2 · Nhân vật và chân dung luồng 6

> 2026-10-30 · T-116 Review · Imagegen tích hợp; chưa mở game/test/typecheck/build.
> Tiếp nối mẫu [SAMPLE_PASS_01](SAMPLE_PASS_01.md); giữ môi trường cho luồng 7.

## Asset đã tích hợp

Master ở `art-src/slice/chapter2/`, runtime cùng tên WebP ở `public/assets/slice/chapter2/`.

| Master PNG | Lưới/kích thước master | Runtime | Nội dung |
|---|---|---|---|
| `keepers-extra-v1.png` | 4×3, 2048×1536 | 1024×768 | Hàng 0 Thủ Thư; 1 Ông Cân; 2 Bà Gác Cửa |
| `gods-v1.png` | 4×2, 2048×1024 | 1024×512 | Hàng 0 Thần Chết; 1 Thần Cà Phê |
| `portraits-extra-v1.png` | 3×2, 1536×1024 | 768×512 | 0 Thủ Thư, 1 Ông Cân, 2 Bà Gác Cửa, 3 Thần Chết, 4 Thần Cà Phê, 5 Sổ |

Tái dùng `scholar-sample-v1.png` và chân dung mẫu ở cả trạm 1 lẫn 4; hai trạm có hai image riêng để không di chuyển nhầm sprite. Hero giữ hình và chân dung Màn 1. Như vậy có 6 NPC × 4 trạng thái và 8 chân dung kể cả hero/Sổ; chưa làm animation nhiều frame.

Người gác: cột 0 idle, 1 nói, 2 vui, 3 sốc. Thần Chết: idle/đọc hồ sơ/đóng dấu/sốc. Cốc: idle/nói/vui/xin lỗi. Dòng twist có `expression: surprised`, dòng nhận lỗi có `expression: apology`; hướng diễn này không đổi Phúc Đức hoặc cue âm thanh. Mọi trạng thái vẫn theo thoại/phản hồi thật; không sinh thêm câu hỏi để ép biểu cảm.

Registry giữ đủ ô và chia frame theo hàng. `TrialEffects` dùng map sprite theo ID, có fallback nếu thiếu ảnh/frame, ẩn khi không còn view và huỷ lúc rời scene. Thần Cà Phê dùng sprite bay theo vị trí mô phỏng, nhún nhẹ theo đồng hồ mô phỏng nên menu dừng nó. `DialogueFooter` nhận texture kèm frame, giữ cơ chế hero và painter dự phòng.

## Nguồn và chuẩn hoá

Nguồn gốc giữ trong `art-src/slice/chapter2/source/`:
- `keepers-extra-generation-v1.png`: 1448×1086, hàng thô không đều; chia lại ba hàng trước khi yêu cầu bỏ lớp nền mờ.
- `keepers-extra-cleanup-v1.png`: bản đã bỏ nền, giữ ba hàng; resize cả bố cục về 2048×1536. Đèn lồng pose vui vượt ranh ô vài pixel: đóng gói lại riêng hàng Bà theo biên 0/512/1024/1560/2048, cùng tỷ lệ 90%, bù vị trí khi pad để không kéo méo hay đổi tỷ lệ từng pose.
- `gods-generation-v1.png`: 1774×887; Thần Chết chiếm dải y0–534, cốc y535–886. Cắt theo dải thực, chia 4 cột, resize đồng đều từng hàng và pad thành ô 512, ghép lại 4×2. Không chia máy móc ở y443 khiến cắt chân Thần Chết.
- `portraits-extra-generation-v1.png` và `portraits-extra-cleanup-v1.png`: giữ cả lần tạo và lần yêu cầu bỏ nền. Chân dung mới dùng tham chiếu từ sheet người và thần, không tạo độc lập từ mô tả.

Metadata world sau chuẩn hoá (full-cell, không trim):

| Người | Cỡ toàn ô world | Origin | Ghi chú |
|---|---|---|---|
| Ông Đồ | 88 | .45/.96 | giữ mẫu, flip X |
| Thủ Thư | 92 | .45/.967 | flip X |
| Ông Cân | 100 | .43/.934 | flip X; cân thay tư thế trong ảnh, chưa rig chuyển động riêng |
| Bà Gác Cửa | 96 | .45/.86 | flip X; bù sau đóng gói lại đèn lồng |
| Thần Chết | 104 | .44/.932 | flip X |
| Thần Cà Phê | 96 | .52/.55 | không flip; nhỏ hơn người, không có chân |

Chân dung toàn ô 100×100 trước scale mobile, phần nền tròn khoảng 80–90px. Một số đạo cụ nhô khỏi vòng nhưng nằm trong ô; không dùng mask tròn cứng để cắt mất đèn lồng/muôi.

Xuất runtime:
```sh
zsh scripts/export-slice-webp.sh chapter2/keepers-extra-v1 chapter2/gods-v1 chapter2/portraits-extra-v1
```

## Prompt thực tế

Ảnh tham chiếu: người gác/thần theo scholar mẫu; chân dung theo hai sheet mới. Các lượt đều `transparent_background=true`, dùng imagegen tích hợp, không CLI/API key.

### Người gác · tạo mới

```text
Use case: stylized-concept. Production sprite sheet for the SAME Vietnamese cozy storybook game as reference scholar. Reference image is style/scale reference, NOT an edit target. Create a 4-column by 3-row sheet, 2048x1536, equal 512-square cells, transparent PNG, no text or grid lines. Warm painted 3D chibi style, gentle dark brown contours, warm upper-left light, elevated orthographic 3/4 view, all faces slightly toward screen right. EACH ROW one identical character across four states. Columns left to right: idle; talking/gesturing; pleased happy; comically shocked/disappointed. Row 1 Cloud Librarian: middle-aged Vietnamese lady, hair bun, round glasses, lavender cardigan over long pale purple skirt, dark shoes, colourful books held in one arm, free hand at lips idle. Row 2 Karma Keeper: bald chubby kind elderly man, golden yellow monk-like robe, large gold balance scale held at shoulder height, scale tilts slightly for happy/shocked, same scale and face all columns. Row 3 Door Granny: petite old Vietnamese grandmother, purple headscarf, red ao ba ba blouse, dark trousers and cloth shoes, bamboo stick holding small glowing red paper lantern, cheeky friendly face. Full bodies, same scale and foot baseline within each row, feet near y480 of each cell, keep all hats/hands/scale/lantern inside with 32px safe margin. No cloud bases, no scenery, no large cast shadows. Do NOT include the reference scholar or extra characters. Genuinely transparent background, no letters, labels, captions, borders or watermark. Keep these characters visually compatible with the reference scholar.
```

### Hai thần · tạo mới

```text
Use case: stylized-concept. Create a production 4-column x 2-row sprite sheet, 2048x1024, eight equal square cells, fully transparent background. Reference scholar is style/scale reference only: same cozy Vietnamese mobile storybook game, soft painted 3D chibi illustration, warm brown contours, warm upper-left light, elevated orthographic 3/4 facing slightly screen right. Row 1: friendly sleepy Death God on office duty, round pale human face, dark purple-black hooded robe, holds unmistakable silver PHO SOUP LADLE instead of scythe and an office paper file. Same character each column: (1) bored idle holding ladle and file (2) talking reading file (3) proudly stamping file with a red rubber stamp (4) shocked discovering paperwork mistake, wide eyes and sweat drop. Row 2: Coffee Spirit, a small WHITE CERAMIC COFFEE CUP with cute face, coffee inside, tiny white wings and steam, NO LEGS or human body. Same cup each column: (1) floating idle (2) talking wings spread (3) happy with a few sparkles (4) bowing apologetically, embarrassed blush. Entire silhouettes and props contained within their own cell, 40px safe gutters, equal scale and fixed pivot per row. Align Death God's robe bottom near y470 within each cell; Coffee cup centre fixed x256 y286 within each cell, wings extend symmetrically. NO cloud platform, backdrop, caption, letters on file, grid borders, watermark, horror, skull or scythe. Genuinely transparent alpha outside sprites.
```

### Chân dung · tạo mới

```text
Use case: stylized-concept. Create a 3-column by 2-row sheet of SIX circular dialogue portraits, 1536x1024, equal 512-square cells, same cozy Vietnamese storybook style as supplied references. First reference = librarian/scale keeper/granny identity, second = Death God/Coffee Spirit identity. Preserve their EXACT faces, outfits, props and soft painted 3D shading. Each cell has ONE head-and-shoulders portrait inside a soft cream circular medallion, centred x256 y256, diameter400px, transparent outside circle, all hat/beard/props inside circle, 48px safe margin. Top row left to right: (1) Cloud Librarian, bun, round glasses, lavender clothes and colourful books; (2) bald Karma Keeper, gold robe and small gold balance scale; (3) Door Granny, purple headscarf, red ao ba ba, glowing red lantern. Bottom row left to right: (4) friendly sleepy Death God, purple-black hood, silver pho soup ladle and blank file; (5) white ceramic Coffee Spirit cup, coffee, tiny white wings, steam and cute smiling face, no body; (6) open old cream-page Karma Book with brown leather cover and gold lotus ornament, no letters. Mild happy talking expressions, face slightly screen right, warm upper-left light, gentle brown contours. No grid, no labels, no written text, no watermark, no rectangle backgrounds, no extra people. Real alpha transparency in gutters and outside every circular medallion.
```

### Chân dung · bỏ nền

```text
Edit target is the supplied six-portrait sheet. PRECISE BACKGROUND REMOVAL ONLY. Keep all six portrait artworks, faces, clothing, medallions, props, positions, sizes and the 3-column 2-row layout unchanged. Remove the brown/gold rectangular backdrop completely to true alpha transparency outside the six circular medallions. Preserve the cream interior of each circle and the lantern that overlaps its circle. NO rectangle shadow, brown haze or residual colour outside circles. Keep safe transparent gutters between portraits. Do not redraw characters or crop any portrait. Output PNG with real transparency, same 1536x1024 composition.
```

### Người gác · bỏ nền

```text
Use case: background-extraction. Edit this 4-column by 3-row full-body character sprite sheet only to clean its alpha background. Preserve all 12 figures EXACTLY, identities, expressions, costumes, books, scale, lanterns, positions, sizes and the existing equal cell layout. Remove ALL faint rectangular grey/brown backdrop and ALL floor shadows from outside the figures. Make every gutter and background pixel fully alpha-zero transparent; especially behind the bottom row of grannies and middle row of scale keepers. Keep the lantern glow only immediately beside lantern glass, not a square haze. Do not redraw, recolour, crop, move or resize any figure, do not add platforms. Output transparent PNG, same 2048x1536 composition and 4x3 cells.
```

## Bàn giao

Đã xem nguồn, master và WebP trên nền trời/giấy tĩnh; đọc alpha/kích thước, rà frame/pivot/portrait/cleanup. Chưa mở game, test, typecheck hoặc build, chưa đo hiệu năng hay nghiệm thu PC/mobile.

Cần người dùng kiểm tra mở màn → 5 trạm → Bà Gác Cửa: đúng người/đạo cụ/biểu cảm, chân không nhảy và không cắt tay/đầu; đổi người nói không sót portrait. Rào mới vẫn chỉ ở trạm 1; đường/cửa/props/trời giữ cho luồng 7. Các giới hạn hiện tại: bốn pose tĩnh mỗi NPC, portrait một biểu cảm, asset nạp cùng boot theo pipeline cũ.

