# Chương 1 — đợt 06: sự cố, nhóm 2/3

Ngày: 2026-10-28. Trạng thái **Review** cho nhóm hố/quần áo/dép/xe chở hàng. Sinh ảnh bằng imagegen tích hợp, đã ghép vào mã hiển thị; chưa chạy game/test/typecheck/build theo yêu cầu người dùng tự thử. Chưa push các đợt asset.

## File bàn giao

| Asset | Quy cách | Trạng thái trong atlas |
|---|---|---|
| [hazard-holes-v1.png](../../../public/assets/slice/chapter1/hazard-holes-v1.png) | PNG alpha 2 cột × 2 hàng | nứt đường/hố mở/nắp cống đóng/nắp cống mở |
| [hazard-laundry-v1.png](../../../public/assets/slice/chapter1/hazard-laundry-v1.png) | PNG alpha 2 cột × 2 hàng | ba dáng bay/rơi và một dáng phủ đầu |
| [hazard-slipper-v1.png](../../../public/assets/slice/chapter1/hazard-slipper-v1.png) | PNG alpha 2 cột × 2 hàng | mặt trên/đế/cạnh/nghiêng để quay khi bay |
| [hazard-cargo-bike-v1.png](../../../public/assets/slice/chapter1/hazard-cargo-bike-v1.png) | PNG alpha 2 cột × 4 hàng | bốn hướng, mỗi hướng có thùng đóng/mở |

Đường dẫn runtime: public/assets/slice/chapter1/. Texture cạnh dài tối đa768/384/384/768 pixel khi nạp; PNG nguồn vẫn giữ nguyên. Hai xe đầu của đoàn dùng lại motorbikes-v1.png, không tạo thêm atlas trùng.

## Đã ghép vào mã

- Hố: hình nứt lớn dần trong warn rồi đổi sang hố mở; nhánh né dùng nắp cống với chuyển động lật trước khi mở. Vẫn giữ dấu cảnh báo dưới nền, bụi và pose hụt chân cũ.
- Quần áo: ba khung rơi theo progress của warn; khi phủ đầu dùng khung riêng theo vị trí người chơi. Không giữ thêm ảnh quần áo vừa trúng nằm dưới đường cùng lúc. Đây vẫn là nhánh rối điều khiển tạm thời, không đổi thành ngất.
- Dép: giữ cảnh báo, đổi bốn mặt khi bay và đổi chiều theo vector đã có, bao gồm lúc quay lại. Cảnh va chạm có sprite riêng; tắt ảnh đang fade của chiếc vừa trúng để không hiện hai bản cùng lúc.
- Đoàn xe: vẫn ba xe, khoảng cách1.3 tile và độ lệch làn như cũ; hai xe đầu dùng atlas thường, xe cuối dùng xe chở tủ lạnh/thùng gà theo bốn hướng. Từng xe có depth theo vị trí riêng.
- RunService chỉ xuất thêm trường view cargoOpen từ cờ twisted của nhánh xe đang có. Không đổi điều kiện né/thả gà, bán kính trúng, thời gian, đường bay hoặc luật kết thúc.
- Khi thùng mở, căn frame theo frame đóng để hạn chế ảnh xe dịch chỉ vì nắp/lông làm vùng crop lớn hơn. Giữ một hệ số scale cho toàn atlas; cache chiều cao để không tính lại mỗi frame.
- Sprite tiếp tục dùng cơ chế dùng lại/dọn của IncidentRunView, có hình vẽ code dự phòng nếu atlas chưa tải đủ frame.

## Giới hạn và tự thử

1. Hố/nắp cống: so hình mở với vùng trúng, nhánh nắp xuất hiện sau khi né và thứ tự che khuất người đứng sát mép. Mặt hố vẫn là hình trên nền, không thêm vật cản cứng vào nav grid vì bác sĩ còn phải tiếp cận người bị nạn theo logic hiện tại.
2. Quần áo: rơi đúng vùng cảnh báo, phủ đầu khớp vị trí mặt lúc đi/đổi hướng; hết hiệu ứng thì ảnh phủ đầu biến mất. Các pose thân/đầu hiện tại chưa có animation nhận quần áo riêng.
3. Dép: thấy rõ chiều bay/quay lại và va chạm, không để lại ảnh dư. Chưa có vật lý lật3D; bốn khung ảnh thể hiện chuyển động quay.
4. Xe: xem cả trục đường chính và ngõ; đủ ba xe, cargo không bị cắt ở biên ô hoặc che quá nhiều người chơi; thùng mở đúng lúc nhánh gà bắt đầu. Chưa thay art đàn gà trong đợt này và chưa có chuỗi frame nắp thùng bật mở liên tục.
5. Xem trên mobile dọc/ngang để chỉnh lại kích thước, điểm gắn, độ đọc cảnh báo và vùng va chạm theo hình thực tế. File tải về vẫn là master, chưa phải bản nén cuối.

Đã xem atlas, đọc metadata alpha/kích thước và rà diff. Kiểm tra một số điểm alpha ngoài hình hố cho thấy nền ngoài vật thể trong suốt; việc này không xác nhận tích hợp trong game hoặc hiệu năng thiết bị. Chưa nghiệm thu animation/art final.

## Tiến độ

Cập nhật: [nhóm3 đã nối ở đợt07](ASSET_PASS_07.md), tổng12/12 loại chờ tự duyệt. Thống kê8/12 dưới đây là trạng thái lúc tạo đợt06.

T-080 vẫn **Doing — 8/12 loại đã ghép hình và chờ tự duyệt**. Nhóm3 còn lại: mèo, chó nhỏ/chó lớn (một loại sự cố), bồ câu và gà. Sau đó mới đến sáu kết thúc, UI, âm thanh và nghiệm thu.

## Prompt chính xác đã dùng

### Hố và nắp cống

Ảnh tham chiếu: style-reference-v1.png; yêu cầu nền trong suốt.

```text
Use case: stylized-concept. Asset type: transparent2.5D game road-hole hazard atlas. Reference is ART STYLE ONLY: softly painted warm Hanoi street game, simplified readable materials, fixed upper-left daylight. Exact regular square2 columns by2 rows, FOUR isolated ground hazard sprites, genuine alpha outside each shape, all contained with generous padding. Elevated orthographic2:1 dimetric ground plane: circular ground objects appear as ellipses twice as wide as tall. TOP LEFT: gray asphalt patch with spreading dark cracks and slightly sunken center, NO open black hole yet, transparent outer contour. TOP RIGHT: a LARGE open irregular street sinkhole, warm broken asphalt and soil rim around a dark deep interior, hole interior must be dark opaque, not transparent; no cover. BOTTOM LEFT: a CLOSED dark muted gray cast-iron manhole cover, flat2:1 ellipse, simple concentric grip pattern, no lettering. BOTTOM RIGHT: an OPEN round manhole, dark opening and iron rim, its round cover tilted upward at rear edge, keep rim's ground ellipse clear. No pipes sticking out, grass, ground plane beyond rim, people, particles, text labels gridlines borders UI watermark. Consistent road-gray and earth-brown palette, readable at120–190px width. Do not combine the four states into one scene.
```

### Quần áo rơi

Ảnh tham chiếu: style-reference-v1.png; yêu cầu nền trong suốt.

```text
Use case: stylized-concept. Asset type: transparent2.5D game falling laundry animation atlas. Reference is ART STYLE ONLY: warm soft painted cozy chibi game, simple bold readable details. Create ONE pair of ordinary loose coral-pink boxer shorts with a small yellow flower pattern and elastic waistband, NO person or mannequin. EXACT regular square2 columns by2 rows, FOUR complete poses of the SAME shorts, consistent size and pattern, centered inside equal cells with generous transparent padding. TOP LEFT shorts falling mostly flat front view with open waistband and two short leg openings. TOP RIGHT same shorts fluttering tilted left with billowing fabric. BOTTOM LEFT fluttering tilted right. BOTTOM RIGHT shorts draped and bunched over an INVISIBLE round head: fabric bends at waistband and hangs downward so this sprite can cover a chibi character's eyes, no head/face/body included. Cute slapstick everyday laundry, no sexual framing. Elevated orthographic game camera, soft upper-left light, minimal fine folds, readable at42px width. Genuine transparent alpha background, no clothespins/line/ground/cast shadows, no text labels grids border UI watermark. Only the four clothing sprites.
```

### Dép bay

Ảnh tham chiếu: style-reference-v1.png; yêu cầu nền trong suốt.

```text
Use case: stylized-concept. Asset type: transparent2.5D game flying rubber slipper animation atlas. Reference is ART STYLE ONLY: warm softly painted cozy chibi game, simple readable shapes, upper-left soft light. Draw ONE classic Vietnamese yellow honeycomb perforated plastic/rubber slide sandal (dep to ong), NOT flip-flop, no person/foot. EXACT regular square2 columns by2 rows, FOUR views of the SAME yellow slipper for a spinning boomerang gag, consistent scale, fully inside own equal cell with generous transparent padding. TOP LEFT top three-quarter view: rounded toe on RIGHT, heel on LEFT, wide perforated upper with clear honeycomb holes. TOP RIGHT underside/sole three-quarter view showing simple tread, toe still RIGHT. BOTTOM LEFT narrow side/edge view with thick yellow sole, toe RIGHT. BOTTOM RIGHT top three-quarter view tilted about30 degrees upward, toe RIGHT and holes visible. Keep original simple yellow rubber material, golden darker sole edges, no brand. Genuine alpha background, no ground, cast shadow, motion trails, text labels grids borders UI watermark. Readable at34px long in game.
```

### Xe chở hàng

Ảnh tham chiếu: motorbikes-v1.png; yêu cầu nền trong suốt.

```text
Use case: stylized-concept. Asset type: transparent2.5D Hanoi overloaded delivery motorbike sprite atlas. Reference is the APPROVED traffic scooter atlas: match its same chibi Vietnamese rider, cream helmet, teal jacket, dark trousers and warm soft painted materials. Create EXACT TWO columns by FOUR rows, EIGHT full rider+motorbike sprites, same scale/identity/camera throughout, genuine alpha background, ample padding and all cargo/mirrors/helmet/wheels inside each equal cell. The scooter is muted green and carries a SMALL cream refrigerator strapped upright behind the rider plus a compact brown ventilated wooden poultry crate secured to the rear rack. Cargo readable but not absurdly huge; keep rider visible. LEFT column crate CLOSED; RIGHT column same vehicle pixel-aligned, refrigerator still strapped, crate LID OPEN with a few loose white feathers at opening, NO chickens drawn. ROW1 front wheel/headlight points screen DOWN-RIGHT; ROW2 front points UP-LEFT showing rider BACK and taillight; ROW3 front points DOWN-LEFT; ROW4 front points UP-RIGHT showing rider BACK and taillight. Strict elevated ORTHOGRAPHIC2:1 dimetric camera with ground directions26.565 degrees, light fixed upper-left. No ground, road, cast shadow outside silhouette, additional people, labels, text, brand logos, number plate lettering, grids, border, UI or watermark. Only eight isolated cargo scooter sprites, same orientation as reference rows.
```


