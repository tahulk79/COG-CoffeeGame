# 01 · Intro (Màn 1)

Đoạn mở đầu dựng bằng cảnh 3D có phụ đề: tai nạn, xe cứu thương, rồi nhân vật bị đưa lên thiên đàng. Dài 23,5 s (`DURATION`), có nút Bỏ qua từ giây 0, chạm để tua sang câu phụ đề kế.

| | |
|---|---|
| Vào từ | [00 · Chọn nhân vật](../00-selection/README.md) |
| Ra tới | [02 · Thiên đàng](../02-heaven/README.md) khi hết giờ hoặc Bỏ qua |
| Dữ liệu ghi | `introCompleted: true` (`completeIntro`); tải lại trang sau đó vào thẳng thiên đàng |
| Code | `src/features/intro/`: `scene.js` (cảnh), `timeline.js` (thời lượng, phụ đề), `collision.js` (chặn đường tiếp cận vật cản), `rescue.js` (động tác cúi và căn tay y tế theo điểm đỡ) |

## Diễn biến

Đi bộ → né xe đạp → va biển → ngã → xe cứu thương xuất hiện và dừng → y tế nâng người lên cáng → thần chết tách hồn và dẫn lên → đáp xuống đầu đường trên mây → đứng lại 1,5 s (`LANDING_PAUSE`) → đi liền mạch tới cổng và vào trong.

- `DURATION = 22 + LANDING_PAUSE` = 23,5 s ở tốc độ thường; không tăng tốc toàn bộ chuyển động.
- Cổng mở sẵn khi đến gần, không dừng ở cổng. Xe cứu thương ẩn hoàn toàn trước mốc cứu hộ.
- HUD hội thoại: biểu tượng người nói, thẻ tên, nội dung, nút **Tiếp**. Bấm bất kỳ đâu, Enter hoặc Tiếp sang câu kế và bỏ qua diễn biến giữa hai câu; không bấm thì tự chạy. Góc màn hình chỉ có nút **Bỏ qua**.
- Đổi tab dừng vòng lặp, quay lại thì chạy tiếp.

## Nhân vật và cứu hộ

- GLB có rig, giữ texture gốc, chuẩn hóa chiều cao 2 đơn vị. Walking lấy từ model; ngã dùng keyframe dựng bằng code và giữ tư thế cuối.
- Bounds model có rig đo qua `src/characters/bounds.js`, đồng bộ ma trận xương trước khi lấy.
- Va chạm tính theo model; chặn cột, thanh đỡ và biển. Nhân vật ngã về sau, vị trí cuối là mốc chung cho cứu hộ.
- Y tế cúi đỡ, nâng đủ cao rồi mới chuyển ngang sang cáng; cơ thể nằm nguyên trên cáng khi di chuyển. Tay có hai khớp, bám theo điểm đỡ hoặc tay cầm.
- Thần chết xuất hiện trước lúc tách hồn, dây xích nối tới bàn tay. Chưa có lồng tiếng; y tế và thần chết là hình khối dựng bằng code.
- Công cụ xem từng mốc (va chạm, ngã, nâng, khiêng): `tools/intro-preview/`, không nằm trong bản build.

## Tài liệu liên quan

- Mục tiêu thời gian của intro, nút Bỏ qua, gợi ý tiếp: [shared/onboarding-flow.md](../../shared/onboarding-flow.md)
- Model dùng trong intro (xe cứu thương, xe đạp, cổng trời...): [assets/scene-assets.md](../../assets/scene-assets.md)
- Sơ đồ chuyển màn: [game-flow.md](../../game-flow.md)

Màn này chưa có tài liệu luật riêng vì không có gameplay: chỉ là đoạn phim tương tác ngắn.
