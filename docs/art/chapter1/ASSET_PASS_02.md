# Chương 1 — đợt 02: cứu hộ 2.5D

Ngày: 2026-10-28. Trạng thái: **Review**, đã ghép mã, chưa chạy game/test/typecheck/build theo yêu cầu người dùng tự thử. Dùng imagegen tích hợp, không dùng API/CLI riêng.

## Bàn giao

| Asset | Quy cách | Trạng thái trong mã |
|---|---|---|
| [medic-v1.png](../../../public/assets/slice/chapter1/medic-v1.png) | Atlas alpha 4 cột × 4 hàng | Hai bác sĩ dùng chung atlas, 4 hướng màn hình; mỗi hàng đứng/đi trái/đi phải/đưa tay khiêng |
| [medic-carry-v1.png](../../../public/assets/slice/chapter1/medic-carry-v1.png) | Atlas alpha 4 cột × 4 hàng | Mỗi hướng có cúi xuống/nâng lên/bước trái khiêng/bước phải khiêng; hai người dùng chung nhịp |
| [ambulance-v1.png](../../../public/assets/slice/chapter1/ambulance-v1.png) | Atlas alpha 3 cột × 4 hàng | Mỗi hàng đóng cửa/mở cửa/mất bánh trước; hàng theo hướng xuống phải/lên trái/xuống trái/lên phải |
| [wheel-v1.png](../../../public/assets/slice/chapter1/wheel-v1.png) | Một bánh xe alpha | Quay bằng góc từ mô phỏng, theo nhánh rơi bánh hiện có |

File có sẵn dưới public/assets/slice/chapter1/; mọi thay đổi của đợt 01 và 02 hiện vẫn nằm trong workspace, chưa push thêm.

## Hành vi đã nối vào mã

- Bác sĩ dùng hướng bước đi từ mô phỏng, giữ hướng lúc dừng. Khi khiêng, hai người hướng về tâm thân người bị nạn.
- Điểm đứng của hai bác sĩ được đặt gần đầu/chân của tư thế nằm cố định, vẫn tìm nền đi được bằng cơ chế hiện có. Khi phải tránh vật cản, các điểm này có thể lệch khỏi vị trí tay lý tưởng.
- Thân người nâng dần trong 200 ms, dùng chung tiến độ với dáng nâng của bác sĩ. Thời gian animation bác sĩ lấy từ đồng hồ mô phỏng, dừng khi mở cài đặt.
- Xe chọn một trong bốn hướng theo trục x/y và chiều chạy. Cửa chỉ mở khi tới điểm đỗ, đóng khi cả nhóm lên xe. Xe chờ bác sĩ về gần người bị nạn trước khi ẩn nhóm và rời đi.
- Nhánh rơi bánh đổi sang sprite mất bánh, vẽ bánh rời bằng asset mới và tiếp tục dùng góc nghiêng/vòng tròn/vụ nổ hiện có.
- Kích thước hiển thị bác sĩ khoảng 70 pixel thế giới, xe rộng tối đa khoảng 205 pixel thế giới. Một hệ số scale dùng cho toàn atlas, tránh đổi kích cỡ chỉ vì mở cửa.
- Có hình tạm dự phòng nếu atlas không tải/không đủ frame; các bóng tiếp xúc và bánh rời được dọn khi rời scene.

## Ngân sách texture lúc nạp

Giữ nguyên PNG nguồn. Khi đăng ký texture, mã thu nhỏ bản dùng trong game một lần rồi bỏ texture GPU nguồn: hero/medic cạnh dài tối đa 768, nhà 1536, xe 1280, bánh 64 pixel. Không thu nhỏ lại mỗi frame.

Đây là giới hạn kích thước đã ghi trong mã, **chưa phải số đo hiệu năng**. PNG tải xuống vẫn là file nguồn; việc xuất bản runtime nhỏ hơn, nén asset và đo trên điện thoại còn trong kế hoạch tối ưu.

## Phần chưa final

- Đã có atlas cúi/nâng và hai bước chân khi giữ người theo bốn hướng, nhưng chưa có chuyển động khớp tay chính xác hoặc animation đưa người qua cửa. Bộ đưa tay trong atlas đứng/đi làm dự phòng nếu atlas khiêng chưa tải được.
- Mở/đóng cửa hiện đổi frame, chưa có chuỗi frame trượt cửa. Cửa nhìn thấy trong ảnh không đảm bảo trùng tuyệt đối với điểm lên xe ở cả hai phía đường.
- Các atlas do AI tạo có thể cần chỉnh lại vị trí trong ô và hình dáng giữa các frame. Chưa xác nhận góc nhìn/điểm gắn trong game.
- Cảnh nổ, bụi và vòng tròn vẫn là hình vẽ bằng code; âm thanh cứu hộ hiện vẫn là bản tạm.
- Cần tự thử cả hai chiều đường và ngõ, ngã sát tường/quầy/cây/cổng, có và không có nhánh rơi bánh; kiểm tra đủ hai bác sĩ, cửa mở lúc đón và không biến mất sớm.

## Prompt chính xác đã dùng

### Cúi, nâng và bước khiêng

Ảnh tham chiếu: medic-v1.png; nền trong suốt.

```text
Use case: stylized-concept. Asset type: transparent game animation atlas. Reference image is the medic sprite atlas; preserve EXACT character identity, cap, face, jacket, trousers, proportions, camera and rendering. Make a SECOND 4-column by 4-row atlas ONLY for lifting and CARRYING a patient by hand. Genuine transparent background. All sixteen sprites full body, consistent scale, centered in equally sized cells, feet on the same baseline. Row1 faces screen DOWN-RIGHT, row2 DOWN-LEFT, row3 UP-RIGHT rear three-quarter, row4 UP-LEFT rear three-quarter. For EACH row, all poses have BOTH hands forward with PALMS UP, supporting an INVISIBLE patient at waist height (do not draw patient or stretcher). Col1 bend knees and crouch down to pick up the invisible patient, keep both hands low and forward. Col2 stand upright holding patient with both forearms extended waist high, feet planted. Col3 WALKING carry left foot forward, both hands stay steady waist high. Col4 WALKING carry right foot forward, both hands stay steady waist high. Crucial: col3/4 do NOT swing arms, maintain the supporting grip while the legs move. Same ground baseline even when crouching. Rear views show back of head, cap and jacket. No props, patient, stretcher, floor, cast shadows, labels, gridlines, border, UI or watermark. Same soft painted warm chibi 2.5D look as reference, readable at70px.
```


### Bác sĩ

Ảnh tham chiếu: hero-v1.png; nền trong suốt.

```text
Use case: stylized-concept. Asset type: transparent 2.5D game character sprite atlas. Image 1 is a STYLE/PROPORTION REFERENCE ONLY, the game's hero atlas. Create a different character: Vietnamese chibi ambulance medic, short neat dark hair, white medical cap with small red plus, white short-sleeve medical jacket with small red plus on chest, pale teal blue trousers, dark comfortable shoes, no bag, no equipment. Match the hero's soft painted rendering, warm colors, large head, compact body and elevated orthographic camera; simplify small details for 70px game height. EXACT regular 4 columns by 4 rows, sixteen separate FULL BODY sprites, genuine transparent background. Same scale every cell, feet at same baseline, full cap visible, all sprites padded inside their own equal cell. Row1 faces screen DOWN-RIGHT, row2 DOWN-LEFT, row3 UP-RIGHT rear three-quarter, row4 UP-LEFT rear three-quarter. In EACH row: col1 standing neutral arms at sides; col2 walking left foot forward; col3 walking right foot forward; col4 carrying pose BOTH forearms extended forward at waist height, elbows bent and palms UP as if supporting one end of a patient. The patient must NOT be included. Col4 knees slightly bent for lifting, hands clearly visible. Consistent clothing/cap/face/size throughout. Rear rows must show back of head and jacket, no front face. No ground, floor, props, cast shadows, text, labels, grid lines, watermark or UI. Render only the sixteen medic sprites.
```

### Xe cứu thương

Ảnh tham chiếu: style-reference-v1.png; nền trong suốt.

```text
Use case: stylized-concept. Asset type: transparent isometric ambulance sprite atlas for a mobile 2.5D Hanoi game. Reference image is the game's ART DIRECTION: match its small white ambulance, red horizontal stripe and small red medical plus, red/blue roof lightbar, gray windows, compact proportions and soft painted warm shading. Create EXACTLY 3 columns by 4 rows, TWELVE complete isolated vehicles, genuine transparent background, regular equal cells. Elevated ORTHOGRAPHIC 2:1 dimetric camera, ground parallel edges slope at 26.565 degrees; camera and light from upper left fixed, do not use a frontal or side-on camera. Same compact white box ambulance every cell, vehicle about twice as long as wide. Row1 front cab points screen DOWN-RIGHT; row2 front cab points screen UP-LEFT (see REAR doors and leftward back side); row3 front cab points screen DOWN-LEFT; row4 front cab points screen UP-RIGHT (see REAR doors and rightward back side). Rotation must rotate the SAME vehicle, not redesign it. In EACH row column1 vehicle with all doors closed, column2 SAME EXACT vehicle and pixel-aligned body with a PATIENT COMPARTMENT SIDE DOOR OPEN on the camera-visible side (clear dark opening; NOT front driver's door, no patient), column3 same vehicle all doors closed with ONE camera-visible FRONT wheel missing and visible empty wheel arch, other wheels remain. Do not tilt the damaged van: engine applies tilt. Wheels visible, all body parts remain entirely within each cell. Same scale, same ground center, same framing in all variants; full vehicle fits with ample transparent padding around. No driver or people, no ground plane or shadows outside vehicle, no scene, no text lettering words numerals branding logos labels gridlines borders UI watermark. Only the twelve van sprites.
```

### Bánh xe

Ảnh tham chiếu: ambulance-v1.png; nền trong suốt.

```text
Use case: stylized-concept. Asset type: one transparent detachable ambulance wheel game sprite. Reference image is the ambulance atlas; match its black rubber tire, muted gray steel hub and warm soft painted 2.5D rendering. Draw ONLY ONE complete wheel viewed directly side-on so its circular gray hub and tire can rotate in a 2D game without wobble. Perfectly round silhouette, centered, diameter about70 percent of square canvas, subtle tread on the outer edge, five simple hub openings. No vehicle, no axle sticking out, no ground, no shadow, no text, no border, no UI or watermark. Genuine alpha background. Readable at26px on screen.
```

