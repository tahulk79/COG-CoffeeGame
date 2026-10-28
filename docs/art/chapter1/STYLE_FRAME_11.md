# Khung mẫu theo UI — đợt 11

Ngày: 2026-10-29. Trạng thái Review. File: [style-frame-v1.png](style-frame-v1.png).

## Mục đích

Chốt hình tổng thể trước khi làm lại các asset riêng. Ảnh có phố, hero, người bán, người cao tuổi, cây, xe cứu thương/bác sĩ, thoại và nút UI tham chiếu cùng nét nâu và bảng màu kem/coral/mint. Đường và cảnh ngoài nối cùng mặt đất; không hồ, không sàn nổi hay nền lật gương.

**Đây là ảnh minh họa định hướng, không phải screenshot game hoặc background/atlas sẵn dùng.** UI trong ảnh được imagegen vẽ theo reference và tokens, không phải UI thật render từ Phaser. Runtime/code gameplay chưa thay đổi trong đợt này. Không lấy chữ/nút trong ảnh để thay UI đang dùng.

## Những gì cần giữ khi triển khai

- Nét nâu rõ, hai đến ba mảng sáng/tối chính; giảm chất liệu ảnh thật, ngói/lá nhỏ và bóng đổ nặng.
- Cảnh/nhân vật cùng cách viền và ánh sáng; chủ quầy và khách khác tuổi/tóc/vóc dáng/trang phục nhưng cùng phong cách.
- Phố có các lối tiếp tục và vật thể chung cao độ, background ít nổi hơn vùng chơi; không dùng flipY/flipX để chữa mép nền có kiến trúc.
- UI đang có vẫn là chuẩn; không thêm Mục tiêu, nhấp nháy hero hoặc sáu cú chót đã bỏ.
- Hai bác sĩ không dùng cáng; khung đầu sinh nhầm cáng đã được sửa khỏi ảnh chọn cuối.

## Giới hạn

Khung chỉ để duyệt cách vẽ và phân cấp. Chưa khóa tỷ lệ asset/pivot/camera từ ảnh: nhân vật, cây, cửa và UI phải được căn lại ở kích thước390px và PC khi thực hiện. Ảnh chưa phải sơ đồ chính xác toàn bộ map48×18 và không thay nav grid/collider. Chưa có animation hoặc minh chứng di chuyển/cứu hộ với phong cách mới.

Bước sau là áp dụng chuẩn được chọn cho background theo bố cục map, sau đó nhà/cây/quầy/xe và nhân vật; xem lại cả cảnh trong Phaser trước khi sản xuất đủ atlas. Chưa đổi asset game trong lượt này, không chạy test/typecheck/build hoặc push.

## Nguồn và prompt

Sinh/chỉnh bằng imagegen tích hợp, transparent_background=false; không dùng CLI/API hoặc Python chỉnh ảnh. Ảnh cuối đã lưu trong dự án. Reference1 là ảnh UI người dùng cung cấp, lưu bản sao [ui-reference-original.png](ui-reference-original.png); chỉ lấy phong cách UI, bỏ Mục tiêu/hồ/nhà chồng của ảnh cũ. Reference2: public/assets/slice/chapter1/hero-v1.png lấy nhận diện hero. Không dùng ảnh nền bị từ chối làm chuẩn mới.

### Prompt tạo khung

Use case: ui-mockup. Create ONE cohesive portrait mobile game art-direction screen for COG-CoffeeGame, aspect 2:3. This is a reviewable complete game-screen mockup, not asset atlas. Reference image1 is ONLY the authoritative UI style: cream rounded paper buttons, thick chocolate brown outlines, coral accents, friendly bold rounded Vietnamese letters. Do NOT copy its objective card, lake, browser chrome, old plain stick people, overlapping tall buildings or clipped speech. Reference image2 is ONLY main hero identity (tousled dark brown hair, coral short-sleeve shirt, navy trousers, white sneakers, brown crossbody bag); redraw him in the simpler unified style described below. ART DIRECTION: attractive polished hand-drawn cartoon 2.5D isometric, large flat color shapes with just two or three gentle shading tones, clear dark warm brown outlines on people/buildings/trees AND UI. NOT photorealistic miniature, NOT realistic rendered materials, no dense roof tiles or tiny leaves, no dramatic shadows, no texture noise, no glossy 3D. Palette: cream #FFF6E5, paper #FFFAF0, ink #5A3825, coral #FF7F6B, mint #6FD3C0, muted ochre/teal/sage supporting colors. Daytime Hanoi old-quarter everyday humor. Orthographic 2:1 dimetric, all street ground axes follow screen slopes +26.565/-26.565 degrees, consistent top-left lighting. COMPOSITION: a broad diagonal asphalt street through middle from upper left toward lower right, wide warm beige sidewalks on BOTH sides. Main coral-shirt chibi hero stands clearly visible near center on sidewalk, full body about 8 percent of image height, expressive face, rounded chunky silhouette. Near him one female vendor with short tied hair in purple blouse at modest wood street-food stall with mint/cream awning; one elderly man in blue polo with gray mustache and cap; two white-uniform medics near a cream ambulance with red cross parked normally at curb. Distinct people but SAME outlined flat cartoon style. A few houses at upper and lower side of street, modest one or two storeys, clearly separate yellow/cream/sage facades with varied shutters/roof shapes, scaled door height roughly one-and-a-half times person height. Trees have irregular grouped leaf masses, visible trunks, two different silhouettes, simple shading. FRAME IS FILLED WITH CONTINUOUS TOWN: sidewalk joins side lanes and courtyards naturally, all same ground level. At far edges lower contrast/lower detail blocks suggest town continues. No foreground platform edge, no floating stage, no fence dividing scene from a pasted photo, no city wallpaper, no upside-down/mirrored buildings, no perspective horizon, no lake/water/bridge. UI included and drawn in EXACT same cream brown-outline style as reference1: top-left small rounded sound button with speaker icon and exact label 'Bật'; top-right compact gear icon button; leave top center clear, NO objective/mission card. One small readable cream speech bubble close above purple vendor with exact Vietnamese 'Mời cháu uống trà!' (do not cover hero). At bottom-left a subtle cream translucent outlined circular joystick with coral knob, sized for thumb; keep it away from hero. No extra controls, no scores, no title, no captions, no logo/watermark, no phone bezel or status/browser bars. UI and world must unmistakably belong to the same cartoon game. Prioritize clear phone-scale readability and physically coherent continuous street layout.

### Prompt chỉnh bản mẫu

Edit this mobile game-screen style mockup with ONLY two targeted corrections. Keep all other composition, outlines, palette, architecture, hero, NPC identities, text, lighting and visual style unchanged. Correction1 in upper-left ambulance area: REMOVE the entire stretcher, wheeled bed, all patients/bodies on it and its wheels. The two white-uniform medics simply stand naturally at the ambulance's open rear door chatting, hands at their sides, nobody carrying or supporting anything. The game's story intentionally has no stretcher. Reconstruct empty asphalt beneath them coherently with the rest of street. Keep the two medics distinct from the hero; hero remains upright by tea stall. Correction2 bottom-left: shrink the circular joystick to about18 percent of canvas width, keep its center near current lower-left position but comfortably inside screen, coral knob proportionally scaled. Remove the four white direction triangles inside joystick, retain translucent cream circular ring and coral knob only. Preserve exact 'Bật' top-left button, gear top-right, exact 'Mời cháu uống trà!' bubble, all other details and full portrait canvas. Do not add objective cards, lake or extra UI.

