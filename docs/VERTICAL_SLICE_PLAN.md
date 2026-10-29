# Kế hoạch chốt Vertical Slice — Chương 1

Ngày rà: 2026-10-29. Kế hoạch theo mã đang có trong workspace, gồm thay đổi mới từ Claude; không coi các lỗi ở lần rà cũ là vẫn tồn tại khi chưa đối chiếu lại. Theo dõi trạng thái duy nhất tại [TASK_LIST.md](task-list/TASK_LIST.md), T-099–T-108. Các mục bên dưới là phạm vi và điều kiện bàn giao, không phải bảng trạng thái thứ hai.

## Phạm vi cần đạt

Một chương phố cổ Hà Nội ban ngày, 2.5D isometric bằng sprite/atlas trong Phaser: đi lại, tương tác/hội thoại, phố có sinh hoạt, 12 loại sự cố, ngất → cứu hộ → trùng sinh/chuyển sang chương tiếp. Không cần hoàn thiện gameplay chương 2 để nghiệm thu chương 1; cần bàn giao sang cảnh kế tiếp được.

Giữ các quyết định đã chốt: bỏ hồ và landmark hồ, bỏ quán cà phê ông Tám, sáu kết thúc sống đủ thời gian, bảng mục tiêu, hiệu ứng nhấp nháy nhận diện và kéo map màn 1. Không chuyển engine/3D runtime. Không thay hàng loạt asset trước khi duyệt đoạn mẫu trong game.

## Căn cứ lần rà này

- Đọc code hiện tại: NPC có ghé quầy rồi rời đi, chủ quầy/khách có idle/shuffle, né người giữ hướng; khởi tạo hiện là **8 người đi bộ, 4 xe máy**, khác số cũ. Chưa tự xác nhận mọi tình huống của các hành vi này.
- Cảnh barie hiện dừng nhân vật tại chỗ thay vì tự dẫn ra giữa đường. Hai nhận xét ở lần rà trước cần đối chiếu bản mới; không đưa lại thành lỗi đã xác nhận.
- Cứu hộ có tính thân xe là vật cản, đường vòng của người khiêng và lệch giờ xuống xe của hai bác sĩ. Các số mô phỏng ở readiness §13 là ghi nhận từ lượt khác, không phải lượt này chạy lại.
- 33 atlas runtime WebP khoảng 5,3 MB, master PNG khoảng 48 MB nằm ngoài public. Việc xuất ảnh đã có; hiệu năng thiết bị thật còn cần đo.
- Đã mở bản chạy local, xem khung PC 1280×720, mobile dọc 390×844 và cài đặt PC. Ảnh đầu xem toàn map theo chế độ trình duyệt tự động; lượt sau dùng `story=1&close=1` để xem camera theo người. Giả lập chiều rộng không đồng nghĩa thiết bị cảm ứng thật.
- Quan sát thấy dãy nhà ảnh chi tiết phía trên và dãy quán khối đơn giản phía dưới chưa cùng mức hoàn thiện. Đây là việc cần duyệt mỹ thuật, không mặc định phải bỏ toàn bộ đồ họa vẽ bằng code.
- Lúc rà ban đầu: `story.json` đặt S03.next=S04 nhưng WorldScene dùng CHAPTER1_ONLY=true để đổi về S03 ở trình duyệt thường. T-100 đã gỡ override này; xem ghi nhận triển khai bên dưới.
- Không chạy suite unit/e2e, typecheck hoặc build trong lượt rà. Chưa nghe duyệt âm thanh, chưa chơi đủ 12 sự cố/các góc cứu hộ, chưa đo mạng/RAM hay kiểm tra điện thoại thật. Không kết luận đã nghiệm thu từ FPS overlay trên desktop.

## Cách làm từng phần

Mỗi phần: đối chiếu bản mới → sửa đúng phạm vi → mở game và lưu bằng chứng → bạn tự chơi/duyệt → sửa lỗi phát sinh → cập nhật task. Không chuyển Review thành Done chỉ vì đã viết code. Mọi lần triển khai đều giữ thay đổi khác đang có trong workspace. Không tự chạy lại bộ test khi bạn vẫn giữ yêu cầu tự test.

### 1. Khóa luồng chơi và bản dùng để nghiệm thu — T-100

**Tôi làm:** tách chế độ lặp màn 1 phục vụ phát triển khỏi luồng bàn giao; bỏ phụ thuộc `navigator.webdriver` trong hành vi người chơi; kiểm trạng thái mới/có save/chơi lại, mở menu, quay lại tab và chuyển cảnh. Kiểm lại phạm vi đã bỏ không còn xuất hiện trong màn chơi.

**Bạn duyệt:** mở game như người chơi bình thường, chơi mới rồi quay lại; xác nhận sau cứu hộ phải thấy gì ở đầu chương kế tiếp. Mặc định theo yêu cầu trước là trùng sinh/chuyển chương.

**Xong khi:** trình duyệt thường và bản bàn giao có cùng luồng; một lượt từ bắt đầu tới cứu hộ/chuyển cảnh kết thúc được, không lặp màn 1 ngoài ý muốn, không khóa điều khiển khi quay lại. Có đường chơi lại rõ ràng; không ép ngất bằng thời gian.

### 2. Phố có sinh hoạt và lối đi rõ — T-101

**Tôi làm:** quan sát người đi qua các khu trà đá, ngõ, quầy phía nam và hai barie; phân biệt chủ quầy, khách dừng ngắn, người qua đường. Rà NPC ghé quầy có rời đi được, không chờ nhau vô hạn hoặc xuyên người khi hết timeout. Điều chỉnh mật độ theo số người nhìn thấy trong camera, tốc độ và vị trí xuất hiện; chỉ tăng số NPC sau khi đường đi ổn. Giữ đủ lối cho hero và bác sĩ.

**Bạn duyệt:** đoạn đầu/giữa/cuối phố có cảm giác thành phố đang sống; chủ quầy đứng bán hợp lý, người qua đường không thành tượng hoặc đoàn diễu hành giống nhau. Duyệt một đoạn mẫu trước khi tăng toàn phố.

**Xong khi:** người qua lại hai chiều và ghé/rời quầy; không dồn thành đám đứng lâu, đi xuyên vật cản, giật hướng liên tục hoặc chắn đường bắt buộc. Khi cứu hộ chỉ nhóm gần đó tụ lại, phố xung quanh vẫn có hoạt động. Không lấy một con số NPC cố định làm tiêu chí duy nhất.

### 3. Đồng bộ cảnh, nền ngoài map và camera — T-102

**Tôi làm:** chụp ba khung gần/trung/xa trên PC và mobile; chốt tỉ lệ hero–cửa–quầy–cây–xe, góc chiếu, màu/ánh sáng/bóng. Làm mẫu một đoạn có cả hai bên phố, một quầy, cây và NPC theo art đang dùng, rồi mới mở rộng. Rà đường/vỉa hè/miệng ngõ, dãy quán phía nam, nhà xa, chỗ nối ngoài map, fade khi che người và footprint hình/collider. Chọn từng asset cần sửa sau khi có ảnh mẫu, không mua/tạo thêm cả bộ ngay.

**Bạn duyệt:** ảnh chụp từ game của đoạn mẫu ở PC và mobile; chỉ khi đồng ý mới áp dụng toàn màn. Bối cảnh Việt Nam, vui và rõ; ưu tiên đọc được người/nguy hiểm hơn chi tiết trang trí.

**Xong khi:** hai phía phố cùng chất lượng/phong cách; không mái/vật thừa, mối nối lộ, nền lật gương, nhà đè nhân vật hoặc vùng trống vô nghĩa tại giới hạn camera. Chân nhân vật nằm đúng mặt đất; trên mobile nhận ra hero và nguy hiểm mà không cần thêm điều khiển zoom.

### 4. Nhân vật và cảnh cứu hộ — T-103

**Tôi làm:** xem đi/đứng/đổi hướng/vấp/ngã/nằm/nâng/khiêng/lên xe; chỉnh điểm neo, kích thước và chuyển frame khi cần. Duyệt đường xe từ hai hướng, vào ngõ/đỗ/quay ra, cửa xe, tiếp xúc bác sĩ–hero, portal và nhánh rụng bánh. Dùng lại logic đã sửa, chỉ sửa chỗ còn tái hiện lỗi.

**Bạn duyệt:** cứu hộ ở hai barie, cuối ngõ, sát quầy, sát cây/xe đỗ và vị trí thông thường; thấy xe tới và hiểu bác sĩ đang làm gì.

**Xong khi:** không ngã trên mái/cổng, bác sĩ không mất/đè nhau, không xuyên xe/quầy, không khiêng hụt; xe đỗ đủ gần và camera không bỏ mất hero lúc đón. Mọi vị trí chơi tới được có đường cứu hộ hợp lệ hoặc phương án tiếp cận hợp lý, không nằm chờ vô hạn.

### 5. Duyệt đủ nội dung 12 sự cố — T-104

Danh sách: mèo, chó, hố/nắp cống, sầu riêng, xe máy chở hàng, bồ câu, vỏ chuối, nước, dây phơi, đá cầu, dép và gà. Barie là cảnh riêng, không tính thay một trong 12 loại.

**Tôi làm:** lập bảng tình huống với vị trí, điều kiện mở, cảnh báo, vùng va chạm, nhánh phụ và kết quả; cung cấp cách xem từng loại trong bản phát triển để không phải chờ ngẫu nhiên. Rà việc lưu lịch sử sự cố, lặp nội dung và xung đột nhiều sự cố/cứu hộ. VFX đơn giản, không che UI.

**Bạn duyệt:** từng loại có dễ hiểu, né được và đủ vui; không chỉ xem vài lượt ngẫu nhiên rồi đánh dấu đủ nội dung.

**Xong khi:** cả 12 loại và các nhánh cấu hình có bằng chứng chơi qua; cảnh báo khớp hình và hitbox, vật đã biến mất không còn gây hit, một lần ngất không khởi tạo nhiều cảnh cứu hộ/chuyển chương.

### 6. UI, camera và điều khiển — T-105

**Tôi làm:** rà điện thoại dọc/ngang và PC; thoại dài/nhiều người, lựa chọn quầy, cài đặt, loading, lỗi tải và quay lại game. Kiểm joystick/chạm đi tới/phím, không bấm xuyên UI, kéo ngón không thành lệnh đi ngoài ý muốn, xoay máy giữa hội thoại/cứu hộ; kiểm menu có dừng nguy hiểm đúng chỗ. Tách nút phát triển khỏi giao diện bàn giao.

**Bạn duyệt:** độ dễ đọc và tầm với ngón tay trên điện thoại thật; nhân vật có vừa mắt, quan sát kịp nguy hiểm và bấm lựa chọn thoải mái.

**Xong khi:** không cắt chữ/đè joystick hoặc nút âm thanh/cài đặt; mở/đóng menu không làm tự chạy, lệnh điều khiển không bị giữ khi rời tab. Không tái thêm kéo map, bảng mục tiêu hay blink đã bỏ. Loading không mắc vô hạn; khi lỗi có thông báo và cách thử lại.

### 7. Âm thanh hoàn chỉnh cho một chương — T-106

**Tôi làm:** kiểm kê và cân nhạc/ambience/SFX UI, bước chân/xe/cảnh báo, ngất/cứu hộ/portal; chọn phần tổng hợp có thể giữ và phần cần thay. Ghi nguồn/quyền dùng asset bổ sung. Rà loop, âm lượng chồng, mute được nhớ, audio unlock và rời/quay lại ứng dụng trên mobile. Không bắt buộc voice.

**Bạn duyệt:** nghe bằng loa điện thoại và tai nghe; duyệt cảm giác phố Việt, âm không chói/ồn/lặp khó chịu.

**Xong khi:** toàn luồng có âm đúng nhịp và mức âm dễ chịu; cue nguy hiểm nghe rõ; tắt âm thật sự im lặng và bật lại được, không nhân đôi nhạc sau chơi lại/chuyển cảnh.

### 8. Hiệu năng và gói bàn giao — T-107

**Tôi làm:** kiểm kê WebP/texture thực tải, lỗi console/tải asset và phụ thuộc mạng/font; đo tải lạnh, đi phố, nhiều sự cố, cứu hộ/portal và chơi lại nhiều lượt. Phân biệt FPS canvas/simulation với bộ đếm requestAnimationFrame hiện có; không dùng riêng overlay làm bằng chứng đạt. Xử lý điểm nghẽn đo được, không cắt art/NPC theo phỏng đoán.

**Bạn làm cùng:** chọn ít nhất một Android và một iPhone nếu có, ghi model/OS/trình duyệt, chạy các cảnh giống nhau. Nếu thiếu nền tảng phải ghi rõ giới hạn hỗ trợ khi bàn giao.

**Xong khi:** mục tiêu đề xuất mobile duy trì ≥30 FPS, PC gần 60 FPS trên máy tham chiếu đã ghi; không đứng hình kéo dài/đen màn hình, lỗi tải hoặc bộ nhớ tăng liên tục qua các lượt. Ghi thời gian tải lạnh thực tế với mạng tham chiếu rồi chốt ngưỡng hợp lý; không suy từ 5,3 MB ảnh. Chỉ chạy build/check tự động khi được bạn cho phép lại; bản release cuối vẫn cần xác nhận build được.

### 9. Buổi nghiệm thu và khóa bản — T-108

**Tôi làm:** chuẩn bị checklist một trang, mã phiên bản/commit và danh sách lỗi còn mở. Gộp bằng chứng các phần trước, không buộc chơi lại mọi thứ sau thay đổi không liên quan. Sau mỗi sửa lỗi, rà vùng ảnh hưởng.

**Bạn làm:** một lượt người chơi mới từ đầu tới trùng sinh trên PC và điện thoại dọc/ngang, kèm các lượt theo bảng nội dung/cứu hộ. Xác nhận chất lượng hình/âm/cảm giác điều khiển.

**Xong khi:** không còn lỗi chặn tiến trình, mất điều khiển, xuyên vật cản nghiêm trọng, mất người cứu hộ hoặc chuyển sai chương; đủ bằng chứng nội dung và thiết bị; các lỗi nhẹ được ghi và bạn chấp nhận. Lưu bản đã duyệt để tránh thay đổi tiếp làm mất mốc.

## Thứ tự triển khai và điều kiện dừng mở rộng

Làm **T-100 → T-101 → mẫu T-102 → T-103 → T-104 → T-105 → T-106 → T-107 → T-108**. Nếu lỗi cứu hộ chặn chơi xuất hiện, sửa trước mẫu mỹ thuật. Khi duyệt đoạn mẫu, ghi rõ bộ phận nào được thay; không đổi style toàn game giữa chừng.

Chưa thêm loại sự cố/chương/landmark mới. Không yêu cầu mọi NPC phải luôn đi; chủ quầy, người đang nói chuyện và người xem cứu hộ được đứng có lý do. Mỗi lần làm tiếp chọn một task cụ thể, trả ảnh/bằng chứng cùng phần còn cần bạn tự duyệt.


## Triển khai luồng 1 — 2026-10-29

T-100 đã được người dùng duyệt ngày 2026-10-29. Chưa nghiệm thu toàn bộ Vertical Slice.

- Chơi mới ở URL thường vào S03, không phụ thuộc trình duyệt có tự động hóa hay không. Bỏ `CHAPTER1_ONLY` và `playContent`; mọi bản dùng next từ cấu hình (S03 → S04).
- Tải lại tiếp tục chương/flags đã lưu; không tự xóa tiến trình cốt truyện. Nếu save được ghi lúc chuyển cảnh với chương mới nhưng map cũ, chọn map của chương để tránh kẹt ở màn trước.
- Giữ nút Xem lại cốt truyện: bắt đầu S03 qua luồng travel có sẵn, giữ tiến trình kinh tế/phần thưởng. Các pha tạm như sự cố/đám đông không được serialize; reload giữa màn 1 tạo lượt chạy mới ở checkpoint đã lưu.
- Chuyển scene mang state trong bộ nhớ, tránh đọc lại save cũ nếu storage không ghi được. Vẫn tôn trọng saveBlocked của save phiên bản mới hơn. Không đảm bảo khôi phục qua đóng tab khi trình duyệt từ chối ghi save.
- Game mới vẫn cần bấm xác nhận; chặn autosave/pagehide của session cũ ghi lại slot vừa xóa; mở lại đường dẫn sạch để không kế thừa `map`, `cheat`, `skipStory` của URL phát triển.
- Mất focus/ẩn tab: bỏ joystick, reset phím và ngừng steer để tránh giữ hướng khi quay lại.
- Dev muốn bỏ cốt truyện dùng `?skipStory=1` rõ ràng, không dùng ở production. Các URL vào bộ e2e ngoài cốt truyện đã đổi theo cách này; chưa chạy chúng. `?chapter2=1` không còn cần thiết. `fit/close` vẫn chỉ hỗ trợ camera phát triển, không đổi next/chương.

**Đã quan sát bằng UI local trên cổng riêng 5190:** mở `/` vào màn 1 không có tham số story; thao tác đi phố dẫn tới ngất/cứu hộ và sang cảnh S04; reload `/` vẫn ở S04; chọn Xem lại cốt truyện về màn 1; mở Game mới thấy bước xác nhận. Console không có error tại các lần đọc. Không dùng bot/suite hay gọi debug để ép chuyển chương.

Bằng chứng: [đã sang S04](screenshots/flow1-chapter2.png), [xem lại về S03](screenshots/flow1-replay.png).

**Bạn tự kiểm trước khi đóng T-100:**

1. Mở URL thường không có map/skipStory; đi phố và gặp sự cố, chờ bác sĩ khiêng lên xe rồi vào cảnh trùng sinh. Không quay lại phố tự động.
2. Reload khi đã ở S04: giữ chương và các viên đá đã kích hoạt. Reload giữa màn 1: giữ checkpoint/flags, bắt đầu lại phần sự cố tạm.
3. Xem lại cốt truyện: quay về S03; kiểm tài sản/phần thưởng cũ không bị mất hoặc cấp đôi.
4. Game mới: chỉ xóa sau xác nhận, vào S03 từ đầu; reload không hồi save cũ. Thử cả khi URL cũ có map override. Lượt triển khai chưa bấm xóa save qua UI.
5. Mở/đóng menu, giữ phím/joystick rồi đổi tab/quay lại: không giữ hướng chạy. Cần kiểm trên điện thoại thật.
6. Trường hợp storage bị chặn/ghi lỗi và đóng tab giữa chuyển cảnh chưa được mô phỏng; phần xử lý mới đã rà code, chưa xác nhận runtime. Không đánh dấu các trường hợp này đã qua.

Không chạy unit/e2e/typecheck/build theo yêu cầu tự test; chưa push/commit. Bước tiếp sau khi duyệt T-100 là T-101 (sinh hoạt NPC/lối đi), giữ nguyên art trong lượt này.


## Triển khai luồng 2 — 2026-10-29

T-101 đã được người dùng duyệt ngày 2026-10-29.

- Cấu hình tăng 8 → **16 người đi bộ**, giữ 4 xe máy. Chia vị trí xuất phát đều dọc hai vỉa hè, hướng đi xen kẽ hai chiều, vẫn có khác biệt tốc độ/hình người từ bộ art hiện tại. Tìm chỗ spawn trống trong giới hạn phố, tránh người/quầy/props/bảo vệ/hero; không đẩy một spawn bị chắn ra ngoài map. Nếu không có chỗ hợp lệ thì không thêm người chồng lên nhau để đủ số.
- Tối đa một phần tư nhóm đi bộ ghé quầy cùng lúc (với16 là4); mỗi quầy có tối đa một khách ghé từ dòng người qua đường. Chủ quầy và khách cố định vẫn giữ sinh hoạt riêng. Khách ghé xem2,5–5,5giây rồi quay lại lối đi, không biến cả nhóm thành đám đứng xem quầy.
- Lưu chỗ/hướng xuất phát khi ghé; giữ nguyên làn gốc. Chuyến đi bị chặn quá9giây chuyển sang quay về, không lấy vị trí cạnh quầy làm làn mới. Nếu đường về cũng bị chặn quá lâu thì bỏ chuyến, trở lại luồng đi thường với làn gốc và quy tắc né; không teleport/xuyên người. Chỉ chọn đường ghé có waypoint nằm ngoài lòng đường.
- Dùng kiểm khoảng cách chung cho đi thường, bước né, idle và từng bước của đường ghé quầy; tránh hero/người đi bộ/props nhỏ và thân xe cứu thương đã đỗ. Khi kiểm đường ghé dùng bước tiếp theo của tuyến thực, không xét đường thẳng tới đích qua tường. Người chắn tạm thời không làm hủy cache tuyến mỗi frame.
- Bỏ nhánh NPC chờ lâu rồi xuyên người. Chỗ không né được thì quay lại; khi chỉ lắc ngang mà không tiến được cũng quay lại sau1,8giây. Người đã chồng nhẹ do một cảnh khác được bước ra, không bị khóa trong nhau.
- Khi bắt đầu cứu hộ, khách đang ghé trở lại lối đi; chỉ nhóm4 người được chọn gần hero đứng xem như luồng cứu hộ đã có. Không tăng đám đông cứu hộ. Chưa sửa riêng thuật toán di chuyển bác sĩ hoặc xe trong phần này.

**Đã quan sát:** mở game local cổng5190 ở PC1280×720 và viewport dọc390×844; người qua đường thay vị trí, hai phía phố có người qua lại, chủ/khách quầy giữ cử động; lưu [ảnh PC](screenshots/flow2-street-pc.png), [ảnh mobile](screenshots/flow2-street-mobile.png). Console không có error ở các lần đọc. Rà các caller của route/visit và `git diff --check`; không chạy suite unit/e2e/typecheck/build, không dùng mô phỏng tự động. Ảnh tĩnh không chứng minh mọi trường hợp tránh nhau hoặc đủ16 NPC đang hiện trên màn.

**Bạn tự duyệt trước khi đóng T-101:**

1. Ở đầu/giữa/cuối phố: mật độ có vừa đủ sống động; người đi hai chiều, không thành một hàng dính nhau. Không yêu cầu chủ quầy hoặc người đang hội thoại luôn phải đi.
2. Quan sát một khách ghé quầy rồi rời đi; đứng chắn lối ghé và dời đi để xem họ tiếp tục hoặc bỏ chuyến, không mắc lại bên quầy. Không có nhiều khách ghé từ dòng người đứng cùng một điểm.
3. Đứng giữa dòng người ở cả hai vỉa hè; họ né hoặc quay lại thay vì xuyên người. Đẩy tình huống đối đầu cạnh cây/xe đỗ/ghế/quầy; không giật hướng hoặc lắc ngang vô hạn.
4. Đi dọc hai barie và miệng ngõ: còn lối cho hero và NPC, không spawn trong vật cản hoặc đứng chồng lên bảo vệ. Việc hero tự lách khi bị kẹt thuộc quy tắc RunService đã có, không đổi ở lượt này.
5. Gặp sự cố khi phố đông: nhóm gần đó tụ lại, những người khác còn hoạt động/thoát khỏi quầy; bác sĩ tiếp cận và khiêng được, xe đỗ không bị người đi xuyên. Chưa xác nhận hết trường hợp cứu hộ sau tăng mật độ.
6. Chơi trên điện thoại thật để duyệt độ mượt và cảm giác mật độ; chưa có số đo hiệu năng, không kết luận từ viewport giả lập.

Giữ nguyên toàn bộ asset, UI, điều khiển và luồng chuyển chương đã duyệt. Sau khi T-101 được duyệt mới triển khai mẫu mỹ thuật T-102.


## Triển khai luồng 3 — đoạn mẫu 2026-10-29

T-102 Doing, đã có [mẫu14 trong game](art/chapter1/STREET_SAMPLE_14.md) chờ duyệt. Hai quán nhìn từ phía sau quanh cột8–13 có chất liệu mái ngói/tôn, tường/shutter/điều hòa theo bộ nhà đang dùng. Master và WebP được lưu trong workspace; phần ngoài đoạn mẫu, UI, hero, map/collision, nền và camera không đổi.

Đã xem PC1280×720, dọc390×844 và ngang844×390; không thấy error console. Màn ngang còn cắt quán tiền cảnh. Chưa kiểm hết fade khi hero ở dưới mái, cảnh cứu hộ/miệng ngõ/hai đầu phố và hiệu năng thiết bị. Không chạy suite/typecheck/build. Đây chưa phải nghiệm thu toàn bộ luồng3.

Sau khi bạn duyệt vật liệu/tỷ lệ/hướng nhìn mẫu: mới làm thêm biến thể, mở rộng dãy quán và rà nền/camera/che khuất toàn màn. Không đổi toàn bộ art khi chưa duyệt mẫu trong game.


## Triển khai luồng 4 — 2026-10-29

T-103 Review. Xem [thay đổi, ảnh và checklist cứu hộ](gameplay/CHAPTER1_RESCUE_REVIEW.md). Giữ phần3 ở mốc mẫu chờ duyệt, không tự đánh dấu được duyệt hoặc nhân rộng.

Đã sửa điều kiện hai bác sĩ tới điểm đỡ, chờ chỗ xuống xe, chọn điểm có đường tới, chờ nhau khi khiêng và tránh thân xe khi tách người. Giãn hai điểm đỡ về đầu/chân và hạ độ nâng ảnh để hợp bàn tay; pose được cập nhật cùng khung. Không thay bộ ảnh hoặc tạo thêm VFX.

Đã nhìn trực tiếp PC một cảnh tiếp cận/khiêng gần xe dựng và kết thúc sang S04 sau sửa, lưu ảnh trước/sau chỉnh đội hình. Còn các góc ngõ, cả hai barie/hướng xe, nhánh bánh và mobile thật cần tự duyệt theo bảng. Không chạy unit/e2e/typecheck/build hoặc mô phỏng tự động toàn bản đồ. Chưa nghiệm thu toàn bộ luồng4.


## Luồng 3 làm lại toàn cảnh — 2026-10-29

Người dùng xác nhận **chưa duyệt luồng3**, yêu cầu bỏ cách dừng ở hai quán mẫu và làm kỹ cả phố. [Đợt15](art/chapter1/STREET_COHESION_15.md) thay phạm vi mẫu14: toàn dãy phía nam dùng6 biến thể cùng art, sửa khoảng lô/bóng chân, giãn các lớp nhà bắc, thay nền chân nhà và nối phố nền cùng dãy đối diện. Không sửa lối đi/collision/NPC/cứu hộ/UI/camera.

T-102 Review để người dùng duyệt lại toàn cảnh. Đã xem PC/dọc/ngang và overview; chưa đi kiểm hết từng góc hoặc đo thiết bị thật. Không chạy suite/typecheck/build. Các dòng đợt14 phía trên là lịch sử, không phải trạng thái đã được duyệt hoặc còn chặn việc triển khai toàn dãy.

### Luồng3 — ảnh tham chiếu mới, đợt16

Người dùng vẫn chưa duyệt đợt15. [Bản sửa16](art/chapter1/STREET_REFERENCE_16.md) thay mặt tiền dãy gần, thêm vật liệu nhựa đường, đá lát ấm/cống/rãnh và bóng cây tĩnh theo ảnh mẫu. T-102 vẫn Review; nhà còn lặp, vỉa hè còn rộng, chưa kiểm mọi góc/thiết bị thật. Đã xem PC/mobile giả lập, không chạy suite/typecheck/build.

## Triển khai luồng 5 — 2026-10-29

Người dùng duyệt luồng3 và4; đóng T-102/T-103 theo duyệt, không tự suy thành đã kiểm điện thoại thật. T-104 Review triển khai, chờ duyệt nội dung.

Xem [ma trận12 sự cố và17 ca duyệt](gameplay/CHAPTER1_INCIDENT_REVIEW.md). Thêm bộ chọn DEV `?incidentReview=cat`, dùng save bộ nhớ và dừng chia ngẫu nhiên để xem mỗi loại/nhánh. Vẫn dùng logic hit/cứu hộ/chuyển chương thực; các nhánh dựng sẵn không chứng minh điều kiện mở nhánh tự nhiên.

Sửa lá bài trùng tích lũy, cap khi nhịp đôi/nhánh phụ, tăng cảnh báo chuối/bẫy phụ, kiểm khoảng trống điểm rơi và đoạn va chạm xe/chim/cầu/dép. Không thêm kết thúc sống đủ thời gian hoặc sửa mỹ thuật đã duyệt. Không chạy suite/typecheck/build; chưa chơi hết17ca hoặc nghiệm thu thiết bị thật.

## Triển khai luồng6 — 2026-10-29

Người dùng duyệt luồng5, T-104 Done. [Luồng6](gameplay/CHAPTER1_UI_REVIEW.md) đang Review: input/menu, safe area, độ đọc thoại và xử lý lỗi tải. Chưa kiểm runtime mới do browser không khả dụng; cần kiểm các mục trong checklist trước khi duyệt. Không suite/typecheck/build.

Luồng6 lượt tiếp tục: browser đã hoạt động; xem menu dọc/ngang và xoay khi đang mở. Sửa Enter/Space xuyên modal, ẩn bảng DEV và nhãn hazard cắt mép. Xem bằng chứng trong CHAPTER1_UI_REVIEW; T-105 còn Review, chưa kiểm đủ checklist.

## Triển khai luồng7 — 2026-10-29

Người dùng duyệt luồng6. T-106 Review: xem [kiểm kê âm và cách nghe duyệt](gameplay/CHAPTER1_AUDIO_REVIEW.md). Sửa master mute/catch-up/cleanup và thêm cue còn thiếu bằng synth nội bộ. Chưa nghe/đo/kiểm mobile thật, chưa Done; không suite/typecheck/build.

## Triển khai luồng8 và phản hồi ảnh — 2026-10-29

Người dùng duyệt luồng7. [Luồng8](performance/FLOW8_HANDOFF.md) có profiler Phaser/report, baseline local, manifest/gói ZIP. Build/typecheck đã được cho phép và qua; không test. Phạm vi web+Android; chưa có số đo Android, còn khựng khởi tạo/chuyển cảnh nên T-107 Review. Phản hồi ảnh mới bổ sung sửa xe đỗ, vào giữa map, NPC/collider và thoại; cần rà lại cứu hộ sau sửa.
