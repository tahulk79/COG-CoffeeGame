# Màn 2 · Mẫu art luồng 5

> 2026-10-30 · T-115 Review · Chỉ trạm 1; chờ người dùng chơi duyệt.
> Dùng imagegen tích hợp, không dùng CLI/API key. Tham chiếu Màn 1: `hero-v1.png`, `owners-v1.png`.

## File và cách dùng

Tất cả tên dưới đây nằm trong `art-src/slice/chapter2/`; runtime cùng tên `.webp` trong `public/assets/slice/chapter2/`.

| File PNG | Master chuẩn hoá | WebP | Dùng ở |
|---|---|---|---|
| `scholar-sample-v1.png` | 2048×512, 4×1 | 1024×256 | Trạm 1: idle/talking/happy/shocked, giữ nguyên ô, source pivot .55/.96; flip X và origin .45/.96 trong world, toàn ô 88×88 |
| `scholar-portrait-sample-v1.png` | 512×512 | 256×256 | Footer `scholarSample`, toàn ảnh 100×100, có nền tròn trong ảnh |
| `cloud-wall-sample-v1.png` | 2048×1024, 2×1 | 1024×512 | Chỉ rào trạm 1, solid/wisps, origin .5/.72 |

Nguồn chưa chuẩn hoá giữ riêng: `source/scholar-generation-v1.png` (2172×724), `source/scholar-portrait-generation-v1.png` (1254×1254), `source/cloud-wall-generation-v1.png` (1774×887). Công cụ trả kích thước khác yêu cầu. Đã chia 4/2 ô theo bố cục thực tế, resize giữ tỉ lệ và pad trong suốt đồng đều; không sửa vẽ hoặc trim từng pose. Foot baseline alpha sau chuẩn hoá ở y490–491 cho cả bốn ô. Bốn pose có thể lệch chi tiết vẽ nhỏ, chưa phải rig/animation nhiều frame.

`CHAPTER2_SLICE_ASSETS` trong `sliceAssets.ts` chia full cell riêng với cách trim của Màn 1 để giữ pivot. Nạp ảnh qua `queueWorldAssets` sẵn có; ba ảnh mẫu vẫn nạp lúc boot như pipeline hiện tại, chưa tải theo chương. `TrialEffects` dùng lại image giữa các frame và huỷ khi rời scene. Người và rào khác giữ prototype; thiếu ảnh/frame có fallback. Footer nhận callback texture tuỳ chọn và dùng painter cũ nếu ảnh không sẵn có.

Rào đặt sau người ở mẫu để không che hero. Solid/wisps ghép alpha và nâng nhẹ theo `melt` 700 ms; không đổi luật va chạm. Khi NPC đang chào/hỏi dùng pose talking; trả lời đúng hoặc hài dùng happy, sai dùng shocked; còn lại idle. Câu trạm 1 nào không có mood sai sẽ không hiện shocked khi chọn câu hài.

Xuất lại riêng ba ảnh (không chạy build):

```sh
zsh scripts/export-slice-webp.sh chapter2/scholar-sample-v1 chapter2/scholar-portrait-sample-v1 chapter2/cloud-wall-sample-v1
```

## Prompt thực tế

### Ông Đồ · tham chiếu hero và owners Màn 1 · transparent_background=true

```text
Use case: stylized-concept. Create a production game sprite sheet, NEW character inspired by the two reference sprite sheets' exact cozy chibi painted/soft 3D storybook style and warm dark brown contours. Transparent PNG, landscape 2048x512, FOUR equal square cells in ONE ROW, no text, no grid lines. Subject in every cell is the SAME elderly Vietnamese village scholar: kind expressive eyes, round black traditional scholar hat, long white goatee, blue ao dai robe, dark shoes, holding a small dark green wooden chalkboard with only abstract chalk strokes, no letters. Full body from hat to shoes, no cloud pedestal, no scenery. Fixed orthographic elevated 3/4 camera matching reference characters, face angled slightly toward screen right (toward hero on the road). Warm upper-left lighting, soft shading. Left to right: idle knowing smile holding board; talking with free hand gesturing; happy nodding smile; shocked hand on face. All four figures SAME height, scale and location within their 512px cell; head top about y48, shoe contact at y464, centre foot pivot x256 y464. Keep 40px clear margin on every cell boundary, no hands or board crossing boundary. Identical clothing/hat/beard/board throughout; no extra figures, background shadows, captions, watermark or ground. Real alpha transparency outside figures.
```

### Chân dung · tham chiếu scholar-sample-v1 · transparent_background=true

```text
Use case: stylized-concept. Generate ONE circular dialogue portrait PNG 512x512 for the EXACT elderly Vietnamese scholar in reference. Reference is identity/style reference, not an edit target. Same warm friendly face, thick white eyebrows, long white pointed goatee, round black scholar hat, blue ao dai with pale collar. Head-and-shoulders bust, slightly facing screen right, cheerful talking expression. Cozy chibi storybook game illustration with warm brown contours and soft 3D painted shading, not glossy plastic. Centre face inside a pale cream circular medallion of radius210px at centre256,256; all hat, beard and shoulders fit inside this circle, at least40px transparent outer margin. No full body, no text, no border/frame, no speech bubble, no watermark. Real alpha transparency outside the circular medallion; only one portrait.
```

### Rào · tham chiếu hero Màn 1 và scholar-sample-v1 · transparent_background=true

```text
Use case: stylized-concept. Create a TWO-CELL horizontal sprite sheet 2048x1024, two equal 1024-square cells. Transparent background. Cozy Vietnamese storybook isometric game, soft painted 3D shading with warm brown contour edges matching references (style references only; NO characters in output). Subject: a fluffy cream white CLOUD BARRIER across a narrow heavenly road, gold rim light and a few small pastel sparkles. Isometric 2:1 projection: its long foot-contact line goes from lower LEFT to upper RIGHT at slope -0.5 on screen. Foot-contact endpoints relative to each square: (112,864) and (912,464), footprint centre (512,664). Medium-low cloud bank with rounded puffs about one character height, never a towering vertical opaque curtain; top cloud contour roughly 200px above foot-contact line. No road or ground or platform drawn. Cell 1: solid dense soft cloud bank. Cell 2: SAME exact placement/footprint but dissolving into thin separated wisps drifting upward with tiny gold sparkles; genuinely transparent gaps. Keep 64px margins, do not cross the middle boundary. No text, no people, no doors, no frame, no watermark, no checkerboard painted into transparency. Real alpha, soft semitransparent edges.
```

## Đã xem và còn chờ

Đã xem nguồn, sheet chuẩn hoá, WebP rào trên nền trời tĩnh; đọc kích thước/kênh alpha, xuất thành công ba WebP (~160 KiB tổng), rà caller nạp/frame/footer/cleanup. Đây là kiểm tra asset và code, không phải chơi thử.

Chưa mở game, chưa chạy test/typecheck/build; chưa xác nhận góc nhìn/tỉ lệ/che khuất trên PC/mobile, độ mượt hoặc cảm nhận phong cách trong cảnh. Chờ duyệt trước khi làm luồng 6.

Người dùng vào `?chap=2`, đọc hết mở màn, tới trạm 1 để xem NPC/portrait; thử phản hồi, rào tan, đổi người nói hero/Sổ rồi xoay màn. Trạm 4 vẫn hình cũ là đúng phạm vi mẫu. Checklist đầy đủ ở [kế hoạch luồng 5](../../production/chapters/CHAPTER_2_IMPLEMENTATION.md).
