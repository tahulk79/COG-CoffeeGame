# 02 · Thiên đàng

Màn ngắn ngay sau đoạn mở đầu. Thần Chết và Thần Tiếp Nhận nói tối đa 5 hộp thoại: người chơi bị kéo nhầm, chưa chết, chỉ ngất. Hộp cuối trao quà cố định **❧ Túi hạt giống**, rồi nhân vật tự đi vào Cổng trùng sinh để mở bản đồ thế giới. Màn này không hỏi câu nào. Ba chuyên gia (Hội đồng trùng sinh) gặp người chơi sau, ở nông trại và quán. Nội dung câu hỏi và mẹo vẫn thuộc màn này.

Luật chi tiết và số liệu: [rules.md](rules.md).

## Vào / ra

| Vào từ | Điều kiện |
|---|---|
| [01 · Intro](../01-intro/README.md) | Xem hết đoạn mở đầu hoặc bấm Bỏ qua (`completeIntro`) |
| Mở lại game | Save có `introCompleted` nhưng chưa có `heaven.completed` và chưa có `farm` (`app/game.js`) |

| Ra tới | Khi nào |
|---|---|
| [02b · Bản đồ thế giới](../02b-world-map/README.md) | Nhân vật tới Cổng trùng sinh (tự đi, tua, hoặc tự đi vào cổng khi đi lại tự do) |
| Quay lại thiên đàng, đứng trước cổng | Đóng bản đồ mà chưa chọn nơi (`cancelPortal`) |
| [03 · Nông trại](../03-farm/README.md) | Đã chọn nơi: chạy hoạt cảnh qua cổng (`depart`), rồi `enterFarm`. Nơi chỉ có quán thì nông trại tự đưa vào [04 · Quán](../04-cafe/README.md) |

Save đã có `heaven.completed` hoặc `farm` thì mở game vào thẳng nông trại, không qua màn này.

## Luồng chơi

1. Vào quảng trường. Thần Chết và Thần Tiếp Nhận đứng sẵn hai bên chỗ xuất hiện, quay mặt về người chơi.
2. Thoại tự chạy 4 hộp (`MINI`): Thần Chết 2 hộp, Thần Tiếp Nhận 2 hộp. Hộp 3 có dấu đỏ «CHƯA CHẾT · CHỈ NGẤT». Hộp 4 báo Hội đồng trùng sinh sẽ tìm người chơi ở trần gian. Camera nghiêng về người đang nói.
3. Hộp 5: lời tiễn của Thần Tiếp Nhận, dòng quà «❧ Túi hạt giống: +6 hạt giống, 6 túi phân» và nút **Nhận**.
4. Bấm Nhận: toast nhận quà, nhân vật tự đi tới Cổng trùng sinh. Chạm hoặc bấm phím để tua tới trước cổng.
5. Tới cổng: mở bản đồ thế giới. Chọn nơi xong thì nhân vật đi qua cổng, màn hình sáng dần rồi sang nông trại.
6. Đóng bản đồ mà chưa chọn: đứng trước cổng, đi lại tự do, đi vào cổng để mở lại bản đồ.

Bỏ qua ↗ (một lần bấm) nhảy thẳng tới bước 4. Tải lại giữa chừng thì tiếp tục theo pha đã lưu. Xem [rules.md](rules.md) mục 1–3.

## Điều khiển

| Thao tác | Chạm | Chuột / phím |
|---|---|---|
| Tiếp hội thoại | Chạm bất kỳ đâu | Bấm bất kỳ đâu, E / Enter / Space |
| Nhận quà (hộp 5) | Nút Nhận | Nút Nhận (có tiêu điểm sẵn), phím 1, Enter |
| Tua khi tự đi vào cổng | Chạm bất kỳ đâu (trừ ⚙️) | Bấm, E / Enter / Space |
| Bỏ qua | Nút Bỏ qua ↗ cạnh ⚙️ | Như chạm |
| Đi (chỉ khi đi lại tự do) | Joystick góc trái | Bấm mặt đất, WASD, phím mũi tên |
| Nói chuyện / vào cổng (đi lại tự do) | Chạm NPC hoặc nút tương tác | Bấm NPC, E / Enter / Space khi đứng gần |
| Xoay camera / zoom (đi lại tự do) | Kéo màn hình | Kéo chuột ≥ 8 px; lăn chuột để zoom |
| Đi tới đích nhiệm vụ | Chạm thẻ nhiệm vụ | Bấm thẻ, Enter / Space khi thẻ có tiêu điểm |

Chi tiết từng luật: [rules.md](rules.md) mục 4.

## Dữ liệu

Khóa localStorage `godbean-progress` (`state/progress.js`, `saveHeaven`).

| Trường | Đọc / ghi | Ý nghĩa |
|---|---|---|
| `introCompleted` | đọc, ghi `true` | Đã xong đoạn mở đầu |
| `chapter` | ghi | 2 khi đang ở thiên đàng, 3 khi `heaven.completed` |
| `heaven` | đọc, ghi | Tiến trình màn này; schema ở [rules.md](rules.md) mục 6 |
| `startingGift` | ghi | Bản sao `heaven.gift`; save mới luôn `'seeds'` |

Truyền sang nông trại (`enterFarm`): `gift`, `correctQuestionIds(heaven)` (câu đúng → mẹo) và `answeredQuestionIds(heaven)` (câu đã trả lời → đã gặp chuyên gia). Nông trại lưu kết quả trong `farm.lessons`; Hội đồng ghi `farm.lessons.met`, `farm.lessons.arrived` (xem [rules.md](rules.md) mục 7–9). Màn này không đọc hay ghi `farm`.

## Code

| File | Vai trò |
|---|---|
| `src/features/heaven/content.js` | NPC và vị trí, ba chuyên gia và 6 câu hỏi (`EXPERTS`, dùng chung với Hội đồng và hỏi lại), thoại `MINI`, quà `GIFTS`, `STARTING_GIFT`, `expertsDone`. Không phụ thuộc Three.js |
| `src/features/heaven/journey.js` | Pha `welcome → gift → return → completed`, khôi phục và chuẩn hóa save, `correctQuestionIds`, `answeredQuestionIds`, `answerText`. Không phụ thuộc DOM, Three.js, localStorage |
| `src/features/heaven/game.js` | Nối luật, cảnh và UI: nhịp thoại, hộp quà, Bỏ qua, tự đi vào cổng, kéo/zoom camera, hook `cancelPortal` / `depart` |
| `src/features/heaven/scene.js` | Bọc `createAdventureScene` với cấu hình thiên đàng (ánh sáng, hướng NPC) |
| `src/features/heaven/ui.js` | Thẻ nhiệm vụ, hộp thoại và nút Nhận, con dấu, joystick, toast, màn kết, màn sáng khi qua cổng |
| `src/shared/world/scene.js` | Quảng trường 3D, vật cản, tìm đường, điểm bấm, camera, slot asset |
| `src/shared/game/navigation.js` | Tìm đường quanh collider; chạy từng phần khoảng 2 ms mỗi khung hình |
| `src/ui/dialogue.js` | Khung hội thoại đáy màn, gợi ý tiếp theo thiết bị |
| `src/ui/lesson-prompt.js` | `askLesson` (hỏi lại một câu), `askCouncil` (một lượt Hội đồng), `findLesson` |
| `src/features/farm/model.js` | `farm.lessons`, mốc có mặt của chuyên gia, `act('lessons', 'answer' / 'defer' / 'council')`, áp quà và mẹo |
| `src/features/farm/game.js` | Cổng Hội đồng, `openCouncil`, `meetCouncil`, `offerLesson`, Sổ tay thiên đàng |
| `src/features/cafe/game.js`, `cafe/ui.js`, `cafe/bench.js` | Chuông Hội đồng trong quán, nút Hội đồng ở báo cáo ca, hỏi lại sau ca và sau ly |
| `src/features/awakening/rules.js` | 6 câu hỏi mở nguồn `'heaven'` và cách kiểm chứng |
| `src/features/awakening/ui.js` | Sổ tay ▸ Câu hỏi / Fragment-Key, nút «Gặp Hội đồng» |
| `src/state/progress.js` | `readProgress`, `saveHeaven` |
| `src/app/game.js` | `enterHeaven`, `openWorldMap`, `leaveWorldMap`, analytics `heaven_completed` |
| `src/i18n/locales/heaven.js` | Toàn bộ chữ của màn, câu hỏi, mẹo, quà |
| `src/ui/styles/heaven.css`, `src/ui/styles/dialogue.css` | Giao diện riêng của màn và khung hội thoại |

## Asset

| Slot | File |
|---|---|
| `heaven/reaper` | `public/models/heaven/reaper.glb` |
| `heaven/clerk` | `public/models/heaven/clerk.glb` |
| `heaven/portal/frame`, `left-leaf`, `right-leaf` | `public/models/heaven/portal.glb` (`#portal_frame`, `#portal_left_leaf`, `#portal_right_leaf`) |
| `heaven/plaza` | `public/models/heaven/plaza.glb` (chỉ thay hình; khối tạm giữ làm va chạm) |
| `heaven/surroundings` | `public/models/heaven/surroundings.glb` (không đổ/nhận bóng) |
| Nhân vật | Model nữ/nam theo hồ sơ (`loadPlayer`), dùng animation Walking của model |
| Cổng Hội đồng (farm) | Khối tạm, slot `farm/council` (`farm/environment.js`) |

Bảng tên NPC và vị trí nằm ở `content.js`; thay asset thì giữ id, cập nhật collider theo kích thước mới. `growing.glb`, `brewing.glb`, `business.glb` có trong thư mục nhưng màn này không nạp (chuyên gia ẩn).

## Analytics

| Sự kiện | Nơi phát | Thuộc tính |
|---|---|---|
| `game_started` | `app/game.js`, mở lại game vào thiên đàng | `resumed: true`, `screen: 'heaven'` |
| `heaven_completed` | `app/game.js`, khi qua cổng | `skipped`, `correct` (số câu đúng của save cũ), `gift` (save mới `'seeds'`), `mode` (`'mini'` / `'full'`), `region_type` (`both` / `farm` / `cafe`) |
| `council_answered` | `farm/model.js`, mỗi câu trả lời ở Hội đồng | `expert`, `questionId`, `correct` |

`council_arrived` chỉ là sự kiện nội bộ của farm (toast, dựng Cổng), không gửi analytics.

## Chưa làm / điểm mở

- Chưa đo thời lượng màn mini; mục tiêu ≤ 25 s.
- Chưa playtest tọa độ Cổng Hội đồng và vật Hội đồng trong quán ở màn 375×812.
- NPC, bàn, cổng và Cổng Hội đồng vẫn là khối tạm hoặc asset tạm; chưa có lồng tiếng.
- `expert.greeting` và `expert.seal` trong `content.js` không còn dùng.
- Màn kết chương chỉ hiện khi chạy không có `onReborn` hoặc mở lại save đã xong; app hiện không đi đường này nên nút Chơi lại gần như không tới được.
