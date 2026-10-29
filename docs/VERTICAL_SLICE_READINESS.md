# Kiểm tra Prototype và yêu cầu bàn giao đồ họa

> **Kế hoạch hiện hành sau khi rà bản mới ngày 2026-10-29:** xem [VERTICAL_SLICE_PLAN.md](VERTICAL_SLICE_PLAN.md), theo dõi T-099–T-108 trong task list. Các mục audit cũ dưới đây lưu diễn biến; không dùng số PNG/danh sách lỗi cũ làm hiện trạng. Master đã tách, runtime WebP khoảng 5,3 MB. T-100 đã gỡ CHAPTER1_ONLY, tiếp tục checkpoint và chuyển S03 → S04 thống nhất; xem ghi nhận triển khai luồng 1 trong kế hoạch. Đang Review, chưa nghiệm thu thiết bị thật.

Ngày kiểm tra: 2026-10-28. Phạm vi Vertical Slice đề xuất: **Chương 1 – Phố cổ Hà Nội**, gồm ngoài phố, các quầy hàng ngoài trời, sự cố, cứu thương và chuyển sang chương tiếp theo. **Quán cà phê ông Tám đã được bỏ khỏi Chương 1 theo yêu cầu ngày 2026-10-28.** Chưa bao gồm nâng cấp toàn bộ nông trại và quản lý quán ở các chương sau.

**Cập nhật sau khi duyệt ảnh định hướng:** tiếp tục **2.5D isometric bằng sprite/atlas trong Phaser**, không chuyển sang 3D runtime. Yêu cầu model/rig/GLB bên dưới chỉ áp dụng nếu chọn dựng 3D làm nguồn render sprite hoặc đổi hướng về sau. Đợt asset đầu gồm hero và ba mẫu nhà đã nối vào mã; xem [prompt, file và giới hạn đợt 01](art/chapter1/ASSET_PASS_01.md). Chưa chạy lại game/test hoặc nghiệm thu trên điện thoại thật.

**Chốt phạm vi mới ngày2026-10-29:** người dùng chọn **bỏ hồ, đổi thành khu phố kéo dài**. Đợt09 thay nền rải asset bằng ảnh background phố lặp quanh camera; xóa nước/kè/Tháp Rùa/Thê Húc/Ngọc Sơn. Mô tả hồ ở brief cũ bên dưới chỉ còn lịch sử. Xem [background09](art/chapter1/BACKGROUND_PASS_09.md). Chưa chạy game/test hoặc nghiệm thu background trong game.

**Rà thị giác mới nhất:** đã mở game và cài đặt theo yêu cầu tựcheck ngày2026-10-29; bản ghép còn lệch phong cách và tỷ lệ, background lặp gương làm lộ map như sàn nổi. Đề xuất giữUI làm chuẩn, chốt một khung mẫu tổng hợp rồi mới thay hàng loạt. Xem [review10](art/chapter1/VISUAL_REVIEW_10.md). Chưa sửa lại art theo phương án này, chưa nghiệm thu Slice.

**Khung mẫu theo UI:** [style-frame-v1.png](art/chapter1/style-frame-v1.png) và [brief11](art/chapter1/STYLE_FRAME_11.md) đã được tạo để duyệt phong cách toàn cảnh; chưa đưa vào runtime và chưa thay asset hiện tại. Đây là ảnh định hướng, không phải bằng chứng game đã hiển thị như mẫu.

**Đoạn phố mẫu đang Review (T-096):** đã bỏ background ảnh lậtgương, nối mặt đất và phố đối diện theo lưới; chỉ sửa lát/bóvỉa đầu phố, giữ bộnhà/người/UI. Đã mở bảnchạy xem PC vàmobile390×844 giảlập; [mẫu13 và ảnh](art/chapter1/STREET_SAMPLE_13.md) ghi phạmvi/giớihạn. Chưa áp dụng mỹthuật khungmẫu11 trên toànbộgame hoặc nghiệmthu thiếtbịthật.

## 0. Rà soát khoảng cách tới Vertical Slice — 2026-10-28

**Chưa đạt Vertical Slice. Hiện đã ghép bộ art đầu vào gameplay; chưa có bằng chứng trải nghiệm hoàn chỉnh với chất lượng đại diện bản cuối.** “Đã nối atlas” không đồng nghĩa animation/art đã hoàn thiện. Đánh giá dưới đây dựa trên mã nguồn, file và tài liệu; không chạy game/test/typecheck/build theo yêu cầu người dùng tự thử.

Phạm vi hiện hành: một chương phố cổ ban ngày, sprite/atlas 2.5D trong Phaser, 12 sự cố, tai nạn → cứu thương → trùng sinh/chuyển chương. Không có quán ông Tám, sáu cú chót theo thời gian, bảng mục tiêu hoặc nhấp nháy nhân vật. Không bắt buộc thêm model 3D/rig/GLB hoặc thay toàn bộ ảnh vẽ bằng code; chỉ cần chất lượng và hành vi nhất quán ở camera thật. Các hướng dẫn 3D phía dưới là tham khảo cho nguồn render hoặc phương án khác, không phải điều kiện nghiệm thu của hướng đang chọn.

| Ưu tiên / việc còn phải làm | Bằng chứng hiện có và khoảng trống | Điều kiện hoàn tất | Task |
|---|---|---|---|
| 1. Nhân vật và cứu hộ | Đợt08 đã nối hero vấp/ngã/nằm/khiêng bằng frame riêng trước/sau; giữ dịch chuyển theo nhịp sự cố, không xoay hình đứng khi có atlas. Thêm16 kiểu người và gắn chủ quầy/khách theoID. Bác sĩ có atlas nâng/khiêng nhưng chưa duyệt tiếp xúc trong game. | Bộ pose/chuyển tiếp đủ rõ cho vấp/trượt/va chạm, nằm, nâng/khiêng/lên xe; chân không trượt, tay khớp thân người và cửa; không cần tạo animation riêng cho từng sự cố nếu dùng chung hợp lý. | T-068, T-076–078 |
| 2. Phố, camera và vật cản | Giữ sáu nhà mới/sáu loài cây đợt08; đợt09 bỏ hồ/landmark/kè và nền rải asset, thay bằng một background phố lặp quanh camera. Cổng/dây điện và ranh vườn thấp giữ code theo lưới. Cây che hero giảm alpha. Footprint hình/collider, mép nối background/tỷ lệ và camera chưa được duyệt trong game. | Nhìn rõ nhân vật/nguy hiểm trong ngõ, sát quầy/cây và dưới cổng; tỷ lệ, chân ảnh, lớp trước/sau đúng; camera xa vừa đủ cho dọc/ngang/PC; xe đi hết tuyến. Chỉ thay phần code art nếu không đạt hình mục tiêu. | T-067, T-071, T-073–074, T-079 |
| 3. UI và chuyển cảnh | UI đợt 01 mới sửa lựa chọn/cài đặt/resize. Bong bóng rìa camera, thoại cứu hộ chồng nhau, portrait và chuyển cảnh chưa được duyệt. Loading hiện tiến dần đến 90% khi chờ ready, chưa phải tiến độ tải byte thật. | Câu dài không cắt/đè; lựa chọn đọc và bấm rõ, không kích joystick/bản đồ; menu không chạy nguy hiểm phía sau; loading/chuyển cảnh dễ hiểu, không mắc khi tải lỗi. Có thể giữ cổng/UI vẽ bằng code. | T-082 |
| 4. 12 sự cố và VFX | Có ảnh 12/12 và nhánh phụ; các pose AI cần duyệt nối frame. Bụi/lông/sao/nổ/portal và nhiều phản ứng vẫn hệ cũ. | Cảnh báo trước va chạm, hitbox phù hợp hình; hố/dép/nước/quần áo/gà hoạt động đúng nhánh; không ảnh dư, nhấp nháy hay hiệu ứng che người/chữ. VFX đơn giản đủ đọc, không cần thêm hiệu ứng lặp. | T-080, T-068 |
| 5. Âm thanh | `RunAudio.ts` và `TransitionScene.ts` vẫn tổng hợp Web Audio; chưa có bộ nhạc phố/ambience/SFX được duyệt. | Chọn và tích hợp nhạc nền/ambience/cue phù hợp phố Việt; sự cố, xe, cứu hộ, chuyển cảnh, UI nghe rõ và đúng lúc; loop/mức âm/mute và audio mobile ổn. Có thể giữ cue tổng hợp nếu đạt chất lượng đã chốt; không bắt buộc thu voice. | T-083 |
| 6. Tải và hiệu năng | Sau đợt08 ngày2026-10-29:34 PNG trong `public/assets/slice/chapter1/` tổng **49,87 MiB** (đọc dung lượng file; mốc audit trước đó26 PNG35,49 MiB). `registerSliceFrames()` downsample sau tải, chưa giảm dung lượng mạng. Chưa đo lại trên điện thoại. | Giữ master riêng, xuất ảnh runtime đúng cỡ/nén phù hợp; đo tải lạnh, texture memory và FPS lúc đông người/cứu hộ; mục tiêu ban đầu mobile ≥30 FPS, PC gần60 FPS trên máy tham chiếu được chọn. | T-084, T-069 |
| 7. Khóa luật và nghiệm thu toàn chương | Bỏ ép ngất120s: né được thì còn tiếp tục chơi. Sửa va chạm/cứu hộ và các đợt art chưa được người dùng xác nhận trên máy thật. | Xác nhận việc không giới hạn thời gian là chủ ý; kiểm tra cứu hộ ở hai đầu phố/ngõ/góc hẹp/sát quầy; đủ nhánh qua nhiều lượt; chơi từ bắt đầu tới trùng sinh trên PC và điện thoại dọc/ngang. Ghi lỗi và sửa trước khi đóng mốc. | T-085, T-075, T-086 |

**Thứ tự đề xuất:** nhân vật/cứu hộ → độ đọc phố/camera → UI và chuyển cảnh → duyệt sự cố/VFX → âm thanh → tối ưu/thiết bị → nghiệm thu. Có thể xuất PNG nhỏ sớm để giảm thời gian tải trong các lượt tự chơi. Không cần tạo thêm tình huống mới hoặc mở rộng chương khác để đạt mốc này.

Không gán phần trăm hoàn thành: chưa có buổi duyệt art/animation trong game, chưa có số đo thiết bị và chưa chốt danh sách lỗi sau tích hợp. Việc người dùng thấy “còn nhiều” phù hợp với khoảng trống thực tế giữa art đầu tiên và một chương hoàn thiện.

## 1. Kết luận hiện trạng

| Mốc | Hiện trạng | Điều kiện để đóng mốc |
|---|---|---|
| Prototype | Có bản chơi được: di chuyển, tương tác, hội thoại, 12 loại sự cố, cứu thương, chuyển chương, UI và âm thanh tạm. Chưa nên gọi là đã nghiệm thu hoàn toàn. | Kiểm tra các góc/ngõ, đường cứu hộ, đủ nhánh nội dung; chơi thử trên điện thoại thật, xác nhận cảm giác điều khiển, độ đọc UI và hiệu năng. Unit test không thay thế nghiệm thu thiết bị thật. |
| Vertical Slice | Chưa đạt: đã nối art hero/nhà, cứu hộ, người/xe và môi trường qua đợt 01–04, đang chờ tự duyệt; art 12/12 sự cố đã nối và chờ tự duyệt; UI/audio và animation final còn thiếu. Hướng được chọn là 2.5D. | Hoàn thiện đúng một chương từ đầu đến cuối với chất lượng hình, UI, âm thanh đại diện cho bản cuối, chạy trong ngân sách thiết bị mục tiêu. |
| Production | Chưa bắt đầu ở mức đồ họa sản xuất. | s |

**Lưu ý:** Không cần người chơi gặp đủ 12 sự cố trong một lượt. Một lần ngã đã dẫn đến cứu thương và hết chương. Phải kiểm tra từng sự cố riêng, các nhánh phụ và sự đa dạng qua nhiều lượt chơi.

## 2. Hiện tại phải thay những gì?

`public/assets/slice/chapter1/` hiện có34 PNG sau đợt08: hero, nhà, bác sĩ/khiêng, xe cứu thương/bánh rời, ba nhóm người, xe máy, quầy/cây/xe đỗ và art cho 12 sự cố, đăng ký riêng trong `sliceAssets.ts`. `ART_READY` trong `src/components/render/h5Assets.ts` vẫn rỗng vì atlas cũ có quy cách khác. Các đường dẫn h5 bên dưới là điểm gắn asset dự kiến, **không phải bộ ảnh sản xuất đang có và chỉ cần ghi đè**:

| Nhóm | Asset dự kiến / mã hiện tại | Công việc thay thế |
|---|---|---|
| Nhân vật chính | `/assets/h5/hero.png`; `IncidentActorView` trong `incidentArt.ts`; `PlaceholderActorView` | Hoàn thiện sprite animation phản ứng/ngã/nằm/khiêng; rig chỉ cần nếu dùng 3D làm nguồn render. Atlas hero cũ chỉ chia 4×4 ô, 8 hướng × 2 frame; không đủ cho bộ animation hoàn chỉnh. |
| Người đi phố, người bán, khách, bảo vệ, bác sĩ | `StreetLifeView`, `LOOKS`, `person()` trong `streetArt.ts` | Bộ nhân vật dùng chung rig; skin/quần áo/phụ kiện phân biệt vai trò. Bác sĩ cần hai instance đồng bộ khi khiêng, không cần hai bộ rig riêng. |
| Xe cộ | `ambulance()`, `motorbike()` và xe đỗ trong `streetArt.ts` / `incidentArt.ts` | Xe cứu thương có bánh, cửa và trạng thái đón/chở/nổ; xe máy thường và xe chở hàng. Phải xoay theo cả đường chính và ngõ. |
| Đường, ngõ, sân, hồ, nhà, hàng quán | `drawIncidentEnvironment()` trong `incidentArt.ts`; `/assets/h5/terrain.png` | Bộ môi trường modular và vật cản khớp bản đồ; tách nền, nhà, cửa, mái, vật cản và biển hiệu. Không gộp cả phố thành một ảnh nếu dùng 3D trực tiếp. |
| Sự cố và VFX | `IncidentRunView`, `runPose()`, `RunService` | Asset riêng từng tình huống trong §3; animation nhân vật nhận tác động và VFX đúng thời điểm. |
| Cổng chuyển cảnh | `TransitionScene.ts` | Cổng, tay nắm, ánh sáng là UI vẽ bằng code. Có thể giữ dạng overlay 2D; cần thiết kế final và âm thanh mở/đóng. |
| UI | `StoryHud.ts`, `speechBubble.ts`, `SettingsModal.ts`, `assetRegistry.ts` | Icon, nút các trạng thái, panel, bong bóng thoại, bảng lựa chọn, thiết lập, portrait. Chữ tiếng Việt để render riêng, không dán sẵn vào ảnh. |
| Chương sau | `/assets/story/portal.png`, `sensory-stone.png`, `cafe-facade.png`, `trees.png`; các atlas farm/extra/portrait | Ngoài phạm vi Slice Chương 1, trừ phần chuyển cảnh kết chương. Lập đợt sản xuất riêng. |
| Âm thanh | `RunAudio.ts`, âm thanh trong `TransitionScene.ts` | Hiện là âm thanh tổng hợp bằng Web Audio. Cần nhạc/SFX final, không phải thay vài ảnh là hoàn tất. |

Các atlas UI tổng quát cũ còn có `extra.png`, `panel.png`, `button.png`, `icons.png`, `farm.png`, `portrait.png`. `assetRegistry.ts` hiện trả container rỗng nếu chưa tải texture `ui/<key>`; chỉ thêm file ảnh mà không đăng ký/tải sẽ chưa hiển thị.

## 3. Gói asset tối thiểu cho một chương hoàn chỉnh

| Gói | Cần có | Chuyển động / trạng thái bắt buộc |
|---|---|---|
| Người chơi | Một bộ sprite/atlas nhân vật nhất quán theo hướng; file nguồn và metadata frame/pivot | Idle, đi, chạy, quay, nói chuyện, phản ứng, trượt/vấp, ngã, nằm, được nâng/khiêng, đưa vào xe. Một số clip dùng chung nhưng phải kiểm tra mọi tình huống. |
| Bác sĩ | 1 bộ nhân vật dùng hai instance hoặc 2 skin | Ra xe, đi đến, chuẩn bị nâng, nâng, khiêng cùng nhau, đặt vào xe. Đồng bộ tay với nhân vật/cửa. Hiện kịch bản cố ý quên cáng, nên không cần làm asset cáng. |
| Người và động vật phụ | Người bán/khách/bảo vệ/người đi đường; chó nhỏ/chó Ngao, mèo, gà, bồ câu | Người: idle/đi/nói/chụp ảnh/chỉ tay. Động vật: idle/đi/chạy, đuổi, bỏ đi; pose phản ứng phù hợp các sự cố còn giữ; không yêu cầu mèo quán hoặc chó liếm của nhánh đã bỏ. |
| Xe và đường | Xe cứu thương, xe máy, xe chở hàng, xe đỗ; đường, vỉa hè, vạch, barie, ngõ/sân | Bánh quay, xe đổi hướng; xe cứu thương mở/đóng cửa, bánh rơi; barie nâng/hạ. Dữ liệu kích thước và điểm tương tác đi kèm. |
| Dựng phố | Nhà modular, cửa/mái/cửa sổ, tường ngõ, dây điện/cột, cây, hàng rào, quầy hàng, ghế, biển | Cửa quán mở/đóng; phần che nhân vật cần fade/cắt mái theo camera. Vật cản không được lệch collider. |
| Sự cố 1–4 | Vỏ chuối + vỏ thứ hai; sầu riêng; chậu nước + nước; quả cầu | Cảnh báo vị trí, rơi/ném/trượt/va chạm; khớp thời gian gameplay. |
| Sự cố 5–8 | Chó nhỏ/chó Ngao; mèo ngoài phố; hố/ổ voi + nắp cống; dây phơi/quần áo | Đuổi/vấp; hố mở và nhân vật hụt chân; quần đùi che đầu là mất tầm nhìn tạm thời, không trực tiếp gây ngất. |
| Sự cố 9–12 | Xe chở hàng; dép tổ ong; đàn bồ câu + bánh mì; gà từ thùng xe | Xe quẹt/né; dép bay rồi quay lại; chim bay/tha; gà bung thùng và đuổi. Gà là nhánh phụ sau khi né xe chở hàng, không phải sự cố được rút độc lập. |
| VFX | Cảnh báo, bụi/ngã, khói phanh, nước, flash máy ảnh, vòng dịch chuyển, bánh rơi và nổ | Tách particle/mesh/material khỏi model. Có mức chất lượng thấp; không che dấu hiệu nguy hiểm hoặc chữ. |
| UI final | Nút âm thanh/cài đặt, lựa chọn, hội thoại, portrait, chuyển cảnh | Normal/pressed/disabled; PC có hover; hỗ trợ màn dọc/ngang, safe area, tiếng Việt. Giữ quyết định đã bỏ bảng Mục tiêu và nhấp nháy nhân vật. |
| Âm thanh final | Nhạc phố, ambience, bước chân, cảnh báo từng sự cố, va chạm/ngã, xe/còi/phanh, bác sĩ khiêng, cổng/nổ, UI | Loop liền mạch; không clipping; đồng bộ sự kiện; điều chỉnh âm lượng và mute; mở khóa audio sau thao tác đầu tiên trên mobile. Voice-over chưa nằm trong scope, chỉ làm nếu được chọn. |

## 4. Hai đường làm đồ họa cần phân biệt

### A. Model 3D chạy trực tiếp — phương án tham khảo, chưa chọn

Bàn giao `.blend` nguồn + `.glb` đã export + texture + danh sách clip. Dự án hiện chưa có bộ nạp model, animation mixer, camera 3D, ánh sáng 3D hay raycast chọn đối tượng. Cần tích hợp renderer 3D, ánh xạ tọa độ và input; tái dùng mô phỏng gameplay/nav grid nếu vẫn phù hợp. Các renderer riêng trong `incidentArt.ts`, `streetArt.ts` cũng phải được thay, không chỉ `PlaceholderRenderer`.

Không chọn engine/thư viện hoặc chuyển toàn bộ dự án trong đợt sửa lỗi này. Bước thử đầu tiên là **một nhân vật + một đoạn đường/ngõ + xe cứu thương + hai bác sĩ**, kiểm tra di chuyển/cứu hộ trên thiết bị mục tiêu trước khi sản xuất cả bộ.

### B. Ảnh/atlas 2.5D — hướng đã chọn

Bàn giao PNG nền trong suốt + atlas JSON hoặc quy cách ô + animation theo hướng. Có thể vẽ 2D, tạo ảnh rồi chỉnh lại hoặc dựng 3D để render sprite. Tiếp tục Phaser; runtime vẫn là 2D, ánh sáng và góc nhìn được thể hiện sẵn trong ảnh. Đợt đầu đang dùng atlas AI để thử tích hợp, chưa có bộ chuyển động được nghiệm thu.

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
| QA nội dung | 12 sự cố + hai biến thể ở barie (xe máy lao qua / barie rơi trúng đầu) + các lựa chọn ở quầy hàng ngoài trời; kiểm tra âm/VFX/animation đúng lúc và không kẹt khi cứu hộ. |
| QA bản đồ | Các góc/ngõ, cạnh props, lối vào ngõ, hai đầu phố; xe chỉ đi ở đường đủ rộng, điểm đỗ có đường bộ tới nhân vật và có lối xe rời đi. |
| QA UI/input | Mobile dọc/ngang, safe area, kéo camera và joystick riêng; PC chuột/phím; không che nhân vật/nguy hiểm hoặc mất nút lựa chọn. |

## 7. Lộ trình thực hiện

1. Đóng Prototype bằng kiểm tra gameplay và điện thoại thật; chốt danh sách tình huống, tuyến cứu hộ và cảm giác điều khiển.
2. Đã chọn ảnh định hướng và pipeline sprite/atlas 2.5D; tiếp tục chốt camera, thiết bị hỗ trợ và phạm vi đúng một chương.
3. Thay asset từng nhóm trên màn đang chơi, bắt đầu hero/nhà rồi bác sĩ/xe; đo hiệu năng và duyệt art trong game.
4. Sản xuất và tích hợp đủ gói §3, hoàn thiện UI/âm thanh, kiểm tra trọn chương. Đây là nghiệm thu Vertical Slice.
5. Dùng chuẩn đã duyệt để làm Production: mở rộng nội dung, nâng chất lượng có kiểm soát, LOD/texture/light bake/VFX budget, regression và nghiệm thu thiết bị.

Tài liệu này là audit và brief bàn giao; đã tạo và nối atlas hero/nhà đợt đầu, chưa có model/animation/audio final hoặc nghiệm thu đầy đủ.

## 8. Cập nhật phạm vi và nghiệm thu theo yêu cầu mới

- Đã bỏ `ShopScene`, `ShopService`, cửa vào, biển hiệu và toàn bộ hội thoại/mèo của cà phê ông Tám ở Chương 1. Hệ quản lý quán ở các chương sau không thuộc phần bị xóa.
- Cảnh phố chuyển sang một hàng nhà thấp, cache theo từng nhà và xếp lớp theo chân nhà; hồ chỉ nằm phía bờ hồ. Không dùng lại bố cục hai hàng nhà chồng lên nhau.
- Nhân vật dùng cùng quy tắc va chạm khi kéo điều khiển hoặc nhấp đi tới; đường bác sĩ kiểm tra khoảng trống theo kích thước người ở từng bước. Tư thế ngã/được khiêng giữ thứ tự che khuất theo vị trí mặt đất.
- NPC chỉ dùng dáng đi khi thực sự đổi vị trí; đạt chỗ đứng thì bỏ mục tiêu đã đến, giữ hướng và thứ tự vẽ ổn định.
- **Người dùng yêu cầu dừng test tự động để tự chơi thử.** Các thay đổi sau yêu cầu này chưa được chạy lại test hoặc kiểm tra trên điện thoại thật; chưa đóng nghiệm thu Prototype 1.

## 9. Các đợt hoàn thiện theo hướng 2.5D

Theo yêu cầu làm dần để hoàn chỉnh màn 1, triển khai từng nhóm và giữ trạng thái Review tới khi người dùng tự chơi xác nhận:

1. **Nhân vật chính/nhà:** đã nối atlas đợt01; đợt08 thêm pose hero phản ứng/nằm/khiêng và sáu nhà mới. Cần duyệt ở camera thực tế, chưa nghiệm thu animation final.
2. **Cứu hộ:** đã nối bác sĩ đứng/đi/cúi/nâng/khiêng, xe bốn hướng đóng/mở cửa/mất bánh và bánh rời. [Đợt 02](art/chapter1/ASSET_PASS_02.md) ghi đủ prompt và giới hạn. Chưa nghiệm thu tiếp xúc tay, vị trí cửa hoặc animation lên xe.
3. **Người đi phố:** đã nối atlas12 kiểu người bán/khách/bảo vệ và xe máy bốn hướng/bốn màu; đợt08 thêm16 kiểu người mới và gắn chủ quầy/khách theoID, đang Review. [Đợt 03](art/chapter1/ASSET_PASS_03.md) có file/prompt và giới hạn; chưa chạy game hoặc nghiệm thu bước đi/phụ kiện/đổi hướng.
4. **Môi trường:** đã nối quầy/cây/xe đỗ, dùng nhà mới ngoài rìa; chỉnh nền/barie và dựng cổng vòm bằng code theo lưới, đang Review. [Đợt08](art/chapter1/ASSET_PASS_08.md) bổ sung hồ/kè/lan can, landmark và nền phố xa, nhà/cây đa dạng; chưa duyệt tổng cảnh. [Đợt 04](art/chapter1/ASSET_PASS_04.md) ghi file/prompt và giới hạn. Cần duyệt chân vật thể, vùng che khuất, nối đầu cầu/đảo và xe qua cổng; landmark hồ đã thay bằng atlas đợt08.
5. **Sự cố:** đã nối hình 12/12 loại qua nhóm1–3, đang Review. [Đợt 05](art/chapter1/ASSET_PASS_05.md), [đợt 06](art/chapter1/ASSET_PASS_06.md) và [đợt 07 — động vật](art/chapter1/ASSET_PASS_07.md) có asset/prompt/giới hạn. Giữ luật/cảnh báo, chưa chơi thử đủ nhánh hoặc nghiệm thu animation final.
6. **Kết chương:** giữ luồng tai nạn → cứu hộ → trùng sinh/chuyển chương. Đã bỏ sáu kết thúc theo thời gian và mốc ép ngất 120 giây theo yêu cầu ngày 2026-10-28; né được thì tiếp tục chơi.
7. **UI:** đã triển khai [đợt UI 01](art/chapter1/UI_PASS_01.md): lựa chọn tránh joystick, nút lớn, cài đặt hai cột và thoại đổi chiều màn hình. Đang Doing; còn bong bóng rìa camera/loading/chuyển cảnh và tự duyệt thiết bị thật. Không thêm lại bảng Mục tiêu hay nhấp nháy.
8. **Âm thanh:** nhạc phố/ambience và các cue di chuyển, tương tác, sự cố, cứu hộ, chuyển cảnh; đồng bộ với các trạng thái đã chốt.
9. **Tối ưu và nghiệm thu:** tạo bộ export runtime nhỏ hơn, đo tải/memory/FPS, tự chơi trên thiết bị mục tiêu, xử lý lỗi rồi mới đóng Slice.

Danh sách công việc và trạng thái chính thức chỉ theo dõi tại `docs/task-list/TASK_LIST.md`; đây là thứ tự triển khai, không phải xác nhận các đợt còn lại đã hoàn thành.

## 10. Đợt sửa gameplay màn 1 — 2026-10-29 (T-097, Review)

- **Va chạm:** nhân vật chính trượt dọc tường, vòng qua người đứng chắn và tự lách góc quầy/xe đỗ (tối đa 0,4 ô); bị cảnh đẩy vào vật cản thì tự ra chỗ trống gần nhất. Nhấp-đi-tới cũng trượt như vậy thay vì huỷ đường đi.
- **Người đi đường:** né nhau, né nhân vật chính, người bán và bảo vệ (mỗi người lệch về bên phải mình, không bước xuống lòng đường) rồi trở lại hàng đi; không còn đi xuyên nhau hay đứng đối mặt đứng im.
- **Barie:** bỏ hàng rào vỉa hè. Barie chỉ chặn xe; người đi đường đi qua bình thường. Riêng nhân vật chính cố bước qua là gặp nạn ngay tại chỗ (không tự dắt ra giữa đường): trên lòng đường thì ngẫu nhiên xe máy lao qua hoặc bảo vệ nâng barie “ưu tiên người đi bộ” rồi tuột tay; trên vỉa hè thì xe máy leo vỉa hè đâm vào. Bấm vào bảo vệ chỉ nghe một câu. Bỏ bảng lựa chọn cãi bảo vệ.
- **Xe cứu thương:** vào từ ngoài đầu phố qua barie (không hiện ra giữa phố), phanh dần khi đỗ; vòng xoáy mở trên đoạn đường đủ chỗ, không trùng barie; xe chờ vòng mở, tăng tốc rồi bị hút, xoay và thu nhỏ vào tâm.
- **Người trên phố:** đường ít người (8 người đi bộ, mỗi người một hình khác nhau, không trùng người ở quầy; 4 xe máy). Người đi bộ né cả quầy/xe đỗ/cây, quay mặt theo hướng đi khi vòng qua, gặp ngõ cụt thì quay lại. Họ ghé quầy dọc đường (tới chỗ trống cạnh quầy, đứng xem vài giây rồi đi tiếp). Khách ở quầy đi lại quanh quầy, chủ quầy đi dọc quầy, bảo vệ quay nhìn quanh; ai đang nói với nhân vật chính thì quay mặt về phía họ. Nhân vật bị kẹt giữa tường và người quá 0,35 s thì lách qua.
- **Thoại:** viết lại thoại quầy, người đi đường, barie, cứu hộ và câu ngất theo hướng hài “xàm”, mỗi quầy cài trước một sự cố (chó, bồ câu, dây phơi, dép, barie).

Chưa chạy game/test/typecheck/build, chưa nghiệm thu trên thiết bị. Vertical Slice vẫn **chưa đạt** theo bảng §0: art/animation final, âm thanh final, tối ưu ảnh (49,87 MiB PNG) và đo FPS thiết bị vẫn là khoảng trống chính.

## 11. Tối ưu ảnh và đo FPS — 2026-10-29 (T-084, Review)

- Ảnh master PNG (33 file, ~48 MB) chuyển sang `art-src/slice/chapter1/`, không còn nằm trong `public/` nên không bị tải về hay đóng gói.
- Game tải 33 WebP xuất sẵn đúng cỡ texture (`maxEdge`), tổng **5,3 MB**. Texture trên GPU không đổi cỡ so với trước (trước đây cũng thu nhỏ lúc nạp), nên hình gần như giữ nguyên; lợi ích chính là tải lạnh nhanh hơn và bộ nhớ đỉnh lúc giải nén ảnh thấp hơn nhiều (quan trọng với iOS dễ bị đen màn hình khi thiếu RAM).
- Đổi/thêm ảnh: đặt PNG master vào `art-src/`, khai báo trong `sliceAssets.ts`, chạy `zsh scripts/export-slice-webp.sh [tên]`.
- Mở game với `?fps=1` để thấy FPS trung bình và khung chậm nhất mỗi giây. Cần đo trên máy thật ở ba lúc: đi phố đông, đang có 2 sự cố, cảnh cứu hộ/vòng xoáy. Mục tiêu §6: mobile ≥30 FPS, PC ~60 FPS.
- Chưa chạy game/test/build sau thay đổi.

## 12. Bố cục phố hai bên — 2026-10-29 (Review)

- Phía trên: nhà ống mảnh và thấp hơn (rộng 1,8 ô, sâu 1,9 ô, cao 108–148 px thay cho 2,2 × 2,6 ô, cao 128–176 px), có khe giữa các nhà; cứ hai nhà xen một quán ăn vẽ tay (dùng tranh quầy có sẵn) lùi vào khe.
- Phía dưới: bỏ vườn cỏ, lan can và bồn hoa. Hàng 14 thành vỉa hè có ghế nhựa; hàng 15–16 là dãy quán 1 tầng nhìn từ phía sau (mái tôn có gân, bạt sọc mép lượn nhô ra vỉa hè, biển tên trên mái, cục nóng, bồn nước/chậu cây). Dãy quán tự mờ khi nhân vật đi sau. Cây sấu chuyển ra mép vỉa hè phía nam (hàng 11). Làn người đi bộ: 7,3 / 12,4 / 14,4.
- Dãy quán phía dưới đang vẽ bằng code (tạm). Muốn đồng bộ hẳn với tranh vẽ tay cần một atlas ảnh “dãy quán 1 tầng nhìn từ phía sau, mái bạt sọc”.
- Rìa dưới ngoài map: bỏ dãy nhà ảnh (đỡ ~30 ảnh và bộ nhớ), thay bằng đại lộ hai chiều rộng có dải cây giữa, vẽ bằng một lớp đồ họa.
- Cứu hộ: cửa xe cứu thương phải đủ chỗ cho bác sĩ đứng (trước đó cửa sát gốc sấu làm bác sĩ kẹt, không bê được người). Đã chạy thử mô phỏng trong dev: 272/272 vị trí ngất trên hai vỉa hè đều được khiêng lên xe.
- Đã xem bằng dev server (PC và màn dọc 792×1322 giả lập), 60 FPS; chưa chạy bộ test.

## 13. Đợt rà toàn bộ màn 1 — 2026-10-29 (Review)

**Ghi nhận lịch sử trước T-100 (đã gỡ override):** hằng `CHAPTER1_ONLY` trong `WorldScene.ts` (cứu hộ xong thì chơi lại màn 1); `story.json` giữ `S03.next = "S04"`. Bật lại màn 2: đặt `CHAPTER1_ONLY = false`, hoặc mở game với `?chapter2=1`. Trình duyệt tự động (e2e) luôn chạy cốt truyện thật.

- **Va chạm:** cây sấu, ghế nhựa, xe máy dựng va chạm hình tròn đúng cỡ hình (không còn ô vuông vô hình); nhân vật trượt quanh người/vật theo phía nghiêng, phía đó tắc thì sang phía kia, giữ phía đã chọn 0,4 s (không giật); tự lách góc vật chữ nhật tới 1 ô; bị kẹt giữa tường và người thì lách qua người sau 0,35 s.
- **Cứu hộ:** cửa xe cách thân xe 1,1 ô; bác sĩ và người được khiêng đi vòng thân xe; điểm đỗ chỉ được chọn khi có đường vòng tới nhân vật; hai bác sĩ xuống lệch nhau 0,6 s và luôn cách nhau ≥ 0,45 ô.
- **Ảnh atlas:** mỗi ô được tách mảnh liền; mảnh nhỏ lấn từ ô bên cạnh bị xoá (hết mái nhà lơ lửng, dây leo thừa cạnh cây). Thêm ~0,36 s lúc nạp trên PC.
- **Bố cục:** mặt tiền phía trên liền dãy (nhà 2 × 2,2 ô), thêm hai dãy nhà phía sau dùng lại tranh nhà, xa hơn là màu phố mờ; bỏ quán chen khe và hai khối tường miệng ngõ. Toàn bộ vỉa hè lát một kiểu. Cây có bồn gốc viền đá. Vỉa hè dưới có hàng xe máy dựng và ghế nhựa, chừa lối quanh hai quầy. Bong bóng thoại luôn nằm trong màn hình, tránh nút HUD.
- **Đồng bộ đường/vỉa hè:** vỉa hè ngoài rìa map lát cùng gạch với trong map; viền vỉa hè chạy suốt hai bên (bên xa thấy mặt đứng, bên gần chỉ thấy mặt trên và bóng); vạch giữa đường một kiểu cho mọi tuyến, kể cả phía tây ngoài map (trước đó mất vì phép chia dư số âm); miệng ngõ có nhà hai bên, sau sân cuối ngõ có thêm dãy nhà, không kéo dây điện ngang miệng ngõ.
- **Ngõ và bầu trời:** bỏ nhà ở miệng ngõ, mọi ô nền trong map (cả sân cuối ngõ) lát gạch vỉa hè; phía sau các dãy mái là bầu trời xanh nhạt dần về chân trời (một hình vẽ phẳng, không thêm ảnh).
- **Đã kiểm chứng bằng mô phỏng trên dev server:** đi dọc mọi hàng vỉa hè hai chiều và chéo (138 lượt, chỉ còn 1 góc cụt cạnh quầy trà đá, lùi ra được); bot đi ngẫu nhiên 8 lượt × 200 s không kẹt ngoài lúc đẩy thẳng vào tường; cứu hộ 225/225 vị trí, 0 lần xuyên xe, 0 lần hai bác sĩ chồng nhau; barie 36/36 cảnh kết thúc bằng cứu hộ (4 lần quầy trà đá nói trước, đúng thiết kế); 8/8 người đi đường qua cả hai barie, không lần nào trong vật cản; sau cứu hộ quay lại màn 1. Chưa chạy bộ unit/e2e/typecheck.

**Tự kiểm tra 2026-10-29 (sau đợt 13):** typecheck sạch; unit 281/281 đạt (đã cập nhật các test cũ theo luật mới: barie không còn lựa chọn, cây/ghế/xe dựng va chạm tròn, mặt tiền liền dãy). E2E chạy bằng Chrome: 21/27 đạt ở các bộ màn 1 (sự cố, nội dung, điều khiển chạm, cứu hộ qua barie và trong sân, UI). 6 bài rừng màn 2 lỗi do test cũ: từ commit `87685b3` game luôn chơi lại từ màn 1 khi mở giữa cốt truyện, nên test không vào được màn 2 từ file lưu — không thuộc phạm vi màn 1. Lỗi thật đã sửa trong lúc test: lời thoại quầy bị huỷ ngay khi người bán đứng lệch quầy; cứu hộ trong sân cuối ngõ (đuôi xe vào sân, nhân vật nằm sát góc tường).
