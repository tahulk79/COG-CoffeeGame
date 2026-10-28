# Kiểm tra Prototype và yêu cầu bàn giao đồ họa

Ngày kiểm tra: 2026-10-28. Phạm vi Vertical Slice đề xuất: **Chương 1 – Phố cổ Hà Nội**, gồm ngoài phố, các quầy hàng ngoài trời, sự cố, cứu thương và chuyển sang chương tiếp theo. **Quán cà phê ông Tám đã được bỏ khỏi Chương 1 theo yêu cầu ngày 2026-10-28.** Chưa bao gồm nâng cấp toàn bộ nông trại và quản lý quán ở các chương sau.

## 1. Kết luận hiện trạng

| Mốc | Hiện trạng | Điều kiện để đóng mốc |
|---|---|---|
| Prototype | Có bản chơi được: di chuyển, tương tác, hội thoại, 12 loại sự cố, 6 kết thúc do sống sót đủ thời gian, cứu thương, chuyển chương, UI và âm thanh tạm. Chưa nên gọi là đã nghiệm thu hoàn toàn. | Kiểm tra các góc/ngõ, đường cứu hộ, đủ nhánh nội dung; chơi thử trên điện thoại thật, xác nhận cảm giác điều khiển, độ đọc UI và hiệu năng. Unit test không thay thế nghiệm thu thiết bị thật. |
| Vertical Slice | Chưa đạt: chưa có bộ model/rig/animation sản xuất; thế giới hiện được vẽ bằng code và hiển thị bằng hình 2D. | Hoàn thiện đúng một chương từ đầu đến cuối với chất lượng hình, UI, âm thanh đại diện cho bản cuối, chạy trong ngân sách thiết bị mục tiêu. |
| Production | Chưa bắt đầu ở mức đồ họa sản xuất. | Mở rộng nội dung đã được kiểm chứng ở Slice, cải thiện và tối ưu model, texture, ánh sáng, VFX, animation; nghiệm thu từng nhóm thiết bị. |

**Lưu ý:** Không cần người chơi gặp đủ 12 sự cố trong một lượt. Một lần ngã đã dẫn đến cứu thương và hết chương. Phải kiểm tra từng sự cố riêng, các nhánh phụ và sự đa dạng qua nhiều lượt chơi.

## 2. Hiện tại phải thay những gì?

`public/` chưa tồn tại; `ART_READY` trong `src/components/render/h5Assets.ts` đang rỗng. Các đường dẫn sau là điểm gắn asset dự kiến, **không phải bộ ảnh sản xuất đang có và chỉ cần ghi đè**:

| Nhóm | Asset dự kiến / mã hiện tại | Công việc thay thế |
|---|---|---|
| Nhân vật chính | `/assets/h5/hero.png`; `IncidentActorView` trong `incidentArt.ts`; `PlaceholderActorView` | Thay bằng nhân vật có rig + các animation. Atlas hero cũ chỉ chia 4×4 ô, 8 hướng × 2 frame; không đủ cho bộ animation hoàn chỉnh. |
| Người đi phố, người bán, khách, bảo vệ, bác sĩ | `StreetLifeView`, `LOOKS`, `person()` trong `streetArt.ts` | Bộ nhân vật dùng chung rig; skin/quần áo/phụ kiện phân biệt vai trò. Bác sĩ cần hai instance đồng bộ khi khiêng, không cần hai bộ rig riêng. |
| Xe cộ | `ambulance()`, `motorbike()` và xe đỗ trong `streetArt.ts` / `incidentArt.ts` | Xe cứu thương có bánh, cửa và trạng thái đón/chở/nổ; xe máy thường và xe chở hàng. Phải xoay theo cả đường chính và ngõ. |
| Đường, ngõ, sân, hồ, nhà, hàng quán | `drawIncidentEnvironment()` trong `incidentArt.ts`; `/assets/h5/terrain.png` | Bộ môi trường modular và vật cản khớp bản đồ; tách nền, nhà, cửa, mái, vật cản và biển hiệu. Không gộp cả phố thành một ảnh nếu dùng 3D trực tiếp. |
| Sự cố, kết thúc và VFX | `IncidentRunView`, `runPose()`, `RunService` | Asset riêng từng tình huống trong §3; animation nhân vật nhận tác động và VFX đúng thời điểm. |
| Cổng chuyển cảnh | `TransitionScene.ts` | Cổng, tay nắm, ánh sáng là UI vẽ bằng code. Có thể giữ dạng overlay 2D; cần thiết kế final và âm thanh mở/đóng. |
| UI | `StoryHud.ts`, `speechBubble.ts`, `SettingsModal.ts`, `assetRegistry.ts` | Icon, nút các trạng thái, panel, bong bóng thoại, bảng lựa chọn, thiết lập, portrait. Chữ tiếng Việt để render riêng, không dán sẵn vào ảnh. |
| Chương sau | `/assets/story/portal.png`, `sensory-stone.png`, `cafe-facade.png`, `trees.png`; các atlas farm/extra/portrait | Ngoài phạm vi Slice Chương 1, trừ phần chuyển cảnh kết chương. Lập đợt sản xuất riêng. |
| Âm thanh | `RunAudio.ts`, âm thanh trong `TransitionScene.ts` | Hiện là âm thanh tổng hợp bằng Web Audio. Cần nhạc/SFX final, không phải thay vài ảnh là hoàn tất. |

Các atlas UI tổng quát cũ còn có `extra.png`, `panel.png`, `button.png`, `icons.png`, `farm.png`, `portrait.png`. `assetRegistry.ts` hiện trả container rỗng nếu chưa tải texture `ui/<key>`; chỉ thêm file ảnh mà không đăng ký/tải sẽ chưa hiển thị.

## 3. Gói asset tối thiểu cho một chương hoàn chỉnh

| Gói | Cần có | Chuyển động / trạng thái bắt buộc |
|---|---|---|
| Người chơi | 1 model, 1 rig, material/texture; định hướng nghệ thuật front/side/back | Idle, đi, chạy, quay, nói chuyện, phản ứng, trượt/vấp, ngã, nằm, được nâng/khiêng, đưa vào xe. Một số clip dùng chung nhưng phải kiểm tra mọi tình huống. |
| Bác sĩ | 1 bộ nhân vật dùng hai instance hoặc 2 skin | Ra xe, đi đến, chuẩn bị nâng, nâng, khiêng cùng nhau, đặt vào xe. Đồng bộ tay với nhân vật/cửa. Hiện kịch bản cố ý quên cáng, nên không cần làm asset cáng. |
| Người và động vật phụ | Người bán/khách/bảo vệ/người đi đường; chó nhỏ/chó Ngao, mèo, gà, bồ câu | Người: idle/đi/nói/chụp ảnh/chỉ tay. Động vật: idle/đi/chạy, đuổi, bỏ đi; chó thêm liếm, mèo quán thêm nằm/ngủ. |
| Xe và đường | Xe cứu thương, xe máy, xe chở hàng, xe đỗ; đường, vỉa hè, vạch, barie, ngõ/sân | Bánh quay, xe đổi hướng; xe cứu thương mở/đóng cửa, bánh rơi; barie nâng/hạ. Dữ liệu kích thước và điểm tương tác đi kèm. |
| Dựng phố | Nhà modular, cửa/mái/cửa sổ, tường ngõ, dây điện/cột, cây, hàng rào, quầy hàng, ghế, biển | Cửa quán mở/đóng; phần che nhân vật cần fade/cắt mái theo camera. Vật cản không được lệch collider. |
| Sự cố 1–4 | Vỏ chuối + vỏ thứ hai; sầu riêng; chậu nước + nước; quả cầu | Cảnh báo vị trí, rơi/ném/trượt/va chạm; khớp thời gian gameplay. |
| Sự cố 5–8 | Chó nhỏ/chó Ngao; mèo ngoài phố; hố/ổ voi + nắp cống; dây phơi/quần áo | Đuổi/vấp; hố mở và nhân vật hụt chân; quần đùi che đầu là mất tầm nhìn tạm thời, không trực tiếp gây ngất. |
| Sự cố 9–12 | Xe chở hàng; dép tổ ong; đàn bồ câu + bánh mì; gà từ thùng xe | Xe quẹt/né; dép bay rồi quay lại; chim bay/tha; gà bung thùng và đuổi. Gà là nhánh phụ sau khi né xe chở hàng, không phải sự cố được rút độc lập. |
| Sáu kết thúc sau khi sống sót | Quả sấu; tờ tiền + cột điện; ghế gãy; tiêu/hắt hơi; chó liếm; báo có ảnh nhân vật | Đủ setup → hành động → phản ứng → tư thế ngã. Ghế/phở/báo có điều kiện đã nghe hội thoại liên quan. |
| VFX | Cảnh báo, bụi/ngã, khói phanh, nước, flash máy ảnh, vòng dịch chuyển, bánh rơi và nổ | Tách particle/mesh/material khỏi model. Có mức chất lượng thấp; không che dấu hiệu nguy hiểm hoặc chữ. |
| UI final | Nút âm thanh/cài đặt, lựa chọn, hội thoại, portrait, chuyển cảnh | Normal/pressed/disabled; PC có hover; hỗ trợ màn dọc/ngang, safe area, tiếng Việt. Giữ quyết định đã bỏ bảng Mục tiêu và nhấp nháy nhân vật. |
| Âm thanh final | Nhạc phố, ambience, bước chân, cảnh báo từng sự cố, va chạm/ngã, xe/còi/phanh, bác sĩ khiêng, cổng/nổ, UI | Loop liền mạch; không clipping; đồng bộ sự kiện; điều chỉnh âm lượng và mute; mở khóa audio sau thao tác đầu tiên trên mobile. Voice-over chưa nằm trong scope, chỉ làm nếu được chọn. |

## 4. Hai đường làm đồ họa cần phân biệt

### A. Model 3D chạy trực tiếp — đúng yêu cầu Vertical Slice mới

Bàn giao `.blend` nguồn + `.glb` đã export + texture + danh sách clip. Dự án hiện chưa có bộ nạp model, animation mixer, camera 3D, ánh sáng 3D hay raycast chọn đối tượng. Cần tích hợp renderer 3D, ánh xạ tọa độ và input; tái dùng mô phỏng gameplay/nav grid nếu vẫn phù hợp. Các renderer riêng trong `incidentArt.ts`, `streetArt.ts` cũng phải được thay, không chỉ `PlaceholderRenderer`.

Không chọn engine/thư viện hoặc chuyển toàn bộ dự án trong đợt sửa lỗi này. Bước thử đầu tiên là **một nhân vật + một đoạn đường/ngõ + xe cứu thương + hai bác sĩ**, kiểm tra di chuyển/cứu hộ trên thiết bị mục tiêu trước khi sản xuất cả bộ.

### B. Dựng 3D rồi render thành ảnh/atlas — phương án giữ pipeline 2.5D

Bàn giao thêm PNG nền trong suốt + atlas JSON + clip theo hướng. Có thể tiếp tục Phaser và đỡ thay nền tảng hiển thị, nhưng runtime vẫn là 2D; ánh sáng, góc nhìn và animation đã render sẵn. Không gọi phương án này là đã hoàn thành yêu cầu 3D trực tiếp.

## 5. Chuẩn bàn giao cho artist/animator

- Có 2–3 ảnh target đã chốt: nhân vật, môi trường và một màn hoàn chỉnh; xác nhận giữ phố cổ ban ngày hiện tại hay đổi sang hướng khác. ART_BIBLE cũ mô tả phố mưa đêm và rừng ở chương sau, không còn khớp hoàn toàn bản đang chơi; không dùng nó như brief đã duyệt cuối cùng.
- Model có kích thước thống nhất; đề xuất 1 đơn vị bản đồ = 1 mét, nhưng phải duyệt tỷ lệ chibi và thử lại xe/ngõ trước khi khóa. Nhân vật pivot ở chân; xe ở tâm đáy; cửa/barie/bánh có pivot đúng trục quay. Apply transform, không scale âm tùy tiện.
- Xuất `.glb` có rig/skin/material, giữ tên object/bone/clip ổn định. File nguồn `.blend` và texture nguồn phải đi kèm. Animation di chuyển in-place; gameplay quyết định vận tốc, tránh model tự đi lệch collider vì root motion.
- Clip ghi rõ duration, loop/non-loop và thời điểm tiếp xúc: chân chạm đất, tay nâng người, va chạm, đóng cửa. Khiêng dùng cùng một timeline cho người chơi và hai bác sĩ; có socket tay, vị trí người được khiêng và điểm đặt vào xe.
- Texture có UV sạch, không mất link; Base Color và các map Normal/Roughness/Metallic/AO khi cần. Normal map thống nhất theo pipeline export. Texture dùng chung/atlas cho NPC và props; không tạo một material riêng cho từng đồ vật nhỏ.
- Mỗi prefab có bounding box, footprint/collider đơn giản, điểm cửa lên/xuống, vùng tương tác và mức che khuất. Xe có chiều rộng/chiều dài thật để kiểm tra đường, chỗ đỗ và bán kính quay; nhà có phần mái/mặt tiền tách được để tránh che nhân vật.
- UI: nguồn SVG hoặc file thiết kế, PNG nền trong suốt khi cần; panel/nút có vùng 9-slice và bộ trạng thái. Bàn giao riêng chữ; font có glyph tiếng Việt và giấy phép phù hợp.
- Âm thanh: master WAV, loop marker và bản export cho runtime theo pipeline được chốt; ghi cue, độ dài, loop và mức âm lượng tương đối. Kèm giấy phép/quyền sử dụng mọi model, texture, font và audio.
- Kèm một scene mẫu có camera orthographic, ánh sáng, mặt đất, một nhân vật và xe để so khớp tỷ lệ/màu; nghiệm thu bằng scene trong game, không chỉ ảnh đẹp từ phần mềm dựng.

## 6. Ngân sách và tiêu chí nghiệm thu

Đây là **mục tiêu khởi đầu để đo và chỉnh**, không phải thông số hiệu năng đã đạt hoặc giới hạn cứng áp dụng cho mọi máy:

| Hạng mục | Mục tiêu đề xuất |
|---|---|
| Mobile | Ít nhất 30 FPS ổn định khi có xe, đám đông, thoại và VFX; không giật khi xuất hiện asset mới. Đo trên điện thoại thật, gồm Android và iOS được chọn hỗ trợ. |
| PC | Hướng tới 60 FPS ở cấu hình tham chiếu đã chốt. |
| Model chính | Bắt đầu khoảng 8–15 nghìn tam giác cho hero; NPC/xe khoảng 3–10 nghìn tùy vai trò; đo cả skinning, bóng và số instance. |
| Texture | Thường 512–1024 cho NPC/props, hero có thể 2048 khi cần. Ưu tiên dùng chung material; kiểm tra độ nét ở camera thực tế. |
| Cảnh | Đo draw calls, thời gian CPU/GPU, memory texture và thời gian tải của chương mẫu; quyết định LOD/culling/instancing/light bake từ kết quả đo. Chưa có profiling 3D nên chưa khóa con số tổng scene. |
| QA nội dung | 12 sự cố + 6 kết thúc + hai lựa chọn barie + các lựa chọn ở quầy hàng ngoài trời; kiểm tra âm/VFX/animation đúng lúc và không kẹt khi cứu hộ. |
| QA bản đồ | Các góc/ngõ, cạnh props, lối vào ngõ, hai đầu phố; xe chỉ đi ở đường đủ rộng, điểm đỗ có đường bộ tới nhân vật và có lối xe rời đi. |
| QA UI/input | Mobile dọc/ngang, safe area, kéo camera và joystick riêng; PC chuột/phím; không che nhân vật/nguy hiểm hoặc mất nút lựa chọn. |

## 7. Lộ trình thực hiện

1. Đóng Prototype bằng kiểm tra gameplay và điện thoại thật; chốt danh sách tình huống, tuyến cứu hộ và cảm giác điều khiển.
2. Chốt target look, 3D runtime hay 3D render-to-sprite, camera, thiết bị hỗ trợ và phạm vi đúng một chương.
3. Làm scene thử nhỏ nêu ở §4; đo hiệu năng và duyệt art trong game.
4. Sản xuất và tích hợp đủ gói §3, hoàn thiện UI/âm thanh, kiểm tra trọn chương. Đây là nghiệm thu Vertical Slice.
5. Dùng chuẩn đã duyệt để làm Production: mở rộng nội dung, nâng chất lượng có kiểm soát, LOD/texture/light bake/VFX budget, regression và nghiệm thu thiết bị.

Tài liệu này là audit và brief bàn giao; chưa tạo hoặc nhập model, texture, animation hay audio final.

## 8. Cập nhật phạm vi và nghiệm thu theo yêu cầu mới

- Đã bỏ `ShopScene`, `ShopService`, cửa vào, biển hiệu và toàn bộ hội thoại/mèo của cà phê ông Tám ở Chương 1. Hệ quản lý quán ở các chương sau không thuộc phần bị xóa.
- Cảnh phố chuyển sang một hàng nhà thấp, cache theo từng nhà và xếp lớp theo chân nhà; hồ chỉ nằm phía bờ hồ. Không dùng lại bố cục hai hàng nhà chồng lên nhau.
- Nhân vật dùng cùng quy tắc va chạm khi kéo điều khiển hoặc nhấp đi tới; đường bác sĩ kiểm tra khoảng trống theo kích thước người ở từng bước. Tư thế ngã/được khiêng giữ thứ tự che khuất theo vị trí mặt đất.
- NPC chỉ dùng dáng đi khi thực sự đổi vị trí; đạt chỗ đứng thì bỏ mục tiêu đã đến, giữ hướng và thứ tự vẽ ổn định.
- **Người dùng yêu cầu dừng test tự động để tự chơi thử.** Các thay đổi sau yêu cầu này chưa được chạy lại test hoặc kiểm tra trên điện thoại thật; chưa đóng nghiệm thu Prototype 1.
