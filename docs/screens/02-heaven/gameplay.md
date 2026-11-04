# Chương thiên đàng — Hội đồng trùng sinh

## Luồng chơi

1. Đoạn mở đầu hoàn thành hoặc bấm Bỏ qua sẽ chuyển vào quảng trường thiên đàng, không còn màn trắng.
2. Người chơi bấm Thần Chết để tới nói chuyện, hoặc dùng nút tương tác khi đứng gần. Sau đoạn thoại là bước nhận hồ sơ với hai lựa chọn: được dẫn tới chuyên gia tiếp theo hoặc tự khám phá. Chỉ sau khi chọn mới ghi nhận đã nhận nhiệm vụ; không đóng thoại đột ngột rồi để người chơi tự đoán. Chưa tiết lộ chuyện chỉ bị ngất ở bước này.
3. Gặp ba chuyên gia về trồng cà phê, pha chế và kinh doanh theo thứ tự tùy chọn. Mỗi người có hai câu hỏi, mỗi câu có ba đáp án.
4. Mỗi câu chỉ được trả lời một lần. Đúng hoặc sai đều lưu lựa chọn và kết quả ngay, có giải thích rồi sang câu tiếp theo. Trả lời đủ hai câu nhận dấu hoàn thành; điểm đúng/sai hiển thị riêng, không nhận lặp dấu hoặc đổi đáp án.
5. Đủ ba dấu mới được Thần Tiếp Nhận kiểm tra hồ sơ. Hội thoại lúc này mới tiết lộ người chơi chỉ ngất, Thần Chết kéo nhầm. Có dấu đỏ “CHƯA CHẾT · CHỈ NGẤT”.
6. Chọn một hành trang: Túi hạt giống, Gói mở rộng quán (tên cũ Bộ dụng cụ pha) hoặc Túi vốn nhỏ. Lưu lựa chọn cho chương nông trại sau. Hành trang chọn trước khi biết loại nơi, nên khi vào farm món không dùng được ở nơi đó tự đổi thành **Túi vốn nhỏ** (+150 xu): Hạt giống ở nơi chỉ quán, Gói mở rộng quán ở nơi chỉ trồng (04/11/2026, `createFarm` trong `farm/model.js`).
7. Tự đi về cổng. Sau câu tiễn hài hước cuối, Thần Tiếp Nhận mời «chọn nơi bắt đầu lại» và bản đồ thế giới mở ra ([02b-world-map](../02b-world-map/README.md)); chọn nơi xong nhân vật đi qua cổng và cảnh sáng dần.
8. **Bỏ qua (04/11/2026):** nút «Bỏ qua ↗» cạnh ⚙️, chỉ hiện trước bước chọn hành trang (pha `welcome`/`learning`/`review`). Bấm lần đầu đổi chữ thành «Bỏ qua phần học? Bấm lần nữa» (4 s không bấm thì trở lại); bấm lần hai thì đóng thoại đang mở, tự lấy hành trang đầu tiên (Hạt giống), nhân vật tự đi vào cổng và mở ngay bản đồ thế giới — không hộp chọn hành trang, không lời tiễn (sửa 04/11: bớt thao tác). Câu đã trả lời vẫn tính mẹo; câu chưa trả lời không có mẹo và sẽ được hỏi lại ở nông trại/quán như câu sai.

### Thiên đàng là bài học (chốt và triển khai 03/11/2026)

Spec đầy đủ: [luồng người chơi mới](../../shared/onboarding-flow.md) mục 3.1, 4.1. Thay đổi so với luồng trên:

- **Câu đúng cho mẹo có tác dụng thật** ở farm/quán: `ripe` → hái tay +5 chất lượng; `water` → bình tưới +2; `recipe` → Phin đen nóng và Cà phê sữa đá bắt đầu ★ (điểm luyện tối thiểu 40); `adjust` → màn kết quả ly đánh dấu "Sửa bước này trước"; `costs` → +30 xu một lần; `customer` → uy tín quán +3 một lần. Hộp kết quả mỗi câu ghi tên mẹo và tác dụng; câu sai ghi "Chưa nhận mẹo · sẽ được hỏi lại ở nông trại/quán".
- **Câu sai được học lại** ở farm/quán đúng lúc liên quan (sau lần hái tay, ngày mưa/ra giếng, báo cáo cuối ca, ly dưới 70 điểm, khách bỏ về), tối đa 1 câu mỗi ngày công 6 phút, hoặc ôn chủ động ở Sổ tay thiên đàng trong Hướng dẫn farm. Chấm bằng chính `content.js`.
- Chơi lại chương không xóa mẹo đã thuộc ở farm; thưởng một lần không trả lại.
- **Thoại gọn:** `WELCOME` 5 → 3 câu; lời chào chuyên gia gộp vào hộp câu hỏi đầu; `REVEAL` 7 → 4; `FAREWELL` 3 → 2. Tổng 32 → 23 hộp; mục tiêu ≤ 150 s từ lúc vào tới khi qua cổng.
- Bước nhận hồ sơ: focus mặc định vào "Dẫn tôi tới chuyên gia tiếp theo"; chọn dẫn thì sau chuyên gia cuối tự đi tới Thần Tiếp Nhận.
- **Thẻ quà ghi số thật:** Túi hạt giống "+6 hạt cà phê vối và 6 túi phân bón"; **Gói mở rộng quán** (đã chốt đổi tên từ "Bộ dụng cụ pha", id `tools` giữ nguyên) "Quán lên cấp 2: mở sẵn 4 bàn thay vì 3"; Túi vốn nhỏ "+150 xu".
- Màn kết hiện "Mẹo đã nhận x/6 · y câu sẽ được ôn lại".
- Lưu: không thêm trường trong `heaven`. Farm đọc `heaven.answers` qua `correctQuestionIds(heaven)` (mới, `journey.js`) và lưu kết quả ở `farm.lessons` (xem `docs/shared/contracts.md` mục 5).

Cổng trùng sinh mở bản đồ thế giới ([02b-world-map](../02b-world-map/README.md)); chọn nơi xong mới vào nông trại (nơi chỉ quán: vào thẳng quán); quán cà phê mở từ nông trại (nút Vào quán, nhiệm vụ "Bán ly cà phê đầu tiên"). Người đã qua cổng sẽ trở lại nông trại khi tải lại trang. Hành trang chọn ở đây áp dụng một lần khi vào farm (xem `docs/screens/03-farm/rules.md` mục 9).

## Điều khiển

- Desktop: bấm mặt đất để đi tới vị trí đó; bấm NPC để tìm đường tới gần và tự mở hội thoại. Bấm điểm mới để đổi đích.
- Nhân vật tìm đường trên lưới và rút gọn các đoạn thẳng nhìn thấy nhau, tránh collider của bàn, NPC và biên bản đồ. Có thêm WASD và phím mũi tên làm điều khiển bổ sung.
- Mobile: joystick analog ở góc trái, có vùng chết ở tâm và tốc độ theo độ kéo. Thả tay, hủy pointer hoặc mất focus thì dừng. Joystick hủy đường đi tự động đang có.
- **Gợi ý điều khiển khi vào (triển khai 03/11/2026):** desktop giữ dòng "Bấm mặt đất để đi · Bấm nhân vật để tới nói chuyện"; mobile thêm "Kéo nút tròn để đi · Chạm nhân vật để nói chuyện". Tắt khi đã di chuyển một lần hoặc sau 10 s; không lưu.
- **Gợi ý tiếp hội thoại theo thiết bị:** cảm ứng "Chạm để tiếp", chuột/bàn phím "Enter hoặc bấm để tiếp", đang có câu hỏi/quà "Chọn một đáp án". Không còn ẩn gợi ý trên `hover: none` (`dialogue.css`).
- Có thể bấm nút tương tác khi đứng gần NPC, hoặc dùng E / Enter / Space.
- Trong hội thoại thường và phần giải thích đáp án, bấm bất kỳ đâu để tiếp; sự kiện được xử lý một lần, không bấm xuyên xuống mặt đất.
- Khi đang trả lời câu hỏi hoặc chọn quà, chỉ nút lựa chọn / phím 1–3 mới đi tiếp. Bấm ra ngoài giữ nguyên câu hỏi và nháy nhẹ viền khung; không hiện ô cảnh báo hay thông báo đỏ.
- HUD thường chỉ hiện nhiệm vụ gọn ở góc trái và ba huy hiệu ở góc phải; bấm huy hiệu mới mở hồ sơ có số câu đã trả lời và tổng đúng/sai. Màn kết hiện tổng điểm; dấu là hoàn thành phần học, không đồng nghĩa mọi câu đều đúng.
- Khi đang nói chuyện hoặc làm bài, nhân vật ngừng di chuyển. Đổi tab / mất focus xóa joystick và lộ trình đang đi.

## Lưu và khôi phục

Dùng key sẵn có `godbean-progress`, giữ schema ngoài `version: 1` và các trường cũ. Thêm:

```text
heaven.version: 2
heaven.metReaper: boolean
heaven.answers: { growing: [...], brewing: [...], business: [...] }
  mỗi đáp án: { questionId, optionId, correct }
heaven.answered: số câu đã trả lời mỗi chuyên gia (dữ liệu dẫn xuất)
heaven.passed: số câu đúng mỗi chuyên gia (dữ liệu dẫn xuất)
heaven.skipped: boolean   — đã bấm Bỏ qua: không cần đủ ba dấu để tới bước hành trang
heaven.revealed: boolean
heaven.gift: null | seeds | tools | capital
heaven.completed: boolean
startingGift: cùng id hành trang đã chọn
```

`features/heaven/journey.js` chuẩn hóa dữ liệu lưu theo nội dung hiện có. Bản v1 được chuyển sang v2 bằng các câu đúng đã ghi; không tự tạo thêm câu sai. Với v2, kết quả đúng/sai tính lại từ lựa chọn và đáp án gốc, không tin vào bộ đếm lưu sẵn. Các mốc sau chỉ hợp lệ khi đã đủ điều kiện trước. Giữ tiến trình trong bộ nhớ nếu localStorage bị chặn; báo người chơi một lần khi ghi thất bại.

Tải lại sau Màn 1 sẽ vào thẳng thiên đàng, giữ câu đã qua, dấu và quà. Nếu đã hoàn thành thiên đàng thì hiện màn kết; người chơi có thể chọn chơi lại chương. Chơi lại đặt lại tiến trình riêng của thiên đàng và hành trang, không xóa hồ sơ nhân vật hoặc buộc xem lại mở đầu.

## Tổ chức code và thay asset

- `content.js`: NPC, vị trí, màu nhận diện, câu hỏi, đáp án, giải thích, hội thoại và quà. Không phụ thuộc Three.js.
- `journey.js`: điều kiện tiến triển, chống nhận lặp, khôi phục trạng thái. Không phụ thuộc DOM / Three.js / localStorage.
- `scene.js`: quảng trường 3D, raycast điểm bấm, nhân vật, camera, di chuyển, vật cản và vị trí tương tác.
- `shared/game/navigation.js`: tìm đường quanh collider, tránh cắt góc và rút gọn waypoint. Tìm đường là generator, được scene xử lý từng phần với ngân sách khoảng 2 ms mỗi frame; thao tác bấm không chạy toàn bộ tìm kiếm đồng bộ. Chọn điểm mới hoặc kéo joystick hủy yêu cầu cũ.
- `ui.js`: HUD, hồ sơ, lựa chọn, con dấu, cảm ứng, kết chương và quản lý focus.
- `game.js`: nối luật chơi, cảnh và UI; điều khiển nhịp hội thoại và qua cổng.
- `state/progress.js`: đọc / ghi lưu trữ.
- `ui/styles/heaven.css`: giao diện riêng của chương.

NPC, bàn và cổng hiện dựng bằng hình khối. Avatar dùng model nữ sẵn có và Walking của model. Khi thay NPC hoặc bối cảnh bằng asset, thay phần dựng hình trong `scene.js`, giữ id trong `content.js` và cập nhật collider theo kích thước asset. Vị trí tương tác và điều kiện nhiệm vụ không phụ thuộc tên mesh hoặc rig của asset.

Scene cung cấp `scene`, `camera`, `update(dt, time)`, `resize`, `dispose` qua controller. Khi rời màn, giải phóng animation, GPU và listener UI; listener ứng dụng cũng được gỡ khi HMR thay module.

## Trạng thái bàn giao

Triển khai code trước, chưa chạy test, build, lint, kiểm tra cú pháp hoặc mở trình duyệt theo quy tắc người dùng trong `AGENTS.md`. NPC và bối cảnh là asset tạm; chưa có lồng tiếng hoặc chương nông trại.

Chuyển vào / ra hội thoại làm mượt cả vị trí camera và điểm nhìn. Animation đi / đứng trộn trọng số theo thời gian, không chuyển tức thì về tư thế nghỉ. Những thay đổi này chưa được đo FPS hoặc kiểm tra thực tế do quy tắc người dùng tự test.

Bố cục mới và cổng: xem [cảnh và asset](../../assets/scene-assets.md). Vật cản, tìm đường, điểm bấm ngoài map và các slot hình ảnh được quản lý ở `shared/world/scene.js`; wrapper `features/heaven/scene.js` chỉ truyền cấu hình thiên đàng.

Giao diện hội thoại dùng khung đáy màn hình có viền đôi, chân dung nhỏ và tên nằm trong khung để không bị cắt. Các lựa chọn là dòng chữ với mũi chỉ khi trỏ/chọn; nút tiếp chỉ còn ký hiệu mũi tên. HUD nhiệm vụ và huy hiệu dùng cùng lưới để thẳng hàng trên desktop và mobile. Không chạy kiểm tra giao diện sau thay đổi này theo quy tắc người dùng tự test.

Khi chọn NPC, tìm đường phải kết thúc ở một điểm đứng được bên trong khoảng tương tác, không dùng điểm dừng gần nhất ngoài tầm nói chuyện. Mũi chỉ nhiệm vụ và vòng sáng cũng nhận bấm như NPC. Khi tới nơi, ưu tiên đúng NPC đã chọn để tự mở thoại, tránh phải bấm thêm một đoạn đường.
