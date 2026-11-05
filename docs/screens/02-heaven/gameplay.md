# Chương thiên đàng — Hội đồng trùng sinh

## Luồng chơi — thiên đàng mini (02-mini, 05/11/2026, F-44)

Luật hiện hành từ 05/11/2026 (F-44, đề xuất [mobile-first](../../shared/mobile-first-proposal.md) Q1 R1–R4, R13, R16 và Q2; phần "Vá sau soát chéo" của đề xuất thắng khi khác). Luồng 9 bước cũ ở cuối mục này chỉ còn để đối chiếu.

1. Đoạn mở đầu hoàn thành hoặc bấm Bỏ qua thì vào quảng trường. **Thần Chết và Thần Tiếp Nhận đứng sẵn cạnh nhân vật** (không đứng trên bệ, `noDais`), quay mặt về chỗ người chơi xuất hiện. Không có bước tự đi tới ai, không gợi ý joystick, không bước nhận hồ sơ hai lựa chọn, không HUD huy hiệu/Hồ sơ trùng sinh.
2. Thoại tự chạy, **tối đa 5 hộp** (`MINI` trong `content.js` + hộp quà): Thần Chết 2 hộp (kéo nhầm); Thần Tiếp Nhận 2 hộp (dấu đỏ «CHƯA CHẾT · CHỈ NGẤT», rồi câu móc «Hội đồng trùng sinh sẽ tìm con ở trần gian»); hộp 5 là **lời tiễn kèm nút «Nhận»**. Lời tiết lộ không còn chờ đủ ba dấu. Camera nghiêng về người đang nói. Nghe xong hộp 4 thì ghi `heaven.revealed`; tải lại chỉ còn hộp 5.
3. **Quà cố định 1 chạm:** hộp 5 ghi dòng «❧ Túi hạt giống: +6 hạt giống, 6 túi phân» (không chữ "cà phê", tên giống vối chỉ hiện ở log farm). Bấm Nhận (hoặc phím 1 / Enter vào nút Nhận) thì `chooseGift('seeds')`: `heaven.gift = startingGift = 'seeds'`. Không còn thẻ chọn 1 trong 3; `tools`/`capital` chỉ còn ở save cũ và quà thay theo nơi. Luật đổi theo loại nơi giữ nguyên: vào farm ở nơi chỉ quán thì Túi hạt giống đổi thành Túi vốn nhỏ +150 xu, log riêng «Nơi này chỉ có quán: nhận Túi vốn nhỏ +150 xu thay túi hạt» (`createFarm`, `farm/model.js`; xem [03-farm rules](../03-farm/rules.md) mục 9).
4. **Hoạt cảnh tự đi vào cổng:** sau Nhận, nhân vật tự đi tới Cổng trùng sinh (khóa joystick, ẩn nút tương tác); chạm màn hình hoặc E / Enter / Space thì tua: đặt nhân vật ngay trước cổng. Tới cổng thì mở bản đồ thế giới ([02b-world-map](../02b-world-map/README.md)) như hiện tại; chọn nơi xong nhân vật đi qua cổng và cảnh sáng dần. Không còn lời tiễn ở cổng (đã nằm ở hộp 5). Đóng bản đồ mà chưa chọn nơi thì đứng trước cổng, đi lại tự do, đi vào cổng để mở lại.
5. **Bỏ qua ↗ (1 lần bấm):** nút cạnh ⚙️ hiện khi còn thoại hoặc hộp quà (pha `welcome`/`gift`), ẩn khi đang tự đi, khi bản đồ mở. Bấm một lần: đóng thoại, ghi `heaven.skipped` (nếu chưa nghe hết thoại), nhận Túi hạt giống rồi chạy hoạt cảnh tự đi vào cổng như bước 4. Không còn xác nhận hai lần vì không còn câu hỏi để lỡ.
6. **Ba chuyên gia và 6 câu không còn ở thiên đàng:** bệ của họ trên sân để trống (nhân vật ẩn, không chạm được, không nạp GLB). Họ gặp người chơi ở trần gian (Hội đồng so le, 05/11/2026, F-45 — mục «Hội đồng so le ở trần gian» dưới). `heaven.answers` của save cũ giữ nguyên: câu đúng vẫn là mẹo (`correctQuestionIds`), câu đã trả lời (đúng hay sai) là đã gặp (`answeredQuestionIds` → `farm.lessons.met`), câu chưa trả lời (kể cả save `heaven.skipped`) là "chưa gặp" và chỉ được hỏi ở Hội đồng (thay luật cũ "câu chưa trả lời hỏi lại như câu sai").
7. **Không lộ chủ đề cà phê trong mini** (giữ luật 05/11/2026): thoại và dòng quà không có chữ "cà phê".
8. **Save cũ:** `heaven.completed = true` vào thẳng farm như cũ (`app/game.js`), `heaven.mode` thiếu thì coi là `'full'`. Save có `introCompleted` mà thiên đàng dở (đang hỏi, kiểm hồ sơ, chọn quà, đi về cổng) thì chạy mini và giữ câu đã trả lời: chưa `revealed` → đủ 5 hộp; đã `revealed` mà chưa có quà (kể cả save đã Bỏ qua) → chỉ hộp Nhận; đã có quà → tự đi vào cổng.
9. **Analytics:** `heaven_completed` giữ `skipped`, `correct`, `gift` (save mới luôn `'seeds'`), thêm `mode` (`'mini'`) và `region_type` (`both`/`farm`/`cafe`) — [analytics](../../shared/analytics.md).

### Luồng 9 bước cũ (trước 05/11/2026 — đã thay bởi 02-mini, chỉ để đối chiếu)

Thần Chết → bước nhận hồ sơ hai lựa chọn → 3 chuyên gia × 2 câu (mỗi câu một lần) → đủ ba dấu mới tiết lộ «chỉ ngất» → chọn 1 trong 3 hành trang → tự đi về cổng, lời tiễn rồi mở bản đồ. Bỏ qua cần bấm hai lần; câu chưa trả lời được hỏi lại ở farm/quán như câu sai. Nhãn trung tính ❧ ♨ ₫, Hồ sơ trùng sinh. Bước 2 (nhận hồ sơ), 5 (tiết lộ sau 3 dấu), 6 (3 thẻ hành trang), 8 (Bỏ qua 2 lần bấm) và 9 (huy hiệu, Hồ sơ) đã bỏ.

### Hội đồng so le ở trần gian (05/11/2026, F-45, đề xuất [mobile-first](../../shared/mobile-first-proposal.md) Q1 R5–R15 + vá)

Lối vào thứ hai của chương này: ba chuyên gia gặp người chơi ở farm/quán, không quay lại thiên đàng. Luật đầy đủ: [onboarding-flow](../../shared/onboarding-flow.md) mục 3.1; dữ liệu: [contracts](../../shared/contracts.md) mục 5.

- **Mốc có mặt:** Thần Nông (`ripe`, `water`) khi đã xong `farm-intro` và hái lần đầu (tay hoặc Auto); Thần Pha Chế (`recipe`, `adjust`) khi `stats.served ≥ 1` (nơi chỉ trồng: lần bán đầu); Thần Thương Hội (`costs`, `customer`) sau báo cáo cuối **ca thường** đầu tiên (ca tập không tính; nơi chỉ trồng: hết ngày công đầu sau lần bán đầu). Nơi chỉ quán: ly đầu → Nông rồi Pha Chế xếp hàng. Không điều kiện cấp.
- **Mỗi lượt 1 chuyên gia × các câu chưa gặp** (tối đa 2), xếp hàng Nông → Pha Chế → Thương Hội.
- **Vật 3D:** Cổng Hội đồng trong farm (`council` trong `farm/content.js`, ẩn rồi trồi lên khi chuyên gia đầu có mặt, bóng từng chuyên gia, cầu sáng + biển «✨ Mới · tên» khi có người chờ, vùng cấm xây); chuông/khung chân dung Hội đồng trong quán (`council` trong `cafe/game.js`). Chạm là hội thoại đáy màn mở tại chỗ (`askCouncil` trong `ui/lesson-prompt.js`), nhân vật quay mặt về vật, khoá di chuyển, Auto chạy phía sau, có nút Đóng (giữ câu đã trả lời). Như hỏi lại: đang làm việc tay (tự tay hái/gieo/đi tới máy) thì không mở, toast «làm xong việc đang làm tay rồi hãy gặp»; Auto bật thì vẫn mở. Ở quán chỉ mở khi cửa đóng hoặc từ nút ở báo cáo cuối **ca thường** (báo cáo ca tập không có nút, mục 5 Q7 R5 ↔ Q1 R7). Chuyên gia tới: toast ở farm khi không có modal; ở quán chỉ chấm «Mới» ở vật Hội đồng, không toast. Chạm vật khi Auto bật không bật vòng chọn của vật khác. Lối tắt: Sổ tay ▸ Câu hỏi / Fragment-Key và dòng «Chưa gặp chuyên gia» ở Sổ tay thiên đàng (Hướng dẫn farm) — lia camera tới Cổng rồi mở. Không vào từ thiên đàng.
- **Chấm:** cùng câu, đáp án, giải thích trong `content.js`. Lượt đầu không tính giới hạn 1 câu hỏi lại/ngày công; đúng → mẹo ngay; sai → vào hỏi lại hiện hành. Hội đồng chỉ trao mẹo, không quà, không Fragment.
- **Nhãn:** tên lĩnh vực thật (tên chuyên gia), dấu ✓ của chuyên gia = đủ 2 câu trong `met` (khối tạm: hạt vàng trên đầu bóng chuyên gia ở Cổng, dưới chân dung ở vật quán; `expertsDone` trong `heaven/content.js`). Hồ sơ trùng sinh và nhiệm vụ 'gặp chuyên gia' của thiên đàng cũ đã bỏ (F-44).
- **Việc tiếp theo (Q1 R7):** khi có chuyên gia chờ, thẻ nhiệm vụ farm hiện «Gặp tên ở Hội đồng» lúc không có nhiệm vụ chuỗi (đứng trước hái/tưới/...); chạm thẻ = lối tắt Sổ tay (lia camera rồi mở). Không hiện ở nơi chỉ quán và không hiện trong quán.
- **Chưa làm:** toạ độ Cổng/vật quán chờ playtest 375×812.

### Thiên đàng là bài học (chốt và triển khai 03/11/2026 — phần hỏi đáp dời xuống trần gian 05/11/2026, F-44/F-45)

Spec đầy đủ: [luồng người chơi mới](../../shared/onboarding-flow.md) mục 3.1, 4.1. Từ 05/11/2026 (F-44) các câu không còn hỏi ở thiên đàng; mẹo và cách chấm dưới đây giữ nguyên cho Hội đồng ở trần gian (F-45) và cho mẹo của save cũ:

- **Câu đúng cho mẹo có tác dụng thật** ở farm/quán: `ripe` → hái tay +5 chất lượng; `water` → bình tưới +2; `recipe` → Phin đen nóng và Cà phê sữa đá bắt đầu ★ (điểm luyện tối thiểu 40); `adjust` → màn kết quả ly đánh dấu "Sửa bước này trước"; `costs` → +30 xu một lần; `customer` → uy tín quán +3 một lần. Hộp kết quả mỗi câu ghi tên mẹo và tác dụng; câu sai ghi "Chưa nhận mẹo · sẽ được hỏi lại ở nông trại/quán".
- **Câu sai được học lại** (chỉ câu đã gặp chuyên gia, 05/11/2026, F-45) ở farm/quán đúng lúc liên quan (sau lần hái tay, ngày mưa/ra giếng, báo cáo cuối ca, ly dưới 70 điểm, khách bỏ về), tối đa 1 câu mỗi ngày công 6 phút, hoặc ôn chủ động ở Sổ tay thiên đàng trong Hướng dẫn farm. Chấm bằng chính `content.js`.
- Chơi lại chương không xóa mẹo đã thuộc ở farm; thưởng một lần không trả lại.
- **Câu hỏi mở — nối với Decode & Awaken (chốt 04/11/2026, CHƯA CODE, spec [decode-awaken](../../shared/decode-awaken.md) mục 4.1):** Quang chốt "kết hợp". Mẹo vẫn giữ nguyên là bài học (trục Mastery). Thêm: mỗi câu (đúng hay sai) để lại **một câu hỏi mở** trong Sổ tay thiên đàng, gắn lĩnh vực của chuyên gia (trồng / pha / kinh doanh). Người chơi kiểm chứng câu hỏi đó ở farm/quán bằng thử nghiệm (vd. `ripe`: so chất lượng lô hái tay với lô thợ hái; `recipe`: pha hai ly khác một biến). Kiểm chứng xong mới nhận **Divine Data Fragment** — không trao Fragment hay Key chỉ vì trả lời đúng câu đố (tài liệu chuẩn tr. 9 §11.1). Danh sách câu hỏi mở, cách kiểm chứng và loại Fragment: [decode-awaken](../../shared/decode-awaken.md).
- **Thoại (05/11/2026, F-44):** `WELCOME`/`REVEAL`/`FAREWELL` (23 hộp, mục tiêu ≤ 150 s) thay bằng `MINI` 4 hộp + hộp quà = 5 hộp; mục tiêu mini ≤ 25 s, chưa đo (cần playtest).
- Bước nhận hồ sơ "Dẫn tôi / Tự khám phá": đã bỏ (05/11/2026, F-44).
- **Dòng quà ghi số thật (05/11/2026, F-44):** Túi hạt giống "+6 hạt giống, 6 túi phân" trong mini. Gói mở rộng quán (`tools`, "Quán lên cấp 2: mở sẵn 4 bàn thay vì 3") và Túi vốn nhỏ (`capital`, "+150 xu") chỉ còn ở save cũ / quà thay theo nơi.
- Màn kết (chỉ khi không có bản đồ, `onReborn` trống, hoặc save đã `completed`) nói về túi hạt giống, không nhắc ba chuyên gia; dòng điểm "x/6 câu đúng · Mẹo đã nhận x/6" chỉ hiện khi save đã trả lời câu nào đó, không còn "câu sẽ được ôn lại" (05/11/2026, F-44).
- Hoạt cảnh tự đi chỉ nhận chạm tua từ khung hình đầu tiên (lúc còn màn tải thì bỏ qua); kẹt giữa đường (tìm lộ trình thất bại hoặc bị chặn sau 2 lần thử) thì tự tua tới cổng (05/11/2026, F-44).
- Lưu: không thêm trường trong `heaven`. Farm đọc `heaven.answers` qua `correctQuestionIds(heaven)` (mới, `journey.js`) và lưu kết quả ở `farm.lessons` (xem `docs/shared/contracts.md` mục 5).

Cổng trùng sinh mở bản đồ thế giới ([02b-world-map](../02b-world-map/README.md)); chọn nơi xong mới vào nông trại (nơi chỉ quán: vào thẳng quán); quán cà phê mở từ nông trại (nút Vào quán, nhiệm vụ "Bán ly cà phê đầu tiên"). Người đã qua cổng sẽ trở lại nông trại khi tải lại trang. Quà nhận ở đây áp dụng một lần khi vào farm (xem `docs/screens/03-farm/rules.md` mục 9).

## Điều khiển

- Desktop: bấm mặt đất để đi tới vị trí đó; bấm NPC để tìm đường tới gần và tự mở hội thoại. Bấm điểm mới để đổi đích.
- Nhân vật tìm đường trên lưới và rút gọn các đoạn thẳng nhìn thấy nhau, tránh collider của bàn, NPC và biên bản đồ. Có thêm WASD và phím mũi tên làm điều khiển bổ sung.
- Mobile: joystick analog ở góc trái, có vùng chết ở tâm và tốc độ theo độ kéo. Thả tay, hủy pointer hoặc mất focus thì dừng. Joystick hủy đường đi tự động đang có.
- Đi lại tự do chỉ còn sau khi đóng bản đồ mà chưa chọn nơi (đứng trước cổng). Gợi ý điều khiển khi vào đã bỏ (05/11/2026, F-44: không gợi ý joystick).
- **Gợi ý tiếp hội thoại theo thiết bị:** cảm ứng "Chạm để tiếp", chuột/bàn phím "Enter hoặc bấm để tiếp", hộp quà "Bấm Nhận để mang theo". Không còn ẩn gợi ý trên `hover: none` (`dialogue.css`).
- Có thể bấm nút tương tác khi đứng gần NPC, hoặc dùng E / Enter / Space.
- Trong hội thoại thường và phần giải thích đáp án, bấm bất kỳ đâu để tiếp; sự kiện được xử lý một lần, không bấm xuyên xuống mặt đất.
- Ở hộp quà, chỉ nút Nhận / phím 1 / Enter (nút Nhận nhận tiêu điểm sẵn) mới đi tiếp. Bấm ra ngoài giữ nguyên hộp và nháy nhẹ viền khung; không hiện ô cảnh báo hay thông báo đỏ.
- Trong hoạt cảnh tự đi vào cổng: chạm bất kỳ đâu (trừ ⚙️) hoặc E / Enter / Space để tua tới trước cổng.
- HUD chỉ còn thẻ nhiệm vụ gọn ở góc trái (05/11/2026, F-44: bỏ ba huy hiệu ❧ ♨ ₫ và Hồ sơ trùng sinh; dấu ✓ của từng chuyên gia chuyển sang Hội đồng ở trần gian, F-45).
- Khi đang nói chuyện hoặc làm bài, nhân vật ngừng di chuyển. Đổi tab / mất focus xóa joystick và lộ trình đang đi.

## Lưu và khôi phục

Dùng key sẵn có `godbean-progress`, giữ schema ngoài `version: 1` và các trường cũ. Thêm:

```text
heaven.version: 2
heaven.mode: 'mini' | 'full'   — 05/11/2026 (F-44): bản đã xong; thiếu trường thì coi là 'full' (thiên đàng đầy đủ cũ)
heaven.metReaper: boolean
heaven.answers: { growing: [...], brewing: [...], business: [...] }
  mỗi đáp án: { questionId, optionId, correct }
heaven.answered: số câu đã trả lời mỗi chuyên gia (dữ liệu dẫn xuất)
heaven.passed: số câu đúng mỗi chuyên gia (dữ liệu dẫn xuất)
heaven.skipped: boolean   — đã bấm Bỏ qua trước khi nghe hết thoại mini
heaven.revealed: boolean  — đã nghe hộp tiết lộ (hộp 4) hoặc Bỏ qua; không còn cần đủ ba dấu (05/11/2026, F-44)
heaven.gift: null | seeds | tools | capital   — save mới luôn 'seeds'
heaven.completed: boolean
startingGift: cùng id hành trang đã chọn
```

`features/heaven/journey.js` chuẩn hóa dữ liệu lưu theo nội dung hiện có. Bản v1 được chuyển sang v2 bằng các câu đúng đã ghi; không tự tạo thêm câu sai. Với v2, kết quả đúng/sai tính lại từ lựa chọn và đáp án gốc, không tin vào bộ đếm lưu sẵn. Các mốc sau chỉ hợp lệ khi đã đủ điều kiện trước. Giữ tiến trình trong bộ nhớ nếu localStorage bị chặn; báo người chơi một lần khi ghi thất bại.

Tải lại sau Màn 1 sẽ vào thẳng thiên đàng mini theo pha đã lưu (bước 8 ở trên). Nếu đã hoàn thành thiên đàng thì app vào thẳng farm; màn kết chỉ hiện khi chạy chương không có bản đồ. Chơi lại chương đặt lại `revealed`/`gift`/`completed` rồi ghi lại `'seeds'`, **giữ `answers`**; farm không áp quà lần nữa vì `giftApplied` đã là `true` (Q2 R7). Không xóa hồ sơ nhân vật hoặc buộc xem lại mở đầu.

## Tổ chức code và thay asset

- `content.js`: NPC, vị trí (Thần Chết/Thần Tiếp Nhận `noDais`, chuyên gia `initialVisible: false`), câu hỏi (Hội đồng dùng chung), thoại `MINI`, quà và `STARTING_GIFT`. Không phụ thuộc Three.js.
- `journey.js`: pha `welcome → gift → return → completed`, chống nhận lặp, khôi phục trạng thái, `correctQuestionIds`, `answerText`. Không phụ thuộc DOM / Three.js / localStorage.
- `scene.js`: quảng trường 3D, raycast điểm bấm, nhân vật, camera, di chuyển, vật cản và vị trí tương tác.
- `shared/game/navigation.js`: tìm đường quanh collider, tránh cắt góc và rút gọn waypoint. Tìm đường là generator, được scene xử lý từng phần với ngân sách khoảng 2 ms mỗi frame; thao tác bấm không chạy toàn bộ tìm kiếm đồng bộ. Chọn điểm mới hoặc kéo joystick hủy yêu cầu cũ.
- `ui.js`: thẻ nhiệm vụ, hộp thoại và nút Nhận, con dấu, cảm ứng, kết chương và quản lý focus.
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
