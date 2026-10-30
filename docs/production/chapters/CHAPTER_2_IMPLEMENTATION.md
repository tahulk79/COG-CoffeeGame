# Màn 2 · Kế hoạch triển khai theo luồng

> 2026-10-30 · Luồng 1–8 đã triển khai, chờ duyệt. Ngày 2026-10-30 người dùng cho phép test/build; đổi sang đảo mây theo ảnh mẫu, xem [báo cáo nghiệm thu web](../../art/chapter2/ISLAND_ACCEPTANCE.md).
> Nguồn: [CHAPTER_2](CHAPTER_2.md), [PROMPTS](../../art/chapter2/PROMPTS.md).
> Trạng thái công việc chỉ theo dõi tại [TASK_LIST](../../task-list/TASK_LIST.md), T-110–T-118.

## Cách phối hợp

- Codex làm một luồng mỗi lượt, đọc và rà code liên quan, bàn giao phần đã làm cùng cách vào thử và checklist ngắn.
- Người dùng tự chạy game và test. Không tự chạy game, unit/e2e, typecheck hoặc build; không tạo test mới hoặc đóng gói ZIP/manifest.
- Bàn giao chuyển task sang Review. Chỉ chuyển Done khi người dùng duyệt; phản hồi lỗi thì sửa trong cùng luồng.
- Chỉ bắt đầu luồng kế khi người dùng duyệt và yêu cầu làm tiếp. Không tự làm gộp các luồng sau.
- Nếu lỗi thuộc phần đã duyệt làm cản luồng hiện tại, sửa và ghi rõ phần cần người dùng kiểm tra lại.
- Giữ các thay đổi đang có trong workspace. Không tự commit, push hoặc triển khai Màn 3.

## Luồng 1 · Mở màn và nối Màn 1 → 2 (T-111)

**Codex làm:** rà đường chuyển S03 → S04, giữ nguyên nhân ngất, câu trả lời đúng và hai câu nhiễu; chỉnh thứ tự thủ tục → twist → Thần Cà Phê nhận nhầm → hướng dẫn. Vào thẳng `?chap=2` vẫn chơi được. Chặn di chuyển/chạm đi trong lúc thoại, lựa chọn chỉ nhận một lần, thoát thoại trả điều khiển đúng. Giữ art tạm.

**Người dùng thử:** vào từ Màn 1 với ít nhất hai nguyên nhân ngất; vào thẳng Màn 2; chọn đúng/sai; bấm nhanh Tiếp và thử đi khi đang nói.

**Duyệt khi:** hồ sơ khớp cú ngất; không cộng/trừ Phúc Đức ở thủ tục; twist rõ; hết thoại đi được và không kẹt. Nhịp mở màn đủ gọn theo cảm nhận người dùng.

**Bàn giao 2026-10-30:** giữ đường truyền `story.scenario` sẵn có qua S03 → S04; đổi cách rút hai câu nhiễu sang xáo trộn không dùng random comparator, loại đáp án trùng. Chặn chọn lại sau khi đã trả lời; hiệu ứng đúng/sai phát lúc Thần Chết đọc hồ sơ, sau câu nhắc đáp án của nhân vật. Gộp twist thành một lượt thoại, thêm hướng dẫn đi/chọn đáp án. Khoá cả gesture thế giới khi thoại và xoá hướng đi/phím giữ khi đổi trạng thái khoá; bỏ key repeat Enter/Space và 1/2/3 ở Màn 2, chặn hai lần Tiếp trong cùng khung hình. Giữ art và điểm hiện tại. Chỉ đọc/rà code, chưa chạy game/test/typecheck/build.

**Cách tự thử luồng 1:**

1. Trên địa chỉ dev đang dùng, thêm `?chap=2`. Đọc hai câu chào, tới câu hỏi thì chạm nền hoặc bấm Enter: câu hỏi phải giữ nguyên, đủ ba đáp án.
2. Chọn một đáp án rồi bấm lại số đó: nhân vật chỉ nhận một câu trả lời; bấm Tiếp mới tới hồ sơ và hiệu ứng. Thủ tục không thay đổi Phúc Đức.
3. Giữ Enter/Space: không tự lướt nhiều câu. Thử phím di chuyển/kéo joystick khi đang thoại: nhân vật đứng yên; hết câu chia tay, thao tác đi mới phải hoạt động bình thường.
4. Vào `?chap=1` và gặp sự cố; đi hết cứu hộ để sang Màn 2 trong cùng lượt, không reload. Chọn đúng nguyên nhân và đối chiếu hồ sơ/câu chia tay. Lặp lại với nguyên nhân khác, lần này chọn câu nhiễu; hồ sơ vẫn phải đọc đúng nguyên nhân thật.
5. Mở Cài đặt khi đang nói/hỏi: Enter/Space và 1/2/3 không xử lý thoại sau menu; đóng menu tiếp tục được.

Reload vẫn khởi động lại chương theo tham số URL như quy tắc hiện tại, không dùng reload để thử giữ nguyên nhân giữa hai màn.

## Luồng 2 · Đi đường và năm trạm (T-112)

**Codex làm:** hoàn thiện chặn đường và kích hoạt đúng thứ tự; mỗi trạm chào → hỏi → nhân vật nhắc đáp án → NPC đáp → lời nhắn → Đi tiếp. Rà đồng hồ 6 giây, hết giờ vẫn qua; không bấm nền bỏ qua câu hỏi hoặc vượt trạm. Trạm đạo đức gọi lại cú ngất khi đi từ Màn 1. Chỉnh khoảng cách/nhịp đi nếu cần, vẫn giữ art tạm.

**Người dùng thử:** đi qua cả năm trạm bằng phím/joystick/chạm; chọn đáp án và để hết giờ; thử đi vòng rào, bấm liên tiếp và quay lại trạm đã qua.

**Duyệt khi:** mỗi trạm chỉ hoàn thành một lần; đủ năm lời nhắn; không mất điều khiển, vượt trạm hoặc đứng kẹt. Ghi nhận tổng thời gian chơi, mục tiêu 3–5 phút.

**Bàn giao 2026-10-30:** nối `Actor.canMove` tới cùng quy tắc va chạm của `TrialService` cho phím/joystick/chạm đi; kiểm tra rào trước khi đi qua, thay vì chỉ kéo vị trí ngược lại sau bước đi. Giữ giới hạn theo trạm đầu tiên chưa hoàn thành trên toàn bề rộng đường. Thêm chặn mở/hoàn thành lại trạm; đáp án chỉ nhận khi đang hỏi và trạm chưa xong. Giữ chuỗi chào → hỏi → hero nhắc đáp án → NPC đáp → lời nhắn → Đi tiếp. Dời cue đúng/sai tới câu NPC đáp; dùng đồng hồ mô phỏng cho hiệu ứng, tránh lệch giờ scene. Đồng hồ chỉ chạy sau khi mở câu hỏi; hết giờ xoá lựa chọn, không đổi điểm, vẫn nhận lời nhắn và qua trạm. Giữ vị trí trạm/khoảng cách, art và trọng số điểm; chờ người dùng đánh giá nhịp trước khi chỉnh. Trạm 3 vẫn ưu tiên `q_faint` khi mang `story.scenario` từ Màn 1, vào thẳng vẫn rút ngẫu nhiên. Chỉ đọc/rà code, chưa chạy game/test/typecheck/build.

**Cách tự thử luồng 2:**

1. Vào `?chap=2`, đọc hết mở màn. Chạm một điểm xa sau các rào rồi thử phím/joystick sát hai mép đường: phải gặp đúng trạm đầu chưa qua, không xuyên rào hoặc bị kéo giật từ phía bên kia.
2. Ở trạm 1, dừng tại câu chào vài giây: đồng hồ chưa chạy. Bấm Tiếp để mở câu hỏi; không chọn trong 6 giây: hiện câu hết giờ, rồi Lời nhắn, nút Đi tiếp; nhận đúng một lời nhắn và một chấm tiến độ.
3. Ở trạm 2/3/5, để câu hỏi mở hơn 6 giây: không tự chọn hoặc hết giờ. Chạm nền/Enter không bỏ qua; chọn đáp án → hero nói → NPC đáp và hiệu ứng → Sổ ghi lời nhắn. Trong toàn bộ chuỗi nhân vật đứng yên.
4. Ở trạm 4, chọn nhanh gần hết giờ và bấm liên tiếp: chỉ có một kết quả, không phát thêm câu hết giờ sau khi đã chọn. Thử đi ngược về trạm cũ: không hỏi lại hoặc nhận thêm thẻ. Qua hết trạm 5 phải có năm chấm và năm lời nhắn; chưa cần duyệt cửa/vòng quay trong luồng này.
5. Chơi Màn 1 → 2 trong cùng lượt: trạm 3 phải hỏi về người ngất giữa phố. Trên mobile, đổi giữa chạm đi và joystick sau khi đóng footer; mỗi trạm phải trả điều khiển bình thường. Ghi nhận thời lượng và đoạn đọc/đi quá dài để phản hồi.

## Luồng 3 · Phúc Đức, kho câu hỏi và Sổ (T-113)

**Codex làm:** đồng bộ bảng điểm tài liệu/config/HUD. Phương án mặc định để người dùng duyệt cùng kế hoạch: giữ trọng số đáp án hiện có, dùng khoảng −4…+5, mức cao ≥4, trung bình ≥1, thấp <1. Bổ sung tối thiểu bốn câu/trạm, giữ câu hài không phạt ở trạm 1 và thủ tục. Rà sổ, thứ tự thẻ, chống ghi trùng, tổng điểm và trạng thái mở sổ không cho input xuyên xuống thế giới. Chưa tách dịch vi/en.

**Người dùng thử:** một lượt chọn tốt, một lượt chọn bất lợi; mở/đóng sổ sau từng trạm; chơi lại để xem câu khác, kiểm tra trạm 3 khi nối từ Màn 1.

**Duyệt khi:** điểm đúng quy tắc, thẻ đủ và không trùng; đọc lại được lời nhắn; chơi lại không mang nhầm điểm/thẻ của lượt cũ. Nếu người dùng chọn giữ mốc +6 thì điều chỉnh trọng số rõ ràng trước khi code luồng này.

**Bàn giao 2026-10-30:** cấu hình −4…+5, cao ≥4, trung bình ≥1; HUD hiện số điểm, Sổ dùng cùng ngưỡng với Bà Gác Cửa. Bổ sung `q_no_one_watching` (trạm 4) và `q_small_start` (trạm 5), đủ 20 câu/4 câu mỗi trạm. Điểm chỉ ghi cùng lời nhắn/cờ trạm khi hiện Lời nhắn; ghi thẻ kiểm tra ID và chống ghi trùng, giữ số thứ tự đã có. Sổ chuyển sang `GameModal` sẵn có và đăng ký `ModalManager`: mỗi trang một lời nhắn, Trước/Sau/✕, tổng điểm/mức và số thẻ. Thế giới/câu hỏi/thoại dừng khi Sổ mở, kể cả input phím và trong hoạt ảnh đóng. Giữ quy tắc boot/reload khởi động lại chương theo URL; không thêm lưu checkpoint giữa trang. Chỉ đọc/rà code, chưa chạy game/test/typecheck/build.

**Cách tự thử luồng 3:**

1. Vào `?chap=2`, mở Sổ trước trạm 1: điểm 0, mức Thấp, 0/5 thẻ; nút Trước/Sau không lật được. Đóng bằng ✕, chạm nền hoặc Esc.
2. Sau mỗi trạm, tới dòng Lời nhắn mới kiểm tra HUD/Sổ: điểm và số thẻ cùng cập nhật một lần. Lật tới/lui giữ đúng thứ tự; bấm đáp án liên tiếp hoặc quay về trạm cũ không tăng thêm điểm/thẻ.
3. Một lượt chọn phương án tốt nhất: trạm 1 +0, trạm 2 +1, trạm 3 +2, trạm 4 +1, trạm 5 +1 → cuối cùng +5, mức Cao, 5 thẻ. Một lượt chọn bất lợi: điểm ≤0 → mức Thấp; khoảng 1–3 → Trung bình. Không phải bộ câu nào cũng có đáp án để đạt −4. Hết giờ trạm 1/4 chỉ nhận lời nhắn, không đổi điểm.
4. Mở Sổ giữa câu hỏi đếm giờ, chờ hơn 6 giây; thử đi, Enter/Space và 1/2/3 khi Sổ đang mở: không di chuyển/đổi thoại/chọn đáp án; đóng Sổ tiếp tục đúng thời gian còn lại. Xoay dọc/ngang và lật trang, chữ/nút không tràn. Mở Cài đặt sau khi đóng Sổ, thử lại để kiểm tra cùng hệ thống modal.
5. Tải lại `?chap=2` để bắt đầu lượt mới: điểm 0/thẻ rỗng. Chơi lại vài lượt để xem kho câu hỏi, có thể rút trùng; nối Màn 1 → 2 vẫn ưu tiên câu người ngất ở trạm 3. Chưa làm gameplay Màn 3 hoặc luồng 4.

## Luồng 4 · Bà Gác Cửa và kết màn (T-114)

**Codex làm:** hoàn thiện lời khuyên ba mức, hai lựa chọn, gag đếm ngược bằng lượt thoại, mở cửa và vòng quay. Bảo đảm vòng quay luôn dừng ở chủ quán cà phê, chỉ chuyển chương một lần; mang đúng Phúc Đức/lời nhắn tới S05 và hiển thị thẻ Sắp ra mắt. Chưa làm vốn, vật phẩm hoặc gameplay Màn 3.

**Người dùng thử:** cả hai lựa chọn ở cửa; các mức điểm cao/trung bình/thấp qua những lượt chơi; mở menu khi quay và trở lại.

**Duyệt khi:** lời khuyên đúng mức; không mắc ở cửa/vòng quay; kết quả và điểm mang sang chính xác. Đến đây duyệt xong gameplay trước khi thay art hàng loạt.

**Bàn giao 2026-10-30:** giữ ba lời khuyên đọc ngưỡng chung từ config và hai nhánh Sẵn sàng/Nghĩ thêm (đếm bằng từng lượt thoại). Thêm chặn gọi lại Bà/mở cửa khi chưa đủ trạm hoặc đã mở. Cửa mở 700 ms rồi quay 3,8 giây, giữ kết quả 3,2 giây; dừng di chuyển, ẩn HUD trạm/Sổ trong toàn bộ đoạn kết. Portal chỉ được chuyển chương sau pha `done`; vòng quay chỉ xử lý khi pha `spin`, gọi chuyển một lần. Giữ kết quả cố định theo `spin.result`, không rút ngẫu nhiên. Thẻ Màn 3 đọc counters giữ nguyên từ lượt Màn 2, hiện điểm/số thẻ và danh sách lời nhắn đúng thứ tự bằng nội dung text; danh sách mở gọn và cuộn trên màn ngắn. Nút chơi lại bỏ query để thật sự về Màn 1; dọn thẻ DOM khi scene đóng. Chỉ đọc/rà code, chưa chạy game/test/typecheck/build. Chưa tạo art hoặc gameplay Màn 3.

**Cách tự thử luồng 4:**

1. Qua đủ năm trạm, ghi lại điểm và lời nhắn trong Sổ rồi tiến tới Bà. Điểm ≥4 → lời khuyên sổ sáng; 1–3 → chưa sáng lắm; ≤0 → ai cũng có lần làm lại. Thử các mức qua những lượt chơi, không sửa điểm thủ công.
2. Chọn Sẵn sàng: hero nhắc đáp án → Bà đáp → cửa mở → vòng quay. Lượt khác chọn Nghĩ thêm: phải qua các câu 3/2/1/Vào theo lượt bấm, không quay lại câu hỏi và không mất điểm. Bấm nhanh 1/2 nhiều lần chỉ nhận một lựa chọn.
3. Lúc cửa mở và đang quay, thử chạm cửa/đường và phím di chuyển: không đi hoặc nhảy sang Màn 3 sớm. Vòng quay luôn dừng ở Chủ một quán cà phê nhỏ, giữ ngắn kết quả rồi chỉ chuyển cảnh một lần.
4. Mở Cài đặt giữa vòng quay, chờ vài giây rồi đóng: phải tiếp tục từ nhịp cũ, không tự kết thúc phía sau menu. Thử cả khi vòng quay đã dừng.
5. Thẻ Sắp ra mắt phải hiện đúng điểm và 5 lời nhắn mang sang; mở danh sách, đối chiếu thứ tự/nội dung với Sổ. Xoay màn để kiểm tra cuộn/đọc và nút chơi lại. Bấm Chơi lại chương 1 khi xuất phát từ `?chap=2`: phải về Màn 1. Vào thẳng `?chap=3` không có lượt Màn 2 thì hiển thị số liệu có trong trạng thái, không tự bịa năm thẻ.

## Luồng 5 · Mẫu art tích hợp (T-115)

**Codex làm:** chuẩn hoá mã asset, góc nhìn, pivot chân, kích thước hiển thị và lề an toàn trong PROMPTS. Tạo rồi tích hợp mẫu Ông Đồ IQ với bốn trạng thái, chân dung tương ứng và rào mây. Mở rộng khai báo/chia frame/export WebP hiện có cho chapter2; dùng ảnh trong footer thay vì chỉ callback Graphics. Giữ hình tạm cho các phần còn lại. Dùng asset Màn 1 làm tham chiếu; tạo ảnh mẫu thuộc phạm vi luồng này, không yêu cầu người dùng tự chuẩn bị file.

**Người dùng thử:** trạm 1 trên PC và điện thoại, quan sát đứng/nói/phản ứng, chân dung và rào tan.

**Duyệt khi:** phong cách hợp Màn 1; không đổi kích thước/nhảy chân khi đổi pose; chân dung rõ; rào không che nhân vật sai chiều sâu. Chưa nhân rộng trước khi mẫu được duyệt.

**Bàn giao 2026-10-30:** imagegen tích hợp tạo ba PNG mẫu Ông Đồ/portrait/rào; giữ bản sinh gốc, chuẩn hoá lưới và xuất ba WebP khoảng 160 KiB tổng. Thêm `CHAPTER2_SLICE_ASSETS` giữ full cell/pivot; mở rộng pipeline nạp/chia frame/export sẵn có. Chỉ trạm 1 dùng ảnh mới; bốn pose theo trạng thái lời thoại, NPC lật ngang hướng về người chơi phía trái và bù origin X. Rào mẫu đặt sau người và ghép solid/wisps khi tan, không đổi va chạm. Footer thêm texture portrait tuỳ chọn và giữ painter fallback. Đồng bộ mã asset/quy cách trong PROMPTS và CHAPTER_2; nguồn/prompt/giới hạn ở [SAMPLE_PASS_01](../../art/chapter2/SAMPLE_PASS_01.md). Đã xem ảnh/metadata/xuất WebP/rà caller, chưa mở game hoặc chạy test/typecheck/build. Chờ duyệt trước khi nhân rộng.

**Cách tự thử luồng 5:**

1. Vào `?chap=2`, đọc hết mở màn: Thần Chết/cốc và các phần còn lại vẫn hình tạm. Tiến tới trạm 1, Ông Đồ phải là sprite áo dài xanh, có bảng và râu trắng; mặt hướng về phía người chơi.
2. Quan sát lúc chưa nói → chào/hỏi → phản hồi: đứng/nói/vui/sốc đổi theo câu. Câu có mood sai mới dùng shocked; các câu hài có thể đều vui. Chân, cỡ người và bảng không bị giật/đổi scale khi đổi pose. Chơi lại có thể rút câu cũ.
3. Footer Ông Đồ trạm 1 dùng chân dung mới. Chuyển sang hero, Sổ và NPC trạm 2: không còn ảnh Ông Đồ đè lên chân dung khác; xoay PC/mobile dọc/ngang để xem mặt không che chữ/nút.
4. Rào trạm 1 là mây viền vàng, nằm ngang bề rộng đường theo góc isometric. Thử sát hai mép trước khi trả lời: vẫn bị chặn. Tới Lời nhắn, rào tan rồi biến mất; hero không bị rào phủ kín khi đang nói/đi qua.
5. Đi tiếp tới trạm 4: Ông Đồ/rào ở đó vẫn bản code cũ, đúng phạm vi mẫu. Sau chuyển chương/chơi lại không xuất hiện ảnh mẫu trùng hoặc sót. Gửi cảm nhận phong cách, tỉ lệ người/mặt/rào trước khi duyệt luồng 6.

## Luồng 6 · Toàn bộ nhân vật và chân dung (T-116)

**Codex làm:** theo mẫu đã duyệt, hoàn thiện Thần Chết, Thần Cà Phê, Thủ Thư, Ông Cân và Bà Gác Cửa; hoàn tất các sheet nhân vật/chân dung, map trạng thái và frame. Tái dùng chân dung hero hiện có nếu phù hợp. Bốn tư thế là bốn trạng thái; chuyển động nhẹ bằng code, chưa làm animation nhiều frame mới.

**Người dùng thử:** mở màn, từng trạm và cửa; chú ý muôi phở, cái cân, đèn lồng, cánh cốc và chân dung người nói.

**Duyệt khi:** đúng nhân vật/trạng thái; đồng nhất tỉ lệ và nét vẽ; không cắt tay/đầu, chồng hình cũ hoặc hiện sai chân dung.

**Bàn giao 2026-10-30:** imagegen tạo bộ Thủ Thư/Ông Cân/Bà, hai thần và sáu chân dung bổ sung, có lượt bỏ nền. Chuẩn hoá hàng/cột theo nguồn thực để không cắt chân Thần Chết hoặc tràn đèn lồng; xuất ba WebP, giữ đủ ô/pivot. Ông Đồ và portrait mẫu dùng lại cả trạm 1/4 với sprite riêng theo ID; hero giữ art cũ. Cốc bay dùng sprite thay hình vẽ, biểu cảm sốc/xin lỗi theo hướng diễn dòng thoại độc lập điểm. Footer nhận texture kèm frame để đổi đủ chân dung, giữ fallback và cleanup. Nguồn/prompt/metadata ở [CHARACTER_PASS_02](../../art/chapter2/CHARACTER_PASS_02.md). Chỉ xem ảnh/metadata/xuất WebP/rà code, chưa mở game hoặc chạy test/typecheck/build. Giữ môi trường/rào mẫu như luồng 5.

**Cách tự thử luồng 6:**

1. Vào `?chap=2`: Thần Chết có áo choàng, muôi phở, hồ sơ; khi đọc thì pose nói, khai đúng thì đóng dấu, phát hiện ghi nhầm thì sốc. Thần Cà Phê là cốc trắng có cánh, cúi đầu ở câu nhận lỗi rồi nói bình thường khi hướng dẫn. Lượt khác khai sai để xem phản ứng sốc.
2. Đi hết năm trạm: Ông Đồ ở trạm 1 và 4 đều dùng ảnh mẫu nhưng đứng đúng vị trí, không biến mất hoặc nhảy sang trạm kia; Thủ Thư có kính/sách, Ông Cân có cân vàng, Bà có khăn tím/đèn đỏ. Thử đáp án tốt/xấu và hết giờ để xem đổi pose, chân và tỷ lệ giữ ổn định.
3. Cốc tiếp tục bay theo hero rồi tới trạm 5, không xuất hiện một cốc thứ hai hoặc hình cũ đè lên sprite; mở Cài đặt để kiểm tra cốc ngừng nhún khi mô phỏng dừng.
4. Đổi qua từng người nói, hero và Sổ: chân dung đúng người, không sót ảnh cũ, không cắt muôi/đèn lồng hoặc che câu/nút. Xoay mobile dọc/ngang khi đang thoại.
5. Tới Bà, chọn cả hai nhánh qua hai lượt; rời màn rồi chơi lại: không sót sprite/portrait từ scene cũ. Môi trường và rào ngoài trạm 1 vẫn hình cũ, chờ luồng 7.

## Luồng 7 · Môi trường và cửa trùng sinh (T-117)

**Codex làm:** tạo và tích hợp cửa đóng/mở, mặt đường mây, props và nền trời. Nối tile đúng lưới 2:1, giữ vùng đi/va chạm, sắp chiều sâu; trời hồng chuyển vàng theo tiến độ. Tái sử dụng phần rào đã duyệt, bổ sung chuyển tan nếu cần. Rà tải texture theo chương và dọn đối tượng khi rời scene bằng đọc code; không báo số đo hiệu năng khi chưa đo.

**Người dùng thử:** đi hết đường trên PC/mobile dọc/ngang; đứng trước/sau cây/cột/cửa; quan sát khe tile, độ rõ đường đi và chuyển màu trời.

**Duyệt khi:** không lộ khe hoặc mép nền; props không che câu hỏi/lối đi; cửa mở khớp kết màn; cảnh rõ trên cả ba bố cục.

**Bàn giao 2026-10-30:** imagegen tạo vật liệu mây, cửa đóng/mở, sáu props và trời hồng/vàng; xuất bốn WebP, lưu nguồn/prompt trong [ENVIRONMENT_PASS_03](../../art/chapter2/ENVIRONMENT_PASS_03.md). Mặt đường dùng UV liên tục và bake theo dải 8 ô, bỏ nền ô/rừng cũ; ghép mép mây bằng ảnh đã có. Sprite cây/cột/cửa theo map, cảnh phụ ngoài vùng đi, làm mờ props che hero. Mỗi trạm có cặp solid/wisps riêng, đủ 5 rào. Trời phủ viewport giữ tỷ lệ, crop theo X hero; C2 chỉ xếp tải khi vào afterlife, canvas nền tạm/sky/walls được dọn khi rời scene. Không sửa `afterlife.json`, luật va chạm, điểm hoặc nhịp chuyển chương. Chỉ đọc/rà code và xem ảnh/metadata/WebP trên nền tĩnh; chưa mở game/test/typecheck/build, chưa đo FPS/tải/RAM.

**Cách tự thử luồng 7:**

1. Vào `?chap=2` rồi thử lượt Màn 1 → 2: cả hai phải tải đủ cảnh mới, không còn nền rừng xanh/ô bàn cờ và không báo thiếu ảnh. Đi từ đầu tới cuối, chú ý các đoạn khoảng x8/16/24/32/40 để tìm khe mảng hoặc đường kẻ sáng.
2. Đi sát hai mép, quanh cây/cột và quay lại trạm cũ: phạm vi đi vẫn như trước, không lọt qua rào chưa trả lời; cây/cột/cửa che hero phía sau phải mờ. Đèn/bảng/chuông/ghế chỉ trang trí ngoài mép, không tạo chỗ kẹt mới.
3. Qua từng trạm: đủ 5 rào ảnh và tan đúng rào khi nhận Lời nhắn, không làm rào khác biến mất hoặc sót hình cũ. Đọc thoại trên mobile để xem rào/cảnh không phủ hero hoặc footer.
4. Đầu đường trời hồng, gần Bà/cửa vàng hơn; đi lùi thấy trời trở hồng dần. Xoay dọc/ngang và đổi cỡ cửa sổ: trời phải phủ kín, không kéo méo hoặc lộ nền trống. Quan sát props trước/sau hero và vị trí chân so với đường.
5. Tới cửa: đóng đúng vị trí trước chọn, mở cùng khung sau thoại Bà, có ánh sáng rồi vòng quay/chuyển S05. Chơi lại Màn 1 → 2 để kiểm tra không sót scene cũ hoặc nhân đôi nền/rào/props. Gửi ảnh nếu lệch vị trí/kích thước/che khuất; luồng 8 chưa làm.

## Luồng 8 · UI, âm thanh, hiệu ứng và bàn giao (T-118)

**Codex làm:** hoàn thiện icon sen/sổ/SAI/đồng hồ, phản hồi đúng/sai, thẻ vào sổ, ánh sáng cửa và âm thanh theo sự kiện; giữ nền synth hiện có, chưa cần nhạc/file âm thanh ngoài. Rà footer và menu ở dọc/ngang, safe area, nút ≥44px, câu dài, chặn input, mute/ẩn tab và giảm chuyển động. Chỉ thêm zoom thoại nếu giữ đủ người nói và nhân vật trên mobile. Đồng bộ tài liệu và ghi giới hạn còn lại.

**Người dùng thử:** một lượt trọn Màn 1 → 2 → thẻ Màn 3; một lượt vào thẳng Màn 2; xoay màn khi hỏi, mở/đóng menu và sổ, mute/bật âm, ẩn/hiện tab, thử giảm chuyển động.

**Duyệt khi:** không lỗi cản chơi, mọi chữ/nút đọc và bấm được; âm thanh đúng trạng thái; hiệu ứng không che đáp án. Người dùng xác nhận thời lượng và độ mượt trên thiết bị thực tế; không xem kế hoạch này là cam kết FPS/tải đã được đo.

## Mẫu bàn giao mỗi luồng

1. Đã làm: nêu thay đổi người chơi nhìn thấy.
2. Cách thử: URL/đường vào và 3–5 thao tác cụ thể.
3. Mong đợi: dấu hiệu để người dùng xác nhận.
4. Chưa xác minh: ghi rõ chưa chạy game/test/typecheck/build và điểm còn chờ tự test.
5. Dừng ở Review, chờ phản hồi; chưa triển khai luồng tiếp.


## Cập nhật theo ảnh mẫu — T-120 (2026-10-30)

Thay map hành lang 46×9 bằng mask điều hướng 42×42 khớp nền đảo mây. Trên PC rộng camera nhìn cả khu chơi; điện thoại/màn dọc bám nhân vật. Năm trạm vẫn theo thứ tự, kích hoạt khi tới gần đúng NPC, không còn rào vô hình cắt ngang đảo. Đền trên cầu là đích chuyển sinh; cổng trái là cảnh trí. UI mới có khung nhiệm vụ, tiến độ, phúc đức, hội thoại và menu ảnh; bản đồ mở toàn cảnh, túi và nhật ký cùng mở các lời nhắn đã thu (chưa có hệ inventory riêng).

T-118 chuyển Review cùng lượt ghép này: icon/cue/sổ/ánh cửa, nền synth, pause modal/ẩn tab và giảm chuyển động đã nối. Phần đã test và các giới hạn nghiệm thu được ghi riêng trong [ISLAND_ACCEPTANCE](../../art/chapter2/ISLAND_ACCEPTANCE.md); không coi là đã nghiệm thu thiết bị thật hoặc chất lượng âm thanh.
