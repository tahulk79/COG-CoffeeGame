# Background khu phố tiếp diễn — đợt 09

Ngày: 2026-10-29. Theo lựa chọn trực tiếp của người dùng: **bỏ hồ, đổi thành khu phố kéo dài**. Thay cách rải các asset rời ở đợt08 bằng một background vẽ cả khu phố.

**Đã được thay ở T-096:** ảnh background09 và registry đã gỡ; không còn dùng cách lậtgương. Xem STREET_SAMPLE_13.md cho trạng thái đang chạy. Phần dưới giữ làm lịch sử.

## Đã triển khai

- Ảnh opaque public/assets/slice/chapter1/district-background-v1.png, sinh bằng imagegen tích hợp. Đây là background hoàn chỉnh có phố/nhà/cây, không phải atlas đối tượng để rải vào map.
- Registry tải ảnh nền với một frame và giới hạn cạnh1536. chapter1Scenery.ts dùng một pool Image, chỉ phủ các ô trong viewport camera cộng32px. Chỉ cập nhật pool khi phạm vi ô thay đổi, dọn listener PRE_RENDER khi scene shutdown.
- Các ô nối bằng lật xen kẽ ngang/dọc, để chung pixel ở mép ngay cả khi ảnh sinh không nối hoàn hảo. Giữ tọa độ world, không cuộn riêng/parallax; ảnh nền không trượt so với vị trí đường chơi. Có thể nhìn ra đối xứng/lặp khi kéo xa; chưa khẳng định tổng cảnh đã đạt chất lượng cuối.
- Giảm độ tương phản bằng tint và alpha để background không giành sự chú ý với vùng chơi. Nhà/cây trong vùng chơi vẫn là đối tượng có lớp vẽ/vật cản; background là trang trí, không mở nav grid.
- Xóa mặt nước, bank xa, kè, lan can bờ hồ, Tháp Rùa/cầu Thê Húc/Ngọc Sơn, nhãn và fallback hình khối liên quan. Gỡ registry landmark để không tải atlas không dùng. Bản landmark cũ đã được xóa ngày2026-10-29 theo yêu cầu dọn asset không dùng; chỉ giữ mô tả lịch sử trong tài liệu.
- Xóa các dãy nhà/cây rải ngoài map từ đợt08. Vẫn giữ nhà phố/đường vòng hiện có sát vùng chơi để tiếp nối giao thông.
- Mép dưới y17 có ranh vườn thấp theo lưới, không còn kè nước; đường đi và collider không thay. Cây trong vùng chơi giữ sáu mẫu và cơ chế mờ khi che hero.
- Đổi tên bản đồ thành Phố cổ chiều nắng, sửa lời thoại/sự cố còn nhắc bờ hồ sang phố cổ. Không thêm lại sáu kết thúc hoặc quán cà phê.

## Cần tự xem

Chưa chạy game/test/typecheck/build hoặc push theo yêu cầu người dùng tự thử. Đã xem ảnh và rà mã/diff. Cần duyệt tỷ lệ nhà nền so với nhà tiền cảnh, mép nối ảnh bị đối xứng, cạnh vùng chơi với background, độ đọc nhân vật khi kéo tới bốn phía, mobile dọc/ngang và lúc cứu hộ. Background không phải map vô hạn đi được; nó phủ vùng nhìn bằng ảnh lặp. Sau thay đổi có34 PNG trong public, tổng52,13 MiB; đây vẫn là master, chưa xuất bộ runtime nén. Không có số đo FPS/bộ nhớ thiết bị sau thay đổi này.

## Prompt chính xác

Reference: docs/art/chapter1/style-reference-v1.png đã xem từ các đợt trước. Built-in imagegen, transparent_background=false. Không dùng CLI/API hay chỉnh ảnh bằng Python.

Use case: stylized-concept. Asset type: ONE finished seamless BACKGROUND PAINTING for a Vietnamese Hanoi old-quarter 2.5D isometric mobile game. This is a continuous integrated environment backdrop, NOT an atlas, NOT separate cutout assets, NOT a moodboard. Orthographic 2:1 dimetric camera, all ground street axes slope exactly +26.565 and -26.565 degrees, no vanishing point/horizon/sky. Fill entire canvas edge to edge with a coherent extended Hanoi city neighbourhood seen from above: several continuous narrow asphalt streets, pale warm beige sidewalks, irregular city blocks with small low-rise old houses, weathered cream/ochre/sage plaster, varied terracotta roofs and flat rooftops, green shutters, a few inner courtyards, scattered street trees and tiny awnings. Interconnected roads go naturally out all four edges. Houses physically separate, not stacked in impossible piles. Distant background detail level, quiet muted colors and low contrast; no individual giant foreground house, no hero or focal landmark. Match reference's warm painted miniature daytime Hanoi art direction but simplify enough that gameplay sprites stand out. IMPORTANT: truly seamless repeating tile, matching LEFT-RIGHT edges AND TOP-BOTTOM edges for repeating in two axes; distribute city blocks naturally so repetition is inconspicuous. Full opaque background with consistent warm stone ground, no transparency, no isolated islands, no water, lake, river, bridge, temple, towers, shoreline, sky, fog bands, dark vignette, text, UI, signs with writing, logos or watermark. No characters or moving vehicles baked into background. Landscape 3:2 canvas. Light from upper left, cohesive physically plausible street layout. Render a single assembled scene, not rows of individual objects.

