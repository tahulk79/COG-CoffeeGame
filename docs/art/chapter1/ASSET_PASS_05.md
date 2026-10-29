# Chương 1 — đợt 05: sự cố, nhóm 1/3

Ngày: 2026-10-28. Trạng thái **Review** cho bốn loại đầu, chưa nghiệm thu. Sinh ảnh bằng imagegen tích hợp, đã nối vào mã hiển thị; chưa chạy game/test/typecheck/build theo yêu cầu người dùng tự thử. Chưa push đợt asset.

## File bàn giao

| Asset | Quy cách | Trạng thái |
|---|---|---|
| [hazard-banana-v1.png](../../../public/assets/slice/chapter1/hazard-banana-v1.png) | Atlas alpha 2 cột × 1 hàng | vỏ thường và vỏ thứ hai của nhánh né |
| [hazard-durian-v1.png](../../../public/assets/slice/chapter1/hazard-durian-v1.png) | Atlas alpha 2 cột × 1 hàng | quả nguyên khi rơi, nứt hai nửa khi chạm đất |
| [hazard-water-v1.png](../../../public/assets/slice/chapter1/hazard-water-v1.png) | Atlas alpha 2 cột × 2 hàng | chậu, dòng nước, bắn nước, vũng nước |
| [hazard-shuttlecock-v1.png](../../../public/assets/slice/chapter1/hazard-shuttlecock-v1.png) | Atlas alpha 2 cột × 2 hàng | bốn dáng bay của cùng quả cầu, đầu đỏ và lông kem |

Các PNG runtime nằm trong public/assets/slice/chapter1/. Khi đăng ký texture, cạnh dài tối đa lần lượt256/384/512/384 pixel; giữ PNG nguồn và đọc alpha để bỏ phần padding của frame. Đã đọc metadata xác nhận file có kênh alpha; chưa đo hiệu năng thực tế.

## Phần đã ghép

- Vỏ chuối nằm trên nền, có dấu cảnh báo nhẹ lúc warn. Nhánh vỏ thứ hai dùng biến thể riêng và tiếp tục lấy twist từ mô phỏng. Khi trượt, vỏ có thêm chuyển động nhẹ bên chân.
- Sầu riêng rơi theo progress của pha cảnh báo, giữ bóng/vòng vị trí đáp. Đổi hình nứt khi đã xuống đất; cảnh trúng đầu dùng cùng hình quả nguyên, giữ hiệu ứng choáng và pose nhân vật hiện có.
- Chậu nghiêng dần, dòng nước kéo xuống ở cuối pha cảnh báo; sau đó đổi sang nước bắn/vũng nước theo active/gone. Cảnh trúng có nước bắn cùng các giọt hiệu ứng code hiện có.
- Quả cầu chỉ xuất hiện khi active sau vạch cảnh báo; đổi bốn khung theo progress và lật theo hướng bay. Khi trúng, tiếp tục hình bật ra và ngôi sao choáng.
- Sprite cảnh báo/va chạm được dùng lại theo ID, không tạo texture mới mỗi frame; dọn khi pha kết thúc và khi hủy view. Giữ hình code dự phòng nếu frame chưa tải.
- Không thay RunService: điểm sinh, thời gian cảnh báo, bán kính trúng, nhánh né, điều kiện ngất và cứu hộ giữ nguyên. Chỉ thay phần hiển thị trong IncidentRunView.

Đây là chuyển động sprite được điều khiển bằng progress gameplay, chưa phải bộ animation nhân vật ngã riêng cho từng sự cố. Pose ngã/choáng vẫn theo hệ hiện có.

## Cần tự thử

1. Vỏ đầu và vỏ thứ hai: dễ thấy ở camera mobile, không trúng ngoài vùng hình một cách khó hiểu.
2. Sầu riêng: vòng đáp nhìn được trước va chạm; quả rơi, chạm đầu/đất hợp lý; né sát còn nhánh mùi theo logic cũ.
3. Nước: dòng nối với mép chậu, tới vị trí cảnh báo đúng lúc; kiểm tra khi ngã sát mặt tiền nhà và khi mở cài đặt.
4. Quả cầu: hướng bay và vạch cảnh báo khớp; không có bóng ảnh còn sót sau va chạm/hết sự cố/chuyển chương.
5. Giữ rõ chữ, người chơi và dấu nguy hiểm khi nhiều sự cố xuất hiện cùng lúc trên mobile dọc/ngang.

Đã xem atlas và rà diff, chưa xác nhận chúng khớp trong game. Water VFX có đổi trạng thái bằng frame, chưa có chuỗi mô phỏng nước liên tục; các ảnh AI có thể cần chỉnh lại kích thước/điểm gắn sau tự thử. Âm thanh vẫn là bản tạm.

## Các nhóm còn lại của T-080

Cập nhật sau đợt này: [nhóm2 đã được nối trong đợt06](ASSET_PASS_06.md) và [nhóm3 ở đợt07](ASSET_PASS_07.md), tổng12/12 loại đang chờ tự duyệt. Thống kê4/12 bên dưới là trạng thái lúc tạo đợt05.

- Nhóm2: hố/nắp cống, quần áo, dép và xe chở hàng.
- Nhóm3: mèo, chó nhỏ/chó lớn, bồ câu và gà.

Tổng thể T-080 vẫn **Doing — 4/12 loại đã được thay hình và chờ Review**, không coi tám loại còn lại hoặc toàn bộ Vertical Slice là đã hoàn thành.

## Prompt chính xác đã dùng

### Vỏ chuối

Ảnh tham chiếu: style-reference-v1.png; nền trong suốt.

```text
Use case: stylized-concept. Asset type: transparent 2.5D game hazard atlas, banana peel. Reference image is ART STYLE ONLY: warm softly painted, simple readable chibi game forms and upper-left daylight. EXACTLY TWO columns in ONE row, two fully isolated EMPTY banana peels, NO whole banana or fruit flesh. Each peel has a short central stalk with THREE spread curved yellow flaps lying on the ground, golden edges and tiny brown tips, clear recognizable silhouette. LEFT cell normal peel, RIGHT cell second peel rotated about40 degrees on the ground with slightly different flap arrangement, same size and yellow color. Elevated orthographic2:1 isometric ground camera, flatter silhouette about twice as wide as high, all flaps fully visible within equal cells with generous transparent padding. Genuine alpha background, no floor, no cast shadow beyond silhouette, no floating debris, no text, labels, border, gridlines, UI or watermark. Readable at42px width on mobile.
```

### Sầu riêng

Ảnh tham chiếu: style-reference-v1.png; nền trong suốt.

```text
Use case: stylized-concept. Asset type: transparent2.5D game hazard durian atlas. Reference is ART STYLE ONLY: warm softly painted upper-left daylight, simple readable chibi game objects. EXACT TWO columns in ONE row, same object scale and elevated orthographic camera in both equal cells, generous alpha padding. LEFT cell one whole compact oval green durian fruit with clearly visible triangular spines and a short brown stem, NO face, hanging in empty space as a falling object. RIGHT cell the same durian after landing, shell cracked into TWO chunky halves next to each other with pale golden yellow flesh inside, slightly flattened ground-facing arrangement, no debris cloud. Keep spines simplified and bold rather than hundreds of tiny spikes, readable at44px width whole and65px width split. Genuine transparent background, no ground or environment, no cast shadows outside silhouette, no text/labels/gridlines/border/UI/watermark. Entire fruit and halves fully inside own cells.
```

### Nước đổ

Ảnh tham chiếu: style-reference-v1.png; nền trong suốt.

```text
Use case: stylized-concept. Asset type: transparent 2.5D game water-spill VFX atlas. Reference image is ART STYLE ONLY: warm softly painted mobile game, simple bold readable shapes, not photoreal. EXACT regular square2 columns by2 rows, FOUR separate sprites, genuine alpha background, generous padding, no overlap. TOP LEFT: one small oval muted cyan-blue plastic washbasin filled with light blue water, viewed elevated three-quarter and tilted slightly forward, NO hands. TOP RIGHT: a narrow vertical ribbon of POURING WATER flowing downward, tapered at top and breaking into a few drops at bottom, NO basin or other objects in this cell. BOTTOM LEFT: one impact WATER SPLASH, broad low crown with upward droplets and clear white highlights, no basin. BOTTOM RIGHT: one shallow irregular blue PUDDLE, viewed from elevated orthographic2:1 isometric ground angle, roughly three times wider than tall with a few pale ripple highlights. Water muted sky-blue with partially translucent edges, avoid neon/glow. Every object completely inside its own equal cell. No ground planes, cast shadows, scene, text, labels, gridlines, borders, UI or watermark. Only these four component sprites for game animation, not one combined scene.
```

### Quả cầu

Ảnh tham chiếu: style-reference-v1.png; nền trong suốt.

```text
Use case: stylized-concept. Asset type: transparent2.5D game flying shuttlecock animation atlas. Reference is ART STYLE ONLY: warm soft painted chibi mobile game, clear simple shapes. Make ONE Vietnamese street kicking shuttlecock (qua cau da cau): a short RED rubber weighted base with three or four small cream-white feathers trailing behind, compact recognizable silhouette, NO racquet or people. EXACT square2 columns by2 rows, FOUR animation poses of the SAME object, all fully within own equal cells with generous transparent padding, same scale. All four poses travel toward screen RIGHT: red weighted base on RIGHT and feathers trailing LEFT. Top-left straight flight feathers together; top-right nose tilted slightly down15 degrees and feathers flexed upward; bottom-left straight flight feathers slightly spread; bottom-right nose tilted slightly up15 degrees and feathers flexed downward. Elevated orthographic game camera, upper-left soft light, minimal material detail, clear red base and white feathers readable at36px width. Genuine alpha background, no ground, cast shadows, motion streaks, extra objects, labels, text, gridlines, borders, UI or watermark.
```


