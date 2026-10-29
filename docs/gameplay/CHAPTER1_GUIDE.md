> Cập nhật2026-10-29: Chương1 đã bỏ kéo map một/hai ngón. Camera theo nhân vật/cảnh cứu hộ; joystick, WASD/mũi tên và chạm đi tới giữ nguyên. Các mô tả kéo camera phía dưới nếu có không còn áp dụng cho Chương1. Đợt mỹ thuật sau khung mẫu11 đã hoàn tác theo yêu cầu người dùng.

# Hướng dẫn chơi Màn 1: "Một ngày xui tận mạng"

> Cập nhật: **2026-10-28** · Trạng thái: **Prototype** (hình vẽ bằng code, chờ thay bằng art 3D). Số liệu bên dưới lấy từ [story.json](../../src/data/config/story.json) mục `chapters.S03` và mã nguồn `RunService.ts`, `StreetService.ts`, `ShopService.ts`.
> Kế hoạch và danh sách asset: [CHAPTER_PLAN.md](../production/CHAPTER_PLAN.md).

## 1. Màn này là gì
Bạn dạo một phố cổ ven Hồ Gươm. Phố đầy người, quán và xe máy, nhưng hôm nay xui: **sự cố lãng xẹt cứ lần lượt kéo tới**. Mục tiêu là **né càng lâu càng tốt**, nghe chuyện ở các quầy và ghé quán cà phê ông Tám. Dính **1 phát là ngất**, xe cứu thương tới đưa đi, và cuối cùng xe lao vào một vòng tròn ma thuật để sang Màn 2 (vườn mây).

Một lượt chơi dài khoảng **0,5 đến 2 phút** nếu bạn bị ngất sớm, tối đa **120 giây** nếu né hết (cộng khoảng 15 giây cảnh cứu hộ). Thời gian trong quán cà phê không bị tính.

## 2. Điều khiển
| Thao tác | Máy tính | Điện thoại |
|---|---|---|
| Đi | **W A S D** hoặc **phím mũi tên** (lên là lên màn hình) | Chạm giữ và kéo ở **nửa trái** màn hình (joystick hiện ra dưới ngón tay) |
| Đi tới một chỗ | **Bấm chuột** vào mặt đất | Chạm vào mặt đất |
| Nói chuyện | Bấm vào người, hoặc đi lại gần quầy | Chạm vào người, hoặc đi lại gần |
| Chọn câu trả lời | Bấm 1 trong 2 nút ở cuối màn hình hoặc phím **1** / **2** | Chạm nút |
| Bật/tắt tiếng | Nút ở góc trái trên hoặc phím **M** | Nút ở góc trái trên |
| Nhìn xa hơn | Giữ chuột và kéo (nhả ra camera tự về nhân vật) | Kéo ở **nửa phải** màn hình như Tốc Chiến; nhả tay camera tự về nhân vật. Không còn zoom |

Khi bấm di chuyển, nơi bạn bấm hiện một **dấu điểm đến** (vòng sóng cam lan ra, rồi vòng tròn nhỏ có chấm cam), mờ dần khi bạn tới nơi.
Màn mở đầu chờ bạn chạm hoặc bấm phím lần đầu rồi mới bắt đầu tính giờ.

Thẻ trên đầu màn hình luôn cho biết việc cần làm ("Dạo phố cổ, ghé quán cà phê ông Tám · coi chừng sự cố, dính 1 phát là ngất!").

## 3. Nhịp của một lượt chơi
1. **0 đến 8 giây**: yên ổn, làm quen, đi lại, nói chuyện.
2. **Từ giây thứ 8**: sự cố đầu tiên xuất hiện. Sự cố ra mỗi **2,6 giây**, nhanh dần xuống **1 giây** sau khoảng 90 giây. Từ giây 70 trở đi **ra hai cái một lúc**. Cùng lúc tối đa 5 sự cố.
3. **Các loại sự cố được mở dần** theo thời gian (mục 4), và được rút như bốc bài: mỗi vòng ra đủ mọi loại rồi mới lặp lại.
4. **Dính 1 phát là ngất** (mục 8). Né được thì tiếp tục chơi, không còn mốc tự ngất sau 120 giây.
5. **Cảnh cứu hộ** (mục 8), rồi sang Màn 2.

## 4. Mười hai sự cố
Mỗi sự cố có **báo trước** (bóng đổ, nứt đường, dấu chấm than, dải làn nhấp nháy) để bạn kịp né. Hầu hết có **bẻ lái**: né xong lại dính cái lãng xẹt hơn.

| # | Mở từ giây | Sự cố | Báo trước | Bẻ lái lãng xẹt | Câu than khi ngất |
|---|---|---|---|---|---|
| 1 | 0 | **Vỏ chuối** nằm phía trước | Ngắn (0,3 giây), thấy trước trên đường | Đi lại gần rồi đi ra xa thì **vỏ chuối thứ hai** hiện ngay trước mặt | "Đã né rồi cơ mà… ai rải hai cái…" |
| 2 | 4 | **Sầu riêng 5 ký rơi** | Bóng đổ lớn dần 1,4 giây | Rơi sát bên mà không trúng thì **mùi làm đi chậm** 2 giây ("Mùi gì kinh thế…") | "Sầu riêng… năm ký… đầu mình…" |
| 3 | 10 | **Bà tầng 2 đổ chậu nước** (chỉ khi bạn ở vỉa hè phía nhà hoặc trong ngõ) | Bóng đổ 1,2 giây | | "Bà ơi… cháu không phải rau…" |
| 4 | 16 | **Quả cầu đá** bay ngang | Dải làn và dấu chấm than 0,8 giây | | "Đánh đầu… đẹp chưa…" |
| 5 | 22 | **Chó**: bé Chihuahua sủa "Gâu gâu!" | 1,7 giây | Rồi **chó Ngao to hơn hẳn** lao ra đuổi ("GÂU!!!"), chạy nhanh nhưng quay vòng rộng; bỏ cuộc sau 3,6 giây hoặc khi bạn chạy xa | "Con chó bé tí… mà có bố to thế…" |
| 6 | 28 | **Mèo** chạy theo | 1,1 giây | Chậm hơn bạn nhưng bám dai | "Mèo nằm giữa đường… ai mà thấy…" |
| 7 | 34 | **Ổ voi** giữa đường | Đường nứt dần 1,5 giây | Đi lại gần rồi lùi ra thì **nắp cống bên cạnh lật** ("Nắp cống!") | "Hà Nội ơi… hố ga nhiều hơn khách…" |
| 8 | 40 | **Quần đùi hoa rơi chụp đầu** (chỉ gần nhà) | Bóng đổ 1,2 giây | **Không ngất**: mặt bị che, **phím điều khiển đảo ngược 2 giây** | "Ai treo quần đùi hoa ở đây!!…" |
| 9 | 46 | **Đoàn 3 xe máy** chở tủ lạnh chạy ngang lòng đường | Cả làn nhấp nháy 1,6 giây | Né được đoàn xe thì **lồng gà ở xe cuối vỡ**, **đàn gà sổng chuồng** đuổi theo ("Gà sổng chuồng!") | "Ai chở cả tủ lạnh trên xe máy thế…" / "Bị gà mổ… nhục quá…" |
| 10 | 52 | **Dép tổ ong** bay | 0,9 giây | Bay qua rồi **quay lại như boomerang** ("Nó quay lại!!") | "Dép tổ ong… biết quay đầu à…" |
| 11 | 58 | **Đàn bồ câu** lao ngang | Dải trắng 1,5 giây | Nếu bạn **đã nghe xong quầy bánh mì** thì chúng **bay theo bạn đòi bánh mì** ("Bánh mì kìa!!") | "Trả… bánh mì… đây…" |
| 12 | 46 | **Đàn gà sổng chuồng** | Không tự ra: chỉ xuất hiện sau đoàn xe máy ở dòng 9 | Đuổi theo bạn, chậm hơn chó | "Bị gà mổ… nhục quá…" |


**Cách né:** đi khỏi chỗ có báo trước, đừng đứng yên giữa lòng đường, chạy xa con vật đang đuổi. Quần đùi và mùi sầu riêng không làm ngất nhưng làm bạn loạng choạng đúng lúc có sự cố khác.

## 5. Kết chương
Đã bỏ sáu cú chót theo thời gian. Nhân vật chuyển sang trùng sinh qua luồng tai nạn → cứu thương → Màn 2; không có kết thúc thắng do sống sót đủ thời gian.

## 6. Quầy, quán và người trên phố

### Tám quầy vỉa hè
Đi lại gần (trong khoảng 1,9 ô) hoặc bấm vào người bán thì họ **tự nói chuyện bằng bong bóng**; tới đoạn cần trả lời thì hiện **2 nút**. Nghe hết chuyện là **đã ghé** quầy đó (dấu ✓ cạnh tên). Đi ra xa giữa chừng thì chuyện dừng và lần sau nói lại từ đầu. Bấm vào người bán sau khi đã nghe thì họ nói một câu ngắn.

| Quầy | Vị trí | Trò đùa | Cài cho về sau |
|---|---|---|---|
| Trà đá chú Tư | Vỉa hè bắc, bên trái | Ông Bảy đá bóng với "Messi bán bánh mì" | Hội thoại đời thường |
| Sạp báo ông Hai | Vỉa hè bắc | "Tin nóng: thanh niên dạo phố gặp sự cố lãng xẹt!" | Hội thoại đời thường |
| Phở bà Ba | Vỉa hè bắc | "Hết tái. Ăn chín." Khách bảo quán ngon nhờ bị chửi | Chuyện quán phở; chó nhà ông Tư Mập |
| Bún đậu cô Sáu | Vỉa hè bắc | Chọn "nước mắm" thì cả quán im lặng nhìn | Bồ câu né mùi mắm tôm |
| Bánh mì anh Bảy | Vỉa hè bắc, bên phải | "Cho em ổ bánh mì không có gì." | **Bồ câu đuổi theo đòi bánh mì** |
| Cắt tóc bác Hùng | Vỉa hè bắc, phía đông | Gương treo cây, kiểu "Hàng Bạc, Hàng Gai" | |
| Xe ôm chú Năm | Vỉa hè nam | "Đi bộ thì bác đi bộ cùng, hai mươi nghìn" | |
| Gánh xôi bà Tư | Vỉa hè nam | Khách Tây khen "Very rẻ!", shipper bị khách ở Úc | |

### Quán cà phê ông Tám (có cửa vào trong)
- Cửa gỗ có biển tên trên mặt tiền dãy nhà phía bắc, phía đông (giữa quầy bánh mì và quầy cắt tóc). **Đi thẳng vào cửa** thì vào trong quán.
- Trong quán: phòng nhỏ có quầy pha, bàn ghế, khách ngồi, bảng menu. Đi lại bằng phím, joystick hoặc bấm sàn; bấm vào người để nói chuyện. Ông Tám nói chuyện khi bạn đi lại gần ông.
- **Trò đùa**: sau khi nghe xong, mèo quán chiếm chỗ cạnh bạn. "Cà phê ngon là phải chờ, như người yêu ấy."
- **Ở trong quán thì phố bên ngoài đứng yên, đồng hồ 120 giây dừng lại**, nên đây là chỗ nghỉ an toàn. Ra bằng **thảm "Lối ra ▼"** ở mép trước thì về đứng trước cửa.
- Cửa **đóng** (biển "Nghỉ giờ tan tầm") khi bạn đã bị ngất.

### Người đi đường và xe máy nền
- Khoảng 10 người đi bộ (người dân, khách Tây, shipper, bà gánh hàng, trẻ con…) đi lại, thỉnh thoảng nói đùa; đi sát họ thì họ chào một câu. Bấm vào họ cũng được.
- 3 xe máy chạy dọc phố, **đi bên phải** (hướng tây đi làn phía bắc, hướng đông đi làn phía nam).
- **Bước vào sát xe máy** thì ngẫu nhiên: **50% xe phanh "Kíííít!"** (khói bốc lên, người lái chửi một câu, bạn thoát) hoặc **50% xe tông**, bạn ngất. Trong 5 giây đầu xe chỉ bấm còi và giảm tốc, chưa tông.
- Cây sấu ven hồ, ghế nhựa, xe máy đỗ, ô tô, quầy hàng là **vật cản thật**: không đi xuyên qua được, cũng không đi xuyên người khác. Lan can ven hồ và hai trạm chắn ở hai đầu phố là rìa của màn.

### Trạm chắn ở hai đầu phố
Hai đầu phố có **rào chắn và bảo vệ**. Đi lại sát bảo vệ hoặc bấm vào ông ấy:
1. Bạn: "Ơ, chặn đường à? Cho cháu qua với!" Bảo vệ: "Phố đang cấm. Quay lại!"
2. Một xe máy tới, bảo vệ **nâng thanh chắn cho xe qua** ("Xe máy là người nhà, cho qua!"). Bạn hỏi sao người đi bộ không được, bảo vệ vẫn từ chối.
3. Bạn chọn:
   - **"Thôi cháu quay lại ạ"**: bảo vệ khen "Ngoan." và bạn chơi tiếp.
   - **Nài nỉ**: bảo vệ cho qua, nhân vật tự bước qua rào… và **bị xe máy tông bay** ("Đã bảo cấm rồi còn cố đi!"). Cảnh cứu hộ bắt đầu.
4. Đi ra xa trước khi chọn thì cảnh dừng; quay lại sau 15 giây thì diễn lại.

## 7. Cái chết mềm: "dính 1 phát"
Khi dính sự cố, cú ngã diễn ra trong khoảng 1,4 giây: nhân vật loạng choạng, bay lên, rơi xuống hố… tùy sự cố. Nhân vật **luôn giữ nguyên kích thước**, rồi **nằm ra** sõng soài, sao bay quanh đầu và nói câu than ở bảng mục 4.

## 8. Cảnh cứu hộ (khoảng 15 giây)
1. Người đi đường **xúm lại** đứng cách xa nhân vật: "Có ai gọi 115 chưa?", "Khoan, để em quay TikTok đã!", "Thằng này hôm qua còn nợ tôi cốc trà đá", "Ơ, nó còn thở này… đang ngáy".
2. **Xe cứu thương** hú còi tới theo làn bên phải. Bác xe ôm chen vào ("Để bác chở cho nhanh, hai mươi nghìn!"), tài xế gắt "Bác đi ra!". Xe máy khác xếp hàng phía sau bấm còi.
3. Hai y tế xuống xe hét **"Tránh ra, tránh ra!"**, đám đông lùi ra hai bên lề. Y tế mắng người quay phim: "Quay quay cái gì! Cất điện thoại đi!"; người đó cãi: "Em đang live…".
4. **"Ơ… quên mang cáng ở nhà rồi!"** "Thôi, hai đứa mình khiêng tay vậy. Một, hai, ba… nhấc!" Mọi người giơ điện thoại **chụp, đèn flash nháy**: "Lên TikTok xu hướng luôn!", "Chụp lẹ, đăng Facebook!"…
5. Khiêng tới cạnh xe, **"CỐP!"** đập đầu vào cửa xe, nhân vật vào xe và biến mất.
6. Xe chạy đi (tài xế: "Ơ… đập đầu vào cửa xe rồi. Thôi, đi!") và **một vòng tròn ma thuật mở ra giữa đường**, camera đi theo xe.
   - **50%**: xe lao vào vòng tròn và biến mất.
   - **50%**: **một bánh xe rơi ra lăn đi**, xe nghiêng ("Ơ… bánh xe đâu rồi?!"), khựng lại và **"BÙM!!!"** (đám mây hoạt hình có sao bay).
7. Màn hình lóe sáng, **cánh cổng đóng lại rồi mở ra ở Màn 2**.

## 9. Mẹo cho người chơi
- Hầu hết sự cố nhắm vào **chỗ bạn đang đứng hoặc đang đi tới**. Đổi hướng khi thấy bóng đổ hoặc dải nhấp nháy.
- Quán cà phê ông Tám là chỗ **tạm dừng đồng hồ**: vào đó khi đang thấy rối.
- Muốn xem **cảnh bảo vệ**: đi tới đầu phố bên trái hoặc bên phải.
- Muốn xem **gà sổng chuồng**: sống qua giây 46 và né đoàn xe máy chở tủ lạnh.

## 10. Chỉnh độ khó và nội dung (dành cho người làm game)
Tất cả nằm trong [story.json](../../src/data/config/story.json), mục `chapters.S03`:

| Muốn chỉnh | Trường |
|---|---|
| Khoảng yên đầu màn | `run.firstGagMs` (hiện 8000) |
| Mỗi sự cố mở từ giây nào | `run.unlockSec` |
| Tốc độ ra sự cố | `run.spawnStartMs`, `spawnMinMs`, `rampSec`, `rushSec`, `maxHazards` |
| Tốc độ nhân vật | `run.runSpeed` |
| Câu chữ từng sự cố, câu than | `hazards.<loại>` |
| Quầy vỉa hè | `stalls` |
| Quán cà phê | `street.shops` |
| Số người đi bộ, xe máy nền | `street.walkers`, `street.bikes` |
| Xác suất xe phanh kịp | `street.skidChance` (hiện 0,5) |
| Hai trạm chắn và lời bảo vệ | `street.gates`, `street.gateLines` |
| Cảnh cứu hộ, xác suất rơi bánh nổ | `street.rescue`, `street.rescue.wheelOffChance` (hiện 0,5) |

Kiểm tra tự động: `tests/unit/chapter1-playtest.test.ts` (chơi thử từng sự cố, cảnh rào, cảnh cứu hộ, và một bài bấm ngẫu nhiên 40 lượt).


## Chơi mới, tiếp tục và chơi lại (T-100)

Mở game bình thường: chưa có save thì vào phố (S03); có save thì tiếp tục chương đã lưu. Sau cứu hộ, nhân vật chuyển sang cảnh trùng sinh S04; không tự lặp lại màn 1. Tải lại giữa một sự cố không khôi phục từng khung hình/đám đông, mà bắt đầu lại lượt chạy của chương ở checkpoint đã lưu.

Trong Cài đặt, **Xem lại cốt truyện** bắt đầu lại S03 và giữ tài sản hiện có. **Game mới** xóa tiến trình sau bước xác nhận và mở từ đầu. Bản phát triển có thể mở `?skipStory=1` để vào phần quản lý; không cần `?story=1` hoặc `?chapter2=1` để chơi cốt truyện thật.
