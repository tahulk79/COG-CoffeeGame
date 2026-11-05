# 02 · Thiên đàng — Luật

Luật hiện hành của thiên đàng mini, ba chuyên gia (Hội đồng trùng sinh), mẹo, hỏi lại và 6 câu hỏi mở nối với Decode. Tổng quan màn: [README.md](README.md).

## 1. Thiên đàng mini

| Luật | Chi tiết | Nguồn |
|---|---|---|
| Người có mặt | Thần Chết (-3,2; 5,4) và Thần Tiếp Nhận (3,2; 5,4) đứng sẵn, không bệ (`noDais`), quay về chỗ xuất hiện `SPAWN` (0; 7). Cổng trùng sinh ở (0; 13) | `content.js` `NPCS`, `scene.js` |
| Chuyên gia | Ba bệ chuyên gia vẫn có trên sân nhưng để trống: nhân vật ẩn (`initialVisible: false`), không chạm được, không nạp GLB | `content.js`, `game.js` `HEAVEN_MODELS` |
| Thoại | 4 hộp `MINI` + hộp quà = tối đa 5 hộp. Không hỏi câu nào, không chọn quà, không gợi ý joystick, không huy hiệu | `content.js` `MINI`, `game.js` `begin` |
| Con dấu | Hộp 3 hiện dấu «CHƯA CHẾT · CHỈ NGẤT» | `MINI[2]` mã `notDead` |
| Tiết lộ | Nghe xong hộp 4 thì ghi `heaven.revealed = true` | `journey.reveal` |
| Không nhắc cà phê | Thoại và dòng quà không có chữ "cà phê"; tên giống vối chỉ hiện ở log nông trại | `locales/heaven.js` `heaven.mini.*` |
| Camera | Nghiêng về người đang nói; về sau lưng nhân vật khi tự đi | `game.js` `showLine`, `walkToPortal` |
| HUD | Chỉ còn thẻ nhiệm vụ gọn góc trái, chữ theo pha (`welcome`, `gift`, `return`, `completed`, biến thể `walk`). Mũi chỉ: pha `gift` → Thần Tiếp Nhận, pha `return` → cổng | `ui.js` `hud` |

## 2. Quà khởi đầu

- Save mới luôn nhận `STARTING_GIFT = 'seeds'` bằng nút Nhận ở hộp 5 (`journey.chooseGift`).
- Kiểu quà `'seeds' | 'tools' | 'capital'` còn giữ cho save cũ (`GIFTS`).
- Nông trại áp quà đúng một lần, chặn bằng `farm.giftApplied` (`farm/model.js` `createFarm`).

| Quà | Tác dụng khi vào nông trại |
|---|---|
| ❧ Túi hạt giống (`seeds`) | +6 hạt robusta, +6 túi phân |
| ☕ Gói mở rộng quán (`tools`, save cũ) | Quán lên cấp 2 (`upgrades.cafe ≥ 2`): 4 bàn thay vì 3 |
| ₫ Túi vốn nhỏ (`capital`, save cũ) | +150 xu |

Đổi theo loại nơi (quà chọn trước khi biết nơi):

| Quà | Nơi | Nhận thay | Log |
|---|---|---|---|
| `seeds` | chỉ có quán | Túi vốn nhỏ +150 xu | «Nơi này chỉ có quán: nhận Túi vốn nhỏ +150 xu thay túi hạt» |
| `tools` | chỉ trồng | Túi vốn nhỏ +150 xu | Câu đổi chung `farmRules.log.giftSwapped` |

## 3. Pha, Bỏ qua, tự đi vào cổng

Pha (`journey.js` `phase`):

| Pha | Điều kiện | Vào màn thì |
|---|---|---|
| `welcome` | `revealed = false` | Chạy đủ 4 hộp rồi hộp quà |
| `gift` | `revealed`, chưa có `gift` | Chỉ hiện hộp quà |
| `return` | Có `gift`, chưa `completed` | Tự đi vào cổng |
| `completed` | `completed = true` | App vào thẳng nông trại; nếu màn vẫn được mở thì hiện màn kết |

Bỏ qua ↗:
- Hiện khi pha `welcome` hoặc `gift` và không đang tự đi, mở bản đồ, qua cổng (`game.js` `refresh`).
- Một lần bấm: đóng thoại, ghi `heaven.skipped = true` và `revealed = true` (chỉ khi còn ở `welcome`), nhận Túi hạt giống, rồi tự đi vào cổng. Không có bước xác nhận.

Tự đi vào cổng:
- Khóa joystick và phím, ẩn nút tương tác; nhân vật tìm đường tới cổng (`moveToNpc('portal')`).
- Chạm bất kỳ đâu (trừ ⚙️, ⚙️ menu, Bỏ qua) hoặc E / Enter / Space thì tua: đặt nhân vật ngay trước cổng (2,4 m) rồi mở bản đồ.
- Chỉ nhận tua từ khung hình đầu tiên đã vẽ (`ready`); lúc còn màn tải thì bỏ qua.
- Tìm đường thất bại hoặc mất lộ trình thì tự tua, không chờ chạm.

Qua cổng:
- Tới cổng gọi `onPortal` mở bản đồ thế giới. Không có lời tiễn ở cổng.
- Đóng bản đồ (`cancelPortal`): đứng trước cổng, đi lại tự do.
- Chọn nơi (`depart`): hoạt cảnh qua cổng, màn sáng dần trong 1 s sau khi đi qua; xong thì `returnHome` ghi `completed = true`, `mode = 'mini'` và gọi `onReborn(gift, progress)`.

Màn kết chương (`ui.complete`): chỉ khi chạy không có `onReborn` hoặc mở màn với save đã `completed`. Ghi quà và, nếu save đã trả lời câu nào, dòng «x/6 câu đúng · y câu sai · Mẹo đã nhận x/6». Nút Chơi lại gọi `journey.reset`.

## 4. Điều khiển

- Hội thoại thường: bấm bất kỳ đâu hoặc E / Enter / Space để tiếp; sự kiện xử lý một lần, không bấm xuyên xuống mặt đất.
- Gợi ý tiếp theo thiết bị: cảm ứng «Chạm để tiếp», chuột/bàn phím «Enter hoặc bấm để tiếp», hộp quà «Bấm Nhận để mang theo» (`ui/dialogue.js`, `heaven.mini.claimHint`).
- Hộp quà: chỉ nút Nhận, phím 1 hoặc Enter đi tiếp. Nút Nhận có tiêu điểm sẵn; Enter/Space trong 300 ms đầu hoặc phím giữ lặp bị chặn. Bấm ra ngoài thì nháy viền khung 420 ms (`pulseChoices`), không cảnh báo.
- Đi lại tự do (chỉ sau khi đóng bản đồ):
  - Bấm mặt đất để đi; bấm NPC để đi tới trong tầm nói rồi tự mở thoại. Bấm điểm mới để đổi đích.
  - WASD / mũi tên; joystick analog góc trái có vùng chết, tốc độ theo độ kéo; kéo joystick hủy đường đi tự động.
  - Thần Chết nói 1 câu (`heaven.reaper.return`), Thần Tiếp Nhận nói 1 câu (`heaven.clerk.done`). Đi vào cổng thì mở lại bản đồ.
  - Kéo ≥ 8 px để xoay camera; cú bấm trong 400 ms sau khi kéo không làm nhân vật đi. Lăn chuột để zoom (bỏ qua khi giữ Ctrl).
  - Thẻ nhiệm vụ bấm được: đưa nhân vật tới đích nhiệm vụ.
- Khi đang thoại, tự đi hoặc mở bản đồ, nhân vật không nhận lệnh di chuyển. Đổi tab hoặc mất focus thì xóa joystick và lộ trình.

## 5. Khôi phục save

- `heaven.completed = true` (hoặc có `farm`): app vào thẳng nông trại (`app/game.js`).
- `introCompleted` mà thiên đàng dở: chạy mini theo pha đã lưu (mục 3), kể cả save của bản thiên đàng đầy đủ cũ (đang hỏi, chọn quà, đi về cổng). Save cũ đã Bỏ qua mà chưa có quà vào thẳng hộp Nhận.
- `heaven.mode` thiếu ở save đã xong thì coi là `'full'` (bản đầy đủ cũ).
- `heaven.answers` của save cũ luôn được giữ, kể cả khi chơi lại chương.
- Chơi lại chương (`reset`): đặt lại `metReaper`, `skipped`, `revealed`, `gift`, `completed`; giữ `answers`; ghi lại `'seeds'` khi nhận. Nông trại không áp quà lần nữa vì `giftApplied = true`. Mẹo đã thuộc không mất.
- localStorage bị chặn: tiến trình giữ trong bộ nhớ; ghi thất bại thì báo một lần «Trình duyệt chưa lưu được tiến trình…».

## 6. Dữ liệu `heaven`

Khóa `godbean-progress`, ghi bằng `saveHeaven` (kèm `introCompleted: true`, `chapter`, `startingGift`).

```text
heaven.version: 2
heaven.mode: 'mini' | 'full'      ghi 'mini' khi xong; thiếu ở save đã xong = 'full'
heaven.metReaper: boolean
heaven.answers: { growing: [...], brewing: [...], business: [...] }
  mỗi phần tử: { questionId, optionId, correct }   chỉ có ở save cũ
heaven.answered: { growing, brewing, business }    số câu đã trả lời (dẫn xuất, không tin khi đọc)
heaven.passed:   { growing, brewing, business }    số câu đúng (dẫn xuất, không tin khi đọc)
heaven.skipped: boolean           bấm Bỏ qua trước khi nghe hết thoại
heaven.revealed: boolean          nghe xong hộp 4 hoặc Bỏ qua
heaven.gift: null | 'seeds' | 'tools' | 'capital'   save mới luôn 'seeds'
heaven.completed: boolean         đã qua cổng
```

Chuẩn hóa (`journey.js` `normalizeAnswers`, `createJourney`):
- v2: đọc lần lượt từng câu của mỗi chuyên gia; dừng ở bản ghi đầu tiên sai `questionId` hoặc `optionId` lạ. `correct` tính lại từ đáp án gốc.
- v1 (chỉ lưu số câu đúng `passed`): chuyển thành bản ghi đúng; không tự tạo câu sai.
- `gift` chỉ hợp lệ khi `revealed`; `completed` chỉ hợp lệ khi có `gift`.
- `correctQuestionIds(heaven)` → câu đúng; `answeredQuestionIds(heaven)` → mọi câu đã trả lời.

## 7. Ba chuyên gia và 6 câu hỏi

Nguồn duy nhất: `heaven/content.js` `EXPERTS`, chữ ở `locales/heaven.js`. Mỗi câu 3 đáp án; đúng/sai so theo id.

| Chuyên gia | Câu | Đáp án đúng | Mẹo | Tác dụng |
|---|---|---|---|---|
| ❧ Thần Nông (`growing`) | `ripe` | `ripe` | Mắt chọn quả | Lô quả **nhân vật chính hái** +5 chất lượng (chặn 100) |
| | `water` | `drain` | Đọc độ ẩm | Bình tưới +2 lượt: `6 + 4 × (cấp giếng − 1) + 2` |
| ♨ Thần Pha Chế (`brewing`) | `recipe` | `measure` | Cân đo chuẩn | `phin-den` và `nau-da` có `mastery.best ≥ 40` (★); không tăng `made` |
| | `adjust` | `one` | Sửa từng bước | Kết quả ly hiện «Sửa bước này trước» cho bước mất điểm nhiều nhất (không hiện khi ly do Auto pha) |
| ₫ Thần Thương Hội (`business`) | `costs` | `no` | Sổ thu chi | +30 xu một lần (bút toán `quest`) |
| | `customer` | `listen` | Giữ chân khách | Uy tín quán +3 một lần (chặn 100) |

Nguồn tác dụng: `farm/model.js` (`grantLessons`, `waterCapacity`, lệnh hái), `cafe/bench.js` (`cafe.bench.fixFirst`). Thưởng một lần chặn bằng `farm.lessons.granted`, không bao giờ trả hai lần.

Hộp kết quả: đúng → giải thích + «Mẹo mới: tên · tác dụng»; sai → câu sai, đáp án đúng, giải thích (`answerText`) + «Chưa nhận mẹo».

## 8. Hội đồng trùng sinh (ở nông trại và quán)

Mốc có mặt (`farm/model.js` `councilCheck`, `councilArrive`; không điều kiện cấp):

| Chuyên gia | Nơi có nông trại | Nơi chỉ trồng | Nơi chỉ quán |
|---|---|---|---|
| Thần Nông | Đã xong `farm-intro` và `stats.harvested ≥ 1` (tay hoặc Auto) | như trái | Ly đầu (`stats.served ≥ 1`; `farm-intro` coi như xong) |
| Thần Pha Chế | `stats.served ≥ 1` | Lần bán đầu (`stats.sold > 0`) | Ly đầu |
| Thần Thương Hội | Kết thúc ca thường đầu tiên (`act('cafe','shift')` không có `learning`) | Ngày công đầu kết thúc sau khi đã có Thần Pha Chế | Kết thúc ca thường đầu tiên |

- Mỗi lượt gặp **một** chuyên gia, hỏi các câu chưa gặp của người đó (tối đa 2). Nhiều người chờ thì xếp hàng Nông → Pha Chế → Thương Hội (`councilWaiting`).
- Chuyên gia đã có mặt không mất (`farm.lessons.arrived`).
- Lượt đầu là `farm.act('lessons', 'council', { questionId, optionId })`:
  - Không đọc/ghi `askedDay` / `askedCount`, không ăn suất hỏi lại trong ngày.
  - Luôn ghi câu vào `met`. Đúng → `learned` + mẹo ngay. Sai → `asked[id]` = ngày công hiện tại, sau đó vào cơ chế hỏi lại (mục 9).
  - Bị từ chối nếu câu đã gặp, đã thuộc, hoặc chuyên gia chưa có mặt.
- Hội đồng chỉ trao mẹo. Không quà, không Fragment.

Điểm vào:

| Nơi | Vật / nút | Luật mở |
|---|---|---|
| Nông trại | Cổng Hội đồng (`farm/content.js` `council`, tại (-3,4; 1,9)): ẩn tới khi chuyên gia đầu có mặt rồi trồi lên; bóng từng chuyên gia đã tới; cầu sáng + biển «✨ Mới · tên» khi có người chờ; hạt vàng ✓ khi chuyên gia đủ 2 câu trong `met` (`expertsDone`) | Chạm là mở tại chỗ, không đi bộ; nhân vật quay mặt về Cổng |
| Quán | Vật Hội đồng (`cafe/game.js` `council`, tại (3,6; 1,4)), chấm «Mới», dấu ✓ | Chỉ mở khi cửa quán đóng |
| Báo cáo cuối ca thường | Nút «🏛 Gặp Hội đồng · tên» khi có người chờ (`cafe/ui.js`) | Báo cáo ca tập không có nút |
| Sổ tay ▸ Câu hỏi / Fragment-Key | Thẻ «Gặp Hội đồng» khi có người chờ (`awakening/ui.js` `councilRow`) | Nông trại: lia camera tới Cổng (650 ms) rồi mở; quán: mở luôn |
| Hướng dẫn ▸ Sổ tay thiên đàng | Câu chưa gặp: «Chưa gặp chuyên gia» + nút «Gặp Hội đồng» (tắt, ghi «Tới sau» khi chuyên gia chưa có mặt) | Như Sổ tay |
| Thẻ nhiệm vụ nông trại | «Gặp tên ở Hội đồng» khi có người chờ và không có nhiệm vụ chuỗi | Không hiện ở nơi chỉ quán, không hiện trong quán |

Khi mở (`farm/game.js` `openCouncil`, `ui/lesson-prompt.js` `askCouncil`):
- Hội thoại đáy màn, nhãn «HỘI ĐỒNG · 1/2», chân dung chuyên gia, nút «Đóng». Đóng giữa chừng giữ câu đã trả lời, không tính là hoãn.
- Khóa di chuyển; Auto vẫn làm việc phía sau, không bấm hộ đáp án hay nút Đóng.
- Auto tắt mà đang làm việc tay (có việc, hàng đợi, đang đi tới máy, đang chọn công cụ/giống) thì không mở, toast «Làm xong việc đang làm tay rồi hãy gặp Hội đồng».
- Không có ai chờ: toast «Hiện chưa có chuyên gia nào chờ ở Hội đồng».
- Chuyên gia mới tới: nông trại toast «🏛 tên đã tới Hội đồng…» khi không có modal; quán chỉ có chấm «Mới», không toast.

## 9. Hỏi lại câu sai

Điều kiện một câu hỏi được (`farm/model.js` `askable`):
- Câu đã gặp chuyên gia (`met`) và chưa thuộc (`learned`).
- Chưa trả lời sai câu đó trong ngày công hiện tại (`asked[id] ≠ ngày công`).
- Toàn game chưa dùng suất hỏi lại hôm nay (`askedCount < 1`). Ngày công = `WORK_DAY_MS` = 6 phút.

Câu chưa gặp không bao giờ bị hỏi lại; chỉ Hội đồng hỏi.

| Câu | Lúc hỏi lại | Nguồn |
|---|---|---|
| `ripe` | Ngay sau khi nhân vật hái xong | `farm/game.js` |
| `water` | Sau khi tự lấy nước ở giếng; chạm giếng khi bình đầy (và giếng không có nâng cấp chờ); lúc rảnh đầu tiên của ngày công có mưa | `farm/game.js` |
| `adjust` | Màn kết quả ly dưới 70 điểm (không phải pha nhanh) | `cafe/bench.js` |
| `customer`, `recipe`, `costs` | Sau báo cáo cuối ca thường, theo thứ tự này; `customer` chỉ khi có khách bỏ về | `cafe/ui.js` |
| Bất kỳ | Nút «Ôn lại» ở Sổ tay thiên đàng; nếu hôm nay hết suất thì ghi «Ôn lại sau n phút» | `farm/ui.js` |

- Nông trại chỉ hỏi khi đã xong `farm-intro` và đang rảnh: không modal, không làm việc, không đặt trang trí, không bảng hướng dẫn điều khiển (trừ khi người chơi tự bấm Ôn lại). Không đủ điều kiện thì bỏ, chờ lần kích hoạt sau; không xếp hàng.
- Quán hỏi sau khi màn kết quả ly hoặc báo cáo ca đóng; mở màn khác thì bỏ câu đang chờ.
- Khung hỏi lại khóa di chuyển nhưng không dừng thời gian.
- «Để sau» hoặc Esc ở nông trại: tính là đã dùng suất hôm nay (`act('lessons','defer')`), không ghi kết quả.
- Đúng → mẹo ngay. Sai → giải thích; câu đó chờ ngày công sau.
- Chấm bằng đúng câu và đáp án trong `content.js`.

Save cũ:
- `met` = `farm.lessons.met` + câu đã trả lời ở thiên đàng + câu đã thuộc + câu đã trả lời sai ở nông trại.
- `learned` luôn gộp thêm câu đúng ở thiên đàng mỗi lần nạp; thưởng một lần trả cho câu mới thuộc, log «Mẹo từ thiên đàng: …».
- `arrived` thiếu: Thần Thương Hội có mặt nếu sổ ca có ≥ 2 ca (nơi chỉ trồng: đã bán).

## 10. Sáu câu hỏi mở (nối Decode)

Mỗi câu của thiên đàng có một câu hỏi mở cùng id, nguồn `'heaven'`, ở trạng thái `open` ngay từ đầu (`awakening/rules.js` `emptyAwakening`). Câu hỏi mở không phụ thuộc đã gặp chuyên gia hay trả lời đúng: Fragment chỉ đến từ thử nghiệm bằng dữ liệu của người chơi, không bao giờ từ việc trả lời câu đố. Luật Decode chung (trạng thái, Fragment, Message, Key) nằm trong GDD.

| Câu | Loại Fragment | Game tự nhận khi | So sánh / người chơi chọn |
|---|---|---|---|
| `ripe` | Origin | Cùng ngày công, cùng giống có một lô **nhân vật hái khi Auto tắt** (`by: 'player'`) và một lô thợ/robot hái; lô hái lúc Auto bật (`by: 'auto'`) không tính | Chất lượng hai lô; hơn / kém / như nhau (sai số 1) |
| `water` | Origin | Có một ô nước ≥ 90 (chỉ mưa đẩy lên mức này; tưới tay đặt 70) và một ô nước ≤ 15 | Tiến độ lớn hai ô (%); sai số 2 |
| `recipe` | Extraction | Hai ly game tự pha cùng món, đã nếm, có điểm mô phỏng, không lệch quá 5% (`STEP_TOLERANCE`) ở cả 4 biến `grind`, `tempC`, `doseG`, `waterG` | Điểm hai ly; sai số 3 |
| `adjust` | Extraction ×3 | First Sixth Key: mở (`trying`) khi `recipe` đã giải hoặc V60 đạt ≥ 70 điểm; 2 ly V60 A, B → giả thuyết một biến → ly C chỉ đổi biến đó | Giả thuyết đúng / sai / chưa đủ dữ liệu; đúng thì nhận 3 Fragment (đủ Message) |
| `costs` | Exchange | Hai ca: ca A doanh thu cao hơn nhưng lãi thấp hơn ca B (lãi = doanh thu − vật tư − lương − hạt nhập) | Khoản chi tăng nhiều nhất: lương / vật tư / hạt |
| `customer` | Connection | Hai ca liền nhau: ca trước ≥ 2 khách bỏ về, ca sau ít hơn, đổi đúng một trong: người, thực đơn, sữa, nước | Thứ đã đổi |

- Số liệu được đóng băng khi câu chuyển sang `ready`. Chọn sai: về `trying`, chờ bằng chứng mới (cặp khác).
- Chọn đúng: 1 Fragment cùng loại (`adjust`: 3).
- Nhật ký ca nằm ở `cafe.shiftLog` (giữ 10 ca, ca tập không ghi); mẫu thu hoạch/mẻ ở `awakening.samples`.
- Vào giao diện: Sổ tay ▸ Câu hỏi; câu `ready` có nút «🔎 Giải mã».

## 11. Chưa làm

- Câu hỏi mở `customer` chưa tính khách chê, chỉ tính khách bỏ về.
